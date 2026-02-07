// ClawdBot Dashboard — Client
// API base path (Netlify Functions via redirect)
const API = '/api/tasks';

// ---- State ----
let tasks = [];
let apiKey = localStorage.getItem('clawdbot_key') || '';
let dragTaskId = null;

// ---- DOM refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  authScreen: $('#auth-screen'),
  dashboard: $('#dashboard'),
  apiKeyInput: $('#api-key-input'),
  authBtn: $('#auth-btn'),
  authError: $('#auth-error'),
  logoutBtn: $('#logout-btn'),
  refreshBtn: $('#refresh-btn'),
  newTaskBtn: $('#new-task-btn'),
  modal: $('#task-modal'),
  modalBackdrop: $('#modal-backdrop'),
  modalClose: $('#modal-close'),
  modalCancel: $('#modal-cancel'),
  taskForm: $('#task-form'),
  taskTitle: $('#task-title'),
  taskDesc: $('#task-desc'),
  taskCategory: $('#task-category'),
  taskStatus: $('#task-status'),
  statTotal: $('#stat-total'),
  statTodo: $('#stat-todo'),
  statProgress: $('#stat-progress'),
  statDone: $('#stat-done'),
  countTodo: $('#count-todo'),
  countProgress: $('#count-progress'),
  countDone: $('#count-done'),
  colTodo: $('#col-todo'),
  colProgress: $('#col-progress'),
  colDone: $('#col-done'),
  weeksList: $('#weeks-list'),
  activityList: $('#activity-list'),
  toastContainer: $('#toast-container'),
};

// ---- Utilities ----
function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text || '';
  return el.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return {
    year: d.getFullYear(),
    week: 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  };
}

function getWeekRange(year, week) {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = (jan4.getDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} — ${fmt(sunday)}`;
}

function isCurrentWeek(year, week) {
  const now = getISOWeek(new Date());
  return now.year === year && now.week === week;
}

// ---- Auth headers ----
function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
  return h;
}

// ---- Toast notifications ----
function toast(message, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type ? 'toast-' + type : ''}`;
  el.textContent = message;
  dom.toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 200);
  }, 3000);
}

