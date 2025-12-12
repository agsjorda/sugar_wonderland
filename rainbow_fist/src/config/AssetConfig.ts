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

	// Network resources notes: ~38MB | Medium
	getBackgroundAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		return {
			images: {
				'default_background': `${prefix}/background/default_background.png`,
				'reel_frame': `${prefix}/background/reel_frame.png`,
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
				'bonus_reel_frame': `${prefix}/background/reel_frame.png`,
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
				'win-bar': `${prefix}/header/win_bar.png`,
				'multiplier-bar': `${prefix}/header/multiplier_bar.png`,
				'logo': `${prefix}/header/logo.png`,
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
				'win-bar-bonus': `${prefix}/header/win_bar.png`,
				'multiplier-bar-bonus': `${prefix}/header/multiplier_bar.png`,
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
				'loading_background': `${prefix}/loading/loading_background.png`,
				'loading_character': `${prefix}/loading/loading_character.png`,
				'loading_footer': `${prefix}/loading/loading_footer.png`,
				'loading_header': `${prefix}/loading/loading_header.png`,
				'loading_footer_feather': `${prefix}/loading/loading_footer_feather.png`,

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
				'logo_spine': {
					atlas: `${prefix}/logo/logo_250.atlas`,
					json: `${prefix}/logo/logo_250.json`
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
				const symbolName = `Symbol${i}_RF`;
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
				// HowToPlay images
				'howToPlay1': `${prefix}/help_screen/HowToPlay1.webp	`,
				'howToPlay1Mobile': `${prefix}/help_screen/HowToPlay1Mobile.webp`,
				'howToPlay2': `${prefix}/help_screen/HowToPlay2.webp`,
				'howToPlay2Mobile': `${prefix}/help_screen/HowToPlay2Mobile.webp`,
				'howToPlay3': `${prefix}/help_screen/HowToPlay3.webp`,
				'howToPlay3Mobile': `${prefix}/help_screen/HowToPlay3Mobile.webp`,
				'howToPlay4': `${prefix}/help_screen/HowToPlay4.webp`,
				'howToPlay4Mobile': `${prefix}/help_screen/HowToPlay4Mobile.webp`,
				'howToPlay5': `${prefix}/help_screen/HowToPlay5.webp`,
				'howToPlay6': `${prefix}/help_screen/HowToPlay6.webp`,
				'howToPlay7': `${prefix}/help_screen/HowToPlay7.webp`,
				'howToPlay8': `${prefix}/help_screen/HowToPlay8.webp`,
				'howToPlay8Mobile': `${prefix}/help_screen/HowToPlay8Mobile.webp`,
				'howToPlay9': `${prefix}/help_screen/HowToPlay9.webp`,
				'howToPlay9Mobile': `${prefix}/help_screen/HowToPlay9Mobile.webp`,
				'howToPlay10': `${prefix}/help_screen/HowToPlay10.webp`,
				'howToPlay10Mobile': `${prefix}/help_screen/HowToPlay10Mobile.webp`,
				'howToPlay11Mobile': `${prefix}/help_screen/HowToPlay11Mobile.webp`,
				'howToPlay12Mobile': `${prefix}/help_screen/HowToPlay12Mobile.webp`,
				// Feature help
				'BuyFeatHelp': `${prefix}/help_screen/BuyFeatHelp.webp`,
				'BuyFeatMobile': `${prefix}/help_screen/BuyFeatMobile.webp`,
				'DoubleHelp': `${prefix}/help_screen/DoubleHelp.webp`,
				'DoubleHelpMobile': `${prefix}/help_screen/DoubleHelpMobile.webp`,
				// Payline visuals
				'paylineMobileWin': `${prefix}/help_screen/paylineMobileWin.webp`,
				'paylineMobileNoWin': `${prefix}/help_screen/paylineMobileNoWin.webp`,
				// Scatter / Tumble / Multiplier visuals
				'scatterGame': `${prefix}/help_screen/scatterGame.webp`,
				'scatterIcon': `${prefix}/help_screen/scatterIcon.webp`,
				'scatterWin': `${prefix}/help_screen/scatterWin.webp`,
				'ScatterLabel': `${prefix}/help_screen/ScatterSymbol.webp`,
				'tumbleIcon': `${prefix}/help_screen/tumbleIcon.webp`,
				'tumbleWin': `${prefix}/help_screen/tumbleWin.webp`,
				'multiplierGame': `${prefix}/help_screen/multiplierGame.webp`,
				'multiplierIcon': `${prefix}/help_screen/multiplierIcon.webp`,
			}
		};
	}

	// Network resources notes: ~11MB | Light
	getDialogAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading dialog assets with prefix: ${prefix}`);
		
		return {
			images: {
				// 'total_win_background': `${prefix}/dialogs/total_win_background.webp`,
				// 'total_win_foreground': `${prefix}/dialogs/total_win_foreground.webp`,
				// 'max_win_background': `${prefix}/dialogs/max_win_background.webp`
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
				// 'total_win': {
				// 	atlas: `${prefix}/dialogs/TotalWin_RF/TotalWin_RF.atlas`,
				// 	json: `${prefix}/dialogs/TotalWin_RF/TotalWin_RF.json`
				// },
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
		// numberImages['number_x'] = `${prefix}/numbers/number_x.webp`;
		
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
			}
		};
	}

	// Network resources notes: ~8MB | Light
	getBuyFeatureAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading buy feature assets with prefix: ${prefix}`);
		
		return {
			images: {
				'buy_feature_logo': `${prefix}/symbols/symbol0.webp`,
				'buy_feature_logo_bg': `${prefix}/buy_feature/buy_feature_logo_bg.png`,
				'buy_feature_bg': `${prefix}/buy_feature/buy_feature_bg.png`
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
				'freespin_wf': 'assets/sounds/Wins/freespin_wf.ogg',
				'congrats_wf': 'assets/sounds/Wins/congrats_wf.ogg',
				'bigw_wf': 'assets/sounds/Wins/bigw_wf.ogg',
				'megaw_wf': 'assets/sounds/Wins/megaw_wf.ogg',
				'superw_wf': 'assets/sounds/Wins/superw_wf.ogg',
				'epicw_wf': 'assets/sounds/Wins/epicw_wf.ogg',

				// Tumble win SFX
				'twin1_wf': 'assets/sounds/Wins/twin1_wf.ogg',
				'twin2_wf': 'assets/sounds/Wins/twin2_wf.ogg',
				'twin3_wf': 'assets/sounds/Wins/twin3_wf.ogg',
				'twin4_wf': 'assets/sounds/Wins/twin4_wf.ogg',
				'twinheaven1_wf': 'assets/sounds/Wins/twinheaven1_wf.ogg',
				'twinheaven2_wf': 'assets/sounds/Wins/twinheaven2_wf.ogg',
				'twinheaven3_wf': 'assets/sounds/Wins/twinheaven3_wf.ogg',
				'twinheaven4_wf': 'assets/sounds/Wins/twinheaven4_wf.ogg',

				// Background SFX
				'mainbg_wf': 'assets/sounds/BG/mainbg_wf.ogg',
				'bonusbg_wf': 'assets/sounds/BG/bonusbg_wf.ogg',
				'argun_wf': 'assets/sounds/SFX/argun_wf.ogg',

				// Menu/UI clicks
				'click_wf': 'assets/sounds/click_wf.ogg',
				
				'turbodrop_wf': 'assets/sounds/SFX/turbodrop_wf.ogg',
				'reeldrop_wf': 'assets/sounds/SFX/reeldrop_wf.ogg',

				// WIP
				
				'bonus_explosion_wf': 'assets/sounds/SFX/explosion_heaven_wf.ogg',
				'multiplier_added_wf': 'assets/sounds/SFX/birdland_wf.ogg',
				'explosion_wf': 'assets/sounds/SFX/explosion_wf.ogg',
				'missile_wf': 'assets/sounds/SFX/missile_wf.ogg',
				'multi_wf': 'assets/sounds/SFX/multi_wf.ogg',
				'nuke_wf': 'assets/sounds/SFX/nuke_wf.ogg',

				// Unused SFX
				'hit_win_2_wf': 'assets/sounds/SFX/hit_win_2_wf.ogg',
				'hit_win_wf': 'assets/sounds/SFX/hit_win_wf.ogg',
				'reeldrop2_wf': 'assets/sounds/SFX/reeldrop2_wf.ogg',
				'turbo2_wf': 'assets/sounds/SFX/turbo2_wf.ogg',
				'spin_wf': 'assets/sounds/SFX/spin_wf.ogg',
				'spin2_wf': 'assets/sounds/SFX/spin2_wf.ogg',
				'ub_wf': 'assets/sounds/SFX/ub_wf.ogg',
				
				// Unused Wins
				'maxw_end_wf': 'assets/sounds/Wins/maxw_end_wf.ogg',
				'maxw_wf': 'assets/sounds/Wins/maxw_wf.ogg',
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