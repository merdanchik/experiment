import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

export default class Composer {
	constructor(renderer, scene, camera) {
		this.composer = new EffectComposer(renderer);
		this.renderPass = new RenderPass(scene, camera);
		this.composer.addPass(this.renderPass);
	}

	addPass(pass) {
		this.composer.addPass(pass);
	}

	render() {
		this.composer.render();
	}

	resize(width, height) {
		this.composer.setSize(width, height);
	}
}
