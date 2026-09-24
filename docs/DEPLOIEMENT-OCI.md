# Déploiement sur Oracle Cloud — offre Always Free

Écrit pour être suivi de bout en bout, une fois, sans rien connaître d'OCI.

Le résultat : l'application en HTTPS sur votre nom de domaine, sur une machine
gratuite, avec les sauvegardes qui tournent toutes les nuits.

Comptez **une à deux heures**, dont une bonne partie à attendre.

---

## Ce qu'on va utiliser dans l'offre gratuite

| Ressource | Ce qu'on prend | Limite Always Free |
|---|---|---|
| Machine **Ampere A1** (ARM) | 2 cœurs, 12 Go | 4 cœurs et 24 Go, répartissables |
| Disque | 100 Go | 200 Go au total |
| Réseau sortant | quelques Go | 10 To par mois |
| Object Storage *(facultatif)* | les sauvegardes | 20 Go |

Un salon, c'est quelques dizaines de tickets par jour. **2 cœurs et 12 Go sont
déjà très au-dessus du besoin** : prenez-les parce qu'ils sont gratuits, pas
parce qu'il les faut.

> ⚠️ **Prenez bien une machine ARM (Ampere A1), pas AMD.** Les deux instances
> AMD « Micro » gratuites n'ont que 1 Go de mémoire : PostgreSQL et
> l'application y tiendraient à peine et le moindre pic ferait tomber le tout.

L'application est prête pour ARM : sa seule dépendance (`pg`) est en JavaScript
pur, sans rien à compiler, et les trois images de base — `node:24-alpine`,
`postgres:16-alpine`, `caddy:2-alpine` — existent toutes en `linux/arm64`.
L'image se construit **sur la machine**, donc l'architecture est forcément la
bonne et il n'y a aucun registre à gérer.

---

## 1. Avant de commencer

Il vous faut :

- un compte Oracle Cloud (la création demande une carte bancaire pour
  vérification ; les ressources *Always Free* ne sont pas facturées) ;
- **un nom de domaine**, celui que le QR Code de la vitrine encodera. C'est la
  seule décision irréversible de cette page : une fois l'affiche imprimée,
  l'adresse ne change plus. Voir [`DEPLOIEMENT.md`](DEPLOIEMENT.md) §1.

---

## 2. Créer la machine

Console OCI → **Compute** → **Instances** → *Create instance*.

| Champ | Valeur |
|---|---|
| Image | **Ubuntu 22.04** (ou 24.04) |
| Shape | *Change shape* → **Ampere** → `VM.Standard.A1.Flex` |
| OCPU / mémoire | **2** et **12 Go** |
| Boot volume | 100 Go, *VPU 10* |
| Clé SSH | ajoutez votre clé publique |

Notez l'**adresse IP publique** à la fin.

### « Out of capacity »

C'est le message le plus fréquent d'OCI sur les machines ARM gratuites : la
région n'a plus de A1 disponible à cet instant. Ce n'est pas une erreur de votre
part.

- réessayez à un autre moment de la journée, ou un autre jour ;
- essayez un autre **domaine de disponibilité** (AD-1, AD-2, AD-3) dans la liste
  déroulante ;
- en dernier recours, demandez 1 cœur / 6 Go : c'est plus facile à obtenir, et
  largement suffisant.

---

## 3. Ouvrir les ports — **les deux pare-feux**

C'est le piège n°1 d'OCI, celui qui fait perdre une soirée : **il y a deux
pare-feux**, et ouvrir seulement le premier ne sert à rien.

### a. Le réseau (côté Oracle)

Console → **Networking** → *Virtual Cloud Networks* → votre VCN → *Subnets* →
votre sous-réseau → *Security Lists* → *Default Security List* → **Add Ingress
Rules** :

| Source CIDR | Protocole | Port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

### b. La machine elle-même (iptables)

Les images Ubuntu d'Oracle arrivent avec des règles `iptables` qui **bloquent
tout sauf le 22**. En SSH sur la machine :

