'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

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
      iconSize: 15,
      text: 'text-lg',
      pill: 'text-[10px] px-1.5 py-0.5',
      badge: 'w-7 h-7 rounded-lg',
      dot: 'w-1.5 h-1.5',
      sub: 'text-[9px]'
    },
    md: {
      iconSize: 18,
      text: 'text-xl sm:text-2xl',
      pill: 'text-xs px-2 py-0.5',
      badge: 'w-9 h-9 rounded-xl',
      dot: 'w-2 h-2',
      sub: 'text-[11px]'
    },
    lg: {
      iconSize: 22,
      text: 'text-2xl sm:text-3xl',
      pill: 'text-xs sm:text-sm px-2.5 py-0.5',
      badge: 'w-11 h-11 rounded-2xl',
      dot: 'w-2.5 h-2.5',
      sub: 'text-xs'
    },
    xl: {
      iconSize: 28,
      text: 'text-3xl sm:text-4xl',
      pill: 'text-sm sm:text-base px-3 py-1',
      badge: 'w-13 h-13 sm:w-14 sm:h-14 rounded-2xl',
      dot: 'w-3 h-3',
      sub: 'text-xs sm:text-sm'
    }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const content = (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 font-sans select-none max-w-full ${className}`}>
      
      {/* Ícone / Emblema Oficial DDS ON */}
      <div className={`${currentSize.badge} bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 border border-emerald-400/40 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/25 shrink-0 relative overflow-hidden group`}>
        <ShieldCheck size={currentSize.iconSize} className="text-slate-950 stroke-[2.5]" />
        <span className="absolute top-1 right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-200"></span>
        </span>
      </div>

      {/* Tipografia da Marca */}
      <div className="flex flex-col text-left min-w-0">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-black text-white tracking-tight ${currentSize.text}`}>
            DDS
          </span>
          <span className={`font-black bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 rounded-lg shadow-md font-mono ${currentSize.pill}`}>
            ON
          </span>
        </div>
        
        {showSubtitle && (
          <span className={`text-slate-400 font-medium tracking-wide mt-1 break-words ${currentSize.sub}`}>
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

