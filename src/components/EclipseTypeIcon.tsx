import type { SolarIconVariant, LunarIconVariant } from '../helpers/eclipseTypeIcon';
import './EclipseTypeIcon.css';

interface EclipseTypeIconProps {
  kind: 'solar' | 'lunar';
  variant: SolarIconVariant | LunarIconVariant;
  className?: string;
}

export default function EclipseTypeIcon({ kind, variant, className }: EclipseTypeIconProps) {
  return (
    <span
      className={`eclipse-type-icon eclipse-type-icon--${kind}-${variant}${className ? ` ${className}` : ''}`}
      aria-hidden
    />
  );
}
