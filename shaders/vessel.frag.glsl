varying vec3 vColor;
varying float vOpacity;
varying vec2 vUv;

void main() {
  if (vOpacity < 0.01) discard;

  // Soft circular falloff from center of circle geometry
  float dist = length(vUv - 0.5) * 2.0;
  if (dist > 1.0) discard;

  float alpha = smoothstep(1.0, 0.4, dist) * vOpacity;

  // Emissive output — values > 1.0 drive bloom
  gl_FragColor = vec4(vColor * 1.5, alpha);
}
