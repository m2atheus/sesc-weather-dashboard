import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ThemeToggle } from '../src/components/ThemeToggle'

afterEach(() => {
  localStorage.clear()
  document.documentElement.style.colorScheme = ''
})

it('guarda o tema escolhido e volta a seguir o sistema ao escolher o tema dele', () => {
  // jsdom has no matchMedia, so the system theme reads as light.
  render(<ThemeToggle />)
  const toggle = screen.getByRole('button', { name: 'Modo noturno' })
  expect(toggle.getAttribute('aria-pressed')).toBe('false')

  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-pressed')).toBe('true')
  expect(document.documentElement.style.colorScheme).toBe('dark')
  expect(localStorage.getItem('estacao-tema')).toBe('dark')

  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-pressed')).toBe('false')
  expect(document.documentElement.style.colorScheme).toBe('')
  expect(localStorage.getItem('estacao-tema')).toBeNull()
})
