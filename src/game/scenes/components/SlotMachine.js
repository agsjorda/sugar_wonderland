import { Events } from "./Events";
import { Slot } from "./GameData";
import { getRandomRows } from "./IdleState";
import { WinState } from "./WinState";
import { Autoplay } from "./Autoplay";
export class SlotMachine {

  constructor() {
    this.container = undefined;
    this.symbolGrid = [];
    this.activeWinOverlay = null; // Add tracking for active overlay

    this.symbolData = [
		[0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0]
	];

    this.numColumns = this.symbolData.length;
    this.numRows = this.numColumns > 0 ? this.symbolData[0].length : 0;

    this.symbolDisplayWidth = 153.17;
    this.symbolDisplayHeight = 147.2;
    this.horizontalSpacing = 10;
    this.verticalSpacing = 10;

		this.autoplay = new Autoplay();
  }

  preload(scene) {
		this.scene = scene
		scene.load.image('slotBackground', 'assets/Reels/Property 1=Default.png');

    for (let i = 0; i < Slot.SYMBOLS; i++) {
      scene.load.image('symbol_' + i, 'assets/Symbols/Symbol_' + i + '.png');
    }

	scene.load.image('symbol_99', 'assets/Symbols/Symbol_99.png');

		this.initVariables(scene);
  }

	initVariables(scene) {
		this.width = scene.scale.width;
		this.height = scene.scale.height;

		this.centerX = this.width * 0.5;
    	this.centerY = this.height * 0.5;

		this.totalGridWidth = 1000;//(this.symbolDisplayWidth * this.numColumns) + (this.horizontalSpacing * (this.numColumns - 1));
		this.totalGridHeight = 775;//(this.symbolDisplayHeight * this.numRows) + (this.verticalSpacing * (this.numRows - 1));

		this.slotX = this.centerX - this.totalGridWidth * 0.475;
		this.slotY = 85;
	}


  create(scene) {
		this.createContainer(scene)
		this.createBackground(scene);
    	this.createSlot(scene);
		this.eventListners(scene)

		// this.createRowDetection(scene)
  }

	createContainer(scene) {
		this.container = scene.add.container(this.slotX, this.slotY);
		this.container.setDepth(4);
	}

	createBackground(scene) {
		const background = scene.add.image(0, 0, 'slotBackground').setOrigin(0, 0);
		background.setDepth(3);

		const paddingX = 90
		const paddingY = 90

		background.x = this.slotX - paddingX * 0.5;
		background.y = this.slotY - paddingY * 0.5;

		background.displayWidth = this.totalGridWidth + paddingX;
		background.displayHeight = this.totalGridHeight + paddingY;
	}

  createSlot(scene) {
    const maskShape = scene.add.graphics();
    maskShape.fillRect(this.slotX, this.slotY, this.totalGridWidth, this.totalGridHeight);

    const mask = maskShape.createGeometryMask();
    this.container.setMask(mask);
    maskShape.setVisible(false);
  }

