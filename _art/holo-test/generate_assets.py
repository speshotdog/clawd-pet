"""Deterministic, non-generative assets. Run: python _art/holo-test/generate_assets.py.
Only writes derived files beside this script. Original scene/source PNGs are read-only.
Requires Pillow, numpy, opencv-python. Runtime demo needs none of these packages.
"""
from pathlib import Path
import math, random, json, hashlib
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent
SEED = 20260908
rng = random.Random(SEED)
cv2.setRNGSeed(SEED)
cv2.setNumThreads(1)

# Tileable monochrome fibers: all random samples are retained in a fixed tile.
grain = Image.new('RGBA', (512, 512))
gp = grain.load()
for y in range(512):
    for x in range(512):
        v = rng.randrange(70, 231)
        gp[x, y] = (v, v, v, rng.randrange(22, 90))
grain.save(OUT / 'texture-fiber.png')

# Four microfacet directions, SAME positions and normals across every quadrant.
atlas = Image.new('RGBA', (1024, 1024))
particles = []
for y in range(0, 512, 6):
    for x in range(0, 512, 6):
        angle = rng.random() * math.tau
        slope = rng.uniform(.18, .95)
        n = np.array([math.cos(angle)*slope, math.sin(angle)*slope, 1.0])
        n /= np.linalg.norm(n)
        particles.append((x+rng.randrange(6), y+rng.randrange(6), 1.5 if rng.random()<.055 else .6, n))
for k in range(4):
    tile = Image.new('RGBA', (512,512))
    d = ImageDraw.Draw(tile)
    angle = -math.pi+k*math.pi/2
    h = np.array([math.cos(angle)*.65, math.sin(angle)*.65, 1.0]); h /= np.linalg.norm(h)
    for x,y,r,n in particles:
        alpha = round(255*max(float(np.dot(n,h)),0)**32)
        for ox in (-512,0,512):
            for oy in (-512,0,512):
                d.ellipse((x+ox-r,y+oy-r,x+ox+r,y+oy+r), fill=(255,255,255,alpha))
    atlas.paste(tile, ((k%2)*512,(k//2)*512))
atlas.save(OUT/'texture-glitter-atlas.png')

# Periodic guilloche engraving; endpoints match at both tile boundaries.
engraving = Image.new('RGBA',(512,512)); d=ImageDraw.Draw(engraving)
for base in range(-512,1025,32):
    for direction in (-1,1):
        points=[(x,base+direction*x+14*math.sin(x*math.tau/128)) for x in range(513)]
        d.line(points, fill=(220,220,220,170), width=1)
engraving.save(OUT/'texture-engraving.png')
(OUT/'frame-mask.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 840"><rect x="7" y="7" width="586" height="826" rx="25" fill="none" stroke="white" stroke-width="12"/><rect x="23" y="23" width="554" height="794" rx="16" fill="none" stroke="white" stroke-width="2"/></svg>',encoding='utf-8')

# Hand-authored contour guides in source pixel coordinates, refined by GrabCut.
# This is segmentation/inpainting, not AI image generation. Hidden scenery is an approximation.
GUIDES = {
 'rocketdog': [(78,151),(152,156),(268,217),(286,180),(329,147),(343,132),(400,124),(455,136),(489,161),(517,213),(516,261),(499,279),(508,301),(489,340),(451,365),(404,381),(427,430),(459,455),(489,486),(503,522),(492,559),(476,568),(498,600),(505,633),(489,659),(490,694),(468,712),(444,740),(409,742),(372,725),(333,727),(284,706),(243,691),(209,665),(191,625),(188,581),(151,528),(109,459),(86,406),(74,356),(64,303),(66,228)],
 'astronaut': [(223,401),(213,364),(220,324),(243,294),(274,278),(326,272),(366,287),(396,314),(416,351),(411,387),(394,415),(369,435),(384,457),(380,480),(369,487),(381,511),(367,531),(343,537),(329,517),(306,513),(271,501),(243,499),(220,488),(206,468),(211,449),(205,434),(208,414)],
 'alienkitty': [(226,353),(224,330),(236,318),(264,313),(280,327),(276,345),(282,355),(304,347),(296,331),(296,315),(312,303),(335,302),(350,317),(345,333),(338,349),(371,352),(398,355),(405,368),(396,391),(402,402),(426,412),(434,434),(416,446),(396,448),(377,436),(350,438),(327,447),(301,454),(280,462),(293,476),(286,491),(269,499),(247,491),(229,505),(207,502),(191,487),(184,470),(189,452),(206,447),(224,454),(228,435),(204,432),(200,416),(218,395),(238,378)],
 'fluffdog': [(35,501),(45,465),(56,441),(61,403),(78,372),(101,349),(147,325),(174,320),(201,300),(236,287),(279,291),(315,312),(334,310),(374,313),(410,328),(440,353),(449,371),(487,377),(526,398),(548,430),(558,468),(555,499),(537,514),(545,545),(534,568),(509,586),(498,602),(475,616),(460,640),(424,654),(388,664),(353,659),(320,662),(306,670),(311,700),(300,715),(286,710),(282,671),(248,672),(211,664),(182,658),(150,654),(116,642),(111,663),(98,662),(97,650),(103,624),(80,607),(67,579),(47,568),(33,539)]
}
records=[]
for name,points in GUIDES.items():
    path=OUT/f'scene-{name}.png'; rgb=np.array(Image.open(path).convert('RGB'))
    guide=np.zeros(rgb.shape[:2],np.uint8); cv2.fillPoly(guide,[np.array(points,np.int32)],255)
    outer=cv2.dilate(guide,np.ones((13,13),np.uint8)); inner=cv2.erode(guide,np.ones((11,11),np.uint8))
    labels=np.where(outer>0,cv2.GC_PR_BGD,cv2.GC_BGD).astype(np.uint8)
    labels[guide>0]=cv2.GC_PR_FGD; labels[inner>0]=cv2.GC_FGD
    cv2.grabCut(rgb,labels,None,np.zeros((1,65)),np.zeros((1,65)),4,cv2.GC_INIT_WITH_MASK)
    mask=np.uint8((labels==cv2.GC_FGD)|(labels==cv2.GC_PR_FGD))*255
    # Keep the main connected subject, excluding isolated flecks from the contour band.
    count, lab, stats, _=cv2.connectedComponentsWithStats(mask)
    if count>1: mask=np.uint8(lab==(1+np.argmax(stats[1:,cv2.CC_STAT_AREA])))*255
    alpha=Image.fromarray(mask).filter(ImageFilter.GaussianBlur(.45))
    fg=Image.fromarray(rgb).convert('RGBA'); fg.putalpha(alpha); fg.save(OUT/f'layer-{name}-subject.png')
    fillmask=cv2.dilate(mask,np.ones((7,7),np.uint8))
    bg=cv2.inpaint(rgb,fillmask,5,cv2.INPAINT_TELEA)
    Image.fromarray(bg).save(OUT/f'layer-{name}-background.png')
    records.append({'scene':name,'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':[600,840],'subject_pixels':int((mask>0).sum())})
(OUT/'asset-manifest.json').write_text(json.dumps({'seed':SEED,'generator_version':1,'pillow':Image.__version__,'opencv':cv2.__version__,'scenes':records},ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated 3 textures, frame mask, and 4 subject/background pairs. Seed:',SEED)
