'use client'

import { useRef, useEffect } from 'react'
import { CameraControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '@/lib/store'
import { GLOBE_RADIUS, FIELDS_PER_VESSEL, BINARY_FIELDS } from '@/lib/constants'
import { latLngToVec3 } from '@/lib/geo'

const _vesselPos = new THREE.Vector3()
const AUTO_ROTATE_SPEED = (2 * Math.PI * 0.4) / 60
const MIN_DIST = 120
const MAX_DIST = 600
const MIN_ROTATE_SPEED = 0.15
const MAX_ROTATE_SPEED = 1.0

export function CameraController() {
  const controlsRef = useRef<CameraControls>(null)
  const autoRotateRef = useRef(true)
  const animatingRef = useRef(false)
  const selectedVessel = useStore((s) => s.selectedVessel)

  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    c.mouseButtons.right = 0
    c.touches.three = 0

    const stopRotate = () => useStore.getState().setAutoRotate(false)
    c.addEventListener('controlstart', stopRotate)
    return () => c.removeEventListener('controlstart', stopRotate)
  }, [])

  useEffect(() => {
    return useStore.subscribe((s) => {
      autoRotateRef.current = s.autoRotate
    })
  }, [])

  useFrame((_, delta) => {
    const c = controlsRef.current
    if (!c) return

    const dist = c.distance
    const t = THREE.MathUtils.clamp((dist - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1)
    const speed = THREE.MathUtils.lerp(MIN_ROTATE_SPEED, MAX_ROTATE_SPEED, t)
    c.azimuthRotateSpeed = speed
    c.polarRotateSpeed = speed

    if (!animatingRef.current && autoRotateRef.current) {
      c.rotate(AUTO_ROTATE_SPEED * delta, 0, false)
    }
  })

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || selectedVessel === null) return

    const { binaries, year } = useStore.getState()
    const binary = binaries.get(year)
    if (!binary) return

    const offset = selectedVessel * FIELDS_PER_VESSEL
    const lat = binary[offset + BINARY_FIELDS.LAT]
    const lng = binary[offset + BINARY_FIELDS.LNG]

    latLngToVec3(lat, lng, GLOBE_RADIUS, _vesselPos)

    const azimuth = Math.atan2(_vesselPos.x, _vesselPos.z)
    const polar = Math.acos(
      THREE.MathUtils.clamp(_vesselPos.y / GLOBE_RADIUS, -1, 1),
    )

    animatingRef.current = true
    controls.rotateTo(azimuth, polar, true).then(() => {
      animatingRef.current = false
    })
  }, [selectedVessel])

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={0.8}
      draggingSmoothTime={0.125}
      minDistance={120}
      maxDistance={600}
    />
  )
}