```bash
sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save        # sinon tout est perdu au redémarrage
sudo iptables -L INPUT -n --line-numbers
```

La dernière commande dit où les règles ont atterri. Les deux `ACCEPT` doivent
apparaître **avant** la ligne `REJECT ... icmp-host-prohibited`.

C'est la raison du `1` : un numéro plus grand que la longueur de la chaîne place
la règle *après* le `REJECT`, où elle ne sert à rien — et `iptables` l'accepte
sans rien dire. La chaîne d'une image Ubuntu ne compte que cinq règles au
départ.

Sur une image **Oracle Linux**, c'est `firewalld` à la place :

```bash
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

---

## 4. Le nom de domaine

Chez votre registrar, un enregistrement **A** qui pointe vers l'adresse IP
publique de la machine :

```
file.peluqueria-haron.com.   A   <IP publique>
```

Attendez que ce soit propagé avant l'étape 7 — Caddy demandera le certificat et
Let's Encrypt doit pouvoir joindre le domaine :

```bash
dig +short file.peluqueria-haron.com
```

---

## 5. Installer Docker

```bash
ssh ubuntu@<IP publique>

sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl git

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
sudo systemctl enable docker      # pour que tout reparte après un redémarrage
newgrp docker                     # ou déconnectez-vous et reconnectez-vous
```

---

## 6. Récupérer l'application et la configurer

```bash
sudo mkdir -p /opt/haron && sudo chown $USER:$USER /opt/haron
git clone https://github.com/khalilmejdo/Peluqueria_HARON.git /opt/haron
cd /opt/haron

# Les trois secrets, plus un mot de passe de départ
docker run --rm -v "$PWD":/app -w /app node:24-alpine node scripts/keygen.js
```

Puis créez le fichier `.env` :

```bash
cat > .env <<'FIN'
DOMAINE=file.peluqueria-haron.com
COURRIEL_TLS=vous@exemple.com

APP_TIMEZONE=Europe/Madrid
TELEPHONE_INDICATIF_DEFAUT=34

POSTGRES_PASSWORD=<un mot de passe long, tiré au sort>

APP_SECRET=<collez ici>
APP_ENCRYPTION_KEY=<collez ici>
APP_PASSWORD_PEPPER=<collez ici>

BOOTSTRAP_ADMIN_USERNAME=haron
BOOTSTRAP_ADMIN_PASSWORD=<collez ici>

WHATSAPP_ACTIF=false
FIN

chmod 600 .env
```

> `PUBLIC_URL` et `ALLOWED_ORIGINS` sont déduits de `DOMAINE` : il n'y a rien
> d'autre à écrire. Le fichier `.env` est ignoré par git ; il ne partira jamais
> dans le dépôt.

---

## 7. Démarrer

```bash
export SOURCE_COMMIT=$(git rev-parse --short HEAD)
docker compose -f docker-compose.oci.yml up -d --build
docker compose -f docker-compose.oci.yml logs -f
```

La première construction prend quelques minutes sur ARM. Ensuite, dans les
journaux, vous devez voir :

```
Base joignable
Schema applique : 10 tables.
Compte gerant « haron » cree.
Serveur demarre
```

Caddy demande le certificat dans la foulée. Ouvrez
`https://file.peluqueria-haron.com` : la page d'accueil du salon doit
apparaître, en HTTPS, sans avertissement.

L'espace du salon est sur `/gestion`.

### Si le certificat ne vient pas

```bash
docker compose -f docker-compose.oci.yml logs caddy
```

Dans l'ordre de fréquence :

1. le port 80 n'est pas ouvert dans **l'un des deux** pare-feux (étape 3) ;
2. le domaine ne pointe pas encore sur la machine (`dig +short`) ;
3. trop d'essais ratés d'affilée : Let's Encrypt limite les demandes. Corrigez
   la vraie cause, puis attendez une heure.

---

## 8. Après la première connexion

1. Connectez-vous sur `/gestion` avec `BOOTSTRAP_ADMIN_USERNAME` et changez le
   mot de passe (l'application l'exige).
