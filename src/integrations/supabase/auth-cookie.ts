import type { Session } from "@supabase/supabase-js";

import { supabase } from "./client";

/** Cookie usada para levar o access token ao servidor (SSR e serverFns). */
export const SUPABASE_AUTH_COOKIE = "sb-access-token";

function writeCookie(token: string, maxAgeSeconds: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SUPABASE_AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${Math.max(
    0,
    Math.floor(maxAgeSeconds),
  )}; SameSite=Lax${secure}`;
}

function eraseCookie() {
  document.cookie = `${SUPABASE_AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Lê o access token da cookie no browser. */
export function readAuthCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${SUPABASE_AUTH_COOKIE}=`));
  if (!match) return undefined;
  const value = decodeURIComponent(match.slice(SUPABASE_AUTH_COOKIE.length + 1));
  return value || undefined;
}

/** Mantém a cookie em sincronia com a sessão do Supabase (localStorage). */
export function syncAuthCookie(session: Session | null) {
  if (typeof document === "undefined") return;
  if (!session?.access_token) {
    eraseCookie();
    return;
  }
  const expiresAt = session.expires_at ? session.expires_at * 1000 : Date.now() + 60 * 60 * 1000;
  writeCookie(session.access_token, (expiresAt - Date.now()) / 1000);
}

/**
 * Espelha a sessão atual na cookie e mantém o espelho atualizado em cada
 * mudança de estado de autenticação (login, refresh de token, logout).
 * Retorna a função de cleanup.
 */
export function startAuthCookieSync(): () => void {
  if (typeof document === "undefined") return () => {};
  void supabase.auth.getSession().then(({ data }) => syncAuthCookie(data.session));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    syncAuthCookie(session);
  });
  return () => data.subscription.unsubscribe();
}
