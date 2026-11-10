// Studio enseignant : saisir un texte, laisser Albert préparer les activités, relire, valider, publier.
import { el, vider, remplir } from '../ui.js';
import { COULEURS, CLE_BROUILLON, CLE_APERCU, chargerPublie, lireBrouillon, fusionnerCorpus } from '../donnees.js';
import { figureDansTexte, propre, compterMots, formeGrille } from '../lib/texte.js';
import { genererGrille } from '../lib/grille.js';
import { bornesGroupes, ciblesMaze, erreursMaze } from '../lib/activites-lecture.js';
import { erreursTexte } from '../lib/validation.js';
import { dire } from '../voix.js';

const CLE_CODE = 'pl-studio-code';
const CLE_META = 'pl-studio-meta';
const REGLAGES = { niveau: 'CE1', nbMotsDictee: 8, nbQuestions: 5, nbMotsMeles: 8, directions: 'simple', vitesse: 60 };
const NIVEAUX = ['GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
const SENS = { simple: '→ et ↓', diagonales: '→ ↓ et ↘', completes: 'tous les sens' };

export async function monterStudio(racine) {
  const lien = el('link', { rel: 'stylesheet', href: new URL('./studio.css', import.meta.url).href });
  document.head.append(lien);
  document.title = 'Studio — Parcours lecture';

  let contenu = lireBrouillon();
  let meta = lireMeta();
  let publie = null;
  try { publie = await chargerPublie(); } catch { /* hors ligne : on garde le brouillon */ }
  if (!contenu) { contenu = structuredClone(publie || { version: 1, parcours: [] }); meta = { modifie: false }; }
  normaliser(contenu);
  if (publie && fusionnerCorpus(contenu, publie)) {
    meta.modifie = true;
    try {
      localStorage.setItem(CLE_BROUILLON, JSON.stringify(contenu));
      localStorage.setItem(CLE_META, JSON.stringify(meta));
    } catch { /* le studio reste utilisable pour cette session */ }
  }
  let empreintes = new WeakMap();
  const empreinte = (t) => JSON.stringify([t.titre, t.texte, t.activites]);
  const retenirValides = () => {
    empreintes = new WeakMap();
    for (const p of contenu.parcours) for (const t of p.textes) {
      if (t.valide) empreintes.set(t, empreinte(t));
    }
  };
  retenirValides();

  let code = sessionStorage.getItem(CLE_CODE) || '';
  let statut = null; // { albert, publier }
  let pId = contenu.parcours[0]?.id;
  let tId = null;
  let enGeneration = false;

  // --- Squelette -----------------------------------------------------------
  const zoneConnexion = el('div', { class: 'st-connexion' });
  const pastilleEtat = el('span', { class: 'st-etat' });
  const zoneActions = el('div', { class: 'st-actions' });
  const onglets = el('nav', { class: 'st-onglets', 'aria-label': 'Parcours' });
  const colonne = el('aside', { class: 'st-colonne' });
  const editeur = el('section', { class: 'st-editeur' });
  const notif = el('div', { class: 'st-notif', role: 'status', 'aria-live': 'polite' });

  remplir(racine,
    el('header', { class: 'st-haut' },
      el('div', { class: 'st-titre' }, el('b', {}, 'Studio'), el('span', {}, 'Parcours lecture')),
      pastilleEtat, zoneActions, zoneConnexion),
    onglets,
    el('div', { class: 'st-corps' }, colonne, editeur),
    notif);

  // --- Connexion (code studio) ----------------------------------------------
  function majConnexion() {
    if (statut) {
      remplir(zoneConnexion,
        el('span', { class: `st-badge ${statut.albert ? 'ok' : 'ko'}` }, statut.albert ? 'Albert connecté' : 'Albert non configuré'),
        el('button', { class: 'st-lien', onclick: () => { sessionStorage.removeItem(CLE_CODE); code = ''; statut = null; majConnexion(); majActions(); } }, 'Se déconnecter'));
      return;
    }
    const champ = el('input', { type: 'password', placeholder: 'Code studio', 'aria-label': 'Code studio', autocomplete: 'current-password' });
    const form = el('form', { class: 'st-form-code', onsubmit: (e) => { e.preventDefault(); verifierCode(champ.value); } },
      champ, el('button', { class: 'st-btn' }, 'Connecter Albert'));
    remplir(zoneConnexion, form);
  }

  async function verifierCode(valeur, silencieux = false) {
    try {
      const r = await fetch('/api/statut', { headers: { 'x-studio-code': valeur } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`);
      code = valeur;
      statut = j;
      sessionStorage.setItem(CLE_CODE, valeur);
      if (!silencieux) notifier('Studio connecté.');
    } catch (e) {
      statut = null;
      if (!silencieux) notifier(e.message === 'Failed to fetch' ? 'Serveur injoignable.' : e.message, 'erreur');
    }
    majConnexion();
    majActions();
    majEditeur();
  }

  // --- Barre d'actions -------------------------------------------------------
  function majActions() {
    remplir(pastilleEtat, meta.modifie ? 'Modifications non publiées' : 'À jour');
    pastilleEtat.classList.toggle('modifie', Boolean(meta.modifie));
    const fichier = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: importer });
    remplir(zoneActions,
      el('button', { class: 'st-btn st-btn-clair', onclick: () => apercu() }, 'Voir côté élève'),
      el('button', { class: 'st-btn st-btn-clair', onclick: exporter }, 'Exporter le fichier'),
      el('button', { class: 'st-btn st-btn-clair', onclick: () => fichier.click() }, 'Importer'),
      fichier,
      statut?.publier ? el('button', { class: 'st-btn st-btn-fort', onclick: publier, disabled: !meta.modifie }, 'Publier pour les élèves') : null,
      el('button', { class: 'st-lien', onclick: repartirPublie, title: 'Abandonner le brouillon local' }, 'Recharger la version publiée'));
  }

  // --- Onglets des parcours --------------------------------------------------
  function majOnglets() {
    remplir(onglets, contenu.parcours.map((p) => {
      const c = COULEURS[p.couleur] || COULEURS.vert;
      const nbV = p.textes.filter((t) => t.valide).length;
      return el('button', {
        class: `st-onglet ${p.id === pId ? 'actif' : ''}`,
        style: { '--c': c.fond, '--cs': c.sombre },
        onclick: () => { pId = p.id; tId = null; majOnglets(); majColonne(); majEditeur(); },
      }, el('span', { class: 'st-pastille' }), p.nom, el('small', {}, `${nbV}/${p.textes.length} validés`));
    }));
  }

  const parcoursCourant = () => contenu.parcours.find((p) => p.id === pId);
  const texteCourant = () => parcoursCourant()?.textes.find((t) => t.id === tId);

  // --- Colonne : réglages + liste des textes ---------------------------------
  function majColonne() {
    const p = parcoursCourant();
    if (!p) { vider(colonne); return; }
    const r = p.reglages;
    const champ = (libelle, cle, type = 'number', attrs = {}) => el('label', { class: 'st-champ-court' }, libelle,
      el('input', { type, value: r[cle], ...attrs, onchange: (e) => { r[cle] = type === 'number' ? Number(e.target.value) : e.target.value; sauver(); } }));

    remplir(colonne,
      el('details', { class: 'st-reglages' },
        el('summary', {}, 'Réglages du parcours'),
        el('label', { class: 'st-champ-court' }, 'Nom',
          el('input', { value: p.nom, onchange: (e) => { p.nom = e.target.value || p.nom; sauver(); majOnglets(); } })),
        el('label', { class: 'st-champ-court' }, 'Couleur',
          el('select', { onchange: (e) => { p.couleur = e.target.value; sauver(); majOnglets(); } },
            Object.keys(COULEURS).map((k) => el('option', { value: k, selected: p.couleur === k }, k)))),
        el('label', { class: 'st-champ-court' }, 'Niveau visé',
          el('select', { onchange: (e) => { r.niveau = e.target.value; sauver(); } },
            NIVEAUX.map((n) => el('option', { value: n, selected: r.niveau === n }, n)))),
        champ('Mots de dictée', 'nbMotsDictee', 'number', { min: 3, max: 15 }),
        champ('Questions', 'nbQuestions', 'number', { min: 2, max: 10 }),
        champ('Mots mêlés', 'nbMotsMeles', 'number', { min: 3, max: 14 }),
        el('label', { class: 'st-champ-court' }, 'Sens de la grille',
          el('select', { onchange: (e) => { r.directions = e.target.value; sauver(); } },
            Object.entries(SENS).map(([k, v]) => el('option', { value: k, selected: r.directions === k }, v)))),
        champ('Vitesse (mots/min)', 'vitesse', 'number', { min: 20, max: 140, step: 5 }),
        el('p', { class: 'st-aide' }, 'Albert utilise ces réglages pour chaque texte de ce parcours.')),
      el('div', { class: 'st-liste-entete' },
        el('h2', {}, `Textes (${p.textes.length})`),
        el('button', { class: 'st-btn', onclick: nouveauTexte }, '+ Texte')),
      el('ol', { class: 'st-liste' },
        p.textes.map((t, i) => el('li', { class: t.id === tId ? 'actif' : '' },
          el('button', { class: 'st-item', onclick: () => { tId = t.id; majColonne(); majEditeur(); } },
            el('span', { class: 'st-num' }, String(i + 1).padStart(2, '0')),
            el('span', { class: 'st-item-titre' }, t.titre || 'Sans titre'),
            pastilleTexte(t)),
          el('span', { class: 'st-ordre' },
            el('button', { 'aria-label': 'Monter', disabled: i === 0, onclick: () => deplacer(i, -1) }, '↑'),
            el('button', { 'aria-label': 'Descendre', disabled: i === p.textes.length - 1, onclick: () => deplacer(i, 1) }, '↓'))))),
      p.textes.some((t) => !aDesActivites(t))
        ? el('button', { class: 'st-btn st-btn-clair st-plein', disabled: !statut?.albert || enGeneration, onclick: genererTout },
          `Préparer avec Albert les ${p.textes.filter((t) => !aDesActivites(t)).length} texte(s) sans activités`)
        : null,
    );
  }

  function pastilleTexte(t) {
    if (t.valide) return el('span', { class: 'st-statut valide' }, 'validé');
    if (aDesActivites(t)) return el('span', { class: 'st-statut relire' }, 'à relire');
    return el('span', { class: 'st-statut vide' }, 'texte seul');
  }

  function deplacer(i, d) {
    const l = parcoursCourant().textes;
    [l[i], l[i + d]] = [l[i + d], l[i]];
    sauver(); majColonne();
  }

  function nouveauTexte() {
    const p = parcoursCourant();
    const t = { id: `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, titre: '', texte: '', valide: false, activites: activitesVides() };
    p.textes.push(t);
    tId = t.id;
    sauver(); majOnglets(); majColonne(); majEditeur();
    editeur.querySelector('input')?.focus();
  }

  // --- Éditeur du texte --------------------------------------------------------
  function majEditeur() {
    const p = parcoursCourant();
    const t = texteCourant();
    if (!t) {
      remplir(editeur, el('div', { class: 'st-vide' },
        el('h2', {}, p ? p.nom : 'Aucun parcours'),
        el('p', {}, p?.textes.length ? 'Choisissez un texte dans la liste, ou ajoutez-en un.' : 'Ce parcours n\'a pas encore de texte. Ajoutez-en un avec « + Texte ».'),
        !statut ? el('p', { class: 'st-aide' }, 'Pour générer les activités, entrez le code studio en haut à droite.') : null));
      return;
    }
    const a = t.activites;
    const nbMots = compterMots(t.texte);

    const btnAlbert = el('button', {
      class: 'st-btn st-btn-fort',
      disabled: !statut?.albert || enGeneration || t.texte.trim().length < 20,
      onclick: () => generer(t),
    }, enGeneration ? 'Albert prépare les activités…' : (aDesActivites(t) ? 'Régénérer avec Albert' : 'Préparer les activités avec Albert'));

    remplir(editeur,
      el('div', { class: 'st-bloc' },
        el('label', { class: 'st-champ' }, 'Titre',
          el('input', { value: t.titre, placeholder: 'Titre du texte', oninput: (e) => { t.titre = e.target.value; sauver(); majTitreListe(); } })),
        el('label', { class: 'st-champ' }, el('span', {}, 'Texte ', el('small', {}, `${nbMots} mots · un paragraphe par ligne`)),
          el('textarea', { rows: 9, placeholder: 'Collez le texte ici.', oninput: (e) => { t.texte = e.target.value; sauver(); }, onchange: () => majEditeur() }, t.texte)),
        el('div', { class: 'st-ligne' }, btnAlbert,
          !statut ? el('span', { class: 'st-aide' }, 'Entrez le code studio pour utiliser Albert.') : null,
          statut && !statut.albert ? el('span', { class: 'st-aide' }, 'La clé ALBERT_API_KEY n\'est pas configurée sur Vercel.') : null),
        t._alertes?.length ? el('div', { class: 'st-alertes' },
          el('strong', {}, 'Points à vérifier :'),
          el('ul', {}, t._alertes.map((x) => el('li', {}, x))),
          el('button', { class: 'st-lien', onclick: () => { delete t._alertes; sauver(); majEditeur(); } }, 'Masquer')) : null),

      carte('lecture', 'Lecture au prompteur', a.lecture,
        el('label', { class: 'st-champ-court' }, 'Vitesse conseillée (mots/min)',
          el('input', { type: 'number', min: 20, max: 140, step: 5, value: a.lecture.vitesse || parcoursCourant().reglages.vitesse, onchange: (e) => { a.lecture.vitesse = Number(e.target.value); sauver(); } })),
        el('p', { class: 'st-aide' }, 'L\'élève peut ensuite ralentir ou accélérer lui-même.'),
        editeurGroupes(t)),

      carte('dictee', `Dictée de mots (${a.dictee.mots.length})`, a.dictee, editeurDictee(t)),
      carte('comprehension', `Compréhension (${a.comprehension.questions.length} questions)`, a.comprehension, editeurQuestions(t)),
      carte('motsMeles', `Mots mêlés (${a.motsMeles.mots.length} mots)`, a.motsMeles, editeurMotsMeles(t)),
      carte('maze', `Labyrinthe de lecture (${a.maze.trous.length} choix)`, a.maze, editeurMaze(t)),

      piedTexte(t),
    );
  }

  function piedTexte(t) {
    return el('div', { class: 'st-pied' },
      el('span', { class: `st-statut grand ${t.valide ? 'valide' : 'relire'}` }, t.valide ? 'Validé : visible par les élèves après publication' : 'Brouillon : invisible pour les élèves'),
      el('button', { class: 'st-btn st-btn-clair', onclick: () => apercu(t) }, 'Aperçu élève'),
      t.valide
        ? el('button', { class: 'st-btn st-btn-clair', onclick: () => { t.valide = false; sauver(); majOnglets(); majColonne(); majEditeur(); } }, 'Repasser en brouillon')
        : el('button', { class: 'st-btn st-btn-fort', onclick: () => valider(t) }, 'Valider ce texte'),
      el('button', { class: 'st-btn st-btn-danger', onclick: () => supprimer(t) }, 'Supprimer'));
  }

  function majTitreListe() {
    const li = colonne.querySelector('.st-liste li.actif .st-item-titre');
    if (li) li.textContent = texteCourant()?.titre || 'Sans titre';
  }

  function carte(cle, titre, activite, ...contenuCarte) {
    const corps = el('div', { class: 'st-carte-corps' }, contenuCarte);
    corps.classList.toggle('eteinte', activite.actif === false);
    return el('section', { class: 'st-carte' },
      el('div', { class: 'st-carte-entete' },
        el('span', { class: `st-ico st-ico-${cle}` }),
        el('h3', { class: 'st-carte-titre' }, titre),
        el('label', { class: 'st-actif' },
          el('input', { type: 'checkbox', checked: activite.actif !== false, onchange: (e) => { activite.actif = e.target.checked; corps.classList.toggle('eteinte', !e.target.checked); sauver(); } }),
          'Proposée aux élèves')),
      corps);
  }

  function editeurDictee(t) {
    const liste = t.activites.dictee.mots;
    return el('div', {},
      el('div', { class: 'st-table' },
        el('div', { class: 'st-tr st-th' }, el('span', {}, 'Mot'), el('span', {}, 'Phrase pour l\'entendre en contexte'), el('span', {})),
        liste.map((m, i) => el('div', { class: 'st-tr' },
          el('span', { class: 'st-cellule' },
            el('input', { value: m.mot, 'aria-label': 'Mot', oninput: (e) => { m.mot = e.target.value; sauver(); }, onchange: () => majEditeur() }),
            m.mot && !figureDansTexte(m.mot, t.texte) ? el('em', { class: 'st-warn' }, 'absent du texte') : null),
          el('input', { value: m.phrase || '', 'aria-label': 'Phrase', oninput: (e) => { m.phrase = e.target.value; sauver(); } }),
          el('span', { class: 'st-outils' },
            el('button', { class: 'st-mini', title: 'Écouter', onclick: () => dire(m.mot, { vitesse: 0.8 }) }, '▶'),
            el('button', { class: 'st-mini', title: 'Retirer', onclick: () => { liste.splice(i, 1); sauver(); majEditeur(); } }, '✕'))))),
      el('button', { class: 'st-lien', onclick: () => { liste.push({ mot: '', phrase: '' }); sauver(); majEditeur(); } }, '+ Ajouter un mot'));
  }

  function editeurQuestions(t) {
    const qs = t.activites.comprehension.questions;
    return el('div', { class: 'st-questions' },
      qs.map((q, i) => el('div', { class: 'st-question' },
        el('div', { class: 'st-q-entete' },
          el('b', {}, `Question ${i + 1}`),
          el('span', { class: 'st-outils' },
            el('button', { class: 'st-mini', disabled: i === 0, onclick: () => { [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; sauver(); majEditeur(); } }, '↑'),
            el('button', { class: 'st-mini', onclick: () => { qs.splice(i, 1); sauver(); majEditeur(); } }, '✕'))),
        el('input', { class: 'st-q-texte', value: q.question, 'aria-label': 'Question', oninput: (e) => { q.question = e.target.value; sauver(); } }),
        el('div', { class: 'st-choix' },
          [0, 1, 2].map((k) => el('label', { class: `st-choix-ligne ${q.bonne === k ? 'bonne' : ''}` },
            el('input', { type: 'radio', name: `bonne-${t.id}-${i}`, checked: q.bonne === k, title: 'Bonne réponse', onchange: () => { q.bonne = k; sauver(); majEditeur(); } }),
            el('input', { value: q.choix[k] || '', placeholder: k === q.bonne ? 'Bonne réponse' : 'Réponse fausse', oninput: (e) => { q.choix[k] = e.target.value; sauver(); } })))),
        el('label', { class: 'st-champ-court' }, 'Indice (sans donner la réponse)',
          el('input', { value: q.indice || '', oninput: (e) => { q.indice = e.target.value; sauver(); } })),
        el('label', { class: 'st-champ-court' }, el('span', {}, 'Passage du texte qui répond ',
          q.extrait && !propre(t.texte).includes(propre(q.extrait)) ? el('em', { class: 'st-warn' }, 'introuvable dans le texte') : null),
        el('input', { value: q.extrait || '', oninput: (e) => { q.extrait = e.target.value; sauver(); }, onchange: () => majEditeur() })))),
      el('button', { class: 'st-lien', onclick: () => { qs.push({ question: '', choix: ['', '', ''], bonne: 0, indice: '', extrait: '' }); sauver(); majEditeur(); } }, '+ Ajouter une question'));
  }

  function editeurMotsMeles(t) {
    const mm = t.activites.motsMeles;
    const apercuGrille = el('div', { class: 'st-grille' });
    const dessiner = () => {
      if (!mm.mots.length) { remplir(apercuGrille, el('p', { class: 'st-aide' }, 'Ajoutez des mots pour voir la grille.')); return; }
      const g = genererGrille(mm.mots, { directions: mm.directions || parcoursCourant().reglages.directions, cle: `${t.id}|${mm.mots.join(',')}` });
      const cachees = new Set(g.places.flatMap((p) => p.cases.map(([l, c]) => `${l}.${c}`)));
      remplir(apercuGrille,
        el('div', { class: 'st-mini-grille', style: { '--n': g.taille } },
          g.lettres.flatMap((ligne, l) => ligne.map((x, c) => el('span', { class: cachees.has(`${l}.${c}`) ? 'cache' : '' }, x)))),
        g.ignores.length ? el('p', { class: 'st-warn' }, `Mots qui n'ont pas pu être placés : ${g.ignores.join(', ')}`) : null);
    };
    dessiner();
    return el('div', { class: 'st-mm' },
      el('div', {},
        el('label', { class: 'st-champ' }, 'Mots à cacher (séparés par des virgules)',
          el('textarea', {
            rows: 3,
            onchange: (e) => {
              mm.mots = e.target.value.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
              sauver(); majEditeur();
            },
          }, mm.mots.join(', '))),
        el('label', { class: 'st-champ-court' }, 'Sens de lecture',
          el('select', { onchange: (e) => { mm.directions = e.target.value; sauver(); dessiner(); } },
            Object.entries(SENS).map(([k, v]) => el('option', { value: k, selected: (mm.directions || parcoursCourant().reglages.directions) === k }, v)))),
        mm.mots.filter((m) => !figureDansTexte(m, t.texte)).length
          ? el('p', { class: 'st-warn' }, `Absents du texte : ${mm.mots.filter((m) => !figureDansTexte(m, t.texte)).join(', ')}`) : null,
        mm.mots.filter((m) => formeGrille(m).length > 12).length
          ? el('p', { class: 'st-warn' }, 'Certains mots sont trop longs pour la grille.') : null),
      apercuGrille);
  }

  function editeurGroupes(t) {
    const groupes = t.activites.lecture.groupes;
    return el('label', { class: 'st-champ st-groupes' },
      'Groupes de souffle (un groupe par ligne)',
      el('textarea', {
        rows: 6,
        placeholder: 'Le matin,\nPilou dort\nsur le lit.',
        onchange: (e) => {
          t.activites.lecture.groupes = e.target.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
          sauver(); majEditeur();
        },
      }, groupes.join('\n')),
      (t.activites.lecture.groupesDemandes || groupes.length) && !bornesGroupes(t.texte, groupes)
        ? el('em', { class: 'st-warn' }, 'Les groupes doivent reprendre tous les mots du texte, une seule fois et dans le même ordre.') : null,
      el('small', {}, 'Albert propose le découpage. Le prompteur avance ensuite par groupe ; le mode mot à mot reste disponible.'));
  }

  function editeurMaze(t) {
    const maze = t.activites.maze;
    const cibles = ciblesMaze(t.texte);
    const initialiser = () => {
      if (maze.trous.length && !confirm('Recréer les emplacements MAZE ? Les distracteurs actuels seront effacés.')) return;
      maze.trous = cibles.map(({ index, mot }) => ({ index, choix: [mot, '', ''], bonne: 0 }));
      sauver(); majEditeur();
    };
    return el('div', { class: 'st-maze' },
      el('p', { class: 'st-aide' }, 'Environ un mot sur sept. Pour chaque mot du texte, Albert propose deux choix impossibles dans ce contexte.'),
      maze.trous.length ? el('button', { class: 'st-lien', onclick: initialiser }, 'Recréer les emplacements')
        : el('button', { class: 'st-lien', onclick: initialiser }, 'Créer les emplacements à compléter'),
      maze.trous.map((trou, i) => {
        const cible = cibles.find((c) => c.index === trou.index);
        return el('div', { class: 'st-maze-ligne' },
          el('b', {}, `${i + 1}. ${cible?.mot || 'Position introuvable'}`),
          el('small', {}, cible?.contexte || 'Le texte a changé : recréez les emplacements.'),
          [1, 2].map((k) => el('input', {
            value: trou.choix?.[k] || '',
            placeholder: `Distracteur ${k}`,
            'aria-label': `Distracteur ${k} pour ${cible?.mot || `le choix ${i + 1}`}`,
            oninput: (e) => { trou.choix[k] = e.target.value; sauver(); },
          })));
      }),
      maze.trous.length && erreursMaze(t.texte, maze.trous).length
        ? el('p', { class: 'st-warn' }, `À corriger : ${erreursMaze(t.texte, maze.trous).join(', ')}.`) : null);
  }

  // --- Albert -----------------------------------------------------------------
  async function appelAlbert(t) {
    const r = await fetch('/api/albert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-studio-code': code },
      body: JSON.stringify({ titre: t.titre, texte: t.texte, reglages: parcoursCourant().reglages }),
    });
    const j = await r.json().catch(() => ({ erreur: `Réponse illisible (${r.status}).` }));
    if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`);
    return j;
  }

  function appliquer(t, resultat) {
    const anciens = t.activites;
    t.activites = resultat.activites;
    // Conserve les choix d'activation de l'enseignant.
    for (const k of Object.keys(t.activites)) {
      if (k === 'maze' && !anciens?.maze?.trous?.length) continue;
      if (anciens?.[k]?.actif === false) t.activites[k].actif = false;
    }
    t._alertes = resultat.alertes;
    t.valide = false;
  }

  async function generer(t) {
    if (aDesActivites(t) && !confirm('Remplacer les activités actuelles par une nouvelle proposition d\'Albert ?')) return;
    enGeneration = true;
    majEditeur(); majColonne();
    try {
      const res = await appelAlbert(t);
      appliquer(t, res);
      sauver();
      notifier(`Activités préparées (${res.modeles?.principal || res.model} ; compréhension : ${res.modeles?.comprehension || res.model}). Relisez-les avant de valider.`);
    } catch (e) {
      notifier(e.message, 'erreur');
    } finally {
      enGeneration = false;
      majOnglets(); majColonne(); majEditeur();
    }
  }

  async function genererTout() {
    const p = parcoursCourant();
    const aFaire = p.textes.filter((t) => !aDesActivites(t) && t.texte.trim().length >= 20);
    if (!aFaire.length) return;
    enGeneration = true;
    majColonne(); majEditeur();
    let ok = 0;
    for (const [k, t] of aFaire.entries()) {
      notifier(`Albert prépare le texte ${k + 1} / ${aFaire.length} : ${t.titre || 'sans titre'}…`);
      try { appliquer(t, await appelAlbert(t)); ok++; sauver(); majColonne(); } catch (e) {
        notifier(`« ${t.titre} » : ${e.message}`, 'erreur');
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    enGeneration = false;
    notifier(`${ok} texte(s) préparé(s). Relisez-les puis validez-les un par un.`);
    majOnglets(); majColonne(); majEditeur();
  }

  // --- Validation, aperçu, suppression ---------------------------------------------
  function valider(t) {
    const a = t.activites;
    const manque = erreursTexte(t, parcoursCourant());
    if (manque.length) { notifier(`Il manque : ${manque.join(', ')}.`, 'erreur'); return; }
    const actives = Object.values(a).filter((x) => x.actif !== false).length;
    if (actives < Object.keys(a).length && !confirm(`Seulement ${actives} activité(s) sur ${Object.keys(a).length} sont proposées. Valider quand même ?`)) return;
    // Nettoyage léger avant validation.
    a.dictee.mots = a.dictee.mots.filter((m) => m.mot.trim()).map((m) => ({ mot: m.mot.trim(), phrase: (m.phrase || '').trim() }));
    a.comprehension.questions = a.comprehension.questions.map((q) => {
      const juste = q.choix[q.bonne].trim();
      const autres = q.choix.filter((c, k) => k !== q.bonne && c?.trim()).map((c) => c.trim());
      return { ...q, choix: [juste, ...autres], bonne: 0 };
    });
    t.valide = true;
    delete t._alertes;
    empreintes.set(t, empreinte(t));
    sauver();
    notifier(statut?.publier ? 'Texte validé. Pensez à publier.' : 'Texte validé. Exportez le fichier pour le mettre en ligne.');
    majOnglets(); majColonne(); majEditeur();
  }

  function supprimer(t) {
    if (!confirm(`Supprimer « ${t.titre || 'ce texte'} » et ses activités ?`)) return;
    const p = parcoursCourant();
    p.textes = p.textes.filter((x) => x.id !== t.id);
    tId = null;
    sauver(); majOnglets(); majColonne(); majEditeur();
  }

  function apercu(t) {
    sessionStorage.setItem(CLE_APERCU, '1');
    location.hash = t ? `#/p/${pId}/t/${encodeURIComponent(t.id)}` : '#/';
  }

  // --- Sauvegarde, export, publication ------------------------------------------------
  function sauver() {
    let validationPerdue = false;
    for (const p of contenu.parcours) for (const t of p.textes) {
      if (t.valide && empreintes.get(t) !== empreinte(t)) {
        t.valide = false;
        empreintes.delete(t);
        validationPerdue = true;
      }
    }
    meta.modifie = true;
    try {
      localStorage.setItem(CLE_BROUILLON, JSON.stringify(contenu));
      localStorage.setItem(CLE_META, JSON.stringify(meta));
    } catch { notifier('Impossible d\'enregistrer le brouillon sur cet appareil.', 'erreur'); }
    remplir(pastilleEtat, 'Modifications non publiées');
    pastilleEtat.classList.add('modifie');
    zoneActions.querySelector('.st-btn-fort')?.removeAttribute('disabled');
    if (validationPerdue) {
      majOnglets(); majColonne();
      const pied = editeur.querySelector('.st-pied');
      const t = texteCourant();
      if (pied && t) pied.replaceWith(piedTexte(t));
      notifier('Texte modifié : il est repassé en brouillon. Validez-le à nouveau.', 'info');
    }
  }

  function contenuPropre() {
    return JSON.parse(JSON.stringify(contenu, (k, v) => (k.startsWith('_') ? undefined : v)));
  }

  function versionAPublier() {
    const pret = contenuPropre();
    for (const p of pret.parcours) for (const t of p.textes) {
      if (!t.valide) continue;
      const erreurs = erreursTexte(t, p);
      if (erreurs.length) {
        notifier(`« ${t.titre || 'Sans titre'} » : ${erreurs.join(', ')}.`, 'erreur');
        return null;
      }
    }
    return pret;
  }

  function exporter() {
    const publie = versionAPublier();
    if (!publie) return;
    const blob = new Blob([`${JSON.stringify(publie, null, 2)}\n`], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'parcours.json' });
    document.body.append(a); a.click(); a.remove();
    notifier('Fichier exporté. Remplacez public/contenu/parcours.json dans le projet puis redéployez.');
  }

  async function importer(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!Array.isArray(j.parcours)) throw new Error('Ce fichier ne contient pas de parcours.');
      if (!confirm('Remplacer tout le brouillon par ce fichier ?')) return;
      contenu = j; normaliser(contenu); retenirValides();
      pId = contenu.parcours[0]?.id; tId = null;
      sauver(); majOnglets(); majColonne(); majEditeur();
      notifier('Fichier importé.');
    } catch (err) { notifier(err.message, 'erreur'); }
    e.target.value = '';
  }

  async function publier() {
    const publie = versionAPublier();
    if (!publie) return;
    if (!confirm('Publier cette version ? Les élèves verront tous les textes validés.')) return;
    try {
      const r = await fetch('/api/publier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-studio-code': code },
        body: JSON.stringify({ contenu: publie }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`);
      meta.modifie = false;
      localStorage.setItem(CLE_META, JSON.stringify(meta));
      majActions();
      notifier('Publié. La nouvelle version sera en ligne d\'ici une à deux minutes.');
    } catch (err) { notifier(err.message, 'erreur'); }
  }

  async function repartirPublie() {
    if (!confirm('Abandonner le brouillon de cet appareil et recharger la version publiée ?')) return;
    try { publie = await chargerPublie(); } catch (err) { notifier(err.message, 'erreur'); return; }
    contenu = structuredClone(publie); normaliser(contenu); retenirValides();
    meta = { modifie: false };
    localStorage.removeItem(CLE_BROUILLON);
    localStorage.setItem(CLE_META, JSON.stringify(meta));
    pId = contenu.parcours[0]?.id; tId = null;
    majActions(); majOnglets(); majColonne(); majEditeur();
    notifier('Version publiée rechargée.');
  }

  let minuterieNotif = null;
  function notifier(message, type = 'info') {
    remplir(notif, message);
    notif.className = `st-notif visible ${type}`;
    clearTimeout(minuterieNotif);
    minuterieNotif = setTimeout(() => notif.classList.remove('visible'), type === 'erreur' ? 9000 : 5000);
  }

  // --- Premier affichage ---
  majConnexion();
  majActions();
  majOnglets();
  majColonne();
  majEditeur();
  if (code) verifierCode(code, true);
}

// --- Utilitaires -----------------------------------------------------------------------
function lireMeta() {
  try { return JSON.parse(localStorage.getItem(CLE_META)) || { modifie: false }; } catch { return { modifie: false }; }
}

function activitesVides() {
  return {
    lecture: { actif: true, vitesse: null, groupes: [], groupesDemandes: false },
    dictee: { actif: true, mots: [] },
    comprehension: { actif: true, questions: [] },
    motsMeles: { actif: true, mots: [], directions: null },
    maze: { actif: true, trous: [] },
  };
}

function aDesActivites(t) {
  const a = t.activites || {};
  return Boolean(a.dictee?.mots?.length || a.comprehension?.questions?.length || a.motsMeles?.mots?.length
    || a.lecture?.groupes?.length || a.maze?.trous?.length);
}

/** Complète les champs manquants pour que l'éditeur n'ait jamais à se méfier. */
function normaliser(c) {
  c.version ||= 1;
  c.parcours ||= [];
  for (let n = 1; n <= 4; n++) {
    if (!c.parcours.find((p) => p.id === n)) c.parcours.push({ id: n, nom: `Parcours ${n}`, couleur: ['vert', 'jaune', 'orange', 'bleu'][n - 1], textes: [] });
  }
  c.parcours.sort((a, b) => a.id - b.id);
  for (const p of c.parcours) {
    p.reglages = { ...REGLAGES, ...(p.reglages || {}) };
    p.textes ||= [];
    for (const t of p.textes) {
      t.titre ||= '';
      t.texte ||= '';
      const avaitMaze = Boolean(t.activites?.maze);
      const vide = activitesVides();
      t.activites = { ...vide, ...(t.activites || {}) };
      for (const k of Object.keys(vide)) t.activites[k] = { ...vide[k], ...(t.activites[k] || {}) };
      if (!avaitMaze && t.valide) t.activites.maze.actif = false;
      t.activites.lecture.groupes ||= [];
      t.activites.maze.trous = (t.activites.maze.trous || []).map((trou) => ({
        index: trou.index, bonne: 0, choix: [...(trou.choix || []), '', '', ''].slice(0, 3),
      }));
      t.activites.dictee.mots = (t.activites.dictee.mots || []).map((m) => (typeof m === 'string' ? { mot: m, phrase: '' } : m));
      t.activites.comprehension.questions = (t.activites.comprehension.questions || []).map((q) => ({
        question: '', indice: '', extrait: '', bonne: 0, ...q, choix: [...(q.choix || []), '', '', ''].slice(0, 3),
      }));
    }
  }
}

