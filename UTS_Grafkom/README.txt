UTS Grafkom — Eddy, Poby & Loopy at a picnic in the park

RUN
  Open this folder in VS Code and start Live Server on index.html
  (or run "python -m http.server" here and open http://localhost:8000).
  It must be served over http because the scripts are ES modules.

CONTROLS
  The bar at the top: Replay, Play/Pause, the time, a slider to jump to any
  second, the current part of the story, Orbit/Ghost camera, Camera (reset)
  and Hide.
  SPACE : pause / play              0 or HOME : replay from the start
  <- / -> : back / forward 1 s      H : hide / show the bar (before recording)
  R : reset the camera to the start view
  G : switch camera  ORBIT <-> GHOST

  ORBIT camera (start): drag mouse / W A S D rotate around the middle,
                        scroll = zoom
  GHOST camera (free flying, for filming from any angle):
    W A S D  fly forward / left / back / right
    Q / E    down / up             drag mouse  look around
    Shift    3x faster             Alt         slower
    scroll   flying speed (1.5 / 3 / 6 / 12 / 24 units per second)
    Ghost starts from the current view and moves smoothly; it still
    works while the animation is paused.

STORYLINE (60 s, loops)
  00-10  Opening       everyone stands at the picnic
  10-20  Poby's turn   Poby blows a soap bubble (poby_story.js)
  20-35  Loopy's turn  Loopy chases a butterfly (loopy-anim.js)
  30-45  Eddy's turn   Eddy walks forward and blows up a balloon, gets dizzy,
                       lets it float away and claps (eddy.js, animateEddy)
                       (30-35: Loopy is finishing while Eddy starts)
  45-60  Showcase      everyone at once

FILES
  index.html            the page (one canvas, loads main.js)
  main.js               the scene: WebGL setup, sky, environment, camera,
                        controls, and where each character stands (PLACEMENT)
  eddy.js               Eddy   -> export createEddy(GL)  (model + balloon animation)
  poby.js               Poby   -> export createPoby(GL, { showcaseTurn })
                        (measurements + hierarchy + rig; shapes in builders.js)
  poby_story.js        Poby's animation (bubble wand + soap bubble)
  loopy.js              Loopy  -> export createLoopy(GL)
  loopy-anim.js         Loopy's animation (butterfly chase)
  helpers/libs.js       LIBS (Eddy, Loopy, scene) + POBY_LIBS (Poby)
  helpers/node.js       Node (Eddy, Loopy, scene) + MyObject (Poby)
                        Node supports scale, axisAngle (arbitrary axis),
                        matrixOverride and visible
  helpers/builders.js   EDDY_BUILDERS, POBY_BUILDERS, LOOPY_BUILDERS
                        (every character's shape generators)
  helpers/rig.js        Poby's skeleton + skinning (Rig, SkinnedMesh, M4)
  helpers/environment.js       the picnic park (grass, path, trees, bushes,
                               flowers, mountains, drifting clouds, picnic mat
                               with basket, food and drinks)
  helpers/environment_snow.js  the old snowy world (backup, not used)

Each create...() function returns { name, root, update(t), draw(scene) }.
Every character keeps its own shader, so it looks the same as in its own
project. Each one is lifted so its feet are at y = 0; main.js puts them
on the ground. Poby is drawn last because his soap bubble is see-through.
