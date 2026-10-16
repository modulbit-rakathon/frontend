// Potvrzovací okno místo window.confirm().
// Používá nativní <dialog>: prohlížeč sám ztmaví zbytek stránky, drží fokus
// uvnitř okna a zavře ho klávesou Esc. My jen přidáme vzhled a animaci.
//
// Použití:
//   <ConfirmDialog
//     open={Boolean(toRemove)}
//     title="Opravdu odebrat lék Paralen?"
//     text="…"
//     confirmLabel="Odebrat"
//     cancelLabel="Ponechat"
//     danger
//     onConfirm={…}
//     onCancel={…}
//   />
import { useEffect, useId, useRef, useState } from 'react';

// Jak dlouho trvá zavírací animace (musí sedět s index.css)
const CLOSE_MS = 160;

export default function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useId();
  const textId = useId();
  const [closing, setClosing] = useState(false);

  // Otevření: showModal() = okno nad vším ostatním, zbytek stránky nejde ovládat
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setClosing(false);
      dialog.showModal();
      // Fokus na bezpečnou volbu – Enter omylem nic neodebere
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Zavřeme až po krátkém zmizení, ať okno jen neprobleskne
  function finish(callback) {
    if (closing) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      ref.current?.close();
      callback();
      return;
    }
    setClosing(true);
    setTimeout(() => {
      ref.current?.close();
      setClosing(false);
      callback();
    }, CLOSE_MS);
  }

  return (
    <dialog
      ref={ref}
      className={closing ? 'confirm-dialog confirm-dialog-closing' : 'confirm-dialog'}
      aria-labelledby={titleId}
      aria-describedby={text ? textId : undefined}
      // Esc: prohlížeč by okno zavřel hned – chceme stejnou animaci jako tlačítko
      onCancel={(e) => {
        e.preventDefault();
        finish(onCancel);
      }}
      // Klepnutí na ztmavené pozadí (mimo okno) = zrušit
      onClick={(e) => {
        if (e.target === ref.current) finish(onCancel);
      }}
    >
      <div className="confirm-body">
        <h2 id={titleId}>{title}</h2>
        {text && <p id={textId}>{text}</p>}
        <div className="confirm-actions">
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => finish(onConfirm)}
          >
            {confirmLabel}
          </button>
          <button type="button" className="btn btn-secondary" ref={cancelRef} onClick={() => finish(onCancel)}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
