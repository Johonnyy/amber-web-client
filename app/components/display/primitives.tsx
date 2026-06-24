"use client";

import { useState } from "react";
import type { Badge, Field } from "@/lib/displayTypes";

/** A small coloured pill (status/label). Tone maps to a CSS modifier. */
export function BadgePill({ badge }: { badge: Badge }) {
  return <span className={`d-badge d-badge--${badge.tone || "neutral"}`}>{badge.text}</span>;
}

/** A label → value row (used by cards, key-values, weather stats). */
export function FieldRow({ field }: { field: Field }) {
  return (
    <div className="d-field">
      <span className="d-field-label">{field.label}</span>
      <span className="d-field-value">{field.value}</span>
    </div>
  );
}

/** The leading visual for a card/list item.
 *
 * Prefers an emoji (instant, never 404s — ideal for flags on a kiosk). If an
 * `imageUrl` is given it's shown instead, but a load failure falls back to the
 * emoji (or nothing), so a flaky network degrades gracefully.
 */
export function Thumb({
  emoji,
  imageUrl,
  alt,
}: {
  emoji?: string;
  imageUrl?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = imageUrl && !failed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="d-thumb d-thumb--img"
        src={imageUrl}
        alt={alt || ""}
        onError={() => setFailed(true)}
      />
    );
  }
  if (emoji) return <span className="d-thumb d-thumb--emoji">{emoji}</span>;
  return null;
}
