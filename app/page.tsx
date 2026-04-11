"use client";
import { useState, useEffect } from "react";

type Shift = {
  start: number;
  end: number;
  salaryPerHour: number;
  note: string;
};

export default function Home() {
  const [tab, setTab] = useState("work");

  const [salaryPerHour, setSalaryPerHour] = useState(50);
  const [isWorking, setIsWorking] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [note, setNote] = useState("");

  // ⏱️ שעון רץ כל שנייה
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 💰 חישוב זמן נוכחי
  const currentMinutes =
    isWorking && startTime ? (now - startTime) / 1000 / 60 : 0;

  const currentHours = currentMinutes / 60;
  const currentSalary = currentHours * salaryPerHour;

  const startShift = () => {
    setStartTime(Date.now());
    setIsWorking(true);
  };

  const endShift = () => {
    if (!startTime) return;

    const newShift: Shift = {
      start: startTime,
      end: Date.now(),
      salaryPerHour,
      note,
    };

    setShifts([...shifts, newShift]);
    setIsWorking(false);
    setStartTime(null);
    setNote("");
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("he-IL");
  };

  const calcShift = (shift: Shift) => {
    const minutes = (shift.end - shift.start) / 1000 / 60;
    const hours = minutes / 60;

    const regular = Math.min(hours, 8);
    const extra125 = Math.max(0, Math.min(hours - 8, 2));
    const extra150 = Math.max(0, hours - 10);

    const salary =
      regular * shift.salaryPerHour +
      extra125 * shift.salaryPerHour * 1.25 +
      extra150 * shift.salaryPerHour * 1.5;

    return {
      hours: hours.toFixed(2),
      salary: salary.toFixed(2),
      regular: regular.toFixed(2),
      extra125: extra125.toFixed(2),
      extra150: extra150.toFixed(2),
    };
  };

  return (
    <main style={{ padding: 20, fontFamily: "Arial" }}>
      {/* טאבים */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setTab("work")}>משמרות</button>
        <button onClick={() => setTab("form101")}>טופס 101</button>
        <button onClick={() => setTab("pension")}>פנסיה</button>
      </div>

      {/* ===== משמרות ===== */}
      {tab === "work" && (
        <div>
          <h2>Work Tracker</h2>

          <input
            type="number"
            value={salaryPerHour}
            onChange={(e) => setSalaryPerHour(Number(e.target.value))}
          />

          <div style={{ marginTop: 10 }}>
            {!isWorking ? (
              <button onClick={startShift}>כניסה למשמרת</button>
            ) : (
              <button onClick={endShift}>יציאה מהמשמרת</button>
            )}
          </div>

          {/* 💰 בזמן אמת */}
          {isWorking && (
            <div style={{ marginTop: 20 }}>
              <p>שעות: {currentHours.toFixed(2)}</p>
              <p>שכר: ₪{currentSalary.toFixed(2)}</p>
            </div>
          )}

          {/* 📝 הערות */}
          <textarea
            placeholder="הערות למשמרת"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {/* 📊 היסטוריה */}
          <h3>משמרות</h3>
          {shifts.map((shift, i) => {
            const calc = calcShift(shift);
            return (
              <div key={i} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
                <p>
                  {formatTime(shift.start)} → {formatTime(shift.end)}
                </p>
                <p>סה״כ שעות: {calc.hours}</p>
                <p>רגילות: {calc.regular}</p>
                <p>125%: {calc.extra125}</p>
                <p>150%: {calc.extra150}</p>
                <p>שכר: ₪{calc.salary}</p>
                <p>תעריף: ₪{shift.salaryPerHour}</p>
                <p>הערות: {shift.note}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== 101 ===== */}
      {tab === "form101" && (
        <div>
          <h2>טופס 101</h2>
          <p>שלב הבא נבנה כאן מנוע מס אמיתי</p>
        </div>
      )}

      {/* ===== פנסיה ===== */}
      {tab === "pension" && (
        <div>
          <h2>פנסיה</h2>
          <p>שלב הבא נכניס הפרשות עובד ומעסיק</p>
        </div>
      )}
    </main>
  );
}