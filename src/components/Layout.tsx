import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Settings, User, History } from 'lucide-react';
import { useRef } from 'react';
import type { CSSProperties } from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Capture the pointer and store the initial screen position and window size
    e.currentTarget.setPointerCapture(e.pointerId);
    startPos.current = { x: e.screenX, y: e.screenY };
    startSize.current = { 
      width: window.outerWidth, 
      height: window.outerHeight 
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    if (window.electron) {
      // Delta is the distance the mouse has moved from the start position
      const deltaX = e.screenX - startPos.current.x;
      const deltaY = e.screenY - startPos.current.y;
      
      // New size = Initial Size + Delta
      const newWidth = Math.max(300, startSize.current.width + deltaX);
      const newHeight = Math.max(400, startSize.current.height + deltaY);
      
      window.electron.resize(Math.round(newWidth), Math.round(newHeight));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

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
  };

  return (
    <div className="app-container">
      {children}
      
      {/* Visual Resize Handle - Standard Way for Frameless Windows */}
      <div 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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
