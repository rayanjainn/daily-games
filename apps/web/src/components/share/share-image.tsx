'use client';

import { Download, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/**
 * A generated image with Share (the phone's share sheet, sending the picture itself) and
 * Download. The image is private to the player until they choose to share the file.
 */
export function ShareImage({
  src,
  filename,
  alt,
  width,
  height,
}: {
  src: string;
  filename: string;
  alt: string;
  width: number;
  height: number;
}) {
  const toast = useToast();
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.canShare === 'function');
  }, []);

  async function file() {
    const res = await fetch(src, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('image');
    return new File([await res.blob()], filename, { type: 'image/png' });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* A generated PNG from our own route, so a plain img (not next/image). */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="h-auto w-full rounded-lg border-[length:var(--bw)] border-line"
        data-testid="share-image"
      />
      <div className="flex flex-wrap gap-2">
        {canShare ? (
          <Button
            onClick={async () => {
              try {
                const f = await file();
                if (navigator.canShare({ files: [f] }))
                  await navigator.share({ files: [f], title: alt });
                else throw new Error('unsupported');
              } catch (err) {
                if ((err as Error).name !== 'AbortError')
                  toast({ tone: 'error', title: 'Sharing failed. Download it instead.' });
              }
            }}
          >
            <Share2 aria-hidden /> Share
          </Button>
        ) : null}
        <a href={src} download={filename} className={buttonVariants({ variant: 'secondary' })}>
          <Download aria-hidden /> Download
        </a>
      </div>
    </div>
  );
}
