// Application élève : parcours → texte → activité, avec retour arrière à chaque étape.
import { el, vider, remplir, ajouter, iconePixel } from './ui.js';
import { jouer, basculerMuet, estMuet } from './sons.js';
import { dire, taire } from './voix.js';
import {
  chargerPourEleve, couleurDe, ACTIVITES, activitesDisponibles, modeApercu, CLE_APERCU,
} from './donnees.js';
import { monterLecture } from './activites/lecture.js';
import { monterDictee } from './activites/dictee.js';
import { monterComprehension } from './activites/comprehension.js';
import { monterMotsMeles } from './activites/motsmeles.js';
import { monterMaze } from './activites/maze.js';

const MOTEURS = {
  lecture: monterLecture,
  dictee: monterDictee,
  comprehension: monterComprehension,
  motsMeles: monterMotsMeles,
  maze: monterMaze,
};

let contenu = null;
let nettoyage = null;
const racine = document.getElementById('app');

// ---------------------------------------------------------------------------
// Coque « console »
// ---------------------------------------------------------------------------
const boutonSon = el('button', {
  class: 'console-son',
  'aria-label': 'Activer ou couper les sons',
  onclick: () => { basculerMuet(); majBoutonSon(); jouer('choisir'); },
});
function majBoutonSon() {
  remplir(boutonSon, iconePixel(estMuet() ? 'muet' : 'son', { taille: 26, contour: 'currentColor', fond: 'currentColor' }));
  boutonSon.setAttribute('aria-pressed', String(estMuet()));
}

const boutonRetour = el('button', { class: 'btn-retour', onclick: () => retour() },
  iconePixel('retour', { taille: 20, contour: 'currentColor', fond: 'currentColor' }), el('span', {}, 'Retour'));
const filAriane = el('nav', { class: 'fil', 'aria-label': 'Où suis-je ?' });
const vue = el('main', { class: 'vue', tabindex: '-1' });
const bandeauApercu = el('div', { class: 'bandeau-apercu', hidden: true },
  'Aperçu enseignant : les textes non validés sont visibles. ',
  el('button', { onclick: () => { sessionStorage.removeItem(CLE_APERCU); location.hash = '#/studio'; } }, 'Revenir au studio'));

racine.append(
  el('div', { class: 'console' },
    el('div', { class: 'console-haut' },
      el('span', { class: 'led', 'aria-hidden': 'true' }),
      el('span', { class: 'marque' }, 'PARCOURS ', el('b', {}, 'LECTURE')),
      boutonSon),
    el('div', { class: 'ecran' },
      bandeauApercu,
      el('header', { class: 'barre' }, boutonRetour, filAriane),
      vue),
    el('div', { class: 'console-bas', 'aria-hidden': 'true' },
      el('span', { class: 'croix' }), el('span', { class: 'fentes' }, el('i'), el('i'), el('i')),
      el('span', { class: 'ab' }, el('i', {}, 'B'), el('i', {}, 'A')))),
);
majBoutonSon();

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
function route() {
  const morceaux = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return morceaux;
}

function aller(chemin) { location.hash = `#/${chemin.map(encodeURIComponent).join('/')}`; }

function retour() {
  const r = route();
  jouer('retour');
  if (r[0] !== 'p') return aller([]);
  if (r.length >= 5) return aller(r.slice(0, 4));   // activité → choix des activités
  if (r.length >= 4) return aller(r.slice(0, 2));   // texte → liste des textes
  return aller([]);                                  // parcours → accueil
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.querySelector('.fenetre-fond')) retour();
});

async function afficher() {
  if (route()[0] === 'studio') {
    nettoyage?.(); nettoyage = null;
    const { monterStudio } = await import('./studio/studio.js');
    document.body.classList.add('mode-studio');
    remplir(racine, el('div', { id: 'studio' }));
    monterStudio(document.getElementById('studio'));
    return;
  }
  if (document.body.classList.contains('mode-studio')) { location.reload(); return; }

  taire();
  nettoyage?.();
  nettoyage = null;
  document.querySelectorAll('.fenetre-fond').forEach((f) => f.remove());
  bandeauApercu.hidden = !modeApercu();
  if (!contenu) {
    remplir(vue, el('p', { class: 'chargement' }, 'Chargement…'));
    try { contenu = await chargerPourEleve(); } catch (e) {
      remplir(vue, el('div', { class: 'erreur' }, 'Le contenu n\'a pas pu être chargé. ', e.message));
      return;
    }
  }
  const [, idP, , idT, act] = route();
  const r = route();
  vider(vue);
  vue.scrollTop = 0;

  if (r[0] !== 'p') return ecranAccueil();
  const parcours = contenu.parcours.find((p) => String(p.id) === idP);
  if (!parcours) return aller([]);
  const c = couleurDe(parcours);
  document.documentElement.style.setProperty('--p-fond', c.fond);
  document.documentElement.style.setProperty('--p-sombre', c.sombre);
  document.documentElement.style.setProperty('--p-clair', c.clair);

  if (!idT) return ecranTextes(parcours);
  const index = parcours.textes.findIndex((t) => t.id === idT);
  const texte = parcours.textes[index];
  if (!texte) return aller(['p', idP]);
  if (!act) return ecranActivites(parcours, texte, index);
  if (!MOTEURS[act] || !activitesDisponibles(texte)[act]) return aller(['p', idP, 't', idT]);
  ecranActivite(parcours, texte, index, act);
}

