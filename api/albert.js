// Relais vers l'API Albert : la clé reste côté serveur, jamais dans le navigateur.
import { construireMessages, lireJson, nettoyer } from './_lib/generation.js';
import { codeValide, refuser, corps } from './_lib/acces.js';
import { motsDuTexte, phrases } from '../src/lib/texte.js';
import { ciblesMaze, motsLecture } from '../src/lib/activites-lecture.js';

const BASE = (process.env.ALBERT_BASE_URL || 'https://albert.api.etalab.gouv.fr/v1').replace(/\/$/, '');
let modeleEnCache = null;

async function choisirModele(cle) {
  if (process.env.ALBERT_MODEL) return process.env.ALBERT_MODEL;
  if (modeleEnCache) return modeleEnCache;
  const r = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${cle}` } });
  if (!r.ok) throw new Error(`Albert : liste des modèles indisponible (${r.status}).`);
  const { data = [] } = await r.json();
  const texte = data.filter((m) => m.type === 'text-generation');
  const prefere = texte.find((m) => /large/i.test(m.id)) || texte[0];
  if (!prefere) throw new Error('Albert : aucun modèle de génération de texte disponible.');
  modeleEnCache = prefere.id;
  return modeleEnCache;
}

async function appelerAlbert(messages, model, cle) {
  const envoyer = (avecFormat) => fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 4500,
      ...(avecFormat ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  let r = await envoyer(true);
  // Certains modèles refusent response_format : on réessaie sans.
  if (r.status === 400 || r.status === 422) r = await envoyer(false);
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 300);
    throw Object.assign(new Error(`Albert (${model}) a répondu ${r.status}. ${detail}`), { statut: 502 });
  }
  const json = await r.json();
  return { contenu: json.choices?.[0]?.message?.content || '', model };
}

/** Réponse simulée pour tester sans clé (ALBERT_MOCK=1). */
function simulation(texte, reglages) {
  const r = { nbMotsDictee: 8, nbQuestions: 5, nbMotsMeles: 8, ...reglages };
  const outils = new Set('le la les un une des de du et il elle ils elles est a au aux sur sous dans avec pour par mais ne pas se sa son ses on qui que'.split(' '));
  const mots = [...new Set(motsDuTexte(texte).filter((m) => m.length > 3 && !outils.has(m)))];
  const ph = phrases(texte);
  const motsComplets = motsLecture(texte);
  const maze = ciblesMaze(texte).map(({ index, mot }) => {
    const autres = [...new Set(mots.filter((m) => m !== mot && /^[\p{L}]{2,20}$/u.test(m)))].slice(0, 2);
    return { index, distracteurs: autres };
  });
  return JSON.stringify({
    dictee: mots.slice(0, r.nbMotsDictee).map((mot) => ({ mot })),
    comprehension: ph.slice(0, r.nbQuestions).map((p, i) => ({
      question: `Question ${i + 1} : que dit cette partie du texte ?`,
      choix: [p.slice(0, 40), 'Une autre réponse', 'Encore une autre'],
      bonne: 0,
      indice: 'Relis le début du texte.',
      extrait: p,
    })),
    motsMeles: mots.filter((m) => !m.includes('-')).slice(0, r.nbMotsMeles),
    groupesSouffle: Array.from({ length: Math.ceil(motsComplets.length / 4) }, (_, i) => motsComplets.slice(i * 4, i * 4 + 4).join(' ')),
    maze,
    vitesse: 55,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return refuser(res, 405, 'Méthode non autorisée.');
  if (!codeValide(req)) return refuser(res, 401, 'Code studio incorrect.');
  let donnees;
  try { donnees = await corps(req); } catch { return refuser(res, 400, 'Requête illisible.'); }
  const { titre = '', texte = '', reglages = {} } = donnees;
  if (String(texte).trim().length < 20) return refuser(res, 400, 'Le texte est trop court.');
  if (String(texte).length > 12000) return refuser(res, 400, 'Le texte est trop long (12 000 caractères maximum).');

  try {
    let brut;
    let modeles = { principal: 'simulation', comprehension: 'simulation' };
    if (process.env.ALBERT_MOCK === '1') {
      brut = lireJson(simulation(texte, reglages));
    } else {
      const cle = process.env.ALBERT_API_KEY;
      if (!cle) throw Object.assign(new Error('La clé ALBERT_API_KEY n\'est pas configurée sur Vercel.'), { statut: 500 });
      const principal = await choisirModele(cle);
      const comprehension = process.env.ALBERT_COMPREHENSION_MODEL || principal;
      modeles = { principal, comprehension };
      const [reponsePrincipale, reponseComprehension] = await Promise.all([
        appelerAlbert(construireMessages({ titre, texte, reglages, activite: 'principal' }), principal, cle),
        appelerAlbert(construireMessages({ titre, texte, reglages, activite: 'comprehension' }), comprehension, cle),
      ]);
      const partiePrincipale = lireJson(reponsePrincipale.contenu);
      const partieComprehension = lireJson(reponseComprehension.contenu);
      if (!Array.isArray(partiePrincipale.dictee) || !Array.isArray(partiePrincipale.motsMeles)
        || !Array.isArray(partieComprehension.comprehension)) {
        throw Object.assign(new Error('Albert a renvoyé des activités incomplètes. Réessayez la génération.'), { statut: 502 });
      }
      brut = { ...partiePrincipale, comprehension: partieComprehension.comprehension, maze: partieComprehension.maze };
    }
    const resultat = nettoyer(brut, { texte, reglages });
    res.status(200).json({ ...resultat, model: modeles.principal, modeles });
  } catch (e) {
    refuser(res, e.statut || 500, e.message || 'Erreur inconnue.');
  }
}
