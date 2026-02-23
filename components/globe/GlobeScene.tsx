'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { GlobeCore } from './GlobeCore'
import { VesselLayer } from './VesselLayer'
import { CameraController } from './CameraController'
import { PostProcessing } from './PostProcessing'

export default function GlobeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 300], fov: 50, near: 1, far: 2000 }}
      dpr={[1, 2]}
      flat
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#000008']} />
      <ambientLight intensity={1.0} />
      <directionalLight position={[100, 100, 100]} intensity={1.0} />

      <Suspense fallback={null}>
        <GlobeCore />
        <VesselLayer />
      </Suspense>

      <CameraController />
      <PostProcessing />
    </Canvas>
  )
}
