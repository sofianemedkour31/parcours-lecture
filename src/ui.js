// Petits outils d'interface : création d'éléments, icônes pixel, fenêtres.

/** el('button', { class: 'x', onclick }, 'texte', autreElement) */
export function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith('--')) n.style.setProperty(p, val);
        else n.style[p] = val;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'html') n.innerHTML = v;
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (const e of enfants.flat(Infinity)) {
    if (e == null || e === false) continue;
    n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return n;
}

export function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

/** Ajoute des enfants en ignorant null/false (append() écrirait « null »). */
export function ajouter(n, ...enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e == null || e === false) continue;
    n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return n;
}

/** Vide puis remplit. */
export function remplir(n, ...enfants) { return ajouter(vider(n), ...enfants); }

export function echapper(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Icônes pixel : chaque caractère d'une ligne est un pixel.
// '#' contour, 'o' remplissage, 'x' reflet, '.' transparent.
// ---------------------------------------------------------------------------
const DESSINS = {
  lecture: [
    '..............',
    '.###......###.',
    '#ooo##..##ooo#',
    '#oxooo##oooxo#',
    '#oooooo#ooooo#',
    '#oxxooo#oxxoo#',
    '#oooooo#ooooo#',
    '#oxxxoo#oxxxo#',
    '#oooooo#ooooo#',
    '#oxxooo#oxxoo#',
    '#oooooo#ooooo#',
    '.###ooo#ooo###',
    '....###.###...',
    '..............',
  ],
  dictee: [
    '..........##..',
    '.........#xx#.',
    '........#oo##.',
    '.......#oo#o#.',
    '......#oo#o#..',
    '.....#oo#o#...',
    '....#oo#o#....',
    '...#oo#o#.....',
    '..#oo#o#......',
    '..#xx#o#......',
    '.#xxx##.......',
    '.###..........',
    '...........###',
    '.......#######',
  ],
  comprehension: [
    '....######....',
    '...#oooooo#...',
    '..#oo####oo#..',
    '..#o#....#o#..',
    '...#.....#o#..',
    '........#oo#..',
    '.......#oo#...',
    '......#oo#....',
    '......#oo#....',
    '.......##.....',
    '......####....',
    '......#oo#....',
    '......####....',
    '..............',
  ],
  motsMeles: [
    '...#####......',
    '..#xoooo#.....',
    '.#xooooooo#...',
    '.#oooooooo#...',
    '.#oooooooo#...',
    '.#oooooooo#...',
    '..#oooooo#....',
    '...######.#...',
    '..........##..',
    '...........##.',
    '............##',
    '.............#',
    '..............',
    '..............',
  ],
  maze: [
    '##############',
    '#oo#oooooo#oo#',
    '#oo#o####o#oo#',
    '#oooo#xx#oooo#',
    '####o#xx#o####',
    '#oooo#oo#oooo#',
    '#o####oo####o#',
    '#oooooo##oooo#',
    '#o#######o##o#',
    '#oooooo#ooooo#',
    '###o##o#o#####',
    '#oooo#ooooooo#',
    '#o##o#######o#',
    '##############',
  ],
  retour: [
    '....##....',
    '...#o#....',
    '..#oo#####',
    '.#oooooooo',
    '#ooooooooo',
    '.#oooooooo',
    '..#oo#####',
    '...#o#....',
    '....##....',
  ],
  son: [
    '.....#....',
    '....##..#.',
    '###o#..#..',
    '#oo##.#..#',
    '#oo##.#..#',
    '###o#..#..',
    '....##..#.',
    '.....#....',
  ],
  muet: [
    '.....#....',
    '....##....',
    '###o#.#..#',
    '#oo##..##.',
    '#oo##..##.',
    '###o#.#..#',
    '....##....',
    '.....#....',
  ],
  etoile: [
    '....##....',
    '....##....',
    '...#oo#...',
    '####oo####',
    '.#oooooo#.',
    '..#oooo#..',
    '..#o##o#..',
    '.#o#..#o#.',
    '.##....##.',
  ],
};

export function iconePixel(nom, { contour = 'currentColor', fond = 'var(--icone-fond, #fff)', reflet = 'var(--icone-reflet, rgba(255,255,255,.6))', taille = 48 } = {}) {
  const lignes = DESSINS[nom];
  if (!lignes) return el('span');
  const h = lignes.length;
  const w = lignes[0].length;
  const couleurs = { '#': contour, o: fond, x: reflet };
  let rects = '';
  lignes.forEach((ligne, y) => {
    [...ligne].forEach((c, x) => {
      if (couleurs[c]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${couleurs[c]}"/>`;
    });
  });
  const span = el('span', { class: 'icone-pixel', 'aria-hidden': 'true' });
  span.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${taille}" height="${Math.round(taille * h / w)}" shape-rendering="crispEdges">${rects}</svg>`;
  return span;
}

/** Fenêtre superposée simple. Renvoie { fermer, boite }. */
export function fenetre(contenu, { classe = '', onFermer } = {}) {
  const fond = el('div', { class: `fenetre-fond ${classe}` });
  const boite = el('div', { class: 'fenetre', role: 'dialog', 'aria-modal': 'true' }, contenu);
  fond.append(boite);
  const fermer = () => { fond.remove(); document.removeEventListener('keydown', echap); onFermer?.(); };
  const echap = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
  fond.addEventListener('click', (e) => { if (e.target === fond) fermer(); });
  document.addEventListener('keydown', echap);
  document.body.append(fond);
  return { fermer, boite };
}

export function formaterDuree(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
