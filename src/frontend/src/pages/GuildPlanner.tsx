import type { GrowingClaim } from "@/backend";
import { CalculatorLayout } from "@/components/CalculatorLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useActor } from "@/hooks/useActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import {
  AlertTriangle,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Sprout,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Types & constants ────────────────────────────────────────────────────────

type Category = "All" | "Farming" | "Herbalism" | "Woodcutting" | "Husbandry";
type LandSize = "Small" | "Medium" | "Large" | "Stronghold" | "Fort";

const CATEGORIES: Category[] = [
  "All",
  "Farming",
  "Herbalism",
  "Woodcutting",
  "Husbandry",
];

const LAND_SIZES: LandSize[] = [
  "Small",
  "Medium",
  "Large",
  "Stronghold",
  "Fort",
];

const CATEGORY_COLORS: Record<string, string> = {
  Farming: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Herbalism: "bg-lime-500/15 text-lime-400 border-lime-500/30",
  Woodcutting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Husbandry: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const LAND_SIZE_COLORS: Record<string, string> = {
  Small: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  Medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Large: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  Stronghold: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Fort: "bg-red-500/15 text-red-400 border-red-500/30",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortPrincipal(principal: string): string {
  return principal.length > 8 ? `${principal.slice(0, 8)}…` : principal;
}

function timeAgo(timestampMs: number): string {
  const diff = Date.now() - timestampMs;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

/**
 * Derive a stable numeric hash from an item name string.
 * Used when free-text entry is needed and we don't have a known item ID.
 * The hash is deterministic per name, though collisions are theoretically
 * possible for very different names — good enough for guild coordination.
 */
function hashItemName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ClaimRow({
  claim,
  isOverlap,
  isOwn,
  index,
  onRemove,
}: {
  claim: GrowingClaim;
  isOverlap: boolean;
  isOwn: boolean;
  index: number;
  onRemove: (itemId: bigint) => void;
}) {
  const principal = claim.claimedBy.toText();
  const ts = Number(claim.claimedAt);
  // Backend may store timestamp in nanoseconds (ICP standard) or ms
  // If ts is > 1e15 it's likely nanoseconds, convert to ms
  const tsMs = ts > 1e15 ? Math.floor(ts / 1_000_000) : ts;

  return (
    <div
      data-ocid={`guild_planner.item.${index}`}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
        isOwn
          ? "border-violet-500/30 bg-violet-500/5"
          : "border-border bg-surface-1"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-foreground">{claim.itemName}</span>
          <Badge
            variant="outline"
            className={`border px-1.5 py-0 text-[10px] font-medium ${CATEGORY_COLORS[claim.category] ?? ""}`}
          >
            {claim.category}
          </Badge>
          <Badge
            variant="outline"
            className={`border px-1.5 py-0 text-[10px] font-medium ${LAND_SIZE_COLORS[claim.landSize] ?? ""}`}
          >
            {claim.landSize}
          </Badge>
          {isOverlap && (
            <Badge
              variant="outline"
              className="border border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-400"
            >
              <AlertTriangle className="mr-0.5 inline h-2.5 w-2.5" />
              Overlap
            </Badge>
          )}
          {isOwn && (
            <Badge
              variant="outline"
              className="border border-violet-500/40 bg-violet-500/10 px-1.5 py-0 text-[10px] font-medium text-violet-400"
            >
              You
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            Qty:{" "}
            <span className="font-num text-foreground">
              {Number(claim.quantity)}
            </span>
          </span>
          <span>
            By:{" "}
            <span className="font-mono text-foreground/80">
              {shortPrincipal(principal)}
            </span>
          </span>
          <span>{timeAgo(tsMs)}</span>
        </div>
      </div>
      {isOwn && (
        <Button
          data-ocid={`guild_planner.remove_claim_button.${index}`}
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(claim.itemId)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Add Claim Dialog ─────────────────────────────────────────────────────────

function AddClaimDialog({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const { actor } = useActor();
  const [open, setOpen] = useState(false);
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState<string>("Farming");
  const [landSize, setLandSize] = useState<string>("Medium");
  const [quantity, setQuantity] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !itemName.trim()) return;

    const qty = Number.parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    setIsSubmitting(true);
    try {
      // Derive a stable numeric ID from the item name
      const itemId = BigInt(hashItemName(itemName.trim()));
      await actor.setClaim(
        itemId,
        itemName.trim(),
        category,
        landSize,
        BigInt(qty),
      );
      toast.success(`Added claim for ${itemName}`);
      setOpen(false);
      setItemName("");
      setQuantity("1");
      onSuccess();
    } catch {
      toast.error("Failed to add claim. Are you logged in?");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          data-ocid="guild_planner.add_claim_button"
          size="sm"
          className="gap-2 bg-violet-600 text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" />
          Add My Claim
        </Button>
      </DialogTrigger>
      <DialogContent
        data-ocid="guild_planner.add_claim_dialog"
        className="bg-surface-1 sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Add Growing Claim</DialogTitle>
          <DialogDescription>
            Tell your guild what you're growing to avoid duplicates.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="claim-item">Item name</Label>
            <Input
              id="claim-item"
              data-ocid="guild_planner.claim_item_input"
              placeholder="e.g. Potatoes, Cotton, Oak…"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="bg-surface-2"
              required
            />
            <p className="text-xs text-muted-foreground">
              Type the exact item name from RavenQuest.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="claim-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger
                id="claim-category"
                data-ocid="guild_planner.claim_category_select"
                className="bg-surface-2"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="claim-land-size">Land size</Label>
            <Select value={landSize} onValueChange={setLandSize}>
              <SelectTrigger
                id="claim-land-size"
                data-ocid="guild_planner.claim_land_size_select"
                className="bg-surface-2"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAND_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="claim-quantity">Quantity (plots / pens)</Label>
            <Input
              id="claim-quantity"
              data-ocid="guild_planner.claim_quantity_input"
              type="number"
              min="1"
              max="9999"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-surface-2"
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-ocid="guild_planner.claim_cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-ocid="guild_planner.claim_submit_button"
              disabled={isSubmitting || !itemName.trim()}
              className="bg-violet-600 text-white hover:bg-violet-500"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Add Claim
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main GuildPlanner page ───────────────────────────────────────────────────

export function GuildPlanner() {
  const { actor, isFetching: actorLoading } = useActor();
  const { identity, isLoginSuccess } = useInternetIdentity();
  const isLoggedIn = isLoginSuccess && !!identity;

  const [claims, setClaims] = useState<GrowingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const myPrincipal = identity?.getPrincipal().toText() ?? null;

  const fetchClaims = useCallback(async () => {
    if (!actor) return;
    setLoading(true);
    setError(null);
    try {
      const data = await actor.getClaims();
      setClaims(data);
    } catch {
      setError("Failed to load guild claims. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    if (actor && !actorLoading) {
      void fetchClaims();
    }
  }, [actor, actorLoading, fetchClaims]);

  const handleRemoveClaim = async (itemId: bigint) => {
    if (!actor) return;
    try {
      await actor.removeClaim(itemId);
      toast.success("Claim removed");
      await fetchClaims();
    } catch {
      toast.error("Failed to remove claim");
    }
  };

  // Detect overlaps: items claimed by 2+ different users
  const overlapItemIds = useMemo(() => {
    const itemUsers: Record<string, Set<string>> = {};
    for (const claim of claims) {
      const key = claim.itemId.toString();
      if (!itemUsers[key]) itemUsers[key] = new Set();
      itemUsers[key].add(claim.claimedBy.toText());
    }
    return new Set(
      Object.entries(itemUsers)
        .filter(([, users]) => users.size > 1)
        .map(([key]) => key),
    );
  }, [claims]);

  // Filter claims
  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      if (
        searchTerm &&
        !c.itemName.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      if (selectedCategory !== "All" && c.category !== selectedCategory) {
        return false;
      }
      if (showOnlyMine && myPrincipal && c.claimedBy.toText() !== myPrincipal) {
        return false;
      }
      return true;
    });
  }, [claims, searchTerm, selectedCategory, showOnlyMine, myPrincipal]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, GrowingClaim[]> = {};
    for (const claim of filteredClaims) {
      if (!groups[claim.category]) groups[claim.category] = [];
      groups[claim.category].push(claim);
    }
    return groups;
  }, [filteredClaims]);

  // Summary stats
  const totalClaims = claims.length;
  const overlapCount = overlapItemIds.size;
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of claims) {
      counts[c.category] = (counts[c.category] ?? 0) + 1;
    }
    return counts;
  }, [claims]);

  // ── Left filters ──────────────────────────────────────────────────────────

  const filtersPanel = (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Search
        </Label>
        <div className="relative">
          <Input
            placeholder="Item name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-surface-2 pl-3 text-sm"
          />
        </div>
      </div>

      <div>
        <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Category
        </Label>
        <div className="flex flex-col gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                selectedCategory === cat
                  ? "bg-violet-500/20 text-violet-300"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {cat}
              {cat !== "All" && categoryCounts[cat] ? (
                <span className="ml-auto float-right text-xs opacity-60">
                  {categoryCounts[cat]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {isLoggedIn && (
        <div>
          <Separator className="mb-3" />
          <div className="flex items-center gap-2">
            <Switch
              id="show-mine"
              checked={showOnlyMine}
              onCheckedChange={setShowOnlyMine}
            />
            <Label htmlFor="show-mine" className="cursor-pointer text-sm">
              My claims only
            </Label>
          </div>
        </div>
      )}
    </div>
  );

  // ── Center: claims board ──────────────────────────────────────────────────

  const claimsBoard = (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Guild Planner
          </h2>
          <p className="text-sm text-muted-foreground">
            See what your guild is growing to avoid duplicates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-ocid="guild_planner.refresh_button"
            variant="outline"
            size="sm"
            className="gap-1.5 bg-surface-2 text-xs"
            onClick={() => void fetchClaims()}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {isLoggedIn && (
            <AddClaimDialog onSuccess={() => void fetchClaims()} />
          )}
        </div>
      </div>

      {/* Not logged in banner */}
      {!isLoggedIn && (
        <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-300">
          <Info className="h-4 w-4 shrink-0" />
          Login with Internet Identity to add your own growing claims.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          data-ocid="guild_planner.loading_state"
          className="flex items-center justify-center py-16"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          data-ocid="guild_planner.error_state"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredClaims.length === 0 && (
        <div
          data-ocid="guild_planner.empty_state"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface-1 py-16 text-center"
        >
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-muted-foreground">
              {claims.length === 0
                ? "No guild members have added growing claims yet."
                : "No claims match your filters."}
            </p>
            {isLoggedIn && claims.length === 0 && (
              <p className="mt-1 text-sm text-muted-foreground/60">
                Be the first — add a claim above.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Claims grouped by category */}
      {!loading && !error && filteredClaims.length > 0 && (
        <ScrollArea className="max-h-[calc(100vh-320px)] pr-1">
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, catClaims]) => (
              <div key={cat}>
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {cat}
                  </h3>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
                    {catClaims.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {catClaims.map((claim, idx) => (
                    <ClaimRow
                      key={`${claim.itemId}-${claim.claimedBy.toText()}`}
                      claim={claim}
                      isOverlap={overlapItemIds.has(claim.itemId.toString())}
                      isOwn={
                        !!myPrincipal &&
                        claim.claimedBy.toText() === myPrincipal
                      }
                      index={idx + 1}
                      onRemove={(id) => void handleRemoveClaim(id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  // ── Right: Summary panel ──────────────────────────────────────────────────

  const summaryPanel = (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sprout className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-semibold text-foreground">
          Guild Overview
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
        <p className="text-xs text-muted-foreground">Total claims</p>
        <p className="font-num text-2xl font-bold text-foreground">
          {totalClaims}
        </p>
      </div>

      {overlapCount > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-xs text-amber-400">Items with overlap</p>
          <p className="font-num text-2xl font-bold text-amber-400">
            {overlapCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Multiple members growing the same thing
          </p>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          By category
        </p>
        {Object.entries(categoryCounts).length === 0 ? (
          <p className="text-xs text-muted-foreground">No claims yet</p>
        ) : (
          Object.entries(categoryCounts).map(([cat, count]) => (
            <div key={cat} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{cat}</span>
              <Badge
                variant="outline"
                className={`border px-1.5 py-0 text-[10px] font-medium ${CATEGORY_COLORS[cat] ?? ""}`}
              >
                {count}
              </Badge>
            </div>
          ))
        )}
      </div>

      <Separator />

      <Button
        data-ocid="guild_planner.refresh_button"
        variant="outline"
        size="sm"
        className="w-full gap-2 bg-surface-2 text-xs"
        onClick={() => void fetchClaims()}
        disabled={loading}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        Refresh Claims
      </Button>
    </div>
  );

  return (
    <CalculatorLayout
      filters={filtersPanel}
      results={claimsBoard}
      summary={summaryPanel}
    />
  );
}
