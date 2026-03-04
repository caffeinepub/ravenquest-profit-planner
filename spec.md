# RavenQuest Profit Planner

## Current State

- `App.tsx`: Header → GlobalSettingsBar → sticky tab nav → tab content. No global price-input bar.
- `GrowTimeStrategy.tsx`: Strategy tab with band cards, QuickIndicator, BandComparison table, AISummaryPanel, MarketFloodWarning, ChatPriceInput+ScreenshotImport, SnapshotPanel. Player Status and Land Type selectors are local to this page.
- `configStore.ts`: persists `landSize` / `landMultiplier` / `marketFeePercent` / `craftTaxPercent`. Land options: small(1x) medium(2x) large(4x) stronghold(8x) fort(20x).
- `growTimeBands.ts`: `BandStats`, `computeBandStats`, `getBandForItem`, `husbandryToGathering`, `GROW_TIME_BANDS`. `BandStats` has: `band`, `avgSilverPerHour`, `topSilverPerHour`, `totalPotentialSilver`, `itemCount`, `pricedItemCount`, `hasData`.
- `profitEngine.ts`: `calculateGatheringProfit(item, qty, config) → ProfitResult`, `CalculationConfig = {landMultiplier, marketFeePercent, getPrice}`.
- `marketDepth/store.ts`: per-item buy/sell order quantities, `getLiquidityLabel`.
- `ImageCropTool.tsx`: interactive crop overlay (already built).
- `ScreenshotImport.tsx`: full pipeline crop→preprocess→OCR→review table (recently rebuilt).
- `ChatPriceInput.tsx`: collapsible text-based price entry.

## Requested Changes (Diff)

### Add

**1. Land Inventory Store (`lib/landInventory/store.ts`)**
Persisted Zustand store tracking the user's owned lands:
```typescript
export type PlotType = 'crop' | 'herb' | 'tree' | 'animal';
export type LandType = 'fort' | 'large';

export interface LandSlot {
  id: string;           // uuid
  landType: LandType;   // fort | large
  plotType: PlotType;   // crop | herb | tree | animal
  rowCount: number;     // 1–8 rows within this land (fort has up to 4 rows)
}

export interface LandInventoryState {
  slots: LandSlot[];
  addSlot: (slot: Omit<LandSlot, 'id'>) => void;
  updateSlot: (id: string, patch: Partial<Omit<LandSlot, 'id'>>) => void;
  removeSlot: (id: string) => void;
  clearAll: () => void;
  totalFortRows: () => number;
  totalLargeRows: () => number;
}
```
Persist key: `rq-land-inventory:v1`.

**2. Land Advisor Store (`lib/landAdvisor/store.ts`)**
Persisted Zustand store for the land screenshot advisor state:
```typescript
export type PlotStatus = 'empty' | 'growing' | 'ready' | 'unknown';

export interface DetectedSlot {
  slotIndex: number;
  plotType: PlotType;
  status: PlotStatus;
  confidence: number;  // 0–1
  // editable by user:
  editedPlotType?: PlotType;
  editedStatus?: PlotStatus;
}

export interface LandAdvisorState {
  detectedLandType: LandType | null;
  detectedSlots: DetectedSlot[];
  confirmedSlots: DetectedSlot[];  // after user confirms/edits
  imageUrl: string | null;
  stage: 'idle' | 'image_loaded' | 'cropping' | 'processing' | 'review' | 'recommendations';
  setStage: (s: LandAdvisorState['stage']) => void;
  setDetected: (landType: LandType, slots: DetectedSlot[]) => void;
  confirmSlots: (slots: DetectedSlot[]) => void;
  reset: () => void;
}
```
Do NOT persist `imageUrl` (too large). Persist `confirmedSlots` and `detectedLandType`. Persist key: `rq-land-advisor:v1`.

**3. Land Screenshot Advisor component (`components/LandAdvisor.tsx`)**
Full-featured dialog/panel triggered by a persistent "Analyze Land Screenshot" button.

Flow stages:
- **idle**: Drop zone (paste / upload). Also shows a "Manual Setup" fallback button.
- **image_loaded**: Shows `ImageCropTool` to select just the land area.
- **processing**: Spinner while OCR/heuristic runs.
- **review**: Editable grid of detected slots + confirmation.
- **recommendations**: Per-slot top-3 item recommendations.

**Vision heuristic** (no external AI — purely heuristic using image analysis on canvas):
Since true computer vision is not available, use the **Fallback mode** directly but keep the screenshot as a visual reference shown on screen. Detection is purely manual + heuristic:
- After the user crops and confirms, show the cropped image alongside an editable slot grid.
- Pre-populate slot count by trying to detect horizontal bands in the cropped image (divide image height into N equal bands where N = detected row count estimate based on image dimensions).
- Confidence defaults to 0.4 (low) for all auto-detected rows → user must confirm each.
- The "Manual Setup" path skips image upload entirely and goes straight to the review/edit grid.

**Edit grid UI**:
- Each row: slot number | Land Type selector (Fort/Large) | Plot Type selector (Crop/Herb/Tree/Animal) | Status selector (Empty/Growing/Ready/Unknown) | Confidence badge | Delete button
- Toolbar buttons: "Add Slot", "Mark All Empty", "Set All Fort", "Set All Large"
- Fort selector sets `rowCount` = 4 (per fort), Large sets `rowCount` = 1
- "Confirm & Get Recommendations" button → triggers recommendation engine

