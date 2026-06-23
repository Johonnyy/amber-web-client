"use client";

import { useEffect, useState } from "react";

/** The centerpiece: a large live clock with the date beneath it.
 *
 * Renders nothing until mounted on the client (the time isn't known during SSR,
 * so rendering it server-side would cause a hydration mismatch).
 */
export function Clock({ clock24h }: { clock24h: boolean }) {
  // Seeded on the client; SSR renders a placeholder time that the client
  // immediately replaces, so the time/date nodes suppress hydration warnings.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: !clock24h,
  });
  const date = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="clock" suppressHydrationWarning>
      <time className="clock-time" suppressHydrationWarning>
        {time}
      </time>
      <div className="clock-date" suppressHydrationWarning>
        {date}
      </div>
    </div>
  );
}
