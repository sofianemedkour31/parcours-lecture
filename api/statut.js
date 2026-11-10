// Vérifie le code studio et indique ce qui est configuré, sans rien divulguer.
import { codeValide, refuser } from './_lib/acces.js';

export default function handler(req, res) {
  if (!process.env.STUDIO_CODE) return refuser(res, 503, 'STUDIO_CODE n\'est pas configuré sur Vercel.');
  if (!codeValide(req)) return refuser(res, 401, 'Code studio incorrect.');
  res.status(200).json({
    ok: true,
    albert: Boolean(process.env.ALBERT_API_KEY) || process.env.ALBERT_MOCK === '1',
    publier: Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO),
  });
}
