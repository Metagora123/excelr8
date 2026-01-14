import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="relative inline-block">
          {/* Outer glow ring */}
          <div className="absolute inset-0 animate-ping">
            <div className="w-20 h-20 rounded-full bg-cyan-500/30"></div>
          </div>
          
          {/* Spinning loader */}
          <div className="relative">
            <Loader2 className="w-20 h-20 text-cyan-400 animate-spin" />
          </div>
        </div>
        
        <p className="mt-6 text-xl font-semibold text-gradient animate-pulse">
          {text}
        </p>
      </div>
    </div>
  );
}