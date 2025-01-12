import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { searchSelectedThemesOnlyAtom, searchTermAtom, writeSearchTermAtom } from "@/lib/state-atoms.ts";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Search, X } from "lucide-react";

export function SearchBar() {
    const [searchSelectedThemesOnly, setSearchSelectedThemesOnly] = useAtom(searchSelectedThemesOnlyAtom);
    const searchTerm = useAtomValue(searchTermAtom);
    const writeSearchTerm = useSetAtom(writeSearchTermAtom);

    return (
        <div className="px-2">
            <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                <X
                    onClick={() => writeSearchTerm("")}
                    className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground"
                />
                <Input
                    type="search"
                    placeholder="Search buildings..."
                    aria-label="Search buildings"
                    className="pl-8"
                    value={searchTerm}
                    onChange={e => writeSearchTerm(e.target.value.slice(0, 30))}
                />
            </div>
            <div className="mt-2 flex items-center space-x-2">
                <Switch
                    checked={searchSelectedThemesOnly}
                    onCheckedChange={setSearchSelectedThemesOnly}
                    id="search-selected-themes-only"
                />
                <Label htmlFor="search-selected-themes-only">Search only from selected styles</Label>
            </div>
        </div>
    );
}
