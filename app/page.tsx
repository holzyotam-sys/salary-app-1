"use client";

import { useEffect, useState } from "react";

// ===== TYPES =====
type Shift = {
  id: string;
  start: number;
  end: number | null;
  hourlyRate: number;
  notes: string;
};

type Profile = {
  hourlyRate: number;
};

type Pension = {
  company: string;
  employeePercent: number;
  employerPercent: number;
  fundCompany: string;
};

// ===== HELPERS =====
function formatMoney(value: number) {
  return `₪${value.toFixed(2)}`;
}

function hoursBetween(start: number, end: number) {
  return (end - start) / (1000 * 60 * 60);
}

// ===== MAIN =====
export default function Home() {
  const [tab, setTab] = useState<"shifts" | "profile" | "pension">("shifts");

  const [profile, setProfile] = useState<Profile>({
    hourlyRate: 50,
  });

  const [pension, setPension] = useState<Pension>({
    company: "",
    employeePercent: 0,
    employerPercent: 0,
    fundCompany: "",
  });

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [now, setNow] = useState(Date.now());

  // ===== LOAD =====
  useEffect(() => {
    const savedShifts = localStorage.getItem("shifts");
    const savedProfile = localStorage.getItem("profile");
    const savedPension = localStorage.getItem("pension");

    if (savedShifts) setShifts(JSON.parse(savedShifts));
    if (savedProfile) setProfile(JSON.parse(savedProfile));
    if (savedPension) setPension(JSON.parse(savedPension));
  }, []);

  // ===== SAVE =====
  useEffect(() => {
    localStorage.setItem("shifts", JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem("profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("pension", JSON.stringify(pension));
  }, [pension]);

  // ===== CLOCK =====
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ===== ACTIONS =====
  const startShift = () => {
    const newShift: Shift = {
      id: Date.now().toString(),
      start: Date.now(),
      end: null,
      hourlyRate: profile.hourlyRate,
      notes: "",
    };
    setActiveShift(newShift);
  };

  const endShift = () => {
    if (!activeShift) return;
    const finished = { ...activeShift, end: Date.now() };
    setShifts([finished, ...shifts]);
    setActiveShift(null);
  };

  // ===== LIVE CALC =====
  let liveHours = 0;
  let liveMoney = 0;

  if (activeShift) {
    liveHours = hoursBetween(activeShift.start, now);
    liveMoney = liveHours * activeShift.hourlyRate;
  }

  // ===== UI =====
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f5f5f5",
        fontFamily: "Arial",
      }}
    >
      <div style={{ width: 400 }}>
        {/* ===== TABS ===== */}
        <div style={{ display: "flex", marginBottom: 20 }}>
          {["shifts", "profile", "pension"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              style={{
                flex: 1,
                padding: 10,
                background: tab === t ? "#000" : "#ddd",
                color: tab === t ? "#fff" : "#000",
                border: "none",
                cursor: "pointer",
              }}
            >
              {t === "shifts"
                ? "משמרות"
                : t === "profile"
                ? "טופס 101"
                : "פנסיה"}
            </button>
          ))}
        </div>

        {/* ===== SHIFTS ===== */}
        {tab === "shifts" && (
          <div style={card}>
            <h2>Work Calculator</h2>

            <p>תעריף נוכחי: ₪{profile.hourlyRate}</p>

            {!activeShift ? (
              <button onClick={startShift} style={btn}>
                כניסה למשמרת
              </button>
            ) : (
              <>
                <button onClick={endShift} style={btn}>
                  יציאה
                </button>

                <p>שעות: {liveHours.toFixed(2)}</p>
                <p>שכר: {formatMoney(liveMoney)}</p>
              </>
            )}

            <hr />

            {shifts.map((s) => {
              const hours = s.end
                ? hoursBetween(s.start, s.end)
                : 0;
              const salary = hours * s.hourlyRate;

              return (
                <div key={s.id} style={shiftCard}>
                  <p>תעריף: ₪{s.hourlyRate}</p>
                  <p>שעות: {hours.toFixed(2)}</p>
                  <p>שכר: {formatMoney(salary)}</p>

                  <textarea
                    placeholder="הערות"
                    value={s.notes}
                    onChange={(e) => {
                      setShifts(
                        shifts.map((x) =>
                          x.id === s.id
                            ? { ...x, notes: e.target.value }
                            : x
                        )
                      );
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ===== PROFILE ===== */}
        {tab === "profile" && (
          <div style={card}>
            <h2>טופס 101</h2>

            <label>שכר לשעה</label>
            <input
              type="number"
              value={profile.hourlyRate}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  hourlyRate: Number(e.target.value),
                })
              }
            />
          </div>
        )}

        {/* ===== PENSION ===== */}
        {tab === "pension" && (
          <div style={card}>
            <h2>פנסיה</h2>

            <input
              placeholder="חברה"
              value={pension.company}
              onChange={(e) =>
                setPension({ ...pension, company: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="% עובד"
              value={pension.employeePercent}
              onChange={(e) =>
                setPension({
                  ...pension,
                  employeePercent: Number(e.target.value),
                })
              }
            />

            <input
              type="number"
              placeholder="% מעסיק"
              value={pension.employerPercent}
              onChange={(e) =>
                setPension({
                  ...pension,
                  employerPercent: Number(e.target.value),
                })
              }
            />

            <input
              placeholder="קרן השתלמות"
              value={pension.fundCompany}
              onChange={(e) =>
                setPension({
                  ...pension,
                  fundCompany: e.target.value,
                })
              }
            />
          </div>
        )}
      </div>
    </main>
  );
}

// ===== STYLES =====
const card = {
  background: "#fff",
  padding: 20,
  borderRadius: 10,
  boxShadow: "0 0 10px rgba(0,0,0,0.1)",
};

const btn = {
  padding: 10,
  width: "100%",
  marginTop: 10,
  cursor: "pointer",
};

const shiftCard = {
  border: "1px solid #ddd",
  padding: 10,
  marginTop: 10,
};