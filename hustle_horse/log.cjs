const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const main = async () => {
    const args = process.argv.slice(2);
    const packageJsonPath = path.resolve(__dirname, 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const event = args[0] || 'unknown';
    const phaserVersion = packageData.dependencies.phaser;

    const options = {
        hostname: 'gryzor.co',
        port: 443,
        path: `/v/${event}/${phaserVersion}/${packageData.name}`,
        method: 'GET'
    };

    try {
        const req = https.request(options, (res) => {
            res.on('data', () => {});
            res.on('end', () => {
                process.exit(0);
            });
        });

        req.on('error', () => {
            process.exit(1);
        });

        req.end();
    } catch (error) {
        process.exit(1);
    }
};

main();
