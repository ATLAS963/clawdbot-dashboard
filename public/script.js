// Modified for Netlify Functions
const API_BASE = '/.netlify/functions';

document.addEventListener('DOMContentLoaded', () => {
  const todoCol = document.getElementById('todo-tasks');
  const inprogressCol = document.getElementById('inprogress-tasks-col');
  const doneCol = document.getElementById('done-tasks-col');
  const totalTasksEl = document.getElementById('total-tasks');
  const doneTasksEl = document.getElementById('done-tasks');
  const inprogressTasksEl = document.getElementById('inprogress-tasks');
  const lastUpdatedEl = document.getElementById('last-updated');
  const cronListEl = document.getElementById('cron-list');
  const activityListEl = document.getElementById('activity-list');
  const addTaskBtn = document.getElementById('add-task-btn');
  const newTaskTitle = document.getElementById('new-task-title');
  const newTaskDesc = document.getElementById('new-task-desc');
  const newTaskCategory = document.getElementById('new-task-category');

  let tasks = [];
  let dragTask = null;

  // Fetch tasks from Netlify Function
  async function fetchTasks() {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      const data = await res.json();
      tasks = data.tasks || [];
      lastUpdatedEl.textContent = new Date(data.lastUpdated || Date.now()).toLocaleString();
      renderTasks();
      updateStats();
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      // Fallback to sample data
      tasks = [
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
          createdAt: "2026-02-06T18:47:00Z",
          completedAt: null,
          agent: "manual"
        }
      ];
      renderTasks();
      updateStats();
    }
  }

  // Fetch cron jobs (static for now)
  async function fetchCron() {
    // In future, fetch from ClawdBot API
    const cronJobs = [
      { name: 'Daily Security Audit', nextRun: '2026-02-07T14:00:00Z' },
      { name: 'System Health Check', nextRun: '2026-02-06T23:00:00Z' },
      { name: 'ClawdBot Update Check', nextRun: '2026-02-08T15:00:00Z' },
      { name: 'Backup Verification', nextRun: '2026-02-08T15:00:00Z' },
      { name: 'API Cost Monitoring', nextRun: '2026-02-13T15:00:00Z' }
    ];
    renderCron(cronJobs);
  }

  // Render tasks to columns
  function renderTasks() {
    todoCol.innerHTML = '';
    inprogressCol.innerHTML = '';
    doneCol.innerHTML = '';

    tasks.forEach(task => {
      const taskEl = createTaskElement(task);
      if (task.status === 'todo') todoCol.appendChild(taskEl);
      else if (task.status === 'in-progress') inprogressCol.appendChild(taskEl);
      else if (task.status === 'done') doneCol.appendChild(taskEl);
    });

    // Make tasks draggable
    document.querySelectorAll('.task').forEach(task => {
      task.draggable = true;
      task.addEventListener('dragstart', handleDragStart);
      task.addEventListener('dragend', handleDragEnd);
    });

    // Make columns droppable
    document.querySelectorAll('.column').forEach(col => {
      col.addEventListener('dragover', handleDragOver);
      col.addEventListener('dragenter', handleDragEnter);
      col.addEventListener('dragleave', handleDragLeave);
      col.addEventListener('drop', handleDrop);
    });

    // Render recent activity (last 5 done tasks)
    const recent = tasks
      .filter(t => t.status === 'done')
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 5);
    renderActivity(recent);
  }

  // Create task DOM element
  function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = `task ${task.status}`;
    div.dataset.id = task.id;
    div.innerHTML = `
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-desc">${escapeHtml(task.description)}</div>
      <div class="task-meta">
        <span class="task-category">${task.category}</span>
        <span>${new Date(task.createdAt).toLocaleDateString()}</span>
      </div>
    `;
    return div;
  }

  // Render cron jobs
  function renderCron(jobs) {
    cronListEl.innerHTML = '';
    jobs.forEach(job => {
      const div = document.createElement('div');
      div.className = 'cron-job';
      div.innerHTML = `
        <div class="cron-name">${escapeHtml(job.name)}</div>
        <div class="cron-next">Next: ${new Date(job.nextRun).toLocaleString()}</div>
      `;
      cronListEl.appendChild(div);
    });
  }

  // Render recent activity
  function renderActivity(activities) {
    activityListEl.innerHTML = '';
    activities.forEach(act => {
      const div = document.createElement('div');
      div.className = 'activity-item';
      div.innerHTML = `
        <div class="activity-text">${escapeHtml(act.title)}</div>
        <div class="activity-time">${new Date(act.completedAt).toLocaleString()}</div>
      `;
      activityListEl.appendChild(div);
    });
  }

  // Update stats counters
  function updateStats() {
    totalTasksEl.textContent = tasks.length;
    doneTasksEl.textContent = tasks.filter(t => t.status === 'done').length;
    inprogressTasksEl.textContent = tasks.filter(t => t.status === 'in-progress').length;
  }

  // Add new task via Netlify Function
  async function addTask() {
    const title = newTaskTitle.value.trim();
    const desc = newTaskDesc.value.trim();
    const category = newTaskCategory.value;
    if (!title) return alert('Please enter a task title');

    const task = {
      title,
      description: desc,
      category,
      status: 'todo',
      agent: 'manual'
    };

    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
      if (res.ok) {
        newTaskTitle.value = '';
        newTaskDesc.value = '';
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to add task:', err);
      // Add locally for demo
      task.id = Date.now().toString();
      task.createdAt = new Date().toISOString();
      tasks.push(task);
      renderTasks();
      updateStats();
    }
  }

  // Update task status via Netlify Function
  async function updateTaskStatus(taskId, newStatus) {
    try {
      await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchTasks();
    } catch (err) {
      console.error('Failed to update task:', err);
      // Update locally for demo
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        task.status = newStatus;
        if (newStatus === 'done' && !task.completedAt) {
          task.completedAt = new Date().toISOString();
        }
        renderTasks();
        updateStats();
      }
    }
  }

  // Drag & drop handlers
  function handleDragStart(e) {
    dragTask = this;
    this.classList.add('dragging');
    e.dataTransfer.setData('text/plain', this.dataset.id);
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    dragTask = null;
    document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDragEnter(e) {
    e.preventDefault();
    this.classList.add('drag-over');
  }

  function handleDragLeave() {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    if (!dragTask) return;

    const newStatus = this.dataset.status;
    const taskId = dragTask.dataset.id;
    updateTaskStatus(taskId, newStatus);
  }

  // Utility: escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Event listeners
  addTaskBtn.addEventListener('click', addTask);
  newTaskTitle.addEventListener('keypress', e => {
    if (e.key === 'Enter') addTask();
  });

  // Initial load
  fetchTasks();
  fetchCron();
});