import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Search } from "lucide-react";
import { useState } from "react";

export type SortOption = "profit" | "profitPerHour" | "skill" | "name";

interface FiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  minSkill: number;
  maxSkill: number;
  onSkillRangeChange: (min: number, max: number) => void;
  showOnlyPositive: boolean;
  onShowOnlyPositiveChange: (show: boolean) => void;
  topN: number;
  onTopNChange: (n: number) => void;
  // Optional harvest time filter (in hours, 0 = any)
  maxHarvestHours?: number;
  onMaxHarvestHoursChange?: (hours: number) => void;
  // Optional category filter (for All Items view)
  categoryFilter?: string;
  onCategoryFilterChange?: (category: string) => void;
}

export function Filters({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  minSkill,
  maxSkill,
  onSkillRangeChange,
  showOnlyPositive,
  onShowOnlyPositiveChange,
  topN,
  onTopNChange,
  maxHarvestHours,
  onMaxHarvestHoursChange,
  categoryFilter,
  onCategoryFilterChange,
}: FiltersProps) {
  const [skillRange, setSkillRange] = useState([minSkill, maxSkill]);

  const handleSkillRangeCommit = (values: number[]) => {
    onSkillRangeChange(values[0], values[1]);
  };

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Search
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-ocid="filters.search_input"
            type="text"
            placeholder="Item name..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-surface-2 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Sort By */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sort By
        </Label>
        <Select
          value={sortBy}
          onValueChange={(v) => onSortChange(v as SortOption)}
        >
          <SelectTrigger
            data-ocid="filters.sort_select"
            className="bg-surface-2 text-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="profit">Profit per Harvest</SelectItem>
            <SelectItem value="profitPerHour">Profit per Hour</SelectItem>
            <SelectItem value="skill">Skill Level</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Skill Range */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Skill Range
        </Label>
        <div className="px-1">
          <Slider
            min={1}
            max={100}
            step={1}
            value={skillRange}
            onValueChange={setSkillRange}
            onValueCommit={handleSkillRangeCommit}
          />
        </div>
        <div className="font-num flex justify-between text-xs text-muted-foreground">
          <span>{skillRange[0]}</span>
          <span>{skillRange[1]}</span>
        </div>
      </div>

      {/* Only Positive */}
      <div className="flex items-center justify-between">
        <Label htmlFor="only-positive" className="cursor-pointer text-sm">
          Only Positive Profit
        </Label>
        <Switch
          data-ocid="filters.positive_only_toggle"
          id="only-positive"
          checked={showOnlyPositive}
          onCheckedChange={onShowOnlyPositiveChange}
        />
      </div>

      {/* Show Top N */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Show
        </Label>
        <Select
          value={topN.toString()}
          onValueChange={(v) => onTopNChange(Number.parseInt(v))}
        >
          <SelectTrigger className="bg-surface-2 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 results</SelectItem>
            <SelectItem value="50">50 results</SelectItem>
            <SelectItem value="100">100 results</SelectItem>
            <SelectItem value="9999">All results</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Max Harvest Time (optional) */}
      {onMaxHarvestHoursChange !== undefined && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Max Harvest Time
          </Label>
          <Select
            value={(maxHarvestHours ?? 0).toString()}
            onValueChange={(v) => onMaxHarvestHoursChange(Number(v))}
          >
            <SelectTrigger
              data-ocid="filters.max_harvest_select"
              className="bg-surface-2 text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any time</SelectItem>
              <SelectItem value="1">Under 1 hour</SelectItem>
              <SelectItem value="2">Under 2 hours</SelectItem>
              <SelectItem value="6">Under 6 hours</SelectItem>
              <SelectItem value="12">Under 12 hours</SelectItem>
              <SelectItem value="24">Under 24 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Category Filter (optional, for All Items view) */}
      {onCategoryFilterChange !== undefined && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Category
          </Label>
          <Select
            value={categoryFilter ?? "all"}
            onValueChange={onCategoryFilterChange}
          >
            <SelectTrigger
              data-ocid="filters.category_select"
              className="bg-surface-2 text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Farming">Farming</SelectItem>
              <SelectItem value="Herbalism">Herbalism</SelectItem>
              <SelectItem value="Woodcutting">Woodcutting</SelectItem>
              <SelectItem value="Husbandry">Husbandry</SelectItem>
              <SelectItem value="Crafting">Crafting</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
