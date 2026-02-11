import { useState, useEffect } from 'react';
import './SplashScreen.css';

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // Wait for fade out
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`splash-container ${!isVisible ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <div className="logo-pulse">
            <div className="inner-circle"></div>
        </div>
        <h1>ClueInterview</h1>
        <p>Stealth AI Assistant</p>
      </div>
    </div>
  );
}
