import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CONSENT_STORAGE_KEY } from "@/lib/site";

/**
 * Storage / cookie notice.
 *
 * Audio Blendr itself only uses essential browser storage (the auth session
 * and this dismissal flag). The embedded YouTube player is a third party
 * that can set its own cookies, which is what this notice discloses.
 *
 * Rendered only after mount so SSR output is identical for every visitor
 * and there is no hydration mismatch.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CONSENT_STORAGE_KEY) !== "accepted") setVisible(true);
    } catch {
      // Storage unavailable (private mode, blocked) — show the notice each visit.
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    } catch {
      // Nothing to persist to; dismiss for this session only.
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie and storage notice"
      className="fixed inset-x-0 top-16 z-50 p-4 md:bottom-0 md:top-auto md:p-6"
    >
      <div className="glass mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl p-5 shadow-elegant md:flex-row md:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          We use essential browser storage to keep you signed in. Playback uses an embedded YouTube
          player, which may set its own cookies.{" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Read our privacy policy
          </Link>
          .
        </p>
        <Button size="sm" variant="secondary" onClick={accept} className="shrink-0">
          Got it
        </Button>
      </div>
    </div>
  );
}
