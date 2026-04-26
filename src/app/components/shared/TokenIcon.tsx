import { useState } from 'react';

interface TokenIconProps {
  logoURI?: string;
  logo: string;
  symbol: string;
  /** Tailwind size classes for the container, e.g. "w-9 h-9 sm:w-12 sm:h-12" */
  size?: string;
  /** Tailwind text size for the emoji fallback, e.g. "text-lg sm:text-2xl" */
  textSize?: string;
  className?: string;
}

/**
 * Renders a token icon image from `logoURI` (e.g. from Jupiter API).
 * Falls back to the emoji character if the image fails or isn't available.
 */
export function TokenIcon({
  logoURI,
  logo,
  symbol,
  size = 'w-9 h-9 sm:w-12 sm:h-12',
  textSize = 'text-lg sm:text-2xl',
  className = '',
}: TokenIconProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const showImage = logoURI && !imgFailed;

  return (
    <div
      className={`${size} rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`}
    >
      {showImage ? (
        <img
          src={logoURI}
          alt={symbol}
          className="w-full h-full object-cover rounded-xl"
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      ) : (
        <span className={textSize}>{logo}</span>
      )}
    </div>
  );
}
