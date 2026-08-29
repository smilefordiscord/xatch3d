# xatch3d

A 3D engine written from scratch in Scratch, using [goboscript](https://github.com/aspizu/goboscript).

## Features

- **BSP generation from OBJ files.** Geometry is compiled into a BSP tree, giving correct back-to-front ordering without a per-frame sort, plus frustum culling and raycasting for free.
- **Swept AABB collision.** The player box is swept through the world with SAT and clipped against surface normals, so you slide along walls and step over ledges instead of tunneling through them.
- **Source-like movement.** Movement physics based on the Quake games and the Source engine.
- **3D renderer.** A fast 3D triangle renderer using [Rex's triangle filler](https://scratch.mit.edu/projects/509029922). Triangles are near-clipped, screen-clipped, flat lambert shaded, and colored straight from the OBJ's vertex colors, with distance fog into the skybox.
- **Fast stamp-based text engine.** Text is stamped per character rather than drawn with the pen, with Roblox-style `UDim2` positions and anchor points for alignment.

## Getting started

You'll need goboscript installed. See [Install](https://aspiz.uk/goboscript/docs/install.html) and [Getting Started](https://aspiz.uk/goboscript/docs/getting-started/index.html).

I'd strongly suggest setting up [TurboWarp Desktop editor integration](https://aspiz.uk/goboscript/docs/editor-integration/turbowarp-desktop.html) before anything else. It gives you `Ctrl`+`B` to reload the project instantly, which you'll want on every single build.

Then:

```sh
goboscript build
```

and open the resulting `.sb3` in TurboWarp/Scratch.

> **NOTE:** vanilla Scratch will struggle to run anything beyond a VERY small map.

## Controls

| Key | Action |
| --- | --- |
| `WASD` | Move |
| Mouse / arrows | Look |
| `M` | Toggle mouse lock (only recommended with the [TurboWarp pointerlock experiment](https://experiments.turbowarp.org/pointerlock/)) |
| `Space` | Jump |
| `C` | Crouch |
| `V` | Toggle noclip (`E`/`Q` to rise/fall) |

## Loading your own maps

For mapping I recommend [Blender](https://www.blender.org/). It handles vertex color painting and OBJ export out of the box.

1. Model your level.
2. Paint vertex colors. These become the face colors in-engine, and any unpainted faces will be solid white.
3. **Triangulate the mesh.** This is not optional. The loader reads exactly three indices per face and will silently mangle anything with more than three vertices. In Blender, add a Triangulate modifier or hit `Ctrl`+`T` in Edit Mode, and tick **Triangulated Mesh** in the OBJ exporter as a safety net.
4. **Export as OBJ with vertex colors enabled.** In Blender's OBJ exporter this is the **Colors** option under Geometry. Without it your vertices carry no color data and the whole map renders white.
5. Drop the `.obj` into the project folder and point the `Map` list in `stage.gs` at it. That list is what the loader reads, so changing the path there is all that's needed to swap maps.

Try to keep the triangle count reasonable. The BSP build runs at load, so big maps can take a while to start up.

> Changing the map means recompiling. The OBJ is baked into the `.sb3` at build time, so run `goboscript build` again after swapping it.

## Limitations

- Solid colors only, no textures
- Static geometry. The BSP is compiled at load and can't handle moving brushes
- The loader expects triangulated meshes
- Performance starts dipping past roughly 1600 triangles in view
