# RavenQuest Profit Planner

A production-ready web application for calculating potential profits from gathering and crafting activities in RavenQuest, using **live API data only** (no fake/static data).

## Features

### Five Calculator Modules
- **Farming** - Calculate profit per harvest and per hour for crops
- **Herbalism** - Analyze herb gathering profitability with land multipliers
- **Woodcutting** - Evaluate tree cutting profits and yields
- **Husbandry** - Track animal pen profits in gathering and butchering modes
- **Crafting** - Calculate material costs vs output value for Alchemy, Blacksmithing, Carpentry, Cooking, and Weaving

### API Explorer
- Browse all available Ravendawn API endpoints
- View live data in table or JSON format
- Transparent data inspection for debugging

### Price Book System
- Manual price management with localStorage persistence
- Import/Export price data as JSON
- Set individual item prices to calculate accurate profits

### Global Configuration
- **Land Size:** Small (1x), Medium (2x), Large (4x), Stronghold (8x), Fort (20x)
- **Fees:** Market fee %, crafting fee, listing fee
- **Opportunity Cost:** Toggle to count sellable materials as cost
- **Pricing Mode:** Manual override (live API prices not available)

### Advanced Filtering & Sorting
- Search by item name
- Sort by Profit, Margin %, Profit/Hour, Skill Level
- Filter by skill level range (1-100)
- "Only show positive profit" toggle
- Show top N results (10, 25, 50, 100, or All)
- Category filtering for crafting professions

### Profit Calculation Engine
- **Gathering (Farming/Herbalism/Woodcutting):**
  - Average yield = (min + max) / 2
  - Apply land multiplier
  - Calculate profit per harvest and profit per hour
- **Husbandry:**
  - Separate calculations for gathering vs butchering modes
  - Different time windows for each mode
- **Crafting:**
  - Sum material costs from Price Book
  - Calculate output value after market fees
  - Optional opportunity cost consideration
- **Confidence Scoring:**
  - **High:** All prices set
  - **Medium:** Some prices missing
  - **Low:** Critical data missing

### UI/UX
- Responsive design (desktop & mobile)
- Dark/light theme toggle
- Sticky filters and summary sidebars
- Expandable result rows with detailed breakdowns
- Empty states and error handling with retry
- Rate limit management with user notifications

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **State Management:** Zustand (global config) + React Query (API data)
- **Styling:** Tailwind CSS with custom OKLCH tokens
- **UI Components:** shadcn/ui (Radix primitives)
- **API:** https://api.ravendawn.online/v1/

## Data Source

All data is fetched dynamically from the official Ravendawn API:
- **Professions:** `/v1/professions/{farming,herbalism,woodcutting,husbandry,alchemy,blacksmithing,carpentry,cooking,weaving}`
- **Swagger Documentation:** `https://api.ravendawn.online/swagger/doc.json`

No hardcoded item lists or fake data - everything is live.

## Usage

1. **Select a calculator tab** (Farming, Crafting, Herbalism, Woodcutting, or Husbandry)
2. **Configure your land size** in the Quick Input Bar (affects yield multipliers)
3. **Set prices** using the Price Book button (manual pricing required)
4. **Apply filters** to narrow down results (skill level, category, search term)
5. **Sort by profit, margin, or profit/hour** to find the best opportunities
6. **Expand result rows** to see detailed input/output breakdowns
7. **Export your Price Book** for backup or sharing

## Land Multipliers (from RavenQuest Whitepaper)

- Small: 1x
- Medium: 2x
- Large: 4x
- Stronghold: 8x
- Fort: 20x

## Price Book Management

Since the API does not provide real-time market prices:
1. Click the **Price Book** button in the header
2. Manually set prices for items you want to track
3. **Export** your price data as JSON for backup
4. **Import** price data to restore or share with others

## Profit Calculation Example

**Farming (Potatoes on Fort land):**
- Output: 2-4 potatoes (avg 3)
- Land multiplier: 20x (Fort)
- Yield: 3 × 20 = 60 potatoes
- Price per potato: 5 silver (from Price Book)
- Output value: 60 × 5 = 300 silver
- Market fee (5%): 15 silver
- Net profit: 285 silver per harvest
- Growing time: 1800 seconds (30 minutes)
- Profit/hour: 570 silver

## API Rate Limiting

The app implements:
- In-memory rate limit tracking
- Exponential backoff on retries
- User notifications when rate limits are hit
- React Query caching (5-minute stale time)

## Development

```bash
# Install dependencies
pnpm install

# Type check
pnpm --filter '@caffeine/template-frontend' typescript-check

# Lint
pnpm --filter '@caffeine/template-frontend' lint

# Build
pnpm --filter '@caffeine/template-frontend' build:skip-bindings

# Dev server
pnpm --filter '@caffeine/template-frontend' start
```

## Project Structure

```
src/frontend/src/
├── components/
│   ├── ui/                       # shadcn/ui components (read-only)
│   ├── CalculatorLayout.tsx      # Three-column layout
│   ├── ConfidenceBadge.tsx       # Data confidence indicator
│   ├── EmptyState.tsx            # Empty state placeholder
│   ├── ErrorDisplay.tsx          # Error handling with retry
│   ├── Filters.tsx               # Shared filter component
│   ├── PriceBookDialog.tsx       # Price management dialog
│   ├── QuickInputBar.tsx         # Global config bar
│   ├── ResultsTable.tsx          # Results table with expand
│   └── Summary.tsx               # Profit summary sidebar
├── hooks/
│   ├── useQueries.ts             # React Query hooks
│   ├── useActor.ts               # (generated, read-only)
│   └── useInternetIdentity.ts    # (generated, read-only)
├── lib/
│   ├── api/
│   │   ├── client.ts             # API client with retry logic
│   │   └── types.ts              # API response types
│   ├── calculator/
│   │   ├── profitEngine.ts       # Profit calculation logic
│   │   └── types.ts              # Profit result types
│   ├── priceBook/
│   │   ├── store.ts              # Zustand price store
│   │   └── types.ts              # Price book types
│   └── utils.ts                  # (shared utilities)
├── pages/
│   ├── FarmingCalculator.tsx
│   ├── CraftingCalculator.tsx
│   ├── HerbalismCalculator.tsx
│   ├── WoodcuttingCalculator.tsx
│   ├── HusbandryCalculator.tsx
│   └── ApiExplorer.tsx
├── store/
│   └── configStore.ts            # Zustand config store
├── App.tsx                       # Main app with routing
└── main.tsx                      # Entry point
```

## Design Tokens

Custom OKLCH-based theme with warm earth tones and rich amber accents:
- **Primary:** Rich amber for profit highlights
- **Success:** Profit green
- **Destructive:** Loss red
- **Accent:** Deep forest green for nature/farming
- Light and dark mode support

## Non-Features (by Design)

- ❌ No login or user accounts
- ❌ No subscriptions or paywalls
- ❌ No XP tracking
- ❌ No AI features
- ❌ No leaderboards
- ❌ No tradepacks (API does not support)

## Future Extensibility

- If API adds real-time market prices → seamlessly switch from manual to live pricing
- If tradepack endpoint becomes available → add Tradepack calculator tab
- If API adds server/region filtering → enable server selector
- If user accounts are added → support saving Price Books to cloud

## License

Built with ❤️ using [caffeine.ai](https://caffeine.ai)

Data from [Ravendawn API](https://api.ravendawn.online/) | [RavenQuest Official](https://ravenquest.io/en/)
