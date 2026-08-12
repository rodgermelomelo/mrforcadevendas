import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getIsApprover } from "@/lib/team.functions";

/** Gerentes, gestores, supervisores e administradores. */
export function useIsApprover() {
  return useQuery({
    queryKey: ["is-approver"],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return false;
      try {
        return await getIsApprover();
      } catch {
        return false;
      }
    },
  });
}
