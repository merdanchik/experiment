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
		this.targetTexture = this.#buildTargetTexture();

		this.#fillTextures(
			positionTexture,
			this.defaultPositionTexture,
			this.particleDataTexture,
		);

		this.defaultPositionTexture.needsUpdate = true;
		this.targetTexture.needsUpdate = true;

		this.positionVariable = this.gpuCompute.addVariable(
			"texturePosition",
			positionShader,
			positionTexture,
		);

		Object.assign(this.positionVariable.material.uniforms, {
			textureDefaultPosition: { value: this.defaultPositionTexture },
			textureTarget: { value: this.targetTexture },
			uAttractStrength: { value: 0.0 },
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

	#buildTargetTexture() {
		const silSize = 256;
		const canvas = document.createElement('canvas');
		canvas.width = silSize;
		canvas.height = silSize;
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = 'white';

		const cx = silSize * 0.5;
		const u = silSize;

		// Head
		ctx.beginPath();
		ctx.arc(cx, u * 0.10, u * 0.075, 0, Math.PI * 2);
		ctx.fill();

		// Neck
		ctx.fillRect(cx - u * 0.03, u * 0.175, u * 0.06, u * 0.04);

		// Torso
		ctx.beginPath();
		ctx.moveTo(cx - u * 0.14, u * 0.215);
		ctx.lineTo(cx + u * 0.14, u * 0.215);
		ctx.lineTo(cx + u * 0.09, u * 0.48);
		ctx.lineTo(cx - u * 0.09, u * 0.48);
		ctx.closePath();
		ctx.fill();

		// Left arm
		ctx.beginPath();
		ctx.moveTo(cx - u * 0.14, u * 0.215);
		ctx.lineTo(cx - u * 0.20, u * 0.225);
		ctx.lineTo(cx - u * 0.24, u * 0.44);
		ctx.lineTo(cx - u * 0.18, u * 0.44);
		ctx.closePath();
		ctx.fill();

		// Right arm
		ctx.beginPath();
		ctx.moveTo(cx + u * 0.14, u * 0.215);
		ctx.lineTo(cx + u * 0.20, u * 0.225);
		ctx.lineTo(cx + u * 0.24, u * 0.44);
		ctx.lineTo(cx + u * 0.18, u * 0.44);
		ctx.closePath();
		ctx.fill();

		// Left leg
		ctx.beginPath();
		ctx.moveTo(cx - u * 0.09, u * 0.48);
		ctx.lineTo(cx - u * 0.01, u * 0.48);
		ctx.lineTo(cx - u * 0.02, u * 0.88);
		ctx.lineTo(cx - u * 0.11, u * 0.88);
		ctx.closePath();
		ctx.fill();

		// Right leg
		ctx.beginPath();
		ctx.moveTo(cx + u * 0.01, u * 0.48);
		ctx.lineTo(cx + u * 0.09, u * 0.48);
		ctx.lineTo(cx + u * 0.11, u * 0.88);
		ctx.lineTo(cx + u * 0.02, u * 0.88);
		ctx.closePath();
		ctx.fill();

		// Collect filled pixels
		const pixels = ctx.getImageData(0, 0, silSize, silSize).data;
		const points = [];
		for (let y = 0; y < silSize; y++) {
			for (let x = 0; x < silSize; x++) {
				if (pixels[(y * silSize + x) * 4 + 3] > 128) {
					const nx = (x / silSize - 0.5) * 2;
					const ny = -(y / silSize - 0.5) * 2;
					points.push(nx * this.radius * 0.75, ny * this.radius * 0.75, 0);
				}
			}
		}

		// Assign a random silhouette point to each particle
		const texture = this.gpuCompute.createTexture();
		const data = texture.image.data;
		const pointCount = points.length / 3;
		for (let i = 0; i < this.size * this.size; i++) {
			const p = Math.floor(Math.random() * pointCount) * 3;
			data[i * 4]     = points[p];
			data[i * 4 + 1] = points[p + 1];
			data[i * 4 + 2] = points[p + 2];
			data[i * 4 + 3] = 1;
		}
		return texture;
	}

	setAttraction(strength) {
		this.positionVariable.material.uniforms.uAttractStrength.value = strength;
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
