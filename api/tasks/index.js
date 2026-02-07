// GET  /api/tasks     — list all tasks
// POST /api/tasks     — create a task

const { checkAuth, cors, listTasks, createTask } = require('../_db');

const VALID_STATUSES = ['todo', 'in-progress', 'done'];
const VALID_CATEGORIES = ['development', 'automation', 'security', 'research', 'content', 'maintenance'];

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const tasks = await listTasks();
      return res.json({ tasks, lastUpdated: new Date().toISOString() });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
        return res.status(400).json({ error: 'title is required' });
      }

      const status = VALID_STATUSES.includes(body.status) ? body.status : 'todo';
      const task = {
        title: body.title.trim(),
        description: (body.description || '').trim(),
        category: VALID_CATEGORIES.includes(body.category) ? body.category : 'development',
        status,
        createdAt: new Date().toISOString(),
        completedAt: status === 'done' ? new Date().toISOString() : null,
        agent: body.agent === 'bot' ? 'bot' : 'manual',
      };

      const created = await createTask(task);
      return res.status(201).json(created);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