2. **Retirez `BOOTSTRAP_ADMIN_PASSWORD` du `.env`** et relancez :
   ```bash
   docker compose -f docker-compose.oci.yml up -d
   ```
3. Réglages → nom du salon, adresse, téléphone, durée d'une coupe, fauteuils.
4. Onglet **Tarifas** → vos vrais prix. Les huit lignes créées au premier
   démarrage sont des ordres de grandeur, pas une vérité.
5. Onglet **QR Code** → vérifiez l'adresse, **scannez-la avec un téléphone**,
   puis imprimez l'affiche.

---

## 8 bis. Les photos du salon

La page d'accueil affiche une section « El salón » dès qu'il y a des photos, et
la masque quand il n'y en a pas. Elles ne sont **pas** dans l'image Docker :
`/opt/haron/photos` est monté en volume, donc en ajouter une ne demande ni
reconstruction, ni redémarrage.

Créez le dossier **avant** le premier démarrage, sinon Docker le crée lui-même
et il appartiendra à `root` :

```bash
mkdir -p /opt/haron/photos
```

Puis, depuis votre poste :

```bash
scp mesphotos/*.jpg ubuntu@<IP publique>:/opt/haron/photos/
```

La galerie se rafraîchit au plus dix secondes après. Le **nom du fichier** donne
l'ordre et la légende :

```
01-nuestro-salon.jpg   ->  « Nuestro salon », affichée en grand
02-la_vitrina.jpg      ->  « La vitrina »
03.jpg                 ->  aucune légende
```

La première photo occupe deux fois la largeur des autres : mettez-y la vue
d'ensemble. Formats acceptés : `.jpg .jpeg .png .webp .avif`, vingt-quatre au
maximum.

> Des photos de 4 000 pixels de large ne seront pas plus belles à l'écran, mais
> feront attendre un client en 4G — et c'est là qu'il regarde la page. Environ
> 1 200 × 1 200 suffisent.

---

## 9. Les sauvegardes

```bash
crontab -e
```

```cron
15 3 * * * cd /opt/haron && ./scripts/sauvegarde.sh >> /var/log/haron-sauvegarde.log 2>&1
```

Le script écrit un dump dans `/opt/haron/sauvegardes/`, vérifie qu'il n'est pas
vide, et efface ceux de plus de quatorze jours.

### Savoir que le salon est tombé

Sans alerte, une panne à trois heures du matin s'apprend par un client devant
la porte. Cinq minutes à poser.

