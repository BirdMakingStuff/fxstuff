/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { getImageSize, requestStory } from './stuff';
import { handleOembed } from './oembed';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const parsedUrl = new URL(request.url);

		// Handle oEmbed endpoint
		if (parsedUrl.pathname === '/oembed') {
			return handleOembed(request);
		}

		let urlMatch: { category: string; id: number; urlTitle: string } | null = null;

		const m = parsedUrl.pathname.match(/^\/([^\/]+)\/([1-9][0-9]*)\/([^\/]+)\/?$/);
		if (m) urlMatch = { category: m[1], id: Number(m[2]), urlTitle: m[3] };

		if (urlMatch === null) {
			return new Response('Not Found', { status: 404 });
		}

		const ua = (request.headers.get('user-agent') || '').toLowerCase();
		const isDiscord = ua.includes('discord') || ua.includes('discordbot');
		const isTwitter = ua.includes('twitter') || ua.includes('twitterbot');

		const story = await requestStory(urlMatch.id);
		const title = story.teaser.title;
		const description = story.teaser.intro;
		const image = story.teaser.image.url;
		let imageSize = null;
		if (image) {
			imageSize = await getImageSize(image);
		}

		const storyUrl = `https://www.stuff.co.nz/${urlMatch.category}/${urlMatch.id}/${urlMatch.urlTitle}`;
		const oembedUrl = `${parsedUrl.origin}/oembed?url=${encodeURIComponent(storyUrl)}`;

		let header = `<!doctype html><html><head>
			<meta name="theme-color" content="#8d1de8">
			<meta property="og:title" content="${escapeHtml(title)}"/>
			<meta property="og:description" content="${escapeHtml(description)}"/>
			<meta property="og:url" content="${storyUrl}"/>
			<meta property="og:type" content="website"/>
			<meta property="og:site_name" content="Stuff"/>
			<link href='https://www.stuff.co.nz/assets/icon/Favicon-Stuff-32x32.png' rel='icon' sizes='32x32' type='image/png'>
			<link rel="alternate" type="application/json+oembed" href="${oembedUrl}" title="${escapeHtml(title)}">
			`;

		if (image) {
			header += `<meta property="og:image" content="${escapeHtml(image)}"/>`;
			header += `<meta property="og:image:alt" content="${escapeHtml(story.teaser.image.alt)}"/>`;
			if (imageSize) {
				header += `<meta property="og:image:width" content="${imageSize.width}"/><meta property="og:image:height" content="${imageSize.height}"/>`;
			}
		}

		header += `</head><body></body></html>`;

		return new Response(header, { headers: { 'content-type': 'text/html; charset=utf-8' } });

		// Redirect to Stuff
		// return Response.redirect(`https://www.stuff.co.nz/${urlMatch.category}/${urlMatch.id}/${urlMatch.urlTitle}`, 302);
	},
} satisfies ExportedHandler<Env>;

function escapeHtml(s: string) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/>/g, '&gt;');
}
