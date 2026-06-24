import type { ComponentType } from "react";
import type { Phase } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { StarfieldFX } from "@/app/components/fx/StarfieldFX";

/** Themes that want a JS (canvas) effect on top of their CSS layers.
 *
 * Adding a JS-driven effect to a theme = one entry here. Themes not listed pay
 * nothing — only their declarative CSS layers render. `Background` reads this map
 * and mounts the component for the active theme (home backdrop only; see there).
 */
export const FX_FOR_THEME: Partial<
  Record<ThemeId, ComponentType<{ phase: Phase }>>
> = {
  space: StarfieldFX,
};
