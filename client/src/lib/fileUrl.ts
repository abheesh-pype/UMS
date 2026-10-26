// Uploaded proofs and documents are stored in the database as data URLs.
// Older records may still hold `/uploads/<file>` paths or bare file names served by the API.
export const resolveFileUrl = (url?: string | null) => {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  const filePath = url.startsWith('/') ? url : `/uploads/${url.replace(/^\.?\//, '')}`;
  const apiOrigin = import.meta.env.VITE_API_URL?.match(/^https?:\/\/[^/]+/i)?.[0] || window.location.origin;
  return new URL(filePath, apiOrigin).toString();
};

export const isImageFileUrl = (url?: string | null) =>
  !!url && (url.startsWith('data:image/') || /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url));

const dataUrlToBlobUrl = (dataUrl: string) => {
  const [header, base64] = dataUrl.split(',', 2);
  const mime = header.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream';
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
};

// Browsers refuse to open data: URLs in a new tab, so links to them are opened as blob URLs instead
export const installDataUrlLinkHandler = () => {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const anchor = (event.target as Element | null)?.closest?.('a[href^="data:"]') as HTMLAnchorElement | null;
    if (!anchor || anchor.hasAttribute('download')) return;
    event.preventDefault();
    const blobUrl = dataUrlToBlobUrl(anchor.getAttribute('href') || '');
    window.open(blobUrl, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  });
};
