// Priority scoring for tasks.
// Formula (per spec):
//   completed   -> 0
//   otherwise   -> (importance * 10) + (100 / max(daysUntilDue, 1))
//
// daysUntilDue is the count of whole days between now and the due date,
// floored. Due dates already in the past clamp the divisor to 1 so we
// don't blow up on division by zero or end up with negative scores.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(dueDate, now = new Date()) {
  const diff = new Date(dueDate).getTime() - now.getTime();
  return Math.floor(diff / ONE_DAY_MS);
}

export function priorityScoreFor(task, now = new Date()) {
  if (task.status === 'completed') return 0;
  const d = Math.max(daysUntil(task.dueDate, now), 1);
  const raw = task.importance * 10 + 100 / d;
  // Spec says rounded to 2 decimals. Math.round handles standard rounding.
  return Math.round(raw * 100) / 100;
}
