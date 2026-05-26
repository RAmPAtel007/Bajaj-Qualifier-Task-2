// API client. Resolves base URL with:
// 1. explicit VITE_API_URL,
// 2. localhost during local dev,
// 3. else fall through to the deployed Render origin (set after backend deploy).

const PROD_FALLBACK = 'https://bajaj-qualifier-task-2.onrender.com';

const host = typeof window !== 'undefined' ? window.location.hostname : '';
const localDev = /^(localhost|127\.)/.test(host);

const origin =
  (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.replace(/\/$/, '')) ||
  (localDev ? 'http://localhost:4100' : PROD_FALLBACK);

const BASE = `${origin}/bfhl`;

async function send(path, init = {}) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (r.status === 204) return null;
  const ct = r.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await r.json().catch(() => ({})) : await r.text();
  if (!r.ok) {
    const msg = (body && body.error) || `request failed (${r.status})`;
    const e = new Error(msg);
    e.status = r.status;
    e.fields = body && body.fields;
    throw e;
  }
  return body;
}

export const listTasks = ({ status, minImportance } = {}) => {
  const q = new URLSearchParams();
  if (status) q.set('status', status);
  if (minImportance != null && minImportance !== '') q.set('minImportance', String(minImportance));
  const qs = q.toString();
  return send(`/tasks${qs ? `?${qs}` : ''}`);
};

export const createTask = (body) => send('/tasks', { method: 'POST', body: JSON.stringify(body) });
export const updateTask = (id, patch) => send(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const removeTask = (id) => send(`/tasks/${id}`, { method: 'DELETE' });
export const getStats = () => send('/tasks/stats');
