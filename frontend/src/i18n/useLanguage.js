import { createContext, useContext, useMemo, useState, createElement } from 'react'
import { dictionaries, supportedLanguages } from './dict'

const STORAGE_KEY = 'language'
const DEFAULT_LANGUAGE = 'en'

const LanguageContext = createContext(null)

const getByPath = (obj, path) => {
  return path.split('.').reduce((acc, segment) => acc?.[segment], obj)
}

const formatMessage = (message, params = {}) => {
  if (typeof message !== 'string') {
    return message
  }

  return message.replace(/\{(\w+)\}/g, (_match, key) => {
    return params[key] ?? ''
  })
}

export const normalizeLanguage = (value) => {
  if (!value || typeof value !== 'string') {
    return DEFAULT_LANGUAGE
  }

  const normalized = value.toLowerCase().split('-')[0]
  return supportedLanguages.includes(normalized) ? normalized : DEFAULT_LANGUAGE
}

export const detectInitialLanguage = () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    return normalizeLanguage(saved)
  }

  return normalizeLanguage(navigator.language)
}

let activeLanguage = typeof window === 'undefined' ? DEFAULT_LANGUAGE : detectInitialLanguage()

export const getCurrentLanguage = () => activeLanguage

export const setCurrentLanguage = (language) => {
  const normalized = normalizeLanguage(language)
  activeLanguage = normalized
  localStorage.setItem(STORAGE_KEY, normalized)
  return normalized
}

export const translate = (key, params = {}, language = activeLanguage) => {
  const normalized = normalizeLanguage(language)
  const message = getByPath(dictionaries[normalized], key) ?? getByPath(dictionaries[DEFAULT_LANGUAGE], key) ?? key
  return formatMessage(message, params)
}

export const getLanguageLocale = (language = activeLanguage) => {
  const normalized = normalizeLanguage(language)
  return dictionaries[normalized]?.locale ?? dictionaries[DEFAULT_LANGUAGE].locale
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => activeLanguage)

  const setLanguageAndPersist = (nextLanguage) => {
    const normalized = setCurrentLanguage(nextLanguage)
    setLanguage(normalized)
  }

  const value = useMemo(() => {
    return {
      language,
      locale: getLanguageLocale(language),
      setLanguage: setLanguageAndPersist,
      t: (key, params = {}) => translate(key, params, language),
    }
  }, [language])

  return createElement(LanguageContext.Provider, { value }, children)
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
