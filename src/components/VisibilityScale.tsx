import { VISIBILITY_SCALE, type VisibilityLevel } from '../helpers/visibilityRating';
import './VisibilityScale.css';

interface VisibilityScaleProps {
  activeLevel?: VisibilityLevel;
}

export default function VisibilityScale({ activeLevel }: VisibilityScaleProps) {
  return (
    <div className="visibility-scale">
      <p className="visibility-scale__intro">
        Basée sur la hauteur de l'éclipse au-dessus de l'horizon au maximum (plus elle est haute, moins un horizon
        dégagé est nécessaire), affinée par une vérification réelle du relief environnant quand elle est disponible.
      </p>
      <ul className="visibility-scale__list">
        {VISIBILITY_SCALE.map((tier) => (
          <li
            key={tier.level}
            className={tier.level === activeLevel ? 'visibility-scale__item visibility-scale__item--active' : 'visibility-scale__item'}
          >
            <span className="visibility-scale__swatch" style={{ backgroundColor: tier.color }} />
            <span className="visibility-scale__label">{tier.label}</span>
            <span className="visibility-scale__threshold">{tier.thresholdLabel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
