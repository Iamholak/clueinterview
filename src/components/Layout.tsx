import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Settings, User, History } from 'lucide-react';
import type { CSSProperties } from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const resizeHandleStyle: CSSProperties & { WebkitAppRegion?: string } = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '20px',
    height: '20px',
    cursor: 'se-resize',
    zIndex: 9999,
    background: 'linear-gradient(135deg, transparent 50%, rgba(0, 243, 255, 0.4) 50%)',
    borderBottomRightRadius: '4px',
    WebkitAppRegion: 'no-drag',
    touchAction: 'none',
    display: 'none',
  };

  return (
    <div className="app-container">
      {children}
      
      {/* Hidden because native frame resize is enabled */}
      <div 
        style={resizeHandleStyle}
      />

      <div className="bottom-nav">
        <button 
          className={`nav-item ${isActive('/history') ? 'active' : ''}`}
          onClick={() => navigate('/history')}
        >
          <History size={20} />
          <span>History</span>
        </button>
        <button 
          className={`nav-item ${isActive('/') ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          <Home size={20} />
          <span>Session</span>
        </button>
        <button 
          className={`nav-item ${isActive('/profile') ? 'active' : ''}`}
          onClick={() => navigate('/profile')}
        >
          <User size={20} />
          <span>Profile</span>
        </button>
        <button 
          className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
          onClick={() => navigate('/settings')}
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
