import { formatDuration, formatTime } from '../domain/dates';
import { describePattern } from '../domain/recurrence';
import type { Context, Series } from '../domain/types';
import { updateSeries } from '../storage/store';

type Props = {
  series: Series[];
  contexts: Context[];
  onEdit: (series: Series) => void;
  onNew: () => void;
};

export function SeriesView({ series, contexts, onEdit, onNew }: Props) {
  return (
    <section className="panel wide">
      <header className="panel-head">
        <h2>Wiederkehrende Aufgaben</h2>
        <button className="btn primary" onClick={onNew}>
          + Serie
        </button>
      </header>

      <ul className="series-list">
        {[...series]
          .sort((a, b) => a.title.localeCompare(b.title, 'de'))
          .map((item) => {
            const context = contexts.find((c) => c.id === item.contextId);
            return (
              <li
                key={item.id}
                className={`series-card${item.active ? '' : ' inactive'}`}
                style={{ '--accent': context?.color } as React.CSSProperties}
              >
                <div className="series-main">
                  <button className="series-title" onClick={() => onEdit(item)}>
                    {item.title}
                  </button>
                  <span className="task-meta">
                    <span className="dot" />
                    {context?.name} · {describePattern(item.pattern)} ·{' '}
                    {formatDuration(item.estimateMin)}
                    {item.autoScheduleMin !== null && (
                      <> · fest um {formatTime(item.autoScheduleMin)}</>
                    )}
                    {item.endDate && <> · bis {item.endDate}</>}
                    {item.skipped.length > 0 && <> · {item.skipped.length}× übersprungen</>}
                  </span>
                </div>
                <label
                  className="switch"
                  title={item.active ? 'Serie pausieren' : 'Serie aktivieren'}
                >
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={(e) => updateSeries(item.id, { active: e.target.checked })}
                  />
                  <span>{item.active ? 'aktiv' : 'pausiert'}</span>
                </label>
              </li>
            );
          })}
      </ul>

      {series.length === 0 && (
        <p className="empty">
          Noch keine Serien. Typische Kandidaten: tägliche Mail-Zeit, Wochenplanung am Montag,
          monatliche Abrechnung.{' '}
          <button className="link" onClick={onNew}>
            Erste Serie anlegen
          </button>
        </p>
      )}
    </section>
  );
}
