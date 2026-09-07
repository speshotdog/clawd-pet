() => {
  const stage = document.getElementById('stage').getBoundingClientRect();
  const rel = el => { if (!el) return null; const r = el.getBoundingClientRect();
    return [Math.round(r.left - stage.left), Math.round(r.top - stage.top), Math.round(r.right - stage.left), Math.round(r.bottom - stage.top)]; };
  const out = { stage: [Math.round(stage.width), Math.round(stage.height)] };
  out.slots = rel(document.getElementById('slots'));
  out.meter = rel(document.querySelector('.package-meter'));
  out.hero = rel(document.getElementById('hero-position') || document.querySelector('#hero, .hero'));
  out.bag = rel(document.getElementById('bag'));
  out.gift = rel(document.getElementById('gift-bag')) || rel(document.getElementById('daily-bag'));
  out.boss = rel(document.getElementById('boss-challenge'));
  out.decos = [...document.querySelectorAll('#deco-layer .deco')].map(e => [e.src.split('/').pop(), rel(e)]);
  return out;
}
