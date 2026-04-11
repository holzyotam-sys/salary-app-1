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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#f5f5f5',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          boxSizing: 'border-box',
          textAlign: 'left',
          direction: 'ltr',
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: 20,
            fontSize: 28,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          Salary Calculator
        </h1>

        <input
          type="number"
          placeholder="Enter minutes"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 12,
            fontSize: 16,
            border: '1px solid #cfcfcf',
            borderRadius: 10,
            outline: 'none',
            marginBottom: 20,
          }}
        />

        <p style={{ margin: '0 0 10px 0', fontSize: 18 }}>
          Hours: {hours.toFixed(2)}
        </p>

        <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          Salary: {formatMoney(salary)}
        </p>
      </div>
    </div>
  );
}