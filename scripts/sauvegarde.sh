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

# La taille ecarte le cas le plus grossier : un dump de quelques centaines
# d'octets signale une base vide ou une erreur avalee.
taille=$(wc -c < "${DOSSIER}/${fichier}")
if [ "$taille" -lt 4096 ]; then
  echo "ECHEC : la sauvegarde ne fait que ${taille} octets. La base est-elle vide ?" >&2
  exit 1
fi

# Mais un fichier de bonne taille peut etre illisible : archive tronquee,
# ecriture interrompue, disque plein juste avant la fin. « pg_restore --list »
# ouvre l'archive et en lit le sommaire SANS rien restaurer. C'est le seul
# controle qui distingue une sauvegarde d'un tas d'octets de la bonne taille.
#
# On compte les objets : une archive valide mais vide passerait autrement.
objets=$($COMPOSE exec -T base pg_restore --list "/sauvegardes/${fichier}" 2>/dev/null \
  | grep -c '^[0-9]' || true)
if [ "${objets:-0}" -lt 10 ]; then
  echo "ECHEC : l'archive ${fichier} n'est pas relisible (${objets:-0} objet(s) au sommaire)." >&2
  echo "        Le fichier est garde pour examen, mais NE COMPTEZ PAS DESSUS." >&2
  exit 1
fi

echo "$(date '+%Y-%m-%d %H:%M')  sauvegarde ${fichier} — $((taille / 1024)) ko, ${objets} objets relus"

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
