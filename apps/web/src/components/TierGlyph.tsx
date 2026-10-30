import type { HazardTier } from "@roomguide/core";
import { IconCaution, IconHazard, IconInfo } from "../lib/icons";

/**
 * Tier is encoded by shape first and colour second, deliberately: three distinct
 * silhouettes (triangle / diamond / circle) so the meaning survives greyscale,
 * colour blindness, and a screen reader reading the text label.
 */
export function TierGlyph({ tier, label }: { tier: HazardTier; label?: string }) {
  const Cmp = tier === "critical" ? IconHazard : tier === "caution" ? IconCaution : IconInfo;
  return (
    <span className="rg-concept-glyph" data-tier={tier} role="img" aria-label={label ?? tier}>
      <Cmp width="100%" height="100%" />
    </span>
  );
}
