import * as THREE from 'three'

const DEG2RAD = Math.PI / 180

export function latLngToVec3(
  lat: number,
  lng: number,
  radius: number,
  target?: THREE.Vector3,
): THREE.Vector3 {
  const phi = (90 - lat) * DEG2RAD
  const theta = (lng + 180) * DEG2RAD

  const x = -radius * Math.sin(phi) * Math.cos(theta)
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.sin(theta)

  if (target) {
    target.set(x, y, z)
    return target
  }

  return new THREE.Vector3(x, y, z)
}
