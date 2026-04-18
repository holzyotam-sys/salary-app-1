"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calculateNetSalary } from "@/lib/netSalary";
import {
  buildTrackerProfile,
  calculateCreditPoints,
  createEmptyForm101,
  getAgeFromBirthDate,
  type ChildInfo,
  type Form101Data,
} from "@/lib/taxProfile";

type Shift = {
  id: string;
  start: number;
  end: number;
  salaryPerHour: number;
  note: string;
  unpaidBreakMs?: number;
};

type HolidayMap = Record<string, string>;

type HebcalItem = {
  date?: string;
  title?: string;
};

type HebcalResponse = {
  items?: HebcalItem[];
};

type UserAccount = {
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
};

type AppStep = "account" | "form101" | "tracker";
type AppView = "account" | "form101" | "tracker";

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

function getPaidDurationMs(
  start: number,
  end: number,
  unpaidBreakMs: number,
  activeBreakStart?: number | null,
  now?: number
) {
  const liveBreakMs =
    activeBreakStart && now && now > activeBreakStart ? now - activeBreakStart : 0;

  return Math.max(0, end - start - unpaidBreakMs - liveBreakMs);
}

function getActiveBreakDurationMs(
  activeBreakStart?: number | null,
  now?: number
) {
  if (!activeBreakStart || !now || now <= activeBreakStart) return 0;
  return now - activeBreakStart;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function getDefaultHourlyWageByAge(age: number): number {
  if (age >= 18) return 35.4;
  if (age === 17) return 29.38;
  if (age === 16) return 26.55;
  if (age > 0) return 24.78;
  return 35;
}

function calculateShift(shift: Shift, holidayMap: HolidayMap) {
  const totalHours =
    getPaidDurationMs(shift.start, shift.end, shift.unpaidBreakMs ?? 0) / 1000 / 60 / 60;

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

function createEmptyAccount(): UserAccount {
  return {
    phone: "",
    firstName: "",
    lastName: "",
    email: "",
  };
}

function monthLabel(month: number): string {
  const labels = [
    "",
    "ינואר",
    "פברואר",
    "מרץ",
    "אפריל",
    "מאי",
    "יוני",
    "יולי",
    "אוגוסט",
    "ספטמבר",
    "אוקטובר",
    "נובמבר",
    "דצמבר",
  ];
  return labels[month] ?? "";
}

const pageStyle = {
  width: "100%",
  paddingLeft: 24,
  paddingRight: 24,
  fontFamily:
    '"SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
  margin: "0 auto",
  background:
    "radial-gradient(circle at top, rgba(32, 86, 255, 0.16) 0%, rgba(7, 12, 25, 0) 32%), linear-gradient(180deg, #050811 0%, #0A1020 46%, #08111D 100%)",
  minHeight: "100vh",
  direction: "rtl" as const,
  color: "#F5F7FB",
  display: "flex",
  justifyContent: "center",
};

const appShellStyle = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  padding: "28px 0 40px",
};

const cardStyle = {
  background: "rgba(16, 24, 40, 0.62)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  borderRadius: 16,
  padding: "14px 16px",
  margin: "0 auto 14px",
  boxShadow: "0 18px 40px rgba(0, 0, 0, 0.28)",
  border: "1px solid rgba(255, 255, 255, 0.10)",
  width: "100%",
  maxWidth: 560,
  boxSizing: "border-box" as const,
  transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
};

const trackerStackStyle = {
  width: "100%",
  maxWidth: 560,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
};

const trackerInnerContentStyle = {
  width: "100%",
  maxWidth: 320,
  margin: "0 auto",
  textAlign: "center" as const,
};

const tintedCardStyle = {
  ...cardStyle,
  background: "linear-gradient(180deg, rgba(18, 41, 34, 0.72) 0%, rgba(11, 29, 32, 0.82) 100%)",
  border: "1px solid rgba(74, 222, 128, 0.18)",
};

const sectionTitleStyle = {
  margin: "0 0 12px",
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "#F8FBFF",
};

const bodyTextStyle = {
  fontSize: 15,
  lineHeight: 1.6,
  color: "#E8EEF8",
};

const secondaryTextStyle = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "#9AA8BC",
};

const moneyTextStyle = {
  color: "#1B8F3A",
  fontWeight: 700,
  fontSize: 24,
  letterSpacing: "-0.02em",
};

const moneyInlineStyle = {
  color: "#1B8F3A",
  fontWeight: 700,
};

const labelStyle = {
  ...secondaryTextStyle,
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
};

const fieldWrapperStyle = {
  marginBottom: 12,
};

const inputStyle = {
  width: "100%",
  maxWidth: 320,
  borderRadius: 12,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(255, 255, 255, 0.06)",
  padding: "10px 12px",
  fontSize: 15,
  color: "#F5F7FB",
  outline: "none",
};

const textareaStyle = {
  ...inputStyle,
  minHeight: 84,
  resize: "vertical" as const,
};

const primaryButtonStyle = {
  borderRadius: 999,
  border: "none",
  background: "#1B8F3A",
  color: "#FFFFFF",
  padding: "11px 18px",
  fontSize: 14,
  fontWeight: 700,
  boxShadow: "0 12px 24px rgba(27, 143, 58, 0.24)",
  cursor: "pointer",
  transition: "transform 160ms ease, box-shadow 160ms ease, background 160ms ease",
};

const secondaryButtonStyle = {
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(255, 255, 255, 0.06)",
  color: "#F5F7FB",
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
};

const subtleButtonStyle = {
  ...secondaryButtonStyle,
  padding: "8px 12px",
  fontSize: 13,
};

const moneyPanelStyle = {
  background: "linear-gradient(180deg, rgba(17, 45, 26, 0.76) 0%, rgba(12, 31, 20, 0.88) 100%)",
  border: "1px solid rgba(74, 222, 128, 0.16)",
  borderRadius: 14,
  padding: 14,
  marginTop: 12,
  marginBottom: 12,
};

