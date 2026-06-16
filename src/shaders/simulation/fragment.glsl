#include ../utils/curl.glsl;

uniform sampler2D textureDefaultPosition;
uniform float uTime;
uniform float uSpeed;
uniform float uDieSpeed;
uniform float uCurlSize;
uniform float uDeltaFrames;
uniform float uAttractStrength;
uniform float uRadius;

// Deterministic pseudo-random from 2D seed
float h(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Maps each particle's UV to a random point on the human silhouette.
// No texture needed — computed entirely in the shader.
vec3 silhouetteTarget(vec2 uv) {
	float scale = uRadius * 0.72;

	// Three independent randoms per particle
	float part = h(uv);
	float rx   = h(uv + vec2(0.31, 0.71));
	float ry   = h(uv + vec2(0.93, 0.17));

	vec2 pos;

	if (part < 0.13) {
		// Left leg
		pos = vec2(mix(-0.19, -0.03, rx), mix(-0.74, -0.07, ry));
	} else if (part < 0.26) {
		// Right leg
		pos = vec2(mix( 0.03,  0.19, rx), mix(-0.74, -0.07, ry));
	} else if (part < 0.56) {
		// Torso (trapezoid: narrow hips → wide shoulders)
		float hw = mix(0.12, 0.28, ry);
		pos = vec2(mix(-hw, hw, rx), mix(-0.08, 0.57, ry));
	} else if (part < 0.74) {
		// Left arm
		pos = vec2(mix(-0.46, -0.26, rx), mix(-0.08, 0.52, ry));
	} else if (part < 0.92) {
		// Right arm
		pos = vec2(mix( 0.26,  0.46, rx), mix(-0.08, 0.52, ry));
	} else {
		// Head (uniform disk sampling)
		float angle = rx * 6.28318530718;
		float r     = sqrt(ry) * 0.155;
		pos = vec2(cos(angle) * r, 0.73 + sin(angle) * r);
	}

	return vec3(pos * scale, 0.0);
}

void main() {
	vec2 uv = gl_FragCoord.xy / resolution.xy;

	vec4 positionInfo = texture2D(texturePosition, uv);
	vec3 position = positionInfo.xyz;
	float life = positionInfo.a - uDieSpeed * uDeltaFrames;

	if (life < 0.0) {
		if (uAttractStrength > 0.5) {
			position = silhouetteTarget(uv);
		} else {
			vec4 defaultPosition = texture2D(textureDefaultPosition, uv);
			position = defaultPosition.xyz;
		}
		life = 0.5 + fract(dot(uv, vec2(127.1, 311.7)) + uTime);
	} else {
		vec3 flow = curl(position * uCurlSize, uTime, 0.1 + (1.0 - life) * 0.1);
		flow /= length(flow) + 1e-4;

		if (uAttractStrength > 0.0) {
			vec3 target = silhouetteTarget(uv);
			// Lerp toward target — no overshooting, exponential convergence
			position += (target - position) * uAttractStrength * 0.12 * uDeltaFrames;
			// Small curl residual for organic feel
			position += flow * (1.0 - uAttractStrength) * uSpeed * uDeltaFrames;
		} else {
			position += flow * uSpeed * uDeltaFrames;
		}
	}

	gl_FragColor = vec4(position, life);
}
