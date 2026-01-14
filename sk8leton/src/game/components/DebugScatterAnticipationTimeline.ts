import { SCATTER_SYMBOL, SLOT_COLUMNS, SLOT_ROWS } from "../../config/GameConfig";

type ScatterPos = { x: number; y: number };

export function debugScatterAnticipationTimeline(symbols: number[][]): void {
	try {
		const positions: ScatterPos[] = [];
		const scatterVal = SCATTER_SYMBOL[0];
		for (let col = 0; col < SLOT_COLUMNS; col++) {
			const column = symbols?.[col];
			if (!Array.isArray(column)) continue;
			for (let row = 0; row < SLOT_ROWS; row++) {
				if (column[row] === scatterVal) {
					positions.push({ x: col, y: row });
				}
			}
		}
		positions.sort((a, b) => (a.x - b.x) || (a.y - b.y));

		const scattersByReel = new Array<number>(SLOT_COLUMNS).fill(0);
		for (const p of positions) {
			scattersByReel[p.x] = (scattersByReel[p.x] || 0) + 1;
		}

		const total = positions.length;
		console.log('[DebugScatterAnticipationTimeline] total scatters:', total);
		console.log('[DebugScatterAnticipationTimeline] positions (sorted):', positions);

		for (const target of [3, 4, 5]) {
			if (total < target) {
				console.log(`[DebugScatterAnticipationTimeline] target=${target}: not applicable (only ${total} scatters)`);
				continue;
			}
			const pos = positions[target - 1];
			if (!pos) continue;
			let before = 0;
			for (let c = 0; c < pos.x; c++) before += (scattersByReel[c] || 0);
			const shouldAnticipate = before >= (target - 1);
			console.log(`[DebugScatterAnticipationTimeline] target=${target}:`, {
				pos,
				beforeReel: before,
				willTriggerDuringReelStops: shouldAnticipate,
				reelToExtend: shouldAnticipate ? pos.x : null,
				rowToHighlight: shouldAnticipate ? pos.y : null,
			});
		}
	} catch (e) {
		console.warn('[DebugScatterAnticipationTimeline] failed:', e);
	}
}
