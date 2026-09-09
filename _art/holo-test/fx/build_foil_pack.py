# -*- coding: utf-8 -*-
"""
鋁箔卡包（TCG 補充包）與撕裂邊的 Blender 靜幀。
用法：blender -b -P build_foil_pack.py -- <out_dir>
產出：foil-pack.png (700x980 RGBA)、foil-tear.png (1024x256 RGBA)、foil-pack.blend
材質數值沿用 holo-card-studio（MIT）：wave bands scale .55 / distortion 7 / 粉黃藍白 ramp。
中立銀白：不帶任何稀有度色，彩虹只當低強度光澤。
"""
import bpy, bmesh, math, sys, random
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '.'
random.seed(7)

# ---------- 清場 ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = 160
sc.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    sc.cycles.device = 'GPU'
except Exception as e:  # 沒 GPU 就 CPU
    print('GPU 不可用，改 CPU：', e)
sc.render.film_transparent = True
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
# Round 33: render-time highlight shoulder; retain the print's dark ink.
# Applied before PNG/WebP output, consistently to the pack and torn foil.
sc.use_nodes = True
nt = sc.node_tree
nt.nodes.clear()
rl = nt.nodes.new('CompositorNodeRLayers')
curve = nt.nodes.new('CompositorNodeCurveRGB')
curve.mapping.initialize()
master = curve.mapping.curves[3]
master.points[1].location = (1.0, .52)
master.points.new(.18, .025)
master.points.new(.5, .25)
curve.mapping.update()
out = nt.nodes.new('CompositorNodeComposite')
nt.links.new(rl.outputs['Image'], curve.inputs['Image'])
shoulder = nt.nodes.new('CompositorNodeMixRGB')
shoulder.blend_type = 'DARKEN'
shoulder.inputs[0].default_value = 1
shoulder.inputs[2].default_value = (.55, .55, .55, 1)
nt.links.new(curve.outputs['Image'], shoulder.inputs[1])
nt.links.new(shoulder.outputs['Image'], out.inputs['Image'])


