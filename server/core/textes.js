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

  'pied.devise': { es: 'Gracias por tu confianza.', fr: 'Merci de votre confiance.' },
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

  'accueil.titre': { es: '{nom} — {metier}', fr: '{nom} — {metier}' },
  'accueil.description': {
es: '{nom}: servicios, tarifas y reserva en línea. Elige tu hora o pide turno desde el móvil, sin cuenta y sin instalar nada.',
    fr: '{nom} : prestations, tarifs et réservation en ligne. Choisissez votre heure ou prenez votre tour depuis votre téléphone, sans compte et sans rien installer.',
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

  /* ---------------------------------------------------------------- */
  /*  La vitrine                                                      */
  /* ---------------------------------------------------------------- */

  'vt.nav.aria': { es: 'Secciones de la página', fr: 'Sections de la page' },
  'vt.nav.tarifs': { es: 'Tarifas', fr: 'Tarifs' },
  'vt.nav.galerie': { es: 'Galería', fr: 'Galerie' },
  'vt.nav.reserver': { es: 'Reservar', fr: 'Réserver' },
  'vt.nav.contact': { es: 'Contacto', fr: 'Contact' },

  'vt.etat.ouvert': { es: 'Abierto ahora', fr: 'Ouvert maintenant' },
  'vt.etat.ouvertJusqua': { es: 'Abierto · hasta las {heure}', fr: 'Ouvert · jusqu’à {heure}' },
  'vt.etat.pause': { es: 'Cerrado · reabre a las {heure}', fr: 'Fermé · rouvre à {heure}' },
  'vt.etat.ouvreA': { es: 'Cerrado · abre a las {heure}', fr: 'Fermé · ouvre à {heure}' },
  'vt.etat.fermeAujourdhui': { es: 'Cerrado hoy', fr: 'Fermé aujourd’hui' },
  'vt.etat.conges': { es: 'Cerrado por vacaciones', fr: 'Fermé pour congés' },

  'vt.une.surtitre': { es: 'Barbería & peluquería', fr: 'Barbier & coiffure' },
  'vt.une.reserver': { es: 'Reservar mi turno', fr: 'Réserver mon tour' },
  'vt.une.tarifs': { es: 'Ver las tarifas', fr: 'Voir les tarifs' },
  'vt.atout.compte': { es: 'Sin cuenta, sin aplicación', fr: 'Sans compte, sans application' },
  'vt.atout.direct': { es: 'Tu posición en directo', fr: 'Votre position en direct' },
  'vt.atout.duree': { es: 'Espera calculada según tus servicios', fr: 'Attente calculée selon vos prestations' },

  'vt.infos.aria': { es: 'Información práctica', fr: 'Informations pratiques' },
  'vt.infos.aujourdhui': { es: 'Hoy', fr: 'Aujourd’hui' },
  'vt.infos.adresse': { es: 'Dirección', fr: 'Adresse' },
  'vt.infos.telephone': { es: 'Teléfono', fr: 'Téléphone' },

  'vt.resa.surtitre': { es: 'Reserva', fr: 'Réservation' },
  'vt.resa.titre': { es: 'Reserva tu turno', fr: 'Réservez votre tour' },
  'vt.resa.chapo': {
    es: 'Elige tus servicios, deja tu nombre y tu número: entras en la fila al momento y sigues tu posición desde el móvil. Ven cuando te toque.',
    fr: 'Choisissez vos prestations, laissez votre nom et votre numéro : vous entrez dans la file aussitôt et suivez votre position depuis votre téléphone. Venez quand c’est votre tour.',
  },

  'vt.galerie.surtitre': { es: 'La casa', fr: 'La maison' },
  'vt.galerie.photo': { es: 'Foto {n} del salón', fr: 'Photo {n} du salon' },
  'vt.galerie.visionneuse': { es: 'Foto ampliada', fr: 'Photo agrandie' },
  'vt.galerie.fermer': { es: 'Cerrar', fr: 'Fermer' },
  'vt.galerie.precedente': { es: 'Foto anterior', fr: 'Photo précédente' },
  'vt.galerie.suivante': { es: 'Foto siguiente', fr: 'Photo suivante' },

  'vt.lieu.surtitre': { es: 'Visítanos', fr: 'Nous rendre visite' },
  'vt.lieu.titre': { es: 'Dónde estamos', fr: 'Où nous trouver' },
  'vt.lieu.afficherCarte': { es: 'Ver el mapa', fr: 'Afficher la carte' },
  // La phrase dit POURQUOI la carte attend un clic : sans elle, le bouton a
  // l'air d'un defaut de chargement.
  'vt.lieu.noteCarte': {
    es: 'El mapa lo sirve OpenStreetMap: se carga solo si lo pides.',
    fr: 'La carte est servie par OpenStreetMap : elle ne se charge que si vous le demandez.',
  },
  'vt.lieu.titreCarte': { es: 'Mapa: ubicación del salón', fr: 'Carte : emplacement du salon' },

  'tarifs.medaillon': { es: 'Servicio y estilo', fr: 'Service & style' },
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
  'file.dejaUnTourPublic': {
    es: 'Ya hay un turno en curso para este número. Búscalo en tu enlace de seguimiento, o pídelo en el salón.',
    fr: 'Un tour est déjà en cours pour ce numéro. Retrouvez-le avec votre lien de suivi, ou demandez-le au salon.',
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
  'acces.reserveSuperAdmin': {
    es: 'Esta acción está reservada al administrador de la plataforma.',
    fr: 'Cette action est réservée à l’administrateur de la plateforme.',
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
  'req.tropGros': { es: 'El contenido enviado supera el límite permitido.', fr: 'Le contenu envoyé dépasse la limite permise.' },
  'req.interrompue': { es: 'El envío se ha interrumpido. Inténtalo de nuevo.', fr: 'L’envoi a été interrompu. Réessayez.' },
  'req.tropProfond': { es: 'Estructura JSON demasiado profunda.', fr: 'Structure JSON trop profonde.' },
  'req.typeNonPris': { es: 'Tipo de contenido no admitido: {type}.', fr: 'Type de contenu non pris en charge : {type}.' },
  'req.listeTropLongue': { es: 'Lista demasiado larga.', fr: 'Liste trop longue.' },
  'http.tropDeConnexions': { es: 'Demasiadas conexiones. Espera unos instantes.', fr: 'Trop de connexions. Patientez quelques instants.' },
  'poste.nomRequis': { es: 'Dale un nombre al sillón.', fr: 'Donnez un nom au fauteuil.' },

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

  'role.COIFFEUR.libelle': { es: 'Profesional', fr: 'Professionnel' },
  'role.COIFFEUR.description': {
    es: 'Lleva la fila y la agenda del día: llamar, atender, recibir las citas.',
    fr: 'Tient la file et l’agenda du jour : appeler, servir, accueillir les rendez-vous.',
  },
  'role.GERANT.libelle': { es: 'Gerente', fr: 'Gérant' },
  'role.GERANT.description': {
    es: 'Todo lo que hace el profesional, más los ajustes, la carta, las cuentas y el historial.',
    fr: 'Tout ce que fait le professionnel, plus les réglages, la carte, les comptes et l’historique.',
  },
  'role.SUPERADMIN.libelle': { es: 'Administrador de la plataforma', fr: 'Administrateur de la plateforme' },
  'role.SUPERADMIN.description': {
    es: 'Todo lo que hace el gerente, más la identidad de la marca: nombre, colores, logo, actividad, idioma y moneda.',
    fr: 'Tout ce que fait le gérant, plus l’identité de la marque : nom, couleurs, logo, activité, langue et monnaie.',
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
  'reglage.salon.accroche.defaut': { es: 'Tu momento, a tu hora.', fr: 'Votre moment, à votre heure.' },
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

  'reglage.vitrine.galerie.libelle': { es: 'Mostrar la galería de fotos', fr: 'Afficher la galerie de photos' },
  'reglage.vitrine.galerie.aide': {
    es: 'Las fotos se añaden, ordenan y ocultan en la pestaña « Galería ». Desactivada, la sección desaparece de la página de inicio sin borrar ninguna foto.',
    fr: 'Les photos s’ajoutent, s’ordonnent et se masquent dans l’onglet « Galerie ». Désactivée, la section disparaît de la page d’accueil sans effacer aucune photo.',
  },
  'reglage.vitrine.localisation.libelle': { es: 'Mostrar « Cómo llegar » y el mapa', fr: 'Afficher « Comment venir » et la carte' },
  'reglage.vitrine.localisation.aide': {
    es: 'Hace falta la dirección o las coordenadas del salón (grupo « Identidad del salón »). Sin ellas, la sección no aparece aunque esté activada.',
    fr: 'Il faut l’adresse ou les coordonnées du salon (groupe « Identité du salon »). Sans elles, la section n’apparaît pas même activée.',
  },
  'reglage.vitrine.contact.libelle': { es: 'Mostrar el contacto y el horario', fr: 'Afficher le contact et les horaires' },
  'reglage.vitrine.contact.aide': {
    es: 'Teléfono, WhatsApp y horario. Cada tarjeta aparece solo si su dato está rellenado.',
    fr: 'Téléphone, WhatsApp et horaires. Chaque carte n’apparaît que si son information est remplie.',
  },
  'reglage.vitrine.etapes.libelle': { es: 'Mostrar « Cómo funciona »', fr: 'Afficher « Comment ça marche »' },
  'reglage.vitrine.etapes.aide': {
    es: 'Los tres pasos que explican la reserva por internet, en la página de inicio « en imágenes ». Se puede quitar cuando las clientas ya lo conocen.',
    fr: 'Les trois étapes qui expliquent la réservation en ligne, sur la page d’accueil « en images ». À retirer quand les clientes connaissent.',
  },

  'photos.legendeTropLongue': { es: 'La leyenda no puede pasar de {max} caracteres.', fr: 'La légende ne peut pas dépasser {max} caractères.' },
  'photos.formatRefuse': {
    es: 'Este archivo no es una foto legible. Formatos aceptados: JPEG, PNG o WebP.',
    fr: 'Ce fichier n’est pas une photo lisible. Formats acceptés : JPEG, PNG ou WebP.',
  },
  'photos.aucuneImage': { es: 'No se ha recibido ninguna imagen.', fr: 'Aucune image reçue.' },
  'photos.introuvable': { es: 'Esta foto ya no existe.', fr: 'Cette photo n’existe plus.' },
  'photos.galeriePleine': {
    es: 'La galería ya tiene {max} fotos. Borra una antes de añadir otra.',
    fr: 'La galerie compte déjà {max} photos. Supprimez-en une avant d’en ajouter une autre.',
  },
  'photos.dossierFerme': {
    es: 'El servidor no puede guardar fotos: la carpeta de fotos no admite escritura. En el servidor: sudo chown -R 1000:1000 /opt/haron/photos',
    fr: 'Le serveur ne peut pas enregistrer de photo : le dossier des photos n’est pas accessible en écriture. Sur le serveur : sudo chown -R 1000:1000 /opt/haron/photos',
  },
  'photos.ecritureImpossible': {
    es: 'La foto no se ha podido guardar en el servidor. Inténtalo de nuevo.',
    fr: 'La photo n’a pas pu être enregistrée sur le serveur. Réessayez.',
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
    es: 'La zona horaria y el prefijo se eligen en la pantalla « Marca » (superadministrador); el archivo .env del servidor '
      + 'solo da su valor de partida. El idioma de las plantillas de WhatsApp sigue en el .env (WHATSAPP_LANGUE). '
      + 'La zona horaria decide qué día es « hoy »: cámbiela con el salón cerrado, nunca a media tarde.',
    fr: 'Le fuseau et l’indicatif se choisissent dans l’écran « Marque » (super-administrateur) ; le fichier .env du serveur '
      + 'ne donne que leur valeur de départ. La langue des modèles WhatsApp reste dans le .env (WHATSAPP_LANGUE). '
      + 'Le fuseau décide de ce qu’est « aujourd’hui » : changez-le salon fermé, jamais en milieu d’après-midi.',
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

  /* ---------------------------------------------------------------- */
  /*  La marque (administrateur de la plateforme)                     */
  /* ---------------------------------------------------------------- */

  'valid.couleur': { es: 'Un color en formato #rrggbb, por ejemplo #c9a45c.', fr: 'Une couleur au format #rrggbb, par exemple #c9a45c.' },
  'reglage.salon.nom.defaut': { es: 'Mi salón', fr: 'Mon salon' },
  'reglage.pays.fuseau.libelle': { es: 'Zona horaria', fr: 'Fuseau horaire' },
  'reglage.pays.fuseau.aide': {
    es: 'Decide qué día es « hoy » y a qué hora abre el salón. Cámbiela con el salón cerrado: a media jornada, la fila de hoy parecería vacía.',
    fr: 'Décide de ce qu’est « aujourd’hui » et de l’heure d’ouverture. À changer salon fermé : en pleine journée, la file du jour paraîtrait vide.',
  },
  'reglage.pays.indicatif.libelle': { es: 'Prefijo telefónico del país', fr: 'Indicatif téléphonique du pays' },
  'reglage.pays.indicatif.aide': {
    es: 'Sin el « + »: 34 para España, 212 para Marruecos, 33 para Francia. Se añade a los números escritos sin prefijo.',
    fr: 'Sans le « + » : 212 pour le Maroc, 34 pour l’Espagne, 33 pour la France. Il s’ajoute aux numéros saisis sans indicatif.',
  },
  'reglage.marque.activite.ONGLES': { es: 'Salón de uñas', fr: 'Bar à ongles' },
  'reglage.marque.palette.CORAIL': { es: 'Coral luminoso', fr: 'Corail lumineux' },
  'reglage.marque.palette.LILAS': { es: 'Lila y ciruela', fr: 'Lilas et prune' },
  'reglage.marque.palette.NUDE': { es: 'Nude y terracota', fr: 'Nude et terracotta' },
  'reglage.marque.typographie.DOUCE': { es: 'Suave — Jost y Manrope', fr: 'Douce — Jost et Manrope' },
  'reglage.marque.accueil.libelle': { es: 'Página de inicio', fr: 'Page d’accueil' },
  'reglage.marque.accueil.aide': {
    es: '« En imágenes » pone las fotos del salón arriba del todo y la galería justo debajo. Las fotos se añaden en « Fotos ».',
    fr: '« En images » place les photos du salon tout en haut et la galerie juste dessous. Les photos s’ajoutent dans « Photos ».',
  },
  'reglage.marque.accueil.CLASSIQUE': { es: 'Clásica — centrada', fr: 'Classique — centrée' },
  'reglage.marque.accueil.IMAGES': { es: 'En imágenes — moderna', fr: 'En images — moderne' },
  'reglage.marque.activite.libelle': { es: 'Actividad', fr: 'Activité' },
  'reglage.marque.activite.aide': {
    es: 'Decide el vocabulario de la página ({pro}, {metier}) y la carta de partida que se puede aplicar.',
    fr: 'Décide du vocabulaire de la page ({pro}, {metier}) et de la carte de départ qu’on peut appliquer.',
  },
  'reglage.marque.activite.BARBERIA': { es: 'Barbería (hombre)', fr: 'Barbier (homme)' },
  'reglage.marque.activite.PELUQUERIA': { es: 'Peluquería de señoras', fr: 'Salon de coiffure (femme)' },
  'reglage.marque.activite.UNISEX': { es: 'Peluquería mixta', fr: 'Salon mixte' },
  'reglage.marque.activite.ESTETICA': { es: 'Estética y belleza', fr: 'Institut de beauté' },
  'reglage.marque.palette.libelle': { es: 'Paleta', fr: 'Palette' },
  'reglage.marque.palette.aide': {
    es: 'Los colores de toda la aplicación: escaparate, reservas, seguimiento, pantalla del salón y gestión.',
    fr: 'Les couleurs de toute l’application : vitrine, réservation, suivi, écran du salon et gestion.',
  },
  'reglage.marque.palette.ONYX': { es: 'Ónix y oro', fr: 'Onyx et or' },
  'reglage.marque.palette.IVOIRE': { es: 'Marfil y champán', fr: 'Ivoire et champagne' },
  'reglage.marque.palette.POUDRE': { es: 'Rosa empolvado', fr: 'Rose poudré' },
  'reglage.marque.palette.EMERAUDE': { es: 'Esmeralda y latón', fr: 'Émeraude et laiton' },
  'reglage.marque.palette.BORDEAUX': { es: 'Burdeos y oro rosa', fr: 'Bordeaux et or rose' },
  'reglage.marque.palette.MINUIT': { es: 'Azul noche y platino', fr: 'Bleu nuit et platine' },
  'reglage.marque.palette.PERSO': { es: 'Mis colores', fr: 'Mes couleurs' },
  'reglage.marque.couleurFond.libelle': { es: 'Color de fondo', fr: 'Couleur de fond' },
  'reglage.marque.couleurFond.aide': {
    es: 'Solo con la paleta « Mis colores ». Oscuro o claro: el resto se deduce.',
    fr: 'Seulement avec la palette « Mes couleurs ». Sombre ou clair : le reste s’en déduit.',
  },
  'reglage.marque.couleurAccent.libelle': { es: 'Color de acento', fr: 'Couleur d’accent' },
  'reglage.marque.couleurAccent.aide': {
    es: 'El metal de la casa: filetes, botones, precios. Si se lee mal como texto, se ajusta solo.',
    fr: 'Le métal de la maison : filets, boutons, prix. S’il se lit mal en texte, il s’ajuste seul.',
  },
  'reglage.marque.typographie.libelle': { es: 'Tipografía', fr: 'Typographie' },
  'reglage.marque.typographie.CLASSIQUE': { es: 'Clásica — Cormorant y Manrope', fr: 'Classique — Cormorant et Manrope' },
  'reglage.marque.typographie.PRESTIGE': { es: 'Prestigio — Marcellus y Jost', fr: 'Prestige — Marcellus et Jost' },
  'reglage.marque.typographie.MODERNE': { es: 'Moderna — Jost en versalitas', fr: 'Moderne — Jost en capitales' },
  'reglage.marque.angles.libelle': { es: 'Formas', fr: 'Formes' },
  'reglage.marque.angles.NETS': { es: 'Rectas', fr: 'Droites' },
  'reglage.marque.angles.DOUX': { es: 'Suaves', fr: 'Douces' },
  'reglage.marque.angles.ARRONDIS': { es: 'Redondeadas', fr: 'Arrondies' },
  'reglage.marque.monogramme.libelle': { es: 'Monograma', fr: 'Monogramme' },
  'reglage.marque.monogramme.aide': {
    es: 'Hasta tres letras, cuando no hay logo. Vacío: las iniciales del nombre.',
    fr: 'Jusqu’à trois lettres, quand il n’y a pas de logo. Vide : les initiales du nom.',
  },
  'reglage.salon.presentation.libelle': { es: 'Presentación de la casa', fr: 'Présentation de la maison' },
  'reglage.salon.presentation.aide': {
    es: 'Unas líneas sobre el salón, su estilo, su historia. Vacío: la sección no aparece.',
    fr: 'Quelques lignes sur le salon, son style, son histoire. Vide : la section n’apparaît pas.',
  },
  'reglage.vitrine.equipe.libelle': { es: 'Mostrar el equipo', fr: 'Afficher l’équipe' },
  'reglage.vitrine.equipe.aide': {
    es: 'Los nombres de los profesionales, tal como figuran en cada sillón.',
    fr: 'Les noms des professionnels, tels qu’ils figurent sur chaque fauteuil.',
  },
  'manifeste.gestionNom': { es: '{nom} — gestión', fr: '{nom} — gestion' },
  'manifeste.gestionCourt': { es: 'Gestión', fr: 'Gestion' },
  'manifeste.gestionDescription': { es: 'La fila, la agenda y los ajustes de {nom}.', fr: 'La file, l’agenda et les réglages de {nom}.' },
  'manifeste.raccourciRdv': { es: 'Reservar cita', fr: 'Prendre rendez-vous' },
  'manifeste.raccourciTour': { es: 'Pedir turno', fr: 'Prendre mon tour' },
  'tarifs.aPartirDe': { es: 'desde {prix}', fr: 'dès {prix}' },
  'tarifa.categorieTropLongue': { es: 'El capítulo no puede pasar de {max} caracteres.', fr: 'Le chapitre ne peut pas dépasser {max} caractères.' },

  /* ---------------------------------------------------------------- */
  /*  Cartes de depart, par activite                                  */
  /* ---------------------------------------------------------------- */

  'seed.cat.mainsSeules': { es: 'Manos', fr: 'Mains' },
  'seed.cat.gel': { es: 'Gel y nail art', fr: 'Gel et nail art' },
  'seed.cat.pieds': { es: 'Pies', fr: 'Pieds' },
  'seed.tarif.o.manucureExpress': { es: 'Manicura exprés', fr: 'Manucure express' },
  'seed.tarif.o.deposeSemi': { es: 'Retirada de semipermanente', fr: 'Dépose semi-permanent' },
  'seed.tarif.o.poseGel': { es: 'Uñas de gel — puesta completa', fr: 'Pose complète gel' },
  'seed.tarif.o.remplissage': { es: 'Relleno de gel', fr: 'Remplissage gel' },
  'seed.tarif.o.nailArt': { es: 'Nail art', fr: 'Nail art' },
  'seed.tarif.o.babyboomer': { es: 'Baby boomer', fr: 'Baby boomer' },
  'seed.tarif.o.pedicureSemi': { es: 'Pedicura con semipermanente', fr: 'Pédicure semi-permanent' },
  'seed.tarif.o.duo': { es: 'Dúo manos y pies', fr: 'Duo mains et pieds' },
  'seed.cat.coupes': { es: 'Cortes', fr: 'Coupes' },
  'seed.cat.barbe': { es: 'Barba', fr: 'Barbe' },
  'seed.cat.soins': { es: 'Cuidados', fr: 'Soins' },
  'seed.cat.couleur': { es: 'Color', fr: 'Couleur' },
  'seed.cat.coiffage': { es: 'Peinados', fr: 'Coiffage' },
  'seed.cat.evenements': { es: 'Ocasiones especiales', fr: 'Grandes occasions' },
  'seed.cat.femme': { es: 'Mujer', fr: 'Femme' },
  'seed.cat.homme': { es: 'Hombre', fr: 'Homme' },
  'seed.cat.enfant': { es: 'Niños', fr: 'Enfant' },
  'seed.cat.visage': { es: 'Rostro', fr: 'Visage' },
  'seed.cat.regard': { es: 'Mirada', fr: 'Regard' },
  'seed.cat.mains': { es: 'Manos y pies', fr: 'Mains et pieds' },
  'seed.cat.epilation': { es: 'Depilación', fr: 'Épilation' },
  'seed.cat.corps': { es: 'Cuerpo', fr: 'Corps' },
  'seed.tarif.f.coupeBrushing': { es: 'Corte y brushing', fr: 'Coupe et brushing' },
  'seed.tarif.f.coupe': { es: 'Corte', fr: 'Coupe femme' },
  'seed.tarif.f.brushing': { es: 'Brushing', fr: 'Brushing' },
  'seed.tarif.f.lisse': { es: 'Alisado con plancha', fr: 'Lissage au fer' },
  'seed.tarif.f.boucles': { es: 'Ondas y rizos', fr: 'Ondulations' },
  'seed.tarif.f.chignon': { es: 'Recogido', fr: 'Chignon' },
  'seed.tarif.f.couleur': { es: 'Coloración', fr: 'Couleur' },
  'seed.tarif.f.balayage': { es: 'Balayage', fr: 'Balayage' },
  'seed.tarif.f.gloss': { es: 'Gloss y matiz', fr: 'Gloss et patine' },
  'seed.tarif.f.soinProfond': { es: 'Tratamiento profundo', fr: 'Soin profond' },
  'seed.tarif.f.mariee': { es: 'Novia — prueba y día', fr: 'Mariée — essai et jour J' },
  'seed.tarif.h.coupe': { es: 'Corte caballero', fr: 'Coupe homme' },
  'seed.tarif.h.barbe': { es: 'Arreglo de barba', fr: 'Taille de barbe' },
  'seed.tarif.h.enfant': { es: 'Corte infantil', fr: 'Coupe enfant' },
  'seed.tarif.e.soinVisage': { es: 'Tratamiento facial completo', fr: 'Soin visage signature' },
  'seed.tarif.e.soinEclat': { es: 'Tratamiento luminosidad', fr: 'Soin éclat' },
  'seed.tarif.e.sourcils': { es: 'Diseño de cejas', fr: 'Restructuration des sourcils' },
  'seed.tarif.e.rehausse': { es: 'Lifting de pestañas', fr: 'Rehaussement de cils' },
  'seed.tarif.e.manucure': { es: 'Manicura', fr: 'Manucure' },
  'seed.tarif.e.semiPermanent': { es: 'Esmaltado semipermanente', fr: 'Vernis semi-permanent' },
  'seed.tarif.e.pedicure': { es: 'Pedicura', fr: 'Pédicure' },
  'seed.tarif.e.epilJambes': { es: 'Depilación piernas', fr: 'Épilation jambes' },
  'seed.tarif.e.massage': { es: 'Masaje relajante', fr: 'Massage relaxant' },
  'seed.tarif.e.maquillage': { es: 'Maquillaje de evento', fr: 'Maquillage événement' },

  /* ---------------------------------------------------------------- */
  /*  Rendez-vous                                                     */
  /* ---------------------------------------------------------------- */

  'rdv.choisirPrestation': { es: 'Elige al menos un servicio.', fr: 'Choisissez au moins une prestation.' },
  'rdv.heureInvalide': { es: 'Elige un día y una hora.', fr: 'Choisissez un jour et une heure.' },
  'rdv.creneauIndisponible': {
    es: 'Esta hora ya no está disponible. Elige otra.',
    fr: 'Cette heure n’est plus disponible. Choisissez-en une autre.',
  },
  'rdv.creneauPris': {
    es: 'Alguien acaba de reservar esta hora, unos segundos antes que tú. Elige otra.',
    fr: 'Quelqu’un vient de réserver cette heure, quelques secondes avant vous. Choisissez-en une autre.',
  },
  'rdv.tropDeRdv': {
    es: 'Este número ya tiene {n} cita reservada. Para otra, llama al salón.|Este número ya tiene {n} citas reservadas. Para otra, llama al salón.',
    fr: 'Ce numéro a déjà {n} rendez-vous à venir. Pour un autre, appelez le salon.|Ce numéro a déjà {n} rendez-vous à venir. Pour un autre, appelez le salon.',
  },
  'rdv.tropTardPourAnnuler': {
    es: 'Ya no se puede anular en línea a menos de {n} hora de la cita: llama al salón.|Ya no se puede anular en línea a menos de {n} horas de la cita: llama al salón.',
    fr: 'Il n’est plus possible d’annuler en ligne à moins de {n} heure du rendez-vous : appelez le salon.|Il n’est plus possible d’annuler en ligne à moins de {n} heures du rendez-vous : appelez le salon.',
  },
  'rdv.introuvable': {
    es: 'Esta cita no existe, o el enlace está incompleto.',
    fr: 'Ce rendez-vous n’existe pas, ou le lien est incomplet.',
  },
  'rdv.dejaInstalle': { es: 'Este cliente ya está en el sillón.', fr: 'Ce client est déjà au fauteuil.' },
  'rdv.arriveAujourdhuiSeulement': {
    es: 'Solo se puede recibir a un cliente el día de su cita.',
    fr: 'On n’accueille un client que le jour de son rendez-vous.',
  },
  'rdv.gesteInconnu': { es: 'Acción desconocida.', fr: 'Geste inconnu.' },
  'rdv.gesteImpossible': {
    es: 'No es posible: la cita está « {statut} ».',
    fr: 'Impossible : le rendez-vous est « {statut} ».',
  },
  'rdv.statut.CONFIRME': { es: 'Confirmada', fr: 'Confirmé' },
  'rdv.statut.ARRIVE': { es: 'En el salón', fr: 'Arrivé' },
  'rdv.statut.INSTALLE': { es: 'En el sillón', fr: 'Au fauteuil' },
  'rdv.statut.ANNULE': { es: 'Anulada', fr: 'Annulé' },
  'rdv.statut.ABSENT': { es: 'No vino', fr: 'Absent' },
  'rdv.ferme.INACTIFS': {
    es: 'El salón no toma citas en línea por ahora.',
    fr: 'Le salon ne prend pas de rendez-vous en ligne pour le moment.',
  },
  'rdv.ferme.HORAIRES': {
    es: 'El salón aún no ha publicado su horario: las citas no están abiertas.',
    fr: 'Le salon n’a pas encore publié ses horaires : les rendez-vous ne sont pas ouverts.',
  },
  'rdv.ferme.AUCUN_FAUTEUIL': {
    es: 'Ningún profesional toma citas por ahora.',
    fr: 'Aucun professionnel ne prend de rendez-vous pour le moment.',
  },
  'rdv.messageWhatsapp': {
    es: 'Hola {prenom}, te escribimos de {nom}. Aquí tienes tu cita: {lien}',
    fr: 'Bonjour {prenom}, ici {nom}. Voici votre rendez-vous : {lien}',
  },
  'debit.tropDeRdv': {
    es: 'Este número ya ha hecho varias reservas. La siguiente será posible {delai}.',
    fr: 'Ce numéro a déjà fait plusieurs réservations. La suivante sera possible {delai}.',
  },
  'trace.rdvInstalle': { es: 'Cliente con cita, instalado en {poste}.', fr: 'Client de rendez-vous, installé au {poste}.' },
  'trace.sourceRdv': { es: 'cita', fr: 'rendez-vous' },
  'push.rdvPris': { es: 'Nueva cita — {prenom}', fr: 'Nouveau rendez-vous — {prenom}' },
  'push.rdvAnnule': { es: 'Cita anulada — {prenom}', fr: 'Rendez-vous annulé — {prenom}' },

  /* ---------------------------------------------------------------- */
  /*  La vitrine de la maison                                         */
  /* ---------------------------------------------------------------- */

  'vt.nav.maison': { es: 'La casa', fr: 'La maison' },
  'vt.nav.carte': { es: 'La carta', fr: 'La carte' },
  'vt.nav.equipe': { es: 'El equipo', fr: 'L’équipe' },
  'vt.nav.menu': { es: 'Menú', fr: 'Menu' },
  'mx.une.photos': { es: 'Fotos del salón', fr: 'Photos du salon' },
  'mx.une.prochain': { es: 'Próxima hora libre', fr: 'Prochain créneau libre' },
  'mx.une.voirGalerie': { es: 'Ver la galería', fr: 'Voir la galerie' },
  'mx.galerie.surtitre': { es: 'Galería', fr: 'Galerie' },
  'mx.galerie.titre': { es: 'Nuestros trabajos', fr: 'Nos réalisations' },
  'mx.galerie.chapo': { es: 'Toque una foto para verla en grande.', fr: 'Touchez une photo pour la voir en grand.' },
  'mx.galerie.avant': { es: 'Fotos anteriores', fr: 'Photos précédentes' },
  'mx.galerie.apres': { es: 'Fotos siguientes', fr: 'Photos suivantes' },
  'mx.carte.reserver': { es: 'Reservar', fr: 'Réserver' },
  'mx.carte.reserverCe': { es: 'Reservar: {nom}', fr: 'Réserver : {nom}' },
  'mx.une.metier': { es: '{metier}', fr: '{metier}' },
  'mx.une.rdv': { es: 'Reservar cita', fr: 'Prendre rendez-vous' },
  'mx.une.tour': { es: 'Pedir turno', fr: 'Prendre mon tour' },
  'mx.une.carte': { es: 'Ver la carta', fr: 'Découvrir la carte' },
  'mx.une.defiler': { es: 'Descubrir la casa', fr: 'Découvrir la maison' },
  'reglage.marque.palette.NACRE': { es: 'Nácar y oro rosa', fr: 'Nacre et or rose' },
  'reglage.marque.palette.PRUNE': { es: 'Ciruela y oro rosa', fr: 'Prune et or rose' },
  'reglage.marque.typographie.COUTURE': { es: 'Costura — Cormorant, botones suaves', fr: 'Couture — Cormorant, boutons doux' },
  'reglage.vitrine.engagements.libelle': { es: 'Mostrar « Nuestra exigencia »', fr: 'Afficher « Notre exigence »' },
  'reglage.vitrine.engagements.aide': {
    es: 'Cuatro compromisos del salón (higiene, productos, consejo, tiempo), en la página de inicio « en imágenes ».',
    fr: 'Quatre engagements du salon (hygiène, produits, conseil, temps), sur la page d’accueil « en images ».',
  },
  'reglage.salon.engagements.libelle': { es: 'Sus compromisos', fr: 'Vos engagements' },
  'reglage.salon.engagements.aide': {
    es: 'Uno por línea, « Título : texto », cuatro como máximo. Vacío: los de su actividad. Escriba solo lo que el salón hace de verdad.',
    fr: 'Un par ligne, « Titre : texte », quatre au plus. Vide : ceux de votre activité. N’écrivez que ce que le salon fait vraiment.',
  },
  'mx.soin.surtitre': { es: 'Nuestra exigencia', fr: 'Notre exigence' },
  'mx.soin.titre': { es: 'El cuidado, hasta el último detalle', fr: 'Le soin, jusque dans le détail' },
  'mx.soin.ONGLES.1.titre': { es: 'Higiene impecable', fr: 'Hygiène irréprochable' },
  'mx.soin.ONGLES.1.texte': { es: 'Instrumentos desinfectados y limas nuevas para cada clienta.', fr: 'Instruments désinfectés et limes neuves pour chaque cliente.' },
  'mx.soin.ONGLES.2.titre': { es: 'Productos profesionales', fr: 'Produits professionnels' },
  'mx.soin.ONGLES.2.texte': { es: 'Esmaltes y geles de marcas reconocidas, elegidos por su duración y su respeto de la uña.', fr: 'Des vernis et des gels de marques reconnues, choisis pour leur tenue et le respect de l’ongle.' },
  'mx.soin.ONGLES.3.titre': { es: 'Un cuidado a medida', fr: 'Un soin sur mesure' },
  'mx.soin.ONGLES.3.texte': { es: 'Miramos sus manos, la escuchamos y le aconsejamos la forma y el color que le favorecen.', fr: 'Nous regardons vos mains, nous vous écoutons, puis nous vous conseillons la forme et la couleur qui vous vont.' },
  'mx.soin.ONGLES.4.titre': { es: 'Tiempo para usted', fr: 'Du temps pour vous' },
  'mx.soin.ONGLES.4.texte': { es: 'Una clienta a la vez: su cita es solo suya, sin prisas.', fr: 'Une cliente à la fois : votre rendez-vous vous est entièrement consacré, sans précipitation.' },
  'mx.soin.BEAUTE.1.titre': { es: 'Higiene cuidada', fr: 'Hygiène soignée' },
  'mx.soin.BEAUTE.1.texte': { es: 'Material limpio y desinfectado entre cada clienta.', fr: 'Matériel nettoyé et désinfecté entre chaque cliente.' },
  'mx.soin.BEAUTE.2.titre': { es: 'Productos profesionales', fr: 'Produits professionnels' },
  'mx.soin.BEAUTE.2.texte': { es: 'Marcas elegidas una a una, por su resultado y su suavidad.', fr: 'Des marques choisies une à une, pour leur résultat et leur douceur.' },
  'mx.soin.BEAUTE.3.titre': { es: 'Un consejo a medida', fr: 'Un conseil sur mesure' },
  'mx.soin.BEAUTE.3.texte': { es: 'Cada cita empieza por escucharla: lo que desea, lo que le favorece.', fr: 'Chaque rendez-vous commence par vous écouter : ce que vous souhaitez, ce qui vous va.' },
  'mx.soin.BEAUTE.4.titre': { es: 'Tiempo para usted', fr: 'Du temps pour vous' },
  'mx.soin.BEAUTE.4.texte': { es: 'Su cita es solo suya, sin prisas.', fr: 'Votre rendez-vous vous est entièrement consacré, sans précipitation.' },
  'mx.soin.BARBIER.1.titre': { es: 'Herramientas desinfectadas', fr: 'Outils désinfectés' },
  'mx.soin.BARBIER.1.texte': { es: 'Navajas, peines y máquinas limpios para cada cliente.', fr: 'Rasoirs, peignes et tondeuses propres pour chaque client.' },
  'mx.soin.BARBIER.2.titre': { es: 'El gesto preciso', fr: 'Le geste précis' },
  'mx.soin.BARBIER.2.texte': { es: 'Un corte limpio, un acabado a navaja, sin atajos.', fr: 'Une coupe nette, une finition au rasoir, sans raccourci.' },
  'mx.soin.BARBIER.3.titre': { es: 'Un consejo franco', fr: 'Un conseil franc' },
  'mx.soin.BARBIER.3.texte': { es: 'Le decimos lo que le queda bien, y por qué.', fr: 'On vous dit ce qui vous va, et pourquoi.' },
  'mx.soin.BARBIER.4.titre': { es: 'Su tiempo, respetado', fr: 'Votre temps respecté' },
  'mx.soin.BARBIER.4.texte': { es: 'Con cita o con turno, sabe cuándo le toca.', fr: 'Sur rendez-vous ou par la file, vous savez quand c’est à vous.' },
  'mx.rituel.surtitre': { es: 'Su visita', fr: 'Votre visite' },
  'mx.rituel.titre': { es: 'Tres gestos, y ya está', fr: 'Trois gestes, et c’est réservé' },
  'mx.rituel.1.titre': { es: 'Elija su cuidado', fr: 'Choisissez votre soin' },
  'mx.rituel.1.texte': { es: 'La carta indica la duración y el precio de cada servicio.', fr: 'La carte indique la durée et le prix de chaque prestation.' },
  'mx.rituel.2.titre': { es: 'Reserve su hora', fr: 'Réservez votre créneau' },
  'mx.rituel.2.texte': { es: 'Solo ve las horas libres de verdad. Sin cuenta, sin pago por adelantado.', fr: 'Vous ne voyez que les heures vraiment libres. Sans compte, sans paiement à l’avance.' },
  'mx.rituel.3.titre': { es: 'Póngase cómoda', fr: 'Installez-vous' },
  'mx.rituel.3.texte': { es: 'Su {pro} la espera: nadie más tiene esa hora.', fr: 'Votre {pro} vous attend : ce créneau n’est donné à personne d’autre.' },
  'mx.invitation.titre': { es: 'Regálese este momento', fr: 'Offrez-vous ce moment' },
  'mx.invitation.texte': { es: 'Reserve en un minuto; la confirmación es inmediata.', fr: 'Réservez en une minute ; la confirmation est immédiate.' },
  'mx.invitation.appeler': { es: 'O llámenos: {telephone}', fr: 'Ou appelez-nous : {telephone}' },
  'mx.maison.surtitre': { es: 'La casa', fr: 'La maison' },
  'mx.maison.titre': { es: 'Un momento para ti', fr: 'Un moment pour vous' },
  'mx.carte.surtitre': { es: 'La carta', fr: 'La carte' },
  'mx.carte.titre': { es: 'Servicios y tarifas', fr: 'Prestations et tarifs' },
  'mx.carte.autres': { es: 'Otros servicios', fr: 'Autres prestations' },
  'mx.carte.duree': { es: '{n} min', fr: '{n} min' },
  'mx.venir.surtitre': { es: 'Reservar', fr: 'Réserver' },
  'mx.venir.titre': { es: 'Tu momento, a tu manera', fr: 'Votre moment, à votre façon' },
  'mx.venir.chapo': {
    es: 'Elige tu hora con antelación, o ven cuando quieras y sigue tu turno desde el teléfono.',
    fr: 'Choisissez votre heure à l’avance, ou venez quand vous voulez et suivez votre tour depuis votre téléphone.',
  },
  'mx.rdv.titre': { es: 'Con cita', fr: 'Sur rendez-vous' },
  'mx.rdv.texte': {
    es: 'Servicio, {pro}, día y hora: tú eliges. La confirmación es inmediata.',
    fr: 'Prestation, {pro}, jour et heure : vous choisissez. La confirmation est immédiate.',
  },
  'mx.rdv.prochains': { es: 'Próximas horas libres', fr: 'Prochaines disponibilités' },
  'mx.rdv.choisir': { es: 'Elegir mi hora', fr: 'Choisir mon créneau' },
  'mx.rdv.aucun': {
    es: 'No queda ninguna hora libre estos días. Llámanos.',
    fr: 'Plus aucune heure libre ces jours-ci. Appelez-nous.',
  },
  'mx.file.titre': { es: 'Sin cita', fr: 'Sans rendez-vous' },
  'mx.file.texte': {
    es: 'Pide tu turno desde el teléfono y espera donde quieras: te avisamos cuando se acerque.',
    fr: 'Prenez votre tour depuis votre téléphone et attendez où vous voulez : nous vous prévenons quand il approche.',
  },
  'mx.file.bouton': { es: 'Pedir mi turno', fr: 'Prendre mon tour' },
  'mx.equipe.surtitre': { es: 'El equipo', fr: 'L’équipe' },
  'mx.equipe.titre': { es: 'Manos expertas', fr: 'Des mains expertes' },
  'mx.equipe.role': { es: '{Pro}', fr: '{Pro}' },
  'mx.equipe.reserver': { es: 'Reservar con {nom}', fr: 'Réserver avec {nom}' },
  'join.horsLigneTitre': { es: 'Esta casa atiende con cita', fr: 'Cette maison reçoit sur rendez-vous' },
  'file.horsLigne': {
    es: 'El salón no ofrece la fila en línea. Pasa por el salón o llámanos.',
    fr: 'Le salon ne propose pas la file d’attente en ligne. Passez au salon ou appelez-nous.',
  },
  'file.horsLigneRdv': {
    es: 'Aquí no se pide turno: elige tu hora y te esperamos.',
    fr: 'Ici, on ne prend pas de tour : choisissez votre heure, nous vous attendons.',
  },

  'affiche.accrocheRdv': { es: 'Reserva tu cita', fr: 'Réservez votre rendez-vous' },
  'affiche.sousTitreRdv': { es: 'Escanea el código y elige tu hora.', fr: 'Scannez le code et choisissez votre heure.' },
  'horsLigne.texte': { es: 'No hemos podido contactar con el salón. Vuelve a cargar la página cuando tengas señal.', fr: 'Impossible de joindre le salon. Rechargez la page quand le réseau revient.' },
  'horsLigne.reessayer': { es: 'Reintentar', fr: 'Réessayer' },
  'date.courte': { es: '{jour} {n} {mois}', fr: '{jour} {n} {mois}' },
  'date.aujourdhui': { es: 'Hoy', fr: 'Aujourd’hui' },
  'date.demain': { es: 'Mañana', fr: 'Demain' },
  'jour.court.0': { es: 'dom', fr: 'dim.' },
  'jour.court.1': { es: 'lun', fr: 'lun.' },
  'jour.court.2': { es: 'mar', fr: 'mar.' },
  'jour.court.3': { es: 'mié', fr: 'mer.' },
  'jour.court.4': { es: 'jue', fr: 'jeu.' },
  'jour.court.5': { es: 'vie', fr: 'ven.' },
  'jour.court.6': { es: 'sáb', fr: 'sam.' },
  'mois.court.1': { es: 'ene', fr: 'janv.' },
  'mois.court.2': { es: 'feb', fr: 'févr.' },
  'mois.court.3': { es: 'mar', fr: 'mars' },
  'mois.court.4': { es: 'abr', fr: 'avr.' },
  'mois.court.5': { es: 'may', fr: 'mai' },
  'mois.court.6': { es: 'jun', fr: 'juin' },
  'mois.court.7': { es: 'jul', fr: 'juil.' },
  'mois.court.8': { es: 'ago', fr: 'août' },
  'mois.court.9': { es: 'sep', fr: 'sept.' },
  'mois.court.10': { es: 'oct', fr: 'oct.' },
  'mois.court.11': { es: 'nov', fr: 'nov.' },
  'mois.court.12': { es: 'dic', fr: 'déc.' },

  /* ---------------------------------------------------------------- */
  /*  Les pages de rendez-vous                                        */
  /* ---------------------------------------------------------------- */

  'rdvp.titrePage': { es: 'Reservar cita — {nom}', fr: 'Prendre rendez-vous — {nom}' },
  'rdvp.titreSuivi': { es: 'Tu cita — {nom}', fr: 'Votre rendez-vous — {nom}' },
  'rdvp.titreAgenda': { es: 'Cita — {nom}', fr: 'Rendez-vous — {nom}' },
  'rdvp.description': {
    es: 'Reserva tu cita en {nom}: elige servicio, día y hora en un minuto.',
    fr: 'Réservez votre rendez-vous chez {nom} : prestation, jour et heure en une minute.',
  },
  'rdvp.titre': { es: 'Reserva tu momento', fr: 'Réservez votre moment' },
  'rdvp.chapo': {
    es: 'Cuatro elecciones y tu cita queda confirmada. Sin cuenta, sin pago por adelantado.',
    fr: 'Quatre choix et votre rendez-vous est confirmé. Sans compte, sans paiement à l’avance.',
  },
  'rdvp.indisponibleTitre': { es: 'Las citas no están abiertas', fr: 'Les rendez-vous ne sont pas ouverts' },
  'rdvp.etape.prestations': { es: 'Tus servicios', fr: 'Vos prestations' },
  'rdvp.etape.pro': { es: 'Tu {pro}', fr: 'Votre {pro}' },
  'rdvp.etape.jour': { es: 'El día', fr: 'Le jour' },
  'rdvp.etape.heure': { es: 'La hora', fr: 'L’heure' },
  'rdvp.etape.coordonnees': { es: 'Tus datos', fr: 'Vos coordonnées' },
  'rdvp.sansPreference': { es: 'Sin preferencia', fr: 'Sans préférence' },
  'rdvp.choisirDabord': { es: 'Elige primero un servicio: te mostramos los días libres.', fr: 'Choisissez d’abord une prestation : nous vous montrons les jours libres.' },
  'rdvp.aucunJour': {
    es: 'No queda ningún día libre para esta elección. Prueba sin preferencia, o llámanos.',
    fr: 'Plus aucun jour libre pour ce choix. Essayez sans préférence, ou appelez-nous.',
  },
  'rdvp.vise': { es: 'Hora elegida: {jour}, {heure}', fr: 'Heure choisie : {jour}, {heure}' },
  'rdvp.voirHeures': { es: 'Ver los días y las horas', fr: 'Voir les jours et les heures' },
  'rdvp.complet': { es: 'completo', fr: 'complet' },
  'rdvp.ferme': { es: 'cerrado', fr: 'fermé' },
  'rdvp.moment.matin': { es: 'Mañana', fr: 'Matin' },
  'rdvp.moment.apresMidi': { es: 'Tarde', fr: 'Après-midi' },
  'rdvp.moment.soir': { es: 'Final del día', fr: 'Soirée' },
  'rdvp.resume': { es: 'Tu cita', fr: 'Votre rendez-vous' },
  'rdvp.resumeVide': { es: 'Tu elección aparecerá aquí.', fr: 'Votre choix s’affichera ici.' },
  'rdvp.duree': { es: 'Duración', fr: 'Durée' },
  'rdvp.total': { es: 'Total', fr: 'Total' },
  'rdvp.avec': { es: 'Con', fr: 'Avec' },
  'rdvp.quand': { es: 'Cuándo', fr: 'Quand' },
  'rdvp.prestations': { es: 'Servicios', fr: 'Prestations' },
  'rdvp.notePolitique': {
    es: 'Puedes anular en línea hasta {n} hora antes. El pago se hace en el salón.|Puedes anular en línea hasta {n} horas antes. El pago se hace en el salón.',
    fr: 'Vous pouvez annuler en ligne jusqu’à {n} heure avant. Le règlement se fait au salon.|Vous pouvez annuler en ligne jusqu’à {n} heures avant. Le règlement se fait au salon.',
  },
  'rdvp.confirmer': { es: 'Confirmar mi cita', fr: 'Confirmer mon rendez-vous' },
  'rdvp.confirmeTitre': { es: 'Tu cita está confirmada', fr: 'Votre rendez-vous est confirmé' },
  'rdvp.votreRdv': { es: 'Tu cita', fr: 'Votre rendez-vous' },
  'rdvp.annuleTitre': { es: 'Cita anulada', fr: 'Rendez-vous annulé' },
  'rdvp.passeTitre': { es: 'Esta cita ya pasó', fr: 'Ce rendez-vous est passé' },
  'rdvp.ajouterAgenda': { es: 'Añadir a mi calendario', fr: 'Ajouter à mon agenda' },
  'rdvp.nouveauRdv': { es: 'Reservar otra cita', fr: 'Prendre un autre rendez-vous' },
  'rdvp.annuler': { es: 'Anular esta cita', fr: 'Annuler ce rendez-vous' },
  'rdvp.confirmerAnnulation': { es: '¿Anular esta cita? La hora quedará libre para otra persona.', fr: 'Annuler ce rendez-vous ? L’heure sera libérée pour quelqu’un d’autre.' },
  'rdvp.annulableJusqua': {
    es: 'Anulación en línea posible hasta {n} hora antes.|Anulación en línea posible hasta {n} horas antes.',
    fr: 'Annulation en ligne possible jusqu’à {n} heure avant.|Annulation en ligne possible jusqu’à {n} heures avant.',
  },
  'rdvp.annulationImpossible': { es: 'No se ha podido anular', fr: 'Annulation impossible' },
  'rdvp.gardeLien': { es: 'Guarda este enlace', fr: 'Gardez ce lien' },
  'rdvp.lienTexte': {
    es: 'Es tu cita: sirve para consultarla, añadirla al calendario o anularla.',
    fr: 'C’est votre rendez-vous : il sert à le consulter, l’ajouter à votre agenda ou l’annuler.',
  },

  'reglage.accueil.file.libelle': { es: 'Proponer la fila en línea', fr: 'Proposer la file d’attente en ligne' },
  'reglage.accueil.file.aide': {
    es: 'El cliente pide turno desde su teléfono y sigue su posición. Desactivada, el salón trabaja solo con cita (la fila del mostrador sigue disponible para el personal).',
    fr: 'Le client prend son tour depuis son téléphone et suit sa position. Désactivée, le salon travaille sur rendez-vous seulement (la file du comptoir reste disponible au personnel).',
  },
  'reglage.rdv.actifs.libelle': { es: 'Aceptar citas en línea', fr: 'Accepter les rendez-vous en ligne' },
  'reglage.rdv.actifs.aide': {
    es: 'Los clientes eligen servicio, profesional, día y hora. Necesita el horario de apertura.',
    fr: 'Les clients choisissent prestation, professionnel, jour et heure. Nécessite les horaires d’ouverture.',
  },
  'reglage.rdv.pasMinutes.libelle': { es: 'Intervalo entre horas propuestas (min)', fr: 'Intervalle entre les heures proposées (min)' },
  'reglage.rdv.delaiMinutes.libelle': { es: 'Antelación mínima (min)', fr: 'Délai minimal avant un rendez-vous (min)' },
  'reglage.rdv.delaiMinutes.aide': {
    es: '60: nadie reserva para dentro de media hora.',
    fr: '60 : personne ne réserve pour dans une demi-heure.',
  },
  'reglage.rdv.horizonJours.libelle': { es: 'Reservable con cuántos días de antelación', fr: 'Réservable combien de jours à l’avance' },
  'reglage.rdv.annulationHeures.libelle': { es: 'Anulación en línea hasta (horas antes)', fr: 'Annulation en ligne jusqu’à (heures avant)' },
  'reglage.rdv.tamponMinutes.libelle': { es: 'Margen entre dos citas (min)', fr: 'Marge entre deux rendez-vous (min)' },
  'reglage.rdv.choixProfessionnel.libelle': { es: 'El cliente puede elegir su {pro}', fr: 'Le client peut choisir son {pro}' },
  'reglage.rdv.maxParNumero.libelle': { es: 'Citas futuras por número', fr: 'Rendez-vous à venir par numéro' },
  'reglage.rdv.message.libelle': { es: 'Mensaje en la confirmación', fr: 'Message sur la confirmation' },
  'reglage.rdv.message.aide': {
    es: 'Por ejemplo: « Le agradecemos que llegue cinco minutos antes ».',
    fr: 'Par exemple : « Merci d’arriver cinq minutes avant ».',
  },
};
