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
				'default_background': `${prefix}/background/BG-Default.png`,
				'reel-frame': `${prefix}/background/reel-frame.png`,
				'rifle': `${prefix}/background/rifle.png`,
			},
			spine: {
				'nuclear': {
					atlas: `${prefix}/win/nuclear.atlas`,
					json: `${prefix}/win/nuclear.json`
				},
				'columns_rifle': {
					atlas: `${prefix}/background/columns_rifle.atlas`,
					json: `${prefix}/background/columns_rifle.json`
				}
			}
		};
	}

	// Network resources notes: ~13MB | Light
	getBonusBackgroundAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		return {
			images: {
				'bonus_background': `${prefix}/bonus_background/BG-Bonus.png`,
				'bonus-reel-frame': `${prefix}/bonus_background/bonus-reel-frame.png`,
				'arch': `${prefix}/bonus_background/arch.png`,
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
				// 'warfreaks-logo': `${prefix}/header/Logo.png`,
				'win-bar': `${prefix}/win_bar/win_bar.png`,
				'multiplier-bar': `${prefix}/header/multiplier_bar.png`,
				// Add more header images here
			},
			spine: {
				'jetfighter': {
					atlas: `${prefix}/header/jetfighter/jetfighter_02.atlas`,
					json: `${prefix}/header/jetfighter/jetfighter_02.json`
				},
				'warfreaks-logo-spine': {
					atlas: `${prefix}/logo/logo_250.atlas`,
					json: `${prefix}/logo/logo_250.json`
				},
				// Add more Spine animations here
			}
		};
	}

	// Network resources notes: ~1MB | Very light
	getBonusHeaderAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				// 'logo-bonus': `${prefix}/bonus_header/logo-bonus.png`,
				'win-bar-bonus': `${prefix}/win_bar/win_bar_bonus.png`,
				'multiplier-bar-bonus': `${prefix}/bonus_header/multiplier_bar_bonus.png`,
			},
			spine: {
				'dove': {
					atlas: `${prefix}/bonus_background/dove/dove.atlas`,
					json: `${prefix}/bonus_background/dove/dove.json`
				},
			}
		};
	}

	// Network resources notes: ~1MB | Very light
	getLoadingAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'loading_background': `${prefix}/loading/loading_background.png`,
				'button_bg': `${prefix}/loading/button_bg.png`,
				'button_spin': `${prefix}/loading/button_spin.png`,
				'loading_frame': `${prefix}/loading/loading-frame.png`,
				'loading_frame_2': `${prefix}/loading/loading-frame-2.png`,
				'dijoker_logo': `${prefix}/loading/DiJoker-logo.png`
			},
			spine: {
				// Studio loading spine (DI JOKER) – only available in portrait/high
				'di_joker': {
					atlas: `assets/portrait/high/dijoker_loading/DI JOKER.atlas`,
					json: `assets/portrait/high/dijoker_loading/DI JOKER.json`
				}
			}
		};
	}

	// Network resources notes: NONE | Not used
	// Add more asset groups as needed
	getSymbolAssets(): AssetGroup {
		const prefix = this.getAssetPrefix(); // This gives us assets/{orientation}/{quality}
		console.log(`[AssetConfig] Loading symbol assets from: ${prefix}/symbols/ and ${prefix}/Symbols_KA/`);
		// Generate symbol assets for all symbols (0-9)
		const symbolImages: { [key: string]: string } = {};
		const symbolSpine: { [key: string]: { atlas: string; json: string } } = {};
		
		for (let i = 0; i <= 9; i++) {
			// PNG sprites for normal display
			const spriteKey = `symbol_${i}`;
			const spritePath = `${prefix}/symbols/symbol_${i}.png`;
			symbolImages[spriteKey] = spritePath;
			
			// Spine animations for hit effects
			const spineKey = `symbol_${i}_spine`;
			const symbolName = `Symbol${i}_KA`;
			const atlasPath = `${prefix}/Symbols_KA/${symbolName}.atlas`;
			const jsonPath = `${prefix}/Symbols_KA/${symbolName}.json`;
			
			symbolSpine[spineKey] = {
				atlas: atlasPath,
				json: jsonPath
			};
			
			//console.log(`[AssetConfig] Symbol ${i}: sprite=${spritePath}, spine=${atlasPath}`);
		}
		
		return {
			images: symbolImages,
			spine: symbolSpine
		};
	}

	// Network resources notes: PNG: ~14.5MB | Very heavy
	// Network resources notes: SPINE: ~87.5MB | Very heavy

	getSymbolSpineAssets(): AssetGroup {
		const prefix = this.getAssetPrefix(); // This gives us assets/{orientation}/{quality}
		console.log(`[AssetConfig] Loading symbol assets from: ${prefix}/symbols/ and ${prefix}/Symbols_KA/`);
		
		// Generate symbol assets for all symbols (0-9)
		const symbolImages: { [key: string]: string } = {};
		const symbolSpine: { [key: string]: { atlas: string; json: string } } = {};
		const symbolCount: number = 10

		for (let i = 0; i < symbolCount; i++) {
			const isScatter = i === 0;
			const isHighPaying = i >= 1 && i <= 5;

			// PNG sprites for normal display
			const spriteKey = `symbol_${i}`;
			const spritePath = `${prefix}/symbols/symbol_${i}.png`;
			symbolImages[spriteKey] = spritePath;

			// Spine animations for hit effects
			const spineKey = `Symbol${i}_WF`;
			const symbolName = isScatter ? 'Symbol_0_WF' : `Symbol_${isHighPaying ? 'HP' : 'LP'}_256`;
			const atlasPath = `${prefix}/symbols/Animations/${symbolName}.atlas`;
			const jsonPath = `${prefix}/symbols/Animations/${symbolName}.json`;

			console.log('[AssetConfig] Loading symbol spine:', spineKey, symbolName, atlasPath, jsonPath);
			
			symbolSpine[spineKey] = {
				atlas: atlasPath,
				json: jsonPath
			};
		}
		
		// Drop multiplier symbol animations for hit effects
		const wholeMultiplierSpineKey = `multiplier_WF`;
		const wholeMultiplierSymbolName = 'multiplier_WF';
		const wholeMultiplierAtlasPath = `${prefix}/symbols/multipliers/${wholeMultiplierSymbolName}.atlas`;
		const wholeMultiplierJsonPath = `${prefix}/symbols/multipliers/${wholeMultiplierSymbolName}.json`;

		symbolSpine[wholeMultiplierSpineKey] = {
			atlas: wholeMultiplierAtlasPath,
			json: wholeMultiplierJsonPath
		};


		// Spine animations for hit effects
		const frameSpineKey = `multiplier_frame`;
		const frameSymbolName = 'multiplier_WF_frame';
		const frameAtlasPath = `${prefix}/symbols/multipliers/${frameSymbolName}.atlas`;
		const frameJsonPath = `${prefix}/symbols/multipliers/${frameSymbolName}.json`;

		symbolSpine[frameSpineKey] = {
			atlas: frameAtlasPath,
			json: frameJsonPath
		};

		// Spine animations for hit effects
		const doveSpineKey = `multiplier_dove`;
		const doveSymbolName = 'multiplier_WF_dove';
		const doveAtlasPath = `${prefix}/symbols/multipliers/${doveSymbolName}.atlas`;
		const doveJsonPath = `${prefix}/symbols/multipliers/${doveSymbolName}.json`;

		symbolSpine[doveSpineKey] = {
			atlas: doveAtlasPath,
			json: doveJsonPath
		};

		for(let i = 0; i < 15; i++) {
			const spriteKey = `multiplier_${i}`;
			const spritePath = `${prefix}/symbols/multipliers/multiplier_${i}.png`;
			symbolImages[spriteKey] = spritePath;
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
			images: {
				'spin_01': `${prefix}/spinner/spin_01.png`,
				'spin_02': `${prefix}/spinner/spin_02.png`,
				'spin_03': `${prefix}/spinner/spin_03.png`,
				'spin_04': `${prefix}/spinner/spin_04.png`,
			}
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
				'howToPlay11Mobile': `${prefix}/help_screen/HowToPlay11Mobile.png`,
				'howToPlay12Mobile': `${prefix}/help_screen/HowToPlay12Mobile.png`,
				// Feature help
				'BuyFeatHelp': `${prefix}/help_screen/BuyFeatHelp.png`,
				'BuyFeatMobile': `${prefix}/help_screen/BuyFeatMobile.png`,
				'DoubleHelp': `${prefix}/help_screen/DoubleHelp.png`,
				'DoubleHelpMobile': `${prefix}/help_screen/DoubleHelpMobile.png`,
				// Payline visuals
				'paylineMobileWin': `${prefix}/help_screen/paylineMobileWin.png`,
				'paylineMobileNoWin': `${prefix}/help_screen/paylineMobileNoWin.png`,
				// Scatter / Tumble / Multiplier visuals
				'scatterGame': `${prefix}/help_screen/scatterGame.png`,
				'scatterIcon': `${prefix}/help_screen/scatterIcon.png`,
				'scatterWin': `${prefix}/help_screen/scatterWin.png`,
				'ScatterLabel': `${prefix}/help_screen/ScatterSymbol.png`,
				'tumbleIcon': `${prefix}/help_screen/tumbleIcon.png`,
				'tumbleWin': `${prefix}/help_screen/tumbleWin.png`,
				'multiplierGame': `${prefix}/help_screen/multiplierGame.png`,
				'multiplierIcon': `${prefix}/help_screen/multiplierIcon.png`,
				// Winlines thumbnails (static, not dependent on screen prefix)
				// Keys: winlines1 .. winlines20
				...(() => {
					const map: { [key: string]: string } = {};
					for (let i = 1; i <= 20; i++) {
						map[`winlines${i}`] = `assets/winlines/winline${i}.png`;
					}
					return map;
				})()
			}
		};
	}

	// Network resources notes: ~11MB | Light
	getDialogAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading dialog assets with prefix: ${prefix}`);
		
		return {
			images: {
				'total_win_background': `${prefix}/dialogs/total_win_background.png`,
				'total_win_foreground': `${prefix}/dialogs/total_win_foreground.png`,
				'max_win_background': `${prefix}/dialogs/max_win_background.png`
			},
			spine: {
				'win_dialog': {
					atlas: `${prefix}/dialogs/win_dialog.atlas`,
					json: `${prefix}/dialogs/win_dialog.json`
				},
				'free_spin': {
					atlas: `${prefix}/dialogs/free_spin.atlas`,
					json: `${prefix}/dialogs/free_spin.json`
				},
				'max_win': {
					atlas: `${prefix}/dialogs/max_win.atlas`,
					json: `${prefix}/dialogs/max_win.json`
				},
				'total_win': {
					atlas: `${prefix}/dialogs/total_win.atlas`,
					json: `${prefix}/dialogs/total_win.json`
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
				'reelanim_KA': {
					atlas: `assets/portrait/high/scatterAnticipation/reelanim_KA.atlas`,
					json: `assets/portrait/high/scatterAnticipation/reelanim_KA.json`
				}
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
			const path = `${prefix}/numbers/0${i}_WF_G.png`;
			numberImages[key] = path;
			console.log(`[AssetConfig] Number ${key}: ${path}`);
		}
		
		// Add comma and dot
		numberImages['number_comma'] = `${prefix}/numbers/comma_WF_G.png`;
		numberImages['number_dot'] = `${prefix}/numbers/point_WF_G.png`;
		numberImages['number_x'] = `${prefix}/numbers/x_WF_G.png`;
		
		console.log(`[AssetConfig] Number comma: ${prefix}/numbers/comma_KA.png`);
		console.log(`[AssetConfig] Number dot: ${prefix}/numbers/dot_KA.png`);

		return {
			images: numberImages
		};
	}

	// Network resources notes: NONE | Not used
	getCoinAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading coin assets with prefix: ${prefix}`);

		return {};

		// Not being used
		return {
			images: {
				'coin': `${prefix}/coin/coin.png`
			}
		};
	}

	getSymbolEffectsAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();

		return {
			spine: {
				'spark_vfx': {
					atlas: `${prefix}/symbols/Spark_VFX/Spark_VFX.atlas`,
					json: `${prefix}/symbols/Spark_VFX/Spark_VFX.json`
				}
			}
		};
	}

	// Network resources notes: ~8MB | Light
	getBuyFeatureAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading buy feature assets with prefix: ${prefix}`);
		
		return {
			images: {
				'buy_feature_logo': `${prefix}/buy_feature/buy_feature_logo.png`,
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

				// Menu/UI clicks
				'click_wf': 'assets/sounds/click_wf.ogg',
				'mainbg_wf': 'assets/sounds/BG/mainbg_wf.ogg',
				'bonusbg_wf': 'assets/sounds/BG/bonusbg_wf.ogg',
				
				'turbodrop_wf': 'assets/sounds/SFX/turbodrop_wf.ogg',
				'reeldrop_wf': 'assets/sounds/SFX/reeldrop_wf.ogg',

				// Unused SFX
				'argun_wf': 'assets/sounds/SFX/argun_wf.ogg',
				'explosion_wf': 'assets/sounds/SFX/explosion_wf.ogg',
				'hit_win_2_wf': 'assets/sounds/SFX/hit_win_2_wf.ogg',
				'hit_win_wf': 'assets/sounds/SFX/hit_win_wf.ogg',
				'missile_wf': 'assets/sounds/SFX/missile_wf.ogg',
				'multi_wf': 'assets/sounds/SFX/multi_wf.ogg',
				'nuke_wf': 'assets/sounds/SFX/nuke_wf.ogg',
				'reeldrop2_wf': 'assets/sounds/SFX/reeldrop2_wf.ogg',
				'spin_wf': 'assets/sounds/SFX/spin_wf.ogg',
				'spin2_wf': 'assets/sounds/SFX/spin2_wf.ogg',
				'turbo2_wf': 'assets/sounds/SFX/turbo2_wf.ogg',
				'ub_win_wf': 'assets/sounds/SFX/ub_win_wf.ogg',
				
				// Unused Wins
				'maxw_end_wf': 'assets/sounds/Wins/maxw_end_wf.ogg',
				'maxw_wf': 'assets/sounds/Wins/maxw_wf.ogg',
				'twin1_wf': 'assets/sounds/Wins/twin1_wf.ogg',
				'twin2_wf': 'assets/sounds/Wins/twin2_wf.ogg',
				'twin3_wf': 'assets/sounds/Wins/twin3_wf.ogg',
				'twin4_wf': 'assets/sounds/Wins/twin4_wf.ogg',
				'twinheaven1_wf': 'assets/sounds/Wins/twinheaven1_wf.ogg',
				'twinheaven2_wf': 'assets/sounds/Wins/twinheaven2_wf.ogg',
				'twinheaven3_wf': 'assets/sounds/Wins/twinheaven3_wf.ogg',
				'twinheaven4_wf': 'assets/sounds/Wins/twinheaven4_wf.ogg',

				// 'freespinbg_ka': 'assets/sounds/Wins/freespin_wf.ogg',
				// 'ambience_ka': 'assets/sounds/SFX/ambience_wf.ogg',
				// 'spinb_ka': 'assets/sounds/SFX/spinb_wf.ogg',
				// // Hit win SFX
				// 'hitwin_ka': 'assets/sounds/SFX/hitwin_wf.ogg',
				// // Wild multi SFX
				// 'wildmulti_ka': 'assets/sounds/SFX/wildmulti_wf.ogg',
				// 'scatter_ka': 'assets/sounds/SFX/scatter_ka.ogg',
				// 'anticipation_ka': 'assets/sounds/SFX/anticipation_ka.ogg',
				// // Winline SFX
				// 'winline_1_ka': 'assets/sounds/SFX/winline_1_wf.ogg',
				// 'winline_2_ka': 'assets/sounds/SFX/winline_2_wf.ogg',

				// // Win dialog SFX
				// 'bigwskip_ka': 'assets/sounds/Wins/bigwskip_wf.ogg',
				// 'megawskip_ka': 'assets/sounds/Wins/megawskip_wf.ogg',
				// 'superwskip_ka': 'assets/sounds/Wins/superwskip_wf.ogg',
				// 'epicwskip_ka': 'assets/sounds/Wins/epicwskip_wf.ogg',

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
			symbols: this.getSymbolSpineAssets(),
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