
import React, { createContext, useContext } from 'react';
import { useVolleyGame } from '../hooks/useVolleyGame';
import { GlobalLoader } from '../components/ui/GlobalLoader';

type GameContextType = ReturnType<typeof useVolleyGame>;

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const game = useVolleyGame();

  if (!game.isLoaded) {
      return <GlobalLoader />;
  }

  return (
    <GameContext.Provider value={game}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
