# Round 35 — 魔花少女 gift card

The gift is now `mohuashaonv`, displayed as **魔花少女 · 特殊**, with one deliverable: [`gift-mohuashaonv.html`](../../_art/holo-test/gift-mohuashaonv.html). The old HTML and all `layer-manhuahua-*` assets were removed. No commit or push was performed.

Section 0 was completed before implementation: HANDOFF six-four/six-five, the required LESSONS sections (including the font floor rule), the builder's source notes, and the actual Desktop round33 reference. The reference was opened with `?ceremony-test`, a `rocketdog` fixture passed through `pull(1)` / `skipAll()`, and `state().collectable` awaited. `cards-remade.html` was also opened and measured. Reference files were read only.

## A. Rename

The builder's name, card ID, asset keys, output names, title and heading were renamed together. The checker verifies the **rendered** name, title, heading and ID. Cleanup runs only after the replacement page is written and only targets this gift's old filenames.

At 380px card width, `--name-fs` remains **31.45px**, `dataset.nameFits` is **true**, and the rendered glyph-to-gem gap is **54.3953px**. No font baseline, shrink floor, shared geometry or `card_face.js` code was changed.

## B. Measure first, then fix the reflection fade

The original image pair **already faded in both directions**. The foil-mask pair also faded. The actual defect was the sibling reflection pair: `.special-tint { opacity:.72 !important }` overrode every inline opacity written by `show()`. Both reflections remained at 0.72 even at the idle endpoint.

The fix removes that single conflicting opacity declaration. It retains the multiply reflection layer, its gradient, and the intended 0.72 strength supplied by `show()`. Both groups now interpolate through their existing **320ms ease** transition. No artwork was cleaned, cut out, recolored or cropped differently.

Disposition of the brief's hypotheses:

1. `altImg.removeAttribute('src')` happens on entry, not return; the measured return image curve is continuous. No return-time source reset was found or added.
2. The ordinary foil masks follow the 0.4 gain correctly. The overriding declaration was on **special-tint**, not `--subject-gain`.
3. The existing timer returns to idle, then unlocks after FADE. The measured isolated-trigger return did not hard-cut; no timer change was justified by this evidence. Rapid-click stress beyond this trigger cycle was not separately claimed as tested.

The checker calls the real `giftCard.trigger()`, logs all six computed opacities on a **60ms interval with actual timestamps**, and also records them on every animation frame. Browser scheduling makes observed intervals imperfect; no synthetic clock or invented ideal curve is used. Image values have peak 1, mask values peak 0.4, and reflection values peak 0.72. The assertions normalize each pair by its peak, require at least three intermediate samples in **each direction and each pair**, reject any recorded frame with both normalized values near 0 or both near 1, enforce complementary sums within 0.025, and verify the final idle endpoint.

The tables below show endpoints and intermediate samples; stationary plateaus are omitted. Full 60ms and per-frame records are in [before](shots/round35/before-fade-dev-curve.json), [after dev](shots/round35/after-dev-curve.json), and [after moved copy](shots/round35/after-moved-copy-curve.json). Times are milliseconds since trigger; columns are **idle image / mask / reflection**, then **action image / mask / reflection**.

### Before fix - entry

| ms | Idle image | Idle mask | Idle reflection | Action image | Action mask | Action reflection |
|---|---|---|---|---|---|---|
| 495 | 1.0000 | 0.4000 | 0.7200 | 0.0000 | 0.0000 | 0.7200 |
| 557 | 0.5687 | 0.2275 | 0.7200 | 0.4313 | 0.1725 | 0.7200 |
| 604 | 0.1778 | 0.0711 | 0.7200 | 0.8222 | 0.3289 | 0.7200 |
| 663 | 0.0296 | 0.0119 | 0.7200 | 0.9704 | 0.3881 | 0.7200 |
| 3250 | 0.0000 | 0.0000 | 0.7200 | 1.0000 | 0.4000 | 0.7200 |

### Before fix - return

