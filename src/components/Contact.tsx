import { AnimatedSection } from './AnimatedSection'

export function Contact() {
  return (
    <section id="contact" className="py-24 md:py-36 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <AnimatedSection>
          <div className="max-w-3xl">
            <p className="text-accent text-xs font-medium tracking-[0.25em] uppercase mb-4">
              Get in Touch
            </p>
            <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8">
              Let's <span className="italic">Make</span>
              <br />
              Something.
            </h2>
            <p className="text-text-muted text-base md:text-lg font-light leading-relaxed mb-12 max-w-xl">
              Open for brand collaborations, series projects, and creative
              partnerships. Based in India, working remotely worldwide.
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-16">
            <a
              href="mailto:shivamkadian17@gmail.com"
              className="group p-6 border border-border hover:border-accent/30 transition-all duration-300"
            >
              <p className="text-text-dim text-xs tracking-[0.15em] uppercase mb-3">
                Email
              </p>
              <p className="text-text text-sm group-hover:text-accent transition-colors break-all">
                shivamkadian17@gmail.com
              </p>
            </a>

            <a
              href="tel:+918952018784"
              className="group p-6 border border-border hover:border-accent/30 transition-all duration-300"
            >
              <p className="text-text-dim text-xs tracking-[0.15em] uppercase mb-3">
                Phone / WhatsApp
              </p>
              <p className="text-text text-sm group-hover:text-accent transition-colors">
                +91-8952018784
              </p>
            </a>

            <a
              href="https://linkedin.com/in/shivam-kumar-5b5ab41bb"
              target="_blank"
              rel="noopener noreferrer"
              className="group p-6 border border-border hover:border-accent/30 transition-all duration-300"
            >
              <p className="text-text-dim text-xs tracking-[0.15em] uppercase mb-3">
                LinkedIn
              </p>
              <p className="text-text text-sm group-hover:text-accent transition-colors flex items-center gap-1.5">
                Shivam Kumar
                <svg
                  className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                  />
                </svg>
              </p>
            </a>

            <div className="p-6 border border-border">
              <p className="text-text-dim text-xs tracking-[0.15em] uppercase mb-3">
                Location
              </p>
              <p className="text-text text-sm">India (Remote-ready)</p>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.3}>
          <footer className="pt-12 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <a
              href="#"
              className="font-display text-lg font-bold text-text hover:text-accent transition-colors"
            >
              Shivam<span className="italic text-accent">.</span>
            </a>
            <p className="text-text-dim text-xs tracking-wide">
              &copy; {new Date().getFullYear()} Shivam Kumar. All rights
              reserved.
            </p>
          </footer>
        </AnimatedSection>
      </div>
    </section>
  )
}
