import batom from "@/assets/prod-batom.jpg";
import esmalte from "@/assets/prod-esmalte.jpg";
import base from "@/assets/prod-base.jpg";
import skincare from "@/assets/prod-skincare.jpg";
import { catalogProductImageRef, type ProductImageCandidate } from "./product-image-catalog";

const assets: Record<string, string> = { batom, esmalte, base, skincare };

/**
 * Resolve a imagem do produto. O enriquecimento guarda `asset:<chave>` para o
 * catálogo de demonstração e uma URL controlada do Storage quando houver foto oficial.
 */
export function productImage(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("asset:")) return assets[imageUrl.slice(6)] ?? null;
  return imageUrl;
}

export function resolveProductImage(product: ProductImageCandidate): string | null {
  return productImage(catalogProductImageRef(product));
}
