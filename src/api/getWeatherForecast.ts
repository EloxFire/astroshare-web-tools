import { astroshareApi } from './astroshareApi';
import type { WeatherForecast } from '../types/Weather';

// Même backend que /eclipses ou /location/coords (voir astroshareApi.ts) : il proxy lui-même l'API
// OpenWeather One Call 3.0 (clé côté serveur, jamais exposée au navigateur) — voir DeepAstronomy/
// src/routes/weather/weather.ts. `lang: 'fr'` renvoie des descriptions déjà traduites par OpenWeather.
export const getWeatherForecast = async (lat: number, lon: number): Promise<WeatherForecast> => {
  try {
    const response = await astroshareApi.get('/weather', { params: { lat, lon, lang: 'fr' } });
    return response.data.data;
  } catch (error) {
    console.log('Get weather forecast error :', error);
    throw error;
  }
};
