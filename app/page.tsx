'use client'

import dynamic from 'next/dynamic'
import { TimeSlider } from '@/components/ui/TimeSlider'

const GlobeScene = dynamic(() => import('@/components/globe/GlobeScene'), {
  ssr: false,
  loading: () => <div className="h-screen w-screen bg-black" />,
})

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <GlobeScene />
      <TimeSlider />
    </main>
  )
}
