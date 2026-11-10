// Prompt envoyé à Albert et nettoyage de sa réponse.
import {
  figureDansTexte, phraseAvec, formeGrille, propre, formeDictee, compterMots, jetons, phrases,
} from '../../src/lib/texte.js';
import { bornesGroupes, ciblesMaze, erreursMaze, motsLecture } from '../../src/lib/activites-lecture.js';

export const REGLAGES_DEFAUT = {
  nbMotsDictee: 8,
  nbQuestions: 5,
  nbMotsMeles: 8,
  directions: 'simple',
  vitesse: 60,
  niveau: 'CE1',
};

export function construireMessages({ titre, texte, reglages, activite = 'principal' }) {
  const r = { ...REGLAGES_DEFAUT, ...(reglages || {}) };
  const cibles = ciblesMaze(texte);
  const systeme = [
    'Tu es un professeur des écoles français, spécialiste de l\'apprentissage de la lecture au cycle 2.',
    'À partir d\'un texte, tu prépares des activités pour des élèves de 6 à 9 ans, dont certains lecteurs fragiles.',
    'Tu réponds uniquement avec un objet JSON valide, sans texte autour, sans balises de code.',
  ].join(' ');

  const contexte = `Niveau visé : ${r.niveau}.
Titre : ${titre || '(sans titre)'}
Texte :
"""
${texte}
"""`;

  const consignes = activite === 'comprehension' ? `${contexte}

Prépare les activités "comprehension" et "maze", sans dictée ni groupes de souffle.

1. "comprehension" : exactement ${r.nbQuestions} questions, dans l'ordre du texte.
   - Au moins une question dont la réponse est écrite dans le texte, au moins une question qui demande de déduire (inférence), et une question de vocabulaire sur un mot du texte.
   - 3 réponses courtes par question, de longueur proche. Une seule est juste. Les autres sont plausibles mais fausses d'après le texte.
   - Mets toujours la bonne réponse en premier : "bonne": 0 (l'application mélange l'ordre).
   - "indice" : une aide qui guide sans donner la réponse (exemple : « Relis la phrase où Léo arrive. »).
   - "extrait" : la phrase du texte, recopiée à l'identique, qui permet de répondre.
   - Vocabulaire simple, phrases courtes, sans négation piège.

2. "maze" : pour chaque cible ci-dessous, invente exactement deux distracteurs, c'est-à-dire deux mots plausibles grammaticalement mais impossibles dans ce contexte. Garde la même catégorie grammaticale et, si nécessaire, le même nombre ou temps. Un seul mot par distracteur, sans ponctuation, et jamais le mot correct. Recopie chaque index sans le modifier. Ne recopie pas le texte entier.
Cibles (index de mot à partir de 0, mot correct, contexte) :
${JSON.stringify(cibles)}

Format attendu :
{
  "comprehension": [{"question": "…", "choix": ["bonne réponse", "…", "…"], "bonne": 0, "indice": "…", "extrait": "…"}],
  "maze": [{"index": 6, "distracteurs": ["…", "…"]}]
}` : `${contexte}

Prépare uniquement les activités suivantes, sans questions de compréhension ni distracteurs MAZE.

1. "dictee" : exactement ${r.nbMotsDictee} éléments pris dans le texte.
   - Si l'élément est un nom commun, mets dans "mot" le déterminant avec le nom, recopiés ensemble exactement comme dans le texte : "un chat", "des chats", "l'oiseau". Cela permet à l'élève d'entendre et d'écrire le singulier ou le pluriel. Ne change jamais le nombre et n'invente pas de déterminant ; si le nom n'en a pas juste devant lui, choisis un autre élément.
   - Pour un verbe ou un adjectif, recopie le mot seul, exactement comme dans le texte (mêmes accents et même forme).
   - Choisis des éléments utiles et fréquents, de préférence réguliers. Pas de noms propres, pas de déterminants seuls ni d'autres mots-outils (et, il…). Le mot principal doit avoir au moins 3 lettres.
   - Pour chaque élément, donne une "phrase" courte du texte (ou très simple) qui contient toute l'expression de "mot" à l'identique, pour l'entendre en contexte.

2. "motsMeles" : exactement ${r.nbMotsMeles} mots du texte parmi les plus intéressants (noms, verbes, adjectifs qui portent le sens de l'histoire).
   - Un seul mot chacun, entre 3 et 10 lettres, sans trait d'union ni apostrophe, recopié comme dans le texte.

3. "groupesSouffle" : découpe tout le texte en groupes de sens, dans l'ordre de lecture. Chaque groupe contient généralement 2 à 6 mots et jamais plus de 8 ; ne coupe pas un groupe au milieu d'une expression naturelle et ne traverse pas la fin d'une phrase. Recopie chaque mot exactement une fois, sans omission ni ajout. La ponctuation peut rester attachée au groupe. Exemple : ["Le matin,", "Pilou dort", "sur le lit."].

4. "vitesse" : la vitesse de lecture conseillée en mots par minute pour faire défiler ce texte au prompteur, entre 30 et 120, selon sa difficulté et le niveau visé.

Format attendu :
{
  "dictee": [{"mot": "…", "phrase": "…"}],
  "motsMeles": ["…"],
  "groupesSouffle": ["…", "…"],
  "vitesse": 60
}`;

  return [
    { role: 'system', content: systeme },
    { role: 'user', content: consignes },
  ];
}

