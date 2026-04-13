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

function formatDateOnlyValue(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function buildTimestamp(dateValue: string, timeValue: string): number {
  return new Date(`${dateValue}T${timeValue}`).getTime();
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

function getMonthKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

export default function Home() {
  const nowDate = new Date();
  const today = formatDateOnlyValue(nowDate.getTime());

  const [salary, setSalary] = useState<number>(35);
  const [note, setNote] = useState<string>("");
  const [isWorking, setIsWorking] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editSalary, setEditSalary] = useState<number>(35);
  const [editNote, setEditNote] = useState("");

  const [manualStartDate, setManualStartDate] = useState(today);
  const [manualStartTime, setManualStartTime] = useState("08:00");
  const [manualEndDate, setManualEndDate] = useState(today);
  const [manualEndTime, setManualEndTime] = useState("17:00");
  const [manualNote, setManualNote] = useState("");

  const [holidayMap, setHolidayMap] = useState<HolidayMap>({});
  const [holidayStatus, setHolidayStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );

  const [creditPoints, setCreditPoints] = useState<number>(2.25);
  const [pensionPercent, setPensionPercent] = useState<number>(6);
  const [trainingFundPercent, setTrainingFundPercent] = useState<number>(2.5);

  const [selectedMonth, setSelectedMonth] = useState<string>(getMonthKey(Date.now()));

  useEffect(() => {
    const savedShifts = localStorage.getItem("shifts");
    const savedWorking = localStorage.getItem("workingShift");
    const savedSalary = localStorage.getItem("defaultSalary");
    const savedProfile = localStorage.getItem("salaryProfile");

    if (savedShifts) {
      setShifts(JSON.parse(savedShifts));
    }

    if (savedWorking) {
      const parsed = JSON.parse(savedWorking);
      setIsWorking(parsed.isWorking);
      setStartTime(parsed.startTime);
      setNote(parsed.note || "");
      setSalary(parsed.salary || 35);
    }

    if (savedSalary) {
      setSalary(Number(savedSalary));
    }

    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setCreditPoints(parsed.creditPoints ?? 2.25);
      setPensionPercent(parsed.pensionPercent ?? 6);
      setTrainingFundPercent(parsed.trainingFundPercent ?? 2.5);
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
    localStorage.setItem(
      "salaryProfile",
      JSON.stringify({
        creditPoints,
        pensionPercent,
        trainingFundPercent,
      })
    );
  }, [creditPoints, pensionPercent, trainingFundPercent]);

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

  const availableMonths = useMemo(() => {
    const unique = Array.from(new Set(shifts.map((shift) => getMonthKey(shift.start))));
    unique.sort((a, b) => (a < b ? 1 : -1));

    if (!unique.includes(selectedMonth)) {
      return [selectedMonth, ...unique.filter((m) => m !== selectedMonth)];
    }

    return unique;
  }, [shifts, selectedMonth]);

  function startShift() {
    setStartTime(Date.now());
    setIsWorking(true);
  }

  function endShift() {
    if (!startTime) return;

    const end = Date.now();
    if (end <= startTime) return;

    const newShift: Shift = {
      id: crypto.randomUUID(),
      start: startTime,
      end,
      salaryPerHour: salary,
      note,
    };

    setShifts((prev) => [newShift, ...prev]);
    setIsWorking(false);
    setStartTime(null);
    setNote("");
  }

  function addManualShift() {
    if (!manualStartDate || !manualStartTime || !manualEndDate || !manualEndTime) return;

    const start = buildTimestamp(manualStartDate, manualStartTime);
    const end = buildTimestamp(manualEndDate, manualEndTime);

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return;

    const newShift: Shift = {
      id: crypto.randomUUID(),
      start,
      end,
      salaryPerHour: salary,
      note: manualNote,
    };

    setShifts((prev) => [newShift, ...prev]);
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
    setEditSalary(35);
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

  const shiftsWithCalc = useMemo(() => {
    return shifts.map((shift) => ({
      shift,
      calc: calculateShift(shift, holidayMap),
    }));
  }, [shifts, holidayMap]);

  const monthlyShifts = useMemo(() => {
    return shiftsWithCalc.filter(({ shift }) => getMonthKey(shift.start) === selectedMonth);
  }, [shiftsWithCalc, selectedMonth]);

  const monthlySummary = useMemo(() => {
    const totalHours = monthlyShifts.reduce((sum, item) => sum + item.calc.totalHours, 0);
    const regularHours = monthlyShifts.reduce((sum, item) => sum + item.calc.regularHours, 0);
    const overtime125Hours = monthlyShifts.reduce(
      (sum, item) => sum + item.calc.overtime125Hours,
      0
    );
    const overtime150Hours = monthlyShifts.reduce(
      (sum, item) => sum + item.calc.overtime150Hours,
      0
    );
    const gross = monthlyShifts.reduce((sum, item) => sum + item.calc.totalPay, 0);

    const net = calculateNetSalary(gross, {
      creditPoints,
      pensionPercent,
      trainingFundPercent,
    });

    return {
      totalHours,
      regularHours,
      overtime125Hours,
      overtime150Hours,
      ...net,
      shiftsCount: monthlyShifts.length,
    };
  }, [monthlyShifts, creditPoints, pensionPercent, trainingFundPercent]);

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
        <h2>פרופיל משתמש</h2>

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
      </div>

      <div style={{ border: "1px solid #ccc", padding: 12, marginBottom: 20 }}>
        <h2>סיכום חודשי</h2>

        <div style={{ marginBottom: 12 }}>
          <label>חודש נבחר: </label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {availableMonths.length === 0 ? (
              <option value={selectedMonth}>{getMonthLabel(selectedMonth)}</option>
            ) : (
              availableMonths.map((month) => (
                <option key={month} value={month}>
                  {getMonthLabel(month)}
                </option>
              ))
            )}
          </select>
        </div>

        <p>כמות משמרות בחודש: {monthlySummary.shiftsCount}</p>
        <p>סה״כ שעות בחודש: {monthlySummary.totalHours.toFixed(2)}</p>
        <p>שעות רגילות: {monthlySummary.regularHours.toFixed(2)}</p>
        <p>שעות 125%: {monthlySummary.overtime125Hours.toFixed(2)}</p>
        <p>שעות 150%: {monthlySummary.overtime150Hours.toFixed(2)}</p>

        <hr />

        <p>ברוטו חודשי: {formatMoney(monthlySummary.gross)}</p>
        <p>מס הכנסה חודשי: {formatMoney(monthlySummary.incomeTax)}</p>
        <p>ביטוח לאומי חודשי: {formatMoney(monthlySummary.bituach)}</p>
        <p>פנסיה חודשית: {formatMoney(monthlySummary.pension)}</p>
        <p>השתלמות חודשית: {formatMoney(monthlySummary.training)}</p>
        <p>
          <b>נטו חודשי: {formatMoney(monthlySummary.net)}</b>
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>שכר בסיס לשעה: </label>
        <input
          type="number"
          value={salary}
          onChange={(e) => setSalary(Number(e.target.value))}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        {!isWorking ? (
          <button onClick={startShift}>כניסה</button>
        ) : (
          <button onClick={endShift}>יציאה</button>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <textarea
          placeholder="הערות למשמרת"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ width: 260, height: 60 }}
        />
      </div>

      <h2>💰 כסף בזמן אמת: {formatMoney(liveMoney)}</h2>

      <p>{isWorking ? "🟢 עובד עכשיו" : "⚪ לא עובד"}</p>

      <hr />

      <h2>➕ הוספה ידנית</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <label>תאריך התחלה</label>
          <br />
          <input
            type="date"
            value={manualStartDate}
            onChange={(e) => setManualStartDate(e.target.value)}
          />
        </div>

        <div>
          <label>שעת התחלה</label>
          <br />
          <input
            type="time"
            value={manualStartTime}
            onChange={(e) => setManualStartTime(e.target.value)}
          />
        </div>

        <div>
          <label>תאריך סיום</label>
          <br />
          <input
            type="date"
            value={manualEndDate}
            onChange={(e) => setManualEndDate(e.target.value)}
          />
        </div>

        <div>
          <label>שעת סיום</label>
          <br />
          <input
            type="time"
            value={manualEndTime}
            onChange={(e) => setManualEndTime(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "end" }}>
          <button onClick={addManualShift}>הוסף</button>
        </div>
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
          creditPoints,
          pensionPercent,
          trainingFundPercent,
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