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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // עריכה
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editSalary, setEditSalary] = useState(50);
  const [editNote, setEditNote] = useState("");

  // הוספה ידנית
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");

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
    return {
      hours,
      total: hours * shift.salaryPerHour,
    };
  };

  const liveMoney =
    isWorking && startTime
      ? (((now - startTime) / 1000 / 60 / 60) * salary).toFixed(2)
      : "0.00";

  const deleteShift = (index: number) => {
    const newShifts = shifts.filter((_, i) => i !== index);
    setShifts(newShifts);
  };

  const startEdit = (shift: Shift, index: number) => {
    setEditingIndex(index);
    setEditStart(new Date(shift.start).toISOString().slice(0, 16));
    setEditEnd(new Date(shift.end).toISOString().slice(0, 16));
    setEditSalary(shift.salaryPerHour);
    setEditNote(shift.note);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;

    const updated = [...shifts];
    updated[editingIndex] = {
      start: new Date(editStart).getTime(),
      end: new Date(editEnd).getTime(),
      salaryPerHour: editSalary,
      note: editNote,
    };

    setShifts(updated);
    setEditingIndex(null);
  };

  const addManualShift = () => {
    if (!manualStart || !manualEnd) return;

    const newShift: Shift = {
      start: new Date(manualStart).getTime(),
      end: new Date(manualEnd).getTime(),
      salaryPerHour: salary,
      note: "ידני",
    };

    setShifts([newShift, ...shifts]);
    setManualStart("");
    setManualEnd("");
  };

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

      <hr />

      <h2>➕ הוספה ידנית</h2>

      <input
        type="datetime-local"
        value={manualStart}
        onChange={(e) => setManualStart(e.target.value)}
      />
      <input
        type="datetime-local"
        value={manualEnd}
        onChange={(e) => setManualEnd(e.target.value)}
      />

      <button onClick={addManualShift}>הוסף</button>

      <hr />

      <h2>משמרות</h2>

      {shifts.map((shift, i) => {
        const c = calcShift(shift);

        if (editingIndex === i) {
          return (
            <div key={i} style={{ border: "2px solid blue", margin: 10, padding: 10 }}>
              <input
                type="datetime-local"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
              />
              <input
                type="datetime-local"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
              />

              <input
                type="number"
                value={editSalary}
                onChange={(e) => setEditSalary(Number(e.target.value))}
              />

              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />

              <button onClick={saveEdit}>שמור</button>
            </div>
          );
        }

        return (
          <div key={i} style={{ border: "1px solid black", margin: 10, padding: 10 }}>
            <p>
              {new Date(shift.start).toLocaleString()} →
              {new Date(shift.end).toLocaleTimeString()}
            </p>

            <p>שעות: {c.hours.toFixed(2)}</p>
            <p>שכר: ₪{c.total.toFixed(2)}</p>
            <p>תעריף: ₪{shift.salaryPerHour}</p>
            <p>הערות: {shift.note}</p>

            <button onClick={() => startEdit(shift, i)}>✏️ ערוך</button>
            <button onClick={() => deleteShift(i)}>🗑 מחק</button>
          </div>
        );
      })}
    </main>
  );
}