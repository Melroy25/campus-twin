import React, { useMemo, useState, useCallback } from 'react';
import { MdAdd, MdEdit, MdDelete, MdClose, MdCallSplit } from 'react-icons/md';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const DEFAULT_SLOTS = [
  { label: '9:00 - 9:55',   start: '09:00', end: '09:55' },
  { label: '9:55 - 10:50',  start: '09:55', end: '10:50' },
  { label: '11:10 - 12:05', start: '11:10', end: '12:05' },
  { label: '12:05 - 1:00',  start: '12:05', end: '13:00' },
  { label: '2:00 - 3:00',   start: '14:00', end: '15:00' },
  { label: '3:00 - 4:00',   start: '15:00', end: '16:00' },
  { label: '4:00 - 5:00',   start: '16:00', end: '17:00' },
];

function hashColor(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 10;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (h < 8) h += 12;
  return h * 60 + m;
}

function formatTime(t24) {
  if (!t24) return '';
  const [hStr, mStr] = t24.split(':');
  let h = parseInt(hStr);
  const m = mStr || '00';
  if (h === 0) return `12:${m}`;
  if (h <= 12) return `${h}:${m}`;
  return `${h - 12}:${m}`;
}

function findSlotIndex(entry, slots) {
  const startStr = entry.start_time || (entry.time ? entry.time.split('-')[0].trim() : '');
  const startMin = parseTimeToMinutes(startStr);
  if (startMin === null) return -1;
  for (let i = 0; i < slots.length; i++) {
    const slotStart = parseTimeToMinutes(slots[i].start);
    if (slotStart !== null && startMin >= slotStart - 15 && startMin <= slotStart + 15) return i;
  }
  return -1;
}

function findSpan(entry, startSlotIdx, slots) {
  const endStr = entry.end_time || (entry.time ? entry.time.split('-')[1]?.trim() : '');
  if (!endStr) return 1;
  const endMin = parseTimeToMinutes(endStr);
  if (endMin === null) return 1;
  for (let i = startSlotIdx; i < slots.length; i++) {
    const slotEnd = parseTimeToMinutes(slots[i].end);
    if (slotEnd !== null && endMin <= slotEnd + 15) return i - startSlotIdx + 1;
  }
  return 1;
}

