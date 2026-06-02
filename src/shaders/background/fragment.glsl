uniform vec3 uColorTop;
uniform vec3 uColorBottom;

varying vec2 vUv;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
	vec3 color = mix(uColorBottom, uColorTop, vUv.y);

	float noise = hash(gl_FragCoord.xy) - hash(gl_FragCoord.xy + 1.0);
	color += noise / 255.0;

	gl_FragColor = vec4(color, 1.0);
}
