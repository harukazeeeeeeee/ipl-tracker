import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const PARTS = {
  beard: {
    id: "beard", label: "髭", icon: "🧔", color: "#c0735a", bg: "#fdf2ee",
    curve: [
      { week: 0, density: 100 }, { week: 2, density: 98 }, { week: 4, density: 93 },
      { week: 8, density: 83 }, { week: 12, density: 70 }, { week: 16, density: 58 },
      { week: 20, density: 50 }, { week: 24, density: 43 }, { week: 30, density: 36 },
      { week: 36, density: 30 }, { week: 44, density: 25 }, { week: 52, density: 22 },
    ],
    schedule: { intensive: 7, stable: 21, maintenance: 30 },
    milestones: [
      { week: 4, text: "産毛化し始める部位が出てくる", emoji: "🌱" },
      { week: 12, text: "全体的に毛量が減ってきたと実感", emoji: "✨" },
      { week: 24, text: "ひげ剃りの頻度が明らかに減る", emoji: "🎉" },
      { week: 52, text: "手間が大幅減・維持フェーズへ", emoji: "🏆" },
    ],
  },
  legs: {
    id: "legs", label: "足", icon: "🦵", color: "#5a7fa8", bg: "#eef3f9",
    curve: [
      { week: 0, density: 100 }, { week: 2, density: 95 }, { week: 4, density: 84 },
      { week: 8, density: 67 }, { week: 12, density: 52 }, { week: 16, density: 40 },
      { week: 20, density: 32 }, { week: 24, density: 26 }, { week: 30, density: 20 },
      { week: 36, density: 16 }, { week: 44, density: 13 }, { week: 52, density: 11 },
    ],
    schedule: { intensive: 7, stable: 18, maintenance: 30 },
    milestones: [
      { week: 4, text: "生えてくる毛が細くなってくる", emoji: "🌱" },
      { week: 8, text: "毛量の減少を肌で感じられる", emoji: "✨" },
      { week: 16, text: "脱毛完了した部位が目立ち始める", emoji: "🎉" },
      { week: 36, text: "ほぼ気にならないレベルに", emoji: "🏆" },
    ],
  },
};

const today = () => new Date().toISOString().split("T")[0];
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const weeksFrom = (start, date) => Math.max(0, daysBetween(start, date) / 7);
const estimateDensity = (curve, weeks) => {
  if (weeks <= 0) return 100;
  const sorted = [...curve].sort((a, b) => a.week - b.week);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (weeks >= a.week && weeks <= b.week) {
      const t = (weeks - a.week) / (b.week - a.week);
      return Math.round(a.density + t * (b.density - a.density));
    }
  }
  return sorted[sorted.length - 1].density;
};
const getPhase = (weeks) => {
  if (weeks < 12) return { label: "集中期", color: "#c0735a", interval: "週1回" };
  if (weeks < 24) return { label: "安定期", color: "#5a7fa8", interval: "2〜4週に1回" };
  return { label: "維持期", color: "#7ab89a", interval: "月1〜2回" };
};
const formatDate = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };

