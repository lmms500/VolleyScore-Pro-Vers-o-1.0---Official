
import React from 'react';
import { Modal } from '../ui/Modal';
import { Mic, Zap, User, RotateCcw, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';

interface VoiceCommandsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandRow = ({ cmd, desc }: { cmd: string, desc: string }) => (
    <div className="flex flex-col py-2 border-b border-black/5 dark:border-white/5 last:border-0">
        <span className="text-sm font-bold text-slate-800 dark:text-white">"{cmd}"</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{desc}</span>
    </div>
);

const Section = ({ title, icon: Icon, colorClass, children }: any) => (
    <div className="mb-4 bg-white/50 dark:bg-white/5 rounded-2xl p-4 border border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-black/5 dark:border-white/5">
            <Icon size={16} className={colorClass} />
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</h4>
        </div>
        {children}
    </div>
);

export const VoiceCommandsModal: React.FC<VoiceCommandsModalProps> = ({ isOpen, onClose }) => {
  const { t, language } = useTranslation();

  // Content adapts slightly based on language for better examples
  const isPT = language === 'pt';
  const isES = language === 'es';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isPT ? "Comandos de Voz" : (isES ? "Comandos de Voz" : "Voice Commands")} maxWidth="max-w-md">
      <div className="pb-6">
        <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 mb-4 flex gap-3 items-start">
            <Mic size={20} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-800 dark:text-indigo-200 leading-relaxed">
                {isPT 
                    ? "Diga o nome do Time ou Jogador para adicionar pontos. O sistema aprende os nomes que você digitou!" 
                    : "Say the Team or Player name to add points. The system learns the names you typed!"}
            </p>
        </div>

        <Section title={isPT ? "Pontuação Básica" : "Basic Scoring"} icon={Zap} colorClass="text-amber-500">
            <CommandRow cmd={isPT ? "Ponto Time A" : "Point Team A"} desc={isPT ? "Adiciona ponto para casa" : "Adds point to home team"} />
            <CommandRow cmd={isPT ? "Ponto Brasil" : "Point [Team Name]"} desc={isPT ? "Usa o nome do time atual" : "Uses dynamic team name"} />
            <CommandRow cmd={isPT ? "Tirar ponto" : "Remove point"} desc={isPT ? "Subtrai do último time falado" : "Subtracts from last mentioned"} />
        </Section>

        <Section title={isPT ? "Estatísticas (Scout)" : "Player Stats"} icon={User} colorClass="text-emerald-500">
            <CommandRow cmd={isPT ? "Ponto do João" : "Point John"} desc={isPT ? "Ponto genérico para o jogador" : "Generic point for player"} />
            <CommandRow cmd={isPT ? "Ace do João" : "Ace John"} desc={isPT ? "Ponto de Saque" : "Service Ace"} />
            <CommandRow cmd={isPT ? "Bloqueio Pedro" : "Block Peter"} desc={isPT ? "Ponto de Bloqueio" : "Kill Block"} />
            <CommandRow cmd={isPT ? "Ataque Lucas" : "Attack Lucas"} desc={isPT ? "Ponto de Ataque" : "Attack Kill"} />
        </Section>

        <Section title={isPT ? "Controle" : "Controls"} icon={RotateCcw} colorClass="text-rose-500">
            <CommandRow cmd={isPT ? "Desfazer / Voltar" : "Undo / Back"} desc={isPT ? "Remove a última ação" : "Reverts last action"} />
            <CommandRow cmd={isPT ? "Tempo / Pausa" : "Timeout"} desc={isPT ? "Pede tempo para o time" : "Calls timeout"} />
            <CommandRow cmd={isPT ? "Troca de Saque" : "Change Server"} desc={isPT ? "Apenas inverte a posse" : "Switches service possession"} />
        </Section>
      </div>
    </Modal>
  );
};
