#!/bin/sh
# =====================================================================
#  Surveillance du salon.
#
#      ./scripts/surveillance.sh
#
#  Toutes les cinq minutes, par cron :
#      */5 * * * * cd /opt/haron && ./scripts/surveillance.sh >> /var/log/haron-surveillance.log 2>&1
#
#  Le trou que ce script bouche : sans lui, si l'application tombe a trois
#  heures du matin, personne ne le sait avant l'ouverture — et le gerant
#  l'apprend par un client devant la porte.
#
#  CE QU'IL FAIT
#    1. interroge /healthz ;
#    2. exige DEUX echecs de suite avant d'alerter — un reseau qui hoquette
#       une fois n'est pas une panne, et une alerte qui crie pour rien finit
#       par etre ignoree, ce qui est pire que pas d'alerte du tout ;
#    3. alerte UNE SEULE FOIS par panne, puis une fois au retour. Vingt
#       messages identiques ne disent rien de plus que le premier ;
#    4. si REPARER=1, tente un « docker compose up -d » avant d'alerter.
#
#  OU PART L'ALERTE
#    ALERTE_URL recoit le texte en POST. N'importe quel service de webhook
#    convient. Le plus simple, sans compte ni cle :
#
#        export ALERTE_URL=https://ntfy.sh/haron-un-mot-difficile-a-deviner
#
#    Puis installez l'application ntfy sur le telephone et abonnez-vous a ce
#    sujet. Choisissez un nom qu'on ne devine pas : chez ntfy, qui connait le
#    sujet lit les messages.
#
#  PAR COURRIEL
#    ALERTE_COURRIEL fait suivre l'alerte a une boite aux lettres. ntfy s'en
#    charge, sans compte ni serveur de courrier a installer sur la machine :
#
#        export ALERTE_COURRIEL=vous@exemple.com
#
#    Un courrier arrive plus tard qu'une notification et peut tomber dans les
#    indesirables : gardez les deux si l'alerte compte vraiment.
#
#  SANS ALERTE_URL, le script se contente d'ecrire dans son journal. Il sert
#  alors d'historique, pas d'alarme.
#
#  IL SE TAIT QUAND TOUT VA BIEN. Une ligne toutes les cinq minutes ferait 288
#  lignes par jour, toutes identiques : le journal grossirait sans fin et les
#  vraies pannes s'y noieraient. Seuls les CHANGEMENTS sont ecrits. Pour une
#  mise au point, « VERBEUX=1 » rend la trace complete.
# =====================================================================
set -eu

ADRESSE="${ADRESSE_SANTE:-}"
ALERTE_URL="${ALERTE_URL:-}"
REPARER="${REPARER:-0}"
COMPOSE="${COMPOSE:-docker compose -f docker-compose.oci.yml}"
ETAT="${ETAT_SURVEILLANCE:-./sauvegardes/.surveillance}"
DELAI="${DELAI_SECONDES:-10}"

# L'adresse se deduit du .env : une seule verite, celle qui sert deja a Caddy.
if [ -z "$ADRESSE" ] && [ -f .env ]; then
  domaine=$(sed -n 's/^DOMAINE=//p' .env | head -n 1 | tr -d '\r')
  [ -n "$domaine" ] && ADRESSE="https://${domaine}/healthz"
fi
if [ -z "$ADRESSE" ]; then
  echo "$(date '+%F %T')  ECHEC : ni ADRESSE_SANTE ni DOMAINE dans .env." >&2
  exit 2
fi

horodatage() { date '+%F %T'; }

# Une alerte qui echoue ne doit jamais arreter la surveillance : on la signale
# et on continue, sinon une panne du service d'alerte masquerait la panne du
# salon — exactement le contraire du but.
alerter() {
  echo "$(horodatage)  ALERTE : $1"
  [ -z "$ALERTE_URL" ] && return 0

  # « X-Email » demande a ntfy de faire suivre par courrier. Sur un autre
  # service de webhook l'en-tete est simplement ignore : rien ne casse.
  if [ -n "${ALERTE_COURRIEL:-}" ]; then
    entete_courriel="-H X-Email:${ALERTE_COURRIEL}"
  else
    entete_courriel=""
  fi

  # shellcheck disable=SC2086
  if ! curl -fsS --max-time 20 \
       -H "Title: Peluqueria HARON" \
       -H "Priority: high" \
       -H "Tags: warning" \
       $entete_courriel \
       -d "$1" "$ALERTE_URL" >/dev/null 2>&1; then
    echo "$(horodatage)  ATTENTION : l'alerte n'a pas pu etre envoyee." >&2
  fi
}

mkdir -p "$(dirname "$ETAT")"
[ -f "$ETAT" ] || echo "0 ok" > "$ETAT"
read -r echecs signale < "$ETAT" || { echecs=0; signale=ok; }

# --- la mesure -------------------------------------------------------
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$DELAI" "$ADRESSE" 2>/dev/null || echo 000)

if [ "$code" = "200" ]; then
  if [ "$signale" = "alerte" ]; then
    alerter "Peluqueria HARON est de nouveau en ligne. Interruption d'environ $((echecs * 5)) minutes."
    echo "$(horodatage)  de nouveau en ligne"
  elif [ "$echecs" -gt 0 ]; then
    echo "$(horodatage)  de nouveau en ligne (un echec isole, sans alerte)"
  fi
  # SILENCE quand tout va bien.
  #
  # Une ligne toutes les cinq minutes fait 288 lignes par jour, toutes
  # identiques : le journal grossit sans fin ET les vraies pannes s'y noient.
  # On n'ecrit donc que les CHANGEMENTS. « VERBEUX=1 » rend la trace complete,
  # le temps d'une mise au point.
  [ "${VERBEUX:-0}" = "1" ] && echo "$(horodatage)  en ligne (HTTP $code)"
  echo "0 ok" > "$ETAT"
  exit 0
fi

echecs=$((echecs + 1))
echo "$(horodatage)  INJOIGNABLE (HTTP $code) — echec $echecs"

# Un seul echec : on note et on attend le passage suivant. Le reseau hoquette.
if [ "$echecs" -lt 2 ]; then
  echo "$echecs $signale" > "$ETAT"
  exit 0
fi

# Deux echecs de suite : c'est une panne.
if [ "$REPARER" = "1" ] && [ "$signale" != "alerte" ]; then
  echo "$(horodatage)  tentative de relance..."
  $COMPOSE up -d >/dev/null 2>&1 || true
  sleep 20
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$DELAI" "$ADRESSE" 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then
    alerter "Peluqueria HARON etait tombe ; une relance automatique l'a remis en ligne. A regarder : docker compose logs app"
    echo "0 ok" > "$ETAT"
    exit 0
  fi
fi

if [ "$signale" != "alerte" ]; then
  alerter "Peluqueria HARON NE REPOND PLUS (HTTP $code) depuis $((echecs * 5)) minutes. Sur le serveur : cd /opt/haron && docker compose -f docker-compose.oci.yml logs --tail=50 app"
  signale=alerte
fi
echo "$echecs $signale" > "$ETAT"
exit 1
