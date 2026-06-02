#include <common>
#include <packing>

varying float vLife;

void main() {

	if (vLife < 0.01) discard;

	vec2 coord = gl_PointCoord - 0.5;
	if (dot(coord, coord) > 0.25) discard;

	gl_FragColor = packDepthToRGBA(gl_FragCoord.z);
}
