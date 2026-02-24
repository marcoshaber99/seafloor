attribute vec3 instancePosition;
attribute vec3 instanceColor;
attribute float instanceScale;
attribute float instanceOpacity;

uniform float uTime;
uniform float uCamDist;
uniform int uHoveredIndex;

varying vec3 vColor;
varying float vOpacity;
varying vec2 vUv;

void main() {
  float scale = instanceScale * instanceOpacity;

  // Zoom-aware scaling: shrink points when camera is close
  float zoom = smoothstep(120.0, 400.0, uCamDist);
  scale *= mix(0.35, 1.0, zoom);

  // Gentle pulse — each instance offset by its ID for variation
  float pulse = 1.0 + 0.05 * sin(uTime * 2.0 + float(gl_InstanceID) * 0.37);
  scale *= pulse;

  // Hover highlight
  if (gl_InstanceID == uHoveredIndex) {
    scale *= 1.8;
  }

  // Billboard: offset local vertex in view space so circle always faces camera
  vec4 mvInstancePos = modelViewMatrix * vec4(instancePosition, 1.0);
  vec4 mvPosition = mvInstancePos + vec4(position.xy * scale, 0.0, 0.0);

  gl_Position = projectionMatrix * mvPosition;

  vColor = instanceColor;
  vOpacity = instanceOpacity;
  vUv = uv;
}
