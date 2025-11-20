#!/usr/bin/env node
/**
 * Strip BOM and convert UTF-16 files to UTF-8 (no BOM).
 * Usage: node scripts/fix-bom.cjs <file1> [file2 ...]
 */
const fs = require('fs');
const path = require('path');

function convertUtf16BeToLe(buffer) {
  const swapped = Buffer.allocUnsafe(buffer.length);
  for (let i = 0; i < buffer.length; i += 2) {
    swapped[i] = buffer[i + 1];
    swapped[i + 1] = buffer[i];
  }
  return swapped;
}

function processFile(filePath) {
  const abs = path.resolve(filePath);
  let buf = fs.readFileSync(abs);
  if (buf.length === 0) {
    console.log(`[skip] ${filePath} is empty`);
    return;
  }

  // UTF-16LE with BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    const text = buf.slice(2).toString('utf16le');
    fs.writeFileSync(abs, Buffer.from(text, 'utf8'));
    console.log(`[ok] Converted UTF-16LE -> UTF-8 (no BOM): ${filePath}`);
    return;
  }

  // UTF-16BE with BOM
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const le = convertUtf16BeToLe(buf.slice(2));
    const text = le.toString('utf16le');
    fs.writeFileSync(abs, Buffer.from(text, 'utf8'));
    console.log(`[ok] Converted UTF-16BE -> UTF-8 (no BOM): ${filePath}`);
    return;
  }

  // Remove any number of UTF-8 BOMs (defensive)
  let removed = 0;
  while (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    buf = buf.slice(3);
    removed++;
  }
  if (removed > 0) {
    fs.writeFileSync(abs, buf);
    console.log(`[ok] Removed ${removed} UTF-8 BOM(s): ${filePath}`);
  } else {
    // Re-write as UTF-8 to normalize encoding anyway
    const text = buf.toString('utf8');
    fs.writeFileSync(abs, Buffer.from(text, 'utf8'));
    console.log(`[ok] Ensured UTF-8 without BOM: ${filePath}`);
  }
}

if (process.argv.length <= 2) {
  console.error('Usage: node scripts/fix-bom.cjs <file1> [file2 ...]');
  process.exit(1);
}

for (let i = 2; i < process.argv.length; i++) {
  try {
    processFile(process.argv[i]);
  } catch (err) {
    console.error(`[error] ${process.argv[i]}: ${err.message}`);
    process.exitCode = 1;
  }
}


