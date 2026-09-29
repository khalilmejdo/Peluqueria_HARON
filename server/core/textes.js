/**
 * Tout ce que le serveur dit a voix haute, dans les deux langues.
 *
 * UNE CLE, DEUX LANGUES, UNE LIGNE. C'est la seule disposition qui empeche une
 * traduction d'etre oubliee : on ne peut pas ajouter une phrase sans voir le
 * trou a cote. Deux fichiers separes, ou deux gros objets l'un apres l'autre,
 * auraient derive des la premiere semaine.
 *
 * LE FRANCAIS VOUVOIE, L'ESPAGNOL TUTOIE. Ce n'est pas une inconstance : en
 * Espagne, « pide tu turno » est le registre normal d'un commerce de quartier, et
 * vouvoyer y sonnerait administratif. En francais — et particulierement dans le
 * francais commercial du Maroc — c'est l'inverse : tutoyer un client qu'on ne
 * connait pas sonne cavalier. Traduire le tutoiement mot pour mot aurait donne
 * une vitrine familiere la ou l'espagnole est simplement chaleureuse.
 *
 * LE PLURIEL SE MARQUE AVEC « | » : « {n} personne|{n} personnes ». La coupure
 * n'est pas au meme endroit dans les deux langues (« 0 personas » mais
 * « 0 personne »), et c'est le moteur qui choisit — voir indicePluriel().
 *
 * Les accolades portent les valeurs : « Nous rouvrons le {date}. »
 */

