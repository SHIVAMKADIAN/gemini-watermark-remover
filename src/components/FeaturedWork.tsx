import { useState } from 'react'
import { motion } from 'framer-motion'
import { AnimatedSection } from './AnimatedSection'

interface Project {
  title: string
  description: string
  format: string
  gradient: string
}

const projects: Project[] = [
  {
    title: 'Xiaomi Service Center Campaign',
    description: '3-film promotional series, cinematic product storytelling',
    format: 'Brand Film',
    gradient: 'from-amber-900/30 to-stone-900/30',
  },
  {
    title: 'Nykaa Fashion',
    description: 'Social-first AI content optimized for Instagram & TikTok',
    format: 'Social / UGC',
    gradient: 'from-rose-900/30 to-stone-900/30',
  },
  {
    title: 'Allrya AI',
    description: 'AI-generated brand content for next-gen creative platform',
    format: 'Brand Film',
    gradient: 'from-cyan-900/30 to-stone-900/30',
  },
  {
    title: 'APEX',
    description: 'Original aviation drama micro-series',
    format: 'Web Series',
    gradient: 'from-blue-900/30 to-stone-900/30',
  },
  {
    title: 'Off Limits',
    description: 'Campus thriller-romance series concept reel',
    format: 'Web Series',
    gradient: 'from-violet-900/30 to-stone-900/30',
  },
  {
    title: 'Arabic AI Music Video',
    description: 'Cultural aesthetic blended with AI generation',
    format: 'Music Video',
    gradient: 'from-orange-900/30 to-stone-900/30',
  },
]

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const [hovered, setHovered] = useState(false)

  return (
    <AnimatedSection delay={index * 0.1}>
      <motion.div
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className="group relative cursor-pointer"
      >
        <div
          className={`relative aspect-[16/10] bg-gradient-to-br ${project.gradient} overflow-hidden border border-border`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-6">
              <div className="w-16 h-16 mx-auto mb-4 border border-border rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-text-dim"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                  />
                </svg>
              </div>
              <p className="text-text-dim text-xs tracking-[0.2em] uppercase">
                Reel coming soon
              </p>
            </div>
          </div>

          <motion.div
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-bg/60 backdrop-blur-sm flex items-end p-6"
          >
            <div>
              <span className="inline-block text-accent text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 border border-accent/30 px-2 py-0.5">
                {project.format}
              </span>
              <p className="text-text text-sm font-light leading-relaxed">
                {project.description}
              </p>
            </div>
          </motion.div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <h3 className="font-display text-lg md:text-xl font-medium text-text group-hover:text-accent transition-colors">
            {project.title}
          </h3>
          <span className="text-text-dim text-xs tracking-[0.15em] uppercase hidden sm:block">
            {project.format}
          </span>
        </div>
      </motion.div>
    </AnimatedSection>
  )
}

export function FeaturedWork() {
  return (
    <section id="work" className="py-24 md:py-36">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <AnimatedSection>
          <div className="flex items-end justify-between mb-16 md:mb-20">
            <div>
              <p className="text-accent text-xs font-medium tracking-[0.25em] uppercase mb-4">
                Selected Projects
              </p>
              <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Featured <span className="italic">Work</span>
              </h2>
            </div>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
          {projects.map((project, i) => (
            <ProjectCard key={project.title} project={project} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
