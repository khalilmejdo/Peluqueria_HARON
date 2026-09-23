# WhatsApp

---

## 1. L'application marche sans

C'est le point de départ. Sans aucune configuration WhatsApp :

- le client voit son numéro de ticket et son **lien de suivi à l'écran**, juste
  après avoir pris son tour ; il le garde en favori ou le partage lui-même ;
- le coiffeur dispose, sur chaque carte de la file, d'un bouton **WhatsApp** qui
  ouvre la conversation avec **le message déjà écrit**. Il appuie, il envoie.

C'est la solution du premier jour, et le filet de sécurité le jour où l'API
refuse un envoi. Zéro compte Business, zéro délai d'approbation.

---

## 2. Les trois messages

| Type | Quand | Contenu |
|---|---|---|
| `CONFIRMATION` | à la prise de tour | prénom, salon, numéro de ticket, personnes devant, **lien de suivi** |
| `APPROCHE` | quand il reste **2 personnes** devant lui (réglable) | idem |
| `TOUR` | à l'appel | prénom, salon, numéro de ticket, **lien de suivi** |

Le seuil se règle dans **Réglages → « Prévenir le client quand il reste N
personnes devant lui »**. Il vaut 2 par défaut.

Un client rappelé après une absence reçoit bien un nouveau « c'est votre tour »,
mais **jamais deux fois le même message** : l'unicité `(ticket, type, passage)`
est portée par la base, où `passage` vaut `retards + 1`.

---

## 3. Activer l'envoi automatique

L'envoi automatique d'un premier message passe obligatoirement par un **modèle
approuvé par Meta**. Il faut donc :

1. un compte **WhatsApp Business** vérifié (Meta Business Manager) ;
2. un **numéro d'envoi** enregistré, avec son identifiant (`numéro ID`) ;
3. un **jeton d'accès permanent** ;
4. les **trois modèles approuvés**.

Puis, dans l'environnement :

```bash
WHATSAPP_ACTIF=true
WHATSAPP_NUMERO_ID=123456789012345
WHATSAPP_JETON=EAAG...
WHATSAPP_LANGUE=fr
WHATSAPP_MODELE_CONFIRMATION=haron_tour_enregistre
WHATSAPP_MODELE_APPROCHE=haron_tour_approche
WHATSAPP_MODELE_TOUR=haron_c_est_votre_tour
```

Ces valeurs viennent **toujours** de l'environnement, jamais de la base : un
secret n'a rien à faire dans une table que l'on sauvegarde.

`npm run check` refuse de démarrer si `WHATSAPP_ACTIF=true` et qu'un élément
manque.

---

## 4. Les modèles à faire approuver

Catégorie **Utility** (service), langue **Français** (ou l'espagnol, selon la
clientèle — pensez alors à `WHATSAPP_LANGUE=es`).

Chaque modèle porte un **bouton d'URL dynamique** : Meta impose que la partie
fixe de l'adresse soit figée dans le modèle et que seule la partie variable
voyage. L'application n'envoie donc que le jeton.

### `haron_tour_enregistre`

**Corps**

```
Bonjour {{1}} 👋
Votre tour chez {{2}} est enregistré.

🎟️ Numéro : {{3}}
👥 Personnes devant vous : {{4}}

Nous vous préviendrons lorsque votre tour approchera.
```

**Bouton** — type *Visiter le site web*, dynamique
`https://file.peluqueria-haron.com/ticket/{{1}}`, libellé « Suivre mon tour ».

### `haron_tour_approche`

```
Bonjour {{1}} 🔔
Votre tour chez {{2}} approche.

🎟️ Numéro : {{3}}
👥 Personnes devant vous : {{4}}

Rapprochez-vous du salon.
```

Même bouton.

### `haron_c_est_votre_tour`

```
Bonjour {{1}} 🟢
C’est votre tour chez {{2}} !

🎟️ Numéro : {{3}}

Présentez-vous au fauteuil.
```

Même bouton.

**L'ordre des paramètres compte** : prénom, salon, numéro, personnes devant.
Il est fixé dans `parametresModele()` (`server/domain/notifications.js`). Si
vous changez l'ordre dans le modèle, changez-le là aussi.

---

## 5. Ce que fait l'application

Un message n'est jamais envoyé depuis une route : il est **écrit dans la
transaction du geste métier**, dans la table `envois_whatsapp`. Un `ROLLBACK`
n'annonce rien, un `COMMIT` n'oublie rien.

Une tâche de fond (`whatsapp.envois`, toutes les 30 secondes) vide la boîte.
Chaque ligne est réservée par un bail court : deux passages qui se chevauchent
ne peuvent pas envoyer deux fois le même message.

En cas d'échec :

- **temporaire** (429, 5xx, réseau) → nouvel essai, avec un délai croissant,
  jusqu'à six fois ;
- **définitif** (jeton invalide, modèle non approuvé, numéro refusé) → la ligne
  passe en `ECHEC`, visible dans **Chiffres → État du service**.

Le contenu porte le lien de suivi en clair : il est chiffré en base, jamais
journalisé, et **effacé dès que le message est parti**.

Un tour annulé ou une journée close désactivent les messages encore en attente :
prévenir quelqu'un que son tour approche le lendemain matin serait pire que de
ne rien envoyer.

---

## 6. Dépannage

| Symptôme | Cause | Quoi faire |
|---|---|---|
| Rien ne part, tout est `DESACTIVE` | `WHATSAPP_ACTIF=false` | poser les variables, redémarrer |
| `Refus de l'API WhatsApp (401)` | jeton expiré ou révoqué | regénérer un jeton permanent |
| `Refus de l'API WhatsApp (132001)` | modèle inconnu ou non approuvé | vérifier le nom **exact** et la langue |
| `(131047)` | fenêtre de 24 h fermée | normal hors modèle : seuls les modèles approuvés passent |
| `(131026)` | le numéro n'a pas WhatsApp | rien à faire ; le coiffeur appelle |
| Messages en attente qui s'accumulent | tâche arrêtée | **Chiffres → État du service**, puis relancer `whatsapp.envois` |

Pour vider la boîte sans attendre : **Chiffres → État du service** (gérant).

---

## 7. Les numéros

Le numéro saisi par le client est rangé au **format international, chiffres
seuls** (`34612345678`), qui est ce qu'attend l'API de Meta.

`TELEPHONE_INDICATIF_DEFAUT` donne le pays du salon — `34` pour l'Espagne. Un
client espagnol écrit donc simplement `612 345 678`. Un client étranger commence
par `+`.

| Saisie | Enregistré |
|---|---|
| `612345678` | `34612345678` |
| `612 34 56 78` | `34612345678` |
| `0612345678` | `34612345678` |
| `+212612345678` | `212612345678` |
| `0034612345678` | `34612345678` |
| `appelle-moi` | refusé |

Le champ n'accepte que des chiffres et les séparateurs usuels : le clavier
s'ouvre en mode numérique, le motif ferme la porte aux lettres, et ce qui
passerait malgré tout est retiré au fil de la frappe. Le serveur revalide de
toute façon — c'est lui qui fait foi.