async function loadData() {
  try { const r = await localStorage.getItem("ipl_v1"); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function saveData(data) {
  try { await localStorage.setItem("ipl_v1", JSON.stringify(data)); } catch { }
}

function ProgressRing({ pct, color, size = 80 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0ede8" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
}

function Shell({ children }) {
  return (
    <div style={{ fontFamily: "'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif", background: "#faf9f7", minHeight: "100vh", padding: "28px 18px 48px", maxWidth: 480, margin: "0 auto", color: "#2a2a2a" }}>
      {children}
    </div>
  );
}
function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "12px 10px", boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 10, color: "#bbb", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#ccc" }}>{sub}</div>
    </div>
  );
}
function FormRow({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}
function Toast({ msg }) {
  return (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#2a2a2a", color: "#fff", padding: "10px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 9999, whiteSpace: "nowrap" }}>{msg}</div>
  );
}
function MilestoneModal({ milestone, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "#fff", borderRadius: 24, padding: "36px 32px", textAlign: "center", maxWidth: 300, margin: "0 20px", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>{milestone.emoji}</div>
        <h2 style={{ fontWeight: 800, margin: "0 0 8px" }}>マイルストーン達成！</h2>
        <p style={{ color: "#888", fontSize: 14, margin: "0 0 24px" }}>{milestone.text}</p>
        <button onClick={onClose} style={{ padding: "12px 32px", border: "none", borderRadius: 14, cursor: "pointer", background: "#2a2a2a", color: "#fff", fontWeight: 700, fontSize: 15 }}>続ける 🎉</button>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(null);
  const [view, setView] = useState("home");
  const [activePart, setActivePart] = useState("beard");
  const [logForm, setLogForm] = useState({ date: today(), partId: "beard", intensity: 3, note: "" });
  const [toast, setToast] = useState(null);
  const [justMilestone, setJustMilestone] = useState(null);

  useEffect(() => {
    loadData().then(d => setState(d || { startDate: today(), sessions: [], setup: false }));
  }, []);

  const save = useCallback((next) => { setState(next); saveData(next); }, []);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  if (!state) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#bbb" }}>読み込み中…</div>;

  // Setup
  if (!state.setup || view === "setup") {
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "40px 0 32px" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✨</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>脱毛スタート日を設定</h1>
          <p style={{ color: "#aaa", fontSize: 14, margin: "0 0 32px" }}>最初の照射日または記録開始日を入力してください</p>
        </div>
        <SetupForm
          startDate={state.startDate}
          onSave={date => { save({ ...state, startDate: date, setup: true }); setView("home"); showToast("スタート日を設定しました 🎉"); }}
        />
      </Shell>
    );
  }

  if (view === "log") {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button onClick={() => setView("home")} style={{ background: "#f5f3f0", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 16 }}>←</button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>セッションを記録</h2>
        </div>
        <FormRow label="部位">
          <div style={{ display: "flex", gap: 10 }}>
            {Object.values(PARTS).map(p => (
              <button key={p.id} onClick={() => setLogForm(f => ({ ...f, partId: p.id }))} style={{
                flex: 1, padding: "12px 0", border: `2px solid ${logForm.partId === p.id ? p.color : "#eee"}`,
                borderRadius: 12, cursor: "pointer", background: logForm.partId === p.id ? p.bg : "#fff",
                color: logForm.partId === p.id ? p.color : "#bbb", fontWeight: 700, fontSize: 15,
              }}>{p.icon} {p.label}</button>
            ))}
          </div>
        </FormRow>
        <FormRow label="照射日">
          <input type="date" value={logForm.date} onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))} style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e8e4df", fontSize: 15, boxSizing: "border-box", outline: "none" }} />
        </FormRow>
        <FormRow label={`強度レベル: ${logForm.intensity}`}>
          <input type="range" min={1} max={5} value={logForm.intensity} onChange={e => setLogForm(f => ({ ...f, intensity: Number(e.target.value) }))} style={{ width: "100%", accentColor: PARTS[logForm.partId].color }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#bbb", marginTop: 4 }}>
            {["1(弱)", "2", "3", "4", "5(強)"].map(l => <span key={l}>{l}</span>)}
          </div>
        </FormRow>
        <FormRow label="メモ（任意）">
          <textarea value={logForm.note} onChange={e => setLogForm(f => ({ ...f, note: e.target.value }))} placeholder="肌の状態・気づきなど…" rows={3} style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e8e4df", fontSize: 14, boxSizing: "border-box", outline: "none", resize: "none", fontFamily: "inherit" }} />
        </FormRow>
        <button onClick={() => {
          const ns = { id: Date.now().toString(), ...logForm };
          const nextSessions = [...state.sessions, ns];
          const wk = weeksFrom(state.startDate, logForm.date);
          const hit = PARTS[logForm.partId].milestones.find(m =>
            m.week <= wk && !state.sessions.some(s => s.partId === logForm.partId && weeksFrom(state.startDate, s.date) >= m.week)
          );
          save({ ...state, sessions: nextSessions });
          if (hit) setJustMilestone(hit);
          setView("home");
          showToast("セッションを記録しました ✓");
        }} style={{ width: "100%", padding: 16, border: "none", borderRadius: 16, cursor: "pointer", background: PARTS[logForm.partId].color, color: "#fff", fontWeight: 800, fontSize: 16, boxShadow: `0 4px 20px ${PARTS[logForm.partId].color}50` }}>
          記録する
        </button>
      </Shell>
    );
  }

  if (view === "history") {
    const sorted = [...state.sessions].sort((a, b) => b.date.localeCompare(a.date));
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => setView("home")} style={{ background: "#f5f3f0", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 16 }}>←</button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>記録履歴</h2>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#bbb" }}>{state.sessions.length}件</span>
        </div>
        {sorted.length === 0 && <p style={{ color: "#bbb", textAlign: "center", marginTop: 60 }}>まだ記録がありません</p>}
        {sorted.map(s => {
          const p = PARTS[s.partId];
          const weeks = weeksFrom(state.startDate, s.date);
          return (
            <div key={s.id} style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 8px rgba(0,0,0,0.05)", display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{p.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.label} <span style={{ color: "#ccc", fontWeight: 400 }}>/ {s.date}</span></div>
                <div style={{ fontSize: 12, color: "#bbb" }}>強度 {s.intensity} · {Math.round(weeks * 10) / 10}週目{s.note ? ` · ${s.note}` : ""}</div>
              </div>
              <button onClick={() => { save({ ...state, sessions: state.sessions.filter(x => x.id !== s.id) }); showToast("削除しました"); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#ddd", padding: 4 }}>✕</button>
            </div>
          );
        })}
      </Shell>
    );
  }

  // Home
  const part = PARTS[activePart];
  const nowWeeks = weeksFrom(state.startDate, today());
  const phase = getPhase(nowWeeks);
  const partSessions = state.sessions.filter(s => s.partId === activePart).sort((a, b) => a.date.localeCompare(b.date));
  const lastSession = partSessions[partSessions.length - 1];
  const daysSinceLast = lastSession ? daysBetween(lastSession.date, today()) : null;
  const nextInterval = phase.label === "集中期" ? part.schedule.intensive : phase.label === "安定期" ? part.schedule.stable : part.schedule.maintenance;
  const daysUntilNext = lastSession ? Math.max(0, nextInterval - daysSinceLast) : 0;
  const isOverdue = lastSession && daysSinceLast > nextInterval + 3;
  const currentDensity = estimateDensity(part.curve, nowWeeks);
  const progress = Math.round((1 - currentDensity / 100) * 100);
  const nextMilestone = part.milestones.find(m => m.week > nowWeeks);
  const weeksToNext = nextMilestone ? Math.ceil(nextMilestone.week - nowWeeks) : null;

  // Build chart data with session markers
  const sessionWeeks = partSessions.map(s => weeksFrom(state.startDate, s.date));

  return (
    <Shell>
      {toast && <Toast msg={toast} />}
      {justMilestone && <MilestoneModal milestone={justMilestone} onClose={() => setJustMilestone(null)} />}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, color: "#ccc", letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>スムースエピ 管理</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>My Progress</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["📋", "history"], ["⚙️", "setup"]].map(([icon, v]) => (
            <button key={v} onClick={() => setView(v)} style={{ width: 36, height: 36, border: "none", borderRadius: 10, background: "#f5f3f0", cursor: "pointer", fontSize: 16 }}>{icon}</button>
          ))}
        </div>
      </div>

      {/* Part tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {Object.values(PARTS).map(p => (
          <button key={p.id} onClick={() => setActivePart(p.id)} style={{
            flex: 1, padding: "10px 0", border: "none", borderRadius: 12, cursor: "pointer",
            background: activePart === p.id ? p.color : "#f5f3f0",
            color: activePart === p.id ? "#fff" : "#aaa",
            fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.2s",
          }}><span>{p.icon}</span><span>{p.label}</span></button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <StatCard label="開始から" value={`${Math.round(nowWeeks)}週`} sub={`約${Math.round(nowWeeks / 4.3)}ヶ月`} color={part.color} />
        <StatCard label="照射回数" value={`${partSessions.length}回`} sub={phase.label} color={part.color} />
        <StatCard label="毛量推計" value={`${currentDensity}%`} sub={`削減 ${progress}%`} color={part.color} />
      </div>

      {/* Progress card */}
      <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginBottom: 14, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <ProgressRing pct={progress} color={part.color} size={78} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: part.color }}>{progress}%</div>
            <div style={{ fontSize: 9, color: "#ccc" }}>削減</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#bbb", marginBottom: 3 }}>フェーズ</div>
            <span style={{ background: part.bg, color: part.color, fontWeight: 700, fontSize: 12, padding: "3px 10px", borderRadius: 20 }}>{phase.label} — {phase.interval}</span>
          </div>
          {lastSession ? (
            <div>
              <div style={{ fontSize: 11, color: "#bbb", marginBottom: 2 }}>次回の目安</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: isOverdue ? "#e07b5a" : "#2a2a2a" }}>
                {isOverdue ? "⚠️ 空きすぎています" : daysUntilNext === 0 ? "✅ 今日が照射日！" : `あと ${daysUntilNext} 日`}
              </div>
              <div style={{ fontSize: 11, color: "#ccc" }}>前回: {formatDate(lastSession.date)} ({daysSinceLast}日前)</div>
            </div>
          ) : <div style={{ fontSize: 13, color: "#bbb" }}>最初のセッションを記録しましょう</div>}
        </div>
      </div>

      {/* Next milestone */}
      {nextMilestone && (
        <div style={{ background: `linear-gradient(135deg, ${part.bg}, #fff)`, border: `1px solid ${part.color}28`, borderRadius: 16, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 26 }}>{nextMilestone.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#bbb", marginBottom: 2 }}>次のマイルストーン（あと約{weeksToNext}週）</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{nextMilestone.text}</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: part.color, background: `${part.color}18`, borderRadius: 20, padding: "4px 10px", flexShrink: 0 }}>{nextMilestone.week}週</div>
        </div>
      )}

      {/* Chart */}
      <div style={{ background: "#fff", borderRadius: 20, padding: "18px 14px 14px", marginBottom: 14, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingLeft: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>毛量推移</span>
          <div style={{ fontSize: 10, color: "#ccc" }}>│ を照射日に設定</div>
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={part.curve} margin={{ top: 4, right: 12, left: -22, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f3f0" />
            <XAxis dataKey="week" tickFormatter={w => w === 0 ? "開始" : `${w}w`} tick={{ fontSize: 9, fill: "#ccc" }} axisLine={false} tickLine={false} ticks={[0, 4, 8, 12, 16, 24, 36, 52]} />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: "#ccc" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={v => [`${v}%`, "毛量目安"]} labelFormatter={w => `${w}週目`} contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 12 }} />
            <ReferenceLine x={nowWeeks} stroke={part.color} strokeWidth={2} strokeDasharray="4 3" label={{ value: "今", fontSize: 10, fill: part.color, position: "insideTopRight" }} />
            {part.milestones.map(m => <ReferenceLine key={m.week} x={m.week} stroke="#ebe8e3" strokeDasharray="2 4" />)}
            {sessionWeeks.map((w, i) => <ReferenceLine key={i} x={w} stroke={part.color} strokeWidth={1} strokeOpacity={0.35} />)}
            <Line type="monotone" dataKey="density" stroke={part.color} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        {/* Session count chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, paddingLeft: 4 }}>
          {partSessions.slice(-8).map(s => (
            <span key={s.id} style={{ fontSize: 10, color: part.color, background: part.bg, borderRadius: 10, padding: "2px 7px" }}>{formatDate(s.date)}</span>
          ))}
          {partSessions.length === 0 && <span style={{ fontSize: 11, color: "#ddd" }}>照射記録なし</span>}
        </div>
      </div>

      {/* Milestones */}
      <div style={{ background: "#fff", borderRadius: 20, padding: "18px", marginBottom: 20, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>マイルストーン</div>
        {part.milestones.map((m, i) => {
          const reached = nowWeeks >= m.week;
          return (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: reached ? part.color : "#f5f3f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, transition: "background 0.3s", flexShrink: 0 }}>
                  {reached ? m.emoji : <span style={{ fontSize: 12, color: "#ccc" }}>{m.week}w</span>}
                </div>
                {i < part.milestones.length - 1 && <div style={{ width: 1.5, height: 22, background: reached ? `${part.color}40` : "#eee", margin: "3px 0" }} />}
              </div>
              <div style={{ paddingTop: 6, paddingBottom: i < part.milestones.length - 1 ? 0 : 0 }}>
                <div style={{ fontSize: 11, color: reached ? part.color : "#bbb", fontWeight: 700, marginBottom: 2 }}>{m.week}週目</div>
                <div style={{ fontSize: 13, color: reached ? "#333" : "#aaa", marginBottom: i < part.milestones.length - 1 ? 10 : 0 }}>{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <button onClick={() => setView("log")} style={{
        width: "100%", padding: "15px", border: "none", borderRadius: 16, cursor: "pointer",
        background: part.color, color: "#fff", fontWeight: 800, fontSize: 16,
        boxShadow: `0 4px 20px ${part.color}55`, letterSpacing: 0.3,
      }}>＋ セッションを記録する</button>
    </Shell>
  );
}

function SetupForm({ startDate, onSave }) {
  const [date, setDate] = useState(startDate);
  return (
    <>
      <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 8 }}>スタート日</label>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "1.5px solid #e8e4df", fontSize: 16, marginBottom: 24, boxSizing: "border-box", outline: "none" }} />
      <button onClick={() => onSave(date)} style={{ width: "100%", padding: 16, border: "none", borderRadius: 16, cursor: "pointer", background: "#2a2a2a", color: "#fff", fontWeight: 800, fontSize: 16 }}>スタート！</button>
    </>
  );
}