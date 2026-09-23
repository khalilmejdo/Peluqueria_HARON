# Architecture

Ce document dit **pourquoi** l'application est faite ainsi. Le code dit comment.

---

## 1. Le principe

> Un salon. Une file. Un ticket. Un lien WhatsApp. Zéro complication.

Une seule file par journée. L'origine du client — en ligne, QR Code, comptoir —
est affichée au coiffeur mais **n'entre jamais dans le tri**. L'ordre est celui
des rangs, et rien d'autre.

Tout ce qui n'était pas demandé n'a pas été construit : ni paiement, ni compte
client, ni créneau horaire, ni fidélité, ni messagerie. Trois ajouts seulement
sortent de la commande initiale, et chacun est signalé plus bas.

---

## 2. La pile

Une seule dépendance : `pg`. HTTP, routage, sessions, chiffrement, validation,
temps réel, QR Code et PNG sont écrits à la main, sur Node 22+ et PostgreSQL 16.

Pourquoi : c'est la pile déjà éprouvée sur les trois autres applications du même
auteur, elle se déploie partout, elle n'a pas de chaîne d'approvisionnement à
surveiller, et elle ne se périme pas. Un salon de quartier doit pouvoir faire
tourner cette application cinq ans sans qu'un `npm audit` réclame une migration.

Le prix payé est explicite : un encodeur QR Code de 500 lignes plutôt qu'un
`npm install`. Il est couvert par un test qui relit ce qu'il produit.

### Séparation

| Couche | Emplacement | Rôle |
|---|---|---|
| Socle HTTP | `server/http/` + `server/index.js` | routeur, contexte, CSP, CSRF, débit |
| Noyau | `server/core/` | config, sessions, validation, temps, SSE, WhatsApp, QR |
| Base | `server/db/` | `schema.sql` idempotent, pool, transactions |
| Métier | `server/domain/` | **file.js**, journee.js, fermetures.js, notifications.js, statistiques.js |
| API | `server/routes/` | public (sans compte) / salon (session) |
| Site | `server/site/` | pages du client, rendues par le serveur |
| Interface | `public/` | CSS + JS vanille, temps réel par SSE |

---

## 3. La file

### L'ordre : le rang

Chaque ticket porte un **rang**, entier, unique dans la journée, et **jamais
réutilisé**. L'index unique `(jour, rang)` rend structurellement impossible que
deux clients actifs partagent une position — pas « improbable » : impossible,
quoi que fasse le code.

Le **numéro** (`A024`) est autre chose : c'est ce que le client a sous les yeux.
Il ne change jamais de la journée.

Quand un client est déclaré absent, il reçoit un **rang neuf**, supérieur à tous
les autres. Son numéro ne bouge pas, son historique non plus, son compteur
d'absences monte d'un. S'il est encore absent au tour suivant, le même geste le
repousse encore.

### L'attribution : le verrou de la journée

La ligne `journees` porte les compteurs (dernier numéro, dernier rang). C'est
**elle** qu'on verrouille (`SELECT ... FOR UPDATE`) pour attribuer un ticket.
Deux clients qui appuient sur « Prendre mon tour » à la même milliseconde
passent l'un derrière l'autre, sans verrouiller toute la table des tickets.

Vérifié : vingt-cinq prises de tour simultanées donnent vingt-cinq numéros
consécutifs, sans trou ni doublon (`test/integration/concurrence.test.js`).

### Les statuts

```
WAITING     en attente
LATE        en attente, déjà absent au moins une fois
CALLED      appelé, on l'attend au fauteuil
IN_SERVICE  en cours de coupe
COMPLETED   servi
CANCELLED   annulé
```

`LATE` est un statut d'**attente**, pas une sortie de file : le client reste
dans la file, à sa nouvelle place. Le coiffeur voit du même coup d'œil qui est
déjà reparti une fois.

### Les fauteuils

Le salon en déclare autant qu'il en a. Chaque fauteuil sert **un** client à la
fois ; la file, elle, reste **unique et commune**. C'est ce qui distingue cette
application d'un système de rendez-vous : le client prend un tour, pas un
fauteuil. Il ne choisit ni son siège ni son coiffeur, et n'a d'ailleurs jamais
besoin de savoir combien il y en a — seulement combien de temps il attendra.

L'invariant est porté par un index unique partiel sur `(jour, poste_id)` : deux
fauteuils servent en parallèle, mais deux clients ne peuvent jamais atterrir sur
le même, quoi que fassent deux tablettes au même instant. Un `CHECK` garantit en
plus qu'un client appelé est toujours rattaché à un fauteuil.