| ms | Idle image | Idle mask | Idle reflection | Action image | Action mask | Action reflection |
|---|---|---|---|---|---|---|
| 3486 | 0.0000 | 0.0000 | 0.7200 | 1.0000 | 0.4000 | 0.7200 |
| 3550 | 0.1984 | 0.0793 | 0.7200 | 0.8016 | 0.3207 | 0.7200 |
| 3612 | 0.6290 | 0.2516 | 0.7200 | 0.3710 | 0.1484 | 0.7200 |
| 3674 | 0.8657 | 0.3463 | 0.7200 | 0.1343 | 0.0537 | 0.7200 |
| 3737 | 0.9528 | 0.3811 | 0.7200 | 0.0472 | 0.0189 | 0.7200 |
| 3777 | 0.9978 | 0.3991 | 0.7200 | 0.0022 | 0.0009 | 0.7200 |

### After fix (dev) - entry

| ms | Idle image | Idle mask | Idle reflection | Action image | Action mask | Action reflection |
|---|---|---|---|---|---|---|
| 136 | 1.0000 | 0.4000 | 0.7200 | 0.0000 | 0.0000 | 0.0000 |
| 195 | 0.6861 | 0.2744 | 0.4940 | 0.3139 | 0.1256 | 0.2260 |
| 245 | 0.2945 | 0.1178 | 0.2120 | 0.7055 | 0.2822 | 0.5080 |
| 309 | 0.2945 | 0.1178 | 0.2120 | 0.7055 | 0.2822 | 0.5080 |
| 372 | 0.0986 | 0.0394 | 0.0710 | 0.9014 | 0.3606 | 0.6490 |
| 434 | 0.0165 | 0.0066 | 0.0119 | 0.9835 | 0.3934 | 0.7081 |
| 3248 | 0.0000 | 0.0000 | 0.0000 | 1.0000 | 0.4000 | 0.7200 |

### After fix (dev) - return

| ms | Idle image | Idle mask | Idle reflection | Action image | Action mask | Action reflection |
|---|---|---|---|---|---|---|
| 3544 | 0.0000 | 0.0000 | 0.0000 | 1.0000 | 0.4000 | 0.7200 |
| 3607 | 0.4312 | 0.1725 | 0.3105 | 0.5688 | 0.2275 | 0.4095 |
| 3670 | 0.7696 | 0.3078 | 0.5541 | 0.2304 | 0.0922 | 0.1659 |
| 3732 | 0.7696 | 0.3078 | 0.5541 | 0.2304 | 0.0922 | 0.1659 |
| 3793 | 0.9528 | 0.3811 | 0.6860 | 0.0472 | 0.0189 | 0.0340 |
| 4315 | 1.0000 | 0.4000 | 0.7200 | 0.0000 | 0.0000 | 0.0000 |


| Entry | Entry intermediate counts (image/mask/reflection) | Return intermediate counts | Recorded frames | Maximum normalized sum error | Blank / double frames |
|---|---|---|---|---|---|
| dev | [4, 4, 4] | [3, 3, 3] | 66 | 0.000001 | 0 / 0 |
| moved-copy | [3, 3, 3] | [4, 4, 4] | 72 | 0.000001 | 0 / 0 |

The check was red before the opacity fix. The initial direct run rejected the reflection pair; the renamed pre-fix run additionally exposed an entry sampling count of two. Replaying its **recorded native pre-fix curve** through the final return-first assertion fails specifically with `('crossfade intermediate samples', 'idle', 2, 0)`, exit **1**. This is the unfixed reflection return, not an artificial CSS mutation. See [return regression log](shots/round35/return-regression-red.log). The corrected live dev and copied-file runs pass the same assertion.

## C. Centering and every preserved baseline

**置中偏差 0.0081 px。** This is measured after renaming using both the existing element-centering assertion and a `Range` around the actual glyphs. The `<2px` thresholds remain unchanged.

| Item | Before | After (dev and moved copy) | Result |
|---|---|---|---|
| Card type / scene canvases | depth + scene; 600x840 | depth + scene; all 3 images 600x840 | unchanged |
| Plate left (%) | 4.3997 | 4.3997 | unchanged |
| Plate right (%) | 4.3998 | 4.3998 | unchanged |
| Plate bottom (%) | 3.3981 | 3.3981 | unchanged |
| Plate height (%) | 16.1977 | 16.1977 | unchanged |
| Name center (px) | 0.0081 | 0.0081 | subpixel rounding |
| Rarity center (px) | 0.0081 | 0.0081 | unchanged |
| Name font (px) | 31.4500 | 31.4500 | unchanged |
| Rarity font (px) | 17.6900 | 17.6900 | unchanged |
| Gem font (px) | 28.8300 | 28.8300 | unchanged |
| Projected overflow (px) | -7.7211 | -7.7211 | unchanged |
| Gem contrast | 145.6700 | 145.6700 | unchanged |
| Name contrast ratio | 6.4400 | 5.9400 | decreased, still >4.5 |
| Name fits | true | true | unchanged |
| Glyph-to-gem minimum gap (px) | 71.6823 | 54.3953 | decreased; positive |
| Subject placement (px) | x6 y190 w588 h520 | x6 y190 w588 h520 | unchanged |
| Crop each side / plate overlap (px) | 0 / 35 | 0 / 35 | unchanged |

