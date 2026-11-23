# Animations Mixamo à télécharger pour le championnat

Liste relevée sur mixamo.com le 22/11/2026 (recherche « boxing », « kick », « sweep », « knocked », « dizzy », « dodge », « throw », « uppercut », « crouch »). Dans Mixamo, plusieurs animations portent le même nom (« Boxing », « Hook »...) : on les reconnaît à leur **description**, affichée sous la vignette.

## Réglages

- Un seul robot pour toutes les animations (par exemple Y Bot, ou ton premier robot).
- Panneau de droite : **Overdrive** 50 (vitesse d'origine : le jeu recale lui-même les coups), **Character Arm-Space** à augmenter si les bras traversent un robot massif, **Mirror** non coché, **In Place** coché quand la case apparaît (déplacements).
- Download : **FBX Binary**, **Without Skin**, **30** images par seconde, **Keyframe Reduction : none**.
- **Renomme chaque fichier comme la colonne « Fichier »** (par exemple `direct.fbx`) : l'outil de conversion range alors chaque animation à coup sûr.
- Dépose-les dans `mixamo-brut/animations/`.

## Les 20 animations

| Fichier | Dans le jeu | Nom Mixamo | Description à repérer |
|---|---|---|---|
| **Positions en boucle** | | | |
| `base.fbx` | attente entre deux actions | Idle | Bouncing Boxing Idle |
| `garde.fbx` | garde haute (tenue) | Center Block | High Center Block |
| `garde_basse.fbx` | garde basse (tenue) | Center Block | Low Center Block |
| `avancer.fbx` | avancer (In Place) | Walking | Boxing Advancing Forward |
| `reculer.fbx` | reculer (In Place) | Walking Backwards | One Foot At A Time In Combat Pose |
| `sonne.fbx` | robot sonné | Dizzy Idle | Rocking Back And Forth As If Dizzy |
| **Attaques** | | | |
| `direct.fbx` | direct (rapide) | Lead Jab | Med Head Jab |
| `crochet.fbx` | crochet (lent, gros dégâts) | Hook | Mid Hook Punch To The Head |
| `coup_bas.fbx` | coup bas | Mma Kick | Mma Low Kick |
| `projection.fbx` | projection | Grab And Slam | Grabbing And Slamming Someone To The Ground |
| `special.fbx` | coup spécial | Hurricane Kick | Flying Hurricane Kick |
| `esquive.fbx` | esquive (recule de 40 cm) | Dodging | Boxing Dodge Retreat |
| **Réactions** | | | |
| `touche.fbx` | touché par un direct ou un coup bas | Head Hit | Receiving A Light Hit To The Head From A Right Punch |
| `touche_fort.fbx` | touché par un crochet, un spécial, un contre | Receiving A Big Uppercut | Getting Rocked By A Big Uppercut |
| `bloque.fbx` | coup encaissé en garde | Right Block | High Right Block |
| `projete.fbx` | projeté (facultatif) | Getting Thrown | Being Thrown To The Side |
| **Transitions et fin du combat** | | | |
| `entree.fbx` | entrée dans le ring | Entry | Entering Ring |
| `ko.fbx` | K.-O. (tombe et reste au sol) | Knocked Out | Knocked Out Falling To Back |
| `victoire.fbx` | victoire | Victory | Victory From A Boxing Win |
| `defaite.fbx` | battu aux points | Defeat | Defeat From A Boxing Loss |

## Variantes si une animation ne plaît pas

- direct : Boxing (Boxing Leading Hand Jab) ; Lead Jab (Short Head Jab).
- crochet : Boxing (Boxing Lead Hand Hook) ; Hook (Long Hook Punch To The Head).
- coup bas : Leg Sweep (Front Leg Sweep), plus spectaculaire mais plus long.
- spécial : Boxing (Boxing Back Hand Uppercut), plus sobre ; Back Flip To Uppercut (Back Flip To Uppercut Combo).
- esquive : Dodging Right (Dodging To The Right In Place).
- touché : Head Hit (Receiving A Medium Hit To The Head From A Left Punch) ; Stomach Hit (Receiving A Hit In The Stomach).
- entrée : Taunt (Boxing Taunt) ; Entry (Entering From Ring Corner).
- K.-O. : Knocked Out (Knocked Out Falling To Stomach).

## Pas trouvé dans Mixamo

- Une garde basse accroupie à mains nues : les gardes accroupies existent seulement avec épée et bouclier. « Low Center Block » (garde basse debout) la remplace.
- Une réaction « garde qui encaisse » à mains nues : « High Right Block » la remplace.

## Ce que fait le jeu sans une animation

Un état sans fichier prend une animation proche : touché fort → touché ; projeté → touché fort ; garde basse → garde ; encaisse → garde ; défaite → attente ; entrée → garde.
