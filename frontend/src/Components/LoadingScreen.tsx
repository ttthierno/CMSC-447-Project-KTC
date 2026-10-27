import { useEffect } from 'react';
import './LoadingScreen.css';

type LoadingScreenProps = {
  onComplete: () => void;
};

function LoadingScreen({ onComplete }: LoadingScreenProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onComplete();
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo-mark">K</div>

        <h1 className="loading-logo-text">
          KonTraCk
        </h1>

        <p className="loading-tagline">
          Every detail. One place.
        </p>

        <div className="loading-progress">
          <div className="loading-progress-bar" />
        </div>
      </div>

      <span className="loading-footer">
        CONSTRUCTION MANAGEMENT
      </span>
    </div>
  );
}

export default LoadingScreen;
