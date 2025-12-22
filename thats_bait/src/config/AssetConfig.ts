import { NetworkManager } from "../managers/NetworkManager";
import { ScreenModeManager } from "../managers/ScreenModeManager";

export interface AssetGroup {
	images?: { [key: string]: string };
	spine?: { [key: string]: { atlas: string; json: string } };
	audio?: { [key: string]: string };
	fonts?: { [key: string]: string };
}

export class AssetConfig {
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	private getAssetPrefix(): string {
		const screenConfig = this.screenModeManager.getScreenConfig();
		const isHighSpeed = this.networkManager.getNetworkSpeed();
		
		const orientation = screenConfig.isPortrait ? 'portrait' : 'landscape';
		const quality = isHighSpeed ? 'high' : 'low';
		
		return `assets/${orientation}/${quality}`;
	}

	getBackgroundAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		
		return {
			images: {
				'BG-Depth': `${prefix}/background/BG-Depth.webp`,
				'BG-Surface': `${prefix}/background/BG-Surface.webp`,
				'BG-Sky': `${prefix}/background/BG-Sky.webp`,
				'BG-Normal-Slots': `${prefix}/background/BG-Normal-Slots.webp`,
				'Sea-Edge': `${prefix}/background/Sea-Edge.webp`,
				'BG-Fog': `${forcedPortraitHighPrefix}/background/BG-Fog.webp`,
				'bubble': `${forcedPortraitHighPrefix}/background/bubble.webp`,
				'winline-bubble-1': `${forcedPortraitHighPrefix}/bubbles/winline-bubble-1.webp`,
				'winline-bubble-2': `${forcedPortraitHighPrefix}/bubbles/winline-bubble-2.webp`,
				'hook': `${forcedPortraitHighPrefix}/characters/hook.webp`,
			},
			spine: {
				'ReelBottom_Normal_TB': {
					atlas: `${forcedPortraitHighPrefix}/background/ReelBottom_Normal_TB.atlas`,
					json: `${forcedPortraitHighPrefix}/background/ReelBottom_Normal_TB.json`
				},
				'Character_TB': {
					atlas: `${forcedPortraitHighPrefix}/characters/Character_TB.atlas`,
					json: `${forcedPortraitHighPrefix}/characters/Character_TB.json`
				}
			}
		};
	}

	getBonusBackgroundAssets(): AssetGroup {
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		
		return {
			images: {
				'BG-Bonus-Depth': `${forcedPortraitHighPrefix}/bonus_background/BG-Bonus-Depth.webp`,
				'BG-Bonus-Sky': `${forcedPortraitHighPrefix}/bonus_background/BG-Bonus-Sky.webp`,
				'BG-Bonus-Surface': `${forcedPortraitHighPrefix}/bonus_background/BG-Bonus-Surface.webp`,
				'Sea-Edge-Bonus': `${forcedPortraitHighPrefix}/bonus_background/Sea-Edge-Bonus.webp`,
				'level1-meter': `${forcedPortraitHighPrefix}/gauge-meter/level1-meter.webp`,
				'level2-meter': `${forcedPortraitHighPrefix}/gauge-meter/level2-meter.webp`,
				'level3-meter': `${forcedPortraitHighPrefix}/gauge-meter/level3-meter.webp`,
				'meter-indicator': `${forcedPortraitHighPrefix}/gauge-meter/meter-indicator.webp`,
				'stage1_1': `${forcedPortraitHighPrefix}/gauge-meter/stage1_1.webp`,
				'stage1_2': `${forcedPortraitHighPrefix}/gauge-meter/stage1_2.webp`,
				'stage1_3': `${forcedPortraitHighPrefix}/gauge-meter/stage1_3.webp`,
				'stage1_4': `${forcedPortraitHighPrefix}/gauge-meter/stage1_4.webp`,
				'stage2_1': `${forcedPortraitHighPrefix}/gauge-meter/stage2_1.webp`,
				'stage2_2': `${forcedPortraitHighPrefix}/gauge-meter/stage2_2.webp`,
				'stage2_3': `${forcedPortraitHighPrefix}/gauge-meter/stage2_3.webp`,
				'stage2_4': `${forcedPortraitHighPrefix}/gauge-meter/stage2_4.webp`,
				'stage3_1': `${forcedPortraitHighPrefix}/gauge-meter/stage3_1.webp`,
				'stage3_2': `${forcedPortraitHighPrefix}/gauge-meter/stage3_2.webp`,
				'stage3_3': `${forcedPortraitHighPrefix}/gauge-meter/stage3_3.webp`,
				'stage3_4': `${forcedPortraitHighPrefix}/gauge-meter/stage3_4.webp`,
				'win-10-free-spins': `${forcedPortraitHighPrefix}/gauge-meter/win-10-free-spins.webp`,
				'2x_multiplier': `${forcedPortraitHighPrefix}/gauge-meter/2x_multiplier.webp`,
				'3x_Multiplier_TB': `${forcedPortraitHighPrefix}/gauge-meter/3x_Multiplier_TB.webp`,
				'10x_Multiplier_TB': `${forcedPortraitHighPrefix}/gauge-meter/10x_Multiplier_TB.webp`
			},
			// Bonus dragon & fireworks spine assets were removed for this game
			spine: {
				'ReelBottom_Bonus_TB': {
					atlas: `${forcedPortraitHighPrefix}/bonus_background/ReelBottom_Bonus_TB.atlas`,
					json: `${forcedPortraitHighPrefix}/bonus_background/ReelBottom_Bonus_TB.json`
				},
				'stage1_5': {
					atlas: `${forcedPortraitHighPrefix}/gauge-meter/stage1_5.atlas`,
					json: `${forcedPortraitHighPrefix}/gauge-meter/stage1_5.json`
				},
				'stage2_5': {
					atlas: `${forcedPortraitHighPrefix}/gauge-meter/stage2_5.atlas`,
					json: `${forcedPortraitHighPrefix}/gauge-meter/stage2_5.json`
				},
				'stage3_5': {
					atlas: `${forcedPortraitHighPrefix}/gauge-meter/stage3_5.atlas`,
					json: `${forcedPortraitHighPrefix}/gauge-meter/stage3_5.json`
				}
			}
		};
	}


	getBonusHeaderAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {},
			spine: {}
		};
	}

	getLoadingAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				// Note: BG-Default.png was removed; only BG-loading.png remains
				'loading_background': `${prefix}/loading/BG-loading.webp`,
				'button_bg': `${prefix}/loading/button_bg.webp`,
				'button_spin': `${prefix}/loading/button_spin.webp`,
				'thats-bait-logo': `${prefix}/loading/thats-bait-logo.webp`,
				'loading_frame': `${prefix}/loading/loading-frame.webp`,
				'loading_frame_2': `${prefix}/loading/loading-frame-2.webp`,
				'dijoker_logo': `${prefix}/loading/DiJoker-logo.webp`
			},
			spine: {
				// Studio loading spine (DI JOKER) – only available in portrait/high
				'di_joker': {
					atlas: `${prefix}/dijoker_loading/DI JOKER.atlas`,
					json: `${prefix}/dijoker_loading/DI JOKER.json`
				}
			}
		};
	}

	// Add more asset groups as needed
	getSymbolAssets(): AssetGroup {
		const prefix = this.getAssetPrefix(); // This gives us assets/{orientation}/{quality}
		console.log(`[AssetConfig] Loading symbol assets (Spine + WEBP symbols) from assets/portrait/high`);
		
		// Generate Spine + WEBP symbol assets for all symbols (0-14)
		const symbolImages: { [key: string]: string } = {};
		const symbolSpine: { [key: string]: { atlas: string; json: string } } = {};
		
		// Symbols that have TB Spine atlases/json in public/assets/portrait/high/spine_symbols
		// Extend this list only for symbols we know have atlas/json on disk to avoid 404s.
		const tbSpineSymbols = new Set<number>([0, 1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14]);
		
		// Symbols that have dedicated WEBP art in public/assets/portrait/high/symbols
		const webpSymbolsFolder = new Set<number>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
		
		// Higher indices fall back to WEBP exported alongside Spine in spine_symbols (none today)
		const webpSpineFolderFallback = new Set<number>([]);
		
		// Force TB symbols to portrait/high paths for now
		const spinePrefix = `assets/portrait/high`;
		
		// Register symbols 0-17 using a single, consistent naming scheme:
		//  - Spine key:   symbol_{i}_spine
		//  - Image key:   symbol_{i}
		//  - File names:  spine_symbols/Symbol{i}_TB.(atlas|json), symbols/Symbol{i}_TB.webp
		for (let i = 0; i <= 17; i++) {
			const symbolNameTB = `Symbol${i}_TB`;
			const spineKey = `symbol_${i}_spine`;
			
			if (tbSpineSymbols.has(i)) {
				const atlasPath = `${spinePrefix}/spine_symbols/${symbolNameTB}.atlas`;
				const jsonPath = `${spinePrefix}/spine_symbols/${symbolNameTB}.json`;
				
				symbolSpine[spineKey] = {
					atlas: atlasPath,
					json: jsonPath
				};
				
				console.log(`[AssetConfig] Symbol ${i}: spine=${atlasPath}`);
			} else {
				console.log(`[AssetConfig] Symbol ${i}: spine=<none> (no TB Spine asset)`);
			}
			
			// Register WEBP image used for lightweight spin rendering
			let imagePath: string | undefined;
			if (webpSymbolsFolder.has(i)) {
				imagePath = `${spinePrefix}/symbols/${symbolNameTB}.webp`;
			} else if (webpSpineFolderFallback.has(i)) {
				imagePath = `${spinePrefix}/spine_symbols/${symbolNameTB}.webp`;
			}
			
			if (imagePath) {
				const imageKey = `symbol_${i}`;
				symbolImages[imageKey] = imagePath;
				console.log(`[AssetConfig] Symbol ${i}: image=${imagePath}`);
			}
		}

		return {
			images: symbolImages,
			spine: symbolSpine
		};
	}

	getButtonAssets(): AssetGroup {
		// Controller buttons now follow portrait/landscape structure
		const screenConfig = this.screenModeManager.getScreenConfig();
		const isHighSpeed = this.networkManager.getNetworkSpeed();
		const quality = isHighSpeed ? 'high' : 'low';
		const screenMode = screenConfig.isPortrait ? 'portrait' : 'landscape';
		// Some controller spine packs are only present in portrait/high today – force those paths to avoid 404s
		const forcedPortraitHigh = 'portrait/high';
		
		console.log(`[AssetConfig] Loading controller buttons with quality: ${quality}, screen mode: ${screenMode}`);
		
		return {
			images: {
				'autoplay_off': `assets/controller/${screenMode}/${quality}/autoplay_off.png`,
				'autoplay_on': `assets/controller/${screenMode}/${quality}/autoplay_on.png`,
				'decrease_bet': `assets/controller/${screenMode}/${quality}/decrease_bet.png`,
				'increase_bet': `assets/controller/${screenMode}/${quality}/increase_bet.png`,
				'menu': `assets/controller/${screenMode}/${quality}/menu.png`,
				'spin': `assets/controller/${screenMode}/${quality}/spin_bg.png`,
				'spin_icon': `assets/controller/${screenMode}/${quality}/spin_icon.png`,
				'autoplay_stop_icon': `assets/controller/${screenMode}/${quality}/autoplay_stop_icon.png`,
				'turbo_off': `assets/controller/${screenMode}/${quality}/turbo_off.png`,
				'turbo_on': `assets/controller/${screenMode}/${quality}/turbo_on.png`,
				'amplify': `assets/controller/${screenMode}/${quality}/amplify.png`,
				'feature': `assets/controller/${screenMode}/${quality}/feature.webp`,
				'long_button': `assets/controller/${screenMode}/${quality}/long_button.png`,
				'maximize': `assets/controller/${screenMode}/${quality}/maximize.png`,
				'minimize': `assets/controller/${screenMode}/${quality}/minimize.png`,
			},
			spine: {
				'spin_button_animation': {
					atlas: `assets/controller/${forcedPortraitHigh}/spin_button_anim/spin_button_anim.atlas`,
					json: `assets/controller/${forcedPortraitHigh}/spin_button_anim/spin_button_anim.json`
				},
				'button_animation_idle': {
					atlas: `assets/controller/${forcedPortraitHigh}/button_animation_idle/button_animation_idle.atlas`,
					json: `assets/controller/${forcedPortraitHigh}/button_animation_idle/button_animation_idle.json`
				},
				'amplify_bet': {
					atlas: `assets/${screenMode}/${quality}/amplify_bet/Amplify Bet.atlas`,
					json: `assets/${screenMode}/${quality}/amplify_bet/Amplify Bet.json`
				},
				// Enhance Bet idle loop (available only in portrait/high for now)
				'enhance_bet_idle_on': {
					atlas: `assets/controller/portrait/high/enhanceBet_idle_on/Amplify Bet.atlas`,
					json: `assets/controller/portrait/high/enhanceBet_idle_on/Amplify Bet.json`
				},
				'turbo_animation': {
					atlas: `assets/controller/${forcedPortraitHigh}/turbo_animation/Turbo_Spin.atlas`,
					json: `assets/controller/${forcedPortraitHigh}/turbo_animation/Turbo_Spin.json`
				}
			}
		};
	}

	getFontAssets(): AssetGroup {
		console.log(`[AssetConfig] Loading font assets`);
		
		return {
			fonts: {
				'Poppins-Thin': 'assets/fonts/poppins/Poppins-Thin.ttf',
				'Poppins-Bold': 'assets/fonts/poppins/Poppins-Bold.ttf',
				'Poppins-Regular': 'assets/fonts/poppins/Poppins-Regular.ttf',
			}
		};
	}

	getMenuAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		return {
			images: {
				// Menu tab icons
				'menu_info': `${prefix}/menu/Info.png`,
				'menu_history': `${prefix}/menu/History.png`,
				'menu_settings': `${prefix}/menu/Settings.png`,
				// Pagination and loading
				'icon_left': `${prefix}/menu/icon_left.png`,
				'icon_most_left': `${prefix}/menu/icon_most_left.png`,
				'icon_right': `${prefix}/menu/icon_right.png`,
				'icon_most_right': `${prefix}/menu/icon_most_right.png`,
				'loading_icon': `${prefix}/menu/loading.png`,
				// Close icon (portrait/high specific path)
				'menu_close': `assets/controller/portrait/high/close.png`
			}
		};
	}

	getHelpScreenAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		// Build images map
		const images: { [key: string]: string } = {
			// HowToPlay images
			'howToPlay1': `${prefix}/help_screen/HowToPlay1.png`,
			'howToPlay1Mobile': `${prefix}/help_screen/HowToPlay1Mobile.png`,
			'howToPlay2': `${prefix}/help_screen/HowToPlay2.png`,
			'howToPlay2Mobile': `${prefix}/help_screen/HowToPlay2Mobile.png`,
			'howToPlay3': `${prefix}/help_screen/HowToPlay3.png`,
			'howToPlay3Mobile': `${prefix}/help_screen/HowToPlay3Mobile.png`,
			'howToPlay4': `${prefix}/help_screen/HowToPlay4.png`,
			'howToPlay4Mobile': `${prefix}/help_screen/HowToPlay4Mobile.png`,
			'howToPlay5': `${prefix}/help_screen/HowToPlay5.png`,
			'howToPlay6': `${prefix}/help_screen/HowToPlay6.png`,
			'howToPlay7': `${prefix}/help_screen/HowToPlay7.png`,
			'howToPlay8': `${prefix}/help_screen/HowToPlay8.png`,
			'howToPlay8Mobile': `${prefix}/help_screen/HowToPlay8Mobile.png`,
			'howToPlay9': `${prefix}/help_screen/HowToPlay9.png`,
			'howToPlay9Mobile': `${prefix}/help_screen/HowToPlay9Mobile.png`,
			'howToPlay10': `${prefix}/help_screen/HowToPlay10.png`,
			'howToPlay10Mobile': `${prefix}/help_screen/HowToPlay10Mobile.png`,
			// Feature help
			'BuyFeatHelp': `${prefix}/help_screen/BuyFeatHelp.png`,
			'BuyFeatMobile': `${prefix}/help_screen/BuyFeatMobile.png`,
			'DoubleHelp': `${prefix}/help_screen/DoubleHelp.png`,
			'DoubleHelpMobile': `${prefix}/help_screen/DoubleHelpMobile.png`,
			// Payline visuals
			'paylineMobileWin': `${prefix}/help_screen/paylineMobileWin.png`,
			'paylineMobileNoWin': `${prefix}/help_screen/paylineMobileNoWin.png`,
            // Scatter / Tumble / Multiplier visuals (icons removed to avoid loading unused assets)
            'scatterGame': `${prefix}/help_screen/scatterGame.png`,
            'scatterWin': `${prefix}/help_screen/scatterWin.png`,
            'ScatterLabel': `${prefix}/help_screen/ScatterSymbol.png`,
            'wheelSpin_helper': `${prefix}/help_screen/wheelSpin_helper.png`,
            'freeSpin_round': `${prefix}/help_screen/freeSpin_round.png`,
            'tumbleWin': `${prefix}/help_screen/tumbleWin.png`,
            'multiplierGame': `${prefix}/help_screen/multiplierGame.png`
		};

		// Map winlines1..20 -> public/assets/winlines/winline1..20.png
		for (let i = 1; i <= 20; i++) {
			images[`winlines${i}`] = `assets/winlines/winline${i}.png`;
		}

		return { images };
	}

	getDialogAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		const forcedPortraitLowPrefix = `assets/portrait/low`;
		
		console.log(`[AssetConfig] Loading dialog assets with prefix: ${prefix}`);
		
		return {
			images: {
				'congrats-bg': `${forcedPortraitLowPrefix}/dialogs/congrats-bg.png`,
				'congratulations-you-won': `${forcedPortraitLowPrefix}/dialogs/congratulations-you-won.png`
			},
			spine: {
				'BigW_TB': {
					atlas: `${forcedPortraitHighPrefix}/dialogs/BigW_TB.atlas`,
					json: `${forcedPortraitHighPrefix}/dialogs/BigW_TB.json`
				},
				'EpicW_TB': {
					atlas: `${forcedPortraitHighPrefix}/dialogs/EpicW_TB.atlas`,
					json: `${forcedPortraitHighPrefix}/dialogs/EpicW_TB.json`
				},
				'MegaW_TB': {
					atlas: `${forcedPortraitHighPrefix}/dialogs/MegaW_TB.atlas`,
					json: `${forcedPortraitHighPrefix}/dialogs/MegaW_TB.json`
				},
				'SuperW_TB': {
					atlas: `${forcedPortraitHighPrefix}/dialogs/SuperW_TB.atlas`,
					json: `${forcedPortraitHighPrefix}/dialogs/SuperW_TB.json`
				},
				'TotalW_TB': {
					atlas: `${forcedPortraitHighPrefix}/dialogs/TotalW_TB.atlas`,
					json: `${forcedPortraitHighPrefix}/dialogs/TotalW_TB.json`
				},
				'FreeSpin_TB': {
					atlas: `${forcedPortraitHighPrefix}/dialogs/FreeSpin_TB.atlas`,
					json: `${forcedPortraitHighPrefix}/dialogs/FreeSpin_TB.json`
				},
				'FreeSpinRetri_TB': {
					atlas: `${forcedPortraitHighPrefix}/dialogs/FreeSpinRetri_TB.atlas`,
					json: `${forcedPortraitHighPrefix}/dialogs/FreeSpinRetri_TB.json`
				}
			}
		};
	}

	getFreeSpinCardAssets(): AssetGroup {
		console.log('[AssetConfig] Loading free spin card (spine) assets');
		return {
			images: {
				'free_spin_card': `assets/coin.png`,
				'free_spin_card_front': `assets/coin.png`,
				'free_spin_text': `assets/coin.png`
			}
		};
	}

	getScatterAnticipationAssets(): AssetGroup {
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		console.log('[AssetConfig] Loading Scatter Anticipation assets (forced portrait/high)');
		return {
			images: {},
			spine: {}
		};
	}

	getNumberAssets(): AssetGroup {
		const prefix = `assets/portrait/high`;
		
		console.log(`[AssetConfig] Loading number assets with prefix: ${prefix}`);
		
		const numberImages: { [key: string]: string } = {};
		
		for (let i = 0; i <= 9; i++) {
			const key = `number_${i}`;
			const path = `${prefix}/numbers/number_${i}.webp`;
			numberImages[key] = path;
			console.log(`[AssetConfig] Number ${key}: ${path}`);
		}
		
		numberImages['number_comma'] = `${prefix}/numbers/number_comma.webp`;
		numberImages['number_dot'] = `${prefix}/numbers/number_dot.webp`;
		
		console.log(`[AssetConfig] Number comma: ${prefix}/numbers/number_comma.webp`);
		console.log(`[AssetConfig] Number dot: ${prefix}/numbers/number_dot.webp`);
		
		numberImages['number_x'] = `${prefix}/numbers/number_x.webp`;
		console.log(`[AssetConfig] Number x: ${prefix}/numbers/number_x.webp`);
		
		return {
			images: numberImages
		};
	}

	getCoinAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading coin assets with prefix: ${prefix}`);
		
		return {
			images: {
				'coin': `${prefix}/coin/coin.png`
			}
		};
	}

	getBuyFeatureAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		const portraitHighPrefix = `assets/portrait/high`;
		
		console.log(`[AssetConfig] Loading buy feature assets with prefix: ${prefix} (logos forced to ${portraitHighPrefix})`);
		
		return {
			images: {
				'scatter_logo_background': `${portraitHighPrefix}/buy_feature/scatter_logo_background.png`,
				'buy_feature_bg': `${prefix}/buy_feature/buy_feature_bg.png`
			}
		};
	}

	getScatterWinOverlayAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		console.log(`[AssetConfig] Loading scatter win overlay assets`);
		
		return {
			images: {
				'PickACard': `assets/portrait/low/scatter_win/PickACard.png`,
				'congrats': `assets/portrait/low/scatter_win/congrats.png`,
				'fireanimation01_HTBH_img': `assets/portrait/low/scatter_win/Winfontfire.png`
			}
		};
	}

	getFreeSpinOverlayAssets(): AssetGroup {
		console.log('[AssetConfig] Loading free spin overlay assets');
		return {
			spine: {}
		};
	}

	getAudioAssets(): AssetGroup {
		console.log(`[AssetConfig] Loading audio assets`);
		
		return {
			audio: {
				// Menu/UI clicks
				'click_sw': 'assets/sounds/click_sw.ogg',
				'button_fx': 'assets/sounds/SFX/button_fx.ogg',
				'mainbg_hh': 'assets/sounds/BG/mainbg_hh.ogg',
				'bonusbg_hh': 'assets/sounds/BG/bonusbg_hh.ogg',
				'freespinbg_ka': 'assets/sounds/Wins/freespin_ka.ogg',
				// Pick-a-card overlay background music
				'bgpickacard_hh': 'assets/sounds/BG/bgpickacard_hh.ogg',
				'rumble_hh': 'assets/sounds/SFX/rumble_hh.ogg',
				'roar_hh': 'assets/sounds/SFX/roar_hh.ogg',
				'ambience_hh': 'assets/sounds/SFX/ambience_hh.ogg',
				'spin_hh': 'assets/sounds/SFX/spin_hh.ogg',
				'reeldrop_hh': 'assets/sounds/SFX/reeldrop_hh.ogg',
				'turbodrop_hh': 'assets/sounds/SFX/turbodrop_hh.ogg',
				'wheelspin_ka': 'assets/sounds/SFX/wheelspin_ka.ogg',
				'coin_drop_ka': 'assets/sounds/SFX/coin_drop_ka.ogg',
				// Fire SFX
				'fire_hh': 'assets/sounds/SFX/fire_hh.ogg',
				'blaze_hh': 'assets/sounds/SFX/blaze_hh.ogg',
				'fireworks_hh': 'assets/sounds/SFX/fireworks_hh.ogg',
				'cardflip_hh': 'assets/sounds/SFX/cardflip_hh.ogg',
				// Hit win SFX
				'hitwin_hh': 'assets/sounds/SFX/hitwin_hh.ogg',
				// Wild multi SFX
				'scatter_hh': 'assets/sounds/SFX/scatter_hh.ogg',
				'anticipation_hh': 'assets/sounds/SFX/anticipation_hh.ogg',
				// Winline SFX
				'winline_1_ka': 'assets/sounds/SFX/winline_1_ka.ogg',
				'winline_2_ka': 'assets/sounds/SFX/winline_2_ka.ogg',
				// Card deal SFX for ScatterWinOverlay card slide
				'carddeal_hh': 'assets/sounds/SFX/carddeal_hh.ogg',
				// Card pick SFX when user selects a card in ScatterWinOverlay
				'cardpick_hh': 'assets/sounds/SFX/cardpick_hh.ogg',
				// Win dialog SFX
				'bigw_hh': 'assets/sounds/Wins/bigw_hh.ogg',
				'megaw_ka': 'assets/sounds/Wins/megaw_ka.ogg',
				'superw_ka': 'assets/sounds/Wins/superw_ka.ogg',
				'epicw_ka': 'assets/sounds/Wins/epicw_ka.ogg',
				'freespin_ka': 'assets/sounds/Wins/freespin_ka.ogg',
				'congrats_ka': 'assets/sounds/Wins/congrats_ka.ogg',
				
				// Win dialog SFX
				'bigwskip_ka': 'assets/sounds/Wins/bigwskip_ka.ogg',
				'megawskip_ka': 'assets/sounds/Wins/megawskip_ka.ogg',
				'superwskip_ka': 'assets/sounds/Wins/superwskip_ka.ogg',
				'epicwskip_ka': 'assets/sounds/Wins/epicwskip_ka.ogg'
			}
		};
	}

	getTransitionAssets(): AssetGroup {
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		return {
			spine: {
				'bubbles_transition': {
					atlas: `${forcedPortraitHighPrefix}/transitions/Bubbles_Transition.atlas`,
					json: `${forcedPortraitHighPrefix}/transitions/Bubbles_Transition.json`
				}
			}
		};
	}

	getDynamiteAssets(): AssetGroup {
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		return {
			images: {
				'dynamite': `${forcedPortraitHighPrefix}/dynamite/dynamite.png`,
				'boom': `${forcedPortraitHighPrefix}/dynamite/boom.png`,
			}
		};
	}

	// Helper method to get all assets for a scene
	getAllAssets(): { [key: string]: AssetGroup } {
		return {
			background: this.getBackgroundAssets(),
			bonusHeader: this.getBonusHeaderAssets(),
			loading: this.getLoadingAssets(),
			transitions: this.getTransitionAssets(),
			dynamite: this.getDynamiteAssets(),
			symbols: this.getSymbolAssets(),
			buttons: this.getButtonAssets(),
			fonts: this.getFontAssets(),
			dialogs: this.getDialogAssets(),
			numbers: this.getNumberAssets(),
			coin: this.getCoinAssets(),
			buyFeature: this.getBuyFeatureAssets(),
			scatterWin: this.getScatterWinOverlayAssets(),
			freeSpinOverlay: this.getFreeSpinOverlayAssets(),
			audio: this.getAudioAssets(),
		};
	}

	// Method to get debug info
	getDebugInfo(): void {
		const prefix = this.getAssetPrefix();
		console.log(`[AssetConfig] Asset prefix: ${prefix}`);
		console.log(`[AssetConfig] Available asset groups:`, Object.keys(this.getAllAssets()));
	}
} 