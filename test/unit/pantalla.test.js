/**
 * L'ecran du salon.
 *
 * DEUX RISQUES, ET UN TEST POUR CHACUN.
 *
 * 1. CE QUI SORT. L'ecran est accroche au mur, et son adresse est ouverte tant
 *    que le gerant n'a pas choisi d'afficher les apellidos (ce choix pose une
 *    cle dans l'adresse) :
 *    tout ce que la projection laisse passer est lisible par quiconque la
 *    connait. Un numero de telephone ou un jeton de suivi qui s'y glisserait
 *    ne se verrait jamais — un televiseur n'a pas de lecteur attentif.
 *
 * 2. DEUX RENDUS POUR UNE MEME PAGE. Le serveur pose la premiere image en
 *    HTML, le script pose les suivantes en DOM. Deux mises en page qui
 *    divergent donnent un ecran qui SAUTE a la premiere mise a jour, et le
 *    defaut ne se voit que sur place, dans le salon. On compare donc le texte
 *    produit par les deux, dans l'ordre.
 *
 * Le faux DOM ci-dessous ne cherche pas a etre un navigateur : il implemente
 * exactement les six methodes que `pantalla.js` emploie. Toute methode
 * supplementaire employee un jour fera echouer ce fichier bruyamment, ce qui
 * est le comportement voulu.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { pourPantalla } from '../../server/domain/file.js';
import { _corpsPantalla } from '../../server/site/index.js';

/* ------------------------------------------------------------------ */
/*  Un etat de journee, fabrique a la main                             */
/* ------------------------------------------------------------------ */

const POSTE_A = { id: 'p1', nom: 'Sillón 1', coiffeur: 'Haron', actif: true, ordre: 0 };
const POSTE_B = { id: 'p2', nom: 'Sillón 2', coiffeur: null, actif: true, ordre: 1 };

const ticket = (n, statut, extra = {}) => ({
  id: 't' + n,
  numero_affiche: 'A0' + String(n).padStart(2, '0'),
  rang: n,
  prenom: 'Cliente' + n,
  nom: 'Apellido' + n,
  statut,
  telephone_enc: 'CHIFFRE-TELEPHONE-' + n,
  telephone_fin: '678' + n,
  jeton_enc: 'CHIFFRE-JETON-' + n,
  arrive_at: '2026-09-24T09:0' + n + ':00.000Z',
  poste_id: null,
  poste_choisi_id: null,
  ...extra,
});

function etatDeTest(tickets, { pantallaNombres = 'NOMBRE' } = {}) {
  return {
    jour: '2026-09-24',
    ouverte: true,
    maj: '2026-09-24T10:00:00.000Z',
    postes: [POSTE_A, POSTE_B],
    postesActifs: [POSTE_A, POSTE_B],
    dureeMoyenneMinutes: 20,
    pantallaNombres,
    tickets,
    compteurs: { servis: 7 },
  };
}

const JOURNEE = etatDeTest([
  ticket(1, 'IN_SERVICE', { poste_id: 'p1' }),
  ticket(2, 'CALLED', { poste_id: 'p2' }),
  ticket(3, 'WAITING'),
  ticket(4, 'WAITING', { poste_choisi_id: 'p1' }),
  ticket(5, 'COMPLETED'),
  ticket(6, 'CANCELLED'),
]);

/* ------------------------------------------------------------------ */
/*  1. Ce qui sort                                                     */
/* ------------------------------------------------------------------ */

test('l ecran montre le numero, le prenom et le fauteuil', () => {
  const vue = pourPantalla(JOURNEE);
  assert.deepEqual(vue.appeles, [{ numero: 'A002', prenom: 'Cliente2', poste: 'Sillón 2' }]);
  assert.deepEqual(vue.auFauteuil, [{ numero: 'A001', prenom: 'Cliente1', poste: 'Haron' }]);
  assert.equal(vue.attente.length, 2);
  assert.equal(vue.enAttente, 2);
  assert.equal(vue.servis, 7);
});

test('le fauteuil affiche le nom du coiffeur quand il en a un', () => {
  const vue = pourPantalla(JOURNEE);
  // « Haron » plutot que « Sillón 1 » : dans la salle, on cherche la personne.
  assert.equal(vue.auFauteuil[0].poste, 'Haron');
  assert.equal(vue.appeles[0].poste, 'Sillón 2');
});

/*
 * Le test qui compte. La projection du personnel porte les telephones ; celle
 * de l'ecran ne doit rien en savoir, et il ne suffit pas de « ne pas les
 * mettre » : il faut le verifier sur la sortie entiere, serialisee.
 */
test('ni telephone, ni jeton, ni nom de famille ne sortent par defaut', () => {
  const texte = JSON.stringify(pourPantalla(JOURNEE));
  for (const interdit of ['CHIFFRE-TELEPHONE', 'CHIFFRE-JETON', 'Apellido', '6781', '6782']) {
    assert.ok(!texte.includes(interdit), interdit + ' se retrouve sur l écran du salon');
  }
  // L'heure d'arrivee dit qui poireaute depuis une heure : ce n'est l'affaire
  // de personne dans la salle d'attente.
  assert.ok(!texte.includes('T09:'), 'une heure d arrivée est exposée');
});

test('un salon peut couper les prenoms et n afficher que des numeros', () => {
  const vue = pourPantalla(etatDeTest(JOURNEE.tickets, { pantallaNombres: 'NINGUNO' }));
  assert.equal(vue.appeles[0].numero, 'A002');
  assert.equal(vue.appeles[0].prenom, null);
  assert.ok(!JSON.stringify(vue).includes('Cliente'));
});

