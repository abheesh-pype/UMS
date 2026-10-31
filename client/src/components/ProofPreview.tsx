import { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { resolveFileUrl } from '@/lib/fileUrl';
import { cn } from '@/lib/utils';

interface Props {
  url?: string | null;
  alt?: string;
  className?: string;
}

// Shows an uploaded proof (image or PDF) from the database, whether it is saved as a data URL
// or as a stored file link. The file is loaded as a blob so PDFs can be shown inline too.
export function ProofPreview({ url, alt = 'Uploaded payment proof', className }: Props) {
  const [loaded, setLoaded] = useState<{ url: string; src: string; type: string; failed: boolean } | null>(null);

  useEffect(() => {
    if (!url) return;
    let objectUrl = '';
    let cancelled = false;
    fetch(resolveFileUrl(url))
      .then(response => {
        if (!response.ok) throw new Error('Failed to load file');
        return response.blob();
      })
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ url, src: objectUrl, type: blob.type, failed: false });
      })
      .catch(() => !cancelled && setLoaded({ url, src: '', type: '', failed: true }));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  // Ignore a result left over from a previous url while the new one loads
  const current = loaded?.url === url ? loaded : null;
  const failed = !!current?.failed;
  const file = current && !current.failed ? current : null;

  if (!url) return <p className="text-sm text-muted-foreground">No payment proof uploaded yet.</p>;
  if (failed) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        Unable to load the uploaded payment proof.
      </p>
    );
  }
  if (!file) return <div className={cn('h-64 w-full rounded-lg bg-muted animate-pulse', className)} />;

  return (
    <div className="space-y-2">
      {file.type.startsWith('image/') ? (
        <img src={file.src} alt={alt} className={cn('max-h-[75vh] w-full rounded-lg border object-contain bg-muted', className)} />
      ) : file.type === 'application/pdf' ? (
        <iframe src={file.src} title={alt} className={cn('h-[70vh] w-full rounded-lg border bg-muted', className)} />
      ) : (
        <div className="flex items-center gap-2 rounded-lg border p-4 text-sm">
          <FileText className="w-4 h-4" />This file type cannot be previewed.
        </div>
      )}
      <a href={file.src} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
        Open in new tab <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
