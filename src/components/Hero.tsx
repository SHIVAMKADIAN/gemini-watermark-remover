interface HeroProps {
  title: string
  subtitle: string
}

export function Hero({ title, subtitle }: HeroProps) {
  return (
    <div className="mx-auto max-w-2xl px-6 pt-14 pb-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">{title}</h1>
      <p className="mx-auto mt-3 max-w-lg text-balance text-[15px] leading-relaxed text-text-secondary">{subtitle}</p>
    </div>
  )
}
