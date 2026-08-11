import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — MR Força de Vendas" },
      {
        name: "description",
        content: "Defina uma nova senha de acesso à plataforma comercial da MR Cosméticos.",
      },
      { property: "og:title", content: "Redefinir senha — MR Força de Vendas" },
      { property: "og:description", content: "Defina uma nova senha de acesso." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada.");
      void navigate({ to: "/", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <form onSubmit={submit} className="surface-card w-full max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-bold">Definir nova senha</h1>
        <p className="text-sm text-muted-foreground">
          Escolha uma senha com pelo menos 6 caracteres.
        </p>
        <div className="space-y-2">
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl"
          />
        </div>
        <Button type="submit" disabled={loading} size="lg" className="w-full rounded-xl bg-brand-gradient">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar senha
        </Button>
      </form>
    </main>
  );
}
