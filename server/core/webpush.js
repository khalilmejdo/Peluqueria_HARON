/**
 * Web Push, ecrit a la main.
 *
 * Le depot n'a qu'une seule dependance, « pg », et ce n'est pas une coquetterie :
 * chaque paquet ajoute est du code que personne ici ne relit, qui se met a jour
 * tout seul, et qui tourne avec les cles du salon a portee de main. Le protocole
 * de notification tient en deux normes courtes et n'utilise que « node:crypto ».
 *
 *   RFC 8291  chiffrement du message      (ECDH P-256, HKDF, AES-128-GCM)
 *   RFC 8188  le format « aes128gcm »     (l'en-tete binaire du corps)
 *   RFC 8292  VAPID                       (le jeton qui identifie le serveur)
 *
 * CE QUE VOIT LE SERVICE DE NOTIFICATION. Google, Apple ou Mozilla relaient le
 * message jusqu'au telephone du coiffeur. Ils voient l'adresse d'abonnement,
 * l'heure et la TAILLE du message — jamais son contenu : il est chiffre de bout
 * en bout, entre ce serveur et le navigateur du coiffeur, avec une cle qu'eux
 * n'ont pas. C'est la raison d'etre de RFC 8291, et c'est pourquoi on ne prend
 * pas le raccourci d'un service tiers « plus simple ».
 *
 * Aucune cle n'est en base : elles viennent de l'environnement, comme les
 * autres secrets. Sans elles, ce module ne fait rien du tout.
 */
import crypto from 'node:crypto';
import https from 'node:https';
import { URL } from 'node:url';

/* ------------------------------------------------------------------ */
/*  Base64url                                                          */
/* ------------------------------------------------------------------ */

export const versB64u = (buf) => Buffer.from(buf).toString('base64url');

/**
 * Le decodage est STRICT. Node accepte volontiers du base64 mal forme et rend
 * un tampon plus court que prevu ; une cle tronquee donnerait ici un secret
 * partage silencieusement faux, et des notifications qui ne partent jamais sans
 * qu'on sache pourquoi. On verifie donc la longueur attendue.
 */
export function depuisB64u(texte, longueurAttendue = null) {
  const buf = Buffer.from(String(texte || ''), 'base64url');
  if (longueurAttendue !== null && buf.length !== longueurAttendue) {
    throw new Error('Clé de ' + buf.length + ' octets, ' + longueurAttendue + ' attendus.');
  }
  return buf;
}

/* ------------------------------------------------------------------ */
/*  HKDF                                                               */
/* ------------------------------------------------------------------ */

const hmac = (cle, donnees) => crypto.createHmac('sha256', cle).update(donnees).digest();

/**
 * HKDF reduit au seul cas dont ces deux normes ont besoin : une sortie qui
 * tient dans un bloc SHA-256. Ecrire la boucle generale serait du code jamais
 * emprunte, donc jamais teste.
 */
function hkdf(sel, ikm, info, longueur) {
  if (longueur > 32) throw new Error('HKDF : un seul bloc ici.');
  const prk = hmac(sel, ikm);
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, longueur);
}

const infoContenu = (nom) => Buffer.concat([
  Buffer.from('Content-Encoding: ' + nom, 'ascii'),
  Buffer.from([0]),
]);

/* ------------------------------------------------------------------ */
/*  Chiffrement du message (RFC 8291)                                  */
/* ------------------------------------------------------------------ */

const TAILLE_ENREGISTREMENT = 4096;

/**
 * Chiffre un message pour UN abonnement.
 *
 * `cleEphemere` et `sel` ne sont la que pour les tests : ils permettent de
 * rejouer le vecteur de la RFC octet par octet. En service, ils sont tires au
 * hasard a chaque envoi — une cle ephemere reutilisee reduirait le chiffrement
 * a rien.
 *
 * @param {Buffer|string} message
 * @param {{ p256dh: string, auth: string }} abonnement  cles du navigateur, en base64url
 * @returns {Buffer} le corps de la requete, en « aes128gcm »
 */
