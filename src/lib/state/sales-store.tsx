import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { CartItem, Customer, Order, PriceTable, Product } from "@/lib/domain/types";
import { resolvePrice } from "@/lib/pricing";
import {
  getCatalogWorkspace,
  getWorkspaceCore,
  type BrandMetadataEntry,
} from "@/lib/workspace.functions";
import { setApprovalMatrix } from "@/lib/orders/validation";
import { createOrder, listOrders, type CreateOrderInput } from "@/lib/orders.functions";

const STORAGE_KEY = "mrfv.draft.v2";

interface DraftState {
  customerId: string | null;
  cart: CartItem[];
  orderDiscountPercent: number;
  isBonus: boolean;
  notes: string;
  paymentTerm: string | null;
}

const emptyDraft: DraftState = {
  customerId: null,
  cart: [],
  orderDiscountPercent: 0,
  isBonus: false,
  notes: "",
  paymentTerm: null,
};

export interface CartLine {
  product: Product;
  quantity: number;
  discountPercent: number;
  unitPrice: number | null;
  priceError: string | null;
  lineTotal: number;
}

export type CartMutationResult =
  | { ok: true; quantity: number }
  | { ok: false; message: string; available: number; requested: number; current: number };

interface SalesContextValue extends DraftState {
  hydrated: boolean;
  loading: boolean;
  customers: Customer[];
  products: Product[];
  priceTables: PriceTable[];
  productGroups: string[];
  erpLastUpdate: string | null;
  orders: Order[];
  brandMetadata: Record<string, BrandMetadataEntry>;
  taxonomyOverrides: { categoryName: string; targetBrandName: string }[];
  customer: Customer | null;
  table: PriceTable | undefined;
  lines: CartLine[];
  subtotal: number;
  discountValue: number;
  total: number;
  itemCount: number;
  sellerName: string;
  sellerCodes: string[];
  sellers: {
    code: string;
    name: string;
    customerCount: number;
    monthlyGoal?: number | undefined;
  }[];
  role: string | null;
  selectCustomer: (id: string) => void;
  clearCustomer: () => void;
  addItem: (productId: string, quantity: number) => CartMutationResult;
  setQuantity: (productId: string, quantity: number) => CartMutationResult;
  setItemDiscount: (productId: string, percent: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  setOrderDiscount: (percent: number) => void;
  setBonus: (value: boolean) => void;
  setNotes: (value: string) => void;
  setPaymentTerm: (value: string) => void;
  submitOrder: (input: CreateOrderInput) => Promise<Order>;
  submitting: boolean;
}

const SalesContext = createContext<SalesContextValue | null>(null);

function stockLimit(product: Product) {
  return Math.max(0, Math.floor(product.stock));
}

function formatStock(value: number, unit: string) {
  return `${value.toLocaleString("pt-BR")} ${unit}`;
}

function stockExceededResult(
  product: Product,
  requested: number,
  current: number,
): CartMutationResult {
  const available = stockLimit(product);
  const already = current > 0 ? ` Você já tem ${current.toLocaleString("pt-BR")} no carrinho.` : "";
  return {
    ok: false,
    available,
    requested,
    current,
    message: `Estoque insuficiente para ${product.name}. Disponível: ${formatStock(available, product.unit)}; solicitado: ${requested.toLocaleString("pt-BR")} ${product.unit}.${already}`,
  };
}

export function SalesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DraftState>(emptyDraft);
  const stateRef = useRef<DraftState>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const needsCatalog =
    pathname.startsWith("/catalogo") ||
    pathname.startsWith("/carrinho") ||
    pathname.startsWith("/pedido/revisar");

  const fetchWorkspaceCore = useServerFn(getWorkspaceCore);
  const fetchCatalogWorkspace = useServerFn(getCatalogWorkspace);
  const fetchOrders = useServerFn(listOrders);
  const submit = useServerFn(createOrder);