Le fauteuil est posé à l'appel, gardé jusqu'au bout, et **conservé après coup** :
c'est lui qui dit « qui a servi qui », y compris un an plus tard. Il est en
revanche effacé si le client repart en fin de file — il libère son siège du même
geste.

Un fauteuil qui a déjà servi ne se supprime pas, il se **ferme** : le supprimer
emporterait l'historique de tous ses tickets. Le salon garde toujours au moins
un fauteuil ouvert, et on ne ferme pas un fauteuil occupé.

### Deux organisations possibles

Le réglage **`file.mode`** décide comment la file est organisée. Il vaut
`UNIQUE` par défaut.

| | `UNIQUE` | `PAR_FAUTEUIL` |
|---|---|---|
| Le client | prend un tour | **choisit son coiffeur** |
| Il est servi par | le premier coiffeur libre | le sien, et lui seul |
| Il voit devant lui | toute la file du salon | la file de son coiffeur |
| Le salon avance | le plus vite possible | au rythme de chaque coiffeur |

Le mode ne se change **qu'avec une file vide**. En pleine journée, les clients
déjà en attente se retrouveraient dans un entre-deux : en file unique ils n'ont
pas de coiffeur, en file par coiffeur ils en auraient un que personne n'a
choisi. C'est un réglage qu'on pose une fois, le matin.

### Le couloir : une seule formule pour les deux modes

Un **couloir** est l'ensemble de ceux qui se disputent la même place :

- en file unique, **un seul couloir**, servi par tous les fauteuils ;
- en file par coiffeur, **un couloir par coiffeur**, servi par lui seul.

`calculerPositions()` ne connaît que cette notion. Il n'existe donc pas une
seconde règle de calcul ailleurs qui pourrait diverger, et le mode n'ajoute pas
un second chemin de code à maintenir.

### Coiffeur choisi et fauteuil qui sert : deux choses

Le ticket porte **deux** références de fauteuil, et il ne faut pas les
confondre :

| Colonne | Ce que c'est | Quand elle change |
|---|---|---|
| `poste_choisi_id` | le coiffeur que **le client** a choisi | jamais |
| `poste_id` | le fauteuil qui **le sert** | posé à l'appel, effacé s'il quitte le fauteuil |

Cette séparation permet à un coiffeur libre de **dépanner la file d'un
collègue** : le client est appelé à son fauteuil, mais il reste le client de
celui qu'il a choisi. S'il est absent, il repart en fin de **sa** file, pas
chez celui qui le dépannait. Le déplacement est écrit dans son historique.

### L'attente, divisée par le nombre de fauteuils

Avec N fauteuils ouverts et des coupes de durée d, les N premiers de la file
commencent tout de suite, les N suivants à d, et ainsi de suite. Celui qui a
`devant` personnes devant lui attend donc :

```
tours = floor(devant / N)
attente = tours × d
```

On appelle **tour** cette unité : zéro tour = je passe dans la foulée, un tour =
il y a une fournée avant moi. Le seuil de prévenance compte lui aussi en tours,
sans quoi « prévenir à 2 personnes » n'aurait pas le même sens selon le nombre
de fauteuils ouverts. Le message WhatsApp, lui, annonce le nombre **réel** de
personnes devant : c'est ce que le client compte des yeux en entrant.

Avec un seul fauteuil, `tours = devant` : le comportement d'origine, à
l'identique.

---

## 4. La journée

La file active est celle d'**aujourd'hui**, lu dans le fuseau du salon
(`APP_TIMEZONE`), jamais en UTC. Sans cela, un ticket pris à 00 h 30 basculerait
dans la journée du lendemain et disparaîtrait de la file.

Deux mécanismes, volontairement redondants :

1. **Paresseux** — tout geste qui touche la file commence par `assurerJournee()` :
   la ligne du jour est créée si elle manque, et toute journée antérieure restée
   ouverte est close au passage. Le salon peut être coupé du réseau une semaine,
   la reprise est propre.
2. **Programmé** — une tâche de fond clôt les journées passées toutes les dix
   minutes, pour que les statistiques soient justes même si personne ne rouvre
   l'application.

La clôture de la journée **en cours** n'est jamais automatique : le coiffeur qui
finit une tête à 20 h 40 alors que le salon ferme à 20 h 30 ne doit pas voir sa
file disparaître. C'est le gérant qui clôt d'un bouton, ou bien elle se clôt au
passage de minuit.

Rien n'est supprimé : les tickets non servis passent en `CANCELLED` avec un
motif lisible, et un déclencheur PostgreSQL interdit ensuite toute modification
(`HR001`). L'historique est protégé même d'un onglet resté ouvert depuis la
veille.

