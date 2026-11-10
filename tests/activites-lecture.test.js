import assert from 'node:assert/strict';
import test from 'node:test';
import { bornesGroupes, ciblesMaze, erreursMaze, motsLecture } from '../src/lib/activites-lecture.js';
import { erreursTexte } from '../src/lib/validation.js';

const texte = 'Le matin, Pilou dort sur le lit. Puis le petit chat regarde les oiseaux dans le jardin.';

test('les groupes de souffle couvrent chaque mot une seule fois', () => {
  const groupes = ['Le matin,', 'Pilou dort', 'sur le lit.', 'Puis le petit chat', 'regarde les oiseaux', 'dans le jardin.'];
  const bornes = bornesGroupes(texte, groupes);
  assert.equal(bornes.length, groupes.length);
  assert.equal(bornes[0].debut, 0);
  assert.equal(bornes.at(-1).fin, motsLecture(texte).length - 1);
  assert.equal(bornesGroupes(texte, groupes.slice(0, -1)), null);
  assert.equal(bornesGroupes(texte, [...groupes, 'jardin']), null);
});

test('MAZE choisit environ un mot sur sept et exige deux distracteurs distincts', () => {
  const cibles = ciblesMaze(texte);
  assert.ok(cibles.length >= 2);
  const trous = cibles.map(({ index, mot }) => ({ index, choix: [mot, 'dragon', 'bateau'], bonne: 0 }));
  assert.deepEqual(erreursMaze(texte, trous), []);
  trous[0].choix[2] = 'dragon';
  assert.ok(erreursMaze(texte, trous).length);
});

test('un ancien texte validé sans MAZE reste publiable', () => {
  const ancien = { titre: 'Ancien texte', texte, activites: {
    lecture: { actif: true }, dictee: { actif: false }, comprehension: { actif: false }, motsMeles: { actif: false },
  } };
  assert.deepEqual(erreursTexte(ancien, {}), []);
});

test('un nouveau texte ne peut pas être validé avec des groupes ou choix MAZE incomplets', () => {
  const groupes = ['Le matin,', 'Pilou dort', 'sur le lit.', 'Puis le petit chat', 'regarde les oiseaux', 'dans le jardin.'];
  const trous = ciblesMaze(texte).map(({ index, mot }) => ({ index, choix: [mot, 'dragon', 'bateau'], bonne: 0 }));
  const t = { titre: 'Pilou', texte, activites: {
    lecture: { actif: true, groupes: [], groupesDemandes: true },
    dictee: { actif: false }, comprehension: { actif: false }, motsMeles: { actif: false },
    maze: { actif: true, trous },
  } };
  assert.match(erreursTexte(t, {}).join(' '), /groupes de souffle/);
  t.activites.lecture.groupes = groupes;
  assert.deepEqual(erreursTexte(t, {}), []);
  t.activites.maze.trous[0].choix[1] = '';
  assert.match(erreursTexte(t, {}).join(' '), /MAZE/);
});
