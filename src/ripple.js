// "Vlna" při klepnutí na tlačítko (jako v aplikacích od Googlu).
//
// Funguje pro celou aplikaci najednou: posloucháme klepnutí na celé stránce,
// a když bylo na tlačítko, odkaz nebo volbu (RIPPLE_SELECTOR), vložíme do něj
// kroužek <span class="ripple">, který se z místa klepnutí rozšíří a zmizí.
// Vzhled a rychlost vlny jsou v index.css (hledejte "VLNA").

// Na které prvky vlnu dávat – všechna tlačítka, odkazy a volby (.choice).
// Prvek s třídou "no-ripple" (nebo uvnitř něj) vlnu nedostane.
const RIPPLE_SELECTOR = 'button, a[href], [role="button"], label.choice, .card-link';

function handlePointerDown(event) {
  const target = event.target.closest(RIPPLE_SELECTOR);
  if (!target || target.disabled || target.closest('.no-ripple')) return;

  // Lidé, kteří mají v systému vypnuté animace, vlnu neuvidí.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Kroužek se měří od tlačítka, takže tlačítko nesmí mít position: static.
  if (getComputedStyle(target).position === 'static') {
    target.style.position = 'relative';
  }

  // Velikost kroužku = delší strana tlačítka × 2, aby vlna pokryla celé tlačítko.
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;

  // Obal přes celé tlačítko s overflow: hidden, aby vlna nepřetekla ven
  // (samotné tlačítko tak nemusí mít overflow: hidden).
  const holder = document.createElement('span');
  holder.className = 'ripple-holder';

  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  // Střed kroužku dáme přesně tam, kam uživatel klepl.
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

  holder.appendChild(ripple);
  target.appendChild(holder);
  // Po skončení animace kroužek zase odstraníme.
  ripple.addEventListener('animationend', () => holder.remove());
}

document.addEventListener('pointerdown', handlePointerDown);