/*
 * Le nom de famille N'EST JAMAIS UN DEFAUT. Il faut l'avoir choisi, et ce choix
 * ferme la page derriere une cle (voir `enregistrer` dans reglages.js) : un
 * apellido sur une adresse que tout internet peut ouvrir n'est pas la meme
 * chose qu'un apellido sur un mur.
 */
test('le nom de famille ne sort que si le salon l a explicitement choisi', () => {
  assert.equal(pourPantalla(etatDeTest(JOURNEE.tickets)).appeles[0].prenom, 'Cliente2');
  assert.equal(
    pourPantalla(etatDeTest(JOURNEE.tickets, { pantallaNombres: 'COMPLETO' })).appeles[0].prenom,
    'Cliente2 Apellido2',
  );
  // Une valeur inconnue retombe sur le prenom seul, jamais sur le nom complet.
  assert.equal(
    pourPantalla(etatDeTest(JOURNEE.tickets, { pantallaNombres: 'AUTRE_CHOSE' })).appeles[0].prenom,
    'Cliente2',
  );
});

test('un client sans nom de famille ne fabrique pas un libelle bancal', () => {
  const sansNom = [ticket(1, 'CALLED', { nom: '' }), ticket(2, 'CALLED', { prenom: '', nom: 'Solo' })];
  const vue = pourPantalla(etatDeTest(sansNom, { pantallaNombres: 'COMPLETO' }));
  assert.equal(vue.appeles[0].prenom, 'Cliente1');
  assert.equal(vue.appeles[1].prenom, 'Solo');
  assert.ok(!JSON.stringify(vue).includes('  '), 'une double espace traîne dans un libellé');
});

test('les termines et les annules ne montent pas sur l ecran', () => {
  const texte = JSON.stringify(pourPantalla(JOURNEE));
  assert.ok(!texte.includes('A005'), 'un turno terminado est affiché');
  assert.ok(!texte.includes('A006'), 'un turno anulado est affiché');
});

/*
 * Une liste coupee sans le dire fait croire a un client qu'il n'est pas dans
 * la file. Le compte de ce qui manque doit donc etre exact.
 */
test('ce qui ne tient pas a l ecran est COMPTE, pas oublie', () => {
  const beaucoup = [];
  for (let i = 1; i <= 15; i += 1) beaucoup.push(ticket(i, 'WAITING'));
  const vue = pourPantalla(etatDeTest(beaucoup), { combien: 4 });
  assert.equal(vue.attente.length, 4);
  assert.equal(vue.deplus, 11);
  assert.equal(vue.enAttente, 15);
});

test('une file vide ne fabrique pas un ecran bancal', () => {
  const vue = pourPantalla(etatDeTest([]));
  assert.deepEqual(vue.appeles, []);
  assert.deepEqual(vue.auFauteuil, []);
  assert.deepEqual(vue.attente, []);
  assert.equal(vue.deplus, 0);
  assert.equal(vue.attenteEstimeeMinutes, 0);
});

/* ------------------------------------------------------------------ */
/*  2. Les deux rendus                                                 */
/* ------------------------------------------------------------------ */

/**
 * Le strict minimum de DOM qu'emploie `pantalla.js`. Rien de plus : une
 * methode oubliee fera echouer le test au lieu de mentir.
 */
function fauxDom() {
  const noeud = (nom) => ({
    nom,
    className: '',
    textContent: '',
    enfants: [],
    classList: {
      add(c) { this.hote.className = (this.hote.className + ' ' + c).trim(); },
    },
    append(...enfants) { this.enfants.push(...enfants); },
  });

  const creer = (nom) => {
    const n = noeud(nom);
    n.classList.hote = n;
    return n;
  };

  return {
    createElement: creer,
    createDocumentFragment: () => creer('#fragment'),
    createTextNode: (t) => ({ nom: '#texte', textContent: String(t), enfants: [] }),
  };
}

/** Le texte visible d'un arbre, dans l'ordre, sans les blancs superflus. */
function texteDe(noeud) {
  // Les blancs sont coupes des deux cotes : le serveur ecrit « <strong>2</strong>
  // esperando », le script pose un noeud de texte « esperando » precede d'un
  // espace. C'est le MEME rendu, et comparer les blancs ferait echouer ce test
  // sur une difference que personne ne voit a l'ecran.
  if (noeud.nom === '#texte') return noeud.textContent.trim();
  const propre = String(noeud.textContent || '').trim();
  if (propre) return propre;
  return noeud.enfants.map(texteDe).filter(Boolean).join('\n');
}

/** Le texte visible d'un fragment HTML, dans l'ordre. */
function texteDuHtml(html) {
  return html
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

async function texteDuClient(vue) {
  globalThis.document = fauxDom();
  try {
    const { construireCorps } = await import('../../public/js/pantalla.js');
    return texteDe(construireCorps(vue));
  } finally {
    delete globalThis.document;
  }
}

/*
 * Le serveur pose la premiere image, le script pose les suivantes. Si les deux
 * ne disent pas la meme chose, l'ecran SAUTE au premier changement — et le
 * defaut ne se voit que sur place, accroche au mur du salon.
 */
test('le serveur et le script affichent exactement le meme texte', async () => {
  for (const vue of [
    pourPantalla(JOURNEE),
    pourPantalla(etatDeTest([])),
    pourPantalla(etatDeTest([ticket(1, 'IN_SERVICE', { poste_id: 'p1' })])),
    pourPantalla(etatDeTest(JOURNEE.tickets, { pantallaNombres: 'NINGUNO' })),
    pourPantalla(etatDeTest(JOURNEE.tickets, { pantallaNombres: 'COMPLETO' })),
    pourPantalla({ ...etatDeTest([]), ouverte: false }),
  ]) {
    assert.equal(
      await texteDuClient(vue),
      texteDuHtml(_corpsPantalla(vue)),
      'les deux rendus ont divergé',
    );
  }
});
