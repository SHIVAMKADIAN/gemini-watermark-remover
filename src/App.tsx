import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { ClientStrip } from './components/ClientStrip'
import { FeaturedWork } from './components/FeaturedWork'
import { WhatIDo } from './components/WhatIDo'
import { About } from './components/About'
import { Timeline } from './components/Timeline'
import { Contact } from './components/Contact'

export default function App() {
  return (
    <div className="bg-bg min-h-screen">
      <Navbar />
      <Hero />
      <ClientStrip />
      <FeaturedWork />
      <WhatIDo />
      <About />
      <Timeline />
      <Contact />
    </div>
  )
}
