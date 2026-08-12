import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { MapPin, ShieldAlert, Clock3, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { maskTaxId } from "@/lib/pricing";
import { useSales } from "@/lib/state/sales-store";
import { normalizeSearchText } from "@/lib/utils";

const RECENT_KEY = "mr-fdv:recent-customers";

interface PickerOptions {
  /** Descarta o carrinho atual antes de escolher o cliente (fluxo "Novo pedido"). */
  startNewOrder?: boolean;
}

interface CustomerPickerContextValue {
  openCustomerPicker: (options?: PickerOptions) => void;
  /** Seleciona um cliente pedindo confirmação caso exista carrinho de outro cliente. */
  startWithCustomer: (customerId: string) => void;
  recentCustomerIds: string[];
}

const CustomerPickerContext = createContext<CustomerPickerContextValue | null>(null);

export function useCustomerPicker(): CustomerPickerContextValue {
  const ctx = useContext(CustomerPickerContext);
  if (!ctx) throw new Error("useCustomerPicker precisa estar dentro de CustomerPickerProvider");
  return ctx;
}

export function CustomerPickerProvider({ children }: { children: ReactNode }) {
  const { customers, priceTables, customer, itemCount, selectCustomer, clearCart } = useSales();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  /** Ação pendente aguardando confirmação de descarte do carrinho. */
  const [pending, setPending] = useState<{ kind: "picker" } | { kind: "customer"; id: string } | null>(
    null,
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw) as string[]);
    } catch {
      /* histórico corrompido: ignora */
    }
  }, []);

  const remember = useCallback((id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage indisponível */
      }
      return next;
    });
  }, []);

  const goToCatalog = useCallback(() => {
    if (!pathname.startsWith("/catalogo")) void navigate({ to: "/catalogo" });
  }, [navigate, pathname]);

  const commit = useCallback(
    (id: string, discardCart: boolean) => {
      if (discardCart) clearCart();
      selectCustomer(id);
      remember(id);
      setOpen(false);
      setTerm("");
      const chosen = customers.find((c) => c.id === id);
      if (chosen) toast.success(`Atendendo ${chosen.tradeName}`);
      goToCatalog();
    },
    [clearCart, selectCustomer, remember, customers, goToCatalog],
  );

  const openCustomerPicker = useCallback(
    (options?: PickerOptions) => {
      if (options?.startNewOrder && itemCount > 0) {
        setPending({ kind: "picker" });
        return;
      }
      setTerm("");
      setOpen(true);
    },
    [itemCount],
  );

  const startWithCustomer = useCallback(
    (id: string) => {
      if (itemCount > 0 && customer && customer.id !== id) {
        setPending({ kind: "customer", id });
        return;
      }
      commit(id, false);
    },
    [itemCount, customer, commit],
  );

  // Atalho de teclado (desktop): Ctrl/Cmd + K abre o seletor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTerm("");
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = normalizeSearchText(term.trim());
    const list = q
      ? customers.filter((c) =>
          normalizeSearchText([c.erpCode, c.legalName, c.tradeName, c.taxId, c.city, c.uf].join(" ")).includes(q),
        )
      : customers;
    return { rows: list.slice(0, 60), total: list.length };
  }, [term, customers]);

  const recentCustomers = useMemo(
    () =>
      recent
        .map((id) => customers.find((c) => c.id === id))
        .filter((c): c is (typeof customers)[number] => Boolean(c)),
    [recent, customers],
  );

  const renderRow = (prefix: string) => (c: (typeof customers)[number]) => {
    const table = priceTables.find((t) => t.code === c.priceTableCode);
    return (
      <CommandItem
        key={`${prefix}-${c.id}`}
        value={`${c.tradeName} ${c.legalName} ${c.erpCode} ${c.taxId} ${c.city}`}
        onSelect={() => startWithCustomer(c.id)}
        className="items-start gap-3 rounded-xl py-3 data-[selected=true]:[&_*]:text-accent-foreground"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{c.tradeName}</span>
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {c.erpCode}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {c.city}/{c.uf}
            </span>
            <span>CNPJ {maskTaxId(c.taxId)}</span>
            <span>{table ? `${table.code} · ${table.name}` : "Sem tabela"}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {c.restricted && (
            <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
              <ShieldAlert className="h-3 w-3" /> Restrição
            </span>
          )}
          {table?.mappedLevel === null && (
            <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              <AlertTriangle className="h-3 w-3" /> Preço pendente
            </span>
          )}
        </div>
      </CommandItem>
    );
  };

  const value: CustomerPickerContextValue = {
    openCustomerPicker,
    startWithCustomer,
    recentCustomerIds: recent,
  };

  return (
    <CustomerPickerContext.Provider value={value}>
      {children}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0">
          <DialogTitle className="sr-only">Selecionar cliente</DialogTitle>
          <Command shouldFilter={false} className="[&_[cmdk-input]]:h-12">
        <CommandInput
          value={term}
          onValueChange={setTerm}
          placeholder="Buscar cliente por código, razão social, nome fantasia, CNPJ ou cidade"
        />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>Nenhum cliente da sua carteira corresponde à busca.</CommandEmpty>
          {!term && recentCustomers.length > 0 && (
            <CommandGroup
              heading={
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" /> Atendidos recentemente
                </span>
              }
            >
              {recentCustomers.map(renderRow("recent"))}
            </CommandGroup>
          )}
          <CommandGroup
            heading={`${term ? "Resultados" : "Minha carteira"} (${results.total.toLocaleString("pt-BR")})`}
          >
            {results.rows.map(renderRow("all"))}
            {results.total > results.rows.length && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Mostrando {results.rows.length.toLocaleString("pt-BR")} de{" "}
                {results.total.toLocaleString("pt-BR")}
              </div>
            )}
          </CommandGroup>
        </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar o pedido em andamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem {itemCount} {itemCount === 1 ? "item" : "itens"} no carrinho
              {customer ? ` de ${customer.tradeName}` : ""}. Iniciar um novo atendimento descarta
              esses itens, porque os preços mudam conforme a tabela do cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter pedido atual</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = pending;
                setPending(null);
                if (!action) return;
                if (action.kind === "customer") {
                  commit(action.id, true);
                } else {
                  clearCart();
                  setTerm("");
                  setOpen(true);
                }
              }}
            >
              Descartar e continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CustomerPickerContext.Provider>
  );
}
