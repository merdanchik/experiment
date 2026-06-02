uniform sampler2D texturePosition;
uniform float uPointSize;
uniform float uDepthOffset;

attribute vec2 reference;

varying float vLife;

void main() {
	vec4 positionInfo = texture2D(texturePosition, reference);
	vLife = positionInfo.w;

	vec4 mvPosition = modelViewMatrix * vec4(positionInfo.xyz, 1.0);
	mvPosition.z += uDepthOffset;

	gl_PointSize = uPointSize;
	gl_Position = projectionMatrix * mvPosition;
}
