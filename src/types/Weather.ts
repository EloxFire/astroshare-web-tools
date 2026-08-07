// Sous-ensemble de la réponse OpenWeather One Call 3.0 (proxyée par le backend Astroshare, voir
// getWeatherForecast.ts) — uniquement les champs réellement utilisés par EclipseWeatherForecast.
export interface WeatherCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
}

export interface HourlyWeather {
  dt: number;
  temp: number;
  clouds: number;
  pop: number;
  // m/s (convention OpenWeather en `units=metric`, malgré ce que suggère le nom "metric" — voir
  // windSpeedToKmh dans EclipseWeatherForecast.tsx pour la conversion à l'affichage).
  wind_speed: number;
  wind_deg: number;
  weather: WeatherCondition[];
}

export interface DailyWeather {
  dt: number;
  temp: { day: number; min: number; max: number };
  clouds: number;
  pop: number;
  wind_speed: number;
  wind_deg: number;
  weather: WeatherCondition[];
}

export interface WeatherForecast {
  hourly: HourlyWeather[];
  daily: DailyWeather[];
}