---

## 5. Fermer l'entrée sans fermer la file

Trois raisons, et trois seulement, peuvent refuser une entrée dans la file.
Elles sont classées de la plus durable à la plus passagère, parce que c'est dans
cet ordre qu'un client veut l'apprendre :

| Code | Quand | Qui décide |
|---|---|---|
| `SALON_EN_CONGES` | une période déclarée couvre aujourd'hui | le gérant, à l'avance |
| `PRISE_DE_TOUR_SUSPENDUE` | arrêt manuel | le coiffeur, d'un appui |
| `SALON_FERME` | hors horaires, si le contrôle est activé | les réglages |

**Aucune des trois ne touche à la file** : ceux qui attendent sont servis
jusqu'au dernier. C'est le point important, et il est testé.

Une seule fonction, `etatPriseDeTour()`, répond à la question. La page
d'accueil, le formulaire et la prise de tour l'appellent toutes les trois :
elles disent donc toujours la même chose, et il n'existe pas de cas où le
bouton mène à un refus.

Le **comptoir** échappe à ces trois règles : le coiffeur est physiquement là, il
a quelqu'un devant lui, et c'est lui qui décide. Une règle qui contredit la
personne présente est une règle qu'on contourne avec un papier.

---

## 6. Le temps réel

Un flux d'événements (SSE), pas de WebSocket.

Le téléphone d'un client reste sur la page de suivi, parfois une heure. SSE
tient cela avec une seule connexion sortante, se reconnecte de lui-même, et
traverse les proxys HTTP ordinaires — là où un WebSocket demande une
négociation particulière à chaque relais.

Quand la file change, l'état de la journée est relu **une fois**, puis chaque
abonné reçoit la projection qui le concerne :

- **le salon** reçoit la file entière, numéros WhatsApp compris ;
- **un client** reçoit sa position, son statut, son estimation. Rien d'autre :
  ni le nom, ni le numéro, ni même l'existence des autres.

Trente clients connectés coûtent donc une requête, pas trente.

Les changements sont regroupés sur 60 ms : le coiffeur qui termine un client
puis appelle le suivant produit deux gestes rapprochés, pas deux salves.

Un battement toutes les 25 secondes garde les connexions ouvertes à travers les
proxys. Au retour de veille d'un téléphone, la page relit une fois l'état par
requête ordinaire puis repart d'une connexion neuve : `EventSource` rend
parfois une connexion morte sans le dire.

---

## 7. Sécurité

### Le lien de suivi

192 bits d'entropie, en base64url. La base ne garde que son **condensat
SHA-256** : personne ne remonte d'un ticket vers son lien, et un vol de la base
ne donne accès à aucune page de suivi.

Une seconde colonne garde le jeton **chiffré** (AES-256-GCM), uniquement pour
remettre le lien dans les messages WhatsApp qui suivent la confirmation. La clé
vit dans l'environnement, jamais dans la base : le vol de la seule base ne donne
donc toujours rien.

Un jeton mal formé, un jeton inconnu et un jeton d'une autre journée rendent
**exactement la même réponse** : rien ne dit à qui cherche lequel avait la bonne
forme. La limitation de débit arrête l'énumération bien avant l'arithmétique.

### Le numéro WhatsApp

Chiffré (AES-256-GCM), avec un **index aveugle** HMAC-SHA-256 qui permet de
reconnaître « ce numéro a déjà un tour aujourd'hui » sans jamais déchiffrer la
colonne. Les quatre derniers chiffres sont gardés en clair, pour l'affichage
masqué.

Il ne sort jamais par une route publique, ni dans les journaux (le journal
expurge `telephone`, `whatsapp`, `jeton`). Il n'apparaît dans l'espace du salon
que lorsqu'on demande explicitement à écrire à quelqu'un.

### Le reste

- **CSP stricte** : ni script en ligne, ni style en ligne, ni ressource externe.
  Les polices sont auto-hébergées. Une faille d'échappement ne suffirait pas à
  exécuter du code.
- **CSRF** : contrôle d'origine sur toute requête mutante, plus un jeton dérivé
  de la session par HMAC pour l'espace du salon. Cookie `HttpOnly` + `Secure` +
  `SameSite=Strict`.
- **Débit** : par adresse ET par numéro. Une adresse IP n'est pas un client —
  derrière le wifi du salon, toute une matinée la partage. Le budget par adresse
  est donc large (40/h, contre les robots) et celui par numéro serré (5/h), qui
  est la vraie limite.
- **Doublon** : un même numéro ne peut pas occuper deux places. Le lien du
  ticket existant n'est **pas** renvoyé : sinon, deviner un numéro de téléphone
  suffirait à récupérer le ticket de quelqu'un d'autre.
