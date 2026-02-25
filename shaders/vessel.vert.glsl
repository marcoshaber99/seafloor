attribute vec3 instancePosition;
attribute vec3 instanceColor;
attribute float instanceScale;
attribute float instanceOpacity;

uniform float uTime;
uniform float uCamDist;
uniform int uHoveredIndex;
uniform vec3 uCamPos;
uniform float uIntroScale;

varying vec3 vColor;
varying float vOpacity;
varying vec2 vUv;

void main() {
  // Cull instances on the far side of the globe
  float facing = dot(normalize(instancePosition), normalize(uCamPos));
  if (facing < -0.2) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    vOpacity = 0.0;
    vColor = vec3(0.0);
    vUv = vec2(0.0);
    return;
  }

  // Fade instances near the globe's edge for smooth transition
  float edgeFade = smoothstep(-0.2, 0.15, facing);

  // Intro: stagger each instance using golden ratio hash for organic spread
  float introStagger = fract(float(gl_InstanceID) * 0.618034);
  float introT = clamp(uIntroScale * 2.0 - introStagger, 0.0, 1.0);
  float introEased = introT * introT * (3.0 - 2.0 * introT); // smoothstep polynomial

  float scale = instanceScale * instanceOpacity * introEased;

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
  vOpacity = instanceOpacity * edgeFade;
  vUv = uv;
}
