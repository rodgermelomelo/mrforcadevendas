import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CNPJ_SCHEMA = z.object({
  taxId: z.string().regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos"),
});

export const lookupCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CNPJ_SCHEMA.parse(data))
  .handler(async ({ data }) => {
    try {
      // Usando a Brasil API (gratuita e sem necessidade de chave para testes básicos)
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${data.taxId}`);
      
      if (!response.ok) {
        if (response.status === 404) throw new Error("CNPJ não encontrado.");
        throw new Error("Erro ao consultar serviço de CNPJ.");
      }

      const result = await response.json();
      
      return {
        tradeName: result.nome_fantasia || result.razao_social,
        legalName: result.razao_social,
        city: result.municipio,
        uf: result.uf,
      };
    } catch (error: any) {
      console.error("CNPJ Lookup Error:", error);
      throw new Error(error.message || "Falha na consulta do CNPJ.");
    }
  });
