// Sdílení hotového odkazu (režim pro blízké):
//   - "Poslat odkaz" = systémové sdílení telefonu (WhatsApp, SMS, e-mail…),
//   - když ho prohlížeč nemá, odkaz zkopírujeme do schránky,
//   - když nejde ani to, ukážeme odkaz k ručnímu zkopírování,
//   - QR kód pro blízkého, který sedí vedle (jen u kratších odkazů).
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { MAX_QR_LENGTH } from '../familyShare.js';

export default function ShareLink({ url, title, text }) {
  const [qrUrl, setQrUrl] = useState('');
  const [status, setStatus] = useState(''); // 'copied' | 'manual' | ''

  useEffect(() => {
    if (url.length > MAX_QR_LENGTH) {
      setQrUrl('');
      return;
    }
    QRCode.toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: 'L' })
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch {
      setStatus('manual');
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // Uživatel sdílení zavřel – nic dalšího neděláme.
        if (error?.name === 'AbortError') return;
      }
    }
    copy();
  }

  return (
    <div className="share-link">
      <button type="button" className="btn btn-primary" onClick={share}>
        Poslat odkaz
      </button>
      <button type="button" className="btn btn-secondary" onClick={copy}>
        Zkopírovat odkaz
      </button>

      {status === 'copied' && (
        <p className="share-link-status" role="status">
          Odkaz je zkopírovaný. Vložte ho do zprávy.
        </p>
      )}
      {status === 'manual' && (
        <div className="field">
          <label htmlFor="share-link-text">Zkopírujte tento odkaz:</label>
          <textarea id="share-link-text" className="share-link-text" readOnly value={url} onFocus={(e) => e.target.select()} />
        </div>
      )}

      {qrUrl ? (
        <figure className="share-qr">
          <img src={qrUrl} alt="QR kód s odkazem" />
          <figcaption>Je druhý telefon vedle vás? Stačí načíst QR kód fotoaparátem.</figcaption>
        </figure>
      ) : (
        <p className="subtitle">Seznam je dlouhý, QR kód by nešel načíst. Pošlete odkaz zprávou.</p>
      )}
    </div>
  );
}
