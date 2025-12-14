
import React from 'react';
import { 
  Trophy, Hand, Users, Edit3, UserCircle, RefreshCw, Scale, 
  Layout, MousePointerClick, History, FileText, PieChart, Activity, Mic, List, Settings, Volume2, ArrowRightLeft, Layers
} from 'lucide-react';

export interface TutorialStep {
  id: string;
  titleKey: string;
  descKey: string;
  icon: any;
  color: string; // Tailwind color class for the graphic header (e.g. 'indigo', 'rose')
  visualId?: string; // Links to TutorialVisuals.tsx
  CustomComponent?: React.ReactNode;
}

export const TUTORIAL_SCENARIOS: Record<string, TutorialStep[]> = {
  // A. ONBOARDING (PANORAMA GERAL)
  main: [
    { 
      id: 'welcome', 
      titleKey: 'tutorial.welcome.title', 
      descKey: 'tutorial.welcome.desc', 
      icon: Trophy, 
      color: 'indigo',
      visualId: 'app_logo' 
    },
    { 
      id: 'gestures', 
      titleKey: 'tutorial.gestures.title', 
      descKey: 'tutorial.gestures.desc', 
      icon: Hand, 
      color: 'violet',
      visualId: 'gestures'
    },
    { 
      id: 'config', 
      titleKey: 'tutorial.main.config.title', 
      descKey: 'tutorial.main.config.desc', 
      icon: Settings, 
      color: 'slate',
      visualId: 'settings_config' 
    },
    {
      id: 'voice',
      titleKey: 'tutorial.voice.title',
      descKey: 'tutorial.voice.desc',
      icon: Mic,
      color: 'sky',
      visualId: 'voice_control'
    },
    {
      id: 'narrator',
      titleKey: 'tutorial.main.narrator.title',
      descKey: 'tutorial.main.narrator.desc',
      icon: Volume2,
      color: 'pink',
      visualId: 'audio_narrator'
    }
  ],

  // B. TEAM MANAGER (DETALHADO)
  manager: [
    { 
      id: 'intro', 
      titleKey: 'tutorial.manager.intro.title', 
      descKey: 'tutorial.manager.intro.desc', 
      icon: Users, 
      color: 'indigo',
      visualId: 'team_management'
    },
    { 
      id: 'structure', 
      titleKey: 'tutorial.manager.structure.title', 
      descKey: 'tutorial.manager.structure.desc', 
      icon: Layers, 
      color: 'slate',
      visualId: 'drag_and_drop'
    },
    { 
      id: 'profiles', 
      titleKey: 'tutorial.manager.profiles.title', 
      descKey: 'tutorial.manager.profiles.desc', 
      icon: UserCircle, 
      color: 'violet',
      visualId: 'player_profile'
    },
    { 
      id: 'subs', 
      titleKey: 'tutorial.manager.subs.title', 
      descKey: 'tutorial.manager.subs.desc', 
      icon: ArrowRightLeft, 
      color: 'emerald',
      visualId: 'substitutions'
    },
    { 
      id: 'rotation', 
      titleKey: 'tutorial.manager.rotation.title', 
      descKey: 'tutorial.manager.rotation.desc', 
      icon: RefreshCw, 
      color: 'rose',
      visualId: 'rotations'
    },
    { 
      id: 'balance', 
      titleKey: 'tutorial.manager.balance.title', 
      descKey: 'tutorial.manager.balance.desc', 
      icon: Scale, 
      color: 'amber',
      visualId: 'skill_balance_v2'
    },
    {
      id: 'batch',
      titleKey: 'tutorial.manager.batch.title', 
      descKey: 'tutorial.manager.batch.desc', 
      icon: List,
      color: 'cyan',
      visualId: 'batch_input'
    }
  ],

  // C. HISTORY (ANÁLISE DE DADOS)
  history: [
    { 
      id: 'summary', 
      titleKey: 'tutorial.history.summary.title', 
      descKey: 'tutorial.history.summary.desc', 
      icon: History, 
      color: 'slate',
      visualId: 'history_analytics'
    },
    { 
      id: 'timeline', 
      titleKey: 'tutorial.history.timeline.title', 
      descKey: 'tutorial.history.timeline.desc', 
      icon: FileText, 
      color: 'indigo',
      visualId: 'history_timeline'
    },
    { 
      id: 'stats', 
      titleKey: 'tutorial.history.stats', 
      descKey: 'tutorial.history.statsDesc', 
      icon: PieChart, 
      color: 'amber',
      visualId: 'scout_mode_advanced'
    },
    {
      id: 'export',
      titleKey: 'tutorial.history.export.title',
      descKey: 'tutorial.history.export.desc', 
      icon: Activity,
      color: 'emerald',
      visualId: 'export_data'
    }
  ]
};
