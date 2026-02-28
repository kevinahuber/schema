import QRCode from 'qrcode';

export function renderQR(container) {
  const wrap = document.createElement('div');
  wrap.className = 'page-qr';

  const h1 = document.createElement('h1');
  h1.className = 'page-title';
  h1.textContent = 'QR Code';
  wrap.appendChild(h1);

  const qrContainer = document.createElement('div');
  qrContainer.className = 'qr-container';

  const qrCanvas = document.createElement('canvas');
  qrCanvas.className = 'qr-canvas';
  qrCanvas.setAttribute('role', 'img');
  qrCanvas.setAttribute('aria-label', 'QR code linking to the draw page');
  qrContainer.appendChild(qrCanvas);

  const label = document.createElement('p');
  label.className = 'qr-label';
  qrContainer.appendChild(label);

  wrap.appendChild(qrContainer);
  container.appendChild(wrap);

  const drawUrl = `${location.origin}${location.pathname}#draw`;
  const qrSize = Math.min(window.innerWidth - 64, 480);

  QRCode.toCanvas(qrCanvas, drawUrl, {
    width: qrSize,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#111111', light: '#f9f9f9' },
  }).then(() => {
    label.textContent = `Scan to draw · ${drawUrl}`;
  }).catch(err => {
    label.textContent = 'QR generation failed.';
    console.error(err);
  });

  return () => { container.innerHTML = ''; };
}