export const TEXTES = {
  /* ---------------------------------------------------------------- */
  /*  Mots communs                                                    */
  /* ---------------------------------------------------------------- */

  'commun.accueil': { es: 'Inicio', fr: 'Accueil' },
  'commun.retourAccueil': { es: 'Volver al inicio', fr: 'Retour à l’accueil' },
  'commun.ferme': { es: 'Cerrado', fr: 'Fermé' },
  'commun.conges': { es: 'Vacaciones', fr: 'Congés' },
  'commun.avis': { es: 'Aviso', fr: 'Avis' },
  'commun.appelerSalon': { es: 'Llamar al salón', fr: 'Appeler le salon' },
  'commun.sansConnexion': { es: 'Sin conexión', fr: 'Hors connexion' },
  'commun.salonLeNom': { es: 'el salón', fr: 'le salon' },

  /* ---------------------------------------------------------------- */
  /*  Pied de page                                                    */
  /* ---------------------------------------------------------------- */

  'pied.devise': { es: 'Un salón. Una fila. Un turno.', fr: 'Un salon. Une file. Un tour.' },
  'pied.acces': { es: 'Acceso del personal', fr: 'Accès du personnel' },
  'marque.inicio': { es: '{nom}, inicio', fr: '{nom}, accueil' },
  'saut.contenu': { es: 'Ir al contenido', fr: 'Aller au contenu' },
  'gestion.titrePage': { es: 'Salón — {nom}', fr: 'Salon — {nom}' },
  'gestion.chargement': { es: 'Cargando la fila…', fr: 'Chargement de la file…' },

  /* ---------------------------------------------------------------- */
  /*  Pages d'erreur                                                  */
  /* ---------------------------------------------------------------- */

  'erreur.etiquette': { es: 'Error {statut}', fr: 'Erreur {statut}' },
  'erreur.tropDeDemandes': { es: 'Demasiadas peticiones', fr: 'Trop de demandes' },
  'erreur.tropDeDemandesTexte': {
    es: 'Espera unos instantes antes de recargar esta página.',
    fr: 'Patientez quelques instants avant de recharger cette page.',
  },
  /* ---------------------------------------------------------------- */
  /*  Erreurs applicatives                                            */
  /* ---------------------------------------------------------------- */

  'err.requeteInvalide': { es: 'Petición no válida.', fr: 'Requête invalide.' },
  'err.identification': { es: 'Hace falta identificarse.', fr: 'Il faut s’identifier.' },
  'err.interdit': { es: 'No tienes permiso para esta acción.', fr: 'Vous n’avez pas le droit d’effectuer cette action.' },
  'err.introuvable': { es: 'No encontrado.', fr: 'Introuvable.' },
  'err.conflit': { es: 'Conflicto con el estado actual del dato.', fr: 'Conflit avec l’état actuel de la donnée.' },
  'err.tropGros': { es: 'Contenido demasiado grande.', fr: 'Contenu trop volumineux.' },
  'err.typeNonPermis': { es: 'Tipo de contenido no permitido.', fr: 'Type de contenu non autorisé.' },
  'err.operationRefusee': { es: 'Operación rechazada.', fr: 'Opération refusée.' },
  'err.champsInvalides': { es: 'Algunos campos no son válidos.', fr: 'Certains champs ne sont pas valides.' },

  'err.pgType.valeur': {
    es: 'Un parámetro de la petición está mal formado: un valor no tiene la forma esperada.',
    fr: 'Un paramètre de la requête est mal formé : une valeur n’a pas la forme attendue.',
  },
  'err.pgType.date': {
    es: 'Un parámetro de la petición está mal formado: se espera una fecha con formato AAAA-MM-DD.',
    fr: 'Un paramètre de la requête est mal formé : une date au format AAAA-MM-JJ est attendue.',
  },
  'err.pgType.dateImpossible': {
    es: 'Un parámetro de la petición está mal formado: esa fecha u hora no existe.',
    fr: 'Un paramètre de la requête est mal formé : cette date ou cette heure n’existe pas.',
  },
  'err.pgType.capacite': {
    es: 'Un valor supera la capacidad del campo que lo recibe.',
    fr: 'Une valeur dépasse la capacité du champ qui la reçoit.',
  },
  'err.fileConcurrente': {
    es: 'Dos cambios en la fila se han cruzado. No se ha perdido nada: repite la acción.',
    fr: 'Deux changements dans la file se sont croisés. Rien n’a été perdu : refaites le geste.',
  },
  'err.fauteuilConcurrent': {
    es: 'Se acaba de llamar a un cliente en el mismo instante. Recarga la fila antes de llamar al siguiente.',
    fr: 'Un client vient d’être appelé au même instant. Rechargez la file avant d’appeler le suivant.',
  },
  'err.doublon': {
    es: 'Este elemento ya existe (valor duplicado). Recarga la página y comprueba antes de repetir.',
    fr: 'Cet élément existe déjà (valeur en double). Rechargez la page et vérifiez avant de recommencer.',
  },
  'err.baseIndisponible': {
    es: 'El servicio no puede usar la base de datos ahora mismo: {cause}. No se ha guardado nada. Inténtalo en un instante.',
    fr: 'Le service ne peut pas utiliser la base de données pour le moment : {cause}. Rien n’a été enregistré. Réessayez dans un instant.',
  },
  'err.base.ecriture': {
    es: 'la base de datos rechaza la escritura: permisos insuficientes',
    fr: 'la base de données refuse l’écriture : droits insuffisants',
  },
  'err.base.tableManquante': {
    es: 'falta una tabla: la base de datos no está migrada',
    fr: 'une table manque : la base de données n’est pas migrée',
  },
  'err.base.connexionPerdue': {
    es: 'se ha perdido la conexión con la base de datos',
    fr: 'la connexion à la base de données a été perdue',
  },
  'err.base.neRepondPas': { es: 'la base de datos no responde', fr: 'la base de données ne répond pas' },
  'err.base.extinction': { es: 'la base de datos se está apagando', fr: 'la base de données s’arrête' },
  'err.base.demarrage': { es: 'la base de datos está arrancando', fr: 'la base de données démarre' },
  'err.base.plusDeConnexions': {
    es: 'la base de datos ya no acepta conexiones',
    fr: 'la base de données n’accepte plus de connexions',
  },
  'err.base.memoire': { es: 'la base de datos se ha quedado sin memoria', fr: 'la base de données n’a plus de mémoire' },
  'err.base.disquePlein': { es: 'el disco de la base de datos está lleno', fr: 'le disque de la base de données est plein' },
  'err.base.disqueNeRepondPas': {
    es: 'el disco de la base de datos no responde',
    fr: 'le disque de la base de données ne répond pas',
  },
  'err.base.lectureSeule': {
    es: 'la base de datos está en solo lectura: no se puede escribir',
    fr: 'la base de données est en lecture seule : impossible d’écrire',
  },
  'err.base.verrouTropLong': {
    es: 'otra operación mantenía el bloqueo demasiado tiempo',
    fr: 'une autre opération gardait le verrou trop longtemps',
  },
  'err.base.tempsDepasse': {
    es: 'la operación ha superado el tiempo permitido y se ha interrumpido',
    fr: 'l’opération a dépassé le temps permis et a été interrompue',
  },
  'err.base.connexionsOccupees': {
    es: 'todas las conexiones con la base de datos están ocupadas',
    fr: 'toutes les connexions à la base de données sont occupées',
  },

  'erreur.pageIntrouvable': { es: 'Página no encontrada', fr: 'Page introuvable' },
  'erreur.unMoment': { es: 'Un momento', fr: 'Un instant' },
  'erreur.reessayer': {
    es: 'Inténtalo en un instante. Si el problema continúa, dile al salón la referencia {ref}.',
    fr: 'Réessayez dans un instant. Si le problème persiste, donnez au salon la référence {ref}.',
  },
  'erreur.inattendue': {
    es: 'Ha ocurrido un error inesperado. Si continúa, comunique la referencia {ref} a su administrador.',
    fr: 'Une erreur inattendue s’est produite. Si elle persiste, communiquez la référence {ref} à votre administrateur.',
  },
  'http.tropDeDemandes': { es: 'Demasiadas peticiones. Espere unos instantes.', fr: 'Trop de demandes. Patientez quelques instants.' },
  'http.tropDeDemandesOperation': {
    es: 'Demasiadas peticiones en esta operación. Espere un instante.',
    fr: 'Trop de demandes pour cette opération. Patientez un instant.',
  },
  'http.methodeInterdite': { es: 'Método no permitido para esta dirección.', fr: 'Méthode non autorisée pour cette adresse.' },
  'http.adresseInconnue': { es: 'Dirección desconocida.', fr: 'Adresse inconnue.' },
  'http.origineRefusee': { es: 'Petición rechazada: origen no reconocido.', fr: 'Requête refusée : origine non reconnue.' },
  'http.sessionExpiree': {
    es: 'Tu sesión ha caducado o se ha cerrado: vuelve a entrar.',
    fr: 'Votre session a expiré ou a été fermée : reconnectez-vous.',
  },
  'http.csrf': {
    es: 'Falta el testigo de seguridad o no es válido. Recarga la página.',
    fr: 'Le jeton de sécurité est absent ou invalide. Rechargez la page.',
  },
  'erreur.lienInvalide': { es: 'Enlace de seguimiento no válido', fr: 'Lien de suivi invalide' },
  'erreur.lienInvalideWhatsapp': {
    es: 'Este enlace ya no sirve. Si tu turno sigue en curso, busca el enlace que recibiste por WhatsApp, o pídelo en el salón.',
    fr: 'Ce lien ne fonctionne plus. Si votre tour est toujours en cours, retrouvez le lien reçu par WhatsApp, ou demandez-le au salon.',
  },
  'erreur.lienInvalideSansWhatsapp': {
    es: 'Este enlace ya no sirve. Si tu turno sigue en curso, pide tu enlace en el salón: pueden encontrarlo con tu número de turno.',
    fr: 'Ce lien ne fonctionne plus. Si votre tour est toujours en cours, demandez votre lien au salon : on le retrouve avec votre numéro de tour.',
  },

  /* ---------------------------------------------------------------- */
  /*  Accueil                                                         */
  /* ---------------------------------------------------------------- */

  'accueil.titre': { es: '{nom} — Pide tu turno sin esperar de pie', fr: '{nom} — Prenez votre tour sans attendre debout' },
  'accueil.description': {
    es: 'Pide turno en {nom} desde el móvil, sigue tu posición en directo y llega en el momento justo. Sin cuenta y sin instalar nada.',
    fr: 'Prenez votre tour chez {nom} depuis votre téléphone, suivez votre position en direct et arrivez au bon moment. Sans compte et sans rien installer.',
  },
  'accueil.enDirect': { es: 'En directo', fr: 'En direct' },
  'accueil.sansAttente': { es: 'Sin espera', fr: 'Aucune attente' },
  'accueil.sansAttenteDetail': { es: 'El sillón te está esperando.', fr: 'Le fauteuil vous attend.' },
  'accueil.enFile': { es: '{n} persona en la fila|{n} personas en la fila', fr: '{n} personne dans la file|{n} personnes dans la file' },
  'accueil.attenteEstimee': { es: 'Espera estimada: {duree}', fr: 'Attente estimée : {duree}' },
  'accueil.servisAujourdhui': { es: '{n} atendido hoy|{n} atendidos hoy', fr: '{n} client servi aujourd’hui|{n} clients servis aujourd’hui' },
  'accueil.prendreTour': { es: 'Pedir mi turno', fr: 'Prendre mon tour' },
  'accueil.noteAvecWhatsapp': {
    es: 'Sin cuenta y sin instalar nada. Recibes un enlace de seguimiento por WhatsApp.',
    fr: 'Sans compte et sans rien installer. Vous recevez un lien de suivi par WhatsApp.',
  },
  'accueil.noteSansWhatsapp': {
    es: 'Sin cuenta y sin instalar nada. Te llevas un enlace que muestra tu posición en directo.',
    fr: 'Sans compte et sans rien installer. Vous repartez avec un lien qui montre votre position en direct.',
  },
  'accueil.salonFerme': { es: 'Salón cerrado', fr: 'Salon fermé' },
  'accueil.plusDeTours': { es: 'No damos más turnos', fr: 'Nous ne prenons plus de tours' },
  'accueil.dejaAuSalon': { es: '¿Ya estás en el salón?', fr: 'Vous êtes déjà au salon ?' },
  'accueil.dejaAuSalonTexte': {
    es: 'Escanea el código QR del escaparate y entras en la misma fila.',
    fr: 'Scannez le code QR de la vitrine : c’est la même file.',
  },

  /* ---------------------------------------------------------------- */
  /*  Bandeau des conges                                              */
  /* ---------------------------------------------------------------- */

  'conges.ferme': { es: 'El salón está cerrado', fr: 'Le salon est fermé' },
  'conges.reouverture': { es: 'Volvemos a abrir el {date}.', fr: 'Nous rouvrons le {date}.' },
  'conges.fermonsAujourdhui': { es: 'Cerramos hoy', fr: 'Nous fermons aujourd’hui' },
  'conges.fermonsDemain': { es: 'Cerramos mañana', fr: 'Nous fermons demain' },
  'conges.fermonsDans': { es: 'Cerramos dentro de {n} días', fr: 'Nous fermons dans {n} jours' },
  'conges.prochaineFermeture': { es: 'Próximo cierre', fr: 'Prochaine fermeture' },
  'conges.periode': { es: 'Del {du} al {au}. Volvemos el {retour}.', fr: 'Du {du} au {au}. Retour le {retour}.' },
  'conges.finAvantDebut': {
    es: 'La fecha de fin debe ser posterior o igual a la de inicio.',
    fr: 'La date de fin doit être postérieure ou égale à celle de début.',
  },
  'conges.chevauchementPrecis': {
    es: 'Ya hay un cierre que cubre estas fechas (del {du} al {au}). Modifíquelo en lugar de añadir otro.',
    fr: 'Une fermeture couvre déjà ces dates (du {du} au {au}). Modifiez-la plutôt que d’en ajouter une autre.',
  },
  'conges.chevauchement': { es: 'Ya hay un cierre que cubre estas fechas.', fr: 'Une fermeture couvre déjà ces dates.' },
  'conges.introuvable': { es: 'Este periodo de cierre ya no existe.', fr: 'Cette période de fermeture n’existe plus.' },
  'conges.messageClient': {
    es: '{raison}El salón está cerrado hasta el {jusqua} incluido. Reabrimos el {reouverture}.',
    fr: '{raison}Le salon est fermé jusqu’au {jusqua} inclus. Nous rouvrons le {reouverture}.',
  },

  /* ---------------------------------------------------------------- */
  /*  Sections de la vitrine                                          */
  /* ---------------------------------------------------------------- */

  'tarifs.titre': { es: 'Tarifas', fr: 'Tarifs' },
  'tarifs.intro': { es: 'Precios claros, sin sorpresas.', fr: 'Des prix clairs, sans surprise.' },
  'tarifs.bandeau': { es: 'Barbería & estilo', fr: 'Coiffure & style' },
  'tarifs.devise': { es: 'Tu estilo, nuestra pasión', fr: 'Votre style, notre passion' },

  'contact.titre': { es: 'Contacto', fr: 'Contact' },
  'contact.intro': { es: 'Pasa cuando quieras, o escríbenos antes.', fr: 'Passez quand vous voulez, ou écrivez-nous avant.' },
  'contact.appeler': { es: 'Llámanos', fr: 'Appelez-nous' },
  'contact.appelerAction': { es: 'Llamar ahora', fr: 'Appeler maintenant' },
  'contact.whatsapp': { es: 'WhatsApp', fr: 'WhatsApp' },
  'contact.whatsappAction': { es: 'Escribir', fr: 'Écrire' },
  'contact.horaires': { es: 'Horario', fr: 'Horaires' },

  'galerie.titre': { es: 'El salón', fr: 'Le salon' },
  'galerie.intro': { es: 'Así es la casa.', fr: 'La maison, en images.' },
  'galerie.noteDessins': {
    es: 'Ilustraciones. Las fotos del salón llegan pronto.',
    fr: 'Illustrations. Les photos du salon arrivent bientôt.',
  },

  'lieu.titre': { es: 'Cómo llegar', fr: 'Comment venir' },
  'lieu.intro': { es: 'Estamos aquí.', fr: 'Nous sommes ici.' },
  'lieu.itineraire': { es: 'Cómo llegar', fr: 'Itinéraire' },
  'lieu.voirCarte': { es: 'Ver en el mapa', fr: 'Voir sur la carte' },

  'etapes.titre': { es: 'Cómo funciona', fr: 'Comment ça marche' },
  'etapes.intro': { es: 'Tres pasos, y ninguno cuesta nada.', fr: 'Trois étapes, et aucune ne coûte rien.' },
  'etapes.1.titre': { es: 'Pide tu turno', fr: 'Prenez votre tour' },
  'etapes.1.texte': {
    es: 'Tu nombre y tu teléfono. Nada más: ni cuenta, ni contraseña, ni aplicación.',
    fr: 'Votre nom et votre téléphone. Rien d’autre : ni compte, ni mot de passe, ni application.',
  },
  'etapes.2.titre': { es: 'Sigue tu posición', fr: 'Suivez votre position' },
  'etapes.2.texte': {
    es: 'Te llevas un enlace que te dice en directo cuántas personas te faltan.',
    fr: 'Vous repartez avec un lien qui vous dit en direct combien de personnes vous précèdent.',
  },
  'etapes.3.titre': { es: 'Llega a tiempo', fr: 'Arrivez à temps' },
  'etapes.3.texte': {
    es: 'Espera donde quieras y ven cuando el enlace te diga que te toca.',
    fr: 'Attendez où vous voulez et venez quand le lien vous dit que c’est à vous.',
  },

  /* ---------------------------------------------------------------- */
  /*  Prendre son tour                                                */
  /* ---------------------------------------------------------------- */

  'join.titre': { es: 'Pedir mi turno — {nom}', fr: 'Prendre mon tour — {nom}' },
  'join.description': { es: 'Entra en la fila de {nom} en menos de un minuto.', fr: 'Entrez dans la file de {nom} en moins d’une minute.' },
  'join.h1': { es: 'Pedir mi turno', fr: 'Prendre mon tour' },
  'join.sousTitre': {
    es: 'Tres datos, menos de un minuto, y sigues tu posición en directo.',
    fr: 'Trois informations, moins d’une minute, et vous suivez votre position en direct.',
  },
  'join.champPrenom': { es: 'Nombre', fr: 'Prénom' },
  'join.champNom': { es: 'Apellido', fr: 'Nom' },
  'join.champTelephone': { es: 'Número de WhatsApp', fr: 'Numéro WhatsApp' },
  'join.aideTelephone': {
    es: 'Solo cifras. Número del país por defecto: no hace falta escribir +{indicatif}. Desde el extranjero, empieza por « + ».',
    fr: 'Chiffres uniquement. Numéro du pays par défaut : inutile d’écrire +{indicatif}. De l’étranger, commencez par « + ».',
  },
  'join.envoyer': { es: 'Pedir mi turno', fr: 'Prendre mon tour' },
  'join.noteAvecWhatsapp': {
    es: 'Tu número solo sirve para avisarte. Nunca se muestra en público.',
    fr: 'Votre numéro ne sert qu’à vous prévenir. Il n’est jamais affiché en public.',
  },
  'join.noteSansWhatsapp': {
    es: 'Tu número sirve al salón para localizarte si hace falta. Nunca se muestra en público.',
    fr: 'Votre numéro permet au salon de vous joindre si besoin. Il n’est jamais affiché en public.',
  },
  'join.coiffeurTitre': { es: 'Tu peluquero', fr: 'Votre coiffeur' },
  'join.coiffeurLibre': { es: 'Libre ahora mismo', fr: 'Libre tout de suite' },
  'join.coiffeurAttente': { es: '{n} persona · ≈ {duree}|{n} personas · ≈ {duree}', fr: '{n} personne · ≈ {duree}|{n} personnes · ≈ {duree}' },
  'join.prestationsTitre': { es: '¿Qué te vas a hacer?', fr: 'Que souhaitez-vous ?' },
  'join.prestationsFacultatif': { es: 'opcional', fr: 'facultatif' },
  'join.prestationsAide': {
    es: 'Nos ayuda a calcular mejor tu espera. Puedes elegir varios.',
    fr: 'Cela nous aide à mieux estimer votre attente. Plusieurs choix possibles.',
  },
  'join.prestationsTotal': { es: '{n} servicio · ≈ {duree} · {prix}|{n} servicios · ≈ {duree} · {prix}', fr: '{n} prestation · ≈ {duree} · {prix}|{n} prestations · ≈ {duree} · {prix}' },
  'join.fermeTitre': { es: 'El salón está cerrado', fr: 'Le salon est fermé' },

  /* ---------------------------------------------------------------- */
  /*  Suivi d'un tour                                                 */
  /* ---------------------------------------------------------------- */

  'ticket.titre': { es: 'Turno {numero} — {nom}', fr: 'Tour {numero} — {nom}' },
  'ticket.description': { es: 'Sigue tu turno en {nom} en directo.', fr: 'Suivez votre tour chez {nom} en direct.' },
  'ticket.label': { es: 'Tu turno', fr: 'Votre tour' },
  'ticket.avecCoiffeur': { es: 'con {nom}', fr: 'avec {nom}' },
  'ticket.devant': { es: 'Personas delante de ti', fr: 'Personnes devant vous' },
  'ticket.estimation': { es: 'Estimación', fr: 'Estimation' },
  'ticket.noteRetard': {
    es: 'Te hemos puesto al final de la fila porque no estabas. Esta vez quédate cerca.',
    fr: 'Vous avez été replacé en fin de file car vous étiez absent. Cette fois, restez à proximité.',
  },
  'ticket.tourDu': { es: 'Turno del {date}', fr: 'Tour du {date}' },
  'ticket.gardeLien': { es: 'Guarda este enlace', fr: 'Gardez ce lien' },
  'ticket.tonLien': { es: 'Tu enlace de seguimiento', fr: 'Votre lien de suivi' },
  'ticket.lienTexte': {
    es: 'Abre esta página cuando quieras y te dice cuántas personas te faltan. Envíatelo a ti mismo, o guárdalo en favoritos.',
    fr: 'Ouvrez cette page quand vous voulez : elle vous dit combien de personnes vous précèdent. Envoyez-le-vous, ou gardez-le dans vos favoris.',
  },
  'ticket.copier': { es: 'Copiar el enlace', fr: 'Copier le lien' },
  'ticket.envoyer': { es: 'Enviar el enlace', fr: 'Envoyer le lien' },
  'ticket.copie': { es: 'Enlace copiado.', fr: 'Lien copié.' },
  'ticket.sActualise': {
    es: 'Esta página se actualiza sola. Déjala abierta, o vuelve con tu enlace.',
    fr: 'Cette page se met à jour toute seule. Laissez-la ouverte, ou revenez avec votre lien.',
  },
  'ticket.annuler': { es: 'No voy a venir, liberar mi sitio', fr: 'Je ne viendrai pas, libérer ma place' },
  'ticket.nouveauTour': { es: 'Pedir un turno nuevo', fr: 'Prendre un nouveau tour' },

  /* ---------------------------------------------------------------- */
  /*  Les phases du tour, vues par le client                          */
  /* ---------------------------------------------------------------- */

  'phase.tour.titre': { es: '¡Es tu turno!', fr: 'C’est à vous !' },
  'phase.tour.detail': { es: 'Pasa al sillón, {nom} te espera.', fr: 'Installez-vous, {nom} vous attend.' },
  'phase.service.titre': { es: 'Estás en el sillón.', fr: 'Vous êtes au fauteuil.' },
  'phase.service.detail': { es: '¡Que te quede bien!', fr: 'Bonne coupe !' },
  'phase.suivant.titre': { es: 'Eres el siguiente.', fr: 'Vous êtes le prochain.' },
  'phase.suivant.detail': {
    es: 'Quédate cerca del salón, tu turno está a punto de llegar.',
    fr: 'Restez près du salon, votre tour arrive.',
  },
  'phase.approche.titre': { es: '¡Tu turno se acerca!', fr: 'Votre tour approche !' },
  'phase.approche.detail': {
    es: 'Te queda {n} persona delante. Acércate al salón.|Te quedan {n} personas delante. Acércate al salón.',
    fr: 'Il reste {n} personne devant vous. Rapprochez-vous du salon.|Il reste {n} personnes devant vous. Rapprochez-vous du salon.',
  },
  'phase.fini.titre': { es: 'Ya te han atendido.', fr: 'Vous avez été servi.' },
  'phase.fini.detail': { es: 'Gracias por tu visita, ¡hasta pronto!', fr: 'Merci de votre visite, à bientôt !' },
  'phase.annule.titre': { es: 'Este turno se ha anulado.', fr: 'Ce tour a été annulé.' },
  'phase.annule.detail': { es: 'Pide otro turno cuando quieras.', fr: 'Reprenez un tour quand vous voulez.' },
  'phase.attente.titre': { es: 'Estás en la fila.', fr: 'Vous êtes dans la file.' },
  'phase.attente.detail': {
    es: 'Unos {duree} de espera. Quédate cerca, te avisaremos.',
    fr: 'Environ {duree} d’attente. Restez à proximité, nous vous préviendrons.',
  },

  /* ---------------------------------------------------------------- */
  /*  L'ecran du salon                                                */
  /* ---------------------------------------------------------------- */

  'pantalla.titre': { es: 'Pantalla — {nom}', fr: 'Écran — {nom}' },
  'pantalla.description': { es: 'La fila del salón, en directo.', fr: 'La file du salon, en direct.' },
  'pantalla.cestATous': { es: 'Es vuestro turno', fr: 'C’est à vous' },
  'pantalla.cestAToi': { es: 'Es tu turno', fr: 'C’est à vous' },
  'pantalla.auFauteuil': { es: 'En el sillón', fr: 'Au fauteuil' },
  'pantalla.fauteuilLibre': { es: 'Sillón libre', fr: 'Fauteuil libre' },
  'pantalla.journeeClose': { es: 'Jornada cerrada', fr: 'Journée terminée' },
  'pantalla.passeQuandTuVeux': { es: 'Pasa cuando quieras.', fr: 'Passez quand vous voulez.' },
  'pantalla.aDemain': { es: 'Hasta mañana.', fr: 'À demain.' },
  'pantalla.suivants': { es: 'Siguientes', fr: 'Suivants' },
  'pantalla.personneEnAttente': { es: 'Nadie esperando.', fr: 'Personne n’attend.' },
  'pantalla.etDePlus': { es: 'y {n} más', fr: 'et {n} de plus' },
  'pantalla.enAttente': { es: 'esperando', fr: 'en attente' },
  'pantalla.aujourdhui': { es: 'hoy', fr: 'aujourd’hui' },
  'pantalla.prendreTour': { es: 'Pide tu turno', fr: 'Prenez votre tour' },
  'pantalla.prendreTourTexte': {
    es: 'Escanea el código y sigue tu posición en el móvil.',
    fr: 'Scannez le code et suivez votre position sur votre téléphone.',
  },

  /* ---------------------------------------------------------------- */
  /*  L'affiche de la vitrine                                         */
  /* ---------------------------------------------------------------- */

  'affiche.titre': { es: 'Cartel con código QR — {nom}', fr: 'Affiche avec code QR — {nom}' },
  'affiche.description': { es: 'El cartel para imprimir y poner en el escaparate.', fr: 'L’affiche à imprimer pour la vitrine du salon.' },
  'affiche.accroche': { es: '¿Ya estás aquí?', fr: 'Vous êtes déjà là ?' },
  'affiche.sousTitre': { es: 'Escanea para pedir tu turno', fr: 'Scannez pour prendre votre tour' },
  'affiche.mention': { es: 'No hace falta instalar ninguna aplicación', fr: 'Aucune application à installer' },
  'affiche.qrAlt': { es: 'Escanear para pedir turno', fr: 'Scanner pour prendre son tour' },
  'affiche.telechargerSvg': { es: 'Descargar el QR (SVG)', fr: 'Télécharger le QR (SVG)' },
  'affiche.telechargerPng': { es: 'Descargar el QR (PNG)', fr: 'Télécharger le QR (PNG)' },
  'affiche.imprimer': { es: 'Imprimir el cartel', fr: 'Imprimer l’affiche' },

  /* ---------------------------------------------------------------- */
  /*  Les scenes dessinees de la galerie                              */
  /* ---------------------------------------------------------------- */

  'scene.salon': { es: 'Nuestro salón', fr: 'Notre salon' },
  'scene.fauteuil': { es: 'El sillón', fr: 'Le fauteuil' },
  'scene.entree': { es: 'La entrada', fr: 'L’entrée' },

  /* ---------------------------------------------------------------- */
  /*  Le domaine de la file : refus et messages                       */
  /* ---------------------------------------------------------------- */

  'file.plusDeToursDefaut': {
    es: 'El salón no da más turnos por ahora. Ven directamente al salón, o vuelve un poco más tarde.',
    fr: 'Le salon ne prend plus de tours pour le moment. Passez directement au salon, ou revenez un peu plus tard.',
  },
  'file.fermeMidi': {
    es: 'El salón está cerrado a mediodía. Volvemos a abrir a las {heure}, y entonces podrás pedir tu turno.',
    fr: 'Le salon est fermé à midi. Nous rouvrons à {heure}, et vous pourrez alors prendre votre tour.',
  },
  'file.fermeMaintenant': {
    es: 'El salón está cerrado ahora mismo. Podrás pedir tu turno a partir de las {heure}.',
    fr: 'Le salon est fermé pour le moment. Vous pourrez prendre votre tour à partir de {heure}.',
  },
  'file.fermeAujourdhui': {
    es: 'El salón está cerrado hoy. Vuelve el próximo día de apertura.',
    fr: 'Le salon est fermé aujourd’hui. Revenez le prochain jour d’ouverture.',
  },
  'file.choisirCoiffeur': { es: 'Elige tu peluquero.', fr: 'Choisissez votre coiffeur.' },
  'file.choisirCoiffeurGlobal': {
    es: 'El salón funciona con una fila por peluquero: elige el tuyo.',
    fr: 'Le salon fonctionne avec une file par coiffeur : choisissez le vôtre.',
  },
  'file.coiffeurIndisponible': { es: 'Este peluquero no está disponible.', fr: 'Ce coiffeur n’est pas disponible.' },
  'file.coiffeurIndisponibleGlobal': {
    es: 'Este peluquero ya no está disponible. Elige otro.',
    fr: 'Ce coiffeur n’est plus disponible. Choisissez-en un autre.',
  },
  'file.journeeClose': {
    es: 'El salón ha cerrado la jornada. Vuelve mañana, o ven directamente al salón.',
    fr: 'Le salon a clôturé la journée. Revenez demain, ou passez directement au salon.',
  },
  'file.complete': {
    es: 'La fila de hoy está completa. Ven al salón o vuelve mañana.',
    fr: 'La file du jour est complète. Passez au salon ou revenez demain.',
  },
  'file.dejaUnTour': {
    es: 'Ya hay un turno en curso para este número (turno {numero}). Búscalo en tu enlace de seguimiento, o pídelo en el salón.',
    fr: 'Un tour est déjà en cours pour ce numéro (tour {numero}). Retrouvez-le avec votre lien de suivi, ou demandez-le au salon.',
  },
  'file.pasDansLaFile': { es: 'Este turno no está en la fila de hoy.', fr: 'Ce tour n’est pas dans la file du jour.' },
  'file.aucuneFileOuverte': { es: 'No hay ninguna jornada abierta hoy.', fr: 'Aucune journée n’est ouverte aujourd’hui.' },
  'file.journeeCloseModif': {
    es: 'La jornada está cerrada: la fila de hoy ya no se puede modificar.',
    fr: 'La journée est clôturée : la file du jour ne peut plus être modifiée.',
  },
  'file.dejaAppele': { es: 'El turno {numero} ya está llamado.', fr: 'Le tour {numero} est déjà appelé.' },
  'file.plusEnAttente': { es: 'El turno {numero} ya no está esperando ({statut}).', fr: 'Le tour {numero} n’attend plus ({statut}).' },
  // Cette phrase melangeait l'espagnol et le francais dans la meme phrase :
  // « ya está en el sillón … Terminez ce client ». Personne ne l'avait vue, car
  // elle n'apparait qu'en appelant quelqu'un alors qu'un fauteuil est occupe.
  'file.fauteuilOccupe': {
    es: '{prenom} ({numero}) ya está en el sillón « {poste} ». Termina con ese cliente, o márcalo ausente, antes de llamar al siguiente.',
    fr: '{prenom} ({numero}) est déjà au fauteuil « {poste} ». Terminez ce client, ou marquez-le absent, avant d’appeler le suivant.',
  },
  'file.aAppelerDabord': { es: 'El turno {numero} tiene que ser llamado primero.', fr: 'Le tour {numero} doit d’abord être appelé.' },
  'file.dejaDansCetEtat': { es: 'El turno {numero} ya está {statut}.', fr: 'Le tour {numero} est déjà {statut}.' },
  'file.plusDansLaFile': { es: 'El turno {numero} ya no está en la fila ({statut}).', fr: 'Le tour {numero} n’est plus dans la file ({statut}).' },
  'file.plusDansLaFileCourt': { es: 'El turno {numero} ya no está en la fila.', fr: 'Le tour {numero} n’est plus dans la file.' },
  'file.uneSeuleFile': {
    es: 'El salón funciona con una sola fila: no hay otra fila a la que mover a este cliente.',
    fr: 'Le salon fonctionne avec une file unique : il n’y a pas d’autre file où déplacer ce client.',
  },
  'file.dejaAuFauteuil': {
    es: 'El turno {numero} ya no está esperando ({statut}): no se cambia de peluquero a alguien que ya está en el sillón.',
    fr: 'Le tour {numero} n’attend plus ({statut}) : on ne change pas de coiffeur pour quelqu’un qui est déjà au fauteuil.',
  },
  'file.indiquerCoiffeur': { es: 'Indique el peluquero al que mover a este cliente.', fr: 'Indiquez le coiffeur vers lequel déplacer ce client.' },
  'file.coiffeurInexistant': { es: 'Este peluquero ya no existe.', fr: 'Ce coiffeur n’existe plus.' },
  'file.fauteuilFerme': { es: 'El sillón « {poste} » está cerrado.', fr: 'Le fauteuil « {poste} » est fermé.' },
  'file.dejaChezCeCoiffeur': { es: 'Este cliente ya está esperando a {nom}.', fr: 'Ce client attend déjà chez {nom}.' },
  'file.motifAnnulationSalon': { es: 'Turno anulado por el salón.', fr: 'Tour annulé par le salon.' },
  'file.lienPerime': { es: 'Este enlace de seguimiento ya no sirve.', fr: 'Ce lien de suivi ne fonctionne plus.' },
  'file.tourPlusDansLaFile': { es: 'Este turno ya no está en la fila.', fr: 'Ce tour n’est plus dans la file.' },
  'file.journeeCloseCourt': { es: 'La jornada está cerrada.', fr: 'La journée est clôturée.' },
  'file.personneChezCeCoiffeur': { es: 'Ahora mismo nadie espera a este peluquero.', fr: 'Personne n’attend chez ce coiffeur pour le moment.' },
  'file.personneEnAttente': { es: 'Ahora mismo no espera nadie.', fr: 'Personne n’attend pour le moment.' },

  /* ---------------------------------------------------------------- */
  /*  Les donnees de depart, posees a la premiere installation        */
  /* ---------------------------------------------------------------- */

  'seed.fauteuil1': { es: 'Sillón 1', fr: 'Fauteuil 1' },
  'seed.gerant': { es: 'Gerente del salón', fr: 'Gérant du salon' },

  'seed.tarif.coupe': { es: 'Corte normal', fr: 'Coupe' },
  'seed.tarif.barbe': { es: 'Barba', fr: 'Barbe' },
  'seed.tarif.coupeBarbe': { es: 'Corte + barba', fr: 'Coupe + barbe' },
  'seed.tarif.masque': { es: 'Mascarilla', fr: 'Masque' },
  'seed.tarif.dark': { es: 'Dark', fr: 'Dark' },
  'seed.tarif.keratine': { es: 'Queratina', fr: 'Kératine' },
  'seed.tarif.meches': { es: 'Mechas', fr: 'Mèches' },
  'seed.tarif.mechesBlanches': { es: 'Mechas blancas', fr: 'Mèches blanches' },
  'seed.tarif.coiffage': { es: 'Peinado', fr: 'Coiffage' },
  'seed.tarif.sourcils': { es: 'Cejas', fr: 'Sourcils' },
  'seed.tarif.sourcilsCire': { es: 'Cejas con cera', fr: 'Sourcils à la cire' },
  'seed.tarif.teinture': { es: 'Tinte normal', fr: 'Teinture' },
  'seed.tarif.coloration': { es: 'Tinte de pelo', fr: 'Coloration' },
  'seed.tarif.teintureBarbe': { es: 'Tinte barba', fr: 'Teinture barbe' },
  'seed.tarif.shampoing': { es: 'Lavado de pelo', fr: 'Shampoing' },
  'seed.tarif.leplusdemande': { es: 'El más pedido', fr: 'Le plus demandé' },

  /* ---------------------------------------------------------------- */
  /*  Les fauteuils                                                   */
  /* ---------------------------------------------------------------- */

  'poste.dejaCeNom': { es: 'Ya hay un sillón con ese nombre.', fr: 'Un fauteuil porte déjà ce nom.' },
  'poste.dejaCeNomFerme': {
    es: 'Un sillón desactivado ya lleva ese nombre. Reactívelo en lugar de crear un segundo.',
    fr: 'Un fauteuil fermé porte déjà ce nom. Réouvrez-le plutôt que d’en créer un second.',
  },
  'poste.introuvable': { es: 'Este sillón ya no existe.', fr: 'Ce fauteuil n’existe plus.' },
  'poste.autreCeNom': { es: 'Otro sillón ya lleva ese nombre.', fr: 'Un autre fauteuil porte déjà ce nom.' },
  'poste.occupe': {
    es: '{prenom} ({numero}) está sentado en este sillón. Termínelo, o márquelo ausente, antes de cerrar el sillón.',
    fr: '{prenom} ({numero}) est assis à ce fauteuil. Terminez-le, ou marquez-le absent, avant de fermer le fauteuil.',
  },
  // L'espagnol colle le pronom au verbe et l'accorde (« atiéndalo » / « atiéndalos ») :
  // la phrase change a quatre endroits selon le nombre, ce qui est exactement
  // pourquoi le pluriel se declare dans le dictionnaire et pas dans le code.
  'poste.fileAttachee': {
    es: '{n} cliente espera a este peluquero. Atiéndalo, llámelo desde otro sillón, o anule ese turno antes de cerrar.'
      + '|{n} clientes esperan a este peluquero. Atiéndalos, llámelos desde otro sillón, o anule esos turnos antes de cerrar.',
    fr: '{n} client attend chez ce coiffeur. Servez-le, appelez-le depuis un autre fauteuil, ou annulez son tour avant de fermer.'
      + '|{n} clients attendent chez ce coiffeur. Servez-les, appelez-les depuis un autre fauteuil, ou annulez leurs tours avant de fermer.',
  },
  'poste.dernierOuvert': {
    es: 'Es el último sillón abierto: el salón debe conservar uno. Cree otro antes de cerrar este.',
    fr: 'C’est le dernier fauteuil ouvert : le salon doit en garder un. Créez-en un autre avant de fermer celui-ci.',
  },
  'poste.aServi': {
    es: 'Este sillón ya ha atendido a {n} cliente: borrarlo eliminaría ese historial. Ciérrelo en su lugar.'
      + '|Este sillón ya ha atendido a {n} clientes: borrarlo eliminaría ese historial. Ciérrelo en su lugar.',
    fr: 'Ce fauteuil a déjà servi {n} client : le supprimer effacerait cet historique. Fermez-le plutôt.'
      + '|Ce fauteuil a déjà servi {n} clients : le supprimer effacerait cet historique. Fermez-le plutôt.',
  },
  'poste.auMoinsUn': { es: 'El salón debe conservar al menos un sillón.', fr: 'Le salon doit garder au moins un fauteuil.' },
  'poste.ferme': { es: 'El sillón « {poste} » está cerrado.', fr: 'Le fauteuil « {poste} » est fermé.' },
  'poste.suiteTerminer': {
    es: 'Termine un cliente, o márquelo ausente, antes de llamar al siguiente.',
    fr: 'Terminez un client, ou marquez-le absent, avant d’appeler le suivant.',
  },
  'poste.unSeulOccupe': { es: '{prenom} ({numero}) ya está en el sillón.', fr: '{prenom} ({numero}) est déjà au fauteuil.' },
  'poste.tousOccupes': { es: 'Todos los sillones están ocupados', fr: 'Tous les fauteuils sont occupés' },
  'poste.assisEn': { es: '{prenom} ({numero}) en {poste}', fr: '{prenom} ({numero}) sur {poste}' },
  'commun.aucuneModification': { es: 'No se ha enviado ningún cambio.', fr: 'Aucune modification transmise.' },

  /* ---------------------------------------------------------------- */
  /*  L'historique : ce qui se grave, au moment ou ca se grave         */
  /* ---------------------------------------------------------------- */

  'trace.tourPris': { es: 'Turno pedido ({source})', fr: 'Tour pris ({source})' },
  'trace.sourceEnLigne': { es: 'por internet', fr: 'en ligne' },
  'trace.sourceQr': { es: 'código QR del salón', fr: 'code QR du salon' },
  'trace.sourceComptoir': { es: 'mostrador', fr: 'comptoir' },
  'trace.appele': { es: 'Cliente llamado al sillón « {poste} »', fr: 'Client appelé au fauteuil « {poste} »' },
  'trace.appeleDeplace': {
    es: 'Cliente llamado al sillón « {poste} » (movido desde otro sillón).',
    fr: 'Client appelé au fauteuil « {poste} » (déplacé depuis un autre fauteuil).',
  },
  'trace.coupeCommencee': { es: 'Corte empezado.', fr: 'Coupe commencée.' },
  'trace.clientServi': { es: 'Cliente atendido.', fr: 'Client servi.' },
  'trace.absent': {
    es: 'Ausente al llamarle: pasa al final de la fila (ausencia n.º {n}).',
    fr: 'Absent à l’appel : replacé en fin de file (absence n° {n}).',
  },
  'trace.changementCoiffeur': { es: 'Cambio de peluquero: {avant} → {apres}.', fr: 'Changement de coiffeur : {avant} → {apres}.' },
  'trace.sansCoiffeur': { es: 'sin peluquero', fr: 'sans coiffeur' },
  'trace.annuleParClient': { es: 'Anulado por el cliente.', fr: 'Annulé par le client.' },
  'trace.annuleParClientLien': {
    es: 'Anulado por el cliente desde su enlace de seguimiento.',
    fr: 'Annulé par le client depuis son lien de suivi.',
  },
  'trace.envoiAnnuleAvant': { es: 'Turno anulado antes del envío.', fr: 'Tour annulé avant l’envoi.' },
  'trace.envoiAnnuleParClient': { es: 'Turno anulado por el cliente.', fr: 'Tour annulé par le client.' },

  /* ---------------------------------------------------------------- */
  /*  Les messages WhatsApp                                           */
  /* ---------------------------------------------------------------- */

  'wa.type.CONFIRMATION': { es: 'Turno registrado', fr: 'Tour enregistré' },
  'wa.type.APPROCHE': { es: 'Tu turno se acerca', fr: 'Votre tour approche' },
  'wa.type.TOUR': { es: 'Es tu turno', fr: 'C’est à vous' },
  'wa.suivi': { es: '\n\nSigue tu turno aquí:\n{lien}', fr: '\n\nSuivez votre tour ici :\n{lien}' },
  'wa.confirmation': {
    es: '¡Hola {prenom}! 👋\nTu turno en {salon} está registrado.\n\n🎟️ Número: {numero}\n👥 Personas delante de ti: {devant}',
    fr: 'Bonjour {prenom} ! 👋\nVotre tour chez {salon} est enregistré.\n\n🎟️ Numéro : {numero}\n👥 Personnes devant vous : {devant}',
  },
  'wa.confirmationFin': {
    es: '\n\nTe avisaremos cuando tu turno se acerque.',
    fr: '\n\nNous vous préviendrons quand votre tour approchera.',
  },
  'wa.approche': {
    es: '¡Hola {prenom}! 🔔\nTu turno en {salon} se acerca.\n\n🎟️ Número: {numero}\n👥 Personas delante de ti: {devant}\n\nAcércate al salón.',
    fr: 'Bonjour {prenom} ! 🔔\nVotre tour chez {salon} approche.\n\n🎟️ Numéro : {numero}\n👥 Personnes devant vous : {devant}\n\nRapprochez-vous du salon.',
  },
  'wa.tour': {
    es: '¡Hola {prenom}! 🟢\n¡Es tu turno en {salon}!\n\n🎟️ Número: {numero}\n\nPasa al sillón.',
    fr: 'Bonjour {prenom} ! 🟢\nC’est à vous chez {salon} !\n\n🎟️ Numéro : {numero}\n\nInstallez-vous.',
  },
  'wa.nonConfigure': {
    es: 'WhatsApp Business no está configurado: mensaje no enviado.',
    fr: 'WhatsApp Business n’est pas configuré : message non envoyé.',
  },

  /* ---------------------------------------------------------------- */
  /*  Les avis poussés au personnel                                   */
  /* ---------------------------------------------------------------- */

  'push.tourPris': { es: 'Nuevo turno {numero}{qui}', fr: 'Nouveau tour {numero}{qui}' },
  'push.seulEnAttente': { es: 'Es el único que espera.', fr: 'Il est le seul à attendre.' },
  'push.enAttente': { es: '{n} persona esperando.|{n} personas esperando.', fr: '{n} personne en attente.|{n} personnes en attente.' },
  'push.tourAnnule': { es: 'Turno anulado {numero}{qui}', fr: 'Tour annulé {numero}{qui}' },
  'push.personneEnAttente': { es: 'Ya no espera nadie.', fr: 'Plus personne n’attend.' },
  'push.resteEnAttente': {
    es: 'Queda {n} persona esperando.|Quedan {n} personas esperando.',
    fr: 'Il reste {n} personne en attente.|Il reste {n} personnes en attente.',
  },
  'push.essai': { es: 'Las notificaciones funcionan en este aparato.', fr: 'Les avis fonctionnent sur cet appareil.' },
  'push.nonConfigure': {
    es: 'Los avisos no están configurados en este servidor.',
    fr: 'Les avis ne sont pas configurés sur ce serveur.',
  },
  'push.abonnementPerime': {
    es: 'Este aparato ya no acepta avisos: vuelve a activarlos.',
    fr: 'Cet appareil n’accepte plus les avis : réactivez-les.',
  },
  'push.envoiImpossible': {
    es: 'No se ha podido enviar el aviso a este aparato.',
    fr: 'L’avis n’a pas pu être envoyé à cet appareil.',
  },
  'push.adresseInvalide': { es: 'Dirección de suscripción no válida.', fr: 'Adresse d’abonnement invalide.' },
  'push.httpsRequis': { es: 'La suscripción debe usar https.', fr: 'L’abonnement doit utiliser https.' },

  /* ---------------------------------------------------------------- */
  /*  La journee : cloture et traces                                  */
  /* ---------------------------------------------------------------- */

  'journee.clotureAuto': { es: 'cierre automático', fr: 'clôture automatique' },
  'journee.nonServi': {
    es: 'Jornada terminada: este turno no se ha atendido.',
    fr: 'Journée terminée : ce tour n’a pas été servi.',
  },
  'journee.envoiAnnuleCloture': { es: 'Jornada cerrada antes del envío.', fr: 'Journée clôturée avant l’envoi.' },
  'journee.nouvelle': { es: 'nueva jornada', fr: 'nouvelle journée' },
  'journee.fermeeParSalon': { es: 'Jornada cerrada por el salón.', fr: 'Journée clôturée par le salon.' },
  'journee.tourIntrouvable': { es: 'Turno no encontrado.', fr: 'Tour introuvable.' },

  /* ---------------------------------------------------------------- */
  /*  Sessions et acces                                               */
  /* ---------------------------------------------------------------- */

  'acces.sessionCaduque': { es: 'Tu sesión ha caducado. Vuelve a entrar.', fr: 'Votre session a expiré. Reconnectez-vous.' },
  'acces.compteDesactive': { es: 'Tu cuenta ha sido desactivada.', fr: 'Votre compte a été désactivé.' },
  'acces.motDePasseADefinir': {
    es: 'Primero tienes que definir una contraseña nueva.',
    fr: 'Vous devez d’abord définir un nouveau mot de passe.',
  },
  'acces.reserveGerant': {
    es: 'Esta acción está reservada al gerente del salón.',
    fr: 'Cette action est réservée au gérant du salon.',
  },
  'acces.identifiantsIncorrects': { es: 'Usuario o contraseña incorrectos.', fr: 'Identifiant ou mot de passe incorrects.' },
  'acces.compteBloque': {
    es: 'Esta cuenta está bloqueada {n} minuto más, tras varios intentos fallidos.'
      + '|Esta cuenta está bloqueada {n} minutos más, tras varios intentos fallidos.',
    fr: 'Ce compte est bloqué encore {n} minute, après plusieurs tentatives échouées.'
      + '|Ce compte est bloqué encore {n} minutes, après plusieurs tentatives échouées.',
  },
  'acces.serviceIndisponible': {
    es: 'El servicio de identificación no está disponible ahora mismo. Inténtelo en un instante.',
    fr: 'Le service d’identification n’est pas disponible pour le moment. Réessayez dans un instant.',
  },
  'acces.motDePasseCourt': {
    es: 'La contraseña nueva debe tener al menos {min} caracteres.',
    fr: 'Le nouveau mot de passe doit compter au moins {min} caractères.',
  },
  'acces.motDePasseIdentique': {
    es: 'La contraseña nueva debe ser distinta de la anterior.',
    fr: 'Le nouveau mot de passe doit être différent de l’ancien.',
  },
  'acces.motDePasseIdentiqueChamp': { es: 'Elija una contraseña distinta.', fr: 'Choisissez un mot de passe différent.' },
  'acces.motDePasseActuelFaux': { es: 'La contraseña actual no es correcta.', fr: 'Le mot de passe actuel n’est pas correct.' },
  'trace.deconnexion': { es: 'cierre de sesión', fr: 'déconnexion' },
  'trace.deconnexionDemandee': { es: 'cierre solicitado', fr: 'déconnexion demandée' },
  'trace.compteDesactive': { es: 'cuenta desactivada', fr: 'compte désactivé' },
  'trace.compteBloque': { es: 'cuenta bloqueada', fr: 'compte bloqué' },
  'trace.motDePasseChange': { es: 'contraseña cambiada', fr: 'mot de passe changé' },
  'trace.motDePasseReinitialise': { es: 'contraseña restablecida', fr: 'mot de passe réinitialisé' },

  /* ---------------------------------------------------------------- */
  /*  Comptes du personnel                                            */
  /* ---------------------------------------------------------------- */

  'compte.identifiantForme': {
    es: 'Solo letras sin acento, cifras, punto, guion y subrayado.',
    fr: 'Seulement des lettres sans accent, des chiffres, le point, le tiret et le souligné.',
  },
  'compte.motDePasseCourt': {
    es: 'La contraseña debe tener al menos {min} caracteres.',
    fr: 'Le mot de passe doit compter au moins {min} caractères.',
  },
  'compte.identifiantPris': { es: 'Ya hay una cuenta con ese usuario.', fr: 'Un compte utilise déjà cet identifiant.' },
  'compte.introuvable': { es: 'Cuenta no encontrada.', fr: 'Compte introuvable.' },
  'compte.minCaracteres': { es: 'Al menos {min} caracteres.', fr: 'Au moins {min} caractères.' },
  'compte.pasSoiMeme': {
    es: 'No puedes quitarte tus propios permisos. Pídeselo a otro gerente.',
    fr: 'Vous ne pouvez pas retirer vos propres droits. Demandez-le à un autre gérant.',
  },
  'trace.roleModifie': { es: 'rol modificado', fr: 'rôle modifié' },
  'compte.dernierGerant': {
    es: 'Esta cuenta es el último gerente activo: el salón debe conservar uno.',
    fr: 'Ce compte est le dernier gérant actif : le salon doit en garder un.',
  },

  /* ---------------------------------------------------------------- */
  /*  Reglages : refus propres a l'ecran                              */
  /* ---------------------------------------------------------------- */

  'reglages.envoiValeurs': {
    es: 'Envíe un objeto « valeurs » con los ajustes que hay que guardar.',
    fr: 'Envoyez un objet « valeurs » avec les réglages à enregistrer.',
  },
  'reglages.modeFileOccupee': {
    es: 'No se puede cambiar la organización de la fila: hay {n} cliente en la fila de hoy. Atiéndalos, o cierre la jornada, y cambie el ajuste después.'
      + '|No se puede cambiar la organización de la fila: hay {n} clientes en la fila de hoy. Atiéndalos, o cierre la jornada, y cambie el ajuste después.',
    fr: 'L’organisation de la file ne peut pas changer : {n} client est dans la file du jour. Servez-le, ou clôturez la journée, puis modifiez le réglage.'
      + '|L’organisation de la file ne peut pas changer : {n} clients sont dans la file du jour. Servez-les, ou clôturez la journée, puis modifiez le réglage.',
  },

  /* ---------------------------------------------------------------- */
  /*  Fermetures et statistiques, cote gestion                        */
  /* ---------------------------------------------------------------- */

  'admin.congesPasse': { es: 'Un periodo de cierre no se declara en el pasado.', fr: 'Une période de fermeture ne se déclare pas dans le passé.' },
  'admin.aPartirDAujourdhui': { es: 'A partir de hoy.', fr: 'À partir d’aujourd’hui.' },
  'admin.debutAvantFin': { es: 'La fecha de inicio debe ser anterior a la de fin.', fr: 'La date de début doit être antérieure à celle de fin.' },
  'admin.tarifNomRequis': { es: 'Indique el nombre del servicio.', fr: 'Indiquez le nom de la prestation.' },
  'admin.tarifPrixRequis': { es: 'Indique el precio.', fr: 'Indiquez le prix.' },
  'admin.ordreComplet': { es: 'Envíe « ids » con el orden completo.', fr: 'Envoyez « ids » avec l’ordre complet.' },
  'admin.purgeMotMajuscules': { es: 'Escribe BORRAR en mayúsculas para confirmar.', fr: 'Écrivez SUPPRIMER en majuscules pour confirmer.' },
  'admin.purgeMotExact': { es: 'Escribe exactamente BORRAR.', fr: 'Écrivez exactement SUPPRIMER.' },
  'admin.purgeMot': { es: 'BORRAR', fr: 'SUPPRIMER' },
  'admin.colDate': { es: 'Fecha', fr: 'Date' },
  'admin.colTotal': { es: 'Total', fr: 'Total' },
  'admin.colServis': { es: 'Atendidos', fr: 'Servis' },
  'admin.colAnnules': { es: 'Anulados', fr: 'Annulés' },
  'admin.colAbsence': { es: 'Con ausencia', fr: 'Avec absence' },
  'admin.colEnLigne': { es: 'Por internet', fr: 'Par internet' },
  'admin.colQr': { es: 'Por QR', fr: 'Par QR' },
  'admin.colComptoir': { es: 'En mostrador', fr: 'Au comptoir' },
  'admin.colAttenteMoyenne': { es: 'Espera media (min)', fr: 'Attente moyenne (min)' },
  'admin.colDureeMoyenne': { es: 'Duración media del corte (min)', fr: 'Durée moyenne de la coupe (min)' },
  'admin.dateDebutRequise': { es: 'La fecha de inicio es obligatoria.', fr: 'La date de début est obligatoire.' },
  'admin.dateFinRequise': { es: 'La fecha de fin es obligatoria.', fr: 'La date de fin est obligatoire.' },
  'admin.finApresDebut': { es: 'La fecha de fin debe ser posterior o igual a la de inicio.', fr: 'La date de fin doit être postérieure ou égale à celle de début.' },
  'admin.posterieurDebut': { es: 'Posterior a la fecha de inicio.', fr: 'Postérieure à la date de début.' },
  'admin.tacheInconnue': { es: 'Tarea desconocida.', fr: 'Tâche inconnue.' },
  'admin.csvNomFichier': { es: 'inicio', fr: 'debut' },
  'purge.fileNonVide': {
    es: 'Hay {n} turno todavía en la fila. Cierra la jornada antes de borrar el historial.'
      + '|Hay {n} turnos todavía en la fila. Cierra la jornada antes de borrar el historial.',
    fr: 'Il reste {n} tour dans la file. Clôturez la journée avant d’effacer l’historique.'
      + '|Il reste {n} tours dans la file. Clôturez la journée avant d’effacer l’historique.',
  },

  /* ---------------------------------------------------------------- */
  /*  Limitation de debit                                             */
  /* ---------------------------------------------------------------- */

  'debit.tropDeTours': {
    es: 'Este número ya ha pedido varios turnos hoy. El siguiente será posible {delai}.',
    fr: 'Ce numéro a déjà pris plusieurs tours aujourd’hui. Le suivant sera possible {delai}.',
  },
  'debit.tropDepuisCetteConnexion': {
    es: 'Demasiadas peticiones desde esta conexión a internet. Inténtalo de nuevo {delai}.',
    fr: 'Trop de demandes depuis cette connexion internet. Réessayez {delai}.',
  },
  'debit.appelerAussi': { es: ' También puedes llamar al salón al {telephone}.', fr: ' Vous pouvez aussi appeler le salon au {telephone}.' },
  'debit.venirAuSalon': { es: ' También puedes venir directamente al salón.', fr: ' Vous pouvez aussi passer directement au salon.' },
  // La preposition fait partie du texte : les appelants collent la phrase telle
  // quelle et n'ont pas a savoir si l'attente se dit en secondes ou en heures.
  'debit.dansSecondes': { es: 'en {n} segundo|en {n} segundos', fr: 'dans {n} seconde|dans {n} secondes' },
  'debit.dansMinutes': { es: 'en {n} minuto|en {n} minutos', fr: 'dans {n} minute|dans {n} minutes' },
  'debit.dansHeures': { es: 'en {n} hora|en {n} horas', fr: 'dans {n} heure|dans {n} heures' },
  'debit.etMinutes': { es: ' y {n} minuto| y {n} minutos', fr: ' et {n} minute| et {n} minutes' },

  /* ---------------------------------------------------------------- */
  /*  Requetes mal formees                                            */
  /* ---------------------------------------------------------------- */

  'req.jsonInvalide': { es: 'El cuerpo de la petición no es un JSON válido.', fr: 'Le corps de la requête n’est pas un JSON valide.' },
  'req.objetAttendu': { es: 'El cuerpo de la petición debe ser un objeto JSON.', fr: 'Le corps de la requête doit être un objet JSON.' },
  'req.reponseManquante': { es: 'Falta la respuesta del servidor.', fr: 'La réponse du serveur est absente.' },
  'req.entierAttendu': { es: '« {champ} » debe ser un número entero.', fr: '« {champ} » doit être un nombre entier.' },
  'req.entre': { es: '« {champ} » debe estar entre {min} y {max}.', fr: '« {champ} » doit être compris entre {min} et {max}.' },
  'req.identifiantAttendu': { es: '« {champ} » no es un identificador válido.', fr: '« {champ} » n’est pas un identifiant valide.' },
  'req.dateAttendue': { es: '« {champ} » debe ser una fecha con formato AAAA-MM-DD.', fr: '« {champ} » doit être une date au format AAAA-MM-JJ.' },
  'req.dateForme': { es: 'Se espera una fecha: AAAA-MM-DD.', fr: 'Une date est attendue : AAAA-MM-JJ.' },
  'req.lienPerime': { es: 'Este enlace de seguimiento ya no sirve.', fr: 'Ce lien de suivi ne fonctionne plus.' },

  /* ---------------------------------------------------------------- */
  /*  Les statuts, tels qu'ils se lisent                              */
  /* ---------------------------------------------------------------- */

  'statut.WAITING': { es: 'Esperando', fr: 'En attente' },
  'statut.LATE': { es: 'Esperando (ya estuvo ausente)', fr: 'En attente (déjà absent une fois)' },
  'statut.CALLED': { es: 'Llamado', fr: 'Appelé' },
  'statut.IN_SERVICE': { es: 'En el sillón', fr: 'Au fauteuil' },
  'statut.COMPLETED': { es: 'Atendido', fr: 'Servi' },
  'statut.CANCELLED': { es: 'Anulado', fr: 'Annulé' },
  'statut.NO_SHOW': { es: 'Ausente', fr: 'Absent' },

  /* ---------------------------------------------------------------- */
  /*  Les roles                                                       */
  /* ---------------------------------------------------------------- */

  'role.COIFFEUR.libelle': { es: 'Peluquero', fr: 'Coiffeur' },
  'role.COIFFEUR.description': {
    es: 'Lleva la fila del día: llamar, atender, marcar ausente, anular.',
    fr: 'Tient la file du jour : appeler, servir, marquer absent, annuler.',
  },
  'role.GERANT.libelle': { es: 'Gerente', fr: 'Gérant' },
  'role.GERANT.description': {
    es: 'Todo lo que hace el peluquero, más los ajustes, las cuentas y el historial.',
    fr: 'Tout ce que fait le coiffeur, plus les réglages, les comptes et l’historique.',
  },

  /* ---------------------------------------------------------------- */
  /*  Validation des saisies                                          */
  /* ---------------------------------------------------------------- */

  'valid.requis': { es: 'Este dato es obligatorio.', fr: 'Ce champ est obligatoire.' },
  'valid.whatsappRequis': {
    es: 'Tu número de WhatsApp es obligatorio: es donde recibirás tu enlace de seguimiento.',
    fr: 'Votre numéro WhatsApp est obligatoire : c’est là que vous recevrez votre lien de suivi.',
  },
  'valid.whatsappInvalide': {
    es: 'Número de WhatsApp no válido. Ejemplo: {exemple}, o +{indicatif} {exemple} desde el extranjero.',
    fr: 'Numéro WhatsApp invalide. Exemple : {exemple}, ou +{indicatif} {exemple} depuis l’étranger.',
  },
  'valid.tropLong': { es: 'Este dato no puede pasar de {max} caracteres.', fr: 'Ce champ ne peut pas dépasser {max} caractères.' },
  'valid.prenomRequis': { es: 'Tu nombre es obligatorio.', fr: 'Votre prénom est obligatoire.' },
  'valid.nomRequis': { es: 'Tu apellido es obligatorio.', fr: 'Votre nom est obligatoire.' },
  'valid.texteAttendu': { es: 'Se espera un texto.', fr: 'Un texte est attendu.' },
  'valid.numeroAttendu': { es: 'Se espera un número.', fr: 'Un numéro est attendu.' },
  'valid.nomMin': { es: 'Este campo debe tener al menos {min} caracteres.', fr: 'Ce champ doit compter au moins {min} caractères.' },
  'valid.nomMax': { es: 'Este campo no puede pasar de {max} caracteres.', fr: 'Ce champ ne peut pas dépasser {max} caractères.' },
  'valid.nomLettres': {
    es: 'Solo se aceptan letras, espacio, apóstrofo y guion.',
    fr: 'Seules les lettres, l’espace, l’apostrophe et le tiret sont acceptés.',
  },
  'valid.intMin': { es: 'El valor debe ser mayor o igual que {min}.', fr: 'La valeur doit être supérieure ou égale à {min}.' },
  'valid.intMax': { es: 'El valor debe ser menor o igual que {max}.', fr: 'La valeur doit être inférieure ou égale à {max}.' },
  'valid.identifiant': { es: 'Identificador no válido.', fr: 'Identifiant invalide.' },
  'valid.dateInvalide': { es: 'Fecha no válida. Formato esperado: AAAA-MM-DD', fr: 'Date invalide. Format attendu : AAAA-MM-JJ' },
  'valid.dateMin': { es: 'La fecha no puede ser anterior al {min}.', fr: 'La date ne peut pas être antérieure au {min}.' },
  'valid.dateMax': { es: 'La fecha no puede ser posterior al {max}.', fr: 'La date ne peut pas être postérieure au {max}.' },
  'valid.heureInvalide': { es: 'Hora no válida. Formato esperado: HH:MM', fr: 'Heure invalide. Format attendu : HH:MM' },
  'valid.urlProtocole': {
    es: 'La dirección debe empezar por http:// o https://',
    fr: 'L’adresse doit commencer par http:// ou https://',
  },
  'valid.listeAttendue': { es: 'Se espera una lista.', fr: 'Une liste est attendue.' },
  'valid.listeMin': { es: 'Se requiere(n) al menos {min} elemento(s).', fr: 'Au moins {min} élément(s) sont attendus.' },
  'valid.listeMax': { es: 'No se permiten más de {max} elemento(s).', fr: 'Pas plus de {max} élément(s).' },
  'valid.objetAttendu': { es: 'Se espera un objeto.', fr: 'Un objet est attendu.' },
  'valid.formatInvalide': { es: 'El formato no es válido.', fr: 'Le format n’est pas valide.' },
  'valid.texteMin': { es: 'Este texto debe tener al menos {min} caracteres.', fr: 'Ce texte doit compter au moins {min} caractères.' },
  'valid.texteMax': { es: 'Este texto no puede pasar de {max} caracteres.', fr: 'Ce texte ne peut pas dépasser {max} caractères.' },
  'valid.reglageInconnu': { es: 'Ajuste desconocido.', fr: 'Réglage inconnu.' },
  'valid.valeurAttendue': { es: 'Se espera un valor.', fr: 'Une valeur est attendue.' },
  'valid.entierAttendu': { es: 'Se espera un número entero.', fr: 'Un nombre entier est attendu.' },
  'valid.minimum': { es: 'Como mínimo {min}.', fr: 'Au minimum {min}.' },
  'valid.maximum': { es: 'Como máximo {max}.', fr: 'Au maximum {max}.' },
  'valid.ouiNon': { es: 'Se espera sí o no.', fr: 'Une valeur oui/non est attendue.' },
  'valid.heure': { es: 'Se espera una hora con el formato HH:MM.', fr: 'Une heure au format HH:MM est attendue.' },
  'valid.choix': { es: 'Valor esperado entre: {valeurs}.', fr: 'Valeur attendue parmi : {valeurs}.' },
  'valid.url': {
    es: 'Dirección no válida. Ejemplo: https://file.peluqueria-haron.com',
    fr: 'Adresse invalide. Exemple : https://file.peluqueria-haron.com',
  },
  'valid.urlTropLongue': { es: 'Dirección demasiado larga.', fr: 'Adresse trop longue.' },
  'valid.coordonnees': {
    es: 'Se esperan dos números con punto decimal, separados por una coma. Ejemplo: 40.416775, -3.703790',
    fr: 'Deux nombres à point décimal, séparés par une virgule, sont attendus. Exemple : 40.416775, -3.703790',
  },
  'valid.telephone': { es: 'Número no válido.', fr: 'Numéro invalide.' },
  'valid.telephoneTropLong': { es: 'Número demasiado largo.', fr: 'Numéro trop long.' },
  'valid.texteTropLong': { es: 'Este texto no puede pasar de {max} caracteres.', fr: 'Ce texte ne peut pas dépasser {max} caractères.' },
  'valid.fermetureApresOuverture': {
    es: 'El cierre debe ser posterior a la apertura ({jour}).',
    fr: 'La fermeture doit être postérieure à l’ouverture ({jour}).',
  },
  'valid.pauseDeuxHeures': {
    es: 'El descanso necesita las dos horas: cuándo empieza y cuándo se vuelve a abrir ({jour}).',
    fr: 'La pause demande les deux heures : quand elle commence et quand on rouvre ({jour}).',
  },
  'valid.pauseFinApresDebut': {
    es: 'La reapertura debe ser posterior al inicio del descanso ({jour}).',
    fr: 'La réouverture doit être postérieure au début de la pause ({jour}).',
  },
  'valid.pauseDansJournee': {
    es: 'El descanso tiene que caer dentro del horario del día, entre {ouverture} y {fermeture} ({jour}).',
    fr: 'La pause doit tomber dans les horaires du jour, entre {ouverture} et {fermeture} ({jour}).',
  },

  /* ---------------------------------------------------------------- */
  /*  La fiche de prix                                                */
  /* ---------------------------------------------------------------- */

  'tarifa.nomRequis': { es: 'Indique el nombre del servicio.', fr: 'Indiquez le nom de la prestation.' },
  'tarifa.nomTropLong': { es: 'El nombre del servicio no puede pasar de {max} caracteres.', fr: 'Le nom de la prestation ne peut pas dépasser {max} caractères.' },
  'tarifa.notaTropLongue': { es: 'La nota no puede pasar de {max} caracteres.', fr: 'La note ne peut pas dépasser {max} caractères.' },
  'tarifa.prixInvalide': { es: 'Escriba un precio como « {exemple1} » o « {exemple2} ».', fr: 'Écrivez un prix comme « {exemple1} » ou « {exemple2} ».' },
  'tarifa.dupliquee': { es: 'Ya existe un servicio con ese nombre.', fr: 'Une prestation porte déjà ce nom.' },
  'tarifa.introuvable': { es: 'Servicio no encontrado.', fr: 'Prestation introuvable.' },
  'tarifa.ordreIncomplet': { es: 'Envíe el orden completo de la lista.', fr: 'Envoyez l’ordre complet de la liste.' },
  'tarifa.ordreRepete': { es: 'La lista enviada repite un servicio.', fr: 'La liste envoyée répète une prestation.' },
  'tarifa.listeDesyncro': {
    es: 'La lista ha cambiado mientras la reordenabas. Recarga la página e inténtalo de nuevo.',
    fr: 'La liste a changé pendant que vous la réordonniez. Rechargez la page et recommencez.',
  },
  'tarifa.sensInvalide': { es: 'Sentido no válido.', fr: 'Sens invalide.' },
  'tarifa.dureeEntiere': { es: 'Indique los minutos, en números enteros.', fr: 'Indiquez les minutes, en nombres entiers.' },
  'tarifa.dureeBornes': { es: 'Entre {min} y {max} minutos.', fr: 'Entre {min} et {max} minutes.' },
  'tarifa.prixDeraisonnable': { es: 'El precio está fuera de lo razonable.', fr: 'Le prix sort du raisonnable.' },

  /* ---------------------------------------------------------------- */
  /*  Duree d'attente, dite a quelqu'un qui attend                    */
  /* ---------------------------------------------------------------- */

  'duree.quelquesMinutes': { es: 'unos minutos', fr: 'quelques minutes' },
  'duree.minutes': { es: '{n} minuto|{n} minutos', fr: '{n} minute|{n} minutes' },
  'duree.heures': { es: '{h} h', fr: '{h} h' },
  'duree.heuresMinutes': { es: '{h} h {m}', fr: '{h} h {m}' },
  // L'espagnol accorde « unos / unas » avec ce qui suit et change de tournure
  // au-dela de l'heure ; le francais se contente d'« environ » dans les deux
  // cas. C'est pour cela qu'il y a deux cles et non une seule.
  'duree.environMinutes': { es: 'unos {duree}', fr: 'environ {duree}' },
  'duree.environHeures': { es: 'alrededor de {duree}', fr: 'environ {duree}' },
  'duree.maintenant': { es: 'ahora mismo', fr: 'tout de suite' },
  'duree.min': { es: '{n} min', fr: '{n} min' },

  /* ---------------------------------------------------------------- */
  /*  Dates                                                           */
  /* ---------------------------------------------------------------- */

  'date.alors': { es: '{date} a las {heure}', fr: '{date} à {heure}' },
  'date.longue': { es: '{jour} {n} de {mois} de {annee}', fr: '{jour} {n} {mois} {annee}' },

  /* ---------------------------------------------------------------- */
  /*  Les jours et les mois                                           */
  /* ---------------------------------------------------------------- */

  'jour.0': { es: 'domingo', fr: 'dimanche' },
  'jour.1': { es: 'lunes', fr: 'lundi' },
  'jour.2': { es: 'martes', fr: 'mardi' },
  'jour.3': { es: 'miércoles', fr: 'mercredi' },
  'jour.4': { es: 'jueves', fr: 'jeudi' },
  'jour.5': { es: 'viernes', fr: 'vendredi' },
  'jour.6': { es: 'sábado', fr: 'samedi' },

  'mois.1': { es: 'enero', fr: 'janvier' },
  'mois.2': { es: 'febrero', fr: 'février' },
  'mois.3': { es: 'marzo', fr: 'mars' },
  'mois.4': { es: 'abril', fr: 'avril' },
  'mois.5': { es: 'mayo', fr: 'mai' },
  'mois.6': { es: 'junio', fr: 'juin' },
  'mois.7': { es: 'julio', fr: 'juillet' },
  'mois.8': { es: 'agosto', fr: 'août' },
  'mois.9': { es: 'septiembre', fr: 'septembre' },
  'mois.10': { es: 'octubre', fr: 'octobre' },
  'mois.11': { es: 'noviembre', fr: 'novembre' },
  'mois.12': { es: 'diciembre', fr: 'décembre' },

  /* ---------------------------------------------------------------- */
  /*  L'identite du salon : la langue, la monnaie, le pays            */
  /* ---------------------------------------------------------------- */

  'reglage.salon.idioma.libelle': { es: 'Idioma del salón', fr: 'Langue du salon' },
  'reglage.salon.idioma.aide': {
    es: 'La lengua de TODO: la vitrina, la pantalla, los mensajes y esta pantalla de ajustes. '
      + 'No traduce lo que has escrito tú — el nombre del salón, la frase de inicio y los nombres de los servicios se quedan tal cual.',
    fr: 'La langue de TOUT : la vitrine, l’écran du salon, les messages et cet écran de réglages. '
      + 'Elle ne traduit pas ce que vous avez écrit vous-même — le nom du salon, la phrase d’accueil et les noms des prestations restent tels quels.',
  },
  'reglage.salon.moneda.libelle': { es: 'Moneda', fr: 'Monnaie' },
  'reglage.salon.moneda.aide': {
    es: 'Cambia el símbolo de los precios, NADA MÁS. Los importes ya guardados no se convierten: '
      + '« 15 € » pasa a ser « 15 DH ». Si cambias de moneda, repasa la lista de tarifas.',
    fr: 'Change le symbole des prix, RIEN D’AUTRE. Les montants déjà saisis ne sont pas convertis : '
      + '« 15 € » devient « 15 DH ». Si vous changez de monnaie, reprenez la liste des tarifs.',
  },

  /* ---------------------------------------------------------------- */
  /*  Les reglages du salon                                           */
  /* ---------------------------------------------------------------- */

  'reglage.salon.nom.libelle': { es: 'Nombre del salón', fr: 'Nom du salon' },
  'reglage.salon.nom.aide': {
    es: 'Aparece en la cabecera de todas las páginas y en los mensajes de WhatsApp.',
    fr: 'Apparaît dans l’en-tête de toutes les pages et dans les messages WhatsApp.',
  },
  'reglage.salon.accroche.libelle': { es: 'Frase de la página de inicio', fr: 'Phrase de la page d’accueil' },
  'reglage.salon.accroche.defaut': { es: 'Pide tu turno sin esperar de pie.', fr: 'Prenez votre tour sans attendre debout.' },
  'reglage.salon.adresse.libelle': { es: 'Dirección del salón', fr: 'Adresse du salon' },
  'reglage.salon.adresse.aide': {
    es: 'Aparece en la sección Contacto de la página de inicio, con enlace al mapa, y en la página de seguimiento.',
    fr: 'Apparaît dans la section Contact de la page d’accueil, avec un lien vers la carte, et sur la page de suivi.',
  },
  'reglage.salon.telephone.libelle': { es: 'Teléfono del salón', fr: 'Téléphone du salon' },
  'reglage.salon.telephone.aide': {
    es: 'Aparece en la sección Contacto de la página de inicio y se ofrece al cliente cuando no se pueden pedir turnos por internet.',
    fr: 'Apparaît dans la section Contact de la page d’accueil et est proposé au client quand les tours ne peuvent pas être pris par internet.',
  },
  'reglage.salon.whatsapp.libelle': { es: 'WhatsApp del salón', fr: 'WhatsApp du salon' },
  'reglage.salon.whatsapp.aide': {
    es: 'Número desde el que salen los mensajes. Aparece en la sección Contacto, con enlace directo a la conversación.',
    fr: 'Numéro depuis lequel partent les messages. Apparaît dans la section Contact, avec un lien direct vers la conversation.',
  },
  'reglage.salon.coordenadas.libelle': { es: 'Coordenadas del salón (latitud, longitud)', fr: 'Coordonnées du salon (latitude, longitude)' },
  'reglage.salon.coordenadas.aide': {
    es: 'En Google Maps: pulsación larga sobre la puerta del salón y se copian « 40.416775, -3.703790 ». '
      + 'Con ellas, el botón « Cómo llegar » lleva a la puerta y no a mitad de la calle.',
    fr: 'Sur Google Maps : appui long sur la porte du salon, puis on copie « 40.416775, -3.703790 ». '
      + 'Avec elles, le bouton « Itinéraire » mène à la porte et non au milieu de la rue.',
  },
  'reglage.salon.comoLlegar.libelle': { es: 'Cómo llegar', fr: 'Comment venir' },
  'reglage.salon.comoLlegar.aide': {
    es: 'Referencias, transporte y aparcamiento. Por ejemplo: « Frente a la farmacia, metro Sol a 3 minutos, aparcamiento en la plaza. »',
    fr: 'Repères, transports et stationnement. Par exemple : « Face à la pharmacie, tramway à 3 minutes, parking sur la place. »',
  },

  'reglage.file.dureeMoyenneMinutes.libelle': { es: 'Duración media de un corte (minutos)', fr: 'Durée moyenne d’une coupe (minutes)' },
  'reglage.file.dureeMoyenneMinutes.aide': {
    es: 'Sirve para estimar la espera. Se puede cambiar en cualquier momento; el día en curso conserva el valor de la mañana.',
    fr: 'Sert à estimer l’attente. Modifiable à tout moment ; la journée en cours conserve la valeur du matin.',
  },
  'reglage.file.seuilPrevenir.libelle': {
    es: 'Avisar al cliente cuando le queden N personas delante',
    fr: 'Prévenir le client quand il ne reste que N personnes devant lui',
  },
  'reglage.file.seuilPrevenir.aide': {
    es: 'Por debajo de este umbral, el cliente ve « tu turno se acerca » y recibe un mensaje de WhatsApp.',
    fr: 'Sous ce seuil, le client voit « votre tour approche » et reçoit un message WhatsApp.',
  },
  'reglage.file.mode.libelle': { es: 'Organización de la fila', fr: 'Organisation de la file' },
  'reglage.file.mode.aide': {
    es: 'Una sola fila: el cliente pide turno y le atiende el primer peluquero libre. '
      + 'Una fila por peluquero: el cliente elige el suyo y espera en SU fila. '
      + 'Solo se puede cambiar con la fila vacía.',
    fr: 'File unique : le client prend son tour et le premier coiffeur libre le sert. '
      + 'Une file par coiffeur : le client choisit le sien et attend dans SA file. '
      + 'Modifiable seulement quand la file est vide.',
  },
  'reglage.file.mode.UNIQUE': { es: 'Una sola fila para todo el salón', fr: 'Une seule file pour tout le salon' },
  'reglage.file.mode.PAR_FAUTEUIL': { es: 'Una fila por peluquero', fr: 'Une file par coiffeur' },
  'reglage.file.priseDeTourOuverte.libelle': { es: 'Aceptar nuevos turnos', fr: 'Accepter de nouveaux tours' },
  'reglage.file.priseDeTourOuverte.aide': {
    es: 'Desmarque para dejar de dar turnos sin tocar la fila en curso: quien espera será atendido, pero nadie nuevo entra.',
    fr: 'Décochez pour arrêter de donner des tours sans toucher à la file en cours : ceux qui attendent seront servis, mais personne de nouveau n’entre.',
  },
  'reglage.file.messagePause.libelle': { es: 'Mensaje cuando no se dan turnos', fr: 'Message quand les tours sont suspendus' },
  'reglage.file.messagePause.aide': {
    es: 'Por ejemplo: « Esta tarde ya no damos más turnos, mañana a las 9:30. » Si lo deja vacío se usa un mensaje predeterminado.',
    fr: 'Par exemple : « Plus de tours cet après-midi, demain à 9h30. » Laissé vide, un message par défaut est utilisé.',
  },
  'reglage.file.maxParJour.libelle': { es: 'Número máximo de turnos por día', fr: 'Nombre maximum de tours par jour' },
  'reglage.file.maxParJour.aide': {
    es: 'Tope de seguridad: por encima, no se aceptan más turnos por internet y se explica al cliente.',
    fr: 'Garde-fou : au-delà, les tours par internet ne sont plus acceptés et c’est expliqué au client.',
  },

  'reglage.horaires.actifs.libelle': { es: 'No dar turnos fuera del horario', fr: 'Ne pas donner de tours en dehors des horaires' },
  'reglage.horaires.actifs.aide': {
    es: 'Desactivado, el cliente puede pedir turno a cualquier hora.',
    fr: 'Désactivé, le client peut prendre un tour à n’importe quelle heure.',
  },
  'reglage.horaires.ouverture': { es: 'Apertura {jour}', fr: 'Ouverture {jour}' },
  'reglage.horaires.fermeture': { es: 'Cierre {jour}', fr: 'Fermeture {jour}' },
  'reglage.horaires.pauseDebut': { es: 'Empieza el descanso {jour}', fr: 'Début de la pause {jour}' },
  'reglage.horaires.pauseFin': { es: 'Vuelve a abrir {jour}', fr: 'Réouverture {jour}' },
  'reglage.horaires.pauseAide': {
    es: 'Si el salón cierra a mediodía, pon aquí las dos horas. Durante el descanso no se pueden pedir turnos, '
      + 'y el horario se muestra en dos tramos: 10:00 – 14:00 · 17:00 – 20:30. Déjalo vacío si la jornada es seguida.',
    fr: 'Si le salon ferme à midi, mettez ici les deux heures. Pendant la pause, aucun tour ne peut être pris, '
      + 'et les horaires s’affichent en deux tranches : 10:00 – 14:00 · 17:00 – 20:30. Laissez vide si la journée est continue.',
  },

  'reglage.tarifas.visible.libelle': { es: 'Mostrar las tarifas en la página de inicio', fr: 'Afficher les tarifs sur la page d’accueil' },
  'reglage.tarifas.visible.aide': {
    es: 'Desactívelo si prefiere no publicar los precios.',
    fr: 'Désactivez-le si vous préférez ne pas publier les prix.',
  },
  'reglage.tarifas.nota.libelle': { es: 'Nota debajo de las tarifas', fr: 'Note sous les tarifs' },
  'reglage.tarifas.nota.aide': {
    es: 'Por ejemplo: « Efectivo y tarjeta. » Se deja vacío si no hace falta.',
    fr: 'Par exemple : « Espèces et carte. » À laisser vide si ce n’est pas utile.',
  },

  'reglage.pantalla.nombres.libelle': { es: 'Qué se muestra en la pantalla del salón', fr: 'Ce qui s’affiche sur l’écran du salon' },
  'reglage.pantalla.nombres.aide': {
    es: 'Si la pantalla se ve desde la calle, deje solo los números. Con « nombre y apellido », la pantalla pasa a estar '
      + 'protegida por una clave en su dirección: solo se abre desde el aparato donde la haya puesto.',
    fr: 'Si l’écran est visible de la rue, n’affichez que les numéros. Avec « nom et prénom », l’écran devient '
      + 'protégé par une clé dans son adresse : il ne s’ouvre que depuis l’appareil où vous l’avez saisie.',
  },
  'reglage.pantalla.nombres.NINGUNO': { es: 'Solo los números de turno', fr: 'Uniquement les numéros de tour' },
  'reglage.pantalla.nombres.NOMBRE': { es: 'Número y nombre de pila', fr: 'Numéro et prénom' },
  'reglage.pantalla.nombres.COMPLETO': { es: 'Número, nombre y apellido', fr: 'Numéro, prénom et nom' },
  'reglage.pantalla.clave.libelle': { es: 'Clave de la pantalla', fr: 'Clé de l’écran' },
  'reglage.pantalla.clave.aide': {
    es: 'Vacía, la pantalla se abre en /pantalla sin más. Rellena, hace falta /pantalla?k=… — es la dirección que hay '
      + 'que poner en el televisor. Se genera sola al elegir « nombre y apellido ».',
    fr: 'Vide, l’écran s’ouvre sur /pantalla sans plus. Remplie, il faut /pantalla?k=… — c’est l’adresse à saisir '
      + 'sur le téléviseur. Elle se génère toute seule quand on choisit « nom et prénom ».',
  },

  /* ---------------------------------------------------------------- */
  /*  Ce qui vient de l'environnement, et sa coherence                */
  /* ---------------------------------------------------------------- */

  'identite.titre': { es: 'Identidad del salón', fr: 'Identité du salon' },
  'identite.serveurTitre': { es: 'Lo que viene del servidor', fr: 'Ce qui vient du serveur' },
  'identite.fuseau': { es: 'Zona horaria', fr: 'Fuseau horaire' },
  'identite.indicatif': { es: 'Prefijo telefónico', fr: 'Indicatif téléphonique' },
  'identite.whatsappLangue': { es: 'Idioma de las plantillas de WhatsApp', fr: 'Langue des modèles WhatsApp' },
  'identite.envNote': {
    es: 'Estos tres valores NO se cambian aquí, sino en el archivo .env del servidor '
      + '(APP_TIMEZONE, TELEPHONE_INDICATIF_DEFAUT, WHATSAPP_LANGUE). La zona horaria decide qué día es « hoy » '
      + 'para la fila: cambiarla a media tarde movería la jornada en curso y la fila de hoy parecería vacía. '
      + 'No es un ajuste de pantalla, es una decisión de instalación.',
    fr: 'Ces trois valeurs ne se changent PAS ici, mais dans le fichier .env du serveur '
      + '(APP_TIMEZONE, TELEPHONE_INDICATIF_DEFAUT, WHATSAPP_LANGUE). Le fuseau décide de ce qu’est « aujourd’hui » '
      + 'pour la file : le changer en milieu d’après-midi déplacerait la journée en cours et la file du jour '
      + 'paraîtrait vide. Ce n’est pas un réglage d’écran, c’est une décision d’installation.',
  },
  'identite.coherenceOk': {
    es: 'La zona horaria y el prefijo concuerdan con la moneda elegida.',
    fr: 'Le fuseau et l’indicatif concordent avec la monnaie choisie.',
  },
  'identite.fuseauIncoherent': {
    es: 'Moneda {devise} pero zona horaria {actuel}: se esperaba {attendu}. Mientras no se corrija, la fila '
      + 'cambiará de día a la hora equivocada.',
    fr: 'Monnaie {devise} mais fuseau {actuel} : on attendait {attendu}. Tant que ce n’est pas corrigé, la file '
      + 'changera de jour à la mauvaise heure.',
  },
  'identite.indicatifIncoherent': {
    es: 'Moneda {devise} pero prefijo +{actuel}: se esperaba +{attendu}. Los números escritos sin « + » se '
      + 'guardarán con el prefijo equivocado y los mensajes no llegarán.',
    fr: 'Monnaie {devise} mais indicatif +{actuel} : on attendait +{attendu}. Les numéros saisis sans « + » '
      + 'seront enregistrés avec le mauvais indicatif et les messages n’arriveront pas.',
  },
  'identite.whatsappIncoherent': {
    es: 'El salón habla {langue} pero las plantillas de WhatsApp se piden en « {actuel} ». Meta rechaza el envío '
      + 'si la plantilla no existe en ese idioma.',
    fr: 'Le salon parle {langue} mais les modèles WhatsApp sont demandés en « {actuel} ». Meta refuse l’envoi '
      + 'si le modèle n’existe pas dans cette langue.',
  },

  'reglage.public.url.libelle': { es: 'Dirección pública del salón', fr: 'Adresse publique du salon' },
  'reglage.public.url.aide': {
    es: 'Es la que codifica el código QR del escaparate. Déjelo vacío para usar PUBLIC_URL.',
    fr: 'C’est celle qu’encode le code QR de la vitrine. Laissez vide pour utiliser PUBLIC_URL.',
  },
};