# ---------- 材質：銀白鋁箔 ----------
def foil_material(name, rainbow=0.22, rough=0.28, crinkle=0.9, print_path=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)
    out = t.nodes.new('ShaderNodeOutputMaterial'); out.location = (900, 0)
    bsdf = t.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (600, 0)
    bsdf.inputs['Metallic'].default_value = 1.0
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Base Color'].default_value = (0.62, 0.64, 0.70, 1)
    t.links.new(bsdf.outputs[0], out.inputs[0])

    # 皺摺 bump：noise + 細條紋
    tc = t.nodes.new('ShaderNodeTexCoord'); tc.location = (-1200, 0)
    noise = t.nodes.new('ShaderNodeTexNoise'); noise.location = (-900, -250)
    noise.inputs['Scale'].default_value = 9.0
    noise.inputs['Detail'].default_value = 6.0
    noise.inputs['Roughness'].default_value = 0.62
    t.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    bump = t.nodes.new('ShaderNodeBump'); bump.location = (300, -300)
    bump.inputs['Strength'].default_value = 0.7 * crinkle
    bump.inputs['Distance'].default_value = 0.02
    t.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    t.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    # 鐳射條帶（holo-card-studio 數值）→ ramp → 低強度混進 base color
    mp = t.nodes.new('ShaderNodeMapping'); mp.location = (-900, 300)
    mp.inputs['Rotation'].default_value = (0, math.radians(32), 0)
    t.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    wave = t.nodes.new('ShaderNodeTexWave'); wave.location = (-600, 300)
    wave.wave_type = 'BANDS'; wave.bands_direction = 'X'
    wave.inputs['Scale'].default_value = 0.55
    wave.inputs['Distortion'].default_value = 7
    wave.inputs['Detail Scale'].default_value = 1.5
    t.links.new(mp.outputs[0], wave.inputs['Vector'])
    ramp = t.nodes.new('ShaderNodeValToRGB'); ramp.location = (-300, 300)
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0; cr.elements[0].color = (0.70, 0.10, 0.34, 1)
    cr.elements[1].position = 1.0; cr.elements[1].color = (1, 1, 1, 1)
    cr.elements.new(0.35).color = (1, 0.68, 0.16, 1)
    cr.elements.new(0.68).color = (0.10, 0.48, 1, 1)
    t.links.new(wave.outputs['Color'], ramp.inputs[0])
    mix = t.nodes.new('ShaderNodeMixRGB'); mix.location = (100, 200)
    mix.blend_type = 'OVERLAY'; mix.inputs[0].default_value = rainbow
    mix.inputs[1].default_value = (0.62, 0.64, 0.70, 1)
    t.links.new(ramp.outputs[0], mix.inputs[2])
    if print_path:
        img = bpy.data.images.load(print_path)
        tex = t.nodes.new('ShaderNodeTexImage'); tex.image = img; tex.location = (-300, 700)
        tex.extension = 'CLIP'
        t.links.new(tc.outputs['Generated'], tex.inputs['Vector'])
        # 印刷覆蓋率：alpha × 0.92，讓皺摺高光還能穿過印刷
        cov = t.nodes.new('ShaderNodeMath'); cov.operation = 'MULTIPLY'; cov.inputs[1].default_value = 1.0
        t.links.new(tex.outputs['Alpha'], cov.inputs[0])
        col = t.nodes.new('ShaderNodeMixRGB'); col.blend_type = 'MIX'; col.location = (350, 500)
        t.links.new(cov.outputs[0], col.inputs[0]); t.links.new(mix.outputs[0], col.inputs[1]); t.links.new(tex.outputs['Color'], col.inputs[2])
        t.links.new(col.outputs[0], bsdf.inputs['Base Color'])
        met = t.nodes.new('ShaderNodeMath'); met.operation = 'MULTIPLY_ADD'; met.location = (350, 350)
        # metallic = 1 - 0.75*cov
        met.inputs[1].default_value = -1.0; met.inputs[2].default_value = 1.0
        t.links.new(cov.outputs[0], met.inputs[0]); t.links.new(met.outputs[0], bsdf.inputs['Metallic'])
        rg = t.nodes.new('ShaderNodeMath'); rg.operation = 'MULTIPLY_ADD'; rg.location = (350, 250)
        # roughness = rough + 0.3*cov
        rg.inputs[1].default_value = (0.38 - rough); rg.inputs[2].default_value = rough
        t.links.new(cov.outputs[0], rg.inputs[0]); t.links.new(rg.outputs[0], bsdf.inputs['Roughness'])
        bs = t.nodes.new('ShaderNodeMath'); bs.operation = 'MULTIPLY_ADD'; bs.location = (100, -300)
        # bump strength = base - 0.45*cov
        bs.inputs[1].default_value = -0.58 * crinkle; bs.inputs[2].default_value = 0.7 * crinkle
        # 印刷面加亮膜（coat）做高光，不靠金屬反射
        ct = t.nodes.new('ShaderNodeMath'); ct.operation = 'MULTIPLY'; ct.inputs[1].default_value = 0.55
        t.links.new(cov.outputs[0], ct.inputs[0]); t.links.new(ct.outputs[0], bsdf.inputs['Coat Weight'])
        bsdf.inputs['Coat Roughness'].default_value = 0.12
        t.links.new(cov.outputs[0], bs.inputs[0]); t.links.new(bs.outputs[0], bump.inputs['Strength'])
    else:
        t.links.new(mix.outputs[0], bsdf.inputs['Base Color'])
    return m


# ---------- 幾何 ----------
def outline_pack(w=7.0, h=9.8, teeth=44, tooth_h=0.09, seal=0.9):
    """卡包外框：直式矩形，上、下各一道封口，封口外緣是鋸齒。回傳頂點座標（逆時針）。"""
    pts = []
    x0, x1, y0, y1 = -w / 2, w / 2, -h / 2, h / 2
    # 底邊鋸齒（從左到右）
    for i in range(teeth + 1):
        x = x0 + (x1 - x0) * i / teeth
        pts.append((x, y0 + (tooth_h if i % 2 else 0)))
    # 右邊
    pts.append((x1, y1 - tooth_h))
    # 頂邊鋸齒（從右到左）
    for i in range(teeth, -1, -1):
        x = x0 + (x1 - x0) * i / teeth
        pts.append((x, y1 - (tooth_h if i % 2 else 0)))
    return pts


def mesh_from_outline(name, pts, mat, subdiv=6):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, 0)) for x, y in pts]
    bm.faces.new(verts)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    # 細分 + 位移做鼓起與皺摺
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.subdivision_type = 'SIMPLE'
    sub.levels = subdiv; sub.render_levels = subdiv
    return ob


def add_displace(ob, strength, scale, name):
    tex = bpy.data.textures.new(name, 'CLOUDS')
    tex.noise_scale = scale; tex.noise_depth = 4
    d = ob.modifiers.new(name, 'DISPLACE')
    d.texture = tex; d.strength = strength; d.mid_level = 0.5
    d.texture_coords = 'LOCAL'
    return d


