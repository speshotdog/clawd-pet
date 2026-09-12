"""5.0 original-pixel selections. Polygons guide GrabCut, never paint RGB."""
from pathlib import Path
import base64, hashlib, io, json
import cv2
import numpy as np
from scipy import ndimage as nd
from PIL import Image, ImageDraw, ImageFont, ImageOps
from pool_data import CARDS_5_0

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'source-5.0'
OUT = HERE.parents[1] / 'docs/clicker/shots/5.0'
FONT = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 22)
# Coordinates are on the inspected 512x1000 poster / 540x960 video / 960x480 rice previews.
POLYGONS = [
 [(94,387),(110,362),(111,299),(132,277),(142,251),(162,259),(170,280),(181,307),(169,353),(166,365),(202,376),(219,360),(211,341),(224,317),(202,301),(247,275),(263,231),(280,210),(295,215),(290,245),(322,246),(343,257),(365,257),(359,229),(373,207),(395,207),(404,187),(419,196),(423,219),(413,237),(393,238),(420,257),(399,274),(401,287),(446,300),(439,320),(415,336),(419,359),(402,386),(420,410),(443,402),(470,403),(489,417),(490,480),(434,487),(400,475),(409,492),(375,513),(348,524),(334,539),(313,531),(300,522),(287,532),(265,526),(244,519),(220,526),(208,514),(185,494),(171,467),(172,440),(182,416),(163,408),(139,407),(108,402)],
 [(49,665),(44,640),(58,629),(73,635),(70,605),(75,548),(89,537),(108,566),(120,563),(128,531),(141,528),(155,558),(184,550),(203,554),(210,580),(206,613),(220,608),(236,586),(258,578),(270,582),(271,612),(259,628),(225,641),(222,660),(207,691),(211,707),(194,727),(172,739),(133,751),(110,772),(79,779),(62,773),(67,754),(78,733),(76,706),(57,694),(49,679)],
 [(191,805),(206,786),(225,784),(209,766),(201,740),(200,706),(214,680),(228,652),(260,636),(277,633),(272,616),(282,600),(301,596),(301,579),(318,569),(339,582),(347,601),(372,610),(400,627),(415,660),(420,687),(435,724),(438,756),(425,782),(420,794),(434,813),(433,849),(423,873),(425,916),(438,924),(459,938),(453,950),(160,956),(142,942),(158,928),(186,925),(188,883),(187,843)],
 [(11,559),(15,542),(29,539),(92,575),(94,558),(119,543),(130,530),(155,521),(177,527),(198,520),(218,530),(223,543),(242,553),(252,571),(254,593),(262,610),(258,634),(247,648),(245,666),(227,678),(204,684),(144,684),(116,674),(101,660),(95,627),(82,615),(83,594),(20,583)],
 [(245,641),(258,619),(254,594),(272,584),(282,554),(291,552),(304,587),(318,587),(333,552),(343,554),(355,594),(362,616),(369,685),(257,688),(242,680)],
 [(380,630),(386,606),(377,594),(384,577),(394,568),(382,566),(389,556),(411,546),(412,528),(425,519),(436,522),(437,539),(464,545),(477,519),(489,511),(500,518),(500,546),(516,560),(511,572),(498,580),(503,599),(496,607),(506,622),(503,639),(521,650),(519,680),(483,687),(403,682),(400,658),(388,656),(381,646)],
 [(347,448),(367,440),(371,423),(380,423),(382,439),(389,438),(393,421),(403,424),(404,435),(413,432),(417,413),(441,414),(439,431),(471,430),(458,449),(455,463),(434,466),(433,483),(452,489),(462,483),(466,474),(477,471),(482,476),(476,483),(475,495),(464,505),(443,508),(420,500),(415,509),(400,508),(395,499),(387,502),(376,505),(360,501),(365,478),(352,473),(347,459)],
]

