import { useState, useEffect } from 'react';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Primer día del mes: 0 = lunes … 6 = domingo.
 * @param {number} year
 * @param {number} month1
 */
function firstWeekdayMondayIndex(year, month1) {
  const wd = new Date(year, month1 - 1, 1).getDay();
  return (wd + 6) % 7;
}

function daysInMonth(year, month1) {
  return new Date(year, month1, 0).getDate();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYmd(year, month1, day) {
  return `${year}-${pad2(month1)}-${pad2(day)}`;
}

function parseYm(value) {
  if (!value || value.length < 10) return null;
  const [ys, ms] = value.split('-');
  const y = parseInt(ys, 10);
  const m = parseInt(ms, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { y, m };
}

function defaultYm() {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1 };
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Calendario mensual para elegir día (última modificación de recepción); marca en naranja los días con datos.
 * @param {{
 *   value: string,
 *   max: string,
 *   diasConDatos: Set<string>,
 *   onChange: (ymd: string) => void,
 * }} props
 */
export default function InfoFinalMonthGrid({ value, max, diasConDatos, onChange }) {
  const [visible, setVisible] = useState(() => parseYm(value) || defaultYm());

  useEffect(() => {
    const p = parseYm(value);
    if (p) setVisible(p);
  }, [value]);

  const { y, m } = visible;
  const lead = firstWeekdayMondayIndex(y, m);
  const dim = daysInMonth(y, m);
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= dim; d += 1) cells.push(d);

  const prevMonth = () => {
    if (m <= 1) setVisible({ y: y - 1, m: 12 });
    else setVisible({ y, m: m - 1 });
  };

  const nextMonth = () => {
    if (m >= 12) setVisible({ y: y + 1, m: 1 });
    else setVisible({ y, m: m + 1 });
  };

  const titleId = `info-final-cal-title-${y}-${m}`;

  return (
    <section className="info-final-cal" aria-labelledby={titleId}>
      <div className="info-final-cal-head">
        <button type="button" className="info-final-cal-nav" onClick={prevMonth} aria-label="Mes anterior">
          ‹
        </button>
        <h2 id={titleId} className="info-final-cal-title">
          {MONTH_NAMES[m - 1]} {y}
        </h2>
        <button type="button" className="info-final-cal-nav" onClick={nextMonth} aria-label="Mes siguiente">
          ›
        </button>
      </div>
      <div className="info-final-cal-weekdays" role="row">
        {WEEKDAYS.map((w) => (
          <span key={w} className="info-final-cal-wd" role="columnheader">
            {w}
          </span>
        ))}
      </div>
      <div className="info-final-cal-grid" role="grid" aria-label="Días del mes (última modificación de recepción)">
        {cells.map((day, idx) => {
          if (day == null) {
            return <span key={`e-${idx}`} className="info-final-cal-cell info-final-cal-cell--empty" aria-hidden />;
          }
          const ymd = toYmd(y, m, day);
          const tieneDatos = diasConDatos.has(ymd);
          const seleccionado = ymd === value;
          const futuro = max && ymd > max;
          const clases = [
            'info-final-cal-cell',
            tieneDatos ? 'info-final-cal-cell--con-datos' : '',
            seleccionado ? 'info-final-cal-cell--selected' : '',
            futuro ? 'info-final-cal-cell--disabled' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={ymd}
              type="button"
              role="gridcell"
              className={clases}
              disabled={futuro}
              aria-label={
                tieneDatos
                  ? `${day}, hay recepciones con artículos este día`
                  : `${day}, sin recepciones registradas`
              }
              aria-pressed={seleccionado}
              onClick={() => !futuro && onChange(ymd)}
            >
              <span className="info-final-cal-day-num">{day}</span>
            </button>
          );
        })}
      </div>
      <p className="info-final-cal-leyenda">
        <span className="info-final-cal-leyenda-marca" aria-hidden />
        Día con recepciones modificadas (info final de artículos)
      </p>
    </section>
  );
}
