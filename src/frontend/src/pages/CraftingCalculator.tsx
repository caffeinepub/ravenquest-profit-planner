// Crafting Calculator — Coming Soon
// The Ravendawn API does not currently expose market/cost prices for crafting materials.
// Profit calculations require both material costs and output prices, which are not available.

export function CraftingCalculator() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-4 text-4xl">⚒️</div>
        <h2 className="text-xl font-bold">Crafting Calculator</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Crafting profit calculations are coming soon. The API data for
          crafting recipes is available but market prices for materials and
          outputs must be manually priced to calculate meaningful profit. This
          feature will be added in a future update.
        </p>
      </div>
    </div>
  );
}
