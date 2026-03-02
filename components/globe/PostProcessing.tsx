'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import type { BloomEffect } from 'postprocessing'

export function PostProcessing() {
  const bloomRef = useRef<BloomEffect>(null!)

  useFrame(({ camera }) => {
    if (!bloomRef.current) return
    const dist = camera.position.length()
    const t = Math.max(0, Math.min(1, (dist - 120) / (400 - 120)))
    bloomRef.current.intensity = 0.06 + t * 0.18
  })

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef}
        luminanceThreshold={0.65}
        luminanceSmoothing={0.25}
        intensity={0.2}
        mipmapBlur
      />
      <Vignette offset={0.3} darkness={0.5} />
    </EffectComposer>
  )
}
