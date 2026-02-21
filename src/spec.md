# RavenQuest Profit Planner

## Current State
This is a new project with no existing code.

## Requested Changes (Diff)

### Add
- Full-stack React + TypeScript application for calculating profit from RavenQuest game activities
- Five calculator modules: Farming, Crafting, Herbalism, Woodcutting, Husbandry
- API Explorer for browsing all available Ravendawn API endpoints
- Dynamic API client that fetches data from https://api.ravendawn.online/
- Price Book system for manual price management with local storage persistence
- Land configuration system supporting all land sizes (Small 1x, Medium 2x, Large 4x, Stronghold 8x, Fort 20x) with production multipliers
- Profit calculation engine with opportunity cost support
- Comprehensive filtering and sorting for all result tables
- Tax/fee configuration (market fee, crafting fee, listing fee)
- Confidence indicators for profit calculations based on data completeness
- Mobile-responsive UI with sticky sidebars and clean empty states

### Modify
N/A (new project)

### Remove
N/A (new project)

## Implementation Plan

### 1. Data Layer & API Client
**Files:** `src/lib/api/client.ts`, `src/lib/api/types.ts`, `src/lib/api/endpoints.ts`

- Create typed API client that dynamically fetches from all Ravendawn API endpoints
- Implement stale-while-revalidate caching strategy with configurable TTL
- Define TypeScript interfaces for all API response types:
  - `FarmingItem` (id, name, skillRequired, experience, growingTime, items[])
  - `HerbalismItem` (id, name, skillRequired, experience, growingTime, items[])
  - `WoodcuttingItem` (id, name, skillRequired, experience, growingTime, items[])
  - `HusbandryItem` (id, name, skillRequired, time{gathering, butchering}, items{gathering, butchering})
  - `CraftingRecipe` (amount, category, description, durability, experience, itemId, level, materials[], name, progress, quality)
  - All other API resources (items, regions, consumables, spells, etc.)
- Handle rate limiting with exponential backoff and user notifications
- Provide loading states, error boundaries, and retry mechanisms

### 2. Price Book System
**Files:** `src/lib/priceBook/store.ts`, `src/lib/priceBook/types.ts`, `src/hooks/usePriceBook.ts`

- Local storage-backed price database keyed by item ID
- Support manual price entry per item
- Import/Export JSON functionality
- "Auto-fill from last known" on data refresh
- Price override mode toggle (Live API prices vs Manual override)
- Track last updated timestamp per item

### 3. Profit Calculation Engine
**Files:** `src/lib/calculator/profitEngine.ts`, `src/lib/calculator/types.ts`

Core calculation logic for all activity types:
- **Farming/Herbalism/Woodcutting:**
  - Input: seed/plant cost (if applicable, set to 0 for gathering)
  - Output: item yields (min-max range, calculate average)
  - Apply land production multiplier (1x, 2x, 4x, 8x, 20x)
  - Calculate profit per harvest
  - Calculate profit per time (using growingTime in seconds)
  - Calculate profit per land slot
  
- **Husbandry:**
  - Support gathering mode and butchering mode separately
  - Different time windows for each mode
  - Apply land production multiplier
  - Calculate profit per animal slot
  
- **Crafting:**
  - Sum material costs (from price book)
  - Calculate output value (crafted item price × amount)
  - Subtract crafting fee
  - Apply durability considerations if relevant
  - Calculate profit per craft
  - Calculate profit per profession XP gained

- **Opportunity Cost:**
  - Toggle to treat sellable ingredients as cost (ingredient price vs using it)
  - Example: If corn can be sold for 10 silver or used to craft, opportunity cost = 10 silver

- **Tax/Fee Application:**
  - Market listing fee % (default 5%)
  - Crafting station fee (flat amount, default 0)
  - Final profit = (output value) - (input costs) - (fees)

- **Confidence Scoring:**
  - High: all inputs and outputs have prices
  - Medium: some prices missing (specify which)
  - Low: critical data missing (hide profit, show requirements)

### 4. Global Configuration State
**Files:** `src/store/configStore.ts`, `src/hooks/useConfig.ts`

