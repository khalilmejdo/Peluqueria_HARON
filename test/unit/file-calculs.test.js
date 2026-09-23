/**
 * Le calcul de la file.
 *
 * calculerPositions est le coeur du metier et une fonction PURE : elle ne
 * connait ni la base, ni l'heure, ni le reseau. Tout ce que voit un client —
 * sa position, le nombre de personnes devant lui, son estimation, sa phase —
 * sort d'ici, et peut donc etre verifie ligne a ligne.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerPositions, messageDePhase } from '../../server/domain/file.js';
import { numeroAffiche, STATUTS_ACTIFS } from '../../server/domain/journee.js';

const REGLAGES = { dureeMoyenneMinutes: 20, seuilPrevenir: 2 };

/** Fabrique un ticket minimal pour le calcul. */
const t = (id, rang, statut = 'WAITING') => ({ id, rang, statut });

test('la position suit le rang, et rien d autre', () => {
  // Volontairement dans le desordre, et avec des rangs non contigus : c'est
  // exactement ce que produit une file ou des gens ont ete servis et d'autres
  // replaces en fin de file.
  const tickets = [t('c', 30), t('a', 3), t('b', 11)];
  const positions = calculerPositions(tickets, REGLAGES);

  assert.equal(positions.get('a').position, 1);
  assert.equal(positions.get('b').position, 2);
  assert.equal(positions.get('c').position, 3);
});

test('l origine du client n influence jamais l ordre', () => {
  const tickets = [
    { id: 'enligne', rang: 1, statut: 'WAITING', source: 'ONLINE' },
    { id: 'qr', rang: 2, statut: 'WAITING', source: 'QR' },
    { id: 'comptoir', rang: 3, statut: 'WAITING', source: 'COMPTOIR' },
  ];
  const positions = calculerPositions(tickets, REGLAGES);
  assert.equal(positions.get('enligne').position, 1);
  assert.equal(positions.get('qr').position, 2);
  assert.equal(positions.get('comptoir').position, 3);
});

test('le client au fauteuil compte comme une personne devant', () => {
  const tickets = [t('fauteuil', 1, 'IN_SERVICE'), t('premier', 2), t('second', 3)];
  const positions = calculerPositions(tickets, REGLAGES);

  assert.equal(positions.get('fauteuil').devant, 0);
  assert.equal(positions.get('premier').devant, 1);
  assert.equal(positions.get('second').devant, 2);
  assert.equal(positions.get('premier').estimationMinutes, 20);
  assert.equal(positions.get('second').estimationMinutes, 40);
});

test('l exemple de la commande : trois personnes devant, environ soixante minutes', () => {
  const tickets = [t('a', 1), t('b', 2), t('c', 3), t('moi', 4)];
  const positions = calculerPositions(tickets, REGLAGES);
  assert.equal(positions.get('moi').devant, 3);
  assert.equal(positions.get('moi').estimationMinutes, 60);
});

test('les phases se succedent dans le bon ordre', () => {
  const tickets = [t('a', 1), t('b', 2), t('c', 3), t('d', 4), t('e', 5)];
  const positions = calculerPositions(tickets, REGLAGES);

  assert.equal(positions.get('a').phase, 'PROCHAIN');   // 0 devant
  assert.equal(positions.get('b').phase, 'APPROCHE');   // 1 devant, seuil 2
  assert.equal(positions.get('c').phase, 'APPROCHE');   // 2 devant, seuil 2
  assert.equal(positions.get('d').phase, 'ATTENTE');    // 3 devant
  assert.equal(positions.get('e').phase, 'ATTENTE');
});

test('l appel et le service ont leur propre phase, quel que soit le rang', () => {
  const tickets = [t('appele', 1, 'CALLED'), t('suivant', 2)];
  const positions = calculerPositions(tickets, REGLAGES);
  assert.equal(positions.get('appele').phase, 'VOTRE_TOUR');
  assert.equal(positions.get('suivant').phase, 'APPROCHE');

  const enCours = calculerPositions([t('x', 1, 'IN_SERVICE')], REGLAGES);
  assert.equal(enCours.get('x').phase, 'EN_COURS');
});

