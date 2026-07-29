// Sous-ensemble de src/helpers/constants.ts (astroshare-app) utilisé par l'écran des circonstances d'éclipse solaire.

export const app_colors = {
  black: '#000000',
  white: '#FFFFFF',
  white_sixty: '#FFFFFF60',
  white_forty: '#FFFFFF40',
  white_twenty: '#FFFFFF20',
  white_no_opacity: '#FFFFFF0D',
  green: '#00FF00',
  red: '#FF0000',
  yellow: '#F4C238',
  orange: '#FFA500',
};

export const solarEclipseTypes: Record<string, string> = {
  NonCentralPartialEclipse: 'Éclipse partielle',
  NonCentralHybridEclipse: 'Éclipse totale ou annulaire',
  NonCentralTotalEclipse: 'Éclipse totale',
  NonCentralAnnularEclipse: 'Éclipse annulaire',
  CentralHybridEclipse: 'Éclipse totale ou annulaire',
  CentralTotalEclipse: 'Éclipse totale',
  CentralAnnularEclipse: 'Éclipse annulaire',
  ObserverPartialEclipse: 'Éclipse partielle',
  ObserverTotalEclipse: 'Éclipse totale',
  ObserverAnnularEclipse: 'Éclipse annulaire',
};

export const solarEclipseVisibilityLinesColors: Record<string, string> = {
  beginSunRise: app_colors.green,
  endSunSet: app_colors.red,
  beginSunSet: app_colors.red,
  endSunRise: app_colors.green,
  limitSouth: app_colors.yellow,
  limitNorth: app_colors.yellow,
  maximumSunRise: app_colors.orange,
  maximumSunSet: app_colors.orange,
  // Ligne centrale du passage de l'ombre (éclipses centrales uniquement) — blanche pour rester
  // lisible par-dessus la bande de totalité dorée, sans être confondue avec les autres lignes.
  central: app_colors.white,
};

// Style des deux polygones renvoyés par l'API pour une éclipse centrale (totale/annulaire) :
// "umbra" (bande de totalité/annularité, la zone à privilégier) et "penumbra" (zone de visibilité
// partielle, bien plus large). L'umbra est rendue nettement plus marquée pour qu'elle ressorte
// immédiatement, la penumbra reste discrète en arrière-plan (comme sur le site de l'IMCCE).
export const solarVisibilityPathStyles: Record<'umbra' | 'penumbra', { color: string; fillColor: string; fillOpacity: number; weight: number }> = {
  umbra: { color: app_colors.yellow, fillColor: app_colors.yellow, fillOpacity: 0.35, weight: 2 },
  penumbra: { color: '#5a7bb8', fillColor: '#5a7bb8', fillOpacity: 0.1, weight: 1 },
};

export const lunarEclipseTypes: Record<string, string> = {
  PenumbralEclipse: 'Éclipse pénombrale',
  PartialEclipse: 'Éclipse partielle',
  TotalEclipse: 'Éclipse totale',
};

// Seule la ligne du maximum est affichée sur la carte lunaire (voir LunarEclipseMap) — les 7 lignes
// de phase (P1/U1/U2/greatest/U3/U4/P2) rendaient la carte confuse pour un gain d'information limité
// par rapport au dégradé de zones de visibilité.
export const lunarEclipseVisibilityLinesColors: Record<string, string> = {
  maximumEclipse: app_colors.red,
};
