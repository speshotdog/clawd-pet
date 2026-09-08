// 角色 rig 資料（顯示高度／四肢樞紐／擺幅倍率／睡姿／命中範圍）唯一的一份。
// pet.js（桌寵本體）、gacha-card.js（卡面）、clicker（遊戲舞台）都讀這裡，不另抄。
// 每個角色是 index.html 的一個 <template>，內含同一套結構 id（pet/body/face/legL/legR/pawR/眼睛組），
// 可選部件（tail/earL/earR）有就會動。
// hit：逐像素命中範圍，「頭部橢圓 ∪ 軀幹方框」（ellipse: [cx, cy, rx, ry]、box: [x0, x1, y0, y1]，皆為 240x256 stage CSS 座標）。
(function (root) {
  const CHAR_CFG = {
    dog: {
      // 兩角色「頭頂（頭皮，不算耳朵）」等高：都落在 CSS y=93
      height: 161,                             // CSS 顯示高度
      limbScale: 1,                            // 四肢擺幅倍率
      center: { x: 101, y: 142 },             // 臉的中心（視窗 CSS 座標）
      legL: [91, 301], legR: [158, 305], pawR: [277, 264],  // 四肢樞紐（viewBox 座標）
      up: -1,                                  // pawR 舉起的旋轉方向（SVG 順時針為正）
      sleepShift: '8px',
      sleep: [{ img: 'dog-sleep.png', h: 90.7 }],
      hit: { ellipse: [122, 141, 65, 48], box: [49, 191, 180, 254] },  // 頭+雙耳 / 軀幹
    },
    fox: {
      // viewBox 61 94 495 467（原圖 635x618 的子窗）；頭皮鞍部 y=152 → 高度 184 時頭頂在 CSS y=93
      height: 184,
      limbScale: 0.55,   // 部件切割縫較淺，擺幅縮小避免毛刺
      center: { x: 123, y: 148 },
      legL: [258, 503], legR: [368, 503], pawR: [246, 400],
      tail: [441, 443],
      up: -1,
      sleepShift: '-6px',
      sleep: [{ img: 'fox-sleep.png', h: 103.1 }],
      hit: { ellipse: [124, 126, 52, 48], box: [74, 213, 175, 252] },  // 頭+雙耳 / 裙+尾巴
    },
    jiaobu: {
      // viewBox 121 63 553 635；頭皮鞍部（雙角間）y=181 → 高度 198 時頭頂在 CSS y=93
      height: 198,
      limbScale: 0.5,    // 存根切割縫，擺幅減半藏縫
      center: { x: 107, y: 136 },
      legL: [234, 650], legR: [544, 650],
      pawR: [533, 452],  // 樞紐放手肘斷口上：舉刀時斷口零位移
      pawScale: 0.5,     // 實機驗證台定的乾淨上限：刀臂輪廓掃過肚子的視覺黑線在此幅度下 Gemini/人審 PASS
      tail: [604, 560],
      up: 1,             // 刀尖在樞紐左上，順時針才是舉起
      sleepShift: '0px',
      sleep: [{ img: 'jiaobu-sleep.png', h: 136.4 }],
      hit: { ellipse: [107, 128, 58, 42], box: [38, 202, 162, 254] },  // 頭 / 軀幹
    },
    yueyue: {
      // viewBox 40 21 688 726；頭皮鞍部（雙耳間）y=157 → 高度 198 時頭頂在 CSS y=93
      height: 198,
      limbScale: 0.5,
      center: { x: 118, y: 113 },
      legL: [150, 690], legR: [535, 692],
      pawR: [145, 515],  // 樞紐放臂根下緣：舉手時下端幾乎不掃動
      tail: [608, 385],  // 樞紐貼熔接縫：上緣熔接點掃動最小化（原 [635,525] 撕裂 -47%；驗證台掃 7 候選此值最佳）
      tailScale: 0.2,    // 實機驗證台定的乾淨上限：尾巴可見輪廓掃動 ±1° 內 Gemini/人審 PASS
      up: 1,             // 拳頭在樞紐左側，順時針上舉
      sleepShift: '0px',
      // 兩張睡姿變體，依 w 加權抽選：新版 3、舊版 1（舊版 1/4 機率）
      sleep: [
        { img: 'yueyue-sleep2.png', h: 112.8, w: 3 },
        { img: 'yueyue-sleep.png', h: 102.9, w: 1 },
      ],
      hit: { ellipse: [105, 111, 72, 52], box: [28, 210, 158, 254] },  // 頭+雙耳 / 軀幹+尾巴
    },
    zhenzhen: {
      // viewBox 150 139 848 844（原圖 1000x1000 的子窗）；羊毛球頂 y=147 →
      // 解 (254-H)+(147-139)*H/844=93 得 H=162.5，頭頂落在 CSS y=93.04
      height: 162.5,
      limbScale: 0.5,   // 腿樁切在黑色輪廓帶（黑對黑藏縫），擺幅減半，±6.5° 零裂縫
      center: { x: 85, y: 150 },   // 雙眼中點（視窗 CSS 座標），視線跟隨用
      legL: [354, 910], legR: [596, 936],   // 腿樁樞紐（viewBox 座標，放切割帶中點）
      pawR: [400, 500],   // pawR 留空（未拆手），樞紐給任意值不影響（旋轉空 g 無視覺）
      up: -1,             // pawR 舉起方向（此角無手，保留欄位）
      sleepShift: '0px',
      sleep: [{ img: 'zhenzhen-sleep.png', h: 132.4 }],
      hit: { ellipse: [120, 172, 81, 80], box: [52, 188, 172, 254] },  // 圓滾羊身 / 底部
    },
    zhenmu: {
      // viewBox 62 128 650 543（768 畫布子窗）；圓頂最高 y=135，觸手末端貼地 y=670。
      // 解 (254-163)+(135-128)*163/543 = 93.1 → 頭頂線 CSS y≈93（誤差 0.1px）
      height: 163,
      limbScale: 0.5,     // 觸手細長、組內兩條共轉，擺幅 13*0.5=6.5° 藏住根部縫
      center: { x: 100, y: 150 },       // 臉中心（豆眼中點的 CSS 座標）
      legL: [226, 506], legR: [500, 506],  // 各組觸手根部中點（存根覆蓋帶內，接近交界）
      pawR: [400, 400],   // pawR 留空（未拆手），樞紐給任意值（旋轉空 g 無視覺；缺欄位會 spread 爆錯）
      up: -1,             // pawR 空，此值無實效，保留供 rig
      sleepShift: '0px',
      hit: { ellipse: [120, 148, 88, 54], box: [46, 191, 200, 254] },  // 圓頂 / 觸手矮區
    },
    caihua: {
      // 綠龍。素材直接取自畫師分層的 PSD（見 index.html 的 char-caihua 註解）。
      // viewBox 0 0 559 466＝群組緊裁；height = 466 × 0.3336（全域倍率，見 角色製作工法 §1.5）
      height: 155.5,
      limbScale: 1,      // body 完整無挖除區、部件是畫師自己的完整形狀 → 不必為藏縫縮擺幅
      center: { x: 96, y: 153 },            // 雙眼中點（視窗 CSS 座標）
      gazeScale: 0,      // 眼睛與眉毛在原畫連成一體，平移 #face 會把眼睛扯離眉毛 → 不做視線跟隨
      legL: [66, 310], legR: [302, 294],    // 樞紐取部件最頂列中點（貼身體交界，掃動最小）
      pawR: [279, 233],  // 無手部件，樞紐值無實效（空 g）
      tail: [368, 346],  // 尾根：部件最左欄中點
      up: -1,
      sleepShift: '0px',
      sleep: [{ img: 'caihua-sleep.png', h: 86.4 }],
      hit: { ellipse: [91, 134, 64, 35], box: [27, 213, 168, 254] },  // 頭＋雙角 / 軀幹＋尾巴
    },
    // 以下五隻與采華同工法（角色製作工法 §1.8 分層素材直出）。limbScale 一律 1：
    // body 完整無挖除區、部件是畫師自己的完整形狀，沒有接縫要靠縮擺幅來藏。
    yueyue2: {
      height: 175.1,     // viewBox 0 0 584 525；525 × 0.3336
      limbScale: 1,
      center: { x: 101, y: 141 },
      legL: [46, 284], legR: [384, 264],
      pawR: [292, 262],  // 無手部件（空 g）
      tail: [372, 427],
      up: -1,
      sleepShift: '0px',
      sleep: [
        { img: 'yueyue-sleep2.png', h: 112.8, w: 3 },
        { img: 'yueyue-sleep.png', h: 102.9, w: 1 },
      ],
      hit: { ellipse: [89, 118, 67, 39], box: [23, 217, 158, 254] },
    },
    zhenzhen2: {
      height: 190.1,     // viewBox 0 0 587 570
      // 腿畫在身體「前面」，擺動時上端會從身體底部輪廓下滑出來（掃出量與角度成正比）
      limbScale: 0.5,
      center: { x: 82, y: 150 },
      legL: [124, 465], legR: [378, 488],
      pawR: [293, 285],  // 無手部件（空 g）
      up: -1,
      sleepShift: '0px',
      sleep: [{ img: 'zhenzhen-sleep.png', h: 132.4 }],
      hit: { ellipse: [121, 107, 97, 43], box: [22, 218, 149, 254] },
    },
    jiaobu2: {
      height: 183.8,     // viewBox 0 0 466 551
      limbScale: 1,
      center: { x: 107, y: 151 },
      legL: [59, 323],   // 左臂：走路時擺動
      legR: [310, 511],  // 腿長在 body 裡，legR 留空（樞紐值無實效）
      pawR: [344, 330],  // 右臂：舉手提醒
      tail: [384, 384],
      up: -1,
      sleepShift: '0px',
      sleep: [{ img: 'jiaobu-sleep.png', h: 136.4 }],
      hit: { ellipse: [118, 112, 76, 41], box: [42, 197, 153, 254] },
    },
    lk: {
      height: 195.8,     // viewBox 0 0 586 587（全隊最高）
      limbScale: 0.5,    // 同珍珍：腿在身體前面，擺幅減半壓低上端掃出量
      center: { x: 107, y: 123 },
      legL: [143, 457], legR: [294, 474],
      pawR: [293, 293],  // 無手部件（空 g）
      up: -1,
      sleepShift: '0px',
      sleep: [{ img: 'lk-sleep.png', h: 140.8 }],
      hit: { ellipse: [93, 102, 71, 44], box: [23, 217, 146, 254] },
    },
    yang: {
      height: 161.8,     // viewBox 0 0 525 485
      limbScale: 1,
      center: { x: 100, y: 154 },
      legL: [130, 399], legR: [376, 393],
      pawR: [298, 285],  // 身上那隻小手
      up: -1,
      sleepShift: '0px',
      sleep: [{ img: 'yang-sleep.png', h: 100.1 }],
      hit: { ellipse: [120, 129, 87, 36], box: [33, 207, 165, 254] },
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CHAR_CFG;
  else root.CharacterConfig = CHAR_CFG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
