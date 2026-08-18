import { AnimatedSection } from './AnimatedSection'

const milestones = [
  {
    year: '2026',
    title: 'Zingroll',
    role: 'AI Filmmaker',
    description:
      'Leading end-to-end AI film pipelines with ElevenLabs sound design.',
  },
  {
    year: '2025–26',
    title: 'Vrozart',
    role: 'AI Video Creator & Business Analyst',
    description:
      'Built multi-model pipelines (Weavy, Midjourney, Runway, Kling, Veo, Higgsfield, Seedance) improving production speed 40%.',
  },
  {
    year: '2024',
    title: 'Freelance',
    role: 'AI Video Creator',
    description:
      '10+ concurrent international client projects, 100% on-time delivery.',
  },
  {
    year: '2021–25',
    title: 'Chandigarh University',
    role: 'B.E. Computer Science Engineering',
    description: '30% academic scholarship. Technical foundation for creative pipelines.',
  },
]

export function Timeline() {
  return (
    <section className="py-24 md:py-36 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <AnimatedSection>
          <p className="text-accent text-xs font-medium tracking-[0.25em] uppercase mb-4">
            Journey
          </p>
          <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-16 md:mb-20">
            We've been up to <span className="italic">cool things</span>
          </h2>
        </AnimatedSection>

        <div className="space-y-0">
          {milestones.map((milestone, i) => (
            <AnimatedSection key={milestone.year} delay={i * 0.1}>
              <div className="group grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4 md:gap-12 py-8 md:py-10 border-b border-border hover:border-accent/30 transition-colors duration-500">
                <div className="flex-shrink-0">
                  <span className="font-display text-xl md:text-2xl font-bold text-accent">
                    {milestone.year}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-xl md:text-2xl font-semibold text-text mb-1">
                    {milestone.title}
                  </h3>
                  <p className="text-text-dim text-sm tracking-wide mb-3">
                    {milestone.role}
                  </p>
                  <p className="text-text-muted text-sm md:text-base font-light leading-relaxed max-w-2xl">
                    {milestone.description}
                  </p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  )
}
