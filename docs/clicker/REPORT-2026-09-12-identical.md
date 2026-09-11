# 三面卡圖同一性：2026-09-12

> **2026-09-12 夜：BACKLOG 兩項已做完，接手改看 [REPORT-2026-09-12-picker-drag.md](REPORT-2026-09-12-picker-drag.md)（Astra v3 EXIT 0）。** 原備註：[BACKLOG-2026-09-12.md](BACKLOG-2026-09-12.md) —— 使用者試玩後提的兩項未來開發備註
> （技能挑選改顯示卡片＋拖曳設定、卡片四角 L 型黑邊的覆蓋率補洞），本輪都沒有動。

## 1. 資產同一性

卡圖現在只由 `card_assets.py` 編碼，`update_demo_data.py` 在既有建置順序的第一步產生權威檔與 `card-assets.json`。其餘建置器只讀取並嵌入同一串 bytes，不再各自重編卡圖。來源或權威檔雜湊不符會停止建置。沒有 commit。

採 lossless WebP（exact=True、method=6），600×840 為 bounding box。原本已為 600×840 的場景圖維持該尺寸；去背卡原圖比例各異，保持比例、不拉伸、不加透明邊、不放大小原圖。這不是每張檔案都硬改為 600×840。

六個抽卡／卡冊入口各嵌入完整 63 卡、71 個圖層；team 嵌入其既有 24 卡、28 個圖層。共 **454 個引用**逐一驗 SHA-256、data URI 完整相等，以及解碼 RGBA 完全相等，全部通過。解碼像素差為 0。這項資產檢查也已接入正式判定器，缺證據或與現有產物不符會 FAIL。

[逐入口原始資料](shots/identical/identity.json)。下表「六入口」表示 gacha、gacha-standalone、gacha-test、gacha-test-standalone、pool、pool-standalone；加 team 者七入口共用。

