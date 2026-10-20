/* =========================================================================
   viewer.js — Halaman viewer satu karakter (viewer.html?c=sunflower | peashooter)
   Zombie teman punya halaman sendiri: src/characters/zombie/zombie.html
   HUD (judul, dok 5 animasi rubrik) dibangun dari `spec.hud` tiap karakter.
   ========================================================================= */
import { createApp } from "./core/app.js";

const SPECS = {
  sunflower: () => import("./characters/sunflower/index.js"),
  peashooter: () => import("./characters/peashooter/index.js"),
};

const name = new URLSearchParams(location.search).get("c") || "sunflower";
const spec = (await (SPECS[name] || SPECS.sunflower)()).default;
const H = spec.hud;

document.title = `${H.title} — PvZ WebGL`;
document.documentElement.style.setProperty("--sun", H.accent[0]);
document.documentElement.style.setProperty("--sun-deep", H.accent[1]);
document.getElementById("title").textContent = H.title;
document.getElementById("desc").textContent = H.desc;
const regrow = document.getElementById("regrow");
regrow.dataset.act = H.regrow[0];
regrow.querySelector("span").textContent = H.regrow[1];
document.getElementById("dock").innerHTML = H.dock
  .map(([act, label, rubric], i) =>
    `<button class="act" data-act="${act}" data-anim="${act}"><kbd>${i + 1}</kbd><b>${label}</b><small>${rubric}</small></button>`)
  .join("");

if (H.auto) document.querySelector('.hint').textContent = H.auto + ' · seret untuk memutar kamera';
createApp(spec);
