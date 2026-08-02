#!/usr/bin/env node
/**
 * Copies the dataset into the iOS package's resource bundle and regenerates the
 * localisation table, so the app and the web version can never disagree about the
 * data. Run after any edit to data/*.json or js/i18n.js:
 *
 *     node build/sync-ios.js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'ios/Packages/JazzTreeCore/Sources/JazzTreeCore/Resources');
mkdirSync(dest, { recursive: true });

// The ID-keyed editorial table is generated from reviewable translation
// fragments. Build and validate it before embedding anything in the app.
execFileSync(process.execPath, [join(root, 'build/build-localization.js')], { stdio: 'inherit' });
execFileSync(process.execPath, [join(root, 'build/validate-localization.js')], { stdio: 'inherit' });

for (const name of ['genres.json', 'albums.json', 'paths.json']) {
  const data = readFileSync(join(root, 'data', name));
  writeFileSync(join(dest, name), data);
  console.log(`copied data/${name} → ${(data.length / 1024).toFixed(0)} KB`);
}

// Regenerates localization.json and fails if the app references a missing key.
execFileSync(process.execPath, [join(root, 'build/extract-i18n.js')], { stdio: 'inherit' });

console.log('\nNow verify the Swift side:');
console.log('  cd ios/Packages/JazzTreeCore && swift run jazztree-verify');
