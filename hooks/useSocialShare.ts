
import { useCallback, useState } from 'react';
import { toPng } from 'html-to-image';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export const useSocialShare = () => {
  const [isSharing, setIsSharing] = useState(false);

  const generateImage = async (): Promise<string> => {
      const element = document.getElementById('social-share-card');
      if (!element) throw new Error('Card element not found');
      // pixelRatio 2 offers good balance of quality vs memory usage on mobile
      return await toPng(element, { cacheBust: true, pixelRatio: 2 });
  };

  const shareMatch = useCallback(async () => {
    try {
      setIsSharing(true);
      const dataUrl = await generateImage();

      if (Capacitor.isNativePlatform()) {
        const fileName = `volleyscore-result-${Date.now()}.png`;
        const base64Data = dataUrl.split(',')[1];

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true 
        });

        await Share.share({
          title: 'Match Result',
          files: [savedFile.uri], 
        });

      } else {
        if (navigator.share) {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], 'match-result.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'VolleyScore Pro' });
            return;
          }
        }
        // Fallback if share API not supported
        const link = document.createElement('a');
        link.download = `volleyscore-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error('Share error:', error);
    } finally {
      setIsSharing(false);
    }
  }, []);

  const downloadMatch = useCallback(async () => {
      try {
          setIsSharing(true); // Re-use state to show loading spinner
          const dataUrl = await generateImage();
          const fileName = `volleyscore-${Date.now()}.png`;

          if (Capacitor.isNativePlatform()) {
              // Native: Save to Documents so user can access it
              const base64Data = dataUrl.split(',')[1];
              await Filesystem.writeFile({
                  path: fileName,
                  data: base64Data,
                  directory: Directory.Documents,
                  recursive: true
              });
              // We could show a Toast here in the UI layer
              console.log("Saved to Documents");
          } else {
              // Web: Trigger download
              const link = document.createElement('a');
              link.download = fileName;
              link.href = dataUrl;
              link.click();
          }
      } catch (error) {
          console.error('Download error:', error);
      } finally {
          setIsSharing(false);
      }
  }, []);

  return { shareMatch, downloadMatch, isSharing };
};
