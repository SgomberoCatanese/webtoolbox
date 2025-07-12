// cache.js

// Forza caricamento senza cache per CSS/JS
const version = '1.0.4';
document.querySelectorAll('link[rel="stylesheet"], script[src]').forEach(el => {
  const src = el.getAttribute(el.tagName === 'LINK' ? 'href' : 'src');
  const separator = src.includes('?') ? '&' : '?';
  const newSrc = src.split('?')[0] + separator + 'v=' + version;
  el.setAttribute(el.tagName === 'LINK' ? 'href' : 'src', newSrc);
});

// Pulisce dati e URL temporanei
window.addEventListener('beforeunload', () => {
  localStorage.clear();
  sessionStorage.clear();
  if (window.convertedBlobs) {
    window.convertedBlobs.forEach(url => URL.revokeObjectURL(url));
  }
});
