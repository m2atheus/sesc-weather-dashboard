import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Moon, Sun } from 'lucide-react'

const storageKey = 'estacao-tema'
const systemTheme = () => window.matchMedia?.('(prefers-color-scheme: dark)')
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function isDark() {
  const scheme = document.documentElement.style.colorScheme
  return scheme ? scheme === 'dark' : Boolean(systemTheme()?.matches)
}

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown
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
    // Picking the system's own theme drops the override, so the page follows
    // later system changes again (for example, automatic switching at night).
    const followsSystem = (theme === 'dark') === Boolean(systemTheme()?.matches)
    const root = document.documentElement
    function apply() {
      root.classList.add('theme-switching')
      root.style.colorScheme = followsSystem ? '' : theme
      flushSync(() => setDark(theme === 'dark'))
      // Restore transitions only after the new colors have painted.
      const release = () => root.classList.remove('theme-switching')
      if (window.requestAnimationFrame) requestAnimationFrame(() => requestAnimationFrame(release))
      else setTimeout(release)
    }
    try {
      if (followsSystem) localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, theme)
    } catch {
      // The choice still applies to the open page when storage is unavailable.
    }
    const transition = document as TransitionDocument
    if (transition.startViewTransition && !reducedMotion()) transition.startViewTransition(apply)
    else apply()
  }

  return (
    <button type="button" className="theme-toggle" aria-label="Modo noturno"
      aria-pressed={dark} title={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={toggle}>
      {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
    </button>
  )
}