export function chiffrer(message, abonnement, { cleEphemere = null, sel = null } = {}) {
  const clair = Buffer.isBuffer(message) ? message : Buffer.from(String(message), 'utf8');

  // 65 octets, non compresses, premier octet 0x04. Un navigateur n'en envoie
  // jamais d'autre forme ; une longueur differente est une donnee corrompue.
  const clientPublique = depuisB64u(abonnement.p256dh, 65);
  if (clientPublique[0] !== 0x04) throw new Error('Clé publique du navigateur mal formée.');
  const authentification = depuisB64u(abonnement.auth, 16);

  const ecdh = cleEphemere || crypto.createECDH('prime256v1');
  if (!cleEphemere) ecdh.generateKeys();
  const serveurPublique = ecdh.getPublicKey();
  const secretPartage = ecdh.computeSecret(clientPublique);

  // La cle d'entree melange le secret ECDH, le secret d'authentification de
  // l'abonnement, ET LES DEUX CLES PUBLIQUES. Ces deux dernieres lient le
  // message a cette paire precise : rejoue vers un autre abonne, il ne
  // dechiffre rien.
  const infoCle = Buffer.concat([
    Buffer.from('WebPush: info', 'ascii'),
    Buffer.from([0]),
    clientPublique,
    serveurPublique,
  ]);
  const ikm = hkdf(authentification, secretPartage, infoCle, 32);

  const selUtilise = sel || crypto.randomBytes(16);
  const cle = hkdf(selUtilise, ikm, infoContenu('aes128gcm'), 16);
  const nonce = hkdf(selUtilise, ikm, infoContenu('nonce'), 12);

  // 0x02 ferme le dernier (et unique) enregistrement. Avec 0x01 le navigateur
  // attendrait la suite et ne montrerait jamais la notification.
  const aChiffrer = Buffer.concat([clair, Buffer.from([2])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cle, nonce);
  const chiffre = Buffer.concat([cipher.update(aChiffrer), cipher.final(), cipher.getAuthTag()]);

  const tailleEnregistrement = Buffer.alloc(4);
  tailleEnregistrement.writeUInt32BE(TAILLE_ENREGISTREMENT, 0);

  return Buffer.concat([
    selUtilise,
    tailleEnregistrement,
    Buffer.from([serveurPublique.length]),
    serveurPublique,
    chiffre,
  ]);
}

/* ------------------------------------------------------------------ */
/*  VAPID (RFC 8292)                                                   */
/* ------------------------------------------------------------------ */

/**
 * Reconstruit la cle privee a partir des deux chaines base64url du `.env`.
 *
 * VAPID transporte la cle privee comme 32 octets bruts, ce que « node:crypto »
 * ne sait pas lire directement : on passe par une JWK, dont les coordonnees x
 * et y sont les deux moities de la cle publique.
 */
function clePriveeDepuisBrut(publiqueB64u, priveeB64u) {
  const publique = depuisB64u(publiqueB64u, 65);
  if (publique[0] !== 0x04) throw new Error('Clé publique VAPID mal formée.');
  return crypto.createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: versB64u(publique.subarray(1, 33)),
      y: versB64u(publique.subarray(33, 65)),
      d: versB64u(depuisB64u(priveeB64u, 32)),
    },
  });
}

/** Une paire de cles VAPID, sous la forme attendue par le `.env`. */
export function genererCles() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  return {
    publique: versB64u(Buffer.concat([
      Buffer.from([4]),
      Buffer.from(jwk.x, 'base64url'),
      Buffer.from(jwk.y, 'base64url'),
    ])),
    privee: versB64u(Buffer.from(jwk.d, 'base64url')),
    // Rendue pour que l'appelant puisse verifier la paire sans la reconstruire.
    verification: publicKey.export({ format: 'jwk' }),
  };
}

/**
 * L'en-tete « Authorization » d'un envoi.
 *
 * Le jeton vaut pour UNE origine (celle du service de notification) et pour une
 * duree bornee. La norme autorise vingt-quatre heures ; on en prend douze. Un
 * jeton vole vaut le droit d'envoyer des notifications a des abonnes qu'on ne
 * connait pas — la fenetre n'a aucune raison d'etre large.
 */
export function enteteVapid(endpoint, { clePublique, clePrivee, sujet }, { maintenant = Date.now() } = {}) {
  const audience = new URL(endpoint).origin;
  const entete = versB64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const charge = versB64u(JSON.stringify({
    aud: audience,
    exp: Math.floor(maintenant / 1000) + 12 * 3600,
    sub: sujet,
  }));
  const aSigner = Buffer.from(entete + '.' + charge, 'ascii');

  // « ieee-p1363 » rend les 64 octets bruts r||s. Le format DER, qui est le
  // defaut de Node, serait refuse par tous les services de notification.
  const signature = crypto.sign('sha256', aSigner, {
    key: clePriveeDepuisBrut(clePublique, clePrivee),
    dsaEncoding: 'ieee-p1363',
  });

  return 'vapid t=' + entete + '.' + charge + '.' + versB64u(signature) + ', k=' + clePublique;
}

