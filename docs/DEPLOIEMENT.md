# Déploiement

Écrit pour la personne qui met le salon en ligne et qui s'en occupe ensuite.

---

## 1. Avant de commencer

Une décision à prendre une fois pour toutes : **l'adresse publique du salon**.

C'est elle qu'encode le QR Code collé en vitrine. L'affiche est imprimée une
fois et reste des années : si l'adresse change, il faut réimprimer et
recoller. Choisissez un nom de domaine que vous garderez, par exemple
`file.peluqueria-haron.com`.

---

## 2. Les secrets

```bash
npm run keygen
```

Trois secrets de 64 caractères hexadécimaux, tous différents :

| Variable | Protège |
|---|---|
| `APP_SECRET` | signature des sessions et des jetons CSRF |
| `APP_ENCRYPTION_KEY` | chiffrement des numéros WhatsApp et des liens de suivi |
| `APP_PASSWORD_PEPPER` | poivre des mots de passe |

Ils se posent dans l'interface de l'hébergeur (Coolify, Render) ou dans un
fichier `.env` **jamais commité**.

> **Changer `APP_ENCRYPTION_KEY` rend illisibles les numéros déjà enregistrés.**
> Pour en changer sans rien perdre, posez l'ancienne dans
> `APP_ENCRYPTION_KEY_PREVIOUS` le temps de la bascule : l'application lit avec
> les deux clés et écrit avec la nouvelle.

---

## 3. Docker Compose

```bash
cp .env.example .env     # puis renseigner les secrets et PUBLIC_URL
docker compose up -d --build
docker compose logs -f app
```

Le conteneur, à chaque démarrage :

1. attend que la base réponde (90 s au maximum) ;
2. applique `server/db/schema.sql` — idempotent, sous verrou consultatif ;
3. pose les réglages par défaut **manquants** et crée le premier compte si la
   table est vide.

Le seed ne touche **jamais** un réglage déjà enregistré : un redéploiement ne
remettra pas 20 minutes par coupe alors que le gérant en a mis 35.

Variables indispensables : `DATABASE_URL`, les trois secrets, `PUBLIC_URL`,
`ALLOWED_ORIGINS`, `APP_TIMEZONE`.

### Derrière un proxy

```
TRUST_PROXY=true
TRUST_PROXY_HOPS=1      # le nombre EXACT de proxys devant l'application
SECURE_COOKIES=true
ENABLE_HSTS=true
```

`TRUST_PROXY_HOPS` compte depuis la fin de `X-Forwarded-For` : le premier
élément de cette chaîne est écrit par le client et ne vaut rien. Une valeur trop
grande laisse un client choisir l'adresse que voit la limitation de débit.

### Les flux temps réel derrière nginx

```nginx
location / {
  proxy_pass http://app:3000;
  proxy_http_version 1.1;
  proxy_set_header Connection '';
  proxy_buffering off;          # sinon les messages arrivent par paquets
  proxy_read_timeout 3600s;     # un suivi reste ouvert une heure
}
```

L'application pose déjà `X-Accel-Buffering: no` sur ses flux ; `proxy_buffering
off` couvre les autres relais.

---

## 4. Vérifier avant de mettre en ligne

```bash
npm run check      # dit ce qui manque, ce qui est mal formé, ce qui mérite un regard
npm run verify     # tous les tests
curl https://.../healthz
```

`npm run check` sort en 1 si quelque chose empêche de démarrer.

---

## 5. Le premier compte

Créé au premier démarrage depuis `BOOTSTRAP_ADMIN_USERNAME` et
`BOOTSTRAP_ADMIN_PASSWORD`, avec le rôle `GERANT` et l'obligation de changer son
mot de passe.

**Retirez `BOOTSTRAP_ADMIN_PASSWORD` de l'environnement une fois la première
connexion faite.**

Porte de secours, depuis le serveur uniquement :

```bash
docker compose exec app node scripts/coiffeur.js \
  --identifiant=youssef --nom="Youssef Haron" --role=GERANT
```

Sans `--mot-de-passe`, un mot de passe provisoire est tiré au sort et affiché
une seule fois. Sur un compte existant, la commande le répare : mot de passe
neuf, compte réactivé, sessions fermées.

---

## 6. Le QR Code

Une fois en ligne, dans l'espace du salon, onglet **QR Code** :

1. vérifiez que l'adresse affichée est bien l'adresse définitive ;
2. **scannez-la vous-même avec un téléphone** — c'est la seule vérification qui
   compte vraiment ;
3. téléchargez le SVG pour un imprimeur, le PNG pour une impression de bureau ;
4. ou ouvrez `/affiche` et imprimez directement (A4, sans marges).

---

## 7. Sauvegarde

Tout ce qui compte est dans PostgreSQL. L'application n'écrit rien sur disque.

```bash
# sauvegarde
docker compose exec -T base pg_dump -U haron -Fc haron > haron-$(date +%F).dump

# restauration sur une base neuve
docker compose exec -T base pg_restore -U haron -d haron --clean --if-exists < haron-2026-09-23.dump
```

Gardez les sauvegardes **hors du serveur**. Une sauvegarde qui n'a jamais été
restaurée n'est pas une sauvegarde : essayez la restauration au moins une fois,
sur une base jetable.

> La restauration ne suffit pas seule : sans `APP_ENCRYPTION_KEY`, les numéros
> WhatsApp de la sauvegarde sont illisibles. Gardez les trois secrets avec les
> sauvegardes, dans un endroit différent.

---

## 8. Mise à jour

```bash
git pull
docker compose up -d --build
```

Le schéma se réapplique tout seul. Aucune interruption de la file : les tickets
du jour, les réglages et les congés sont en base.

`SOURCE_COMMIT` (posé au build par Coolify) sert d'empreinte de version : les
adresses des fichiers statiques portent alors `?v=<commit>`, le navigateur les
garde un an, et une mise en ligne change toutes les adresses d'un coup.

---

## 9. Surveiller

- `GET /healthz` — sonde de l'hébergeur, sur une connexion dédiée. Elle reste
  verte même si toutes les connexions applicatives sont occupées.
- Espace du salon → **Chiffres** (gérant) → *État du service* : base en
  écriture ou non, boîte WhatsApp, écrans connectés en direct, version déployée.
- Les journaux sont en JSON, une ligne par événement, avec les clés sensibles
  expurgées.

Ce qui mérite une alerte :

| Signe | Cause probable |
|---|---|
| `/healthz` en 503 | base injoignable |
| « la base est en lecture seule » | bascule, disque plein |
| boîte WhatsApp en échec qui monte | jeton expiré, modèle non approuvé |
| journée non close au matin | l'application ne tourne plus |
