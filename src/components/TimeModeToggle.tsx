import './TimeModeToggle.css';

interface TimeModeToggleProps {
  useLocalTime: boolean;
  onChange: (useLocalTime: boolean) => void;
}

export default function TimeModeToggle({ useLocalTime, onChange }: TimeModeToggleProps) {
  return (
    <div className="time-mode-toggle" role="group" aria-label="Fuseau horaire affiché">
      <button
        type="button"
        className={useLocalTime ? 'time-mode-toggle__button time-mode-toggle__button--active' : 'time-mode-toggle__button'}
        onClick={() => onChange(true)}
      >
        Heure locale
      </button>
      <button
        type="button"
        className={!useLocalTime ? 'time-mode-toggle__button time-mode-toggle__button--active' : 'time-mode-toggle__button'}
        onClick={() => onChange(false)}
      >
        UTC
      </button>
    </div>
  );
}