Zustand store for global settings:
- `landSize`: "small" | "medium" | "large" | "stronghold" | "fort"
- `landMultiplier`: 1 | 2 | 4 | 8 | 20 (derived from landSize)
- `upgradeLevel`: number (0-10, affects production in some cases)
- `marketFeePercent`: number (default 5)
- `craftingFee`: number (default 0)
- `listingFee`: number (default 0)
- `includeOpportunityCost`: boolean (default false)
- `pricingMode`: "live" | "manual"
- `selectedServer`: string | null (if API supports servers/regions in future)

### 5. UI Components

#### Quick Input Bar (Global Header)
**File:** `src/components/QuickInputBar.tsx`
- Sticky top bar visible on all calculator tabs
- Dropdowns for land size, server/region (placeholder for future)
- Pricing mode toggle (Live API / Manual Override)
- Expandable "Settings" panel for tax/fee inputs with tooltips
- Visual indicators for current configuration

#### Calculator Tabs Navigation
**File:** `src/components/CalculatorNav.tsx`
- Horizontal tab bar: Farming | Crafting | Herbalism | Woodcutting | Husbandry | API Explorer
- Active tab highlight
- Mobile: convert to dropdown or swipeable tabs

#### Calculator Tab Layout (Shared)
**File:** `src/components/CalculatorLayout.tsx`
Three-column layout:
- **Left sidebar (Filters):** 250px fixed width, sticky
  - Search input (item name)
  - Sort dropdown (Profit, Margin, Profit/Time)
  - Filter by skill level range (min-max sliders)
  - Filter by category/type (checkboxes)
  - "Only show positive profit" toggle
  - "Show top N" dropdown (10, 25, 50, 100, All)
- **Center (Results List):** Flex-grow, scrollable
  - Table or card grid showing calculation results
  - Pagination controls or "Load More" button
  - Always show MORE than 4 results (default 50)
- **Right sidebar (Profit Summary):** 300px fixed width, sticky
  - Total profit (sum of visible results)
  - Best profit item highlight
  - Confidence breakdown (how many high/medium/low confidence results)
  - Quick actions (Export CSV, Adjust Prices)

#### Result Row/Card Component
**File:** `src/components/ResultRow.tsx`
Display per result:
- Item icon (placeholder or from API if available)
- Item name + output quantity
- Input ingredients list + quantities
- Total input cost (with breakdown on hover)
- Output value
- Profit (absolute, color-coded: green positive, red negative)
- Profit margin (%)
- Profit per time (if applicable)
- Profit per land slot (if applicable)
- Confidence badge (High/Medium/Low with tooltip)
- Expand/collapse for detailed breakdown

#### API Explorer Tab
**Files:** `src/components/ApiExplorer/index.tsx`, `src/components/ApiExplorer/EndpointSidebar.tsx`, `src/components/ApiExplorer/ResponseViewer.tsx`

Layout:
- **Left sidebar:** List of all API endpoint categories (Professions, Items, Consumables, Spells, Archetypes, Regions, etc.)
- **Main panel:**
  - Endpoint URL display
  - Query params form (if endpoint supports params)
  - "Fetch" button
  - Response preview table (auto-generate columns from JSON keys)
  - Pagination controls (if response is array with 50+ items)
  - Raw JSON viewer (collapsible tree view)
- Read-only: no mutation, purely for transparency and debugging

### 6. Calculator Tab Implementations

#### Farming Calculator
**File:** `src/pages/FarmingCalculator.tsx`
- Fetch from `/v1/professions/farming`
- Display all crops and trees
- Show output items (e.g., Potato: 2-4, Three-Leaf Clover: 0-1)
- Calculate average yield: (min + max) / 2
- Apply land multiplier to yields
- Calculate profit per harvest and profit per hour (growingTime)
- Filter by skill level, search by name
- Sort by profit, margin, or profit/hour

#### Crafting Calculator
**File:** `src/pages/CraftingCalculator.tsx`
- Fetch from all crafting endpoints:
  - `/v1/professions/alchemy`
  - `/v1/professions/blacksmithing`
  - `/v1/professions/carpentry`
  - `/v1/professions/cooking`
  - `/v1/professions/weaving`