Choisissez un **sujet difficile à deviner** sur [ntfy.sh](https://ntfy.sh) —
chez eux, qui connaît le sujet lit les messages — puis installez l'application
ntfy sur votre téléphone et abonnez-vous à ce sujet.

```bash
crontab -e
```

```cron
*/5 * * * * cd /opt/haron && ALERTE_URL=https://ntfy.sh/haron-VOTRE-MOT-SECRET REPARER=1 ./scripts/surveillance.sh >> /var/log/haron-surveillance.log 2>&1
```

Le script :

- interroge `/healthz` toutes les cinq minutes ;
- exige **deux échecs de suite** avant d'alerter — un réseau qui hoquette une
  fois n'est pas une panne, et une alerte qui crie pour rien finit par être
  ignorée, ce qui est pire que pas d'alerte ;
- alerte **une seule fois** par panne, puis une fois au retour ;
- avec `REPARER=1`, tente un `docker compose up -d` avant d'alerter — ce qui
  aurait suffi à plusieurs pannes ordinaires.

Vérifiez-le tout de suite, en le pointant sur une adresse morte :

```bash
ADRESSE_SANTE=https://peluqueria-haron.duckdns.org/inexistant ./scripts/surveillance.sh
./scripts/surveillance.sh    # deuxième échec : l'alerte part
```

### Les sortir de la machine

Une sauvegarde qui dort à côté de la base disparaît avec elle. Object Storage
offre 20 Go gratuits :

```bash
# une fois
sudo apt-get install -y python3-pip && pip3 install oci-cli
oci setup config
oci os bucket create --name sauvegardes-haron --compartment-id <votre OCID>

# puis, dans la ligne de cron, avant la commande :
SEAU_OCI=sauvegardes-haron
```

> 🔑 **La sauvegarde de la base ne suffit pas.** Les numéros WhatsApp et les
> liens de suivi y sont chiffrés avec `APP_ENCRYPTION_KEY`, qui vit dans `.env`,
> pas dans la base. **Gardez une copie de `.env` ailleurs** — sans elle, une
> restauration rend des numéros illisibles.

### Restaurer

```bash
cd /opt/haron
docker compose -f docker-compose.oci.yml exec -T base \
  pg_restore -U haron -d haron --clean --if-exists /sauvegardes/haron-2026-09-23_0315.dump
```

Essayez-la **au moins une fois**, sur une base jetable. Une sauvegarde jamais
restaurée n'est pas une sauvegarde.

---

## 10. Mettre à jour

```bash
cd /opt/haron && ./scripts/deployer.sh
```

Une seule commande, qui **vérifie et sait revenir en arrière** :

1. refuse de partir si des fichiers suivis par git sont modifiés — c'est
   exactement ce qui a fait échouer un `git pull` en silence le 24 septembre,
   et laissé le serveur deux versions en retard sans que rien ne le dise ;
2. étiquette l'image en place, puis tire, construit et démarre ;
3. attend que `/healthz` réponde — quatre-vingt-dix secondes au plus ;
4. **si le salon ne répond pas, il remet l'ancienne version, la redémarre, et
   le dit.** Un déploiement raté ne doit jamais laisser le salon à terre.

À la fin, il affiche la version réellement déployée et la commande exacte pour
revenir en arrière à la main.

Le schéma se réapplique tout seul, et il est idempotent. La file du jour, les
réglages, les fauteuils, les tarifs et les congés sont en base : **rien n'est
perdu**, même en pleine journée. Le `.env`, les photos et les sauvegardes sont
hors de git et hors de l'image — le script n'y touche pas.

> Les scripts sont enregistrés exécutables dans le dépôt : il n'y a **pas** de
> `chmod` à faire. Un `chmod +x` créerait au contraire une modification suivie
> par git, et `deployer.sh` refuserait alors de partir — à juste titre.

---

## 11. Surveiller

```bash
# état des conteneurs
docker compose -f docker-compose.oci.yml ps

# sonde de santé
curl -s https://file.peluqueria-haron.com/healthz

# journaux de l'application
docker compose -f docker-compose.oci.yml logs -f app

# place disque
df -h /
```

Dans l'application : **Chiffres → État du service** (gérant) dit si la base
accepte d'écrire, où en est la boîte WhatsApp, et combien d'écrans sont
connectés en direct.

---

## 12. À savoir sur l'offre gratuite

**Oracle peut récupérer une machine *Always Free* restée longtemps inactive.**
Un salon en service a du trafic tous les jours, le cas ne devrait donc pas se
présenter — mais vérifiez la politique en vigueur sur votre compte, et gardez
vos sauvegardes **hors de la machine** : c'est la seule vraie protection, contre
ce risque comme contre tous les autres.

Passer le compte en **Pay As You Go** ne coûte rien tant que vous restez dans
les limites *Always Free*, et lève cette contrainte. À vous de voir.

**Surveillez le quota de trafic sortant** (10 To/mois) si vous ajoutez un jour
des images lourdes. En l'état, l'application sert quelques dizaines de kilo-
octets par visite : il n'y a aucun risque d'en approcher.

---

## Ce guide en une page

```bash
# 1. machine ARM Ampere A1, Ubuntu 22.04, 2 OCPU / 12 Go
# 2. Security List : 80 et 443 en TCP depuis 0.0.0.0/0
# 3. sur la machine :
sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
# 4. enregistrement DNS A vers l'IP publique
# 5. Docker (étape 5)
# 6. git clone, keygen, .env
# 7. docker compose -f docker-compose.oci.yml up -d --build
# 8. cron pour les sauvegardes
```
