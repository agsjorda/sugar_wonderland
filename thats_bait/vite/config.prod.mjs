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
                    if (!req?.url || !req.url.startsWith('/fake-response.json')) {
                        return next();
                    }
                    const p = path.resolve(server.config.root, path.basename(fakeResponseFilePath));
                    if (!fs.existsSync(p)) {
                        return next();
                    }
                    const data = fs.readFileSync(p);
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

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);
            
            process.stdout.write(`✨ Done ✨\n`);
        }
    }
}   

export default defineConfig({
    base: './',
    logLevel: 'warning',
    resolve: {
        dedupe: ['phaser']
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    },
    server: {
        port: 8080,
        host: true,
        allowedHosts: ['minium.dev.fybtech.xyz', 'dev-games.dijoker.com']
    },
    plugins: [
        phasermsg(),
        fakeBonusResponse()
    ]
});
