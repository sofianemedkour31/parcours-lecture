import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fusionnerCorpus } from '../src/donnees.js';
import { erreursTexte } from '../src/lib/validation.js';

const corpus = JSON.parse(readFileSync(new URL('../public/contenu/parcours.json', import.meta.url), 'utf8'));

test('les quatre parcours conservent leurs textes et les textes validés sont publiables', () => {
  assert.deepEqual(corpus.parcours.map((p) => p.textes.length), [15, 15, 15, 15]);
  for (const p of corpus.parcours) for (const [index, t] of p.textes.entries()) {
    assert.equal(t.id, `p${p.id}-texte-${String(index + 1).padStart(2, '0')}`);
    assert.ok(t.titre && t.texte.length >= 100);
    if (t.valide) assert.deepEqual(erreursTexte(t, p), []);
  }
});

test('un ancien brouillon reçoit les textes sans perdre ses changements', () => {
  const modifie = { ...structuredClone(corpus.parcours[0].textes[0]), texte: 'Ma correction locale.' };
  const personnel = { id: 'personnel', titre: 'Mon texte', texte: 'Un texte personnel.' };
  const brouillon = { version: 1, parcours: [{ id: 1, textes: [modifie, personnel] }] };

  assert.equal(fusionnerCorpus(brouillon, corpus), true);
  assert.equal(brouillon.corpusVersion, corpus.corpusVersion);
  assert.deepEqual(brouillon.parcours.map((p) => p.textes.length), [16, 15, 15, 15]);
  assert.equal(brouillon.parcours[0].textes[0], modifie);
  assert.equal(brouillon.parcours[0].textes.at(-1), personnel);
  assert.equal(fusionnerCorpus(brouillon, corpus), false);
  assert.deepEqual(brouillon.parcours.map((p) => p.textes.length), [16, 15, 15, 15]);
});
