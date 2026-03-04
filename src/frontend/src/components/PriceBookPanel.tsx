import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActor } from "@/hooks/useActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePriceBookStore } from "@/lib/priceBook/store";
import type { PriceBook } from "@/lib/priceBook/types";
import {
  Check,
  Download,
  Info,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface PriceBookPanelProps {
  open: boolean;
  onClose: () => void;
}

export function PriceBookPanel({ open, onClose }: PriceBookPanelProps) {
  const {
    priceBook,
    setPrice,
    clearPrice,
    clearAll,
    exportPrices,
    importPrices,
    guildMode,
    lastSyncAt,
    syncStatus,
    setGuildMode,
    syncFromBackend,
  } = usePriceBookStore();

  const { actor } = useActor();
  const { isAdmin } = useIsAdmin();
  const { login } = useInternetIdentity();

  // In guild mode, only admin can edit
  const isReadOnly = guildMode && !isAdmin;

  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [attributions, setAttributions] = useState<Record<number, string>>({});
  const importRef = useRef<HTMLInputElement>(null);

  // Load attributions when guild mode is active or after a sync
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastSyncAt is intentionally used to re-fetch after sync
  useEffect(() => {
    if (guildMode && actor) {
      actor
        .getAttributions()
        .then((entries) => {
          const map: Record<number, string> = {};
          for (const [id, principal] of entries) {
            map[Number(id)] = principal;
          }
          setAttributions(map);
        })
        .catch(() => {
          // Silently fail - attributions are bonus info
        });
    }
  }, [guildMode, actor, lastSyncAt]);

  const entries = Object.values(priceBook)
    .filter((e) =>
      searchTerm
        ? e.itemName.toLowerCase().includes(searchTerm.toLowerCase())
        : true,
    )
    .sort((a, b) => a.itemName.localeCompare(b.itemName));

  const totalCount = Object.keys(priceBook).length;

  const handleExport = () => {
    const data = exportPrices();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ravenquest-prices.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Price Book exported");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as PriceBook;
        importPrices(parsed);
        toast.success("Price Book imported");
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    if (importRef.current) importRef.current.value = "";
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all prices? This cannot be undone.")) return;
    clearAll();
    if (guildMode && actor) {
      try {
        await actor.clearAll();
        toast.success("All prices cleared (local + guild)");
      } catch {
        toast.error("Local cleared but guild sync failed");
      }
    } else {
      toast.success("All prices cleared");
    }
  };

  const startEdit = (id: number, currentPrice: number) => {
    setEditingId(id);
    setEditingValue(currentPrice.toString());
  };

  const saveEdit = async (id: number, itemName: string) => {
    const parsed = Number.parseFloat(editingValue);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setPrice(id, itemName, parsed);
      setEditingId(null);
      if (guildMode && actor) {
        try {
          await actor.setPrice(BigInt(id), itemName, parsed);
          toast.success(`Updated price for ${itemName} (synced to guild)`);
        } catch {
          toast.success(`Updated price for ${itemName} (guild sync failed)`);
        }
      } else {
        toast.success(`Updated price for ${itemName}`);
      }
    } else {
      toast.error("Enter a valid price (≥ 0)");
    }
  };

  const handleClearOne = async (itemId: number, itemName: string) => {
    clearPrice(itemId);
    if (guildMode && actor) {
      try {
        await actor.clearPrice(BigInt(itemId));
        toast.success(`Removed ${itemName} (synced to guild)`);
      } catch {
        toast.success(`Removed ${itemName} (guild sync failed)`);
      }
    } else {
      toast.success(`Removed ${itemName}`);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    id: number,
    itemName: string,
  ) => {
    if (e.key === "Enter") void saveEdit(id, itemName);
    if (e.key === "Escape") setEditingId(null);
  };

  const handleSyncNow = () => {
    if (!actor) return;
    void syncFromBackend(actor).then(() => {
      toast.success("Synced from guild");
      if (actor) {
        actor
          .getAttributions()
          .then((entries) => {
            const map: Record<number, string> = {};
            for (const [id, principal] of entries) {
              map[Number(id)] = principal;
            }
            setAttributions(map);
          })
          .catch(() => {});
      }
    });
  };

  const formatSyncTime = () => {
    if (!lastSyncAt) return "Never synced";
    const diff = Date.now() - lastSyncAt;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Synced just now";
    if (mins === 1) return "Synced 1 min ago";
    return `Synced ${mins} mins ago`;
  };

  const handleToggleGuildMode = (toGuild: boolean) => {
    setGuildMode(toGuild, actor);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        data-ocid="price_book.panel"
        side="right"
        className="flex w-full max-w-lg flex-col gap-0 bg-surface-1 p-0"
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-gold">Price Book</SheetTitle>
              <SheetDescription>
                {totalCount} item{totalCount !== 1 ? "s" : ""} with prices set
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-ocid="price_book.close_button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Guild / Local toggle */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className="flex rounded-lg border border-border bg-surface-2 p-0.5"
              data-ocid="price_book.guild_toggle"
            >
              <button
                type="button"
                onClick={() => handleToggleGuildMode(false)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  !guildMode
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Local
              </button>
              <button
                type="button"
                onClick={() => handleToggleGuildMode(true)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  guildMode
                    ? "bg-violet-500/20 text-violet-300"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Guild (Shared)
                {guildMode && isReadOnly && (
                  <span className="inline-flex items-center gap-0.5 rounded border border-orange-500/40 bg-orange-500/15 px-1 py-0.5 text-[9px] font-semibold text-orange-300 leading-none">
                    <Lock className="h-2.5 w-2.5" />
                    Read-only
                  </span>
                )}
              </button>
            </div>

            {guildMode && (
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {syncStatus === "syncing" ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Syncing…
                    </span>
                  ) : syncStatus === "error" ? (
                    <span className="text-destructive">Sync failed</span>
                  ) : (
                    formatSyncTime()
                  )}
                </span>
                <Button
                  data-ocid="price_book.sync_button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 bg-surface-2 text-xs"
                  onClick={handleSyncNow}
                  disabled={syncStatus === "syncing" || !actor}
                >
                  <RefreshCw
                    className={`h-3 w-3 ${syncStatus === "syncing" ? "animate-spin" : ""}`}
                  />
                  Sync Now
                </Button>
              </div>
            )}
          </div>

          {/* Guild mode info */}
          {guildMode && !isReadOnly && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-300">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Prices synced and shared with the entire guild.
            </div>
          )}

          {/* Read-only banner for non-admin guild mode */}
          {isReadOnly && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-300">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">
                Prices are managed by the guild admin. Log in as admin to edit.
              </span>
              <Button
                data-ocid="price_book.login_button"
                variant="outline"
                size="sm"
                className="h-6 gap-1 border-orange-500/30 bg-orange-500/10 px-2 text-[11px] text-orange-300 hover:bg-orange-500/20"
                onClick={login}
              >
                Log in
              </Button>
            </div>
          )}
        </SheetHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
          <div className="relative min-w-40 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 bg-surface-2 pl-8 text-sm"
            />
          </div>
          <Button
            data-ocid="price_book.export_button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-1.5 bg-surface-2 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button
            data-ocid="price_book.import_button"
            variant="outline"
            size="sm"
            className="gap-1.5 bg-surface-2 text-xs"
            onClick={() => !isReadOnly && importRef.current?.click()}
            disabled={isReadOnly}
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            data-ocid="price_book.clear_all_button"
            variant="destructive"
            size="sm"
            onClick={() => !isReadOnly && void handleClearAll()}
            disabled={isReadOnly}
            className="gap-1.5 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </Button>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs">Item</TableHead>
                <TableHead className="text-right text-xs">Price (s)</TableHead>
                {guildMode ? (
                  <TableHead className="text-right text-xs">
                    Last updated by
                  </TableHead>
                ) : (
                  <TableHead className="text-right text-xs">Updated</TableHead>
                )}
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    {totalCount === 0
                      ? "No prices set yet. Expand an item row in the calculators to set prices inline."
                      : "No items match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.itemId} className="border-border">
                    <TableCell className="py-2 text-sm font-medium">
                      {entry.itemName}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      {!isReadOnly && editingId === entry.itemId ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingValue}
                          autoFocus
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) =>
                            handleKeyDown(e, entry.itemId, entry.itemName)
                          }
                          onBlur={() =>
                            void saveEdit(entry.itemId, entry.itemName)
                          }
                          className="h-7 w-24 bg-surface-2 text-right font-mono text-xs"
                        />
                      ) : (
                        <span className="font-num text-sm">
                          {entry.price.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}
                          <span className="ml-0.5 text-xs text-muted-foreground">
                            s
                          </span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs text-muted-foreground">
                      {guildMode
                        ? attributions[entry.itemId]
                          ? `${attributions[entry.itemId].slice(0, 8)}…`
                          : "—"
                        : new Date(entry.lastUpdated).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      {isReadOnly ? (
                        <Lock className="ml-auto h-3 w-3 text-muted-foreground/40" />
                      ) : (
                        <div className="flex justify-end gap-1">
                          {editingId === entry.itemId ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() =>
                                void saveEdit(entry.itemId, entry.itemName)
                              }
                            >
                              <Check className="h-3.5 w-3.5 text-profit" />
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() =>
                                startEdit(entry.itemId, entry.price)
                              }
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() =>
                              void handleClearOne(entry.itemId, entry.itemName)
                            }
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
