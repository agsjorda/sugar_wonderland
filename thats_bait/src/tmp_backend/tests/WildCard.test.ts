import { describe, it, expect } from 'vitest';
import { Data } from '../Data';

// Legacy wildcard mechanic has been removed for this game.
// This test simply documents that no wildcard symbols are configured.

describe('Wildcards (disabled)', () => {
	it('has no wildcard symbols configured in Data', () => {
		expect(Data.WILDCARDS.length).toBe(0);
	});
});