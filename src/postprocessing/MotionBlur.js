import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import motionVertexShader from "../shaders/motion/vertex.glsl";
import motionFragmentShader from "../shaders/motion/fragment.glsl";
import blurVertexShader from "../shaders/motion/blur.vert";
import blurFragmentShader from "../shaders/motion/blur.frag";

export default class MotionBlur {
	constructor(renderer, scene, particles, settings = {}) {
		this.renderer = renderer;
		this.scene = scene;
		this.particles = particles;

		this.settings = {
			multiplier: 1.5,
			maxDistance: 120,
			leaning: 0.5,
			targetFPS: 120,
			sampleCount: 21,
			...settings,
		};

		this._prevModelViewMatrix = new THREE.Matrix4();
		this._currModelViewMatrix = new THREE.Matrix4();
		this._mvInitialized = false;

		this.#createVelocityTarget();
		this.#createMotionMaterial();
		this.#createPass();
	}

	#createVelocityTarget() {
		const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
		this.velocityTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			type: THREE.HalfFloatType,
			depthBuffer: true,
		});
	}

	#createMotionMaterial() {
		this.motionMaterial = new THREE.ShaderMaterial({
			uniforms: {
				texturePosition: { value: null },
				texturePrevPosition: { value: null },
				particleDataTexture: { value: this.particles.particleDataTexture },
				uPointSize: { value: this.particles.pointSize },
				uPrevModelViewMatrix: { value: new THREE.Matrix4() },
				uMotionMultiplier: { value: 1.0 },
			},
			vertexShader: motionVertexShader,
			fragmentShader: motionFragmentShader,
			blending: THREE.NoBlending,
		});
	}

	#createPass() {
		const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
		this.pass = new ShaderPass({
			defines: { SAMPLE_COUNT: this.settings.sampleCount },
			uniforms: {
				tDiffuse: { value: null },
				uVelocity: { value: null },
				uResolution: { value: new THREE.Vector2(size.x, size.y) },
				uMaxDistance: { value: this.settings.maxDistance },
				uMotionMultiplier: { value: this.settings.multiplier },
				uLeaning: { value: this.settings.leaning },
			},
			vertexShader: blurVertexShader,
			fragmentShader: blurFragmentShader,
		});
		this.pass.uniforms.uVelocity.value = this.velocityTarget.texture;
	}

	renderVelocity(camera) {
		const renderer = this.renderer;
		const scene = this.scene;
		const points = this.particles.points;

		camera.updateMatrixWorld();
		points.updateMatrixWorld();
		const view = this._currModelViewMatrix
			.copy(camera.matrixWorld)
			.invert()
			.multiply(points.matrixWorld);

		if (!this._mvInitialized) {
			this._prevModelViewMatrix.copy(view);
			this._mvInitialized = true;
		}

		const uniforms = this.motionMaterial.uniforms;
		uniforms.texturePosition.value = this.particles.positionTexture;
		uniforms.texturePrevPosition.value = this.particles.previousPositionTexture;
		uniforms.uPrevModelViewMatrix.value.copy(this._prevModelViewMatrix);

		const prevBackground = scene.background;
		const prevOverride = scene.overrideMaterial;
		const prevClear = renderer.getClearColor(new THREE.Color());
		const prevAlpha = renderer.getClearAlpha();

		scene.background = null;
		scene.overrideMaterial = this.motionMaterial;
		renderer.setRenderTarget(this.velocityTarget);
		renderer.setClearColor(0x000000, 0.0);
		renderer.clear();
		renderer.render(scene, camera);
		renderer.setRenderTarget(null);

		scene.overrideMaterial = prevOverride;
		scene.background = prevBackground;
		renderer.setClearColor(prevClear, prevAlpha);

		this._prevModelViewMatrix.copy(view);
	}

	update(delta) {
		const fpsRatio = Math.min(
			1,
			1 / Math.max(delta, 1e-4) / this.settings.targetFPS,
		);
		const u = this.pass.uniforms;
		u.uMotionMultiplier.value = this.settings.multiplier * fpsRatio;
		u.uMaxDistance.value = this.settings.maxDistance;
		u.uLeaning.value = this.settings.leaning;
	}

	resize(width, height) {
		const ratio = this.renderer.getPixelRatio();
		this.velocityTarget.setSize(width * ratio, height * ratio);
		const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
		this.pass.uniforms.uResolution.value.set(size.x, size.y);
	}
}
