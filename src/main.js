import Three from "./core/Three";
import "./style.css";

document.addEventListener("DOMContentLoaded", () => {
	const container = document.querySelector("#app");
	const three = new Three(container);
	three.run();

	const btnBlur = document.querySelector("#btn-blur");
	let blurEnabled = true;
	btnBlur.addEventListener("click", (e) => {
		e.stopPropagation();
		blurEnabled = !blurEnabled;
		three.setMotionBlur(blurEnabled);
		btnBlur.dataset.active = blurEnabled;
	});

	const btnSlowmo = document.querySelector("#btn-slowmo");
	let slowMoEnabled = false;
	btnSlowmo.addEventListener("click", (e) => {
		e.stopPropagation();
		slowMoEnabled = !slowMoEnabled;
		three.setSlowMotion(slowMoEnabled);
		btnSlowmo.dataset.active = slowMoEnabled;
	});

	const btnPause = document.querySelector("#btn-pause");
	let paused = false;
	btnPause.addEventListener("click", (e) => {
		e.stopPropagation();
		paused = !paused;
		three.setPaused(paused);
		btnPause.dataset.active = paused;
		btnPause.textContent = paused ? "Play" : "Pause";
	});

	const btnSilhouette = document.querySelector("#btn-silhouette");
	let silhouetteEnabled = false;
	btnSilhouette.addEventListener("click", (e) => {
		e.stopPropagation();
		silhouetteEnabled = !silhouetteEnabled;
		three.setAttraction(silhouetteEnabled);
		btnSilhouette.dataset.active = silhouetteEnabled;
	});
});
