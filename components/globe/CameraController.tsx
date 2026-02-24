'use client'

import { OrbitControls } from '@react-three/drei'
import { useStore } from '@/lib/store'

export function CameraController() {
  const autoRotate = useStore((s) => s.autoRotate)

  return (
    <OrbitControls
      makeDefault
      autoRotate={autoRotate}
      autoRotateSpeed={0.4}
      enableDamping
      dampingFactor={0.05}
      minDistance={120}
      maxDistance={600}
      enablePan={false}
    />
  )
}
