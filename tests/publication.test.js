import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import publier from '../api/publier.js';
import { erreursTexte } from '../src/lib/validation.js';
import { candidatsStatiques } from '../scripts/fichiers-statiques.mjs';

const exemple = JSON.parse(readFileSync(new URL('./fixtures/contenu-valide.json', import.meta.url), 'utf8'));
const copier = () => structuredClone(exemple);

test('le serveur local ne propose que les fichiers de l’application', () => {
  const racine = new URL('..', import.meta.url).pathname;
  assert.equal(candidatsStatiques(racine, '/.env').length, 0);
  assert.equal(candidatsStatiques(racine, '/src/main.js').length, 2);
  assert.equal(candidatsStatiques(racine, '/README.md')[0].base.endsWith('public'), true);
  assert.equal(candidatsStatiques(racine, '/contenu/parcours.json')[0].base.endsWith('public'), true);
  assert.equal(candidatsStatiques(racine, '/index.html').length, 2);
});

function reponse() {
  return {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('la validation refuse une question à deux choix et une grille sans mots jouables', () => {
  const p = copier().parcours[0];
  const t = p.textes[0];
  assert.deepEqual(erreursTexte(t, p), []);
  t.activites.comprehension.questions[0].choix.pop();
  t.activites.motsMeles.mots = ['!', '?', '-'];
  const erreurs = erreursTexte(t, p);
  assert.match(erreurs.join(' '), /3 réponses/);
  assert.match(erreurs.join(' '), /mots mêlés/);
});

test('l’API refuse un texte validé invalide avant tout appel à GitHub', async () => {
  const originalFetch = globalThis.fetch;
  const original = {
    code: process.env.STUDIO_CODE,
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO,
  };
  process.env.STUDIO_CODE = 'code-test';
  process.env.GITHUB_TOKEN = 'jeton-test';
  process.env.GITHUB_REPO = 'compte/depot';
  globalThis.fetch = () => { throw new Error('GitHub ne doit pas être appelé'); };
  try {
    const contenu = copier();
    contenu.parcours[0].textes[0].activites.comprehension.questions[0].choix.pop();
    const res = reponse();
    await publier({ method: 'POST', headers: { 'x-studio-code': 'code-test' }, body: { contenu } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.erreur, /3 réponses/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [cle, nom] of Object.entries({ code: 'STUDIO_CODE', token: 'GITHUB_TOKEN', repo: 'GITHUB_REPO' })) {
      if (original[cle] === undefined) delete process.env[nom];
      else process.env[nom] = original[cle];
    }
  }
});

test('l’API conserve les brouillons pour les prochains passages dans le studio', async () => {
  const originalFetch = globalThis.fetch;
  const original = {
    code: process.env.STUDIO_CODE,
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO,
  };
  process.env.STUDIO_CODE = 'code-test';
  process.env.GITHUB_TOKEN = 'jeton-test';
  process.env.GITHUB_REPO = 'compte/depot';
  let fichier;
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === 'PUT') {
      fichier = JSON.parse(Buffer.from(JSON.parse(options.body).content, 'base64').toString('utf8'));
      return { ok: true };
    }
    return { ok: true, json: async () => ({ sha: 'sha-test' }) };
  };
  try {
    const contenu = copier();
    contenu.parcours[0].textes.push({ id: 'brouillon', titre: 'À préparer', texte: 'Un texte qui attend ses activités.', valide: false, activites: {} });
    const res = reponse();
    await publier({ method: 'POST', headers: { 'x-studio-code': 'code-test' }, body: { contenu } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(fichier.parcours[0].textes.map((t) => t.id), ['exemple-pilou', 'brouillon']);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [cle, nom] of Object.entries({ code: 'STUDIO_CODE', token: 'GITHUB_TOKEN', repo: 'GITHUB_REPO' })) {
      if (original[cle] === undefined) delete process.env[nom];
      else process.env[nom] = original[cle];
    }
  }
});
