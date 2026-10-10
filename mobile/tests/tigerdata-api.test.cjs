const assert = require('node:assert/strict');
const test = require('node:test');
const { createTigerDataApi } = require('../tigerdata-api.cjs');

function createHarness(responses = []) {
  const calls = [];
  const formData = {
    fields: [],
    append(name, value) {
      this.fields.push([name, value]);
    },
  };
  const api = createTigerDataApi({
    baseUrl: 'http://192.168.1.20:8000/',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      const response = responses.shift() || { ok: true, status: 200, json: async () => ({}) };
      return response;
    },
    formDataFactory: () => formData,
  });
  return { api, calls, formData };
}

test('uploads a selected bill image to the Gemini and Tiger Data analysis endpoint', async () => {
  const expected = { audit: { audit_id: 'audit-1' }, extracted_bill: { items: [] } };
  const { api, calls, formData } = createHarness([
    { ok: true, status: 200, json: async () => expected },
  ]);

  const result = await api.uploadBill({
    uri: 'file:///bill.jpg',
    name: 'bill.jpg',
    type: 'image/jpeg',
  });

  assert.deepEqual(result, expected);
  assert.equal(calls[0].url, 'http://192.168.1.20:8000/api/v1/analyze-image');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(formData.fields, [
    ['file', { uri: 'file:///bill.jpg', name: 'bill.jpg', type: 'image/jpeg' }],
  ]);
});

test('reads the latest audit state and timeline from the backend', async () => {
  const audit = { audit_id: 'audit-1', events: [{ event_type: 'bill_scanned' }] };
  const { api, calls } = createHarness([
    { ok: true, status: 200, json: async () => audit },
  ]);

  assert.deepEqual(await api.getAudit('audit-1'), audit);
  assert.equal(calls[0].url, 'http://192.168.1.20:8000/api/v1/audits/audit-1');
});

test('creates a manual case in Tiger Data through the backend', async () => {
  const expected = { audit_id: 'manual-1', case_type: 'manual_case' };
  const { api, calls } = createHarness([
    { ok: true, status: 201, json: async () => expected },
  ]);

  const result = await api.createManualCase({
    provider_name: 'Example Hospital',
    service_date: '2026-09-15',
    bill_received_date: '2026-10-01',
    payment_due_date: '2026-11-01',
  });

  assert.deepEqual(result, expected);
  assert.equal(calls[0].url, 'http://192.168.1.20:8000/api/v1/audits/manual');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    provider_name: 'Example Hospital',
    service_date: '2026-09-15',
    bill_received_date: '2026-10-01',
    payment_due_date: '2026-11-01',
  });
});

test('sends status, deadline corrections, and actions to the audit API', async () => {
  const { api, calls } = createHarness([
    { ok: true, status: 200, json: async () => ({ status: 'dispute_in_progress' }) },
    { ok: true, status: 200, json: async () => ({ collection_deadline: '2026-12-01' }) },
    { ok: true, status: 201, json: async () => ({ action: 'Called provider' }) },
  ]);

  await api.updateStatus('audit-1', 'dispute_in_progress', 'Letter sent');
  await api.updateDeadlines('audit-1', {
    collection_deadline: '2026-12-01',
    payment_due_date: null,
  });
  await api.addAction('audit-1', 'Called provider', 'Asked for itemized bill');

  assert.deepEqual(calls.map(call => [call.options.method, call.url]), [
    ['PATCH', 'http://192.168.1.20:8000/api/v1/audits/audit-1/status'],
    ['PATCH', 'http://192.168.1.20:8000/api/v1/audits/audit-1/deadlines'],
    ['POST', 'http://192.168.1.20:8000/api/v1/audits/audit-1/actions'],
  ]);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    status: 'dispute_in_progress',
    note: 'Letter sent',
  });
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    collection_deadline: '2026-12-01',
    payment_due_date: null,
  });
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    action: 'Called provider',
    note: 'Asked for itemized bill',
  });
});

test('surfaces backend errors instead of returning success-shaped empty data', async () => {
  const { api } = createHarness([
    { ok: false, status: 503, json: async () => ({ detail: 'Tiger Data unavailable' }) },
  ]);

  await assert.rejects(
    api.getAudit('audit-1'),
    /Tiger Data unavailable/,
  );
});
