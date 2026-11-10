// Génération de la grille de mots mêlés.
import { formeGrille, graine } from './texte.js';

export const DIRECTIONS = {
  simple: [[0, 1], [1, 0]],                              // → ↓
  diagonales: [[0, 1], [1, 0], [1, 1]],                   // → ↓ ↘
  completes: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0]], // + ↗ ← ↑
};

// Lettres de remplissage pondérées selon leur fréquence en français.
const REMPLISSAGE = 'EEEEEEAAAAASSSSIIIINNNNTTTTRRRRUUULLLOOODDCCMMPPGBVHFQJXYZK';

/**
 * @param {string[]} mots  mots à cacher (forme libre, normalisés ici)
 * @param {object} opts    { directions: 'simple'|'diagonales'|'completes', cle: string }
 * @returns {{ taille:number, lettres:string[][], places:{mot:string, affiche:string, cases:[number,number][]}[], ignores:string[] }}
 */
export function genererGrille(mots, { directions = 'simple', cle = 'grille' } = {}) {
  const dirs = DIRECTIONS[directions] || DIRECTIONS.simple;
  const liste = [];
  const vus = new Set();
  for (const m of mots) {
    const g = formeGrille(m);
    if (g.length >= 2 && !vus.has(g)) { vus.add(g); liste.push({ mot: g, affiche: String(m).trim() }); }
  }
  liste.sort((a, b) => b.mot.length - a.mot.length);
  const plusLong = liste.length ? liste[0].mot.length : 6;
  const lettresTotales = liste.reduce((s, x) => s + x.mot.length, 0);
  let taille = Math.max(plusLong + 1, 7, Math.ceil(Math.sqrt(lettresTotales * 2.2)));
  taille = Math.min(taille, 14);

  // Plusieurs essais : on garde la grille qui place le plus de mots.
  let meilleure = null;
  for (let essai = 0; essai < 40; essai++) {
    const alea = graine(`${cle}|${directions}|${essai}`);
    const t = taille + Math.floor(essai / 12);
    const res = tenter(liste, t, dirs, alea);
    if (!meilleure || res.places.length > meilleure.places.length) meilleure = res;
    if (res.places.length === liste.length) break;
  }
  const alea = graine(`${cle}|remplissage`);
  for (const ligne of meilleure.lettres) {
    for (let c = 0; c < ligne.length; c++) {
      if (!ligne[c]) ligne[c] = REMPLISSAGE[Math.floor(alea() * REMPLISSAGE.length)];
    }
  }
  const placesMots = new Set(meilleure.places.map((p) => p.mot));
  meilleure.ignores = liste.filter((x) => !placesMots.has(x.mot)).map((x) => x.affiche);
  return meilleure;
}

function tenter(liste, taille, dirs, alea) {
  const lettres = Array.from({ length: taille }, () => Array(taille).fill(''));
  const places = [];
  for (const { mot, affiche } of liste) {
    if (mot.length > taille) continue;
    const options = [];
    for (const [dl, dc] of dirs) {
      for (let l = 0; l < taille; l++) {
        for (let c = 0; c < taille; c++) {
          const fl = l + dl * (mot.length - 1);
          const fc = c + dc * (mot.length - 1);
          if (fl < 0 || fl >= taille || fc < 0 || fc >= taille) continue;
          let ok = true;
          let croisements = 0;
          for (let i = 0; i < mot.length; i++) {
            const x = lettres[l + dl * i][c + dc * i];
            if (x && x !== mot[i]) { ok = false; break; }
            if (x) croisements++;
          }
          if (ok) options.push({ l, c, dl, dc, croisements, r: alea() });
        }
      }
    }
    if (!options.length) continue;
    // Privilégie un peu les croisements, sans en faire une règle.
    options.sort((a, b) => (b.croisements * 0.6 + b.r) - (a.croisements * 0.6 + a.r));
    const o = options[0];
    const cases = [];
    for (let i = 0; i < mot.length; i++) {
      lettres[o.l + o.dl * i][o.c + o.dc * i] = mot[i];
      cases.push([o.l + o.dl * i, o.c + o.dc * i]);
    }
    places.push({ mot, affiche, cases });
  }
  return { taille, lettres, places };
}
