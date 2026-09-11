"""Fail-closed validation before arithmetic or cross-entry comparison."""
import math
import re
from collections import Counter
from scope3_capture import SCOPE, artifact_hashes, digest
from pathlib import Path


def number(v):
    return type(v) in (int, float) and math.isfinite(v)


def positive_css(v):
    return isinstance(v, str) and bool(re.fullmatch(r'(?:\d+(?:\.\d+)?|\.\d+)px', v)) and float(v[:-2]) > 0


def validate(data, root, text_keys, box_keys):
    errors = []
    def require(ok, path):
        if not ok:
            errors.append(path)
        return ok
    if not require(isinstance(data, dict) and isinstance(data.get('entries'), dict), 'entries object'):
        return errors
    require(set(data['entries']) == set(SCOPE), 'exact seven-entry scope')
    from check_card_identity import measure, valid
    identity = measure()
    require(valid(identity), 'embedded card bytes identical to authority')
    require(data.get('assetIdentity') == identity, 'asset identity evidence matches current artifacts')
    require(data.get('artifactsUnchanged') is True, 'artifacts unchanged during collection')
    require(data.get('sourceHashes') == artifact_hashes(root), 'artifact hashes match current files')
    from pool_data import pool
    expected = {c['id']: c for c in pool()}
    labels = dict(common='普通', rare='精良', epic='史詩', legendary='傳說', mythic='神話')
    for entry, e in data['entries'].items():
        if not require(isinstance(e, dict) and isinstance(e.get('viewports'), dict), entry + ': viewports'):
            continue
        for vp, rec in e['viewports'].items():
            prefix = entry + '@' + vp
            if not require(vp in ('1440x1200','1024x900','390x844'), prefix + ': known viewport'):
                continue
            if not require(isinstance(rec, dict), prefix + ': record'):
                continue
            shot = rec.get('screenshot')
            require(isinstance(shot, dict) and isinstance(shot.get('path'), str)
                    and Path(shot['path']).is_file() and shot.get('sha256') == digest(shot['path']),
                    prefix + ': screenshot exists and matches hash')
            for field in ('pageErrors', 'brokenImages', 'captureDiagnostics'):
                require(isinstance(rec.get(field), list), prefix + ': ' + field + ' list')
            diag = rec.get('captureDiagnostics')
            require(isinstance(diag, list) and bool(diag) and all(isinstance(d, dict)
                    and d.get('errors') == [] and isinstance(d.get('decoded'), list)
                    and len(d['decoded']) > 0 for d in diag), prefix + ': successful decode/refit evidence')
            if isinstance(diag,list):
                for record in diag:
                    decoded=record.get('decoded') if isinstance(record,dict) else None
                    if isinstance(decoded,list):
                        require(all(isinstance(im,dict) and type(im.get('index')) is int and im['index']>=0
                                    and type(im.get('width')) is int and im['width']>0
                                    and type(im.get('height')) is int and im['height']>0 for im in decoded),
                                prefix + ': valid decoded image dimensions')
                        indices=[im.get('index') for im in decoded if isinstance(im,dict) and type(im.get('index')) is int]
                        require(len(indices)==len(decoded) and len(indices)==len(set(indices)),prefix + ': unique decoded image indices')
            cards = rec.get('cards')
            if not require(isinstance(cards, list) and bool(cards), prefix + ': cards list'):
                continue
            require(all(isinstance(c,dict) for c in cards), prefix + ': card objects')
            cards=[c for c in cards if isinstance(c,dict)]
            act = rec.get('activation')
            if not require(isinstance(act, dict), prefix + ': activation object'):
                continue
            for i, c in enumerate(cards):
                p = prefix + '/' + str(i)
                if not require(isinstance(c, dict), p + ': card object'):
                    continue
                cid = c.get('canonicalId')
                spec = expected.get(cid) if isinstance(cid,str) else None
                require(bool(spec), p + ': source card ID')
                if spec:
                    kind=spec.get('kind') or ('depth' if spec.get('scene') else 'flat' if spec.get('bleed') else 'framed')
                    require(c.get('kind')==kind,p + ': source card kind')
                    require(isinstance(c.get('id'),str) and c['id'].removeprefix('pool-')==cid,p + ': card identity')
                    require(c.get('nameText') == spec['name'], p + ': source name text')
                    require(c.get('rarity') == spec['rarity'], p + ': source rarity')
                    require(c.get('rarityText') == labels[spec['rarity']] + ' / ' + spec['rarity'].upper(), p + ': source rarity text')
                require(c.get('nameFits') == 'true', p + ': fitted name')
                require(c.get('entry') == entry and c.get('viewport') == vp, p + ': sample location metadata')
                require(c.get('pose','native') in ('native','neutral'), p + ': pose')
                if c.get('pose') == 'neutral':
                    require(number(c.get('sameSizeWidth')) and c['sameSizeWidth'] == 260, p + ': controlled width')
                    box=c.get('box')
                    require(number(c.get('contentWidth')) and abs(c['contentWidth']-260)<0.011
                            and isinstance(box,dict) and number(box.get('w')) and number(box.get('h'))
                            and abs(box['w']-260)<0.011 and abs(box['h']-364)<0.011,p + ': actual controlled dimensions')
                    layers=c.get('layers')
                    if require(isinstance(layers,list) and bool(layers), p + ': layers list'):
                        for layer in layers:
                            if not require(isinstance(layer,dict), p + ': layer object'): continue
                            require(isinstance(layer.get('classes'),str) and type(layer.get('index')) is int,
                                    p + ': layer identity')
                            for part in ('style','before','after'):
                                value=layer.get(part)
                                require(isinstance(value,dict) and bool(value) and all(isinstance(v,str)
                                        for v in value.values()), p + ': layer styles '+part)
                            rect=layer.get('rect')
                            require(isinstance(rect,dict) and all(number(rect.get(k)) for k in ('x','y','w','h')),
                                    p + ': layer geometry')
                for field in ('visible', 'inViewport', 'hasRect', 'selectedState'):
                    require(type(c.get(field)) is bool, p + ': boolean ' + field)
                for field in ('instance', 'slot'):
                    require(type(c.get(field)) is int and c[field] >= 0, p + ': nonnegative integer ' + field)
                require(number(c.get('contentWidth')) and c['contentWidth'] > 0, p + ': positive width')
                for field in ('nameFsVar', 'rarityFsVar'):
                    require(positive_css(c.get(field)), p + ': finite positive CSS ' + field)
                for field, keys in [('nameStyle', text_keys), ('rarityStyle', text_keys),
                                    ('frame', box_keys), ('gem', box_keys), ('plate', box_keys)]:
                    obj = c.get(field)
                    if require(isinstance(obj, dict), p + ': object ' + field):
                        for k in keys:
                            require(isinstance(obj.get(k), str) and bool(obj[k].strip())
                                    and not re.search(r'\b(?:NaN|Infinity)\b', obj[k]), p + ': CSS ' + field + '.' + k)
                        if field.endswith('Style'):
                            require(positive_css(obj.get('fontSize')), p + ': positive fontSize')
                for field, keys in [('nameRange', ('w','h','lines')), ('rarityRange', ('w','h','lines')),
                                    ('nameClear', ('left','right')), ('rarityClear', ('left','right')),
                                    ('box', ('x','y','w','h')), ('plateBox', ('x','y','w','h')),
                                    ('gemBox', ('x','y','w','h'))]:
                    obj = c.get(field)
                    if require(isinstance(obj, dict), p + ': geometry ' + field):
                        for k in keys:
                            require(number(obj.get(k)), p + ': finite ' + field + '.' + k)
                        for k in ('w','h'):
                            if k in keys:
                                require(number(obj.get(k)) and obj[k] > 0, p + ': positive ' + field + '.' + k)
                        if 'lines' in keys:
                            require(type(obj.get('lines')) is int and obj['lines'] == 1, p + ': single line ' + field)
                            card_box=c.get('box')
                            if isinstance(card_box,dict):
                                require(all(number(obj.get(k)) and number(card_box.get(k)) and obj[k]<=card_box[k]
                                            for k in ('w','h')),p + ': text range contained in card dimensions')
                for field in ('lineGap', 'gemOverlapArea'):
                    require(number(c.get(field)), p + ': finite ' + field)
                if c.get('role') == 'detail' and c.get('pose', 'native') == 'native':
                    b = c.get('box') or {}
                    w,h = map(int, vp.split('x'))
                    if all(number(b.get(k)) for k in ('x','y','w','h')):
                        require(b['x'] >= 0 and b['y'] >= 0 and b['x']+b['w'] <= w
                                and b['y']+b['h'] <= h, p + ': entire detail within viewport')
                platform=c.get('platformFonts')
                if not require(isinstance(platform,dict),p + ': platform fonts object'): platform={}
                for role in ('name','rarity'):
                    pf = platform.get(role)
                    if require(isinstance(pf, dict), p + ': font evidence ' + role):
                        require(type(pf.get('nodeId')) is int and pf['nodeId'] > 0, p + ': font node ID')
                        fonts = pf.get('fonts')
                        require(isinstance(fonts, list) and bool(fonts), p + ': nonempty fonts')
                        if isinstance(fonts, list):
                            require(all(isinstance(f, dict) and f.get('familyName') == 'Noto Sans TC'
                                        and f.get('isCustomFont') is True and type(f.get('glyphCount')) is int
                                        and f['glyphCount'] > 0 for f in fonts), p + ': valid embedded glyph evidence')
            if entry.startswith('gacha'):
                ceremony = act.get('ceremony')
                if require(isinstance(ceremony, list) and bool(ceremony), prefix + ': ceremony list'):
                    if not require(all(isinstance(b,dict) for b in ceremony), prefix + ': batch objects'): continue
                    for pose in ('native','neutral'):
                        rows = [c for c in cards if c.get('pose','native') == pose]
                        require(all(type(c.get('batch')) is int for c in rows), prefix + ': batch integer')
                        require({c.get('batch') for c in rows if type(c.get('batch')) is int} == set(range(len(ceremony))), prefix + ': batch coverage')
                        for bi,batch in enumerate(ceremony):
                            seq = batch.get('ids') if batch.get('ids') is not None else act.get('drawnIds')
                            actual = [c for c in rows if c.get('batch') == bi]
                            require([c.get('canonicalId') for c in actual] == seq, prefix + ': batch IDs ' + str(bi))
                            require([c.get('slot') for c in actual] == list(range(len(actual))), prefix + ': batch slots ' + str(bi))
            def signatures(pose):
                return Counter(tuple(repr(c.get(k)) for k in ('canonicalId','role','shadowPath','instance','batch'))
                               for c in cards if c.get('pose','native') == pose)
            require(signatures('native') == signatures('neutral'), prefix + ': exact native/neutral multiplicity')
    return errors
