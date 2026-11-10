import assert from 'node:assert/strict';
import test from 'node:test';
import { construireMessages, nettoyer } from '../api/_lib/generation.js';
import { figureDansTexte, phraseAvec } from '../src/lib/texte.js';

test('la consigne demande le déterminant avec chaque nom de dictée', () => {
  const demande = construireMessages({ titre: 'Les animaux', texte: 'Des chats regardent l’oiseau.' })[1].content;
  assert.match(demande, /déterminant avec le nom/);
  assert.match(demande, /singulier ou le pluriel/);
  assert.match(demande, /n'invente pas de déterminant/);
  assert.doesNotMatch(demande, /au singulier si possible/);
});

test('la dictée conserve les groupes nominaux et leurs phrases', () => {
  const texte = 'Des chats regardent l’oiseau. Un chat dort.';
  assert.equal(figureDansTexte('des chats', texte), true);
  assert.equal(figureDansTexte('un chat', texte), true);
  assert.equal(figureDansTexte("l'oiseau", texte), true);
  assert.equal(figureDansTexte('les chats', texte), false);
  assert.equal(phraseAvec('Des chats', texte), "Des chats regardent l'oiseau.");

  const resultat = nettoyer({
    dictee: [{ mot: 'Des chats', phrase: 'Les chats jouent.' }, { mot: "l'oiseau" }],
    motsMeles: [], vitesse: 60,
  }, { texte, reglages: { nbMotsDictee: 2 } });
  assert.deepEqual(resultat.activites.dictee.mots, [
    { mot: 'Des chats', phrase: "Des chats regardent l'oiseau." },
    { mot: "l'oiseau", phrase: "Des chats regardent l'oiseau." },
  ]);
});
