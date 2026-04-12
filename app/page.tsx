"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateNetSalary } from "@/lib/netSalary";

type Shift = {
  id: string;
  start: number;
  end: number;
  salaryPerHour: number;
  note: string;
};

type HolidayMap = Record<string, string>;

type HebcalItem = {
  date?: string;
  title?: string;
};

type HebcalResponse = {
  items?: HebcalItem[];
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

function toDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSaturday(timestamp: number): boolean {
  return new Date(timestamp).getDay() === 6;
}

function normalizeHolidayTitle(title: string): string {
  const value = title.toLowerCase();

  if (value.includes("rosh hashana")) return "ראש השנה";
  if (value.includes("yom kippur")) return "יום כיפור";
  if (value.includes("sukkot")) return "סוכות";
  if (value.includes("shemini atzeret")) return "שמיני עצרת";
  if (value.includes("simchat torah")) return "שמחת תורה";
  if (value.includes("pesach i")) return "פסח";
  if (value.includes("pesach vii")) return "שביעי של פסח";
  if (value.includes("shavuot")) return "שבועות";
  if (value.includes("yom haatzma")) return "יום העצמאות";

  return title;
}

function isPaidIsraeliHolidayTitle(title: string): boolean {
  const value = title.toLowerCase();

  return (
    value.includes("rosh hashana") ||
    value.includes("yom kippur") ||
    value.includes("sukkot") ||
    value.includes("shemini atzeret") ||
    value.includes("simchat torah") ||
    value.includes("pesach i") ||
    value.includes("pesach vii") ||
    value.includes("shavuot") ||
    value.includes("yom haatzma")
  );
}

function buildHolidayMapFromHebcal(items: HebcalItem[]): HolidayMap {
  const map: HolidayMap = {};

  for (const item of items) {
    if (!item.date || !item.title) continue;
    if (!isPaidIsraeliHolidayTitle(item.title)) continue;
    map[item.date] = normalizeHolidayTitle(item.title);
  }

  return map;
}

async function fetchHebcalHolidays(year: number): Promise<HolidayMap> {
  const params = new URLSearchParams({
    v: "1",
    cfg: "json",
    year: String(year),
    i: "on",
    maj: "on",
    mod: "on",
  });

  const response = await fetch(`https://www.hebcal.com/hebcal?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Hebcal request failed for year ${year}`);
  }

  const data = (await response.json()) as HebcalResponse;
  return buildHolidayMapFromHebcal(data.items ?? []);
}

function calculateShift(shift: Shift, holidayMap: HolidayMap) {
  const totalHours = Math.max(0, (shift.end - shift.start) / 1000 / 60 / 60);

  const saturday = isSaturday(shift.start);
  const holidayName = holidayMap[toDateKey(shift.start)] ?? null;
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

  const [holidayMap, setHolidayMap] = useState<HolidayMap>({});
  const [holidayStatus, setHolidayStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );

  // שלב 1: פרופיל משתמש
  const [creditPoints, setCreditPoints] = useState<number>(2.25);
  const [pensionPercent, setPensionPercent] = useState<number>(6);
  const [trainingFundPercent, setTrainingFundPercent] = useState<number>(2.5);

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

  useEffect(() => {
    let cancelled = false;

    async function loadHolidays() {
      try {
        setHolidayStatus("loading");

        const currentYear = new Date().getFullYear();
        const nextYear = currentYear + 1;
        const previousYear = currentYear - 1;

        const [prevMap, currentMap, nextMap] = await Promise.all([
          fetchHebcalHolidays(previousYear),
          fetchHebcalHolidays(currentYear),
          fetchHebcalHolidays(nextYear),
        ]);

        if (cancelled) return;

        setHolidayMap({
          ...prevMap,
          ...currentMap,
          ...nextMap,
        });
        setHolidayStatus("ready");
      } catch {
        if (cancelled) return;
        setHolidayStatus("error");
      }
    }

    loadHolidays();

    return () => {
      cancelled = true;
    };
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

    return calculateShift(liveShift, holidayMap).totalPay;
  }, [isWorking, startTime, now, salary, note, holidayMap]);

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

      <div style={{ border: "1px solid #ccc", padding: 12, marginBottom: 20 }}>
        <h2>פרופיל משתמש - שלב 1</h2>

        <div style={{ marginBottom: 10 }}>
          <label>נקודות זיכוי: </label>
          <input
            type="number"
            step="0.25"
            value={creditPoints}
            onChange={(e) => setCreditPoints(Number(e.target.value))}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>אחוז פנסיה עובד: </label>
          <input
            type="number"
            step="0.1"
            value={pensionPercent}
            onChange={(e) => setPensionPercent(Number(e.target.value))}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>אחוז קרן השתלמות עובד: </label>
          <input
            type="number"
            step="0.1"
            value={trainingFundPercent}
            onChange={(e) => setTrainingFundPercent(Number(e.target.value))}
          />
        </div>

        <p>כרגע זה רק מוצג במסך. בשלב הבא נחבר את זה לחישוב הנטו.</p>
      </div>

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

      <p>
        מצב מנוע חגים:{" "}
        {holidayStatus === "loading"
          ? "טוען..."
          : holidayStatus === "ready"
          ? "מוכן"
          : holidayStatus === "error"
          ? "שגיאה"
          : "לא התחיל"}
      </p>

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
        const c = calculateShift(shift, holidayMap);

        const netData = calculateNetSalary(c.totalPay, {
          creditPoints: 2.25,
          pensionPercent: 6,
          trainingFundPercent: 2.5,
        });

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
            <p>מס הכנסה: {formatMoney(netData.incomeTax)}</p>
            <p>ביטוח לאומי: {formatMoney(netData.bituach)}</p>
            <p>פנסיה עובד: {formatMoney(netData.pension)}</p>
            <p>השתלמות עובד: {formatMoney(netData.training)}</p>
            <p>
              <b>נטו: {formatMoney(netData.net)}</b>
            </p>

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