- Aggregate all recipes
- Each recipe has materials[] array (itemId, amount, name)
- Calculate material costs from price book
- Calculate output value (itemId × amount)
- Show profit after crafting fees
- Filter by category (drinks, baked goods, meals, weapons, armor, etc.)
- Sort by profit per craft or profit per XP

#### Herbalism Calculator
**File:** `src/pages/HerbalismCalculator.tsx`
- Fetch from `/v1/professions/herbalism`
- Similar to Farming: herbs, mushrooms, plants
- Show output items (e.g., Refreshing Leaf, Thin Roots)
- Apply land multiplier
- Calculate profit per harvest and profit per hour

#### Woodcutting Calculator
**File:** `src/pages/WoodcuttingCalculator.tsx`
- Fetch from `/v1/professions/woodcutting`
- Display trees (Juniper, Fir, Palm, Oak, Wildleaf, Willow)
- Show log outputs (Small Log, Heavy Log, Sturdy Log, Fine Log, Dense Log)
- Apply land multiplier
- Calculate profit per tree and profit per hour

#### Husbandry Calculator
**File:** `src/pages/HusbandryCalculator.tsx`
- Fetch from `/v1/professions/husbandry`
- Display animal pens and special structures (Cheese Barrel, Bee Hive)
- Support two modes per animal:
  - Gathering (e.g., Egg from chickens, Milk from cows)
  - Butchering (e.g., Chicken Meat, Beef)
- Show separate time and outputs for each mode
- Let user toggle between modes or show both
- Apply land multiplier
- Calculate profit per pen and profit per hour for each mode

### 7. Empty States & Error Handling
**Files:** `src/components/EmptyState.tsx`, `src/components/ErrorBoundary.tsx`

- **No results:** "Set price data to see profits" or "No items match your filters"
- **API errors:** Friendly message with retry button, suggest checking API status
- **Missing prices:** Highlight which items need prices, link to Price Book
- **Rate limit hit:** Show cooldown timer, explain rate limiting

### 8. Mobile Responsiveness
- Quick Input Bar: collapse into hamburger menu on mobile
- Calculator Layout: stack columns vertically (filters on top, results, summary at bottom)
- Result rows: convert to cards with clear hierarchy
- API Explorer: sidebar becomes drawer/modal on mobile

### 9. Performance Optimizations
- Virtualized lists for 100+ results (react-window or similar)
- Debounced search inputs
- Memoized calculation results
- Lazy load tabs (code-split by route)
- Service worker for API response caching

### 10. Data Accuracy Checks
- **Land multipliers:** Verify against whitepaper (Small=1x, Medium=2x, Large=4x, Stronghold=8x, Fort=20x)
- **Fort vs Stronghold:** If API or references distinguish further, implement accordingly
- **Tradepacks:** Check if API has tradepack endpoints. If YES, implement Tradepack calculator tab. If NO, add a placeholder "Tradepacks: Coming Soon (waiting for API support)" panel and do NOT fabricate data.

## UX Notes

### Design Principles
- Clean, professional interface
- High information density without clutter
- Clear visual hierarchy (use color sparingly for profit/loss indicators)
- Consistent spacing, typography, button styles
- Accessible: ARIA labels, keyboard navigation, screen reader support

