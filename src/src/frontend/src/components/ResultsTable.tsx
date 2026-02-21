import { useState } from "react";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { cn } from "@/lib/utils";
import type { ProfitResult } from "@/lib/calculator/types";

interface ResultsTableProps {
  results: ProfitResult[];
  onSetPrice?: (itemId: number, itemName: string) => void;
}

export function ResultsTable({ results, onSetPrice }: ResultsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatNumber = (num: number | undefined, decimals = 2) => {
    if (num === undefined) return "-";
    return num.toFixed(decimals);
  };

  const formatTime = (seconds: number | undefined) => {
    if (!seconds) return "-";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Skill</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Margin</TableHead>
            <TableHead className="text-right">Per Hour</TableHead>
            <TableHead className="text-right">Confidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                No results found
              </TableCell>
            </TableRow>
          ) : (
            results.map((result) => {
              const isExpanded = expandedRows.has(result.id);
              const profitColor =
                result.profit > 0
                  ? "text-success"
                  : result.profit < 0
                    ? "text-destructive"
                    : "text-muted-foreground";

              return (
                <>
                  <TableRow
                    key={result.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleRow(result.id)}
                  >
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        {result.name}
                        {result.category && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {result.category}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {result.skillRequired}
                    </TableCell>
                    <TableCell className={cn("text-right font-mono", profitColor)}>
                      <div className="flex items-center justify-end gap-1">
                        {result.profit > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : result.profit < 0 ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : null}
                        {formatNumber(result.profit)}
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-right font-mono", profitColor)}>
                      {formatNumber(result.profitMargin, 1)}%
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {result.profitPerTime
                        ? formatNumber(result.profitPerTime)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <ConfidenceBadge
                        confidence={result.confidence}
                        missingPrices={result.missingPrices}
                      />
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30">
                        <div className="grid gap-4 py-4 md:grid-cols-2">
                          {/* Inputs */}
                          <div>
                            <h4 className="mb-2 font-semibold">Inputs</h4>
                            {result.inputBreakdown.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No input costs (gathering)
                              </p>
                            ) : (
                              <ul className="space-y-1 text-sm">
                                {result.inputBreakdown.map((input, i) => (
                                  <li
                                    key={i}
                                    className="flex justify-between gap-2"
                                  >
                                    <span>
                                      {input.itemName} x{input.amount}
                                    </span>
                                    <span className="font-mono">
                                      {input.price !== null
                                        ? formatNumber(
                                            input.price * input.amount,
                                          )
                                        : "?"}
                                    </span>
                                  </li>
                                ))}
                                <li className="flex justify-between gap-2 border-t pt-1 font-semibold">
                                  <span>Total Input Cost</span>
                                  <span className="font-mono">
                                    {formatNumber(result.inputCosts)}
                                  </span>
                                </li>
                              </ul>
                            )}
                          </div>

                          {/* Outputs */}
                          <div>
                            <h4 className="mb-2 font-semibold">Outputs</h4>
                            <ul className="space-y-1 text-sm">
                              {result.outputBreakdown.map((output, i) => (
                                <li
                                  key={i}
                                  className="flex justify-between gap-2"
                                >
                                  <span>
                                    {output.itemName} x{formatNumber(output.amount, 1)}
                                  </span>
                                  <span className="font-mono">
                                    {output.price !== null
                                      ? formatNumber(output.price * output.amount)
                                      : "?"}
                                  </span>
                                </li>
                              ))}
                              <li className="flex justify-between gap-2 border-t pt-1 font-semibold">
                                <span>Total Output Value</span>
                                <span className="font-mono">
                                  {formatNumber(result.outputValue)}
                                </span>
                              </li>
                            </ul>
                          </div>

                          {/* Additional Metrics */}
                          <div className="md:col-span-2">
                            <h4 className="mb-2 font-semibold">
                              Additional Info
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                              <div>
                                <span className="text-muted-foreground">
                                  Time:
                                </span>
                                <span className="ml-1 font-mono">
                                  {formatTime(result.time)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  XP:
                                </span>
                                <span className="ml-1 font-mono">
                                  {result.experience}
                                </span>
                              </div>
                              {result.profitPerSlot !== undefined && (
                                <div>
                                  <span className="text-muted-foreground">
                                    Per Slot:
                                  </span>
                                  <span className="ml-1 font-mono">
                                    {formatNumber(result.profitPerSlot)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
