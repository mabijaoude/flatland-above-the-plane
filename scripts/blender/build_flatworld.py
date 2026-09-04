"""Build Flatworld's planar late-Victorian surface material kit in Blender.

The town's native reality remains two-dimensional. Blender is therefore used to
author and bake surface craft—not miniature benches, lamps, or elevated walls.
"""

import math
import os
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUBLIC_DIR = os.path.join(ROOT, "public", "assets", "materials")
SOURCE_DIR = os.path.join(ROOT, "art_source")
SIZE = 256

os.makedirs(PUBLIC_DIR, exist_ok=True)
os.makedirs(SOURCE_DIR, exist_ok=True)


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))


MATERIALS = {
    "parchment": ("#D6C39B", "paper"),
    "road": ("#596266", "stipple"),
    "civic-stone": ("#A99D7D", "stone"),
    "garden": ("#70804E", "garden"),
    "domestic": ("#B9654A", "wood"),
    "commerce": ("#D19A3A", "tile"),
    "services": ("#687B91", "ledger"),
    "workshop": ("#895B3E", "slate"),
    "civic": ("#3F716B", "engraved"),
}


def noise(x, y, seed):
    value = math.sin((x * 12.9898 + y * 78.233 + seed * 37.719)) * 43758.5453
    return value - math.floor(value)


def height_at(x, y, style, seed):
    u = x / SIZE
    v = y / SIZE
    grain = (noise(x, y, seed) - 0.5) * 0.16
    if style == "paper":
        return grain + math.sin((u + v) * math.pi * 24) * 0.025
    if style == "stipple":
        return grain * 0.8 + (0.11 if noise(x // 3, y // 3, seed + 2) > 0.83 else -0.025)
    if style == "stone":
        joint = min(abs((x % 64) - 1), abs((y % 42) - 1))
        return grain * 0.45 - (0.22 if joint < 1.6 else 0)
    if style == "garden":
        leaf = math.sin(u * math.pi * 18 + math.sin(v * math.pi * 6)) * math.sin(v * math.pi * 22)
        return grain * 0.55 + leaf * 0.07
    if style == "wood":
        return grain * 0.45 + math.sin((u * 34 + math.sin(v * 9)) * math.pi) * 0.055
    if style == "tile":
        joint = min(x % 32, y % 32, 32 - x % 32, 32 - y % 32)
        return grain * 0.35 - (0.2 if joint < 1.2 else 0)
    if style == "ledger":
        line = min(y % 24, 24 - y % 24)
        return grain * 0.35 - (0.12 if line < 0.9 else 0)
    if style == "slate":
        scratch = abs(math.sin((u * 2 + v) * math.pi * 20))
        return grain * 0.6 - (0.1 if scratch < 0.04 else 0)
    hatch = abs(math.sin((u + v) * math.pi * 24))
    return grain * 0.4 - (0.09 if hatch < 0.045 else 0)


def save_image(name, pixels, colorspace="sRGB"):
    image = bpy.data.images.get(name) or bpy.data.images.new(name, width=SIZE, height=SIZE, alpha=True)
    image.colorspace_settings.name = colorspace
    image.pixels.foreach_set(pixels)
    image.file_format = "PNG"
    image.filepath_raw = os.path.join(PUBLIC_DIR, f"{name}.png")
    image.save()
    return image


def build_texture(material_name, base_hex, style, seed):
    base = hex_rgb(base_hex)
    heights = [[height_at(x, y, style, seed) for x in range(SIZE)] for y in range(SIZE)]
    color_pixels = []
    normal_pixels = []
    for y in range(SIZE):
        for x in range(SIZE):
            height = heights[y][x]
            variation = height * 0.34
            color_pixels.extend([
                max(0, min(1, base[0] + variation)),
                max(0, min(1, base[1] + variation)),
                max(0, min(1, base[2] + variation)),
                1.0,
            ])
            left = heights[y][(x - 1) % SIZE]
            right = heights[y][(x + 1) % SIZE]
            down = heights[(y - 1) % SIZE][x]
            up = heights[(y + 1) % SIZE][x]
            dx = (right - left) * 1.3
            dy = (up - down) * 1.3
            normal_pixels.extend([
                max(0, min(1, 0.5 - dx)),
                max(0, min(1, 0.5 - dy)),
                1.0,
                1.0,
            ])
    color_image = save_image(material_name, color_pixels)
    normal_image = save_image(f"{material_name}-normal", normal_pixels, "Non-Color")
    return color_image, normal_image


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

for index, (name, (color, style)) in enumerate(MATERIALS.items(), 1):
    color_image, normal_image = build_texture(name, color, style, index * 1884)
    material = bpy.data.materials.new(f"Flatworld {name}")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    color_node = nodes.new("ShaderNodeTexImage")
    color_node.name = f"{name} baked color"
    color_node.image = color_image
    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = f"{name} baked normal"
    normal_node.image = normal_image
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.18
    links.new(color_node.outputs["Color"], principled.inputs["Base Color"])
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    principled.inputs["Roughness"].default_value = 0.86

    bpy.ops.mesh.primitive_plane_add(size=4, location=((index - 5) * 5, 0, 0))
    swatch = bpy.context.object
    swatch.name = f"PLANAR SWATCH — {name}"
    swatch.data.materials.append(material)

bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene.world.color = (0.18, 0.18, 0.16)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE_DIR, "flatworld-planar-materials.blend"))

print(f"Built {len(MATERIALS)} Flatworld planar material sets in {PUBLIC_DIR}")
