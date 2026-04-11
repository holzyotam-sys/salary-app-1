"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "work-hours-app-v7";

const DEFAULTS = {
  hourlyRate: 42,
  activeShift: null,
  manualDate: new Date().toISOString().slice(0, 10),
  manualStart: "08:00",
  manualEnd: "16:00",
  manualNote: "",
  manualHourlyRate: 42,
  shifts: [],
};

function formatMoney(value) {
  return `₪${Number(value || 0).toFixed(2)}`;
}

function formatHoursFromMinutes(minutes) {
  return (minutes / 60).toFixed(2);
}

function formatDateForInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function formatDateForDisplay(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTimeDisplay(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatClock(date) {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function buildLocalDateTime(dateString, timeString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = timeString.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function calculateShiftBreakdown(startDate, endDate, hourlyRate) {
  const totalMinutes = Math.max(
    0,
    Math.round((endDate.getTime() - startDate.getTime()) / 60000)
  );

  const regularMinutes = Math.min(totalMinutes, 8 * 60);
  const overtime125Minutes = Math.min(
    Math.max(totalMinutes - 8 * 60, 0),
    2 * 60
  );
  const overtime150Minutes = Math.max(totalMinutes - 10 * 60, 0);

  const regularPay = (regularMinutes / 60) * hourlyRate;
  const pay125 = (overtime125Minutes / 60) * hourlyRate * 1.25;
  const pay150 = (overtime150Minutes / 60) * hourlyRate * 1.5;
  const totalPay = regularPay + pay125 + pay150;

  return {
    totalMinutes,
    regularMinutes,
    overtime125Minutes,
    overtime150Minutes,
    regularPay,
    pay125,
    pay150,
    totalPay,
  };
}

function createShiftRecord({
  date,
  startTime,
  endTime,
  note,
  hourlyRate,
  source = "manual",
}) {
  const startDate = buildLocalDateTime(date, startTime);
  let endDate = buildLocalDateTime(date, endTime);

  if (endDate <= startDate) {
    endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
  }

  const breakdown = calculateShiftBreakdown(startDate, endDate, hourlyRate);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    date,
    startTime,
    endTime,
    note: note?.trim() || "",
    hourlyRate,
    source,
    createdAt: new Date().toISOString(),
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
    ...breakdown,
  };
}

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(DEFAULTS.hourlyRate);
  const [activeShift, setActiveShift] = useState(DEFAULTS.activeShift);
  const [manualDate, setManualDate] = useState(DEFAULTS.manualDate);
  const [manualStart, setManualStart] = useState(DEFAULTS.manualStart);
  const [manualEnd, setManualEnd] = useState(DEFAULTS.manualEnd);
  const [manualNote, setManualNote] = useState(DEFAULTS.manualNote);
  const [manualHourlyRate, setManualHourlyRate] = useState(
    DEFAULTS.manualHourlyRate
  );
  const [shifts, setShifts] = useState(DEFAULTS.shifts);
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const loadedHourlyRate = parsed.hourlyRate ?? DEFAULTS.hourlyRate;

      setHourlyRate(loadedHourlyRate);
      setActiveShift(parsed.activeShift ?? DEFAULTS.activeShift);
      setManualDate(parsed.manualDate ?? DEFAULTS.manualDate);
      setManualStart(parsed.manualStart ?? DEFAULTS.manualStart);
      setManualEnd(parsed.manualEnd ?? DEFAULTS.manualEnd);
      setManualNote(parsed.manualNote ?? DEFAULTS.manualNote);
      setManualHourlyRate(parsed.manualHourlyRate ?? loadedHourlyRate);
      setShifts(Array.isArray(parsed.shifts) ? parsed.shifts : DEFAULTS.shifts);
    } catch (err) {
      console.error("Load error:", err);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        hourlyRate,
        activeShift,
        manualDate,
        manualStart,
        manualEnd,
        manualNote,
        manualHourlyRate,
        shifts,
      })
    );
  }, [
    mounted,
    hourlyRate,
    activeShift,
    manualDate,
    manualStart,
    manualEnd,
    manualNote,
    manualHourlyRate,
    shifts,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setManualHourlyRate(hourlyRate);
  }, [hourlyRate]);

  const liveBreakdown = useMemo(() => {
    if (!activeShift?.startAt) return null;
    return calculateShiftBreakdown(new Date(activeShift.startAt), now, hourlyRate);
  }, [activeShift, now, hourlyRate]);

  const manualPreview = useMemo(() => {
    if (!manualDate || !manualStart || !manualEnd) return null;

    const previewStart = buildLocalDateTime(manualDate, manualStart);
    let previewEnd = buildLocalDateTime(manualDate, manualEnd);

    if (
      Number.isNaN(previewStart.getTime()) ||
      Number.isNaN(previewEnd.getTime())
    ) {
      return null;
    }

    if (previewEnd <= previewStart) {
      previewEnd = new Date(previewEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    return calculateShiftBreakdown(previewStart, previewEnd, Number(manualHourlyRate || 0));
  }, [manualDate, manualStart, manualEnd, manualHourlyRate]);

  const grandTotal = useMemo(() => {
    return shifts.reduce(
      (acc, shift) => {
        acc.totalMinutes += shift.totalMinutes || 0;
        acc.regularMinutes += shift.regularMinutes || 0;
        acc.overtime125Minutes += shift.overtime125Minutes || 0;
        acc.overtime150Minutes += shift.overtime150Minutes || 0;
        acc.regularPay += shift.regularPay || 0;
        acc.pay125 += shift.pay125 || 0;
        acc.pay150 += shift.pay150 || 0;
        acc.totalPay += shift.totalPay || 0;
        return acc;
      },
      {
        totalMinutes: 0,
        regularMinutes: 0,
        overtime125Minutes: 0,
        overtime150Minutes: 0,
        regularPay: 0,
        pay125: 0,
        pay150: 0,
        totalPay: 0,
      }
    );
  }, [shifts]);

  function handleStartShift() {
    setError("");

    if (activeShift) {
      setError("יש כבר משמרת פתוחה.");
      return;
    }

    const startedAt = new Date();

    setActiveShift({
      startAt: startedAt.toISOString(),
      date: formatDateForInput(startedAt),
      startTime: `${String(startedAt.getHours()).padStart(2, "0")}:${String(
        startedAt.getMinutes()
      ).padStart(2, "0")}`,
    });
  }

  function handleEndShift() {
    setError("");

    if (!activeShift?.startAt) {
      setError("אין כרגע משמרת פעילה.");
      return;
    }

    const startDate = new Date(activeShift.startAt);
    const endDate = new Date();

    const shift = createShiftRecord({
      date: activeShift.date,
      startTime: activeShift.startTime,
      endTime: `${String(endDate.getHours()).padStart(2, "0")}:${String(
        endDate.getMinutes()
      ).padStart(2, "0")}`,
      note: "יציאה משעון נוכחות",
      hourlyRate,
      source: "timer",
    });

    shift.startAt = startDate.toISOString();
    shift.endAt = endDate.toISOString();

    const recalculated = calculateShiftBreakdown(startDate, endDate, hourlyRate);
    Object.assign(shift, recalculated);

    setShifts((prev) => [shift, ...prev]);
    setActiveShift(null);
  }

  function handleManualAdd() {
    setError("");

    if (!manualDate || !manualStart || !manualEnd) {
      setError("צריך לבחור תאריך, שעת התחלה ושעת סיום.");
      return;
    }

    if (!manualHourlyRate || Number(manualHourlyRate) <= 0) {
      setError("צריך להזין שכר לשעה גדול מאפס.");
      return;
    }

    const startDate = buildLocalDateTime(manualDate, manualStart);
    let endDate = buildLocalDateTime(manualDate, manualEnd);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError("יש בעיה בתאריך או בשעות שהוזנו.");
      return;
    }

    if (endDate <= startDate) {
      endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const shift = createShiftRecord({
      date: manualDate,
      startTime: manualStart,
      endTime: manualEnd,
      note: manualNote,
      hourlyRate: Number(manualHourlyRate),
      source: "manual",
    });

    setShifts((prev) => [shift, ...prev]);
    setManualNote("");
  }

  function handleDeleteShift(id) {
    setShifts((prev) => prev.filter((shift) => shift.id !== id));
  }

  function handleEditShift(shift) {
    setManualDate(shift.date);
    setManualStart(shift.startTime);
    setManualEnd(shift.endTime);
    setManualNote(shift.note || "");
    setManualHourlyRate(shift.hourlyRate || hourlyRate);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleClearManual() {
    setManualDate(formatDateForInput(new Date()));
    setManualStart("08:00");
    setManualEnd("16:00");
    setManualNote("");
    setManualHourlyRate(hourlyRate);
    setError("");
  }

  function handleClearAll() {
    setShifts([]);
    setActiveShift(null);
    setError("");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "24px 16px 60px",
        direction: "rtl",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 20, textAlign: "center" }}>
          מחשבון שכר
        </h1>

        <section style={sectionBox}>
          <label style={labelStyle}>שכר ברירת מחדל לשעה</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(Number(e.target.value || 0))}
            style={inputStyle}
          />
        </section>

        <section style={sectionBox}>
          <h2 style={sectionTitle}>שעון נוכחות</h2>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "1fr 1fr",
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              onClick={handleStartShift}
              style={{
                ...buttonStyle,
                background: "#1d4ed8",
                opacity: activeShift ? 0.6 : 1,
              }}
              disabled={!!activeShift}
            >
              כניסה למשמרת
            </button>

            <button
              type="button"
              onClick={handleEndShift}
              style={{
                ...buttonStyle,
                background: "#16a34a",
                opacity: activeShift ? 1 : 0.6,
              }}
              disabled={!activeShift}
            >
              יציאה ממשמרת
            </button>
          </div>

          <div style={summaryBox}>
            <div style={{ marginBottom: 8 }}>
              שעה נוכחית: <strong>{formatClock(now)}</strong>
            </div>

            {!activeShift && <div>אין משמרת פעילה כרגע.</div>}

            {activeShift && liveBreakdown && (
              <>
                <div style={rowText}>
                  התחלה: <strong>{formatDateTimeDisplay(activeShift.startAt)}</strong>
                </div>
                <div style={rowText}>
                  שעות רגילות:{" "}
                  <strong>{formatHoursFromMinutes(liveBreakdown.regularMinutes)}</strong>
                </div>
                <div style={rowText}>
                  שעות 125%:{" "}
                  <strong>{formatHoursFromMinutes(liveBreakdown.overtime125Minutes)}</strong>
                </div>
                <div style={rowText}>
                  שעות 150%:{" "}
                  <strong>{formatHoursFromMinutes(liveBreakdown.overtime150Minutes)}</strong>
                </div>
                <div style={rowText}>
                  כסף על שעות רגילות:{" "}
                  <strong>{formatMoney(liveBreakdown.regularPay)}</strong>
                </div>
                <div style={rowText}>
                  כסף על 125%: <strong>{formatMoney(liveBreakdown.pay125)}</strong>
                </div>
                <div style={rowText}>
                  כסף על 150%: <strong>{formatMoney(liveBreakdown.pay150)}</strong>
                </div>
                <div style={{ ...rowText, fontWeight: 800 }}>
                  סה״כ כרגע: <strong>{formatMoney(liveBreakdown.totalPay)}</strong>
                </div>
              </>
            )}
          </div>
        </section>

        <section style={sectionBox}>
          <h2 style={sectionTitle}>הוספת יום מהיומן</h2>

          <label style={labelStyle}>תאריך</label>
          <input
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            style={{ ...inputStyle, ...ltrInputStyle, marginBottom: 12 }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label style={labelStyle}>שעת התחלה</label>
              <input
                type="time"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                style={{ ...inputStyle, ...ltrInputStyle }}
              />
            </div>

            <div>
              <label style={labelStyle}>שעת סיום</label>
              <input
                type="time"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                style={{ ...inputStyle, ...ltrInputStyle }}
              />
            </div>
          </div>

          <label style={labelStyle}>שכר לשעה ליום הזה</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={manualHourlyRate}
            onChange={(e) => setManualHourlyRate(Number(e.target.value || 0))}
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          <label style={labelStyle}>הערות ליום (לא חובה)</label>
          <textarea
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="למשל: משמרת ערב / שבת / חג"
            rows={4}
            style={{ ...inputStyle, resize: "vertical", marginBottom: 12 }}
          />

          <div style={{ ...summaryBox, marginBottom: 12 }}>
            {!manualPreview ? (
              <div>לא ניתן לחשב עדיין.</div>
            ) : (
              <>
                <div style={rowText}>
                  שכר לשעה: <strong>{formatMoney(manualHourlyRate)}</strong>
                </div>
                <div style={rowText}>
                  שעות רגילות:{" "}
                  <strong>{formatHoursFromMinutes(manualPreview.regularMinutes)}</strong>
                </div>
                <div style={rowText}>
                  שעות 125%:{" "}
                  <strong>{formatHoursFromMinutes(manualPreview.overtime125Minutes)}</strong>
                </div>
                <div style={rowText}>
                  שעות 150%:{" "}
                  <strong>{formatHoursFromMinutes(manualPreview.overtime150Minutes)}</strong>
                </div>
                <div style={rowText}>
                  כסף על שעות רגילות:{" "}
                  <strong>{formatMoney(manualPreview.regularPay)}</strong>
                </div>
                <div style={rowText}>
                  כסף על 125%: <strong>{formatMoney(manualPreview.pay125)}</strong>
                </div>
                <div style={rowText}>
                  כסף על 150%: <strong>{formatMoney(manualPreview.pay150)}</strong>
                </div>
                <div style={{ ...rowText, fontWeight: 800 }}>
                  סה״כ צפוי: <strong>{formatMoney(manualPreview.totalPay)}</strong>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleManualAdd}
            style={{
              ...buttonStyle,
              background: "#1d4ed8",
              width: "100%",
              marginBottom: 10,
            }}
          >
            הוסף יום מהיומן
          </button>

          <button
            type="button"
            onClick={handleClearManual}
            style={{
              ...buttonStyle,
              background: "#cbd5e1",
              color: "#111827",
              width: "100%",
            }}
          >
            נקה הכל
          </button>

          {error && (
            <div
              style={{
                marginTop: 12,
                color: "#b91c1c",
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}
        </section>

        <section style={sectionBox}>
          <h2 style={sectionTitle}>רשימת ימים</h2>

          {shifts.length === 0 && <div>עדיין אין משמרות שמורות.</div>}

          {shifts.map((shift, index) => (
            <div
              key={shift.id}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                יום {index + 1}
              </div>

              <div style={rowBetween}>
                <span>תאריך:</span>
                <strong>{formatDateForDisplay(shift.date)}</strong>
              </div>

              <div style={rowBetween}>
                <span>שעת התחלה:</span>
                <strong>{shift.startTime}</strong>
              </div>

              <div style={rowBetween}>
                <span>שעת סיום:</span>
                <strong>{shift.endTime}</strong>
              </div>

              <div style={rowBetween}>
                <span>שכר לשעה:</span>
                <strong>{formatMoney(shift.hourlyRate)}</strong>
              </div>

              {shift.note ? (
                <div style={rowBetween}>
                  <span>הערות:</span>
                  <strong>{shift.note}</strong>
                </div>
              ) : null}

              <hr
                style={{
                  border: 0,
                  borderTop: "1px solid #e5e7eb",
                  margin: "12px 0",
                }}
              />

              <div style={rowBetween}>
                <span>שעות רגילות:</span>
                <strong>{formatHoursFromMinutes(shift.regularMinutes)}</strong>
              </div>

              <div style={rowBetween}>
                <span>שעות 125%:</span>
                <strong>{formatHoursFromMinutes(shift.overtime125Minutes)}</strong>
              </div>

              <div style={rowBetween}>
                <span>שעות 150%:</span>
                <strong>{formatHoursFromMinutes(shift.overtime150Minutes)}</strong>
              </div>

              <div style={rowBetween}>
                <span>כסף על שעות רגילות:</span>
                <strong>{formatMoney(shift.regularPay)}</strong>
              </div>

              <div style={rowBetween}>
                <span>כסף על 125%:</span>
                <strong>{formatMoney(shift.pay125)}</strong>
              </div>

              <div style={rowBetween}>
                <span>כסף על 150%:</span>
                <strong>{formatMoney(shift.pay150)}</strong>
              </div>

              <div style={{ ...rowBetween, fontWeight: 800 }}>
                <span>סה״כ ליום:</span>
                <strong>{formatMoney(shift.totalPay)}</strong>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleDeleteShift(shift.id)}
                  style={{ ...buttonStyle, background: "#dc2626" }}
                >
                  מחק
                </button>

                <button
                  type="button"
                  onClick={() => handleEditShift(shift)}
                  style={{ ...buttonStyle, background: "#2563eb" }}
                >
                  ערוך
                </button>
              </div>
            </div>
          ))}

          {shifts.length > 0 && (
            <>
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "2px solid #e5e7eb",
                  lineHeight: 1.9,
                  fontSize: 18,
                }}
              >
                <div>
                  כסף משעות רגילות: <strong>{formatMoney(grandTotal.regularPay)}</strong>
                </div>
                <div>
                  כסף מ־125%: <strong>{formatMoney(grandTotal.pay125)}</strong>
                </div>
                <div>
                  כסף מ־150%: <strong>{formatMoney(grandTotal.pay150)}</strong>
                </div>
                <div style={{ fontWeight: 800, fontSize: 22 }}>
                  סה״כ מצטבר: <strong>{formatMoney(grandTotal.totalPay)}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearAll}
                style={{
                  ...buttonStyle,
                  background: "#111827",
                  width: "100%",
                  marginTop: 16,
                }}
              >
                מחק את כל הרשימה
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

const sectionBox = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 16,
  marginBottom: 18,
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 16,
  boxSizing: "border-box",
};

const ltrInputStyle = {
  direction: "ltr",
  textAlign: "left",
};

const buttonStyle = {
  border: 0,
  borderRadius: 10,
  padding: "13px 16px",
  color: "#fff",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};

const labelStyle = {
  display: "block",
  marginBottom: 8,
  fontWeight: 700,
};

const sectionTitle = {
  marginTop: 0,
  marginBottom: 14,
  fontSize: 22,
};

const summaryBox = {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
};

const rowText = {
  marginBottom: 6,
};

const rowBetween = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 6,
};