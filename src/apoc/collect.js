// 收藏卡：卡片資料＋素材對照＋新階級註冊。由 tools/apoc/build_collect_card.py 產生，不要手改。
// 「特殊」是這張卡自己新增的階級；card-face.js 是凍結檔，所以標籤與參數在外面補。
window.ApocCollect = {
 "entries": {
  "mohuashaonv": {
   "id": "mohuashaonv",
   "name": "魔花少女",
   "rarity": "special",
   "kind": "depth",
   "scene": true,
   "pal": {
    "base": "#312a32",
    "glow": "#8b768e",
    "accent": "#ffe0ff",
    "ink": "#1b171c"
   }
  }
 },
 "assets": {
  "layer-mohuashaonv-subject.png": "art/collect-mohuashaonv-subject.webp",
  "layer-mohuashaonv-background.png": "art/collect-mohuashaonv-background.png",
  "alt": "art/collect-alt.webp",
  "alt-mask": "art/collect-alt-mask.webp"
 },
 "masks": {
  "frame": "masks/collect-frame.svg",
  "glitter": "masks/collect-glitter.png",
  "layer-mohuashaonv-subject.png": "masks/collect-mohuashaonv-subject.webp"
 },
 "rarity": {
  "label": {
   "special": "特殊"
  },
  "zlift": {
   "special": 56
  },
  "tilt": {
   "special": 14
  }
 },
 "bodyClass": [
  "font-system",
  "gem-faceted",
  "ink-chroma"
 ]
};
