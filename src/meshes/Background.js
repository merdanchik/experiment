import * as THREE from "three";
import vertexShader from "../shaders/background/vertex.glsl";
import fragmentShader from "../shaders/background/fragment.glsl";

export default class Background extends THREE.Mesh {
	constructor(camera, { colorTop = 0x173038, colorBottom = 0x3d626b } = {}) {
		const geometry = new THREE.PlaneGeometry(1, 1);

		const material = new THREE.ShaderMaterial({
			uniforms: {
				uColorTop: { value: new THREE.Color(colorTop) },
				uColorBottom: { value: new THREE.Color(colorBottom) },
			},
			vertexShader,
			fragmentShader,
			depthWrite: false,
		});

		super(geometry, material);

		this.camera = camera;
		this.distance = camera.far * 0.99;
		this.position.z = -this.distance;
		this.frustumCulled = false;
		this.renderOrder = -1;

		camera.add(this);
		this.fit();
	}

	fit() {
		const height =
			2 *
			this.distance *
			Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
		const width = height * this.camera.aspect;
		this.scale.set(width, height, 1);
	}
}
