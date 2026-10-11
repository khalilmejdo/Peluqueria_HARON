/**
 * L'AGENDA — les rendez-vous du jour, par professionnel.
 *
 * Une colonne par fauteuil qui prend des rendez-vous, les rendez-vous dans
 * l'ordre de la journee, et sur chacun les gestes du moment : « Arrive » quand
 * le client pousse la porte, « Installer » quand il passe au fauteuil (il
 * devient alors un tour de la file, servi comme les autres), « Absent » s'il
 * ne vient pas. Le salon pose aussi les rendez-vous pris au telephone, sur les
 * memes heures libres que le site.
 *
 * L'ecran se relit seul toutes les trente secondes tant qu'il est affiche : un
 * rendez-vous pris en ligne apparait sans qu'on touche a rien.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';
import { t, dateLongue } from '../langue.js';

const plusJours = (iso, n) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
};

let minuterie = null;

export async function vueAgenda(conteneur, contexte, jourDemande = null) {
  clearInterval(minuterie);
  const donnees = await api.get('/api/agenda' + (jourDemande ? '?jour=' + jourDemande : ''));
  const { jour, aujourdhui } = donnees;
  const alerte = el('p.alerte.alerte--refus', { role: 'alert', hidden: true });
  const dire = (err) => {
    alerte.textContent = err instanceof ErreurApi ? err.message : t('agenda.echec');
    alerte.hidden = false;
    annoncer(alerte.textContent);
  };
  const recharger = (j = jour) => vueAgenda(conteneur, contexte, j);
  const agir = async (fn, message) => {
    alerte.hidden = true;
    try {
      await fn();
      if (message) annoncer(message);
      await recharger();
    } catch (err) {
      dire(err);
    }
  };

  // La relecture s'arrete d'elle-meme des qu'on quitte l'onglet.
  minuterie = setInterval(() => {
    if (!conteneur.isConnected || !conteneur.querySelector('[data-agenda]')) { clearInterval(minuterie); return; }
    if (document.visibilityState !== 'visible' || conteneur.querySelector('[data-saisie-ouverte]')) return;
    recharger().catch(() => {});
  }, 30000);

  /* ---------------- la barre du jour ---------------- */

  const choixJour = el('input.agenda__date', { type: 'date', value: jour, 'aria-label': t('agenda.choisirJour') });
  choixJour.addEventListener('change', () => { if (choixJour.value) recharger(choixJour.value); });
  const barre = el('div.agenda__barre',
    el('button.bouton.bouton--discret.bouton--petit', { type: 'button', texte: '‹', 'aria-label': t('agenda.veille'), surClick: () => recharger(plusJours(jour, -1)) }),
    el('div.agenda__jour',
      el('p.agenda__jour-nom', { texte: jour === aujourdhui ? t('agenda.aujourdhui') : dateLongue(jour) }),
      jour === aujourdhui ? el('p.texte-doux', { texte: dateLongue(jour) }) : null),
    el('button.bouton.bouton--discret.bouton--petit', { type: 'button', texte: '›', 'aria-label': t('agenda.lendemain'), surClick: () => recharger(plusJours(jour, 1)) }),
    choixJour,
    jour !== aujourdhui ? el('button.bouton.bouton--discret.bouton--petit', { type: 'button', texte: t('agenda.revenirAujourdhui'), surClick: () => recharger(aujourdhui) }) : null);

  /* ---------------- un rendez-vous ---------------- */

  const STATUTS = { CONFIRME: 'neutre', ARRIVE: 'ok', INSTALLE: 'ok', ANNULE: 'refus', ABSENT: 'attention' };

  /** Le panneau « deplacer » : un jour, puis les heures libres de ce jour. */
  function panneauDeplacer(rdv, carte) {
    const date = el('input', { type: 'date', value: rdv.jour, min: aujourdhui });
    const heures = el('div.agenda__heures');
    const charger = async () => {
      remplacer(heures, el('p.texte-doux', { texte: t('agenda.chargement') }));
      try {
        const r = await api.get('/api/agenda/creneaux?jour=' + date.value + '&posteId=' + rdv.posteId + '&saufId=' + rdv.id);
        remplacer(heures, r.creneaux.length
          ? r.creneaux.map((c) => el('button.puce', {
            type: 'button',
            texte: c.heure,
            surClick: () => agir(() => api.post('/api/agenda/' + rdv.id + '/deplacer', { jour: date.value, heure: c.heure }), t('agenda.deplace')),
          }))
          : el('p.texte-doux', { texte: t('agenda.aucuneHeure') }));
      } catch (err) {
        dire(err);
      }
    };
    date.addEventListener('change', charger);
    const panneau = el('div.agenda__panneau', { donnees: { saisieOuverte: '1' } },
      el('p.etiquette', { texte: t('agenda.deplacerVers') }), date, heures,
      el('button.bouton.bouton--lien', { type: 'button', texte: t('commun.annuler'), surClick: () => panneau.remove() }));
    carte.append(panneau);
    charger();
  }

  function carteRdv(rdv) {
    const actif = rdv.statut === 'CONFIRME' || rdv.statut === 'ARRIVE';
    const duJour = rdv.jour === aujourdhui;
    const bouton = (texte, surClick, classe = 'bouton--discret') => el('button.bouton.bouton--petit.' + classe, { type: 'button', texte, surClick });
    const carte = el('li.rdv.rdv--' + rdv.statut.toLowerCase(),
      el('div.rdv__heure', el('span.rdv__debut', { texte: rdv.heure }), el('span.rdv__fin', { texte: rdv.heureFin })),
      el('div.rdv__corps',
        el('p.rdv__nom', { texte: rdv.prenom + ' ' + rdv.nom }),
        el('p.rdv__prestations', {
          texte: (rdv.prestations.length ? rdv.prestations.map((p) => p.nombre).join(' · ') : t('agenda.sansPrecision'))
            + ' — ' + t('agenda.minutes', { n: rdv.duree }),
        }),
        el('p.rdv__meta',
          el('span.pastille.pastille--' + (STATUTS[rdv.statut] || 'neutre'), { texte: t('agenda.statut.' + rdv.statut) }),
          rdv.source === 'ONLINE' ? el('span.rdv__source', { texte: t('agenda.enLigne') }) : null,
          rdv.posteChoisi ? el('span.rdv__source', { texte: t('agenda.aChoisi') }) : null),
        rdv.note ? el('p.rdv__note', { texte: rdv.note }) : null,
        actif
          ? el('div.rdv__actions',
            duJour && rdv.statut === 'CONFIRME' ? bouton(t('agenda.geste.arrive'), () => agir(() => api.post('/api/agenda/' + rdv.id + '/statut', { statut: 'ARRIVE' }), t('agenda.dit.arrive'))) : null,
            duJour ? bouton(t('agenda.geste.installer'), () => agir(() => api.post('/api/agenda/' + rdv.id + '/installer'), t('agenda.dit.installe')), 'bouton--principal') : null,
            bouton(t('agenda.geste.deplacer'), () => { if (!carte.querySelector('.agenda__panneau')) panneauDeplacer(rdv, carte); }),
            bouton('WhatsApp', async () => {
              try {
                const r = await api.get('/api/agenda/' + rdv.id + '/whatsapp');
                if (r.lienWhatsapp) window.open(r.lienWhatsapp, '_blank', 'noopener');
              } catch (err) {
                dire(err);
              }
            }),
            duJour ? bouton(t('agenda.geste.absent'), () => agir(() => api.post('/api/agenda/' + rdv.id + '/statut', { statut: 'ABSENT' }), t('agenda.dit.absent'))) : null,
            bouton(t('agenda.geste.annuler'), () => {
              const motif = window.prompt(t('agenda.confirmerAnnulation', { prenom: rdv.prenom }), '');
              if (motif === null) return;
              agir(() => api.post('/api/agenda/' + rdv.id + '/statut', { statut: 'ANNULE', motif: motif || undefined }), t('agenda.dit.annule'));
            }, 'bouton--lien.bouton--danger'))
          : (rdv.statut === 'ABSENT' && duJour
            ? el('div.rdv__actions', bouton(t('agenda.geste.remettre'), () => agir(() => api.post('/api/agenda/' + rdv.id + '/statut', { statut: 'CONFIRME' }), null)))
            : null)));
    return carte;
  }

  /* ---------------- les colonnes ---------------- */

  const colonnes = donnees.postes.map((p) => {
    const siens = donnees.rdvs.filter((r) => r.posteId === p.id);
    const aVenir = siens.filter((r) => r.statut === 'CONFIRME' || r.statut === 'ARRIVE').length;
    return el('section.agenda__colonne',
      el('h2.agenda__pro', el('span.agenda__pro-nom', { texte: p.professionnel }), el('span.agenda__pro-compte', { texte: t('agenda.compte', { n: aVenir }) })),
      siens.length
        ? el('ul.agenda__liste', siens.map(carteRdv))
        : el('p.agenda__vide', { texte: t('agenda.rienCeJour') }));
  });

  /* ---------------- poser un rendez-vous ---------------- */

  async function formulaireNouveau() {
    const tarifs = (await api.get('/api/tarifas')).items.filter((x) => x.visible);
    const cases = tarifs.map((x) => {
      const c = el('input', { type: 'checkbox', value: x.id, id: 'a-p-' + x.id });
      return { c, noeud: el('label.agenda__presta', { for: 'a-p-' + x.id }, c, el('span', { texte: x.nombre + ' · ' + x.duracionMin + ' min' })) };
    });
    const pro = el('select', { id: 'a-pro' },
      el('option', { value: '', texte: t('agenda.sansPreference') }),
      donnees.postes.map((p) => el('option', { value: p.id, texte: p.professionnel })));
    const date = el('input', { type: 'date', id: 'a-jour', value: jour < aujourdhui ? aujourdhui : jour, min: aujourdhui });
    const heures = el('div.agenda__heures');
    const prenom = el('input', { type: 'text', id: 'a-prenom', required: true, autocomplete: 'off' });
    const nom = el('input', { type: 'text', id: 'a-nom', required: true, autocomplete: 'off' });
    const tel = el('input', { type: 'tel', id: 'a-tel', required: true, inputmode: 'tel', autocomplete: 'off' });
    const note = el('input', { type: 'text', id: 'a-note', maxlength: '200' });
    let heure = null;
    const ids = () => cases.filter((x) => x.c.checked).map((x) => x.c.value);

    const charger = async () => {
      heure = null;
      remplacer(heures, el('p.texte-doux', { texte: t('agenda.chargement') }));
      try {
        const r = await api.get('/api/agenda/creneaux?jour=' + date.value + '&tarifaIds=' + ids().join(',') + (pro.value ? '&posteId=' + pro.value : ''));
        if (!r.etat.ouvert) {
          remplacer(heures, el('p.alerte.alerte--attention', { texte: t('agenda.ferme.' + r.etat.raison) }));
          return;
        }
        remplacer(heures, r.creneaux.length
          ? r.creneaux.map((c) => {
            const b = el('button.puce', { type: 'button', texte: c.heure, 'aria-pressed': 'false' });
            b.addEventListener('click', () => {
              heure = c.heure;
              for (const autre of heures.querySelectorAll('.puce')) autre.setAttribute('aria-pressed', 'false');
              b.setAttribute('aria-pressed', 'true');
            });
            return b;
          })
          : el('p.texte-doux', { texte: t('agenda.aucuneHeure') }));
      } catch (err) {
        dire(err);
      }
    };
    for (const x of cases) x.c.addEventListener('change', charger);
    pro.addEventListener('change', charger);
    date.addEventListener('change', charger);

    const panneau = el('form.carte.agenda__nouveau', {
      donnees: { saisieOuverte: '1' },
      surSubmit: async (evenement) => {
        evenement.preventDefault();
        if (!heure) { dire(new ErreurApi(t('agenda.choisirHeure'))); return; }
        alerte.hidden = true;
        try {
          await api.post('/api/agenda', {
            prenom: prenom.value.trim(), nom: nom.value.trim(), telephone: tel.value.trim(),
            tarifaIds: ids(), posteId: pro.value || undefined, jour: date.value, heure, note: note.value.trim() || undefined,
          });
          annoncer(t('agenda.pose'));
          await recharger(date.value);
        } catch (err) {
          dire(err);
        }
      },
    },
    el('h2.reglages__titre', { texte: t('agenda.nouveau') }),
    cases.length ? el('div.champ', el('p.etiquette', { texte: t('agenda.prestations') }), el('div.agenda__prestas', cases.map((x) => x.noeud))) : null,
    el('div.agenda__duo',
      el('div.champ', el('label', { for: 'a-pro', texte: t('agenda.professionnel') }), pro),
      el('div.champ', el('label', { for: 'a-jour', texte: t('agenda.jour') }), date)),
    el('div.champ', el('p.etiquette', { texte: t('agenda.heure') }), heures),
    el('div.agenda__duo',
      el('div.champ', el('label', { for: 'a-prenom', texte: t('file.champPrenom') }), prenom),
      el('div.champ', el('label', { for: 'a-nom', texte: t('file.champNom') }), nom)),
    el('div.agenda__duo',
      el('div.champ', el('label', { for: 'a-tel', texte: t('file.champWhatsapp') }), tel),
      el('div.champ', el('label', { for: 'a-note', texte: t('agenda.note') }), note)),
    el('div.agenda__pied',
      el('button.bouton.bouton--principal', { type: 'submit', texte: t('agenda.poser') }),
      el('button.bouton.bouton--lien', { type: 'button', texte: t('commun.annuler'), surClick: () => recharger() })));
    charger();
    return panneau;
  }

  const zoneNouveau = el('div');
  const boutonNouveau = el('button.bouton.bouton--principal', {
    type: 'button',
    texte: t('agenda.nouveau'),
    surClick: async () => {
      boutonNouveau.disabled = true;
      try {
        remplacer(zoneNouveau, await formulaireNouveau());
        zoneNouveau.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        dire(err);
        boutonNouveau.disabled = false;
      }
    },
  });

  remplacer(conteneur,
    el('div.enveloppe.agenda', { donnees: { agenda: '1' } },
      el('header.vue__tete.agenda__tete',
        el('div',
          el('h1.titre-page', { texte: t('agenda.titre') }),
          el('p.texte-doux', { texte: t(donnees.enLigne ? 'agenda.enLigneOuvert' : 'agenda.enLigneFerme') })),
        donnees.etat.ouvert ? boutonNouveau : null),
      !donnees.etat.ouvert ? el('p.alerte.alerte--attention', { texte: t('agenda.ferme.' + donnees.etat.raison) }) : null,
      alerte,
      barre,
      zoneNouveau,
      donnees.plages.length || donnees.rdvs.length
        ? el('div.agenda__colonnes.agenda__colonnes--' + Math.min(colonnes.length, 4), colonnes)
        : el('p.agenda__vide.agenda__vide--jour', { texte: t('agenda.fermeCeJour') })));
}
