import React from 'react';

export default function Filters({ value, onChange }) {
  return (
    <div className="filters">
      <label className="filter">
        <span>Status</span>
        <select
          value={value.status || ''}
          onChange={(e) => onChange({ ...value, status: e.target.value || null })}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </label>

      <label className="filter">
        <span>Min importance</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value.minImportance || 1}
          onChange={(e) => onChange({ ...value, minImportance: Number(e.target.value) })}
        />
        <span className="filter-value">{value.minImportance || 1}+</span>
      </label>

      <button
        className="btn btn-ghost"
        onClick={() => onChange({ status: null, minImportance: null })}
        title="Reset filters"
      >
        Reset
      </button>
    </div>
  );
}
