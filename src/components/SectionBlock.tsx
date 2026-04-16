import type { ReactNode } from 'react'

type SectionBlockProps = {
  title: string
  subtitle?: string
  count?: number
  children: ReactNode
}

export function SectionBlock({
  title,
  subtitle,
  count,
  children,
}: SectionBlockProps) {
  return (
    <section className="section-block">
      <header className="section-heading">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {typeof count === 'number' ? <span className="section-count">{count}</span> : null}
      </header>

      {children}
    </section>
  )
}
