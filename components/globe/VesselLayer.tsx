'use client'

import { useRef, useMemo, useEffect, useCallback } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '@/lib/store'
import { loadYear } from '@/lib/data-loader'
import { GLOBE_RADIUS, MAX_VESSELS, FIELDS_PER_VESSEL, BINARY_FIELDS } from '@/lib/constants'
import { latLngToVec3 } from '@/lib/geo'
import { co2ToColor } from '@/lib/color'
import vertexShader from '@/shaders/vessel.vert.glsl'
import fragmentShader from '@/shaders/vessel.frag.glsl'

const _v = new THREE.Vector3()

function vesselRaycast(
  this: THREE.InstancedMesh,
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[],
) {
  const posAttr = this.geometry.getAttribute(
    'instancePosition',
  ) as THREE.InstancedBufferAttribute | undefined
  if (!posAttr) return

  const pos = posAttr.array as Float32Array
  const count = this.count
  const { ray } = raycaster
  const camPos = ray.origin

  // Scale threshold with camera distance so hover zone feels consistent
  const threshold = 2.0 * (camPos.length() / 300)

  let bestDist = Infinity
  let bestIdx = -1

  for (let i = 0; i < count; i++) {
    _v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])

    // Skip vessels on the far side of the globe
    if (camPos.dot(_v) < 0) continue

    const d = ray.distanceToPoint(_v)
    if (d < threshold && d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }

  if (bestIdx !== -1) {
    _v.set(pos[bestIdx * 3], pos[bestIdx * 3 + 1], pos[bestIdx * 3 + 2])
    const point = new THREE.Vector3()
    ray.closestPointToPoint(_v, point)

    intersects.push({
      distance: camPos.distanceTo(point),
      point,
      object: this,
      face: null,
      faceIndex: undefined,
      instanceId: bestIdx,
    } as THREE.Intersection)
  }
}

export function VesselLayer() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const visibleMapRef = useRef(new Int32Array(MAX_VESSELS))
  const prevHoveredRef = useRef(-1)

  const year = useStore((s) => s.year)
  const colorMode = useStore((s) => s.colorMode)
  const filters = useStore((s) => s.filters)
  const selectedCompany = useStore((s) => s.selectedCompany)
  const selectedVessel = useStore((s) => s.selectedVessel)
  const binary = useStore((s) => s.binaries.get(s.year))
  const index = useStore((s) => s.indices.get(s.year))
  const setBinary = useStore((s) => s.setBinary)
  const setIndex = useStore((s) => s.setIndex)

  const geometry = useMemo(() => new THREE.CircleGeometry(0.8, 8), [])

  const introRef = useRef(true)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCamDist: { value: 300 },
      uHoveredIndex: { value: -1 },
      uCamPos: { value: new THREE.Vector3(0, 0, 300) },
      uIntroScale: { value: 0 },
    }),
    [],
  )

  const buffersRef = useRef({
    instancePosition: new Float32Array(MAX_VESSELS * 3),
    instanceColor: new Float32Array(MAX_VESSELS * 3),
    instanceScale: new Float32Array(MAX_VESSELS),
    instanceOpacity: new Float32Array(MAX_VESSELS),
  })

  useEffect(() => {
    if (meshRef.current) meshRef.current.raycast = vesselRaycast
  }, [])

  useEffect(() => {
    if (useStore.getState().binaries.has(year)) return
    loadYear(year).then(({ buffer, index }) => {
      setBinary(year, buffer)
      setIndex(year, index)
    })
  }, [year, setBinary, setIndex])

  const companyIndices = useMemo(() => {
    if (!selectedCompany || !index) return null
    const set = new Set<number>()
    for (let i = 0; i < index.vessels.length; i++) {
      if (index.vessels[i].company_name === selectedCompany) set.add(i)
    }
    return set
  }, [selectedCompany, index])

  useEffect(() => {
    if (!binary || !meshRef.current) return

    const buffers = buffersRef.current
    const map = visibleMapRef.current
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

      const vesselIdx = binary[offset + BINARY_FIELDS.VESSEL_INDEX]
      if (selectedVessel !== null) {
        buffers.instanceOpacity[visible] = vesselIdx === selectedVessel ? 1.0 : 0.2
      } else if (companyIndices) {
        buffers.instanceOpacity[visible] = companyIndices.has(vesselIdx) ? 1.0 : 0.2
      } else {
        buffers.instanceOpacity[visible] = 1.0
      }

      map[visible] = i
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
  }, [binary, colorMode, filters, companyIndices, selectedVessel])

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      const idx = e.intersections[0]?.instanceId ?? -1
      if (idx === prevHoveredRef.current) return
      prevHoveredRef.current = idx

      if (materialRef.current) {
        materialRef.current.uniforms.uHoveredIndex.value = idx
      }

      if (idx >= 0 && binary) {
        const binaryIdx = visibleMapRef.current[idx]
        const vesselIndex =
          binary[binaryIdx * FIELDS_PER_VESSEL + BINARY_FIELDS.VESSEL_INDEX]
        useStore.getState().setHovered(vesselIndex)
      } else {
        useStore.getState().setHovered(-1)
      }

      document.body.style.cursor = idx >= 0 ? 'pointer' : 'auto'
    },
    [binary],
  )

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      const idx = e.intersections[0]?.instanceId ?? -1
      if (idx >= 0 && binary) {
        const binaryIdx = visibleMapRef.current[idx]
        const vesselIndex =
          binary[binaryIdx * FIELDS_PER_VESSEL + BINARY_FIELDS.VESSEL_INDEX]
        useStore.getState().setSelected(vesselIndex)
      }
    },
    [binary],
  )

  const handlePointerOut = useCallback(() => {
    prevHoveredRef.current = -1
    if (materialRef.current) {
      materialRef.current.uniforms.uHoveredIndex.value = -1
    }
    useStore.getState().setHovered(-1)
    document.body.style.cursor = 'auto'
  }, [])

  useFrame(({ clock, camera }) => {
    if (!materialRef.current) return
    const elapsed = clock.getElapsedTime()
    materialRef.current.uniforms.uTime.value = elapsed
    materialRef.current.uniforms.uCamDist.value = camera.position.length()
    materialRef.current.uniforms.uCamPos.value.copy(camera.position)

    if (introRef.current) {
      const t = Math.min(Math.max((elapsed - 1.0) / 0.8, 0), 1)
      materialRef.current.uniforms.uIntroScale.value = 1 - (1 - t) ** 3
      if (t >= 1) introRef.current = false
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, MAX_VESSELS]}
      frustumCulled={false}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
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