| 卡／圖層鍵 | 尺寸 | SHA-256（編碼 bytes） | 共用入口 |
|---|---|---|---|
| rocketdog / layer-rocketdog-subject.png | 600×840 | `153d74266f266c9dba1f3b376a3a711abd10ab7b33f472085a9fdd4caec4ccd1` | 六入口＋team |
| rocketdog / layer-rocketdog-background.png | 600×840 | `8b1700b70382297314ea496b0c08c273ecb7fd6a9a6e2435f9847e7b2adbc94a` | 六入口＋team |
| alienkitty / layer-alienkitty-subject.png | 600×840 | `930734baecfd85774184e0e565c6c48b1ced1ea5bc2f199d7af806a65aa837c2` | 六入口＋team |
| alienkitty / layer-alienkitty-background.png | 600×840 | `c47ad87cc85a84ef996fc03b809998f0d56cddc19de2a48531c814bbc4d43619` | 六入口＋team |
| astronaut / layer-astronaut-subject.png | 600×840 | `b26908bdc4107d914850e9d86ef77aee16ecc24453106fb5c238ebd066ce184c` | 六入口＋team |
| astronaut / layer-astronaut-background.png | 600×840 | `64819fd2d08b48e0cb29b76d306fd09e43c54716c1dd4bed210ade78f90652e7` | 六入口＋team |
| fluffdog / layer-fluffdog-subject.png | 600×840 | `481d3239e47428fd6a8c609e593094e7c5bd4695668e4148de405855f371b6fd` | 六入口＋team |
| fluffdog / layer-fluffdog-background.png | 600×840 | `2dc7d8742632e5a0364c95d532a225d7e8b298fa33cadd24d46e79e6b06cd64a` | 六入口＋team |
| liulangyueshou / card-liulangyueshou.png | 600×506 | `3e6a3f39207eff96955a974b08ad6e1dcfe180e898f0eabacac9edd966f352de` | 六入口＋team |
| mieshi / card-mieshi.png | 509×580 | `733bc9dc3ee6445411ed5df453f5ef54690517a6f741ae8ef0e99944b0e7dcf8` | 六入口＋team |
| qinghua / card-qinghua.png | 600×575 | `8e82a841108bdce6ff740e5ae4c4b3bd204d60bfadec2fc7e83e8e4c90f0b081` | 六入口＋team |
| shabaolingzhu / layer-shabaolingzhu-subject.png | 600×840 | `1461708a2e1177efce34fd7c41a13d724263e0fceb535bbf0967ee4418d03135` | 六入口 |
| shabaolingzhu / layer-shabaolingzhu-background.png | 600×840 | `86bc6fdeaeb3ff9f539fb7b00144c17718e4c0b8f70c1fca5f2441dc28c4fa5a` | 六入口 |
| wanwumythic / card-wanwumythic.png | 509×490 | `7cc7f87f78a9461e0e99ba824f8ea7e9b6f797954b9f98589767de9e7f769740` | 六入口 |
| yueyuexian / card-yueyuexian.png | 561×569 | `4fdfda3a462294297179e4518ecdd8274775067ba243a53b9f03c397ef44bc61` | 六入口 |
| zhenjunyue / layer-zhenjunyue-subject.png | 600×840 | `2f7a649df95de27e21ef88f7dcc3b24a435c6924266883ce751df2766e713dcb` | 六入口 |
| zhenjunyue / layer-zhenjunyue-background.png | 600×840 | `f570785db617495c01ef7ed90fcdd19a7bbba004f034d69ab149612ea27a8d95` | 六入口 |
| zhenqiqiu / layer-zhenqiqiu-subject.png | 600×840 | `585bbe4de3c66a6ebfc313b336280787d0632f1a4493fb99813113d9e7f7cca2` | 六入口 |
| zhenqiqiu / layer-zhenqiqiu-background.png | 600×840 | `8c57471046a2b3413e772088c99f745597c604ac04d22ea7915e2d638f4c01e0` | 六入口 |
| zhenzhen / layer-zhenzhen-subject.png | 600×840 | `1428de488d32e4684774f92579e5d5014aedac06d667bd0b9637c49565142881` | 六入口 |
| zhenzhen / layer-zhenzhen-background.png | 600×840 | `fadf81e06fb746c37b48d28ebc3a1f4bede04082f71659cba7cce5d6400dd2bf` | 六入口 |
| foxfriend / card-foxfriend.png | 566×580 | `543b7c28eb0eccbefc8c150da4b3697136da3d3837dc570de170f4d9e3c6a2c5` | 六入口＋team |
| jiaotou / card-jiaotou.png | 582×515 | `0a164f648409d85c0bb0f95318f5dd25a19d751d6bf553b08b888b859c414f6f` | 六入口＋team |
| jinggou / card-jinggou.png | 535×515 | `598d5ae17b145df10a6687605a878b70d70d8774bafde675b8007d16a1b8b33b` | 六入口＋team |
| jintianwoshengri / card-jintianwoshengri.png | 482×580 | `8f4ec9fe802ef50e934c41f4ee43480c02ec4dfa862663b55e36638d06b27a91` | 六入口＋team |
| lksphinx / card-lksphinx.png | 600×492 | `36bb490ffc1222d773afed8b9aaafcd3d5736264b6db8ea2d3f3a685aaeccce8` | 六入口＋team |
| shiyi / card-shiyi.png | 600×526 | `4b4df29f116b0139aa2cd45f7d67c5157321c30dee6cbfd4da9d1206486a1aa1` | 六入口 |
| wanwu / card-wanwu.png | 600×483 | `bee707516dee1741b81fab0bfac68004a999ad75c6a0942ac01a043363b04f86` | 六入口 |
| yuefeimo / card-yuefeimo.png | 600×419 | `798cabdf4d65d094f7065955afca9d808d515df9b0f6c5a0fb26d1684ab1c327` | 六入口 |
| yuesong / card-yuesong.png | 591×580 | `270207878e466c3fa4ff21a9d54eabf3e11348771386fde4074b46c6f5637f74` | 六入口 |
| zhenbush / card-zhenbush.png | 579×580 | `945b1d59de1dfe12456e465fe08c88734883711cc5be0850e28aad0c90fbd86a` | 六入口 |
| zhenfang / card-zhenfang.png | 600×545 | `a8936a248e138e8f08a9e9ad2b028176de729ec107fe88a6230ca32cb60368b8` | 六入口 |
| zhenmoss / card-zhenmoss.png | 600×507 | `5690a54e545be1089b4f2b093aaa42333974e4197ae44f2d2bdaba9572b98cf0` | 六入口 |
| bianbiancaihua / card-bianbiancaihua.png | 600×536 | `2f2fc9642d580ee3a1ff388322937f13ac95748fcb57d847276d6e6a2ffb4b7f` | 六入口＋team |
| bingyang / card-bingyang.png | 600×520 | `36cd8d4f3bd9ef411d81e360e8aaa2b51477c61a48544c8c9b6196609a5eeda0` | 六入口＋team |
| chengtiregou / card-chengtiregou.png | 449×580 | `7b88039612f22799c94e7d767b134c331f23672127bb05b846c80c58f6331ec3` | 六入口＋team |
| foxmoney / card-foxmoney.png | 600×357 | `d5f40ddbe51692424eda8c6aa4784276216c701fd213b46cf3f5df01e3817feb` | 六入口 |
| gebugou / card-gebugou.png | 600×548 | `38df12590bb726a8b4419f47f3984fbfd7c690aa30aa8304459277d15107aab1` | 六入口＋team |
| geimieqianhaoma / card-geimieqianhaoma.png | 600×345 | `70ae34a0a73553e7b4c28300bdb6301d00a862e151a083dc520fec711c5905ae` | 六入口 |
| lkreal / card-lkreal.png | 600×495 | `bf7f656a52f79864ea3dcc9c1b2e005892e6db59e1aa6dae792fe528940a5061` | 六入口 |
| mianhua / card-mianhua.png | 600×538 | `a28df7715d31ece01cc150ee13218c3577881c8040749fd9536fd5f29cf2fc3c` | 六入口 |
| qipupu / card-qipupu.png | 600×492 | `49988da7743ef9c050b993d49b4620fb0f648ffdefb4f6151e325a9b2ec545f5` | 六入口 |
| xiaochouyue / card-xiaochouyue.png | 600×482 | `6acae5dabf9f8c0e97c731c7bcb341e819a36568ddc31aa5373d281557b2459b` | 六入口 |
| xiaojiaojiao / card-xiaojiaojiao.png | 510×580 | `2a29edb8086e79c226159707137ab959f60cf6b4d328a362d11a2d1131a627a0` | 六入口 |
| yangpu / card-yangpu.png | 305×334 | `cdc9b79867e72dbbc3389db4428f88183f2f8d2ab1476d41fec62035de68a2d0` | 六入口 |
| yuetrumpet / card-yuetrumpet.png | 583×422 | `ecfa4b4ec5d902835f1e84f22bd64090958c0d8f7c77560eb0444eb0513f841a` | 六入口 |
| yuexiong / card-yuexiong.png | 600×471 | `6d006b538332e7ae912df0a7c6724b3272a145b4c65f3df163fba6050c316ca7` | 六入口 |
| zhenbing / card-zhenbing.png | 600×520 | `71003906ff3a10a4264ac15e53253919752f5ded7b8b53878f50e0f2b9503bb6` | 六入口 |
| zhencao / card-zhencao.png | 500×372 | `fbbd6a4dee82a8ab9868ce9ce96833d4cde4ea8de811dcb417c53ef0d3431e51` | 六入口 |
| zhenpete / card-zhenpete.png | 600×462 | `62c8b410760cbca79d19536550f894e424cfa19f67715e34f24e036057d35f48` | 六入口 |
| ababa / card-ababa.png | 600×375 | `85f9084d4cfd31cc7bcdacfd5d4876b262ab6ff43c973562066694e631f3c550` | 六入口 |
| alu / card-alu.png | 554×562 | `f316c04a33179f5c9f4dfe22507d5d921bd2e08a2a904da68fc65e86d6133d32` | 六入口＋team |
| chaichai / card-chaichai.png | 600×487 | `7a2563e901c08325df619e48691eb47d2cc7f8876a378a43b14617b4408859d3` | 六入口＋team |
| gebuyang / card-gebuyang.png | 600×360 | `a5bce878a79212dc28d291cb355fa8048d2d5e9957c7ba094aff2e25de214d47` | 六入口 |
| guanjiu / card-guanjiu.png | 600×552 | `7e3c0a306bde96848f4d8cdb7a89c72e1939e7fb3d2fa2df738a85b35147724a` | 六入口＋team |
| jiaochi / card-jiaochi.png | 543×580 | `6ad5e9b4de503821399a8f66c20776fa5aa643ac0c3dd5acceaeb927481f53e6` | 六入口＋team |
| jiaolan / card-jiaolan.png | 497×580 | `81347d3b7a657f0d0197f4bd07a9ef93d72d44f1c63c2a104a0077875cfd2311` | 六入口＋team |
| manhua / card-manhua.png | 600×447 | `eb8da7ecca40633ab9a03ac4933f9be830595071fdc580c0a2fae64cee5850e5` | 六入口＋team |
| miepupu / card-miepupu.png | 600×543 | `bc20e9d0a1b3284c0777c018668397ab6f7758435fbafe11d16fc0adce8cbabf` | 六入口＋team |
| miepuxiong / card-miepuxiong.png | 578×580 | `a0f82404180d3545b258d4d7727dac2cd9e4e5c50c51f5cd82b538f87ef6bb88` | 六入口＋team |
| pufayueyue / card-pufayueyue.png | 600×481 | `07d988e26aadbb06ffed810d4630164f2edbdc36d8f9df95a8bb9d129e425649` | 六入口 |
| salamander / card-salamander.png | 600×405 | `4a8f3e9d0d92edec8131086c60439b7d9870e31630502bc2a73009764701c3aa` | 六入口 |
| seal / card-seal.png | 600×431 | `2d6d496c723cf27fb2c987111e41e36467cda4f3ae59c3147c5ae29db992e3b3` | 六入口 |
| shiwang / card-shiwang.png | 447×580 | `199628b4f35ac11b17c679c9e46bfb6030b46a1faa1ab3a86e0b63154699bfa9` | 六入口 |
| waisongmiege / card-waisongmiege.png | 600×418 | `360417878b7750e33d6b02ac6e0e3fc6bad83974bbf456a528f917cc20274f40` | 六入口 |
| yangtuo / card-yangtuo.png | 534×580 | `69efb85d2125d2688adaab1e09530917b1aa7a091463518c4eba050f51ca59e1` | 六入口 |
| zhenjpg / card-zhenjpg.png | 568×546 | `4d63d1e182089e6cbe8ef92e67e442d48596fea8ca63d707e43c648298bc02c0` | 六入口 |
| zhenwang / card-zhenwang.png | 600×495 | `e01fcf46ca3d5e1db2129e63c42d0206a9dc12d54529029242a58a9cdaf1ca61` | 六入口 |
| ballyellow / toy-ballyellow.png | 328×269 | `41d6b554cfc3b49d97dc17580f421e6407c0f39ae06995c3dfda33ec4addb691` | 六入口 |
| beachball / toy-beachball.png | 284×284 | `9b3d8365a171832862ee3b71b3ab386749ce3e844c6db92543a4e3aa57e6d9f5` | 六入口 |
| dino / toy-dino.png | 600×356 | `9e58de1f85cd552414204e24cf013d3aee493dcdbbad1a1b3398ec2b432cf438` | 六入口 |

