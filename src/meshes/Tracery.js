import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import vertexShader from "../shaders/tracery/vertex.glsl";
import fragmentShader from "../shaders/tracery/fragment.glsl";

export default class Tracery {
	constructor(scene, camera, options = {}) {
		this.scene = scene;
		this.camera = camera;

		this.radius = options.radius ?? 40;
		this.spread = options.spread ?? this.radius * 1.75;
		this.depth = options.depth ?? this.radius * 0.6;
		this.maxNodes = options.maxNodes ?? 4;
		this.spawnInterval = options.spawnInterval ?? 0.25;
		this.color = new THREE.Color(options.color ?? 0xffffff);

		this.widthRange = options.widthRange ?? [10, 10];
		this.heightRange = options.heightRange ?? [10, 10];

		this.boxBorder = options.boxBorder ?? 0.2;
		this.plusArm = options.plusArm ?? 1;
		this.plusThickness = options.plusThickness ?? 0.25;

		this.lineWidth = options.lineWidth ?? 1.5;
		this.dashSize = options.dashSize ?? 0.5;
		this.gapSize = options.gapSize ?? 0.5;

		this.minSpacing = options.minSpacing ?? this.spread * 0.55;

		this.lifeRange = options.lifeRange ?? [1, 1];

		this.showLabels = options.showLabels ?? true;
		this.labelHeight = options.labelHeight ?? 2.1;

		this.nodes = [];
		this.spawnTimer = this.spawnInterval;
		this.resolution = new THREE.Vector2(1, 1);

		this._right = new THREE.Vector3();
		this._up = new THREE.Vector3();

		this.group = new THREE.Group();
		this.group.renderOrder = 999;
		this.scene.add(this.group);

		this.planeGeometry = new THREE.PlaneGeometry(1, 1);

		this.#loadFont();
		this.#createConnections();
	}

	#loadFont() {
		this.fontFamily = "JetBrains Mono";
		this.fontReady = !this.showLabels;
		if (this.fontReady) return;

