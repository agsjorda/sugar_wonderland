import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { ViteDevServer } from 'vite';
import path from 'path';

function gameReloadPlugin(): Plugin {
  return {
    name: 'game-reload-on-change',

    configureServer(server: ViteDevServer) {
      const gameDirPath = path.resolve(__dirname, '../src/game');

      server.watcher.on('change', (file: string) => {
        const normalizedFile = path.normalize(file);

        if (normalizedFile.startsWith(gameDirPath)) {
          console.log(`[Plugin HMR] Core game file changed (${normalizedFile}). Forcing full browser reload.`);
          server.ws.send({
            type: 'full-reload',
            path: '*'
          });
          // <--- THE CRITICAL CHANGE IS HERE --->
          // Return an empty array to prevent Vite from processing
          // this update further with its default HMR handlers.
          return [];
        }
        // If the file is not in src/game, let Vite handle it as usual
        // (i.e., return undefined, or don't return anything)
      });
    },
  };
}

export default defineConfig({
    base: './',
    plugins: [
        react(),
        gameReloadPlugin(),
    ],
    server: {
        port: 3000,
        hmr: true,
    },
});