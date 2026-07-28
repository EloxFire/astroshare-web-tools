import type { CSSProperties, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { app_colors } from '../constants';
import './SimpleButton.css';

interface SimpleButtonProps {
  text?: string;
  icon?: ReactNode;
  active?: boolean;
  onPress?: () => void;
  backgroundColor?: string;
  textColor?: string;
  activeBorderColor?: string;
  loading?: boolean;
  style?: CSSProperties;
  // Infobulle au survol — utile surtout pour les boutons sans `text` visible (icône seule), qui sans
  // ça n'ont aucun indice de ce qu'ils font avant d'être cliqués. Sert aussi de nom accessible
  // (aria-label) dans ce cas.
  title?: string;
}

export default function SimpleButton({
  text,
  icon,
  onPress,
  active,
  backgroundColor,
  textColor,
  activeBorderColor,
  loading,
  style,
  title,
}: SimpleButtonProps) {
  return (
    <button
      className="simple-button"
      title={title}
      aria-label={!text ? title : undefined}
      style={{
        backgroundColor: backgroundColor ?? app_colors.white_no_opacity,
        borderColor: active ? (activeBorderColor ?? app_colors.white_forty) : 'transparent',
        color: textColor ?? app_colors.white,
        ...style,
      }}
      onClick={onPress}
    >
      {loading ? (
        <Loader2 size={16} className="simple-button__spinner" color={textColor ?? app_colors.white} />
      ) : (
        <>
          {icon}
          {text && <span>{text}</span>}
        </>
      )}
    </button>
  );
}
