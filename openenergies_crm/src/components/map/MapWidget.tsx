// src/components/map/MapWidget.tsx
// Plain Leaflet implementation (no react-leaflet — avoids React 18/19 context issues)
import { useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGeocodedPuntos } from '@hooks/useGeocodedPuntos';
import { MapPin, Loader2 } from 'lucide-react';

// ── Custom SVG marker icon ─────────────────────────────────────
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#f59e0b" stroke="#92400e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;
const PIN_URL = `data:image/svg+xml;base64,${btoa(PIN_SVG)}`;

const pinIcon = L.icon({
    iconUrl: PIN_URL,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

// ── Estado badge colors ────────────────────────────────────────
const ESTADO_COLORS: Record<string, string> = {
    'Nueva Oportunidad': '#3b82f6',
    'Solicitar Doc.': '#eab308',
    'Doc. OK': '#10b981',
    'Estudio enviado': '#a855f7',
    'Aceptado': '#22c55e',
    'Permanencia': '#f97316',
    'Standby': '#6b7280',
    'Desiste': '#ef4444',
};

// ── Spain center ───────────────────────────────────────────────
const SPAIN_CENTER: L.LatLngExpression = [40.4637, -3.7492];
const DEFAULT_ZOOM = 6;

// ── Main MapWidget ─────────────────────────────────────────────
export default function MapWidget() {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const { puntos, isLoading } = useGeocodedPuntos();

    // Initialize map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: SPAIN_CENTER,
            zoom: DEFAULT_ZOOM,
            scrollWheelZoom: true,
            zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Update markers when puntos change
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Clear old markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        if (puntos.length === 0) return;

        // Add new markers
        const newMarkers = puntos.map(p => {
            const color = ESTADO_COLORS[p.estado] ?? '#6b7280';
            const marker = L.marker([p.lat, p.lng], { icon: pinIcon }).addTo(map);
            marker.bindPopup(`
        <div style="min-width:200px;font-family:system-ui,sans-serif;">
          <p style="font-weight:700;color:#111;margin:0 0 4px;font-size:12px;letter-spacing:0.5px;">${p.cups}</p>
          <p style="color:#666;font-size:11px;margin:0 0 8px;">${p.direccion}</p>
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;color:${color};background:${color}20;">
            ${p.estado}
          </span>
        </div>
      `);
            return marker;
        });

        markersRef.current = newMarkers;

        // Fit bounds to markers
        const bounds = L.latLngBounds(puntos.map(p => [p.lat, p.lng] as L.LatLngTuple));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }, [puntos]);

    return (
        <div className="glass-card overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-fenix-500/10">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-primary">Mapa de Puntos de Suministro</h3>
                    <p className="text-[11px] text-secondary">
                        {isLoading
                            ? 'Geocodificando direcciones…'
                            : `${puntos.length} punto${puntos.length !== 1 ? 's' : ''} localizados`}
                    </p>
                </div>
                {isLoading && (
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin ml-auto" />
                )}
            </div>

            {/* Map container */}
            <div
                ref={containerRef}
                className="flex-1 min-h-[250px] w-full"
                style={{ background: '#1a1a2e' }}
            />
        </div>
    );
}
