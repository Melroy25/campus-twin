import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getMarksCardsByStudent } from '../../firebase/firestore';
import { MdPictureAsPdf, MdDownload, MdOpenInNew } from 'react-icons/md';

export default function StudentMarksCard() {
  const { currentUser } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) return;
    getMarksCardsByStudent(currentUser.uid).then((data) => {
      const sorted = [...data].sort((a, b) => (a.semester - b.semester));
      setCards(sorted);
      setLoading(false);
    });
  }, [currentUser]);

  return (
    <Layout pageTitle="Marks Card">
      <h1 className="page-title">Marks Card</h1>
      <p className="page-subtitle">Download your semester-wise marks cards</p>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : cards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MdPictureAsPdf /></div>
          <p>No marks cards uploaded yet. Contact your admin.</p>
        </div>
      ) : (
        <div className="grid-3">
          {cards.map((card) => (
            <div key={card.id} className="card" style={{ textAlign: 'center', cursor: 'pointer' }}>
              <div style={{
                width: 64, height: 64, background: 'var(--danger-light)',
                borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 16px', fontSize: '2rem', color: 'var(--danger)',
              }}>
                <MdPictureAsPdf />
              </div>
              <h4 style={{ marginBottom: 4 }}>Semester {card.semester}</h4>
              <p style={{ fontSize: '0.8rem', marginBottom: 16 }}>
                {card.file_url ? 'Marks card available' : 'Not uploaded'}
              </p>
              {card.file_url && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <a
                    href={card.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-primary"
                  >
                    <MdOpenInNew /> View
                  </a>
                  <a
                    href={card.file_url}
                    download
                    className="btn btn-sm btn-secondary"
                  >
                    <MdDownload /> Download
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
