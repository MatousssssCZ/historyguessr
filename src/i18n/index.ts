import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { resources } from './resources'

export const LANGUAGES = [
  { code: 'cs', label: 'Čeština', short: 'CS' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'de', label: 'Deutsch', short: 'DE' },
] as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['cs', 'en', 'de'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'hg_lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

/** Locale pro formátování čísel/dat podle aktuálního jazyka */
export function currentLocale(): string {
  const lng = (i18n.language || 'en').slice(0, 2)
  return lng === 'cs' ? 'cs-CZ' : lng === 'de' ? 'de-DE' : 'en-US'
}

export function setLanguage(code: string) {
  i18n.changeLanguage(code)
}

export default i18n
