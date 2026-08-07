// Icônes locales (public/icons/weather/), reprises telles quelles de l'app mobile Astroshare plutôt
// que de dépendre du CDN icônes d'OpenWeather (openweathermap.org/img/wn/...) — même style visuel que
// le reste de l'écosystème Astroshare, et pas de requête vers un tiers juste pour une icône.
const KNOWN_ICONS = new Set([
  '01d', '01n', '02d', '02n', '03d', '03n', '04d', '04n',
  '09d', '09n', '10d', '10n', '11d', '11n', '13d', '13n', '50d', '50n',
]);

export const getWeatherIconUrl = (icon: string): string => `/icons/weather/${KNOWN_ICONS.has(icon) ? icon : 'default'}.png`;
