import { useState } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Sprout, Hammer, Leaf, Trees, PawPrint, Code2 } from "lucide-react";
import { QuickInputBar } from "@/components/QuickInputBar";
import { PriceBookDialog } from "@/components/PriceBookDialog";
import { FarmingCalculator } from "@/pages/FarmingCalculator";
import { CraftingCalculator } from "@/pages/CraftingCalculator";
import { HerbalismCalculator } from "@/pages/HerbalismCalculator";
import { WoodcuttingCalculator } from "@/pages/WoodcuttingCalculator";
import { HusbandryCalculator } from "@/pages/HusbandryCalculator";
import { ApiExplorer } from "@/pages/ApiExplorer";
import { useTheme } from "next-themes";

type Tab = "farming" | "crafting" | "herbalism" | "woodcutting" | "husbandry" | "api-explorer";

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("farming");
  const { theme, setTheme } = useTheme();

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "farming", label: "Farming", icon: <Sprout className="h-4 w-4" /> },
    { id: "crafting", label: "Crafting", icon: <Hammer className="h-4 w-4" /> },
    { id: "herbalism", label: "Herbalism", icon: <Leaf className="h-4 w-4" /> },
    { id: "woodcutting", label: "Woodcutting", icon: <Trees className="h-4 w-4" /> },
    { id: "husbandry", label: "Husbandry", icon: <PawPrint className="h-4 w-4" /> },
    { id: "api-explorer", label: "API Explorer", icon: <Code2 className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary">RavenQuest Profit Planner</h1>
              <p className="text-sm text-muted-foreground">
                Calculate profits from gathering & crafting
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PriceBookDialog />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Input Bar */}
      <QuickInputBar />

      {/* Navigation Tabs */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "secondary" : "ghost"}
                className="flex items-center gap-2 whitespace-nowrap rounded-b-none"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {activeTab === "farming" && <FarmingCalculator />}
        {activeTab === "crafting" && <CraftingCalculator />}
        {activeTab === "herbalism" && <HerbalismCalculator />}
        {activeTab === "woodcutting" && <WoodcuttingCalculator />}
        {activeTab === "husbandry" && <HusbandryCalculator />}
        {activeTab === "api-explorer" && <ApiExplorer />}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t bg-card py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            © 2026. Built with ❤️ using{" "}
            <a
              href="https://caffeine.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </p>
          <p className="mt-2">
            Data from{" "}
            <a
              href="https://api.ravendawn.online/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Ravendawn API
            </a>
            {" | "}
            <a
              href="https://ravenquest.io/en/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              RavenQuest Official
            </a>
          </p>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <AppContent />
    </ThemeProvider>
  );
}
