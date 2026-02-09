import { describe, it, expect } from 'vitest';
import { parsePath } from '../src/index';

describe('parsePath', () => {
	it('parses simple three-segment paths', () => {
		expect(parsePath('/section/12345/slug')).toEqual({ category: 'section', id: 12345, urlTitle: 'slug' });
	});

	it('parses multi-segment category paths containing the article id and slug', () => {
		const path = '/auckland/local-news/auckland-city-harbour-news/96230184/auckland-university-students-vote-to-disaffiliate-antiabortion-club';
		expect(parsePath(path)).toEqual({
			category: 'auckland/local-news/auckland-city-harbour-news',
			id: 96230184,
			urlTitle: 'auckland-university-students-vote-to-disaffiliate-antiabortion-club',
		});
	});

	it('parses fxstuff single-segment category paths', () => {
		const path = '/business/360923270/asian-retail-chain-goes-liquidation-owing-millions';
		expect(parsePath(path)).toEqual({
			category: 'business',
			id: 360923270,
			urlTitle: 'asian-retail-chain-goes-liquidation-owing-millions',
		});
	});

	it('parses editors-picks style paths', () => {
		const path = '/auckland/editors-picks/7303166/Anti-abortion-group-wins-key-vote';
		expect(parsePath(path)).toEqual({
			category: 'auckland/editors-picks',
			id: 7303166,
			urlTitle: 'Anti-abortion-group-wins-key-vote',
		});
	});
});