- **Mots de passe** : scrypt + sel + poivre applicatif hors base. Verrouillage
  du compte après plusieurs échecs. Temps de réponse identique pour un
  identifiant inconnu et un mot de passe faux.

---

## 8. WhatsApp

Un message n'est jamais envoyé depuis une route : il est **écrit dans la
transaction du geste métier**, dans la boîte d'envoi. Un `ROLLBACK` n'annonce
rien, un `COMMIT` n'oublie rien. Une tâche de fond vide la boîte.

L'unicité `(ticket, type, passage)` est portée par la base : un client rappelé
après une absence reçoit bien un nouveau « c'est votre tour », mais jamais deux
fois le même message — même si le processus meurt en plein envoi.

`passage` vaut `retards + 1`.

Le contenu porte le lien de suivi en clair : il est donc chiffré en base, jamais
journalisé, et **effacé dès que le message est parti**.

Sans API configurée, les messages sont enregistrés comme désactivés (la trace
reste) et le coiffeur dispose d'un lien `wa.me` avec le texte déjà écrit.

---

## 9. Deux rôles, pas de matrice

`COIFFEUR` tient la file. `GERANT` fait tout ce que fait le coiffeur, plus les
réglages, les comptes, les congés et l'historique.

Un salon de quartier n'a pas besoin d'une matrice de permissions, et une route
sans annotation **ferme** l'accès au lieu de l'ouvrir.

Le salon garde toujours au moins un gérant actif : on ne peut ni se retirer ses
propres droits, ni désactiver le dernier.

---

## 10. Le QR Code

Écrit à la main (`server/core/qrcode.js`), mode octet, versions 1 à 15, les
quatre niveaux de correction. Niveau **Q** par défaut : l'affiche vit collée sur
une vitrine, elle prend la poussière et les doigts, et 25 % de redondance la
laisse lisible bien plus longtemps que 15 %.

Il est vérifié de trois façons indépendantes (`test/unit/qrcode.test.js`) :

1. **cohérence des tables** — pour chaque version et chaque niveau, données +
   correction tombe exactement sur le total de la version ; les centres
   d'alignement sont recalculés par l'algorithme de la norme ;
2. **vecteur connu** — le calcul Reed-Solomon est comparé à l'exemple publié
   dans l'annexe I.2 de l'ISO/IEC 18004 ;
3. **relecture complète** — un décodeur écrit dans le test, à partir des règles
   de la norme, relit la matrice produite : format, masque, parcours en zigzag,
   désentrelacement, syndromes de correction nuls, puis contenu.

C'est ce troisième contrôle qui a trouvé, à l'écriture, un polynôme générateur
construit à l'envers — une erreur qui produisait des QR Codes d'apparence
parfaitement normale.

**Il reste une chose qu'aucun test ne remplace** : scanner l'affiche imprimée
avec un vrai téléphone avant de la coller en vitrine. L'écran QR Code le dit.

L'adresse encodée (`/join?qr=1`) est un **contrat** : l'affiche est imprimée une
fois et reste des années. Elle ne doit jamais changer.

---

## 11. Ce qui sort de la commande initiale

Trois ajouts, et leurs raisons :

| Ajout | Pourquoi |
|---|---|
| **Source `COMPTOIR`** | Le client sans téléphone en main. Sans ce geste, le coiffeur tiendrait une file parallèle sur un papier — exactement ce que l'application supprime. |
| **Annulation par le client** | Une place libérée d'elle-même fait avancer tout le monde. C'est le geste le plus utile d'un client qui ne viendra pas. |
| **Arrêt manuel + congés** | Demandés en cours de route. |

Et une chose volontairement **non** faite : l'application n'envoie aucun message
de relance, ne garde aucun profil client d'un jour sur l'autre, et ne demande
jamais d'adresse e-mail.

---

## 12. Conventions

- **Français partout** : interface, messages d'erreur, noms métier. Les
  commentaires de code sont sans accents (ASCII).
- **SQL toujours paramétré.** Les identifiants dynamiques (tri) viennent de
  listes blanches.
- **Toute écriture est dans une transaction**, avec sa trace d'historique dans
  la même transaction.
- **Réponses en camelCase**, jamais les noms de colonnes bruts.
- **Le temps** : instants en `timestamptz` (UTC) ; tout « jour », « heure »,
  « aujourd'hui » passe par `server/core/temps.js`. Jamais
  `new Date().toISOString().slice(0,10)`.
- **Les messages d'erreur disent quoi faire**, pas seulement ce qui ne va pas.
