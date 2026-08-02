"use client";

import { useAuth } from "@/lib/auth-context";

export function WatermarkOverlay() {
  const { user } = useAuth();
  const text = user?.email || user?.id || "";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden">
      <svg className="h-full w-full opacity-20" viewBox="0 0 400 200" preserveAspectRatio="none">
        <defs>
          <pattern id="watermark" x={0} y={0} width={400} height={200} patternUnits="userSpaceOnUse">
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize="18"
              fontWeight="500"
              fontFamily="monospace"
              transform="rotate(-20 200 100)"
            >
              {text}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#watermark)" />
      </svg>
    </div>
  );
}
