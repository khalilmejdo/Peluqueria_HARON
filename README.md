# L'application du salon — file d'attente, rendez-vous, vitrine

**Une application, autant de salons qu'on veut : barbier, salon de coiffure,
institut de beauté. Le nom, le logo, les couleurs, les lettres et la carte se
règlent à l'écran.**

Née pour la Peluquería HARON, elle se vend maintenant à d'autres maisons : rien
dans le code ne porte plus le nom ni les couleurs d'un salon.

Le client **réserve un créneau** (prestation, professionnel, jour, heure) ou
**prend son tour** depuis son téléphone et suit sa position en direct. Le salon
tient sa file, son agenda et sa carte. Pas de compte client, pas de mot de
passe, pas d'application à installer.

> Deux langues (espagnol, français), deux monnaies (euro, dirham). Le code reste
> commenté en français.

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

**Sur une machine nue** — Oracle Cloud *Always Free*, ou n'importe quel serveur
avec Docker. Trois conteneurs : Caddy (HTTPS automatique), l'application,
PostgreSQL.

```bash
npm run keygen                                       # les trois secrets → .env
docker compose -f docker-compose.oci.yml up -d --build
```

Guide complet, pas à pas : [`docs/DEPLOIEMENT-OCI.md`](docs/DEPLOIEMENT-OCI.md).

**Derrière un proxy déjà en place** (Coolify, Traefik, nginx) :

```bash
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

Détails et exploitation : [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md).

---

## Le lien de suivi, et WhatsApp

Le client repart avec **un lien**. C'est son ticket : ni compte, ni mot de passe.
Il l'ouvre quand il veut et voit, en direct, combien de personnes restent avant
lui. Juste après avoir pris son tour, la page lui propose **Copier le lien** et
**Envoyer le lien** — sur téléphone, il se l'envoie lui-même sur WhatsApp en
deux appuis.

**Cela ne coûte rien au salon** : c'est le téléphone du client qui envoie.

L'envoi **automatique**, lui, passe par WhatsApp Business et Meta le facture à
la conversation. Il est **désactivé par défaut**. Activé, il ajoute trois
messages, pas un de plus :

| Quand | Message |
|---|---|
| à la prise de tour | « Votre tour est enregistré », avec le numéro et le lien de suivi |
| quand il reste **2 personnes** devant lui (réglable) | « Votre tour approche », avec le lien |
| à l'appel | « C'est votre tour » |

**Sans configuration WhatsApp, l'application est complète et gratuite** : le
client copie ou s'envoie son lien, et le coiffeur dispose d'un bouton *WhatsApp*
qui ouvre la conversation avec le message déjà écrit — envoyé depuis son propre
téléphone, donc sans frais.

Avec `WHATSAPP_ACTIF=true` et un compte WhatsApp Business (API Cloud de Meta),
les trois messages partent seuls. Les identifiants viennent des variables
d'environnement, jamais de la base.

Mise en place et modèles à faire approuver : [`docs/WHATSAPP.md`](docs/WHATSAPP.md).

---

## Ce que le salon peut régler

| | |
|---|---|
| **Langue** | **Espagnol** ou **français**, pour tout : la vitrine, l'écran du salon, les messages, l'espace de gestion, les pages d'erreur. Le changement prend effet immédiatement ; l'écran se recharge pour appliquer la langue du document. Ce que le gérant a écrit lui-même — nom du salon, phrase d'accueil, noms des prestations — n'est jamais traduit. |
| **Monnaie** | **Euro (€)** ou **dirham (DH)**. Change le symbole des prix, et rien d'autre : les montants déjà saisis ne sont pas convertis, « 15 € » devient « 15 DH ». Un taux de change dormant dans le code serait faux six mois plus tard, et personne ne saurait quel prix a été enregistré. |
| **Fiche de prix** | Une liste simple — service, prix, note — affichée en vitrine sur la page d'accueil. Ajout, renommage, réordonnancement, masquage. Le prix se tape « 14 » ou « 14,90 » ; il est stocké en centimes entiers, jamais en flottant. |
| **Hors ligne** | La vitrine et la page de suivi restent lisibles sans réseau : un travailleur de service garde la dernière page vue, et un bandeau ambre dit que le chiffre affiché n'est plus frais. L'API n'est jamais mise en cache. |
| **Galerie** | Photos envoyées depuis le téléphone (onglet Galerie) : réduites avant l'envoi, légende, ordre, masquer, et une **photo de couverture** affichée en grand en haut de la vitrine. Interrupteur pour retirer la section. Type vérifié dans les octets, jamais dans l'extension. |
| **Sections de la vitrine** | Galerie, carte et itinéraire, contact et horaires, « comment ça marche » : chacune s'éteint depuis les réglages. Le bilan « Votre vitrine », en tête des réglages, dit ce que voient les visiteurs et ce qui manque pour le reste. |
| **Fauteuils** | Autant que le salon en a. Nom libre, nom du coiffeur, ouverture et fermeture à la demande. |
| **Organisation de la file** | **Une seule file** (par défaut) : le client prend un tour, le premier coiffeur libre le sert. **Une file par coiffeur** : le client choisit le sien et attend dans sa file. Se change avec une file vide. |
| **Arrêter les prises de tour** | Un appui. La file en cours continue, personne de nouveau n'entre. |
| **Congés** | Une période déclarée à l'avance, annoncée aux clients avec la date de réouverture. |
| **Durée moyenne d'une coupe** | Sert à estimer l'attente. 20 minutes par défaut. |
| **Prévenir à N personnes** | Seuil du message « votre tour approche ». 2 par défaut. |
| **Horaires** | Facultatif : refuser les tours hors des heures d'ouverture. |
| **Nom, adresse, téléphone** | Affichés au client et repris dans les messages. |
| **QR Code** | Affiché, téléchargeable en SVG et PNG, avec une affiche prête à imprimer. |

### Installer le salon au Maroc

Trois valeurs se règlent à l'écran (langue, monnaie, identité) ; trois autres
vivent dans le `.env` du serveur, parce que les changer en cours de journée
déplacerait la file :

```ini
APP_LANGUE=fr                      # lu seulement à la première installation
APP_MONNAIE=MAD                    # idem : ensuite, l'écran commande
APP_TIMEZONE=Africa/Casablanca     # décide de ce qu'est « aujourd'hui »
TELEPHONE_INDICATIF_DEFAUT=212     # appliqué aux numéros saisis sans « + »
WHATSAPP_LANGUE=fr                 # les modèles Meta sont déclarés par langue
```

`APP_LANGUE` et `APP_MONNAIE` ne sont lues **que** par le seed, sur une base où
le réglage n'existe pas encore : elles décident de la langue dans laquelle le
salon s'installe — l'accroche de la page d'accueil, le nom du premier fauteuil,
les quinze prestations de départ (avec des prix en dirhams plausibles, pas la
conversion des prix espagnols) et le nom du compte gérant.

Les trois autres ne se règlent pas à l'écran, mais **s'y voient** : l'écran des
réglages les affiche sous l'identité, avec le nom de leur variable, et signale
en ambre ce qui ne concorde pas avec la monnaie choisie — un salon qui encaisse
en dirhams avec le fuseau de Madrid changerait de jour à la mauvaise heure, en
silence.

---

## La marque blanche

Trois niveaux de compte, chacun faisant tout ce que fait celui d'en dessous :

| Rôle | Ce qu'il règle |
|---|---|
| Professionnel (`COIFFEUR`) | la file et l'agenda du jour |
| Gérant (`GERANT`) | horaires, carte, galerie, congés, rendez-vous, comptes |
| Administrateur de la plateforme (`SUPERADMIN`) | **la marque** : nom, activité, langue, monnaie, logo, palette, typographie, formes |

L'administrateur de la plateforme est **vous**, l'éditeur. Son compte se crée
depuis le serveur, jamais depuis le réseau :

```bash
docker compose -f docker-compose.oci.yml exec app \
  node scripts/coiffeur.js --identifiant=khalil --nom="Khalil" --role=SUPERADMIN
