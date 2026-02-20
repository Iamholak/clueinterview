import React from 'react';
import { Minus, Square, X } from 'lucide-react';

interface HeaderProps {
  title: React.ReactNode;
}

export default function Header({ title }: HeaderProps) {
  const handleMinimize = () => {
    if (window.electron && window.electron.minimize) {
      window.electron.minimize();
    }
  };

  const handleMaximize = () => {
    if (window.electron && window.electron.maximize) {
      window.electron.maximize();
    }
  };

  const handleClose = () => {
    if (window.electron && window.electron.close) {
      window.electron.close();
    }
  };

  return (
    <div className="header">
      <div className="header-title">{title}</div>
      <div className="header-controls" style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleMinimize} title="Minimize">
          <Minus size={16} />
        </button>
        <button onClick={handleMaximize} title="Maximize">
          <Square size={14} />
        </button>
        <button onClick={handleClose} title="Close" style={{ color: '#ff5555' }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