function majFil(elements) {
  vider(filAriane);
  boutonRetour.hidden = elements.length === 0;
  elements.forEach((e, i) => {
    if (i) filAriane.append(el('span', { class: 'fil-sep', 'aria-hidden': 'true' }, '›'));
    filAriane.append(el('span', { class: i === elements.length - 1 ? 'fil-ici' : '' }, e));
  });
}

// ---------------------------------------------------------------------------
// Écrans
// ---------------------------------------------------------------------------
function ecranAccueil() {
  majFil([]);
  document.documentElement.style.removeProperty('--p-fond');
  vue.append(
    el('div', { class: 'titre-jeu' },
      el('h1', {}, el('span', {}, 'Choisis'), el('span', {}, 'ton parcours')),
      boutonEcouter('Choisis ton parcours.')),
    el('div', { class: 'grille-parcours' },
      contenu.parcours.map((p) => {
        const c = couleurDe(p);
        const n = p.textes.length;
        return el('button', {
          class: 'carte-parcours',
          style: { '--c': c.fond, '--cs': c.sombre, '--cc': c.clair },
          disabled: n === 0,
          onclick: () => { jouer('choisir'); aller(['p', String(p.id)]); },
          onpointerenter: () => jouer('deplacer'),
        },
        el('span', { class: 'cp-etiquette' }, 'Parcours'),
        el('span', { class: 'cp-numero' }, String(p.id)),
        el('span', { class: 'cp-info' }, n ? `${n} texte${n > 1 ? 's' : ''}` : 'Bientôt'));
      })),
  );
}

function ecranTextes(parcours) {
  majFil([parcours.nom]);
  vue.append(
    el('div', { class: 'entete-ecran' },
      el('h1', {}, parcours.nom),
      el('p', {}, 'Choisis ton texte.'), boutonEcouter('Choisis ton texte.')),
    el('ol', { class: 'grille-textes' },
      parcours.textes.map((t, i) => el('li', {},
        el('button', {
          class: 'carte-texte',
          onclick: () => { jouer('choisir'); aller(['p', String(parcours.id), 't', t.id]); },
          onpointerenter: () => jouer('deplacer'),
        },
        el('span', { class: 'ct-numero' }, String(i + 1).padStart(2, '0')),
        el('span', { class: 'ct-titre' }, t.titre || `Texte ${i + 1}`),
        !t.valide ? el('span', { class: 'ct-brouillon' }, 'non validé') : null)))),
  );
}

function ecranActivites(parcours, texte, index) {
  majFil([parcours.nom, `Texte ${index + 1}`]);
  const dispo = activitesDisponibles(texte);
  vue.append(
    el('div', { class: 'entete-ecran' },
      el('p', { class: 'surtitre' }, `Texte ${index + 1}`),
      el('h1', {}, texte.titre),
      el('p', {}, 'Choisis ton activité.'), boutonEcouter(`${texte.titre}. Choisis ton activité.`)),
    el('div', { class: 'grille-activites' },
      ACTIVITES.map((a) => el('div', { class: 'cartouche-wrap' },
        el('button', {
          class: `cartouche cartouche-${a.cle}`,
          disabled: !dispo[a.cle],
          onclick: () => { jouer('choisir'); aller(['p', String(parcours.id), 't', texte.id, a.cle]); },
          onpointerenter: () => jouer('deplacer'),
        },
        el('span', { class: 'cartouche-icone' }, iconePixel(a.cle, { taille: 64, contour: '#1b1626', fond: 'var(--fond-icone)', reflet: '#ffffffaa' })),
        el('span', { class: 'cartouche-nom' }, a.nom),
        el('span', { class: 'cartouche-aide' }, a.aide)),
        boutonEcouter(`${a.nom}. ${a.aide}`, 'petit')))),
  );
}

function ecranActivite(parcours, texte, index, act) {
  const a = ACTIVITES.find((x) => x.cle === act);
  majFil([parcours.nom, `Texte ${index + 1}`, a.nom]);
  const zone = el('section', { class: `activite activite-${act}` });
  vue.append(zone);
  nettoyage = MOTEURS[act](zone, {
    texte,
    parcours,
    finir: () => aller(['p', String(parcours.id), 't', texte.id]),
  });
}

function boutonEcouter(phrase, taille = '') {
  return el('button', {
    class: `btn-ecouter ${taille}`,
    'aria-label': `Écouter : ${phrase}`,
    onclick: (e) => { e.stopPropagation(); dire(phrase); },
  }, iconePixel('son', { taille: taille ? 18 : 22, contour: 'currentColor', fond: 'currentColor' }));
}

window.addEventListener('hashchange', afficher);
afficher();
