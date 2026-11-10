import { formeDictee, jetons } from './texte.js';

export function motsLecture(texte) {
  return jetons(texte).flat().filter((j) => j.type === 'mot').map((j) => j.v);
}

/** Un trou proche de chaque septième mot, en évitant les mots-outils. */
export function ciblesMaze(texte) {
  const mots = motsLecture(texte);
  const outils = new Set('les des une aux sur sous par pour que qui quoi dont est ont pas son ses mes tes nos vos leur leurs elle elles nous vous ils lui eux avec aussi dans depuis entre mais puis quand sans sont tous tout très cette comme encore alors après avant avait était faire ainsi celui celle notre votre'.split(' '));
  const positions = [];
  for (let centre = 6; centre < mots.length; centre += 7) {
    const index = [0, 1, -1, 2, -2, 3, -3]
      .map((decalage) => centre + decalage)
      .find((i) => i >= 0 && i < mots.length && !positions.includes(i)
        && /^[\p{L}]{3,15}$/u.test(mots[i]) && !outils.has(formeDictee(mots[i])));
    if (index !== undefined) positions.push(index);
  }
  return positions.map((index) => ({
    index,
    mot: mots[index],
    contexte: mots.slice(Math.max(0, index - 5), index).join(' ')
      + ` [${mots[index]}] `
      + mots.slice(index + 1, index + 6).join(' '),
  }));
}

/** Renvoie les bornes des groupes si chaque mot du texte est couvert une fois, dans l'ordre. */
export function bornesGroupes(texte, groupes) {
  if (!Array.isArray(groupes) || !groupes.length) return null;
  const mots = motsLecture(texte).map(formeDictee);
  const bornes = [];
  let index = 0;
  for (const groupe of groupes) {
    const termes = motsLecture(groupe).map(formeDictee);
    if (!termes.length || termes.length > 8) return null;
    if (termes.some((mot, k) => mots[index + k] !== mot)) return null;
    bornes.push({ debut: index, fin: index + termes.length - 1 });
    index += termes.length;
  }
  return index === mots.length ? bornes : null;
}

export function erreursMaze(texte, trous) {
  const cibles = ciblesMaze(texte);
  if (!Array.isArray(trous) || trous.length !== cibles.length) return ['un choix pour chaque mot prévu (environ un sur sept)'];
  const vus = new Set();
  const erreurs = [];
  for (const trou of trous) {
    const cible = cibles.find((c) => c.index === trou?.index);
    if (!cible || vus.has(trou.index)) { erreurs.push('des positions uniques et présentes dans le texte'); break; }
    vus.add(trou.index);
    const choix = trou.choix;
    if (!Array.isArray(choix) || choix.length !== 3 || choix[0] !== cible.mot
      || choix.some((mot) => !/^[\p{L}]{2,20}$/u.test(String(mot || '')))
      || new Set(choix.map(formeDictee)).size !== 3) {
      erreurs.push('trois mots distincts par choix, dont le bon mot du texte');
      break;
    }
  }
  return erreurs;
}
