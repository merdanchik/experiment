uniform sampler2D texturePosition;
uniform sampler2D texturePrevPosition;
uniform sampler2D particleDataTexture;
uniform float uPointSize;
uniform mat4 uPrevModelViewMatrix;

attribute vec2 reference;

varying vec2 vMotion;

void main() {
	vec4 positionInfo = texture2D(texturePosition, reference);
	vec4 prevPositionInfo = texture2D(texturePrevPosition, reference);
	vec4 particleData = texture2D(particleDataTexture, reference);
	float sizeRandom = mix(0.75, 2.0, particleData.r);

	vec3 transformed = positionInfo.xyz;
	vec4 mvPosition = viewMatrix * modelMatrix * vec4(transformed, 1.0);
	vec4 pos = projectionMatrix * mvPosition;

	vec4 prevPos =
		projectionMatrix * uPrevModelViewMatrix * vec4(prevPositionInfo.xyz, 1.0);

	gl_PointSize =
		uPointSize * sizeRandom / length(mvPosition.xyz) *
		smoothstep(0.0, 0.3, positionInfo.w);
	gl_Position = pos;

	vMotion = (pos.xy / pos.w - prevPos.xy / prevPos.w) * 0.5 *
		step(positionInfo.w, prevPositionInfo.w);
}
