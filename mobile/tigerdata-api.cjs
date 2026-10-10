const DEFAULT_API_URL =
  typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_API_URL || '' : '';

function createTigerDataApi({
  baseUrl = DEFAULT_API_URL,
  fetchImpl = globalThis.fetch,
  formDataFactory = () => new FormData(),
} = {}) {
  const apiBaseUrl = baseUrl.trim().replace(/\/+$/, '');

  async function request(path, options = {}) {
    if (!apiBaseUrl) {
      throw new Error('Set EXPO_PUBLIC_API_URL to the backend server address.');
    }
    if (typeof fetchImpl !== 'function') {
      throw new Error('This device does not support network requests.');
    }

    let response;
    try {
      response = await fetchImpl(`${apiBaseUrl}${path}`, options);
    } catch (error) {
      throw new Error(`Could not reach the backend: ${error.message}`);
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`Backend returned an unreadable response (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      const message = typeof body.detail === 'string' ? body.detail : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return body;
  }

  return {
    uploadBill(file) {
      if (!file?.uri || !file.name || !file.type) {
        throw new Error('Choose a bill image with a file name and image type.');
      }
      const formData = formDataFactory();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      });
      return request('/api/v1/analyze-image', {
        method: 'POST',
        body: formData,
      });
    },

    createManualCase(caseDetails) {
      return request('/api/v1/audits/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caseDetails),
      });
    },

    getAudit(auditId) {
      return request(`/api/v1/audits/${encodeURIComponent(auditId)}`);
    },

    updateStatus(auditId, status, note) {
      return request(`/api/v1/audits/${encodeURIComponent(auditId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(note ? { note } : {}) }),
      });
    },

    updateDeadlines(auditId, deadlines) {
      return request(`/api/v1/audits/${encodeURIComponent(auditId)}/deadlines`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deadlines),
      });
    },

    addAction(auditId, action, note) {
      return request(`/api/v1/audits/${encodeURIComponent(auditId)}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(note ? { note } : {}) }),
      });
    },
  };
}

module.exports = { createTigerDataApi };
