# Parcours lecture

Application de lecture au look de console rétro. Elle propose 4 parcours, chacun composé de plusieurs textes, et 5 activités par texte :

| Activité | Ce que fait l'élève |
|---|---|
| **Lire** | Lecture au prompteur : progression mot à mot ou par groupes de souffle préparés par Albert. Vitesse réglable, mode « ligne », modèle lu à voix haute, chronomètre. |
| **Dictée** | Il écoute un mot (normalement, lentement ou dans une phrase), puis l'écrit. Au 1er essai faux, il voit les lettres bien placées. Au 2e, le mot est montré et il le recopie. |
| **Comprendre** | Questions à 3 choix, lues à voix haute sur demande. Après une erreur, il reçoit un indice et peut relire le texte avec le passage utile surligné. |
| **Mots mêlés** | Grille générée à partir des mots choisis. Il glisse le doigt sur un mot, ou touche la première puis la dernière lettre. Un mode agrandi permet de zoomer, avec la liste des mots toujours affichée. |
| **Labyrinthe de lecture (MAZE)** | Environ un mot sur sept est remplacé par trois choix. L'élève choisit le seul mot qui convient dans le contexte. |

Navigation : parcours → texte → activité. Le bouton **Retour**, la touche Échap et le bouton retour d'Android remontent d'un niveau.
Aucune donnée élève n'est enregistrée.

## Studio enseignant : `/#/studio`

1. Entrez le **code studio** (variable `STUDIO_CODE`).
2. Choisissez un parcours et un des **15 textes déjà présents**. Le titre et le passage sont prêts ; vous pouvez aussi ajouter vos propres textes avec **+ Texte**.
3. Cliquez sur **Préparer les activités avec Albert**. Mistral Small choisit les mots de dictée, les mots mêlés, la vitesse et les groupes de souffle ; Gemma rédige les questions de compréhension et les distracteurs MAZE. Les deux appels sont effectués en parallèle, puis l'application vérifie et réunit leurs réponses. Un mot absent du texte est retiré et signalé.
4. Relisez et corrigez dans les cartes. Vous pouvez aussi désactiver une activité.
5. Cliquez sur **Valider ce texte**. Le studio vérifie les réponses et la grille ; toute modification ultérieure du texte ou de ses activités le repasse en brouillon.
6. Cliquez sur **Publier pour les élèves**. Seuls les textes validés deviennent visibles dans le mode élève. Si la publication n'est pas configurée, utilisez **Exporter le fichier** (voir plus bas).

Les réglages de chaque parcours (niveau, nombre de mots et de questions, sens de la grille, vitesse) servent à Albert. Le bouton « Préparer avec Albert les N textes sans activités » traite tout un parcours d'un coup.
Les 60 textes des quatre livrets sont enregistrés comme brouillons. Le travail en cours est gardé dans le navigateur de l'ordinateur enseignant. Une publication conserve aussi les textes sans activités dans le fichier de contenu ; le mode élève n'affiche que les textes validés. Si un ancien brouillon local existe, les nouveaux textes y sont ajoutés sans écraser les modifications précédentes.

## Mise en ligne sur Vercel

1. Créez un dépôt GitHub avec ce dossier, puis importez-le dans Vercel. Le préréglage **Vite** est détecté automatiquement.
2. Dans **Settings → Environment Variables**, ajoutez :

| Variable | Rôle |
|---|---|
| `ALBERT_API_KEY` | Votre clé Albert (DINUM). Elle reste côté serveur. |
| `STUDIO_CODE` | Le code à saisir pour utiliser le studio. Il protège votre quota Albert. |
| `ALBERT_MODEL` | Modèle principal pour la dictée, les mots mêlés et la vitesse. Recommandé : `mistral-small-3-2-24b-instruct-2506`. Si vide, un modèle de génération disponible est choisi. |
| `ALBERT_COMPREHENSION_MODEL` | Modèle pour les questions de compréhension et les distracteurs MAZE. Recommandé : `gemma-4-31b-it`. Si vide, le modèle principal est utilisé. |
| `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH` | Facultatif : active le bouton **Publier**. |

3. Redéployez.

**Bouton Publier.** Créez un jeton GitHub *fine-grained* limité à ce dépôt, avec le droit *Contents : Read and write*. Indiquez `GITHUB_REPO` sous la forme `proprietaire/nom`. Le bouton écrit alors `public/contenu/parcours.json` dans le dépôt, et Vercel redéploie seul en 1 à 2 minutes.

**Sans bouton Publier.** Cliquez sur **Exporter le fichier**, remplacez `public/contenu/parcours.json` dans le dépôt par le fichier téléchargé, puis poussez la modification.

## Tester sur votre ordinateur

Il suffit d'avoir Node.js 18 ou plus récent :

```bash
node scripts/serveur-local.mjs
```

Ouvrez ensuite http://localhost:5174. Créez un fichier `.env` sur le modèle de `.env.example`. Avec `ALBERT_MOCK=1`, Albert est simulé, ce qui permet de tester le studio sans clé.
Ce serveur écoute uniquement sur votre ordinateur et ne sert ni `.env`, ni les scripts, ni les fonctions API comme fichiers statiques.
`npm run dev` (Vite) affiche l'application, mais pas les fonctions `/api`. Pour avoir les deux, utilisez `vercel dev` ou le serveur ci-dessus.

Pour ouvrir directement le bon mode avec Python (sans dépendance Python supplémentaire) :

```bash
python lancer.py studio
python lancer.py eleve
```

Le mode studio est choisi par défaut avec `python lancer.py`. Le script ouvre le navigateur et garde le serveur actif jusqu'à `Ctrl+C`. Si le serveur est déjà lancé, il ouvre simplement la page choisie.

## Structure

```
api/albert.js            relais vers Albert (clé côté serveur, contrôle du code studio)
api/_lib/generation.js   prompt envoyé à Albert + vérification de sa réponse
api/publier.js           écriture de parcours.json dans GitHub
api/statut.js            vérification du code studio
public/contenu/parcours.json   tout le contenu (parcours, textes, activités)
src/main.js              navigation élève
src/activites/           lecture, dictée, compréhension, mots mêlés
src/studio/              studio enseignant
src/lib/                 traitement du texte, génération de la grille
```

## Format du contenu

```json
{
  "parcours": [{
    "id": 1, "nom": "Parcours 1", "couleur": "vert",
    "reglages": { "niveau": "CP", "nbMotsDictee": 6, "nbQuestions": 4, "nbMotsMeles": 6, "directions": "simple", "vitesse": 45 },
    "textes": [{
      "id": "…", "titre": "…", "texte": "…", "valide": true,
      "activites": {
        "lecture": { "actif": true, "vitesse": 45, "groupes": ["Le matin,", "Pilou dort", "sur le lit."] },
        "dictee": { "actif": true, "mots": [{ "mot": "chat", "phrase": "Léo a un petit chat gris." }] },
        "comprehension": { "actif": true, "questions": [{ "question": "…", "choix": ["juste", "faux", "faux"], "bonne": 0, "indice": "…", "extrait": "…" }] },
        "motsMeles": { "actif": true, "mots": ["chat", "pelote"], "directions": "simple" },
        "maze": { "actif": true, "trous": [{ "index": 6, "choix": ["dort", "court", "chante"], "bonne": 0 }] }
      }
    }]
  }]
}
```

Chaque parcours contient les 15 textes de son livret PDF, dans le même ordre. Ils sont initialement non validés et sans activités générées.
