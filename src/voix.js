// Synthèse vocale française (consignes, mots de dictée, questions).
let voixFr = null;

function syntheseVocale() {
  try { return window.speechSynthesis || null; } catch { return null; }
}

function chercherVoix() {
  let toutes = [];
  try { toutes = syntheseVocale()?.getVoices?.() || []; } catch { /* API vocale indisponible */ }
  const fr = toutes.filter((v) => /^fr(-|_|$)/i.test(v.lang));
  voixFr = fr.find((v) => /fr-FR/i.test(v.lang) && /google|natural|amélie|audrey|thomas|marie/i.test(v.name))
    || fr.find((v) => /fr-FR/i.test(v.lang))
    || fr[0]
    || null;
}

if (syntheseVocale()) {
  chercherVoix();
  try { syntheseVocale().addEventListener?.('voiceschanged', chercherVoix); } catch { /* navigateur ancien */ }
}

export function voixDisponible() { return Boolean(syntheseVocale()); }

/** Lit un texte. Renvoie une promesse résolue à la fin de la lecture. */
export function dire(texte, { vitesse = 0.9, onFin } = {}) {
  return new Promise((resolve) => {
    if (!voixDisponible() || !texte) { resolve(); return; }
    window.speechSynthesis.cancel();
    if (!voixFr) chercherVoix();
    const u = new SpeechSynthesisUtterance(String(texte));
    u.lang = 'fr-FR';
    if (voixFr) u.voice = voixFr;
    u.rate = vitesse;
    u.onend = () => { onFin?.(); resolve(); };
    u.onerror = () => { onFin?.(); resolve(); };
    // Petit délai : sur Android, cancel() suivi d'un speak() immédiat est parfois ignoré.
    setTimeout(() => window.speechSynthesis.speak(u), 60);
  });
}

export function taire() {
  if (voixDisponible()) window.speechSynthesis.cancel();
}
