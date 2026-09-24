#!/bin/sh
# =====================================================================
#  Surveillance du salon.
#
#      ./scripts/surveillance.sh
#
#  Toutes les cinq minutes, par cron :
#      */5 * * * * cd /opt/haron && ./scripts/surveillance.sh >> /opt/haron/surveillance.log 2>&1
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
#  PAR SENTRY (le plus sur pour le courriel)
#    SENTRY_CRON_URL est l'adresse de « check-in » d'un Cron Monitor Sentry.
#    Le script la ping a chaque passage : « ok » quand le salon repond,
#    « error » sinon.
#
#        export SENTRY_CRON_URL=https://oNNN.ingest.de.sentry.io/api/NNN/cron/haron/CLE/
#
#    Deux avantages sur tout le reste :
#
#      - Sentry envoie le courriel LUI-MEME, avec ses propres regles. Pas de
#        serveur de courrier, pas de service tiers bride ;
#      - il alerte aussi quand le battement S'ARRETE. Si la machine entiere
#        meurt — coupure Oracle, disque plein, noyau fige — ce script ne tourne
#        plus du tout, donc aucune alerte ne PART. Sentry, lui, remarque le
#        silence. C'est le seul mecanisme ici qui couvre ce cas.
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

  # On garde le CODE et le CORPS de la reponse.
  #
  # « ATTENTION : l'alerte n'a pas pu etre envoyee » sans rien d'autre est
  # inutilisable : c'est le moment ou l'on a le plus besoin de savoir pourquoi.
  # Le service d'alerte dit presque toujours ce qui ne va pas — encore faut-il
  # ne pas jeter sa reponse.
  reponse=$(mktemp 2>/dev/null || echo /tmp/haron-alerte.$$)
  # shellcheck disable=SC2086
  code=$(curl -sS --max-time 20 -o "$reponse" -w '%{http_code}' \
       -H "Title: Peluqueria HARON" \
       -H "Priority: high" \
       $entete_courriel \
       -d "$1" "$ALERTE_URL" 2>>"$reponse" || echo 000)

  if [ "$code" = "200" ]; then
    rm -f "$reponse"
    return 0
  fi

  echo "$(horodatage)  ATTENTION : l'alerte n'est PAS partie (HTTP ${code})." >&2
  echo "    reponse du service : $(head -c 400 "$reponse" 2>/dev/null | tr '\n' ' ')" >&2
  echo "    adresse : ${ALERTE_URL}" >&2
  rm -f "$reponse"
}

#
# Le battement vers Sentry.
#
# Il part a CHAQUE passage, pas seulement en cas de panne : c'est le silence
# qui fait l'alerte. Il ne bloque jamais et ne parle pas — un Sentry injoignable
# ne doit pas empecher la surveillance de faire son travail.
battement() {
  [ -z "${SENTRY_CRON_URL:-}" ] && return 0
  curl -fsS --max-time 10 -o /dev/null "${SENTRY_CRON_URL}?status=$1" 2>/dev/null || true
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
  battement ok
  echo "0 ok" > "$ETAT"
  exit 0
fi

echecs=$((echecs + 1))
echo "$(horodatage)  INJOIGNABLE (HTTP $code) — echec $echecs"
battement error

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
