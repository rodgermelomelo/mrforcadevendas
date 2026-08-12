import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — MR Força de Vendas" },
      {
        name: "description",
        content:
          "Acesso restrito à equipe comercial da MR Cosméticos: entre para criar pedidos da sua carteira.",
      },
      { property: "og:title", content: "Entrar — MR Força de Vendas" },
      { property: "og:description", content: "Acesso da equipe comercial MR Cosméticos." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "recover";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: "/", replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (data.session) void navigate({ to: "/", replace: true });
        else setCheckEmail(true);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação para o seu e-mail.");
        setMode("signin");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/", replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-lg font-bold text-primary-foreground shadow-lift">
            MR
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">
            MR <span className="text-brand-gradient">Força de Vendas</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesso restrito à equipe comercial da MR Cosméticos.
          </p>
        </div>

        <div className="surface-card p-6 sm:p-8">
          {checkEmail ? (
            <div className="space-y-4 text-center">
              <Mail className="mx-auto h-10 w-10 text-primary" />
              <h2 className="text-xl font-semibold">Confirme seu e-mail</h2>
              <p className="text-sm text-muted-foreground">
                Enviamos um link de confirmação para <strong>{email}</strong>. Após confirmar, volte
                aqui para entrar.
              </p>
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => {
                  setCheckEmail(false);
                  setMode("signin");
                }}
              >
                Voltar para o login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold">
                {mode === "signin"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar acesso"
                    : "Recuperar senha"}
              </h2>

              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    required
                    className="rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@mrcosmeticos.com.br"
                  required
                  className="rounded-xl"
                />
              </div>

              {mode !== "recover" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                      className="rounded-xl pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-brand-gradient shadow-lift"
                size="lg"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Entrar" : mode === "signup" ? "Criar acesso" : "Enviar link"}
              </Button>

              {mode !== "recover" && (
                <>
                  <div className="relative py-1 text-center">
                    <span className="relative z-10 bg-card px-3 text-xs uppercase tracking-wide text-muted-foreground">
                      ou
                    </span>
                    <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full rounded-xl"
                    onClick={handleGoogle}
                  >
                    Continuar com Google
                  </Button>
                </>
              )}

              <div className="flex flex-wrap justify-between gap-2 pt-2 text-sm">
                {mode !== "signin" ? (
                  <button type="button" className="text-primary" onClick={() => setMode("signin")}>
                    Já tenho acesso
                  </button>
                ) : (
                  <button type="button" className="text-primary" onClick={() => setMode("signup")}>
                    Criar acesso
                  </button>
                )}
                {mode !== "recover" && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setMode("recover")}
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Visibilidade limitada à sua carteira, aplicada no banco de dados.
        </p>
      </div>
    </main>
  );
}
