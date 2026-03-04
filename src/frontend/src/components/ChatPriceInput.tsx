import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import type { BandStats } from "@/lib/calculator/growTimeBands";
import { parsePriceInput } from "@/lib/chatPriceParser";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { useSnapshotStore } from "@/lib/snapshots/store";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  Keyboard,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface ChatPriceInputProps {
  knownItems: Array<{ id: number; name: string }>;
  /** Required to save snapshots: current band stats */
  bandStats?: BandStats[];
}

export function ChatPriceInput({
  knownItems,
  bandStats = [],
}: ChatPriceInputProps) {
  const { setPrice, priceBook } = usePriceBookStore();
  const { saveSnapshot } = useSnapshotStore();

  const hasPrices = Object.keys(priceBook).length > 0;
  const [open, setOpen] = useState(!hasPrices);
  const [text, setText] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [parsed, setParsed] = useState<{
    matched: Array<{ id: number; name: string; price: number }>;
    unrecognized: string[];
  }>({ matched: [], unrecognized: [] });

  const parse = useCallback(
    (value: string) => {
      if (!value.trim()) {
        setParsed({ matched: [], unrecognized: [] });
        return;
      }
      const result = parsePriceInput(value, knownItems);
      setParsed(result);
    },
    [knownItems],
  );

  // Debounced parse on text change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => parse(text), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, parse]);

  const handleApply = () => {
    if (parsed.matched.length === 0) return;

    // We need item names from the price book to call setPrice
    for (const item of parsed.matched) {
      setPrice(item.id, item.name, item.price);
    }

    // Save snapshot
    const label = new Date().toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const currentPriceBook = usePriceBookStore.getState().priceBook;
    saveSnapshot(label, currentPriceBook, bandStats);

    toast.success(
      `${parsed.matched.length} price${parsed.matched.length !== 1 ? "s" : ""} updated`,
    );
    setText("");
    setParsed({ matched: [], unrecognized: [] });
  };

  const handleClear = () => {
    setText("");
    setParsed({ matched: [], unrecognized: [] });
  };

  const matchCount = parsed.matched.length;
  const unrecognizedCount = parsed.unrecognized.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm transition-colors hover:bg-surface-2"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-2">
            <Keyboard className="h-3.5 w-3.5 text-gold" />
          </div>
          <span className="flex-1 text-left font-semibold text-foreground">
            Chat Price Input
          </span>
          {matchCount > 0 && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
              {matchCount} ready
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 rounded-xl border border-border bg-surface-1 p-4 space-y-3">
          <Textarea
            data-ocid="chat_price.textarea"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              "Paste prices here. Examples:\nApple 3690\nCherry 3765\n\nOr: apple:3690, cherry:3765"
            }
            className="resize-none bg-surface-2 font-mono text-sm placeholder:text-muted-foreground/50 focus-visible:ring-gold/40"
          />

          {/* Preview */}
          {(matchCount > 0 || unrecognizedCount > 0) && (
            <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                {matchCount} item{matchCount !== 1 ? "s" : ""} matched
                {unrecognizedCount > 0 && `, ${unrecognizedCount} unrecognized`}
              </p>

              {matchCount > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {parsed.matched.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span className="flex-1 font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="font-mono tabular-nums text-emerald-400 font-bold">
                        {item.price.toLocaleString()}s
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {unrecognizedCount > 0 && (
                <div className="space-y-1 mt-1.5 border-t border-border/50 pt-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Unrecognized
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {parsed.unrecognized.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[11px] text-red-400"
                      >
                        <XCircle className="h-3 w-3" />
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              data-ocid="chat_price.apply_button"
              size="sm"
              disabled={matchCount === 0}
              onClick={handleApply}
              className="gap-1.5 bg-gold text-background hover:bg-gold/90 font-semibold disabled:opacity-40"
            >
              <Zap className="h-3.5 w-3.5" />
              Apply {matchCount > 0 ? `${matchCount} ` : ""}price update
              {matchCount !== 1 ? "s" : ""}
            </Button>
            <Button
              data-ocid="chat_price.clear_button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={!text && matchCount === 0}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
