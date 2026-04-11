"use client";

import { useEffect, useMemo, useState } from "react";

type Shift = {
  id: string;
  start: number;
  end: number;
  salaryPerHour: number;
  note: string;
};

function formatMoney(value: number): string {
  return `₪${value.toFixed(2)}`;
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatTimeOnly(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDateTimeLocalValue(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizeHebrewMonth(raw: string): string {
  const value = raw.toLowerCase().trim();

  if (value.includes("tish")) return "tishri";
  if (value.includes("hesh") || value.includes("chesh")) return "heshvan";
  if (value.includes("kis")) return "kislev";
  if (value.includes("tev")) return "tevet";
  if (value.includes("shev")) return "shevat";
  if (value.includes("adar")) return "adar";
  if (value.includes("nis")) return "nisan";
  if (value.includes("iya")) return "iyar";
  if (value.includes("siv")) return "sivan";
  if (value.includes("tam")) return "tammuz";
  if (value.includes("av")) return "av";
  if (value.includes("elu")) return "elul";

  return value;
}

function getHebrewParts(timestamp: number): { day: number; month: string } {
  const date = new Date(timestamp);

  const formatter = new Intl.DateTimeFormat("en-u-ca-hebrew", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const parts = formatter.formatToParts(date);

  const day = Number(parts.find((p) => p.type === "day")?.value ?? "0");
  const monthRaw = parts.find((p) => p.type === "month")?.value ?? "";

  return {
    day,
    month: normalizeHebrewMonth(monthRaw),
  };
}

function isSaturday(timestamp: number): boolean {
  return new Date(timestamp).getDay() === 6;
}

function getHolidayName(timestamp: number): string | null {
  const { day, month } = getHebrewParts(timestamp);

  if (month === "tishri" && (day === 1 || day === 2)) return "ראש השנה";
  if (month === "tishri" && day === 10) return "יום כיפור";
  if (month === "tishri" && day === 15) return "סוכות";
  if (month === "tishri" && day === 22) return "שמיני עצרת / שמחת תורה";

  if (month === "nisan" && day === 15) return "פסח";
  if (month === "nisan" && day === 21) return "שביעי של פסח";

  if (month === "sivan" && day === 6) return "שבועות";

  return null;
}

function calculateShift(shift: Shift) {
  const totalHours = Math.max(0, (shift.end - shift.start) / 1000 / 60 / 60);

  const saturday = isSaturday(shift.start);
  const holidayName = getHolidayName(shift.start);
  const holiday = Boolean(holidayName);

  const baseMultiplier = saturday || holiday ? 1.5 : 1;

  let regularHours = 0;
  let overtime125Hours = 0;
  let overtime150Hours = 0;

  if (totalHours <= 8) {
    regularHours = totalHours;
  } else if (totalHours <= 10) {
    regularHours = 8;
    overtime125Hours = totalHours - 8;
  } else {
    regularHours = 8;
    overtime125Hours = 2;
    overtime150Hours = totalHours - 10;
  }

  const regularPay = regularHours * shift.salaryPerHour * baseMultiplier;
  const overtime125Pay =
    overtime125Hours * shift.salaryPerHour * 1.25 * baseMultiplier;
  const overtime150Pay =
    overtime150Hours * shift.salaryPerHour * 1.5 * baseMultiplier;

  const totalPay = regularPay + overtime125Pay + overtime150Pay;

  let dayTypeLabel = "יום רגיל";
  if (holiday) dayTypeLabel = `חג - ${holidayName}`;
  if (saturday) dayTypeLabel = holiday ? `שבת + ${holidayName}` : "שבת";

  return {
    totalHours,
    regularHours,
    overtime125Hours,
    overtime150Hours,
    regularPay,
    overtime125Pay,
    overtime150Pay,
    totalPay,
    saturday,
    holiday,
    holidayName,
    dayTypeLabel,
    effectiveBaseRate: shift.salaryPerHour * baseMultiplier,
  };
}

export default function Home() {
  const [salary, setSalary] = useState<number>(50);
  const [note, setNote] = useState<string>("");
  const [isWorking, setIsWorking] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editSalary, setEditSalary] = useState<number>(50);
  const [editNote, setEditNote] = useState("");

  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualNote, setManualNote] = useState("");

  useEffect(() => {
    const savedShifts = localStorage.getItem("shifts");
    const savedWorking = localStorage.getItem("workingShift");
    const savedSalary = localStorage.getItem("defaultSalary");

    if (savedShifts) {
      setShifts(JSON.parse(savedShifts));
    }

    if (savedWorking) {
      const parsed = JSON.parse(savedWorking);
      setIsWorking(parsed.isWorking);
      setStartTime(parsed.startTime);
      setNote(parsed.note || "");
      setSalary(parsed.salary || 50);
    }

    if (savedSalary) {
      setSalary(Number(savedSalary));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("shifts", JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem("defaultSalary", String(salary));
  }, [salary]);

  useEffect(() => {
    localStorage.setItem(
      "workingShift",
      JSON.stringify({
        isWorking,
        startTime,
        note,
        salary,
      })
    );
  }, [isWorking, startTime, note, salary]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  function startShift() {
    setStartTime(Date.now());
    setIsWorking(true);
  }

  function endShift() {
    if (!startTime) return;

    const newShift: Shift = {
      id: crypto.randomUUID(),
      start: startTime,
      end: Date.now(),
      salaryPerHour: salary,
      note,
    };

    setShifts((prev) => [newShift, ...prev]);
    setIsWorking(false);
    setStartTime(null);
    setNote("");
  }

  function addManualShift() {
    if (!manualStart || !manualEnd) return;

    const start = new Date(manualStart).getTime();
    const end = new Date(manualEnd).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return;

    const newShift: Shift = {
      id: crypto.randomUUID(),
      start,
      end,
      salaryPerHour: salary,
      note: manualNote,
    };

    setShifts((prev) => [newShift, ...prev]);
    setManualStart("");
    setManualEnd("");
    setManualNote("");
  }

  function deleteShift(id: string) {
    setShifts((prev) => prev.filter((shift) => shift.id !== id));
    if (editingId === id) {
      cancelEdit();
    }
  }

  function beginEdit(shift: Shift) {
    setEditingId(shift.id);
    setEditStart(formatDateTimeLocalValue(shift.start));
    setEditEnd(formatDateTimeLocalValue(shift.end));
    setEditSalary(shift.salaryPerHour);
    setEditNote(shift.note);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditStart("");
    setEditEnd("");
    setEditSalary(50);
    setEditNote("");
  }

  function saveEdit() {
    if (!editingId) return;

    const start = new Date(editStart).getTime();
    const end = new Date(editEnd).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return;

    setShifts((prev) =>
      prev.map((shift) =>
        shift.id === editingId
          ? {
              ...shift,
              start,
              end,
              salaryPerHour: editSalary,
              note: editNote,
            }
          : shift
      )
    );

    cancelEdit();
  }

  const liveMoney = useMemo(() => {
    if (!isWorking || !startTime) return 0;

    const liveShift: Shift = {
      id: "live",
      start: startTime,
      end: now,
      salaryPerHour: salary,
      note,
    };

    return calculateShift(liveShift).totalPay;
  }, [isWorking, startTime, now, salary, note]);

  return (
    <main
      style={{
        padding: 40,
        fontFamily: "Arial, sans-serif",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1>Work Tracker</h1>

      <input
        type="number"
        value={salary}
        onChange={(e) => setSalary(Number(e.target.value))}
        style={{ marginBottom: 12 }}
      />

      <br />

      {!isWorking ? (
        <button onClick={startShift}>כניסה</button>
      ) : (
        <button onClick={endShift}>יציאה</button>
      )}

      <br />
      <br />

      <textarea
        placeholder="הערות למשמרת"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ width: 260, height: 60 }}
      />

      <h2>💰 כסף בזמן אמת: {formatMoney(liveMoney)}</h2>

      <hr />

      <h2>➕ הוספה ידנית</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
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
      </div>

      <textarea
        placeholder="הערות ליום ידני"
        value={manualNote}
        onChange={(e) => setManualNote(e.target.value)}
        style={{ width: 260, height: 60 }}
      />

      <hr />

      <h2>משמרות</h2>

      {shifts.length === 0 && <p>אין עדיין משמרות</p>}

      {shifts.map((shift) => {
        const c = calculateShift(shift);

        if (editingId === shift.id) {
          return (
            <div
              key={shift.id}
              style={{
                border: "2px solid blue",
                margin: 10,
                padding: 12,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <input
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <input
                  type="datetime-local"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <input
                  type="number"
                  value={editSalary}
                  onChange={(e) => setEditSalary(Number(e.target.value))}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  style={{ width: 260, height: 60 }}
                />
              </div>

              <button onClick={saveEdit} style={{ marginRight: 8 }}>
                שמור
              </button>
              <button onClick={cancelEdit}>ביטול</button>
            </div>
          );
        }

        return (
          <div
            key={shift.id}
            style={{
              border: "1px solid black",
              margin: 10,
              padding: 12,
            }}
          >
            <p>
              {formatDateTime(shift.start)} → {formatTimeOnly(shift.end)}
            </p>

            <p>סוג יום: {c.dayTypeLabel}</p>
            {c.saturday && <p>🔥 תעריף שבת 150%</p>}
            {c.holiday && <p>🎉 תעריף חג 150%</p>}

            <p>סה"כ שעות: {c.totalHours.toFixed(2)}</p>

            <p>
              שעות רגילות: {c.regularHours.toFixed(2)} | שכר רגיל:{" "}
              {formatMoney(c.regularPay)}
            </p>

            <p>
              שעות 125%: {c.overtime125Hours.toFixed(2)} | שכר 125%:{" "}
              {formatMoney(c.overtime125Pay)}
            </p>

            <p>
              שעות 150%: {c.overtime150Hours.toFixed(2)} | שכר 150%:{" "}
              {formatMoney(c.overtime150Pay)}
            </p>

            <p>שכר כולל: {formatMoney(c.totalPay)}</p>
            <p>תעריף בסיס שנשמר: {formatMoney(shift.salaryPerHour)}</p>
            <p>תעריף אפקטיבי ליום הזה: {formatMoney(c.effectiveBaseRate)}</p>
            <p>הערות: {shift.note || "-"}</p>

            <button onClick={() => beginEdit(shift)} style={{ marginRight: 8 }}>
              ✏️ ערוך
            </button>
            <button onClick={() => deleteShift(shift.id)}>🗑 מחק</button>
          </div>
        );
      })}
    </main>
  );
}