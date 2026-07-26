// Port de src/helpers/scripts/convertDDtoDMSCoords.ts (astroshare-app), cardinaux en français et format compact.

export const convertDDtoDMS = (latitude: number, longitude: number) => {
  const latCardinal = latitude >= 0 ? 'N' : 'S';
  const lonCardinal = longitude >= 0 ? 'E' : 'O';

  const latDegree = Math.floor(Math.abs(latitude));
  const latMinute = Math.floor((Math.abs(latitude) - latDegree) * 60);
  const latSecond = ((Math.abs(latitude) - latDegree - latMinute / 60) * 3600).toFixed(1);

  const lonDegree = Math.floor(Math.abs(longitude));
  const lonMinute = Math.floor((Math.abs(longitude) - lonDegree) * 60);
  const lonSecond = ((Math.abs(longitude) - lonDegree - lonMinute / 60) * 3600).toFixed(1);

  return {
    lat: `${latDegree}°${latMinute}'${latSecond}"${latCardinal}`,
    lon: `${lonDegree}°${lonMinute}'${lonSecond}"${lonCardinal}`,
  };
};