**Recommendation engine** (pure TypeScript, uses existing `calculateGatheringProfit`):
For each **empty** or **unknown** slot:
- Filter `allGatheringItems` by plot type:
  - `crop`: category contains "farming" (or no herb/tree/animal keyword)
  - `herb`: category contains "herb" or "herbalism"
  - `tree`: category contains "tree" or "wood"
  - `animal`: category contains "husbandry" or "animal"
- For each candidate item, compute `calculateGatheringProfit(item, 1, config)` with the slot's land multiplier
- Apply Player Status filter:
  - Active → prefer items in FAST or ACTIVE band (growTime ≤ 6h), but show all sorted by s/h
  - Sleeping → prefer SLEEP band (8–16h)
  - Away → prefer AWAY band (16h+)
- Sort by `profitPerHour` descending
- Return top 3 per slot
- Row cap: skip items already recommended in 2+ other slots (default cap = 2, configurable)
- Liquidity: if `getLiquidityLabel(dropId) === 'low'` → show ⚠ badge but don't hide

**Recommendation output per slot**:
Show a card per empty slot:
```
Slot 2 — Fort, Herb plot (Empty)
─────────────────────────────────────────
1. Brightday      6h    420,000 s/h   Low flood risk   [Add to Plan]
2. Thin Roots     2h    310,000 s/h   Unknown          [Add to Plan]
3. Juicy Roots    2h    290,000 s/h   Medium risk      [Add to Plan]
```
"Add to Plan" button inserts into land inventory (slot in `landInventory` store). If no prices are set for any item in the filtered list, show "Set prices in the Price Book to see recommendations."

**4. Strategy tab: Land Inventory Panel**
Inside `GrowTimeStrategy.tsx`, add a new section **"My Lands"** above the Band Cards section:
- Shows a compact grid of the user's configured lands from `landInventory` store
- "Add Land" button → opens a small inline form: Land Type (Fort/Large), Plot Type (Crop/Herb/Tree/Animal), Rows (1–8)
- Each land slot shows: land type icon, plot type label, row count, a remove button
- Fort total rows and Large total rows shown as summary badges (e.g. "8 Fort rows · 2 Large plots")
- If the user has no lands configured, show a prompt: "Configure your lands to get personalised recommendations."
- The `totalFortRows()` and `totalLargeRows()` values feed into the recommendation engine's row-cap logic

**5. "Analyze Land Screenshot" global button in `App.tsx`**
Add a slim persistent bar between `GlobalSettingsBar` and the tab nav:
- Contains a single button: "🔍 Analyze Land Screenshot"
- Opens `LandAdvisor` as a full-screen `Sheet` (shadcn side-panel from the right, width ~50vw on desktop, full on mobile)
- Button always visible regardless of active tab
- Also wire the `LandAdvisor` into the Strategy tab inline (optional anchor section) so the user can access it in context there too

**6. `configStore.ts` additions**
Add `playerStatus: PlayerStatus` (default `'active'`) and `rowCap: number` (default 2) to the config store so they persist globally and are shared between the Strategy tab and the Land Advisor.

### Modify

- **`GrowTimeStrategy.tsx`**:
  - Replace local `playerStatus` state with `configStore.playerStatus` (now persisted)
  - Replace local `rowCap` state with `configStore.rowCap`
  - Add "My Lands" section (land inventory panel, new) above Band Cards
  - The `LandMultiplierSelect` in the sticky header continues to set `configStore.landSize`

- **`App.tsx`**:
  - Add the "Analyze Land Screenshot" bar between `GlobalSettingsBar` and tab nav
  - Import and render `LandAdvisor` as a `Sheet`

- **`configStore.ts`**:
  - Add `playerStatus: PlayerStatus` + `rowCap: number` + setters
  - Bump persist key to `rq-config:v2`

### Remove

- Local `useState` for `playerStatus` and `rowCap` in `GrowTimeStrategy.tsx` (moved to store)

## Implementation Plan

1. **`lib/landInventory/store.ts`** — Zustand persist store for owned land slots. Expose `totalFortRows()` and `totalLargeRows()` computed getters.

2. **`lib/landAdvisor/store.ts`** — Zustand store for advisor UI stage, detected slots, confirmed slots. No image URL persistence.

3. **`store/configStore.ts`** — Add `playerStatus: PlayerStatus`, `rowCap: number`, `setPlayerStatus`, `setRowCap`. Bump persist key to `rq-config:v2`.

4. **`components/LandAdvisor.tsx`** — Full component:
   - Sheet wrapper with open/close prop
   - Stage machine: idle → image_loaded → cropping → processing → review → recommendations
   - Crop + heuristic detection (canvas height-band counting)
   - Editable slot grid with toolbar
   - Recommendation engine (pure TS, uses `calculateGatheringProfit` + `getLiquidityLabel`)
   - Per-slot top-3 output cards with "Add to Plan" buttons
   - Manual Setup fallback (skip image, jump straight to review grid)

5. **`pages/GrowTimeStrategy.tsx`** — Add "My Lands" panel section. Wire `playerStatus` and `rowCap` to `configStore`. Import `useLandInventoryStore` for totals display.

6. **`App.tsx`** — Add "Analyze Land Screenshot" slim bar + `LandAdvisor` Sheet.

7. **Validate**: `npm run typecheck && npm run build` — fix all errors.
