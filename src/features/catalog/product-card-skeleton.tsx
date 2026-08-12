import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder de carregamento equivalente ao ProductCard. */
export function ProductCardSkeleton() {
  return (
    <div className="surface-card flex flex-col overflow-hidden opacity-60">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-3 p-3">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
