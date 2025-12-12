import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression2';
import { constants } from 'zlib';
import viteImagemin from 'vite-plugin-imagemin';

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
        // Use esbuild for faster minification (significantly faster than terser)
        minify: 'esbuild',
        // Enable source maps for debugging (can be disabled for smaller builds)
        sourcemap: false,
        // Optimize chunk size
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                // Better code splitting for faster initial load
                manualChunks: (id) => {
                    // Split vendor libraries into separate chunks
                    if (id.includes('node_modules')) {
                        if (id.includes('phaser')) {
                            return 'phaser';
                        }
                        if (id.includes('react') || id.includes('react-dom')) {
                            return 'react-vendor';
                        }
                        if (id.includes('spine')) {
                            return 'spine-vendor';
                        }
                        // Other vendor libraries
                        return 'vendor';
                    }
                },
                // Optimize chunk file names
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js',
                assetFileNames: (assetInfo) => {
                    const info = assetInfo.name.split('.');
                    const ext = info[info.length - 1];
                    if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(ext)) {
                        return 'assets/images/[name]-[hash][extname]';
                    }
                    if (/woff2?|eot|ttf|otf/i.test(ext)) {
                        return 'assets/fonts/[name]-[hash][extname]';
                    }
                    if (/ogg|mp3|wav|m4a/i.test(ext)) {
                        return 'assets/audio/[name]-[hash][extname]';
                    }
                    return 'assets/[name]-[hash][extname]';
                }
            }
        }
    },
    server: {
        port: 8080,
        host: true,
        allowedHosts: ['minium.dev.fybtech.xyz']
    },
    plugins: [
        phasermsg(),
        // Optimize images during build
        viteImagemin({
            gifsicle: {
                optimizationLevel: 7,
                interlaced: false,
            },
            optipng: {
                optimizationLevel: 7,
            },
            mozjpeg: {
                quality: 80,
            },
            pngquant: {
                quality: [0.8, 0.9],
            },
            svgo: {
                plugins: [
                    {
                        name: 'removeViewBox',
                    },
                    {
                        name: 'removeEmptyAttrs',
                        active: false,
                    },
                ],
            },
            // Only optimize images in public/assets directory to avoid processing node_modules
            include: /\.(jpg|jpeg|png|gif|svg)$/i,
            // Skip already optimized images (WebP, etc.)
            exclude: /\.(webp|avif)$/i,
        }),
        // Precompress text assets to Brotli (better compression than gzip)
        viteCompression({
            algorithm: 'brotliCompress',
            ext: '.br',
            deleteOriginalAssets: false,
            // Lower threshold to compress smaller files too
            threshold: 512,
            // Include more file types for compression
            filter: (file) => /\.(js|mjs|cjs|css|html|svg|json|ttf|woff2?|atlas|xml)$/i.test(file),
            // Higher compression level for better size reduction
            compressionOptions: {
                params: {
                    [constants.BROTLI_PARAM_QUALITY]: 11,
                    [constants.BROTLI_PARAM_SIZE_HINT]: 0
                }
            }
        }),
        // Also generate gzip as fallback (for older browsers/servers)
        viteCompression({
            algorithm: 'gzip',
            ext: '.gz',
            deleteOriginalAssets: false,
            threshold: 512,
            filter: (file) => /\.(js|mjs|cjs|css|html|svg|json|ttf|woff2?|atlas|xml)$/i.test(file),
            compressionOptions: {
                level: 9 // Maximum compression
            }
        })
    ]
});
