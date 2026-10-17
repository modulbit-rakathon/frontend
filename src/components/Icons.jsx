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

export function CopyIcon({ size }) {
  return (
    <Svg size={size}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
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

export function MedicIcon({ size }) {
  return (
    <Svg size={size}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 14h6" />
      <path d="M12 17v-6" />
    </Svg>
  );
}

// Přeškrtnutá Wi-Fi = bez internetu
export function OfflineIcon({ size }) {
  return (
    <Svg size={size}>
      <path d="M2 8.8a15 15 0 0 1 4.2-2.6" />
      <path d="M10.7 5.1A15 15 0 0 1 22 8.8" />
      <path d="M5 12.6a10 10 0 0 1 5.2-2.5" />
      <path d="M16.9 11.1A10 10 0 0 1 19 12.6" />
      <path d="M8.5 16.4a5 5 0 0 1 7 0" />
      <path d="M12 20h.01" />
      <path d="M3 3l18 18" />
    </Svg>
  );
}

export function SettingsIcon({ size }) {
  return (
    <Svg size={size}>
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </Svg>
  );
}
export function ArrowLeftIcon({ size }) {
  return (
    <Svg size={size}>
      <path d="M19 12H5" />
      <path d="M11 5l-7 7 7 7" />
    </Svg>
  );
}
