import { BuildingData, Category, categoryNames, themes } from "@/lib/theme-data.ts";
import { buildingMatchesStringSearchTerm } from "@/lib/utils.ts";
import { atom } from "jotai/index";
import { atomWithStorage } from "jotai/utils";

/**
 * The query parameters stored in localStorage.
 * These are used to check if the url contains search parameters that affect the buildings shown.
 * If these are present, the page will not restore the previous selections from localStorage.
 */
export const LOCALSTORAGE_QUERY_PARAMS = {
    search: "search",
    theme: "theme",
    category: "category",
};

/**
 * The latest URL search parameters are stored in localStorage.
 * This is used to restore the selections when the page is reloaded if no search parameters are present.
 */
let initialUrlSearchParams = new URL(window.location.href).searchParams;
const hasInitialUrlRelevantParams = [...initialUrlSearchParams.keys()].some(
    key => key in LOCALSTORAGE_QUERY_PARAMS,
);
if (initialUrlSearchParams.size === 0 && !hasInitialUrlRelevantParams) {
    initialUrlSearchParams = new URLSearchParams(localStorage.getItem("lastUrlParams") || "");
}

/** The currently expanded building, or null if none are expanded. */
export const expandedBuildingAtom = atom<BuildingData | null>(null);

/** Whether to only search from the selected themes. */
export const searchSelectedThemesOnlyAtom = atomWithStorage<boolean>(
    "searchSelectionsOnly",
    false,
    undefined,
    {
        getOnInit: true,
    },
);

/** The search term for filtering buildings. Also updates the URL on write. */
export const searchTermAtom = atom<string>(
    new URLSearchParams(window.location.search).get(LOCALSTORAGE_QUERY_PARAMS.search) || "",
);
export const writeSearchTermAtom = atom(null, (_get, set, searchTerm: string) => {
    const url = new URL(window.location.href);
    if (searchTerm) {
        url.searchParams.set(LOCALSTORAGE_QUERY_PARAMS.search, searchTerm);
    } else {
        url.searchParams.delete(LOCALSTORAGE_QUERY_PARAMS.search);
    }
    window.history.replaceState({}, "", url.toString());
    set(searchTermAtom, searchTerm);
});

/** Whether to show favorite buildings at the top of the page. */
export const showFavoritesAtom = atomWithStorage<boolean>("showFavorites", true, undefined, {
    getOnInit: true,
});
/** Locally stored paths of favorite buildings. */
export const favoritePaths = atomWithStorage<string[]>("favorites", [], undefined, { getOnInit: true });
export const favoritesPathsWriteAtom = atom(
    get => new Set(get(favoritePaths)),
    (get, set, path: string) => {
        const favorites = get(favoritePaths);
        if (favorites.includes(path)) {
            set(
                favoritePaths,
                favorites.filter(favorite => favorite !== path),
            );
            return false;
        } else {
            set(favoritePaths, [...favorites, path]);
            return true;
        }
    },
);
/** Atom which reads paths of favorite buildings and returns the actual building objects. */
export const favoriteBuildingsAtom = atom(get => {
    const paths = get(favoritePaths);
    return paths.map(path => {
        const pathParts = path.split(">");

        const categories = pathParts.slice(1, -1);
        const theme = pathParts[0];
        const name = pathParts.at(-1)!;

        let categoryLevel: Category = themes.get(theme)!;
        for (const category of categories) {
            categoryLevel = categoryLevel.categories.get(category)!;
        }
        return categoryLevel.blueprints.get(name)!;
    });
});

/** Defines the separator used in the URL for selections. */
const selectionUrlSeparator = "-";

/**
 * Parse the selected themes from the URL search parameters.
 * Param can either be "all" or a list of theme names separated by the selectionUrlSeparator.
 */
function parseThemesFromUrlParams(urlSearchParams: URLSearchParams) {
    const selectedThemes = new Set<string>();
    const themeParams = urlSearchParams.get(LOCALSTORAGE_QUERY_PARAMS.theme);
    if (themeParams === "all") {
        return new Set(themes.keys());
    }
    if (themeParams) {
        const paramThemeParts = themeParams.split(selectionUrlSeparator);
        for (const theme of paramThemeParts) {
            if (themes.has(theme)) {
                selectedThemes.add(theme);
            }
        }
    }
    return selectedThemes;
}

/**
 * Encode the selected themes into the URL search parameters.
 * If all themes are selected, returns "all".
 */
function encodeThemesToUrlParameter(selectedThemes: Set<string>) {
    if (selectedThemes.size === themes.size) return "all";
    return encodeURIComponent([...selectedThemes].join(selectionUrlSeparator));
}

/**
 * Parse the selected categories from the URL search parameters.
 */
function parseCategoriesFromUrlParams(urlSearchParams: URLSearchParams) {
    const categoryParams = urlSearchParams.get(LOCALSTORAGE_QUERY_PARAMS.category);
    const selectedCategories = new Set<string>();
    if (categoryParams) {
        const paramCategoryParts = categoryParams.split(selectionUrlSeparator);
        for (const categoryPart of paramCategoryParts) {
            for (const actualCategory of categoryNames) {
                if (actualCategory.startsWith(categoryPart)) {
                    selectedCategories.add(actualCategory);
                }
            }
        }
    }
    return selectedCategories;
}

