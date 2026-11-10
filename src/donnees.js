// Chargement du contenu des parcours.
// Les élèves lisent le fichier publié ; le studio travaille sur un brouillon local.
import { erreursMaze } from './lib/activites-lecture.js';

export const CLE_BROUILLON = 'pl-studio-brouillon';
export const CLE_APERCU = 'pl-apercu';

/** Le contenu est du JSON ; cette copie fonctionne aussi dans les anciens navigateurs Android. */
export function copierJson(valeur) { return JSON.parse(JSON.stringify(valeur)); }

export const COULEURS = {
  vert: { fond: '#5dbb63', sombre: '#2f6b3a', clair: '#c9efc0' },
  jaune: { fond: '#f2b544', sombre: '#7a5310', clair: '#fde7b5' },
  orange: { fond: '#ec6d4f', sombre: '#7a2716', clair: '#fbd0c3' },
  bleu: { fond: '#6f8cff', sombre: '#26357d', clair: '#d3dcff' },
  violet: { fond: '#b07cf0', sombre: '#4c2380', clair: '#e9dafc' },
  rose: { fond: '#ef7fb3', sombre: '#7a1f4a', clair: '#fbd6e7' },
};

export const ACTIVITES = [
  { cle: 'lecture', nom: 'Lire', aide: 'Lis le texte avec le prompteur.' },
  { cle: 'dictee', nom: 'Dictée', aide: 'Écoute les mots et écris-les.' },
  { cle: 'comprehension', nom: 'Comprendre', aide: 'Réponds aux questions sur le texte.' },
  { cle: 'motsMeles', nom: 'Mots mêlés', aide: 'Retrouve les mots cachés dans la grille.' },
  { cle: 'maze', nom: 'Labyrinthe de lecture', aide: 'Choisis le seul mot qui convient dans le texte.' },
];

export function couleurDe(parcours) {
  return COULEURS[parcours?.couleur] || COULEURS.vert;
}

export function modeApercu() {
  try { return sessionStorage.getItem(CLE_APERCU) === '1'; } catch { return false; }
}

export function lireBrouillon() {
  try {
    const b = localStorage.getItem(CLE_BROUILLON);
    return b ? JSON.parse(b) : null;
  } catch { return null; }
}

/** Ajoute une nouvelle livraison de textes au brouillon sans écraser le travail local. */
export function fusionnerCorpus(brouillon, publie) {
  const version = Number(publie?.corpusVersion || 0);
  if (!version || version <= Number(brouillon?.corpusVersion || 0)) return false;

  for (const source of publie.parcours || []) {
    let cible = brouillon.parcours.find((p) => p.id === source.id);
    if (!cible) {
      cible = copierJson({ ...source, textes: [] });
      brouillon.parcours.push(cible);
    }
    cible.textes ||= [];
    const dejaPresents = new Set();
    const textesDuCorpus = (source.textes || []).map((texte) => {
      const existant = cible.textes.find((t) => t.id === texte.id)
        || cible.textes.find((t) => t.titre === texte.titre && t.texte === texte.texte);
      if (existant) {
        dejaPresents.add(existant);
        return existant;
      }
      return copierJson(texte);
    });
    cible.textes = [...textesDuCorpus, ...cible.textes.filter((t) => !dejaPresents.has(t))];
  }
  brouillon.corpusVersion = version;
  return true;
}

export async function chargerPublie() {
  const r = await fetch(`/contenu/parcours.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Contenu introuvable (${r.status}).`);
  return r.json();
}

/** Contenu vu par l'élève : seulement les textes validés, sauf en mode aperçu du studio. */
export async function chargerPourEleve() {
  const apercu = modeApercu();
  const source = (apercu && lireBrouillon()) || await chargerPublie();
  return {
    ...source,
    parcours: (source.parcours || []).map((p) => ({
      ...p,
      textes: (p.textes || []).filter((t) => apercu || t.valide),
    })),
  };
}

export function activitesDisponibles(texte) {
  const a = texte?.activites || {};
  return {
    lecture: Boolean(a.lecture?.actif !== false && texte?.texte),
    dictee: Boolean(a.dictee?.actif !== false && a.dictee?.mots?.length),
    comprehension: Boolean(a.comprehension?.actif !== false && a.comprehension?.questions?.length),
    motsMeles: Boolean(a.motsMeles?.actif !== false && a.motsMeles?.mots?.length),
    maze: Boolean(a.maze?.actif !== false && a.maze?.trous?.length
      && !erreursMaze(texte?.texte || '', a.maze.trous).length),
  };
}
