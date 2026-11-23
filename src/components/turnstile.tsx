import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type TurnstileWidget = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window { turnstile?: TurnstileWidget }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | undefined;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => {
      scriptPromise = undefined;
      script.remove();
      reject(new Error("Turnstile script failed to load"));
    }, { once: true });
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type TurnstileHandle = { reset: () => void };

type TurnstileProps = {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: (message: string) => void;
  theme?: "dark" | "light" | "auto";
  action?: string;
};

// Cloudflare Turnstile widget. The token is single-use, so callers reset the
// widget whenever an auth attempt fails and a fresh challenge is required.
export const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(function Turnstile(
  { siteKey, onToken, onError, theme = "dark", action },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const token = useRef(onToken);
  const failure = useRef(onError);
  token.current = onToken;
  failure.current = onError;

  useEffect(() => {
    let cancelled = false;
    loadTurnstile().then(() => {
      if (cancelled || !container.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        theme,
        size: "flexible",
        language: "tr",
        action,
        callback: (value: string) => token.current(value),
        "expired-callback": () => token.current(""),
        "timeout-callback": () => token.current(""),
        "error-callback": () => {
          token.current("");
          failure.current?.("Güvenlik doğrulaması tamamlanamadı. Sayfayı yenileyip tekrar dene.");
        },
      });
    }).catch(() => {
      if (!cancelled) failure.current?.("Güvenlik doğrulaması yüklenemedi. Bağlantını kontrol edip sayfayı yenile.");
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [siteKey, theme, action]);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }), []);

  return <div ref={container} className="turnstile-widget" />;
});
