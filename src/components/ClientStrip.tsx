import { AnimatedSection } from './AnimatedSection'

const clients = ['Xiaomi', 'Nykaa Fashion', 'Allrya AI', 'Zingroll']

export function ClientStrip() {
  return (
    <section className="py-16 md:py-24 border-y border-border">
      <AnimatedSection>
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 md:gap-x-20">
            {clients.map((client) => (
              <span
                key={client}
                className="text-text-dim text-sm md:text-base font-medium tracking-[0.15em] uppercase whitespace-nowrap"
              >
                {client}
              </span>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </section>
  )
}
