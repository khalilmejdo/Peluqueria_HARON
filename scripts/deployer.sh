#!/bin/sh
# =====================================================================
#  Deployer, en une commande.
#
#      cd /opt/haron && ./scripts/deployer.sh
#      cd /opt/haron && ./scripts/deployer.sh --forcer
#
#  Remplace la suite « git pull, export, docker compose up --build, et on
#  regarde les journaux en croisant les doigts ». Il fait la meme chose, mais
#  il VERIFIE, et il SAIT REVENIR EN ARRIERE.
#
#  CE QU'IL FAIT
#    1. refuse de partir si le dossier a des modifications non validees —
#       c'est ce qui a bloque un « git pull » silencieusement le 24 septembre ;
#    2. demande au salon QUELLE VERSION IL SERT, et etiquette l'image actuelle ;
#    3. tire, construit, demarre ;
#    4. attend que /healthz reponde. Quatre-vingt-dix secondes au plus ;
#    5. si le salon ne repond pas : REMET L'ANCIENNE VERSION, redemarre, et le
#       dit. Un deploiement rate ne doit jamais laisser le salon a terre.
#
#  IL COMPARE CE QUI TOURNE, PAS CE QUI EST SUR LE DISQUE.
#
#  La premiere version comparait le HEAD de git avant et apres son propre
#  « git pull ». Quelqu'un qui avait deja tire a la main tombait donc sur
#  « deja a jour, rien a faire » alors que le conteneur servait TOUJOURS
#  l'ancienne image — c'est arrive le 24 septembre, et ca s'est vu au « npm
#  error Missing script », pas au message du script. Le disque ne dit rien de
#  ce qui est en service ; seul le salon le sait, et il le dit sur
#  /api/version. C'est desormais lui qu'on interroge.
#
#  Si le salon ne repond pas du tout, on reconstruit sans poser de question :
#  entre reconstruire pour rien et laisser un salon a terre, le choix est fait.
#
#  Il ne touche ni au .env, ni aux photos, ni aux sauvegardes : ils sont hors
#  de git et hors de l'image.
# =====================================================================
set -eu

# Le fichier de composition, plus celui qui n'appartient qu'a cette machine.
#
# `docker-compose.local.yml` est ignore par git. Il sert a ce qui ne peut pas
# vivre dans le depot : un reseau partage avec une autre application, un volume
# propre au serveur, un service de plus. Sans ce mecanisme, la seule facon
# d'ajouter ces lignes etait de modifier le fichier suivi — et le dossier
# devenait « sale », ce qui bloquait tous les deploiements suivants.
COMPOSE="${COMPOSE:-docker compose -f docker-compose.oci.yml}"
[ -f docker-compose.local.yml ] && COMPOSE="$COMPOSE -f docker-compose.local.yml"
IMAGE="${IMAGE:-haron-app}"
ATTENTE="${ATTENTE_SECONDES:-90}"

FORCER=0
[ "${1:-}" = "--forcer" ] && FORCER=1

dire() { echo "  $*"; }
echec() { echo "" >&2; echo "  ECHEC : $*" >&2; exit 1; }

# --- 0. ou joindre le salon -------------------------------------------
base="http://127.0.0.1:3000"
domaine=$(sed -n 's/^DOMAINE=//p' .env 2>/dev/null | head -n 1 | tr -d '\r' || true)
[ -n "${domaine:-}" ] && base="https://${domaine}"
adresse="${base}/healthz"

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

# --- 2. ce qui TOURNE, et de quoi revenir -----------------------------
deployee=$(curl -s --max-time 5 "${base}/api/version" 2>/dev/null \
  | sed -n 's/.*"version" *: *"\([^"]*\)".*/\1/p' | head -n 1 || true)

if [ -n "${deployee:-}" ]; then
  dire "version en service : ${deployee}"
else
  dire "le salon ne repond pas : on reconstruit sans poser de question."
fi

avant=$(git rev-parse --short HEAD)

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
dire "version sur le disque : ${apres}"

if [ "$FORCER" -eq 0 ] && [ -n "${deployee:-}" ] && [ "$deployee" = "$apres" ]; then
  dire "le salon sert deja ${apres}. Rien a faire."
  dire "(pour reconstruire quand meme : ./scripts/deployer.sh --forcer)"
  exit 0
fi

# Ce qu'on remettra si ca tourne mal : la version qui SERT le salon
# aujourd'hui. Pas le HEAD d'avant le pull — quelqu'un qui a deja tire a la
# main nous ferait « revenir » sur du code qui n'a jamais tourne.
retour="${deployee:-$avant}"

dire "construction et demarrage..."
SOURCE_COMMIT="$apres" $COMPOSE up -d --build || echec "la construction a echoue. Le salon tourne toujours sur ${retour}."

# --- 4. attendre que le salon reponde ---------------------------------
dire "attente de la reponse du salon (${ATTENTE} s au plus)..."
reste="$ATTENTE"
while [ "$reste" -gt 0 ]; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$adresse" 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then
    servie=$(curl -s --max-time 5 "${base}/api/version" 2>/dev/null \
      | sed -n 's/.*"version" *: *"\([^"]*\)".*/\1/p' | head -n 1 || true)
    echo ""
    dire "EN LIGNE. Le salon sert ${servie:-?} (attendu ${apres})."
    if [ -n "${servie:-}" ] && [ "$servie" != "$apres" ]; then
      echo ""
      echo "  ATTENTION : la version servie n'est pas celle qui vient d'etre" >&2
      echo "  construite. L'image n'a probablement pas ete reconstruite :" >&2
      echo "    ${COMPOSE} up -d --build --force-recreate app" >&2
      exit 1
    fi
    echo ""
    dire "Si quelque chose cloche, revenir en arriere :"
    dire "  git reset --hard ${retour} && SOURCE_COMMIT=${retour} ${COMPOSE} up -d --build"
    exit 0
  fi
  sleep 3
  reste=$((reste - 3))
done

# --- 5. retour en arriere ---------------------------------------------
echo ""
echo "  Le salon ne repond pas apres ${ATTENTE} s. RETOUR A ${retour}." >&2
echo "" >&2

git reset --hard "$retour" >/dev/null
if docker image inspect "${IMAGE}:precedente" >/dev/null 2>&1; then
  docker tag "${IMAGE}:precedente" "${IMAGE}:latest"
  SOURCE_COMMIT="$retour" $COMPOSE up -d >/dev/null 2>&1 || true
else
  SOURCE_COMMIT="$retour" $COMPOSE up -d --build >/dev/null 2>&1 || true
fi

sleep 8
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$adresse" 2>/dev/null || echo 000)
if [ "$code" = "200" ]; then
  echo "  Le salon est de nouveau en ligne sur ${retour}." >&2
else
  echo "  LE SALON EST TOUJOURS A TERRE. Regardez :" >&2
  echo "    ${COMPOSE} logs --tail=60 app" >&2
fi

echo "" >&2
echo "  Pour comprendre ce qui a echoue dans ${apres} :" >&2
echo "    ${COMPOSE} logs --tail=80 app" >&2
exit 1
