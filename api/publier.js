// Enregistre tous les textes : le mode élève n'affiche que ceux qui sont validés.
// Vercel redéploie alors automatiquement et les élèves voient la nouvelle version.
import { codeValide, refuser, corps } from './_lib/acces.js';
import { erreursTexte } from '../src/lib/validation.js';

const CHEMIN = 'public/contenu/parcours.json';

export default async function handler(req, res) {
  if (req.method !== 'POST') return refuser(res, 405, 'Méthode non autorisée.');
  if (!codeValide(req)) return refuser(res, 401, 'Code studio incorrect.');
  const { GITHUB_TOKEN: jeton, GITHUB_REPO: depot, GITHUB_BRANCH: branche = 'main' } = process.env;
  if (!jeton || !depot) return refuser(res, 501, 'Publication non configurée : utilisez « Exporter le fichier ».');

  let contenu;
  try { contenu = (await corps(req)).contenu; } catch { return refuser(res, 400, 'Requête illisible.'); }
  if (!contenu || !Array.isArray(contenu.parcours)
    || contenu.parcours.some((p) => !p || !Array.isArray(p.textes)
      || p.textes.some((t) => !t || typeof t !== 'object'))) {
    return refuser(res, 400, 'Contenu invalide.');
  }
  for (const p of contenu.parcours) for (const t of p.textes) {
    if (!t.valide) continue;
    const erreurs = erreursTexte(t, p);
    if (erreurs.length) return refuser(res, 400, `Texte « ${t.titre || 'sans titre'} » invalide : ${erreurs.join(', ')}.`);
  }

  const url = `https://api.github.com/repos/${depot}/contents/${CHEMIN}`;
  const entetes = {
    Authorization: `Bearer ${jeton}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'parcours-lecture-studio',
  };
  try {
    const actuel = await fetch(`${url}?ref=${encodeURIComponent(branche)}`, { headers: entetes });
    const sha = actuel.ok ? (await actuel.json()).sha : undefined;
    const texte = `${JSON.stringify({ ...contenu, publieLe: new Date().toISOString() }, (k, v) => (k.startsWith('_') ? undefined : v), 2)}\n`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: { ...entetes, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Studio : mise à jour des parcours de lecture',
        content: Buffer.from(texte, 'utf8').toString('base64'),
        branch: branche,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!r.ok) return refuser(res, 502, `GitHub a répondu ${r.status} : ${(await r.text()).slice(0, 200)}`);
    res.status(200).json({ ok: true });
  } catch (e) {
    refuser(res, 500, e.message);
  }
}
