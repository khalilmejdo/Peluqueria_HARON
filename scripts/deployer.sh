#!/bin/sh
# =====================================================================
#  Deployer, en une commande.
#
#      cd /opt/haron && ./scripts/deployer.sh
#
#  Remplace la suite « git pull, export, docker compose up --build, et on
#  regarde les journaux en croisant les doigts ». Il fait la meme chose, mais
#  il VERIFIE, et il SAIT REVENIR EN ARRIERE.
#
#  CE QU'IL FAIT
#    1. refuse de partir si le dossier a des modifications non validees —
#       c'est ce qui a bloque un « git pull » silencieusement le 24 septembre ;
#    2. note la version en place et etiquette l'image actuelle ;
#    3. tire, construit, demarre ;
#    4. attend que /healthz reponde. Quatre-vingt-dix secondes au plus ;
#    5. si le salon ne repond pas : REMET L'ANCIENNE VERSION, redemarre, et le
#       dit. Un deploiement rate ne doit jamais laisser le salon a terre.
#
#  Il ne touche ni au .env, ni aux photos, ni aux sauvegardes : ils sont hors
#  de git et hors de l'image.
# =====================================================================
set -eu

COMPOSE="${COMPOSE:-docker compose -f docker-compose.oci.yml}"
IMAGE="${IMAGE:-haron-app}"
ATTENTE="${ATTENTE_SECONDES:-90}"

dire() { echo "  $*"; }
echec() { echo "" >&2; echo "  ECHEC : $*" >&2; exit 1; }

# --- 1. le dossier doit etre propre ----------------------------------
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo ""
  echo "  Des fichiers suivis par git sont modifies :"
  git status --short --untracked-files=no | sed 's/^/    /'
  echo ""
  echo "  Un « git pull » les ecraserait, ou serait refuse. Deux choix :"
  echo "    git checkout -- <fichier>    jeter la modification"
  echo "    git stash                    la mettre de cote"
  echo ""
  echec "dossier non propre."
fi

# --- 2. de quoi revenir ----------------------------------------------
avant=$(git rev-parse --short HEAD)
dire "version en place : ${avant}"

# L'image actuelle est etiquetee : c'est elle qu'on remettra si ca tourne mal.
# Sans cela, « revenir en arriere » demanderait de reconstruire, c'est-a-dire
# plusieurs minutes de salon a terre.
if docker image inspect "${IMAGE}:latest" >/dev/null 2>&1; then
  docker tag "${IMAGE}:latest" "${IMAGE}:precedente"
  dire "image actuelle etiquetee « precedente »"
else
  dire "aucune image actuelle : premier deploiement, pas de retour possible."
fi

# --- 3. tirer et construire -------------------------------------------
dire "recuperation..."
git pull --ff-only || echec "le « git pull » a echoue (voir ci-dessus)."

apres=$(git rev-parse --short HEAD)
if [ "$avant" = "$apres" ]; then
  dire "deja a jour sur ${apres}. Rien a faire."
  exit 0
fi
dire "nouvelle version : ${apres}"

dire "construction et demarrage..."
SOURCE_COMMIT="$apres" $COMPOSE up -d --build || echec "la construction a echoue. Le salon tourne toujours sur ${avant}."

# --- 4. attendre que le salon reponde ---------------------------------
adresse="http://127.0.0.1:3000/healthz"
domaine=$(sed -n 's/^DOMAINE=//p' .env 2>/dev/null | head -n 1 | tr -d '\r' || true)
[ -n "${domaine:-}" ] && adresse="https://${domaine}/healthz"

dire "attente de la reponse du salon (${ATTENTE} s au plus)..."
reste="$ATTENTE"
while [ "$reste" -gt 0 ]; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$adresse" 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then
    version=$(curl -s --max-time 5 "${adresse%/healthz}/api/version" 2>/dev/null || echo '')
    echo ""
    dire "EN LIGNE. ${version}"
    echo ""
    dire "Si quelque chose cloche, revenir en arriere :"
    dire "  git reset --hard ${avant} && SOURCE_COMMIT=${avant} ${COMPOSE} up -d --build"
    exit 0
  fi
  sleep 3
  reste=$((reste - 3))
done

# --- 5. retour en arriere ---------------------------------------------
echo ""
echo "  Le salon ne repond pas apres ${ATTENTE} s. RETOUR A ${avant}." >&2
echo "" >&2

git reset --hard "$avant" >/dev/null
if docker image inspect "${IMAGE}:precedente" >/dev/null 2>&1; then
  docker tag "${IMAGE}:precedente" "${IMAGE}:latest"
  SOURCE_COMMIT="$avant" $COMPOSE up -d >/dev/null 2>&1 || true
else
  SOURCE_COMMIT="$avant" $COMPOSE up -d --build >/dev/null 2>&1 || true
fi

sleep 8
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$adresse" 2>/dev/null || echo 000)
if [ "$code" = "200" ]; then
  echo "  Le salon est de nouveau en ligne sur ${avant}." >&2
else
  echo "  LE SALON EST TOUJOURS A TERRE. Regardez :" >&2
  echo "    ${COMPOSE} logs --tail=60 app" >&2
fi

echo "" >&2
echo "  Pour comprendre ce qui a echoue dans ${apres} :" >&2
echo "    ${COMPOSE} logs --tail=80 app" >&2
exit 1
