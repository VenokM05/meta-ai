import type { AimCoach } from "../hooks/useAimCoach";
import { UI, type Locale } from "../lib/i18n";

/**
 * Visual mirror of the aim tones. The audio path is primary; this panel exists so a
 * sighted helper can see the same pitch/roll error the user is hearing.
 */
export function AimCoachPanel({ aim, locale }: { aim: AimCoach; locale: Locale }) {
  const t = UI[locale].aim;
  const x = Math.max(-1, Math.min(1, aim.roll / 14)) * 20;
  const y = Math.max(-1, Math.min(1, (aim.pitch - 90) / 14)) * 20;

  return (
    <div className={aim.level ? "rg-aim is-level" : "rg-aim"} aria-hidden="true">
      <div className="rg-aim-level">
        <span className="rg-aim-axis rg-aim-axis--h" />
        <span className="rg-aim-axis rg-aim-axis--v" />
        <span
          className="rg-aim-bubble"
          style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
        />
      </div>
      <div className="rg-aim-read">
        <b>{aim.level ? t.levelHold : aim.guidance}</b>
        <span data-numeric>{t.pitchRoll(Math.round(aim.pitch), Math.round(aim.roll))}</span>
      </div>
    </div>
  );
}
