import { Settings, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useConfigStore } from "@/store/configStore";
import type { LandSize } from "@/store/configStore";

export function QuickInputBar() {
  const {
    landSize,
    landMultiplier,
    marketFeePercent,
    craftingFee,
    includeOpportunityCost,
    pricingMode,
    setLandSize,
    setMarketFeePercent,
    setCraftingFee,
    setIncludeOpportunityCost,
    setPricingMode,
  } = useConfigStore();

  return (
    <div className="sticky top-0 z-40 border-b bg-card">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          {/* Land Size Selector */}
          <div className="flex items-center gap-2">
            <Label htmlFor="land-size" className="text-sm font-medium">
              Land:
            </Label>
            <Select
              value={landSize}
              onValueChange={(value) => setLandSize(value as LandSize)}
            >
              <SelectTrigger id="land-size" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small (1x)</SelectItem>
                <SelectItem value="medium">Medium (2x)</SelectItem>
                <SelectItem value="large">Large (4x)</SelectItem>
                <SelectItem value="stronghold">Stronghold (8x)</SelectItem>
                <SelectItem value="fort">Fort (20x)</SelectItem>
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground">
                    ({landMultiplier}x)
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">
                    Production multiplier based on land size. Affects yield for
                    farming, herbalism, woodcutting, and husbandry.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Pricing Mode */}
          <div className="flex items-center gap-2">
            <Label htmlFor="pricing-mode" className="text-sm font-medium">
              Prices:
            </Label>
            <Select
              value={pricingMode}
              onValueChange={(value) =>
                setPricingMode(value as "live" | "manual")
              }
            >
              <SelectTrigger id="pricing-mode" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="live" disabled>
                  Live (N/A)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Settings */}
          <Collapsible className="ml-auto">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="absolute right-4 top-14 z-50 w-80 rounded-lg border bg-card p-4 shadow-lg">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="market-fee" className="text-sm">
                    Market Fee (%)
                  </Label>
                  <Input
                    id="market-fee"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={marketFeePercent}
                    onChange={(e) =>
                      setMarketFeePercent(parseFloat(e.target.value) || 0)
                    }
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fee charged when selling items on the market
                  </p>
                </div>

                <div>
                  <Label htmlFor="crafting-fee" className="text-sm">
                    Crafting Fee (silver)
                  </Label>
                  <Input
                    id="crafting-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={craftingFee}
                    onChange={(e) =>
                      setCraftingFee(parseFloat(e.target.value) || 0)
                    }
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Station fee for crafting (if applicable)
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="opportunity-cost" className="text-sm">
                      Include Opportunity Cost
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Count sellable materials as cost
                    </p>
                  </div>
                  <Switch
                    id="opportunity-cost"
                    checked={includeOpportunityCost}
                    onCheckedChange={setIncludeOpportunityCost}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
