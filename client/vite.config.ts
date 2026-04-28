import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/stargazing/' : '/',
  server: { port: 5173 },
}));