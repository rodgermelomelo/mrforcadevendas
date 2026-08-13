# Plan: Catalog Brand Folders

Implement a city-folder-like experience for the catalog, grouping products by brand using an accordion structure.

## Technical Details

- Modify `src/routes/_authenticated/catalogo.tsx` to add a `viewMode` state ('list' | 'brand').
- Implement grouping logic in `useMemo` to categorize filtered products by their brand.
- Use the shadcn `Accordion` component to create brand "folders".
- Refactor the catalog display to switch between the current virtualized grid and the new accordion-based brand view.
- Ensure the brand folders work seamlessly with existing filters (search, stock, launches).

## User Review Required

> [!IMPORTANT]
> The brand folder view will disable virtualization within the accordion groups for simplicity. This might impact performance if a single brand contains thousands of items. Is this acceptable, or should I attempt a nested virtualized approach?

1. Should the brand folders be open or closed by default when switching to this view?
2. When a search term is active, should we automatically expand brands that contain matching products?
