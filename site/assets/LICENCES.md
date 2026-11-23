# Licences des ressources du site

Relevé du 18/11/2026. Les licences sont celles déclarées dans le fichier `package.json` de chaque paquet installé depuis le registre npm.

## Ressources importées dans `assets/`

Aucune dans `assets/`. Le jeu n'importe ni texture, ni carte d'environnement, ni police, ni son : les textures sont dessinées par le code (`js/commun/textures.js`) et les sons sont synthétisés (`js/commun/sons.js`). Les polices sont celles du poste.

## Robots 3D du championnat (`robots/`)

| Fichier | Origine | Licence |
|---|---|---|
| `robots/modeles/robot-retro.glb` | RobotExpressive, Tomás Laulhé (Quaternius), version glTF de Don McCurdy, exemples de three.js | CC0 1.0 |
| `robots/portraits/*.jpg` | rendus par `outils-construction/faire_portraits.py` à partir des modèles du jeu | comme le modèle rendu |
| Robots et animations Mixamo (à venir) | personnages et animations Mixamo (Adobe) ; modèles de robots fournis par le formateur | conditions Mixamo ; personnages protégés : usage en classe uniquement (décision du formateur du 22/11/2026) |

## Bibliothèques de `vendor/`

| Dossier | Bibliothèque | Version | Licence | Origine |
|---|---|---|---|---|
| `vendor/three/` | Three.js (`three.module.js`, `three.core.js`, `addons/loaders/GLTFLoader.js`, `addons/utils/BufferGeometryUtils.js`, `addons/utils/SkeletonUtils.js`, `addons/OrbitControls.js`, `addons/RoomEnvironment.js`, `addons/RoundedBoxGeometry.js`, `addons/postprocessing/` : EffectComposer, Pass, RenderPass, ShaderPass, MaskPass, UnrealBloomPass, OutputPass ; `addons/shaders/` : CopyShader, LuminosityHighPassShader, OutputShader, HorizontalTiltShiftShader, VerticalTiltShiftShader, VignetteShader) | 0.187.0 | MIT (texte dans `vendor/three/LICENSE`) | paquet npm `three`, https://github.com/mrdoob/three.js |
| `vendor/pyodide/` | Pyodide (`pyodide.mjs`, `pyodide.asm.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json`) | 314.0.8 | MPL-2.0 | paquet npm `pyodide`, https://github.com/pyodide/pyodide |
| `vendor/codemirror/codemirror.js` | CodeMirror : `codemirror` 6.0.2, `@codemirror/view` 6.43.15, `@codemirror/state` 6.7.6, `@codemirror/commands` 6.11.1, `@codemirror/language` 6.13.1, `@codemirror/lang-python` 6.2.1, `@lezer/highlight` 1.2.5, `@lezer/python` 1.1.19 et leurs dépendances, réunis en un fichier avec esbuild 0.28.2 | voir ci-contre | MIT | paquets npm du même nom |

Les fichiers de Three.js et de Pyodide sont copiés sans modification. Pyodide embarque CPython et sa bibliothèque standard, sous la licence de Python (PSF).