### Color Coding
- Positive profit: green (#10b981)
- Negative profit: red (#ef4444)
- Neutral/zero: gray (#6b7280)
- High confidence: blue badge
- Medium confidence: yellow badge
- Low confidence: red badge

### Typography
- Headings: Inter or similar sans-serif
- Body: Inter or system font stack
- Monospace for numbers, JSON viewer

### Tooltips & Help
- Tooltip on every configuration field explaining what it does
- Link to RavenQuest whitepaper for land mechanics
- Link to API documentation for transparency
- "?" icons next to complex terms (land multiplier, opportunity cost, etc.)

### Workflow Example
1. User opens app, lands on Farming tab
2. Quick Input Bar shows default config (Medium land, 5% market fee, manual pricing)
3. User adjusts land to "Fort" (20x multiplier)
4. Left sidebar filters: skill level 1-30, only positive profit
5. Results table shows 50 crops sorted by profit/hour (descending)
6. User sees "Potatoes" row: output 2-4, avg 3, with 20x multiplier = 60 potatoes/harvest
7. Input cost = 0 (gathering), output value = 60 × price per potato (user sets price in Price Book)
8. If price not set, row shows "Medium confidence" badge and tooltip: "Set price for Potato to calculate profit"
9. User clicks "Price Book" in right sidebar, sets Potato = 5 silver
10. Calculator updates live, shows profit per harvest and profit per hour
11. User exports results to CSV for offline analysis

### Future Extensibility
- If API adds real-time market prices, seamlessly switch from manual to live pricing
- If tradepacks endpoint becomes available, add Tradepack tab
- If API adds server/region filtering, enable server selector
- If user accounts are added, support saving Price Books to cloud

## Technical Stack
- **Frontend:** React 18 + TypeScript + Vite
- **Routing:** React Router v6
- **State:** Zustand (global config) + React Query (API data fetching/caching)
- **Styling:** Tailwind CSS 3
- **UI Components:** Headless UI (for dropdowns, dialogs) or Radix UI
- **Data Fetching:** Axios or fetch with React Query
- **Storage:** localStorage for Price Book
- **Build:** Vite with code-splitting and tree-shaking

## API Endpoints Summary (from Swagger)
All endpoints discovered from https://api.ravendawn.online/swagger/doc.json:

**Professions (Gathering & Production):**
- GET /v1/professions/farming
- GET /v1/professions/herbalism
- GET /v1/professions/woodcutting
- GET /v1/professions/husbandry
- GET /v1/professions/fishing
- GET /v1/professions/mining
- GET /v1/professions/alchemy
- GET /v1/professions/blacksmithing
- GET /v1/professions/carpentry
- GET /v1/professions/cooking
- GET /v1/professions/weaving

**Items & Consumables:**
- GET /v1/items
- GET /v1/items/charms
- GET /v1/items/trinkets
- GET /v1/items/whetstones
- GET /v1/consumables/foods
- GET /v1/consumables/potions
- GET /v1/consumables/rations
- GET /v1/consumables/tonics
- GET /v1/consumables/treats

**Game Data (for API Explorer):**
- GET /v1/archetypes
- GET /v1/archetypes/classes
- GET /v1/archetypes/colors
- GET /v1/regions
- GET /v1/spells
- GET /v1/spells/crafting-abilities
- GET /v1/spells/fishing-abilities
- GET /v1/spells/legacy-skills
- GET /v1/spells/mount-skills
- GET /v1/spells/passives
- GET /v1/spells/weapon-skills
- GET /v1/creatures
- GET /v1/ravencards

**Note:** No market price endpoints found. No tradepack endpoints found. If these become available, implementation can be added later.

## Testing & Validation Strategy
- Manual testing: verify profit calculations against known player data
- Edge cases: 0 yield items, missing prices, extreme multipliers (Fort 20x)
- Cross-reference land multipliers with whitepaper
- Test all filters, sorts, pagination
- Test Price Book import/export with sample JSON
- Test mobile layout on real devices
- Accessibility audit: keyboard nav, screen readers

## Deployment Notes
- Host on Vercel, Netlify, or Cloudflare Pages (static build)
- No backend required (serverless, API calls from client)
- Set CORS headers if API restricts origins
- Cache-busting for API responses (use React Query's staleTime)
- Monitor API rate limits in production, adjust caching if needed

## Success Criteria
- All 5 calculators (Farming, Crafting, Herbalism, Woodcutting, Husbandry) are functional and accurate
- Profit calculations reflect land multipliers correctly
- API Explorer displays all available endpoints with response data
- Price Book allows full manual control with import/export
- UI is clean, mobile-friendly, and fast (< 2s initial load)
- No fake/static data: everything dynamically fetched from official API
- User can filter, sort, and analyze profit opportunities effectively
