"use client";

import { useEffect, useState } from "react";
import { dateOptions, type DateFormat } from "@/lib/themes";

/** The clock — time over an optional date line. Format is fully driven by
 *  settings; *where* it sits on screen is handled by the wrapper in AmberClient.
 *
 * Seeded on the client; SSR renders a placeholder the client replaces, so the
 * time/date nodes suppress hydration warnings.
 */
export function Clock({
  clock24h,
  showSeconds,
  dateFormat,
}: {
  clock24h: boolean;
  showSeconds: boolean;
  dateFormat: DateFormat;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: showSeconds ? "2-digit" : undefined,
    hour12: !clock24h,
  });

  const dOpts = dateOptions(dateFormat);
  const date = dOpts ? now.toLocaleDateString([], dOpts) : "";

  return (
    <div className="clock" suppressHydrationWarning>
      <time className="clock-time" suppressHydrationWarning>
        {time}
      </time>
      {date && (
        <div className="clock-date" suppressHydrationWarning>
          {date}
        </div>
      )}
    </div>
  );
}
