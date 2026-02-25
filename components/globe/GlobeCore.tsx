'use client'

import { useMemo } from 'react'
import ThreeGlobe from 'three-globe'
import * as THREE from 'three'

export function GlobeCore() {
  const globe = useMemo(() => {
    const g = new ThreeGlobe({ animateIn: false })

    g.globeImageUrl('/textures/earth-night.jpg')
      .bumpImageUrl('/textures/earth-topology.png')
      .showAtmosphere(true)
      .atmosphereColor('#1a3a5c')
      .atmosphereAltitude(0.15)

    g.onGlobeReady(() => {
      g.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshPhongMaterial
          if (mat.emissive) mat.emissive.set(0x000000)
        }
      })
    })

    fetch('/geojson/ne_110m_countries.geojson')
      .then((r) => r.json())
      .then((countries) => {
        g.polygonsData(countries.features)
          .polygonCapColor(() => 'rgba(0,0,0,0)')
          .polygonSideColor(() => 'rgba(0,0,0,0)')
          .polygonStrokeColor(() => 'rgba(100, 140, 200, 0.25)')
          .polygonAltitude(0.001)
      })

    return g
  }, [])

  return <primitive object={globe} />
}
