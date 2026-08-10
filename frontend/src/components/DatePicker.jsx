import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MONTHS = [
  'Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesakuu',
  'Heinakuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu',
];
const WEEKDAYS = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];
const POPOVER_WIDTH = 252;
const POPOVER_GUTTER = 8;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parsePickerValue(value) {
  if (!value) return null;
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 12),
    Number(match[5] || 0),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function valueFromDate(date, mode, timeValue) {
  const datePart = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  if (mode !== 'datetime') return datePart;
  const time = timeValue || `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return `${datePart}T${time}`;
}

function displayValue(value, mode) {
  const date = parsePickerValue(value);
  if (!date) return '';
  const datePart = `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
  if (mode !== 'datetime') return datePart;
  const time = String(value).match(/T(\d{2}:\d{2})/)?.[1] || `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return `${datePart} ${time.replace(':', '.')}`;
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DatePicker({ value, onChange, mode = 'date', placeholder = 'Valitse', className = '' }) {
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const parsed = parsePickerValue(value);
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState(null);
  const [viewDate, setViewDate] = useState(parsed || new Date());
  const [timeValue, setTimeValue] = useState(() => {
    const match = String(value || '').match(/T(\d{2}:\d{2})/);
    return match?.[1] || '12:00';
  });

  useEffect(() => {
    const next = parsePickerValue(value);
    if (next) setViewDate(next);
    const match = String(value || '').match(/T(\d{2}:\d{2})/);
    if (match) setTimeValue(match[1]);
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const clickedTrigger = rootRef.current?.contains(event.target);
      const clickedPopover = popoverRef.current?.contains(event.target);
      if (!clickedTrigger && !clickedPopover) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return undefined;
    const updatePopoverPosition = () => {
      const rect = rootRef.current.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const popoverHeight = popoverRef.current?.getBoundingClientRect().height || 304;
      const preferredLeft = rect.left + POPOVER_WIDTH > viewportWidth - POPOVER_GUTTER
        ? rect.right - POPOVER_WIDTH
        : rect.left;
      const left = Math.min(
        Math.max(POPOVER_GUTTER, preferredLeft),
        Math.max(POPOVER_GUTTER, viewportWidth - POPOVER_WIDTH - POPOVER_GUTTER),
      );
      const below = rect.bottom + 6;
      const top = below + popoverHeight <= viewportHeight - POPOVER_GUTTER
        ? below
        : Math.max(POPOVER_GUTTER, rect.top - popoverHeight - 6);
      setPopoverPosition({ left, top });
    };
    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [open, viewDate, mode]);

  const days = useMemo(() => {
    const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const d = new Date(start);
      d.setDate(start.getDate() + index);
      return d;
    });
  }, [viewDate]);

  const selectDate = (date) => {
    const next = valueFromDate(date, mode, timeValue);
    onChange?.(next);
    if (mode === 'date') setOpen(false);
  };

  const setToday = () => {
    const now = new Date();
    const nextTime = mode === 'datetime' ? `${pad2(now.getHours())}:${pad2(now.getMinutes())}` : timeValue;
    setTimeValue(nextTime);
    setViewDate(now);
    onChange?.(valueFromDate(now, mode, nextTime));
    if (mode === 'date') setOpen(false);
  };

  const clear = () => {
    onChange?.('');
    setOpen(false);
  };

  const changeMonth = (delta) => {
    setViewDate(current => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const shown = displayValue(value, mode);
  const portalTheme = rootRef.current?.closest('.vdx')?.dataset.theme || 'dark';

  const toggleOpen = () => {
    setPopoverPosition(null);
    setOpen(current => !current);
  };

  const popover = open ? (
    <div className="date-picker-portal" data-theme={portalTheme}>
      <div
        className="date-picker-popover"
        ref={popoverRef}
        style={{
          left: popoverPosition?.left ?? -9999,
          top: popoverPosition?.top ?? -9999,
          visibility: popoverPosition ? 'visible' : 'hidden',
        }}
      >
      <div className="date-picker-head">
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Edellinen kuukausi">&lt;</button>
        <strong>{MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}</strong>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Seuraava kuukausi">&gt;</button>
      </div>
      <div className="date-picker-week">
        {WEEKDAYS.map(day => <span key={day}>{day}</span>)}
      </div>
      <div className="date-picker-grid">
        {days.map(day => {
          const selected = sameDay(day, parsed);
          const today = sameDay(day, new Date());
          const outside = day.getMonth() !== viewDate.getMonth();
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={`${outside ? 'outside ' : ''}${selected ? 'selected ' : ''}${today ? 'today' : ''}`.trim()}
              onClick={() => selectDate(day)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
      {mode === 'datetime' && (
        <label className="date-picker-time">
          <span>Aika</span>
          <input
            type="time"
            value={timeValue}
            onChange={(event) => {
              const next = event.target.value || '12:00';
              setTimeValue(next);
              onChange?.(valueFromDate(parsed || viewDate, mode, next));
            }}
          />
        </label>
      )}
      <div className="date-picker-actions">
        <button type="button" onClick={setToday}>Tanaan</button>
        <button type="button" onClick={clear}>Tyhjenna</button>
        {mode === 'datetime' && <button type="button" className="primary" onClick={() => setOpen(false)}>Valmis</button>}
      </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className={`date-picker ${className}`.trim()} ref={rootRef}>
        <button type="button" className="date-picker-btn" onClick={toggleOpen}>
          <span>{shown || placeholder}</span>
          <span aria-hidden="true">v</span>
        </button>
      </div>
      {popover && createPortal(popover, document.body)}
    </>
  );
}
