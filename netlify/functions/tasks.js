// Netlify Function for tasks API
const fs = require('fs').promises;
const path = require('path');

const TASKS_FILE = path.join(process.cwd(), 'tasks.json');

// Ensure tasks.json exists
async function ensureTasksFile() {
  try {
    await fs.access(TASKS_FILE);
  } catch {
    const initialData = {
      tasks: [
        {
          id: "1",
          title: "Security Audit",
          description: "Daily security check",
          category: "security",
          status: "done",
          createdAt: "2026-02-06T14:00:00Z",
          completedAt: "2026-02-06T14:30:00Z",
          agent: "cron"
        },
        {
          id: "2",
          title: "Build Dashboard",
          description: "Create Netlify deployment",
          category: "development",
          status: "in-progress",
          createdAt: new Date().toISOString(),
          completedAt: null,
          agent: "manual"
        }
      ],
      lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(TASKS_FILE, JSON.stringify(initialData, null, 2));
  }
}

exports.handler = async (event, context) => {
  await ensureTasksFile();
  
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const pathParts = event.path.split('/');
  const taskId = pathParts[pathParts.length - 1];

  try {
    const data = await fs.readFile(TASKS_FILE, 'utf8');
    const tasksData = JSON.parse(data);

    // GET /api/tasks
    if (event.httpMethod === 'GET' && event.path.endsWith('/tasks')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(tasksData)
      };
    }

    // POST /api/tasks
    if (event.httpMethod === 'POST' && event.path.endsWith('/tasks')) {
      const newTask = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        completedAt: null,
        ...JSON.parse(event.body)
      };
      tasksData.tasks.push(newTask);
      tasksData.lastUpdated = new Date().toISOString();
      await fs.writeFile(TASKS_FILE, JSON.stringify(tasksData, null, 2));
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(newTask)
      };
    }

    // PATCH /api/tasks/:id
    if (event.httpMethod === 'PATCH' && event.path.includes('/tasks/')) {
      const task = tasksData.tasks.find(t => t.id === taskId);
      if (!task) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Task not found' }) };
      }
      const updates = JSON.parse(event.body);
      Object.assign(task, updates);
      if (updates.status === 'done' && !task.completedAt) {
        task.completedAt = new Date().toISOString();
      }
      tasksData.lastUpdated = new Date().toISOString();
      await fs.writeFile(TASKS_FILE, JSON.stringify(tasksData, null, 2));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(task)
      };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};