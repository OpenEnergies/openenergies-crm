// src/hooks/useGeocodedPuntos.ts
// Efficient geocoding: reads lat/lng from DB, geocodes missing ones
// via Nominatim with postal-code disambiguation + DB caching.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';

// ── Public types ─────────────────────────────────────────────────
export interface GeocodedPunto {
    id: string;
    cups: string;
    estado: string;
    direccion: string;
    clienteNombre: string;
    lat: number;
    lng: number;
}

// ── Raw row from Supabase ────────────────────────────────────────
interface PuntoRaw {
    id: string;
    cups: string;
    estado: string;
    direccion_sum: string | null;
    localidad_sum: string | null;
    provincia_sum: string | null;
    latitud: number | null;
    longitud: number | null;
    clientes: { nombre: string } | { nombre: string }[] | null;
}

// ── Address parsing helpers ──────────────────────────────────────
const STREET_ABBREVS: [RegExp, string][] = [
    [/^GTA\b\.?\s*/i, 'Glorieta '],
    [/^CL\b\.?\s*/i, 'Calle '],
    [/^AV\b\.?\s*/i, 'Avenida '],
    [/^AVD?A?\b\.?\s*/i, 'Avenida '],
    [/^PZ\b\.?\s*/i, 'Plaza '],
    [/^PZA?\b\.?\s*/i, 'Plaza '],
    [/^PG\b\.?\s*/i, 'Paseo '],
    [/^PS\b\.?\s*/i, 'Paseo '],
    [/^PSO?\b\.?\s*/i, 'Paseo '],
    [/^RD\b\.?\s*/i, 'Ronda '],
    [/^CTRA\b\.?\s*/i, 'Carretera '],
    [/^CR\b\.?\s*/i, 'Carretera '],
    [/^CM\b\.?\s*/i, 'Camino '],
    [/^URB\b\.?\s*/i, 'Urbanización '],
    [/^CALLE\b\.?\s*/i, 'Calle '],
    [/^RUA\b\.?\s*/i, 'Rua '],
    [/^PRACA\b\.?\s*/i, 'Praça '],
];

/** Extract the 5-digit postal code from anywhere in the string */
function extractPostalCode(raw: string): string | null {
    const match = raw.match(/\b(\d{5})\b/);
    return match ? match[1]! : null;
}

/** Build a clean street+number string (no floor/door/postal) */
function extractStreet(raw: string): string {
    let addr = raw.trim();
    // Expand abbreviations
    for (const [re, replacement] of STREET_ABBREVS) {
        if (re.test(addr)) {
            addr = addr.replace(re, replacement);
            break;
        }
    }
    // Keep only street + number
    const match = addr.match(/^(.+?,?\s*\d+)/);
    if (match && match[1]) addr = match[1];
    // Remove apartment/floor/door details
    addr = addr.replace(/\s+(PTA|ESC|LOC|DCHA|IZDA?|IZQ|BAJO|ENTP?|ATIC[OA]?|PISO|PL|DPDO)\b.*$/i, '');
    addr = addr.replace(/\s+[A-Z]\s*\d*\s*$/i, '');
    // Remove postal codes from the street part
    addr = addr.replace(/\b\d{5}\b/g, '');
    addr = addr.replace(/[\s\-–,]+$/, '').trim();
    return addr;
}

/** Build a dedup key: "street|postal|city" — groups same-building puntos */
function buildDedupKey(raw: string, localidad: string | null): string {
    const street = extractStreet(raw);
    const postal = extractPostalCode(raw) ?? '';
    const city = localidad?.trim() ?? '';
    return `${street}|${postal}|${city}`.toLowerCase();
}

function displayAddress(raw: string, localidad: string | null, provincia: string | null): string {
    return [raw, localidad, provincia].filter(Boolean).join(', ');
}

function getClienteName(clientes: PuntoRaw['clientes']): string {
    if (Array.isArray(clientes)) return clientes[0]?.nombre ?? '—';
    return clientes?.nombre ?? '—';
}

