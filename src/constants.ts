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
};

export const lunarEclipseTypes: Record<string, string> = {
  PenumbralEclipse: 'Éclipse pénombrale',
  PartialEclipse: 'Éclipse partielle',
  TotalEclipse: 'Éclipse totale',
};

export const lunarEclipseVisibilityLinesColors: Record<string, string> = {
  beginPenumbralEclipse: '#8899aa',
  beginPartialEclipse: app_colors.yellow,
  beginTotalEclipse: app_colors.orange,
  maximumEclipse: app_colors.red,
  endTotalEclipse: app_colors.orange,
  endPartialEclipse: app_colors.yellow,
  endPenumbralEclipse: '#8899aa',
};
