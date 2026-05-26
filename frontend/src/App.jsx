import React, { useCallback, useEffect, useState } from 'react';
import TaskCard from './components/TaskCard.jsx';
import Filters from './components/Filters.jsx';
import CreateForm from './components/CreateForm.jsx';
import Stats from './components/Stats.jsx';
import * as api from './api.js';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ status: null, minImportance: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, s] = await Promise.all([
        api.listTasks({
          status: filters.status || undefined,
          minImportance: filters.minImportance || undefined,
        }),
        api.getStats().catch(() => null),
      ]);
      setTasks(list);
      setStats(s);
    } catch (e) {
      setError(e.message || 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.minImportance]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(payload) {
    await api.createTask(payload);
    await refresh();
  }

  async function handleComplete(task) {
    try {
      await api.updateTask(task._id, { status: 'completed' });
      await refresh();
    } catch (e) {
      flashError(e.message);
    }
  }

  async function handleDelete(task) {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      await api.removeTask(task._id);
      await refresh();
    } catch (e) {
      flashError(e.message);
    }
  }

  function flashError(msg) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  const empty = !loading && tasks.length === 0;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>TaskFlow</h1>
          <p className="sub">Smart task manager with priority scoring</p>
        </div>
      </header>

      <Stats stats={stats} />

      <div className="grid">
        <aside className="sidebar">
          <CreateForm onCreate={handleCreate} />
          <Filters value={filters} onChange={setFilters} />
        </aside>

        <main className="main">
          {error && <div className="banner err">{error}</div>}

          {loading && tasks.length === 0 && (
            <div className="placeholder">Loading tasks…</div>
          )}

          {empty && (
            <div className="placeholder">
              <p>No tasks match the current filters.</p>
              <small>Create one on the left, or relax the filters.</small>
            </div>
          )}

          {!empty && (
            <ul className="task-list">
              {tasks.map((t) => (
                <TaskCard key={t._id} task={t} onComplete={handleComplete} onDelete={handleDelete} />
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
