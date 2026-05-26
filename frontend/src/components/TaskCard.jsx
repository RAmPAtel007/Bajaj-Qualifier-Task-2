import React from 'react';
import { dueIn, isOverdue, stars } from '../formatters.js';

export default function TaskCard({ task, onComplete, onDelete }) {
  const overdue = isOverdue(task);
  const high = task.priorityScore >= 50;

  return (
    <li className={`task ${high ? 'task-high' : ''} ${overdue ? 'task-overdue' : ''}`}>
      <div className="task-top">
        <h3 className="task-title">{task.title}</h3>
        {high && <span className="badge badge-high">High Priority</span>}
      </div>

      {task.description ? <p className="task-desc">{task.description}</p> : null}

      <div className="task-meta">
        <span className="meta-stars" title={`importance ${task.importance}`}>{stars(task.importance)}</span>
        <span className="meta-sep">·</span>
        <span className={`meta-due ${overdue ? 'is-overdue' : ''}`}>Due {dueIn(task.dueDate)}</span>
        <span className="meta-sep">·</span>
        <span className={`status status-${task.status}`}>{task.status}</span>
        <span className="meta-spacer" />
        <span className="score" title="Computed by the server">
          score <strong>{task.priorityScore.toFixed(2)}</strong>
        </span>
      </div>

      <div className="task-actions">
        {task.status === 'pending' && (
          <button className="btn btn-primary" onClick={() => onComplete(task)}>
            Mark as Complete
          </button>
        )}
        <button className="btn btn-danger-ghost" onClick={() => onDelete(task)}>
          Delete
        </button>
      </div>
    </li>
  );
}
