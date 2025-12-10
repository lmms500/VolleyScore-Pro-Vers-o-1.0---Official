
import { Variants, Transition } from "framer-motion";

/**
 * VolleyScore Pro Motion System 2.2
 * Physics-based configuration for a premium, tactile feel.
 * Refined for "Apple-like" fluidity: High stiffness, critical damping.
 */

// --- PHYSICS CONFIGS ---

// "Premium Spring": Standard for screen transitions and large elements.
// Fluid, weighty, no bounce.
export const springPremium: Transition = {
  type: "spring",
  stiffness: 380, // Tighter
  damping: 40,    // Critical damping (no wobble)
  mass: 1
};

// "Snappy Spring": For micro-interactions (buttons, toggles).
// Instant response, very subtle overshoot.
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 600,
  damping: 45, // Crisp stop
  mass: 1
};

// "Ticker Spring": Optimized for fast number tumbling
export const springTicker: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1
};

// --- REUSABLE VARIANTS ---

// Modal / Drawer
export const modalVariants: Variants = {
  hidden: { 
    y: 24, 
    opacity: 0,
    scale: 0.96,
    filter: "blur(8px)",
    transition: { duration: 0.2, ease: "easeOut" } 
  },
  visible: { 
    y: 0, 
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: springPremium
  },
  exit: { 
    y: 12, 
    opacity: 0, 
    scale: 0.98,
    filter: "blur(4px)",
    transition: { duration: 0.15, ease: "easeIn" }
  }
};

// Backdrop Fade
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { duration: 0.35, ease: "easeOut" } 
  },
  exit: { 
    opacity: 0, 
    transition: { duration: 0.2, ease: "easeIn" } 
  }
};

// Button Tap Feedback - Optimized for glass feel
export const buttonTap: Variants = {
  idle: { scale: 1, filter: "brightness(1)" },
  tap: { 
    scale: 0.94, 
    filter: "brightness(1.1)", 
    transition: { type: "spring", stiffness: 800, damping: 20 } 
  },
  hover: { 
    scale: 1.02, 
    transition: { type: "spring", stiffness: 400, damping: 25 } 
  }
};

// List Items (Staggered)
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: springSnappy
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.15 }
  }
};

// 3D Score Ticker Variants (Tumbler Effect)
export const tickerVariants: Variants = {
  enter: (direction: number) => ({
    y: direction > 0 ? "100%" : "-100%",
    rotateX: direction > 0 ? -90 : 90,
    opacity: 0,
    scale: 0.8,
    filter: "blur(4px)",
    zIndex: 1
  }),
  center: {
    y: "0%",
    rotateX: 0,
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    zIndex: 2,
    transition: springTicker
  },
  exit: (direction: number) => ({
    y: direction > 0 ? "-100%" : "100%",
    rotateX: direction > 0 ? 90 : -90,
    opacity: 0,
    scale: 0.8,
    filter: "blur(4px)",
    zIndex: 0,
    transition: { duration: 0.25, ease: "circIn" }
  })
};

// Critical Event Pulse (Heartbeat)
export const pulseHeartbeat: Variants = {
  idle: { scale: 1, opacity: 1 },
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.9, 1],
    filter: ["brightness(1)", "brightness(1.1)", "brightness(1)"],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// Stamp Effect
export const stampVariants: Variants = {
  hidden: { scale: 1.2, opacity: 0, y: 4, filter: "blur(4px)" },
  visible: { 
    scale: 1, 
    opacity: 1, 
    y: 0,
    filter: "blur(0px)",
    transition: springSnappy
  },
  exit: { 
    opacity: 0,
    scale: 0.95,
    filter: "blur(2px)",
    transition: { duration: 0.15 }
  }
};

// Vignette Pulse
export const vignettePulse: Variants = {
  hidden: { opacity: 0 },
  pulse: {
    opacity: [0.1, 0.8],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut"
    }
  }
};
