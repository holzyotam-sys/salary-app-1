"use client";

import { useState } from "react";

export default function Home() {
  const [minutes, setMinutes] = useState<number>(0);

  function formatMoney(value: number): string {
    return `₪${Number(value || 0).toFixed(2)}`;
  }

  function formatHoursFromMinutes(minutes: number): string {
    return (minutes / 60).toFixed(2);
  }

  const hourlyRate = 50; // תעריף לדוגמה

  const hours = Number(formatHoursFromMinutes(minutes));
  const salary = hours * hourlyRate;

  return (
    <main style={{ padding: 20 }}>
      <h1>Salary Calculator</h1>

      <input
        type="number"
        placeholder="Enter minutes"
        value={minutes}
        onChange={(e) => setMinutes(Number(e.target.value))}
        style={{ padding: 10, fontSize: 16 }}
      />

      <div style={{ marginTop: 20 }}>
        <p>Hours: {hours}</p>
        <p>Salary: {formatMoney(salary)}</p>
      </div>
    </main>
  );
}"use client";

import { useState } from "react";

export default function Home() {
  const [minutes, setMinutes] = useState<number>(0);

  function formatMoney(value: number): string {
    return `₪${Number(value || 0).toFixed(2)}`;
  }

  function formatHoursFromMinutes(minutes: number): string {
    return (minutes / 60).toFixed(2);
  }

  const hourlyRate = 50; // תעריף לדוגמה

  const hours = Number(formatHoursFromMinutes(minutes));
  const salary = hours * hourlyRate;

  return (
    <main style={{ padding: 20 }}>
      <h1>Salary Calculator</h1>

      <input
        type="number"
        placeholder="Enter minutes"
        value={minutes}
        onChange={(e) => setMinutes(Number(e.target.value))}
        style={{ padding: 10, fontSize: 16 }}
      />

      <div style={{ marginTop: 20 }}>
        <p>Hours: {hours}</p>
        <p>Salary: {formatMoney(salary)}</p>
      </div>
    </main>
  );
}