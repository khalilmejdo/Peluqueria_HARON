/**
 * La fiche de prix : lecture et ecriture d'un prix, dans les deux monnaies.
 *
 * C'est de l'argent affiche au mur du salon. Le nombre que le gerant tape doit
 * etre exactement celui que le client lit, sans qu'un arrondi binaire s'invite
 * entre les deux. D'ou le stockage en centimes entiers, et d'ou ces tests.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { prixEnCentimes, prixLegible, dureeValide } from '../../server/domain/tarifas.js';
import { ValidationError } from '../../server/core/errors.js';
import { poserDeviseActive, montantLisible, DEVISE_DEFAUT } from '../../server/core/devise.js';

/** L'espace insecable que place montantLisible entre le nombre et le symbole. */
const NBSP = ' ';

test('un prix se saisit comme on l ecrit, et devient des centimes entiers', () => {
  assert.equal(prixEnCentimes('14'), 1400);
  assert.equal(prixEnCentimes('14,90'), 1490);
  assert.equal(prixEnCentimes('14.90'), 1490);
  assert.equal(prixEnCentimes('14,9'), 1490);   // une seule decimale = dizaines de centimes
  assert.equal(prixEnCentimes('9,05'), 905);
  assert.equal(prixEnCentimes('0'), 0);         // un service offert reste affichable
});

test('les facons d ecrire la monnaie sont tolerees, le reste est refuse', () => {
  assert.equal(prixEnCentimes('14 €'), 1400);
  assert.equal(prixEnCentimes('14,90€'), 1490);
  assert.equal(prixEnCentimes(' 14,90 EUR '), 1490);
  // Le dirham, sous les trois ecritures qu'on rencontre sur une fiche de prix.
  assert.equal(prixEnCentimes('80 DH'), 8000);
  assert.equal(prixEnCentimes('80dh'), 8000);
  assert.equal(prixEnCentimes('99,50 DHS'), 9950);
  assert.equal(prixEnCentimes('120 MAD'), 12000);

  // Refus plutot que devinette : un prix mal lu finit imprime au mur.
  assert.equal(prixEnCentimes('abc'), null);
  assert.equal(prixEnCentimes('-5'), null);
  assert.equal(prixEnCentimes('14,999'), null);
  assert.equal(prixEnCentimes('14,90,50'), null);
  assert.equal(prixEnCentimes(''), null);
  assert.equal(prixEnCentimes(null), null);
  assert.equal(prixEnCentimes(undefined), null);
});

/**
 * LE SYMBOLE SAISI EST IGNORE, JAMAIS CONVERTI.
 *
 * Un gerant marocain qui colle « 15 € » depuis une ancienne fiche obtient 15
 * dirhams, pas la contrepartie en dirhams de 15 euros. Convertir en silence
 * serait la pire des reponses : le taux dormirait dans le code, il serait faux
 * six mois plus tard, et personne ne saurait quel prix a ete enregistre.
 */
test('le symbole saisi ne change pas la monnaie du salon', () => {
  const avant = poserDeviseActive('MAD');
  try {
    assert.equal(prixEnCentimes('15 €'), 1500);
    assert.equal(prixLegible(1500), '15' + NBSP + 'DH');
  } finally {
    poserDeviseActive(avant);
  }
});

test('un prix invraisemblable est refuse, pas tronque', () => {
  assert.equal(prixEnCentimes('1000'), 100000);  // la borne exacte passe
  assert.equal(prixEnCentimes('1001'), null);    // au-dela, c est une faute de frappe
  assert.equal(prixEnCentimes(100001), null);
});

test('un entier de centimes traverse sans conversion', () => {
  assert.equal(prixEnCentimes(1490), 1490);
  assert.equal(prixEnCentimes(0), 0);
  assert.equal(prixEnCentimes(14.9), null);      // un flottant n est pas un prix
});

test('le prix s affiche sans centimes inutiles, dans la monnaie du salon', () => {
  poserDeviseActive('EUR');
  assert.equal(prixLegible(1400), '14' + NBSP + '€');
  assert.equal(prixLegible(1490), '14,90' + NBSP + '€');
  assert.equal(prixLegible(905), '9,05' + NBSP + '€');
  assert.equal(prixLegible(0), '0' + NBSP + '€');
  assert.equal(prixLegible(100000), '1000' + NBSP + '€');

  // Au Maroc, presque tous les prix sont des dirhams entiers : la regle des
  // centimes muets rend exactement ce qui est ecrit au mur.
  poserDeviseActive('MAD');
  assert.equal(prixLegible(8000), '80' + NBSP + 'DH');
  assert.equal(prixLegible(9950), '99,50' + NBSP + 'DH');
  poserDeviseActive(DEVISE_DEFAUT);
});

