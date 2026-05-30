import { useState } from 'react';
import { MdSend } from 'react-icons/md';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * TimetableUpdateFeed — A timeline-style announcement feed.
 * 
 * Props:
 *  - feedItems: Array of { id, message, details?, author_name, author_role ('admin'|'teacher'|'student'), 
 *               createdAt, suggestion?, status? }
 *  - canPost: boolean — whether current user can add messages
 *  - postLabel: string — placeholder text for the input
 *  - onPost: async (messageText) => void — callback when posting
 *  - isSuggestionMode: boolean — if true, posts are labeled as "suggestions" (for students)
 */
export default function TimetableUpdateFeed({ 
  feedItems = [], 
  canPost = false, 
  postLabel = 'Write an update...', 
  onPost, 
  isSuggestionMode = false 
}) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!text.trim() || !onPost) return;
    setPosting(true);
    try {
      await onPost(text.trim());
      setText('');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      {/* Post input */}
      {canPost && (
        <div className="tt-feed-input" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', marginBottom: 16 }}>
          <textarea
            className="form-control"
            placeholder={postLabel}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(); }
            }}
          />
          <button 
            className="btn btn-primary" 
            onClick={handlePost} 
            disabled={posting || !text.trim()}
            style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <MdSend /> {posting ? '...' : isSuggestionMode ? 'Suggest' : 'Post'}
          </button>
        </div>
      )}

      {/* Feed timeline */}
      <div className="tt-feed">
        {feedItems.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <p>No updates yet. {canPost ? 'Be the first to post!' : ''}</p>
          </div>
        ) : (
          feedItems.map((item, idx) => (
            <div key={item.id || idx} className="tt-feed-item">
              <div className="tt-feed-line">
                <div className={`tt-feed-dot ${item.author_role || ''}`} />
                {idx < feedItems.length - 1 && <div className="tt-feed-connector" />}
              </div>
              <div className="tt-feed-body">
                <div className="tt-feed-header">
                  <span className="tt-feed-author">{item.author_name || 'Unknown'}</span>
                  <span className={`tt-feed-role ${item.author_role || ''}`}>
                    {item.author_role || 'user'}
                  </span>
                  {item.status && item.status !== 'general' && (
                    <span className={`badge badge-${item.status}`} style={{ fontSize: '0.68rem' }}>
                      {item.status}
                    </span>
                  )}
                  <span className="tt-feed-time">{timeAgo(item.createdAt)}</span>
                </div>
                <div className="tt-feed-message">{item.message}</div>
                {item.details && <div className="tt-feed-details">{item.details}</div>}
                {item.suggestion && (
                  <div className="tt-feed-suggestion">
                    💡 Suggestion: {item.suggestion}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
