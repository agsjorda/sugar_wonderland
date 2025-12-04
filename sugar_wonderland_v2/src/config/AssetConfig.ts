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
		
		return {
			images: {
				'BG-Default': `${prefix}/background/BG-Default.png`,
				'normal-bg-cover': `assets/portrait/high/background/normal_bg_cover.png`,
				'candy-overlay': `assets/portrait/high/background/candy-overlay.png`,
				'cloud-upper': `assets/portrait/high/background/cloud_upper.png`,
				'cloud-middle': `assets/portrait/high/background/cloud_middle.png`,
				'cloud-lower': `assets/portrait/high/background/cloud_lower.png`,
				'shine': `assets/portrait/high/background/shine.png`,
				// Mostly for landscape bg
				// 'balloon-01': `${prefix}/background/balloon-01.png`,
				// 'balloon-02': `${prefix}/background/balloon-02.png`,
				// 'balloon-03': `${prefix}/background/balloon-03.png`,
				// 'balloon-04': `${prefix}/background/balloon-04.png`,
				// 'reel-xmaslight-default': `${prefix}/background/reel-xmaslight-default.png`,
				// 'bulb-01': `${prefix}/background/bulb-01.png`,
				// 'bulb-02': `${prefix}/background/bulb-02.png`,
				// 'bulb-03': `${prefix}/background/bulb-03.png`,
			}
		};
	}

	getBonusBackgroundAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'bonus_background': `${prefix}/bonus_background/BG-Bonus.png`,
				'bonus-bg-cover': `assets/portrait/high/bonus_background/bonus-bg-cover.png`,
				'cloud-upper-bonus': `assets/portrait/high/bonus_background/cloud_upper_bonus.png`,
				'cloud-middle-bonus': `assets/portrait/high/bonus_background/cloud_middle_bonus.png`
			}
		};
	}

	getHeaderAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'header-logo': `${prefix}/header/header_logo.png`,
				// Add more header images here
			},
			spine: {
				// Removed cat and win-bar assets from header
				// Add more Spine animations here
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

	/**
	 * Candy transition assets – currently only available in portrait/high.
	 * We intentionally avoid getAssetPrefix() to ensure correct pathing.
	 */
	getCandyTransitionAssets(): AssetGroup {
		console.log('[AssetConfig] Loading Candy Transition assets');
		return {
			spine: {
				'transition_SW': {
					atlas: `assets/portrait/high/candy_transition/transition_SW.atlas`,
					json: `assets/portrait/high/candy_transition/transition_SW.json`
				}
			}
		};
	}

	getLoadingAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'loading_background': `${prefix}/loading/image.png`,
				'button_bg': `${prefix}/loading/button_bg.png`,
				'button_spin': `${prefix}/loading/button_spin.png`,
				'logo_loading': `${prefix}/loading/logo-loading.png`,
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

	// Add more asset groups as needed
	getSymbolAssets(): AssetGroup {
		const prefix = this.getAssetPrefix(); // This gives us assets/{orientation}/{quality}
		console.log(`[AssetConfig] Loading symbol assets from: ${prefix}/symbols/ and ${prefix}/Symbols_KA/`);
		
		// Generate symbol assets for all symbols (0-21)
		const symbolImages: { [key: string]: string } = {};
		const symbolSpine: { [key: string]: { atlas: string; json: string } } = {};
		
		for (let i = 0; i <= 22; i++) {
			// PNG sprites for normal display
			const spriteKey = `symbol_${i}`;
			let spritePath: string;
			// Special PNG overrides
			if (i === 0) {
				spritePath = `assets/symbols/high/sugar_symbols/Symbol0.png`;
			} else if (i >= 10 && i <= 16) {
				// 10–16 map to Symbols11 visual
				spritePath = `assets/symbols/high/sugar_symbols/Symbol11.png`;
			} else if (i >= 17 && i <= 20) {
				// 17–20 map to Symbols10 visual
				spritePath = `assets/symbols/high/sugar_symbols/Symbol10.png`;
			} else if (i >= 21 && i <= 22) {
				// 21–22 map to Symbols12 visual
				spritePath = `assets/symbols/high/sugar_symbols/Symbol12.png`;
			} else {
				spritePath = `assets/symbols/${this.networkManager.getNetworkSpeed() ? 'high' : 'low'}/Symbol${i}_KA.png`;
			}
			symbolImages[spriteKey] = spritePath;
			
			// Spine animations for hit effects only for 1-14 (others intentionally PNG-only)
			if (i >= 1 && i <= 14) {
				const spineKey = `symbol_${i}_spine`;
				const symbolName = `Symbol${i}_KA`;
				const atlasPath = `${prefix}/Symbols_KA/${symbolName}.atlas`;
				const jsonPath = `${prefix}/Symbols_KA/${symbolName}.json`;
				
				symbolSpine[spineKey] = {
					atlas: atlasPath,
					json: jsonPath
				};
				
				console.log(`[AssetConfig] Symbol ${i}: sprite=${spritePath}, spine=${atlasPath}`);
			} else {
				console.log(`[AssetConfig] Symbol ${i}: sprite=${spritePath} (PNG-only)`);
			}
		}

		// Sugar symbol Spine animations (idle) for Symbol0–Symbol9
		// These are provided in a fixed path under assets/symbols/high/sugar_symbols
		for (let i = 0; i <= 9; i++) {
			const sugarKey = `symbol_${i}_sugar_spine`;
			const sugarAtlas = `assets/symbols/high/sugar_symbols/Symbol${i}.atlas`;
			const sugarJson = `assets/symbols/high/sugar_symbols/Symbol${i}.json`;
			symbolSpine[sugarKey] = { atlas: sugarAtlas, json: sugarJson };
			console.log(`[AssetConfig] Sugar Symbol ${i}: spine=${sugarAtlas}`);
		}
		
		// Multiplier symbols (10–22) share a single Spine: SymbolBombs_SW
		// Animations inside:
		// - Symbols10_SW_Idle / Symbols10_SW_Win
		// - Symbols11_SW_Idle / Symbols11_SW_Win
		// - Symbols12_SW_Idle / Symbols12_SW_Win
		// Note: no Drop animation for these
		const multiKey = 'symbol_bombs_sw';
		const multiAtlas = `assets/symbols/high/sugar_symbols/SymbolBombs_SW.atlas`;
		const multiJson = `assets/symbols/high/sugar_symbols/SymbolBombs_SW.json`;
		symbolSpine[multiKey] = { atlas: multiAtlas, json: multiJson };
		console.log(`[AssetConfig] Multiplier Symbols (10–22): spine=${multiAtlas}`);
		
		// Multiplier overlays (PNG numbers shown in front of the multiplier symbol)
		// Mapping per request:
		// 10->2, 11->3, 12->4, 13->5, 14->6, 15->8, 16->10,
		// 17->12, 18->15, 19->20, 20->25, 21->50, 22->100
		const overlayMap: { [value: number]: string } = {
			10: '2',
			11: '3',
			12: '4',
			13: '5',
			14: '6',
			15: '8',
			16: '10',
			17: '12',
			18: '15',
			19: '20',
			20: '25',
			21: '50',
			22: '100'
		};
		Object.entries(overlayMap).forEach(([valueStr, label]) => {
			const value = Number(valueStr);
			const key = `multiplier_overlay_${value}`;
			const path = `assets/symbols/high/sugar_symbols/multiplier_symbols/${label}.png`;
			symbolImages[key] = path;
			console.log(`[AssetConfig] Multiplier overlay ${value}: ${path}`);
		});
		
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
				// Free round button background (currently only available as portrait/high asset)
				// We reference it directly so it can be used in all modes without additional variants.
				'freeround_bg': `assets/controller/portrait/high/freeround_bg.png`,
				// "Spin Now" button for free round reward panel (portrait/high only asset)
				'spin_now_button': `assets/controller/portrait/high/spin_now_button.png`,
			},
			spine: {
				'spin_button_animation': {
					atlas: `assets/controller/${screenMode}/${quality}/spin_button_anim/spin_button_anim.atlas`,
					json: `assets/controller/${screenMode}/${quality}/spin_button_anim/spin_button_anim.json`
				},
				// Free-round specific spin button animation (portrait/high only asset)
				// Used instead of the normal spin_button_animation while in initialization
				// free-round spins mode.
				'fr_spin_button_animation': {
					atlas: `assets/controller/portrait/high/Button_Bonus_Buttom/Button_Bonus_VFX.atlas`,
					json: `assets/controller/portrait/high/Button_Bonus_Buttom/Button_Bonus_VFX.json`
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
		return {
			images: {
				'helpscreen_0': `${prefix}/help_screen/helpscreen_0.webp`,
				'helpscreen_1': `${prefix}/help_screen/helpscreen_1.webp`,
				'helpscreen_2': `${prefix}/help_screen/helpscreen_2.webp`,
				'helpscreen_3': `${prefix}/help_screen/helpscreen_3.webp`,

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
				// Scatter / Tumble / Multiplier visuals
				'scatterGame': `${prefix}/help_screen/scatterGame.png`,
				'scatterIcon': `${prefix}/help_screen/scatterIcon.png`,
				'scatterWin': `${prefix}/help_screen/scatterWin.png`,
				'ScatterLabel': `${prefix}/help_screen/ScatterSymbol.png`,
				'wheelSpin_helper': `assets/portrait/high/help_screen/wheelSpin_helper.png`,
				'freeSpin_round': `assets/portrait/high/help_screen/freeSpin_round.png`,
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

	getDialogAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading dialog assets with prefix: ${prefix}`);
		
		return {
			spine: {
				'Congrats_KA': {
					atlas: `${prefix}/dialogs/Congrats_KA.atlas`,
					json: `${prefix}/dialogs/Congrats_KA.json`
				},
				'SmallW_KA': {
					atlas: `${prefix}/dialogs/SmallW_KA.atlas`,
					json: `${prefix}/dialogs/SmallW_KA.json`
				},
				'MediumW_KA': {
					atlas: `${prefix}/dialogs/MediumW_KA.atlas`,
					json: `${prefix}/dialogs/MediumW_KA.json`
				},
				'LargeW_KA': {
					atlas: `${prefix}/dialogs/largeW_KA.atlas`,
					json: `${prefix}/dialogs/largeW_KA.json`
				},
				'SuperW_KA': {
					atlas: `${prefix}/dialogs/SuperW_KA.atlas`,
					json: `${prefix}/dialogs/SuperW_KA.json`
				},
				'FreeSpinDialog_KA': {
					atlas: `${prefix}/dialogs/FreeSpinDialog_KA.atlas`,
					json: `${prefix}/dialogs/FreeSpinDialog_KA.json`
				},
				'Win': {
					atlas: `${prefix}/win_dialog/Win.atlas`,
					json: `${prefix}/win_dialog/Win.json`
				}
			}
		};
	}

	/**
	 * Scatter Anticipation assets – only available in portrait/high for now.
	 * We intentionally do not use getAssetPrefix() to avoid missing assets on low quality.
	 */
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

	getNumberAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading number assets with prefix: ${prefix}`);
		
		// Generate number assets for digits 0-9, plus comma and dot
		const numberImages: { [key: string]: string } = {};
		
		// Add digit images (0-9)
		for (let i = 0; i <= 9; i++) {
			const key = `number_${i}`;
			const path = `${prefix}/numbers/Number${i}.png`;
			numberImages[key] = path;
			console.log(`[AssetConfig] Number ${key}: ${path}`);
		}
		
		// Add comma and dot
		numberImages['number_comma'] = `${prefix}/numbers/comma.png`;
		numberImages['number_dot'] = `${prefix}/numbers/dot.png`;
		
		console.log(`[AssetConfig] Number comma: ${prefix}/numbers/comma.png`);
		console.log(`[AssetConfig] Number dot: ${prefix}/numbers/dot.png`);
		
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
		
		console.log(`[AssetConfig] Loading buy feature assets with prefix: ${prefix}`);
		
		return {
			images: {
				'buy_feature_logo': `${prefix}/buy_feature/buy_feature_logo.png`,
				'buy_feature_bg': `${prefix}/buy_feature/buy_feature_bg.png`
			}
		};
	}

	getAudioAssets(): AssetGroup {
		console.log(`[AssetConfig] Loading audio assets`);
		
		return {
			audio: {
				// Menu/UI clicks
				'click_sw': 'assets/sounds/click_sw.ogg',
				'mainbg_ka': 'assets/sounds/BG/mainbg_sw.ogg',
				'bonusbg_ka': 'assets/sounds/BG/bonusbg_sw.ogg',
				'freespinbg_ka': 'assets/sounds/BG/freespinbg_sw.ogg',
				'ambience_ka': 'assets/sounds/SFX/ambience_ka.ogg',
				'spinb_ka': 'assets/sounds/SFX/spin_sw.ogg',
				'reeldrop_ka': 'assets/sounds/SFX/reeldrop_sw.ogg',
				'turbodrop_ka': 'assets/sounds/SFX/turbodrop_sw.ogg',
				// Candy explosion transition SFX (used by SymbolExplosionTransition)
				'candy_transition_sw': 'assets/sounds/SFX/candy_transition.ogg',
				// Scatter win "nom nom" SFX – played when scatter win animation runs
				'nomnom_sw': 'assets/sounds/SFX/nomnom_sw.ogg',
				'wheelspin_ka': 'assets/sounds/SFX/wheelspin_ka.ogg',
				'coin_throw_ka': 'assets/sounds/SFX/coin_throw_ka.ogg',
				'coin_drop_ka': 'assets/sounds/SFX/coin_drop_ka.ogg',
				// Hit win SFX
				'hitwin_ka': 'assets/sounds/SFX/hitwin_ka.ogg',
				// Wild multi SFX
				'wildmulti_ka': 'assets/sounds/SFX/wildmulti_ka.ogg',
				// Multiplier trigger / bomb SFX (bonus-mode multipliers)
				'bomb_sw': 'assets/sounds/SFX/bomb_sw.ogg',
				'scatter_sw': 'assets/sounds/SFX/scatter_sw.ogg',
				'anticipation_ka': 'assets/sounds/SFX/anticipation_ka.ogg',
				// Winline SFX
				'winline_1_ka': 'assets/sounds/SFX/winline_1_ka.ogg',
				'winline_2_ka': 'assets/sounds/SFX/winline_2_ka.ogg',
				// Tumble symbol-win SFX (play per tumble index)
				'twin1_sw': 'assets/sounds/SFX/symbol_win/twin1_sw.ogg',
				'twin2_sw': 'assets/sounds/SFX/symbol_win/twin2_sw.ogg',
				'twin3_sw': 'assets/sounds/SFX/symbol_win/twin3_sw.ogg',
				'twin4_sw': 'assets/sounds/SFX/symbol_win/twin4_sw.ogg',
				// Win dialog SFX
				'bigw_ka': 'assets/sounds/Wins/bigw_sw.ogg',
				'megaw_ka': 'assets/sounds/Wins/megaw_sw.ogg',
				'superw_ka': 'assets/sounds/Wins/superw_sw.ogg',
				'epicw_ka': 'assets/sounds/Wins/epicw_sw.ogg',
				'freespin_ka': 'assets/sounds/Wins/freespin_ka.ogg',
				'congrats_ka': 'assets/sounds/Wins/congrats_sw.ogg',

				// Win dialog SFX
				'bigwskip_ka': 'assets/sounds/Wins/bigwskip_ka.ogg',
				'megawskip_ka': 'assets/sounds/Wins/megawskip_ka.ogg',
				'superwskip_ka': 'assets/sounds/Wins/superwskip_ka.ogg',
				'epicwskip_ka': 'assets/sounds/Wins/epicwskip_ka.ogg'
			}
		};
	}

	// Helper method to get all assets for a scene
	getAllAssets(): { [key: string]: AssetGroup } {
		return {
			background: this.getBackgroundAssets(),
			header: this.getHeaderAssets(),
			bonusHeader: this.getBonusHeaderAssets(),
			candyTransition: this.getCandyTransitionAssets(),
			loading: this.getLoadingAssets(),
			symbols: this.getSymbolAssets(),
			buttons: this.getButtonAssets(),
			fonts: this.getFontAssets(),
			dialogs: this.getDialogAssets(),
			numbers: this.getNumberAssets(),
			coin: this.getCoinAssets(),
			buyFeature: this.getBuyFeatureAssets(),
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