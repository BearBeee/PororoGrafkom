UTS Grafkom — Eddy, Poby & Loopy in one snowy scene

RUN
  Open this folder in VS Code and start Live Server on index.html
  (or run "python -m http.server" here and open http://localhost:8000).
  It must be served over http because the scripts are ES modules.

CONTROLS
  drag mouse / W A S D : rotate     scroll : zoom
  R : reset camera                  SPACE  : pause / resume animation

FILES
  index.html            the page (one canvas, loads main.js)
  main.js               the scene: WebGL setup, sky, environment, camera,
                        controls, and where each character stands (PLACEMENT)
  eddy.js               Eddy   -> export createEddy(GL)
  poby.js               Poby   -> export createPoby(GL)
  loopy.js              Loopy  -> export createLoopy(GL)
  helpers/libs.js       LIBS (Eddy, Loopy, scene) + POBY_LIBS (Poby)
  helpers/node.js       Node (Eddy, Loopy, scene) + MyObject (Poby)
  helpers/builders.js   EDDY_BUILDERS, POBY_BUILDERS, LOOPY_BUILDERS
  helpers/environment.js  the snowy world (ground, mountains, trees, igloo, ...)

Each create...() function returns { name, root, update(t), draw(scene) }.
Every character keeps its own shader, so it looks the same as in its own
project. Each one is lifted so its feet are at y = 0; main.js puts them
on the ground.
