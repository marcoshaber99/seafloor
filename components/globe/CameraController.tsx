'use client'

import { OrbitControls } from '@react-three/drei'

export function CameraController() {
  return (
    <OrbitControls
      makeDefault
      autoRotate
      autoRotateSpeed={0.4}
      enableDamping
      dampingFactor={0.05}
      minDistance={120}
      maxDistance={600}
      enablePan={false}
    />
  )
}
