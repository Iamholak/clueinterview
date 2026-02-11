import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { Trash2, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const [resume, setResume] = useState(localStorage.getItem('user_resume') || '');
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'resume' | 'history'>('resume');
  const navigate = useNavigate();

  useEffect(() => {
    // Load history
    const savedHistory = localStorage.getItem('interview_history');
    if (savedHistory) {
        setHistory(JSON.parse(savedHistory).reverse()); // Newest first
    }
  }, []);

  useEffect(() => {
    if (saved) {
        const timer = setTimeout(() => setSaved(false), 2000);
        return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleSave = () => {
    localStorage.setItem('user_resume', resume);
    setSaved(true);
  };

  const clearHistory = () => {
      if (window.confirm("Are you sure you want to clear all chat history?")) {
          localStorage.removeItem('interview_history');
          setHistory([]);
      }
  };

  const loadSession = (session: any) => {
        // Just load it. The user clicked it intentionally.
        // If we really want safety, we can check if current session has messages.
        // But for "High Priority" fix of "not working", removing blocking confirm is best.
        localStorage.setItem('current_session_messages', JSON.stringify(session.messages));
        navigate('/');
    };

  const formatDate = (dateString: string) => {
      try {
          return new Date(dateString).toLocaleString();
      } catch (e) {
          return dateString;
      }
  };

  return (
    <>
      <Header title="My Profile" />

      <div className="main-content">
        <div className="settings-page">
            
            <div style={{display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #333'}}>
                <button 
                    onClick={() => setActiveTab('resume')}
                    style={{
                        padding: '10px 20px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'resume' ? '2px solid #00f3ff' : 'none',
                        color: activeTab === 'resume' ? '#fff' : '#666',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'resume' ? 'bold' : 'normal'
                    }}
                >
                    Resume
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    style={{
                        padding: '10px 20px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'history' ? '2px solid #00f3ff' : 'none',
                        color: activeTab === 'history' ? '#fff' : '#666',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'history' ? 'bold' : 'normal'
                    }}
                >
                    History
                </button>
            </div>

            {activeTab === 'resume' ? (
                <>
                    <div className="section-info" style={{marginBottom: '1rem', color: '#ccc', fontSize: '0.9rem'}}>
                        Paste your resume below. The AI will use this information to tailor its answers to your experience and skills during the interview.
                    </div>

                    <div className="form-group" style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
                        <label>Resume Content</label>
                        <textarea 
                            className="form-control" 
                            style={{
                                flex: 1, 
                                minHeight: '300px', 
                                resize: 'none', 
                                fontFamily: 'monospace',
                                fontSize: '0.85rem',
                                lineHeight: '1.4'
                            }}
                            placeholder="Paste your resume text here..."
                            value={resume}
                            onChange={(e) => setResume(e.target.value)}
                        />
                    </div>

                    <button 
                        onClick={handleSave} 
                        style={{
                            marginTop: '1rem', 
                            width: '100%',
                            backgroundColor: saved ? '#4caf50' : '#00f3ff',
                            color: saved ? '#fff' : '#000',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {saved ? 'Saved!' : 'Save Resume'}
                    </button>
                </>
            ) : (
                <div style={{flex: 1, overflowY: 'auto'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                        <h3 style={{margin: 0}}>Past Interviews</h3>
                        {history.length > 0 && (
                            <button 
                                onClick={clearHistory}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ff5555',
                                    cursor: 'pointer',
                                    display: 'flex', 
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.8rem'
                                }}
                            >
                                <Trash2 size={14} /> Clear All
                            </button>
                        )}
                    </div>
                    
                    {history.length === 0 ? (
                        <div style={{textAlign: 'center', color: '#666', marginTop: '50px'}}>
                            No interview history yet.
                        </div>
                    ) : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                            {history.map((item, idx) => (
                                <div key={idx} 
                                    onClick={() => loadSession(item)}
                                    title="Click to load this session"
                                    style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '8px',
                                    padding: '15px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                >
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                                        <div style={{color: '#00f3ff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                            <Calendar size={14} /> {formatDate(item.date)}
                                        </div>
                                        <div style={{color: '#888', fontSize: '0.8rem'}}>
                                            {item.messages.length} messages
                                        </div>
                                    </div>
                                    <div style={{maxHeight: '150px', overflowY: 'auto', fontSize: '0.85rem', color: '#ddd'}}>
                                        {item.messages.slice(0, 3).map((m: any, i: number) => (
                                            <div key={i} style={{marginBottom: '4px', opacity: 0.8}}>
                                                <strong>{m.type === 'user' ? 'Interviewer: ' : m.type === 'context' ? 'Me: ' : 'AI: '}</strong>
                                                {m.text.substring(0, 60)}...
                                            </div>
                                        ))}
                                        {item.messages.length > 3 && <div style={{color: '#666', fontSize: '0.8rem'}}>... and {item.messages.length - 3} more</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </>
  );
}
