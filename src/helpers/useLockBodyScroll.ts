import { useEffect } from 'react';

// Empêche le document de défiler pendant qu'un écran plein écran à défilement interne (les écrans
// d'éclipse, voir .solar-eclipse-details) est monté. Bug connu de Safari iOS : même avec
// overflow:hidden sur tous les conteneurs internes, le document lui-même peut encore "rebondir"
// verticalement au toucher si html/body ne sont pas eux-mêmes verrouillés — devenu visible une fois le
// panneau de circonstances un peu plus haut (bandeau de sécurité en plus). Scopé au montage/démontage
// de l'écran plutôt qu'un overflow:hidden global dans index.css, qui casserait le défilement normal
// des autres pages (accueil, sélecteur d'année, page de précision — toutes en min-height:100vh, pensées
// pour défiler).
export const useLockBodyScroll = () => {
  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);
};
