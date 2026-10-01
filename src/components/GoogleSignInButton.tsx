"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { loginWithGoogle } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function GoogleSignInButton({ onSuccess }: { onSuccess: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scriptReady || !CLIENT_ID || !ref.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (response) => {
        try {
          await loginWithGoogle(response.credential);
          onSuccess();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Google sign-in failed");
        }
      },
    });
    window.google.accounts.id.renderButton(ref.current, {
      theme: "outline",
      size: "large",
      width: 320,
      shape: "pill",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady]);

  if (!CLIENT_ID) {
    return (
      <p className="text-[11px] text-muted text-center">
        Google sign-in not configured (set <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>).
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setError("Couldn't load Google sign-in (check network or ad-blocker)")}
      />
      {/* Fixed height matches the rendered button (size="large") so nothing
          shifts, and a skeleton fills the gap instead of looking blank while
          the GSI script loads. */}
      <div ref={ref} className="h-10 w-[320px] max-w-full relative">
        {!scriptReady && !error && (
          <div className="absolute inset-0 rounded-full bg-panel-2 animate-pulse" />
        )}
      </div>
      {error && <p className="text-[11px] text-rose-400 text-center">{error}</p>}
    </div>
  );
}
