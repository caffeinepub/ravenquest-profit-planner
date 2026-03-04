# RavenQuest Profit Planner

## Current State

- `GrowTimeStrategy.tsx` is the Strategy/Opportunities page. It shows band cards (FAST/ACTIVE/MID/SLEEP/AWAY) with avgSilverPerHour and topSilverPerHour per band. The BandCard component displays s/h as the primary metric.
- `AISummaryPanel.tsx` shows "Top bands by silver/hour" listing the top 3 bands with `.slice(0, 3)`.
- `SummaryPanel.tsx` (used in AllItemsCalculator and individual calculators) shows "Best 24h Earner" and "Best per Time Window" section.
- `GlobalChatBar.tsx` has `computeUpdateSummary` which calculates top5 items by silver/hour and fortTop3 (3 items). The `/update` command output labels use silver/hr as the primary ranking. The `UpdateSummaryMessage` component renders "Top Items" by s/hr.
- Currently the default sort/rank in tables is silver/hour, not profit per 24h.
- There is no "Best For Time Window" dropdown on the Strategy page.
- The ranking in all result tables across calculators shows silver/hour as the primary metric.

## Requested Changes (Diff)

### Add

1. **"Best For Time Window" dropdown** near the top of the Strategy page (in the sticky controls row), labeled "Best For Time Window", with options: 2h, 6h, 8h, 12h, 16h, 24h, Custom (user enters hours). Selecting a window filters the ranked results to items whose grow time is within a tolerance:
   - 2h window: 1h–2h
   - 6h window: 4h–6h
   - 8h window: 6h–8h
   - 12h window: 8h–12h
   - 16h window: 12h–16h
   - 24h window: 16h–24h
   - Custom: ±20% around entered hours
   The dropdown should influence the QuickIndicator and band highlighting to show which band matches the selected window.

2. **Profit per 24h calculation** — add a utility: `profitPer24h = (profitPerCycle) × (24 / growTimeHours)` where `profitPerCycle = (sellPrice - cost) × expectedYield × landMultiplier`. This can be derived from existing `profitPerHarvest` and `growingTime` fields already computed by `calculateGatheringProfit`.

3. **"Per 24h" column** in band comparison table and BandCard stats — add a stat showing total profit per 24h beside avg/h.

### Modify

1. **"Top 3" → "Top 5"** everywhere:
   - `AISummaryPanel.tsx`: change `.slice(0, 3)` to `.slice(0, 5)` in ranked bands list.
   - `GlobalChatBar.tsx` `computeUpdateSummary`: `fortTop3` and `overnightTop3` → `fortTop5` and `overnightTop5` (rename and change `.slice(0, 3)` to `.slice(0, 5)`). Update `UpdateSummaryMessage` section headers and `UpdateSummary` interface types accordingly.
   - Any other place showing "Top 3" text or limiting to 3.

2. **Default ranking metric → "Best 24 Hours"**:
   - In `AllItemsCalculator.tsx`: add `profit24h` to the computation for each item row. Formula: `profitPerHarvest × (24 / (growingTime / 3600))`. Display it as the primary metric in the row (replacing or adding alongside s/h). Change default sort to profit24h descending.
   - In the individual calculators (Farming, Herbalism, Woodcutting, Husbandry), likewise show profit24h as the primary displayed metric and default sort.
   - In `SummaryPanel.tsx` time-window section: currently shows best item for 2/4/6/8/12/24h windows. Change label to "Top 5 (24h profit)" where relevant and ensure it shows profit per 24h as the primary number.

3. **Tables/cards display updates** — wherever results are shown:
   - Show "Profit/24h" as the main number (large/bold).
   - Show "Per harvest" as secondary.
   - Show "Grow time" prominently.
   - Show "Last updated" timestamp if available (from PriceBook metadata).
   - Silver/hour as optional tertiary stat.

4. **Chat command output** — `/update` response in `GlobalChatBar.tsx`:
   - "Top Items" section should now rank by profit24h by default.
   - Label output as "Top 5 (24h profit)" instead of "Top Items by s/hr".
   - `fortTop5` should also rank by profit24h for fort multiplier.
   - `overnightTop5` keeps its current logic (SLEEP band).

5. **BandCard and band comparison table** — add "Avg profit/24h" as the displayed metric alongside or replacing avg s/h where the 24h window makes more sense.

### Remove

- Nothing removed. Silver/hour is kept as a secondary/optional stat.

## Implementation Plan

1. **Add `profitPer24h` helper** to `profitEngine.ts` or inline it where needed:
   ```
   function computeProfit24h(profitPerHarvest: number, growingTimeSecs: number): number {
     const hours = growingTimeSecs / 3600;
     if (hours <= 0) return 0;
     return profitPerHarvest * (24 / hours);
   }
   ```

2. **Update `AISummaryPanel.tsx`**: change `.slice(0, 3)` to `.slice(0, 5)`. Show top 5 bands, not 3.

3. **Update `GlobalChatBar.tsx`**:
   - Rename `fortTop3` → `fortTop5`, `overnightTop3` → `overnightTop5`.
   - Change slices from 3 to 5.
   - Add profit24h sorting for top5 and fortTop5 (use `profitPerHarvest × (24 / (growingTime/3600))`).
   - Update label in `UpdateSummaryMessage` to "Top 5 (24h profit)" and "Best Fort Row (20x) — 24h".
   - Update `UpdateSummary` interface.

4. **Update `GrowTimeStrategy.tsx`**:
   - Add "Best For Time Window" dropdown to the sticky controls row.
   - Implement time-window tolerance logic to determine which band corresponds to the selected window.
   - Highlight the matching band card (similar to isPreferred highlighting).
   - Store selected time window in local state.
   - When a time window is selected, show filtered items for that window in a new panel below the band cards.
   - Update BandCard stats to show profit/24h as an additional stat.

5. **Update `AllItemsCalculator.tsx`**:
   - Add profit24h column to the rows (shown as main number).
   - Change default sort order to `profit24h` descending.
   - Add "Grow time" column.
   - Add "Last updated" timestamp display next to price.
   - Update sort options to include "Profit / 24h" as the default option.

6. **Update `SummaryPanel.tsx`**:
   - In "Best per Time Window", rank by profit24h (not just windowProfit, which is already a form of 24h calc).
   - Update labels to reflect "24h profit" terminology.
   - The existing `BestWindowEntry.windowProfit` already computes `floor(Window ÷ HarvestTime) × profitPerHarvest` — this should be renamed/clarified as "24h profit" or kept as is but labeled correctly.

7. **Update individual calculators** (Farming, Herbalism, Woodcutting, Husbandry):
   - Add profit24h to result rows.
   - Default sort by profit24h.
   - Show grow time prominently.
   - Show last updated timestamp when price has one.
