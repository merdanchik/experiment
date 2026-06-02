uniform float uMotionMultiplier;

varying vec2 vMotion;

void main() {
	vec2 uv = gl_PointCoord * 2.0 - 1.0;
	if (dot(uv, uv) > 1.0) discard;

	gl_FragColor = vec4(vMotion * uMotionMultiplier, 0.0, 1.0);
}
