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
	private readonly GAME_INITIALS = 'SD';

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
				'reel_frame_top': `${prefix}/background/reel_frame_top.webp`,
				'reel_frame_bottom': `${prefix}/background/reel_frame_bottom.webp`,
			},
			spine: {
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
			}
		};
	}

	// Network resources notes: ~2MB | Very light
	getHeaderAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'win_bar': `${prefix}/header/win_bar.webp`,
				'logo': `${prefix}/logo/logo.webp`,
				'blur': `${prefix}/header/blur.webp`,
				// Add more header images here
			},
			spine: {
				// Add more Spine animations here
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
				'loading_bg': `${prefix}/loading/loading_bg.webp`,
				'button_bg': `${prefix}/loading/button_bg.webp`,
				'button_spin': `${prefix}/loading/button_spin.webp`,
				'loading_frame': `${prefix}/loading/loading-frame.webp`,
				'loading_frame_2': `${prefix}/loading/loading-frame-2.webp`,
				'dijoker_logo': `${prefix}/loading/DiJoker-logo.webp`,
				'dark_feathering': `${prefix}/loading/dark_feathering.webp`,
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

	// Network resources notes: PNG: ~14.5MB | Very heavy
	// Network resources notes: SPINE: ~87.5MB | Very heavy

	getSymbolAssets(): AssetGroup {
		const prefix = this.getAssetPrefix(); // This gives us assets/{orientation}/{quality}
		console.log(`[AssetConfig] Loading symbol assets from: ${prefix}/symbols/ and ${prefix}/Symbols_${this.GAME_INITIALS}/`);
		
		// Generate symbol assets for all symbols (0-9)
		const symbolImages: { [key: string]: string } = {};
		const symbolSpine: { [key: string]: { atlas: string; json: string } } = {};
		const symbolCount: number = 10

		for (let i = 0; i < symbolCount; i++) {
			const hasSpine = i <= 5;
			
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

		for (let i = 0; i <= 14; i++) {
			symbolImages[`multiplier_${i}`] = `assets/portrait/high/symbols/multipliers/multiplier_${i}.webp`;
		}

		symbolSpine['multiplier_high_spine'] = {
			atlas: `${prefix}/symbols/Symbol10_SD/Symbol10_High_SD.atlas`,
			json: `${prefix}/symbols/Symbol10_SD/Symbol10_High_SD.json`
		};
		symbolSpine['multiplier_mid_spine'] = {
			atlas: `${prefix}/symbols/Symbol10_SD/Symbol10_Mid_SD.atlas`,
			json: `${prefix}/symbols/Symbol10_SD/Symbol10_Mid_SD.json`
		};
		symbolSpine['multiplier_low_spine'] = {
			atlas: `${prefix}/symbols/Symbol10_SD/Symbol10_Low_SD.atlas`,
			json: `${prefix}/symbols/Symbol10_SD/Symbol10_Low_SD.json`
		};
		
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
				'feature': `assets/controller/${screenMode}/${quality}/feature.webp`,
				'long_button': `assets/controller/${screenMode}/${quality}/long_button.png`,
				'maximize': `assets/controller/${screenMode}/${quality}/maximize.png`,
				'minimize': `assets/controller/${screenMode}/${quality}/minimize.png`,
				// Free round assets
				'freeround_bg': `assets/controller/${screenMode}/${quality}/freeround_bg.png`,
				'spin_now_button': `assets/controller/${screenMode}/${quality}/spin_now_button.png`,
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
				},
				// Free round spin button animation (available only in portrait/high for now)
				'fr_spin_button_animation': {
					atlas: `assets/controller/portrait/high/Button_Bonus_Buttom/Button_Bonus_VFX.atlas`,
					json: `assets/controller/portrait/high/Button_Bonus_Buttom/Button_Bonus_VFX.json`
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
			},
			spine: {
				'big_win': {
					atlas: `${prefix}/dialogs/big_win/BigW_${this.GAME_INITIALS}.atlas`,
					json: `${prefix}/dialogs/big_win/BigW_${this.GAME_INITIALS}.json`
				},
				'epic_win': {
					atlas: `${prefix}/dialogs/epic_win/EpicW_${this.GAME_INITIALS}.atlas`,
					json: `${prefix}/dialogs/epic_win/EpicW_${this.GAME_INITIALS}.json`
				},
				'mega_win': {
					atlas: `${prefix}/dialogs/mega_win/MegaW_${this.GAME_INITIALS}.atlas`,
					json: `${prefix}/dialogs/mega_win/MegaW_${this.GAME_INITIALS}.json`
				},
				'super_win': {
					atlas: `${prefix}/dialogs/super_win/SuperW_${this.GAME_INITIALS}.atlas`,
					json: `${prefix}/dialogs/super_win/SuperW_${this.GAME_INITIALS}.json`
				},
				'free_spin': {
					atlas: `${prefix}/dialogs/free_spin/FreeSpin_${this.GAME_INITIALS}.atlas`,
					json: `${prefix}/dialogs/free_spin/FreeSpin_${this.GAME_INITIALS}.json`
				},
				'total_win': {
					atlas: `${prefix}/dialogs/total_win/TotalW_${this.GAME_INITIALS}.atlas`,
					json: `${prefix}/dialogs/total_win/TotalW_${this.GAME_INITIALS}.json`
				},
				'max_win': {
					atlas: `${prefix}/dialogs/max_win/MaxW_${this.GAME_INITIALS}.atlas`,
					json: `${prefix}/dialogs/max_win/MaxW_${this.GAME_INITIALS}.json`
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
			const path = `${prefix}/numbers/${i}.png`;
			numberImages[key] = path;
			console.log(`[AssetConfig] Number ${key}: ${path}`);
		}
		
		// Add comma and dot
		numberImages['number_comma'] = `${prefix}/numbers/comma.png`;
		numberImages['number_dot'] = `${prefix}/numbers/dot.png`;
		numberImages['number_x'] = `${prefix}/numbers/x.png`;
		
		console.log(`[AssetConfig] Number comma: ${prefix}/numbers/comma.webp`);
		console.log(`[AssetConfig] Number dot: ${prefix}/numbers/dot.webp`);
		console.log(`[AssetConfig] Number x: ${prefix}/numbers/x.webp`);

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
					atlas: `${prefix}/symbols/Slash_VFX_SD/Slash_VFX_SD.atlas`,
					json: `${prefix}/symbols/Slash_VFX_SD/Slash_VFX_SD.json`
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
				'buy_feature_bg': `${prefix}/background/default_background.webp`
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
				'freespin': `assets/sounds/BG/freespinbg_${this.GAME_INITIALS}.ogg`,
				'congrats': `assets/sounds/Wins/totalw_${this.GAME_INITIALS}.ogg`,
				'bigw': `assets/sounds/Wins/bigw_${this.GAME_INITIALS}.ogg`,
				'megaw': `assets/sounds/Wins/megaw_${this.GAME_INITIALS}.ogg`,
				'superw': `assets/sounds/Wins/superw_${this.GAME_INITIALS}.ogg`,
				'epicw': `assets/sounds/Wins/epicw_${this.GAME_INITIALS}.ogg`,
				'maxw': `assets/sounds/Wins/maxw_${this.GAME_INITIALS}.ogg`,

				// Background SFX
				'mainbg': `assets/sounds/BG/mainbg_${this.GAME_INITIALS}.ogg`,
				'bonusbg': `assets/sounds/BG/bonusbg_${this.GAME_INITIALS}.ogg`,
				'ambience': `assets/sounds/BG/ambience_${this.GAME_INITIALS}.ogg`,  // Added: exists but wasn't referenced

				// Menu/UI clicks
				'click': `assets/sounds/click_${this.GAME_INITIALS}.ogg`,
				
				'turbodrop': `assets/sounds/SFX/turbodrop_${this.GAME_INITIALS}.ogg`,
				'reeldrop': `assets/sounds/SFX/reeldrop_${this.GAME_INITIALS}.ogg`,
				'scatter': `assets/sounds/SFX/scatter_${this.GAME_INITIALS}.ogg`,

				'multiplier_added': `assets/sounds/SFX/multi_add_${this.GAME_INITIALS}.ogg`,
				//'explosion': `assets/sounds/SFX/explosion_${this.GAME_INITIALS}.ogg`, // replace with HIT_WIN
				'multi': `assets/sounds/SFX/multi_${this.GAME_INITIALS}.ogg`,

				'hit_win': `assets/sounds/SFX/hit_win_${this.GAME_INITIALS}.ogg`,
				'spin': `assets/sounds/SFX/spin_${this.GAME_INITIALS}.ogg`,
				'ub': `assets/sounds/SFX/ub_${this.GAME_INITIALS}.ogg`,

				// twin1-4
				// 'twin1': `assets/sounds/SFX/twin1_${this.GAME_INITIALS}.ogg`,
				// 'twin2': `assets/sounds/SFX/twin2_${this.GAME_INITIALS}.ogg`,
				// 'twin3': `assets/sounds/SFX/twin3_${this.GAME_INITIALS}.ogg`,
				// 'twin4': `assets/sounds/SFX/twin4_${this.GAME_INITIALS}.ogg`,
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
			symbols: this.getSymbolAssets(),
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