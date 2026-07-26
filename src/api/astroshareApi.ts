import axios from 'axios';

export const astroshareApi = axios.create({
  baseURL: import.meta.env.VITE_ASTROSHARE_API_URL,
});
