# Research and design decisions

Research checked on September 20, 2026.

## Source inspiration

The requested starting point was the [Final Fantasy Tactics GameFAQs guide index](https://gamefaqs.gamespot.com/ps/197339-final-fantasy-tactics/faqs). Direct page retrieval was unavailable in this environment; indexed sections of the following guides were readable through web search. No guide text, story, sprites, maps, or formulas were copied wholesale into the game.

- [Dorter (Slums) #4, by just_call_me_ash](https://gamefaqs.gamespot.com/ps/197339-final-fantasy-tactics/faqs/76070/dorter-slums-4): rooftop ranged enemies, significant elevation, and a mixed enemy party make a representative early tactical encounter. Bellwether’s original map emphasizes these spatial decisions.
- [Guide and Walkthrough, by Shotgunnova](https://gamefaqs.gamespot.com/ps/197339-final-fantasy-tactics/faqs/55901): the Dorter section emphasizes dealing with elevated archers and dangerous spellcasters. The original five-chapter story expands this city-battle idea through a garden, crossing, abbey, and citadel.
- [Battle Mechanics Guide, by AeroStar](https://gamefaqs.gamespot.com/ps/197339-final-fantasy-tactics/faqs/3876): CT and delayed actions inform the turn scheduler and telegraphed, fixed-tile spell resolution.
- [Guide and Walkthrough, by BoardFourSixNineFour](https://gamefaqs.gamespot.com/ps/197339-final-fantasy-tactics/faqs/30113): independently choosing Move and Act, CT costs of 100/80/60, JP, and secondary job skills inform the core loop.

All numerical damage and progression formulas in this project are deliberately simplified and original. Deterministic damage forecasts, reversible pre-action movement, automatic saves, and a compact touch interface improve clarity. Story difficulty, retries, and retreat avoid permanent campaign softlocks. Job and equipment changes are locked during battles.

## Technology references

- [Three.js WebGPURenderer manual](https://threejs.org/manual/pages/webgpurenderer): WebGPU-first initialization, automatic WebGL2 fallback, TSL materials and post-processing.
- [WebGPURenderer API](https://threejs.org/docs/pages/WebGPURenderer.html): `forceWebGL`, explicit renderer initialization, and backend behavior.
- [WebGLRenderer API](https://threejs.org/docs/pages/WebGLRenderer.html): modern WebGLRenderer requires WebGL2; WebGL1 was removed in r163.
- [Three.js migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide): compatibility boundaries.
- [Three.js source](https://github.com/mrdoob/three.js): installed r186 `RenderPipeline`, TSL `pass`, `BloomNode`, and `BufferGeometryUtils.mergeGeometries` were inspected before implementation. npm reported 0.186.0 as the current release when dependencies were installed.

The r162 alias is intentionally isolated to WebGL1. It is not the primary renderer. Static scenery is merged by material to keep draw calls lower on phones, and high-cost bloom is excluded from the automatic mobile and WebGL fallback paths.
