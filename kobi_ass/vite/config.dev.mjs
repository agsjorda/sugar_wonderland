import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: 8080
    },
    plugins: [
        checker({
            typescript: true,
        }),
    ]
});
