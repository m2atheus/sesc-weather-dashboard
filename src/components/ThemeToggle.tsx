import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const storageKey = 'estacao-tema'
const systemTheme = () => window.matchMedia?.('(prefers-color-scheme: dark)')

function isDark() {
  const scheme = document.documentElement.style.colorScheme
  return scheme ? scheme === 'dark' : Boolean(systemTheme()?.matches)
}

export function ThemeToggle() {
  const [dark, setDark] = useState(isDark)

  useEffect(() => {
    const media = systemTheme()
    const sync = () => setDark(isDark())
    function onStorage(event: StorageEvent) {
      if (event.storageArea !== window.localStorage || (event.key !== storageKey && event.key !== null)) return
      const value = event.newValue
      document.documentElement.style.colorScheme = value === 'dark' || value === 'light' ? value : ''
      sync()
    }
    sync()
    media?.addEventListener('change', sync)
    window.addEventListener('storage', onStorage)
    return () => {
      media?.removeEventListener('change', sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  function toggle() {
    const theme = isDark() ? 'light' : 'dark'
    document.documentElement.style.colorScheme = theme
    setDark(theme === 'dark')
    try {
      localStorage.setItem(storageKey, theme)
    } catch {
      // The choice still applies to the open page when storage is unavailable.
    }
  }

  return (
    <button type="button" className="theme-toggle" aria-label="Modo noturno"
      aria-pressed={dark} title={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={toggle}>
      {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
    </button>
  )
}
