// Shared database module — Supabase with in-memory fallback
//
// When SUPABASE_URL + SUPABASE_SERVICE_KEY are set → uses Supabase (persistent)
// When not set → uses in-memory array with seed data (resets on cold start)

const { createClient } = require('@supabase/supabase-js');

// ---- Supabase singleton ----
let _sb = null;
function sb() {
  if (!_sb) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) return null;
    _sb = createClient(url, key);
  }
  return _sb;
}

// ---- Auth ----
function checkAuth(req) {
  const secret = process.env.CLAWDBOT_API_KEY;
  if (!secret) return true; // dev mode
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  return token === secret;
}

// ---- CORS ----
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// ---- Row mapping (snake_case DB ↔ camelCase API) ----
function toApi(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
    agent: row.agent,
  };
}

function toDb(obj) {
  const row = {};
  if (obj.title !== undefined) row.title = obj.title;
  if (obj.description !== undefined) row.description = obj.description;
  if (obj.category !== undefined) row.category = obj.category;
  if (obj.status !== undefined) row.status = obj.status;
  if (obj.createdAt !== undefined) row.created_at = obj.createdAt;
  if (obj.completedAt !== undefined) row.completed_at = obj.completedAt;
  if (obj.agent !== undefined) row.agent = obj.agent;
  return row;
}

// ---- In-memory fallback (dev mode) ----
let _mem = null;
function mem() {
  if (!_mem) {
    _mem = [
      { id: '1', title: 'Security Audit', description: 'Daily automated security check of all repositories', category: 'security', status: 'done', createdAt: '2026-02-03T10:00:00Z', completedAt: '2026-02-03T10:30:00Z', agent: 'bot' },
      { id: '2', title: 'Build Dashboard', description: 'Create and deploy the ClawdBot task dashboard', category: 'development', status: 'done', createdAt: '2026-02-04T09:00:00Z', completedAt: '2026-02-06T18:47:00Z', agent: 'manual' },
      { id: '3', title: 'Setup CI/CD Pipeline', description: 'Configure automated testing and deployment workflows', category: 'automation', status: 'in-progress', createdAt: '2026-02-06T14:00:00Z', completedAt: null, agent: 'bot' },
      { id: '4', title: 'API Rate Limit Monitor', description: 'Implement monitoring for external API usage and costs', category: 'maintenance', status: 'todo', createdAt: '2026-02-07T08:00:00Z', completedAt: null, agent: 'bot' },
      { id: '5', title: 'Research LLM Caching', description: 'Evaluate caching strategies to reduce API costs', category: 'research', status: 'todo', createdAt: '2026-02-07T09:30:00Z', completedAt: null, agent: 'manual' },
    ];
  }
  return _mem;
}

// ---- CRUD ----
async function listTasks() {
  const db = sb();
  if (db) {
    const { data, error } = await db
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(toApi);
  }
  return [...mem()];
}

async function createTask(task) {
  const db = sb();
  if (db) {
    const row = toDb(task);
    const { data, error } = await db
      .from('tasks')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return toApi(data);
  }
  // fallback
  const t = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ...task,
  };
  mem().unshift(t);
  return t;
}

async function updateTask(id, updates) {
  const db = sb();
  if (db) {
    const row = toDb(updates);
    const { data, error } = await db
      .from('tasks')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data ? toApi(data) : null;
  }
  // fallback
  const tasks = mem();
  const task = tasks.find(t => t.id === id);
  if (!task) return null;
  Object.assign(task, updates);
  return { ...task };
}

async function deleteTask(id) {
  const db = sb();
  if (db) {
    const { data, error } = await db
      .from('tasks')
      .delete()
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data ? toApi(data) : null;
  }
  // fallback
  const tasks = mem();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  return tasks.splice(idx, 1)[0];
}

module.exports = { checkAuth, cors, listTasks, createTask, updateTask, deleteTask };
