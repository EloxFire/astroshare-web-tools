export type SolarIconVariant = 'partial' | 'annular' | 'total';
export type LunarIconVariant = 'penumbral' | 'partial' | 'total';

// Associe le type d'éclipse renvoyé par l'API (ex: "CentralTotalEclipse", "ObserverAnnularEclipse")
// au pictogramme le plus proche (voir EclipseTypeIcon). Un type hybride est rendu comme "total" :
// depuis la plupart des points du tracé, une éclipse hybride est vécue comme une totale, et ça évite
// un quatrième pictogramme dédié pour un type d'éclipse rare.
const SOLAR_ICON_BY_TYPE: Record<string, SolarIconVariant> = {
  NonCentralPartialEclipse: 'partial',
  ObserverPartialEclipse: 'partial',
  NonCentralAnnularEclipse: 'annular',
  CentralAnnularEclipse: 'annular',
  ObserverAnnularEclipse: 'annular',
  NonCentralTotalEclipse: 'total',
  CentralTotalEclipse: 'total',
  ObserverTotalEclipse: 'total',
  NonCentralHybridEclipse: 'total',
  CentralHybridEclipse: 'total',
};

const LUNAR_ICON_BY_TYPE: Record<string, LunarIconVariant> = {
  PenumbralEclipse: 'penumbral',
  PartialEclipse: 'partial',
  TotalEclipse: 'total',
};

export const getEclipseIconVariant = (
  kind: 'solar' | 'lunar',
  type: string,
): SolarIconVariant | LunarIconVariant =>
  kind === 'solar' ? (SOLAR_ICON_BY_TYPE[type] ?? 'total') : (LUNAR_ICON_BY_TYPE[type] ?? 'partial');
