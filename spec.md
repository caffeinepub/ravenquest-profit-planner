# RavenQuest Profit Planner

## Current State

Previous version had a full profit planner but was broken (prices not appearing, deployment failed). The `.old/` directory contains all prior frontend code as reference. The app has no deployed frontend currently.

## Requested Changes (Diff)

### Add
- Farming, Herbalism, Woodcutting, Husbandry tabs each showing all items from the live Ravendawn API (`https://api.ravendawn.online/v1/professions/{profession}`)
- For each item (crop/herb/tree/animal pen), show:
  - Item name
  - Output items with drop counts (min-max) from API
  - Quantity multiplier input (how many harvests/plots the user plans)
  - Per-output-item: market price input field (manual, persisted to localStorage)
  - Calculated: Total revenue = sum of (avg count * market price * quantity)
  - Calculated: Profit (revenue minus any seed/input costs if present in API data)
  - Profit per hour (using growingTime from API)
- Land multiplier setting (global, applies to all yield calculations): Small(1x), Medium(2x), Large(4x), Stronghold(8x), Fort(20x)
- Market fee % setting (global, deducted from revenue)
- Price Book: localStorage-persisted market prices keyed by item ID (`priceBook:v1`)
- All items from each endpoint shown (paginate or "show all" -- never truncated to <4)
- Husbandry: show both gathering and butchering modes as tabs within each animal entry
- "Clear all prices" and "Export/Import JSON" for price book

### Modify
- API data shape correction: API returns `count: [min, max]` on items, not `min`/`max` separately -- fix all type definitions and calculations to use `item.count[0]` and `item.count[1]`
- Husbandry API returns `items.gathering` and `items.butchering` as arrays (or null); handle null gracefully

### Remove
- Crafting calculator tab (not part of this request -- focus is Farming/Herbalism/Woodcutting/Husbandry only)
- API Explorer tab
- "Live market prices" toggle (no live price API exists)
- Any mock/hardcoded data

## Implementation Plan

1. Backend: minimal Motoko canister (no persistent data needed -- all state is frontend localStorage)
2. API client: fetch from `https://api.ravendawn.online/v1/professions/{farming|herbalism|woodcutting|husbandry}` with stale-while-revalidate caching and error handling. Correct type definitions to use `count: [number, number]` on item drops.
3. Price Book store: Zustand + persist to localStorage key `priceBook:v1`. Structure: `{ [itemId: number]: { itemName: string; price: number; updatedAt: string } }`. Support set, get, clear, importJSON, exportJSON.
4. Global config store: Zustand + persist. Fields: `landMultiplier` (1/2/4/8/20), `marketFeePercent` (default 8), `quantity` (default 1 -- can be overridden per-item too).
5. Profit engine: `revenue = sum(avgCount * landMultiplier * price * quantity)`, `netRevenue = revenue * (1 - marketFee/100)`, `profitPerHour = netRevenue / (growingTime / 3600)`. Confidence: high (all prices set), medium (some set), low (none set).
6. Tab layout: Farming | Herbalism | Woodcutting | Husbandry. Each tab:
   - Left: filters (search, skill level range, sort by profit/margin/profit-per-hour, "only positive profit" toggle)
   - Center: scrollable results list. Each row expandable to show output item breakdown with inline price inputs.
   - Right: sticky summary panel (total profit, avg margin, best item).
7. Inline price input: clicking on an output item's price cell opens a small inline editor. Price is saved to Price Book on blur/enter. Shows placeholder "Set price" if not set.
8. Quantity input: per-row number input (default 1). Changes only affect that row's calculation.
9. Confidence badge: color-coded. Green = all prices set. Yellow = some. Red = none.
10. Global settings bar at top: land multiplier dropdown, market fee % input, "Open Price Book" button.
11. All API calls go directly from frontend to `https://api.ravendawn.online` (CORS is open on that API).
