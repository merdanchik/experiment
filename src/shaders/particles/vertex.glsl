#include <common>
#include <shadowmap_pars_vertex>

uniform sampler2D texturePosition;
uniform sampler2D particleDataTexture;
uniform float uPointSize;
uniform vec3 uLightDirection;

attribute vec2 reference;

varying float vLife;
varying vec3 vColor;
varying vec3 vLightDir;
varying vec3 vViewDir;

const vec3 PALETTE[5] = vec3[5](
	vec3(1.0, 0.93, 0.1),    // yellow
	vec3(0.37, 0.77, 1.0),   // baby blue
	vec3(1.0, 0.24, 0.73),   // pink
	vec3(1.0, 0.19, 0.19),   // red
	vec3(0.64, 0.37, 1.0)    // violet
);

void main() {
	vec4 positionInfo = texture2D(texturePosition, reference);
	vec4 particleData = texture2D(particleDataTexture, reference);
	float sizeRandom = mix(0.5, 2.0, particleData.r);
	vLife = positionInfo.w;
	vColor = PALETTE[int(particleData.g + 0.5)];

	vec3 transformed = positionInfo.xyz;
	vec3 transformedNormal = vec3(0.0, 0.0, 1.0);
	vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
	vec4 mvPosition = viewMatrix * worldPosition;

	vLightDir = normalize((viewMatrix * vec4(uLightDirection, 0.0)).xyz);
	vViewDir = normalize(-mvPosition.xyz);

	#include <shadowmap_vertex>

	gl_PointSize = uPointSize * sizeRandom / length(mvPosition.xyz) * smoothstep(0.0, 0.3, vLife);
	gl_Position = projectionMatrix * mvPosition;
}