/**
 * Encode the selected categories into the URL search parameters.
 * If all categories are selected, returns null.
 */
function encodeCategoriesToUrl(categories: Set<string>) {
    if (categories.size === categoryNames.size) return null;
    return encodeURIComponent(
        [...categories].map(category => category.slice(0, 4)).join(selectionUrlSeparator),
    );
}

/** Crafts a URL with the current selections encoded. */
function encodeSelectionsToUrl(selectedThemes: Set<string>, selectedCategories: Set<string>) {
    const url = new URL(window.location.href);
    const encodedThemes = encodeThemesToUrlParameter(selectedThemes);
    if (!encodedThemes) {
        url.searchParams.delete(LOCALSTORAGE_QUERY_PARAMS.theme);
        url.searchParams.delete(LOCALSTORAGE_QUERY_PARAMS.category);
        return url;
    }

    const encodedCategories = encodeCategoriesToUrl(selectedCategories);
    if (encodedCategories) {
        url.searchParams.set(LOCALSTORAGE_QUERY_PARAMS.category, encodedCategories);
    } else {
        url.searchParams.delete(LOCALSTORAGE_QUERY_PARAMS.category);
    }

    url.searchParams.set(LOCALSTORAGE_QUERY_PARAMS.theme, encodedThemes);
    return url;
}

export const selectedThemesAtom = atom<Set<string>>(parseThemesFromUrlParams(initialUrlSearchParams));
export const selectedCategoriesAtom = atom<Set<string>>(parseCategoriesFromUrlParams(initialUrlSearchParams));

/**
 * Iterates over all themes and categories to gather all buildings that match the search term
 * and/or are part of the selected themes and categories.
 *
 * This organizes the buildings into a structure that can be easily rendered.
 */
export const pageContentAtom = atom(get => {
    const selectedThemes = get(selectedThemesAtom);
    const selectedCategories = get(selectedCategoriesAtom);

    const searchTerm = get(searchTermAtom);
    const searchSelectedThemesOnly = get(searchSelectedThemesOnlyAtom);

    const isRegex = !/^[\d\sA-Za-zäåö]*$/.test(searchTerm);
    const bakedSearchTerm = isRegex ? new RegExp(searchTerm, "i") : searchTerm;
    const buildingMatchesSearchTerm =
        bakedSearchTerm instanceof RegExp
            ? (building: BuildingData) => bakedSearchTerm.test(building.searchString)
            : (building: BuildingData) => buildingMatchesStringSearchTerm(searchTerm, building);

    const url = encodeSelectionsToUrl(selectedThemes, selectedCategories);
    window.history.replaceState({}, "", url);
    localStorage.setItem("lastUrlParams", url.searchParams.toString());

    let totalBuildingsFound = 0;

    function recursivelyGatherAllBuildings(category: Category, results: BuildingData[]) {
        for (const building of category.blueprints.values()) {
            if (!buildingMatchesSearchTerm(building)) continue;
            results.push(building);
            totalBuildingsFound++;
        }
        for (const subcategory of category.categories.values()) {
            recursivelyGatherAllBuildings(subcategory, results);
        }
    }

    type PageBuildingsSection = { blueprints: BuildingData[]; categories: Map<string, BuildingData[]> };

    // Root buildings of all themes come first:
    const rootBuildings: BuildingData[] = [];
    const categories = new Map<string, PageBuildingsSection>();
    if (!searchTerm && selectedThemes.size === 0) {
        return { rootBuildings, categories, totalBuildingsFound };
    }

    for (const [themeName, theme] of themes.entries()) {
        if (searchTerm) {
            if (searchSelectedThemesOnly && !selectedThemes.has(themeName)) {
                continue;
            }
        } else if (!selectedThemes.has(themeName)) {
            continue;
        }

        for (const building of theme.blueprints.values()) {
            if (!buildingMatchesSearchTerm(building)) continue;
            rootBuildings.push(building);
            totalBuildingsFound++;
        }

        for (const [categoryName, categoryData] of theme.categories.entries()) {
            if (!searchTerm && selectedCategories.size > 0 && !selectedCategories.has(categoryName)) {
                continue;
            }

            if (!categories.has(categoryName)) {
                categories.set(categoryName, { blueprints: [], categories: new Map() });
            }
            const section = categories.get(categoryName)!;

            for (const building of categoryData.blueprints.values()) {
                if (!buildingMatchesSearchTerm(building)) continue;
                section.blueprints.push(building);
                totalBuildingsFound++;
            }

            for (const [subcategoryName, subcategoryData] of categoryData.categories.entries()) {
                if (!section.categories.has(subcategoryName)) {
                    section.categories.set(subcategoryName, []);
                }
                const subcategoryBuildingList = section.categories.get(subcategoryName)!;

                recursivelyGatherAllBuildings(subcategoryData, subcategoryBuildingList);
            }
        }
    }

    return { rootBuildings, categories, totalBuildingsFound };
});
