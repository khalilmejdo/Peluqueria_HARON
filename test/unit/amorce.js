/**
 * Amorce des tests unitaires.
 *
 * Les modules du serveur lisent l'environnement a leur PREMIER import. Ce
 * fichier doit donc etre importe AVANT eux — en ESM, les dependances sont
 * evaluees dans l'ordre des declarations d'import, donc une ligne
 * `import './amorce.js';` placee en tete suffit.
 *
 * Il pose des secrets jetables et coupe la lecture du .env : un test unitaire
 * ne doit jamais dependre de la machine sur laquelle il tourne.
 */
import crypto from 'node:crypto';

process.env.HARON_SANS_DOTENV = '1';
process.env.HARON_LOG_SILENCE = '1';
process.env.NODE_ENV = 'test';
process.env.APP_SECRET ||= crypto.randomBytes(32).toString('hex');
process.env.APP_ENCRYPTION_KEY ||= crypto.randomBytes(32).toString('hex');
process.env.APP_PASSWORD_PEPPER ||= crypto.randomBytes(32).toString('hex');
process.env.APP_TIMEZONE ||= 'Europe/Madrid';
process.env.TELEPHONE_INDICATIF_DEFAUT ||= '34';
process.env.DATABASE_URL ||= 'postgresql://inutile@127.0.0.1:1/inutile';
