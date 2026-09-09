# Round 33 command exits

Every row retains the actual process exit code. Later passes do not erase earlier failures.

| Command | Exit | Seconds | Full output |
|---|---:|---:|---|
| `python _art/holo-test/probe_round33_before.py` | 0 | 48.28 | [001-python.log](001-python.log) |
| `python _art/holo-test/prepare_round33_assets.py --back` | 0 | 0.22 | [002-python.log](002-python.log) |
| `python _art/holo-test/edit_round33.py` | 0 | 0.41 | [003-python.log](003-python.log) |
| `python _art/holo-test/build_deluxe_b.py` | 0 | 0.2 | [004-python.log](004-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py` | 0 | 2.49 | [005-python.log](005-python.log) |
| `D:/claude/holo-pack/tools/blender-4.5.13-windows-x64/blender.exe -b -P _art/holo-test/fx/build_foil_pack.py -- D:/claude/clawd-pet-holo/_art/holo-test/fx` | 0 | 13.44 | [006-blender.log](006-blender.log) |
| `python _art/holo-test/check_gacha_layers_round31.py --b --c --de` | 1 | 11.86 | [006-python.log](006-python.log) |
| `python _art/holo-test/prepare_round33_assets.py` | 0 | 5.36 | [1788954637680095800-python.log](1788954637680095800-python.log) |
| `python _art/holo-test/build_deluxe_b.py` | 0 | 0.12 | [1788954650607256800-python.log](1788954650607256800-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py` | 0 | 2.49 | [1788954651358988400-python.log](1788954651358988400-python.log) |
| `python _art/holo-test/check_gacha_layers_round31.py --b --c --de` | 1 | 94.7 | [1788954654431560900-python.log](1788954654431560900-python.log) |
| `D:/claude/holo-pack/tools/blender-4.5.13-windows-x64/blender.exe -b -P _art/holo-test/fx/build_foil_pack.py -- D:/claude/clawd-pet-holo/_art/holo-test/fx` | 0 | 10.24 | [1788954675612427600-blender.log](1788954675612427600-blender.log) |
| `python _art/holo-test/check_gacha_ceremony_round30.py` | 1 | 1325.27 | [1788954695307745200-python.log](1788954695307745200-python.log) |
| `python _art/holo-test/check_demo_round8.py` | 0 | 43.81 | [1788954705995242900-python.log](1788954705995242900-python.log) |
| `python _art/holo-test/prepare_round33_assets.py` | 0 | 6.5 | [1788954724987498700-python.log](1788954724987498700-python.log) |
| `python _art/holo-test/check_demo_round9.py` | 0 | 16.44 | [1788954738557269700-python.log](1788954738557269700-python.log) |
| `D:/claude/holo-pack/tools/blender-4.5.13-windows-x64/blender.exe -b -P _art/holo-test/fx/build_foil_pack.py -- D:/claude/clawd-pet-holo/_art/holo-test/fx` | 0 | 10.59 | [1788954757692173400-blender.log](1788954757692173400-blender.log) |
| `python _art/holo-test/prepare_round33_assets.py` | 0 | 5.72 | [1788954858152301100-python.log](1788954858152301100-python.log) |
| `python _art/holo-test/check_gacha_layers_round33.py --self-test` | 0 | 0.39 | [1788954864715232000-python.log](1788954864715232000-python.log) |
| `python _art/holo-test/build_deluxe_b.py` | 0 | 0.14 | [1788954876037199000-python.log](1788954876037199000-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py` | 0 | 2.61 | [1788954876852373500-python.log](1788954876852373500-python.log) |
| `python _art/holo-test/build_deluxe_b.py --test` | 0 | 0.12 | [1788954880147779900-python.log](1788954880147779900-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py --test` | 0 | 2.59 | [1788954880999164200-python.log](1788954880999164200-python.log) |
| `python _art/holo-test/check_gacha_layers_round33.py --assets --charge --transition --layout --endurance` | 1 | 163.42 | [1788954884314332800-python.log](1788954884314332800-python.log) |
| `python _art/holo-test/prepare_round33_assets.py --back` | 0 | 0.27 | [1788954927524222400-python.log](1788954927524222400-python.log) |
| `python _art/holo-test/prepare_round33_assets.py` | 0 | 6.14 | [1788954928623687800-python.log](1788954928623687800-python.log) |
| `python _art/holo-test/build_deluxe_b.py` | 0 | 0.14 | [1788954951200266400-python.log](1788954951200266400-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py` | 0 | 2.73 | [1788954952186635800-python.log](1788954952186635800-python.log) |
| `python _art/holo-test/build_deluxe_b.py --test` | 0 | 0.12 | [1788954955701308900-python.log](1788954955701308900-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py --test` | 0 | 2.77 | [1788954956657516000-python.log](1788954956657516000-python.log) |
| `python _art/holo-test/check_gacha_layers_round33.py --background --layers` | 1 | 650.55 | [1788954960247589500-python.log](1788954960247589500-python.log) |
| `python _art/holo-test/prepare_round33_assets.py --back` | 0 | 0.28 | [1788954981959974900-python.log](1788954981959974900-python.log) |
| `python _art/holo-test/check_gacha_card_regression.py --flows-only` | 1 | 6.88 | [1788954983265987700-python.log](1788954983265987700-python.log) |
| `python _art/holo-test/check_gacha_card_regression.py --flows-only` | 0 | 103.47 | [1788955009176988700-python.log](1788955009176988700-python.log) |
| `python _art/holo-test/check_new_cards_round32.py` | 1 | 195.78 | [1788955076468255400-python.log](1788955076468255400-python.log) |
| `python -m py_compile _art/holo-test/check_reveal_timing.py _art/holo-test/check_gacha_layers_round33.py _art/holo-test/check_gacha_ceremony_round30.py` | 0 | 0.12 | [1788955140533464300-python.log](1788955140533464300-python.log) |
| `node --check _art/holo-test/ceremony.js` | 0 | 0.09 | [1788955141635323700-node.log](1788955141635323700-node.log) |
| `python _art/holo-test/build_deluxe_b.py` | 0 | 0.17 | [1788955142654454200-python.log](1788955142654454200-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py` | 0 | 2.84 | [1788955143814254700-python.log](1788955143814254700-python.log) |
| `python _art/holo-test/build_deluxe_b.py --test` | 0 | 0.17 | [1788955147553415800-python.log](1788955147553415800-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py --test` | 0 | 2.8 | [1788955148597459800-python.log](1788955148597459800-python.log) |
| `C:\Users\ASUS User VII\AppData\Local\Programs\Python\Python310\python.exe D:\claude\clawd-pet-holo\_art\holo-test\check_gacha_card_regression.py` | 0 | 1237.67 | [1788955169311183600-python.log](1788955169311183600-python.log) |
| `python _art/holo-test/check_gacha_layers_round31.py` | 1 | 141.92 | [1788955180090440700-python.log](1788955180090440700-python.log) |
| `python _art/holo-test/check_gacha_layers_round33.py --assets --charge --background` | 0 | 45.88 | [1788955191070067500-python.log](1788955191070067500-python.log) |
| `python _art/holo-test/check_hover_round33.py` | 0 | 8.55 | [1788955224222561300-python.log](1788955224222561300-python.log) |
| `python _art/holo-test/check_hover_round33.py` | 0 | 7.73 | [1788955245283396500-python.log](1788955245283396500-python.log) |
| `python _art/holo-test/check_gacha_layers_round33.py --layers` | 1 | 678.59 | [1788955267786393000-python.log](1788955267786393000-python.log) |
| `python _art/holo-test/build_deluxe_b.py` | 0 | 0.25 | [1788955312727330800-python.log](1788955312727330800-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py` | 0 | 3.19 | [1788955314022408900-python.log](1788955314022408900-python.log) |
| `python _art/holo-test/build_deluxe_b.py --test` | 0 | 0.24 | [1788955318246269400-python.log](1788955318246269400-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py --test` | 0 | 3.02 | [1788955319527356900-python.log](1788955319527356900-python.log) |
| `python _art/holo-test/build_deluxe_b.py` | 0 | 0.25 | [1788955422728077000-python.log](1788955422728077000-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py` | 0 | 2.94 | [1788955423990805400-python.log](1788955423990805400-python.log) |
| `python _art/holo-test/build_deluxe_b.py --test` | 0 | 0.17 | [1788955427859265700-python.log](1788955427859265700-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py --test` | 0 | 2.86 | [1788955429105676500-python.log](1788955429105676500-python.log) |
| `python _art/holo-test/check_gacha_layers_round31.py --a` | 0 | 587.11 | [1788955444862921900-python.log](1788955444862921900-python.log) |
| `python _art/holo-test/build_deluxe_b.py` | 0 | 0.16 | [1788955542724037600-python.log](1788955542724037600-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py` | 0 | 3.66 | [1788955544064803600-python.log](1788955544064803600-python.log) |
| `python _art/holo-test/build_deluxe_b.py --test` | 0 | 0.22 | [1788955548934530800-python.log](1788955548934530800-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py --test` | 0 | 3.72 | [1788955550420195300-python.log](1788955550420195300-python.log) |
| `python _art/holo-test/check_gacha_layers_round33.py` | 1 | 729.61 | [1788955581985121300-python.log](1788955581985121300-python.log) |
| `python _art/holo-test/probe_occlusion_round33.py` | 1 | 12.98 | [1788955731408530700-python.log](1788955731408530700-python.log) |
| `python _art/holo-test/probe_occlusion_round33.py` | 0 | 26.3 | [1788955783848995900-python.log](1788955783848995900-python.log) |
| `node --check _art/holo-test/ceremony-fx.js` | 0 | 0.09 | [1788955891036041800-node.log](1788955891036041800-node.log) |
| `python _art/holo-test/check_demo_round8.py` | 0 | 58.73 | [1788955951179881800-python.log](1788955951179881800-python.log) |
| `python _art/holo-test/check_demo_round9.py` | 0 | 24.06 | [1788955962244203400-python.log](1788955962244203400-python.log) |
| `python _art/holo-test/check_ui_round33.py` | 0 | 9.34 | [1788956014544690500-python.log](1788956014544690500-python.log) |
| `python _art/holo-test/check_gacha_ceremony_round30.py` | 1 | 30.94 | [1788956155947842400-python.log](1788956155947842400-python.log) |
| `python _art/holo-test/check_gacha_layers_round31.py` | 0 | 695.39 | [1788956166674995500-python.log](1788956166674995500-python.log) |
| `python _art/holo-test/build_deluxe_b.py --test` | 0 | 0.14 | [1788956273813702000-python.log](1788956273813702000-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py --test` | 0 | 2.92 | [1788956274907313200-python.log](1788956274907313200-python.log) |
| `python _art/holo-test/check_background_samples_round33.py` | 0 | 4.78 | [1788956317657248700-python.log](1788956317657248700-python.log) |
| `python _art/holo-test/check_ui_round33.py` | 0 | 9.33 | [1788956375177362800-python.log](1788956375177362800-python.log) |
| `C:\Users\ASUS User VII\AppData\Local\Programs\Python\Python310\python.exe D:\claude\clawd-pet-holo\_art\holo-test\check_gacha_card_regression.py` | 0 | 1199.38 | [1788956407089071700-python.log](1788956407089071700-python.log) |
| `python _art/holo-test/probe_preface_round33.py` | 0 | 12.02 | [1788956581570213700-python.log](1788956581570213700-python.log) |
| `python _art/holo-test/check_gacha_ceremony_round30.py --core --preview-only` | 0 | 46.3 | [1788956661590861400-python.log](1788956661590861400-python.log) |
| `python _art/holo-test/check_gacha_ceremony_round30.py` | 0 | 1274.64 | [1788956716048392900-python.log](1788956716048392900-python.log) |
| `python _art/holo-test/build_deluxe_b.py` | 0 | 0.17 | [1788956995348286700-python.log](1788956995348286700-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py` | 0 | 2.92 | [1788956996462394300-python.log](1788956996462394300-python.log) |
| `python _art/holo-test/build_deluxe_b.py --test` | 0 | 0.19 | [1788957000353118700-python.log](1788957000353118700-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py --test` | 0 | 2.95 | [1788957001532449700-python.log](1788957001532449700-python.log) |
| `python _art/holo-test/check_ui_round33.py` | 0 | 11.42 | [1788957034974969100-python.log](1788957034974969100-python.log) |
| `python _art/holo-test/check_gacha_layers_round33.py --assets --layout --endurance` | 1 | 169.16 | [1788957045828381400-python.log](1788957045828381400-python.log) |
| `git -c safe.directory=D:/claude/clawd-pet-holo diff --check` | 0 | 0.25 | [1788957163523426500-git.log](1788957163523426500-git.log) |
| `python _art/holo-test/check_gacha_layers_round33.py --layers` | 1 | 529.77 | [1788957200680437500-python.log](1788957200680437500-python.log) |
| `C:\Users\ASUS User VII\AppData\Local\Programs\Python\Python310\python.exe D:\claude\clawd-pet-holo\_art\holo-test\check_gacha_card_regression.py` | 0 | 1406.39 | [1788957606640539800-python.log](1788957606640539800-python.log) |
| `python _art/holo-test/check_gacha_layers_round33.py --background` | 0 | 30.27 | [1788957708686235700-python.log](1788957708686235700-python.log) |
| `python _art/holo-test/probe_label_contrast_round33.py` | 0 | 8.95 | [1788957808040613800-python.log](1788957808040613800-python.log) |
| `python _art/holo-test/probe_label_contrast_round33.py` | 0 | 205.67 | [1788957868481008800-python.log](1788957868481008800-python.log) |
| `python _art/holo-test/build_deluxe_b.py` | 0 | 0.22 | [1788957925429690500-python.log](1788957925429690500-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py` | 0 | 3.44 | [1788957926603552300-python.log](1788957926603552300-python.log) |
| `python _art/holo-test/build_deluxe_b.py --test` | 0 | 0.23 | [1788957930900518800-python.log](1788957930900518800-python.log) |
| `python _art/holo-test/build_deluxe_b_standalone.py --test` | 0 | 3.39 | [1788957932347406800-python.log](1788957932347406800-python.log) |
| `python _art/holo-test/check_gacha_layers_round31.py` | 0 | 919.75 | [1788957936632524100-python.log](1788957936632524100-python.log) |
| `python _art/holo-test/check_gacha_layers_round33.py` | 1 | 782.09 | [1788957947422208500-python.log](1788957947422208500-python.log) |
| `python _art/holo-test/check_gacha_ceremony_round30.py` | 0 | 1212.17 | [1788957999385216500-python.log](1788957999385216500-python.log) |
| `python _art/holo-test/probe_label_contrast_round33.py --final` | 0 | 105.33 | [1788958034078787200-python.log](1788958034078787200-python.log) |
| `git -c safe.directory=D:/claude/clawd-pet-holo diff --check` | 0 | 0.2 | [1788959176599479000-git.log](1788959176599479000-git.log) |
| `git -c safe.directory=D:/claude/clawd-pet-holo diff --check` | 0 | 0.2 | [1788959507270665700-git.log](1788959507270665700-git.log) |
