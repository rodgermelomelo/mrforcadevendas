import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { CartItem, Customer, Order, PriceTable, Product } from "@/lib/domain/types";
import { resolvePrice } from "@/lib/pricing";
import { getWorkspace } from "@/lib/catalog.functions";
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

interface SalesContextValue extends DraftState {
  hydrated: boolean;
  loading: boolean;
  customers: Customer[];
  products: Product[];
  priceTables: PriceTable[];
  productGroups: string[];
  erpLastUpdate: string | null;
  orders: Order[];
  customer: Customer | null;
  table: PriceTable | undefined;
  lines: CartLine[];
  subtotal: number;
  discountValue: number;
  total: number;
  itemCount: number;
  sellerName: string;
  role: string | null;
  selectCustomer: (id: string) => void;
  clearCustomer: () => void;
  addItem: (productId: string, quantity: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
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

export function SalesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DraftState>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const queryClient = useQueryClient();

  const fetchWorkspace = useServerFn(getWorkspace);
  const fetchOrders = useServerFn(listOrders);
  const submit = useServerFn(createOrder);

  const workspaceQuery = useQuery({
    queryKey: ["workspace"],
    queryFn: () => fetchWorkspace(),
    staleTime: 60_000,
  });
  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: () => fetchOrders() });

  const createMutation = useMutation({
    mutationFn: (input: CreateOrderInput) => submit({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...emptyDraft, ...(JSON.parse(raw) as DraftState) });
    } catch {
      /* rascunho corrompido: começa limpo */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  useEffect(() => {
    if (workspaceQuery.data?.approvalRules) setApprovalMatrix(workspaceQuery.data.approvalRules);
  }, [workspaceQuery.data]);

  const customers = useMemo(() => workspaceQuery.data?.customers ?? [], [workspaceQuery.data]);
  const products = useMemo(() => workspaceQuery.data?.products ?? [], [workspaceQuery.data]);
  const priceTables = useMemo(() => workspaceQuery.data?.priceTables ?? [], [workspaceQuery.data]);

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

  const update = useCallback((patch: Partial<DraftState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const value: SalesContextValue = {
    ...state,
    hydrated: hydrated && !workspaceQuery.isLoading,
    loading: workspaceQuery.isLoading || ordersQuery.isLoading,
    customers,
    products,
    priceTables,
    productGroups: workspaceQuery.data?.groups ?? [],
    erpLastUpdate: workspaceQuery.data?.lastUpdate ?? null,
    orders: ordersQuery.data ?? [],
    customer,
    table,
    lines,
    subtotal,
    discountValue,
    total,
    itemCount,
    sellerName: workspaceQuery.data?.sellerName ?? "Vendedor",
    role: workspaceQuery.data?.role ?? null,
    selectCustomer: (id) =>
      setState((prev) => ({
        ...prev,
        customerId: id,
        // Trocar de cliente recalcula preços e zera negociações do pedido.
        cart: prev.customerId === id ? prev.cart : [],
        orderDiscountPercent: 0,
        isBonus: false,
        paymentTerm: customers.find((c) => c.id === id)?.paymentTerm ?? null,
      })),
    clearCustomer: () => update({ customerId: null, cart: [], paymentTerm: null }),
    addItem: (productId, quantity) =>
      setState((prev) => {
        const existing = prev.cart.find((i) => i.productId === productId);
        return {
          ...prev,
          cart: existing
            ? prev.cart.map((i) =>
                i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i,
              )
            : [...prev.cart, { productId, quantity, discountPercent: 0 }],
        };
      }),
    setQuantity: (productId, quantity) =>
      setState((prev) => ({
        ...prev,
        cart:
          quantity <= 0
            ? prev.cart.filter((i) => i.productId !== productId)
            : prev.cart.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
      })),
    setItemDiscount: (productId, percent) =>
      setState((prev) => ({
        ...prev,
        cart: prev.cart.map((i) =>
          i.productId === productId
            ? { ...i, discountPercent: Math.min(100, Math.max(0, percent)) }
            : i,
        ),
      })),
    removeItem: (productId) =>
      setState((prev) => ({ ...prev, cart: prev.cart.filter((i) => i.productId !== productId) })),
    clearCart: () => update({ cart: [], orderDiscountPercent: 0, isBonus: false, notes: "" }),
    setOrderDiscount: (percent) =>
      update({ orderDiscountPercent: Math.min(100, Math.max(0, percent)) }),
    setBonus: (v) => update({ isBonus: v }),
    setNotes: (v) => update({ notes: v }),
    setPaymentTerm: (v) => update({ paymentTerm: v }),
    submitting: createMutation.isPending,
    submitOrder: async (input) => {
      const order = await createMutation.mutateAsync(input);
      setState((prev) => ({
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
