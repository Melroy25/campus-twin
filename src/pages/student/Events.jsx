import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { listenEvents } from '../../firebase/firestore';
import { MdEvent } from 'react-icons/md';

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
              {ev.image
                ? <img src={ev.image} alt={ev.title} className="event-card-image" />
                : <div className="event-card-image-placeholder">🎉</div>
              }
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
