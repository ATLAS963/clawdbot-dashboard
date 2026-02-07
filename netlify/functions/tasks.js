// ClawdBot Dashboard — API
//
// Authentication:
//   All requests require: Authorization: Bearer <CLAWDBOT_API_KEY>
//   Set CLAWDBOT_API_KEY as a Netlify environment variable.
//   If CLAWDBOT_API_KEY is not set, auth is disabled (dev mode).
//
// Endpoints:
//   GET    /api/tasks          — List all tasks
//   POST   /api/tasks          — Create a task
//   PATCH  /api/tasks/:id      — Update a task (partial)
//   DELETE /api/tasks/:id      — Delete a task
//
// Task schema:
//   {
//     id:          string,
//     title:       string,
//     description: string,
//     category:    "development"|"automation"|"security"|"research"|"content"|"maintenance",
//     status:      "todo"|"in-progress"|"done",
//     createdAt:   ISO 8601 timestamp,
//     completedAt: ISO 8601 timestamp | null,
//     agent:       "bot"|"manual"
//   }
//
// Bot usage example (curl):
//   curl -X POST https://your-site.netlify.app/api/tasks \
//     -H "Authorization: Bearer YOUR_API_KEY" \
//     -H "Content-Type: application/json" \
//     -d '{"title":"Scan repos","description":"Weekly scan","category":"security","status":"todo","agent":"bot"}'

const fs = require('fs').promises;
const path = require('path');

// Use /tmp for writable storage in serverless environments
const TASKS_FILE = path.join('/tmp', 'clawdbot-tasks.json');

const VALID_STATUSES = ['todo', 'in-progress', 'done'];
const VALID_CATEGORIES = ['development', 'automation', 'security', 'research', 'content', 'maintenance'];

const SEED_TASKS = [
  {
    id: '1',
    title: 'Security Audit',
    description: 'Daily automated security check of all repositories',
    category: 'security',
    status: 'done',
    createdAt: '2026-02-03T10:00:00Z',
    completedAt: '2026-02-03T10:30:00Z',
    agent: 'bot'
  },
  {
    id: '2',
    title: 'Build Dashboard',
    description: 'Create and deploy the ClawdBot task dashboard',
    category: 'development',
    status: 'done',
    createdAt: '2026-02-04T09:00:00Z',
    completedAt: '2026-02-06T18:47:00Z',
    agent: 'manual'
  },
  {
    id: '3',
    title: 'Setup CI/CD Pipeline',
    description: 'Configure automated testing and deployment workflows',
    category: 'automation',
    status: 'in-progress',
    createdAt: '2026-02-06T14:00:00Z',
    completedAt: null,
    agent: 'bot'
  },
  {
    id: '4',
    title: 'API Rate Limit Monitor',
    description: 'Implement monitoring for external API usage and costs',
    category: 'maintenance',
    status: 'todo',
    createdAt: '2026-02-07T08:00:00Z',
    completedAt: null,
    agent: 'bot'
  },
  {
    id: '5',
    title: 'Research LLM Caching',
    description: 'Evaluate caching strategies to reduce API costs',
    category: 'research',
    status: 'todo',
    createdAt: '2026-02-07T09:30:00Z',
    completedAt: null,
    agent: 'manual'
  }
];

async function loadData() {
  try {
    const raw = await fs.readFile(TASKS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    // File doesn't exist or is corrupt — seed it
    const data = { tasks: SEED_TASKS, lastUpdated: new Date().toISOString() };
    await saveData(data);
    return data;
  }
}

async function saveData(data) {
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(TASKS_FILE, JSON.stringify(data, null, 2));
}

// CORS + JSON headers
function headers() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function respond(statusCode, body) {
  return { statusCode, headers: headers(), body: JSON.stringify(body) };
}

function checkAuth(event) {
  const secret = process.env.CLAWDBOT_API_KEY;
  if (!secret) return true; // No auth configured — dev mode

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  return token === secret;
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headers(), body: '' };
  }

  // Auth check
  if (!checkAuth(event)) {
    return respond(401, { error: 'Unauthorized — provide a valid API key in the Authorization header' });
  }

  const pathParts = event.path.replace(/\/$/, '').split('/');
  const lastSegment = pathParts[pathParts.length - 1];
  const isTasksEndpoint = lastSegment === 'tasks';

  try {
    const data = await loadData();

    // GET /api/tasks
    if (event.httpMethod === 'GET' && isTasksEndpoint) {
      return respond(200, data);
    }

    // POST /api/tasks
    if (event.httpMethod === 'POST' && isTasksEndpoint) {
      const body = JSON.parse(event.body || '{}');

      if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
        return respond(400, { error: 'title is required' });
      }

      const task = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title: body.title.trim(),
        description: (body.description || '').trim(),
        category: VALID_CATEGORIES.includes(body.category) ? body.category : 'development',
        status: VALID_STATUSES.includes(body.status) ? body.status : 'todo',
        createdAt: new Date().toISOString(),
        completedAt: body.status === 'done' ? new Date().toISOString() : null,
        agent: body.agent === 'bot' ? 'bot' : 'manual',
      };

      data.tasks.push(task);
      await saveData(data);
      return respond(201, task);
    }

    // PATCH /api/tasks/:id
    if (event.httpMethod === 'PATCH' && !isTasksEndpoint) {
      const taskId = lastSegment;
      const task = data.tasks.find(t => t.id === taskId);
      if (!task) return respond(404, { error: 'Task not found' });

      const body = JSON.parse(event.body || '{}');

      if (body.title !== undefined) task.title = String(body.title).trim();
      if (body.description !== undefined) task.description = String(body.description).trim();
      if (body.category && VALID_CATEGORIES.includes(body.category)) task.category = body.category;
      if (body.status && VALID_STATUSES.includes(body.status)) {
        task.status = body.status;
        if (body.status === 'done' && !task.completedAt) {
          task.completedAt = new Date().toISOString();
        }
        if (body.status !== 'done') {
          task.completedAt = null;
        }
      }

      await saveData(data);
      return respond(200, task);
    }

    // DELETE /api/tasks/:id
    if (event.httpMethod === 'DELETE' && !isTasksEndpoint) {
      const taskId = lastSegment;
      const idx = data.tasks.findIndex(t => t.id === taskId);
      if (idx === -1) return respond(404, { error: 'Task not found' });

      const removed = data.tasks.splice(idx, 1)[0];
      await saveData(data);
      return respond(200, removed);
    }

    return respond(404, { error: 'Not found' });
  } catch (err) {
    console.error('API error:', err);
    return respond(500, { error: 'Internal server error' });
  }
};
