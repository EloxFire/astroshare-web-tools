import dayjs from 'dayjs';

// Les dates de l'API sont des horaires UTC sans suffixe 'Z' (ex: "2026-03-03T08:44:25").
// En heure UTC : on formate la chaîne telle quelle (dayjs sans 'Z' l'interprète comme une heure "murale" identique).
// En heure locale : on ajoute 'Z' pour que dayjs la traite comme un instant UTC réel, puis .format()
// la convertit automatiquement dans le fuseau du navigateur.
export const formatEventTime = (isoDateNoZ: string, useLocalTime: boolean, formatStr = 'HH:mm:ss') =>
  dayjs(useLocalTime ? `${isoDateNoZ}Z` : isoDateNoZ).format(formatStr);
