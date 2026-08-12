import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ImageOff, Loader2, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProductDetail, updateProduct, type ProductDetail } from "@/lib/admin-data.functions";
import { formatBRL, formatDateTimeBR } from "@/lib/pricing";
import { resolveProductImage } from "@/lib/product-images";
import { supabase } from "@/integrations/supabase/client";

export function ProductDetailDialog({
  erpCode,
  onOpenChange,
  groups,
}: {
  erpCode: string | null;
  onOpenChange: (open: boolean) => void;
  groups: { code: string; label: string }[];
}) {
  const load = useServerFn(getProductDetail);
  const query = useQuery({
    queryKey: ["admin", "product-detail", erpCode],
    queryFn: () => load({ data: { erpCode: erpCode as string } }),
    enabled: Boolean(erpCode),
  });

  const detail = query.data;
  const image = detail ? resolveProductImage(detail.product) : null;

  return (
    <Dialog open={Boolean(erpCode)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Detalhe do produto</DialogTitle>
        </DialogHeader>

        {query.isLoading || !detail ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <header className="flex items-start gap-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted">
                {image ? (
                  <img
                    src={image}
                    alt={detail.product.displayName || detail.product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageOff className="h-5 w-5 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">
                  {detail.product.displayName || detail.product.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {detail.product.erpCode} · {detail.product.unit}
                  {detail.product.brand ? ` · ${detail.product.brand}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <HealthBadge
                    tone={
                      detail.product.stock > 0 ? "ok" : detail.product.stock < 0 ? "bad" : "muted"
                    }
                    label={`Estoque ${detail.product.stock.toLocaleString("pt-BR")}`}
                  />
                  <HealthBadge
                    tone={
                      !detail.product.hasPrice
                        ? "bad"
                        : detail.product.hasUnmappedTable
                          ? "warn"
                          : "ok"
                    }
                    label={
                      !detail.product.hasPrice
                        ? "Sem preço"
                        : detail.product.hasUnmappedTable
                          ? "Tabela sem nível"
                          : `Preço OK (${detail.product.priceTables})`
                    }
                  />
                  <HealthBadge
                    tone={detail.product.released && detail.product.active ? "ok" : "muted"}
                    label={
                      !detail.product.active
                        ? "Inativo"
                        : detail.product.released
                          ? "No catálogo"
                          : "Fora do catálogo"
                    }
                  />
                  {detail.product.isLaunch && <HealthBadge tone="brand" label="Lançamento" />}
                </div>
              </div>
            </header>

            <Tabs defaultValue="geral">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="geral">Visão geral</TabsTrigger>
                <TabsTrigger value="estoque">Estoque</TabsTrigger>
                <TabsTrigger value="precos">Preços</TabsTrigger>
                <TabsTrigger value="editar">Editar</TabsTrigger>
              </TabsList>

              <TabsContent value="geral" className="space-y-3 pt-4 text-sm">
                <Info label="Descrição oficial do ERP" value={detail.product.name} />
                <Info label="Grupo" value={detail.product.groupCode ?? "Sem grupo"} />
                <Info label="Marca" value={detail.product.brand ?? "Não identificada"} />
                <Info label="Categoria" value={detail.product.category ?? "Não classificada"} />
                {detail.product.erpBrandSuggestion && (
                  <Info label="Sugestão ERP de marca" value={detail.product.erpBrandSuggestion} />
                )}
                {detail.product.erpCategorySuggestion && (
                  <Info
                    label="Sugestão ERP de categoria"
                    value={detail.product.erpCategorySuggestion}
                  />
                )}
                <Info label="Unidade" value={detail.product.unit} />
                <Info
                  label="Atualizado em"
                  value={detail.updatedAt ? formatDateTimeBR(detail.updatedAt) : "—"}
                />
                {detail.missingSince && (
                  <Info label="Ausente desde" value={formatDateTimeBR(detail.missingSince)} />
                )}
                {detail.eans.length > 0 && <Info label="EAN" value={detail.eans.join(", ")} />}
                <Link
                  to="/catalogo"
                  className="inline-block text-sm font-medium text-primary hover:underline"
                >
                  Ver no catálogo comercial
                </Link>
              </TabsContent>

              <TabsContent value="estoque" className="space-y-3 pt-4 text-sm">
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Quantidade disponível
                  </p>
                  <p
                    className={`text-3xl font-semibold ${
                      detail.product.stock < 0
                        ? "text-destructive"
                        : detail.product.stock === 0
                          ? "text-muted-foreground"
                          : "text-primary"
                    }`}
                  >
                    {detail.product.stock.toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {detail.stockCapturedAt
                      ? `Capturado em ${formatDateTimeBR(detail.stockCapturedAt)}`
                      : "Sem registro de estoque para este código."}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  O estoque é somente leitura: vem do ERP pelo registro tipo 27 na Central de
                  Importações.
                </p>
              </TabsContent>

              <TabsContent value="precos" className="space-y-2 pt-4">
                {detail.prices.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Nenhum preço para este produto (registro tipo 28). O produto não pode ser
                    vendido.
                  </p>
                ) : (
                  detail.prices.map((row) => (
                    <div key={row.priceTableCode} className="rounded-2xl border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          Tabela {row.priceTableCode} · {row.priceTableName}
                        </p>
                        {row.applicable !== null && (
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            Aplicável {formatBRL(row.applicable)}
                            {row.levelLabel ? ` · ${row.levelLabel}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                        {row.values.map((value, index) => {
                          const isApplicable = row.mappedLevel === index + 1;
                          return (
                            <div
                              key={index}
                              className={`rounded-xl border px-3 py-2 text-sm ${
                                isApplicable
                                  ? "border-primary bg-primary/5 font-semibold text-primary"
                                  : "border-border"
                              }`}
                            >
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                Valor {index + 1}
                              </p>
                              {formatBRL(value)}
                            </div>
                          );
                        })}
                      </div>
                      {row.mappedLevel === null && (
                        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Tabela sem nível mapeado — nenhum preço é exibido ao vendedor.
                          <Link to="/admin/tabelas-preco" className="underline">
                            Configurar
                          </Link>
                        </p>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="editar" className="pt-4">
                <ProductForm detail={detail} groups={groups} onDone={() => onOpenChange(false)} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export function HealthBadge({
  tone,
  label,
}: {
  tone: "ok" | "bad" | "warn" | "muted" | "brand";
  label: string;
}) {
  const cls =
    tone === "ok"
      ? "bg-primary/10 text-primary"
      : tone === "bad"
        ? "bg-destructive/10 text-destructive"
        : tone === "warn"
          ? "bg-amber-500/15 text-amber-600"
          : tone === "brand"
            ? "bg-brand-gradient text-primary-foreground"
            : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
  );
}

function ProductForm({
  detail,
  groups,
  onDone,
}: {
  detail: ProductDetail;
  groups: { code: string; label: string }[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const save = useServerFn(updateProduct);
  const product = detail.product;
  const [form, setForm] = useState({
    released: product.released,
    isLaunch: product.isLaunch,
    active: product.active,
    groupCode: product.groupCode ?? "",
    unit: product.unit,
    displayName: product.displayName ?? "",
    imageUrl: product.imageUrl ?? "",
    brand: product.brand ?? "Outros",
    category: product.category ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem (PNG, JPG ou WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. O limite é 5MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${product.erpCode}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
      setForm((f) => ({ ...f, imageUrl: data.publicUrl }));
      toast.success('Imagem enviada. Clique em "Salvar produto" para confirmar.');
    } catch (e) {
      toast.error(`Falha no upload: ${(e as Error).message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const mutation = useMutation({
    mutationFn: () => save({ data: { erpCode: product.erpCode, ...form } }),
    onSuccess: async () => {
      toast.success("Produto atualizado.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "product-detail"] });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
  const labelCls = "text-xs font-medium text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl border border-border p-3">
        <span className={labelCls}>Foto do produto</span>
        <div className="flex items-start gap-3">
          <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-5 w-5 text-muted-foreground" />
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <input
              className={field}
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="Cole uma URL https://... ou envie um arquivo"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Enviar do computador
              </button>
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, imageUrl: "" })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover foto
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              PNG, JPG ou WebP até 5MB. As alterações valem após clicar em “Salvar produto”.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={labelCls}>Nome de exibição</span>
          <input
            className={field}
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder={product.name}
          />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Marca</span>
          <select
            className={field}
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          >
            <option value="Outros">Outros</option>
            <option value="DAILUS">DAILUS</option>
            <option value="ACEMAR">ACEMAR</option>
            <option value="ÁGUA DE CHEIRO">ÁGUA DE CHEIRO</option>
            <option value="DIVINA FLORA">DIVINA FLORA</option>
            <option value="CUCCIO">CUCCIO</option>
            <option value="VERNISSAGE">VERNISSAGE</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Categoria</span>
          <input
            className={field}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder={product.erpCategorySuggestion ?? "Ex.: ESMALTE"}
          />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Grupo</span>
          <select
            className={field}
            value={form.groupCode}
            onChange={(e) => setForm({ ...form, groupCode: e.target.value })}
          >
            <option value="">Sem grupo</option>
            {groups.map((g) => (
              <option key={g.code} value={g.code}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Unidade</span>
          <input
            className={field}
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.released}
            onChange={(e) => setForm({ ...form, released: e.target.checked })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Liberado no catálogo
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isLaunch}
            onChange={(e) => setForm({ ...form, isLaunch: e.target.checked })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Lançamento
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Ativo
        </label>
      </div>

      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}{" "}
        Salvar produto
      </button>
    </div>
  );
}
