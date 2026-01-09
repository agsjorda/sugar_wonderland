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
	private readonly GAME_INITIALS = 'RF';

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

	// Network resources notes: ~38MB | Medium
	getBackgroundAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		return {
			images: {
				'default_background': `${prefix}/background/default_background.webp`,
				'reel_frame': `${prefix}/background/reel_frame.webp`,
			},
			spine: {
				'default_background_spine': {
					atlas: `${prefix}/background/default_background_spine/Main game Background RIG.atlas`,
					json: `${prefix}/background/default_background_spine/Main game Background RIG.json`
				},
				'rainbow_transition': {
					atlas: `${prefix}/transitions/Rainbow_Transition_RF/Rainbow_Transition_RF.atlas`,
					json: `${prefix}/transitions/Rainbow_Transition_RF/Rainbow_Transition_RF.json`
				},
			}
		};
	}

	// Network resources notes: ~13MB | Light
	getBonusBackgroundAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		return {
			images: {
				'bonus_background': `${prefix}/bonus_background/bonus_background.webp`,
			},
			spine: {
				'bonus_background_spine': {
					atlas: `${prefix}/bonus_background/bonus_background_spine/Bonus Background RIG.atlas`,
					json: `${prefix}/bonus_background/bonus_background_spine/Bonus Background RIG.json`
				},
				'sparkle_background': {
					atlas: `${prefix}/bonus_background/SparkleBonus_RF_VFX/SparkleBonus_RF_VFX.atlas`,
					json: `${prefix}/bonus_background/SparkleBonus_RF_VFX/SparkleBonus_RF_VFX.json`
				},
			}
		};
	}

	// Network resources notes: ~2MB | Very light
	getHeaderAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'win_bar': `${prefix}/header/win_bar.webp`,
				'multiplier_bar': `${prefix}/header/multiplier_bar.webp`,
				'logo': `${prefix}/logo/logo.webp`,
				// Add more header images here
			},
			spine: {
			}
		};
	}

	// Network resources notes: ~1MB | Very light
	getBonusHeaderAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
			},
			spine: {
			}
		};
	}

	// Network resources notes: ~1MB | Very light
	getLoadingAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'loading_background': `${prefix}/loading/loading_background.webp`,
				'loading_character': `${prefix}/loading/loading_character.webp`,
				'loading_footer': `${prefix}/loading/loading_footer.webp`,
				'loading_header': `${prefix}/loading/loading_header.webp`,
				'loading_footer_feather': `${prefix}/loading/loading_footer_feather.webp`,

				'button_bg': `${prefix}/loading/button_bg.webp`,
				'button_spin': `${prefix}/loading/button_spin.webp`,
				'loading_frame': `${prefix}/loading/loading-frame.webp`,
				'loading_frame_2': `${prefix}/loading/loading-frame-2.webp`,
				'dijoker_logo': `${prefix}/loading/DiJoker-logo.webp`
			},
			spine: {
				// Studio loading spine (DI JOKER) – only available in portrait/high
				'di_joker': {
					atlas: `assets/portrait/high/dijoker_loading/DI JOKER.atlas`,
					json: `assets/portrait/high/dijoker_loading/DI JOKER.json`
				},
			}
		};
	}

	getSymbolSpineAndPngAssets(): AssetGroup {
		const prefix = this.getAssetPrefix(); // This gives us assets/{orientation}/{quality}
		console.log(`[AssetConfig] Loading symbol assets from: ${prefix}/symbols/ and ${prefix}/symbols`);
		
		// Generate symbol assets for all symbols (0-9)
		const symbolImages: { [key: string]: string } = {};
		const symbolSpine: { [key: string]: { atlas: string; json: string } } = {};
		const symbolCount: number = 10

		for (let i = 0; i < symbolCount; i++) {
			const hasSpine = i < 5;
			
			if(hasSpine) {
				// Spine animations for hit effects
				const spineKey = `symbol${i}_spine`;
				const symbolName = `Symbol${i}_${this.GAME_INITIALS}`;
				const atlasPath = `${prefix}/symbols/${symbolName}/${symbolName}.atlas`;
				const jsonPath = `${prefix}/symbols/${symbolName}/${symbolName}.json`;

				console.log('[AssetConfig] Loading symbol spine:', spineKey, symbolName, atlasPath, jsonPath);
				
				symbolSpine[spineKey] = {
					atlas: atlasPath,
					json: jsonPath
				};
			}

			// PNG sprites for normal display
			const spriteKey = `symbol${i}`;
			const spritePath = `${prefix}/symbols/symbol${i}.webp`;
			symbolImages[spriteKey] = spritePath;
		}

		// Multiplier symbol
		symbolSpine['multiplier_spine'] = {
			atlas: `${prefix}/symbols/Symbol10_RF/Symbol10_RF.atlas`,
			json: `${prefix}/symbols/Symbol10_RF/Symbol10_RF.json`
		};

		/**
		 * Multiplier number images (e.g. 2x, 10x, 500x).
		 * NOTE: These assets currently only exist in `assets/portrait/high/...`, so we only register them
		 * when we're running in portrait + high quality to avoid requesting missing files.
		 * 11 is the index of the first multiplier number
		 */
		const multiplierValues = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 50, 100, 250, 500];
		for (let i = 0; i < multiplierValues.length; i++) {
			const key = `multiplier_number_${i + 11}x`;
			symbolImages[key] = `${prefix}/symbols/multiplier_numbers/${multiplierValues[i]}x.webp`;
		}

		return {
			images: symbolImages,
			spine: symbolSpine
		};
	}

	// Network resources notes: ~6MB | Very light
	getButtonAssets(): AssetGroup {
		// Controller buttons now follow portrait/landscape structure
		const screenConfig = this.screenModeManager.getScreenConfig();
		const isHighSpeed = this.networkManager.getNetworkSpeed();
		const quality = isHighSpeed ? 'high' : 'low';
		const screenMode = screenConfig.isPortrait ? 'portrait' : 'landscape';
		
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
				'feature': `assets/controller/${screenMode}/${quality}/feature.png`,
				'long_button': `assets/controller/${screenMode}/${quality}/long_button.png`,
				'maximize': `assets/controller/${screenMode}/${quality}/maximize.png`,
				'minimize': `assets/controller/${screenMode}/${quality}/minimize.png`,
			},
			spine: {
				'spin_button_animation': {
					atlas: `assets/controller/${screenMode}/${quality}/spin_button_anim/spin_button_anim.atlas`,
					json: `assets/controller/${screenMode}/${quality}/spin_button_anim/spin_button_anim.json`
				},
				'button_animation_idle': {
					atlas: `assets/controller/${screenMode}/${quality}/button_animation_idle/button_animation_idle.atlas`,
					json: `assets/controller/${screenMode}/${quality}/button_animation_idle/button_animation_idle.json`
				},
				'amplify_bet': {
					atlas: `assets/portrait/high/amplify_bet/Amplify Bet.atlas`,
					json: `assets/portrait/high/amplify_bet/Amplify Bet.json`
				},
				// Enhance Bet idle loop (available only in portrait/high for now)
				'enhance_bet_idle_on': {
					atlas: `assets/controller/portrait/high/enhanceBet_idle_on/Amplify Bet.atlas`,
					json: `assets/controller/portrait/high/enhanceBet_idle_on/Amplify Bet.json`
				},
				'turbo_animation': {
					atlas: `assets/controller/${screenMode}/${quality}/turbo_animation/Turbo_Spin.atlas`,
					json: `assets/controller/${screenMode}/${quality}/turbo_animation/Turbo_Spin.json`
				}
			}
		};
	}

	// Network resources notes: ~1MB | Very light
	getFontAssets(): AssetGroup {
		console.log(`[AssetConfig] Loading font assets`);
		
		return {
			fonts: {
				'poppins-thin': 'assets/fonts/poppins/Poppins-Thin.ttf',
				'poppins-bold': 'assets/fonts/poppins/Poppins-Bold.ttf',
				'poppins-regular': 'assets/fonts/poppins/Poppins-Regular.ttf'
				
			}
		};
	}

	// Network resources notes: ~1MB | Very light
	getSpinnerAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading spinner assets with prefix: ${prefix}`);
		
		return {
			
		};
	}

	// Network resources notes: ~0MB | 
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

	// Network resources notes: ~3MB | Very light
	getHelpScreenAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'helpscreen_0': `${prefix}/help_screen/helpscreen_0.webp`,
				'helpscreen_1': `${prefix}/help_screen/helpscreen_1.webp`,
				'helpscreen_2': `${prefix}/help_screen/helpscreen_2.webp`,
			}
		};
	}

	// Network resources notes: ~11MB | Light
	getDialogAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading dialog assets with prefix: ${prefix}`);
		
		return {
			images: {
				'eye_shot_transition': `${prefix}/transitions/eyes_placeholder_RF.png`,
			},
			spine: {
				'big_win': {
					atlas: `${prefix}/dialogs/BigW_RF/BigW_RF.atlas`,
					json: `${prefix}/dialogs/BigW_RF/BigW_RF.json`
				},
				'mega_win': {
					atlas: `${prefix}/dialogs/MegaW_RF/MegaW_RF.atlas`,
					json: `${prefix}/dialogs/MegaW_RF/MegaW_RF.json`
				},
				'epic_win': {
					atlas: `${prefix}/dialogs/EpicW_RF/EpicW_RF.atlas`,
					json: `${prefix}/dialogs/EpicW_RF/EpicW_RF.json`
				},
				'super_win': {
					atlas: `${prefix}/dialogs/SuperW_RF/SuperW_RF.atlas`, 
					json: `${prefix}/dialogs/SuperW_RF/SuperW_RF.json`
				},
				'free_spin': {
					atlas: `${prefix}/dialogs/FreeSpin_RF/FreeSpin_RF.atlas`,
					json: `${prefix}/dialogs/FreeSpin_RF/FreeSpin_RF.json`
				},
				'max_win': {
					atlas: `${prefix}/dialogs/MaxW_RF/MaxW_RF.atlas`,
					json: `${prefix}/dialogs/MaxW_RF/MaxW_RF.json`
				},
				'total_win': {
					atlas: `${prefix}/dialogs/TotalW_RF/TotalW_RF.atlas`,
					json: `${prefix}/dialogs/TotalW_RF/TotalW_RF.json`
				},
				'punch_vfx': {
					atlas: `${prefix}/dialogs/Punch_VFX/Punch_VFX.atlas`,
					json: `${prefix}/dialogs/Punch_VFX/Punch_VFX.json`
				},
			}
		};
	}

	/**
	 * Scatter Anticipation assets – only available in portrait/high for now.
	 * We intentionally do not use getAssetPrefix() to avoid missing assets on low quality.
	 */
	// Network resources notes: ~4MB | Very light
	getScatterAnticipationAssets(): AssetGroup {
		console.log('[AssetConfig] Loading Scatter Anticipation assets');
		return {
			spine: {
			}
		};
	}

	// Network resources notes: NONE | Not used YET
	getNumberAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading number assets with prefix: ${prefix}`);
		
		// Generate number assets for digits 0-9, plus comma and dot
		const numberImages: { [key: string]: string } = {};
		
		// Add digit images (0-9)
		for (let i = 0; i <= 9; i++) {
			const key = `number_${i}`;
			const path = `${prefix}/numbers/number_${i}.webp`;
			numberImages[key] = path;
			console.log(`[AssetConfig] Number ${key}: ${path}`);
		}
		
		// Add comma and dot
		numberImages['number_comma'] = `${prefix}/numbers/number_comma.webp`;
		numberImages['number_dot'] = `${prefix}/numbers/number_dot.webp`;
		numberImages['number_x'] = `${prefix}/numbers/number_x.webp`;
		
		console.log(`[AssetConfig] Number comma: ${prefix}/numbers/number_comma.webp`);
		console.log(`[AssetConfig] Number dot: ${prefix}/numbers/number_dot.webp`);

		return {
			images: numberImages
		};
	}

	// Network resources notes: NONE | Not used
	getCoinAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading coin assets with prefix: ${prefix}`);

		return {};
	}

	getSymbolEffectsAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		return {
			spine: {
				'hit_effect': {
					atlas: `${prefix}/symbols/Poof_VFX_RF/Poof_VFX_RF.atlas`,
					json: `${prefix}/symbols/Poof_VFX_RF/Poof_VFX_RF.json`
				},
			}
		};
	}

	// Network resources notes: ~8MB | Light
	getBuyFeatureAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading buy feature assets with prefix: ${prefix}`);
		
		return {
			images: {
				'buy_feature_logo_bg': `${prefix}/buy_feature/buy_feature_logo_bg.webp`,
				'buy_feature_bg': `${prefix}/buy_feature/buy_feature_bg.webp`
			}
		};
	}

	// Network resources notes: ~0MB | Negligible
	getAudioAssets(): AssetGroup {
		console.log(`[AssetConfig] Loading audio assets`);
		
		return {
			audio: {
				// Updated to WF
				// Win dialog SFX
				'totalw': 'assets/sounds/Wins/totalw_RF.ogg',
				'bigw': 'assets/sounds/Wins/bigw_RF.ogg',
				'megaw': 'assets/sounds/Wins/megaw_RF.ogg',
				'superw': 'assets/sounds/Wins/superw_RF.ogg',
				'epicw': 'assets/sounds/Wins/epicw_RF.ogg',
				'maxw_end': 'assets/sounds/Wins/maxw_end_RF.ogg',
				'maxw': 'assets/sounds/Wins/maxw_RF.ogg',
				'scatter': 'assets/sounds/SFX/scatter_RF.ogg',

				// Tumble win SFX
				'twin1': 'assets/sounds/SFX/twin_1_RF.ogg',
				'twin2': 'assets/sounds/SFX/twin_2_RF.ogg',
				'twin3': 'assets/sounds/SFX/twin_3_RF.ogg',
				'twin4': 'assets/sounds/SFX/twin_4_RF.ogg',

				// Background SFX
				'mainbg': 'assets/sounds/BG/mainbg_RF.ogg',
				'freespinbg': 'assets/sounds/BG/freespinbg_RF.ogg',
				'bonusbg': 'assets/sounds/BG/bonusbg_RF.ogg',

				// Menu/UI clicks
				'click': 'assets/sounds/click.ogg',
				'utility_button': 'assets/sounds/utility_button.ogg',
				
				'turbodrop': 'assets/sounds/SFX/turbo_RF.ogg',
				'reeldrop': 'assets/sounds/SFX/reeldrop_RF.ogg',
				'spin': 'assets/sounds/SFX/spin_RF.ogg',

				// 'multiplier_added': 'assets/sounds/SFX/ringbell_RF.ogg',
				'multiplier_hit': 'assets/sounds/SFX/ringbell_RF.ogg',
				// 'hit_win_2_wf': 'assets/sounds/SFX/hit_win_2_wf.ogg',
				'hit_win': 'assets/sounds/SFX/texplosion_RF.ogg',

				'scatter_animation': 'assets/sounds/SFX/scatter_anim_RF.ogg',
				'symbol_kiss': 'assets/sounds/SFX/kiss_RF.ogg',
				'symbol_nyet': 'assets/sounds/SFX/nyetnyet_RF.ogg',
				'symbol_pau': 'assets/sounds/SFX/pau_RF.ogg',
				'symbol_punch': 'assets/sounds/SFX/punch_RF.ogg',

				// Note: actual folder in /public is "Wins" (case-sensitive on many hosts)
				'win_dialog_intro': 'assets/sounds/Wins/win_intro_anim_RF.ogg',
			}
		};
	}

	// Helper method to get all assets for a scene
	getAllAssets(): { [key: string]: AssetGroup } {
		return {
			background: this.getBackgroundAssets(),
			header: this.getHeaderAssets(),
			bonusHeader: this.getBonusHeaderAssets(),
			loading: this.getLoadingAssets(),
			symbols: this.getSymbolSpineAndPngAssets(),
			buttons: this.getButtonAssets(),
			fonts: this.getFontAssets(),
			spinner: this.getSpinnerAssets(),
			dialogs: this.getDialogAssets(),
			numbers: this.getNumberAssets(),
			coin: this.getCoinAssets(),
			buyFeature: this.getBuyFeatureAssets(),
			audio: this.getAudioAssets(),
			symbolEffects: this.getSymbolEffectsAssets(),
		};
	}

	// Method to get debug info
	getDebugInfo(): void {
		const prefix = this.getAssetPrefix();
		console.log(`[AssetConfig] Asset prefix: ${prefix}`);
		console.log(`[AssetConfig] Available asset groups:`, Object.keys(this.getAllAssets()));
	}
} 