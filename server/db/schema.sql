-- =====================================================================
--  Peluqueria HARON - schema PostgreSQL
--
--  Ce fichier est REJOUE A CHAQUE DEMARRAGE : tout y est idempotent
--  (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE).
--
--  La base garde les invariants que le code ne doit jamais pouvoir violer,
--  meme si deux gestes se croisent a la milliseconde :
--
--    1. deux clients ne peuvent pas occuper la meme position dans la file
--       d'une meme journee          -> index unique (jour, rang)
--    2. deux clients ne peuvent pas porter le meme numero dans la journee
--                                   -> index unique (jour, numero)
--    3. un seul client a la fois est appele ou en cours de service
--                                   -> index unique partiel sur (jour)
--       (le salon a un fauteuil ; voir docs/ARCHITECTURE.md pour en ouvrir
--        plusieurs)
--    4. un ticket d'une journee close ne bouge plus
--                                   -> declencheur, erreur HR001
--    5. deux liens de suivi ne peuvent pas se confondre
--                                   -> index unique sur le condensat du jeton
-- =====================================================================

SET client_min_messages = warning;

-- ---------------------------------------------------------------------
--  Metadonnees applicatives
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_meta (
  key         text PRIMARY KEY,
  value       text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
--  Personnel
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateurs (
  id                        uuid PRIMARY KEY,
  identifiant               text NOT NULL,
  identifiant_lower         text NOT NULL,
  nom_complet               text NOT NULL,
  mot_de_passe_hash         text NOT NULL,
  role                      text NOT NULL,
  actif                     boolean NOT NULL DEFAULT TRUE,
  doit_changer_mot_de_passe boolean NOT NULL DEFAULT FALSE,
  tentatives_echouees       integer NOT NULL DEFAULT 0,
  verrouille_jusqu_a        timestamptz,
  derniere_connexion_at     timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_admis
    CHECK (role IN ('COIFFEUR', 'GERANT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS utilisateurs_identifiant_unique ON utilisateurs (identifiant_lower);

-- ---------------------------------------------------------------------
--  Sessions du personnel
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id              uuid PRIMARY KEY,
  utilisateur_id  uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  token_hash      text NOT NULL,
  csrf_secret     text NOT NULL,
  ip              text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  revoked_reason  text
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_unique ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_utilisateur ON sessions (utilisateur_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS sessions_expiration ON sessions (expires_at);

-- ---------------------------------------------------------------------
--  Reglages du salon (cle / valeur, catalogue declare dans core/reglages.js)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reglages (
  cle         text PRIMARY KEY,
  valeur      text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES utilisateurs(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
--  Journees
--
--  Une ligne par journee d'ouverture. Elle porte les compteurs de la
--  journee : c'est la ligne qu'on VERROUILLE (SELECT ... FOR UPDATE) pour
--  attribuer un numero et un rang, ce qui serialise proprement deux prises
--  de tour simultanees sans verrouiller toute la table des tickets.
--
--  La duree moyenne d'une coupe y est figee a l'ouverture : les statistiques
--  d'une journee passee gardent le reglage qui etait celui du jour.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journees (
  jour                   date PRIMARY KEY,
  ouverte                boolean NOT NULL DEFAULT TRUE,
  dernier_numero         integer NOT NULL DEFAULT 0,
  dernier_rang           integer NOT NULL DEFAULT 0,
  duree_moyenne_minutes  integer NOT NULL DEFAULT 20,
  ouverte_at             timestamptz NOT NULL DEFAULT now(),
  close_at               timestamptz,
  close_par              text
);

DO $$ BEGIN
  ALTER TABLE journees ADD CONSTRAINT journees_compteurs_positifs
    CHECK (dernier_numero >= 0 AND dernier_rang >= 0 AND duree_moyenne_minutes BETWEEN 1 AND 240);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS journees_ouvertes ON journees (jour) WHERE ouverte;

-- ---------------------------------------------------------------------
--  Fermetures : conges, jours feries, fermeture exceptionnelle
--
--  Une periode fermee couvre ses deux bornes incluses. Pendant cette
--  periode, la prise de tour est refusee avec la date de reouverture ;
--  la file du jour, elle, continue de fonctionner normalement (un conge
--  declare pour la semaine prochaine ne gene pas le service d'aujourd'hui).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fermetures (
  id          uuid PRIMARY KEY,
  du          date NOT NULL,
  au          date NOT NULL,
  motif       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES utilisateurs(id) ON DELETE SET NULL
);

DO $$ BEGIN
  ALTER TABLE fermetures ADD CONSTRAINT fermetures_bornes_ordonnees CHECK (au >= du);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Deux periodes de conges ne peuvent pas se chevaucher : sinon, supprimer
-- l'une laisserait le salon fermé sans que personne comprenne pourquoi.
CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$ BEGIN
  ALTER TABLE fermetures ADD CONSTRAINT fermetures_sans_chevauchement
    EXCLUDE USING gist (daterange(du, au, '[]') WITH &&);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS fermetures_periode ON fermetures (du, au);

-- ---------------------------------------------------------------------
--  Tickets : la file
--
--  numero  : 1, 2, 3... dans la journee ; affiche « A001 », « A024 ».
--  rang    : ordre dans la file. JAMAIS REUTILISE. Un client remis en fin
--            de file pour retard recoit un rang NEUF, superieur a tous les
--            autres ; son numero, lui, ne change pas (c'est son ticket).
--            L'index unique (jour, rang) rend donc structurellement
--            impossible que deux clients actifs partagent une position.
--  statut  : WAITING     en attente
--            LATE        en attente, deja absent au moins une fois
--            CALLED      appele, on l'attend au fauteuil
--            IN_SERVICE  en cours de coupe
--            COMPLETED   servi
--            CANCELLED   annule (par le salon, ou a la cloture de la journee)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id              uuid PRIMARY KEY,
  jour            date NOT NULL REFERENCES journees(jour) ON DELETE RESTRICT,
  numero          integer NOT NULL,
  numero_affiche  text NOT NULL,
  rang            integer NOT NULL,
  prenom          text NOT NULL,
  nom             text NOT NULL,
  -- Numero WhatsApp : chiffre (AES-256-GCM), avec index aveugle pour
  -- reconnaitre « ce numero a deja un tour aujourd hui » sans dechiffrer,
  -- et les quatre derniers chiffres en clair pour l'affichage masque.
  telephone_enc   text NOT NULL,
  telephone_idx   text NOT NULL,
  telephone_fin   text NOT NULL,
  source          text NOT NULL,
  statut          text NOT NULL,
  retards         integer NOT NULL DEFAULT 0,
  -- Lien de suivi. Deux colonnes, deux usages :
  --   jeton_hash : la cle de recherche. Un condensat SHA-256 ne se renverse
  --                pas : personne ne remonte d'un ticket vers son lien.
  --   jeton_enc  : le jeton chiffre (AES-256-GCM), UNIQUEMENT pour remettre le
  --                lien dans les messages WhatsApp qui suivent la confirmation.
  --                La cle vit dans l'environnement, jamais dans la base : un
  --                vol de la seule base ne donne donc aucun lien de suivi.
  jeton_hash      text NOT NULL,
  jeton_enc       text,
  arrive_at       timestamptz NOT NULL DEFAULT now(),
  file_depuis_at  timestamptz NOT NULL DEFAULT now(),
  statut_at       timestamptz NOT NULL DEFAULT now(),
  appele_at       timestamptz,
  service_at      timestamptz,
  termine_at      timestamptz,
  motif           text,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE tickets ADD CONSTRAINT tickets_statut_admis
    CHECK (statut IN ('WAITING', 'LATE', 'CALLED', 'IN_SERVICE', 'COMPLETED', 'CANCELLED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tickets ADD CONSTRAINT tickets_source_admise
    CHECK (source IN ('ONLINE', 'QR', 'COMPTOIR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tickets ADD CONSTRAINT tickets_compteurs_positifs
    CHECK (numero >= 1 AND rang >= 1 AND retards >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INVARIANT 1 : jamais deux clients a la meme position dans la journee.
CREATE UNIQUE INDEX IF NOT EXISTS tickets_journee_rang ON tickets (jour, rang);
-- INVARIANT 2 : jamais deux clients avec le meme numero dans la journee.
CREATE UNIQUE INDEX IF NOT EXISTS tickets_journee_numero ON tickets (jour, numero);
-- INVARIANT 3 : un seul client appele ou en cours a la fois.
CREATE UNIQUE INDEX IF NOT EXISTS tickets_un_seul_en_cours
  ON tickets (jour) WHERE statut IN ('CALLED', 'IN_SERVICE');
-- INVARIANT 5 : un lien de suivi designe un ticket et un seul.
CREATE UNIQUE INDEX IF NOT EXISTS tickets_jeton_unique ON tickets (jeton_hash);

-- La file du jour est LA requete de l'application : elle doit etre instantanee.
CREATE INDEX IF NOT EXISTS tickets_file_active ON tickets (jour, rang)
  WHERE statut IN ('WAITING', 'LATE', 'CALLED', 'IN_SERVICE');
-- Un numero qui redemande un tour dans la journee : recherche par index aveugle.
CREATE INDEX IF NOT EXISTS tickets_telephone_jour ON tickets (jour, telephone_idx);
CREATE INDEX IF NOT EXISTS tickets_jour_arrivee ON tickets (jour, arrive_at);

-- ---------------------------------------------------------------------
--  Historique d'un ticket
--
--  Chaque changement d'etat y laisse une ligne : c'est ce qui permet de dire
--  « Ahmed a ete appele a 10 h 12, absent, remis en fin de file, rappele a
--  10 h 41, servi a 10 h 43 ». Rien n'est jamais efface d'un ticket.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_evenements (
  id                  uuid PRIMARY KEY,
  ticket_id           uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  jour                date NOT NULL,
  statut              text NOT NULL,
  rang                integer,
  par_utilisateur_id  uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  par_libelle         text,
  detail              text,
  at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_evenements_ticket ON ticket_evenements (ticket_id, at);
CREATE INDEX IF NOT EXISTS ticket_evenements_jour ON ticket_evenements (jour, at);

-- ---------------------------------------------------------------------
--  Boite d'envoi WhatsApp
--
--  Un message n'est jamais envoye depuis la route : il est ECRIT ICI DANS LA
--  MEME TRANSACTION que le geste metier. Un ROLLBACK n'annonce rien, un
--  COMMIT n'oublie rien. Une tache de fond vide la boite ; l'unicite
--  (ticket, type, passage) garantit qu'un client ne recoit jamais deux fois
--  le meme message, meme si le processus meurt en plein envoi.
--
--  « passage » vaut retards + 1 : un client rappele apres une absence recoit
--  bien un nouveau « c'est votre tour », et un seul.
--
--  Le contenu porte le lien de suivi EN CLAIR : il est donc chiffre, jamais
--  journalise, et efface des que le message est parti.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS envois_whatsapp (
  id                uuid PRIMARY KEY,
  ticket_id         uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type              text NOT NULL,
  passage           integer NOT NULL DEFAULT 1,
  statut            text NOT NULL DEFAULT 'EN_ATTENTE',
  destinataire_enc  text NOT NULL,
  contenu_enc       text,
  essais            integer NOT NULL DEFAULT 0,
  derniere_erreur   text,
  prochain_essai    timestamptz NOT NULL DEFAULT now(),
  message_id        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  envoye_at         timestamptz
);

DO $$ BEGIN
  ALTER TABLE envois_whatsapp ADD CONSTRAINT envois_type_admis
    CHECK (type IN ('CONFIRMATION', 'APPROCHE', 'TOUR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE envois_whatsapp ADD CONSTRAINT envois_statut_admis
    CHECK (statut IN ('EN_ATTENTE', 'ENVOYE', 'ECHEC', 'DESACTIVE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS envois_unicite ON envois_whatsapp (ticket_id, type, passage);
CREATE INDEX IF NOT EXISTS envois_a_traiter ON envois_whatsapp (prochain_essai)
  WHERE statut = 'EN_ATTENTE';

-- ---------------------------------------------------------------------
--  INVARIANT 4 : un ticket d'une journee close ne bouge plus.
--
--  La file active est celle du jour. Une fois la journee close, ses tickets
--  deviennent de l'historique : les statistiques s'appuient dessus, et rien
--  ne doit pouvoir les reecrire - pas meme un onglet reste ouvert sur la
--  tablette du salon depuis la veille.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION haron_journee_close() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_ouverte boolean;
BEGIN
  SELECT ouverte INTO v_ouverte FROM journees WHERE jour = COALESCE(NEW.jour, OLD.jour);
  IF v_ouverte IS NOT NULL AND v_ouverte = FALSE THEN
    RAISE EXCEPTION 'La journée du % est close : ce ticket appartient à l''historique et ne peut plus être modifié.',
      to_char(COALESCE(NEW.jour, OLD.jour), 'DD/MM/YYYY')
      USING ERRCODE = 'HR001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tickets_journee_close ON tickets;
CREATE TRIGGER tickets_journee_close
  BEFORE INSERT OR UPDATE OR DELETE ON tickets
  FOR EACH ROW EXECUTE FUNCTION haron_journee_close();

-- La cloture elle-meme doit pouvoir annuler les tickets restes actifs : elle
-- met les tickets a jour AVANT de passer la journee a « close », donc le
-- declencheur ne la gene pas. Voir server/domain/journee.js (cloturer).

-- ---------------------------------------------------------------------
--  Horodatage automatique
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION haron_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS utilisateurs_touch ON utilisateurs;
CREATE TRIGGER utilisateurs_touch BEFORE UPDATE ON utilisateurs
  FOR EACH ROW EXECUTE FUNCTION haron_touch_updated_at();
