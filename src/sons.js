// Petits sons de console, générés à la volée (aucun fichier audio).
let ctx = null;
let muet = (() => { try { return localStorage.getItem('pl-muet') === '1'; } catch { return false; } })();

export function estMuet() { return muet; }
export function basculerMuet() {
  muet = !muet;
  try { localStorage.setItem('pl-muet', muet ? '1' : '0'); } catch { /* stockage indisponible */ }
  return muet;
}

function note(freq, debut, duree, { type = 'square', volume = 0.06 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + debut);
  g.gain.setValueAtTime(volume, ctx.currentTime + debut);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + debut + duree);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + debut);
  o.stop(ctx.currentTime + debut + duree + 0.02);
}

const MOTIFS = {
  deplacer: () => note(660, 0, 0.05, { volume: 0.035 }),
  choisir: () => { note(523, 0, 0.06); note(784, 0.06, 0.08); },
  retour: () => { note(523, 0, 0.05); note(392, 0.05, 0.08); },
  juste: () => { note(659, 0, 0.07); note(784, 0.07, 0.07); note(1047, 0.14, 0.14); },
  faux: () => { note(196, 0, 0.12, { type: 'sawtooth', volume: 0.04 }); note(165, 0.12, 0.16, { type: 'sawtooth', volume: 0.04 }); },
  trouve: () => { note(880, 0, 0.06); note(1175, 0.06, 0.1); },
  victoire: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => note(f, i * 0.1, 0.12)); },
};

export function jouer(nom) {
  if (muet || !MOTIFS[nom]) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    MOTIFS[nom]();
  } catch { /* audio indisponible : on ignore */ }
}
