import { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { BatchPage } from './pages/BatchPage'
import { ImagePage } from './pages/ImagePage'
import { VideoPage } from './pages/VideoPage'
import { revokeAllTrackedObjectUrls } from './utils/objectUrl'

export type AppTab = 'image' | 'video' | 'batch'

function App() {
  const [tab, setTab] = useState<AppTab>('image')

  useEffect(() => {
    return () => revokeAllTrackedObjectUrls()
  }, [])

  return (
    <div className="min-h-screen bg-surface-0">
      <Header activeTab={tab} onTabChange={setTab} />
      <main>
        {tab === 'image' && <ImagePage />}
        {tab === 'video' && <VideoPage />}
        {tab === 'batch' && <BatchPage />}
      </main>
      <footer className="border-t border-border-subtle/60 px-6 py-8 text-center text-xs text-text-muted">
        OmniClean · A local-first tool for media you own or are authorized to edit. Nothing is uploaded.
      </footer>
    </div>
  )
}

export default App
