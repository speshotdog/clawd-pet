# -*- coding: utf-8 -*-
"""背景箔底材（第二十九輪設計第三節）：同一套鋁箔材質、無印刷、皺摺 0.25、彩虹 0.06、寬面積光無亮點。
用法：blender -b -P build_foil_stage.py -- <out_dir>   → summon-substrate.png 1536x1024 RGB
"""
import bpy, bmesh, math, sys
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '.'

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 128; sc.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('GPU 不可用：', e)
sc.render.film_transparent = False
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'

# ---- 材質：同卡包配方，但皺摺 0.25、彩虹 0.06 ----
m = bpy.data.materials.new('substrate'); m.use_nodes = True; t = m.node_tree
for n in list(t.nodes): t.nodes.remove(n)
out = t.nodes.new('ShaderNodeOutputMaterial'); bsdf = t.nodes.new('ShaderNodeBsdfPrincipled')
bsdf.inputs['Metallic'].default_value = 1.0; bsdf.inputs['Roughness'].default_value = 0.28
t.links.new(bsdf.outputs[0], out.inputs[0])
tc = t.nodes.new('ShaderNodeTexCoord')
noise = t.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 9.0; noise.inputs['Detail'].default_value = 6.0; noise.inputs['Roughness'].default_value = 0.62
t.links.new(tc.outputs['Object'], noise.inputs['Vector'])
bump = t.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.7 * 0.25; bump.inputs['Distance'].default_value = 0.02
t.links.new(noise.outputs['Fac'], bump.inputs['Height']); t.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
mp = t.nodes.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, math.radians(32), 0)
t.links.new(tc.outputs['Object'], mp.inputs['Vector'])
wave = t.nodes.new('ShaderNodeTexWave'); wave.wave_type = 'BANDS'; wave.bands_direction = 'X'
wave.inputs['Scale'].default_value = 0.55; wave.inputs['Distortion'].default_value = 7; wave.inputs['Detail Scale'].default_value = 1.5
t.links.new(mp.outputs[0], wave.inputs['Vector'])
ramp = t.nodes.new('ShaderNodeValToRGB'); cr = ramp.color_ramp
cr.elements[0].position = 0.0; cr.elements[0].color = (0.70, 0.10, 0.34, 1)
cr.elements[1].position = 1.0; cr.elements[1].color = (1, 1, 1, 1)
cr.elements.new(0.35).color = (1, 0.68, 0.16, 1); cr.elements.new(0.68).color = (0.10, 0.48, 1, 1)
t.links.new(wave.outputs['Color'], ramp.inputs[0])
mix = t.nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'OVERLAY'; mix.inputs[0].default_value = 0.06
mix.inputs[1].default_value = (0.62, 0.64, 0.70, 1)
t.links.new(ramp.outputs[0], mix.inputs[2]); t.links.new(mix.outputs[0], bsdf.inputs['Base Color'])

# ---- 幾何：一張比畫面大的鋁箔平面，輕微皺摺 ----
W, H = 15.36, 10.24
me = bpy.data.meshes.new('sheet'); bm = bmesh.new()
vs = [bm.verts.new(p) for p in ((-W/2*1.1, -H/2*1.1, 0), (W/2*1.1, -H/2*1.1, 0), (W/2*1.1, H/2*1.1, 0), (-W/2*1.1, H/2*1.1, 0))]
bm.faces.new(vs); bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new('sheet', me); bpy.context.collection.objects.link(ob); ob.data.materials.append(m)
sub = ob.modifiers.new('sub', 'SUBSURF'); sub.subdivision_type = 'SIMPLE'; sub.levels = sub.render_levels = 6
tex = bpy.data.textures.new('crinkle', 'CLOUDS'); tex.noise_scale = 1.1; tex.noise_depth = 4
d = ob.modifiers.new('disp', 'DISPLACE'); d.texture = tex; d.strength = 0.05; d.mid_level = 0.5; d.texture_coords = 'LOCAL'
for p in ob.data.polygons: p.use_smooth = True

# ---- 相機與寬面積光（無亮點）----
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = W
co = bpy.data.objects.new('cam', cam); co.location = (0, 0, 20); bpy.context.collection.objects.link(co); sc.camera = co
def area(name, loc, energy, size, col):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = col
    o = bpy.data.objects.new(name, l); o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.collection.objects.link(o)
area('key', (-8, 6, 14), 900, 18, (0.90, 0.94, 1.0))
area('fill', (8, -5, 12), 380, 22, (0.95, 0.97, 1.0))
wd = bpy.data.worlds.new('w'); sc.world = wd; wd.use_nodes = True
bg = wd.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.04, 0.07, 0.14, 1); bg.inputs[1].default_value = 0.6

sc.render.resolution_x, sc.render.resolution_y = 1536, 1024; sc.render.resolution_percentage = 100
sc.render.filepath = f'{OUT}/summon-substrate.png'
bpy.ops.render.render(write_still=True); print('DONE')
