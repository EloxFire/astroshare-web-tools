// Tuiles raster du style "outdoors" de Mapbox (relief, courbes de niveau) — utilisable directement
// dans un <TileLayer> Leaflet standard, sans Mapbox GL JS. Réutilise le même token que la
// vérification d'obstruction par le relief (voir horizonObstruction.ts).
export const getTopographyTileUrl = (): string | null => {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return null;
  return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`;
};
