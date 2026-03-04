import { GlobalSettingsBar } from "@/components/GlobalSettingsBar";
import { PriceBookPanel } from "@/components/PriceBookPanel";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { FarmingCalculator } from "@/pages/FarmingCalculator";
import { HerbalismCalculator } from "@/pages/HerbalismCalculator";
import { HusbandryCalculator } from "@/pages/HusbandryCalculator";
import { WoodcuttingCalculator } from "@/pages/WoodcuttingCalculator";
import { BookOpen, Leaf, PawPrint, Sprout, Trees } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

type Tab = "farming" | "herbalism" | "woodcutting" | "husbandry";

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("farming");
  const [priceBookOpen, setPriceBookOpen] = useState(false);

  const tabs: Array<{
    id: Tab;
    label: string;
    icon: React.ReactNode;
    color: string;
  }> = [
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
                  Farming · Herbalism · Woodcutting · Husbandry
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
            </div>
          </div>
        </div>
      </header>

      {/* ── Global Settings Bar ── */}
      <GlobalSettingsBar onOpenPriceBook={() => setPriceBookOpen(true)} />

      {/* ── Tab Navigation ── */}
      <nav className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-ocid={`app.${tab.id}_tab`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? `border-gold ${tab.color}`
                    : "border-transparent text-muted-foreground hover:text-foreground",
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
        {activeTab === "farming" && <FarmingCalculator />}
        {activeTab === "herbalism" && <HerbalismCalculator />}
        {activeTab === "woodcutting" && <WoodcuttingCalculator />}
        {activeTab === "husbandry" && <HusbandryCalculator />}
      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 border-t border-border bg-surface-1 py-6">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>
            Data from{" "}
            <a
              href="https://api.ravendawn.online/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              Ravendawn API
            </a>
            {" · "}
            <a
              href="https://ravenquest.io/en/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              RavenQuest Official
            </a>
          </p>
          <p className="mt-1">
            © {new Date().getFullYear()}. Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>

      {/* ── Price Book Panel ── */}
      <PriceBookPanel
        open={priceBookOpen}
        onClose={() => setPriceBookOpen(false)}
      />

      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
      <AppContent />
    </ThemeProvider>
  );
}
