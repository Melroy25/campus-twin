import { useState, useEffect } from 'react';
import { queryDocuments, addDocument, deleteDocument, updateDocument, getAll } from '../appwrite/database';
import { Query } from 'appwrite';
import { toast } from 'react-hot-toast';
import { 
  MdChevronLeft, MdChevronRight, MdToday, MdAdd, MdDelete, 
  MdCalendarToday, MdEdit, MdSave, MdClose, MdEventNote 
} from 'react-icons/md';

const SEMESTERS = [
  '1st Semester', '2nd Semester', '3rd Semester', '4th Semester', 
  '5th Semester', '6th Semester', '7th Semester', '8th Semester'
];

const EVENT_TYPES = [
  { id: 'holiday', label: 'Holiday', color: '#ef4444', bg: '#fee2e2', text: '#991b1b' },
  { id: 'exam', label: 'Exam', color: '#10b981', bg: '#d1fae5', text: '#065f46' },
  { id: 'display', label: 'Marks / Attendance Display', color: '#3b82f6', bg: '#dbeafe', text: '#1e40af' },
  { id: 'feedback', label: 'Feedback', color: '#eab308', bg: '#fef9c3', text: '#854d0e' },
  { id: 'other', label: 'Events', color: '#ec4899', bg: '#fce7f3', text: '#9d174d' }
];

const toLocalDateString = (dateInput) => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (trimmed === 'null' || trimmed === 'undefined' || trimmed === '') return '';
    if (trimmed.match(/^\d{4}-\d{2}-\d{2}/)) {
      return trimmed.substring(0, 10);
    }
  }
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
};

