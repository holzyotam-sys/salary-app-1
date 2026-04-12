"use client";

import { useState, useEffect } from "react";
import { calculateNetSalary } from "@/lib/netSalary";

type Shift = {
  start: string;
  end: string;
  note: string;
};

function formatMoney(num: number) {
  return `₪${num.toFixed(2)}`;
}

export default function Page() {
  const [hourly, setHourly] = useState(50);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [working, setWorking] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [money, setMoney] = useState(0);
  const [note, setNote] = useState("");

  // ⏱️ סטופר כסף
  useEffect(() => {
    let interval: any;

    if (working && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const hours = (now - startTime) / (1000 * 60 * 60);
        setMoney(hours * hourly);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [working, startTime, hourly]);

  function handleStart() {
    setWorking(true);
    setStartTime(Date.now());
  }

  function handleStop() {
    if (!startTime) return;

    const end = Date.now();
    const newShift: Shift = {
      start: new Date(startTime).toISOString(),
      end: new Date(end).toISOString(),
      note,
    };

    setShifts([newShift, ...shifts]);
    setWorking(false);
    setStartTime(null);
    setMoney(0);
    setNote("");
  }

  function calculateShiftPay(shift: Shift) {
    const start = new Date(shift.start).getTime();
    const end = new Date(shift.end).getTime();
    const hours = (end - start) / (1000 * 60 * 60);

    return hours * hourly;
  }

  return (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <h1>Work Tracker</h1>

      <input
        type="number"
        value={hourly}
        onChange={(e) => setHourly(Number(e.target.value))}
      />

      <br /><br />

      {!working ? (
        <button onClick={handleStart}>כניסה</button>
      ) : (
        <button onClick={handleStop}>יציאה</button>
      )}

      <br /><br />

      <textarea
        placeholder="הערות למשמרת"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <h2>💰 כסף בזמן אמת: {formatMoney(money)}</h2>

      <hr />

      <h3>משמרות</h3>

      {shifts.map((shift, i) => {
        const gross = calculateShiftPay(shift);

        const net = calculateNetSalary(gross, {
          creditPoints: 2.25,
          pensionPercent: 6,
          trainingFundPercent: 2.5,
        });

        return (
          <div key={i} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <p>
              {new Date(shift.start).toLocaleString()} →{" "}
              {new Date(shift.end).toLocaleString()}
            </p>

            <p>שכר ברוטו: {formatMoney(gross)}</p>

            <p>מס הכנסה: {formatMoney(net.incomeTax)}</p>
            <p>ביטוח לאומי: {formatMoney(net.bituach)}</p>
            <p>פנסיה: {formatMoney(net.pension)}</p>
            <p>השתלמות: {formatMoney(net.training)}</p>

            <p><b>נטו: {formatMoney(net.net)}</b></p>

            <p>הערות: {shift.note}</p>
          </div>
        );
      })}
    </div>
  );
}