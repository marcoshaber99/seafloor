'use client'

import dynamic from 'next/dynamic'
import { TimeSlider } from '@/components/ui/TimeSlider'
import { StatsOverlay } from '@/components/ui/StatsOverlay'
import { SearchBar } from '@/components/ui/SearchBar'
import { VesselCard } from '@/components/ui/VesselCard'
import { ColorLegend } from '@/components/ui/ColorLegend'
import { FilterPanel } from '@/components/ui/FilterPanel'

const GlobeScene = dynamic(() => import('@/components/globe/GlobeScene'), {
  ssr: false,
  loading: () => <div className="h-screen w-screen bg-black" />,
})

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <GlobeScene />
      <div className="globe-reveal" />
      <SearchBar />
      <StatsOverlay />
      <VesselCard />
      <FilterPanel />
      <ColorLegend />
      <TimeSlider />
    </main>
  )
}
