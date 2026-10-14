# Installer l'application pour un nouveau salon

La procédure complète, du nom du client à sa première connexion. Le même code
sert tous les salons : ce qui fait d'une installation « le salon de Samira à
Casablanca », c'est son fichier `.env` (préparé par une commande) puis l'écran
« Marque ».

Comptez **une heure** si la machine existe déjà, **deux à trois** pour une
machine neuve (dont beaucoup d'attente).

---

## 0. Ce qu'il faut avant de commencer

| À avoir | Exemple |
|---|---|
| Le nom du salon | Ongles de Samira |
| Son activité | `ONGLES`, `PELUQUERIA` (femme), `BARBERIA` (homme), `UNISEX`, `ESTETICA` (institut) |
| Son pays | `MA` (Maroc), `ES` (Espagne), `FR` (France) |
| Une adresse web | `samira.duckdns.org`, ou un vrai domaine (`rdv.ongles-samira.ma`) |
| Une machine pour lui | voir l'étape 2 |
| Votre adresse courriel | celle qui recevra les avis du certificat HTTPS |

Le pays règle tout seul la langue, la monnaie, l'heure et l'indicatif
téléphonique :

| Pays | Langue | Monnaie | Heure | Indicatif |
|---|---|---|---|---|
| `MA` | français | dirham (DH) | Africa/Casablanca | +212 |
| `ES` | espagnol | euro | Europe/Madrid | +34 |
| `FR` | français | euro | Europe/Paris | +33 |

Tout se change ensuite à l'écran (« Marque » et « Réglages ») : ces choix ne
sont qu'un point de départ.

---

## 1. Préparer le `.env` du salon (sur votre PC)

Dans le dossier du projet :

```bash
cd Desktop/Perso-pr/Peluqueria_HARON
git pull
npm run nouveau-salon -- --nom="Ongles de Samira" --activite=ONGLES --pays=MA \
  --domaine=samira.duckdns.org --courriel=vous@exemple.com --sortie=../salon-samira.env
```

Sans arguments, la commande pose les cinq questions une par une.

**Toujours `--sortie=...` hors du dossier du projet.** Sans lui, elle écrit
`.env` dans le dossier courant — et elle refuse si un `.env` y existe déjà, pour
ne jamais écraser les clés d'un salon en service.

Elle affiche à la fin :

- le résumé (nom, adresse, langue, monnaie, heure, indicatif) ;
- **l'identifiant `gerant` et son mot de passe de départ** — notez-le, c'est
  celui que vous donnerez au gérant ;
- les étapes suivantes.

> ⚠️ **Rangez une copie de ce fichier dans votre dossier de clés** (hors
> OneDrive, hors du dépôt). Il contient les clés de chiffrement du salon : sans
> `APP_ENCRYPTION_KEY`, une sauvegarde restaurée a des numéros de téléphone
> illisibles. Une copie par salon, jamais la même pour deux.

---

## 2. Choisir la machine

**Un salon = une machine.** Deux salons sur la même machine se disputeraient
les ports 80 et 443, les noms des conteneurs et le dossier `/opt/haron`.

Votre compte Oracle Cloud gratuit n'a qu'un quota (4 cœurs, 24 Go) et
HARON l'occupe en entier. Pour un nouveau salon, au choix :

- **le salon ouvre son propre compte Oracle Cloud** (gratuit, à son nom ou au
  vôtre avec une autre adresse courriel) ;
- **un petit serveur payant** (Hetzner, OVH…) : quelques euros par mois, Ubuntu,
  2 Go de mémoire suffisent ;
- **réduire la machine de HARON** pour libérer du quota Oracle — voir
  ci-dessous, à faire salon fermé.

### Réduire la machine de HARON

Un salon n'a pas besoin de 4 cœurs et 24 Go : **1 cœur et 6 Go** suffisent
largement (Node, PostgreSQL et Caddy en utilisent une petite fraction).

Mesuré le 2026-10-14 : la machine de HARON porte aussi la location de voitures
et SimuLab, et les six conteneurs ensemble utilisent **moins de 700 Mo**. Comme
le disque ne permet de toute façon que **deux** nouvelles machines (voir plus
bas), le bon réglage est **2 cœurs / 12 Go** pour HARON : il reste exactement
2 cœurs / 12 Go pour deux nouveaux salons à 1 cœur / 6 Go, et les trois
applications de HARON gardent de la marge pour leurs mises à jour.

La machine porte TROIS sites : le redémarrage les coupe tous les trois.

**La machine redémarre** : le site est coupé deux à cinq minutes. Faites-le
salon fermé. L'adresse IP est réservée, elle ne change pas ; les règles du
pare-feu et les conteneurs reviennent seuls au redémarrage.

1. Sur la machine, regarder ce qu'elle consomme vraiment (pour être sûr) :

   ```bash
   free -h
   docker stats --no-stream
   ```

2. Dans **Cloud Shell** (console Oracle, icône `>_` en haut à droite) :

   ```bash
   ID=$(oci compute instance list --compartment-id "$OCI_TENANCY" --all \
     --query "data[?\"display-name\"=='paliqueria haron' && \"lifecycle-state\"=='RUNNING'].id | [0]" --raw-output)
   echo "$ID"                       # doit afficher ocid1.instance....
   oci compute instance update --instance-id "$ID" \
     --shape-config '{"ocpus": 2, "memoryInGBs": 12}' --force
   ```

   Si le nom de la machine n'est pas le bon, `oci compute instance list
   --compartment-id "$OCI_TENANCY" --all --query "data[].\"display-name\""`
   les liste.

3. Attendre qu'elle soit revenue, puis vérifier :

   ```bash
   oci compute instance get --instance-id "$ID" --query "data.\"shape-config\".{coeurs:ocpus,memoire:\"memory-in-gbs\"}"
   curl -s -o /dev/null -w '%{http_code}\n' https://peluqueria-haron.duckdns.org/healthz   # 200
   ```

   Et sur la machine : `cd /opt/haron && docker compose -f docker-compose.oci.yml ps`
   (trois conteneurs « Up »).

**Le disque, lui, ne se réduit pas** : Oracle ne sait pas rétrécir un disque
existant. HARON garde ses 100 Go ; il reste 100 Go dans le quota gratuit, et
une nouvelle machine se contente du disque minimal (environ 50 Go) — donc
**deux nouveaux salons au plus côté disque**, même si la mémoire en permettrait
trois.

Dernier effet : `deployer.sh` reconstruit l'application sur la machine, ce qui
prend quelques minutes de plus avec un seul cœur. Le salon reste en service
pendant la construction.

Pour une machine Oracle neuve, suivez [DEPLOIEMENT-OCI.md](DEPLOIEMENT-OCI.md),
**étapes 2 à 5** (créer la machine, ouvrir les ports et régler la taille des
paquets, pointer le domaine, installer Docker). Ne sautez pas le réglage de la
taille des paquets (§ 3c) : sans lui, le site tourne sans fin en 4G/5G.

---

## 3. Pointer l'adresse vers la machine

**Avec DuckDNS (gratuit)** : connectez-vous sur duckdns.org, créez le
sous-domaine (`samira`), et mettez dans *current ip* l'adresse IP publique de la
machine.

**Avec un vrai domaine** : chez le registrar, un enregistrement **A** vers l'IP
de la machine.

Vérifiez avant d'aller plus loin (le certificat HTTPS en dépend) :

```bash
dig +short samira.duckdns.org      # doit afficher l'IP de la machine
```

---

## 4. Installer l'application sur la machine

Sur la machine du salon (en SSH) :

```bash
sudo mkdir -p /opt/haron && sudo chown $USER:$USER /opt/haron
git clone https://github.com/khalilmejdo/Peluqueria_HARON.git /opt/haron
cd /opt/haron
```

Copiez-y le fichier préparé à l'étape 1, **sous le nom `.env`**. Depuis votre
PC :

```bash
scp -i "<clé SSH de la machine>" ../salon-samira.env ubuntu@<IP>:/opt/haron/.env
```

Puis, sur la machine :

```bash
chmod 600 /opt/haron/.env
cd /opt/haron && ./scripts/deployer.sh
```

La première fois, `deployer.sh` construit l'application (quelques minutes),
la démarre, attend que Caddy obtienne le certificat HTTPS et vérifie que le
site répond. Il finit sur la version en service.

**Si le certificat ne vient pas** : `docker compose -f docker-compose.oci.yml logs caddy`.
Presque toujours le port 80 fermé dans un des deux pare-feux, ou l'adresse qui
ne pointe pas encore sur la machine (étape 3).

---

## 5. Créer votre compte d'éditeur

Le gérant administre son salon ; **vous**, en super-administrateur, gardez la
main sur la marque (nom, logo, couleurs, activité, pays). Sur la machine :

```bash
cd /opt/haron
docker compose -f docker-compose.oci.yml exec app node scripts/coiffeur.js \
  --identifiant=khalil --nom="Khalil" --role=SUPERADMIN
```

Un mot de passe provisoire s'affiche **une seule fois** ; vous le changerez à
la première connexion.

---

## 6. Personnaliser (dans le navigateur)

Sur `https://samira.duckdns.org/gestion`, connecté avec **votre** compte :

1. **Marque** : le logo, la palette de couleurs, la typographie, la page
   d'accueil (« Fiche », « En images » ou « Classique »). L'aperçu montre le
   résultat avant d'enregistrer.
2. **Marque › Pays** : vérifiez le fuseau et l'indicatif.

Puis, avec le gérant (ou à sa place) :

3. **Carte** : la carte de départ de l'activité est déjà là — ajuster les
   prix, les durées, retirer ce que le salon ne fait pas.
4. **Réglages** : adresse, téléphone, WhatsApp, horaires d'ouverture (sans
   horaires, pas de rendez-vous), rendez-vous et/ou file, programme de
   fidélité (éteint par défaut), avis.
