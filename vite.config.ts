import path from 'path';
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
        fs: {
          strict: false,
          allow: [
            searchForWorkspaceRoot(process.cwd()),
            path.resolve(__dirname, '..'),
            path.resolve(__dirname, '.'),
            '/app/applet',
            '/app',
          ],
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