// ---- API calls ----
async function apiFetch(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  if (res.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function loadTasks() {
  try {
    const data = await apiFetch(API);
    tasks = data.tasks || [];
    render();
  } catch (err) {
    console.error('Failed to load tasks:', err);
    if (err.message !== 'Unauthorized') {
      toast('Failed to load tasks', 'error');
      // Use empty array so UI still renders
      tasks = [];
      render();
    }
  }
}

async function createTask(task) {
  try {
    await apiFetch(API, { method: 'POST', body: JSON.stringify(task) });
    toast('Task created', 'success');
    await loadTasks();
  } catch (err) {
    console.error('Failed to create task:', err);
    toast('Failed to create task', 'error');
  }
}

async function updateTask(id, updates) {
  try {
    await apiFetch(`${API}/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    await loadTasks();
  } catch (err) {
    console.error('Failed to update task:', err);
    toast('Failed to update task', 'error');
  }
}

async function deleteTask(id) {
  try {
    await apiFetch(`${API}/${id}`, { method: 'DELETE' });
    toast('Task deleted', 'success');
    await loadTasks();
  } catch (err) {
    console.error('Failed to delete task:', err);
    toast('Failed to delete task', 'error');
  }
}

// ---- Auth ----
async function authenticate(key) {
  apiKey = key;
  try {
    await apiFetch(API);
    localStorage.setItem('clawdbot_key', key);
    showDashboard();
    await loadTasks();
  } catch {
    apiKey = '';
    localStorage.removeItem('clawdbot_key');
    dom.authError.classList.remove('hidden');
    throw new Error('Auth failed');
  }
}

function logout() {
  apiKey = '';
  localStorage.removeItem('clawdbot_key');
  tasks = [];
  dom.dashboard.classList.add('hidden');
  dom.authScreen.classList.remove('hidden');
  dom.apiKeyInput.value = '';
  dom.authError.classList.add('hidden');
}

function showDashboard() {
  dom.authScreen.classList.add('hidden');
  dom.dashboard.classList.remove('hidden');
}

// ---- Render ----
function render() {
  renderStats();
  renderKanban();
  renderWeeks();
  renderActivity();
}

function renderStats() {
  const todo = tasks.filter(t => t.status === 'todo').length;
  const progress = tasks.filter(t => t.status === 'in-progress').length;
  const done = tasks.filter(t => t.status === 'done').length;
  dom.statTotal.textContent = tasks.length;
  dom.statTodo.textContent = todo;
  dom.statProgress.textContent = progress;
  dom.statDone.textContent = done;
  dom.countTodo.textContent = todo;
  dom.countProgress.textContent = progress;
  dom.countDone.textContent = done;
}

function renderKanban() {
  const columns = {
    'todo': dom.colTodo,
    'in-progress': dom.colProgress,
    'done': dom.colDone,
  };

  Object.values(columns).forEach(col => col.innerHTML = '');

  // Sort: newest first
  const sorted = [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  sorted.forEach(task => {
    const col = columns[task.status];
    if (!col) return;
    col.appendChild(createTaskCard(task));
  });

  // Empty states
  Object.entries(columns).forEach(([status, col]) => {
    if (col.children.length === 0) {
      col.innerHTML = `<div class="empty-state">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
        <span>No tasks</span>
      </div>`;
    }
  });

  setupDragDrop();
}

function createTaskCard(task) {
  const div = document.createElement('div');
  div.className = 'task-card';
  div.draggable = true;
  div.dataset.id = task.id;

  const agentLabel = task.agent === 'bot' || task.agent === 'cron' ? 'Bot' : 'Manual';
  const agentClass = task.agent === 'bot' || task.agent === 'cron' ? 'bot' : '';
  const agentIcon = task.agent === 'bot' || task.agent === 'cron'
    ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>'
    : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  div.innerHTML = `
    <div class="task-card-top">
      <span class="task-category cat-${escapeHtml(task.category)}">${escapeHtml(task.category)}</span>
      <button class="task-delete" data-id="${escapeHtml(task.id)}" title="Delete task">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="task-title">${escapeHtml(task.title)}</div>
    ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
    <div class="task-meta">
      <span class="task-agent ${agentClass}">${agentIcon} ${agentLabel}</span>
      <span class="task-date">${formatDate(task.createdAt)}</span>
    </div>
  `;

  // Delete button handler
  div.querySelector('.task-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.id);
  });

  return div;
}

// ---- Drag & Drop ----
function setupDragDrop() {
  $$('.task-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      dragTaskId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.id);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      dragTaskId = null;
      $$('.kanban-col').forEach(c => c.classList.remove('drag-over'));
    });
  });

  $$('.kanban-col').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    col.addEventListener('dragenter', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', (e) => {
      // Only remove if leaving the column itself
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      if (!dragTaskId) return;
      const newStatus = col.dataset.status;
      const task = tasks.find(t => t.id === dragTaskId);
      if (task && task.status !== newStatus) {
        updateTask(dragTaskId, { status: newStatus });
      }
    });
  });
}

// ---- Weekly Sidebar ----
function renderWeeks() {
  const groups = {};

  tasks.forEach(task => {
    const date = task.completedAt || task.createdAt;
    if (!date) return;
    const { year, week } = getISOWeek(new Date(date));
    const key = `${year}-W${week}`;
    if (!groups[key]) groups[key] = { year, week, tasks: [] };
    groups[key].tasks.push(task);
  });

  // Sort weeks reverse chronologically
  const sorted = Object.values(groups).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.week - a.week;
  });

  dom.weeksList.innerHTML = '';

  if (sorted.length === 0) {
    dom.weeksList.innerHTML = '<div class="empty-state"><span>No history yet</span></div>';
    return;
  }

  sorted.forEach((group, idx) => {
    const isCurrent = isCurrentWeek(group.year, group.week);
    const range = getWeekRange(group.year, group.week);
    const doneCount = group.tasks.filter(t => t.status === 'done').length;
    const totalCount = group.tasks.length;

    const weekEl = document.createElement('div');
    weekEl.className = `week-group${idx === 0 ? ' expanded' : ''}`;

    weekEl.innerHTML = `
      <div class="week-header">
        <svg class="week-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        <span class="week-label">${isCurrent ? 'This Week' : `W${group.week}`}</span>
        <span class="week-badge">${doneCount}/${totalCount}</span>
      </div>
      <div class="week-tasks">
        <div style="font-size:0.72rem;color:var(--text-3);padding:0 8px 4px;font-family:var(--mono)">${range}</div>
        ${group.tasks.map(t => `
          <div class="week-task">
            <span class="week-task-icon ${t.status === 'done' ? 'done' : 'pending'}">
              ${t.status === 'done'
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'
              }
            </span>
            <span class="week-task-name">${escapeHtml(t.title)}</span>
          </div>
        `).join('')}
      </div>
    `;

    weekEl.querySelector('.week-header').addEventListener('click', () => {
      weekEl.classList.toggle('expanded');
    });

    dom.weeksList.appendChild(weekEl);
  });
}

// ---- Recent Activity ----
function renderActivity() {
  const recent = tasks
    .filter(t => t.status === 'done' && t.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 8);

  dom.activityList.innerHTML = '';

  if (recent.length === 0) {
    dom.activityList.innerHTML = '<div class="empty-state"><span>No completed tasks</span></div>';
    return;
  }

  recent.forEach(task => {
    const el = document.createElement('div');
    el.className = 'activity-item';
    el.innerHTML = `
      <div class="activity-dot"></div>
      <div class="activity-info">
        <div class="activity-title">${escapeHtml(task.title)}</div>
        <div class="activity-time">${formatTime(task.completedAt)}</div>
      </div>
    `;
    dom.activityList.appendChild(el);
  });
}

// ---- Modal ----
function openModal() {
  dom.modal.classList.remove('hidden');
  dom.taskTitle.focus();
}

function closeModal() {
  dom.modal.classList.add('hidden');
  dom.taskForm.reset();
}

// ---- Event Listeners ----
function init() {
  // Auth
  dom.authBtn.addEventListener('click', () => {
    const key = dom.apiKeyInput.value.trim();
    if (!key) return;
    dom.authBtn.disabled = true;
    dom.authBtn.textContent = '';
    dom.authBtn.innerHTML = '<span class="spinner"></span>';
    authenticate(key).catch(() => {}).finally(() => {
      dom.authBtn.disabled = false;
      dom.authBtn.textContent = 'Continue';
    });
  });

  dom.apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') dom.authBtn.click();
  });

  dom.apiKeyInput.addEventListener('input', () => {
    dom.authError.classList.add('hidden');
  });

  // Logout
  dom.logoutBtn.addEventListener('click', logout);

  // Refresh
  dom.refreshBtn.addEventListener('click', () => {
    dom.refreshBtn.disabled = true;
    loadTasks().finally(() => {
      dom.refreshBtn.disabled = false;
    });
  });

  // Modal
  dom.newTaskBtn.addEventListener('click', openModal);
  dom.modalClose.addEventListener('click', closeModal);
  dom.modalCancel.addEventListener('click', closeModal);
  dom.modalBackdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dom.modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Task form
  dom.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = dom.taskTitle.value.trim();
    if (!title) return;

    createTask({
      title,
      description: dom.taskDesc.value.trim(),
      category: dom.taskCategory.value,
      status: dom.taskStatus.value,
      agent: 'manual',
    });

    closeModal();
  });

  // Auto-login if key exists
  if (apiKey) {
    showDashboard();
    loadTasks();
  }
}

document.addEventListener('DOMContentLoaded', init);
