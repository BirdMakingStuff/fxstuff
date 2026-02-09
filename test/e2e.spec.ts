import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../src/index';
import * as stuff from '../src/stuff';

afterEach(() => {
	vi.restoreAllMocks();
});

const ctx = { waitUntil: () => {} } as any;
const env = {} as any;

describe('End-to-end behavior', () => {
	it('invalid paths redirect to the GitHub repo page', async () => {
		const req = new Request('https://example.com/foo/bar');
		const res = await (worker as any).fetch(req, env, ctx);
		expect(res.status).toBe(302);
		expect(res.headers.get('Location')).toBe('https://github.com/BirdMakingStuff/fxstuff');
	});

	it('non-bot requests to valid article path redirect to Stuff URL', async () => {
		const path = '/business/360923270/asian-retail-chain-goes-liquidation-owing-millions';
		const req = new Request(`https://example.com${path}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
		const res = await (worker as any).fetch(req, env, ctx);
		expect(res.status).toBe(302);
		expect(res.headers.get('Location')).toBe(`https://www.stuff.co.nz${path}`);
	});

	it('discord user agent receives HTML with OG metadata (og:url) for a valid article path', async () => {
		const path = '/business/360923270/asian-retail-chain-goes-liquidation-owing-millions';
		// Mock requestStory to avoid network
		vi.spyOn(stuff, 'requestStory').mockResolvedValue({
			teaser: {
				title: 'Asian retail chain goes into liquidation',
				intro: 'Some intro',
				image: { id: '1', alt: 'image', url: '' },
			},
			author: { id: '1', name: 'Author', jobTitle: '', email: '', biography: '', location: '', url: '/author/1' },
			publishedDate: '2024-01-01T00:00:00Z',
			updatedDate: '2024-01-02T00:00:00Z',
		} as any);

		const req = new Request(`https://example.com${path}`, { headers: { 'user-agent': 'Discordbot/2.0' } });
		const res = await (worker as any).fetch(req, env, ctx);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toMatch(/text\/html/);
		const body = await res.text();
		expect(body).toContain(`<meta property="og:url" content="https://www.stuff.co.nz${path}"/>`);
	});

	it('handles missing image alt without throwing and emits empty alt meta', async () => {
		const path = '/business/360923270/asian-retail-chain-goes-liquidation-owing-millions';
		vi.spyOn(stuff, 'requestStory').mockResolvedValue({
			teaser: {
				title: 'Title',
				intro: 'Intro',
				image: { id: '1', url: 'https://example.com/image.jpg' }, // alt omitted
			},
			author: { id: '1', name: 'Author', jobTitle: '', email: '', biography: '', location: '', url: '/author/1' },
			publishedDate: '2024-01-01T00:00:00Z',
			updatedDate: '2024-01-02T00:00:00Z',
		} as any);

		const req = new Request(`https://example.com${path}`, { headers: { 'user-agent': 'Discordbot/2.0' } });
		const res = await (worker as any).fetch(req, env, ctx);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('<meta property="og:image:alt" content=""/>');
	});

	it('handles null image alt without throwing and emits empty alt meta', async () => {
		const path = '/business/360923270/asian-retail-chain-goes-liquidation-owing-millions';
		vi.spyOn(stuff, 'requestStory').mockResolvedValue({
			teaser: {
				title: 'Title',
				intro: 'Intro',
				image: { id: '1', alt: null, url: 'https://example.com/image.jpg' },
			},
			author: { id: '1', name: 'Author', jobTitle: '', email: '', biography: '', location: '', url: '/author/1' },
			publishedDate: '2024-01-01T00:00:00Z',
			updatedDate: '2024-01-02T00:00:00Z',
		} as any);

		const req = new Request(`https://example.com${path}`, { headers: { 'user-agent': 'Discordbot/2.0' } });
		const res = await (worker as any).fetch(req, env, ctx);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('<meta property="og:image:alt" content=""/>');
	});
});
