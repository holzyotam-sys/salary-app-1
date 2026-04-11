'use client';

import { useState } from 'react';

function formatMoney(value: number): string {
  return `₪${Number(value || 0).toFixed(2)}`;
}

function formatHoursFromMinutes(minutes: number): number {
  return minutes / 60;
}

export default function Home() {
  const [minutes, setMinutes] = useState<number>(0);

  const hourlyRate = 50;
  const hours = formatHoursFromMinutes(minutes);
  const salary = hours * hourlyRate;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#f5f5f5',
        direction: 'ltr',
      }}
    >
      <main
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          textAlign: 'left',
          boxSizing: 'border-box',
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
          }}
        />

        <div style={{ marginTop: 20 }}>
          <p style={{ margin: '0 0 10px 0', fontSize: 18 }}>
            Hours: {hours.toFixed(2)}
          </p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Salary: {formatMoney(salary)}
          </p>
        </div>
      </main>
    </div>
  );
}