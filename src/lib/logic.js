// 30분 단위 슬롯 i(0~47): KST 09:00 + i*30분 = UTC 00:00 + i*30분
export const SLOTS = 48;
export const DAY_KEYS = ["mon", "tue", "thu"];

export const FIELDS = {
  mon: ["build", "refined", "gold"],
  tue: ["dust", "research"],
  thu: ["train"],
};

export const pad = (n) => String(n).padStart(2, "0");
const mm = (i) => (i % 2) * 30;
const kstHour = (i) => (9 + Math.floor(i / 2)) % 24;

export const utcTime = (i) => `${pad(Math.floor(i / 2) % 24)}:${pad(mm(i))}`;
export const kstTime = (i) => `${pad(kstHour(i))}:${pad(mm(i))}`;
export const isNextDayKST = (i) => i >= 30;
export const isNextDayUTC = (i) => i >= 48;

// 사용자의 브라우저 로컬 시간 (참고용)
export function localTime(i) {
  const d = new Date();
  d.setUTCHours(Math.floor(i / 2), mm(i), 0, 0);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const emptyDays = () => ({
  mon: { ranks: [], build: "", refined: "", gold: "" },
  tue: { ranks: [], dust: "", research: "" },
  thu: { ranks: [], train: "" },
});

function priorityKey(day, a) {
  const d = a.days[day];
  if (day === "mon") return [num(d.refined), num(d.gold), num(d.build)];
  if (day === "tue") return [num(d.dust), num(d.research)];
  return [num(d.train)];
}

export function sortByPriority(day, applicants) {
  return Object.values(applicants)
    .filter((a) => (a.days?.[day]?.ranks || []).length > 0)
    .sort((x, y) => {
      const kx = priorityKey(day, x);
      const ky = priorityKey(day, y);
      for (let i = 0; i < kx.length; i++) if (kx[i] !== ky[i]) return ky[i] - kx[i];
      return (x.updatedAt || 0) - (y.updatedAt || 0);
    });
}

export function rankOf(a, day, slot) {
  const idx = (a?.days?.[day]?.ranks || []).indexOf(slot);
  return idx >= 0 ? idx + 1 : null;
}

export function runAuto(day, applicants, cfg) {
  const cap = Math.max(1, num(cfg.capacity) || 1);
  const slots = {};
  for (let i = 0; i < SLOTS; i++) slots[i] = [];
  const placed = new Set();
  Object.entries(cfg.manual[day] || {}).forEach(([nick, slot]) => {
    const a = applicants[nick];
    if (!a) return;
    slots[slot].push({ nick, rank: rankOf(a, day, slot), source: "manual" });
    placed.add(nick);
  });
  const unassigned = [];
  for (const a of sortByPriority(day, applicants)) {
    if (placed.has(a.nick)) continue;
    const prefs = a.days[day].ranks;
    let done = false;
    for (let r = 0; r < prefs.length; r++) {
      const s = prefs[r];
      if (slots[s].length < cap) {
        slots[s].push({ nick: a.nick, rank: r + 1, source: "auto" });
        done = true;
        break;
      }
    }
    if (!done) unassigned.push(a.nick);
  }
  return { slots, unassigned };
}

export function removeFromSlots(asg, nick) {
  const out = {};
  for (let i = 0; i < SLOTS; i++) out[i] = (asg[i] || []).filter((e) => e.nick !== nick);
  return out;
}
