import { z } from 'zod';

export const narrationLanguages = ['en', 'zu', 'xh', 'sw', 'yo', 'ha', 'af', 'fr', 'pt'] as const;
export const narrationLanguageSchema = z.enum(narrationLanguages);
export type NarrationLanguage = z.infer<typeof narrationLanguageSchema>;
export type LanguageFilter = NarrationLanguage | 'ALL';
export const languageLabels: Record<NarrationLanguage, string> = {
  en: 'English', zu: 'isiZulu', xh: 'isiXhosa', sw: 'Swahili', yo: 'Yoruba',
  ha: 'Hausa', af: 'Afrikaans', fr: 'French', pt: 'Portuguese',
};
export const languageOptions = narrationLanguages.map(value => ({ value, label: languageLabels[value] }));
export const unverifiedVoiceLanguages: readonly string[] = ['zu', 'xh', 'yo', 'ha'];
