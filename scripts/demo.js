#!/usr/bin/env node
/**
 * Remplit la file du jour avec quelques clients : npm run demo
 *
 *   npm run demo -- --si-vide     ne fait rien si la journee a deja des tickets
 *
 * A n'utiliser que sur une installation d'essai. Le script refuse de tourner si
 * la journee contient deja des tickets et que --si-vide est passe ; sans ce
 * drapeau, il ajoute simplement ses clients a la suite.
 */
import { assertConfig } from '../server/core/config.js';
import { one, closePool } from '../server/db/index.js';
import { jourLocal } from '../server/core/temps.js';
import { prendreTour, appeler, terminer, marquerAbsent, chargerEtat, pourSalon } from '../server/domain/file.js';

assertConfig();

const CLIENTS = [
  { prenom: 'Youssef', nom: 'Benali', telephone: '612345601', source: 'ONLINE' },
  { prenom: 'Ahmed', nom: 'Mejdoubi', telephone: '612345602', source: 'QR' },
  { prenom: 'Karim', nom: 'Ouali', telephone: '612345603', source: 'ONLINE' },
  { prenom: 'Mehdi', nom: 'Fassi', telephone: '612345604', source: 'QR' },
  { prenom: 'Sofia', nom: 'Martin', telephone: '612345605', source: 'ONLINE' },
  { prenom: 'Rachid', nom: 'Amrani', telephone: '612345606', source: 'COMPTOIR' },
];

async function main() {
  const jour = jourLocal();
  const deja = await one('SELECT COUNT(*)::int AS n FROM tickets WHERE jour = $1', [jour]);

  if (process.argv.includes('--si-vide') && deja.n > 0) {
    console.log('  La journee contient deja ' + deja.n + ' ticket(s) : rien a faire.');
    return;
  }

  const crees = [];
  for (const client of CLIENTS) {
    const { ticket } = await prendreTour(client);
    crees.push(ticket);
    console.log('  ' + ticket.numero_affiche + '  ' + client.prenom + ' ' + client.nom + '  (' + client.source + ')');
  }

  // Un parcours reel : le premier est servi, le deuxieme est absent et repart
  // en fin de file, le troisieme est au fauteuil.
  await terminer(crees[0].id, { user: null });
  console.log('  ' + crees[0].numero_affiche + ' servi.');

  await appeler(crees[1].id, { user: null });
  await marquerAbsent(crees[1].id, { user: null });
  console.log('  ' + crees[1].numero_affiche + ' absent : replace en fin de file.');

  await appeler(crees[2].id, { user: null });
  console.log('  ' + crees[2].numero_affiche + ' appele.');

  const file = pourSalon(await chargerEtat(jour));
  console.log('\n  File du ' + jour + ' : ' + file.attente.length + ' en attente, '
    + file.compteurs.servis + ' servi(s), ' + file.compteurs.retards + ' retard(s).\n');
}

main()
  .then(() => closePool())
  .catch(async (err) => {
    console.error('\n  Echec de la demo : ' + err.message);
    await closePool().catch(() => {});
    process.exit(1);
  });
