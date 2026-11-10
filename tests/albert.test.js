import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import albert from '../api/albert.js';
import { ciblesMaze, motsLecture } from '../src/lib/activites-lecture.js';

const exemple = JSON.parse(readFileSync(new URL('./fixtures/contenu-valide.json', import.meta.url), 'utf8'));
const texteExemple = exemple.parcours[0].textes[0];

function reponse() {
  return {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('Mistral génère les mots et la vitesse, Gemma génère la compréhension', async () => {
  const ancienFetch = globalThis.fetch;
  const variables = ['STUDIO_CODE', 'ALBERT_API_KEY', 'ALBERT_MODEL', 'ALBERT_COMPREHENSION_MODEL', 'ALBERT_MOCK'];
  const anciennes = Object.fromEntries(variables.map((nom) => [nom, process.env[nom]]));
  Object.assign(process.env, {
    STUDIO_CODE: 'code-test',
    ALBERT_API_KEY: 'cle-test',
    ALBERT_MODEL: 'mistral-small-3-2-24b-instruct-2506',
    ALBERT_COMPREHENSION_MODEL: 'gemma-4-31b-it',
    ALBERT_MOCK: '0',
  });
  const appels = [];
  const principal = {
    dictee: texteExemple.activites.dictee.mots,
    motsMeles: texteExemple.activites.motsMeles.mots,
    groupesSouffle: Array.from({ length: Math.ceil(motsLecture(texteExemple.texte).length / 4) },
      (_, i) => motsLecture(texteExemple.texte).slice(i * 4, i * 4 + 4).join(' ')),
    vitesse: 45,
  };
  const comprehension = {
    comprehension: texteExemple.activites.comprehension.questions,
    maze: ciblesMaze(texteExemple.texte).map(({ index }) => ({ index, distracteurs: ['dragon', 'bateau'] })),
  };
  globalThis.fetch = async (_url, options) => {
    const requete = JSON.parse(options.body);
    appels.push(requete);
    if (requete.model === 'gemma-4-31b-it' && requete.response_format) {
      return { ok: false, status: 400 };
    }
    const contenu = requete.model === 'gemma-4-31b-it' ? comprehension : principal;
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(contenu) } }] }) };
  };
  try {
    const res = reponse();
    await albert({
      method: 'POST',
      headers: { 'x-studio-code': 'code-test' },
      body: { titre: texteExemple.titre, texte: texteExemple.texte, reglages: exemple.parcours[0].reglages },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.modeles, {
      principal: 'mistral-small-3-2-24b-instruct-2506',
      comprehension: 'gemma-4-31b-it',
    });
    assert.equal(res.body.activites.dictee.mots[0].mot, 'chat');
    assert.equal(res.body.activites.comprehension.questions[0].question, 'Comment s\'appelle le chat ?');
    assert.equal(res.body.activites.motsMeles.mots[0], 'chat');
    assert.ok(res.body.activites.lecture.groupes.length > 0);
    assert.equal(res.body.activites.maze.trous.length, ciblesMaze(texteExemple.texte).length);
    assert.equal(appels.length, 3); // Gemma a été réessayé sans response_format.
    assert.equal(appels.filter((a) => a.model === 'gemma-4-31b-it').length, 2);
    assert.equal(appels.find((a) => a.model.startsWith('mistral')).messages[1].content.includes('"comprehension"'), false);
    assert.equal(appels.find((a) => a.model === 'gemma-4-31b-it').messages[1].content.includes('"dictee"'), false);
    assert.match(appels.find((a) => a.model.startsWith('mistral')).messages[1].content, /"groupesSouffle"/);
    assert.match(appels.find((a) => a.model === 'gemma-4-31b-it').messages[1].content, /"maze"/);
  } finally {
    globalThis.fetch = ancienFetch;
    for (const nom of variables) {
      if (anciennes[nom] === undefined) delete process.env[nom];
      else process.env[nom] = anciennes[nom];
    }
  }
});