## 2. 像素結果與完整採集

受控卡寬 260 CSS px、DPR 2，裁圖 520×728。每一個卡型／viewport 先做七入口各三次獨立程序截圖的重現性檢查，再做跨入口比較；來源產物與採集工具 SHA-256 必須相符。原有門檻保持：重現性 mean <1.0；跨入口 mean <1.0、差值 >32 的像素比例 <1%、亮度標準差 >8。沒有事後對位。

| viewport | 入口 | depth / rocketdog mean | framed / chaichai mean | flat / mieshi mean |
|---|---|---:|---:|---:|
| 1440x1200 | gacha | 0.000000 | 0.000000 | 0.000000 |
| 1440x1200 | gacha-standalone | 0.000000 | 0.000000 | 0.000000 |
| 1440x1200 | gacha-test | 0.000000 | 0.000000 | 0.000000 |
| 1440x1200 | gacha-test-standalone | 0.000000 | 0.000000 | 0.000000 |
| 1440x1200 | pool | 0.000026 | 0.000021 | 0.000026 |
| 1440x1200 | pool-standalone | 0.000026 | 0.000021 | 0.000026 |
| 1440x1200 | team | 0.085971 | 0.049461 | 0.000026 |

並排截圖：[rocketdog](shots/identical/controlled/1440x1200/rocketdog-all-entries-260px.png)、[chaichai](shots/identical/controlled/1440x1200/chaichai-all-entries-260px.png)、[mieshi](shots/identical/controlled/1440x1200/mieshi-all-entries-260px.png)

