# Licences des ressources du site

Relevé du 18/11/2026. Les licences sont celles déclarées dans le fichier `package.json` de chaque paquet installé depuis le registre npm.

## Ressources importées dans `assets/`

| Fichiers | Contenu | Origine | Conditions |
|---|---|---|---|
| `assets/carte/serie-01.jpg` à `serie-08.jpg` | les huit halls peints de la carte des missions (un par série), 1672 × 941 px | images générées par le formateur avec ChatGPT à partir de prompts rédigés pour le jeu, fournies le 24/11/2026 ; converties en JPEG sans retouche | celles du service de génération utilisé ; [À VÉRIFIER par le formateur avant toute diffusion hors de la formation] |

Rien d'autre n'est importé : pas de modèle 3D, de carte d'environnement, de police ni de son. Le fût de la carte et les décors des missions sont construits par le code, les textures sont dessinées par le code (`js/commun/textures.js`) et les sons sont synthétisés (`js/commun/sons.js`). Les polices sont celles du poste.

## Bibliothèques de `vendor/`

| Dossier | Bibliothèque | Version | Licence | Origine |
|---|---|---|---|---|
| `vendor/three/` | Three.js (`three.module.js`, `three.core.js`, `addons/OrbitControls.js`, `addons/RoomEnvironment.js`, `addons/RoundedBoxGeometry.js`, `addons/postprocessing/` : EffectComposer, Pass, RenderPass, ShaderPass, MaskPass, UnrealBloomPass, OutputPass ; `addons/shaders/` : CopyShader, LuminosityHighPassShader, OutputShader, HorizontalTiltShiftShader, VerticalTiltShiftShader, VignetteShader) | 0.187.0 | MIT (texte dans `vendor/three/LICENSE`) | paquet npm `three`, https://github.com/mrdoob/three.js |
| `vendor/pyodide/` | Pyodide (`pyodide.mjs`, `pyodide.asm.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json`) | 314.0.8 | MPL-2.0 | paquet npm `pyodide`, https://github.com/pyodide/pyodide |
| `vendor/codemirror/codemirror.js` | CodeMirror : `codemirror` 6.0.2, `@codemirror/view` 6.43.15, `@codemirror/state` 6.7.6, `@codemirror/commands` 6.11.1, `@codemirror/language` 6.13.1, `@codemirror/lang-python` 6.2.1, `@lezer/highlight` 1.2.5, `@lezer/python` 1.1.19 et leurs dépendances, réunis en un fichier avec esbuild 0.28.2 | voir ci-contre | MIT | paquets npm du même nom |

Les fichiers de Three.js et de Pyodide sont copiés sans modification. Pyodide embarque CPython et sa bibliothèque standard, sous la licence de Python (PSF).
