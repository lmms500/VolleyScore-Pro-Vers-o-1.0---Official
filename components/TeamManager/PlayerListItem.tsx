
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Player, PlayerProfile } from '../../types';
import { PlayerCard } from '../PlayerCard';
import { staggerItem } from '../../utils/animations';

interface PlayerListItemProps {
    player: Player;
    locationId: string;
    profile?: PlayerProfile;
    onUpdatePlayer: (id: string, updates: Partial<Player>) => void;
    onSaveProfile: (id: string, overrides: any) => void;
    onRequestProfileEdit: (id: string) => void;
    onViewProfile: (id: string) => void;
    onToggleMenu: (id: string, target: HTMLElement) => void;
    isMenuActive: boolean;
    onShowToast: (msg: string, type: 'success' | 'info' | 'error') => void;
    isCompact?: boolean;
    activeNumberId: string | null;
    onRequestEditNumber: (id: string) => void;
}

export const PlayerListItem = memo((props: PlayerListItemProps) => {
    return (
        <motion.div 
            layout
            variants={staggerItem}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full"
        >
            <PlayerCard 
                player={props.player}
                locationId={props.locationId}
                profile={props.profile}
                onUpdatePlayer={props.onUpdatePlayer}
                onSaveProfile={props.onSaveProfile}
                onRequestProfileEdit={props.onRequestProfileEdit}
                onViewProfile={props.onViewProfile}
                onToggleMenu={props.onToggleMenu}
                isMenuActive={props.isMenuActive}
                onShowToast={props.onShowToast}
                isCompact={props.isCompact}
                activeNumberId={props.activeNumberId}
                onRequestEditNumber={props.onRequestEditNumber}
            />
        </motion.div>
    );
});