test('un client deja absent reste dans la file, a sa nouvelle place', () => {
  // Ahmed (rang 1) a ete absent : il repart au rang 5, derriere tout le monde.
  const tickets = [t('youssef', 2), t('karim', 3), t('mehdi', 4), t('ahmed', 5, 'LATE')];
  const positions = calculerPositions(tickets, REGLAGES);

  assert.equal(positions.get('youssef').position, 1);
  assert.equal(positions.get('ahmed').position, 4);
  assert.equal(positions.get('ahmed').devant, 3);
  // LATE est un statut d'attente : il ne sort pas le client de la file.
  assert.ok(STATUTS_ACTIFS.includes('LATE'));
});

test('les tickets termines et annules sortent du calcul mais gardent une phase', () => {
  const tickets = [t('servi', 1, 'COMPLETED'), t('annule', 2, 'CANCELLED'), t('attend', 3)];
  const positions = calculerPositions(tickets, REGLAGES);

  assert.equal(positions.get('servi').phase, 'TERMINE');
  assert.equal(positions.get('servi').position, 0);
  assert.equal(positions.get('annule').phase, 'ANNULE');
  // Celui qui attend est bien premier : les termines ne comptent pas devant lui.
  assert.equal(positions.get('attend').position, 1);
  assert.equal(positions.get('attend').devant, 0);
});

test('une file vide ne produit aucune position', () => {
  assert.equal(calculerPositions([], REGLAGES).size, 0);
});

test('un seuil a zero ne previent qu au moment d etre le prochain', () => {
  const tickets = [t('a', 1), t('b', 2)];
  const positions = calculerPositions(tickets, { dureeMoyenneMinutes: 20, seuilPrevenir: 0 });
  assert.equal(positions.get('a').phase, 'PROCHAIN');
  assert.equal(positions.get('b').phase, 'ATTENTE');
});

test('la duree moyenne du salon change l estimation, pas l ordre', () => {
  const tickets = [t('a', 1), t('b', 2), t('c', 3)];
  const rapide = calculerPositions(tickets, { dureeMoyenneMinutes: 10, seuilPrevenir: 2 });
  const lent = calculerPositions(tickets, { dureeMoyenneMinutes: 45, seuilPrevenir: 2 });

  assert.equal(rapide.get('c').estimationMinutes, 20);
  assert.equal(lent.get('c').estimationMinutes, 90);
  assert.equal(rapide.get('c').position, lent.get('c').position);
});

/* ------------------------------------------------------------------ */
/*  Plusieurs fauteuils                                                */
/* ------------------------------------------------------------------ */

test('deux fauteuils font avancer la file deux fois plus vite', () => {
  const tickets = [t('a', 1), t('b', 2), t('c', 3), t('d', 4), t('e', 5)];
  const un = calculerPositions(tickets, { ...REGLAGES, postesActifs: 1 });
  const deux = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2 });

  // La POSITION dans la file ne change pas : c'est la meme file, le meme ordre.
  for (const id of ['a', 'b', 'c', 'd', 'e']) {
    assert.equal(un.get(id).position, deux.get(id).position, id);
    assert.equal(un.get(id).devant, deux.get(id).devant, id);
  }

  // L'ATTENTE, elle, est divisee. Avec deux fauteuils : a et b passent tout de
  // suite, c et d a 20 minutes, e a 40.
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map((id) => deux.get(id).estimationMinutes), [0, 0, 20, 20, 40]);
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map((id) => un.get(id).estimationMinutes), [0, 20, 40, 60, 80]);
});

test('trois fauteuils : les trois premiers passent dans la foulee', () => {
  const tickets = Array.from({ length: 7 }, (_, i) => t('t' + i, i + 1));
  const positions = calculerPositions(tickets, { ...REGLAGES, postesActifs: 3 });

  assert.deepEqual(tickets.map((x) => positions.get(x.id).tours), [0, 0, 0, 1, 1, 1, 2]);
  assert.deepEqual(tickets.map((x) => positions.get(x.id).estimationMinutes), [0, 0, 0, 20, 20, 20, 40]);
  // Les trois premiers sont « prochains » : un fauteuil se libere pour chacun.
  assert.deepEqual(tickets.slice(0, 3).map((x) => positions.get(x.id).phase), ['PROCHAIN', 'PROCHAIN', 'PROCHAIN']);
});