  const coreQuery = useQuery({
    queryKey: ["workspace"],
    queryFn: () => fetchWorkspaceCore(),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    gcTime: 30 * 60_000,
  });
  const catalogQuery = useQuery({
    queryKey: ["workspace", "catalog"],
    queryFn: () => fetchCatalogWorkspace(),
    enabled: needsCatalog,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    gcTime: 15 * 60_000,
  });
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchOrders(),
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateOrderInput) => submit({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const nextState = { ...emptyDraft, ...(JSON.parse(raw) as DraftState) };
        stateRef.current = nextState;
        setState(nextState);
      }
    } catch {
      /* rascunho corrompido: começa limpo */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  useEffect(() => {
    if (coreQuery.data?.approvalRules) setApprovalMatrix(coreQuery.data.approvalRules);
  }, [coreQuery.data]);

  const customers = useMemo(() => coreQuery.data?.customers ?? [], [coreQuery.data]);
  const products = useMemo(() => catalogQuery.data?.products ?? [], [catalogQuery.data]);
  const priceTables = useMemo(() => coreQuery.data?.priceTables ?? [], [coreQuery.data]);

  const customer = useMemo(
    () => customers.find((c) => c.id === state.customerId) ?? null,
    [customers, state.customerId],
  );
  const table = useMemo(
    () => priceTables.find((t) => t.code === customer?.priceTableCode),
    [priceTables, customer],
  );

  const lines = useMemo<CartLine[]>(() => {
    return state.cart.flatMap((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return [];
      const resolution = resolvePrice(product, table);
      const unitPrice = resolution.ok ? resolution.value : null;
      const gross = (unitPrice ?? 0) * item.quantity;
      return [
        {
          product,
          quantity: item.quantity,
          discountPercent: item.discountPercent,
          unitPrice,
          priceError: resolution.ok ? null : resolution.message,
          lineTotal: gross * (1 - item.discountPercent / 100),
        },
      ];
    });
  }, [state.cart, products, table]);

  const subtotal = lines.reduce((acc, l) => acc + l.lineTotal, 0);
  const discountValue = subtotal * (state.orderDiscountPercent / 100);
  const total = state.isBonus ? 0 : subtotal - discountValue;
  const itemCount = state.cart.reduce((acc, i) => acc + i.quantity, 0);

  const commitState = useCallback((updater: (prev: DraftState) => DraftState) => {
    const nextState = updater(stateRef.current);
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const update = useCallback(
    (patch: Partial<DraftState>) => {
      commitState((prev) => ({ ...prev, ...patch }));
    },
    [commitState],
  );

  const value: SalesContextValue = {
    ...state,
    hydrated: hydrated && !coreQuery.isLoading && (!needsCatalog || !catalogQuery.isLoading),
    loading: coreQuery.isLoading || (needsCatalog && catalogQuery.isLoading),
    customers,
    products,
    priceTables,
    productGroups: catalogQuery.data?.groups ?? [],
    erpLastUpdate: coreQuery.data?.lastUpdate ?? null,
    orders: ordersQuery.data ?? [],
    customer,
    table,
    lines,
    subtotal,
    discountValue,
    total,
    itemCount,
    sellerName: coreQuery.data?.sellerName ?? "Vendedor",
    sellerCodes: coreQuery.data?.sellerCodes ?? [],
    sellers: coreQuery.data?.sellers ?? [],
    role: coreQuery.data?.role ?? null,
    brandMetadata: coreQuery.data?.brandMetadata ?? {},
    taxonomyOverrides: coreQuery.data?.taxonomyOverrides ?? [],
    selectCustomer: (id) =>
      commitState((prev) => ({
        ...prev,
        customerId: id,
        // Trocar de cliente recalcula preços e zera negociações do pedido.
        cart: prev.customerId === id ? prev.cart : [],
        orderDiscountPercent: 0,
        isBonus: false,
        paymentTerm: customers.find((c) => c.id === id)?.paymentTerm ?? null,
      })),
    clearCustomer: () => update({ customerId: null, cart: [], paymentTerm: null }),
    addItem: (productId, quantity) => {
      const product = products.find((p) => p.id === productId);
      const current = stateRef.current.cart.find((i) => i.productId === productId)?.quantity ?? 0;
      const addQuantity = Math.max(1, Math.floor(quantity));
      const requested = current + addQuantity;
      if (!product) {
        return {
          ok: false,
          message: "Produto não encontrado no catálogo atual.",
          available: 0,
          requested,
          current,
        };
      }
      if (requested > stockLimit(product)) return stockExceededResult(product, requested, current);

      commitState((prev) => {
        const existing = prev.cart.find((i) => i.productId === productId);
        return {
          ...prev,
          cart: existing
            ? prev.cart.map((i) =>
                i.productId === productId ? { ...i, quantity: i.quantity + addQuantity } : i,
              )
            : [...prev.cart, { productId, quantity: addQuantity, discountPercent: 0 }],
        };
      });
      return { ok: true, quantity: requested };
    },
    setQuantity: (productId, quantity) => {
      const product = products.find((p) => p.id === productId);
      const requested = Math.floor(quantity);
      const current = stateRef.current.cart.find((i) => i.productId === productId)?.quantity ?? 0;
      if (requested <= 0) {
        commitState((prev) => ({
          ...prev,
          cart: prev.cart.filter((i) => i.productId !== productId),
        }));
        return { ok: true, quantity: 0 };
      }
      if (!product) {
        return {
          ok: false,
          message: "Produto não encontrado no catálogo atual.",
          available: 0,
          requested,
          current,
        };
      }
      if (requested > stockLimit(product)) return stockExceededResult(product, requested, current);

      commitState((prev) => ({
        ...prev,
        cart: prev.cart.map((i) => (i.productId === productId ? { ...i, quantity: requested } : i)),
      }));
      return { ok: true, quantity: requested };
    },
    setItemDiscount: (productId, percent) =>
      commitState((prev) => ({
        ...prev,
        cart: prev.cart.map((i) =>
          i.productId === productId
            ? { ...i, discountPercent: Math.min(100, Math.max(0, percent)) }
            : i,
        ),
      })),
    removeItem: (productId) =>
      commitState((prev) => ({
        ...prev,
        cart: prev.cart.filter((i) => i.productId !== productId),
      })),
    clearCart: () => update({ cart: [], orderDiscountPercent: 0, isBonus: false, notes: "" }),
    setOrderDiscount: (percent) =>
      update({ orderDiscountPercent: Math.min(100, Math.max(0, percent)) }),
    setBonus: (v) => update({ isBonus: v }),
    setNotes: (v) => update({ notes: v }),
    setPaymentTerm: (v) => update({ paymentTerm: v }),
    submitting: createMutation.isPending,
    submitOrder: async (input) => {
      const order = await createMutation.mutateAsync(input);
      commitState((prev) => ({
        ...prev,
        cart: [],
        orderDiscountPercent: 0,
        isBonus: false,
        notes: "",
      }));
      return order;
    },
  };

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSales(): SalesContextValue {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error("useSales precisa estar dentro de SalesProvider");
  return ctx;
}