	createReel(scene, data) {
		const slot = scene.gameData.slot;
		

		const numRows = Slot.ROWS;
		const numCols = Slot.COLUMNS;
		const width = this.symbolDisplayWidth;
		const height = this.symbolDisplayHeight;
		const horizontalSpacing = this.horizontalSpacing;
		const verticalSpacing = this.verticalSpacing;

		// Use the existing symbolGrid from createSampleSymbols
		const newValues = data.symbols;
		let completedSymbols = 0;
		const totalSymbols = numCols * numRows;
		let newSymbolGrid = Array(numRows).fill().map(() => Array(numCols).fill(null));
		const rowInterval = 150; // ms between each row's arrival in a column

		let turboSpeed = 1;
		if (scene.gameData.turbo) {
			turboSpeed = 0.1;
		}
		else
			turboSpeed = 1;

		let offsetDelay = 1100;
		for (let col = 0; col < numCols; col++) {
			for (let row = numRows - 1; row >= 0; row--) { // Start from bottom row
				const symbol = this.symbolGrid[row][col];
				const centerX = width * 0.5;
				const centerY = height * 0.5;
				const symbolX = centerX + col * (width + horizontalSpacing);
				const symbolY = centerY + row * (height + verticalSpacing);
				const delay = (col * 250 + (numRows - 1 - row) * rowInterval) * turboSpeed;

				// Tween out the old symbol
				if (symbol) {
					const endY = symbol.y + height * (numRows + 1);
					const distance = endY - symbol.y;
					const baseSpeed = 0.5; // pixels per millisecond
					const _duration = (distance / baseSpeed) * turboSpeed;
					
					scene.tweens.add({
						targets: symbol,
						y: endY,
						duration: _duration,
						delay: delay,
						ease: 'Quart.easeInOut',
						onComplete: () => {
							symbol.destroy();
						}
					});
				}

				// Create and tween in the new symbol
				const symbolValue = newValues[row][col];
				const symbolKey = 'symbol_' + symbolValue;
				const startY = symbolY - height * (numRows + 1); // Start position
				const newSymbol = scene.add.sprite(symbolX, startY, symbolKey);
				if (symbolValue === 99) {
					newSymbol.displayWidth = width * 1.1;
					newSymbol.displayHeight = height * 1.1;
				} else {
					newSymbol.displayWidth = width * 0.9;
					newSymbol.displayHeight = height * 0.9;
				}
				this.container.add(newSymbol);
				newSymbolGrid[row][col] = newSymbol;

				// Calculate duration based on distance to maintain consistent speed
				const distance = symbolY - startY;
				const baseSpeed = 0.3; // pixels per millisecond
				let _duration = (distance / baseSpeed) * turboSpeed;
				if (scene.gameData.turbo) {
					_duration = Math.min(_duration, 1250 * turboSpeed);
				}
				
				// Add extra delay for turbo mode to prevent overlap
				let _delay = (delay + offsetDelay) * turboSpeed;
				if (scene.gameData.turbo) {
					_delay += _duration * 1.25; // Add 25% of the duration as extra delay in turbo mode
				}

				scene.tweens.add({
					targets: newSymbol,
					y: symbolY,
					duration: _duration,
					delay: _delay,
					ease: 'Quart.easeInOut',
					onComplete: () => {
						completedSymbols++;
						
						if(scene.gameData.turbo) {
							scene.audioManager.TurboDrop.play();
						}
						
						if (completedSymbols === totalSymbols) {
							this.symbolGrid = newSymbolGrid;
							Events.emitter.emit(Events.SPIN_ANIMATION_END, {
								symbols: slot.values,
								newRandomValues: newValues
							});
							if (this.checkMatch(slot.values, scene) === "No more matches") {
								scene.gameData.isSpinning = false;
							}
						}
						
					}
				});
			}
		}
	}
	
