import { createIsomorphicFn, createMiddleware } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";

import { supabase } from "./client";
import { SUPABASE_AUTH_COOKIE, readAuthCookie } from "./auth-cookie";

/**
 * Resolve o access token do usuário atual.
 *
 * - No browser: sessão do Supabase (localStorage), com fallback para a cookie.
 * - No servidor (SSR / loaders): cabeçalho Authorization já presente ou a
 *   cookie espelhada pelo cliente — evitando o erro
 *   "Unauthorized: No authorization header provided".
 */
const resolveAccessToken = createIsomorphicFn()
  .client(async (): Promise<string | undefined> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? readAuthCookie();
  })
  .server(async (): Promise<string | undefined> => {
    try {
      const header = getRequestHeader("authorization");
      if (header?.startsWith("Bearer ")) return header.slice(7);
      return getCookie(SUPABASE_AUTH_COOKIE) ?? undefined;
    } catch {
      return undefined;
    }
  });

/**
 * Middleware global de serverFn: anexa o bearer do Supabase em toda chamada,
 * tanto no browser quanto durante SSR (a partir da cookie).
 */
export const attachSupabaseBearer = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = await resolveAccessToken();
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
