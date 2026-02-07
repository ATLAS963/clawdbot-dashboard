// PATCH  /api/tasks/:id  — update a task
// DELETE /api/tasks/:id  — delete a task

const { checkAuth, cors, updateTask, deleteTask } = require('../_db');

const VALID_STATUSES = ['todo', 'in-progress', 'done'];
const VALID_CATEGORIES = ['development', 'automation', 'security', 'research', 'content', 'maintenance'];

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;

  try {
    if (req.method === 'PATCH') {
      const body = req.body || {};
      const updates = {};

      if (body.title !== undefined) updates.title = String(body.title).trim();
      if (body.description !== undefined) updates.description = String(body.description).trim();
      if (body.category && VALID_CATEGORIES.includes(body.category)) updates.category = body.category;
      if (body.status && VALID_STATUSES.includes(body.status)) {
        updates.status = body.status;
        if (body.status === 'done') {
          updates.completedAt = new Date().toISOString();
        } else {
          updates.completedAt = null;
        }
      }

      const task = await updateTask(id, updates);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      return res.json(task);
    }

    if (req.method === 'DELETE') {
      const task = await deleteTask(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      return res.json(task);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
