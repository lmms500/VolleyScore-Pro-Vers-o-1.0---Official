import React, { memo } from 'react';
import { motion, Transition } from 'framer-motion';
import { TeamColor } from '../../types';
import { getHexFromColor } from '../../utils/colors';

interface BackgroundGlowProps {
  isSwapped: boolean;
  isFullscreen: boolean;
  colorA?: TeamColor;
  colorB?: TeamColor;
  lowPowerMode?: boolean;
}

export const BackgroundGlow: React.FC<BackgroundGlowProps> = memo(({ isSwapped, isFullscreen, colorA = 'indigo', colorB = 'rose', lowPowerMode = false }) => {
  
  const hexA = getHexFromColor(colorA);
  const hexB = getHexFromColor(colorB);

  // Configuração de física ultra-fluida para o fundo
  const fluidTransition: Transition = {
    type: "spring",
    stiffness: 80, // Reduzido para menos cálculo de física por frame
    damping: 30,    
    mass: 2       
  };

  // Definição das posições
  // Posição 1: Topo Esquerdo
  const pos1 = { top: "-20%", left: "-20%", right: "auto", bottom: "auto" };
  // Posição 2: Fundo Direito
  const pos2 = { top: "auto", left: "auto", right: "-20%", bottom: "-20%" };

  // OTIMIZAÇÃO: Android odeia blurs gigantes.
  // Modo Normal: Reduzido de 160px para 90px para aliviar GPU fill-rate.
  // Modo LowPower: Sem blur, apenas opacidade baixa (muito mais rápido).
  const blurClass = lowPowerMode 
    ? 'opacity-10' 
    : 'blur-[80px] opacity-30 mix-blend-screen saturate-150';

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-slate-50 dark:bg-[#020617]" aria-hidden="true">
       
       {/* BLOB TIME A */}
       <motion.div
         layout
         initial={false}
         animate={{
            ...(isSwapped ? pos2 : pos1),
            backgroundColor: hexA
         }}
         transition={fluidTransition}
         className={`
             absolute w-[80vw] h-[80vw] md:w-[50vw] md:h-[50vw]
             rounded-full will-change-transform transform-gpu
             ${blurClass}
         `}
         style={{ translateZ: 0 }} // Force Hardware Acceleration
       />

       {/* BLOB TIME B */}
       <motion.div
         layout
         initial={false}
         animate={{
            ...(isSwapped ? pos1 : pos2),
            backgroundColor: hexB
         }}
         transition={fluidTransition}
         className={`
             absolute w-[80vw] h-[80vw] md:w-[50vw] md:h-[50vw]
             rounded-full will-change-transform transform-gpu
             ${blurClass}
         `}
         style={{ translateZ: 0 }} // Force Hardware Acceleration
       />
    </div>
  );
});