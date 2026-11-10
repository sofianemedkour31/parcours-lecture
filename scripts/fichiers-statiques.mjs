import path from 'node:path';

// Le serveur local ne sert que l'application, ses sources et les fichiers publics.
export function candidatsStatiques(racine, pathname, dist = false) {
  const relatif = decodeURIComponent(pathname).replace(/\\/g, '/').replace(/^\/+/, '') || 'index.html';
  const segments = relatif.split('/');
  if (segments.some((s) => !s || s.startsWith('.'))) return [];
  const publicDir = path.join(racine, dist ? 'dist' : 'public');
  const chemins = dist
    ? [[publicDir, relatif]]
    : [
        ...(relatif === 'index.html' || (relatif.startsWith('src/') && /\.(js|css)$/.test(relatif))
          ? [[racine, relatif]] : []),
        [publicDir, relatif],
      ];
  return chemins.flatMap(([base, nom]) => {
    const cible = path.resolve(base, nom);
    const sous = path.relative(base, cible);
    return sous.startsWith('..') || path.isAbsolute(sous) ? [] : [{ base, cible }];
  });
}