def add_bulge(ob, amount, w, h, seal):
    """中央鼓起（裡面有卡），封口區壓平：用頂點群組 + 平滑位移。"""
    vg = ob.vertex_groups.new(name='bulge')
    # 先套用細分才有足夠頂點
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier='sub')
    for v in ob.data.vertices:
        x, y = v.co.x, v.co.y
        fy = max(0.0, 1 - (abs(y) / (h / 2 - seal)) ** 2) if abs(y) < h / 2 - seal else 0.0
        fx = max(0.0, 1 - (abs(x) / (w / 2 * 0.95)) ** 2)
        wgt = (fx * fy) ** 0.6
        vg.add([v.index], wgt, 'REPLACE')
        v.co.z += amount * wgt


def seal_ribs(ob, w, h, seal, ribs=6):
    """封口區的壓紋：橫向細條 bump（用第二個 displace 限定在封口頂點群組）。"""
    vg = ob.vertex_groups.new(name='seal')
    for v in ob.data.vertices:
        y = v.co.y
        inside = 1.0 if abs(y) > h / 2 - seal else 0.0
        vg.add([v.index], inside, 'REPLACE')
        if inside:
            v.co.z += 0.05 * math.sin((abs(y) - (h / 2 - seal)) / seal * math.pi * ribs)


# ---------- 場景 ----------
def camera_ortho(w, h, margin=1.06):
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'
    cam.ortho_scale = max(w, h) * margin
    co = bpy.data.objects.new('cam', cam)
    co.location = (0, 0, 20)
    bpy.context.collection.objects.link(co)
    sc.camera = co
    return co


def lights():
    def area(name, loc, energy, size, col=(1, 1, 1)):
        l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = col
        o = bpy.data.objects.new(name, l); o.location = loc
        o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.collection.objects.link(o)
        return o
    area('key', (-6, 7, 12), 1300, 5, (1, 0.99, 0.97))
    area('fill', (7, -3, 10), 520, 9, (0.96, 0.97, 1))
    area('rim', (3, 9, 5), 1100, 1.2, (1, 1, 1))
    # 冷暖漸層的世界光讓金屬有東西可以反射
    wd = bpy.data.worlds.new('w'); sc.world = wd; wd.use_nodes = True
    nt = wd.node_tree
    bg = nt.nodes['Background']
    grad = nt.nodes.new('ShaderNodeTexGradient'); grad.gradient_type = 'LINEAR'
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, math.radians(90), 0)
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.01, 0.015, 0.03, 1)
    ramp.color_ramp.elements[1].color = (0.55, 0.58, 0.66, 1)
    nt.links.new(tc.outputs['Generated'], mp.inputs[0])
    nt.links.new(mp.outputs[0], grad.inputs[0])
    nt.links.new(grad.outputs['Fac'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = 0.7


def render(path, rx, ry):
    sc.render.resolution_x = rx; sc.render.resolution_y = ry
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('rendered', path)


def clear_objects():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


# ---------- 1. 卡包 ----------
W, H, SEAL = 7.0, 9.8, 0.4
mat = foil_material('foil', rainbow=0.4, rough=0.22, print_path=f'{OUT}/pack-print.png')
pack = mesh_from_outline('pack', outline_pack(W, H, seal=SEAL), mat)
add_bulge(pack, 0.55, W, H, SEAL)
seal_ribs(pack, W, H, SEAL)
add_displace(pack, 0.035, 0.7, 'crinkle')
sm = pack.modifiers.new('smooth', 'SMOOTH'); sm.factor = 0.6; sm.iterations = 2
for p in pack.data.polygons:
    p.use_smooth = True
camera_ortho(W, H)
lights()
render(f'{OUT}/foil-pack.png', 700, 980)
bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/foil-pack.blend')

# ---------- 2. 撕裂邊（橫條，下緣不規則撕口）----------
clear_objects()
TW, TH = 10.24, 2.56
pts = [(-TW / 2, TH / 2), (TW / 2, TH / 2)]
n = 60
for i in range(n, -1, -1):
    x = -TW / 2 + TW * i / n
    jag = random.uniform(0.0, 0.55) * (1 if i % 2 else 0.35) + 0.12 * math.sin(i * 0.9)
    pts.append((x, -TH / 2 + jag))
tear = mesh_from_outline('tear', pts, foil_material('foil-tear', rainbow=0.18, rough=0.3), subdiv=5)
bpy.context.view_layer.objects.active = tear
bpy.ops.object.modifier_apply(modifier='sub')
add_displace(tear, 0.06, 0.5, 'crinkle2')
for p in tear.data.polygons:
    p.use_smooth = True
cam = camera_ortho(TW, TH, margin=1.0)
cam.data.ortho_scale = TW
lights()
render(f'{OUT}/foil-tear.png', 1024, 256)
print('DONE')
