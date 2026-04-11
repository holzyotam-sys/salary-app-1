"use client";
import { useState, useEffect } from "react";

type Shift = {
  start: number;
  end: number;
  salaryPerHour: number;
  note: string;
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
    const working = localStorage.getItem("working");

    if (saved) setShifts(JSON.parse(saved));
    if (working) {
      const parsed = JSON.parse(working);
      setIsWorking(true);
      setStartTime(parsed.start);
      setSalary(parsed.salary);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("shifts", JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    if (isWorking && startTime) {
      localStorage.setItem(
        "working",
        JSON.stringify({ start: startTime, salary })
      );
    } else {
      localStorage.removeItem("working");
    }
  }, [isWorking, startTime, salary]);

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

  const calc = (start: number, end: number, rate: number) => {
    const hours = (end - start) / 1000 / 60 / 60;
    return hours * rate;
  };

  const liveMoney =
    isWorking && startTime
      ? calc(startTime, now, salary).toFixed(2)
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

      <h2>💰 כסף בזמן אמת: ₪{liveMoney}</h2>

      <h2>משמרות</h2>

      {shifts.length === 0 && <p>אין עדיין משמרות</p>}

      {shifts.map((shift, i) => {
        const money = calc(shift.start, shift.end, shift.salaryPerHour);

        return (
          <div key={i} style={{ border: "1px solid black", margin: 10, padding: 10 }}>
            <p>
              {new Date(shift.start).toLocaleTimeString()} →
              {new Date(shift.end).toLocaleTimeString()}
            </p>
            <p>שכר: ₪{money.toFixed(2)}</p>
            <p>תעריף: ₪{shift.salaryPerHour}</p>
            <p>הערות: {shift.note}</p>
          </div>
        );
      })}
    </main>
  );
}