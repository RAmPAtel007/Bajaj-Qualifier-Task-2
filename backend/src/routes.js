import { Router } from 'express';
import mongoose from 'mongoose';
import { Task } from './Task.js';
import { priorityScoreFor } from './score.js';

export const bfhl = Router();

// Reusable helper that turns a Task document into the wire shape (with score).
const shape = (doc, now) => {
  const json = doc.toObject({ versionKey: false });
  json.priorityScore = priorityScoreFor(json, now);
  return json;
};

// Turn a mongoose validation error into a flat 400 payload that's actually useful.
function fromMongooseError(err) {
  const fields = {};
  for (const k of Object.keys(err.errors || {})) {
    fields[k] = err.errors[k].message;
  }
  // Pick the first field message as the top-level so the FE can show something.
  const first = Object.values(fields)[0];
  return { error: first || 'invalid input', fields };
}

// Quick guard for the bits we don't want Mongoose to bail on silently.
function preflightCreate(body) {
  const errs = {};
  if (!body || typeof body !== 'object') return { error: 'body must be a JSON object' };

  if (body.title === undefined || body.title === null) errs.title = 'title is required';
  else if (typeof body.title !== 'string') errs.title = 'title must be a string';
  else if (body.title.trim().length < 3 || body.title.trim().length > 100) errs.title = 'title must be 3-100 characters';

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') errs.description = 'description must be a string';
    else if (body.description.length > 500) errs.description = 'description cannot exceed 500 characters';
  }

  if (body.importance === undefined || body.importance === null) {
    errs.importance = 'importance is required';
  } else if (typeof body.importance !== 'number' || !Number.isInteger(body.importance)) {
    errs.importance = 'importance must be an integer';
  } else if (body.importance < 1 || body.importance > 5) {
    errs.importance = 'importance must be between 1 and 5';
  }

  if (!body.dueDate) {
    errs.dueDate = 'dueDate is required';
  } else {
    const d = new Date(body.dueDate);
    if (Number.isNaN(d.getTime())) {
      errs.dueDate = 'dueDate must be a valid date';
    } else if (d.getTime() <= Date.now()) {
      errs.dueDate = 'dueDate must be in the future';
    }
  }

  if (body.status !== undefined && !['pending', 'completed'].includes(body.status)) {
    errs.status = "status must be 'pending' or 'completed'";
  }

  return Object.keys(errs).length ? { error: Object.values(errs)[0], fields: errs } : null;
}

// ---- POST /bfhl/tasks ----
bfhl.post('/tasks', async (req, res, next) => {
  try {
    const issues = preflightCreate(req.body);
    if (issues) return res.status(400).json(issues);

    const doc = await Task.create({
      title: req.body.title.trim(),
      description: (req.body.description ?? '').trim(),
      importance: req.body.importance,
      dueDate: new Date(req.body.dueDate),
      ...(req.body.status ? { status: req.body.status } : {}),
    });
    return res.status(201).json(shape(doc, new Date()));
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json(fromMongooseError(err));
    next(err);
  }
});

// ---- GET /bfhl/tasks ----
// Filters: ?status=pending|completed   ?minImportance=1..5
// Sorted by computed priorityScore DESC (in JS — Mongo can't sort by a non-stored field).
bfhl.get('/tasks', async (req, res, next) => {
  try {
    const where = {};
    const { status, minImportance } = req.query;

    if (status !== undefined) {
      if (!['pending', 'completed'].includes(status)) {
        return res.status(400).json({ error: "status filter must be 'pending' or 'completed'" });
      }
      where.status = status;
    }

    if (minImportance !== undefined) {
      const n = Number(minImportance);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return res.status(400).json({ error: 'minImportance must be an integer 1-5' });
      }
      where.importance = { $gte: n };
    }

    const docs = await Task.find(where);
    const now = new Date();
    const list = docs.map((d) => shape(d, now));
    list.sort((a, b) => b.priorityScore - a.priorityScore);
    return res.json(list);
  } catch (err) {
    next(err);
  }
});

// ---- GET /bfhl/tasks/stats (bonus) ----
// Uses MongoDB aggregation: $facet to compute multiple buckets in one round trip.
bfhl.get('/tasks/stats', async (_req, res, next) => {
  try {
    const now = new Date();
    const [agg] = await Task.aggregate([
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalTasks: { $sum: 1 },
                pendingTasks: {
                  $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
                },
                completedTasks: {
                  $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
                },
                averageImportance: { $avg: '$importance' },
                overdueTasks: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$status', 'pending'] },
                          { $lt: ['$dueDate', now] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          byImportance: [
            { $group: { _id: '$importance', count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    const t = agg?.totals?.[0] || {};
    const tasksByImportance = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of agg?.byImportance || []) {
      tasksByImportance[row._id] = row.count;
    }

    return res.json({
      totalTasks: t.totalTasks || 0,
      pendingTasks: t.pendingTasks || 0,
      completedTasks: t.completedTasks || 0,
      averageImportance: t.averageImportance ? Math.round(t.averageImportance * 100) / 100 : 0,
      overdueTasks: t.overdueTasks || 0,
      tasksByImportance,
    });
  } catch (err) {
    next(err);
  }
});

// ---- PATCH /bfhl/tasks/:id ----
bfhl.patch('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'malformed id' });
    }

    const allowed = ['title', 'description', 'importance', 'dueDate', 'status'];
    const patch = {};
    for (const k of Object.keys(req.body || {})) {
      if (!allowed.includes(k)) {
        return res.status(400).json({ error: `field not editable: ${k}` });
      }
      patch[k] = req.body[k];
    }

    if (patch.dueDate !== undefined) {
      const d = new Date(patch.dueDate);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: 'dueDate must be a valid date' });
      }
      patch.dueDate = d;
    }

    const doc = await Task.findById(id);
    if (!doc) return res.status(404).json({ error: 'task not found' });

    Object.assign(doc, patch);
    await doc.save();
    return res.json(shape(doc, new Date()));
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json(fromMongooseError(err));
    next(err);
  }
});

// ---- DELETE /bfhl/tasks/:id ----
bfhl.delete('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'malformed id' });
    }
    const gone = await Task.findByIdAndDelete(id);
    if (!gone) return res.status(404).json({ error: 'task not found' });
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
});
