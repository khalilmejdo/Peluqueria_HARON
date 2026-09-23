#!/usr/bin/env node
/**
 * Genere les trois secrets de l'application : npm run keygen
 *
 * A coller dans .env (ou dans l'interface de l'hebergeur). Ils ne doivent
 * JAMAIS etre commites, ni partages, ni reutilises d'une installation a l'autre.
 *
 * Changer APP_ENCRYPTION_KEY rend illisibles les numeros WhatsApp deja
 * enregistres : pour en changer sans rien perdre, poser l'ancienne dans
 * APP_ENCRYPTION_KEY_PREVIOUS le temps de la bascule.
 */
import crypto from 'node:crypto';

const cle = () => crypto.randomBytes(32).toString('hex');

console.log('\n  Secrets pour .env — a garder, a ne jamais commiter :\n');
console.log('APP_SECRET=' + cle());
console.log('APP_ENCRYPTION_KEY=' + cle());
console.log('APP_PASSWORD_PEPPER=' + cle());
console.log('\n  Et un mot de passe de depart pour le premier compte :\n');
console.log('BOOTSTRAP_ADMIN_PASSWORD=' + crypto.randomBytes(12).toString('base64url'));
console.log('');
