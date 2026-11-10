// Règles communes au studio et à la publication : un texte validé doit être jouable.
import { genererGrille } from './grille.js';
import { figureDansTexte, formeDictee, formeGrille, propre } from './texte.js';
import { bornesGroupes, erreursMaze } from './activites-lecture.js';

export function erreursTexte(t, parcours) {
  const erreurs = [];
  if (!propre(t?.titre)) erreurs.push('le titre');
  if (String(t?.texte || '').trim().length < 20) erreurs.push('le texte (20 caractères minimum)');

  const a = t?.activites || {};
  const texte = String(t?.texte || '');
  if (a.lecture?.actif !== false && (a.lecture?.groupesDemandes || a.lecture?.groupes?.length)
    && !bornesGroupes(texte, a.lecture.groupes)) {
    erreurs.push('des groupes de souffle qui couvrent tout le texte dans l’ordre');
  }
  if (a.dictee?.actif !== false) {
    const mots = a.dictee?.mots;
    if (!Array.isArray(mots) || mots.length < 2) erreurs.push('au moins 2 mots de dictée');
    else {
      const vus = new Set();
      for (const item of mots) {
        const mot = propre(item?.mot);
        const forme = formeDictee(mot);
        if (!mot || !figureDansTexte(mot, texte) || vus.has(forme)) {
          erreurs.push('des mots de dictée distincts et présents dans le texte');
          break;
        }
        vus.add(forme);
      }
    }
  }

  if (a.comprehension?.actif !== false) {
    const questions = a.comprehension?.questions;
    if (!Array.isArray(questions) || !questions.length) erreurs.push('des questions de compréhension');
    else {
      const invalides = questions.filter((q) => {
        if (!propre(q?.question) || !Array.isArray(q.choix) || q.choix.length !== 3) return true;
        const choix = q.choix.map((c) => formeDictee(c));
        if (choix.some((c) => !c) || new Set(choix).size !== 3) return true;
        if (!Number.isInteger(q.bonne) || q.bonne < 0 || q.bonne > 2) return true;
        return Boolean(q.extrait && !propre(texte).includes(propre(q.extrait)));
      });
      if (invalides.length) erreurs.push(`${invalides.length} question(s) sans 3 réponses distinctes, bonne réponse ou passage valide`);
    }
  }

  if (a.motsMeles?.actif !== false) {
    const mots = a.motsMeles?.mots;
    if (!Array.isArray(mots) || mots.length < 3) erreurs.push('au moins 3 mots pour les mots mêlés');
    else {
      const formes = mots.map(formeGrille);
      const invalides = mots.some((mot, i) => !/^[\p{L}]+$/u.test(mot)
        || formes[i].length < 3 || formes[i].length > 12 || !figureDansTexte(mot, texte));
      if (invalides || new Set(formes).size !== mots.length) {
        erreurs.push('des mots mêlés distincts, de 3 à 12 lettres et présents dans le texte');
      } else {
        const grille = genererGrille(mots, {
          directions: a.motsMeles.directions || parcours?.reglages?.directions || 'simple',
          cle: `${t.id}|${mots.join(',')}`,
        });
        if (grille.ignores.length) erreurs.push(`une grille complète (mots non placés : ${grille.ignores.join(', ')})`);
      }
    }
  }
  if (a.maze?.actif !== false && a.maze) {
    erreurs.push(...erreursMaze(texte, a.maze.trous).map((e) => `MAZE : ${e}`));
  }
  return erreurs;
}

