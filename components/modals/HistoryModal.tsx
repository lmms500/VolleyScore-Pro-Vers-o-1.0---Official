import React from 'react';
import { Modal } from '../ui/Modal';
import { HistoryList } from '../History/HistoryList';
import { useTranslation } from '../../contexts/LanguageContext';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={t('historyList.title')}
        maxWidth="max-w-xl"
    >
        <div className="h-[70vh] flex flex-col">
            <HistoryList />
        </div>
    </Modal>
  );
};