export default function TimetableGrid({
  entries = [],
  timeSlots,
  onCellClick,         // (entry, day, slotOrRange) => void
  editable = false,
  onSlotsChange,       // (newSlots) => void — for column management
  showSlotControls = false
}) {
  const slots = timeSlots || DEFAULT_SLOTS;
  const todayName = DAYS[new Date().getDay() - 1] || '';

  // Column editing modal
  const [editSlotModal, setEditSlotModal] = useState(false);
  const [editSlotIdx, setEditSlotIdx] = useState(-1);
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');

  // Drag selection for merging cells per-row
  const [dragging, setDragging] = useState(false);
  const [dragDay, setDragDay] = useState(-1);
  const [dragStart, setDragStart] = useState(-1);
  const [dragEnd, setDragEnd] = useState(-1);

  const gridMap = useMemo(() => {
    const map = {};
    DAYS.forEach((_, di) => { map[di] = {}; });
    entries.forEach(entry => {
      const dayIdx = DAYS.indexOf(entry.day);
      if (dayIdx === -1) return;
      const slotIdx = findSlotIndex(entry, slots);
      if (slotIdx === -1) return;
      const span = findSpan(entry, slotIdx, slots);
      map[dayIdx][slotIdx] = { entry, span };
      for (let s = 1; s < span; s++) map[dayIdx][slotIdx + s] = { covered: true };
    });
    return map;
  }, [entries, slots]);

  // --- Drag handlers for per-row cell merging ---
  const handleMouseDown = useCallback((di, si) => {
    if (!editable) return;
    // Only start drag on empty cells
    if (gridMap[di]?.[si]) return;
    setDragging(true);
    setDragDay(di);
    setDragStart(si);
    setDragEnd(si);
  }, [editable, gridMap]);

  const handleMouseEnter = useCallback((di, si) => {
    if (!dragging || di !== dragDay) return;
    // Only extend to empty cells — check if any cell in the range is occupied
    const minSi = Math.min(dragStart, si);
    const maxSi = Math.max(dragStart, si);
    let canExtend = true;
    for (let s = minSi; s <= maxSi; s++) {
      if (gridMap[di]?.[s]) { canExtend = false; break; }
    }
    if (canExtend) setDragEnd(si);
  }, [dragging, dragDay, dragStart, gridMap]);

  const handleMouseUp = useCallback(() => {
    if (!dragging) return;
    const minSi = Math.min(dragStart, dragEnd);
    const maxSi = Math.max(dragStart, dragEnd);
    const day = DAYS[dragDay];

    // Build a "range slot" with start of first slot and end of last slot
    const rangeSlot = {
      start: slots[minSi].start,
      end: slots[maxSi].end,
      span: maxSi - minSi + 1,
    };
    onCellClick?.(null, day, rangeSlot);

    setDragging(false);
    setDragDay(-1);
    setDragStart(-1);
    setDragEnd(-1);
  }, [dragging, dragStart, dragEnd, dragDay, slots, onCellClick]);

  // Cancel drag if mouse leaves grid
  const handleMouseLeave = useCallback(() => {
    if (dragging) {
      setDragging(false);
      setDragDay(-1);
      setDragStart(-1);
      setDragEnd(-1);
    }
  }, [dragging]);

  const isInDragRange = (di, si) => {
    if (!dragging || di !== dragDay) return false;
    const minSi = Math.min(dragStart, dragEnd);
    const maxSi = Math.max(dragStart, dragEnd);
    return si >= minSi && si <= maxSi;
  };

  // === Slot management handlers ===
  const openAddSlot = () => {
    setEditSlotIdx(-1);
    setSlotStart('');
    setSlotEnd('');
    setEditSlotModal(true);
  };

  const openEditSlot = (idx) => {
    setEditSlotIdx(idx);
    setSlotStart(slots[idx].start);
    setSlotEnd(slots[idx].end);
    setEditSlotModal(true);
  };

  const saveSlot = () => {
    if (!slotStart || !slotEnd) return;
    const newSlot = { label: `${formatTime(slotStart)} - ${formatTime(slotEnd)}`, start: slotStart, end: slotEnd };
    let updated;
    if (editSlotIdx >= 0) {
      updated = [...slots];
      updated[editSlotIdx] = newSlot;
    } else {
      updated = [...slots, newSlot].sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));
    }
    onSlotsChange?.(updated);
    setEditSlotModal(false);
  };

  const deleteSlot = (idx) => {
    if (!window.confirm('Delete this time column?')) return;
    const updated = slots.filter((_, i) => i !== idx);
    onSlotsChange?.(updated);
  };

  const splitSlot = (idx) => {
    const slot = slots[idx];
    const startMin = parseTimeToMinutes(slot.start);
    const endMin = parseTimeToMinutes(slot.end);
    if (startMin === null || endMin === null) return;
    const mid = Math.floor((startMin + endMin) / 2);
    const midH = Math.floor(mid / 60);
    const midM = mid % 60;
    const midStr = `${String(midH).padStart(2, '0')}:${String(midM).padStart(2, '0')}`;
    const slot1 = { label: `${formatTime(slot.start)} - ${formatTime(midStr)}`, start: slot.start, end: midStr };
    const slot2 = { label: `${formatTime(midStr)} - ${formatTime(slot.end)}`, start: midStr, end: slot.end };
    const updated = [...slots];
    updated.splice(idx, 1, slot1, slot2);
    onSlotsChange?.(updated);
  };

  return (
    <div className="tt-scroll-wrapper" onMouseLeave={handleMouseLeave}>
      {/* Slot Controls Toolbar */}
      {showSlotControls && (
        <div className="tt-toolbar">
          <button className="btn btn-sm btn-ghost" onClick={openAddSlot}>
            <MdAdd /> Add Column
          </button>
          {editable && (
            <span className="tt-drag-hint">
              💡 Drag across empty cells to create a multi-slot entry
            </span>
          )}
        </div>
      )}

      <div
        className="tt-grid"
        style={{ gridTemplateColumns: `100px repeat(${slots.length}, minmax(90px, 1fr))` }}
        onMouseUp={handleMouseUp}
      >
        {/* Header row */}
        <div className="tt-corner">Day / Time</div>
        {slots.map((slot, i) => (
          <div key={i} className="tt-header">
            <div className="tt-header-time">
              {slot.label.split(' - ').map((t, ti) => (
                <div key={ti}>{t}</div>
              ))}
            </div>
            {showSlotControls && (
              <div className="tt-header-actions">
                <button className="tt-header-btn" title="Edit timing" onClick={(e) => { e.stopPropagation(); openEditSlot(i); }}>
                  <MdEdit size={12} />
                </button>
                <button className="tt-header-btn" title="Split into 2" onClick={(e) => { e.stopPropagation(); splitSlot(i); }}>
                  <MdCallSplit size={12} />
                </button>
                <button className="tt-header-btn tt-header-btn-danger" title="Delete column" onClick={(e) => { e.stopPropagation(); deleteSlot(i); }}>
                  <MdDelete size={12} />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Day rows */}
        {DAYS.map((day, di) => (
          <React.Fragment key={`row-${di}`}>
            <div className={`tt-day-label ${day === todayName ? 'tt-today' : ''}`}>
              {day.slice(0, 3)}
            </div>
            {slots.map((slot, si) => {
              const cell = gridMap[di]?.[si];
              if (cell?.covered) return null;

              if (cell?.entry) {
                const e = cell.entry;
                const span = cell.span || 1;
                return (
                  <div
                    key={`${di}-${si}`}
                    className="tt-cell"
                    style={span > 1 ? { gridColumn: `span ${span}` } : {}}
                    onClick={() => onCellClick?.(e, day, slot)}
                  >
                    <div
                      className={`tt-entry ${e.status === 'modified' ? 'tt-entry-modified' : ''}`}
                      data-color={hashColor(e.subject)}
                    >
                      <span className="tt-entry-subject">{e.subject}</span>
                      {e.teacher && <span className="tt-entry-teacher">{e.teacher}</span>}
                      {e.room && <span className="tt-entry-room">📍 {e.room}</span>}
                      {span > 1 && <span className="tt-entry-span">{span} slots</span>}
                    </div>
                  </div>
                );
              }

              const inRange = isInDragRange(di, si);
              return (
                <div
                  key={`${di}-${si}`}
                  className={`tt-cell ${editable ? 'tt-cell-empty' : ''} ${inRange ? 'tt-cell-drag-selected' : ''}`}
                  onMouseDown={() => handleMouseDown(di, si)}
                  onMouseEnter={() => handleMouseEnter(di, si)}
                  onClick={() => {
                    // Only fire single-click if NOT dragging a range
                    if (!dragging && editable) onCellClick?.(null, day, slot);
                  }}
                >
                  {editable && !inRange && <span className="tt-add-icon"><MdAdd /></span>}
                  {inRange && <span className="tt-drag-label">⊞</span>}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Edit Slot Modal */}
      {editSlotModal && (
        <div className="modal-overlay" onClick={() => setEditSlotModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <span className="modal-title">{editSlotIdx >= 0 ? 'Edit Time Slot' : 'Add Time Slot'}</span>
              <button className="modal-close" onClick={() => setEditSlotModal(false)}><MdClose /></button>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Start Time *</label>
                <input type="time" className="form-control" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">End Time *</label>
                <input type="time" className="form-control" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditSlotModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSlot} disabled={!slotStart || !slotEnd}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { DAYS, DEFAULT_SLOTS, hashColor, formatTime };
