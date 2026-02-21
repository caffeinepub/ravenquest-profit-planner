import { useState } from "react";
import { Download, Upload, Trash2, DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePriceBookStore } from "@/lib/priceBook/store";
import { toast } from "sonner";

interface PriceBookDialogProps {
  trigger?: React.ReactNode;
}

export function PriceBookDialog({ trigger }: PriceBookDialogProps) {
  const { priceBook, setPrice, clearPrice, clearAll, exportPrices, importPrices } =
    usePriceBookStore();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState("");

  const entries = Object.values(priceBook).sort((a, b) =>
    a.itemName.localeCompare(b.itemName),
  );

  const handleExport = () => {
    const dataStr = JSON.stringify(priceBook, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ravenquest-prices.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Price Book exported successfully");
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        importPrices(imported);
        toast.success("Price Book imported successfully");
      } catch (error) {
        toast.error("Failed to import Price Book. Invalid JSON format.");
      }
    };
    reader.readAsText(file);
  };

  const handleEdit = (itemId: number, currentPrice: number) => {
    setEditingId(itemId);
    setEditingPrice(currentPrice.toString());
  };

  const handleSaveEdit = (itemId: number, itemName: string) => {
    const price = parseFloat(editingPrice);
    if (!isNaN(price) && price >= 0) {
      setPrice(itemId, itemName, price);
      setEditingId(null);
      toast.success(`Updated price for ${itemName}`);
    } else {
      toast.error("Invalid price value");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingPrice("");
  };

  const handleDelete = (itemId: number, itemName: string) => {
    clearPrice(itemId);
    toast.success(`Removed price for ${itemName}`);
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all prices?")) {
      clearAll();
      toast.success("All prices cleared");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Price Book
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Price Book</DialogTitle>
          <DialogDescription>
            Manage item prices for profit calculations. Import/export your price
            data or edit individual prices.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <label htmlFor="import-file">
              <Upload className="h-4 w-4" />
              Import JSON
              <input
                id="import-file"
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </Button>
          <Button
            onClick={handleClearAll}
            variant="destructive"
            size="sm"
            className="ml-auto gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </Button>
        </div>

        <ScrollArea className="h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No prices set. Start by viewing items in the calculators.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.itemId}>
                    <TableCell className="font-medium">{entry.itemName}</TableCell>
                    <TableCell>
                      {editingId === entry.itemId ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingPrice}
                          onChange={(e) => setEditingPrice(e.target.value)}
                          className="w-32"
                        />
                      ) : (
                        <span className="font-mono">{entry.price.toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === entry.itemId ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(entry.itemId, entry.itemName)}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(entry.itemId, entry.price)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(entry.itemId, entry.itemName)}
                          >
                            Delete
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

        <DialogFooter>
          <p className="text-xs text-muted-foreground">
            {entries.length} item{entries.length !== 1 ? "s" : ""} with prices
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
