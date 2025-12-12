import { useEffect, useRef } from 'react';
import { useLayoutManager } from '../contexts/LayoutContext';

export const useCollider = <T extends HTMLElement = HTMLDivElement>(id: string) => {
  const { registerCollider } = useLayoutManager();
  const ref = useRef<T>(null);

  useEffect(() => {
    // Register on mount and updates
    if (ref.current) {
      registerCollider(id, ref.current);
    }
    
    // Setup resize observer to update bounds if component resizes
    const observer = new ResizeObserver(() => {
        if (ref.current) registerCollider(id, ref.current);
    });
    
    if (ref.current) observer.observe(ref.current);

    return () => {
      observer.disconnect();
      registerCollider(id, null); // Unregister on unmount
    };
  }, [id, registerCollider]);

  return ref;
};