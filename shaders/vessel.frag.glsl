uniform float uCamDist;

varying vec3 vColor;
varying float vOpacity;
varying vec2 vUv;

void main() {
  if (vOpacity < 0.01) discard;

  // Soft circular falloff from center of circle geometry
  float dist = length(vUv - 0.5) * 2.0;
  if (dist > 1.0) discard;

  // Zoom factor: 0 when close (120), 1 when far (400+)
  float zoom = smoothstep(120.0, 400.0, uCamDist);

  // Sharper edge when close, softer glow when far
  float edge = mix(0.75, 0.4, zoom);
  float alpha = smoothstep(1.0, edge, dist) * vOpacity;

  // Fade down alpha at distance so additive stacking saturates less
  alpha *= mix(1.0, 0.55, zoom);

  // Subtle emissive boost — kept modest to avoid blowout in dense clusters
  float emissive = mix(0.85, 0.95, zoom);

  gl_FragColor = vec4(vColor * emissive, alpha);
}
