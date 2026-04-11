'use client';

import { useEffect, useMemo, useState } from 'react';

type ShiftKind = 'regular' | 'shabbat' | 'holiday' | 'shabbat_holiday';

type ShiftRecord = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  totalMinutes: number;
  totalHours: number;
  regularHours: number;
  overtime125Hours: number;
  overtime150Hours: number;
  payRegular: number;
  pay125: number;
  pay150: number;
  totalPay: number;
  kind: ShiftKind;
  holidayName: string | null;
};

type ActiveShift = {
  startedAtIso: string;
  notes: string;
};

const STORAGE_SHIFTS = 'salary-app-shifts-v1';
const STORAGE_ACTIVE = 'salary-app-active-v1';
const STORAGE_RATE = 'salary-app-rate-v1';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number): string {
  return `₪${round2(value).toFixed(2)}`;
}

function formatHours(hours: number): string {
  return round2(hours).toFixed(2);
}

function getNow(): Date {
  return new Date();
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeInputValue(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatHebrewDisplayDate(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function makeLocalDateTime(dateString: string, timeString: string): Date {
  return new Date(`${dateString}T${timeString}:00`);
}

function normalizeHebrewMonth(raw: string): string {
  const value = raw.toLowerCase().trim();

  if (value.includes('tish')) return 'tishri';
  if (value.includes('hesh') || value.includes('chesh')) return 'heshvan';
  if (value.includes('kis')) return 'kislev';
  if (value.includes('tev')) return 'tevet';
  if (value.includes('shev')) return 'shevat';
  if (value.includes('adar')) return 'adar';
  if (value.includes('nis')) return 'nisan';
  if (value.includes('iya')) return 'iyar';
  if (value.includes('siv')) return 'sivan';
  if (value.includes('tam')) return 'tammuz';
  if (value.includes('av')) return 'av';
  if (value.includes('elu')) return 'elul';

  return value;
}

function getHebrewParts(date: Date): { day: number; month: string; year: number } {
  const formatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const parts = formatter.formatToParts(date);

  const day = Number(parts.find((p) => p.type === 'day')?.value ?? '0');
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? '0');
  const monthRaw = parts.find((p) => p.type === 'month')?.value ?? '';

  return {
    day,
    month: normalizeHebrewMonth(monthRaw),
    year,
  };
}

function getHolidayName(date: Date): string | null {
  const { day, month } = getHebrewParts(date);

  if (month === 'tishri' && (day === 1 || day === 2)) return 'ראש השנה';
  if (month === 'tishri' && day === 10) return 'יום כיפור';
  if (month === 'tishri' && day === 15) return 'סוכות';
  if (month === 'tishri' && day === 22) return 'שמיני עצרת / שמחת תורה';

  if (month === 'nisan' && day === 15) return 'פסח';
  if (month === 'nisan' && day === 21) return 'שביעי של פסח';

  if (month === 'sivan' && day === 6) return 'שבועות';

  return null;
}

function getShiftKind(date: Date): { kind: ShiftKind; holidayName: string | null } {
  const holidayName = getHolidayName(date);
  const isShabbat = date.getDay() === 6;

  if (isShabbat && holidayName) {
    return { kind: 'shabbat_holiday', holidayName };
  }

  if (holidayName) {
    return { kind: 'holiday', holidayName };
  }

  if (isShabbat) {
    return { kind: 'shabbat', holidayName: null };
  }

  return { kind: 'regular', holidayName: null };
}

function calculateShift(
  startDate: Date,
  endDate: Date,
  hourlyRate: number,
  notes: string
): Omit<ShiftRecord, 'id'> {
  const diffMs = endDate.getTime() - startDate.getTime();
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
  const totalHours = totalMinutes / 60;

  const regularHours = Math.min(totalHours, 8);
  const overtime125Hours = Math.max(Math.min(totalHours - 8, 2), 0);
  const overtime150Hours = Math.max(totalHours - 10, 0);

  const { kind, holidayName } = getShiftKind(startDate);

  const baseMultiplier = kind === 'regular' ? 1 : 1.5;

  const payRegular = regularHours * hourlyRate * baseMultiplier;
  const pay125 = overtime125Hours * hourlyRate * baseMultiplier * 1.25;
  const pay150 = overtime150Hours * hourlyRate * baseMultiplier * 1.5;
  const totalPay = payRegular + pay125 + pay150;

  return {
    date: toDateInputValue(startDate),
    startTime: toTimeInputValue(startDate),
    endTime: toTimeInputValue(endDate),
    notes,
    totalMinutes,
    totalHours: round2(totalHours),
    regularHours: round2(regularHours),
    overtime125Hours: round2(overtime125Hours),
    overtime150Hours: round2(overtime150Hours),
    payRegular: round2(payRegular),
    pay125: round2(pay125),
    pay150: round2(pay150),
    totalPay: round2(totalPay),
    kind,
    holidayName,
  };
}

function makeRecordId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number>(50);
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [activeNotes, setActiveNotes] = useState('');
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [now, setNow] = useState<Date>(getNow());

  const [manualDate, setManualDate] = useState<string>(toDateInputValue(getNow()));
  const [manualStart, setManualStart] = useState<string>('08:00');
  const [manualEnd, setManualEnd] = useState<string>('17:00');
  const [manualNotes, setManualNotes] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const savedRate = window.localStorage.getItem(STORAGE_RATE);
    const savedActive = window.localStorage.getItem(STORAGE_ACTIVE);
    const savedShifts = window.localStorage.getItem(STORAGE_SHIFTS);

    if (savedRate) {
      const parsedRate = Number(savedRate);
      if (!Number.isNaN(parsedRate)) {
        setHourlyRate(parsedRate);
      }
    }

    if (savedActive) {
      const parsedActive = JSON.parse(savedActive) as ActiveShift;
      setActiveShift(parsedActive);
      setActiveNotes(parsedActive.notes ?? '');
    }

    if (savedShifts) {
      const parsedShifts = JSON.parse(savedShifts) as ShiftRecord[];
      setShifts(parsedShifts);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_RATE, String(hourlyRate));
  }, [hourlyRate, loaded]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_SHIFTS, JSON.stringify(shifts));
  }, [shifts, loaded]);

  useEffect(() => {
    if (!loaded) return;

    if (activeShift) {
      const payload: ActiveShift = {
        ...activeShift,
        notes: activeNotes,
      };
      window.localStorage.setItem(STORAGE_ACTIVE, JSON.stringify(payload));
    } else {
      window.localStorage.removeItem(STORAGE_ACTIVE);
    }
  }, [activeShift, activeNotes, loaded]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(getNow());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const liveBreakdown = useMemo(() => {
    if (!activeShift) return null;

    const startDate = new Date(activeShift.startedAtIso);
    const result = calculateShift(startDate, now, hourlyRate, activeNotes);

    return result;
  }, [activeShift, now, hourlyRate, activeNotes]);

  const totals = useMemo(() => {
    return shifts.reduce(
      (acc, shift) => {
        acc.totalPay += shift.totalPay;
        acc.regularHours += shift.regularHours;
        acc.overtime125Hours += shift.overtime125Hours;
        acc.overtime150Hours += shift.overtime150Hours;
        return acc;
      },
      {
        totalPay: 0,
        regularHours: 0,
        overtime125Hours: 0,
        overtime150Hours: 0,
      }
    );
  }, [shifts]);

  function handleStartShift(): void {
    const nowDate = getNow();
    setActiveShift({
      startedAtIso: nowDate.toISOString(),
      notes: activeNotes,
    });
  }

  function handleEndShift(): void {
    if (!activeShift) return;

    const startDate = new Date(activeShift.startedAtIso);
    const endDate = getNow();

    const newShift: ShiftRecord = {
      id: makeRecordId(),
      ...calculateShift(startDate, endDate, hourlyRate, activeNotes),
    };

    setShifts((prev) => [newShift, ...prev]);
    setActiveShift(null);
    setActiveNotes('');
  }

  function resetManualForm(): void {
    setEditingId(null);
    setManualDate(toDateInputValue(getNow()));
    setManualStart('08:00');
    setManualEnd('17:00');
    setManualNotes('');
  }

  function handleSaveManualShift(): void {
    const startDate = makeLocalDateTime(manualDate, manualStart);
    let endDate = makeLocalDateTime(manualDate, manualEnd);

    if (endDate.getTime() <= startDate.getTime()) {
      endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const computed = calculateShift(startDate, endDate, hourlyRate, manualNotes);

    if (editingId) {
      setShifts((prev) =>
        prev.map((shift) =>
          shift.id === editingId
            ? {
                id: shift.id,
                ...computed,
              }
            : shift
        )
      );
    } else {
      const newShift: ShiftRecord = {
        id: makeRecordId(),
        ...computed,
      };
      setShifts((prev) => [newShift, ...prev]);
    }

    resetManualForm();
  }

  function handleEditShift(shift: ShiftRecord): void {
    setEditingId(shift.id);
    setManualDate(shift.date);
    setManualStart(shift.startTime);
    setManualEnd(shift.endTime);
    setManualNotes(shift.notes);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleDeleteShift(id: string): void {
    setShifts((prev) => prev.filter((shift) => shift.id !== id));
    if (editingId === id) {
      resetManualForm();
    }
  }

  function kindLabel(kind: ShiftKind, holidayName: string | null): string {
    switch (kind) {
      case 'shabbat_holiday':
        return holidayName ? `שבת + ${holidayName}` : 'שבת + חג';
      case 'holiday':
        return holidayName ?? 'חג';
      case 'shabbat':
        return 'שבת';
      default:
        return 'יום רגיל';
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f3f4f6',
        padding: 20,
        fontFamily: 'Arial, sans-serif',
        color: '#111827',
      }}
    >
      <div
        style={{
          maxWidth: 780,
          margin: '0 auto',
        }}
      >
        <h1
          style={{
            textAlign: 'center',
            marginBottom: 20,
            fontSize: 34,
          }}
        >
          יומן עבודה ושכר
        </h1>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontWeight: 700,
              }}
            >
              שכר לשעה
            </label>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: 16,
              }}
            />
          </div>

          <div
            style={{
              marginBottom: 16,
              padding: 16,
              borderRadius: 12,
              background: activeShift ? '#ecfdf5' : '#f9fafb',
              border: activeShift ? '2px solid #22c55e' : '1px solid #e5e7eb',
            }}
          >
            <div style={{ marginBottom: 8, fontWeight: 700 }}>
              מצב משמרת: {activeShift ? 'במשמרת' : 'לא במשמרת'}
            </div>

            <div style={{ marginBottom: 8 }}>
              שעת מכשיר נוכחית: {new Intl.DateTimeFormat('he-IL', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }).format(now)}
            </div>

            {activeShift && liveBreakdown && (
              <div
                style={{
                  background: '#111827',
                  color: '#ffffff',
                  borderRadius: 12,
                  padding: 18,
                  marginTop: 12,
                }}
              >
                <div style={{ fontSize: 14, opacity: 0.85 }}>הרווחת עד עכשיו</div>
                <div style={{ fontSize: 42, fontWeight: 800, margin: '8px 0' }}>
                  {formatMoney(liveBreakdown.totalPay)}
                </div>
                <div>שעות: {formatHours(liveBreakdown.totalHours)}</div>
                <div>רגיל: {formatHours(liveBreakdown.regularHours)}</div>
                <div>125%: {formatHours(liveBreakdown.overtime125Hours)}</div>
                <div>150%: {formatHours(liveBreakdown.overtime150Hours)}</div>
                <div style={{ marginTop: 8 }}>
                  סוג יום: {kindLabel(liveBreakdown.kind, liveBreakdown.holidayName)}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button
              onClick={handleStartShift}
              disabled={!!activeShift}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 10,
                border: 'none',
                background: activeShift ? '#d1d5db' : '#16a34a',
                color: '#fff',
                fontWeight: 700,
                cursor: activeShift ? 'not-allowed' : 'pointer',
              }}
            >
              כניסה למשמרת
            </button>

            <button
              onClick={handleEndShift}
              disabled={!activeShift}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 10,
                border: 'none',
                background: activeShift ? '#111827' : '#d1d5db',
                color: '#fff',
                fontWeight: 700,
                cursor: activeShift ? 'pointer' : 'not-allowed',
              }}
            >
              יציאה ממשמרת
            </button>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontWeight: 700,
              }}
            >
              הערות למשמרת
            </label>
            <textarea
              value={activeNotes}
              onChange={(e) => setActiveNotes(e.target.value)}
              placeholder="מה חשוב לזכור על המשמרת הזאת?"
              style={{
                width: '100%',
                minHeight: 90,
                padding: 12,
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: 15,
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            {editingId ? 'עריכת יום שמור' : 'הוספת יום ידנית'}
          </h2>

          <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>
                תאריך
              </label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #d1d5db',
                  fontSize: 16,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>
                  שעת התחלה
                </label>
                <input
                  type="time"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #d1d5db',
                    fontSize: 16,
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>
                  שעת סיום
                </label>
                <input
                  type="time"
                  value={manualEnd}
                  onChange={(e) => setManualEnd(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #d1d5db',
                    fontSize: 16,
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>
                הערות
              </label>
              <textarea
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="הערות אישיות למשמרת"
                style={{
                  width: '100%',
                  minHeight: 90,
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #d1d5db',
                  fontSize: 15,
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleSaveManualShift}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 10,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {editingId ? 'שמור תיקון' : 'הוסף יום מהיומן'}
            </button>

            {editingId && (
              <button
                onClick={resetManualForm}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  border: 'none',
                  background: '#9ca3af',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ביטול
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h2 style={{ marginTop: 0 }}>סיכום מצטבר</h2>
          <div>סה"כ שעות רגילות: {formatHours(totals.regularHours)}</div>
          <div>סה"כ שעות 125%: {formatHours(totals.overtime125Hours)}</div>
          <div>סה"כ שעות 150%: {formatHours(totals.overtime150Hours)}</div>
          <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>
            סה"כ כסף: {formatMoney(totals.totalPay)}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0 }}>יומן משמרות</h2>

          {shifts.length === 0 ? (
            <div style={{ color: '#6b7280' }}>עדיין אין משמרות שמורות.</div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: 16,
                    background: '#fafafa',
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                    {formatHebrewDisplayDate(shift.date)}
                  </div>

                  <div>כניסה: {shift.startTime}</div>
                  <div>יציאה: {shift.endTime}</div>
                  <div>סוג יום: {kindLabel(shift.kind, shift.holidayName)}</div>
                  <div>שעות סה"כ: {formatHours(shift.totalHours)}</div>
                  <div>רגיל: {formatHours(shift.regularHours)} שעות — {formatMoney(shift.payRegular)}</div>
                  <div>125%: {formatHours(shift.overtime125Hours)} שעות — {formatMoney(shift.pay125)}</div>
                  <div>150%: {formatHours(shift.overtime150Hours)} שעות — {formatMoney(shift.pay150)}</div>

                  <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>
                    סה"כ למשמרת: {formatMoney(shift.totalPay)}
                  </div>

                  {shift.notes && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 10,
                        background: '#eef2ff',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <strong>הערות:</strong>
                      <div>{shift.notes}</div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button
                      onClick={() => handleEditShift(shift)}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        border: 'none',
                        background: '#f59e0b',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ערוך
                    </button>

                    <button
                      onClick={() => handleDeleteShift(shift.id)}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 10,
                        border: 'none',
                        background: '#dc2626',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      מחק
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 16,
            textAlign: 'center',
            color: '#6b7280',
            fontSize: 13,
          }}
        >
          הערה: בגרסת ה־MVP הזו החישוב בזמן אמת מבוסס על שעון המכשיר. חיבור לשעון שרת מדויק דורש backend נוסף.
        </div>
      </div>
    </div>
  );
}