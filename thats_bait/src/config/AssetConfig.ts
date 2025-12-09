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
				'bubble': `${forcedPortraitHighPrefix}/background/bubble.webp`,
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
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'BG-Bonus': `${prefix}/bonus_background/BG-Bonus.png`
			},
			// Bonus dragon & fireworks spine assets were removed for this game
			spine: {}
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
		console.log(`[AssetConfig] Loading symbol assets (Spine + WEBP-only symbols) from assets/portrait/high/spine_symbols`);
		
		// Generate Spine symbol assets for all symbols (0-14)
		const symbolImages: { [key: string]: string } = {};
		const symbolSpine: { [key: string]: { atlas: string; json: string } } = {};
		
		// Symbols that have TB Spine atlases/json in public/assets/portrait/high/spine_symbols
		// All symbols 0-14 are now backed by TB Spine assets.
		const tbSpineSymbols = new Set<number>([0, 1, 2, 3, 4, 5, 6, 11, 12, 13, 14]);
		const webpOnlySymbols = new Set<number>([7, 8, 9, 10]);
		
		const spinePrefix = `assets/portrait/high`;
		const symbolImagePrefix = `${spinePrefix}/symbols`;
		
		for (let i = 0; i <= 14; i++) {
			const symbolNameTB = `Symbol${i}_TB`;
			const imageKey = `symbol_${i}`;
			const imagePath = `${symbolImagePrefix}/${symbolNameTB}.webp`;
			symbolImages[imageKey] = imagePath;
			if (tbSpineSymbols.has(i)) {
				const spineKey = `symbol_${i}_spine`;
				const atlasPath = `${spinePrefix}/spine_symbols/${symbolNameTB}.atlas`;
				const jsonPath = `${spinePrefix}/spine_symbols/${symbolNameTB}.json`;
				
				symbolSpine[spineKey] = {
					atlas: atlasPath,
					json: jsonPath
				};
				
				console.log(`[AssetConfig] Symbol ${i}: spine=${atlasPath}, image=${imagePath}`);
			} else if (webpOnlySymbols.has(i)) {
				console.log(`[AssetConfig] Symbol ${i}: image=${imagePath} (WEBP only, no Spine JSON)`);
			} else {
				console.log(`[AssetConfig] Symbol ${i}: image=${imagePath} (no TB Spine asset)`);
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
		
		console.log(`[AssetConfig] Loading dialog assets with prefix: ${prefix}`);
		
		return {
			images: {
				'congrats-bg': `${prefix}/dialogs/congrats-bg.png`,
				'congratulations-you-won': `${prefix}/dialogs/congratulations-you-won.png`
			},
			// Dialog Spine characters and fire animations were removed for this game
			spine: {}
		};
	}

	/** Free spin card assets (Spine) used by ScatterWinOverlay cards */
	getFreeSpinCardAssets(): AssetGroup {
		console.log('[AssetConfig] Loading free spin card (spine) assets');
		return {
			images: {
				// Temporary placeholder mappings while dedicated free-spin assets are removed.
				// All three keys point to the root coin.png so the feature keeps working without 404s.
				'free_spin_card': `assets/coin.png`,
				'free_spin_card_front': `assets/coin.png`,
				'free_spin_text': `assets/coin.png`
			}
		};
	}

	/**
	 * Scatter Anticipation assets – only available in portrait/high for now.
	 * We intentionally do not use getAssetPrefix() to avoid missing assets on low quality.
	 */
	getScatterAnticipationAssets(): AssetGroup {
		// Force portrait/high paths to ensure presence (these packs may be absent in low quality builds)
		const forcedPortraitHighPrefix = `assets/portrait/high`;
		console.log('[AssetConfig] Loading Scatter Anticipation assets (forced portrait/high)');
		// Reel background visuals are no longer used in this game; no images are required here.
		return {
			images: {},
			// Sparkler_Reel spine assets were removed for this game
			spine: {}
		};
	}

	getNumberAssets(): AssetGroup {
		// Number sprites now live only under portrait/high; always load from there
		const prefix = `assets/portrait/high`;
		
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
		numberImages['number_comma'] = `${prefix}/numbers/number_comma.png`;
		numberImages['number_dot'] = `${prefix}/numbers/number_dot.png`;
		
		console.log(`[AssetConfig] Number comma: ${prefix}/numbers/number_comma.png`);
		console.log(`[AssetConfig] Number dot: ${prefix}/numbers/number_dot.png`);
		
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
		// Force high-quality portrait paths for logo assets to avoid missing files on low quality
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
				// Scatter win overlays currently reuse the low-quality portrait assets for all modes
				'PickACard': `assets/portrait/low/scatter_win/PickACard.png`,
				'congrats': `assets/portrait/low/scatter_win/congrats.png`,
				// PNG fallback for overlay fire; original fire_animations sprites were removed
				'fireanimation01_HTBH_img': `assets/portrait/low/scatter_win/Winfontfire.png`
			}
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

	// Helper method to get all assets for a scene
	getAllAssets(): { [key: string]: AssetGroup } {
		return {
			background: this.getBackgroundAssets(),
			bonusHeader: this.getBonusHeaderAssets(),
			loading: this.getLoadingAssets(),
			symbols: this.getSymbolAssets(),
			buttons: this.getButtonAssets(),
			fonts: this.getFontAssets(),
			dialogs: this.getDialogAssets(),
			numbers: this.getNumberAssets(),
			coin: this.getCoinAssets(),
			buyFeature: this.getBuyFeatureAssets(),
			scatterWin: this.getScatterWinOverlayAssets(),
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