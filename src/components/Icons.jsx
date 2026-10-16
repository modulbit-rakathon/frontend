// Jednoduché SVG ikonky. Barvu berou z textu kolem (currentColor),
// takže je stačí obarvit přes CSS "color".
// aria-hidden = čtečka obrazovky je přeskočí (význam vždy nese i text vedle).

function Svg({ children, size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CameraIcon({ size }) {
  return (
    <Svg size={size}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  );
}

export function HomeIcon({ size }) {
  return (
    <Svg size={size}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </Svg>
  );
}

export function PillIcon({ size }) {
  return (
    <Svg size={size}>
      <rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-35 12 12)" />
      <path d="M9.7 8.7l4.6 6.6" />
    </Svg>
  );
}

export function DocumentIcon({ size }) {
  return (
    <Svg size={size}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </Svg>
  );
}

export function WarningIcon({ size }) {
  return (
    <Svg size={size}>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.01" />
    </Svg>
  );
}

export function InfoIcon({ size }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 11v6M12 7v.01" />
    </Svg>
  );
}

export function CheckIcon({ size }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M7.5 12.5l3 3 6-6" />
    </Svg>
  );
}

export function DownloadIcon({ size }) {
  return (
    <Svg size={size}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </Svg>
  );
}

export function ChevronIcon({ size }) {
  return (
    <Svg size={size}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}
