
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from './Button';
import { useTranslation } from '../../contexts/LanguageContext';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Wrapper to use hook in class component
const ErrorContent: React.FC<{ error: Error | null, onReload: () => void }> = ({ error, onReload }) => {
    const { t } = useTranslation();
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-100 dark:bg-[#020617] text-slate-900 dark:text-slate-100 p-6 text-center">
          <div className="p-4 bg-rose-500/10 rounded-full text-rose-500 mb-4 border border-rose-500/20 shadow-xl shadow-rose-500/10 backdrop-blur-3xl">
            <AlertTriangle size={48} strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight mb-2">{t('errors.genericTitle')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs text-sm leading-relaxed">
            {t('errors.genericMessage')}
          </p>
          <div className="flex gap-4">
             <Button onClick={onReload} size="lg" className="bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20 text-white border-none">
                <RefreshCcw size={18} /> {t('errors.reload')}
             </Button>
          </div>
          <p className="mt-8 text-[10px] font-mono text-slate-400 dark:text-slate-600 opacity-50 max-w-md break-all">
            {error?.message}
          </p>
        </div>
    );
};

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorContent error={this.state.error} onReload={this.handleReload} />;
    }

    return this.props.children;
  }
}
