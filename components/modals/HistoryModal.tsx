
import React, { useEffect, lazy, Suspense } from 'react';
import { Modal } from '../ui/Modal';
import { HistoryList } from '../History/HistoryList';
import { useTranslation } from '../../contexts/LanguageContext';
import { useTutorial } from '../../hooks/useTutorial';

// Lazy load RichTutorialModal
const RichTutorialModal = lazy(() => import('./RichTutorialModal').then(m => ({ default: m.RichTutorialModal })));

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { activeTutorial, triggerTutorial, completeTutorial, isLoaded } = useTutorial(false);

  useEffect(() => {
      if (isLoaded && isOpen) {
          triggerTutorial('history');
      }
  }, [isLoaded, triggerTutorial, isOpen]);

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={t('historyList.title')}
        maxWidth="max-w-2xl"
    >
        <Suspense fallback={null}>
            {activeTutorial === 'history' && (
                <RichTutorialModal 
                    isOpen={true} 
                    tutorialKey="history" 
                    onClose={completeTutorial} 
                />
            )}
        </Suspense>
        
        <div className="h-[75vh] flex flex-col pb-safe-bottom">
            <HistoryList />
        </div>
    </Modal>
  );
};
