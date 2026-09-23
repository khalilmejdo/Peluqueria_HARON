#!/bin/sh
# =====================================================================
#  Sauvegarde de la base, a lancer depuis le dossier du depot.
#
#      ./scripts/sauvegarde.sh
#
#  Chaque nuit, par cron :
#      15 3 * * *  cd /opt/haron && ./scripts/sauvegarde.sh >> /var/log/haron-sauvegarde.log 2>&1
#
#  Le fichier produit est un dump PostgreSQL au format personnalise (-Fc),
#  compresse et restaurable table par table. Les sauvegardes de plus de
#  JOURS_CONSERVES jours sont effacees.
#
#  ATTENTION : une sauvegarde de la base NE SUFFIT PAS. Les numeros WhatsApp
#  et les liens de suivi y sont chiffres avec APP_ENCRYPTION_KEY, qui vit
#  dans .env et non dans la base. Gardez les deux, et pas au meme endroit.
# =====================================================================
set -eu

DOSSIER="${DOSSIER_SAUVEGARDES:-./sauvegardes}"
JOURS_CONSERVES="${JOURS_CONSERVES:-14}"
COMPOSE="${COMPOSE:-docker compose -f docker-compose.oci.yml}"

horodatage=$(date +%Y-%m-%d_%H%M)
fichier="haron-${horodatage}.dump"

mkdir -p "$DOSSIER"

# Le dump s'ecrit DANS le conteneur, sur le volume partage : passer par un
# tube depuis l'hote couperait le fichier en silence si la connexion casse,
# et on ne s'en apercevrait qu'au moment de restaurer.
$COMPOSE exec -T base pg_dump -U haron -d haron -Fc -f "/sauvegardes/${fichier}"

# La taille est le seul controle immediat : un dump de quelques centaines
# d'octets signale une base vide ou une erreur avalee.
taille=$(wc -c < "${DOSSIER}/${fichier}")
if [ "$taille" -lt 4096 ]; then
  echo "ECHEC : la sauvegarde ne fait que ${taille} octets. La base est-elle vide ?" >&2
  exit 1
fi

echo "$(date '+%Y-%m-%d %H:%M')  sauvegarde ${fichier} — $((taille / 1024)) ko"

# Rotation.
find "$DOSSIER" -name 'haron-*.dump' -type f -mtime "+${JOURS_CONSERVES}" -print -delete

# --- Copie hors de la machine ----------------------------------------
#
# Une sauvegarde qui dort a cote de la base disparait avec elle. Si l'outil
# en ligne de commande d'OCI est installe et configure, on depose le fichier
# dans Object Storage (20 Go compris dans l'offre Always Free).
#
#     oci setup config        une fois
#     export SEAU_OCI=sauvegardes-haron
if [ -n "${SEAU_OCI:-}" ] && command -v oci >/dev/null 2>&1; then
  if oci os object put --bucket-name "$SEAU_OCI" --file "${DOSSIER}/${fichier}" \
      --name "$fichier" --force >/dev/null; then
    echo "  copiee dans le seau ${SEAU_OCI}"
  else
    echo "  ATTENTION : la copie vers ${SEAU_OCI} a echoue, la sauvegarde locale reste." >&2
  fi
fi
