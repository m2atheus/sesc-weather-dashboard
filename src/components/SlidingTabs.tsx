import { useLayoutEffect, useRef, type ReactNode } from 'react'

type Props = {
  label: string
  className: string
  selection: string | number
  children: ReactNode
}

function positionIndicator(indicator: HTMLSpanElement, animate: boolean) {
  const active = indicator.parentElement?.querySelector<HTMLElement>(
    'a[aria-current="page"], button[aria-pressed="true"]',
  )
  if (!active) {
    indicator.hidden = true
    return
  }
  const snap = !animate || indicator.hidden
  indicator.hidden = false

  const transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`
  const width = active.offsetWidth + 'px'
  const height = active.offsetHeight + 'px'
  if (
    indicator.style.transform === transform &&
    indicator.style.width === width &&
    indicator.style.height === height
  )
    return

  if (snap) indicator.style.transition = 'none'
  indicator.style.transform = transform
  indicator.style.width = width
  indicator.style.height = height
  if (snap) {
    void indicator.offsetWidth
    indicator.style.removeProperty('transition')
  }
}

export function SlidingIndicator({ selection }: Pick<Props, 'selection'>) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const indicator = ref.current!
    const group = indicator.parentElement!
    const snap = () => positionIndicator(indicator, false)
    snap()
    const observer = new ResizeObserver(snap)
    observer.observe(group)
    group
      .querySelectorAll('a, button')
      .forEach((item) => observer.observe(item))
    window.addEventListener('resize', snap)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', snap)
    }
  }, [])

  useLayoutEffect(() => {
    positionIndicator(ref.current!, true)
  }, [selection])

  return <span ref={ref} className="t-tabs-pill" aria-hidden="true" />
}

export function SlidingTabs({ label, className, selection, children }: Props) {
  return (
    <div
      role="group"
      aria-label={label}
      className={'t-tabs ' + className}
    >
      <SlidingIndicator selection={selection} />
      {children}
    </div>
  )
}
