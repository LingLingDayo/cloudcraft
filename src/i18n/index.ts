/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { useGameStore } from '@store/useGameStore';
import { zh } from './locales/zh';
import { en } from './locales/en';

export const translations: Record<string, any> = {
  zh,
  en,
};

export type LanguageType = 'zh' | 'en';

export const useTranslation = () => {
  const language = useGameStore((state) => state.language);
  
  const t = useCallback((keyPath: string, variables?: Record<string, string | number>) => {
    const keys = keyPath.split('.');
    let translation: any = translations[language] || translations.zh;
    
    for (const key of keys) {
      if (translation && translation[key] !== undefined) {
        translation = translation[key];
      } else {
        // Fallback to Chinese
        let fallback: any = translations.zh;
        for (const fKey of keys) {
          if (fallback && fallback[fKey] !== undefined) {
            fallback = fallback[fKey];
          } else {
            fallback = keyPath;
            break;
          }
        }
        translation = fallback;
        break;
      }
    }
    
    if (typeof translation === 'string') {
      let result = translation;
      if (variables) {
        Object.entries(variables).forEach(([k, v]) => {
          result = result.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        });
      }
      return result;
    }
    
    return keyPath;
  }, [language]);
  
  return { t, language };
};
