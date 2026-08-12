import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, User, Building2, ClipboardList, TrendingUp, AlertCircle, ShoppingBag, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SellerGoalsDialog } from "@/components/admin/seller-goals-dialog";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDateTimeBR } from "@/lib/pricing";
import { getSellerDetail } from "@/lib/admin-data.functions";
import { statusLabel } from "@/lib/orders/status";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface SellerDetailDialogProps {
  erpCode: string | null;
  onClose: () => void;
}

export function SellerDetailDialog({ erpCode, onClose }: SellerDetailDialogProps) {
  const load = useServerFn(getSellerDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "seller-detail", erpCode],
    queryFn: () => (erpCode ? load({ data: { erpCode } }) : null),
    enabled: !!erpCode,
  });

  return (
    <Dialog open={!!erpCode} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
            <div className="flex items-start justify-between w-full">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  <User className="h-6 w-6 text-primary" />
                  {isLoading ? "Carregando..." : data?.seller.name}
                </DialogTitle>
                <DialogDescription>
                  Código ERP: {erpCode} {data?.seller.active ? (
                    <Badge variant="outline" className="ml-2 bg-green-500/10 text-green-600 border-green-200">Ativo</Badge>
                  ) : (
                    <Badge variant="outline" className="ml-2 bg-destructive/10 text-destructive border-destructive/20">Inativo</Badge>
                  )}
                </DialogDescription>
              </div>
              {data && (
                <SellerGoalsDialog 
                  erpCode={erpCode!} 
                  sellerName={data.seller.name} 
                  currentGoal={data.seller.monthlyGoal ?? 0}
                />
              )}
            </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 grid place-items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 pt-4 border-b">
              <StatCard
                icon={<Building2 className="h-4 w-4" />}
                label="Clientes"
                value={data.stats.totalCustomers.toString()}
              />
              <StatCard
                icon={<ShoppingBag className="h-4 w-4" />}
                label="Pedidos"
                value={data.stats.totalOrders.toString()}
              />
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Total faturado"
                value={formatBRL(data.stats.totalValue)}
              />
              <StatCard
                icon={<AlertCircle className="h-4 w-4" />}
                label="Pendentes"
                value={data.stats.pendingApprovals.toString()}
                variant={data.stats.pendingApprovals > 0 ? "warning" : "default"}
              />
            </div>

            <Tabs defaultValue="carteira" className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 border-b">
                <TabsList className="h-12 w-full justify-start gap-6 bg-transparent p-0">
                  <TabsTrigger 
                    value="carteira" 
                    className="relative h-12 rounded-none border-b-2 border-transparent px-1 pb-3 pt-4 font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
                  >
                    Carteira de Clientes
                  </TabsTrigger>
                  <TabsTrigger 
                    value="pedidos" 
                    className="relative h-12 rounded-none border-b-2 border-transparent px-1 pb-3 pt-4 font-semibold data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
                  >
                    Pedidos Recentes
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <TabsContent value="carteira" className="m-0 space-y-4">
                  <div className="grid gap-3">
                    {data.customers.map((customer) => (
                      <div key={customer.erpCode} className="flex items-center justify-between p-4 rounded-xl border bg-card/50 hover:bg-card transition-colors group">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{customer.tradeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {customer.erpCode} · {customer.city}/{customer.uf}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {customer.restricted && (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] h-5">
                              Restrito
                            </Badge>
                          )}
                          {!customer.active && (
                            <Badge variant="outline" className="text-[10px] h-5">Inativo</Badge>
                          )}
                          <Link 
                            to="/admin/clientes" 
                            search={{ term: customer.erpCode }}
                            className="p-2 rounded-lg hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </Link>
                        </div>
                      </div>
                    ))}
                    {data.customers.length === 0 && (
                      <p className="text-center py-8 text-sm text-muted-foreground italic">
                        Nenhum cliente vinculado a este representante.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="pedidos" className="m-0">
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Pedido</th>
                          <th className="px-4 py-3 text-left font-medium">Cliente</th>
                          <th className="px-4 py-3 text-left font-medium">Valor</th>
                          <th className="px-4 py-3 text-left font-medium">Status</th>
                          <th className="px-4 py-3 text-right font-medium">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.recentOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                            <td className="px-4 py-3 font-medium">
                              <Link 
                                to="/pedidos/$orderId" 
                                params={{ orderId: order.id }}
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                {order.number}
                              </Link>
                            </td>
                            <td className="px-4 py-3 truncate max-w-[200px]">{order.customerName}</td>
                            <td className="px-4 py-3 font-medium">{formatBRL(order.total)}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                                {statusLabel[order.status as keyof typeof statusLabel] || order.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                              {formatDateTimeBR(order.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {data.recentOrders.length === 0 && (
                      <p className="text-center py-12 text-sm text-muted-foreground">
                        Nenhum pedido encontrado para este representante.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  variant = "default" 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  variant?: "default" | "warning";
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p className={cn(
        "text-xl font-bold tabular-nums",
        variant === "warning" && "text-amber-600"
      )}>
        {value}
      </p>
    </div>
  );
}
