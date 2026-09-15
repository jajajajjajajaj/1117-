import { SLOTS } from "../lib/logic.js";

export default function SlotPicker({ ranks, onChange, t, L }) {
  const toggle = (i) => {
    if (ranks.includes(i)) onChange(ranks.filter((r) => r !== i));
    else if (ranks.length < 5) onChange([...ranks, i]);
  };
  return (
    <div>
      <div className="grid" role="group" aria-label={t.slotsLabel}>
        {Array.from({ length: SLOTS }, (_, i) => {
          const r = ranks.indexOf(i);
          const on = r >= 0;
          return (
            <button
              key={i}
              type="button"
              className={"slot" + (on ? " on" : ranks.length < 5 ? " next" : "")}
              onClick={() => toggle(i)}
              aria-pressed={on}
              aria-label={L.full(i)}
            >
              {on && <span className="badge">{r + 1}</span>}
              <span className="k">{L.main(i)}</span>
              <span className="u">{L.sub(i)}</span>
            </button>
          );
        })}
      </div>
      <div className="ranks">
        {ranks.length === 0 ? (
          <span className="note inl">{t.slotsHint}</span>
        ) : (
          ranks.map((s, i) => (
            <span key={s} className="chip">
              {t.rank(i + 1)} · {L.main(s)}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
