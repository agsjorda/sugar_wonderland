import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fakeResponseFilePath = fileURLToPath(new URL('../fake-response.json', import.meta.url));

const fakeBonusResponse = () => {
    return {
        name: 'fake-bonus-response',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                try {
                    const url = typeof req?.url === 'string' ? req.url : '';
                    const pathname = (() => {
                        try {
                            return new URL(url, 'http://localhost').pathname;
                        } catch {
                            return url;
                        }
                    })();
                    if (!pathname || !pathname.endsWith('/fake-response.json')) {
                        return next();
                    }
                    if (!fs.existsSync(fakeResponseFilePath)) {
                        return next();
                    }
                    const data = fs.readFileSync(fakeResponseFilePath);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(data);
                } catch {
                    return next();
                }
            });
        },
        generateBundle() {
            try {
                if (!fs.existsSync(fakeResponseFilePath)) return;
                const source = fs.readFileSync(fakeResponseFilePath);
                this.emitFile({ type: 'asset', fileName: 'fake-response.json', source });
            } catch {}
        }
    };
};

export default defineConfig({
    base: './',
    resolve: {
        dedupe: ['phaser']
    },
    plugins: [
        fakeBonusResponse()
    ],
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
