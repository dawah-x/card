#!/usr/bin/env node
/**
 * Builds clean static frontend bundle into `./dist` for Cloudflare Workers Static Assets
 * and Cloudflare Pages deployments without exposing Python/server source files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

const FILES = [
  'index.html',
  'styles.css',
  'app.js',
  'browser-ai.js',
  'dawahx-ai-widget.js',
  'sw.js',
  'manifest.webmanifest',
  'favicon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'logo.webp',
  'logo-icon.webp',
  '.nojekyll',
];

const DIRS = ['fonts'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const file of FILES) {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(OUT, file));
  }
}

for (const dir of DIRS) {
  const srcDir = path.join(ROOT, dir);
  if (fs.existsSync(srcDir)) {
    fs.cpSync(srcDir, path.join(OUT, dir), { recursive: true });
  }
}

console.log(`Built DAWAH X AI static bundle -> ${OUT} (${FILES.length} root files + fonts/)`);
