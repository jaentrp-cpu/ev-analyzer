import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Muuta base vastaamaan GitHub Pages -repositorion nimeä
  // Esim. jos repo on "jaentrp-cpu/ev-analyzer" → base: '/ev-analyzer/'
  base: '/',
});
