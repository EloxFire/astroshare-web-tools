import { Loader2, Search } from 'lucide-react';
import { app_colors } from '../constants';
import './InputWithIcon.css';

interface InputWithIconProps {
  placeholder: string;
  value: string;
  changeEvent: (value: string) => void;
  search?: () => void;
  loading?: boolean;
}

export default function InputWithIcon({ placeholder, value, changeEvent, search, loading }: InputWithIconProps) {
  return (
    <div className="input-with-icon">
      <input
        className="input-with-icon__input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => changeEvent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && search) search();
        }}
      />
      {loading ? (
        <Loader2 size={18} className="input-with-icon__spinner" color={app_colors.white} />
      ) : (
        search && (
          <button
            type="button"
            className="input-with-icon__button"
            onClick={search}
            aria-label="Rechercher"
          >
            <Search size={18} color={value ? app_colors.white : app_colors.white_forty} />
          </button>
        )
      )}
    </div>
  );
}