5. **Galerie** : les photos du salon — c'est ce qui vend la page d'accueil.
6. **Comptes** : un compte par coiffeur ou styliste.

---

## 7. Remettre les clés au gérant

1. Donnez-lui l'adresse `https://samira.duckdns.org/gestion`, l'identifiant
   `gerant` et le mot de passe de départ (étape 1). L'application l'oblige à le
   changer à la première connexion.
2. **Une fois qu'il s'est connecté**, retirez le mot de passe de départ du
   serveur :

   ```bash
   cd /opt/haron
   sed -i 's/^BOOTSTRAP_ADMIN_PASSWORD=.*/BOOTSTRAP_ADMIN_PASSWORD=/' .env
   docker compose -f docker-compose.oci.yml up -d
   ```

3. Imprimez l'affiche avec le QR code (onglet **Code QR**) **seulement avec
   l'adresse définitive** : un QR imprimé ne se corrige pas.

---

## 8. Avant de partir

- [ ] La page d'accueil s'ouvre en HTTPS, au bon nom, dans la bonne langue.
- [ ] Un faux rendez-vous pris depuis un téléphone (en 4G, pas en wifi) arrive
      dans l'agenda — puis annulez-le.
- [ ] Le gérant s'est connecté et a changé son mot de passe.
- [ ] `BOOTSTRAP_ADMIN_PASSWORD` est vide sur le serveur.
- [ ] Une copie du `.env` est dans votre dossier de clés.
- [ ] Les sauvegardes tournent : [DEPLOIEMENT-OCI.md](DEPLOIEMENT-OCI.md) § 9.