test('le seuil de prevenance compte en tours, pas en personnes', () => {
  // Avec un seul fauteuil et un seuil de 2, le 4e (3 devant) attend encore.
  const tickets = Array.from({ length: 8 }, (_, i) => t('t' + i, i + 1));
  const un = calculerPositions(tickets, { dureeMoyenneMinutes: 20, seuilPrevenir: 2, postesActifs: 1 });
  assert.equal(un.get('t3').phase, 'ATTENTE');
  assert.equal(un.get('t2').phase, 'APPROCHE');

  // Avec deux fauteuils, ce meme 4e n'a plus qu'un tour devant lui : son tour
  // approche vraiment. Sans cette regle, « prévenir à 2 personnes » n'aurait
  // pas le meme sens selon le nombre de fauteuils ouverts.
  const deux = calculerPositions(tickets, { dureeMoyenneMinutes: 20, seuilPrevenir: 2, postesActifs: 2 });
  assert.equal(deux.get('t3').phase, 'APPROCHE');
  assert.equal(deux.get('t3').tours, 1);
  assert.equal(deux.get('t6').phase, 'ATTENTE');
  assert.equal(deux.get('t6').tours, 3);
});

test('deux clients peuvent etre aux fauteuils en meme temps', () => {
  const tickets = [
    { id: 'a', rang: 1, statut: 'IN_SERVICE', poste_id: 'p1', poste_choisi_id: null },
    { id: 'b', rang: 2, statut: 'CALLED', poste_id: 'p2', poste_choisi_id: null },
    { id: 'c', rang: 3, statut: 'WAITING', poste_id: null, poste_choisi_id: null },
  ];
  const positions = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2 });

  assert.equal(positions.get('a').phase, 'EN_COURS');
  assert.equal(positions.get('b').phase, 'VOTRE_TOUR');
  // Deux personnes devant lui, deux fauteuils : il passe au prochain tour.
  assert.equal(positions.get('c').devant, 2);
  assert.equal(positions.get('c').tours, 1);
  assert.equal(positions.get('c').estimationMinutes, 20);
});

test('un nombre de fauteuils absurde ne casse pas le calcul', () => {
  const tickets = [t('a', 1), t('b', 2)];
  for (const postesActifs of [0, -3, null, undefined, NaN]) {
    const positions = calculerPositions(tickets, { ...REGLAGES, postesActifs });
    // On retombe sur un fauteuil : jamais de division par zero, jamais
    // d'estimation infinie affichee a un client.
    assert.equal(positions.get('b').estimationMinutes, 20, 'postesActifs = ' + postesActifs);
  }
});

/* ------------------------------------------------------------------ */
/*  Une file par coiffeur                                              */
/* ------------------------------------------------------------------ */

/**
 * Ticket rattache a un coiffeur CHOISI.
 *
 * C'est `poste_choisi_id` qui definit le couloir, pas `poste_id` : le second dit
 * seulement quel fauteuil sert le client en ce moment, et un coiffeur libre
 * peut depanner la file d'un collegue sans que le client change de file.
 */
const tp = (id, rang, coiffeur, statut = 'WAITING', sert = null) => ({
  id, rang, poste_choisi_id: coiffeur, poste_id: sert, statut,
});

test('en file par coiffeur, chacun n a devant lui que SA file', () => {
  // Ordre d'arrivee : a(p1) b(p2) c(p1) d(p2) e(p1)
  const tickets = [tp('a', 1, 'p1'), tp('b', 2, 'p2'), tp('c', 3, 'p1'), tp('d', 4, 'p2'), tp('e', 5, 'p1')];
  const positions = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2, mode: 'PAR_FAUTEUIL' });

  // Chez p1 : a, c, e — donc 0, 1, 2 devant.
  assert.equal(positions.get('a').devant, 0);
  assert.equal(positions.get('c').devant, 1);
  assert.equal(positions.get('e').devant, 2);
  // Chez p2 : b, d — donc 0 et 1.
  assert.equal(positions.get('b').devant, 0);
  assert.equal(positions.get('d').devant, 1);

  // La position affichee est celle de SA file, pas celle du salon.
  assert.equal(positions.get('c').position, 2);
  assert.equal(positions.get('d').position, 2);
});

