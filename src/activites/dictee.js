// Dictée de mots : l'élève écoute un mot du texte et l'écrit.
import { el, vider, remplir, ajouter, iconePixel, fenetre } from '../ui.js';
import { formeDictee } from '../lib/texte.js';
import { jouer } from '../sons.js';
import { dire, taire, voixDisponible } from '../voix.js';

const ACCENTS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'ù', 'û', 'î', 'ï', 'ô', 'ë', 'œ'];

export function monterDictee(zone, { texte, finir }) {
  const tous = texte.activites.dictee.mots.filter((m) => m.mot);
  let liste = tous;
  let i = 0;
  let essais = 0;
  let resultats = [];
  let attente = null;

  const progression = el('div', { class: 'progression' });
  const etape = el('div', { class: 'dictee-etape' });

  ajouter(zone, 
    el('div', { class: 'activite-entete' },
      el('h2', {}, 'Dictée de mots'),
      el('p', { class: 'consigne' }, 'Écoute le mot, puis écris-le. Tu peux le réécouter autant de fois que tu veux.')),
    !voixDisponible() ? el('p', { class: 'alerte' }, 'La voix n\'est pas disponible sur cet appareil : demande à un adulte de dicter les mots.') : null,
    progression,
    etape,
  );

  function majProgression() {
    remplir(progression, 
      el('span', { class: 'progression-texte' }, `Mot ${Math.min(i + 1, liste.length)} / ${liste.length}`),
      el('span', { class: 'progression-barre' },
        liste.map((_, k) => el('i', { class: k < i ? (resultats[k]?.ok ? 'ok' : 'ko') : k === i ? 'ici' : '' }))),
    );
  }

  function afficherMot() {
    essais = 0;
    majProgression();
    const item = liste[i];
    const champ = el('input', {
      class: 'champ-dictee', type: 'text', autocomplete: 'off', autocapitalize: 'off',
      autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Écris le mot ici', enterkeyhint: 'done',
    });
    const retourMsg = el('div', { class: 'retour-msg', 'aria-live': 'polite' });
    const modele = el('div', { class: 'modele', hidden: true });
    const btnValider = el('button', { class: 'btn-px btn-principal', onclick: valider }, 'Valider');

    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); } });

    remplir(etape, 
      el('div', { class: 'dictee-ecoute' },
        el('button', { class: 'btn-gros-son', onclick: () => dire(item.mot, { vitesse: 0.8 }) },
          iconePixel('son', { taille: 48, contour: 'currentColor', fond: 'currentColor' }), el('span', {}, 'Écouter le mot')),
        el('div', { class: 'dictee-options' },
          el('button', { class: 'btn-px', onclick: () => dire(item.mot, { vitesse: 0.5 }) }, 'Lentement'),
          item.phrase ? el('button', { class: 'btn-px', onclick: () => dire(item.phrase, { vitesse: 0.85 }) }, 'Dans une phrase') : null)),
      modele,
      champ,
      el('div', { class: 'accents', role: 'group', 'aria-label': 'Lettres avec accent' },
        ACCENTS.map((a) => el('button', {
          class: 'touche', type: 'button',
          onclick: () => {
            const d = champ.selectionStart ?? champ.value.length;
            const f = champ.selectionEnd ?? d;
            champ.value = champ.value.slice(0, d) + a + champ.value.slice(f);
            champ.focus();
            champ.setSelectionRange(d + 1, d + 1);
          },
        }, a))),
      retourMsg,
      el('div', { class: 'boutons' }, btnValider),
    );
    setTimeout(() => { champ.focus({ preventScroll: true }); dire(item.mot, { vitesse: 0.8 }); }, 350);

    function valider() {
      const saisie = formeDictee(champ.value);
      if (!saisie) { champ.focus(); return; }
      const juste = formeDictee(item.mot);
      if (saisie === juste) {
        jouer('juste');
        if (!resultats[i]) resultats[i] = { mot: item.mot, ok: essais === 0, saisie: champ.value };
        champ.classList.add('juste');
        champ.disabled = true;
        remplir(retourMsg, el('span', { class: 'msg-ok' }, essais === 0 ? 'Bravo, c\'est juste !' : 'C\'est juste maintenant !'));
        remplir(btnValider.parentNode, el('button', { class: 'btn-px btn-principal', onclick: suivant }, i + 1 < liste.length ? 'Mot suivant ▶' : 'Terminer ▶'));
        attente = setTimeout(suivant, 1400);
        return;
      }
      essais++;
      jouer('faux');
      champ.classList.remove('secoue'); void champ.offsetWidth; champ.classList.add('secoue');
      if (essais === 1) {
        remplir(retourMsg, el('span', { class: 'msg-ko' }, 'Presque ! Réécoute le mot et corrige.'), comparaison(champ.value, item.mot));
        champ.select();
      } else {
        resultats[i] = { mot: item.mot, ok: false, saisie: champ.value };
        modele.hidden = false;
        remplir(modele, el('span', {}, 'Le mot s\'écrit :'), el('strong', {}, item.mot));
        remplir(retourMsg, el('span', { class: 'msg-ko' }, 'Regarde bien le mot, puis recopie-le.'));
        champ.value = '';
        champ.focus();
        dire(item.mot, { vitesse: 0.8 });
      }
    }
  }

  /** Montre les lettres bien placées, sans donner la réponse. */
  function comparaison(saisie, juste) {
    const a = [...formeDictee(saisie)];
    const b = [...formeDictee(juste)];
    return el('div', { class: 'comparaison', 'aria-hidden': 'true' },
      el('span', { class: 'comparaison-titre' }, 'Lettres bien placées :'),
      el('span', { class: 'cases' },
        b.map((lettre, k) => el('i', { class: a[k] === lettre ? 'ok' : '' }, a[k] === lettre ? lettre : '')),
      ));
  }

  function suivant() {
    clearTimeout(attente);
    taire();
    i++;
    if (i < liste.length) afficherMot();
    else bilan();
  }

  function bilan() {
    majProgression();
    const reussis = resultats.filter((r) => r.ok).length;
    const rates = liste.filter((_, k) => !resultats[k]?.ok);
    jouer(reussis === liste.length ? 'victoire' : 'juste');
    vider(etape);
    const { fermer } = fenetre(el('div', { class: 'bravo' },
      iconePixel('etoile', { taille: 72, contour: '#1b1626', fond: '#ffd23f' }),
      el('h2', {}, 'Dictée terminée'),
      el('p', {}, `${reussis} mot${reussis > 1 ? 's' : ''} juste${reussis > 1 ? 's' : ''} du premier coup sur ${liste.length}.`),
      el('ul', { class: 'liste-bilan' }, liste.map((m, k) => el('li', { class: resultats[k]?.ok ? 'ok' : 'ko' }, m.mot))),
      el('div', { class: 'boutons' },
        rates.length ? el('button', { class: 'btn-px', onclick: () => { fermer(); recommencer(rates); } }, 'Refaire les mots ratés') : null,
        el('button', { class: 'btn-px', onclick: () => { fermer(); recommencer(tous); } }, 'Tout recommencer'),
        el('button', { class: 'btn-px btn-principal', onclick: () => { fermer(); finir(); } }, 'Autre activité'))));
  }

  function recommencer(nouvelleListe) {
    liste = nouvelleListe;
    i = 0;
    resultats = [];
    afficherMot();
  }

  afficherMot();
  return () => { clearTimeout(attente); taire(); };
}
