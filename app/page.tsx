"use client";
import { useState, useEffect } from "react";

type Shift = {
  start: number;
  end: number;
  salaryPerHour: number;
  note: string;
};

const isSaturday = (date: Date) => {
  return date.getDay() === 6;
};

export default function Home() {
  const [salary, setSalary] = useState(50);
  const [note, setNote] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("shifts");
    if (saved) setShifts(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("shifts", JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const startShift = () => {
    setStartTime(Date.now());
    setIsWorking(true);
  };

  const endShift = () => {
    if (!startTime) return;

    const newShift: Shift = {
      start: startTime,
      end: Date.now(),
      salaryPerHour: salary,
      note,
    };

    setShifts([newShift, ...shifts]);
    setIsWorking(false);
    setStartTime(null);
    setNote("");
  };

  const calcShift = (shift: Shift) => {
    const hours = (shift.end - shift.start) / 1000 / 60 / 60;
    const date = new Date(shift.start);

    let multiplier = 1;

    if (isSaturday(date)) {
      multiplier = 1.5;
    }

    let regular = 0;
    let overtime125 = 0;
    let overtime150 = 0;

    if (hours <= 8) {
      regular = hours;
    } else if (hours <= 10) {
      regular = 8;
      overtime125 = hours - 8;
    } else {
      regular = 8;
      overtime125 = 2;
      overtime150 = hours - 10;
    }

    const regPay = regular * shift.salaryPerHour * multiplier;
    const pay125 = overtime125 * shift.salaryPerHour * 1.25 * multiplier;
    const pay150 = overtime150 * shift.salaryPerHour * 1.5 * multiplier;

    return {
      hours,
      regular,
      overtime125,
      overtime150,
      total: regPay + pay125 + pay150,
      isSaturday: isSaturday(date),
    };
  };

  const liveMoney =
    isWorking && startTime
      ? (((now - startTime) / 1000 / 60 / 60) * salary).toFixed(2)
      : "0.00";

  return (
    <main style={{ padding: 40 }}>
      <h1>Work Tracker</h1>

      <input
        type="number"
        value={salary}
        onChange={(e) => setSalary(Number(e.target.value))}
      />

      <br /><br />

      {!isWorking ? (
        <button onClick={startShift}>כניסה</button>
      ) : (
        <button onClick={endShift}>יציאה</button>
      )}

      <br /><br />

      <textarea
        placeholder="הערות למשמרת"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <h2>💰 ₪{liveMoney} כסף בזמן אמת</h2>

      <h2>משמרות</h2>

      {shifts.map((shift, i) => {
        const c = calcShift(shift);

        return (
          <div key={i} style={{ border: "1px solid black", margin: 10, padding: 10 }}>
            <p>
              {new Date(shift.start).toLocaleString()} →
              {new Date(shift.end).toLocaleTimeString()}
            </p>

            {c.isSaturday && <p>🔥 שבת (150%)</p>}

            <p>סה"כ שעות: {c.hours.toFixed(2)}</p>
            <p>רגילות: {c.regular.toFixed(2)}</p>
            <p>125%: {c.overtime125.toFixed(2)}</p>
            <p>150%: {c.overtime150.toFixed(2)}</p>

            <p>שכר: ₪{c.total.toFixed(2)}</p>
            <p>תעריף: ₪{shift.salaryPerHour}</p>
            <p>הערות: {shift.note}</p>
          </div>
        );
      })}
    </main>
  );
}