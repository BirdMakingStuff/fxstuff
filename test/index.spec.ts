import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker, { parsePath } from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Hello World worker', () => {
	it('responds with Hello World! (unit style)', async () => {
		const request = new IncomingRequest('http://example.com');
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);
	});

	it('responds with Hello World! (integration style)', async () => {
		const response = await SELF.fetch('https://example.com');
		expect(await response.text()).toMatchInlineSnapshot(`"Hello World!"`);
	});

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
	});
});
