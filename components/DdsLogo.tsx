'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface DdsLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  showText?: boolean;
  clickable?: boolean;
  href?: string;
  className?: string;
  theme?: 'dark' | 'light';
}

export default function DdsLogo({
  size = 'md',
  showSubtitle = true,
  showText = true,
  clickable = false,
  href = '/',
  className = '',
  theme = 'dark'
}: DdsLogoProps) {
  const logoSources = ['/logo.png', '/icon-512x512.png', '/icon-192x192.png'];
  const [sourceIndex, setSourceIndex] = useState(0);

  const sizeMap = {
    xs: {
      badge: 'w-7 h-7 sm:w-8 sm:h-8',
      pixelSize: 32,
      text: 'text-base sm:text-lg',
      pill: 'text-[9px] px-1.5 py-0.5',
      sub: 'text-[8px]',
      gap: 'gap-2'
    },
    sm: {
      badge: 'w-8 h-8 sm:w-9 sm:h-9',
      pixelSize: 36,
      text: 'text-lg sm:text-xl',
      pill: 'text-[10px] px-1.5 py-0.5',
      sub: 'text-[9px]',
      gap: 'gap-2.5'
    },
    md: {
      badge: 'w-10 h-10 sm:w-11 sm:h-11',
      pixelSize: 44,
      text: 'text-xl sm:text-2xl',
      pill: 'text-xs px-2 py-0.5',
      sub: 'text-[11px]',
      gap: 'gap-3'
    },
    lg: {
      badge: 'w-12 h-12 sm:w-14 sm:h-14',
      pixelSize: 56,
      text: 'text-2xl sm:text-3xl',
      pill: 'text-xs sm:text-sm px-2.5 py-0.5',
      sub: 'text-xs',
      gap: 'gap-3.5'
    },
    xl: {
      badge: 'w-16 h-16 sm:w-20 sm:h-20',
      pixelSize: 80,
      text: 'text-3xl sm:text-4xl',
      pill: 'text-sm sm:text-base px-3 py-1',
      sub: 'text-xs sm:text-sm',
      gap: 'gap-4'
    }
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const isLight = theme === 'light';

  // Emblema com a Logo Oficial do DDS Online (Capacete + Botão ON)
  const logoBadge = (
    <div className={`${currentSize.badge} shrink-0 relative flex items-center justify-center rounded-xl sm:rounded-2xl border border-emerald-500/30 bg-slate-950/80 shadow-md shadow-emerald-950/40 p-0.5 overflow-hidden transition-transform group-hover:scale-105 duration-200`}>
      <img
        src={logoSources[sourceIndex] || '/logo.png'}
        alt="DDS ON - Logo Oficial"
        width={currentSize.pixelSize}
        height={currentSize.pixelSize}
        className="w-full h-full object-contain rounded-[10px] sm:rounded-[14px] select-none pointer-events-none"
        loading="eager"
        onError={() => {
          setSourceIndex((prev) => (prev < logoSources.length - 1 ? prev + 1 : prev));
        }}
      />
    </div>
  );

  // Modo apenas ícone / marca
  if (!showText) {
    if (clickable) {
      return (
        <Link href={href} className={`hover:opacity-90 transition-opacity inline-flex group ${className}`}>
          {logoBadge}
        </Link>
      );
    }
    return logoBadge;
  }

  const content = (
    <div className={`inline-flex items-center ${currentSize.gap} font-sans select-none max-w-full group ${className}`}>
      {logoBadge}

      {/* Tipografia Oficial da Marca DDS ON */}
      <div className="flex flex-col text-left min-w-0">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'} ${currentSize.text}`}>
            DDS
          </span>
          <span className={`font-black bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 rounded-lg shadow-md font-mono ${currentSize.pill}`}>
            ON
          </span>
        </div>
        
        {showSubtitle && (
          <span className={`font-medium tracking-wide mt-1 break-words ${isLight ? 'text-slate-600' : 'text-slate-400'} ${currentSize.sub}`}>
            Segurança do Trabalho &amp; NRs
          </span>
        )}
      </div>
    </div>
  );

  if (clickable) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}

