
import React, { useEffect, useRef } from 'react';
import { getHexFromColor } from '../../utils/colors';
import { TeamColor } from '../../types';
import { useLayoutManager, ColliderRect } from '../../contexts/LayoutContext';

interface ConfettiProps {
  colors: TeamColor[]; 
  intensity?: 'low' | 'high';
}

interface Particle {
  x: number;
  y: number;
  prevY: number; // For Continuous Collision Detection
  wobble: number;
  wobbleSpeed: number;
  velocity: number;
  tiltAngle: number;
  color: string;
  shape: 'square' | 'circle';
  // Physics Properties
  mass: number;
  drift: number;
  scale: number;
  rotation: number;
  rotationSpeed: number;
  // Interaction
  sliding: boolean;
  slideSlope: number; // Stores the slope of the surface currently sliding on
}

export const Confetti: React.FC<ConfettiProps> = ({ colors, intensity = 'high' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { colliders } = useLayoutManager(); // Access registered UI colliders
  
  // Ref to hold colliders for the animation loop (avoid stale closures)
  const collidersRef = useRef<ColliderRect[]>(colliders);
  
  useEffect(() => {
      collidersRef.current = colliders;
  }, [colliders]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    let isRunning = true;

    const palette = [
        ...colors.map(c => getHexFromColor(c)),
        '#FFD700', // Gold
        '#FFFFFF', // White
    ];

    const resize = () => {
      if (canvas && isRunning) {
          const dpr = window.devicePixelRatio || 1;
          canvas.width = window.innerWidth * dpr;
          canvas.height = window.innerHeight * dpr;
          ctx.scale(dpr, dpr);
          canvas.style.width = `${window.innerWidth}px`;
          canvas.style.height = `${window.innerHeight}px`;
      }
    };

    const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const createParticle = (x: number, y: number): Particle => {
      return {
        x: x,
        y: y,
        prevY: y,
        wobble: Math.random() * 10,
        wobbleSpeed: randomRange(0.03, 0.07), // Slower wobble for paper feel
        velocity: randomRange(1.5, 3.5), // Much slower initial speed
        tiltAngle: Math.random() * Math.PI,
        color: palette[Math.floor(Math.random() * palette.length)],
        shape: Math.random() < 0.4 ? 'circle' : 'square',
        mass: randomRange(0.8, 1.2), 
        drift: randomRange(-0.5, 0.5), 
        scale: randomRange(0.7, 1.0),
        rotation: randomRange(0, 360),
        rotationSpeed: randomRange(-2, 2),
        sliding: false,
        slideSlope: 0
      };
    };

    const init = () => {
      resize();
      const count = intensity === 'high' ? 350 : 150;
      
      particles = [];
      // Initialize spread out vertically ABOVE and ON screen
      for (let i = 0; i < count; i++) {
        particles.push(createParticle(
            randomRange(0, window.innerWidth), 
            randomRange(-window.innerHeight * 1.5, 0) // Higher start point
        ));
      }
    };

    /**
     * ADVANCED COLLISION LOGIC
     * Calculates specific hitboxes based on element type to simulate curves and text bodies.
     */
    const getHitSurfaceY = (p: Particle, collider: ColliderRect): { hitY: number, slope: number } | null => {
        const { rect, id } = collider;
        
        let xPad = 2; // Default horizontal tolerance
        
        // --- HISTORY BAR REFINEMENT ---
        // History items are small pills. We need tight collision to allow falling through gaps.
        if (id.includes('hist-')) {
            xPad = -4; // Negative padding: Particle must be 4px INSIDE the box to collide.
            
            // Check X bounds first with strict padding
            if (p.x < rect.left - xPad || p.x > rect.right + xPad) return null;

            // Flat surface, but sink it slightly to match the "text" height inside the pill
            return { hitY: rect.top + 4, slope: 0 };
        }

        // --- TIMEOUT / FOOTER REFINEMENT ---
        // The footer buttons usually have py-2 padding. We need to sink the collision surface
        // so particles land on the visible button, not the invisible padding box.
        if (id.includes('sc-footer')) {
            xPad = 4; // Tighten horizontal bounds for the pill shape
            if (p.x < rect.left + xPad || p.x > rect.right - xPad) return null;

            // Offset Y: The button has py-2 (~8px). 
            // We sink 6px to bypass the transparent area.
            const visualTopOffset = 6; 
            
            // Add slight curvature for rounded-xl corners
            // As particle gets closer to edge (dist -> 1), drop it slightly
            const width = rect.width;
            const centerX = rect.left + (width / 2);
            const dist = Math.abs(p.x - centerX) / (width / 2); // 0 (center) to 1 (edge)
            const curveDrop = Math.pow(dist, 3) * 3; // 3px drop at extreme edges

            return { 
                hitY: rect.top + visualTopOffset + curveDrop, 
                slope: dist * (p.x > centerX ? 0.5 : -0.5) // Slight slope to shed particles off corners
            };
        }

        // 1. HORIZONTAL CHECK (Broad Phase for standard elements)
        if (p.x < rect.left + xPad || p.x > rect.right - xPad) return null;

        // 2. CALCULATE SURFACE GEOMETRY (Narrow Phase)
        
        // A. Scoreboard Numbers: Parabolic/Curved Surface
        // Simulates the curvature of 0, 3, 6, 8, 9.
        if (id.includes('sc-number')) {
            const width = rect.width;
            const centerX = rect.left + (width / 2);
            const distFromCenter = (p.x - centerX) / (width / 2); // -1 (left) to 1 (right)
            
            // "Sink" amount: How much lower the edges are compared to center
            // 0.35 creates a nice curve but keeps the edges high enough to catch particles
            const sinkFactor = rect.height * 0.35; 
            
            // Base offset: Lower the whole surface just slightly to account for line-height
            // Reduced to 0.1 to prevent visual clipping/tunneling at the top
            const lineHeigthTrim = rect.height * 0.1; 

            // Parabolic function: y = x^2.2 (Slightly flatter top than 2.5)
            const curveOffset = Math.pow(Math.abs(distFromCenter), 2.2) * sinkFactor;
            
            const hitY = rect.top + lineHeigthTrim + curveOffset;
            
            // Calculate Slope for sliding
            const slope = distFromCenter * 2.5; // Steepness multiplier for sliding physics

            return { hitY, slope };
        }

        // B. Text Headers/Names: Flat but Deep Sunk
        if (id.includes('sc-header') || id.includes('hist-')) { // Fallback for other hist items if ID changes
            const textSink = rect.height * 0.3; 
            return { hitY: rect.top + textSink, slope: 0 };
        }

        // C. Standard Elements (Controls, Badges): Flat Surface
        return { hitY: rect.top + 2, slope: 0 };
    };

    const checkCollision = (p: Particle) => {
        // If sliding, we handle physics in update loop, but we need to check if it fell off
        if (p.sliding) return;

        for (const c of collidersRef.current) {
            const surface = getHitSurfaceY(p, c);
            
            if (surface) {
                // CONTINUOUS COLLISION DETECTION (CCD)
                // Instead of just checking if p.y is inside a box, we check if the particle
                // CROSSED the surface line between the previous frame and this frame.
                // This makes it impossible for particles to tunnel through, even at high speeds.
                
                // Logic: 
                // 1. Current Y is at or below the surface
                // 2. Previous Y was at or above the surface (with tiny tolerance for float precision)
                if (p.y >= surface.hitY && p.prevY <= surface.hitY + 2) {
                    // LANDED!
                    // Snap exactly to surface
                    p.y = surface.hitY;
                    p.velocity = 0;
                    p.sliding = true;
                    p.slideSlope = surface.slope;
                    
                    // Dampen movement
                    p.rotationSpeed *= 0.5;
                    p.drift *= 0.5;
                    return;
                }
            }
        }
    };

    const update = () => {
      if (!isRunning || !ctx || !canvas) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      ctx.clearRect(0, 0, width, height);

      // --- SHADOW SETTINGS (Subtle Depth) ---
      ctx.shadowColor = "rgba(0, 0, 0, 0.1)";
      ctx.shadowBlur = 1;
      ctx.shadowOffsetY = 1;
      ctx.shadowOffsetX = 0.5;

      particles.forEach((p) => {
        p.prevY = p.y; // Store position before update for CCD
        
        if (p.sliding) {
            // SLIDING PHYSICS
            // If slope exists (curved surface), accelerate sideways down the slope
            if (Math.abs(p.slideSlope) > 0.1) {
                p.x += p.slideSlope * 1.5; // Slide down curve
                p.rotation += p.slideSlope * 5; // Roll down
            } else {
                // Flat surface friction/drift
                p.x += p.drift + Math.sin(p.wobble) * 0.2;
            }
            
            p.wobble += p.wobbleSpeed * 0.5;
            
            // Check if it is still supported by ANY surface at new X
            let supported = false;
            
            for (const c of collidersRef.current) {
                const surface = getHitSurfaceY(p, c);
                // We are supported if we are 'on' or 'above' the surface at this X
                // We allow a small tolerance (snap distance)
                if (surface) {
                    // Snap-to-surface check
                    // If we are close to the surface verticaly (within 15px), we snap to it
                    if (Math.abs(p.y - surface.hitY) < 15) {
                        supported = true;
                        // Smooth lerp to avoid jitter on steep curves
                        p.y += (surface.hitY - p.y) * 0.5;
                        p.slideSlope = surface.slope;
                        break;
                    }
                }
            }

            if (!supported) {
                p.sliding = false; // Start falling again
                p.velocity = 1; 
                p.rotationSpeed = randomRange(-2, 2); // Regain rotation
            }

        } else {
            // FALLING PHYSICS (Paper-like)
            p.velocity += 0.02; 
            const terminalVelocity = 3.5; 
            if (p.velocity > terminalVelocity) {
                p.velocity = terminalVelocity;
            }

            p.y += p.velocity;
            p.x += p.drift + Math.sin(p.wobble) * 1.5; 
            p.wobble += p.wobbleSpeed;
            p.rotation += p.rotationSpeed;
            
            checkCollision(p);
        }

        // RESET LOGIC
        if (p.y > height + 20) {
           p.y = -20; 
           p.prevY = -20;
           p.x = randomRange(0, width);
           p.velocity = randomRange(1, 2); 
           p.drift = randomRange(-0.5, 0.5);
           p.sliding = false;
           p.slideSlope = 0;
        }

        // --- DRAWING ---
        const size = 6 * p.scale;
        
        // 3D Rotation Simulation
        const widthTilted = size * Math.abs(Math.cos(p.rotation * (Math.PI / 180)));
        
        ctx.fillStyle = p.color;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tiltAngle + (p.sliding ? p.slideSlope : 0)); // Align with slope if sliding
        
        ctx.beginPath();
        if (p.shape === 'circle') {
            ctx.ellipse(0, 0, widthTilted / 2, size / 2, 0, 0, 2 * Math.PI);
        } else {
            ctx.fillRect(-widthTilted / 2, -size / 2, widthTilted, size);
        }
        ctx.fill();
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
  }, [colors, intensity]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-[100]" 
      style={{ width: '100%', height: '100%' }}
    />
  );
};
