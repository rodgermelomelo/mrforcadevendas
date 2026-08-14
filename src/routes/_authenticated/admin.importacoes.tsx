import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileCheck2, AlertTriangle, ShieldAlert, Loader2, CheckCircle2, Search, Table, Eye } from "lucide-react";
import { toast } from "sonner";
import { analyzeErpFile, publishErpFile, getIsAdmin, getErpBaseRecords } from "@/lib/admin.functions";
import { formatDateTimeBR } from "@/lib/pricing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/importacoes")({
  component: ImportacoesPage,
  head: () => ({
    meta: [
      { title: "Central de Importações · MR Força de Vendas" },
      { name: "description", content: "Importe o arquivo dados.txt do ERP e publique o catálogo oficial." },
      { property: "og:title", content: "Central de Importações · MR Força de Vendas" },
      { property: "og:description", content: "Upload, validação e publicação atômica dos dados do ERP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/** Lê o arquivo preservando Latin-1: 1 byte = 1 char. */
async function readLatin1(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let out = "";
  const STEP = 32768;
  for (let i = 0; i < buffer.length; i += STEP) {
    out += String.fromCharCode(...buffer.subarray(i, i + STEP));
  }
  return out;
}

function nf(n: number) {
  return n.toLocaleString("pt-BR");
}

function CatalogImpactPanel({ impact }: { impact: any }) {
  if (!impact) return null;
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
        Impacto no catálogo protegido
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {[
          ["Produtos novos", impact.newProducts],
          ["Produtos sumidos", impact.missingProducts],
          ["Grupos ERP novos", impact.newGroups],
          ["Curadoria preservada", impact.preservedCuratedProducts],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border/70 bg-background/70 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-sm font-semibold">{nf(Number(value ?? 0))}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        O ERP gera {nf(Number(impact.taxonomySuggestions ?? 0))} sugestões de marca/categoria, mas não sobrescreve
        marca, categoria, liberação, lançamento ou status já curados no catálogo.
      </p>
      {(impact.newProductSamples?.length || impact.missingProductSamples?.length || impact.newGroupSamples?.length) && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {impact.newProductSamples?.length > 0 && <p>Novos: {impact.newProductSamples.join(", ")}</p>}
          {impact.missingProductSamples?.length > 0 && <p>Sumidos: {impact.missingProductSamples.join(", ")}</p>}
          {impact.newGroupSamples?.length > 0 && <p>Grupos novos: {impact.newGroupSamples.join(", ")}</p>}
        </div>
      )}
    </div>
  );
}

function ImportacoesPage() {
  const queryClient = useQueryClient();
  const analyze = useServerFn(analyzeErpFile);
  const publish = useServerFn(publishErpFile);
  const adminQuery = useQuery({
    queryKey: ["is-admin"],
    retry: false,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return false;
      try {
        return await getIsAdmin();
      } catch {
        return false;
      }
    },
  });

  const [content, setContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async (text: string) => analyze({ data: { content: text } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: async (text: string) => publish({ data: { content: text } }),
    onSuccess: async (res) => {
      setPublishedAt(new Date().toISOString());
      await queryClient.invalidateQueries();
      toast.success("Publicação concluída — dados do ERP atualizados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const summary = analyzeMutation.data;

  if (adminQuery.isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />;
  }

  if (!adminQuery.data) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Área restrita</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Somente administradores podem acessar a Central de Importações.
        </p>
      </div>
    );
  }

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    analyzeMutation.reset();
    publishMutation.reset();
    setPublishedAt(null);
    setFileName(file.name);
    const text = await readLatin1(file);
    setContent(text);
    analyzeMutation.mutate(text);
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Central de Importações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie o arquivo <code className="rounded bg-muted px-1">dados.txt</code> do ERP (largura fixa, Latin-1).
          O arquivo é validado no servidor e só é publicado após a sua confirmação.
        </p>
      </header>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center transition-colors hover:border-primary/60">
        <Upload className="h-6 w-6 text-primary" />
        <span className="text-sm font-medium">{fileName || "Selecionar arquivo dados.txt"}</span>
        <span className="text-xs text-muted-foreground">Parsing e gravação acontecem no servidor</span>
        <input
          type="file"
          accept=".txt,text/plain"
          className="sr-only"
          onChange={(e) => void onPick(e.target.files?.[0])}
        />
      </label>

      {analyzeMutation.isPending && (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Analisando arquivo…
        </div>
      )}

      {summary && !summary.ok && (
        <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> Arquivo rejeitado — nada foi gravado
          </h2>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {summary.errors.map((e: any, i: number) => (
              <li key={i}>
                [linha {e.line} · tipo {e.type}] {e.code}: {e.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary && summary.ok && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileCheck2 className="h-4 w-4 text-primary" /> Resumo de staging
          </h2>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["Layout", summary.layoutVersion ?? "—"],
              ["Gerado em", `${summary.generatedDate ?? "—"} ${summary.generatedTime ?? ""}`],
              ["Registros lógicos", nf(summary.logicalCount)],
              ["Trailer", `${summary.trailerCount !== null ? nf(summary.trailerCount) : "—"} · ${summary.countsMatch ? "confere" : "divergente"}`],
              ["Reconstruídos", nf(summary.reconstructedRecords)],
              ["Parser", summary.parserVersion],
              ["Tamanho", `${nf(Math.round(summary.fileBytes / 1024))} KB`],
              ["Hash", summary.fileHash.slice(0, 12)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border/70 bg-background/60 p-3">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contagem por tipo
            </h3>
            <div className="flex flex-wrap gap-2">
              {summary.typeCounts.map((t: any) => (
                <div key={t.type} className="flex items-center gap-1">
                  <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs">
                    {t.type} · {t.label}: <strong>{nf(t.count)}</strong>
                  </span>
                  <BaseRecordsDialog 
                    type={t.type} 
                    label={t.label} 
                    content={content || ""} 
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              A criar / atualizar
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.entityCounts).map(([k, v]) => (
                <span key={k} className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs">
                  {k}: <strong>{nf(v as number)}</strong>
                </span>
              ))}
            </div>
          </div>

          <CatalogImpactPanel impact={(summary as any).catalogImpact} />

          <p className="text-xs text-muted-foreground">
            Diagnóstico do catálogo: no catálogo {nf(summary.diagnosis.inCatalog)} · só-estoque{" "}
            {nf(summary.diagnosis.stockOnly)} · só-preço {nf(summary.diagnosis.priceOnly)} · sem preço{" "}
            {nf(summary.diagnosis.catalogNoPriceAnywhere)}
          </p>

          {summary.alreadyPublished && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              Este arquivo (mesmo hash) já foi publicado anteriormente. Publicar novamente é idempotente.
            </p>
          )}

          <button
            type="button"
            disabled={publishMutation.isPending || !content}
            onClick={() => content && publishMutation.mutate(content)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-60"
          >
            {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {publishMutation.isPending ? "Publicando…" : "Publicar no banco"}
          </button>
        </section>
      )}

      {publishedAt && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Publicação concluída
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dados atualizados em {formatDateTimeBR(publishedAt)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries((publishMutation.data as any)?.counts ?? {}).map(([k, v]) => (
              <span key={k} className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs">
                {k}: <strong>{nf(v as number)}</strong>
              </span>
            ))}
          </div>
          <div className="mt-4">
            <CatalogImpactPanel impact={(publishMutation.data as any)?.catalogImpact} />
          </div>
        </section>
      )}
    </div>
  );
}

function BaseRecordsDialog({ type, label, content }: { type: string; label: string; content: string }) {
  const fetchRecords = useServerFn(getErpBaseRecords);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const erpTypeMap: Record<string, any> = {
    "05": "vendedores",
    "10": "clientes",
    "22": "produtos",
    "28": "precos",
    "27": "estoque",
    "30": "grupos",
    "40": "segmentos",
    "43": "formas_pagamento",
    "44": "tabelas_preco"
  };

  const internalPageType = erpTypeMap[type];

  const { data: records, isLoading } = useQuery({
    queryKey: ["erp-base-records", type, internalPageType],
    queryFn: () => fetchRecords({ data: { content, type: internalPageType } }),
    enabled: open && !!internalPageType,
  });

  const filtered = (records || []).filter((r: any) => {
    if (!term) return true;
    const search = term.toLowerCase();
    return JSON.stringify(r).toLowerCase().includes(search);
  });

  const columns = records?.[0] ? Object.keys(records[0]).filter(k => k !== 'raw') : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary">
          <Eye className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Table className="h-5 w-5 text-primary" />
                Base ERP: {label}
              </DialogTitle>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Tipo {type} · {records?.length || 0} registros encontrados
              </p>
            </div>
            <Badge variant="secondary" className="rounded-lg h-6">
              Visualização Staging
            </Badge>
          </div>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filtrar dados na memória..." 
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="pl-9 bg-background/50 border-border/50 focus:border-primary/50 transition-all rounded-xl"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-background">
          <ScrollArea className="h-full">
            <div className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm animate-pulse">Processando registros do arquivo...</p>
                </div>
              ) : records && records.length > 0 ? (
                <UITable>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead key={col} className="text-[10px] font-bold uppercase tracking-wider py-4">
                          {col.replace(/erp/i, "").replace(/([A-Z])/g, ' $1').trim()}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row: any, i: number) => (
                      <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                        {columns.map((col) => {
                          const val = row[col];
                          return (
                            <TableCell key={col} className="text-xs py-3 font-medium text-foreground/80">
                              {Array.isArray(val) ? val.join(", ") : String(val ?? "—")}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </UITable>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 opacity-20" />
                  </div>
                  <p className="text-sm">Nenhum dado disponível para este tipo ou tipo não suportado.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        
        <div className="p-4 bg-muted/30 border-t flex justify-between items-center">
           <p className="text-[10px] text-muted-foreground">
             * Estes dados são extraídos em tempo real do arquivo dados.txt fornecido.
           </p>
           <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="rounded-lg">
             Fechar Visualização
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