---

## Mettre à jour un salon plus tard

Chaque salon se met à jour seul, quand vous le décidez :

```bash
cd /opt/haron && ./scripts/deployer.sh
```

Les réglages, la carte, les photos, les avis et les cartes de fidélité sont en
base : une mise à jour ne les touche pas.

---

## Variante : sur la même machine qu'un salon existant

Quand Oracle répond « Out of capacity », ou simplement pour ne pas gérer une
machine de plus : un salon tient très bien à côté de HARON (moins de 100 Mo de
mémoire). Il a son dossier, sa base et ses photos à lui ; seul le point
d'entrée HTTPS (le Caddy de HARON) est partagé, comme pour la location et
SimuLab.

Exemple pour un salon dans `/opt/ongles`, servi sur `ongles.duckdns.org`. Sur
DuckDNS, le sous-domaine pointe vers **l'IP de la machine de HARON**.

1. **Le code**, recopié depuis HARON (même dépôt, mêmes droits de mise à jour) :

   ```bash
   sudo mkdir -p /opt/ongles && sudo chown $USER:$USER /opt/ongles
   git clone /opt/haron /opt/ongles
   git -C /opt/ongles remote set-url origin "$(git -C /opt/haron remote get-url origin)"
   ```

2. **Le `.env`** du salon (préparé à l'étape 1), copié depuis le PC en
   `/opt/ongles/.env`, puis `chmod 600 /opt/ongles/.env`.

3. **Ce qui n'appartient qu'à ce salon** — `/opt/ongles/docker-compose.local.yml`
   (ignoré par git) : pas de Caddy à lui, une image à son nom, et un alias
   unique sur le réseau partagé `proxy`.

   ```yaml
   services:
     caddy:
       profiles: ["salon-heberge"]   # jamais demarre : le Caddy de HARON sert ce salon
     app:
       image: ongles-app:latest
       networks:
         proxy:
           aliases:
             - ongles-app
   networks:
     proxy:
       external: true
   ```

   **L'alias doit être unique sur la machine** (`ongles-app`, pas `app` ni
   `haron-app`), sinon Caddy sert un salon à la place de l'autre.

4. **Son site dans le Caddy de HARON** — `/opt/haron/caddy.d/ongles.caddy` :

   ```caddyfile
   ongles.duckdns.org {
   	encode zstd gzip
   	reverse_proxy ongles-app:3000 {
   		transport http {
   			keepalive 30s
   		}
   	}
   	header {
   		Strict-Transport-Security "max-age=31536000; includeSubDomains"
   		-Server
   	}
   }
   ```

   puis `cd /opt/haron && docker compose -f docker-compose.oci.yml -f docker-compose.local.yml exec caddy caddy reload --config /etc/caddy/Caddyfile`.
   HARON n'est pas coupé : Caddy recharge sans fermer une connexion.

5. **Démarrer le salon** : `cd /opt/ongles && ./scripts/deployer.sh`. Il
   construit l'image `ongles-app`, sans toucher à celle de HARON, et dit
   « pas de Caddy dans ce dossier (salon hébergé) » : c'est normal.

6. **Les commandes du salon** se lancent depuis SON dossier, avec ses deux
   fichiers :

   ```bash
   cd /opt/ongles
   docker compose -f docker-compose.oci.yml -f docker-compose.local.yml exec app node scripts/coiffeur.js --identifiant=khalil --nom="Khalil" --role=SUPERADMIN
   ```

Puis les étapes 6 à 8 comme pour une machine à part. Ses mises à jour :
`cd /opt/ongles && ./scripts/deployer.sh`, indépendamment de HARON.