| viewport | entry | depth mean | framed mean | flat mean |
|---|---|---:|---:|---:|
| 1024x900 | gacha | 0.000000 | 0.000000 | 0.000000 |
| 1024x900 | gacha-standalone | 0.000000 | 0.000000 | 0.000000 |
| 1024x900 | gacha-test | 0.000000 | 0.000000 | 0.000000 |
| 1024x900 | gacha-test-standalone | 0.000000 | 0.000000 | 0.000000 |
| 1024x900 | pool | 0.000026 | 0.000021 | 0.000026 |
| 1024x900 | pool-standalone | 0.000026 | 0.000021 | 0.000026 |
| 1024x900 | team | 0.085971 | 0.049461 | 0.000026 |

並排截圖：[rocketdog](shots/identical/controlled/1024x900/rocketdog-all-entries-260px.png)、[chaichai](shots/identical/controlled/1024x900/chaichai-all-entries-260px.png)、[mieshi](shots/identical/controlled/1024x900/mieshi-all-entries-260px.png)

| viewport | entry | depth mean | framed mean | flat mean |
|---|---|---:|---:|---:|
| 390x844 | gacha | 0.000000 | 0.000000 | 0.000000 |
| 390x844 | gacha-standalone | 0.000000 | 0.000000 | 0.000000 |
| 390x844 | gacha-test | 0.000000 | 0.000000 | 0.000000 |
| 390x844 | gacha-test-standalone | 0.000000 | 0.000000 | 0.000000 |
| 390x844 | pool | 0.000026 | 0.000021 | 0.000026 |
| 390x844 | pool-standalone | 0.000026 | 0.000021 | 0.000026 |
| 390x844 | team | 0.085971 | 0.049461 | 0.000026 |