def selection(im, points, preview):
    w, h = im.size
    coords = [(round(x*w/preview[0]), round(y*h/preview[1])) for x,y in points]
    guide = Image.new('L', im.size)
    ImageDraw.Draw(guide).polygon(coords, fill=255)
    region = np.array(guide)>0
    search = nd.binary_dilation(region, iterations=max(2,round(w/preview[0]*3)))
    gc = np.where(search, cv2.GC_PR_BGD, cv2.GC_BGD).astype('uint8')
    gc[region]=cv2.GC_PR_FGD
    gc[nd.binary_erosion(region, iterations=max(2, round(w/preview[0]*18)))]=cv2.GC_FGD
    if preview==(540,960):
        gc=np.where(region,cv2.GC_PR_FGD,cv2.GC_BGD).astype('uint8')
        gc[nd.binary_erosion(region,iterations=4)]=cv2.GC_FGD
    cv2.setRNGSeed(50)
    cv2.grabCut(np.array(im.convert('RGB')),gc,None,np.zeros((1,65)),np.zeros((1,65)),5,cv2.GC_INIT_WITH_MASK)
    mask = nd.binary_fill_holes((gc==1)|(gc==3))
    rgb = np.array(im.convert('RGB'))
    rgba = np.dstack([rgb,mask.astype('uint8')*255])
    assert np.array_equal(rgba[:,:,:3],rgb)
    return Image.fromarray(rgba), coords

def background(im, box):
    return ImageOps.fit(im.crop(box).convert('RGBA'), (600,840), method=Image.Resampling.LANCZOS)