```

Tant qu'aucun compte de ce rôle n'existe, le gérant garde la main sur la marque
(un salon déjà en service n'est pas bloqué). Dès qu'il existe, l'onglet
**Marque** n'appartient qu'à lui, et le gérant ne peut ni le modifier, ni le
réinitialiser, ni se donner ce rôle.

**Ce que la marque change** : sept palettes (dont « Mes couleurs », deux
couleurs au choix — le contraste des textes est recalculé pour rester
lisible), trois typographies, trois formes, le monogramme ou un logo, et
l'activité, qui règle le vocabulaire (« votre barbier », « votre
esthéticienne ») et propose une carte type. Tout est servi par `/theme.css`,
généré depuis les réglages : la politique de sécurité du contenu reste stricte,
aucun style en ligne. L'icône de l'application, le manifeste et l'aperçu de
partage suivent la marque.

Installation neuve (lues une seule fois, sur une base vierge) :

```bash
APP_LANGUE=fr
APP_MONNAIE=MAD
APP_ACTIVITE=PELUQUERIA    # BARBERIA | PELUQUERIA | UNISEX | ESTETICA
```

## Les rendez-vous

Activés dans **Réglages › Rendez-vous et file en ligne** (ils demandent les
horaires d'ouverture). Le salon peut proposer les rendez-vous, la file en
ligne, ou les deux ; la file du comptoir reste toujours ouverte au personnel.

- Le client choisit prestations, professionnel (ou « sans préférence »), jour
  et heure sur `/rendez-vous`. La page fonctionne sans JavaScript.
- Il reçoit un lien `/rdv/<jeton>` : consulter, ajouter à son agenda (.ics),
  annuler jusqu'à N heures avant.
- Le salon voit l'onglet **Agenda** : arrivé, installer, absent, annuler,
  déplacer, écrire par WhatsApp, et noter un rendez-vous pris au téléphone.
- « Installer » fait du client un tour de la file, déjà au fauteuil : la suite
  (servi, historique, chiffres) est celle de tous les clients. Le bouton
  « suivant » d'un fauteuil prend d'abord son client de rendez-vous arrivé.

Deux rendez-vous ne peuvent pas se chevaucher sur un même fauteuil : c'est une
**contrainte d'exclusion de la base**, pas une vérification du code. Les
messages WhatsApp automatiques ne couvrent pas (encore) les rendez-vous : le
salon écrit au client depuis l'agenda.

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
| La fiche de prix ne porte pas deux fois la même prestation | index unique sur le nom normalisé |
| Un prix ne dérive jamais d'un centime | entier de centimes de bout en bout, aucun flottant |
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
                    langue.js + textes.js  ← une clé, deux langues, une ligne
                    devise.js              ← euro ou dirham, centimes entiers
  http/             routeur, contexte, corps, fichiers statiques, en-têtes
  db/               schema.sql (idempotent), accès, données de référence
  domain/           file.js  ← LE CŒUR
                    journee.js, postes.js, fermetures.js, tarifas.js,
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
