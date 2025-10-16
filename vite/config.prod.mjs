import { defineConfig } from 'vite';
import { gzipSync, brotliCompressSync, constants as ZLIB_CONSTANTS } from 'node:zlib';

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
    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version || 'prod')
    },
    build: {
        // Generate both modern and legacy bundles to maximize browser support
        target: 'es2018',
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
        },
        // Produce smaller assets; actual on-the-fly compression is handled by the server/CDN
        brotliSize: true,
        chunkSizeWarningLimit: 1500
    },
    server: {
        port: 8080,
        host: true,
        allowedHosts: ['minium.dev.fybtech.xyz']
    },
    plugins: [
        phasermsg(),
        // Add gzip and brotli compressed artifacts for hosting setups that can serve them
        {
            name: 'emit-compressed-assets',
            apply: 'build',
            generateBundle(_options, bundle) {
                for (const [fileName, asset] of Object.entries(bundle)) {
                    if (!/\.(js|css|html|json|wasm)$/i.test(fileName)) continue;
                    const source = (asset.type === 'asset') ? Buffer.from(asset.source) : Buffer.from(asset.code);
                    const gz = gzipSync(source, { level: 9 });
                    this.emitFile({ type: 'asset', fileName: fileName + '.gz', source: gz });
                    const br = brotliCompressSync(source, {
                        params: { [ZLIB_CONSTANTS.BROTLI_PARAM_QUALITY]: 11 }
                    });
                    this.emitFile({ type: 'asset', fileName: fileName + '.br', source: br });
                }
            }
        }
    ]
});
