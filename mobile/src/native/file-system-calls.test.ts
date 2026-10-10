import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// Since expo-file-system 57, File/Directory copy(), move(), text(), bytes() and base64() return promises (the
// *Sync variants do not). A call without await checks or deletes files before the operation is done: on Android
// every imported bill failed with "The document could not be saved" (2026-10-10). The web build uses
// documents.web.ts, so only a phone or emulator shows it; this check catches it everywhere.
const ASYNC_FILE_CALL = /\.(copy|move|text|bytes|base64)\(/g;

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|web)\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

test('native file operations are awaited', () => {
  const unawaited: string[] = [];
  for (const file of sources(join(import.meta.dirname, '..'))) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('expo-file-system')) continue;
    text.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(ASYNC_FILE_CALL)) {
        const before = line.slice(0, match.index);
        if (!/\bawait\s+[\w.?]+$/.test(before) && !/\breturn\s+[\w.?]+$/.test(before)) unawaited.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(unawaited, []);
});