並排截圖：[rocketdog](shots/identical/controlled/390x844/rocketdog-all-entries-260px.png)、[chaichai](shots/identical/controlled/390x844/chaichai-all-entries-260px.png)、[mieshi](shots/identical/controlled/390x844/mieshi-all-entries-260px.png)

跨入口結果：63/63 通過；最大 mean=0.085971，最大單通道差=2，最大 >32 比例=0.000000%，最低亮度標準差=59.386271。

重現性：9/9 個 gate 通過，189 次兩兩比較，最大 mean=0.000000、最大單通道差=0。

完整採集：[collection.log](shots/identical/collection.log)；正式判定：[report.log](shots/identical/report.log)；元件檢查：[assets.log](shots/identical/assets.log)；反例：[sabotage.log](shots/identical/sabotage.log)。

本輪重新完整採集七入口 × 三 viewport，共 1,920 筆卡紀錄、3,840 個字型樣本；非預期 fallback 0、頁面錯誤 0。正式判定 exit 0：同尺寸屬性差異 0、幾何差異 0；元件工具 exit 0：960 次比對、差異 0。原始 rarityRange 高度跨入口最大差為 0。詳見 [採集統計](shots/identical/collection-summary.json)。所有 21 張原生截圖位於 `shots/parity/shots/identical/<entry>/<viewport>.png`，其路徑與雜湊綁在完整採集檔。這次完整採集取代先前 scope3-final 的完成度疑義，沒有覆寫歷史證據。

