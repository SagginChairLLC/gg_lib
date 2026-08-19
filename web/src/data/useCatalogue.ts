import { create } from 'zustand';
import { fetchNui, isEnvBrowser } from '@/lib/fetchNui';

export type CatalogueItem = {
    name: string;
    label: string;
    weight: number;
    description?: string;
    image?: string;
    stack?: boolean;
};

export type CatalogueVehicle = {
    model: string;
    label: string;
    brand?: string;
    price?: number;
    category?: string;
};

type CatalogueState = {
    items: CatalogueItem[];
    vehicles: CatalogueVehicle[];
    canGive: boolean;
    /** The owner's own icon path, empty when the bridge's own is in use. */
    imageUrl: string;
    wired: { framework?: string; inventory?: string };
    loaded: boolean;
    busy: boolean;
    error: string | null;
};

export const useCatalogue = create<CatalogueState>(() => ({
    items: [],
    vehicles: [],
    canGive: false,
    imageUrl: '',
    wired: {},
    loaded: false,
    busy: false,
    error: null,
}));

const mockItems: CatalogueItem[] = [
    { name: 'water', label: 'Water', weight: 500, description: 'A bottle of water.', stack: true },
    { name: 'bread', label: 'Bread', weight: 200, description: 'Fresh from the bakery.' },
    { name: 'phone', label: 'Phone', weight: 190 },
    { name: 'lockpick', label: 'Lockpick', weight: 160 },
    { name: 'radio', label: 'Radio', weight: 800, stack: false },
    { name: 'repairkit', label: 'Repair Kit', weight: 2000 },
    { name: 'plastic', label: 'Plastic', weight: 100 },
    { name: 'copper', label: 'Copper', weight: 100 },
    { name: 'glass', label: 'Glass', weight: 100 },
];

const mockVehicles: CatalogueVehicle[] = [
    { model: 'adder', label: 'Adder', brand: 'Truffade', price: 1000000, category: 'super' },
    { model: 'sultan', label: 'Sultan', brand: 'Karin', price: 12000, category: 'sports' },
    { model: 'elegy', label: 'Elegy', brand: 'Annis', price: 40000, category: 'sports' },
    { model: 'taxi', label: 'Taxi', brand: 'Vapid', price: 8000, category: 'service' },
    { model: 'blista', label: 'Blista', brand: 'Dinka', price: 8000, category: 'compacts' },
    { model: 'police', label: 'Police Cruiser', brand: 'Vapid', category: 'emergency' },
];

/** refresh asks the server to rebuild its catalogues before answering, for when
 *  the owner has changed an inventory or a vehicle list and wants to see it. */
export async function fetchCatalogue(refresh = false) {
    useCatalogue.setState({ busy: true, error: null });

    if (isEnvBrowser()) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        useCatalogue.setState({ items: mockItems, vehicles: mockVehicles, canGive: true, wired: { framework: 'qbx_core', inventory: 'ox_inventory' }, loaded: true, busy: false });
        return;
    }

    const response = await fetchNui<{
        ok: boolean;
        ITEMS?: CatalogueItem[];
        VEHICLES?: CatalogueVehicle[];
        CAN_GIVE?: boolean;
        IMAGE_URL?: string;
        WIRED?: { framework?: string; inventory?: string };
    }>('catalogue_fetch', { refresh });

    useCatalogue.setState({
        items: response?.ok ? (response.ITEMS ?? []) : [],
        vehicles: response?.ok ? (response.VEHICLES ?? []) : [],
        canGive: response?.CAN_GIVE === true,
        imageUrl: response?.IMAGE_URL ?? '',
        wired: response?.WIRED ?? {},
        loaded: true,
        busy: false,
    });
}

/** Where item icons are served from. Empty hands the job back to the bridge. */
export async function setImageUrl(pattern: string) {
    if (isEnvBrowser()) {
        useCatalogue.setState({ imageUrl: pattern });
        return { ok: true, error: null as string | null };
    }

    const response = await fetchNui<{ ok: boolean; error?: string }>('catalogue_set_image_url', { pattern });

    if (response?.ok) {
        useCatalogue.setState({ imageUrl: pattern });
        await fetchCatalogue();
    }

    return { ok: response?.ok === true, error: response?.ok ? null : (response?.error ?? 'the change was refused') };
}

export async function giveItem(item: string, count: number) {
    if (isEnvBrowser()) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { ok: true, error: null as string | null };
    }

    const response = await fetchNui<{ ok: boolean; error?: string }>('catalogue_give_item', { item, count });

    return { ok: response?.ok === true, error: response?.ok ? null : (response?.error ?? 'the spawn was refused') };
}

export async function spawnVehicle(model: string) {
    if (isEnvBrowser()) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { ok: true, error: null as string | null };
    }

    const response = await fetchNui<{ ok: boolean; error?: string }>('catalogue_spawn_vehicle', { model });

    return { ok: response?.ok === true, error: response?.ok ? null : (response?.error ?? 'the spawn was refused') };
}
