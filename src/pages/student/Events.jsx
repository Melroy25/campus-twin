import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { listenEvents } from '../../appwrite/database';
import { MdEvent, MdDownload } from 'react-icons/md';

export default function StudentEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenEvents((data) => { setEvents(data); setLoading(false); });
    return unsub;
  }, []);

  const formatDate = (val) => {
    if (!val) return '';
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <Layout pageTitle="Events">
      <h1 className="page-title">Campus Events</h1>
      <p className="page-subtitle">Stay updated with what's happening on campus</p>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MdEvent /></div>
          <p>No events posted yet. Check back later!</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map((ev) => (
            <div key={ev.id} className="event-card">
              <div style={{ position: 'relative' }}>
                {ev.image ? (
                  <>
                    <img src={ev.image} alt={ev.title} className="event-card-image" />
                    <a href={ev.image} download={`${ev.title || 'event_image'}.jpg`} target="_blank" rel="noreferrer" style={{
                      position: 'absolute', top: 12, right: 12,
                      background: 'rgba(255,255,255,0.9)',
                      color: 'var(--primary)',
                      width: 32, height: 32,
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: 'var(--shadow)',
                      textDecoration: 'none',
                      transition: 'transform 0.2s'
                    }} title="Download Image">
                      <MdDownload size={18} />
                    </a>
                  </>
                ) : (
                  <div className="event-card-image-placeholder">🎉</div>
                )}
              </div>
              <div className="event-card-body">
                <div className="event-card-date">{formatDate(ev.date)}</div>
                <div className="event-card-title">{ev.title}</div>
                <div className="event-card-desc">{ev.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
