# Peluquería HARON

**Un salon. Une file. Un ticket. Un lien WhatsApp. Zéro complication.**

Le client prend son tour depuis son téléphone — en ligne ou en scannant le QR
Code de la vitrine — et suit sa position en direct. Le coiffeur voit le client
actuel en très gros et appuie sur un seul bouton.

Pas de compte client, pas de mot de passe, pas d'application à installer,
pas de créneau à choisir.

---

## Le parcours

**Client** → accueil → *Prendre mon tour* → prénom, nom, WhatsApp → son numéro
de ticket et son lien de suivi → il suit sa position, qui bouge toute seule.

**Coiffeur** → `/gestion` → le client actuel en grand → **CLIENT SERVI ✓** →
le suivant apparaît.

**Client absent** → *Absent / en retard* → il n'est pas supprimé : il repart en
fin de file, garde son numéro, et son compteur d'absences monte.

---

## Démarrer en cinq minutes

```bash
npm install
npm run keygen          # colle les trois secrets dans .env (voir .env.example)
cp .env.example .env    # puis renseigne DATABASE_URL et PUBLIC_URL
npm run migrate         # applique le schéma (idempotent)
npm run seed            # réglages par défaut + premier compte
npm run demo            # facultatif : une file de démonstration
npm run dev             # http://localhost:3000
```

L'espace du salon est sur `/gestion`. Le premier compte vient de
`BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` ; il devra changer son
mot de passe à la première connexion.

Plus personne ne peut entrer ? La porte de secours s'ouvre depuis le serveur :

```bash
npm run coiffeur -- --identifiant=youssef --nom="Youssef Haron" --role=GERANT
```

---

## Mise en production

```bash
npm run keygen                      # les trois secrets, dans l'hébergeur
docker compose up -d --build
```

`PUBLIC_URL` est **l'adresse qu'encode le QR Code collé en vitrine**. Elle ne
doit plus changer une fois l'affiche imprimée : fixez-la avant d'imprimer.

Avant chaque mise en ligne :

```bash
npm run check                       # dit ce qui manque et ce qui mérite un regard
npm run verify                      # tous les tests
```

Le conteneur applique le schéma et les données de référence à chaque démarrage.
Les deux opérations sont idempotentes : un redéploiement en pleine journée ne
touche ni la file en cours, ni les réglages du salon.

Détails : [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md).

---

## WhatsApp

Trois messages, pas un de plus :

| Quand | Message |
|---|---|
| à la prise de tour | « Votre tour est enregistré », avec le numéro et le lien de suivi |
| quand il reste **2 personnes** devant lui (réglable) | « Votre tour approche », avec le lien |
| à l'appel | « C'est votre tour » |

**Sans configuration WhatsApp, l'application est complète** : le client voit son
lien à l'écran, et le coiffeur dispose d'un bouton *WhatsApp* qui ouvre la
conversation avec le message déjà écrit. C'est la solution du premier jour.

Avec `WHATSAPP_ACTIF=true` et un compte WhatsApp Business (API Cloud de Meta),
les trois messages partent seuls. Les identifiants viennent des variables
d'environnement, jamais de la base.

Mise en place et modèles à faire approuver : [`docs/WHATSAPP.md`](docs/WHATSAPP.md).

---

## Ce que le salon peut régler

| | |
|---|---|
| **Fauteuils** | Autant que le salon en a. Nom libre, nom du coiffeur, ouverture et fermeture à la demande. |
| **Organisation de la file** | **Une seule file** (par défaut) : le client prend un tour, le premier coiffeur libre le sert. **Une file par coiffeur** : le client choisit le sien et attend dans sa file. Se change avec une file vide. |
| **Arrêter les prises de tour** | Un appui. La file en cours continue, personne de nouveau n'entre. |
| **Congés** | Une période déclarée à l'avance, annoncée aux clients avec la date de réouverture. |
| **Durée moyenne d'une coupe** | Sert à estimer l'attente. 20 minutes par défaut. |
| **Prévenir à N personnes** | Seuil du message « votre tour approche ». 2 par défaut. |
| **Horaires** | Facultatif : refuser les tours hors des heures d'ouverture. |
| **Nom, adresse, téléphone** | Affichés au client et repris dans les messages. |
| **QR Code** | Affiché, téléchargeable en SVG et PNG, avec une affiche prête à imprimer. |

---

## Ce qui est garanti, et par quoi

Ces règles ne dépendent pas du code : elles sont portées par la base, et
vérifiées par des tests qui font agir deux personnes au même instant.

| Règle | Garantie par |
|---|---|
| Deux clients n'occupent jamais la même position | index unique `(jour, rang)` — un rang n'est jamais réutilisé |
| Deux clients n'ont jamais le même numéro | index unique `(jour, numéro)` |
| Un fauteuil ne sert qu'un client à la fois | index unique partiel `(jour, poste_id)` |
| Un client appelé est toujours rattaché à un fauteuil | contrainte `CHECK` |
| Un ticket d'une journée close ne bouge plus | déclencheur PostgreSQL, erreur `HR001` |
| Un client ne reçoit jamais deux fois le même message | unique `(ticket, type, passage)` |
| Personne n'atteint le ticket d'un autre | jeton de 192 bits, stocké en condensat seul |
| Aucun numéro WhatsApp ne sort côté public | chiffré AES-256-GCM, jamais dans une réponse publique ni dans les journaux |

---

## Carte du dépôt

```
server/
  index.js          chaîne de traitement d'une requête
  app.js            montage de toutes les routes — toute la surface exposée
  core/             config, crypto, sessions, validation, temps du salon,
                    réglages, diffusion temps réel (SSE), WhatsApp, QR Code, PNG
  http/             routeur, contexte, corps, fichiers statiques, en-têtes
  db/               schema.sql (idempotent), accès, données de référence
  domain/           file.js  ← LE CŒUR
                    journee.js, postes.js, fermetures.js,
                    notifications.js, statistiques.js
  routes/           public (sans compte) / salon (session)
  site/             pages du client, rendues par le serveur
public/             CSS, JS vanille, polices, images — zéro framework
test/
  unit/             fonctions pures, sans base
  integration/      vraie base jetable, vrai serveur (banc.js)
docs/
scripts/            migrate, seed, demo, keygen, check, coiffeur, images
```

Une seule dépendance : `pg`. HTTP, routage, sessions, chiffrement, validation,
temps réel, QR Code et PNG sont écrits à la main, sur Node 22+.
Pourquoi : voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Tests

```bash
npm test                # unitaires (aucune base requise)

# intégration : PostgreSQL jetable, chaque fichier crée et supprime SA base
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres npm run test:integration

npm run verify          # les deux
```

Ce que couvre l'intégration : le parcours complet, l'ordre de la file, le
passage au client suivant, les retards et le repositionnement en fin de file,
la clôture d'une journée, l'impossibilité d'atteindre le ticket d'un autre,
l'arrêt des prises de tour, les congés, et la concurrence (vingt-cinq prises de
tour au même instant, deux appels simultanés, un double appui sur « servi »).

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — les choix et leurs raisons
- [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) — mise en ligne, sauvegarde, QR Code
- [`docs/WHATSAPP.md`](docs/WHATSAPP.md) — compte Business, modèles, dépannage
- [`docs/EXPLOITATION.md`](docs/EXPLOITATION.md) — le quotidien du salon
