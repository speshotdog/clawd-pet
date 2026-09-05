// 黃金動機庫：頻道的旋律身分（Undertale 式 Leitmotif 策略）
// 每句動機 = 16 步網格（一小節 16 分音符）上的節奏 + 相對音高輪廓
//   rhythm:  起音步位（0~15，遞增，必含 0）
//   contour: 與第一個音的半音差（第一個 = 0），引擎會貼合當下和弦/音階
// 篩選流程：候選批次（tools/motif_audition.py 渲染 demo）→ 人耳試聽 → 錄入
// 標準：「隔天還記得」才算 keeper；provisional = 風格對但還差口氣，待改良
//
// === 2026-07-17 第一批（Claude 作曲 13 句）用戶裁決 ===
// 淘汰：dawn-rise / far-memory / small-quest / star-cradle / after-rain /
//       skyward-question / deep-toll
// 及格線（暫收）：hero-return / leap-of-faith / chatter-run
// 風格對但差點意思（待改良變體）：okami-flow / lullaby-fall / neon-bounce
//
// === 2026-07-18 第二批（provisional 改良變體 6 句，管絃語法版渲染）用戶裁決 ===
// 及格：neon-bounce-v2b「霓虹滑」→ 錄入為 neon-glide，取代 provisional neon-bounce
// 淘汰：okami-flow-v2a 山泉湧 / okami-flow-v2b 山泉落 /
//       lullaby-fall-v2a 搖籃搖 / lullaby-fall-v2b 搖籃星 / neon-bounce-v2a 霓虹跳
//       （okami-flow / lullaby-fall 維持 provisional，下輪換方向再試）
//
// === 2026-07-18 第三批（情緒缺口 10 句：靜謐/氛圍系為主）用戶裁決 ===
// 全滅：山泉靜/搖籃息/殘響之淚/威壓半音/雪原漫步/謎之低語/凱旋號角/深海呼吸/時鐘齒輪/星空巡遊
// 教訓：稀疏溫吞的句子不會過——過關句全是節奏性格強、方向感清楚的
//
// === 2026-07-18 第四批（節奏抓耳路線 8 句，引擎升級後渲染）用戶裁決 ===
// 及格：double-courage 雙倍勇氣 / matsuri-riot 祭典騷動 / homeward 回家路
// 淘汰：追擊 / 壞心眼舞步 / 決意 / 星之航路 / 雨簷
// 用戶反饋：引擎升級後整體聽感有變好；下一步研究「抓耳/副歌」方向
export const MOTIF_LIBRARY = [
  { id: 'hero-return', name: '勇者歸來', mood: 'heroic',
    rhythm: [0, 2, 3, 4, 8, 12], contour: [0, 0, 0, 5, 4, 7] },     // 三連同音號角→跳進→峰頂
  { id: 'leap-of-faith', name: '信仰之躍', mood: 'epic',
    rhythm: [0, 4, 6, 12], contour: [0, 12, 10, 7] },               // 開頭八度大跳再級進落下
  { id: 'chatter-run', name: '衝刺跑句', mood: 'energetic',
    rhythm: [0, 1, 2, 3, 4, 8, 12], contour: [0, 2, 4, 5, 7, 9, 7] }, // 16 分衝刺→登頂→回音
  { id: 'okami-flow', name: '山泉', mood: 'wafu', provisional: true,
    rhythm: [0, 2, 6, 8, 12, 14], contour: [0, 3, 5, 3, 0, -2] },   // 五聲流水（待改良）
  { id: 'lullaby-fall', name: '搖籃曲', mood: 'gentle', provisional: true,
    rhythm: [0, 6, 8, 12, 14], contour: [0, 4, 2, 0, -1] },         // 附點搖籃（待改良）
  { id: 'neon-glide', name: '霓虹滑', mood: 'city',
    rhythm: [0, 3, 6, 10, 12, 14], contour: [0, -2, 0, 3, 5, 3] },  // 切分上滑到亮點再回落＝燈管逐格點亮
  { id: 'double-courage', name: '雙倍勇氣', mood: 'battle',
    rhythm: [0, 2, 4, 6, 8, 10, 12], contour: [0, 0, 3, 3, 7, 7, 10] }, // 每個音講兩次再登階＝battle cry
  { id: 'matsuri-riot', name: '祭典騷動', mood: 'festive',
    rhythm: [0, 2, 4, 7, 8, 10, 12, 14], contour: [0, 4, 0, 4, 5, 4, 0, 4] }, // 三度彈跳 oom-pah＋切分踉蹌
  { id: 'homeward', name: '回家路', mood: 'warm',
    rhythm: [0, 2, 6, 8, 10, 14], contour: [0, 4, 2, 5, 4, 0] },    // 蹦跳步伐，尾音落回原點的安心感
];