export default function Home() {
  const [salaryManuallySet, setSalaryManuallySet] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("salaryManuallySet") === "true";
  });
  const [isMounted, setIsMounted] = useState(false);
  const [salary, setSalary] = useState<number>(() => {
    if (typeof window === "undefined") return 35;

    const savedWorking = localStorage.getItem("workingShift");
    const savedSalary = localStorage.getItem("defaultSalary");
    const savedForm101 = localStorage.getItem("form101Data");
    const manuallySet = localStorage.getItem("salaryManuallySet") === "true";

    if (savedWorking) {
      const parsed = JSON.parse(savedWorking);
      return Number(parsed.salary) || 35;
    }

    if (!manuallySet && savedForm101) {
      const parsedForm101 = {
        ...createEmptyForm101(),
        ...JSON.parse(savedForm101),
      };
      const age = getAgeFromBirthDate(parsedForm101.birthDate);
      if (age) {
        return getDefaultHourlyWageByAge(age);
      }
    }

    return savedSalary ? Number(savedSalary) : 35;
  });
  const [monthlyGoal] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const savedMonthlyGoal = localStorage.getItem("monthlyGoal");
    return savedMonthlyGoal ? Number(savedMonthlyGoal) : 0;
  });
  const [note, setNote] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const savedWorking = localStorage.getItem("workingShift");
    if (!savedWorking) return "";
    const parsed = JSON.parse(savedWorking);
    return parsed.note || "";
  });
  const [showBreakTooltip, setShowBreakTooltip] = useState(false);
  const [showCommuteTooltip, setShowCommuteTooltip] = useState(false);
  const [isWorking, setIsWorking] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const savedWorking = localStorage.getItem("workingShift");
    if (!savedWorking) return false;
    const parsed = JSON.parse(savedWorking);
    return Boolean(parsed.isWorking);
  });
  const [isOnBreak, setIsOnBreak] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const savedWorking = localStorage.getItem("workingShift");
    if (!savedWorking) return false;
    const parsed = JSON.parse(savedWorking);
    return Boolean(parsed.isOnBreak);
  });
  const [startTime, setStartTime] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const savedWorking = localStorage.getItem("workingShift");
    if (!savedWorking) return null;
    const parsed = JSON.parse(savedWorking);
    return parsed.startTime ?? null;
  });
  const [breakStartTime, setBreakStartTime] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const savedWorking = localStorage.getItem("workingShift");
    if (!savedWorking) return null;
    const parsed = JSON.parse(savedWorking);
    return parsed.breakStartTime ?? null;
  });
  const [unpaidBreakMs, setUnpaidBreakMs] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const savedWorking = localStorage.getItem("workingShift");
    if (!savedWorking) return 0;
    const parsed = JSON.parse(savedWorking);
    return parsed.unpaidBreakMs ?? 0;
  });
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [paidElapsed, setPaidElapsed] = useState(0);
  const [breakElapsed, setBreakElapsed] = useState(0);
  const [shifts, setShifts] = useState<Shift[]>(() => {
    if (typeof window === "undefined") return [];
    const savedShifts = localStorage.getItem("shifts");
    return savedShifts ? JSON.parse(savedShifts) : [];
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editSalary, setEditSalary] = useState<number>(35);
  const [editBreakMinutes, setEditBreakMinutes] = useState(0);
  const [editNote, setEditNote] = useState("");

  const [manualStartDate, setManualStartDate] = useState("");
  const [manualStartTime, setManualStartTime] = useState("08:00");
  const [manualEndDate, setManualEndDate] = useState("");
  const [manualEndTime, setManualEndTime] = useState("17:00");
  const [manualBreakMinutes, setManualBreakMinutes] = useState(0);
  const [manualNote, setManualNote] = useState("");

  const [holidayMap, setHolidayMap] = useState<HolidayMap>({});
  const [, setHolidayStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );

  const [account, setAccount] = useState<UserAccount>(() => {
    if (typeof window === "undefined") return createEmptyAccount();
    const savedAccount = localStorage.getItem("userAccount");
    return savedAccount ? JSON.parse(savedAccount) : createEmptyAccount();
  });
  const [form101, setForm101] = useState<Form101Data>(() => {
    if (typeof window === "undefined") return createEmptyForm101();
    const savedForm101 = localStorage.getItem("form101Data");
    return savedForm101
      ? { ...createEmptyForm101(), ...JSON.parse(savedForm101) }
      : createEmptyForm101();
  });

  const [currentView, setCurrentView] = useState<AppView>("tracker");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const breakTooltipRef = useRef<HTMLDivElement | null>(null);
  const commuteTooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsMounted(true);

      const currentNow = Date.now();
      const todayValue = formatDateOnlyValue(currentNow);

      setManualStartDate((prev) => prev || todayValue);
      setManualEndDate((prev) => prev || todayValue);
      setSelectedMonth((prev) => prev || getMonthKey(currentNow));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    localStorage.setItem("shifts", JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem("defaultSalary", String(salary));
  }, [salary]);

  useEffect(() => {
    localStorage.setItem("salaryManuallySet", String(salaryManuallySet));
  }, [salaryManuallySet]);

  useEffect(() => {
    localStorage.setItem(
      "workingShift",
      JSON.stringify({
        isWorking,
        startTime,
        note,
        salary,
        isOnBreak,
        breakStartTime,
        unpaidBreakMs,
      })
    );
  }, [isWorking, startTime, note, salary, isOnBreak, breakStartTime, unpaidBreakMs]);

  useEffect(() => {
    localStorage.setItem("userAccount", JSON.stringify(account));
  }, [account]);

  useEffect(() => {
    localStorage.setItem("form101Data", JSON.stringify(form101));
  }, [form101]);

  useEffect(() => {
    if (!isMounted) return;

    function updateElapsedTimes() {
      if (!isWorking || !startTime) {
        setTotalElapsed(0);
        setPaidElapsed(0);
        setBreakElapsed(0);
        return;
      }

      const currentNow = Date.now();
      const currentBreakMs = isOnBreak ? getActiveBreakDurationMs(breakStartTime, currentNow) : 0;
      const accumulatedBreakMs = unpaidBreakMs + currentBreakMs;

      setTotalElapsed(Math.max(0, currentNow - startTime));
      setBreakElapsed(accumulatedBreakMs);
      setPaidElapsed(
        getPaidDurationMs(startTime, currentNow, unpaidBreakMs, breakStartTime, currentNow)
      );
    }

    updateElapsedTimes();
    const interval = setInterval(updateElapsedTimes, 1000);

    return () => clearInterval(interval);
  }, [isMounted, isWorking, startTime, isOnBreak, breakStartTime, unpaidBreakMs]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        showBreakTooltip &&
        breakTooltipRef.current &&
        !breakTooltipRef.current.contains(event.target as Node)
      ) {
        setShowBreakTooltip(false);
      }

      if (
        showCommuteTooltip &&
        commuteTooltipRef.current &&
        !commuteTooltipRef.current.contains(event.target as Node)
      ) {
        setShowCommuteTooltip(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showBreakTooltip, showCommuteTooltip]);

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

  const accountComplete = useMemo(() => {
    return Boolean(
      account.phone.trim() &&
        account.firstName.trim() &&
        account.lastName.trim() &&
        account.email.trim()
    );
  }, [account]);

  const form101Complete = useMemo(() => {
    return form101.pensionPercent >= 0 && form101.trainingFundPercent >= 0;
  }, [form101]);

  const initialStep: AppStep = !accountComplete
    ? "account"
    : !form101Complete
    ? "form101"
    : "tracker";
  const activeView: AppView =
    initialStep === "account"
      ? "account"
      : initialStep === "form101"
      ? "form101"
      : currentView;

  function startShift() {
    setStartTime(Date.now());
    setIsWorking(true);
    setIsOnBreak(false);
    setBreakStartTime(null);
    setUnpaidBreakMs(0);
  }

  function endShift() {
    if (!startTime) return;

    const end = Date.now();
    if (end <= startTime) return;

    const finalUnpaidBreakMs =
      unpaidBreakMs +
      (isOnBreak && breakStartTime && end > breakStartTime ? end - breakStartTime : 0);

    const newShift: Shift = {
      id: crypto.randomUUID(),
      start: startTime,
      end,
      salaryPerHour: salary,
      note,
      unpaidBreakMs: finalUnpaidBreakMs,
    };

    setShifts((prev) => [newShift, ...prev]);
    setIsWorking(false);
    setIsOnBreak(false);
    setStartTime(null);
    setBreakStartTime(null);
    setUnpaidBreakMs(0);
    setNote("");
  }

  function toggleBreak() {
    if (!isWorking) return;

    const timestamp = Date.now();

    if (isOnBreak) {
      setUnpaidBreakMs((prev) =>
        prev + (breakStartTime && timestamp > breakStartTime ? timestamp - breakStartTime : 0)
      );
      setBreakStartTime(null);
      setIsOnBreak(false);
      return;
    }

    setBreakStartTime(timestamp);
    setIsOnBreak(true);
  }

  function addManualShift() {
    if (!manualStartDate || !manualStartTime || !manualEndDate || !manualEndTime) return;

    const start = buildTimestamp(manualStartDate, manualStartTime);
    const end = buildTimestamp(manualEndDate, manualEndTime);

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return;

    const totalShiftMs = end - start;
    const safeBreakMinutes = Math.max(0, manualBreakMinutes);
    const unpaidBreakMs = Math.min(totalShiftMs, safeBreakMinutes * 60 * 1000);

    const newShift: Shift = {
      id: crypto.randomUUID(),
      start,
      end,
      salaryPerHour: salary,
      note: manualNote,
      unpaidBreakMs,
    };

    setShifts((prev) => [newShift, ...prev]);
    setManualBreakMinutes(0);
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
    setEditBreakMinutes(Math.round((shift.unpaidBreakMs ?? 0) / 1000 / 60));
    setEditNote(shift.note);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditStart("");
    setEditEnd("");
    setEditSalary(35);
    setEditBreakMinutes(0);
    setEditNote("");
  }

  function saveEdit() {
    if (!editingId) return;

    const start = new Date(editStart).getTime();
    const end = new Date(editEnd).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return;

    const totalShiftMs = end - start;
    const safeBreakMinutes = Math.max(0, editBreakMinutes);
    const unpaidBreakMs = Math.min(totalShiftMs, safeBreakMinutes * 60 * 1000);

    setShifts((prev) =>
      prev.map((shift) =>
        shift.id === editingId
          ? {
              ...shift,
              start,
              end,
              salaryPerHour: editSalary,
              unpaidBreakMs,
              note: editNote,
            }
          : shift
      )
    );

    cancelEdit();
  }

  function addChild() {
    setForm101((prev) => ({
      ...prev,
      children: [
        ...prev.children,
        {
          id: crypto.randomUUID(),
          birthDay: 1,
          birthMonth: 1,
          birthYear: new Date().getFullYear(),
        },
      ],
    }));
  }

  function updateChildField(
    id: string,
    field: "birthDay" | "birthMonth" | "birthYear",
    value: number
  ) {
    setForm101((prev) => ({
      ...prev,
      children: prev.children.map((child) =>
        child.id === id ? { ...child, [field]: value } : child
      ),
    }));
  }

  function removeChild(id: string) {
    setForm101((prev) => ({
      ...prev,
      children: prev.children.filter((child) => child.id !== id),
    }));
  }

  const trackerProfile = useMemo(() => {
    return buildTrackerProfile(form101);
  }, [form101]);

  const currentAge = useMemo(() => {
    return getAgeFromBirthDate(form101.birthDate);
  }, [form101.birthDate]);

  const liveShiftTotalMs = useMemo(() => {
    return totalElapsed;
  }, [totalElapsed]);

  const liveBreakTotalMs = useMemo(() => {
    return breakElapsed;
  }, [breakElapsed]);

  const livePaidWorkMs = useMemo(() => {
    return paidElapsed;
  }, [paidElapsed]);

  const liveMoney = useMemo(() => {
    if (!isWorking || !startTime) return 0;

    const liveShift: Shift = {
      id: "live",
      start: startTime,
      end: startTime + liveShiftTotalMs,
      salaryPerHour: salary,
      note,
      unpaidBreakMs: liveBreakTotalMs,
    };

    return calculateShift(liveShift, holidayMap).totalPay;
  }, [isWorking, startTime, liveShiftTotalMs, salary, note, holidayMap, liveBreakTotalMs]);

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
      creditPoints: trackerProfile.creditPoints,
      pensionPercent: trackerProfile.pensionPercent,
      trainingFundPercent: trackerProfile.trainingFundPercent,
    });

    return {
      totalHours,
      regularHours,
      overtime125Hours,
      overtime150Hours,
      ...net,
      shiftsCount: monthlyShifts.length,
    };
  }, [monthlyShifts, trackerProfile]);

  const endOfMonthInsight = useMemo(() => {
    const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
    const selectedDate = new Date(selectedYear, selectedMonthNumber - 1, 1);
    const previousMonthKey = getMonthKey(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1).getTime()
    );
    const previousMonthGross = shiftsWithCalc
      .filter(({ shift }) => getMonthKey(shift.start) === previousMonthKey)
      .reduce((sum, item) => sum + item.calc.totalPay, 0);
    const crossedHigherTaxBracket = monthlySummary.currentBracketRate > 0.14;
    const title = form101.gender === "female" ? "אלופה 💪" : "תותח 💪";

    const taxBracketMessage = crossedHigherTaxBracket
      ? `היי ${title} 👏

הגעת למדרגת מס חדשה — זה אומר שאתה מרוויח יותר מהרגיל.

מה זה אומר בפועל:
השכר שכבר הרווחת לא משתנה,
וההכנסה החדשה ממשיכה להגדיל את הסכום הכולל שלך.

כדי למקסם את החודש:
כדאי להתמקד בהגעה ליעד החודשי שהגדרנו מראש! 🎯`
      : null;

    let motivationMessage = "אתה מתקדם בקצב יציב — המשך כך 💪";

    if (monthlyGoal > 0) {
      const remainingToGoal = Math.max(0, monthlyGoal - monthlySummary.gross);

      if (remainingToGoal > 0 && remainingToGoal <= salary * 8) {
        motivationMessage = `חסרים לך רק ${formatMoney(remainingToGoal)}
עוד משמרת אחת ואתה סוגר את היעד 💪`;
      } else {
        const progress = monthlySummary.gross / monthlyGoal;

        if (progress >= 0.7 && progress < 1) {
          motivationMessage = `אתה כבר ב-${(progress * 100).toFixed(0)}% מהיעד החודשי שלך 🚀
עוד קצת ואתה שם`;
        } else if (previousMonthGross > 0 && monthlySummary.gross > previousMonthGross) {
          motivationMessage = `אתה מרוויח יותר מהחודש הקודם 📈
הקצב שלך מצוין`;
        }
      }
    } else if (previousMonthGross > 0 && monthlySummary.gross > previousMonthGross) {
      motivationMessage = `אתה מרוויח יותר מהחודש הקודם 📈
הקצב שלך מצוין`;
    }

    return {
      taxBracketMessage,
      motivationMessage,
    };
  }, [form101.gender, monthlyGoal, monthlySummary.currentBracketRate, monthlySummary.gross, salary, selectedMonth, shiftsWithCalc]);

  function renderTopNav() {
    if (initialStep === "account") return null;
    if (initialStep === "form101" && activeView !== "form101") return null;

    return (
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <button style={secondaryButtonStyle} onClick={() => setCurrentView("account")}>
          פרטי משתמש
        </button>
        <button style={secondaryButtonStyle} onClick={() => setCurrentView("form101")}>
          טופס 101
        </button>
        {accountComplete && form101Complete && (
          <button style={primaryButtonStyle} onClick={() => setCurrentView("tracker")}>
            מעקב עבודה
          </button>
        )}
      </div>
    );
  }

  function renderAccountView() {
    return (
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>שלב 1 — יצירת משתמש</h2>

        <div style={fieldWrapperStyle}>
          <label style={labelStyle}>מספר טלפון</label>
          <input
            style={inputStyle}
            type="tel"
            value={account.phone}
            onChange={(e) =>
              setAccount((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
        </div>

        <div style={fieldWrapperStyle}>
          <label style={labelStyle}>שם פרטי</label>
          <input
            style={inputStyle}
            type="text"
            value={account.firstName}
            onChange={(e) =>
              setAccount((prev) => ({ ...prev, firstName: e.target.value }))
            }
          />
        </div>

        <div style={fieldWrapperStyle}>
          <label style={labelStyle}>שם משפחה</label>
          <input
            style={inputStyle}
            type="text"
            value={account.lastName}
            onChange={(e) =>
              setAccount((prev) => ({ ...prev, lastName: e.target.value }))
            }
          />
        </div>

        <div style={fieldWrapperStyle}>
          <label style={labelStyle}>מייל</label>
          <input
            style={inputStyle}
            type="email"
            value={account.email}
            onChange={(e) =>
              setAccount((prev) => ({ ...prev, email: e.target.value }))
            }
          />
        </div>

        <button
          style={primaryButtonStyle}
          onClick={() => {
            if (!accountComplete) return;
            setCurrentView("form101");
          }}
          disabled={!accountComplete}
        >
          המשך לטופס 101
        </button>
      </div>
    );
  }

  function renderForm101View() {
    return (
      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>שלב 2 — טופס 101 חכם</h2>

        <div style={{ marginBottom: 10 }}>
          <label>תושב ישראל</label>
          <br />
          <select
            value={form101.israelResident ? "yes" : "no"}
            onChange={(e) =>
              setForm101((prev) => ({
                ...prev,
                israelResident: e.target.value === "yes",
              }))
            }
          >
            <option value="yes">כן</option>
            <option value="no">לא</option>
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>מין</label>
          <br />
          <select
            value={form101.gender}
            onChange={(e) =>
              setForm101((prev) => ({
                ...prev,
                gender: e.target.value as Form101Data["gender"],
              }))
            }
          >
            <option value="male">גבר</option>
            <option value="female">אישה</option>
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>מצב משפחתי</label>
          <br />
          <select
            value={form101.maritalStatus}
            onChange={(e) =>
              setForm101((prev) => ({
                ...prev,
                maritalStatus: e.target.value as Form101Data["maritalStatus"],
              }))
            }
          >
            <option value="single">רווק/ה</option>
            <option value="married">נשוי/אה</option>
            <option value="divorced">גרוש/ה</option>
            <option value="widowed">אלמן/ה</option>
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>תאריך לידה</label>
          <br />
          <input
            type="date"
            value={form101.birthDate}
            onChange={(e) => {
              const nextBirthDate = e.target.value;
              setForm101((prev) => ({
                ...prev,
                birthDate: nextBirthDate,
              }));

              if (!salaryManuallySet && !isWorking) {
                const age = getAgeFromBirthDate(nextBirthDate);
                if (age) {
                  setSalary(getDefaultHourlyWageByAge(age));
                }
              }
            }}
          />
          {currentAge > 0 && <p style={{ marginTop: 6 }}>גיל מחושב: {currentAge}</p>}
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>בן/בת זוג עובד/ת</label>
          <br />
          <select
            value={form101.spouseWorks ? "yes" : "no"}
            onChange={(e) =>
              setForm101((prev) => ({
                ...prev,
                spouseWorks: e.target.value === "yes",
              }))
            }
          >
            <option value="no">לא</option>
            <option value="yes">כן</option>
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>הכנסה חודשית משוערת של בן/בת זוג (ברוטו)</label>
          <br />
          <input
            type="number"
            value={form101.spouseMonthlyIncome}
            onChange={(e) =>
              setForm101((prev) => ({
                ...prev,
                spouseMonthlyIncome: Number(e.target.value),
              }))
            }
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <label>נסיעות ליום</label>
            <div
              ref={commuteTooltipRef}
              style={{ position: "relative", display: "inline-block" }}
            >
              <button
                type="button"
                onClick={() => setShowCommuteTooltip((prev) => !prev)}
              >
                ❓
              </button>

              {showCommuteTooltip && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 8,
                    background: "#fff",
                    border: "1px solid #ccc",
                    padding: 12,
                    width: 260,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
                    whiteSpace: "pre-line",
                    zIndex: 10,
                  }}
                >
                  {`נסיעות הן בדרך כלל תשלום שהמעסיק מחויב לשלם לפי ימי עבודה בפועל, עד תקרה יומית מקובלת.`}
                </div>
              )}
            </div>
          </div>
          <input
            type="number"
            step="0.01"
            value={form101.commutePerDay}
            onChange={(e) =>
              setForm101((prev) => ({
                ...prev,
                commutePerDay: Number(e.target.value),
              }))
            }
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>הורה יחיד</label>
          <br />
          <select
            value={form101.singleParent ? "yes" : "no"}
            onChange={(e) =>
              setForm101((prev) => ({
                ...prev,
                singleParent: e.target.value === "yes",
              }))
            }
          >
            <option value="no">לא</option>
            <option value="yes">כן</option>
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>ילדים</label>
          <br />
          <button onClick={addChild} type="button">
            + הוסף ילד
          </button>

          <div style={{ marginTop: 10 }}>
            {form101.children.length === 0 && <p>לא הוזנו ילדים</p>}

            {form101.children.map((child: ChildInfo, index: number) => (
              <div
                key={child.id}
                style={{
                  border: "1px solid #ddd",
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                <div style={{ marginBottom: 8 }}>ילד {index + 1}</div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "end",
                  }}
                >
                  <div>
                    <label>יום</label>
                    <br />
                    <select
                      value={child.birthDay}
                      onChange={(e) =>
                        updateChildField(child.id, "birthDay", Number(e.target.value))
                      }
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label>חודש</label>
                    <br />
                    <select
                      value={child.birthMonth}
                      onChange={(e) =>
                        updateChildField(child.id, "birthMonth", Number(e.target.value))
                      }
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <option key={month} value={month}>
                          {monthLabel(month)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label>שנה</label>
                    <br />
                    <select
                      value={child.birthYear}
                      onChange={(e) =>
                        updateChildField(child.id, "birthYear", Number(e.target.value))
                      }
                    >
                      {Array.from(
                        { length: new Date().getFullYear() - 1980 + 1 },
                        (_, i) => new Date().getFullYear() - i
                      ).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <button type="button" onClick={() => removeChild(child.id)}>
                      מחק
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {form101.children.length > 0 && (
          <>
            <div style={{ marginBottom: 10 }}>
              <label>מי מקבל נקודות ילדים</label>
              <br />
              <select
                value={form101.childPointsReceiver}
                onChange={(e) =>
                  setForm101((prev) => ({
                    ...prev,
                    childPointsReceiver: e.target.value as Form101Data["childPointsReceiver"],
                  }))
                }
              >
                <option value="me">אני</option>
                <option value="spouse">בן/בת זוג</option>
                <option value="split">חלוקה</option>
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label>איפה גרים הילדים</label>
              <br />
              <select
                value={form101.childrenLivingWith}
                onChange={(e) =>
                  setForm101((prev) => ({
                    ...prev,
                    childrenLivingWith: e.target.value as Form101Data["childrenLivingWith"],
                  }))
                }
              >
                <option value="me">אצלי</option>
                <option value="other">אצל ההורה השני</option>
                <option value="shared">משמורת משותפת</option>
              </select>
            </div>
          </>
        )}

        {form101.maritalStatus === "divorced" && (
          <>
            <div style={{ marginBottom: 10 }}>
              <label>משלם מזונות</label>
              <br />
              <select
                value={form101.paysAlimony ? "yes" : "no"}
                onChange={(e) =>
                  setForm101((prev) => ({
                    ...prev,
                    paysAlimony: e.target.value === "yes",
                  }))
                }
              >
                <option value="no">לא</option>
                <option value="yes">כן</option>
              </select>
            </div>

            {form101.paysAlimony && (
              <div style={{ marginBottom: 10 }}>
                <label>סכום מזונות חודשי</label>
                <br />
                <input
                  type="number"
                  value={form101.alimonyAmount}
                  onChange={(e) =>
                    setForm101((prev) => ({
                      ...prev,
                      alimonyAmount: Number(e.target.value),
                    }))
                  }
                />
              </div>
            )}
          </>
        )}

        <div style={{ marginBottom: 10 }}>
          <label>אחוז פנסיה עובד</label>
          <br />
          <input
            type="number"
            step="0.1"
            value={form101.pensionPercent}
            onChange={(e) =>
              setForm101((prev) => ({
                ...prev,
                pensionPercent: Number(e.target.value),
              }))
            }
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>אחוז קרן השתלמות עובד</label>
          <br />
          <input
            type="number"
            step="0.1"
            value={form101.trainingFundPercent}
            onChange={(e) =>
              setForm101((prev) => ({
                ...prev,
                trainingFundPercent: Number(e.target.value),
              }))
            }
          />
        </div>

        <hr />

        <p>
          <b>נקודות זיכוי מחושבות: {calculateCreditPoints(form101)}</b>
        </p>

        <button
          onClick={() => {
            if (!form101Complete) return;
            setCurrentView("tracker");
          }}
        >
          המשך למעקב עבודה
        </button>
      </div>
    );
  }

  function renderTrackerView() {
    return (
      <div style={trackerStackStyle}>
        <div className="glass-card hero-card" style={cardStyle}>
          <div style={trackerInnerContentStyle}>
            <h2 style={{ ...sectionTitleStyle, textAlign: "center" }}>סיכום חודשי</h2>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 6 }}>חודש נבחר:</label>
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

            <p style={{ ...secondaryTextStyle, marginBottom: 8, textAlign: "center" }}>
              ברוטו חודשי
            </p>
            <p style={{ ...moneyTextStyle, fontSize: 22, marginTop: 0, marginBottom: 8, textAlign: "center" }}>
              {formatMoney(monthlySummary.gross)}
            </p>
            <p style={{ ...secondaryTextStyle, marginBottom: 6, textAlign: "center" }}>
              נטו חודשי
            </p>
            <p style={{ ...moneyTextStyle, fontSize: 42, marginTop: 0, marginBottom: 12, textAlign: "center" }}>
              {formatMoney(monthlySummary.net)}
            </p>
            <p style={{ ...secondaryTextStyle, textAlign: "center", marginTop: 0 }}>
              תמונת מצב חודשית ברורה ומדויקת
            </p>

            <details style={{ marginTop: 12, textAlign: "center" }}>
              <summary>לפירוט שעות</summary>
              <p>כמות משמרות בחודש: {monthlySummary.shiftsCount}</p>
              <p>סה״כ שעות בחודש: {monthlySummary.totalHours.toFixed(2)}</p>
              <p>שעות רגילות: {monthlySummary.regularHours.toFixed(2)}</p>
              <p>שעות 125%: {monthlySummary.overtime125Hours.toFixed(2)}</p>
              <p>שעות 150%: {monthlySummary.overtime150Hours.toFixed(2)}</p>
            </details>

            <details style={{ marginTop: 12, textAlign: "center" }}>
              <summary>לפירוט הורדות</summary>
              <p>מס הכנסה חודשי: {formatMoney(monthlySummary.incomeTax)}</p>
              <p>ביטוח לאומי חודשי: {formatMoney(monthlySummary.bituach)}</p>
              <p>פנסיה חודשית: {formatMoney(monthlySummary.pension)}</p>
              <p>השתלמות חודשית: {formatMoney(monthlySummary.training)}</p>
            </details>

            <details style={{ marginTop: 12, textAlign: "center" }}>
              <summary>תובנות</summary>
              <p>מדרגת מס נוכחית: {(monthlySummary.currentBracketRate * 100).toFixed(0)}%</p>
              <p>חסר למדרגה הבאה: {formatMoney(monthlySummary.grossToNextBracket)}</p>
              <p>
                חסר למדרגה הבאה בשעות:{" "}
                {salary > 0 ? (monthlySummary.grossToNextBracket / salary).toFixed(2) : "0.00"} שעות
              </p>
              <p>
                מעל הרף התחתון של המדרגה הנוכחית:{" "}
                {formatMoney(monthlySummary.grossAboveCurrentBracketMin)}
              </p>
              <p>
                מעל הרף התחתון בשעות:{" "}
                {salary > 0
                  ? (monthlySummary.grossAboveCurrentBracketMin / salary).toFixed(2)
                  : "0.00"}{" "}
                שעות
              </p>
            </details>
          </div>
        </div>

        <div className="glass-card" style={tintedCardStyle}>
          <div style={trackerInnerContentStyle}>
            <h2 style={{ ...sectionTitleStyle, textAlign: "center" }}>בינה אמיתית 😉</h2>
            {endOfMonthInsight.taxBracketMessage && (
              <p style={{ ...bodyTextStyle, whiteSpace: "pre-line", textAlign: "center" }}>{endOfMonthInsight.taxBracketMessage}</p>
            )}
            <p style={{ ...bodyTextStyle, whiteSpace: "pre-line", textAlign: "center" }}>{endOfMonthInsight.motivationMessage}</p>
          </div>
        </div>

        <div className="glass-card" style={cardStyle}>
          <div style={trackerInnerContentStyle}>
            <h2 style={{ ...sectionTitleStyle, textAlign: "center" }}>משמרת פעילה</h2>
            <div style={fieldWrapperStyle}>
              <label style={{ ...labelStyle, textAlign: "center" }}>שכר בסיס לשעה</label>
              <input
                style={{ ...inputStyle, margin: "0 auto" }}
                type="number"
                value={salary}
                onChange={(e) => {
                  setSalary(Number(e.target.value));
                  setSalaryManuallySet(true);
                }}
              />
            </div>

            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {!isWorking ? (
                <button className="premium-button primary-button" style={primaryButtonStyle} onClick={startShift}>כניסה</button>
              ) : (
                <button className="premium-button primary-button" style={primaryButtonStyle} onClick={endShift}>יציאה</button>
              )}

              <button className="premium-button secondary-button" style={secondaryButtonStyle} type="button" onClick={toggleBreak} disabled={!isWorking}>
                {isOnBreak ? "חזרה מהפסקה" : "הפסקה"}
              </button>

              <div ref={breakTooltipRef} style={{ position: "relative", display: "inline-block" }}>
                <button className="premium-button secondary-button" style={subtleButtonStyle} type="button" onClick={() => setShowBreakTooltip((prev) => !prev)}>
                  ❓
                </button>

                {showBreakTooltip && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: "50%",
                      transform: "translateX(50%)",
                      marginTop: 8,
                      background: "#fff",
                      border: "1px solid #ccc",
                      padding: 12,
                      width: 260,
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
                      whiteSpace: "pre-line",
                      zIndex: 10,
                      textAlign: "center",
                    }}
                  >
                    {`הפסקה לא משולמת ⏱️

אתה לא מקבל עליה שכר,
והיא דוחה את תחילת השעות הנוספות.

חשוב להבין מול מעסיקך,
האם הפסקות משולמות בשכר שלך או שלא.`}
                  </div>
                )}
              </div>
            </div>

            <div style={fieldWrapperStyle}>
              <textarea
                placeholder="הערות למשמרת"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ ...textareaStyle, maxWidth: 320, margin: "0 auto" }}
              />
            </div>

            <div style={moneyPanelStyle}>
              <p style={{ ...secondaryTextStyle, margin: "0 0 6px", textAlign: "center" }}>כסף בזמן אמת</p>
              <h2 style={{ ...moneyTextStyle, margin: 0, textAlign: "center" }}>{formatMoney(liveMoney)}</h2>
            </div>
            <p style={{ ...secondaryTextStyle, textAlign: "center" }}>{isWorking ? "🟢 עובד עכשיו" : "⚪ לא עובד"}</p>
            {isOnBreak && (
              <p style={{ ...bodyTextStyle, textAlign: "center" }}>
                בהפסקה — אתה עדיין בתוך המשמרת, אבל ההפסקה לא נספרת בשכר ולא בחישוב השעות הנוספות.
              </p>
            )}
            <div style={{ marginBottom: 0 }}>
              <p style={{ ...bodyTextStyle, textAlign: "center" }}>זמן משמרת כולל: <span style={{ fontWeight: 700 }}>{formatDuration(liveShiftTotalMs)}</span></p>
              <p style={{ ...bodyTextStyle, textAlign: "center" }}>זמן עבודה משולם: <span style={{ fontWeight: 700 }}>{formatDuration(livePaidWorkMs)}</span></p>
              <p style={{ ...bodyTextStyle, textAlign: "center" }}>זמן הפסקות: <span style={{ fontWeight: 700 }}>{formatDuration(liveBreakTotalMs)}</span></p>
            </div>
          </div>
        </div>

        <div className="glass-card" style={cardStyle}>
          <div style={trackerInnerContentStyle}>
            <h2 style={{ ...sectionTitleStyle, textAlign: "center" }}>➕ הוספה ידנית</h2>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, textAlign: "center" }}>תאריך התחלה</label>
                <input
                  type="date"
                  value={manualStartDate}
                  onChange={(e) => setManualStartDate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, textAlign: "center" }}>שעת התחלה</label>
                <input
                  type="time"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, textAlign: "center" }}>תאריך סיום</label>
                <input
                  type="date"
                  value={manualEndDate}
                  onChange={(e) => setManualEndDate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, textAlign: "center" }}>שעת סיום</label>
                <input
                  type="time"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, textAlign: "center" }}>משך הפסקה (בדקות)</label>
                <input
                  type="number"
                  min="0"
                  value={manualBreakMinutes}
                  onChange={(e) => setManualBreakMinutes(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "center" }}>
                <button className="premium-button primary-button" style={primaryButtonStyle} onClick={addManualShift}>הוסף</button>
              </div>
            </div>

            <textarea
              placeholder="הערות ליום ידני"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              style={{ ...textareaStyle, maxWidth: 320, margin: "0 auto" }}
            />
          </div>
        </div>

        <h2 style={{ ...sectionTitleStyle, textAlign: "center" }}>משמרות</h2>

        {shifts.length === 0 && <p style={{ textAlign: "center" }}>אין עדיין משמרות</p>}

        {shifts.map((shift) => {
          const c = calculateShift(shift, holidayMap);

          const netData = calculateNetSalary(c.totalPay, {
            creditPoints: trackerProfile.creditPoints,
            pensionPercent: trackerProfile.pensionPercent,
            trainingFundPercent: trackerProfile.trainingFundPercent,
          });

          if (editingId === shift.id) {
            return (
              <div
                key={shift.id}
                className="glass-card"
                style={{
                  ...cardStyle,
                  border: "1px solid rgba(74, 222, 128, 0.22)",
                }}
              >
                <div style={trackerInnerContentStyle}>
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
                    <label>זמן הפסקה (בדקות)</label>
                    <br />
                    <input
                      type="number"
                      min="0"
                      value={editBreakMinutes}
                      onChange={(e) =>
                        setEditBreakMinutes(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      style={{ width: 260, height: 60, margin: "0 auto" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                    <button className="premium-button primary-button" style={primaryButtonStyle} onClick={saveEdit}>
                      שמור
                    </button>
                    <button className="premium-button secondary-button" style={secondaryButtonStyle} onClick={cancelEdit}>ביטול</button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              className="glass-card"
              key={shift.id}
              style={{
                ...cardStyle,
              }}
            >
              <div style={trackerInnerContentStyle}>
                <p style={{ ...bodyTextStyle, textAlign: "center" }}>
                  {formatDateTime(shift.start)} → {formatTimeOnly(shift.end)}
                </p>

                <p style={{ ...bodyTextStyle, textAlign: "center" }}>סוג יום: {c.dayTypeLabel}</p>
                {c.saturday && <p style={{ ...bodyTextStyle, textAlign: "center" }}>🔥 תעריף שבת 150%</p>}
                {c.holiday && <p style={{ ...bodyTextStyle, textAlign: "center" }}>🎉 תעריף חג 150%</p>}

                <p style={{ ...bodyTextStyle, textAlign: "center" }}>סה&quot;כ שעות: <span style={{ fontWeight: 700 }}>{c.totalHours.toFixed(2)}</span></p>
                <p style={{ ...bodyTextStyle, textAlign: "center" }}>זמן הפסקה: {Math.round((shift.unpaidBreakMs ?? 0) / 1000 / 60)} דקות</p>

                <p style={{ ...bodyTextStyle, textAlign: "center" }}>
                  שעות רגילות: {c.regularHours.toFixed(2)} | שכר רגיל:{" "}
                  <span style={moneyInlineStyle}>{formatMoney(c.regularPay)}</span>
                </p>

                <p style={{ ...bodyTextStyle, textAlign: "center" }}>
                  שעות 125%: {c.overtime125Hours.toFixed(2)} | שכר 125%:{" "}
                  <span style={moneyInlineStyle}>{formatMoney(c.overtime125Pay)}</span>
                </p>

                <p style={{ ...bodyTextStyle, textAlign: "center" }}>
                  שעות 150%: {c.overtime150Hours.toFixed(2)} | שכר 150%:{" "}
                  <span style={moneyInlineStyle}>{formatMoney(c.overtime150Pay)}</span>
                </p>

                <p style={{ ...bodyTextStyle, textAlign: "center" }}>שכר כולל: <span style={moneyInlineStyle}>{formatMoney(c.totalPay)}</span></p>
                <p style={{ ...bodyTextStyle, textAlign: "center" }}>מס הכנסה: {formatMoney(netData.incomeTax)}</p>
                <p style={{ ...bodyTextStyle, textAlign: "center" }}>ביטוח לאומי: {formatMoney(netData.bituach)}</p>
                <p style={{ ...bodyTextStyle, textAlign: "center" }}>פנסיה עובד: {formatMoney(netData.pension)}</p>
                <p style={{ ...bodyTextStyle, textAlign: "center" }}>השתלמות עובד: {formatMoney(netData.training)}</p>
                <p style={{ ...bodyTextStyle, textAlign: "center" }}>
                  <b>נטו: <span style={moneyInlineStyle}>{formatMoney(netData.net)}</span></b>
                </p>

                <p style={{ ...secondaryTextStyle, textAlign: "center" }}>תעריף בסיס שנשמר: {formatMoney(shift.salaryPerHour)}</p>
                <p style={{ ...secondaryTextStyle, textAlign: "center" }}>תעריף אפקטיבי ליום הזה: {formatMoney(c.effectiveBaseRate)}</p>
                <p style={{ ...secondaryTextStyle, textAlign: "center" }}>הערות: {shift.note || "-"}</p>

                <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                  <button className="premium-button secondary-button" style={secondaryButtonStyle} onClick={() => beginEdit(shift)}>
                    ✏️ ערוך
                  </button>
                  <button className="premium-button secondary-button" style={secondaryButtonStyle} onClick={() => deleteShift(shift.id)}>🗑 מחק</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (!isMounted) {
    return null;
  }

  return (
    <main
      style={pageStyle}
    >
      <style jsx global>{`
        .glass-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 22px 48px rgba(0, 0, 0, 0.34);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .premium-button:hover {
          transform: translateY(-1px);
        }

        .primary-button:hover {
          background: #22a046;
          box-shadow: 0 16px 28px rgba(27, 143, 58, 0.28);
        }

        .secondary-button:hover {
          border-color: rgba(255, 255, 255, 0.22);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.18);
        }

        summary {
          cursor: pointer;
          color: #f5f7fb;
          font-weight: 600;
        }

        input,
        select,
        textarea {
          color-scheme: dark;
        }
      `}</style>
      <div style={appShellStyle}>
        <h1 style={{ ...sectionTitleStyle, fontSize: 30, marginBottom: 10, color: "#FFFFFF" }}>Work Tracker</h1>
        <p style={{ ...secondaryTextStyle, marginTop: 0, marginBottom: 24 }}>
          שליטה ברורה, רגועה ומדויקת על השכר, המשמרות וההתקדמות שלך.
        </p>

        {renderTopNav()}

        {activeView === "account" && renderAccountView()}
        {activeView === "form101" && renderForm101View()}
        {activeView === "tracker" && accountComplete && form101Complete && renderTrackerView()}
      </div>
    </main>
  );
}
