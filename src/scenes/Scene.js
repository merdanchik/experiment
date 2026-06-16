import * as THREE from "three";
import WebGLContext from "../core/WebGLContext";
import { CameraRig } from "../utils/CameraRig";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import Particles from "../meshes/Particles";
import Background from "../meshes/Background";
import Composer from "../postprocessing/Composer";
import MotionBlur from "../postprocessing/MotionBlur";

export default class Scene {
	constructor() {
		this.context = null;
		this.camera = null;
		this.cameraRig = null;
		this.width = 0;
		this.height = 0;
		this.aspectRatio = 0;
		this.scene = null;
		this.envMap = null;
		this.composer = null;
		this.motionBlur = null;
		this.#init();
	}

	async #init() {
		this.#setContext();
		this.#setupScene();
		this.#setupCamera();
		this.#setupCameraRig();
		this.#addLights();
		await this.#addObjects();
		this.#setupComposer();
	}

	#setContext() {
		this.context = new WebGLContext();
	}

	#setupScene() {
		this.scene = new THREE.Scene();
		const environment = new RoomEnvironment();
		const pmremGenerator = new THREE.PMREMGenerator(this.context.renderer);
		this.envMap = pmremGenerator.fromScene(environment).texture;
		this.scene.environment = this.envMap;
		this.scene.environmentIntensity = 1.0;
	}

	#setupCamera() {
		this.#calculateAspectRatio();
		this.camera = new THREE.PerspectiveCamera(45, this.aspectRatio, 1, 1000);
		this.camera.position.z = this.#getCameraDistance();
	}

	#getCameraDistance() {
		const baseDistance = 250;
		const referenceAspect = 16 / 9;

		if (this.aspectRatio >= referenceAspect) return baseDistance;

		const distance = baseDistance * (referenceAspect / this.aspectRatio);
		return Math.min(distance, 350);
	}

	#setupCameraRig() {
		this.cameraRig = new CameraRig(this.camera, {
			target: new THREE.Vector3(0, 0, 0),
			xLimit: [-200, 200],
			yLimit: [-150, 150],
		});
	}

	#addLights() {
		const radius = 40;
		const shadowMapSize = 1024;
		const lightDirection = new THREE.Vector3(-0.5, 1, 0).normalize();

		this.light = new THREE.DirectionalLight(0xffffff, 1.0);
		this.light.position.copy(lightDirection).multiplyScalar(radius * 4);
		this.light.castShadow = true;

		const b = radius * 3;
		const cam = this.light.shadow.camera;
		cam.left = -b;
		cam.right = b;
		cam.top = b;
		cam.bottom = -b;
		cam.near = radius;
		cam.far = radius * 8;
		cam.updateProjectionMatrix();

		this.light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
		this.light.shadow.bias = 0.0;
		this.light.shadow.radius = 10;

		this.scene.add(this.light);
		this.scene.add(this.light.target);
	}

	async #addObjects() {
		this.scene.add(this.camera);
		this.background = new Background(this.camera);

		this.particles = new Particles(this.scene, {
			lightDirection: this.light.position.clone().normalize(),
		});
	}

	#setupComposer() {
		const renderer = this.context.renderer;
		this.composer = new Composer(renderer, this.scene, this.camera);
		this.motionBlur = new MotionBlur(renderer, this.scene, this.particles);
		this.composer.addPass(this.motionBlur.pass);
	}

	setAttraction(enabled) {
		this.particles?.setAttraction(enabled ? 0.8 : 0.0);
	}

	setMotionBlur(enabled) {
		this.motionBlurEnabled = enabled;
		this.motionBlur.pass.enabled = enabled;
	}

	render(delta) {
		if (this.motionBlurEnabled !== false) {
			this.motionBlur.renderVelocity(this.camera);
			this.motionBlur.update(delta);
		}
		this.composer.render();
	}

	#calculateAspectRatio() {
		const { width, height } = this.context.getFullScreenDimensions();
		this.width = width;
		this.height = height;
		this.aspectRatio = this.width / this.height;
	}

	animate(delta, elapsed) {
		this.cameraRig?.update(delta);
		this.particles?.update(elapsed, delta);
	}

	onResize(width, height) {
		this.width = width;
		this.height = height;
		this.aspectRatio = width / height;

		this.camera.aspect = this.aspectRatio;
		this.camera.position.z = this.#getCameraDistance();
		this.camera.updateProjectionMatrix();

		this.background?.fit();

		this.composer?.resize(width, height);
		this.motionBlur?.resize(width, height);
	}
}
