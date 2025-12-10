
import React, { useEffect, useRef } from 'react';
import { resolveTheme } from '../../utils/colors';
import { TeamColor } from '../../types';

interface ConfettiProps {
  color: TeamColor;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

export const Confetti: React.FC<ConfettiProps> = ({ color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = resolveTheme(color);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    let isRunning = true;
    
    // Extract raw colors from theme or defaults
    const primaryColor = theme.halo.replace('bg-[', '').replace(']', '').replace('bg-', ''); 
    const colors = [
       primaryColor.startsWith('#') ? primaryColor : '#6366f1', 
       '#ffffff', 
       color === 'rose' ? '#f43f5e' : (color === 'indigo' ? '#818cf8' : '#cbd5e1')
    ];

    const resize = () => {
      if (canvas && isRunning) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
      }
    };

    const createParticle = (initial: boolean = false): Particle => {
      return {
        x: Math.random() * (canvas ? canvas.width : window.innerWidth),
        y: initial ? Math.random() * window.innerHeight : -20 - Math.random() * 50,
        vx: (Math.random() - 0.5) * 6, // More horizontal spread
        vy: Math.random() * 4 + 2, // Faster fall
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15, // Spin faster
        opacity: 1
      };
    };

    const init = () => {
      resize();
      particles = Array.from({ length: 180 }, () => createParticle(true));
    };

    const update = () => {
      if (!isRunning || !ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.vy += 0.05; // Gravity
        p.vx *= 0.98; // Air drag

        // Wrap around horizontally
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;

        // Reset if fell off screen
        if (p.y > canvas.height) {
           particles[i] = createParticle();
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        
        // Draw confetti shape (rect)
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      animationId = requestAnimationFrame(update);
    };

    window.addEventListener('resize', resize);
    init();
    update();

    return () => {
      isRunning = false;
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [color, theme]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-0"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
