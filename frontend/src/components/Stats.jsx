import React from 'react';

export default function Stats({ stats }) {
  if (!stats) return null;
  const buckets = [1, 2, 3, 4, 5];
  return (
    <section className="stats-card">
      <div className="stats-row">
        <Stat label="Total" value={stats.totalTasks} />
        <Stat label="Pending" value={stats.pendingTasks} />
        <Stat label="Completed" value={stats.completedTasks} />
        <Stat label="Overdue" value={stats.overdueTasks} accent="warn" />
        <Stat label="Avg. importance" value={stats.averageImportance?.toFixed(2) ?? '—'} />
      </div>
      <div className="stats-bars">
        {buckets.map((b) => {
          const count = stats.tasksByImportance?.[b] ?? 0;
          const total = stats.totalTasks || 1;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={b} className="bar-row">
              <span className="bar-label">{'★'.repeat(b)}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="bar-count">{count}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className={`stat ${accent ? `stat-${accent}` : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
