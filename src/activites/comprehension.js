// Compréhension : questions à choix, avec retour au texte en cas d'erreur.
import { el, vider, remplir, ajouter, iconePixel, fenetre } from '../ui.js';
import { melanger, propre } from '../lib/texte.js';
import { jouer } from '../sons.js';
import { dire, taire } from '../voix.js';

const LETTRES = ['A', 'B', 'C', 'D'];

export function monterComprehension(zone, { texte, finir }) {
  const questions = texte.activites.comprehension.questions;
  let i = 0;
  let resultats = [];

  const progression = el('div', { class: 'progression' });
  const etape = el('div', { class: 'compr-etape' });
  ajouter(zone, 
    el('div', { class: 'activite-entete' },
      el('h2', {}, 'Je comprends le texte'),
      el('p', { class: 'consigne' }, 'Lis la question et choisis la bonne réponse. Tu peux relire le texte quand tu veux.')),
    el('div', { class: 'boutons-haut' },
      el('button', { class: 'btn-px', onclick: () => ouvrirTexte() }, '📖 Relire le texte')),
    progression,
    etape,
  );

  function majProgression() {
    remplir(progression, 
      el('span', { class: 'progression-texte' }, `Question ${Math.min(i + 1, questions.length)} / ${questions.length}`),
      el('span', { class: 'progression-barre' },
        questions.map((_, k) => el('i', { class: k < i ? (resultats[k] ? 'ok' : 'ko') : k === i ? 'ici' : '' }))),
    );
  }

  function afficherQuestion() {
    majProgression();
    const q = questions[i];
    let erreurs = 0;
    const ordre = melanger(q.choix.map((c, k) => ({ c, juste: k === (q.bonne ?? 0) })).filter((x) => String(x.c || '').trim()));
    const aide = el('div', { class: 'aide-question', 'aria-live': 'polite' });
    const choix = ordre.map((o, k) => {
      const b = el('div', { class: 'choix-ligne' },
        el('button', { class: 'choix', onclick: () => repondre(o, bouton) },
          el('span', { class: 'choix-lettre' }, LETTRES[k]),
          el('span', { class: 'choix-texte' }, o.c)),
        el('button', { class: 'btn-ecouter petit', 'aria-label': `Écouter la réponse ${LETTRES[k]}`, onclick: () => dire(o.c) },
          iconePixel('son', { taille: 18, contour: 'currentColor', fond: 'currentColor' })));
      const bouton = b.querySelector('.choix');
      return b;
    });
    const suite = el('div', { class: 'boutons' });

    remplir(etape, 
      el('div', { class: 'question' },
        el('p', {}, q.question),
        el('button', { class: 'btn-ecouter', 'aria-label': 'Écouter la question', onclick: () => dire(q.question) },
          iconePixel('son', { taille: 22, contour: 'currentColor', fond: 'currentColor' }))),
      el('div', { class: 'liste-choix' }, choix),
      aide,
      suite,
    );

    function repondre(o, bouton) {
      if (bouton.disabled) return;
      taire();
      if (o.juste) {
        jouer('juste');
        resultats[i] = erreurs === 0;
        bouton.classList.add('juste');
        etape.querySelectorAll('.choix').forEach((b) => { b.disabled = true; });
        remplir(aide, el('p', { class: 'msg-ok' }, erreurs === 0 ? 'Bonne réponse !' : 'Oui, c\'est ça !'),
          q.extrait ? el('p', { class: 'extrait' }, 'Dans le texte : ', el('q', {}, q.extrait)) : null);
        remplir(suite, el('button', { class: 'btn-px btn-principal', onclick: suivant }, i + 1 < questions.length ? 'Question suivante ▶' : 'Terminer ▶'));
        voir();
        return;
      }
      erreurs++;
      jouer('faux');
      bouton.disabled = true;
      bouton.classList.add('faux');
      if (erreurs === 1) {
        remplir(aide, 
          el('p', { class: 'msg-ko' }, 'Ce n\'est pas ça. Retourne dans le texte.'),
          q.indice ? el('p', { class: 'indice' }, '💡 ', q.indice) : null,
          el('button', { class: 'btn-px', onclick: () => ouvrirTexte(q.extrait) }, '📖 Relire le passage'));
      } else {
        resultats[i] = false;
        const bon = [...etape.querySelectorAll('.choix')][ordre.findIndex((x) => x.juste)];
        bon.classList.add('juste', 'revele');
        etape.querySelectorAll('.choix').forEach((b) => { b.disabled = true; });
        remplir(aide, 
          el('p', { class: 'msg-ko' }, 'Voici la bonne réponse.'),
          q.extrait ? el('p', { class: 'extrait' }, 'Le texte dit : ', el('q', {}, q.extrait)) : null);
        remplir(suite, el('button', { class: 'btn-px btn-principal', onclick: suivant }, i + 1 < questions.length ? 'Question suivante ▶' : 'Terminer ▶'));
      }
      voir();
    }

    function voir() {
      requestAnimationFrame(() => (suite.firstChild || aide).scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }

  function ouvrirTexte(extrait) {
    const cible = extrait ? propre(extrait) : '';
    let marque = false;
    const paragraphes = String(texte.texte).split(/\n+/).map(propre).filter(Boolean).map((p) => {
      const k = cible && !marque ? p.indexOf(cible) : -1;
      if (k < 0) return el('p', {}, p);
      marque = true;
      return el('p', {}, p.slice(0, k), el('mark', {}, cible), p.slice(k + cible.length));
    });
    const papier = el('div', { class: 'papier papier-fenetre' }, paragraphes);
    const { fermer } = fenetre(el('div', {},
      el('div', { class: 'fenetre-titre' }, el('h2', {}, texte.titre),
        el('button', { class: 'btn-px', onclick: () => fermer() }, 'Fermer ✕')),
      papier));
    setTimeout(() => papier.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  }

  function suivant() {
    taire();
    i++;
    if (i < questions.length) afficherQuestion();
    else bilan();
  }

  function bilan() {
    majProgression();
    vider(etape);
    const bons = resultats.filter(Boolean).length;
    jouer(bons === questions.length ? 'victoire' : 'juste');
    const { fermer } = fenetre(el('div', { class: 'bravo' },
      iconePixel('etoile', { taille: 72, contour: '#1b1626', fond: '#ffd23f' }),
      el('h2', {}, 'Questions terminées'),
      el('p', {}, `${bons} bonne${bons > 1 ? 's' : ''} réponse${bons > 1 ? 's' : ''} du premier coup sur ${questions.length}.`),
      el('div', { class: 'boutons' },
        el('button', { class: 'btn-px', onclick: () => { fermer(); i = 0; resultats = []; afficherQuestion(); } }, 'Recommencer'),
        el('button', { class: 'btn-px btn-principal', onclick: () => { fermer(); finir(); } }, 'Autre activité'))));
  }

  afficherQuestion();
  return () => taire();
}
