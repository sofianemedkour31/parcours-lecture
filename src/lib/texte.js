// Outils de traitement du texte, partagés par l'application et la fonction Albert.

/** Retire les accents : « Élève » → « Eleve ». */
export function sansAccents(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Apostrophes et espaces homogènes. */
export function propre(s) {
  return String(s ?? '')
    .replace(/[’‘ʼ`´]/g, "'")
    .replace(/ | /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Forme comparable pour la dictée : minuscules, apostrophes droites, accents conservés. */
export function formeDictee(s) {
  return propre(s).toLocaleLowerCase('fr-FR');
}

/** Forme pour la grille de mots mêlés : majuscules sans accents, lettres seules. */
export function formeGrille(s) {
  return sansAccents(propre(s))
    .toLocaleUpperCase('fr-FR')
    .replace(/Œ/g, 'OE')
    .replace(/Æ/g, 'AE')
    .replace(/[^A-Z]/g, '');
}

/** Liste des mots du texte (pour vérifier qu'un mot proposé y figure bien). */
export function motsDuTexte(texte) {
  const t = propre(texte).toLocaleLowerCase('fr-FR');
  return t.split(/[^a-zàâäçéèêëîïôöùûüÿœæ'-]+/i)
    .flatMap((m) => m.split("'"))
    .map((m) => m.replace(/^-+|-+$/g, ''))
    .filter(Boolean);
}

export function figureDansTexte(mot, texte) {
  const cible = formeDictee(mot);
  if (!cible) return false;
  const contenu = formeDictee(texte);
  const lettre = /[\p{L}\p{N}]/u;
  let position = contenu.indexOf(cible);
  while (position !== -1) {
    const fin = position + cible.length;
    if ((position === 0 || !lettre.test(contenu[position - 1]))
      && (fin === contenu.length || !lettre.test(contenu[fin]))) return true;
    position = contenu.indexOf(cible, position + 1);
  }
  return false;
}

/** Découpe en phrases, en gardant la ponctuation finale. */
export function phrases(texte) {
  const t = propre(texte);
  const morceaux = t.match(/[^.!?…]+[.!?…]+["»”)]*|[^.!?…]+$/g) || [];
  return morceaux.map((p) => p.trim()).filter(Boolean);
}

/** Première phrase du texte qui contient le mot (forme exacte, insensible à la casse). */
export function phraseAvec(mot, texte) {
  return phrases(texte).find((p) => figureDansTexte(mot, p)) || '';
}

/** Découpe le texte en paragraphes puis en jetons (mots + espaces/ponctuation). */
export function jetons(texte) {
  const paragraphes = String(texte ?? '')
    .replace(/\r/g, '')
    .split(/\n\s*\n|\n/)
    .map(propre)
    .filter(Boolean);
  return paragraphes.map((p) => {
    const out = [];
    const re = /([A-Za-zÀ-ÖØ-öø-ÿŒœÆæ0-9]+(?:['-][A-Za-zÀ-ÖØ-öø-ÿŒœÆæ0-9]+)*'?)|([^A-Za-zÀ-ÖØ-öø-ÿŒœÆæ0-9]+)/g;
    let r;
    while ((r = re.exec(p))) {
      if (r[1]) out.push({ type: 'mot', v: r[1] });
      else out.push({ type: 'sep', v: r[2] });
    }
    return out;
  });
}

export function compterMots(texte) {
  return jetons(texte).flat().filter((j) => j.type === 'mot').length;
}

/** Générateur pseudo-aléatoire reproductible (même texte → même grille). */
export function graine(chaine) {
  let h = 1779033703 ^ chaine.length;
  for (let i = 0; i < chaine.length; i++) {
    h = Math.imul(h ^ chaine.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function melanger(tableau, alea = Math.random) {
  const t = tableau.slice();
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}
