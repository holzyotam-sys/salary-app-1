'use client';

import { useState } from 'react';

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatMoney(value: number): string {
  return `₪${value.toFixed(2)}`;
}

export default function Home() {
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('17:00');

  const hourlyRate = 50;

  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);

  let totalMinutes = endMinutes - startMinutes;

  // טיפול במקרה של חציית חצות
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  const totalHours = totalMinutes / 60;

  let regularHours = Math.min(totalHours, 8);
  let extra125 = Math.max(Math.min(totalHours - 8, 2), 0);
  let extra150 = Math.max(totalHours - 10, 0);

  const salary =
    regularHours * hourlyRate +
    extra125 * hourlyRate * 1.25 +
    extra150 * hourlyRate * 1.5;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#f5f5f5',
      }}
    >
      <div
        style={{
          width: 340,
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        }}
      >
        <h1 style={{ textAlign: 'center', marginBottom: 20 }}>
          Work Calculator
        </h1>

        <label>Start Time</label>
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />

        <label>End Time</label>
        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          style={{ width: '100%', marginBottom: 20 }}
        />

        <div style={{ fontSize: 16 }}>
          <p>Total Hours: {totalHours.toFixed(2)}</p>
          <p>Regular: {regularHours.toFixed(2)}</p>
          <p>125%: {extra125.toFixed(2)}</p>
          <p>150%: {extra150.toFixed(2)}</p>
        </div>

        <h2 style={{ marginTop: 20 }}>
          Salary: {formatMoney(salary)}
        </h2>
      </div>
    </div>
  );
}