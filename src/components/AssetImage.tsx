import {useState, type ReactNode} from 'react';

/** Source URLs remain untouched; image failures keep the surrounding action usable. */
export function AssetImage({src, alt = '', width, height, className = '', eager = false, fallback}: {
  src: string; alt?: string; width: number; height: number; className?: string; eager?: boolean; fallback: ReactNode;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === src) return <span className={`asset-fallback ${className}`} data-asset-fallback="true">{fallback}</span>;
  return <img className={`cloudinary-asset ${className}`} src={src} alt={alt} width={width} height={height}
    loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailedSource(src)}/>;
}