量測精度修正：所有入口本來都走同一個 `range()`，兩端都有 `toFixed(3)`，並非一端兩位、一端三位。現在兩端都直接保留瀏覽器原始 Range 寬高，移除毫像素四捨五入，沒有增加容差。現存上一輪壓縮採集檔未重現簡報提及的 17.710／17.711 差異（見 [舊資料掃描](shots/identical/rounding-before.json)），因此未宣稱已定位那一筆舊失敗的原始觸發過程。

新增反例把同張圖編成 PNG，確認 RGBA 完全相同後改動編碼 SHA；正式判定器仍必須拒收。另有移除資產同一性證據的反例。

反例實測 **56/56 通過**：clean exit 0，56 個反例均 exit 1 且有 FAIL 斷言，包含「不同編碼但像素完全相同」與缺少資產同一性證據。原始輸入測試前後 SHA 不變。[機讀摘要](shots/identical/sabotage/sabotage-summary-scope3.json)。完整採集壓縮成 [parity-identical.json.gz](shots/parity/parity-identical.json.gz)：173,747,406 → 6,151,768 bytes，已驗證解壓逐位元相同；[壓縮證據](shots/identical/compression.json)。

## 3. 體積

唯一調整的預算是 map20：6,000,000 → 20,000,000 bytes。理由是容納共用 lossless 卡圖與 quality 94 地形，不再因 6 MB 腳本預算拒收同一份卡圖。註解、上下限檢查與 build.json 均記錄新值。

| 產物 | 修改前 bytes | 現在 bytes | 舊上限 | 新上限 |
|---|---:|---:|---:|---:|
| deluxe-gacha-b.html | 2115132 | 14842177 | 無 | 無 |
| deluxe-gacha-b-standalone.html | 5207072 | 16333843 | 無 | 無 |
| deluxe-gacha-b-test.html | 2115164 | 14842209 | 無 | 無 |
| deluxe-gacha-b-test-standalone.html | 5207104 | 16333875 | 無 | 無 |
| cards-remade.html | 2024154 | 14751143 | 無 | 無 |
| cards-remade-standalone.html | 5223641 | 15923037 | 無 | 無 |
| map20.html | 5984408 | 11679652 | 6000000 | 20000000 |
| demo-standalone.html | — | 5155290 | 15728640 | 15728640 |

地形 quality **94 → 94，沒有變好也沒有降級**。map20 實際 11,679,652 bytes；[建置證據](shots/identical/map-build/build.json)。pool 與兩個 gacha standalone 建置器原本沒有體積 gate；demo-standalone 的 15 MiB gate 原封不動，demo 僅按規定順序重建，未納入七入口驗收。地圖 template、版面、導覽、關卡區未改。

依 scope3 報告的十步順序建置全部成功；權威資產產生已納入第一步 update_demo_data.py。最後一步使用 `python build_map20.py --evidence-dir ../../docs/clicker/shots/identical/map-build`，避免覆寫歷史證據。

在 `_art/holo-test` 的驗收重跑指令（每步檢查 exit code）：

```powershell
python check_card_identity.py
python check_card_parity.py --label identical --fixture auto --shots --entries gacha,gacha-standalone,gacha-test,gacha-test-standalone,pool,pool-standalone,team
python check_card_parity_report.py --input ../../docs/clicker/shots/parity/parity-identical.json --reference gacha-test
python check_card_assets.py --input ../../docs/clicker/shots/parity/parity-identical.json --output ../../docs/clicker/shots/identical/asset-layers.json
python check_card_parity_sabotage.py --input ../../docs/clicker/shots/parity/parity-identical.json --out ../../docs/clicker/shots/identical/sabotage
python run_identical_pixels.py
# 等其他瀏覽器驗收結束後再測效能
python measure_identical_decode.py
```

