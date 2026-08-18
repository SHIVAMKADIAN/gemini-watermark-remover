import { AnimatedSection } from './AnimatedSection'

const tools = [
  'Seedance 2.0',
  'Kling',
  'Veo',
  'Runway',
  'Flow',
  'Midjourney',
  'ElevenLabs',
  'DaVinci Resolve',
  'Premiere Pro',
]

export function About() {
  return (
    <section id="about" className="py-24 md:py-36 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24">
          <AnimatedSection>
            <div>
              <p className="text-accent text-xs font-medium tracking-[0.25em] uppercase mb-4">
                About
              </p>
              <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8">
                Who I <span className="italic">Am</span>
              </h2>
              <div className="space-y-5 text-text-muted text-base leading-relaxed font-light">
                <p>
                  I'm an AI Video Creator and Generative Filmmaker with 2+ years
                  producing promotional and narrative content for brands including
                  Xiaomi, Nykaa, and Allrya AI.
                </p>
                <p>
                  I work across the full AI filmmaking stack — Seedance 2.0,
                  Runway, Kling, Veo, Flow, Higgsfield — handling scripting,
                  prompt engineering, visual direction, and post, end to end.
                </p>
                <p className="text-text-dim text-sm">
                  CS Engineering graduate (Chandigarh University, 2025) with a
                  30% academic scholarship — bringing a technical lens to
                  creative pipelines. Also a national-level U-19 football
                  player.
                </p>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <div>
              <p className="text-text-dim text-xs font-medium tracking-[0.25em] uppercase mb-6">
                Tools & Platforms
              </p>
              <div className="flex flex-wrap gap-3">
                {tools.map((tool) => (
                  <span
                    key={tool}
                    className="px-4 py-2 text-sm text-text-muted border border-border hover:border-accent/30 hover:text-accent transition-all duration-300 cursor-default"
                  >
                    {tool}
                  </span>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-border">
                <p className="text-text-dim text-xs font-medium tracking-[0.25em] uppercase mb-4">
                  Key Numbers
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="font-display text-3xl md:text-4xl font-bold text-text">
                      40<span className="text-accent">%</span>
                    </p>
                    <p className="text-text-dim text-xs mt-1 tracking-wide">
                      Production speed improvement
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-3xl md:text-4xl font-bold text-text">
                      10<span className="text-accent">+</span>
                    </p>
                    <p className="text-text-dim text-xs mt-1 tracking-wide">
                      International clients
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-3xl md:text-4xl font-bold text-text">
                      100<span className="text-accent">%</span>
                    </p>
                    <p className="text-text-dim text-xs mt-1 tracking-wide">
                      On-time delivery rate
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-3xl md:text-4xl font-bold text-text">
                      3
                    </p>
                    <p className="text-text-dim text-xs mt-1 tracking-wide">
                      Xiaomi campaign films
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  )
}
