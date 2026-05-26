// End-to-end dry-run against a running TaskFlow API.
// Wipes the `tasks` collection, then exercises every spec point including the
// optional stats endpoint. Run after `node src/index.js` is up.
import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const BASE = process.env.API_BASE || 'http://localhost:4100';
const URI = process.env.MONGODB_URI;

let pass = 0, fail = 0;
const fails = [];
const ok = (n) => { pass++; console.log(`  ✓ ${n}`); };
const bad = (n, why) => { fail++; fails.push({ n, why }); console.log(`  ✗ ${n}\n      ${why}`); };

async function hit(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let json = null;
  try { json = txt ? JSON.parse(txt) : null; } catch {}
  return { status: r.status, body: json };
}

function approxEqual(a, b, tol = 0.01) {
  return Math.abs(a - b) <= tol;
}

async function run() {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 8000 });
  await mongoose.connection.db.collection('tasks').deleteMany({});
  console.log('\n==> tasks collection wiped');

  // ---------- empty state ----------
  console.log('\n[1] empty list');
  {
    const r = await hit('GET', '/bfhl/tasks');
    if (r.status === 200 && Array.isArray(r.body) && r.body.length === 0) ok('GET returns 200 + []');
    else bad('GET 200 + []', `${r.status} ${JSON.stringify(r.body)}`);
  }

  // ---------- POST validation ----------
  console.log('\n[2] POST validation');
  {
    const r = await hit('POST', '/bfhl/tasks', {});
    r.status === 400 ? ok('empty body → 400') : bad('empty body → 400', `${r.status}`);
  }
  {
    const r = await hit('POST', '/bfhl/tasks', {
      title: 'ab', importance: 3, dueDate: new Date(Date.now() + 86400000).toISOString(),
    });
    r.status === 400 ? ok('title <3 chars → 400') : bad('title <3 → 400', `${r.status}`);
  }
  {
    const r = await hit('POST', '/bfhl/tasks', {
      title: 'good', importance: 7, dueDate: new Date(Date.now() + 86400000).toISOString(),
    });
    r.status === 400 ? ok('importance>5 → 400') : bad('importance>5 → 400', `${r.status}`);
  }
  {
    const r = await hit('POST', '/bfhl/tasks', {
      title: 'good', importance: 3, dueDate: new Date(Date.now() - 86400000).toISOString(),
    });
    r.status === 400 ? ok('past dueDate → 400') : bad('past dueDate → 400', `${r.status}`);
  }
  {
    const r = await hit('POST', '/bfhl/tasks', {
      title: 'good', importance: 3.5, dueDate: new Date(Date.now() + 86400000).toISOString(),
    });
    r.status === 400 ? ok('non-integer importance → 400') : bad('non-integer importance → 400', `${r.status}`);
  }

  // ---------- POST happy paths + score math ----------
  console.log('\n[3] POST + priorityScore math');
  const due3d = new Date(Date.now() + 3 * 86400000 + 60000).toISOString(); // 3+ days
  const created = [];

  {
    const r = await hit('POST', '/bfhl/tasks', {
      title: 'Submit report', description: 'final draft', importance: 5, dueDate: due3d,
    });
    if (r.status !== 201) bad('create 201', `${r.status} ${JSON.stringify(r.body)}`);
    else {
      ok('create returns 201');
      created.push(r.body);
      // importance=5, days≈3 → 50 + 100/3 ≈ 83.33
      if (approxEqual(r.body.priorityScore, 83.33, 0.5)) ok('score matches formula (~83.33)');
      else bad('score ~83.33', `got ${r.body.priorityScore}`);
      // confirm 2-decimal rounding
      const s = r.body.priorityScore.toString();
      const decimals = (s.split('.')[1] || '').length;
      if (decimals <= 2) ok('score rounded to ≤2 decimals');
      else bad('rounded ≤2 decimals', `got ${s}`);
    }
  }
  {
    // Pad by an extra 12h so server-side Math.floor lands on exactly 10 days.
    const r = await hit('POST', '/bfhl/tasks', {
      title: 'Buy groceries', importance: 1,
      dueDate: new Date(Date.now() + 10 * 86400000 + 12 * 3600 * 1000).toISOString(),
    });
    if (r.status === 201) {
      created.push(r.body);
      // importance=1, days=10 → 10 + 10 = 20
      if (approxEqual(r.body.priorityScore, 20, 0.5)) ok('low priority + far due → ~20');
      else bad('low+far ~20', `got ${r.body.priorityScore}`);
    } else bad('create low-priority', `${r.status}`);
  }
  {
    const r = await hit('POST', '/bfhl/tasks', {
      title: 'Critical alert', importance: 5,
      dueDate: new Date(Date.now() + 6 * 3600 * 1000).toISOString(), // 6h => 0 days → clamp 1
    });
    if (r.status === 201) {
      created.push(r.body);
      // importance=5, days clamped to 1 → 50 + 100 = 150
      if (approxEqual(r.body.priorityScore, 150, 0.5)) ok('sub-day due clamps daysUntil to 1 → 150');
      else bad('clamp days→1', `got ${r.body.priorityScore}`);
    } else bad('create urgent', `${r.status}`);
  }

  // ---------- sorting ----------
  console.log('\n[4] sorting & filters');
  {
    const r = await hit('GET', '/bfhl/tasks');
    const arr = r.body || [];
    const sorted = arr.every((t, i) => i === 0 || arr[i - 1].priorityScore >= t.priorityScore);
    sorted ? ok('list sorted by priorityScore DESC') : bad('sorted DESC', JSON.stringify(arr.map(t => t.priorityScore)));
  }
  {
    const r = await hit('GET', '/bfhl/tasks?minImportance=3');
    if (r.status === 200 && r.body.every((t) => t.importance >= 3)) ok('?minImportance=3 filter');
    else bad('?minImportance=3', JSON.stringify(r.body));
  }
  {
    const r = await hit('GET', '/bfhl/tasks?status=pending&minImportance=4');
    if (r.status === 200 && r.body.every((t) => t.status === 'pending' && t.importance >= 4)) ok('combined filters');
    else bad('combined filters', JSON.stringify(r.body));
  }
  {
    const r = await hit('GET', '/bfhl/tasks?status=garbage');
    r.status === 400 ? ok('invalid status filter → 400') : bad('invalid status filter → 400', `${r.status}`);
  }
  {
    const r = await hit('GET', '/bfhl/tasks?minImportance=10');
    r.status === 400 ? ok('minImportance out of range → 400') : bad('minImportance out of range → 400', `${r.status}`);
  }

  // ---------- PATCH ----------
  console.log('\n[5] PATCH behavior');
  const reportId = created[0]._id;
  {
    const r = await hit('PATCH', `/bfhl/tasks/${reportId}`, { status: 'completed' });
    if (r.status === 200 && r.body.status === 'completed' && r.body.priorityScore === 0) ok('mark complete → score=0');
    else bad('complete → score=0', `${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    const r = await hit('PATCH', `/bfhl/tasks/${reportId}`, { status: 'pending' });
    if (r.status === 200 && r.body.priorityScore > 0) ok('uncomplete → score restored');
    else bad('uncomplete → score restored', JSON.stringify(r.body));
  }
  {
    const r = await hit('PATCH', `/bfhl/tasks/${reportId}`, { importance: 9 });
    r.status === 400 ? ok('PATCH bad importance → 400') : bad('PATCH bad importance → 400', `${r.status}`);
  }
  {
    const r = await hit('PATCH', `/bfhl/tasks/000000000000000000000000`, { importance: 3 });
    r.status === 404 ? ok('PATCH missing id → 404') : bad('PATCH missing id → 404', `${r.status}`);
  }
  {
    const r = await hit('PATCH', `/bfhl/tasks/not-an-id`, { importance: 3 });
    r.status === 400 ? ok('PATCH malformed id → 400') : bad('PATCH malformed id → 400', `${r.status}`);
  }
  {
    const r = await hit('PATCH', `/bfhl/tasks/${reportId}`, { not_a_field: 'x' });
    r.status === 400 ? ok('PATCH unknown field → 400') : bad('PATCH unknown field → 400', `${r.status}`);
  }

  // ---------- DELETE ----------
  console.log('\n[6] DELETE behavior');
  {
    const r = await hit('DELETE', `/bfhl/tasks/${created[1]._id}`);
    r.status === 204 ? ok('DELETE → 204') : bad('DELETE → 204', `${r.status}`);
  }
  {
    const r = await hit('DELETE', `/bfhl/tasks/${created[1]._id}`);
    r.status === 404 ? ok('re-DELETE → 404') : bad('re-DELETE → 404', `${r.status}`);
  }
  {
    const r = await hit('DELETE', `/bfhl/tasks/not-an-id`);
    r.status === 400 ? ok('DELETE malformed → 400') : bad('DELETE malformed → 400', `${r.status}`);
  }

  // ---------- stats bonus ----------
  console.log('\n[7] /bfhl/tasks/stats (bonus, aggregation)');
  {
    const r = await hit('GET', '/bfhl/tasks/stats');
    if (r.status === 200) {
      const keys = ['totalTasks', 'pendingTasks', 'completedTasks', 'averageImportance', 'overdueTasks', 'tasksByImportance'];
      const missing = keys.filter((k) => !(k in r.body));
      missing.length === 0 ? ok('stats shape includes all required keys') : bad('stats shape', `missing ${missing.join(',')}`);
      const tbi = r.body.tasksByImportance;
      if (tbi && [1,2,3,4,5].every((k) => k in tbi || String(k) in tbi)) ok('tasksByImportance covers buckets 1-5');
      else bad('tasksByImportance buckets', JSON.stringify(tbi));
    } else bad('stats status', `${r.status}`);
  }

  console.log(`\n==> ${pass} passed, ${fail} failed`);
  if (fails.length) {
    console.log('\nFailures:');
    fails.forEach((f) => console.log(`  - ${f.n}: ${f.why}`));
  }

  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

run().catch((e) => { console.error('fatal:', e); process.exit(2); });