export default function CalendarOfEvents({ isAdmin, defaultSemester, teacherClasses }) {
  const [selectedSemester, setSelectedSemester] = useState(defaultSemester || '1st Semester');
  const [semDates, setSemDates] = useState({ startDate: '', endDate: '' });
  const [semDocId, setSemDocId] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingSem, setSavingSem] = useState(false);
  
  // Single month view vs. View All Months
  const [viewAllMonths, setViewAllMonths] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date()); // used to track current month in single mode

  // Add Event Form State
  const [eventForm, setEventForm] = useState({ title: '', date: '', endDate: '', type: 'holiday' });
  const [targetSemesters, setTargetSemesters] = useState([selectedSemester || '1st Semester']);
  const [addingEvent, setAddingEvent] = useState(false);

  // Load Semester Dates & Events
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load dates
      const dateDocs = await queryDocuments('coeSemesters', [Query.equal('semester', selectedSemester)]);
      if (dateDocs && dateDocs.length > 0) {
        setSemDates({
          startDate: dateDocs[0].startDate || '',
          endDate: dateDocs[0].endDate || ''
        });
        setSemDocId(dateDocs[0].$id || dateDocs[0].id);
        
        // Auto-focus calendar month on the semester's start date
        if (dateDocs[0].startDate) {
          setCurrentDate(new Date(dateDocs[0].startDate));
        }
      } else {
        setSemDates({ startDate: '', endDate: '' });
        setSemDocId(null);
      }

      // 2. Load events
      const eventDocs = await queryDocuments('coeEvents', [Query.equal('semester', selectedSemester)]);
      const sortedEvents = (eventDocs || []).sort((a, b) => new Date(a.date) - new Date(b.date));
      setEvents(sortedEvents);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load Calendar of Events data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSemester]);

  useEffect(() => {
    setTargetSemesters([selectedSemester]);
  }, [selectedSemester]);

  // Sync with defaultSemester prop updates
  useEffect(() => {
    if (defaultSemester) {
      setSelectedSemester(defaultSemester);
    }
  }, [defaultSemester]);

  // Save Semester Start/End Dates
  const handleSaveDates = async (e) => {
    e.preventDefault();
    if (!semDates.startDate || !semDates.endDate) {
      return toast.error('Please specify both start and end dates');
    }
    setSavingSem(true);
    try {
      if (semDocId) {
        await updateDocument('coeSemesters', semDocId, {
          startDate: semDates.startDate,
          endDate: semDates.endDate
        });
      } else {
        const newDoc = await addDocument('coeSemesters', {
          semester: selectedSemester,
          startDate: semDates.startDate,
          endDate: semDates.endDate,
          createdAt: new Date().toISOString()
        });
        setSemDocId(newDoc.id || newDoc.$id);
      }
      toast.success('Semester dates saved!');
      loadData();
    } catch (err) {
      toast.error('Failed to save semester dates');
    } finally {
      setSavingSem(false);
    }
  };

  // Add event
  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.date) {
      return toast.error('Event title and date are required');
    }
    if (eventForm.endDate && new Date(eventForm.endDate) < new Date(eventForm.date)) {
      return toast.error('End Date cannot be earlier than Start Date');
    }
    if (targetSemesters.length === 0) {
      return toast.error('Please select at least one semester');
    }
    setAddingEvent(true);
    try {
      const promises = targetSemesters.map(sem => 
        addDocument('coeEvents', {
          semester: sem,
          title: eventForm.title,
          date: eventForm.date,
          endDate: eventForm.endDate || '',
          type: eventForm.type,
          createdAt: new Date().toISOString()
        })
      );
      await Promise.all(promises);
      toast.success(`Event added to ${targetSemesters.length} semester${targetSemesters.length > 1 ? 's' : ''}!`);
      setEventForm({ title: '', date: '', endDate: '', type: 'holiday' });
      setTargetSemesters([selectedSemester]);
      loadData();
    } catch (err) {
      toast.error('Failed to add event');
    } finally {
      setAddingEvent(false);
    }
  };

  // Delete event
  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteDocument('coeEvents', id);
      toast.success('Event deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete event');
    }
  };

  // Calendar rendering logic helpers
  const getMonthsRange = () => {
    if (!semDates.startDate || !semDates.endDate) return [];
    const start = new Date(semDates.startDate);
    const end = new Date(semDates.endDate);
    const range = [];
    
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const stop = new Date(end.getFullYear(), end.getMonth(), 1);
    
    while (current <= stop) {
      range.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
    return range;
  };

  const monthsInRange = getMonthsRange();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const renderMonthCalendar = (monthDate) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthName = monthDate.toLocaleString('default', { month: 'long' }).toUpperCase();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Get first day of the month (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    // Adjusting Sunday to be 6, and Monday to be 0 for standard Mon-Sun rendering
    let firstDayIndex = new Date(year, month, 1).getDay();
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const days = [];
    // Pad initial empty cells
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // Fill days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    // Filter events for this month using pure string boundaries
    const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const monthEvents = events.filter(e => {
      const startStr = toLocalDateString(e.date);
      const endStr = toLocalDateString(e.endDate) || startStr;
      return startStr <= monthEndStr && endStr >= monthStartStr;
    });

    const formatEventDateRange = (startDateStr, endDateStr) => {
      const sDate = new Date(startDateStr);
      const options = { day: 'numeric', month: 'short' };
      const formattedStart = sDate.toLocaleDateString('en-IN', options);
      const cleanEnd = toLocalDateString(endDateStr);
      
      if (cleanEnd && cleanEnd !== toLocalDateString(startDateStr)) {
        const eDate = new Date(endDateStr);
        const formattedEnd = eDate.toLocaleDateString('en-IN', options);
        return `${formattedStart} to ${formattedEnd}`;
      }
      return formattedStart;
    };

    return (
      <div key={`${year}-${month}`} className="coe-month-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 32, borderBottom: '1px solid var(--border)', paddingBottom: 24 }}>
        {/* Left Side: Calendar Grid */}
        <div style={{ maxWidth: 360, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, padding: '4px 10px', borderRadius: 4, background: 'var(--warning-light, #fef3c7)', color: 'var(--warning-dark, #b45309)', letterSpacing: '0.5px' }}>
              {monthName}-{year}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 6px', textAlign: 'center' }}>
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
              <span key={d} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', paddingBottom: 6 }}>
                {d}
              </span>
            ))}

            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} style={{ aspectRatio: '1', background: 'var(--surface-2)', opacity: 0.25, borderRadius: '50%' }} />;
              }

              // Check events for this day using local date string comparison (timezone-safe)
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              
              const dayEvents = monthEvents.filter(e => {
                const eventStartStr = toLocalDateString(e.date);
                const eventEndStr = toLocalDateString(e.endDate) || eventStartStr;
                return dateStr >= eventStartStr && dateStr <= eventEndStr;
              });
              
              const rangeEvents = dayEvents.filter(e => {
                const s = toLocalDateString(e.date);
                const en = toLocalDateString(e.endDate);
                return en && en !== s;
              });
              
              const singleEvents = dayEvents.filter(e => {
                const s = toLocalDateString(e.date);
                const en = toLocalDateString(e.endDate);
                return !en || en === s;
              });

              let isSunday = (idx % 7) === 6;
              
              // 1. Grid Cell Style (Background representing Range Events)
              let cellStyle = {
                aspectRatio: '1', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: dayEvents.length > 0 ? 'pointer' : 'default',
                background: 'var(--surface-2)',
                position: 'relative',
                transition: 'all 0.2s',
              };

              if (rangeEvents.length > 0) {
                const primaryRange = rangeEvents[0];
                const rangeType = EVENT_TYPES.find(t => t.id === primaryRange.type);
                cellStyle.background = rangeType?.bg || 'var(--surface-3)';
                cellStyle.borderRadius = '0%'; // Range events are solid light square blocks
              } else {
                cellStyle.borderRadius = '50%'; // Rounded look when no range is active
              }

              // 2. Inner Circle Style (Representing Single-Day Events, Sundays, or Standard numbers)
              let innerStyle = {
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              };

              if (singleEvents.length > 0) {
                const primarySingle = singleEvents[0];
                const singleType = EVENT_TYPES.find(t => t.id === primarySingle.type);
                innerStyle.background = singleType?.color || 'var(--primary)';
                innerStyle.color = 'white';
                innerStyle.boxShadow = `0 4px 10px ${singleType?.color}35`;
              } else if (rangeEvents.length > 0) {
                const primaryRange = rangeEvents[0];
                const rangeType = EVENT_TYPES.find(t => t.id === primaryRange.type);
                innerStyle.color = rangeType?.text || 'var(--text-primary)';
              } else if (isSunday) {
                innerStyle.background = 'var(--danger-light, #fee2e2)';
                innerStyle.color = 'var(--danger, #ef4444)';
              } else {
                innerStyle.color = 'var(--text-primary)';
              }

              return (
                <div 
                  key={`day-${day}`} 
                  style={cellStyle}
                  title={dayEvents.map(e => e.title).join(', ')}
                >
                  <div style={innerStyle}>
                    {day}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Month Events List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-2)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxHeight: 280, overflowY: 'auto' }}>
          <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
            Events
          </h4>
          {monthEvents.length === 0 ? (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>No scheduled events.</span>
          ) : (
            monthEvents.map(e => {
              const matchedType = EVENT_TYPES.find(t => t.id === e.type);
              const formattedDateRange = formatEventDateRange(e.date, e.endDate);
              return (
                <div key={e.id || e.$id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 8, background: matchedType?.bg || 'var(--surface)', borderRadius: 6, borderLeft: `4px solid ${matchedType?.color || 'var(--primary)'}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: matchedType?.text || 'var(--text-primary)' }}>
                      {formattedDateRange} - {matchedType?.label}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.3 }}>
                      {e.title}
                    </div>
                  </div>
                  {isAdmin && (
                    <button 
                      className="btn btn-sm btn-ghost" 
                      style={{ padding: 2, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }} 
                      onClick={() => handleDeleteEvent(e.id || e.$id)}
                    >
                      <MdDelete size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Determine current active single month
  const activeMonthIndex = monthsInRange.findIndex(m => m.getFullYear() === currentDate.getFullYear() && m.getMonth() === currentDate.getMonth());
  const hasPrev = activeMonthIndex > 0;
  const hasNext = activeMonthIndex < monthsInRange.length - 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header and Selectors */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Semester:</span>
          <select 
            className="form-control" 
            style={{ width: 150, padding: '6px 12px', fontSize: '0.88rem' }}
            value={selectedSemester} 
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            {SEMESTERS.map(sem => <option key={sem} value={sem}>{sem}</option>)}
          </select>
        </div>

        {/* Teacher Class Assignments Subtitle */}
        {teacherClasses && teacherClasses.length > 0 && (
          <div style={{ padding: '6px 12px', background: 'var(--primary-light)', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
            🏫 Associated Classes: {teacherClasses.map(c => c.label).join(', ')}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            className={`btn btn-sm ${!viewAllMonths ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => setViewAllMonths(false)}
          >
            📅 Single Month
          </button>
          <button 
            className={`btn btn-sm ${viewAllMonths ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => setViewAllMonths(true)}
          >
            📋 View All Months
          </button>
        </div>
      </div>

      {/* Main CoE Banner */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)', border: '1px solid var(--border)', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdEventNote style={{ color: 'var(--primary)' }} /> Calendar of Events for {selectedSemester}
          </h3>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Start Date:</span>
            <strong style={{ fontFamily: 'monospace' }}>{semDates.startDate || '—'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>End Date:</span>
            <strong style={{ fontFamily: 'monospace' }}>{semDates.endDate || '—'}</strong>
          </div>
        </div>
      </div>

      {/* Legends */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', padding: '10px 16px', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.8rem' }}>
        {EVENT_TYPES.map(type => (
          <div key={type.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: type.color }} />
            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{type.label}</span>
          </div>
        ))}
      </div>

      {/* Loading state / Empty State / Calendar Render */}
      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : !semDates.startDate ? (
        <div className="empty-state" style={{ minHeight: 180 }}>
          <div className="empty-icon"><MdCalendarToday /></div>
          <p>No start/end dates configured for the <strong>{selectedSemester}</strong> Calendar of Events.</p>
          {isAdmin && <p style={{ fontSize: '0.82rem', marginTop: -8 }}>Use the panel below to configure this semester's schedule.</p>}
        </div>
      ) : (
        <div className="card" style={{ padding: 24 }}>
          {viewAllMonths ? (
            /* Stacked All Months */
            <div>
              {monthsInRange.map(month => renderMonthCalendar(month))}
            </div>
          ) : (
            /* Single Month Slide View */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <button 
                  className="btn btn-sm btn-ghost" 
                  onClick={handlePrevMonth} 
                  disabled={!hasPrev}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <MdChevronLeft size={20} /> Prev Month
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--primary)' }}>
                  <MdToday /> Showing {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </div>
                <button 
                  className="btn btn-sm btn-ghost" 
                  onClick={handleNextMonth} 
                  disabled={!hasNext}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  Next Month <MdChevronRight size={20} />
                </button>
              </div>
              {renderMonthCalendar(currentDate)}
            </div>
          )}
        </div>
      )}

      {/* Admin Panel Controls */}
      {isAdmin && (
        <div className="grid-2" style={{ alignItems: 'start', marginTop: 16 }}>
          {/* Configure Semester Dates */}
          <div className="card card-lg" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
              ⚙️ Set Semester Limits
            </h3>
            <form onSubmit={handleSaveDates} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Semester Start Date</label>
                <input 
                  type="date" 
                  className="form-control"
                  value={semDates.startDate} 
                  onChange={(e) => setSemDates(prev => ({ ...prev, startDate: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Semester End Date</label>
                <input 
                  type="date" 
                  className="form-control"
                  value={semDates.endDate} 
                  onChange={(e) => setSemDates(prev => ({ ...prev, endDate: e.target.value }))}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary btn-block" 
                style={{ marginTop: 6 }} 
                disabled={savingSem}
              >
                {savingSem ? 'Saving limits...' : 'Save Dates'}
              </button>
            </form>
          </div>

          {/* Add Calendar Event */}
          <div className="card card-lg" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
              ➕ Add Calendar Event
            </h3>
            <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Event Description / Title *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Commencement of classes"
                  value={eventForm.title}
                  onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input 
                  type="date" 
                  className="form-control"
                  value={eventForm.date}
                  onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  End Date
                  <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4 }}>Optional — for ranges like Exam Week</span>
                </label>
                <input 
                  type="date" 
                  className="form-control"
                  value={eventForm.endDate}
                  onChange={(e) => setEventForm(prev => ({ ...prev, endDate: e.target.value }))}
                  min={eventForm.date || undefined}
                />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Target Semesters *</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button 
                      type="button" 
                      onClick={() => setTargetSemesters([...SEMESTERS])}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      Select All
                    </button>
                    <span style={{ fontSize: '0.72rem', color: 'var(--border)' }}>|</span>
                    <button 
                      type="button" 
                      onClick={() => setTargetSemesters([selectedSemester])}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', background: 'var(--surface-2)', padding: 10, borderRadius: 'var(--radius)' }}>
                  {SEMESTERS.map(sem => {
                    const isSelected = targetSemesters.includes(sem);
                    return (
                      <button
                        key={sem}
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          borderRadius: 4,
                          cursor: 'pointer',
                          flex: '1 1 22%',
                          textAlign: 'center',
                          border: isSelected ? 'none' : '1px solid var(--border)'
                        }}
                        onClick={() => {
                          if (isSelected) {
                            setTargetSemesters(prev => prev.filter(s => s !== sem));
                          } else {
                            setTargetSemesters(prev => [...prev, sem]);
                          }
                        }}
                      >
                        {sem.replace(' Semester', '')}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Event Type *</label>
                <select 
                  className="form-control"
                  value={eventForm.type}
                  onChange={(e) => setEventForm(prev => ({ ...prev, type: e.target.value }))}
                >
                  {EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <button 
                type="submit" 
                className="btn btn-primary btn-block" 
                style={{ marginTop: 6 }} 
                disabled={addingEvent || !semDates.startDate}
              >
                {addingEvent ? 'Adding to calendar...' : 'Add Event'}
              </button>
              {!semDates.startDate && (
                <span style={{ fontSize: '0.72rem', color: 'var(--danger)', textAlign: 'center' }}>
                  ⚠️ Configure start/end dates first before adding events.
                </span>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
