import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartItem, Customer, Order, PriceTable, Product } from "@/lib/domain/types";
import { customers, demoSellerName, priceTables, products } from "@/lib/demo/data";
import { resolvePrice } from "@/lib/pricing";

const STORAGE_KEY = "mrfv.state.v1";

interface PersistedState {
  customerId: string | null;
  cart: CartItem[];
  orderDiscountPercent: number;
  isBonus: boolean;
  notes: string;
  paymentTerm: string | null;
  orders: Order[];
}

const emptyState: PersistedState = {
  customerId: null,
  cart: [],
  orderDiscountPercent: 0,
  isBonus: false,
  notes: "",
  paymentTerm: null,
  orders: [],
};

export interface CartLine {
  product: Product;
  quantity: number;
  discountPercent: number;
  unitPrice: number | null;
  priceError: string | null;
  lineTotal: number;
}

interface SalesContextValue extends PersistedState {
  hydrated: boolean;
  customer: Customer | null;
  table: PriceTable | undefined;
  lines: CartLine[];
  subtotal: number;
  discountValue: number;
  total: number;
  itemCount: number;
  sellerName: string;
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
  saveOrder: (order: Order) => void;
}

const SalesContext = createContext<SalesContextValue | null>(null);

export function SalesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...emptyState, ...(JSON.parse(raw) as PersistedState) });
    } catch {
      /* estado corrompido: começa limpo */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const customer = useMemo(
    () => customers.find((c) => c.id === state.customerId) ?? null,
    [state.customerId],
  );
  const table = useMemo(
    () => priceTables.find((t) => t.code === customer?.priceTableCode),
    [customer],
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
  }, [state.cart, table]);

  const subtotal = lines.reduce((acc, l) => acc + l.lineTotal, 0);
  const discountValue = subtotal * (state.orderDiscountPercent / 100);
  const total = state.isBonus ? 0 : subtotal - discountValue;
  const itemCount = state.cart.reduce((acc, i) => acc + i.quantity, 0);

  const update = useCallback((patch: Partial<PersistedState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const value: SalesContextValue = {
    ...state,
    hydrated,
    customer,
    table,
    lines,
    subtotal,
    discountValue,
    total,
    itemCount,
    sellerName: demoSellerName,
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
    saveOrder: (order) =>
      setState((prev) => ({
        ...prev,
        orders: [order, ...prev.orders],
        cart: [],
        orderDiscountPercent: 0,
        isBonus: false,
        notes: "",
      })),
  };

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSales(): SalesContextValue {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error("useSales precisa estar dentro de SalesProvider");
  return ctx;
}
