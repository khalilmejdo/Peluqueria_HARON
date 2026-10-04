/**
 * Remontee des erreurs vers Sentry — SANS SDK.
 *
 * L'application n'a qu'une seule dependance, `pg`, et c'est un choix : chaque
 * paquet ajoute est du code qu'on ne relit pas, qui se met a jour tout seul et
 * qu'il faut surveiller. `@sentry/node` en amenerait plusieurs dizaines.
 *
 * L'API d'ingestion de Sentry est du HTTP ordinaire : une requete POST et un
 * corps en JSON separe par des sauts de ligne. Une centaine de lignes ici
 * suffisent, et on sait exactement ce qui sort de la machine.
 *
 * CE QUI SORT, ET CE QUI NE SORT JAMAIS
 *
 * Seules les erreurs NON GEREES partent — celles qui rendent un 500. Les
 * refus metier (409 « ce fauteuil est occupe », 422 « numero invalide ») ne
 * sont pas des incidents : ils nomment parfois un client, et ils n'ont rien a
 * faire chez un tiers.
 *
 * L'adresse demandee est nettoyee avant l'envoi. `/ticket/<jeton>` est le
 * SECRET du client : quiconque lit ce jeton ouvre son suivi. Il est remplace,
 * jamais transmis.
 *
 * Sans SENTRY_DSN, ce module ne fait rien du tout — pas de requete, pas de
 * minuterie, aucun cout.
 */
import crypto from 'node:crypto';
import { config } from './config.js';
import { log } from './logger.js';

/**
 * Un DSN Sentry : https://<cle_publique>@<hote>/<projet>
 * On le decompose une fois, au demarrage, plutot qu'a chaque erreur.
 */
function lireDsn(brut) {
  if (!brut) return null;
  try {
    const u = new URL(brut);
    const projet = u.pathname.replace(/^\/+/, '');
    if (!u.username || !projet) return null;
    return {
      cle: u.username,
      adresse: u.origin + '/api/' + projet + '/envelope/',
    };
  } catch {
    return null;
  }
}

const DSN = lireDsn(process.env.SENTRY_DSN || '');

/** Vrai si la remontee est active. Sert aussi a l'ecran « Etat du service ». */
export const sentryActif = Boolean(DSN);

/**
 * Nettoie une adresse avant de l'envoyer.
 *
 * Le jeton de suivi ne doit JAMAIS sortir : il tient lieu de mot de passe. On
 * le remplace par un marqueur — savoir que l'erreur vient d'une page de suivi
 * suffit largement a la comprendre.
 */
function cheminPropre(chemin) {
  return String(chemin || '')
    // Les DEUX formes : la page (/ticket/x) et l'API (/api/public/tickets/x/flux).
    .replace(/^\/ticket\/[^/?#]+/, '/ticket/<jeton>')
    .replace(/^\/api\/public\/tickets\/[^/?#]+/, '/api/public/tickets/<jeton>')
    .replace(/[?#].*$/, '')
    .slice(0, 300);
}

/**
 * Deux erreurs identiques qui se repetent mille fois ne disent rien de plus
 * que la premiere. On garde une empreinte des erreurs recentes et on n'envoie
 * qu'une fois par tranche de dix minutes — la limite gratuite de Sentry est
 * vite atteinte, et une boite pleine de doublons ne se lit pas.
 */
const RECENTES = new Map();
const FENETRE_MS = 600000;

function dejaVue(empreinte) {
  const maintenant = Date.now();
  const vu = RECENTES.get(empreinte);
  if (vu && maintenant - vu < FENETRE_MS) return true;
  if (RECENTES.size > 200) RECENTES.clear();
  RECENTES.set(empreinte, maintenant);
  return false;
}

/**
 * Signale une erreur non geree.
 *
 * Ne rejette jamais : une panne de Sentry ne doit pas devenir une panne du
 * salon. L'appelant n'a donc pas a l'attendre ni a l'envelopper.
 *
 * @param {Error} erreur
 * @param {{ methode?: string, chemin?: string, requestId?: string, utilisateur?: string|null }} [contexte]
 */
export function signalerErreur(erreur, contexte = {}) {
  if (!DSN || !erreur) return;

  const type = erreur.name || 'Error';
  const message = String(erreur.message || '').slice(0, 500);
  if (dejaVue(type + '|' + message)) return;

  const evenement = {
    event_id: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    logger: 'haron',
    release: config.version || undefined,
    environment: config.env,
    server_name: 'haron',
    exception: {
      values: [{
        type,
        value: message,
        stacktrace: { frames: cadres(erreur) },
      }],
    },
    request: contexte.chemin
      ? { method: contexte.methode, url: cheminPropre(contexte.chemin) }
      : undefined,
    tags: {
      // Jamais l'identifiant d'un client : seulement le role, qui aide a
      // reproduire sans designer personne.
      acteur: contexte.utilisateur ? 'personnel' : 'public',
      pg_code: erreur.code && /^[0-9A-Z]{5}$/.test(String(erreur.code)) ? String(erreur.code) : undefined,
    },
    extra: { requestId: contexte.requestId },
  };

  const enveloppe = [
    JSON.stringify({ event_id: evenement.event_id, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(evenement),
  ].join('\n');

  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), 5000);

  fetch(DSN.adresse, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': 'Sentry sentry_version=7, sentry_client=haron/1.0, sentry_key=' + DSN.cle,
    },
    body: enveloppe,
    signal: controleur.signal,
  })
    .then((r) => {
      if (!r.ok) log.warn('Sentry a refuse l evenement', { statut: r.status });
    })
    .catch((err) => {
      // Un Sentry injoignable ne doit RIEN casser, et surtout pas boucler.
      log.warn('Sentry injoignable', { error: err?.message });
    })
    .finally(() => clearTimeout(minuterie));
}

/**
 * La pile, dans le sens attendu par Sentry : l'appelant d'abord, l'endroit de
 * l'erreur en dernier. Les cadres de node: sont marques « hors application »
 * pour que l'ecran ne montre d'emblee que notre code.
 */
function cadres(erreur) {
  const lignes = String(erreur.stack || '').split('\n').slice(1, 30);
  const sortie = [];
  for (const ligne of lignes) {
    const m = /at (?:(.+?) )?\(?(.+?):(\d+):(\d+)\)?$/.exec(ligne.trim());
    if (!m) continue;
    const fichier = m[2];
    sortie.push({
      function: m[1] || '<anonyme>',
      filename: fichier.replace(/^file:\/\//, ''),
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !fichier.startsWith('node:') && !fichier.includes('node_modules'),
    });
  }
  return sortie.reverse();
}
