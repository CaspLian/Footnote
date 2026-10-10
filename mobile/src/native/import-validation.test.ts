import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPickerOutcome, MAX_IMPORT_BYTES, safeDisplayFilename, validateImportedFile, validateFileMetadata } from './import-validation';
import { draftToHtml, escapeHtml } from './export-content';
import { nativeMessages } from './errors';

const bytes = (value: string) => new TextEncoder().encode(value);

test('real PDF header is required even when a file claims to be a PDF', () => {
  assert.deepEqual(validateImportedFile({ name: 'bill.pdf', mimeType: 'application/pdf', size: 100 }, bytes('%PDF-1.7\n')), { valid: true, mimeType: 'application/pdf', extension: 'pdf' });
  assert.deepEqual(validateImportedFile({ name: 'bill.pdf', mimeType: 'application/pdf', size: 100 }, bytes('<html>not a pdf</html>')), { valid: false, code: 'invalid-pdf' });
});

test('empty and oversized files are rejected before any persistence', () => {
  assert.equal(validateFileMetadata({ name: 'empty.pdf', size: 0 }), 'empty-file');
  assert.equal(validateFileMetadata({ name: 'bad.pdf', size: Number.NaN }), 'empty-file');
  assert.equal(validateFileMetadata({ name: 'large.pdf', size: MAX_IMPORT_BYTES + 1 }), 'file-too-large');
  assert.equal(validateFileMetadata({ name: 'edge.pdf', size: MAX_IMPORT_BYTES }), undefined);
  assert.deepEqual(validateImportedFile({ name: 'empty.pdf' }, new Uint8Array()), { valid: false, code: 'empty-file' });
});

test('unsupported type and PDF disguised as an image are not imported', () => {
  assert.equal(validateFileMetadata({ name: 'sheet.csv', mimeType: 'text/csv', size: 10 }), 'unsupported-file');
  assert.equal(validateFileMetadata({ name: 'danger.svg', mimeType: 'image/svg+xml', size: 10 }), 'unsupported-file');
  assert.deepEqual(validateImportedFile({ name: 'photo.jpg', mimeType: 'image/jpeg', size: 20 }, bytes('%PDF-1.7\n')), { valid: false, code: 'unsupported-file' });
});

test('valid image bytes determine durable extension when pickers rename converted images', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual(validateImportedFile({ name: 'photo.jpg', mimeType: 'image/jpeg', size: 20 }, png), { valid: true, mimeType: 'image/png', extension: 'png' });
  assert.deepEqual(validateImportedFile({ name: 'scan.JPG', size: 20 }, new Uint8Array([0xff, 0xd8, 0xff])), { valid: true, mimeType: 'image/jpeg', extension: 'jpg' });
});

test('generic PDF MIME metadata can fall back to extension but still checks bytes', () => {
  assert.deepEqual(validateImportedFile({ name: 'bill.PDF', mimeType: 'application/octet-stream', size: 40 }, bytes('%PDF-1.4\n')), { valid: true, mimeType: 'application/pdf', extension: 'pdf' });
});

test('cancel is distinct from a malformed picker success', () => {
  assert.deepEqual(classifyPickerOutcome({ canceled: true, assets: null }), { status: 'cancelled' });
  assert.deepEqual(classifyPickerOutcome({ canceled: false, assets: [] }), { status: 'error', code: 'import-failed' });
  const asset = { uri: 'file:///picker/bill.pdf' };
  assert.deepEqual(classifyPickerOutcome({ canceled: false, assets: [asset] }), { status: 'selected', asset });
});

test('display filenames strip path and control characters', () => {
  assert.equal(safeDisplayFilename('../../private/bill\u0000.pdf'), 'bill.pdf');
  assert.equal(safeDisplayFilename('C:\\documents\\bill.pdf'), 'bill.pdf');
});

test('PDF export escapes patient-entered HTML and preserves Spanish content', () => {
  assert.equal(escapeHtml('<script>"&\'</script>'), '&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');
  const html = draftToHtml({ title: '<Petición>', body: 'Revisión & corrección\n<script>alert(1)</script>', language: 'es' });
  assert.ok(html.includes('lang="es"'));
  assert.ok(html.includes('Revisión &amp; corrección'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Revisa los datos'));
});

test('every native error has English and Spanish recovery copy', () => {
  for (const [code, message] of Object.entries(nativeMessages)) {
    assert.ok(message.en.trim(), `${code}: English missing`);
    assert.ok(message.es.trim(), `${code}: Spanish missing`);
  }
});
