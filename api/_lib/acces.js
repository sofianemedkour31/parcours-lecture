// Contrôle d'accès commun aux fonctions du studio.
import { timingSafeEqual } from 'node:crypto';

export function codeValide(req) {
  const attendu = process.env.STUDIO_CODE || '';
  const recu = String(req.headers['x-studio-code'] || '');
  if (!attendu) return false;
  const a = Buffer.from(attendu);
  const b = Buffer.from(recu);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function refuser(res, statut, message) {
  res.status(statut).json({ erreur: message });
}

export async function corps(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const morceaux = [];
  for await (const m of req) morceaux.push(m);
  const brut = Buffer.concat(morceaux).toString('utf8');
  return brut ? JSON.parse(brut) : {};
}
