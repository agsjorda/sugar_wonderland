#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/game/components/Symbols.ts');
let src = fs.readFileSync(filePath, 'utf8');

// Detect repeated concatenation by finding the second occurrence of the known import header
const marker = '\nimport { Data } from "../../tmp_backend/Data";';
const first = src.indexOf(marker);
const second = src.indexOf(marker, first + marker.length);
const third = second === -1 ? -1 : src.indexOf(marker, second + marker.length);

if (first === -1 || second === -1) {
  console.log('[info] No duplicate segments detected or file already clean.');
  process.exit(0);
}

// Keep only the first segment up to start of second segment
const cleaned = src.slice(0, second).trimEnd() + '\n';
fs.writeFileSync(filePath, cleaned, 'utf8');

console.log(`[ok] Deduplicated Symbols.ts. Kept first segment (${second} bytes).` + (third !== -1 ? ' Removed 2+ extra segments.' : ' Removed one extra segment.'));