test('en file par coiffeur, un coiffeur ne sert qu une personne a la fois', () => {
  // Trois clients chez le meme coiffeur, deux fauteuils ouverts : le second
  // fauteuil ne les aide pas, ils ont choisi celui-la.
  const tickets = [tp('a', 1, 'p1'), tp('b', 2, 'p1'), tp('c', 3, 'p1')];
  const unique = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2, mode: 'UNIQUE' });
  const parCoiffeur = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2, mode: 'PAR_FAUTEUIL' });

  // En file unique, deux fauteuils se partagent ces trois clients.
  assert.equal(unique.get('c').estimationMinutes, 20);
  // En file par coiffeur, ils font la queue derriere un seul.
  assert.equal(parCoiffeur.get('c').estimationMinutes, 40);
});

test('le choix du coiffeur ne change pas l ordre a l interieur d une file', () => {
  const tickets = [tp('tard', 9, 'p1'), tp('tot', 2, 'p1')];
  const positions = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2, mode: 'PAR_FAUTEUIL' });
  // C'est le rang qui decide, comme toujours.
  assert.equal(positions.get('tot').position, 1);
  assert.equal(positions.get('tard').position, 2);
});

test('un client au fauteuil compte devant ceux de SA file, pas des autres', () => {
  const tickets = [
    tp('assis1', 1, 'p1', 'IN_SERVICE', 'p1'),
    tp('assis2', 2, 'p2', 'IN_SERVICE', 'p2'),
    tp('suit1', 3, 'p1'),
    tp('suit2', 4, 'p2'),
  ];
  const positions = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2, mode: 'PAR_FAUTEUIL' });

  assert.equal(positions.get('suit1').devant, 1, 'seulement celui de sa file');
  assert.equal(positions.get('suit2').devant, 1);
  assert.equal(positions.get('suit1').phase, 'APPROCHE');
});

test('un client sans coiffeur n est jamais perdu : il forme son propre couloir', () => {
  // Cas de bascule de mode : un ticket pris avant le changement.
  const tickets = [tp('orphelin', 1, null), tp('a', 2, 'p1'), tp('b', 3, 'p1')];
  const positions = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2, mode: 'PAR_FAUTEUIL' });

  assert.equal(positions.get('orphelin').position, 1);
  assert.equal(positions.get('orphelin').devant, 0);
  // Et il ne compte devant personne d'autre.
  assert.equal(positions.get('a').devant, 0);
  assert.equal(positions.get('b').devant, 1);
});

test('le mode par defaut reste la file unique', () => {
  const tickets = [tp('a', 1, 'p1'), tp('b', 2, 'p2'), tp('c', 3, 'p1')];
  // Sans `mode`, on doit retrouver exactement le comportement d'une file unique.
  const sansMode = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2 });
  const explicite = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2, mode: 'UNIQUE' });

  for (const id of ['a', 'b', 'c']) {
    assert.deepEqual(sansMode.get(id), explicite.get(id), id);
  }
  // Le fauteuil choisi n'entre pas dans le calcul.
  assert.equal(sansMode.get('c').devant, 2);
});

test('chaque phase dit au client quoi faire', () => {
  const tour = messageDePhase('VOTRE_TOUR', { nomSalon: 'HARON' });
  assert.match(tour.titre, /votre tour/i);
  assert.equal(tour.ton, 'tour');

  const approche = messageDePhase('APPROCHE', { devant: 2 });
  assert.match(approche.detail, /2 personnes/);
  assert.equal(approche.ton, 'proche');

  // L'accord en nombre : « 1 personne », pas « 1 personnes ».
  assert.match(messageDePhase('APPROCHE', { devant: 1 }).detail, /1 personne devant/);

  assert.equal(messageDePhase('PROCHAIN').ton, 'proche');
  assert.equal(messageDePhase('ATTENTE', { estimationMinutes: 40 }).ton, 'attente');
  assert.equal(messageDePhase('TERMINE').ton, 'fini');
  assert.equal(messageDePhase('ANNULE').ton, 'fini');
});

test('le numero affiche est toujours sur trois chiffres au moins', () => {
  assert.equal(numeroAffiche(1), 'A001');
  assert.equal(numeroAffiche(24), 'A024');
  assert.equal(numeroAffiche(999), 'A999');
  // Au-dela du millier, on ne tronque pas : le numero reste juste.
  assert.equal(numeroAffiche(1042), 'A1042');
});
