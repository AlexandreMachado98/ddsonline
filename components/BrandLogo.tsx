'use client';

import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSlogan?: boolean;
  theme?: 'light' | 'dark';
}

export default function BrandLogo({ size = 'md', showSlogan = false, theme = 'dark' }: BrandLogoProps) {
  const isDark = theme === 'dark';

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex items-center gap-3">
        {/* Ícone Vetorial da AM TST: Capacete + Cruz + Folha */}
        <div className={`relative ${iconSizes[size]} flex items-center justify-center`}>
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
            {/* Círculo com gradiente verde */}
            <circle cx="100" cy="100" r="90" fill="none" stroke="#16a34a" strokeWidth="12" strokeLinecap="round" strokeDasharray="500 60" />
            
            {/* Silhueta do Trabalhador */}
            <path d="M70 145 C70 120 85 105 100 105 C115 105 130 120 130 145 Z" fill="#0f172a" />
            <circle cx="100" cy="90" r="18" fill="#0f172a" />
            
            {/* Capacete de Segurança */}
            <path d="M78 88 C78 70 122 70 122 88 Z" fill="#22c55e" />
            <path d="M74 88 L126 88 C128 88 128 92 126 92 L74 92 C72 92 72 88 74 88 Z" fill="#16a34a" />
            <path d="M96 70 L104 70 L104 88 L96 88 Z" fill="#15803d" />

            {/* Cruz de Primeiros Socorros / Saúde */}
            <path d="M125 95 L145 95 L145 115 L155 115 L155 95 L175 95 L175 85 L155 85 L155 65 L145 65 L145 85 L125 85 Z" fill="#16a34a" />

            {/* Folha Agro / Sustentabilidade */}
            <path d="M110 150 C140 150 170 120 170 95 C145 95 120 120 110 150 Z" fill="#22c55e" />
            <path d="M110 150 Q 140 125 165 100" fill="none" stroke="#ffffff" strokeWidth="2" />
          </svg>
        </div>

        {/* Tipografia da Marca AM TST */}
        <div className="flex flex-col">
          <div className="flex items-baseline tracking-tight font-black">
            <span className={`${textSizes[size]} ${isDark ? 'text-white' : 'text-slate-900'} tracking-tighter mr-1`}>
              AM
            </span>
            <span className={`${textSizes[size]} text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600 font-extrabold`}>
              TST
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] font-bold tracking-widest uppercase text-slate-400 -mt-1">
            Saúde e Segurança do Trabalho
          </span>
        </div>
      </div>

      {showSlogan && (
        <p className="text-[11px] text-emerald-400/90 font-medium tracking-wide mt-3 text-center max-w-xs">
          Cuidamos de pessoas. Protegemos o presente. Construímos um futuro mais seguro.
        </p>
      )}
    </div>
  );
}