import {useState, type ReactNode} from 'react';

const widths = [160, 240, 320, 480, 640, 960, 1280] as const;

/** Keep the supplied asset identity while asking Cloudinary for the displayed size. */
export function optimizedAsset(src: string, width: number) {
  const match = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/)(.+)$/.exec(src);
  if (!match || width < 1) return src;
  return `${match[1]}w_${width},c_limit,q_auto:good,f_auto/${match[2]}${match[3]}`;
}

/** Source URLs remain untouched; image failures keep the surrounding action usable. */
export function AssetImage({src, alt = '', width, height, className = '', eager = false, priority = false, sizes = '(max-width: 700px) 160px, 240px', fallback}: {
  src: string; alt?: string; width: number; height: number; className?: string; eager?: boolean; priority?: boolean; sizes?: string; fallback: ReactNode;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === src) return <span className={`asset-fallback ${className}`} data-asset-fallback="true">{fallback}</span>;
  const srcSet = widths.map(size => `${optimizedAsset(src, size)} ${size}w`).join(', ');
  return <img className={`cloudinary-asset ${className}`} src={src} srcSet={srcSet} sizes={sizes} alt={alt} width={width} height={height}
    loading={eager || priority ? 'eager' : 'lazy'} decoding={priority ? 'sync' : 'async'} fetchPriority={priority ? 'high' : undefined}
    data-asset-priority={priority ? 'high' : undefined} onError={() => setFailedSource(src)}/>;
}
