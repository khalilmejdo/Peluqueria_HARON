/**
 * LA MARQUE BLANCHE ET LES CRENEAUX — les calculs purs.
 *
 * Ce qui fait qu'une meme application devient le salon d'un client (theme,
 * vocabulaire, carte de depart), et ce qui decide d'une heure libre. Rien ici
 * ne touche la base : ce sont les regles, ligne a ligne.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { creneauxDuJour, fauteuilLeMoinsCharge, parMoment, enHeure, enMinutes } from '../../server/domain/creneaux.js';
import {
  themeDe, cssDuTheme, contraste, lisibleSur, PALETTES_DEF, TYPOGRAPHIES_DEF, ANGLES_DEF, STYLE_DE_L_ACTIVITE,
  initiales, paletteComposee, empreinte,
} from '../../server/core/theme.js';
import { TERMES, texte, poserActivite } from '../../server/core/langue.js';
import { TERMES as TERMES_CLIENT } from '../../public/js/langue.js';
import { TEXTES } from '../../server/core/textes.js';
import { CATALOGUES } from '../../server/domain/catalogues.js';
import { ICONES } from '../../server/site/icones-tarifas.js';
import { ACTIVITES, ACCUEILS, PALETTES, TYPOGRAPHIES, ANGLES, CATALOGUE } from '../../server/core/reglages.js';
import { monogramme, filet, icone, NOMS_ICONES, planStylise } from '../../server/site/ornements.js';
import { faviconSvg, icone as iconePng } from '../../server/core/images-marque.js';
import { aLeRole, rolesAttribuables } from '../../server/core/roles.js';
import { fichierIcs } from '../../server/domain/rendezvous.js';

const P = [{ id: 'a' }, { id: 'b' }];
const JOURNEE = [{ ouverture: '09:30', fermeture: '14:00' }, { ouverture: '16:00', fermeture: '20:00' }];

test('une heure n est proposee que si la prestation tient ENTIERE dans une plage', () => {
  const c = creneauxDuJour({ plages: JOURNEE, postes: P, duree: 60, pas: 30 });
  const heures = c.map((x) => x.heure);
  assert.equal(heures[0], '09:30');
  assert.ok(heures.includes('13:00'), 'la derniere heure du matin finit a 14:00 pile');
  assert.ok(!heures.includes('13:30'), '13:30 + 1 h deborderait sur la coupure');
  assert.ok(!heures.includes('14:00') && !heures.includes('15:30'), 'rien pendant la coupure');
  assert.ok(heures.includes('19:00') && !heures.includes('19:30'), 'rien qui depasse la fermeture');
});

test('un fauteuil pris laisse l heure ouverte tant qu un autre est libre', () => {
  const occupes = [{ posteId: 'a', debut: enMinutes('10:00'), fin: enMinutes('11:00') }];
  const c = creneauxDuJour({ plages: JOURNEE, postes: P, occupes, duree: 60, pas: 30 });
  const dix = c.find((x) => x.heure === '10:00');
  assert.deepEqual(dix.postes, ['b']);
  // Le meme calcul pour le seul fauteuil pris : 9:30 chevauche (9:30-10:30), 11:00 est libre.
  const seul = creneauxDuJour({ plages: JOURNEE, postes: [{ id: 'a' }], occupes, duree: 60, pas: 30 }).map((x) => x.heure);
  assert.ok(!seul.includes('09:30') && !seul.includes('10:00') && !seul.includes('10:30'));
  assert.ok(seul.includes('11:00'), 'un rendez-vous qui finit a 11:00 libere 11:00');
});

test('le tampon ecarte les rendez-vous, et le delai ecarte les heures trop proches', () => {
  const occupes = [{ posteId: 'a', debut: enMinutes('10:00'), fin: enMinutes('11:00') }];
  const avec = creneauxDuJour({ plages: JOURNEE, postes: [{ id: 'a' }], occupes, duree: 30, pas: 15, tampon: 15 }).map((x) => x.heure);
  assert.ok(!avec.includes('11:00'), 'le tampon de 15 min interdit 11:00');
  assert.ok(avec.includes('11:15'));
  const tard = creneauxDuJour({ plages: JOURNEE, postes: P, duree: 30, pas: 30, auPlusTotMinutes: enMinutes('17:10') }).map((x) => x.heure);
  assert.equal(tard[0], '17:30');
});

test('sans fauteuil, sans duree ou sans pas : aucune heure, jamais de boucle', () => {
  assert.deepEqual(creneauxDuJour({ plages: JOURNEE, postes: [], duree: 30, pas: 15 }), []);
  assert.deepEqual(creneauxDuJour({ plages: JOURNEE, postes: P, duree: 0, pas: 15 }), []);
  assert.deepEqual(creneauxDuJour({ plages: JOURNEE, postes: P, duree: 30, pas: 0 }), []);
  assert.deepEqual(creneauxDuJour({ plages: [{ ouverture: '20:00', fermeture: '09:00' }], postes: P, duree: 30, pas: 15 }), []);
});

test('sans preference : le fauteuil le moins charge, puis l ordre du salon', () => {
  const occupes = [{ posteId: 'a' }, { posteId: 'a' }, { posteId: 'b' }];
  assert.equal(fauteuilLeMoinsCharge(['a', 'b'], occupes, ['a', 'b']), 'b');
  assert.equal(fauteuilLeMoinsCharge(['a', 'b'], [], ['b', 'a']), 'b');
  assert.equal(fauteuilLeMoinsCharge([], [], []), null);
  const g = parMoment([{ minutes: 600 }, { minutes: 780 }, { minutes: 1110 }]);
  assert.deepEqual([g.matin.length, g.apresMidi.length, g.soir.length], [1, 1, 1]);
  assert.equal(enHeure(545), '09:05');
  assert.ok(Number.isNaN(enMinutes('25:00')));
});

test('chaque palette se LIT : texte, texte doux et accent tiennent le contraste', () => {
  for (const nom of [...Object.keys(PALETTES_DEF), 'PERSO']) {
    const v = themeDe({ 'marque.palette': nom, 'marque.couleurFond': '#f6f1e7', 'marque.couleurAccent': '#e8d9a8' }).variables;
    for (const fond of [v['--fond'], v['--surface']]) {
      assert.ok(contraste(v['--texte'], fond) >= 7, nom + ' : texte ' + contraste(v['--texte'], fond).toFixed(1));
      assert.ok(contraste(v['--accent-lisible'], fond) >= 4.5, nom + ' : accent lisible ' + contraste(v['--accent-lisible'], fond).toFixed(2));
    }
    assert.ok(contraste(v['--texte-doux'], v['--surface']) >= 4.5, nom + ' : texte doux');
    assert.ok(contraste(v['--sur-accent'], v['--accent']) >= 4.5, nom + ' : texte du bouton');
    assert.ok(contraste(v['--accent-sur-clair'], '#ffffff') >= 4.5, nom + ' : accent sur papier');
  }
});

test('un accent illisible est corrige, un accent lisible est garde tel quel', () => {
  assert.equal(lisibleSur('#000000', '#ffffff'), '#000000');
  const corrige = lisibleSur('#f5e9c8', '#ffffff');
  assert.notEqual(corrige, '#f5e9c8');
  assert.ok(contraste(corrige, '#ffffff') >= 4.5);
  const p = paletteComposee('#101014', '#c9a45c');
  assert.ok(contraste(p.texte, p.fond) > 12);
});

test('le theme est une feuille de style, et son empreinte change avec lui', () => {
  const a = cssDuTheme(themeDe({ 'marque.palette': 'ONYX' }));
  const b = cssDuTheme(themeDe({ 'marque.palette': 'IVOIRE' }));
  assert.match(a, /^\/\* [^*]+\*\/\n:root \{/);
  assert.match(a, /color-scheme: dark/);
  assert.match(b, /color-scheme: light/);
  assert.notEqual(empreinte(a), empreinte(b));
  assert.ok(!/[<>]/.test(a), 'une feuille de style ne porte pas de balise');
  // Une couleur trafiquee ne passe pas dans la feuille : elle retombe sur le defaut.
  const piege = cssDuTheme(themeDe({ 'marque.palette': 'PERSO', 'marque.couleurFond': 'red;}body{display:none', 'marque.couleurAccent': '</style>' }));
  assert.ok(!piege.includes('display:none') && !piege.includes('</style>'));
});

test('les listes du catalogue de reglages et du theme disent la meme chose', () => {
  assert.deepEqual([...PALETTES].sort(), [...Object.keys(PALETTES_DEF), 'PERSO'].sort());
  assert.deepEqual([...TYPOGRAPHIES].sort(), Object.keys(TYPOGRAPHIES_DEF).sort());
  assert.deepEqual([...ANGLES].sort(), Object.keys(ANGLES_DEF).sort());
  assert.deepEqual([...ACTIVITES].sort(), Object.keys(STYLE_DE_L_ACTIVITE).sort());
  assert.deepEqual([...ACTIVITES].sort(), Object.keys(CATALOGUES).sort());
  for (const style of Object.values(STYLE_DE_L_ACTIVITE)) {
    assert.ok(ACCUEILS.includes(style.accueil), 'accueil inconnu : ' + style.accueil);
    assert.ok(PALETTES_DEF[style.palette] && TYPOGRAPHIES_DEF[style.typographie] && ANGLES_DEF[style.angles]);
  }
  // Ce qui est de la marque est reserve a l'administrateur de la plateforme.
  for (const cle of ['salon.nom', 'salon.idioma', 'salon.moneda', 'marque.palette', 'marque.activite', 'marque.couleurAccent']) {
    assert.equal(CATALOGUE[cle].reserve, 'SUPERADMIN', cle);
  }
  assert.equal(CATALOGUE['salon.adresse'].reserve, undefined, 'l adresse reste au gerant');
});

test('le vocabulaire suit l activite, a l identique sur le serveur et dans le navigateur', () => {
  assert.deepEqual(TERMES, TERMES_CLIENT);
  assert.deepEqual(Object.keys(TERMES).sort(), [...ACTIVITES].sort());
  poserActivite('BARBERIA');
  assert.equal(texte('fr', 'rdvp.etape.pro'), 'Votre barbier');
  poserActivite('ESTETICA');
  assert.equal(texte('fr', 'rdvp.etape.pro'), 'Votre esthéticienne');
  assert.equal(texte('es', 'mx.equipe.role'), 'Esteticista');
  assert.equal(texte('es', 'accueil.titre', { nom: 'Lumière' }), 'Lumière — Estética y belleza');
  // Une activite inconnue ne casse rien : on retombe sur la premiere.
  assert.equal(poserActivite('N_IMPORTE'), 'BARBERIA');
});

test('chaque carte de depart est ecrite dans les deux langues, avec des dessins qui existent', () => {
  for (const [activite, lignes] of Object.entries(CATALOGUES)) {
    assert.ok(lignes.length >= 8, activite + ' : carte trop courte');
    const noms = new Set();
    for (const [cleNom, cleChapitre, prix, dessin, duree] of lignes) {
      for (const cle of [cleNom, cleChapitre]) {
        assert.ok(TEXTES[cle]?.es && TEXTES[cle]?.fr, activite + ' : ' + cle + ' manque dans une langue');
      }
      assert.ok(ICONES.includes(dessin), activite + ' : dessin inconnu « ' + dessin + ' »');
      assert.ok(prix.EUR > 0 && prix.MAD > 0 && duree >= 1 && duree <= 240, activite + ' : ' + cleNom);
      assert.ok(!noms.has(TEXTES[cleNom].fr), activite + ' : doublon ' + cleNom);
      noms.add(TEXTES[cleNom].fr);
    }
  }
});

test('les ornements et les images de marque ne portent ni script ni saisie brute', () => {
  const dessins = [monogramme('<b>'), filet(), planStylise(), ...NOMS_ICONES.map((n) => icone(n))];
  for (const d of dessins) {
    assert.ok(d.length > 20);
    assert.ok(!/<script|\son[a-z]+\s*=|javascript:/i.test(d), d.slice(0, 80));
  }
  assert.ok(monogramme('<b>').includes('&lt;b&gt;') && !monogramme('<b>').includes('<b>'));
  assert.equal(icone('inconnue'), '');
  const theme = themeDe({ 'marque.palette': 'ONYX' });
  const svg = faviconSvg(theme, '<x>');
  assert.ok(svg.includes('&lt;x&gt;') && !svg.includes('<x>'));
  const png = iconePng(48, { fond: '#0b0b0d', surface: '#1b1b1f', accent: '#c9a45c', activite: 'ESTETICA' });
  assert.equal(png.rgb.length, 48 * 48 * 3);
  assert.equal(initiales('Salon de la Rose'), 'R');
  assert.equal(initiales('Maison Élise Durand'), 'ÉD');
  assert.equal(initiales(''), 'H');
});

test('trois niveaux : chacun fait ce que fait celui d en dessous, pas l inverse', () => {
  const u = (role) => ({ role });
  assert.ok(aLeRole(u('SUPERADMIN'), 'GERANT') && aLeRole(u('SUPERADMIN'), 'COIFFEUR'));
  assert.ok(aLeRole(u('GERANT'), 'COIFFEUR') && !aLeRole(u('GERANT'), 'SUPERADMIN'));
  assert.ok(!aLeRole(u('COIFFEUR'), 'GERANT'));
  assert.ok(!aLeRole(u('GERANT'), 'N_IMPORTE'), 'un role inconnu ne s obtient jamais');
  assert.deepEqual(rolesAttribuables(u('GERANT')), ['COIFFEUR', 'GERANT']);
  assert.deepEqual(rolesAttribuables(u('COIFFEUR')), ['COIFFEUR']);
});

test('l invitation de calendrier est un fichier ics bien forme', () => {
  const ics = fichierIcs({ id: 'abc', debut: '2026-10-12T15:00:00.000Z', fin: '2026-10-12T16:00:00.000Z' },
    { titre: 'Rendez-vous, Maison; Élise', lieu: 'Calle Mayor 12', description: 'Coupe\nhttps://x/rdv/1' });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261012T150000Z\r\n/);
  assert.match(ics, /DTEND:20261012T160000Z\r\n/);
  assert.ok(ics.includes('SUMMARY:Rendez-vous\\, Maison\\; Élise'));
  assert.ok(ics.includes('DESCRIPTION:Coupe\\nhttps://x/rdv/1'));
  assert.match(ics, /END:VCALENDAR\r\n$/);
});