The name contrast fell **6.44:1 → 5.94:1**, and the name-to-gem gap decreased because the name gained a character. Both still pass their requirements. The name metric is the existing screenshot luminance-percentile estimator, not a newly substituted contrast method. The subpixel centering change is numerical rounding. Other baseline items are unchanged.

The five active renamed background/animation/mask files are byte-identical to their originals; hashes are recorded in [asset-identity.json](shots/round35/asset-identity.json). Its two additional `identical:false` rows are obsolete historical `subject.webp` / `mask.webp` files with **no replacement**, not altered active artwork. They were removed with the old prefix. The manifest still reports x6/y190/w588/h520, zero side crop and 35px plate overlap.

## D. Actual comparison with both rocketdog references

Measurements use untransformed **computed layout sizes**, retaining fractional CSS pixels; no perspective rect is used for layout percentages. Rects/Range are used only where the question is about visible projection, glyph centering or glyph-to-gem spacing. Minor percentage differences reflect layout rounding at different card sizes. The checker compares the geometry, font ratios, six depth values and six z-index values against both live references.

| Item | Gift - special | Desktop round33 rocketdog | cards-remade rocketdog | Classification |
|---|---|---|---|---|
| Layout card W x H (px) | 380 x 532 | 375 x 525 | 261.594 x 366.219 | measurement context |
| .art-media top (%) | 1.6976 | 1.6994 | 1.6981 | same construction; rounding |
| .art-media right (%) | 2.3972 | 2.4000 | 2.3952 | same construction; rounding |
| .art-media bottom (%) | 3.2983 | 3.2976 | 3.2981 | same construction; rounding |
| .art-media left (%) | 2.3972 | 2.4000 | 2.3952 | same construction; rounding |
| .face-plate left (%) | 4.3997 | 4.4000 | 4.3961 | same construction; rounding |
| .face-plate right (%) | 4.3997 | 4.4000 | 4.3961 | same construction; rounding |
| .face-plate bottom (%) | 3.3981 | 3.3988 | 3.3962 | same construction; rounding |
| .face-plate height (%) | 16.1977 | 16.1994 | 16.1959 | same construction; rounding |
| .face-text left (%) | 4.3997 | 4.4000 | 4.3961 | same construction; rounding |
| .face-text right (%) | 4.3997 | 4.4000 | 4.3961 | same construction; rounding |
| .face-text bottom (%) | 3.3981 | 3.3988 | 3.3962 | same construction; rounding |
| .face-text height (%) | 16.1977 | 16.1994 | 16.1959 | same construction; rounding |
| .face-gem left (%) | 9.6998 | 9.7000 | 9.7001 | same construction; rounding |
| .face-gem right (%) | 82.7137 | 82.7168 | 82.7141 | same construction; rounding |
| .face-gem top (%) | 85.2914 | 85.2947 | 85.2930 | same construction; rounding |
| .face-gem bottom (%) | 9.2898 | 9.2887 | 9.2883 | same construction; rounding |
| .face-gem width (%) | 7.5863 | 7.5833 | 7.5857 | same construction; rounding |
| .face-gem height (%) | 5.4188 | 5.4167 | 5.4186 | same construction; rounding |
| .face-depth-bg translateZ (px) | 2 | 2 | 2 | identical |
| .face-depth-bg z-index | 10 | 10 | 10 | identical |
| .face-art translateZ (px) | 36.4 | 36.4 | 36.4 | identical |
| .face-art z-index | 30 | 30 | 30 | identical |
| .face-frame translateZ (px) | 24 | 24 | 24 | identical |
| .face-frame z-index | 10 | 10 | 10 | identical |
| .face-plate translateZ (px) | 13 | 13 | 13 | identical |
| .face-plate z-index | 20 | 20 | 20 | identical |
| .face-text translateZ (px) | 40 | 40 | 40 | identical |
| .face-text z-index | 200 | 200 | 200 | identical |
| .face-gem translateZ (px) | 42 | 42 | 42 | identical |
| .face-gem z-index | 210 | 210 | 210 | identical |
| --name-fs / card width (%) | 8.2763 | 8.2747 | 8.2762 | same baseline; rounding |
| --rarity-fs / card width (%) | 4.6553 | 4.6560 | 4.6561 | same baseline; rounding |
| --gem-fs / card width (%) | 7.5868 | 7.5867 | 7.5881 | same baseline; rounding |
| --foil-gain | 1.0 | 1.08 | 1.08 | deliberate special material |
| --grain-gain | 1.3 | 1.5 | 1.5 | deliberate special material |
| --subject-gain | .4 | .42 | .42 | deliberate special material |
| --palette | repeating-linear-gradient(124deg,#ffd4e6 0%,#ff9ecb 12%,#eab6f0 24%,    #b9cdff 38%,#9ce6ff 50%,#ffc9e4 64%,#ffd4e6 76%) | repeating-linear-gradient(124deg,#efc080 0%,#b6e5bd 12%,#8acada 24%,#b0a1e4 36%,#e1a2d5 48%,#efc080 60%) | repeating-linear-gradient(124deg,#efc080 0%,#b6e5bd 12%,#8acada 24%,#b0a1e4 36%,#e1a2d5 48%,#efc080 60%) | deliberate special material |
| Subject foil mask attached / size | True / 100% 100% | True / 100% 100% | True / 100% 100% | identical |
| Silhouette alpha IoU (minimum) | idle 0.999589; action 0.999591 (90 frames each) | 0.999805 (1 frame) | 1.000000 (1 frame) | matched alpha pixels |
| frame-material actual gradient | conic-gradient(from 120deg, rgb(255, 215, 232), rgb(255, 157, 200), rgb(230, 180, 238), rgb(169, 200, 255), rgb(143, 220, 255), rgb(255, 215, 232)) | conic-gradient(from 120deg, rgb(220, 197, 154), rgb(164, 214, 186), rgb(158, 189, 228), rgb(196, 166, 221), rgb(227, 178, 177), rgb(220, 197, 154)) | conic-gradient(from 120deg, rgb(220, 197, 154), rgb(164, 214, 186), rgb(158, 189, 228), rgb(196, 166, 221), rgb(227, 178, 177), rgb(220, 197, 154)) | deliberate special colors/frame |
| face-frame actual shadows | rgb(255, 194, 221) 0px 0px 0px 3px inset, rgb(58, 28, 43) 0px 0px 0px 6px inset, rgb(255, 168, 210) 0px 0px 0px 7px inset, rgb(43, 20, 32) 0px 0px 0px 10px inset, rgba(255, 194, 221, 0.4) 0px 0px 0px 11px inset | rgba(255, 255, 255, 0.533) 0px 0px 0px 2.8626px inset, rgb(147, 240, 223) 0px 0px 0px 5.72519px inset, rgb(24, 16, 28) 0px 0px 0px 10.0191px inset, rgba(255, 255, 255, 0.333) 0px 0px 0px 12.8817px inset, rgb(147, 240, 223) 0px 0px 20.0382px 0px | rgba(255, 255, 255, 0.533) 0px 0px 0px 1.9969px inset, rgb(147, 240, 223) 0px 0px 0px 3.9938px inset, rgb(24, 16, 28) 0px 0px 0px 6.98915px inset, rgba(255, 255, 255, 0.333) 0px 0px 0px 8.98605px inset, rgb(147, 240, 223) 0px 0px 13.9783px 0px | deliberate special colors/frame |
| Inset stroke count | 5 | 4 | 4 | deliberate special frame |

### Classification

**Completely consistent construction:** scene/depth organization; full-size aligned canvases; art-window proportions; plate/text geometry; gem position/size proportions; the six actual Z values and z-index values; font shares; foil silhouette attachment and `100% 100%` mask size. The silhouette check compares alpha pixels at 214×300: every gift animation frame and each reference image is tested, rather than checking only that a mask URL exists.

The observed scene values are **art Z=36.4px and frame Z=24px in all three pages**, not the generic 6px/8px numbers in the older prose. The brief explicitly makes the actual Desktop reference the comparison target and freezes shared code. There is therefore no gift/reference discrepancy to “fix” by changing those shared depths.

**Deliberate differences, preserved:** special pink/blue palette and frame material; the five pink inset strokes versus mythic's four inset strokes plus outer glow; special font treatment for the rarity line; the translucent berry plate; special foil gains plus the separate pale-art multiply reflection; two animated subject/mask/reflection groups and their crossfade. These are existing local special-rarity choices described by the builder, not new round35 design changes. The gift's name gradient remains pink-to-blue and follows phase; mythic retains its conic rainbow. We did not copy the darker reference's foil gain to the pale art.

**Unintended differences corrected:** the extra reflection layers were both permanently visible before the fix. Their endpoints change from **idle/action = .72/.72** to **.72/0** at rest and **0/.72** during the action, with matching fades. No other unintended gift/reference construction difference was found in the requested measurements.

## Acceptance and delivery

| Command/run | Actual exit code | Log |
|---|---|---|
| Pre-fix checker (first run) | 1 | [before-fade-check.log](shots/round35/before-fade-check.log) |
| Renamed pre-fix checker | 1 | [before-fade-renamed-check.log](shots/round35/before-fade-renamed-check.log) |
| Final return assertion on recorded pre-fix curve | 1 | [return-regression-red.log](shots/round35/return-regression-red.log) |
| First fade-fix build | 0 | [build.log](shots/round35/build.log) |
| First complete fixed check, dev + copy | 0 | [check-first.log](shots/round35/check-first.log) |
| Final builder including old-output cleanup | 0 | [build-final.log](shots/round35/build-final.log) |
| Later fixed check, native rendering stall | 1 | [check-final.log](shots/round35/check-final.log) |
| Unchanged final check rerun, dev + copy | 0 | [check-final-retry.log](shots/round35/check-final-retry.log) |

Final sequence: `python _art/holo-test/build_gift_card.py` exited **0**; with `PYTHONIOENCODING=utf-8`, `python _art/holo-test/check_gift_card.py` last exited **0**, both dev and moved copy. One intervening run exited **1**: the native renderer recorded only two intermediate return frames and an approximately 285ms sampling gap. Its [raw curve](shots/round35/failed-timing-dev-curve.json) and failure log are retained. The unchanged rerun passed; no duration, threshold, or sampling requirement was relaxed. This demonstrates observed passing runs, not a claim that timing is immune to host rendering stalls.

The original baseline check also completed with exit 0 for both entries before edits; its metrics are retained in [before-metrics.json](shots/round35/before-metrics.json). Final checks preserve the existing contrast, centering, projection, image-load, font-size and scrim assertions and add identity, reference comparison, silhouette alignment, native fade and visible pointer-response checks. No gate was removed or relaxed.

| Entry | Screenshot return image pair | Pointer mean RGB pixel delta | Errors | External requests |
|---|---|---|---|---|
| dev | [0.431697, 0.568303] | 31.8497 | [] | [] |
| moved-copy | [0.430797, 0.569203] | 31.7704 | [] | [] |

Screenshots inspected: [idle](shots/round35/gift-dev.png), [action](shots/round35/dev-alt.png), [actual paused return midpoint](shots/round35/dev-return-middle.png), [tilt/reflection](shots/round35/dev-tilt.png). Equivalent moved-copy shots and both reference screenshots are in [round35 evidence](shots/round35/). The midpoint captures partially visible distinct animation poses, as expected for a crossfade; it is not two fully opaque layers. The checker pauses the running opacity transitions only for that screenshot, then resumes them. Pointer evidence freezes subject image frames and measures screenshot differences; its metric includes tilt and material response and is not presented as an isolated foil-strength measurement.

The portable check copies only the HTML into a temporary sibling evidence subdirectory **inside this worktree**, opens it by `file://`, and removes that temporary copy afterward. Both entries have no external HTTP requests and no console/page errors, including after the motion checks. The final output is self-contained.

Scope: only the gift builder/checker, gift output/assets/verification and this round's report/evidence were written. Pre-existing unrelated changes, round34 outputs, `src/`, shared `card_face.js`, and all three named MTK experiment files were left untouched. No commit and no push.
