'use client'

import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

export function PostProcessing() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={0.55}
        luminanceSmoothing={0.3}
        intensity={0.35}
        mipmapBlur
      />
      <Vignette offset={0.3} darkness={0.5} />
    </EffectComposer>
  )
}
