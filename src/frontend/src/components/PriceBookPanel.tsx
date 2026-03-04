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
import { usePriceBookStore } from "@/lib/priceBook/store";
import type { PriceBook } from "@/lib/priceBook/types";
import {
  Check,
  Download,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
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
  } = usePriceBookStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

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
    // Reset so same file can be imported again
    if (importRef.current) importRef.current.value = "";
  };

  const handleClearAll = () => {
    if (window.confirm("Clear all prices? This cannot be undone.")) {
      clearAll();
      toast.success("All prices cleared");
    }
  };

  const startEdit = (id: number, currentPrice: number) => {
    setEditingId(id);
    setEditingValue(currentPrice.toString());
  };

  const saveEdit = (id: number, itemName: string) => {
    const parsed = Number.parseFloat(editingValue);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setPrice(id, itemName, parsed);
      setEditingId(null);
      toast.success(`Updated price for ${itemName}`);
    } else {
      toast.error("Enter a valid price (≥ 0)");
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    id: number,
    itemName: string,
  ) => {
    if (e.key === "Enter") saveEdit(id, itemName);
    if (e.key === "Escape") setEditingId(null);
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
        </SheetHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
          <div className="relative flex-1 min-w-40">
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
            onClick={() => importRef.current?.click()}
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
            onClick={handleClearAll}
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
                <TableHead className="text-right text-xs">Price</TableHead>
                <TableHead className="text-right text-xs">Updated</TableHead>
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
                    <TableCell className="py-2 font-medium text-sm">
                      {entry.itemName}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      {editingId === entry.itemId ? (
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
                          onBlur={() => saveEdit(entry.itemId, entry.itemName)}
                          className="h-7 w-24 bg-surface-2 text-right font-mono text-xs"
                        />
                      ) : (
                        <span className="font-num text-sm">
                          {entry.price.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs text-muted-foreground">
                      {new Date(entry.lastUpdated).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {editingId === entry.itemId ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() =>
                              saveEdit(entry.itemId, entry.itemName)
                            }
                          >
                            <Check className="h-3.5 w-3.5 text-profit" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => startEdit(entry.itemId, entry.price)}
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            clearPrice(entry.itemId);
                            toast.success(`Removed ${entry.itemName}`);
                          }}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
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
