
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

export const useNativeIntegration = (
    isMatchActive: boolean,
    isFullscreen: boolean,
    onBackAction: () => void,
    modalsOpen: boolean
) => {
    const isNative = Capacitor.isNativePlatform();

    useEffect(() => {
        if (isNative) {
            const initNative = async () => {
                try {
                    // StatusBar: Estilo escuro e transparente para efeito Edge-to-Edge
                    await StatusBar.setStyle({ style: Style.Dark });
                    if (Capacitor.getPlatform() === 'android') {
                        await StatusBar.setOverlaysWebView({ overlay: true });
                        await StatusBar.setBackgroundColor({ color: '#00000000' });
                    }
                    
                    // Teclado: Não redimensionar a UI para evitar quebras no layout do placar
                    if (Capacitor.getPlatform() === 'ios') {
                        await Keyboard.setResizeMode({ mode: KeyboardResize.None });
                    }

                    // Esconder Splash Screen após a app carregar
                    setTimeout(async () => {
                        await SplashScreen.hide();
                    }, 500);
                } catch (e) {
                    console.warn("[NativeIntegration] Erro ao inicializar plugins nativos:", e);
                }
            };
            initNative();
        }
    }, [isNative]);

    // Bloqueio de Orientação Dinâmico
    useEffect(() => {
        if (isNative) {
            const lockOrientation = async () => {
                try {
                    if (isFullscreen) {
                        await ScreenOrientation.lock({ orientation: 'landscape' });
                    } else {
                        await ScreenOrientation.lock({ orientation: 'portrait' });
                    }
                } catch (e) {
                    console.debug("[NativeIntegration] ScreenOrientation não suportado.");
                }
            };
            lockOrientation();
        }
    }, [isFullscreen, isNative]);

    // Manipulação do Botão de Voltar (Android)
    useEffect(() => {
        if (!isNative) return;

        const listener = CapApp.addListener('backButton', ({ canGoBack }) => {
            if (modalsOpen) {
                onBackAction();
                return;
            }

            if (isMatchActive) {
                // Em jogo ativo, apenas minimizamos para evitar fechar por erro
                CapApp.minimizeApp();
            } else if (!canGoBack) {
                CapApp.exitApp();
            }
        });

        return () => {
            listener.then(l => l.remove());
        };
    }, [isNative, isMatchActive, modalsOpen, onBackAction]);
};
