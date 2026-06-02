varying vec2 vUv;

uniform vec3 uColor;
uniform float uOpacity;
uniform vec2 uSize;
uniform float uBorder;
uniform float uPlusArm;
uniform float uPlusThickness;

void main() {
	vec2 p = vUv * uSize;
	float aa = max(fwidth(p.x), fwidth(p.y));

	// Border ring
	float edge = min(
		min(p.x, uSize.x - p.x),
		min(p.y, uSize.y - p.y)
	);

	float border = 1.0 - smoothstep(
		uBorder - aa,
		uBorder + aa,
		edge
	);

	// Corner length
	float cornerLength = min(uSize.x, uSize.y) * 0.15;

	float left   = 1.0 - smoothstep(cornerLength - aa, cornerLength + aa, p.x);
	float right  = 1.0 - smoothstep(cornerLength - aa, cornerLength + aa, uSize.x - p.x);
	float top    = 1.0 - smoothstep(cornerLength - aa, cornerLength + aa, p.y);
	float bottom = 1.0 - smoothstep(cornerLength - aa, cornerLength + aa, uSize.y - p.y);

	// Four corner masks
	float tl = min(left, top);
	float tr = min(right, top);
	float bl = min(left, bottom);
	float br = min(right, bottom);

	float corners = border * max(max(tl, tr), max(bl, br));

	// Center +
	vec2 q = abs(p - uSize * 0.5);
	float halfT = uPlusThickness * 0.5;

	float hBar =
		(1.0 - smoothstep(halfT - aa, halfT + aa, q.y)) *
		(1.0 - smoothstep(uPlusArm - aa, uPlusArm + aa, q.x));

	float vBar =
		(1.0 - smoothstep(halfT - aa, halfT + aa, q.x)) *
		(1.0 - smoothstep(uPlusArm - aa, uPlusArm + aa, q.y));

	float plus = max(hBar, vBar);

	float alpha = max(corners, plus) * uOpacity;

	if (alpha < 0.001) discard;

	gl_FragColor = vec4(uColor, alpha);
}