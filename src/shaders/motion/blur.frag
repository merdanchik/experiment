uniform sampler2D tDiffuse;
uniform sampler2D uVelocity;
uniform vec2 uResolution;
uniform float uMaxDistance;
uniform float uMotionMultiplier;
uniform float uLeaning;

varying vec2 vUv;

void main() {
	vec2 motion = texture2D(uVelocity, vUv).xy;

	vec2 offset = motion * uResolution * uMotionMultiplier;
	float offsetDistance = length(offset);
	if (offsetDistance > uMaxDistance) {
		offset = normalize(offset) * uMaxDistance;
	}

	vec2 delta = -offset / uResolution * 2.0 / float(SAMPLE_COUNT);
	vec2 pos = vUv - delta * uLeaning * float(SAMPLE_COUNT);

	vec3 color = vec3(0.0);
	for (int i = 0; i < SAMPLE_COUNT; i++) {
		color += texture2D(tDiffuse, pos).rgb;
		pos += delta;
	}

	gl_FragColor = vec4(color / float(SAMPLE_COUNT), 1.0);
}
