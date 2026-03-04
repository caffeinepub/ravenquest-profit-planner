# RavenQuest Profit Planner

## Current State

- Five calculator tabs: All Items, Farming, Herbalism, Woodcutting, Husbandry
- CraftingCalculator.tsx exists but shows a "Coming Soon" placeholder
- Price Book backed by localStorage (local mode) and optional guild mode via Internet Identity login
- Guild shared prices require login (Internet Identity) to write; anonymous users can only read
- Backend has `setPrice`/`clearPrice`/`clearAll` gated behind `#user` permission (requires login)
- Crafting recipes fetched from Ravendawn API (`fetchAllCrafting`) for Alchemy, Blacksmithing, Carpentry, Cooking, Weaving
- `CraftingRecipe` type defined with `materials` (array of `{itemId, amount, name}`) and output `itemId/name/amount`
- Profit engine has `calculateGatheringProfit` and `calculateHusbandryProfit` but no crafting profit function
- `useAllCrafting` hook exists in `useQueries.ts`
- AllItemsCalculator only combines Farming/Herbalism/Woodcutting/Husbandry — no Crafting

## Requested Changes (Diff)

### Add

- **Anonymous shared Price Book**: Remove login requirement from `setPrice`, `clearPrice`, `clearAll` in backend — any user (including guests) can update shared prices
- **CraftingCalculator**: Full implementation replacing the placeholder, with:
  - Load all recipes from API via `useAllCrafting`
  - Per-recipe: show output item + quantity, all materials + quantities, total material cost (from price book), output value (from price book), profit, profit margin %, craft tax included
  - Inline price editing for both output items AND materials (reuse price book store)
  - Profession filter (Alchemy / Blacksmithing / Carpentry / Cooking / Weaving / All)
  - Level filter, search, sort by profit/margin/level/name
  - Show only positive profit toggle
  - Confidence badge (High/Medium/Low)
  - Recipe cost uses material prices × material amounts (summed); output value = output price × output amount; profit = output value − material cost − craft tax
- **`calculateCraftingProfit`** function in `profitEngine.ts`
- **Crafting tab** added to App.tsx navigation
- **Crafting included in AllItemsCalculator** as a fifth category (with a distinct badge color)

### Modify

- **Backend `main.mo`**: Remove `#user` permission check from `setPrice`, `clearPrice`, `clearAll` so anonymous callers can write shared prices. Keep auth on `getMyClaims`, `setClaim`, `removeClaim`, user profile functions.
- **`PriceBookPanel.tsx`**: Remove login-required notice for guild mode editing — all visitors can edit shared prices in guild mode
- **`App.tsx`**: Add "Crafting" tab between Husbandry and Guild Planner
- **Header subtitle**: Update to include "Crafting"

### Remove

- Login gate on price editing in guild mode (visible to all users)

## Implementation Plan

1. Update `src/backend/main.mo` — remove `#user` permission check from `setPrice`, `clearPrice`, `clearAll`
2. Add `calculateCraftingProfit` to `src/frontend/src/lib/calculator/profitEngine.ts`
3. Replace `src/frontend/src/pages/CraftingCalculator.tsx` with full implementation
4. Update `src/frontend/src/pages/AllItemsCalculator.tsx` to include crafting items
5. Update `src/frontend/src/App.tsx` to add Crafting tab
6. Update `src/frontend/src/components/PriceBookPanel.tsx` to remove login gate on guild mode editing
