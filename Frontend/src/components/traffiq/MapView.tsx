import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { HOTSPOT_DESCRIPTIONS, type Junction } from "@/lib/traffiq-data";
import "leaflet/dist/leaflet.css";

export default function MapView({
  layer,
  filteredJunctions,
}: {
  layer: string;
  filteredJunctions: Junction[];
}) {
  return (
    <MapContainer
      center={[12.9716, 77.5946]}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {filteredJunctions.map((j) => {
        let radius = Math.max(6, j.pdi / 5);
        let color = HOTSPOT_DESCRIPTIONS[j.type].color;
        let opacity = 0.55;
        let weight = 1.5;

        if (layer === "Violation Heatmap") {
          radius = Math.max(16, j.pdi / 2);
          opacity = 0.15;
          weight = 0;
        } else if (layer === "GPS Points") {
          radius = 4;
          color = "#00d4ff";
          opacity = 0.85;
          weight = 1;
        }

        return (
          <CircleMarker
            key={j.name}
            center={[j.lat, j.lng]}
            radius={radius}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: opacity,
              weight: weight,
            }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#00d4ff" }}>{j.name}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>PDI Score: <b>{j.pdi.toFixed(1)}</b></div>
                <div style={{ fontSize: 12 }}>City Rank: <b>#{j.rank}</b></div>
                <div style={{ fontSize: 12 }}>Type: <b style={{ color: HOTSPOT_DESCRIPTIONS[j.type].color }}>{j.type}</b></div>
                <div style={{ fontSize: 12 }}>Violations: <b>{j.violations.toLocaleString()}</b></div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