	// returns true if there's any valid 3+ column match left-to-right
	checkMatch(symbolGrid, scene) {
		const rows = symbolGrid.length;
		const cols = symbolGrid[0].length;
		const symbolCount = {};
		const matchIndices = {};

		// 1. Count occurrences and collect indices
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const symbol = symbolGrid[row][col];
				symbolCount[symbol] = (symbolCount[symbol] || 0) + 1;
				if (!matchIndices[symbol]) matchIndices[symbol] = [];
				matchIndices[symbol].push({ row, col });
			}
		}

		// 2. Find symbols with >=8 matches
		let foundMatch = false;
		let matchedSymbol = null;
		for (const symbol in symbolCount) {
			if (symbolCount[symbol] >= 8) {
				foundMatch = true;
				matchedSymbol = symbol;
				break;
			}
		}

		if (!foundMatch) {
			// --- SCATTER CHECK ---
			const scatterCount = symbolCount[99] || 0;
			if (scatterCount >= 4) {
				// Explosive tween for all scatter symbols
				let scatterSprites = [];
				for (let row = 0; row < rows; row++) {
					for (let col = 0; col < cols; col++) {
						if (symbolGrid[row][col] === 99 && this.symbolGrid[row][col]) {
							scatterSprites.push(this.symbolGrid[row][col]);
						}
					}
				}
				let tweensToComplete = scatterSprites.length;
				const onAllTweensComplete = () => {
					// Award free spins based on scatterCount
					let freeSpins = 0;
					if (scatterCount === 4) freeSpins += 10;
					else if (scatterCount === 5) freeSpins += 12;
					else if (scatterCount === 6) freeSpins += 15;
					this.freeSpins = (this.freeSpins || 0) + freeSpins;
					this.showFreeSpinsPopup(scene, freeSpins);
					scene.gameData.isBonusRound = true;
					// BURR
				};
				if (tweensToComplete === 0) {
					onAllTweensComplete();
				} else {
					scene.audioManager.ScatterSFX.play();
					scene.background.enableBonusBackground();
					scene.audioManager.changeBackgroundMusic(scene);

					scatterSprites.forEach(sprite => {
						scene.tweens.add({
							targets: sprite,
							scale: 2,
							alpha: 0,
							duration: 700,
							ease: 'Cubic.easeOut',
							onComplete: () => {
								sprite.destroy();
								tweensToComplete--;
								if (tweensToComplete === 0) onAllTweensComplete();
							}
						});
					});
				}
				scene.gameData.isSpinning = false;
				Events.emitter.emit(Events.SPIN_ANIMATION_END, {
					symbols: symbolGrid,
					newRandomValues: symbolGrid
				});
				Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
				return "free spins";
			}

			// At the end, emit WIN to update totalWin text
			Events.emitter.emit(Events.WIN, {});
			scene.gameData.isSpinning = false;
			Events.emitter.emit(Events.SPIN_ANIMATION_END, {
				symbols: symbolGrid,
				newRandomValues: symbolGrid
			});

			// Play win audio and show overlay based on totalWin/bet multiplier
			const bet = scene.gameData.bet || 1;
			const totalWin = scene.gameData.totalWin || 0;
			const multiplier = totalWin / bet;
			
			if (multiplier >= 10) {
				this.showWinOverlay(scene, totalWin, bet);
			}
			scene.audioManager.playWinSFX(multiplier);

			Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
			return "No more matches";
		}

		// 3. Get all matched indices for the symbol
		const matchedCells = matchIndices[matchedSymbol];

		// 4. Add to totalWin and balance
		const bet = scene.gameData.bet || 1;
		let winAmount = 0;
		if (matchedCells.length === 8 || matchedCells.length === 9) {
			winAmount = 6 * bet;
		} else if (matchedCells.length === 10 || matchedCells.length === 11) {
			winAmount = 10 * bet;
		} else if (matchedCells.length >= 12) {
			winAmount = 20 * bet;
		}
		scene.gameData.totalWin += winAmount;
		scene.gameData.balance += winAmount;
		Events.emitter.emit(Events.WIN, {});

		// Popup text at the matched symbol closest to the center
		const gridCenter = { row: (rows - 1) / 2, col: (cols - 1) / 2 };
		let minDist = Infinity;
		let popupPos = { x: scene.scale.width / 2, y: scene.scale.height / 2 };
		matchedCells.forEach(({ row, col }) => {
			const dist = Math.abs(row - gridCenter.row) + Math.abs(col - gridCenter.col);
			if (dist < minDist && this.symbolGrid[row][col]) {
				minDist = dist;
				const symbolSprite = this.symbolGrid[row][col];
				popupPos = { x: symbolSprite.x, y: symbolSprite.y };
			}
		});
		const popupText = scene.add.text(
			popupPos.x,
			popupPos.y,
			`+$${winAmount.toFixed(2)}`,
			{
				fontSize: '64px',
				fill: '#FFD700',
				fontStyle: 'bold',
				stroke: '#000',
				strokeThickness: 6,
				fontFamily: 'Segoe UI'
			}
		);
		popupText.setOrigin(0.5, 0.5);
		popupText.setDepth(100);
		scene.tweens.add({
			targets: popupText,
			y: popupPos.y - 80,
			alpha: 0,
			scale: 1.5,
			duration: 1200,
			ease: 'Cubic.easeOut',
			onComplete: () => {
				popupText.destroy();
			}
		});

		// 5. Mark matched cells for removal
		const toRemove = Array.from({ length: rows }, () => Array(cols).fill(false));
		matchedCells.forEach(({ row, col }) => {
			toRemove[row][col] = true;
		});

		// 6. Animate matched symbols out
		let tweensToComplete = 0;
		
		scene.audioManager.playRandomQuickWin();
	

		matchedCells.forEach(({ row, col }) => {
			const symbolSprite = this.symbolGrid[row][col];
			if (symbolSprite) {
				tweensToComplete++;
				
				
				scene.tweens.add({
					targets: symbolSprite,
					alpha: 0,
					scale: 0,
					duration: 1000,
					ease: 'Circ.easeInOut',
					onComplete: () => {
						symbolSprite.destroy();
						tweensToComplete--;
						if (tweensToComplete === 0) {
							this.dropAndRefill(symbolGrid, toRemove, scene);
						}
					}
				});
			}
		});

		// Store matched cells for reference
		scene.gameData.currentMatchingSymbols = matchedCells.map(({ row, col }) => ({
			row, col, symbol: matchedSymbol
		}));

		// The rest is handled in dropAndRefill
		return "continue match";
	}

	dropAndRefill(symbolGrid, toRemove, scene) {
		const rows = symbolGrid.length;
		const cols = symbolGrid[0].length;
		const width = this.symbolDisplayWidth;
		const height = this.symbolDisplayHeight;
		const horizontalSpacing = this.horizontalSpacing;
		const verticalSpacing = this.verticalSpacing;
		const dropTweens = [];
		const newSymbols = [];

		// For each column, drop down and fill new randoms
		for (let col = 0; col < cols; col++) {
			// Build new column after removals
			const newCol = [];
			let dropMap = [];
			for (let row = rows - 1; row >= 0; row--) {
				if (!toRemove[row][col]) {
					newCol.unshift(symbolGrid[row][col]);
					dropMap.unshift(row);
				}
			}
			// Fill the rest with new random symbols at the top
			const numNew = rows - newCol.length;
			for (let i = 0; i < numNew; i++) {
				const newSymbol = Math.floor(Math.random() * Slot.SYMBOLS);
				newCol.unshift(newSymbol);
			}
			// Animate drop for each cell in this column
			let targetRow = rows - 1;
			for (let i = dropMap.length - 1; i >= 0; i--) {
				const fromRow = dropMap[i];
				const symbolSprite = this.symbolGrid[fromRow][col];
				if (symbolSprite) {
					const newY = (height * 0.5) + targetRow * (height + verticalSpacing);
					dropTweens.push(new Promise(resolve => {
						scene.tweens.add({
							targets: symbolSprite,
							y: newY,
							duration: 300,
							ease: 'Cubic.easeIn',
							onComplete: () => resolve()
						});
					}));
					this.symbolGrid[targetRow][col] = symbolSprite;
					if (targetRow !== fromRow) {
						this.symbolGrid[fromRow][col] = null;
					}
					--targetRow;
				}
			}
			// Add new symbols at the top
			for (let i = 0; i < numNew; i++) {
				const symbolValue = newCol[i];
				const symbolKey = 'symbol_' + symbolValue;
				const symbolX = (width * 0.5) + col * (width + horizontalSpacing);
				const symbolY = (height * 0.5) + (i - numNew) * (height + verticalSpacing); // Start above
				const newSymbol = scene.add.sprite(symbolX, symbolY, symbolKey);
				newSymbol.displayWidth = width;
				newSymbol.displayHeight = height;
				this.container.add(newSymbol);
				this.symbolGrid[i][col] = newSymbol;
				const targetY = (height * 0.5) + i * (height + verticalSpacing);
				dropTweens.push(new Promise(resolve => {
					scene.tweens.add({
						targets: newSymbol,
						y: targetY,
						duration: 300,
						ease: 'Cubic.easeIn',
						onComplete: () => resolve()
					});
				}));
			}
			// Update symbolGrid values
			for (let row = 0; row < rows; row++) {
				symbolGrid[row][col] = newCol[row];
			}
		}

		// Wait for all tweens to finish, then check for more matches
		Promise.all(dropTweens).then(() => {
			const result = this.checkMatch(symbolGrid, scene);
			if (result === "No more matches" || result === "free spins") {
				Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
				scene.gameData.isSpinning = false;
			}
		});
	}

	

	createSampleSymbols(scene, symbols) {
		this.symbolGrid = [];
		for (let row = 0; row < Slot.ROWS; row++) {
			let rowArr = [];
			const width = this.symbolDisplayWidth;
			const height = this.symbolDisplayHeight;
			const centerX = width * 0.5;
			const centerY = height * 0.5;
			const factor = 1;
			for (let col = 0; col < Slot.COLUMNS; col++) {
				const symbolValue = symbols[row][col];
				const symbolKey = 'symbol_' + symbolValue;
				const symbolRelativeX = centerX + col * (width + this.horizontalSpacing);
				const symbolRelativeY = centerY + row * (height + this.verticalSpacing);
				const symbol = scene.add.sprite(symbolRelativeX, symbolRelativeY, symbolKey);
				if (symbolValue === 99) {
					symbol.displayWidth = width * factor * 1.1;
					symbol.displayHeight = width * factor * 1.1;
				} else {
					symbol.displayWidth = width * factor*.9;
					symbol.displayHeight = width * factor*.9;
				}
				this.container.add(symbol);
				rowArr.push(symbol);
			}
			this.symbolGrid.push(rowArr);
		}
	}

	createRowDetection(scene) {
		const width = 210
		const height = this.height * 0.6

		const start_x = this.width * 0.225;
		const x = start_x
    	const y = this.height * 0.2;
		const cornerRadius = 10;

		const rowDetection = scene.add.graphics();
		rowDetection.setDepth(10);
		rowDetection.fillStyle(0xFFFFFF, 0.25);
		rowDetection.fillRoundedRect(0, 0, width, height, cornerRadius);
		rowDetection.x = x;
		rowDetection.y = y;

		Events.emitter.on(Events.SPIN_END, (data) => {
			rowDetection.x = start_x + width * (data.currentRow % (Slot.COLUMNS))
		})

		Events.emitter.on(Events.START, (data) => {
			rowDetection.x = start_x + width * data.currentRow
		})
	}

	eventListners(scene) {
		Events.emitter.on(Events.START, (data) => {
			this.disposeSymbols();
			this.createSampleSymbols(this.scene, data.symbols);
		})

		Events.emitter.on(Events.SPIN_ANIMATION_START, (data) => {
			if (data.currentRow > 0) {
				scene.gameData.totalWin = 0;
				Events.emitter.emit(Events.WIN, {})
				
				this.disposeSymbols();
				this.createSampleSymbols(this.scene, data.symbols);
			}

			
			this.createReel(this.scene, data);
		})

		// Events.emitter.on(Events.SPIN_BEFORE_ANIMATION_END, (data) => {
		// 	this.disposeSymbols();
		// 	this.createSampleSymbols(this.scene, data.symbols);
		// })
	}

	disposeSymbols() {
		// Helper function to safely destroy symbols in a grid
		const destroyGridSymbols = (grid) => {
			if (!grid) return;
			grid.forEach(row => {
				row.forEach(symbol => {
					if (symbol?.destroy) {
						symbol.destroy();
					}
				});
			});
		};

		// Destroy symbols in both grids
		destroyGridSymbols(this.symbolGrid);
		destroyGridSymbols(this.extraSymbolGrid);

		// Clean up container
		this.container?.removeAll(true);

		// Reset grids
		this.symbolGrid = [];
		this.extraSymbolGrid = [];
	}

	showFreeSpinsPopup(scene, freeSpins) {
		// Create a full screen overlay
		const overlay = scene.add.graphics();
		overlay.fillStyle(0x000000, 0.7);
		overlay.fillRect(0, 0, scene.scale.width, scene.scale.height);
		overlay.setDepth(999);

		// Create popup container
		const popup = scene.add.container(scene.scale.width/2, scene.scale.height/2);
		popup.setDepth(1000);

		// Add blur effect if available
		if (scene.sys.game.renderer.pipelines) {
			overlay.setPipeline('BlurPostFX');
		}

		// Create popup background with gradient
		const bg = scene.add.graphics();
		bg.fillGradientStyle(0x1a1a1a, 0x1a1a1a, 0x000000, 0x000000, 1);
		bg.fillRoundedRect(-250, -150, 500, 300, 32);
		bg.lineStyle(2, 0x57FFA3, 0.5);
		bg.strokeRoundedRect(-250, -150, 500, 300, 32);
		popup.add(bg);

		// Add title
		const title = scene.add.text(0, -80, 'FREE SPINS!', {
			fontSize: '48px',
			fill: '#57FFA3',
			fontFamily: 'Poppins',
			fontStyle: 'bold',
			align: 'center'
		});
		title.setOrigin(0.5, 0.5);
		popup.add(title);

		// Add free spins count
		const text = scene.add.text(0, 0, `${freeSpins}`, {
			fontSize: '72px',
			fill: '#FFD700',
			fontFamily: 'Poppins',
			fontStyle: 'bold',
			align: 'center'
		});
		text.setOrigin(0.5, 0.5);
		popup.add(text);

		// Add "Free Spins" text below count
		const subText = scene.add.text(0, 60, 'Free Spins', {
			fontSize: '32px',
			fill: '#FFFFFF',
			fontFamily: 'Poppins',
			fontStyle: 'bold',
			align: 'center'
		});
		subText.setOrigin(0.5, 0.5);
		popup.add(subText);

		// Create OK button with gradient
		const okBtnBg = scene.add.graphics();
		okBtnBg.fillGradientStyle(0x57FFA3, 0x57FFA3, 0x379557, 0x379557, 1);
		okBtnBg.fillRoundedRect(-100, 100, 200, 60, 30);
		okBtnBg.lineStyle(2, 0xFFFFFF, 0.5);
		okBtnBg.strokeRoundedRect(-100, 100, 200, 60, 30);
		popup.add(okBtnBg);

		const okBtnText = scene.add.text(0, 130, 'START', {
			fontSize: '32px',
			fill: '#000000',
			fontFamily: 'Poppins',
			fontStyle: 'bold'
		});
		okBtnText.setOrigin(0.5, 0.5);
		popup.add(okBtnText);

		// Make button interactive
		okBtnBg.setInteractive(new Phaser.Geom.Rectangle(-100, 100, 200, 60), Phaser.Geom.Rectangle.Contains);
		okBtnBg.on('pointerdown', () => {
			overlay.destroy();
			popup.destroy();
			
			// Start free spins as autoplay
			scene.gameData.freeSpins = freeSpins;
			scene.gameData.isSpinning = false; // Reset spinning state
			
			// Configure autoplay for free spins
			this.autoplay = new Autoplay(); // Reset autoplay instance
			this.autoplay.start(scene, freeSpins);
			
			// Emit autoplay start event
			Events.emitter.emit(Events.AUTOPLAY_START);
			
			// Listen for matches completion to continue auto spinning
			Events.emitter.once(Events.MATCHES_DONE, () => {
				if (scene.gameData.freeSpins > 0) {
					scene.gameData.isSpinning = false;
					Events.emitter.emit(Events.SPIN, {
						currentRow: scene.gameData.currentRow,
						symbols: scene.gameData.slot.values
					});
				}
			});
		});

		// Add entrance animation
		popup.setScale(0);
		scene.tweens.add({
			targets: popup,
			scale: 1,
			duration: 500,
			ease: 'Back.easeOut'
		});
	}

	showWinOverlay(scene, totalWin, bet) {
		// Clean up any existing overlay first
		if (this.activeWinOverlay) {
			this.activeWinOverlay.clickZone.destroy();
			this.activeWinOverlay.overlay.destroy();
			this.activeWinOverlay.container.destroy();
			this.activeWinOverlay = null;
		}

		const multiplier = totalWin / bet;
		let winType = '';
		let textColor = '#FFFFFF';
		let scale = 1;
		let particleColor = 0xFFD700;

		if (multiplier >= 100) {
			winType = 'SUPER WIN';
			textColor = '#FF0000';
			scale = 1.4;
			particleColor = 0xFF0000;
		} else if (multiplier >= 50) {
			winType = 'HUGE WIN';
			textColor = '#FFD700';
			scale = 1.3;
			particleColor = 0xFFD700;
		} else if (multiplier >= 25) {
			winType = 'BIG WIN';
			textColor = '#00FF00';
			scale = 1.2;
			particleColor = 0x00FF00;
		} else if (multiplier >= 10) {
			winType = 'MINI WIN';
			textColor = '#FFFFFF';
			scale = 1.1;
			particleColor = 0xFFFFFF;
		} else {
			return; // Don't show overlay for small wins
		}

		// Create and store the overlay elements
		const overlayElements = {
			clickZone: scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0),
			overlay: scene.add.graphics(),
			container: scene.add.container(scene.scale.width/2, scene.scale.height/2)
		};

		this.activeWinOverlay = overlayElements;

		// Set up clickZone
		overlayElements.clickZone.setOrigin(0, 0);
		overlayElements.clickZone.setDepth(999);
		overlayElements.clickZone.setInteractive();

		// Set up overlay
		overlayElements.overlay.fillStyle(0x000000, 0.8);
		overlayElements.overlay.fillRect(0, 0, scene.scale.width, scene.scale.height);
		overlayElements.overlay.setDepth(1000);

		// Set up container
		overlayElements.container.setDepth(1001);

		// Add particle effect
		const particles = scene.add.particles(0, 0, 'particle', {
			speed: { min: 100, max: 200 },
			angle: { min: 0, max: 360 },
			scale: { start: 0.5, end: 0 },
			blendMode: 'ADD',
			tint: particleColor,
			lifespan: 1000,
			gravityY: 50,
			quantity: 2,
			frequency: 50
		});
		overlayElements.container.add(particles);

		// Win type text
		const winTypeText = scene.add.text(0, -50, winType, {
			fontSize: '72px',
			fill: textColor,
			fontFamily: 'Poppins',
			fontStyle: 'bold',
			stroke: '#000000',
			strokeThickness: 8
		});
		winTypeText.setOrigin(0.5);
		winTypeText.setScale(scale);
		overlayElements.container.add(winTypeText);

		// Win amount text
		const winAmountText = scene.add.text(0, 50, `$${totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, {
			fontSize: '48px',
			fill: '#FFD700',
			fontFamily: 'Poppins',
			fontStyle: 'bold',
			stroke: '#000000',
			strokeThickness: 6
		});
		winAmountText.setOrigin(0.5);
		overlayElements.container.add(winAmountText);

		// Click to skip text
		const skipText = scene.add.text(0, 120, 'Click to continue', {
			fontSize: '24px',
			fill: '#FFFFFF',
			fontFamily: 'Poppins',
			fontStyle: 'bold'
		});
		skipText.setOrigin(0.5);
		skipText.setAlpha(0.7);
		overlayElements.container.add(skipText);

		// Entrance animation
		overlayElements.container.setScale(0);
		scene.tweens.add({
			targets: overlayElements.container,
			scale: 1,
			duration: 500,
			ease: 'Back.easeOut'
		});

		// Make the click zone interactive
		overlayElements.clickZone.on('pointerdown', () => {
			this.destroyWinOverlay(scene);
		});

		return overlayElements;
	}

	destroyWinOverlay(scene) {
		if (this.activeWinOverlay) {
			// Stop win sound
			scene.audioManager.stopWinSFX();
			
			// Remove all elements
			this.activeWinOverlay.clickZone.destroy();
			this.activeWinOverlay.overlay.destroy();
			this.activeWinOverlay.container.destroy();
			this.activeWinOverlay = null;
			
			// Resume autoplay if active
			if (this.autoplay && this.autoplay.isAutoPlaying) {
				Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid: scene.gameData.slot.values });
			}
		}
	}

  update(scene, time, delta) {

  }
}
