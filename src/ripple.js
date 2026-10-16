// "Vlna" při klepnutí na tlačítko (jako v aplikacích od Googlu).
//
// Funguje pro celou aplikaci najednou: posloucháme klepnutí na celé stránce,
// a když bylo na tlačítko ze seznamu RIPPLE_SELECTOR, vložíme do něj kroužek
// <span class="ripple">, který se z místa klepnutí rozšíří a zmizí.
// Vzhled a rychlost vlny jsou v index.css (hledejte "VLNA").

// Na které prvky vlnu dávat. Chcete ji i jinde? Přidejte sem další třídu.
const RIPPLE_SELECTOR = '.btn, .hero-button, .med-toggle, .nav-item, .card-link';

function handlePointerDown(event) {
  const target = event.target.closest(RIPPLE_SELECTOR);
  if (!target || target.disabled) return;

  // Lidé, kteří mají v systému vypnuté animace, vlnu neuvidí.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Velikost kroužku = delší strana tlačítka × 2, aby vlna pokryla celé tlačítko.
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  // Střed kroužku dáme přesně tam, kam uživatel klepl.
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

  target.appendChild(ripple);
  // Po skončení animace kroužek zase odstraníme.
  ripple.addEventListener('animationend', () => ripple.remove());
}

document.addEventListener('pointerdown', handlePointerDown);
