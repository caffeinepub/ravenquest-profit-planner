import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

export type SortOption = "profit" | "margin" | "profitPerTime" | "skill";

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
  categories?: string[];
  selectedCategories?: string[];
  onCategoryToggle?: (category: string) => void;
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
  categories,
  selectedCategories,
  onCategoryToggle,
}: FiltersProps) {
  const [skillRange, setSkillRange] = useState([minSkill, maxSkill]);

  const handleSkillRangeCommit = (values: number[]) => {
    onSkillRangeChange(values[0], values[1]);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <Label htmlFor="search" className="text-sm">
          Search
        </Label>
        <Input
          id="search"
          type="text"
          placeholder="Item name..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="mt-1"
        />
      </div>

      {/* Sort By */}
      <div>
        <Label htmlFor="sort" className="text-sm">
          Sort By
        </Label>
        <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
          <SelectTrigger id="sort" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="profit">Profit</SelectItem>
            <SelectItem value="margin">Margin %</SelectItem>
            <SelectItem value="profitPerTime">Profit/Hour</SelectItem>
            <SelectItem value="skill">Skill Level</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Skill Range */}
      <div>
        <Label className="text-sm">
          Skill Range: {skillRange[0]} - {skillRange[1]}
        </Label>
        <Slider
          min={1}
          max={100}
          step={1}
          value={skillRange}
          onValueChange={setSkillRange}
          onValueCommit={handleSkillRangeCommit}
          className="mt-2"
        />
      </div>

      {/* Show Only Positive */}
      <div className="flex items-center justify-between">
        <Label htmlFor="only-positive" className="text-sm">
          Only Positive Profit
        </Label>
        <Switch
          id="only-positive"
          checked={showOnlyPositive}
          onCheckedChange={onShowOnlyPositiveChange}
        />
      </div>

      {/* Top N */}
      <div>
        <Label htmlFor="top-n" className="text-sm">
          Show Top
        </Label>
        <Select value={topN.toString()} onValueChange={(v) => onTopNChange(parseInt(v))}>
          <SelectTrigger id="top-n" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 Results</SelectItem>
            <SelectItem value="25">25 Results</SelectItem>
            <SelectItem value="50">50 Results</SelectItem>
            <SelectItem value="100">100 Results</SelectItem>
            <SelectItem value="9999">All Results</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Categories (optional) */}
      {categories && categories.length > 0 && (
        <div>
          <Label className="mb-2 text-sm">Categories</Label>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat} className="flex items-center gap-2">
                <Switch
                  id={`cat-${cat}`}
                  checked={selectedCategories?.includes(cat) ?? true}
                  onCheckedChange={() => onCategoryToggle?.(cat)}
                />
                <Label htmlFor={`cat-${cat}`} className="text-sm">
                  {cat}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