		const url = `${import.meta.env.BASE_URL}JetBrainsMono.ttf`;
		const face = new FontFace(this.fontFamily, `url(${url})`);
		face
			.load()
			.then((loaded) => {
				document.fonts.add(loaded);
				this.fontReady = true;
			})
			.catch(() => {
				this.fontFamily = "ui-monospace, monospace";
				this.fontReady = true;
			});
	}

	#createConnections() {
		const maxSegments = Math.max(this.maxNodes - 1, 1);
		this.connectionGeometry = new LineSegmentsGeometry();
		this.connectionGeometry.setPositions(new Float32Array(maxSegments * 6));
		this.connectionGeometry.setColors(new Float32Array(maxSegments * 6));
		this.connectionGeometry.instanceCount = 0;

		this.connectionPositions =
			this.connectionGeometry.attributes.instanceStart.data;
		this.connectionColors =
			this.connectionGeometry.attributes.instanceColorStart.data;

		this.connectionMaterial = new LineMaterial({
			linewidth: this.lineWidth,
			vertexColors: true,
			transparent: true,
			dashed: true,
			dashSize: this.dashSize,
			gapSize: this.gapSize,
			blending: THREE.AdditiveBlending,
			depthTest: false,
			depthWrite: false,
		});
		this.connectionMaterial.resolution = this.resolution;

		this.connections = new LineSegments2(
			this.connectionGeometry,
			this.connectionMaterial,
		);
		this.connections.frustumCulled = false;
		this.connections.renderOrder = 1000;
		this.group.add(this.connections);
	}

	#samplePoint() {
		const angle = Math.random() * Math.PI * 2;
		const r = this.spread * Math.sqrt(Math.random());

		return new THREE.Vector3(
			Math.cos(angle) * r,
			Math.sin(angle) * r,
			THREE.MathUtils.randFloatSpread(this.depth),
		);
	}

	#randomSurfacePoint() {
		let best = null;
		let bestDist = -1;

		for (let attempt = 0; attempt < 16; attempt++) {
			const candidate = this.#samplePoint();
			let nearest = Infinity;
			for (const node of this.nodes) {
				const dx = candidate.x - node.position.x;
				const dy = candidate.y - node.position.y;
				nearest = Math.min(nearest, Math.hypot(dx, dy));
			}

			if (nearest > bestDist) {
				bestDist = nearest;
				best = candidate;
			}
			if (nearest >= this.minSpacing) break;
		}

		return best;
	}

	#formatCoord(value) {
		const n = Math.round(value);
		return String(Math.abs(n)).padStart(3, "0");
	}

	#createLabel(node) {
		const fontPx = 22;
		const padX = 6;
		const padY = 4;
		const dpr = 2;
		const fontDecl = `500 ${fontPx}px ${this.fontFamily}`;
		const text = `X:${this.#formatCoord(node.position.x)} Y:${this.#formatCoord(
			node.position.y,
		)}`;

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		ctx.font = fontDecl;
		const textWidth = Math.ceil(ctx.measureText(text).width);

		const w = textWidth + padX * 2;
		const h = fontPx + padY * 2;
		canvas.width = w * dpr;
		canvas.height = h * dpr;

		ctx.scale(dpr, dpr);
		ctx.font = fontDecl;
		ctx.textBaseline = "top";
		ctx.textAlign = "left";
		ctx.fillStyle = "#ffffff";
		ctx.fillText(text, padX, padY);

		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;

		const material = new THREE.SpriteMaterial({
			map: texture,
			transparent: true,
			opacity: 0,
			depthTest: false,
			depthWrite: false,
		});
		material.color.copy(this.color);

		const sprite = new THREE.Sprite(material);
		sprite.center.set(0.05, 0);
		sprite.scale.set(this.labelHeight * (w / h), this.labelHeight, 1);
		sprite.renderOrder = 1001;
		sprite.frustumCulled = false;

		node.label = sprite;
		node.labelMaterial = material;
		node.labelTexture = texture;
		this.group.add(sprite);
	}

	#spawnNode() {
		const width = THREE.MathUtils.randFloat(
			this.widthRange[0],
			this.widthRange[1],
		);
		const height = THREE.MathUtils.randFloat(
			this.heightRange[0],
			this.heightRange[1],
		);

		const material = new THREE.ShaderMaterial({
			uniforms: {
				uColor: { value: this.color },
				uOpacity: { value: 0 },
				uSize: { value: new THREE.Vector2(width, height) },
				uBorder: { value: this.boxBorder },
				uPlusArm: { value: this.plusArm },
				uPlusThickness: { value: this.plusThickness },
			},
			vertexShader,
			fragmentShader,
			transparent: true,
			depthTest: false,
			depthWrite: false,
		});

		const mesh = new THREE.Mesh(this.planeGeometry, material);
		mesh.scale.set(width, height, 1);
		mesh.frustumCulled = false;
		mesh.renderOrder = 1000;

		const node = {
			mesh,
			material,
			position: this.#randomSurfacePoint(),
			width,
			height,
			age: 0,
			life: THREE.MathUtils.randFloat(this.lifeRange[0], this.lifeRange[1]),
			opacity: 0,
			label: null,
			labelMaterial: null,
			labelTexture: null,
		};

		mesh.position.copy(node.position);
		this.group.add(mesh);

		if (this.showLabels) this.#createLabel(node);

		this.nodes.push(node);
	}

	#updateNode(node) {
		node.opacity = 1;
		node.material.uniforms.uOpacity.value = node.opacity;
		node.mesh.quaternion.copy(this.camera.quaternion);

		if (node.label) {
			const gap = this.labelHeight * 0.25;
			node.label.position
				.copy(node.position)
				.addScaledVector(this._right, -node.width * 0.5)
				.addScaledVector(this._up, node.height * 0.5 + gap);
			node.labelMaterial.opacity = node.opacity;
		}
	}

	#disposeNode(node) {
		this.group.remove(node.mesh);
		node.material.dispose();

		if (node.label) {
			this.group.remove(node.label);
			node.labelMaterial.dispose();
			node.labelTexture.dispose();
		}
	}

	#updateConnections() {
		const segments = this.nodes.length - 1;
		this.connectionGeometry.instanceCount = Math.max(segments, 0);
		if (segments < 1) return;

		const positions = this.connectionPositions;
		const colors = this.connectionColors;
		const { r, g, b } = this.color;

		for (let i = 0; i < segments; i++) {
			const a = this.nodes[i];
			const c = this.nodes[i + 1];
			const alpha = Math.min(a.opacity, c.opacity) * 0.6;
			const o = i * 6;

			positions.array[o] = a.position.x;
			positions.array[o + 1] = a.position.y;
			positions.array[o + 2] = a.position.z;
			positions.array[o + 3] = c.position.x;
			positions.array[o + 4] = c.position.y;
			positions.array[o + 5] = c.position.z;

			colors.array[o] = colors.array[o + 3] = r * alpha;
			colors.array[o + 1] = colors.array[o + 4] = g * alpha;
			colors.array[o + 2] = colors.array[o + 5] = b * alpha;
		}

		positions.needsUpdate = true;
		colors.needsUpdate = true;

		this.connections.computeLineDistances();
	}

	resize(width, height) {
		this.resolution.set(width, height);
	}

	update(delta) {
		this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
		this._up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);

		this.spawnTimer += delta;
		if (
			this.fontReady &&
			this.spawnTimer >= this.spawnInterval &&
			this.nodes.length < this.maxNodes
		) {
			this.spawnTimer = 0;
			this.#spawnNode();
		}

		for (let i = this.nodes.length - 1; i >= 0; i--) {
			const node = this.nodes[i];
			node.age += delta;
			this.#updateNode(node);

			if (node.age >= node.life) {
				this.#disposeNode(node);
				this.nodes.splice(i, 1);
			}
		}

		this.#updateConnections();
	}
}