/** Extrait le premier objet JSON d'une réponse (tolère les balises ```json). */
export function lireJson(contenu) {
  if (contenu && typeof contenu === 'object') return contenu;
  const s = String(contenu || '').replace(/```(?:json)?/gi, '').trim();
  const debut = s.indexOf('{');
  const fin = s.lastIndexOf('}');
  if (debut < 0 || fin <= debut) throw new Error('Réponse d\'Albert illisible (pas de JSON).');
  return JSON.parse(s.slice(debut, fin + 1));
}

function taillesEquilibrees(nombre) {
  if (nombre <= 8) return nombre ? [nombre] : [];
  const nbGroupes = Math.ceil(nombre / 6);
  return Array.from({ length: nbGroupes }, (_, i) =>
    Math.floor(nombre / nbGroupes) + (i < nombre % nbGroupes ? 1 : 0));
}

/** Reprend les mots et la ponctuation du texte selon les coupures proposées. */
function groupesDepuisTailles(texte, tailles) {
  const groupes = [];
  let courant = '';
  let motsDansGroupe = 0;
  let index = 0;
  for (const jeton of jetons(propre(texte))[0] || []) {
    if (jeton.type === 'mot' && motsDansGroupe === tailles[index]) {
      groupes.push(courant.trim());
      courant = '';
      motsDansGroupe = 0;
      index++;
    }
    courant += jeton.v;
    if (jeton.type === 'mot') motsDansGroupe++;
  }
  if (courant.trim()) groupes.push(courant.trim());
  return groupes;
}

function preparerGroupesSouffle(texte, proposition) {
  const proposes = (Array.isArray(proposition) ? proposition : [])
    .map(propre).filter((g) => motsLecture(g).length);
  if (bornesGroupes(texte, proposes)) return { groupes: proposes, ajustes: false };

  const motsTexte = motsLecture(texte).map(formeDictee);
  const motsProposes = proposes.flatMap(motsLecture).map(formeDictee);
  const memesMots = motsProposes.length === motsTexte.length
    && motsProposes.every((mot, i) => mot === motsTexte[i]);
  const tailles = memesMots
    ? proposes.flatMap((g) => taillesEquilibrees(motsLecture(g).length))
    : phrases(texte).flatMap((p) => taillesEquilibrees(motsLecture(p).length));
  const groupes = groupesDepuisTailles(texte, tailles);
  return { groupes: bornesGroupes(texte, groupes) ? groupes : [], ajustes: true };
}

/** Vérifie et nettoie la proposition d'Albert. Renvoie aussi les points à relire. */
export function nettoyer(brut, { texte, reglages }) {
  const r = { ...REGLAGES_DEFAUT, ...(reglages || {}) };
  const alertes = [];

  // Dictée
  const dictee = [];
  const vusD = new Set();
  for (const d of Array.isArray(brut.dictee) ? brut.dictee : []) {
    let mot = propre(typeof d === 'string' ? d : d?.mot);
    if (!mot || vusD.has(formeDictee(mot))) continue;
    // « Vache » → « vache » si le mot apparaît en minuscules dans le texte (sinon c'est sans doute un nom propre).
    const minuscule = mot.toLocaleLowerCase('fr-FR');
    if (mot !== minuscule && propre(texte).split(/[^A-Za-zÀ-ÖØ-öø-ÿŒœÆæ'-]+/).includes(minuscule)) mot = minuscule;
    if (!figureDansTexte(mot, texte)) { alertes.push(`Dictée : « ${mot} » n'est pas dans le texte, retiré.`); continue; }
    let phrase = propre(d?.phrase);
    if (!phrase || !figureDansTexte(mot, phrase)) phrase = phraseAvec(mot, texte);
    vusD.add(formeDictee(mot));
    dictee.push({ mot, phrase });
  }
  if (dictee.length < r.nbMotsDictee) alertes.push(`Dictée : ${dictee.length} mot(s) au lieu de ${r.nbMotsDictee}, à compléter.`);

  // Compréhension
  const questions = [];
  for (const q of Array.isArray(brut.comprehension) ? brut.comprehension : []) {
    const question = propre(q?.question);
    let choix = (Array.isArray(q?.choix) ? q.choix : []).map(propre).filter(Boolean);
    let bonne = Number.isInteger(q?.bonne) ? q.bonne : 0;
    if (!question || choix.length < 2) continue;
    if (bonne < 0 || bonne >= choix.length) bonne = 0;
    // Remet la bonne réponse en tête et garde 3 choix uniques.
    const juste = choix[bonne];
    choix = [juste, ...choix.filter((c, i) => i !== bonne && c.toLowerCase() !== juste.toLowerCase())];
    choix = choix.filter((c, i) => choix.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i).slice(0, 3);
    if (choix.length < 3) alertes.push(`Compréhension : la question « ${question} » n'a que ${choix.length} réponses.`);
    let extrait = propre(q?.extrait);
    if (extrait && !propre(texte).includes(extrait)) {
      alertes.push(`Compréhension : l'extrait de « ${question} » ne correspond pas exactement au texte, à vérifier.`);
      extrait = '';
    }
    questions.push({ question, choix, bonne: 0, indice: propre(q?.indice), extrait });
  }
  if (questions.length < r.nbQuestions) alertes.push(`Compréhension : ${questions.length} question(s) au lieu de ${r.nbQuestions}.`);

  // Mots mêlés
  const motsMeles = [];
  const vusM = new Set();
  for (const m0 of Array.isArray(brut.motsMeles) ? brut.motsMeles : []) {
    const m = propre(typeof m0 === 'string' ? m0 : m0?.mot);
    const g = formeGrille(m);
    if (!m || vusM.has(g)) continue;
    if (/[\s'-]/.test(m)) { alertes.push(`Mots mêlés : « ${m} » contient une espace ou un signe, retiré.`); continue; }
    if (g.length < 3 || g.length > 10) { alertes.push(`Mots mêlés : « ${m} » est trop ${g.length < 3 ? 'court' : 'long'}, retiré.`); continue; }
    if (!figureDansTexte(m, texte)) { alertes.push(`Mots mêlés : « ${m} » n'est pas dans le texte, retiré.`); continue; }
    vusM.add(g);
    motsMeles.push(m);
  }
  if (motsMeles.length < r.nbMotsMeles) alertes.push(`Mots mêlés : ${motsMeles.length} mot(s) au lieu de ${r.nbMotsMeles}.`);

  const { groupes, ajustes } = preparerGroupesSouffle(texte, brut.groupesSouffle);
  if (ajustes) alertes.push(groupes.length
    ? 'Groupes de souffle : découpage ajusté pour reprendre tous les mots du texte ; relisez-le.'
    : 'Groupes de souffle : découpage incomplet ou différent du texte, à corriger.');

  const propositionsMaze = Array.isArray(brut.maze) ? brut.maze : [];
  const trous = ciblesMaze(texte).map(({ index, mot }) => {
    const proposition = propositionsMaze.find((p) => Number(p?.index) === index);
    const candidats = Array.isArray(proposition?.distracteurs) ? proposition.distracteurs : proposition?.choix;
    const distracteurs = (Array.isArray(candidats) ? candidats : [])
      .map(propre).filter((c) => c && formeDictee(c) !== formeDictee(mot))
      .filter((c, i, tous) => tous.findIndex((x) => formeDictee(x) === formeDictee(c)) === i)
      .slice(0, 2);
    return { index, choix: [mot, distracteurs[0] || '', distracteurs[1] || ''], bonne: 0 };
  });
  if (erreursMaze(texte, trous).length) alertes.push('MAZE : certains distracteurs manquent ou ne sont pas des mots distincts, à corriger.');

  let vitesse = Math.round(Number(brut.vitesse));
  if (!Number.isFinite(vitesse)) vitesse = r.vitesse;
  vitesse = Math.min(120, Math.max(30, vitesse));

  return {
    activites: {
      lecture: { actif: true, vitesse, groupes, groupesDemandes: true },
      dictee: { actif: true, mots: dictee.slice(0, Math.max(r.nbMotsDictee, 1) + 2) },
      comprehension: { actif: true, questions },
      motsMeles: { actif: true, mots: motsMeles, directions: r.directions },
      maze: { actif: true, trous },
    },
    alertes,
    nbMots: compterMots(texte),
  };
}
