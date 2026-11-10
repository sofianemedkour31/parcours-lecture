import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [legacy({
    targets: ['defaults', 'samsung >= 8', 'and_chr >= 64'],
    modernPolyfills: ['es.array.flat', 'es.array.flat-map'],
  })],
});