/* ------------------------------------------------------------------ */
/*  Envoi                                                              */
/* ------------------------------------------------------------------ */

/**
 * @typedef {{ ok: boolean, statut: number, disparu: boolean, erreur?: string }} Resultat
 */

/**
 * Envoie un message a un abonnement.
 *
 * NE LEVE JAMAIS. Une notification est un confort ; qu'elle echoue ne doit ni
 * annuler un tour, ni faire echouer une requete du client. Tout ce qui tourne
 * mal revient dans le resultat.
 *
 * `disparu` distingue le seul cas qui demande une action : 404 et 410 disent
 * que l'abonnement n'existe plus (application desinstallee, notifications
 * coupees). Il faut alors l'effacer, sinon on reessaie a chaque tour pris,
 * pour toujours.
 */
export function envoyer(abonnement, message, cles, { delaiMs = 8000, urgence = 'normal' } = {}) {
  return new Promise((resoudre) => {
    let corps;
    let autorisation;
    try {
      corps = chiffrer(message, abonnement);
      autorisation = enteteVapid(abonnement.endpoint, cles);
    } catch (err) {
      resoudre({ ok: false, statut: 0, disparu: false, erreur: 'Préparation : ' + err.message });
      return;
    }

    const requete = https.request(abonnement.endpoint, {
      method: 'POST',
      headers: {
        Authorization: autorisation,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'Content-Length': corps.length,
        // Combien de temps le service garde le message si le telephone est
        // eteint. Un tour pris il y a une heure n'interesse plus personne.
        TTL: '900',
        Urgency: urgence,
      },
      timeout: delaiMs,
    }, (reponse) => {
      // On lit la reponse jusqu'au bout meme sans s'en servir : une reponse non
      // consommee garde la connexion ouverte.
      let texte = '';
      reponse.setEncoding('utf8');
      reponse.on('data', (morceau) => { if (texte.length < 400) texte += morceau; });
      reponse.on('end', () => {
        const statut = reponse.statusCode || 0;
        resoudre({
          ok: statut >= 200 && statut < 300,
          statut,
          disparu: statut === 404 || statut === 410,
          erreur: statut >= 300 ? texte.trim().slice(0, 200) || ('HTTP ' + statut) : undefined,
        });
      });
    });

    requete.on('timeout', () => requete.destroy(new Error('délai dépassé')));
    requete.on('error', (err) => resoudre({ ok: false, statut: 0, disparu: false, erreur: err.message }));
    requete.end(corps);
  });
}

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

/**
 * Les cles, lues une fois. Absentes, `actif` est faux et plus rien n'est
 * tente : un salon qui ne veut pas de notifications n'a rien a desactiver.
 *
 * Une cle presente mais illisible n'est PAS ignoree en silence — elle est dite
 * au demarrage. Une notification qui ne part jamais sans un mot dans le journal
 * est un defaut qu'on cherche pendant des jours.
 */
export function lireCles(env = process.env) {
  const publique = String(env.WEBPUSH_CLE_PUBLIQUE || '').trim();
  const privee = String(env.WEBPUSH_CLE_PRIVEE || '').trim();
  const sujet = String(env.WEBPUSH_SUJET || '').trim();
  if (!publique && !privee) return { actif: false };
  if (!publique || !privee) {
    return { actif: false, probleme: 'WEBPUSH_CLE_PUBLIQUE et WEBPUSH_CLE_PRIVEE vont par deux.' };
  }
  if (!/^(mailto:|https:\/\/)/.test(sujet)) {
    return { actif: false, probleme: 'WEBPUSH_SUJET doit être « mailto:… » ou « https://… ».' };
  }
  try {
    clePriveeDepuisBrut(publique, privee);
  } catch (err) {
    return { actif: false, probleme: 'Clés VAPID illisibles : ' + err.message };
  }
  return { actif: true, clePublique: publique, clePrivee: privee, sujet };
}
