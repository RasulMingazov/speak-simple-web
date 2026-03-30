import React from "react";

export function LogoIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 2.8c5.08 0 9.2 3.56 9.2 7.95 0 2.65-1.48 5.05-3.87 6.5v2.86c0 .47-.51.76-.92.53l-2.62-1.47c-.57.1-1.17.15-1.79.15-5.08 0-9.2-3.56-9.2-7.95S6.92 2.8 12 2.8Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M7.7 10.8c0-.55.45-1 1-1h6.6a1 1 0 1 1 0 2H8.7c-.55 0-1-.45-1-1Zm0 3.4c0-.55.45-1 1-1h4.1a1 1 0 1 1 0 2H8.7c-.55 0-1-.45-1-1Z"
        fill="white"
        opacity="0.9"
      />
    </svg>
  );
}