// ── Nominatim helpers ────────────────────────────────────────────
async function nominatimSearch(params: URLSearchParams): Promise<{ lat: number; lng: number } | null> {
    try {
        params.set('format', 'json');
        params.set('limit', '1');
        params.set('countrycodes', 'es');
        const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'OpenEnergiesCRM/1.0' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {
        return null;
    }
}

// ── Sequential geocoding with multi-level fallback ───────────────
// Priority:
//   1. street + postalcode ONLY (no city) — postal code is the area anchor
//   2. just postalcode (if street not found)
//   3. street + localidad + provincia (only if NO postal code)
//   4. just localidad + provincia (last resort)
const DELAY_MS = 1050;

interface GeoGroup {
    ids: string[];
    rawAddress: string;
    postalCode: string | null;
    localidad: string | null;
    provincia: string | null;
}

async function geocodeMissing(
    groups: Map<string, GeoGroup>,
): Promise<Map<string, { lat: number; lng: number }>> {
    const results = new Map<string, { lat: number; lng: number }>();
    const entries = Array.from(groups.entries());

    for (let i = 0; i < entries.length; i++) {
        const [key, group] = entries[i]!;
        const street = extractStreet(group.rawAddress);
        let coords: { lat: number; lng: number } | null = null;

        if (group.postalCode) {
            // ── HAS POSTAL CODE → use it as the sole area anchor ──
            // Level 1: street + postalcode (NO city)
            const p1 = new URLSearchParams();
            p1.set('street', street);
            p1.set('postalcode', group.postalCode);
            coords = await nominatimSearch(p1);

            // Level 2: just postalcode (centroid of the postal area)
            if (!coords) {
                await new Promise(r => setTimeout(r, DELAY_MS));
                const p2 = new URLSearchParams();
                p2.set('postalcode', group.postalCode);
                coords = await nominatimSearch(p2);
            }
        } else {
            // ── NO POSTAL CODE → fall back to localidad/provincia ──
            // Level 3: street + city + province
            if (group.localidad) {
                const q = `${street}, ${group.localidad}${group.provincia ? ', ' + group.provincia : ''}`;
                const p3 = new URLSearchParams();
                p3.set('q', q);
                coords = await nominatimSearch(p3);
            }

            // Level 4: just city + province
            if (!coords && group.localidad) {
                await new Promise(r => setTimeout(r, DELAY_MS));
                const q = group.provincia
                    ? `${group.localidad}, ${group.provincia}`
                    : group.localidad;
                const p4 = new URLSearchParams();
                p4.set('q', q);
                coords = await nominatimSearch(p4);
            }
        }

        if (coords) {
            results.set(key, coords);
        }

        // Rate limit for next iteration
        if (i < entries.length - 1) {
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }

    return results;
}

// ── Save coordinates back to DB ──────────────────────────────────
async function saveCoordsToDB(coordsMap: Map<string, { lat: number; lng: number; ids: string[] }>) {
    const ids: string[] = [];
    const lats: number[] = [];
    const lngs: number[] = [];

    for (const [, { lat, lng, ids: puntoIds }] of coordsMap) {
        for (const id of puntoIds) {
            ids.push(id);
            lats.push(lat);
            lngs.push(lng);
        }
    }

    if (ids.length === 0) return;

    for (let i = 0; i < ids.length; i += 100) {
        await supabase.rpc('upsert_punto_coords', {
            p_ids: ids.slice(i, i + 100),
            p_lats: lats.slice(i, i + 100),
            p_lngs: lngs.slice(i, i + 100),
        });
    }
}

// ── Core: fetch from DB, geocode missing, return all ─────────────
async function fetchAndGeocode(): Promise<GeocodedPunto[]> {
    const { data, error } = await supabase
        .from('puntos_suministro')
        .select('id, cups, estado, direccion_sum, localidad_sum, provincia_sum, latitud, longitud, clientes(nombre)')
        .is('eliminado_en', null)
        .order('creado_en', { ascending: false })
        .range(0, 99999);

    if (error) throw error;
    const puntos = (data ?? []) as PuntoRaw[];

    const results: GeocodedPunto[] = [];
    const toGeocode = new Map<string, GeoGroup>();

    for (const p of puntos) {
        if (!p.direccion_sum) continue;

        const displayAddr = displayAddress(p.direccion_sum, p.localidad_sum, p.provincia_sum);
        const clienteNombre = getClienteName(p.clientes);

        // Already has coordinates → instant
        if (p.latitud != null && p.longitud != null) {
            results.push({
                id: p.id, cups: p.cups, estado: p.estado,
                direccion: displayAddr, clienteNombre,
                lat: p.latitud, lng: p.longitud,
            });
            continue;
        }

        // Needs geocoding → deduplicate
        const dedupKey = buildDedupKey(p.direccion_sum, p.localidad_sum);
        const existing = toGeocode.get(dedupKey);
        if (existing) {
            existing.ids.push(p.id);
        } else {
            toGeocode.set(dedupKey, {
                ids: [p.id],
                rawAddress: p.direccion_sum,
                postalCode: extractPostalCode(p.direccion_sum),
                localidad: p.localidad_sum,
                provincia: p.provincia_sum,
            });
        }
    }

    // Geocode missing addresses
    if (toGeocode.size > 0) {
        const geocoded = await geocodeMissing(toGeocode);
        const toSave = new Map<string, { lat: number; lng: number; ids: string[] }>();

        for (const [key, group] of toGeocode) {
            const coords = geocoded.get(key);
            if (!coords) continue;
            toSave.set(key, { ...coords, ids: group.ids });

            for (const id of group.ids) {
                const punto = puntos.find(pp => pp.id === id);
                if (!punto) continue;
                results.push({
                    id: punto.id, cups: punto.cups, estado: punto.estado,
                    direccion: displayAddress(punto.direccion_sum!, punto.localidad_sum, punto.provincia_sum),
                    clienteNombre: getClienteName(punto.clientes),
                    lat: coords.lat, lng: coords.lng,
                });
            }
        }

        // Save to DB in background
        saveCoordsToDB(toSave).catch(() => { /* retry next load */ });
    }

    return results;
}

// ── Main hook ────────────────────────────────────────────────────
export function useGeocodedPuntos() {
    const { data: puntos = [], isLoading } = useQuery<GeocodedPunto[]>({
        queryKey: ['map-puntos-geocoded'],
        queryFn: fetchAndGeocode,
        staleTime: 5 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
    });

    return { puntos, isLoading };
}
