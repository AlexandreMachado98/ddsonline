'use client';

import React from 'react';
import Link from 'next/link';

interface DdsLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  clickable?: boolean;
  href?: string;
  className?: string;
}

export default function DdsLogo({
  size = 'md',
  showSubtitle = true,
  clickable = false,
  href = '/',
  className = ''
}: DdsLogoProps) {
  const sizeMap = {
    sm: {
      text: 'text-lg',
      pill: 'text-[10px] px-1.5 py-0.5',
      badge: 'w-7 h-7',
      dot: 'w-1.5 h-1.5',
      sub: 'text-[9px]'
    },
    md: {
      text: 'text-xl sm:text-2xl',
      pill: 'text-xs px-2 py-0.5',
      badge: 'w-9 h-9',
      dot: 'w-2 h-2',
      sub: 'text-[11px]'
    },
    lg: {
      text: 'text-2xl sm:text-3xl',
      pill: 'text-xs sm:text-sm px-2.5 py-0.5',
      badge: 'w-11 h-11',
      dot: 'w-2.5 h-2.5',
      sub: 'text-xs'
    },
    xl: {
      text: 'text-3xl sm:text-4xl',
      pill: 'text-sm sm:text-base px-3 py-1',
      badge: 'w-14 h-14',
      dot: 'w-3 h-3',
      sub: 'text-xs sm:text-sm'
    }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const content = (
    <div className={`inline-flex items-center gap-2.5 font-sans select-none ${className}`}>
      
      {/* Ícone / Badge DDS ON */}
      <div className={`${currentSize.badge} rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/40 p-1 flex items-center justify-center shadow-lg shadow-emerald-950/40 shrink-0 relative overflow-hidden group`}>
        <div className="absolute inset-0 bg-emerald-500/10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
        <div className="flex items-center justify-center relative z-10 font-black tracking-tighter">
          <span className="text-[10px] text-white font-extrabold">D</span>
          <span className="text-[10px] text-emerald-400 font-black">ON</span>
        </div>
        <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
      </div>

      {/* Tipografia da Marca */}
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-black text-white tracking-tight ${currentSize.text}`}>
            DDS
          </span>
          <span className={`font-black bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 rounded-lg shadow-md font-mono ${currentSize.pill}`}>
            ON
          </span>
        </div>
        
        {showSubtitle && (
          <span className={`text-slate-400 font-medium tracking-wide mt-0.5 ${currentSize.sub}`}>
            Segurança do Trabalho &amp; NRs
          </span>
        )}
      </div>

    </div>
  );

  if (clickable) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
