import * as THREE from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import WebGLContext from "../core/WebGLContext";
import vertexShader from "../shaders/particles/vertex.glsl";
import fragmentShader from "../shaders/particles/fragment.glsl";
import positionShader from "../shaders/simulation/fragment.glsl";
import depthVertexShader from "../shaders/shadow/depth.vert";
import depthFragmentShader from "../shaders/shadow/depth.frag";

export default class Particles {
	constructor(scene, options = {}) {
		this.scene = scene;
		this.context = new WebGLContext();
		this.renderer = this.context.renderer;
		this.gpuCompute = null;
		this.positionVariable = null;
		this.particleDataTexture = null;
		this.points = null;
		this.size = 512;
		this.radius = 40;
		this.pointSize = this.#getPointSize();
		this.lightDirection =
			options.lightDirection ?? new THREE.Vector3(-0.5, 1, 0).normalize();

		this.#init();
	}

	#getPointSize() {
		const base = 3000.0;
		const referenceAspect = 16 / 9;
		const { width, height } = this.context.getFullScreenDimensions();
		const aspect = width / height;

		if (aspect >= referenceAspect) return base;

		return base * Math.max(aspect / referenceAspect, 0.75);
	}

	#init() {
		this.#setupGPUComputation();
		this.#createVariables();
		this.#createPoints();
	}

	get positionTexture() {
		return this.gpuCompute.getCurrentRenderTarget(this.positionVariable)
			.texture;
	}

	get previousPositionTexture() {
		return this.gpuCompute.getAlternateRenderTarget(this.positionVariable)
			.texture;
	}

	#setupGPUComputation() {
		this.gpuCompute = new GPUComputationRenderer(
			this.size,
			this.size,
			this.renderer,
		);

		const positionTexture = this.gpuCompute.createTexture();
		this.defaultPositionTexture = this.gpuCompute.createTexture();
		this.particleDataTexture = this.gpuCompute.createTexture();

		this.#fillTextures(
			positionTexture,
			this.defaultPositionTexture,
			this.particleDataTexture,
		);

		this.defaultPositionTexture.needsUpdate = true;

		this.positionVariable = this.gpuCompute.addVariable(
			"texturePosition",
			positionShader,
			positionTexture,
		);

		Object.assign(this.positionVariable.material.uniforms, {
			textureDefaultPosition: { value: this.defaultPositionTexture },
			uAttractStrength: { value: 0.0 },
			uRadius: { value: this.radius },
			uTime: { value: 0 },
			uSpeed: { value: 1.0 },
			uDieSpeed: { value: 0.015 },
			uCurlSize: { value: 0.015 },
			uDeltaFrames: { value: 1.0 },
		});
	}

	#createVariables() {
		this.gpuCompute.setVariableDependencies(this.positionVariable, [
			this.positionVariable,
		]);

		const error = this.gpuCompute.init();
		if (error !== null) {
			console.error("GPUComputationRenderer init error:", error);
		}
	}

	#fillTextures(positionTexture, defaultTexture, particleDataTexture) {
		const positionData = positionTexture.image.data;
		const defaultData = defaultTexture.image.data;
		const particleData = particleDataTexture.image.data;

		for (let i = 0; i < positionData.length; i += 4) {
			const r = Math.cbrt(Math.random()) * this.radius;
			const phi = (Math.random() * 2 - 1) * Math.PI * 0.5;
			const theta = Math.random() * Math.PI * 2;

			const x = r * Math.cos(theta) * Math.cos(phi);
			const y = r * Math.sin(phi);
			const z = r * Math.sin(theta) * Math.cos(phi);
			const life = Math.random();

			positionData[i] = defaultData[i] = x;
			positionData[i + 1] = defaultData[i + 1] = y;
			positionData[i + 2] = defaultData[i + 2] = z;
			positionData[i + 3] = defaultData[i + 3] = life;

			particleData[i] = Math.pow(Math.random(), 5.0);
			particleData[i + 1] = Math.floor(Math.random() * 5);
		}
	}

	#createPoints() {
		const count = this.size * this.size;
		const positions = new Float32Array(count * 3);
		const references = new Float32Array(count * 2);

		for (let i = 0; i < count; i++) {
			references[i * 2] = (i % this.size) / this.size;
			references[i * 2 + 1] = Math.floor(i / this.size) / this.size;
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute(
			"reference",
			new THREE.BufferAttribute(references, 2),
		);

		const material = new THREE.ShaderMaterial({
			lights: true,
			uniforms: THREE.UniformsUtils.merge([
				THREE.UniformsLib.lights,
				{
					texturePosition: { value: null },
					particleDataTexture: { value: this.particleDataTexture },
					uPointSize: { value: this.pointSize },
					uLightDirection: { value: this.lightDirection },
					shadowColor: { value: new THREE.Color(0x000000) },
					shadowBlurRadius: { value: 2.0 },
				},
			]),
			vertexShader,
			fragmentShader,
			blending: THREE.NoBlending,
		});

		this.points = new THREE.Points(geometry, material);
		this.points.frustumCulled = false;
		this.points.castShadow = true;
		this.points.receiveShadow = true;

		this.points.customDepthMaterial = new THREE.ShaderMaterial({
			uniforms: {
				texturePosition: { value: null },
				uPointSize: { value: 1.5 },
				uDepthOffset: { value: this.radius * 0.05 },
			},
			vertexShader: depthVertexShader,
			fragmentShader: depthFragmentShader,
		});

		this.scene.add(this.points);
	}

	setAttraction(strength) {
		const u = this.positionVariable?.material?.uniforms;
		if (!u) { console.error('[Particles] uniforms not ready'); return; }
		console.log('[Particles] setAttraction →', strength, '| uRadius =', u.uRadius?.value);
		u.uAttractStrength.value = strength;
	}

	update(elapsed, delta) {
		const uniforms = this.positionVariable.material.uniforms;
		uniforms.uTime.value = elapsed;

		uniforms.uDeltaFrames.value = Math.min(delta * 60.0, 4.0);
		this.gpuCompute.compute();

		const positionTexture = this.positionTexture;
		this.points.material.uniforms.texturePosition.value = positionTexture;
		this.points.customDepthMaterial.uniforms.texturePosition.value =
			positionTexture;
	}
}
