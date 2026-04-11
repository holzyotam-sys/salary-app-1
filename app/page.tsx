'use client';

import { useState } from 'react';

function formatMoney(value: number): string {
  return `₪${Number(value || 0).toFixed(2)}`;
}

export default function Home() {
  const [minutes, setMinutes] = useState<number>(0);

  const hourlyRate = 50;
  const hours = minutes / 60;
  const salary = hours * hourlyRate;

  return (
    <main className="page-shell">
      <section className="card">
        <h1 className="title">Salary Calculator</h1>

        <input
          className="minutes-input"
          type="number"
          placeholder="Enter minutes"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        />

        <div className="results">
          <p>Hours: {hours.toFixed(2)}</p>
          <p>Salary: {formatMoney(salary)}</p>
        </div>
      </section>
    </main>
  );
}