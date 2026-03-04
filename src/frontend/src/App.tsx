import { GlobalSettingsBar } from "@/components/GlobalSettingsBar";
import { LandAdvisor } from "@/components/LandAdvisor";
import { PriceBookPanel } from "@/components/PriceBookPanel";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  InternetIdentityProvider,
  useInternetIdentity,
} from "@/hooks/useInternetIdentity";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";
import { AllItemsCalculator } from "@/pages/AllItemsCalculator";
import { CraftingCalculator } from "@/pages/CraftingCalculator";
import { FarmingCalculator } from "@/pages/FarmingCalculator";
import { GrowTimeStrategy } from "@/pages/GrowTimeStrategy";
import { GuildPlanner } from "@/pages/GuildPlanner";
import { HerbalismCalculator } from "@/pages/HerbalismCalculator";
import { HusbandryCalculator } from "@/pages/HusbandryCalculator";
import { LandPlanner } from "@/pages/LandPlanner";
import { WoodcuttingCalculator } from "@/pages/WoodcuttingCalculator";
import { useConfigStore } from "@/store/configStore";
import {
  BookOpen,
  Hammer,
  LayoutGrid,
  Leaf,
  Loader2,
  LogOut,
  Map as MapIcon,
  MapPinned,
  PawPrint,
  Sprout,
  Timer,
  Trees,
  User,
  Users,
} from "lucide-react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

type Tab =
  | "all"
  | "strategy"
  | "farming"
  | "herbalism"
  | "woodcutting"
  | "husbandry"
  | "land"
  | "crafting"
  | "guild";

// ─── Auth Button ──────────────────────────────────────────────────────────────

function AuthButton() {
  const {
    login,
    clear,
    identity,
    isInitializing,
    isLoggingIn,
    isLoginSuccess,
  } = useInternetIdentity();
  const { isAdmin, isChecking: isAdminChecking } = useIsAdmin();

  const isLoggedIn = isLoginSuccess && !!identity;
  const isLoading = isInitializing || isLoggingIn;

  if (isLoading) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="gap-2 border-border bg-surface-2"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Loading…</span>
      </Button>
    );
  }

  if (isLoggedIn && identity) {
    const principal = identity.getPrincipal().toText();
    const shortId = `${principal.slice(0, 8)}…`;
    return (
      <div className="flex items-center gap-1">
        <div className="hidden items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 sm:flex">
          <User className="h-3.5 w-3.5 text-violet-400" />
          <span className="font-mono text-xs text-violet-300">{shortId}</span>
          {!isAdminChecking && isAdmin && (
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-1.5 py-0.5 leading-none">
              Admin
            </span>
          )}
        </div>
        <Button
          data-ocid="auth.logout_button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={clear}
          title="Log out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      data-ocid="auth.login_button"
      variant="outline"
      size="sm"
      className="gap-2 border-border bg-surface-2 hover:bg-surface-3"
      onClick={login}
    >
      <User className="h-4 w-4" />
      <span className="hidden sm:inline">Login</span>
    </Button>
  );
}

// ─── App Content ──────────────────────────────────────────────────────────────

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [priceBookOpen, setPriceBookOpen] = useState(false);
  const [landAdvisorOpen, setLandAdvisorOpen] = useState(false);
  const configStore = useConfigStore();

  const tabs: Array<{
    id: Tab;
    label: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      id: "all",
      label: "All Items",
      icon: <LayoutGrid className="h-4 w-4" />,
      color: "text-gold",
    },
    {
      id: "strategy",
      label: "Strategy",
      icon: <Timer className="h-4 w-4" />,
      color: "text-blue-400",
    },
    {
      id: "farming",
      label: "Farming",
      icon: <Sprout className="h-4 w-4" />,
      color: "text-emerald-400",
    },
    {
      id: "herbalism",
      label: "Herbalism",
      icon: <Leaf className="h-4 w-4" />,
      color: "text-lime-400",
    },
    {
      id: "woodcutting",
      label: "Woodcutting",
      icon: <Trees className="h-4 w-4" />,
      color: "text-amber-500",
    },
    {
      id: "husbandry",
      label: "Husbandry",
      icon: <PawPrint className="h-4 w-4" />,
      color: "text-orange-400",
    },
    {
      id: "land",
      label: "Land",
      icon: <MapIcon className="h-4 w-4" />,
      color: "text-teal-400",
    },
    {
      id: "crafting",
      label: "Crafting",
      icon: <Hammer className="h-4 w-4" />,
      color: "text-cyan-400",
    },
    {
      id: "guild",
      label: "Guild Planner",
      icon: <Users className="h-4 w-4" />,
      color: "text-violet-400",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="border-b border-border bg-surface-1">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-2xl">
                🐦
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-gold">
                  RavenQuest Profit Planner
                </h1>
                <p className="text-xs text-muted-foreground">
                  All Items · Farming · Herbalism · Woodcutting · Husbandry ·
                  Crafting
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                data-ocid="settings.price_book_button"
                variant="outline"
                size="sm"
                className="gap-2 border-border bg-surface-2 hover:bg-surface-3"
                onClick={() => setPriceBookOpen(true)}
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Price Book</span>
              </Button>
              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      {/* ── Global Settings Bar ── */}
      <GlobalSettingsBar onOpenPriceBook={() => setPriceBookOpen(true)} />

      {/* ── Land Advisor Bar ── */}
      <div className="border-b border-border bg-surface-1/60 backdrop-blur">
        <div className="container mx-auto px-4 py-2 flex items-center gap-3">
          <Button
            data-ocid="land_advisor.open_modal_button"
            variant="outline"
            size="sm"
            onClick={() => setLandAdvisorOpen(true)}
            className="gap-2 border-border bg-surface-2 hover:bg-surface-3 text-xs"
          >
            <MapPinned className="h-3.5 w-3.5 text-teal-400" />
            Analyze Land Screenshot
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Get crop recommendations for your plots based on current prices
          </span>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <nav className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-ocid={
                  tab.id === "guild" ? "guild_planner.tab" : `app.${tab.id}_tab`
                }
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? `border-gold ${tab.color}`
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  tab.id === "guild" && activeTab !== tab.id
                    ? "hover:text-violet-400"
                    : tab.id === "crafting" && activeTab !== tab.id
                      ? "hover:text-cyan-400"
                      : tab.id === "land" && activeTab !== tab.id
                        ? "hover:text-teal-400"
                        : "",
                )}
              >
                <span className={activeTab === tab.id ? tab.color : ""}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Tab Content ── */}
      <main>
        {activeTab === "all" && <AllItemsCalculator />}
        {activeTab === "strategy" && <GrowTimeStrategy />}
        {activeTab === "farming" && <FarmingCalculator />}
        {activeTab === "herbalism" && <HerbalismCalculator />}
        {activeTab === "woodcutting" && <WoodcuttingCalculator />}
        {activeTab === "husbandry" && <HusbandryCalculator />}
        {activeTab === "land" && <LandPlanner />}
        {activeTab === "crafting" && <CraftingCalculator />}
        {activeTab === "guild" && <GuildPlanner />}
      </main>

      {/* ── Price Book Panel ── */}
      <PriceBookPanel
        open={priceBookOpen}
        onClose={() => setPriceBookOpen(false)}
      />

      {/* ── Land Advisor Sheet ── */}
      <LandAdvisor
        open={landAdvisorOpen}
        onClose={() => setLandAdvisorOpen(false)}
        playerStatus={configStore.playerStatus}
      />

      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
      <InternetIdentityProvider>
        <AppContent />
      </InternetIdentityProvider>
    </ThemeProvider>
  );
}
