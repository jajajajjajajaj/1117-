import { useState, useEffect, useMemo } from "react";
import { T, LANGS, detectLang } from "./i18n.js";
import { SLOTS, FIELDS, DAY_KEYS, emptyDays, rankOf, runAuto, removeFromSlots, utcTime, kstTime, isNextDayKST, localTime } from "./lib/logic.js";
import * as db from "./lib/supabase.js";
import SlotPicker from "./components/SlotPicker.jsx";
import NumField from "./components/NumField.jsx";
import AdminPanel from "./components/AdminPanel.jsx";

// 언어별 시간 표기: 한국어는 KST 우선, 영어는 UTC 우선
function makeLabels(lang, t) {
  if (lang === "ko") {
    const main = (i) => `${isNextDayKST(i) ? t.nextDay + " " : ""}${kstTime(i)}`;
    const sub = (i) => `UTC ${utcTime(i)}`;
    return { main, sub, full: (i) => `KST ${main(i)} (${sub(i)})` };
  }
  const main = (i) => utcTime(i);
  const sub = (i) => `KST ${kstTime(i)}${isNextDayKST(i) ? "+1" : ""}`;
  return { main, sub, full: (i) => `UTC ${main(i)} (${sub(i)})` };
}

export default function App() {
  const [lang, setLang] = useState(detectLang);
  const t = T[lang];
  const L = useMemo(() => makeLabels(lang, t), [lang, t]);

  const [screen, setScreen] = useState("home"); // home | form | done | results | adminLogin | admin
  const [step, setStep] = useState(0);
  const [nick, setNick] = useState("");
  const [days, setDays] = useState(emptyDays());
  const [applicants, setApplicants] = useState({});
  const [cfg, setCfg] = useState(db.defaultSettings());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [resultDay, setResultDay] = useState("mon");
  const [adminDay, setAdminDay] = useState("mon");
  const [pw, setPw] = useState("");
  const [copyText, setCopyText] = useState("");

  useEffect(() => {
    try { localStorage.setItem("lang", lang); } catch {}
    document.documentElement.lang = lang;
  }, [lang]);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };

  const reload = async () => {
    const [a, c] = await Promise.all([db.fetchApplicants(), db.fetchSettings()]);
    setApplicants(a);
    setCfg(c);
    return { a, c };
  };

  useEffect(() => {
    if (!db.configured) { setLoading(false); return; }
    reload().catch((e) => { console.error(e); flash(t.loadFail); }).finally(() => setLoading(false));
  }, []);

  const anyPublished = DAY_KEYS.some((k) => cfg.published[k]);

  // ----- 신청자 -----
  const startForm = async () => {
    const n = nick.trim();
    if (!n) return flash(t.nickRequired);
    setBusy(true);
    try {
      const { a } = await reload();
      const prev = a[n];
      if (prev) { setDays({ ...emptyDays(), ...prev.days }); flash(t.loadedPrev); }
      else setDays(emptyDays());
      setNick(n);
      setStep(0);
      setScreen("form");
    } catch (e) { console.error(e); flash(t.loadFail); }
    setBusy(false);
  };

  const setDay = (key, patch) => setDays((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

  const submit = async (finalDays) => {
    setBusy(true);
    try {
      await db.upsertApplicant(nick, finalDays);
      setApplicants((a) => ({ ...a, [nick]: { nick, days: finalDays, updatedAt: Date.now() } }));
      setScreen("done");
    } catch (e) { console.error(e); flash(t.saveFail); }
    setBusy(false);
  };

  const advance = (skip) => {
    const dayKey = DAY_KEYS[step];
    const nextDays = skip ? { ...days, [dayKey]: { ...days[dayKey], ranks: [] } } : days;
    setDays(nextDays);
    if (step < 2) setStep(step + 1);
    else submit(nextDays);
  };

  // ----- 관리자 -----
  const login = async () => {
    setBusy(true);
    try {
      await db.signIn(pw);
      await reload();
      setPw("");
      setScreen("admin");
    } catch (e) {
      console.error(e);
      flash(e.message === "bad credentials" ? t.loginFail : `${t.loginError}: ${e.message}`);
    }
    setBusy(false);
  };

  const saveCfg = async (next) => {
    setBusy(true);
    let ok = false;
    try { await db.saveSettings(next); setCfg(next); ok = true; }
    catch (e) { console.error(e); flash(t.saveFail); }
    setBusy(false);
    return ok;
  };

  const doAuto = async (day) => {
    try {
      const { a, c } = await reload();
      const { slots, unassigned } = runAuto(day, a, c);
      const next = { ...c, assignments: { ...c.assignments, [day]: slots }, unassigned: { ...c.unassigned, [day]: unassigned }, lastRun: Date.now() };
      if (await saveCfg(next)) flash(t.autoDone(t.days[day]));
    } catch (e) { console.error(e); flash(t.loadFail); }
  };

  const manualAssign = async (day, target, slot) => {
    const c = { ...cfg };
    const asg = removeFromSlots(c.assignments[day] || {}, target);
    asg[slot] = [...asg[slot], { nick: target, rank: rankOf(applicants[target], day, slot), source: "manual" }];
    c.assignments = { ...c.assignments, [day]: asg };
    c.manual = { ...c.manual, [day]: { ...c.manual[day], [target]: slot } };
    c.unassigned = { ...c.unassigned, [day]: (c.unassigned[day] || []).filter((n) => n !== target) };
    if (await saveCfg(c)) flash(t.assignedMsg(target, L.main(slot)));
  };

  const unassign = async (day, target) => {
    const c = { ...cfg };
    const m = { ...c.manual[day] };
    delete m[target];
    c.assignments = { ...c.assignments, [day]: removeFromSlots(c.assignments[day] || {}, target) };
    c.manual = { ...c.manual, [day]: m };
    const hasRanks = (applicants[target]?.days?.[day]?.ranks || []).length > 0;
    const u = c.unassigned[day] || [];
    c.unassigned = { ...c.unassigned, [day]: hasRanks && !u.includes(target) ? [...u, target] : u };
    await saveCfg(c);
  };

  const deleteApplicant = async (target) => {
    if (!window.confirm(t.confirmDelete(target))) return;
    try {
      await db.deleteApplicant(target);
      setApplicants((a) => { const n = { ...a }; delete n[target]; return n; });
      flash(t.deleted);
    } catch (e) { console.error(e); flash(t.saveFail); }
  };

  const resetAll = async () => {
    if (!window.confirm(t.confirmReset)) return;
    try {
      await db.resetAll();
      setApplicants({});
      setCfg(db.defaultSettings());
      flash(t.resetDone);
    } catch (e) { console.error(e); flash(t.saveFail); }
  };

  const buildText = (day) => {
    const asg = cfg.assignments[day] || {};
    const lines = [`[${t.days[day]} ${t.events[day]}]`];
    for (let i = 0; i < SLOTS; i++) {
      const who = (asg[i] || []).map((e) => e.nick).join(", ");
      lines.push(`${L.main(i)} (${L.sub(i)}) : ${who || "-"}`);
    }
    return lines.join("\n");
  };
  const copyResult = async (day) => {
    const txt = buildText(day);
    try { await navigator.clipboard.writeText(txt); flash(t.copied); }
    catch { setCopyText(txt); }
  };

  const changePassword = async (pw) => {
    try { await db.changeCode(pw); flash(t.pwChanged); return true; }
    catch (e) { console.error(e); flash(t.saveFail); return false; }
  };

  const signOut = async () => {
    await db.signOut();
    setScreen("home");
  };

  // ----- 렌더 -----
  const LangBar = () => (
    <div className="topbar">
      {LANGS.map((l) => (
        <button key={l} type="button" className={"lang" + (lang === l ? " on" : "")} onClick={() => setLang(l)}>{T[l].langName}</button>
      ))}
    </div>
  );

  if (!db.configured) return <div className="wrap"><div className="card">{t.notConfigured}<p className="note">{db.configProblem}</p></div></div>;
  if (loading) return <div className="wrap empty">{t.loading}</div>;

  const dayKey = DAY_KEYS[step];
  const d = days[dayKey];

  return (
    <div className="wrap">
      <LangBar />

      {screen === "home" && (
        <>
          <h1>{t.title}</h1>
          <p className="sub">{t.intro}</p>
          <div className="card">
            <label className="f">{t.nickname}</label>
            <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder={t.nickPh} onKeyDown={(e) => e.key === "Enter" && startForm()} />
            <button type="button" className="btn" onClick={startForm} disabled={busy}>{t.start}</button>
            <p className="note">{t.homeNote}</p>
          </div>
          {anyPublished && <button type="button" className="btn ghost" onClick={() => setScreen("results")}>{t.viewResults}</button>}
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button type="button" className="link" onClick={async () => setScreen((await db.getSession()) ? "admin" : "adminLogin")}>{t.admin}</button>
          </div>
        </>
      )}

      {screen === "form" && (
        <>
          <div className="steps">
            {DAY_KEYS.map((k, i) => <span key={k} className={i < step ? "done" : i === step ? "on" : ""} />)}
          </div>
          <h2>{t.days[dayKey]} · {t.events[dayKey]}</h2>
          <p className="sub">{nick} · {t.priorityNote[dayKey]}</p>
          <div className="card">
            <label className="f">{t.slotsLabel}</label>
            <SlotPicker ranks={d.ranks} onChange={(r) => setDay(dayKey, { ranks: r })} t={t} L={L} />
            {lang === "en" && <p className="note">UTC 00:00 = {localTime(0)} {t.localTimeNote}</p>}
          </div>
          <div className="card">
            {FIELDS[dayKey].map((f) => (
              <NumField key={f} label={t.fields[f]} unit={t.units[f]} value={d[f]} onChange={(v) => setDay(dayKey, { [f]: v })} />
            ))}
          </div>
          <button type="button" className="btn" disabled={d.ranks.length === 0 || busy} onClick={() => advance(false)}>
            {step < 2 ? t.next(`${t.days[DAY_KEYS[step + 1]]} ${t.events[DAY_KEYS[step + 1]]}`) : t.submit}
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => advance(true)}>{t.skipDay}</button>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button type="button" className="link" onClick={() => (step > 0 ? setStep(step - 1) : setScreen("home"))}>
              {step > 0 ? t.prevDay : t.home}
            </button>
          </div>
        </>
      )}

      {screen === "done" && (
        <>
          <h1>{t.doneTitle}</h1>
          <p className="sub">{t.doneSub(nick)}</p>
          <div className="card">
            {DAY_KEYS.map((k) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <strong>{t.days[k]} {t.events[k]}</strong>
                <div className="note" style={{ marginTop: 2 }}>
                  {days[k].ranks.length ? days[k].ranks.map((s, i) => `${t.rank(i + 1)} ${L.main(s)}`).join(" · ") : t.notJoining}
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn ghost" onClick={() => setScreen("home")}>{t.home}</button>
        </>
      )}

      {screen === "results" && (
        <>
          <h1>{t.resultsTitle}</h1>
          <p className="sub">{t.resultsSub}</p>
          <div className="tabs">
            {DAY_KEYS.map((k) => (
              <button key={k} type="button" className={"tab" + (resultDay === k ? " on" : "")} onClick={() => setResultDay(k)}>{t.days[k]}</button>
            ))}
          </div>
          <div className="card" style={{ padding: 8 }}>
            {!cfg.published[resultDay] ? (
              <div className="empty">{t.notPublished}</div>
            ) : (
              <table>
                <thead><tr><th>{t.time}</th><th>{t.assigned}</th></tr></thead>
                <tbody>
                  {Array.from({ length: SLOTS }, (_, i) => {
                    const ents = cfg.assignments[resultDay]?.[i] || [];
                    const me = !!nick.trim() && ents.some((e) => e.nick === nick.trim());
                    return (
                      <tr key={i} className={me ? "me" : ""}>
                        <td style={{ whiteSpace: "nowrap" }}>{L.main(i)} <span className="note inl">({L.sub(i)})</span></td>
                        <td>{ents.length ? ents.map((e) => e.nick).join(", ") : <span className="note inl">-</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <button type="button" className="btn ghost" onClick={() => setScreen("home")}>{t.home}</button>
        </>
      )}

      {screen === "adminLogin" && (
        <>
          <h1>{t.admin}</h1>
          <p className="sub">{t.adminLoginSub}</p>
          <div className="card">
            <label className="f">{t.password}</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && login()} />
            <button type="button" className="btn" onClick={login} disabled={busy}>{t.signIn}</button>
          </div>
          <button type="button" className="link" onClick={() => setScreen("home")}>{t.home}</button>
        </>
      )}

      {screen === "admin" && (
        <AdminPanel
          t={t} L={L} cfg={cfg} applicants={applicants} day={adminDay} setDay={setAdminDay} busy={busy}
          onAuto={doAuto} onManual={manualAssign} onUnassign={unassign} onDelete={deleteApplicant}
          onSaveCfg={saveCfg} onReset={resetAll} onCopy={copyResult} copyText={copyText}
          onReload={() => reload().then(() => flash(t.refreshed)).catch(() => flash(t.loadFail))}
          onSignOut={signOut} onChangePassword={changePassword}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
