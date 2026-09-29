/**
 * Tout ce que le navigateur dit a voix haute, dans les deux langues.
 *
 * Meme disposition que cote serveur, et pour la meme raison : une cle, deux
 * langues, une ligne. Une traduction manquante se voit a l'oeil nu, et un test
 * refuse le fichier s'il en reste une — voir test/unit/langue.test.js, qui lit
 * CE fichier aussi.
 *
 * LE FRANCAIS VOUVOIE LE CLIENT ET TUTOIE LE PERSONNEL. Ce n'est pas une
 * inconstance : la vitrine s'adresse a quelqu'un qu'on ne connait pas, l'espace
 * de gestion au coiffeur qui y passe sa journee. L'espagnol fait la meme chose
 * avec le meme « tu » — c'est le registre qui change, pas le pronom.
 *
 * Ce qui N'EST PAS ici : le nom de l'enseigne, les noms de prestations, l'adresse
 * et les phrases saisies par le gerant. Ce sont ses mots, pas les notres.
 */

export const TEXTES = {
  /* ---------------------------------------------------------------- */
  /*  Mots communs                                                    */
  /* ---------------------------------------------------------------- */

  'commun.oui': { es: 'Sí', fr: 'Oui' },
  'commun.non': { es: 'No', fr: 'Non' },
  'commun.fermer': { es: 'Cerrar', fr: 'Fermer' },
  'commun.annuler': { es: 'Anular', fr: 'Annuler' },
  'commun.guardar': { es: 'Guardar', fr: 'Enregistrer' },
  'commun.ajouter': { es: 'Añadir', fr: 'Ajouter' },
  'commun.renommer': { es: 'Renombrar', fr: 'Renommer' },
  'commun.supprimer': { es: 'Borrar', fr: 'Supprimer' },
  'commun.vide': { es: '—', fr: '—' },
  'commun.unMoment': { es: 'Un momento…', fr: 'Un instant…' },
  'commun.horsLigne': {
    es: 'Sin conexión — mostramos lo último que sabemos.',
    fr: 'Hors connexion — nous montrons la dernière file connue.',
  },
  'commun.serviceIndisponible': {
    es: 'El servicio no está disponible ahora mismo. Inténtalo en un instante.',
    fr: 'Le service n’est pas disponible pour le moment. Réessayez dans un instant.',
  },
  'commun.salonInjoignable': {
    es: 'No se puede contactar con el salón. Comprueba la conexión a internet.',
    fr: 'Impossible de joindre le salon. Vérifiez la connexion internet.',
  },
  'commun.erreurAvecCode': { es: 'Ha ocurrido un error ({statut}).', fr: 'Une erreur est survenue ({statut}).' },
  'commun.leSalon': { es: 'el salón', fr: 'le salon' },

  /* ---------------------------------------------------------------- */
  /*  Durees, dates, jours, mois                                      */
  /* ---------------------------------------------------------------- */

  'duree.quelquesMinutes': { es: 'unos minutos', fr: 'quelques minutes' },
  'duree.minutes': { es: '{n} minuto|{n} minutos', fr: '{n} minute|{n} minutes' },
  'duree.heures': { es: '{h} h', fr: '{h} h' },
  'duree.heuresMinutes': { es: '{h} h {m}', fr: '{h} h {m}' },
  'duree.environMinutes': { es: 'unos {duree}', fr: 'environ {duree}' },
  'duree.environHeures': { es: 'alrededor de {duree}', fr: 'environ {duree}' },
  'duree.maintenant': { es: 'ahora mismo', fr: 'tout de suite' },
  'duree.min': { es: '{n} min', fr: '{n} min' },
  'duree.depuisMinutes': { es: 'desde hace {n} min', fr: 'depuis {n} min' },
  'duree.depuisHeures': { es: 'desde hace {duree}', fr: 'depuis {duree}' },

  'date.longue': { es: '{jour} {n} de {mois} de {annee}', fr: '{jour} {n} {mois} {annee}' },
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
  /*  La vitrine : affluence en direct                                */
  /* ---------------------------------------------------------------- */

  'accueil.sansAttente': { es: 'Sin espera', fr: 'Aucune attente' },
  'accueil.sansAttenteDetail': { es: 'El sillón te está esperando.', fr: 'Le fauteuil vous attend.' },
  'accueil.enFile': { es: '{n} persona en la fila|{n} personas en la fila', fr: '{n} personne dans la file|{n} personnes dans la file' },
  'accueil.attenteEstimee': { es: 'Espera estimada: {duree}', fr: 'Attente estimée : {duree}' },
  'accueil.servisAujourdhui': { es: '{n} atendido hoy|{n} atendidos hoy', fr: '{n} client servi aujourd’hui|{n} clients servis aujourd’hui' },

  /* ---------------------------------------------------------------- */
  /*  La page de suivi du client                                      */
  /* ---------------------------------------------------------------- */

  'ticket.titrePage': { es: 'Turno {numero} — {nom}', fr: 'Tour {numero} — {nom}' },
  'ticket.termine': { es: 'Este turno ha terminado.', fr: 'Ce tour est terminé.' },
  'ticket.journeeClose': {
    es: 'La jornada del salón está cerrada. ¡Hasta pronto!',
    fr: 'La journée du salon est terminée. À bientôt !',
  },
  'ticket.copie': { es: 'Enlace copiado.', fr: 'Lien copié.' },
  'ticket.selectionne': { es: 'Enlace seleccionado: cópialo.', fr: 'Lien sélectionné : copiez-le.' },
  // Ces trois phrases etaient EN FRANCAIS dans une application espagnole : la
  // feuille de partage du telephone affichait « Mon tour chez … » a un client de
  // Fuente Alamo. Personne ne l'avait vu, parce qu'elle n'apparait qu'en
  // appuyant sur « Envoyer le lien » depuis un appareil qui sait partager.
  'ticket.partageTitre': { es: 'Mi turno en {salon}', fr: 'Mon tour chez {salon}' },
  'ticket.partageTexte': {
    es: 'Mi turno {numero} en {salon}. Sigo mi posición aquí:',
    fr: 'Mon tour {numero} chez {salon}. Je suis ma position ici :',
  },
  'ticket.confirmerAnnulation': {
    es: '¿Liberar tu sitio en la fila? Tendrás que pedir otro turno para volver.',
    fr: 'Libérer votre place dans la file ? Il faudra reprendre un tour pour revenir.',
  },

  /* ---------------------------------------------------------------- */
  /*  Le formulaire de prise de tour                                  */
  /* ---------------------------------------------------------------- */

  // « aprox. » / « env. » : le prix est indicatif, le salon encaisse au comptoir.
  'join.total': {
    es: '{n} servicio · {duree} · {prix} aprox.|{n} servicios · {duree} · {prix} aprox.',
    fr: '{n} prestation · {duree} · {prix} env.|{n} prestations · {duree} · {prix} env.',
  },
  'join.prenomRequis': { es: 'Tu nombre es obligatorio.', fr: 'Votre prénom est obligatoire.' },
  'join.nomRequis': { es: 'Tu apellido es obligatorio.', fr: 'Votre nom est obligatoire.' },
  'join.nomLettres': {
    es: 'Solo se aceptan letras, espacio, apóstrofo y guion.',
    fr: 'Seules les lettres, l’espace, l’apostrophe et le tiret sont acceptés.',
  },
  'join.telephoneRequis': {
    es: 'Tu número de WhatsApp es obligatorio.',
    fr: 'Votre numéro WhatsApp est obligatoire.',
  },
  'join.telephoneForme': {
    es: 'Número no válido: solo cifras, espacios y « + ».',
    fr: 'Numéro invalide : chiffres, espaces et « + » uniquement.',
  },
  'join.telephoneInvraisemblable': {
    es: 'Este número no parece un número de teléfono.',
    fr: 'Ce numéro ne ressemble pas à un numéro de téléphone.',
  },

  /* ---------------------------------------------------------------- */
  /*  L'ecran du salon                                                */
  /* ---------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------- */
  /*  L'espace de gestion : navigation et connexion                   */
  /* ---------------------------------------------------------------- */

  'nav.file': { es: 'La fila', fr: 'La file' },
  'nav.tarifs': { es: 'Tarifas', fr: 'Tarifs' },
  'nav.qr': { es: 'Código QR', fr: 'Code QR' },
  'nav.chiffres': { es: 'Cifras', fr: 'Chiffres' },
  'nav.conges': { es: 'Vacaciones', fr: 'Congés' },
  'nav.reglages': { es: 'Ajustes', fr: 'Réglages' },
  'nav.comptes': { es: 'Cuentas', fr: 'Comptes' },
  'nav.sections': { es: 'Secciones', fr: 'Sections' },
  'nav.fermerMenu': { es: 'Cerrar el menú', fr: 'Fermer le menu' },
  'nav.sortir': { es: 'Salir', fr: 'Se déconnecter' },
  'nav.pageDuSalon': { es: 'Ir a la página del salón', fr: 'Aller à la page du salon' },
  'nav.chargementEchoue': { es: 'No se ha podido cargar esta pantalla.', fr: 'Cet écran n’a pas pu être chargé.' },

  'connexion.titre': { es: 'Área del salón', fr: 'Espace du salon' },
  'connexion.sousTitre': { es: 'Entra para llevar la fila del día.', fr: 'Connectez-vous pour tenir la file du jour.' },
  'connexion.identifiant': { es: 'Usuario', fr: 'Identifiant' },
  'connexion.motDePasse': { es: 'Contraseña', fr: 'Mot de passe' },
  'connexion.entrer': { es: 'Entrar', fr: 'Entrer' },
  'connexion.montrerMotDePasse': { es: 'Mostrar la contraseña', fr: 'Afficher le mot de passe' },
  'connexion.cacherMotDePasse': { es: 'Ocultar la contraseña', fr: 'Masquer le mot de passe' },
  'connexion.choisirMotDePasse': { es: 'Elige tu contraseña', fr: 'Choisissez votre mot de passe' },
  'connexion.motDePasseProvisoire': {
    es: 'Esta cuenta todavía usa una contraseña provisional. Cámbiala para continuar.',
    fr: 'Ce compte utilise encore un mot de passe provisoire. Changez-le pour continuer.',
  },
  'connexion.motDePasseActuel': { es: 'Contraseña actual', fr: 'Mot de passe actuel' },
  'connexion.motDePasseNouveau': { es: 'Contraseña nueva', fr: 'Nouveau mot de passe' },
  'connexion.auMoins': { es: 'Al menos {n} caracteres.', fr: 'Au moins {n} caractères.' },
  'connexion.motDePasseEnregistre': { es: 'Contraseña guardada.', fr: 'Mot de passe enregistré.' },

  /* ---------------------------------------------------------------- */
  /*  Les avis pousses sur l'appareil                                 */
  /* ---------------------------------------------------------------- */

  'avisos.titre': { es: 'Avisos en este aparato', fr: 'Avis sur cet appareil' },
  'avisos.verification': { es: 'Comprobando…', fr: 'Vérification…' },
  'avisos.bloques': { es: 'Avisos bloqueados.', fr: 'Avis bloqués.' },
  'avisos.bloquesDetail': {
    es: 'El navegador ya no volverá a preguntar: hay que permitirlos en sus ajustes de sitio.',
    fr: 'Le navigateur ne redemandera plus : il faut les autoriser dans ses réglages de site.',
  },
  'avisos.permisRefuse': { es: 'No se ha dado permiso.', fr: 'L’autorisation n’a pas été donnée.' },
  'avisos.activationEchouee': { es: 'No se han podido activar.', fr: 'Activation impossible.' },
  'avisos.desactivationEchouee': { es: 'No se han podido desactivar.', fr: 'Désactivation impossible.' },
  'avisos.envoi': { es: 'Enviando…', fr: 'Envoi…' },
  'avisos.plusAbonne': { es: 'Este aparato ya no está suscrito.', fr: 'Cet appareil n’est plus abonné.' },
  'avisos.envoye': { es: 'Aviso enviado.', fr: 'Avis envoyé.' },
  'avisos.envoyeDetail': {
    es: 'Debería aparecer en un momento. Si no llega, comprueba los ajustes del aparato.',
    fr: 'Il devrait apparaître dans un instant. S’il n’arrive pas, vérifiez les réglages de l’appareil.',
  },
  'avisos.essaiEchoue': { es: 'El aviso de prueba no ha llegado a salir.', fr: 'L’avis d’essai n’a pas pu partir.' },
  'avisos.navigateurIncapable': { es: 'Este navegador no admite avisos.', fr: 'Ce navigateur ne gère pas les avis.' },
  'avisos.iphone': {
    es: 'En iPhone hay que añadir la página a la pantalla de inicio para que funcionen.',
    fr: 'Sur iPhone, il faut ajouter la page à l’écran d’accueil pour qu’ils fonctionnent.',
  },
  'avisos.etatInconnu': { es: 'No se ha podido comprobar el estado de los avisos.', fr: 'L’état des avis n’a pas pu être vérifié.' },
  'avisos.nonConfigure': { es: 'Los avisos no están configurados en este servidor.', fr: 'Les avis ne sont pas configurés sur ce serveur.' },
  'avisos.nonConfigureDetail': {
    es: 'Hacen falta las claves WEBPUSH en el servidor. Mientras tanto, la fila se actualiza sola en pantalla.',
    fr: 'Les clés WEBPUSH manquent sur le serveur. En attendant, la file se met à jour d’elle-même à l’écran.',
  },
  'avisos.preparationRefusee': { es: 'El navegador no ha permitido preparar los avisos.', fr: 'Le navigateur n’a pas permis de préparer les avis.' },
  'avisos.preparationRefuseeDetail': { es: 'Suele pasar en ventanas privadas.', fr: 'C’est fréquent en navigation privée.' },
  'avisos.actifs': { es: 'Activados en este aparato.', fr: 'Activés sur cet appareil.' },
  'avisos.autresAppareils': { es: 'Tienes {n} aparato suscrito.|Tienes {n} aparatos suscritos.', fr: 'Vous avez {n} appareil abonné.|Vous avez {n} appareils abonnés.' },
  'avisos.actifsDetail': {
    es: 'Sonará cuando alguien pida turno o lo anule.',
    fr: 'Il sonnera quand quelqu’un prend un tour ou l’annule.',
  },
  'avisos.essayer': { es: 'Probar', fr: 'Essayer' },
  'avisos.desactiver': { es: 'Desactivar', fr: 'Désactiver' },
  'avisos.bloquesNavigateur': { es: 'Avisos bloqueados en este navegador.', fr: 'Avis bloqués dans ce navigateur.' },
  'avisos.bloquesNavigateurDetail': {
    es: 'Hay que permitirlos en los ajustes del sitio; desde aquí ya no se puede preguntar.',
    fr: 'Il faut les autoriser dans les réglages du site ; d’ici, on ne peut plus le demander.',
  },
  'avisos.inactifs': { es: 'Desactivados en este aparato.', fr: 'Désactivés sur cet appareil.' },
  'avisos.inactifsDetail': {
    es: 'Actívalos y el móvil vibrará cuando alguien pida turno o lo anule, sin tener que mirar la pantalla.',
    fr: 'Activez-les et le téléphone vibrera quand quelqu’un prend un tour ou l’annule, sans avoir à regarder l’écran.',
  },
  'avisos.activer': { es: 'Activar los avisos', fr: 'Activer les avis' },
  'sw.nouveautes': { es: 'Hay novedades en la fila.', fr: 'Du nouveau dans la file.' },

  /* ---------------------------------------------------------------- */
  /*  L'ecran de la file                                              */
  /* ---------------------------------------------------------------- */

  'file.gesteEchoue': { es: 'La acción no se ha completado.', fr: 'Le geste n’a pas abouti.' },
  'file.clientActuel': { es: 'Cliente actual', fr: 'Client actuel' },
  'file.fauteuilLibre': { es: 'Sillón libre.', fr: 'Fauteuil libre.' },
  'file.personneChezCeCoiffeur': { es: 'Nadie espera a este peluquero.', fr: 'Personne n’attend chez ce coiffeur.' },
  'file.personneEnAttente': { es: 'No espera nadie.', fr: 'Personne n’attend.' },
  'file.suivantDansSaFile': { es: 'Siguiente en su fila', fr: 'Suivant dans sa file' },
  'file.suivantDansLaFile': { es: 'Siguiente en la fila', fr: 'Suivant dans la file' },
  'file.appelerQui': { es: 'Llamar a {prenom}', fr: 'Appeler {prenom}' },
  'file.appeleAuFauteuil': { es: '{prenom} ha sido llamado al sillón {poste}.', fr: '{prenom} est appelé au fauteuil {poste}.' },
  'file.prendreAutreFile': {
    es: 'Puedes coger un cliente de otra fila con « Llamar ahora ».',
    fr: 'Vous pouvez prendre un client d’une autre file avec « Appeler maintenant ».',
  },
  'file.seRemplira': {
    es: 'La fila se llenará en cuanto alguien pida turno.',
    fr: 'La file se remplira dès que quelqu’un prendra un tour.',
  },
  'file.appeleDepuis': { es: 'Llamado {depuis}', fr: 'Appelé {depuis}' },
  'file.auFauteuilDepuis': { es: 'En el sillón {depuis}', fr: 'Au fauteuil {depuis}' },
  'file.dejaAbsent': {
    es: 'Ya ha estado ausente {n} vez hoy.|Ya ha estado ausente {n} veces hoy.',
    fr: 'Déjà absent {n} fois aujourd’hui.|Déjà absent {n} fois aujourd’hui.',
  },
  'file.clientServi': { es: 'CLIENTE ATENDIDO ✓', fr: 'CLIENT SERVI ✓' },
  'file.commencerCoupe': { es: 'Empezar el corte', fr: 'Commencer la coupe' },
  'file.absentRetard': { es: 'Ausente / con retraso', fr: 'Absent / en retard' },
  'file.aEteServi': { es: '{prenom} ha sido atendido.', fr: '{prenom} a été servi.' },
  'file.passeEnFin': { es: '{prenom} pasa al final de la fila.', fr: '{prenom} passe en fin de file.' },
  'file.aucunFauteuil': { es: 'Ningún sillón abierto.', fr: 'Aucun fauteuil ouvert.' },
  'file.ouvrirUnFauteuil': {
    es: 'Abre un sillón en Ajustes para poder llamar a un cliente.',
    fr: 'Ouvrez un fauteuil dans les Réglages pour pouvoir appeler un client.',
  },
  'file.transfertVers': { es: 'A:', fr: 'Vers :' },
  'file.changerCoiffeur': { es: 'Cambiar de peluquero', fr: 'Changer de coiffeur' },
  'file.attendChez': { es: '{prenom} espera ahora a {coiffeur}.', fr: '{prenom} attend maintenant chez {coiffeur}.' },
  'file.appeler': { es: 'Llamar', fr: 'Appeler' },
  'file.appelerMaintenant': { es: 'Llamar ahora', fr: 'Appeler maintenant' },
  'file.servi': { es: 'Atendido', fr: 'Servi' },
  'file.aEteAppele': { es: '{prenom} ha sido llamado.', fr: '{prenom} a été appelé.' },
  'file.arriveA': { es: 'Llegó a las {heure}', fr: 'Arrivé à {heure}' },
  'file.attendDepuis': { es: 'Espera {depuis}', fr: 'Attend {depuis}' },
  'file.absentFois': { es: 'ausente {n}×', fr: 'absent {n}×' },
  'file.messageEchoue': { es: 'No se ha podido preparar el mensaje.', fr: 'Le message n’a pas pu être préparé.' },
  'file.messagesEchoues': { es: 'No se ha podido preparar los mensajes.', fr: 'Les messages n’ont pas pu être préparés.' },
  'file.personneNAttend': { es: 'Nadie está esperando.', fr: 'Personne n’attend.' },
  'file.messagePrepare': {
    es: 'Mensaje preparado para {prenom} ({numero}).\n\n¿Preparar el siguiente? Quedan {reste}.',
    fr: 'Message préparé pour {prenom} ({numero}).\n\nPréparer le suivant ? Il en reste {reste}.',
  },
  'file.messagesPrepares': { es: '{n} mensaje preparado.|{n} mensajes preparados.', fr: '{n} message préparé.|{n} messages préparés.' },
  'file.confirmerAnnulation': {
    es: '¿Anular el turno de {prenom} ({numero})?\nMotivo (opcional):',
    fr: 'Annuler le tour de {prenom} ({numero}) ?\nMotif (facultatif) :',
  },
  'file.tourAnnule': { es: 'Turno {numero} anulado.', fr: 'Tour {numero} annulé.' },
  'file.champPrenom': { es: 'Nombre', fr: 'Prénom' },
  'file.champNom': { es: 'Apellido', fr: 'Nom' },
  'file.champWhatsapp': { es: 'WhatsApp', fr: 'WhatsApp' },
  'file.tourCreeComptoir': { es: 'Turno {numero} creado en el mostrador.', fr: 'Tour {numero} créé au comptoir.' },
  'file.ajoutEchoue': { es: 'No se ha podido añadir a este cliente.', fr: 'Ce client n’a pas pu être ajouté.' },
  'file.ajouterALaFile': { es: 'Añadir a la fila', fr: 'Ajouter à la file' },
  'file.ajouterAuComptoir': { es: 'Añadir un cliente en el mostrador', fr: 'Ajouter un client au comptoir' },
  'file.ajouterAuComptoirAide': {
    es: 'Para el cliente que no lleva el móvil a mano. Entra en la misma fila, a continuación.',
    fr: 'Pour le client qui n’a pas son téléphone sous la main. Il entre dans la même file, à la suite.',
  },
  'file.chiffreEnAttente': { es: 'cliente esperando|clientes esperando', fr: 'client en attente|clients en attente' },
  'file.chiffreServis': { es: 'cliente atendido|clientes atendidos', fr: 'client servi|clients servis' },
  'file.chiffreAttente': { es: 'de espera estimada', fr: 'd’attente estimée' },
  'file.chiffreFauteuils': { es: 'sillones libres', fr: 'fauteuils libres' },
  'file.compteEnAttente': { es: '{n} esperando', fr: '{n} en attente' },
  'file.sansCoiffeur': { es: 'Sin peluquero', fr: 'Sans coiffeur' },
  'file.sansCoiffeurAide': {
    es: 'Estos clientes pidieron turno antes del cambio de organización. Llámalos desde el sillón que quieras.',
    fr: 'Ces clients ont pris leur tour avant le changement d’organisation. Appelez-les depuis le fauteuil que vous voulez.',
  },
  'file.aucunEnAttente': { es: 'Ningún cliente esperando.', fr: 'Aucun client en attente.' },
  'file.dejaPasses': { es: 'Ya han pasado hoy ({n})', fr: 'Déjà passés aujourd’hui ({n})' },
  'file.journeeClose': {
    es: 'La jornada está cerrada. La fila volverá a empezar mañana en A001.',
    fr: 'La journée est clôturée. La file repartira demain à A001.',
  },
  'file.titreAttente': { es: 'Fila de espera', fr: 'File d’attente' },
  'file.prevenirProchains': { es: 'Avisar a los {n} siguientes', fr: 'Prévenir les {n} suivants' },
  'file.salonEnConges': { es: 'Salón cerrado (vacaciones)', fr: 'Salon fermé (congés)' },
  'file.arreterTours': { es: 'Dejar de dar turnos', fr: 'Arrêter les tours' },
  'file.reprendreTours': { es: 'Volver a dar turnos', fr: 'Reprendre les tours' },
  'file.confirmerArret': {
    es: '¿Dejar de dar turnos?\n\nQuien espera será atendido con normalidad; no entrará nadie nuevo.\n\nMensaje que verán los clientes (opcional):',
    fr: 'Arrêter les tours ?\n\nCeux qui attendent seront servis normalement ; personne de nouveau n’entrera.\n\nMessage que verront les clients (facultatif) :',
  },
  'file.toursArretes': { es: 'Ya no se dan turnos.', fr: 'Les tours sont arrêtés.' },
  'file.toursReprennent': { es: 'Se vuelven a dar turnos.', fr: 'Les tours reprennent.' },
  'file.toursOuverts': { es: 'Los clientes pueden pedir turno', fr: 'Les clients peuvent prendre un tour' },
  'file.toursFermes': { es: 'No se dan turnos', fr: 'Les tours sont arrêtés' },
  'file.horsHoraires': { es: 'Fuera del horario de apertura configurado.', fr: 'En dehors des horaires d’ouverture configurés.' },
  'file.cloturerJournee': { es: 'Cerrar la jornada', fr: 'Clôturer la journée' },
  'file.confirmerCloture': {
    es: '¿Cerrar la jornada?\nLos turnos que sigan en la fila se anularán y la numeración volverá a empezar mañana en A001.',
    fr: 'Clôturer la journée ?\nLes tours encore dans la file seront annulés et la numérotation repartira demain à A001.',
  },
  'file.journeeCloturee': { es: 'Jornada cerrada.', fr: 'Journée clôturée.' },

  /* ---------------------------------------------------------------- */
  /*  Les reglages                                                    */
  /* ---------------------------------------------------------------- */

  'reglages.titre': { es: 'Ajustes', fr: 'Réglages' },
  'reglages.adresseQr': { es: 'Dirección pública del código QR: {url}', fr: 'Adresse publique du code QR : {url}' },
  'reglages.enregistrer': { es: 'Guardar los ajustes', fr: 'Enregistrer les réglages' },
  'reglages.enregistres': { es: 'Ajustes guardados.', fr: 'Réglages enregistrés.' },
  'reglages.rechargement': {
    es: 'Ajustes guardados. Se recarga la pantalla para aplicar el idioma y la moneda…',
    fr: 'Réglages enregistrés. L’écran se recharge pour appliquer la langue et la monnaie…',
  },

  'reglages.groupe.identite': { es: 'Identidad del salón', fr: 'Identité du salon' },
  'reglages.groupe.file': { es: 'La fila', fr: 'La file' },
  'reglages.groupe.horaires': { es: 'Horario de apertura', fr: 'Horaires d’ouverture' },
  'reglages.groupe.tarifs': { es: 'Tarifas en la vitrina', fr: 'Les tarifs en vitrine' },
  'reglages.groupe.pantalla': { es: 'Pantalla del salón', fr: 'Écran du salon' },
  'reglages.groupe.public': { es: 'Dirección pública', fr: 'Adresse publique' },

  'identite.serveurTitre': { es: 'Lo que viene del servidor', fr: 'Ce qui vient du serveur' },
  'identite.fuseau': { es: 'Zona horaria', fr: 'Fuseau horaire' },
  'identite.indicatif': { es: 'Prefijo telefónico', fr: 'Indicatif téléphonique' },
  'identite.whatsappLangue': { es: 'Idioma de las plantillas de WhatsApp', fr: 'Langue des modèles WhatsApp' },
  'identite.whatsappInactif': { es: 'envío automático desactivado', fr: 'envoi automatique désactivé' },
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
  'identite.aCorriger': { es: 'Hay que corregir en el servidor', fr: 'À corriger sur le serveur' },

  'reglages.fauteuils.titre': { es: 'Sillones', fr: 'Fauteuils' },
  'reglages.fauteuils.plusieurs': {
    es: '{n} sillones abiertos: la fila sigue siendo una sola, pero avanza {n} veces más rápido, y la espera que se anuncia a los clientes lo tiene en cuenta.',
    fr: '{n} fauteuils ouverts : la file reste unique, mais elle avance {n} fois plus vite, et l’attente annoncée aux clients en tient compte.',
  },
  'reglages.fauteuils.unSeul': {
    es: 'Solo un sillón abierto. Añade un segundo y la pantalla de la fila mostrará una tarjeta por sillón.',
    fr: 'Un seul fauteuil ouvert. Ajoutez-en un second et l’écran de la file affichera une carte par fauteuil.',
  },
  'reglages.fauteuils.badgeFerme': { es: 'cerrado', fr: 'fermé' },
  'reglages.fauteuils.occupe': { es: 'ocupado — {qui}', fr: 'occupé — {qui}' },
  'reglages.fauteuils.libre': { es: 'libre', fr: 'libre' },
  'reglages.fauteuils.horsService': { es: 'fuera de servicio', fr: 'hors service' },
  'reglages.fauteuils.servis': { es: '{n} atendido hoy|{n} atendidos hoy', fr: '{n} servi aujourd’hui|{n} servis aujourd’hui' },
  'reglages.fauteuils.inviteNom': { es: 'Nombre del sillón:', fr: 'Nom du fauteuil :' },
  'reglages.fauteuils.echecRenommer': { es: 'No se ha podido renombrar.', fr: 'Le renommage a échoué.' },
  'reglages.fauteuils.mettreCoiffeur': { es: 'Poner el peluquero', fr: 'Affecter le coiffeur' },
  'reglages.fauteuils.changerCoiffeur': { es: 'Cambiar el peluquero', fr: 'Changer le coiffeur' },
  'reglages.fauteuils.inviteCoiffeur': {
    es: 'Peluquero de este sillón (déjalo vacío para quitarlo):',
    fr: 'Coiffeur de ce fauteuil (laissez vide pour le retirer) :',
  },
  'reglages.fauteuils.echecModif': { es: 'No se ha podido modificar.', fr: 'La modification a échoué.' },
  'reglages.fauteuils.fermer': { es: 'Cerrar', fr: 'Fermer' },
  'reglages.fauteuils.reouvrir': { es: 'Reabrir', fr: 'Réouvrir' },
  'reglages.fauteuils.estFerme': { es: 'Sillón cerrado.', fr: 'Fauteuil fermé.' },
  'reglages.fauteuils.estReouvert': { es: 'Sillón reabierto.', fr: 'Fauteuil réouvert.' },
  'reglages.fauteuils.confirmerSuppression': { es: '¿Borrar el sillón « {nom} »?', fr: 'Supprimer le fauteuil « {nom} » ?' },
  'reglages.fauteuils.estSupprime': { es: 'Sillón borrado.', fr: 'Fauteuil supprimé.' },
  'reglages.fauteuils.echecSuppression': { es: 'No se ha podido borrar.', fr: 'La suppression a échoué.' },
  'reglages.fauteuils.champNom': { es: 'Nombre del sillón', fr: 'Nom du fauteuil' },
  'reglages.fauteuils.champCoiffeur': { es: 'Peluquero', fr: 'Coiffeur' },
  'reglages.fauteuils.aideCoiffeur': {
    es: 'Se muestra en la tarjeta del sillón. Opcional.',
    fr: 'S’affiche sur la carte du fauteuil. Facultatif.',
  },
  'reglages.fauteuils.exempleNom': { es: 'Sillón 2', fr: 'Fauteuil 2' },
  'reglages.fauteuils.exempleCoiffeur': { es: 'Nombre del peluquero (opcional)', fr: 'Nom du coiffeur (facultatif)' },
  'reglages.fauteuils.ajouter': { es: 'Añadir el sillón', fr: 'Ajouter le fauteuil' },
  'reglages.fauteuils.estAjoute': { es: 'Sillón añadido.', fr: 'Fauteuil ajouté.' },
  'reglages.fauteuils.echecCreation': { es: 'No se ha podido crear.', fr: 'La création a échoué.' },
  'reglages.fauteuils.titreAjout': { es: 'Añadir un sillón', fr: 'Ajouter un fauteuil' },

  'reglages.whatsapp.titre': { es: 'WhatsApp', fr: 'WhatsApp' },
  'reglages.whatsapp.actif': {
    es: 'Los mensajes salen automáticamente. Plantillas: {modeles}.',
    fr: 'Les messages partent automatiquement. Modèles : {modeles}.',
  },
  'reglages.whatsapp.inactif': {
    es: 'El envío automático no está activado. Cada cliente ve su enlace en pantalla, y el botón « WhatsApp » de la fila abre la conversación con el mensaje ya escrito.',
    fr: 'L’envoi automatique n’est pas activé. Chaque client voit son lien à l’écran, et le bouton « WhatsApp » de la file ouvre la conversation avec le message déjà écrit.',
  },
  'reglages.whatsapp.note': {
    es: 'El token de acceso y el identificador del número se ponen en las variables de entorno (WHATSAPP_ACTIF, WHATSAPP_NUMERO_ID, WHATSAPP_JETON), nunca aquí: un secreto no tiene nada que hacer en la base de datos.',
    fr: 'Le jeton d’accès et l’identifiant du numéro se posent dans les variables d’environnement (WHATSAPP_ACTIF, WHATSAPP_NUMERO_ID, WHATSAPP_JETON), jamais ici : un secret n’a rien à faire dans la base de données.',
  },

  'reglages.purge.titre': { es: 'Borrar el historial', fr: 'Effacer l’historique' },
  'reglages.purge.intro': {
    es: 'Para empezar de cero después de las pruebas: se van todos los turnos y todo lo que cuelga de ellos. No se puede deshacer y no hay papelera.',
    fr: 'Pour repartir de zéro après les essais : tous les tours s’en vont, et tout ce qui s’y rattache. C’est irréversible et il n’y a pas de corbeille.',
  },
  'reglages.purge.voir': { es: 'Ver qué se borra exactamente', fr: 'Voir exactement ce qui est effacé' },
  'reglages.purge.seSupprime': { es: 'Se borra', fr: 'Est effacé' },
  'reglages.purge.seConserve': { es: 'Se conserva', fr: 'Est conservé' },
  'reglages.purge.part1': { es: 'Todos los turnos, de todos los días', fr: 'Tous les tours, de tous les jours' },
  'reglages.purge.part2': { es: 'Su historial (llamadas, retrasos, anulaciones)', fr: 'Leur historique (appels, retards, annulations)' },
  'reglages.purge.part3': { es: 'Los mensajes de WhatsApp pendientes', fr: 'Les messages WhatsApp en attente' },
  'reglages.purge.part4': { es: 'Las jornadas', fr: 'Les journées' },
  'reglages.purge.part5': { es: 'Las vacaciones y cierres declarados', fr: 'Les congés et fermetures déclarés' },
  'reglages.purge.reste1': { es: 'Las cuentas del personal', fr: 'Les comptes du personnel' },
  'reglages.purge.reste2': { es: 'Todos los ajustes del salón', fr: 'Tous les réglages du salon' },
  'reglages.purge.reste3': { es: 'Los sillones', fr: 'Les fauteuils' },
  'reglages.purge.reste4': { es: 'Las tarifas', fr: 'Les tarifs' },
  'reglages.purge.reste5': { es: 'Los avisos activados en cada aparato', fr: 'Les avis activés sur chaque appareil' },
  'reglages.purge.note': {
    es: 'La fila tiene que estar vacía: si queda alguien esperando, cierra la jornada primero. Borrar un turno mientras su cliente mira su enlace le dejaría una página muerta, y nadie en el salón sabría que sigue esperando.',
    fr: 'La file doit être vide : s’il reste quelqu’un en attente, clôturez la journée d’abord. Effacer un tour pendant que son client regarde son lien lui laisserait une page morte, et personne au salon ne saurait qu’il attend toujours.',
  },
  // LE MOT A RECOPIER SUIT LA LANGUE. Il est compare au meme mot cote serveur :
  // les deux lisent la meme cle, l'une dans chaque dictionnaire.
  'reglages.purge.mot': { es: 'BORRAR', fr: 'SUPPRIMER' },
  'reglages.purge.champ': { es: 'Escribe {mot} para confirmar', fr: 'Écrivez {mot} pour confirmer' },
  'reglages.purge.bouton': { es: 'Borrar el historial', fr: 'Effacer l’historique' },
  'reglages.purge.fait': {
    es: 'Historial borrado: {n} líneas. Las cuentas, los ajustes, los sillones y las tarifas siguen ahí.',
    fr: 'Historique effacé : {n} lignes. Les comptes, les réglages, les fauteuils et les tarifs sont toujours là.',
  },
  'reglages.purge.echec': { es: 'No se ha podido borrar.', fr: 'L’effacement a échoué.' },

  /* ---------------------------------------------------------------- */
  /*  La fiche de prix, cote gestion                                  */
  /* ---------------------------------------------------------------- */

  'tarifs.ordreEnregistre': { es: 'Orden guardado.', fr: 'Ordre enregistré.' },
  'tarifs.ordreEchoue': { es: 'No se ha podido guardar el orden.', fr: 'L’ordre n’a pas pu être enregistré.' },
  'tarifs.enregistrementEchoue': { es: 'No se ha podido guardar.', fr: 'La modification n’a pas pu être enregistrée.' },
  'tarifs.deplacerAria': { es: 'Mover {nom}', fr: 'Déplacer {nom}' },
  'tarifs.poigneeTitre': { es: 'Arrastra para reordenar', fr: 'Faites glisser pour réordonner la liste' },
  'tarifs.badgeMasquee': { es: 'oculta', fr: 'masquée' },
  'tarifs.monterAria': { es: 'Subir {nom}', fr: 'Monter {nom}' },
  'tarifs.aMonte': { es: '{nom} ha subido.', fr: '{nom} monte d’un rang.' },
  'tarifs.descendreAria': { es: 'Bajar {nom}', fr: 'Descendre {nom}' },
  'tarifs.aDescendu': { es: '{nom} ha bajado.', fr: '{nom} descend d’un rang.' },
  'tarifs.modifier': { es: 'Editar', fr: 'Modifier' },
  'tarifs.masquer': { es: 'Ocultar', fr: 'Masquer' },
  'tarifs.montrer': { es: 'Mostrar', fr: 'Afficher' },
  'tarifs.estMasquee': { es: '{nom} ya no se muestra.', fr: '{nom} ne s’affiche plus en vitrine.' },
  'tarifs.estAffichee': { es: '{nom} vuelve a mostrarse.', fr: '{nom} s’affiche de nouveau en vitrine.' },
  'tarifs.supprimer': { es: 'Borrar', fr: 'Supprimer' },
  'tarifs.confirmerSuppression': { es: '¿Borrar « {nom} » de la lista de precios?', fr: 'Supprimer « {nom} » de la fiche de prix ?' },
  'tarifs.estSupprimee': { es: '{nom} borrado.', fr: '{nom} ne figure plus sur la fiche de prix.' },
  'tarifs.inviteNom': { es: 'Nombre del servicio:', fr: 'Nom de la prestation :' },
  'tarifs.invitePrix': { es: 'Precio (por ejemplo 14 o 14,90):', fr: 'Prix (par exemple 14 ou 14,90) :' },
  'tarifs.inviteDuree': {
    es: 'Duración en minutos (sirve para calcular la espera):',
    fr: 'Durée en minutes (elle sert à calculer l’attente annoncée) :',
  },
  'tarifs.inviteNote': { es: 'Nota (puede quedar vacía):', fr: 'Note (elle peut rester vide) :' },
  'tarifs.enregistre': { es: 'Guardado.', fr: 'Enregistré.' },
  'tarifs.listeVide': {
    es: 'Todavía no hay ningún precio. Añade el primero abajo.',
    fr: 'Aucun prix pour l’instant. Ajoutez le premier ci-dessous.',
  },
  'tarifs.exempleService': { es: 'Corte de pelo', fr: 'Coupe de cheveux' },
  'tarifs.exempleNote': { es: 'Incluye lavado (opcional)', fr: 'Shampoing compris (facultatif)' },
  'tarifs.ajouter': { es: 'Añadir', fr: 'Ajouter' },
  'tarifs.estAjoutee': { es: '{nom} añadido.', fr: '{nom} figure maintenant sur la fiche de prix.' },
  'tarifs.ajoutEchoue': { es: 'No se ha podido añadir.', fr: 'La prestation n’a pas pu être ajoutée.' },
  'tarifs.champService': { es: 'Servicio', fr: 'Prestation' },
  'tarifs.champPrix': { es: 'Precio', fr: 'Prix' },
  // Le symbole est un PARAMETRE : ecrit « € » en dur, cette aide aurait menti
  // sur un salon qui compte en dirhams, juste au-dessus du champ ou le gerant
  // tape ses prix.
  'tarifs.aidePrix': {
    es: 'Como lo escribes: 14, 14,90 o 14.90. El símbolo {symbole} se añade solo.',
    fr: 'Comme vous l’écrivez : 14, 14,90 ou 14.90. Le symbole {symbole} est ajouté tout seul.',
  },
  'tarifs.champDuree': { es: 'Duración (minutos)', fr: 'Durée (minutes)' },
  'tarifs.aideDuree': {
    es: 'Es lo que sirve para calcular la espera que se anuncia al cliente. Si dudas, pon el tiempo más largo: vale más pasar antes de lo prometido que después.',
    fr: 'C’est cette durée qui sert à calculer l’attente annoncée au client. En cas de doute, indiquez le temps le plus long : mieux vaut passer avant l’heure promise qu’après.',
  },
  'tarifs.champNote': { es: 'Nota', fr: 'Note' },
  'tarifs.titre': { es: 'Tarifas', fr: 'Tarifs' },
  'tarifs.compteVisibles': {
    es: '{visibles} de {total} se muestran en la página de inicio, en este mismo orden.',
    fr: '{visibles} sur {total} s’affichent sur la page d’accueil, dans cet ordre exact.',
  },
  'tarifs.titreAjout': { es: 'Añadir un servicio', fr: 'Ajouter une prestation' },

  /* ---------------------------------------------------------------- */
  /*  Les chiffres du salon                                           */
  /* ---------------------------------------------------------------- */

  'chiffres.clientsDuJour': { es: 'clientes de hoy', fr: 'clients du jour' },
  'chiffres.servis': { es: 'atendidos', fr: 'servis' },
  'chiffres.annules': { es: 'anulados', fr: 'annulés' },
  'chiffres.enRetard': { es: 'llegaron tarde', fr: 'arrivés en retard' },
  'chiffres.absencesTotales': { es: '{n} ausencia en total|{n} ausencias en total', fr: '{n} absence au total|{n} absences au total' },
  'chiffres.attenteMoyenne': { es: 'espera media', fr: 'attente moyenne' },
  'chiffres.coupeMoyenne': { es: 'duración media de un corte', fr: 'durée moyenne d’une coupe' },
  'chiffres.reglageAbsent': { es: 'sin ajuste', fr: 'aucun réglage' },
  'chiffres.reglageActuel': { es: 'ajuste actual: {n} min', fr: 'réglage actuel : {n} min' },
  'chiffres.parInternet': { es: 'por internet', fr: 'par internet' },
  'chiffres.parQr': { es: 'por código QR', fr: 'par code QR' },
  'chiffres.auComptoir': { es: 'añadidos en mostrador', fr: 'ajoutés au comptoir' },
  'chiffres.titre': { es: 'Cifras', fr: 'Chiffres' },
  'chiffres.journeeDu': { es: 'Jornada del {date}', fr: 'Journée du {date}' },
  'chiffres.journeeFermee': { es: 'Jornada del {date} — cerrada', fr: 'Journée du {date} — fermée' },
  'chiffres.parFauteuil': { es: 'Por sillón', fr: 'Par fauteuil' },
  'chiffres.fauteuilServis': {
    es: '{nom}: {n} cliente atendido|{nom}: {n} clientes atendidos',
    fr: '{nom} : {n} client servi|{nom} : {n} clients servis',
  },
  'chiffres.fauteuilCoupeMoyenne': { es: ', corte medio {duree}', fr: ', coupe moyenne {duree}' },
  'chiffres.trenteDerniersJours': { es: 'Los últimos treinta días', fr: 'Les trente derniers jours' },
  'chiffres.telechargerCsv': { es: 'Descargar CSV', fr: 'Télécharger le CSV' },
  'chiffres.colJour': { es: 'Día', fr: 'Jour' },
  'chiffres.colTotal': { es: 'Total', fr: 'Total' },
  'chiffres.colServis': { es: 'Atendidos', fr: 'Servis' },
  'chiffres.colAnnules': { es: 'Anulados', fr: 'Annulés' },
  'chiffres.colAbsences': { es: 'Ausencias', fr: 'Absences' },
  'chiffres.colAttenteMoyenne': { es: 'Espera med.', fr: 'Attente moy.' },
  'chiffres.colInternetQr': { es: 'Internet / QR', fr: 'Internet / QR' },
  'chiffres.aucuneJournee': { es: 'Todavía no hay ninguna jornada registrada.', fr: 'Aucune journée n’est encore enregistrée.' },
  'chiffres.etatService': { es: 'Estado del servicio', fr: 'État du service' },
  'chiffres.baseEnLigne': { es: 'Base de datos: en línea', fr: 'Base de données : en ligne' },
  'chiffres.baseLectureSeule': { es: 'Base de datos: solo lectura — {motif}', fr: 'Base de données : lecture seule — {motif}' },
  'chiffres.baseMuette': { es: 'Base de datos: no responde — {motif}', fr: 'Base de données : ne répond pas — {motif}' },
  'chiffres.whatsapp': {
    es: 'WhatsApp: {etat} — {enAttente} en espera, {enEchec} con error',
    fr: 'WhatsApp : {etat} — {enAttente} en attente, {enEchec} en échec',
  },
  'chiffres.actif': { es: 'activo', fr: 'actif' },
  'chiffres.nonConfigure': { es: 'sin configurar', fr: 'non configuré' },
  'chiffres.ecransConnectes': { es: 'Pantallas conectadas en directo: {n}', fr: 'Écrans connectés en direct : {n}' },
  'chiffres.rapportErreurs': { es: 'Informe de errores: {etat}', fr: 'Rapport d’erreurs : {etat}' },
  'chiffres.versionDeployee': {
    es: 'Versión desplegada: {version} — zona horaria {fuseau}',
    fr: 'Version déployée : {version} — fuseau horaire {fuseau}',
  },
  'chiffres.versionInconnue': { es: 'desconocida', fr: 'inconnue' },

  /* ---------------------------------------------------------------- */
  /*  Conges et fermetures                                            */
  /* ---------------------------------------------------------------- */

  'conges.maintenant': { es: 'Ahora mismo', fr: 'En ce moment' },
  'conges.salonFerme': { es: 'El salón está cerrado', fr: 'Le salon est fermé' },
  'conges.jours': { es: '{n} día|{n} días', fr: '{n} jour|{n} jours' },
  'conges.badgeEnCours': { es: 'en curso', fr: 'en cours' },
  'conges.confirmerSuppression': {
    es: '¿Borrar el cierre del {date}?\nLos clientes podrán volver a pedir turno en esas fechas.',
    fr: 'Supprimer la fermeture du {date} ?\nLes clients pourront de nouveau prendre un tour à ces dates.',
  },
  'conges.periodeSupprimee': { es: 'Periodo borrado.', fr: 'Période supprimée.' },
  'conges.echecSuppression': { es: 'No se ha podido borrar.', fr: 'La suppression a échoué.' },
  'conges.motifExemple': { es: 'Vacaciones de agosto, festivo…', fr: 'Congés d’août, jour férié…' },
  'conges.periodeEnregistree': {
    es: 'Periodo guardado. Los clientes ya están informados.',
    fr: 'Période enregistrée. Les clients en sont déjà informés.',
  },
  'conges.echecEnregistrement': { es: 'No se ha podido guardar.', fr: 'L’enregistrement a échoué.' },
  'conges.du': { es: 'Desde', fr: 'Du' },
  'conges.au': { es: 'Hasta (incluido)', fr: 'Au (inclus)' },
  'conges.motif': { es: 'Motivo (opcional)', fr: 'Motif (facultatif)' },
  'conges.declarerBouton': { es: 'Declarar el cierre', fr: 'Déclarer la fermeture' },
  'conges.titre': { es: 'Vacaciones y cierres', fr: 'Congés et fermetures' },
  'conges.intro': {
    es: 'Durante un periodo declarado, nadie puede pedir turno y la página de inicio anuncia la fecha de reapertura. La fila del día nunca se interrumpe: los clientes que ya están se atienden.',
    fr: 'Pendant une période déclarée, personne ne peut prendre de tour et la page d’accueil annonce la date de réouverture. La file du jour n’est jamais interrompue : les clients déjà présents sont servis.',
  },
  'conges.prochaineAnnoncee': {
    es: 'Próximo cierre anunciado a los clientes: del {du} al {au}.',
    fr: 'Prochaine fermeture annoncée aux clients : du {du} au {au}.',
  },
  'conges.titreDeclarer': { es: 'Declarar un periodo', fr: 'Déclarer une période' },
  'conges.titreListe': { es: 'Periodos guardados', fr: 'Périodes enregistrées' },
  'conges.aucune': { es: 'No hay ningún cierre declarado.', fr: 'Aucune fermeture déclarée.' },

  /* ---------------------------------------------------------------- */
  /*  Les comptes du personnel                                        */
  /* ---------------------------------------------------------------- */

  'comptes.erreur.action': { es: 'La acción no se ha completado.', fr: 'L’action n’a pas abouti.' },
  'comptes.etat.actif': { es: 'activa', fr: 'actif' },
  'comptes.etat.inactif': { es: 'desactivada', fr: 'désactivé' },
  'comptes.etat.bloque': { es: 'bloqueada', fr: 'bloqué' },
  'comptes.etat.motDePasseProvisoire': { es: 'contraseña provisional', fr: 'mot de passe provisoire' },
  'comptes.action.renommer': { es: 'Renombrar', fr: 'Renommer' },
  'comptes.invite.nomComplet': { es: 'Nombre completo:', fr: 'Nom complet :' },
  'comptes.succes.nomChange': { es: 'Nombre cambiado.', fr: 'Le nom a été modifié.' },
  'comptes.action.desactiver': { es: 'Desactivar', fr: 'Désactiver' },
  'comptes.action.reactiver': { es: 'Reactivar', fr: 'Réactiver' },
  'comptes.succes.desactive': { es: 'Cuenta desactivada.', fr: 'Le compte a été désactivé.' },
  'comptes.succes.reactive': { es: 'Cuenta reactivada.', fr: 'Le compte a été réactivé.' },
  'comptes.action.passerCoiffeur': { es: 'Pasar a peluquero', fr: 'Passer en coiffeur' },
  'comptes.action.passerGerant': { es: 'Pasar a gerente', fr: 'Passer en gérant' },
  'comptes.succes.roleModifie': { es: 'Rol modificado.', fr: 'Le rôle a été modifié.' },
  'comptes.action.nouveauMotDePasse': { es: 'Contraseña nueva', fr: 'Nouveau mot de passe' },
  // Le minimum est un PARAMETRE : ecrit en dur, il aurait menti le jour ou
  // PASSWORD_MIN_LENGTH change sur le serveur, et le gerant aurait tape un mot
  // de passe refuse sans comprendre pourquoi.
  'comptes.invite.nouveauMotDePasse': {
    es: 'Contraseña provisional nueva para {identifiant} ({min} caracteres como mínimo):',
    fr: 'Nouveau mot de passe provisoire pour {identifiant} ({min} caractères au minimum) :',
  },
  'comptes.succes.motDePasseReinitialise': {
    es: 'Contraseña restablecida. La cuenta tendrá que cambiarla al entrar.',
    fr: 'Le mot de passe a été réinitialisé. Le compte devra le changer à la connexion.',
  },
  'comptes.action.debloquer': { es: 'Desbloquear', fr: 'Débloquer' },
  'comptes.succes.debloque': { es: 'Cuenta desbloqueada.', fr: 'Le compte a été débloqué.' },
  'comptes.champ.identifiant.exemple': { es: 'usuario', fr: 'identifiant' },
  'comptes.champ.nomComplet': { es: 'Nombre completo', fr: 'Nom complet' },
  'comptes.champ.motDePasse': { es: 'Contraseña provisional', fr: 'Mot de passe provisoire' },
  'comptes.succes.creation': {
    es: 'Cuenta creada. Dale su contraseña provisional.',
    fr: 'Le compte est créé. Communiquez-lui son mot de passe provisoire.',
  },
  'comptes.erreur.creation': { es: 'No se ha podido crear.', fr: 'La création n’a pas abouti.' },
  'comptes.champ.identifiant': { es: 'Usuario', fr: 'Identifiant' },
  'comptes.champ.identifiant.aide': {
    es: 'Letras sin acento, cifras, punto, guion y subrayado.',
    fr: 'Lettres sans accent, chiffres, point, tiret et tiret bas.',
  },
  'comptes.champ.role': { es: 'Rol', fr: 'Rôle' },
  'comptes.champ.motDePasse.aide': {
    es: 'La cuenta tendrá que cambiarla al entrar la primera vez.',
    fr: 'Le compte devra le changer à sa première connexion.',
  },
  'comptes.action.creer': { es: 'Crear la cuenta', fr: 'Créer le compte' },
  'comptes.titre': { es: 'Cuentas del salón', fr: 'Comptes du salon' },
  'comptes.action.ajouter': { es: 'Añadir una cuenta', fr: 'Ajouter un compte' },

  /* ---------------------------------------------------------------- */
  /*  Le code QR et l'ecran du salon, cote gestion                    */
  /* ---------------------------------------------------------------- */

  'affiche.qr.alt': {
    es: 'Código QR que lleva a la página para pedir turno en el salón',
    fr: 'Code QR qui mène à la page pour prendre son tour au salon',
  },
  'affiche.titre': { es: 'Código QR del salón', fr: 'Code QR du salon' },
  'affiche.intro': {
    es: 'Pégalo en el escaparate o en el espejo. El cliente lo escanea, rellena tres campos y entra en la misma fila que quien pide turno por internet.',
    fr: 'Collez-le en vitrine ou sur le miroir. Le client le scanne, remplit trois champs et entre dans la même file que ceux qui prennent leur tour par internet.',
  },
  'affiche.qr.legende': { es: 'Escanea para pedir tu turno', fr: 'Scannez pour prendre votre tour' },
  'affiche.action.ouvrirAffiche': { es: 'Abrir el cartel para imprimir', fr: 'Ouvrir l’affiche à imprimer' },
  'affiche.action.telechargerSvg': { es: 'Descargar (SVG)', fr: 'Télécharger (SVG)' },
  'affiche.action.telechargerPng': { es: 'Descargar (PNG)', fr: 'Télécharger (PNG)' },
  'affiche.action.copierAdresse': { es: 'Copiar la dirección', fr: 'Copier l’adresse' },
  'affiche.succes.adresseCopiee': { es: 'Dirección copiada.', fr: 'L’adresse a été copiée.' },
  'affiche.invite.copierAdresse': { es: 'Copia esta dirección:', fr: 'Copiez cette adresse :' },
  'affiche.ecran.titre': { es: 'Pantalla del salón', fr: 'Écran du salon' },
  'affiche.ecran.intro': {
    es: 'Una pantalla o una tablet en la sala de espera: el turno en curso en grande, los siguientes debajo, y el código QR siempre visible. Se actualiza sola.',
    fr: 'Un écran ou une tablette dans la salle d’attente : le tour en cours en grand, les suivants en dessous, et le code QR toujours visible. L’affichage se met à jour tout seul.',
  },
  'affiche.ecran.action.ouvrir': { es: 'Abrir la pantalla', fr: 'Ouvrir l’écran' },
  'affiche.ecran.action.copierAdresse': { es: 'Copiar la dirección de la pantalla', fr: 'Copier l’adresse de l’écran' },
  'affiche.ecran.succes.adresseCopiee': { es: 'Dirección de la pantalla copiada.', fr: 'L’adresse de l’écran a été copiée.' },
  'affiche.ecran.aide.avecCle': {
    es: 'Esa dirección lleva una clave: es lo que mantiene la pantalla fuera del alcance de quien no la conozca, ya que se muestran los apellidos. Cópiala entera en el navegador de la pantalla y ponlo en pantalla completa (F11). Si la clave cambia, hay que volver a poner la dirección.',
    fr: 'Cette adresse comporte une clé : c’est elle qui met l’écran hors de portée de qui ne la connaît pas, puisque les noms de famille y sont affichés. Copiez-la en entier dans le navigateur de l’écran, puis passez en plein écran (F11). Si la clé change, il faut saisir de nouveau l’adresse.',
  },
  'affiche.ecran.aide.sansCle': {
    es: 'Ábrela en el navegador de la pantalla y ponlo en pantalla completa (F11). No hace falta iniciar sesión, y por eso la página solo muestra números, nombres de pila y sillones. En Ajustes se puede quitar los nombres, o mostrar también los apellidos (entonces se añade una clave a la dirección).',
    fr: 'Ouvrez-la dans le navigateur de l’écran, puis passez en plein écran (F11). Aucune connexion n’est nécessaire, et c’est pourquoi la page n’affiche que les numéros, les prénoms et les fauteuils. Dans les réglages, vous pouvez retirer les prénoms, ou afficher aussi les noms de famille (une clé est alors ajoutée à l’adresse).',
  },
  'affiche.impression.titre': { es: 'Antes de imprimir', fr: 'Avant d’imprimer' },
  'affiche.impression.adresseDefinitive': {
    es: 'Comprueba que la dirección de arriba es la dirección pública definitiva del salón: un código QR impreso no se corrige.',
    fr: 'Vérifiez que l’adresse ci-dessus est bien l’adresse publique définitive du salon : un code QR imprimé ne se corrige pas.',
  },
  'affiche.impression.testerSoiMeme': {
    es: 'Escanéalo tú mismo con un móvil antes de llevarlo a la imprenta.',
    fr: 'Scannez-le vous-même avec un téléphone avant de le porter à l’imprimeur.',
  },
  'affiche.impression.formats': {
    es: 'El SVG es el formato para la imprenta; el PNG basta para imprimir en la oficina.',
    fr: 'Le SVG est le format destiné à l’imprimeur ; le PNG suffit pour une impression au bureau.',
  },

  /* ---------------------------------------------------------------- */
  /*  Statuts et sources, cote gestion                                */
  /* ---------------------------------------------------------------- */

  'statut.WAITING': { es: 'Esperando', fr: 'En attente' },
  'statut.LATE': { es: 'Esperando · ya estuvo ausente', fr: 'En attente · déjà absent' },
  'statut.CALLED': { es: 'Llamado', fr: 'Appelé' },
  'statut.IN_SERVICE': { es: 'En el sillón', fr: 'Au fauteuil' },
  'statut.COMPLETED': { es: 'Atendido', fr: 'Servi' },
  'statut.CANCELLED': { es: 'Anulado', fr: 'Annulé' },
  'statut.NO_SHOW': { es: 'Ausente', fr: 'Absent' },
  'source.ONLINE': { es: 'Por internet', fr: 'Par internet' },
  'source.QR': { es: 'Código QR', fr: 'Code QR' },
  'source.COMPTOIR': { es: 'Mostrador', fr: 'Comptoir' },
};
