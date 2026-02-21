import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ConfidenceLevel } from "@/lib/calculator/types";

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
  missingPrices: string[];
}

export function ConfidenceBadge({
  confidence,
  missingPrices,
}: ConfidenceBadgeProps) {
  const badgeVariant =
    confidence === "high"
      ? "default"
      : confidence === "medium"
        ? "secondary"
        : "destructive";

  const badgeText =
    confidence === "high"
      ? "High"
      : confidence === "medium"
        ? "Medium"
        : "Low";

  if (missingPrices.length === 0) {
    return <Badge variant={badgeVariant}>{badgeText}</Badge>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant={badgeVariant}>{badgeText}</Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="mb-1 font-semibold">Missing prices for:</p>
          <ul className="list-inside list-disc text-sm">
            {missingPrices.slice(0, 5).map((name, i) => (
              <li key={i}>{name}</li>
            ))}
            {missingPrices.length > 5 && (
              <li>+ {missingPrices.length - 5} more...</li>
            )}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
