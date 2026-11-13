import { defineConfig } from 'vite';

// relative paths so the build works from any sub-folder (e.g. GitHub Pages)
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1500 } });