JSON 路徑不存在時，判定／元件／反例工具會自動讀取同名 .json.gz。像素 runner 對每組呼叫 check_shot_determinism.py 與 shoot_card_parity_samesize.py；只有來源、工具、viewport、card 與七入口都吻合且已通過的 gate 才可重用。

## 4. 延後 decode 的效能實驗與結論

**不採用。** 單檔 bytes 已內嵌，延後 decode 不會減少檔案大小。候選只在設定同一個 src 前加 `loading=lazy`／`decoding=async`，沒有縮圖、沒有 hover 換高清；未寫入產品。

每個 viewport 做 baseline／候選各三次新 headless Chromium 程序，DPR 1，交錯順序，等待其他驗收程序結束後才測。首次卡圖 paint 取 Element Timing observer 第一次報告卡內元素 renderTime；另列 DOM ready：rAF 中可見卡圖均 complete 且 naturalWidth>0、字型已載入的第一個時刻。兩者都不是螢幕物理呈現時間。待機 fps 取最後三秒 rAF。JS heap 取 Performance.getMetrics；影像記憶體取 detailed memory dump 的 `cc/image_memory` size（避免加總其子項造成重複）；另記 unique complete 圖片 width×height×4 的 RGBA 估算，兩者不可混稱。

三次中位數：

| viewport | 版本 | 首次卡圖 paint ms | DOM ready ms | 待機 fps | JS heap bytes | compositor image memory bytes | RGBA 估算 bytes |
|---|---|---:|---:|---:|---:|---:|---:|
| 1440x1200 | baseline | 2044.0 | 1993.2 | 60.00 | 3913648 | 41340928 | 93115336 |
| 1440x1200 | 候選 | 1916.0 | 1845.0 | 60.00 | 3834512 | 41340928 | 69231400 |
| 390x844 | baseline | 1748.0 | 1779.1 | 60.00 | 3838216 | 16244736 | 93115336 |
| 390x844 | 候選 | 1732.0 | 1708.4 | 60.00 | 3881940 | 16244736 | 18523280 |

12 次執行中：來源改變 frame 合計 0；非零內在尺寸先小後大 frame 合計 0；首次 DOM ready 之後仍有可見未完成圖片的 frame 合計 0。

不採用的依據：兩個尺寸的待機均約 60 fps，實測 compositor 影像記憶體沒有下降，JS heap 中位數差僅極小幅度；初次 paint 的差異如表，不能把較少的 complete 圖片／RGBA 估算當作已省下實際影像 cache。這次沒有證明 hover-only decode 的待機或影像 cache 收益，也沒有實體呈現逐幀無閃爍的證據，因此不把候選寫入產品。

[全部次數數值](shots/identical/performance/result.json)；同目錄每次 JSON 保存逐 rAF 的尺寸、complete、source 是否改變與可見未完成數。PNG 為完成後畫面。

## 5. 未達成、未宣稱

- 資產解碼像素完全相同，不等於整張瀏覽器合成畫面逐像素必為 0；上表保留真實殘差。
- 去背圖維持原始比例與 600×840 bounding box；未宣稱每個圖層的實際尺寸都是 600×840。
- 不宣稱 hover-only decode 已能省效能；未採用任何延後解碼產品改動。rAF/DOM 逐幀資料能檢查來源與內在尺寸，不能證明每個實體顯示器／GPU 呈現幀完全無閃爍。
- 不宣稱全卡池逐卡瀏覽器像素驗證：渲染像素只驗三代表卡型；資產 bytes／解碼像素則覆蓋七入口全部內嵌卡圖。
- demo、末世地圖卡冊設計、禮物卡、新卡及舊範圍外回歸項目未納入本輪。
