import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import VolumeButton from "@/plugins/VolumeButtonPlugin";

export const pendingSosKey = "resqme_pending_sos";

/**
 * Global native SOS trigger listener.
 *
 * Rationale: volume/wake-word triggers can arrive while the user is on /auth (or any route).
 * We persist a short-lived "pending SOS" flag and navigate to / so the dashboard can show
 * the 5s cancel window and start recording.
 */
export function NativeSOSTriggerListener() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let remove: (() => void) | undefined;

    const setup = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        const { supported } = await VolumeButton.isSupported();
        if (!supported) return;

        const listener = await VolumeButton.addListener("volumeButtonsPressed", (data) => {
          if (!data?.triggered) return;

          try {
            localStorage.setItem(pendingSosKey, String(Date.now()));
          } catch {
            // ignore storage failures
          }

          // If we're not on the main screen, jump there so the SOS UI can take over.
          if (location.pathname !== "/") {
            navigate("/", { replace: false });
          }

          // Also notify the currently-mounted UI (if any).
          window.dispatchEvent(new CustomEvent("resqme:sos-trigger", { detail: data }));
        });

        remove = listener.remove;
      } catch (e) {
        console.log("NativeSOSTriggerListener setup failed:", e);
      }
    };

    setup();

    return () => {
      remove?.();
    };
  }, [navigate, location.pathname]);

  return null;
}
