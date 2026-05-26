// Tiny formatting helpers for the UI. Kept dumb on purpose.

const MS_DAY = 24 * 60 * 60 * 1000;

export function dueIn(dueDate) {
  if (!dueDate) return '—';
  const diff = new Date(dueDate).getTime() - Date.now();
  const days = Math.round(diff / MS_DAY);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function isOverdue(task) {
  return task.status === 'pending' && new Date(task.dueDate).getTime() < Date.now();
}

// e.g. "★★★☆☆" — five-slot stars based on importance.
export function stars(n) {
  const full = '★'.repeat(n);
  const empty = '☆'.repeat(5 - n);
  return full + empty;
}
