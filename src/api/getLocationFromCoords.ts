import { astroshareApi } from './astroshareApi';

export const getLocationName = async (coords: { lat: number; lon: number }) => {
  try {
    const response = await astroshareApi.get('/location/name', { params: { lat: coords.lat, lon: coords.lon } });
    if (!response.data.data) {
      return { local_names: { fr: 'Inconnu' }, country: 'Inconnu', state: 'Inconnu' };
    }
    return response.data.data;
  } catch (error) {
    console.log('Error while retreiving the city : ', error);
    throw error;
  }
};
