export default function NumField({ label, unit, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="f">{label}</label>
      <div className="row">
        <input type="number" inputMode="decimal" min="0" value={value} placeholder="0" onChange={(e) => onChange(e.target.value)} />
        <span className="unit">{unit}</span>
      </div>
    </div>
  );
}

export function Toggle({ on, onClick, label }) {
  return (
    <div className="switch">
      <span style={{ fontWeight: 600 }}>{label}</span>
      <button type="button" className={"sw" + (on ? " on" : "")} onClick={onClick} aria-pressed={on} aria-label={label} />
    </div>
  );
}
