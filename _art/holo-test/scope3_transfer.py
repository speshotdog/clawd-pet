"""Transfer each full CSS image once, instead of repeating base64 per pseudo-element."""
import re
from scope3_layers import normalize_url


def collect_compact(page, script, target_id=None):
    payload=page.evaluate("""(targetId)=>{
      const original=window.__parity.cards;
      if(targetId)window.__parity.cards=()=>original().filter(c=>(c.dataset.id||'').replace(/^pool-/,'')===targetId);
      let cards;
      try{cards=("""+script+""")()}finally{window.__parity.cards=original}
      const resources=[],known=new Map();
      const pack=value=>value.replace(/url\(([^)]+)\)/g,(_,url)=>{
        if(!known.has(url)){known.set(url,resources.length);resources.push(url)}
        return 'url(parity-resource:'+known.get(url)+')';
      });
      for(const card of cards)for(const layer of card.layers)
        for(const part of ['style','before','after'])
          for(const key of Object.keys(layer[part]))layer[part][key]=pack(layer[part][key]);
      return {cards,resources};
    }""",target_id)
    resources=[normalize_url(re.fullmatch(r'url\(([^)]+)\)','url('+url+')')) for url in payload['resources']]
    for card in payload['cards']:
        for layer in card['layers']:
            for part in ('style','before','after'):
                for key,value in layer[part].items():
                    layer[part][key]=re.sub(r'url\(parity-resource:(\d+)\)',lambda m:resources[int(m[1])],value)
    return payload['cards']
