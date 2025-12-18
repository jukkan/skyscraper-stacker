import { defineConfig } from 'vite';

export default defineConfig({
  base: '/skyscraper-stacker/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  server: {
    host: true
  }
});