/**
 * L'ESPACE EST INSECABLE, et c'est verifie.
 *
 * Un espace ordinaire laisserait la colonne etroite des tarifs couper entre le
 * nombre et le symbole : « 99,50 » en fin de ligne et « DH » tout seul dessous.
 * Sur l'affiche imprimee une fois pour des annees, ce detail se voit.
 */
test('le nombre et son symbole ne peuvent pas etre separes par un retour a la ligne', () => {
  for (const code of ['EUR', 'MAD']) {
    const rendu = montantLisible(1250, code);
    assert.ok(rendu.includes(NBSP), code + ' : espace insecable attendu, rendu « ' + rendu + ' »');
    assert.ok(!/ /.test(rendu), code + ' : aucun espace ordinaire ne doit rester');
  }
});

/**
 * LA DUREE D'UNE PRESTATION — le defaut le plus couteux trouve en traduisant.
 *
 * Le motif etait ecrit « /^d{1,3}$/ » au lieu de « /^\d{1,3}$/ » : sans
 * l'antislash, il exigeait la LETTRE d. Toute duree reelle etait donc refusee,
 * et la chaine « d » acceptee. Le gerant ne pouvait plus enregistrer une seule
 * duree, et comme le message d'erreur — « Indiquez les minutes, en nombres
 * entiers » — restait parfaitement plausible devant un champ ou il venait de
 * taper 15, il n'avait aucune raison de soupconner le code.
 *
 * Consequence en vitrine : toutes les prestations gardaient la duree par defaut,
 * et l'attente annoncee cessait de distinguer une barbe d'une keratine — ce qui
 * est exactement la raison d'etre du choix des prestations.
 */
test('une duree en minutes est acceptee, et la lettre d refusee', () => {
  assert.equal(dureeValide('15'), 15);
  assert.equal(dureeValide('1'), 1);
  assert.equal(dureeValide('240'), 240);
  assert.equal(dureeValide(25), 25);
  assert.equal(dureeValide(' 30 '), 30);

  // Le motif fautif acceptait « d » et « dd » : la preuve que le test mord.
  assert.throws(() => dureeValide('d'), ValidationError);
  assert.throws(() => dureeValide('dd'), ValidationError);
  assert.throws(() => dureeValide('abc'), ValidationError);
  assert.throws(() => dureeValide(''), ValidationError);
  assert.throws(() => dureeValide('12,5'), ValidationError);

  // Les bornes : zero n'occupe pas un fauteuil, et quatre heures suffisent.
  assert.throws(() => dureeValide('0'), ValidationError);
  assert.throws(() => dureeValide('241'), ValidationError);
});

/**
 * Le cas qui justifie tout le reste : `Math.round(1.005 * 100)` rend 100, pas
 * 101, parce que 1.005 n'existe pas exactement en binaire. Notre chemin ne
 * passe par aucun flottant, donc « 1,005 » est simplement refuse, et les deux
 * decimales qu'on accepte reviennent toujours identiques.
 */
test('aller et retour : ce qui est tape est ce qui est lu', () => {
  for (const code of ['EUR', 'MAD']) {
    poserDeviseActive(code);
    for (const ecrit of ['14', '14,90', '9,05', '22,50', '1,01', '0,99', '35', '150']) {
      const cts = prixEnCentimes(ecrit);
      assert.notEqual(cts, null, ecrit + ' devrait etre accepte');
      const affiche = prixLegible(cts);
      // Et le tour complet : ce qui s'affiche se recolle dans le champ et
      // redonne les memes centimes, espace insecable compris.
      assert.equal(prixEnCentimes(affiche), cts, affiche + ' devrait se relire');
      const relu = affiche.replace(/[ ].*$/, '');
      const attendu = ecrit.replace(/,(\d)$/, ',$10').replace(/,00$/, '');
      assert.equal(relu, attendu, ecrit + ' -> ' + cts + ' cts -> ' + relu);
    }
  }
  poserDeviseActive(DEVISE_DEFAUT);
});
