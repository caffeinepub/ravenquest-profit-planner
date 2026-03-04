import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConfigStore } from "@/store/configStore";
import type { LandSize } from "@/store/configStore";
import { Info } from "lucide-react";

interface GlobalSettingsBarProps {
  onOpenPriceBook?: () => void;
}

const LAND_OPTIONS: Array<{
  value: LandSize;
  label: string;
  multiplier: number;
}> = [
  { value: "small", label: "Small (1×)", multiplier: 1 },
  { value: "medium", label: "Medium (2×)", multiplier: 2 },
  { value: "large", label: "Large (4×)", multiplier: 4 },
  { value: "stronghold", label: "Stronghold (8×)", multiplier: 8 },
  { value: "fort", label: "Fort (20×)", multiplier: 20 },
];

export function GlobalSettingsBar({
  onOpenPriceBook: _onOpenPriceBook,
}: GlobalSettingsBarProps) {
  const { landSize, marketFeePercent, setLandSize, setMarketFeePercent } =
    useConfigStore();

  return (
    <div className="border-b border-border bg-surface-1/80 backdrop-blur">
      <div className="container mx-auto px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* Land Size */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Land Size
            </Label>
            <Select
              value={landSize}
              onValueChange={(v) => setLandSize(v as LandSize)}
            >
              <SelectTrigger
                data-ocid="settings.land_multiplier_select"
                className="h-8 w-36 bg-surface-2 text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/60" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    Land size multiplies the yield of all gathering professions.
                    Larger land = more output per harvest cycle.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Market Fee */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Market Fee
            </Label>
            <div className="relative">
              <Input
                data-ocid="settings.market_fee_input"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={marketFeePercent}
                onChange={(e) =>
                  setMarketFeePercent(Number.parseFloat(e.target.value) || 0)
                }
                className="h-8 w-20 bg-surface-2 pr-6 text-right text-xs font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/60" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    Deducted from revenue when you sell on the market. Default
                    5%. Adjust to match your server's actual fee.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="ml-auto hidden text-xs text-muted-foreground sm:block">
            Expand any row below to enter market prices and see profit
          </div>
        </div>
      </div>
    </div>
  );
}