def place(sub):
    sub=sub.crop(sub.getbbox())
    sub.thumbnail((520,530),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(600,840))
    xy=((600-sub.width)//2,700-sub.height)
    canvas.paste(sub,xy)
    return canvas,xy,sub.size

def pair(path, images, labels):
    sheet=Image.new('RGB',(620*len(images),920),'#242632')
    draw=ImageDraw.Draw(sheet)
    for i,(im,label) in enumerate(zip(images,labels)):
        pic=im.copy();pic.thumbnail((600,840))
        sheet.paste(pic,(i*620+10+(600-pic.width)//2,65),pic if pic.mode=='RGBA' else None)
        draw.text((i*620+14,15),label,font=FONT,fill='white')
    sheet.save(path)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    files=sorted(SOURCE.iterdir())
    hashes={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
    poster=Image.open(next(SOURCE.glob('*.jpg'))).convert('RGB')
    video=next(SOURCE.glob('*.mp4'))
    cap=cv2.VideoCapture(str(video));cap.set(cv2.CAP_PROP_POS_FRAMES,120)
    ok,bgr=cap.read();assert ok
    star=Image.fromarray(cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB));cap.release()
    star.save(OUT/'stargaze-frame-120.png')
    pngs=[Image.open(f) for f in SOURCE.glob('*.png')]
    clown=next(im for im in pngs if im.mode=='RGBA')
    rice=next(im for im in pngs if im.mode=='RGB')
    rows=[]; masks={}
    palette_path=HERE/'art/palette.json'
    palettes=json.loads(palette_path.read_text(encoding='utf-8'))
    for index,c in enumerate(CARDS_5_0):
        ident=c['id'];coords=None;altbox=None
        if index<7:
            im=poster if index<3 else star
            sub,coords=selection(im,POLYGONS[index],(512,1000) if index<3 else (540,960))
            if index==1:
                extras=[[(54,492),(57,478),(71,465),(98,461),(114,466),(118,486),(127,491),(128,504),(118,518),(91,535),(76,535),(63,523),(65,512)],
                        [(104,744),(115,743),(127,780),(155,818),(173,829),(193,829),(190,848),(174,854),(160,850),(160,878),(174,899),(190,902),(191,919),(170,918),(148,905),(136,887),(132,862),(129,832),(120,798)]]
                a=np.array(sub)
                for points in extras:
                    extra,extra_coords=selection(im,points,(512,1000))
                    a[:,:,3]=np.maximum(a[:,:,3],np.array(extra)[:,:,3])
                    coords.append(extra_coords)
                sub=Image.fromarray(a)
            # Only intact, unoccupied source scenery; no hole filling or cloned RGB.
            box=(100,130,650,500) if index<3 else (0,0,1080,820)
            altbox=[(105,135,385,500),(370,140,650,500),(100,300,540,525),
                    (0,0,580,812),(260,0,840,812),(500,0,1080,812),(250,100,1000,820)][index]
            source_name=next(SOURCE.glob('*.jpg')).name if index<3 else video.name
        elif index==7:
            im=clown.convert('RGBA');sub=im.copy();box=(0,0,*im.size)
            a=np.array(sub);white=(a[:,:,:3].min(axis=2)>235)
            seed=np.zeros_like(white);seed[0]=white[0];seed[-1]=white[-1]
            seed[:,0]=white[:,0];seed[:,-1]=white[:,-1]
            connected=nd.binary_propagation(seed,mask=white)
            a[:,:,3][connected]=0
            sub=Image.fromarray(a)
            source_name=Path(clown.filename).name
        else:
            im=rice
            points=[(271,232),(282,184),(317,142),(362,112),(410,100),(447,98),(489,111),(538,123),(573,95),(602,84),(621,91),(620,129),(608,166),(648,137),(682,128),(700,137),(697,173),(697,225),(680,276),(649,309),(614,329),(579,342),(546,358),(548,380),(525,402),(491,416),(443,415),(401,410),(361,393),(328,371),(302,341),(281,299)]
            sub,coords=selection(im,points,(960,480))
            a=np.array(sub);selected=a[:,:,3]>0
            pale=(a[:,:,0]>205)&(a[:,:,1]>175)
            seed=selected & ~nd.binary_erosion(selected) & pale
            fringe=nd.binary_propagation(seed,mask=pale & selected)
            a[:,:,3][fringe]=0
            sub=Image.fromarray(a)
            box=(2830,160,3830,1560)
            source_name=Path(rice.filename).name
        bbox=sub.getbbox()
        sub.save(OUT/f'{ident}-source-cutout.png')
        sub.getchannel('A').save(OUT/f'{ident}-source-mask.png')
        if c['kind']=='framed':
            result=sub.crop(bbox);result.thumbnail((600,580),Image.Resampling.LANCZOS)
            result.save(HERE/'art'/c['file']);layer=result
            xy=(0,0);size=result.size
            pair(OUT/f'{ident}-before-after.png',[im,result],['原圖 / '+c['name'],'本體卡圖 / '+c['name']])
        else:
            layer,xy,size=place(sub)
            back=background(im,box)
            layer.save(HERE/f'layer-{ident}-subject.png')
            back.save(HERE/f'layer-{ident}-background.png')
            result=Image.alpha_composite(back,layer)
            result.save(HERE/'art'/c['file'])
            pair(OUT/f'{ident}-before-after.png',[sub.crop(bbox),result],['原圖主體 / '+c['name'],'本體卡圖 / '+c['name']])
            if altbox:
                alt=Image.alpha_composite(background(im,altbox),layer)
                background(im,altbox).save(OUT/f'{ident}-alternative-background.png')
                pair(OUT/f'{ident}-background-options.png',[result,alt],['A 系列一致（展示提案）','B 各自背景（待選）'])
        key=f'layer-{ident}-subject.png' if c.get('scene') else c['file']
        small=layer.copy();small.thumbnail((300,420),Image.Resampling.LANCZOS)
        mask=Image.new('RGBA',small.size,'white');mask.putalpha(small.getchannel('A'))
        buf=io.BytesIO();mask.save(buf,format='PNG')
        masks[key]='data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode('ascii')
        visible=np.array(sub)[:,:,3]>0;rgb=np.array(sub)[:,:,:3][visible]
        median=np.median(rgb,axis=0).astype(int)
        color='#'+''.join(f'{x:02x}' for x in median)
        palettes[c['file']]={'base':color,'glow':color,'accent':color,'ink':'#080c17'}
        rows.append(dict(**c,source=source_name,source_size=im.size,subject_bbox=bbox,
            selection_polygon=coords,background_crop=box,alternative_background_crop=altbox,
            output_subject_offset=xy,output_subject_size=size,selected_pixels=int(visible.sum()),
            source_rgb_unchanged=True,frame=120 if 3<=index<7 else None))
        print(ident,bbox,int(visible.sum()),flush=True)
    palette_path.write_text(json.dumps(palettes,ensure_ascii=False,indent=1),encoding='utf-8')
    (HERE/'masks-5.0.json').write_text(json.dumps(masks),encoding='utf-8')
    (OUT/'preparation.json').write_text(json.dumps({'source_sha256':hashes,'cards':rows},ensure_ascii=False,indent=2),encoding='utf-8')
    assert hashes=={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in files}

if __name__=='__main__':main()
