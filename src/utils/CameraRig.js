import * as THREE from "three";
import { easing } from "maath";

export class CameraRig {
	constructor(camera, options = {}) {
		this.camera = camera;
		this.target = options.target || new THREE.Vector3(0, 0, 0);
		this.xLimit = options.xLimit || [-5, 5];
		this.yLimit = options.yLimit || null;
		this.smoothTime = options.smoothTime || 0.25;

		this.pointer = { x: 0, y: 0 };

		this._bindEvents();
	}

	_bindEvents() {
		window.addEventListener("mousemove", (event) => {
			this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
			this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
		});
	}

	update(delta) {
		const rangeX = (this.xLimit[1] - this.xLimit[0]) / 2;
		const targetX = this.target.x + this.pointer.x * rangeX;
		const limitedX = Math.max(
			this.xLimit[0],
			Math.min(this.xLimit[1], targetX),
		);

		easing.damp(this.camera.position, "x", limitedX, this.smoothTime, delta);

		if (this.yLimit) {
			const rangeY = (this.yLimit[1] - this.yLimit[0]) / 2;
			const targetY = this.target.y + this.pointer.y * rangeY;
			const limitedY = Math.max(
				this.yLimit[0],
				Math.min(this.yLimit[1], targetY),
			);
			easing.damp(this.camera.position, "y", limitedY, this.smoothTime, delta);
		}

		this.camera.lookAt(this.target);
	}
}
