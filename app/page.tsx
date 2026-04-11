'use client';

import { useState } from 'react';

function formatMoney(value: number): string {
  return `₪${value.toFixed(2)}`;
}

export default function Home() {
  const [minutes, setMinutes] = useState<number>(0);

  const hourlyRate = 50;
  const hours = minutes / 60;
  const salary = hours * hourlyRate;

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
          width: 320,
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ marginBottom: 20 }}>Salary Calculator</h1>

        <input
          type="number"
          placeholder="Enter minutes"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          style={{
            width: '100%',
            padding: 10,
            marginBottom: 20,
            borderRadius: 8,
            border: '1px solid #ccc',
          }}
        />

        <p>Hours: {hours.toFixed(2)}</p>
        <p style={{ fontWeight: 'bold' }}>
          Salary: {formatMoney(salary)}
        </p>
      </div>
    </div>
  );
}