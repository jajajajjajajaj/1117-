import { useMemo, useState } from "react";
import { SLOTS, FIELDS, DAY_KEYS, sortByPriority, num } from "../lib/logic.js";
import { Toggle } from "./NumField.jsx";

export default function AdminPanel({ t, L, cfg, applicants, day, setDay, busy, onAuto, onManual, onUnassign, onDelete, onSaveCfg, onReset, onCopy, copyText, onReload, onSignOut, onChangePassword }) {
  const [pick, setPick] = useState({});
  const [cap, setCap] = useState(String(cfg.capacity));
  const [showList, setShowList] = useState(true);
  const [newPw, setNewPw] = useState("");

  const ordered = useMemo(() => sortByPriority(day, applicants), [day, applicants]);
  const asg = cfg.assignments[day] || {};
  const assignedSet = new Set(Object.values(asg).flat().map((e) => e.nick));
  const unassigned = (cfg.unassigned[day] || []).filter((n) => applicants[n]);
  const total = Object.keys(applicants).length;
  const dayTitle = `${t.days[day]} · ${t.events[day]}`;

  return (
    <>
      <div className="row between" style={{ marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>{t.admin}</h1>
        <div>
          <button type="button" className="link" onClick={onReload}>{t.refresh}</button>
          <button type="button" className="link" onClick={onSignOut}>{t.signOut}</button>
        </div>
      </div>
      <p className="sub">{t.applicantsCount(total)}</p>

      <div className="tabs">
        {DAY_KEYS.map((k) => (
          <button key={k} type="button" className={"tab" + (day === k ? " on" : "")} onClick={() => setDay(k)}>
            {t.days[k]} {cfg.published[k] ? "●" : ""}
          </button>
        ))}
      </div>

      <div className="card">
        <h2>{dayTitle}</h2>
        <p className="note">{t.priorityNote[day]}</p>
        <button type="button" className="btn" disabled={busy} onClick={() => onAuto(day)}>{t.runAuto}</button>
        <Toggle
          on={!!cfg.published[day]}
          label={t.publishDay}
          onClick={() => onSaveCfg({ ...cfg, published: { ...cfg.published, [day]: !cfg.published[day] } })}
        />
        <p className="note">{t.manualKept}</p>
      </div>

      {unassigned.length > 0 && (
        <div className="card" style={{ borderColor: "#E9C7C8" }}>
          <h2 className="warn" style={{ fontSize: 17 }}>{t.missing(unassigned.length)}</h2>
          <p className="note">{t.missingNote}</p>
          {unassigned.map((n) => {
            const a = applicants[n];
            return (
              <div key={n} style={{ padding: "10px 0", borderTop: "1px solid #EDF0F5" }}>
                <div style={{ fontWeight: 700 }}>{n}</div>
                <div className="note" style={{ margin: "2px 0 8px" }}>
                  {t.wanted}: {a.days[day].ranks.map((s, i) => `${t.rank(i + 1)} ${L.main(s)}`).join(" · ")}
                </div>
                <div className="row">
                  <select value={pick[n] ?? ""} onChange={(e) => setPick({ ...pick, [n]: e.target.value })}>
                    <option value="">{t.pickTime}</option>
                    {Array.from({ length: SLOTS }, (_, i) => (
                      <option key={i} value={i}>
                        {L.full(i)} · {(asg[i] || []).length ? asg[i].map((e) => e.nick).join(", ") : t.emptySlot}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={pick[n] === undefined || pick[n] === "" || busy}
                    onClick={() => onManual(day, n, Number(pick[n]))}
                  >
                    {t.assign}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ padding: 8 }}>
        <div className="row between" style={{ padding: "6px 8px" }}>
          <strong>{t.timetable}</strong>
          <button type="button" className="link" onClick={() => onCopy(day)}>{t.copyText}</button>
        </div>
        {copyText && <textarea readOnly value={copyText} onFocus={(e) => e.target.select()} />}
        <table>
          <thead>
            <tr><th>{t.time}</th><th>{t.assigned}</th></tr>
          </thead>
          <tbody>
            {Array.from({ length: SLOTS }, (_, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {L.main(i)} <span className="note inl">({L.sub(i)})</span>
                </td>
                <td>
                  {(asg[i] || []).map((e) => (
                    <span key={e.nick} style={{ display: "inline-flex", alignItems: "center", marginRight: 8 }}>
                      {e.nick}
                      {e.rank && <span className="tag r">{t.rank(e.rank)}</span>}
                      {e.source === "manual" && <span className="tag m">{t.manualTag}</span>}
                      <button type="button" className="x" title={t.unassignTitle} onClick={() => onUnassign(day, e.nick)}>×</button>
                    </span>
                  ))}
                  {!(asg[i] || []).length && <span className="note inl">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 8 }}>
        <div className="row between" style={{ padding: "6px 8px" }}>
          <strong>{t.applicantsList}</strong>
          <button type="button" className="link" onClick={() => setShowList(!showList)}>{showList ? t.collapse : t.expand}</button>
        </div>
        {showList && (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t.nickname}</th>
                {FIELDS[day].map((f) => <th key={f}>{t.fieldsShort[f]}</th>)}
                <th>{t.wanted}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordered.length === 0 && (
                <tr><td colSpan={FIELDS[day].length + 4} className="empty">{t.noApplicants}</td></tr>
              )}
              {ordered.map((a, i) => (
                <tr key={a.nick}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 700 }}>
                    {a.nick}
                    {assignedSet.has(a.nick) ? <span className="tag m">{t.assignedTag}</span>
                      : unassigned.includes(a.nick) ? <span className="tag x">{t.missingTag}</span> : null}
                  </td>
                  {FIELDS[day].map((f) => <td key={f}>{num(a.days[day][f])}</td>)}
                  <td className="note inl" style={{ fontSize: 12 }}>{a.days[day].ranks.map(L.main).join(" > ")}</td>
                  <td><button type="button" className="x" title={t.deleteTitle} onClick={() => onDelete(a.nick)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 17, marginBottom: 10 }}>{t.settings}</h2>
        <label className="f">{t.capacity}</label>
        <div className="row" style={{ marginBottom: 12 }}>
          <input type="number" min="1" value={cap} onChange={(e) => setCap(e.target.value)} />
          <button type="button" className="btn sm" onClick={() => onSaveCfg({ ...cfg, capacity: Math.max(1, num(cap) || 1) })}>{t.save}</button>
        </div>
        <label className="f">{t.changePw}</label>
        <div className="row" style={{ marginBottom: 12 }}>
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t.newPw} autoComplete="new-password" />
          <button type="button" className="btn sm" disabled={!newPw.trim() || busy}
            onClick={() => onChangePassword(newPw.trim()).then((ok) => ok && setNewPw(""))}>{t.change}</button>
        </div>
        <button type="button" className="btn danger" onClick={onReset}>{t.resetAll}</button>
      </div>
    </>
  );
}
