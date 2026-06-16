import * as THREE from "three";
import WebGLContext from "./WebGLContext";
import Scene from "../scenes/Scene";

class Three {
	constructor(container) {
		this.container = container;
		this.context = null;
		this.clock = new THREE.Clock();
		this.timeScale = 1.0;
		this.targetTimeScale = 1.0;
		this.scaledElapsed = 0;
		this.slowMotionScale = 0.15;
		this.slowMoLocked = false;
	}

	run() {
		this.context = new WebGLContext(this.container);
		this.context.init();
		this.scene = new Scene();
		this.#animate();
		this.#addResizeListener();
		this.#addSlowMotionListeners();
	}

	#animate() {
		const delta = this.clock.getDelta();

		// Ease the time scale toward its target so slow-mo ramps in/out smoothly.
		const ease = Math.min(delta * 12.0, 1.0);
		this.timeScale += (this.targetTimeScale - this.timeScale) * ease;

		const scaledDelta = delta * this.timeScale;
		this.scaledElapsed += scaledDelta;

		this.scene.animate(scaledDelta, this.scaledElapsed);
		this.#render(scaledDelta);

		requestAnimationFrame(() => this.#animate());
	}

	#addSlowMotionListeners() {
		const target = this.container ?? window;
		const enterSlowMotion = () => {
			this.targetTimeScale = this.slowMotionScale;
		};
		const exitSlowMotion = () => {
			if (!this.slowMoLocked) this.targetTimeScale = 1.0;
		};

		target.addEventListener("pointerdown", enterSlowMotion);
		window.addEventListener("pointerup", exitSlowMotion);
		window.addEventListener("pointercancel", exitSlowMotion);
	}

	#render(delta) {
		if (!this.context.renderer) return;
		if (this.scene.composer) {
			this.scene.render(delta);
		} else {
			this.context.renderer.render(this.scene.scene, this.scene.camera);
		}
	}

	setMotionBlur(enabled) {
		this.scene.setMotionBlur(enabled);
	}

	setSlowMotion(enabled) {
		this.slowMoLocked = enabled;
		this.targetTimeScale = enabled ? this.slowMotionScale : 1.0;
	}

	#addResizeListener() {
		window.addEventListener("resize", () => this.#onResize());
	}

	#onResize() {
		const { width, height } = this.context.getFullScreenDimensions();
		this.context.onResize(width, height);
		this.scene.onResize(width, height);
	}
}

export default Three;
