import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version || 'dev')
    },
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
        port: 8080,
        host: true,
        allowedHosts: ['minium.dev.fybtech.xyz']
    }
});
