import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export default function Excelr8Logo({ size = 48, showText = true, className = '' }) {
  const { currentTheme } = useTheme();
  const isLightTheme = currentTheme === 'excelr82' || currentTheme === 'upwork';
  const logoColor = isLightTheme ? '#000000' : '#FFFFFF';
  
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Logo Icon - Stylized "8"/"B" shape */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mb-1"
      >
        {/* Small rounded dot on the left */}
        <circle cx="5" cy="24" r="2.5" fill={logoColor} />
        
        {/* Short rounded horizontal bar extending from dot to main shape */}
        <rect x="8.5" y="21.5" width="5" height="5" rx="2.5" fill={logoColor} />
        
        {/* Main "8"/"B" shape - Top horizontal bar (slightly shorter) */}
        <rect x="13.5" y="8" width="14" height="7" rx="3.5" fill={logoColor} />
        
        {/* Main "8"/"B" shape - Bottom horizontal bar (longer) */}
        <rect x="13.5" y="28" width="18" height="7" rx="3.5" fill={logoColor} />
        
        {/* Vertical rounded segment on the right connecting top and bottom */}
        <rect x="27.5" y="8" width="7" height="27" rx="3.5" fill={logoColor} />
        
        {/* Top closed loop - curved connection at top right */}
        <path
          d="M 27.5 15 Q 30 15 30 18 Q 30 21 27.5 21"
          stroke={logoColor}
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      
      {/* EXCELR8 Text */}
      {showText && (
        <span 
          className="text-xl font-bold uppercase tracking-tight"
          style={{ color: logoColor }}
        >
          EXCELR8
        </span>
      )}
    </div>
  );
}

