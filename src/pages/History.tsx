import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import Header from '../components/Header';

interface HistoryItem {
    id: string;
    date: string;
    messages: { type: 'user' | 'ai'; text: string }[];
}

export default function History() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('interview_history');
    if (saved) {
        try {
            setHistory(JSON.parse(saved).reverse()); // Newest first
        } catch (e) {
            console.error('Failed to parse history', e);
        }
    }
  }, []);

  const clearHistory = () => {
    if (confirm('Are you sure you want to delete all history?')) {
        localStorage.removeItem('interview_history');
        setHistory([]);
    }
  };

  const deleteItem = (id: string) => {
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem('interview_history', JSON.stringify([...newHistory].reverse()));
  };

  const loadSession = (session: HistoryItem) => {
    if (confirm('Load this session? Current unsaved progress will be lost.')) {
        localStorage.setItem('current_session_messages', JSON.stringify(session.messages));
        navigate('/');
    }
  };

  return (
    <>
      <Header title="History" />

      <div className="main-content">
        <div style={{display: 'flex', justifyContent: 'flex-end', padding: '10px'}}>
            <button 
                onClick={clearHistory}
                style={{
                    background: 'rgba(255, 50, 50, 0.2)', 
                    color: '#ff5555',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                }}
            >
                Clear All
            </button>
        </div>

        <div className="history-list">
            {history.length === 0 && (
                <div style={{textAlign: 'center', color: '#666', marginTop: '50px'}}>
                    No interview history found.
                </div>
            )}

            {history.map((item) => (
                <div key={item.id} className="history-card" style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '15px',
                    marginBottom: '15px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                }}
                onClick={() => loadSession(item)}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px'}}>
                        <span style={{color: '#00f3ff', fontSize: '0.9rem'}}>{new Date(item.date).toLocaleString()}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} style={{background: 'none', border: 'none', color: '#666', cursor: 'pointer'}}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                    <div className="history-preview">
                        {item.messages.slice(0, 3).map((msg, idx) => (
                            <div key={idx} style={{fontSize: '0.8rem', marginBottom: '5px', color: msg.type === 'ai' ? '#ccc' : '#888'}}>
                                <strong style={{color: msg.type === 'ai' ? '#00f3ff' : '#aaa'}}>{msg.type === 'ai' ? 'AI: ' : 'Q: '}</strong>
                                {msg.text.substring(0, 100)}{msg.text.length > 100 ? '...' : ''}
                            </div>
                        ))}
                        {item.messages.length > 3 && <div style={{fontSize: '0.7rem', color: '#555', marginTop: '5px'}}>+{item.messages.length - 3} more messages</div>}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </>
  );
}
