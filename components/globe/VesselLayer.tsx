'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '@/lib/store'
import { loadYear } from '@/lib/data-loader'
import { GLOBE_RADIUS, MAX_VESSELS, FIELDS_PER_VESSEL, BINARY_FIELDS } from '@/lib/constants'
import { latLngToVec3 } from '@/lib/geo'
import { co2ToColor } from '@/lib/color'
import vertexShader from '@/shaders/vessel.vert.glsl'
import fragmentShader from '@/shaders/vessel.frag.glsl'

export function VesselLayer() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const year = useStore((s) => s.year)
  const colorMode = useStore((s) => s.colorMode)
  const filters = useStore((s) => s.filters)
  const binary = useStore((s) => s.binaries.get(s.year))
  const setBinary = useStore((s) => s.setBinary)
  const setIndex = useStore((s) => s.setIndex)

  const geometry = useMemo(() => new THREE.CircleGeometry(0.8, 8), [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHoveredIndex: { value: -1 },
    }),
    [],
  )

  const buffers = useMemo(
    () => ({
      instancePosition: new Float32Array(MAX_VESSELS * 3),
      instanceColor: new Float32Array(MAX_VESSELS * 3),
      instanceScale: new Float32Array(MAX_VESSELS),
      instanceOpacity: new Float32Array(MAX_VESSELS),
    }),
    [],
  )

  useEffect(() => {
    if (useStore.getState().binaries.has(year)) return
    loadYear(year).then(({ buffer, index }) => {
      setBinary(year, buffer)
      setIndex(year, index)
    })
  }, [year, setBinary, setIndex])

  useEffect(() => {
    if (!binary || !meshRef.current) return

    const count = binary.length / FIELDS_PER_VESSEL
    const pos = new THREE.Vector3()
    let visible = 0

    for (let i = 0; i < count; i++) {
      const offset = i * FIELDS_PER_VESSEL
      const shipTypeId = binary[offset + BINARY_FIELDS.SHIP_TYPE_ID]
      const flagIsoId = binary[offset + BINARY_FIELDS.FLAG_ISO_ID]

      if (filters.shipTypes.size > 0 && !filters.shipTypes.has(shipTypeId)) continue
      if (filters.flagIsos.size > 0 && !filters.flagIsos.has(flagIsoId)) continue

      latLngToVec3(
        binary[offset + BINARY_FIELDS.LAT],
        binary[offset + BINARY_FIELDS.LNG],
        GLOBE_RADIUS + 0.5,
        pos,
      )
      buffers.instancePosition[visible * 3 + 0] = pos.x
      buffers.instancePosition[visible * 3 + 1] = pos.y
      buffers.instancePosition[visible * 3 + 2] = pos.z

      const [r, g, b] = co2ToColor(binary, offset, colorMode)
      buffers.instanceColor[visible * 3 + 0] = r
      buffers.instanceColor[visible * 3 + 1] = g
      buffers.instanceColor[visible * 3 + 2] = b

      const co2 = binary[offset + BINARY_FIELDS.CO2_TOTAL]
      buffers.instanceScale[visible] = Math.log10(Math.max(co2, 1)) / 5.5
      buffers.instanceOpacity[visible] = 1.0

      visible++
    }

    const mesh = meshRef.current
    mesh.count = visible

    const geom = mesh.geometry
    const setAttr = (name: string, arr: Float32Array, itemSize: number) => {
      const existing = geom.getAttribute(name) as THREE.InstancedBufferAttribute | undefined
      if (existing) {
        existing.set(arr)
        existing.needsUpdate = true
      } else {
        geom.setAttribute(name, new THREE.InstancedBufferAttribute(arr, itemSize))
      }
    }

    setAttr('instancePosition', buffers.instancePosition, 3)
    setAttr('instanceColor', buffers.instanceColor, 3)
    setAttr('instanceScale', buffers.instanceScale, 1)
    setAttr('instanceOpacity', buffers.instanceOpacity, 1)
  }, [binary, colorMode, filters, buffers])

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, MAX_VESSELS]} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  )
}
