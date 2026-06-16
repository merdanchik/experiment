#include ../utils/curl.glsl;

uniform sampler2D textureDefaultPosition;
uniform sampler2D textureTarget;
uniform float uTime;
uniform float uSpeed;
uniform float uDieSpeed;
uniform float uCurlSize;
uniform float uDeltaFrames;
uniform float uAttractStrength;

void main() {
	vec2 uv = gl_FragCoord.xy / resolution.xy;

	vec4 positionInfo = texture2D(texturePosition, uv);
	vec3 position = positionInfo.xyz;
	float life = positionInfo.a - uDieSpeed * uDeltaFrames;

	if (life < 0.0) {
		vec4 defaultPosition = texture2D(textureDefaultPosition, uv);
		position = defaultPosition.xyz;
		life = 0.5 + fract(defaultPosition.w * 21.4131 + uTime);
	} else {
		vec3 flow = curl(position * uCurlSize, uTime, 0.1 + (1.0 - life) * 0.1);
		flow /= length(flow) + 1e-4;

		vec3 target = texture2D(textureTarget, uv).xyz;
		vec3 toTarget = target - position;
		float dist = length(toTarget);
		vec3 attraction = dist > 0.001 ? toTarget / dist : vec3(0.0);

		position += mix(flow, attraction, uAttractStrength) * uSpeed * uDeltaFrames;
	}

	gl_FragColor = vec4(position, life);
}
