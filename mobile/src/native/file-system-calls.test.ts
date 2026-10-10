import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// Two native-only mistakes that the web build (documents.web.ts) cannot show, both found on the Android emulator on
// 2026-10-10:
// - Since expo-file-system 57, File/Directory copy(), move(), text(), bytes() and base64() return promises (the
//   *Sync variants do not). Without await, files are checked or deleted before the operation is done: every
//   imported bill failed with "The document could not be saved".
// - The global fetch is Expo's, which refuses React Native's { uri, name, type } FormData parts
//   ("Unsupported FormDataPart implementation"): every upload failed before reaching the backend.
const ASYNC_FILE_CALL = /\.(copy|move|text|bytes|base64)\(/g;
const URI_FORM_PART = /\.append\([^)]*\{\s*uri\s*:/;

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|web)\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const SOURCES = sources(join(import.meta.dirname, '..'));

test('native file operations are awaited', () => {
  const unawaited: string[] = [];
  for (const file of SOURCES) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('expo-file-system')) continue;
    text.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(ASYNC_FILE_CALL)) {
        const before = line.slice(0, match.index);
        // awaited, returned, or the body of an arrow function that returns the promise
        if (!/(\bawait|\breturn|=>)\s+[\w.?]+$/.test(before)) unawaited.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(unawaited, []);
});

test('native uploads use FormData parts that Expo fetch can send', () => {
  const uriParts: string[] = [];
  for (const file of SOURCES) {
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (URI_FORM_PART.test(line)) uriParts.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(uriParts, []);
});
