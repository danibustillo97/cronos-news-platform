"use client";

import { useEffect } from "react";
import { supabase } from "./supabaseClient";

/**
 * Keeps the httpOnly `cronos_access_token` cookie (read by the /admin middleware and by the
 * /api proxy to the backend) in step with the Supabase session. The cookie used to be written
 * only at login, so after the access token's one hour every backend call (autosave included)
 * started failing with 401 while the editor kept typing.
 */
export function useAdminSessionSync() {
  useEffect(() => {
    let lastPushed: string | null = null;
    let cancelled = false;

    const push = async (token: string | undefined | null) => {
      if (!token || token === lastPushed || cancelled) return;
      lastPushed = token;
      try {
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: token }),
        });
      } catch {
        lastPushed = null; // retried on the next refresh or when the tab becomes visible
      }
    };

    // getSession() refreshes an expired token, so it also covers a laptop waking from sleep.
    const sync = () => { void supabase.auth.getSession().then(({ data }) => push(data.session?.access_token)); };
    sync();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") void push(session?.access_token);
    });
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
