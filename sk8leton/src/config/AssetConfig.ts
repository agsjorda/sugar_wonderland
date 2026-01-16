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
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		return {
			images: {
				'reel_bg': `${forcedPortraitHighPrefix}/background/reel_bg.webp`
			},
			spine: {
				'NormalBackground_SK8': {
					atlas: `${forcedPortraitHighPrefix}/background/NormalBackground_SK8.atlas`,
					json: `${forcedPortraitHighPrefix}/background/NormalBackground_SK8.json`
				}
			}
		};
	}

	getBonusBackgroundAssets(): AssetGroup {
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		return {
			images: {},
			spine: {
				'BonusBackground_SK8': {
					atlas: `${forcedPortraitHighPrefix}/bonus_background/BonusBackground_SK8.atlas`,
					json: `${forcedPortraitHighPrefix}/bonus_background/BonusBackground_SK8.json`
				}
			}
		};
	}

	getGaugeMeterAssets(): AssetGroup {
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		return {
			images: {
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
			spine: {
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
				'button_bg': `${prefix}/loading/button_bg.webp`,
				'button_spin': `${prefix}/loading/button_spin.webp`,
				'loading_frame': `${prefix}/loading/loading-frame.webp`,
				'loading_frame_2': `${prefix}/loading/loading-frame-2.webp`,
				'dijoker_logo': `${prefix}/loading/DiJoker-logo.webp`
			},
			spine: {
				'IntroAnimation_SK8': {
					atlas: `assets/portrait/high/intro_background/IntroAnimation_SK8.atlas`,
					json: `assets/portrait/high/intro_background/IntroAnimation_SK8.json`
				},
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
		const tbSpineSymbols = new Set<number>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
		
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
			const symbolNameSk8 = `Symbol${i}_Sk8`;
			const spineKey = `symbol_${i}_spine`;
			
			if (tbSpineSymbols.has(i)) {
				const spineFileBase = symbolNameSk8;
				const atlasPath = `${spinePrefix}/spine_symbols/${spineFileBase}.atlas`;
				const jsonPath = `${spinePrefix}/spine_symbols/${spineFileBase}.json`;
				
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
				imagePath = `${spinePrefix}/symbols/${symbolNameSk8}.webp`;
			} else if (webpSpineFolderFallback.has(i)) {
				imagePath = `${spinePrefix}/spine_symbols/${symbolNameSk8}.webp`;
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
				'autoplay_off': `assets/controller/${screenMode}/${quality}/autoplay_off.webp`,
				'autoplay_on': `assets/controller/${screenMode}/${quality}/autoplay_on.webp`,
				'decrease_bet': `assets/controller/${screenMode}/${quality}/decrease_bet.webp`,
				'increase_bet': `assets/controller/${screenMode}/${quality}/increase_bet.webp`,
				'menu': `assets/controller/${screenMode}/${quality}/menu.webp`,
				'spin': `assets/controller/${screenMode}/${quality}/spin_bg.webp`,
				'spin_icon': `assets/controller/${screenMode}/${quality}/spin_icon.webp`,
				'autoplay_stop_icon': `assets/controller/${screenMode}/${quality}/autoplay_stop_icon.webp`,
				'turbo_off': `assets/controller/${screenMode}/${quality}/turbo_off.webp`,
				'turbo_on': `assets/controller/${screenMode}/${quality}/turbo_on.webp`,
				'amplify': `assets/controller/${screenMode}/${quality}/amplify.webp`,
				'feature': `assets/controller/${screenMode}/${quality}/feature.webp`,
				'long_button': `assets/controller/${screenMode}/${quality}/long_button.webp`,
				'maximize': `assets/controller/${screenMode}/${quality}/maximize.webp`,
				'minimize': `assets/controller/${screenMode}/${quality}/minimize.webp`,
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
				'menu_info': `${prefix}/menu/Info.webp`,
				'menu_history': `${prefix}/menu/History.webp`,
				'menu_settings': `${prefix}/menu/Settings.webp`,
				// Pagination and loading
				'icon_left': `${prefix}/menu/icon_left.webp`,
				'icon_most_left': `${prefix}/menu/icon_most_left.webp`,
				'icon_right': `${prefix}/menu/icon_right.webp`,
				'icon_most_right': `${prefix}/menu/icon_most_right.webp`,
				'loading_icon': `${prefix}/menu/loading.webp`,
				// Close icon (portrait/high specific path)
				'menu_close': `assets/controller/portrait/high/close.webp`
			}
		};
	}

	getHelpScreenAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		// Build images map
		const images: { [key: string]: string } = {
			'ScatterLabel': `${forcedPortraitHighPrefix}/help_screen/ScatterSymbol.webp`
		};

		for (let i = 0; i <= 6; i++) {
			images[`help_section${i}`] = `${forcedPortraitHighPrefix}/help_screen/help_section${i}.webp`;
		}

		return { images };
	}

	getDialogAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		
		console.log(`[AssetConfig] Loading dialog assets with prefix: ${prefix}`);
		
		return {
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

	getScatterAnticipationAssets(): AssetGroup {
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		console.log('[AssetConfig] Loading Scatter Anticipation assets (forced portrait/high)');
		return {
			images: {},
			spine: {
				'Bubble_Sparkle_VFX': {
					atlas: `${forcedPortraitHighPrefix}/overlays/Bubble_Sparkle_VFX.atlas`,
					json: `${forcedPortraitHighPrefix}/overlays/Bubble_Sparkle_VFX.json`
				}
			}
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
		
		numberImages['number_x'] = `${prefix}/numbers/number_x.webp`;
		console.log(`[AssetConfig] Number x: ${prefix}/numbers/number_x.webp`);
		
		return {
			images: numberImages
		};
	}

	getBuyFeatureAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		const portraitHighPrefix = `assets/portrait/high`;
		
		console.log(`[AssetConfig] Loading buy feature assets with prefix: ${prefix} (logos forced to ${portraitHighPrefix})`);
		
		return {
			images: {
				'scatter_logo_background': `${portraitHighPrefix}/buy_feature/scatter_logo_background.webp`,
				'buy_feature_bg': `${prefix}/buy_feature/buy_feature_bg.webp`
			}
		};
	}

	getWinlineAssets(): AssetGroup {
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		return {
			images: {
				'winline-display': `${forcedPortraitHighPrefix}/winline/winline-display.webp`
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
				'bubble_transition_TB': 'assets/sounds/SFX/bubble_transition_TB.ogg',
				'mainbg_SK8': 'assets/sounds/BG/mainbg_SK8.ogg',
				'ambience_SK8': 'assets/sounds/BG/ambience_SK8.ogg',
				'bonusbg_SK8': 'assets/sounds/BG/bonusbg_SK8.ogg',
				'freespin_SK8': 'assets/sounds/BG/freespin_SK8.ogg',
				'spin_SK8': 'assets/sounds/SFX/spin_SK8.ogg',
				'reeldrop_SK8': 'assets/sounds/SFX/reeldrop_SK8.ogg',
				'turbodrop_SK8': 'assets/sounds/SFX/turbodrop_SK8.ogg',
				'fishreel_TB': 'assets/sounds/SFX/fishreel_TB.ogg',
				'explosion_TB': 'assets/sounds/SFX/explosion_TB.ogg',
				'splash_TB': 'assets/sounds/SFX/splash_TB.ogg',
				'multi_add_1_TB': 'assets/sounds/SFX/multi_add_1_TB.ogg',
				'multi_add_2_TB': 'assets/sounds/SFX/multi_add_2_TB.ogg',
				'multi_add_3_TB': 'assets/sounds/SFX/multi_add_3_TB.ogg',
				'multi_add_4_TB': 'assets/sounds/SFX/multi_add_4_TB.ogg',
				// Hit win SFX
				'hitwin_SK8': 'assets/sounds/SFX/hitwin_SK8.ogg',
				// Wild multi SFX
				'scatter_TB': 'assets/sounds/SFX/scatter_TB.ogg',
				'scat_anti_TB': 'assets/sounds/SFX/scat_anti_TB.ogg',
				'scatter_hit_TB': 'assets/sounds/SFX/scatter_hit_TB.ogg',
				// Win dialog SFX
				'bigw_TB': 'assets/sounds/Wins/bigw_TB.ogg',
				'megaw_TB': 'assets/sounds/Wins/megaw_TB.ogg',
				'superw_TB': 'assets/sounds/Wins/superw_TB.ogg',
				'epicw_TB': 'assets/sounds/Wins/epicw_TB.ogg',
				'congrats_TB': 'assets/sounds/Wins/congrats_TB.ogg',
			}
		};
	}

	getTransitionAssets(): AssetGroup {
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		return {
			spine: {
				'Fire_Transition': {
					atlas: `${forcedPortraitHighPrefix}/transitions/Fire_Transition.atlas`,
					json: `${forcedPortraitHighPrefix}/transitions/Fire_Transition.json`
				}
			}
		};
	}

	getDynamiteAssets(): AssetGroup {
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		return {
			images: {
				'dynamite': `${forcedPortraitHighPrefix}/dynamite/dynamite.webp`,
				'crosshair': `${forcedPortraitHighPrefix}/dynamite/crosshair.webp`
			},
			spine: {
				'Water_Bomb_VFX': {
					atlas: `${forcedPortraitHighPrefix}/dynamite/Water_Bomb_VFX.atlas`,
					json: `${forcedPortraitHighPrefix}/dynamite/Water_Bomb_VFX.json`
				}
			}
		};
	}

	// Helper method to get all assets for a scene
	getAllAssets(): { [key: string]: AssetGroup } {
		return {
			gaugeMeter: this.getGaugeMeterAssets(),
			bonusHeader: this.getBonusHeaderAssets(),
			loading: this.getLoadingAssets(),
			symbols: this.getSymbolAssets(),
			buttons: this.getButtonAssets(),
			fonts: this.getFontAssets(),
			menu: this.getMenuAssets(),
			helpScreen: this.getHelpScreenAssets(),
			dialogs: this.getDialogAssets(),
			scatterAnticipation: this.getScatterAnticipationAssets(),
			numbers: this.getNumberAssets(),
			winline: this.getWinlineAssets(),
			buyFeature: this.getBuyFeatureAssets(),
			audio: this.getAudioAssets()
		};
	}

	// Method to get debug info
	getDebugInfo(): void {
		const prefix = this.getAssetPrefix();
		console.log(`[AssetConfig] Asset prefix: ${prefix}`);
		console.log(`[AssetConfig] Available asset groups:`, Object.keys(this.getAllAssets()));
	}
}