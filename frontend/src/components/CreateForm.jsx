import React, { useState } from 'react';

const EMPTY = { title: '', description: '', importance: 3, dueDate: '' };

// dueDate is a "datetime-local" input; we need a default just-now-ish min.
function nowLocal() {
  const d = new Date(Date.now() + 60 * 1000); // 1 min in the future
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateForm({ onCreate }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function validate() {
    const e = {};
    const t = form.title.trim();
    if (t.length < 3 || t.length > 100) e.title = 'Title must be 3-100 characters';
    if (form.description.length > 500) e.description = 'Description too long (500 max)';
    const imp = Number(form.importance);
    if (!Number.isInteger(imp) || imp < 1 || imp > 5) e.importance = 'Importance must be 1-5';
    if (!form.dueDate) e.dueDate = 'Pick a due date';
    else if (new Date(form.dueDate).getTime() <= Date.now()) e.dueDate = 'Due date must be in the future';
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);

    setBusy(true);
    try {
      await onCreate({
        title: form.title.trim(),
        description: form.description.trim(),
        importance: Number(form.importance),
        dueDate: new Date(form.dueDate).toISOString(),
      });
      setForm(EMPTY);
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      else setErrors({ _form: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="create-form" onSubmit={submit} noValidate>
      <h2>New Task</h2>

      <label className="row">
        <span>Title</span>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="What needs doing?"
        />
        {errors.title && <small className="err">{errors.title}</small>}
      </label>

      <label className="row">
        <span>Description</span>
        <textarea
          rows={2}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Optional context"
        />
        {errors.description && <small className="err">{errors.description}</small>}
      </label>

      <div className="row-2col">
        <label className="row">
          <span>Importance ({form.importance})</span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={form.importance}
            onChange={(e) => set('importance', Number(e.target.value))}
          />
          {errors.importance && <small className="err">{errors.importance}</small>}
        </label>

        <label className="row">
          <span>Due date</span>
          <input
            type="datetime-local"
            min={nowLocal()}
            value={form.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
          />
          {errors.dueDate && <small className="err">{errors.dueDate}</small>}
        </label>
      </div>

      {errors._form && <div className="err banner">{errors._form}</div>}

      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Creating…' : 'Add task'}
      </button>
    </form>
  );
}
