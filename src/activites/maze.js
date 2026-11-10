// Labyrinthe de lecture : un mot du texte sur sept est choisi parmi trois propositions.
import { el, ajouter, remplir, iconePixel, fenetre } from '../ui.js';
import { jetons, melanger } from '../lib/texte.js';
import { erreursMaze } from '../lib/activites-lecture.js';
import { jouer } from '../sons.js';

export function monterMaze(zone, { texte, finir }) {
  const trous = texte.activites.maze.trous;
  if (erreursMaze(texte.texte, trous).length) {
    ajouter(zone, el('p', { class: 'alerte' }, 'Ce labyrinthe doit être complété dans le studio.'));
    return () => {};
  }

  const parIndex = new Map(trous.map((trou) => [trou.index, trou]));
  const rates = new Set();
  let resolus = 0;
  let reussis = 0;
  let motIndex = 0;
  let finDifferee = null;
  const compteur = el('p', { class: 'compteur', 'aria-live': 'polite' });
  const retour = el('p', { class: 'maze-retour', role: 'status', 'aria-live': 'polite' });
  const papier = el('div', { class: 'papier maze-texte' });

  function choisir(trou, bouton, cadre) {
    if (cadre.classList.contains('resolu')) return;
    if (bouton.textContent !== trou.choix[0]) {
      rates.add(trou.index);
      bouton.disabled = true;
      bouton.classList.add('faux');
      remplir(retour, 'Ce mot ne convient pas. Essaie un autre choix.');
      jouer('faux');
      return;
    }
    resolus++;
    if (!rates.has(trou.index)) reussis++;
    cadre.classList.add('resolu');
    remplir(cadre, el('strong', {}, trou.choix[0]));
    remplir(retour, 'Bien joué !');
    compteur.textContent = `${resolus} / ${trous.length} mots trouvés`;
    jouer('juste');
    if (resolus === trous.length) finDifferee = setTimeout(victoire, 500);
  }

  for (const paragraphe of jetons(texte.texte)) {
    const ligne = el('p');
    for (const jeton of paragraphe) {
      if (jeton.type === 'sep') { ligne.append(jeton.v); continue; }
      const trou = parIndex.get(motIndex++);
      if (!trou) { ligne.append(jeton.v); continue; }
      const cadre = el('span', { class: 'maze-choix', role: 'group', 'aria-label': `Choisis le mot ${trou.index + 1}` });
      const choix = melanger(trou.choix);
      for (const proposition of choix) {
        const bouton = el('button', { type: 'button', onclick: () => choisir(trou, bouton, cadre) }, proposition);
        cadre.append(bouton);
      }
      ligne.append(cadre);
    }
    papier.append(ligne);
  }

  compteur.textContent = `0 / ${trous.length} mots trouvés`;
  ajouter(zone,
    el('div', { class: 'activite-entete' },
      el('h2', {}, 'Labyrinthe de lecture'),
      el('p', { class: 'consigne' }, 'Lis le texte. À chaque choix, touche le seul mot qui convient.')),
    compteur,
    retour,
    papier);

  function victoire() {
    jouer('victoire');
    const { fermer } = fenetre(el('div', { class: 'bravo' },
      iconePixel('etoile', { taille: 72, contour: '#1b1626', fond: '#ffd23f' }),
      el('h2', {}, 'Labyrinthe terminé !'),
      el('p', {}, `${reussis} mot${reussis > 1 ? 's' : ''} trouvé${reussis > 1 ? 's' : ''} du premier coup sur ${trous.length}.`),
      el('div', { class: 'boutons' },
        el('button', { class: 'btn-px btn-principal', onclick: () => { fermer(); finir(); } }, 'Autre activité'))));
  }

  return () => clearTimeout(finDifferee);
}
