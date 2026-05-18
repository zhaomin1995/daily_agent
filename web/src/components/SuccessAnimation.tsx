"use client";

import { useEffect, useState } from "react";

interface SuccessAnimationProps {
  show: boolean;
}

export default function SuccessAnimation({ show }: SuccessAnimationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!visible) return null;

  return (
    <div className="flex justify-center py-3 animate-success-pop">
      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400 animate-check-draw">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </div>
  );
}
