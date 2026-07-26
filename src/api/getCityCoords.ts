import { astroshareApi } from './astroshareApi';

export const getCityCoords = async (cityName: string) => {
  try {
    const response = await astroshareApi.get('/location/coords', { params: { name: cityName } });
    return response.data.data;
  } catch (error) {
    console.log('Get city coords error :', error);
    throw error;
  }
};
