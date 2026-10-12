import type { Story, storyAsset } from './stuff';

function escapeHtml(s?: string | null) {
	const value = s ?? '';
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function formatPublishedDate(iso: string | undefined): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	return d.toLocaleString('en-NZ', {
		hour12: false,
		weekday: 'short',
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Pacific/Auckland',
	});
}

/**
 * Renders assets as HTML blocks. Returns the HTML for a single asset.
 * Images get a figure with caption + creditline; other type codes get a
 * generic embed/link treatment.
 */
function renderAsset(asset: storyAsset): string {
	const caption = asset.title ? escapeHtml(asset.title) : '';
	const credit = asset.creditline ? escapeHtml(asset.creditline) : '';
	const figcaption =
		caption || credit
			? `<figcaption>${caption}${credit ? ` <span class="credit">${credit}</span>` : ''}</figcaption>`
			: '';

	const type = (asset.type || '').toUpperCase();

	if (type === 'IMAGE') {
		return `<figure class="story-asset">
			<img src="${escapeHtml(asset.item.url)}" alt="${caption}" loading="lazy">
			${figcaption}
		</figure>`;
	}

	// Video: the playable file lives in item.playback.sources[] (mp4), not item.url
	if (type === 'VIDEO') {
		const sources = (asset.item.playback?.sources || [])
			.filter((s) => s?.url)
			.map((s) => `<source src="${escapeHtml(s.url)}" type="video/mp4">`)
			.join('\n\t\t\t\t');
		const poster = asset.item.poster
			? ` poster="${escapeHtml(asset.item.poster)}"`
			: '';
		const captionText = asset.caption || asset.title || '';
		const credit2 = asset.creditline ? escapeHtml(asset.creditline) : '';
		const captionHtml = captionText
			? `<figcaption>${escapeHtml(captionText)}${credit2 ? ` <span class="credit">${credit2}</span>` : ''}</figcaption>`
			: '';
		return `<figure class="story-asset">
			<video controls preload="metadata"${poster}>
				${sources}
			</video>
			${captionHtml}
		</figure>`;
	}

	// Widgets/other embeds arrive as pre-built HTML (iframes, instagram
	// blockquotes, interactive calculators, etc) — render as provided.
	if (type === 'WIDGET') {
		const html = asset.item.content || '';
		if (!html) return '';
		let out = `<div class="story-embed">${html}`;
		if (asset.caption || asset.title) {
			out += `<figcaption>${escapeHtml(asset.caption || asset.title)}${asset.creditline ? ` <span class="credit">${escapeHtml(asset.creditline)}</span>` : ''}</figcaption>`;
		}
		out += `</div>`;
		return out;
	}

	// Fallback: render the asset url as a link with its title
	return `<figure class="story-asset">
		<a href="${escapeHtml(asset.item.url)}">${caption || escapeHtml(asset.item.url)}</a>
		${figcaption}
	</figure>`;
}

/**
 * Splits the body HTML on paragraph closings (keeping them attached) and
 * injects rendered assets after the paragraph number each asset specifies
 * via showAtParagraph (0 = before the first paragraph).
 */
function interleaveBodyWithAssets(body: string, assets: storyAsset[] | undefined): string {
	if (!assets || assets.length === 0) {
		return body;
	}

	// Index paragraphs: split after every closing </p>
	const paragraphs = body.split(/(?<=<\/p>)/i).filter((chunk) => chunk.trim().length > 0);

	const byParagraph = new Map<number, string[]>();
	for (const asset of assets) {
		const n = Math.max(0, Math.floor(asset.showAtParagraph ?? 0));
		if (!byParagraph.has(n)) byParagraph.set(n, []);
		byParagraph.get(n)!.push(renderAsset(asset));
	}

	let out = '';
	// showAtParagraph: 0 => before the first paragraph
	const beforeFirst = byParagraph.get(0);
	if (beforeFirst) out += beforeFirst.join('\n');
	for (let i = 0; i < paragraphs.length; i++) {
		out += paragraphs[i];
		// showAtParagraph: 1 => after the first paragraph, etc.
		const after = byParagraph.get(i + 1);
		if (after) out += after.join('\n');
	}
	// Assets beyond paragraph count go at the end
	if (paragraphs.length > 0) {
		return out;
	}
	// Body was empty/odd — just show assets
	return [...byParagraph.values()].flat().join('\n');
}

export function renderArticleHtml(
	story: Story,
	storyUrl: string,
	extraHead: string,
	category: string,
): string {
	const title = story.content?.title || story.teaser.title;
	const intro = story.content?.intro || story.teaser.intro;
	const body = story.content?.contentBody?.body ?? '';
	const assets = story.content?.contentBody?.assets ?? [];

	const author = escapeHtml(story.author?.name || story.byline || '');
	const published = formatPublishedDate(story.publishedDate);
	const updated = formatPublishedDate(story.updatedDate);
	const content = interleaveBodyWithAssets(body, assets);
	const needsInstagramScript = assets.some(
		(a) => (a.item?.content || '').includes('instagram-media'),
	);

	return `<!doctype html><html lang="en-NZ"><head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="theme-color" content="#8d1de8">
${extraHead}
	<title>${escapeHtml(title)}</title>
	<style>
		:root { color-scheme: light; }
		* { box-sizing: border-box; }
		body {
			margin: 0;
			font-family: Georgia, 'Times New Roman', serif;
			color: #1a1a1a;
			background: #f4f2ef;
		}
		article {
			max-width: 680px;
			margin: 0 auto;
			padding: 2rem 1rem 4rem;
			background: #fff;
		}
		.kicker {
			font-family: 'Helvetica Neue', Arial, sans-serif;
			font-size: 0.8rem;
			font-weight: 700;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: #8d1de8;
		}
		h1 {
			font-size: 2rem;
			line-height: 1.2;
			margin: 0.4rem 0 0.5rem;
		}
		.intro {
			font-size: 1.15rem;
			color: #444;
			margin: 0 0 1rem;
			font-weight: normal;
		}
		.byline {
			font-family: 'Helvetica Neue', Arial, sans-serif;
			font-size: 0.85rem;
			color: #666;
			border-top: 1px solid #ddd;
			border-bottom: 1px solid #ddd;
			padding: 0.75rem 0;
			margin-bottom: 1.5rem;
		}
		.story-body p {
			line-height: 1.7;
			margin: 0 0 1.1rem;
			font-size: 1.05rem;
		}
		figure.story-asset {
			margin: 1.75rem 0;
		}
		figure.story-asset img, figure.story-asset video {
			width: 100%;
			height: auto;
			display: block;
		}
		figcaption {
			font-family: 'Helvetica Neue', Arial, sans-serif;
			font-size: 0.8rem;
			color: #555;
			margin-top: 0.5rem;
			line-height: 1.4;
		}
		figcaption .credit {
			color: #888;
			display: inline-block;
		}
		figcaption .credit::before {
			content: '\\2014\\00a0';
		}
		.story-embed {
			margin: 1.75rem 0;
		}
		.story-embed iframe, .story-embed video {
			max-width: 100%;
		}
		.story-embed blockquote { margin: 0; }
		.squareup, .twitter-tweet { margin: 0 auto; }
		a { color: #8d1de8; }
		.outbound {
			display: block;
			text-align: center;
			margin-top: 3rem;
			padding-top: 1.5rem;
			border-top: 1px solid #ddd;
			font-family: 'Helvetica Neue', Arial, sans-serif;
			font-size: 0.9rem;
		}
	</style>
</head>
<body>
	<article>
		<div class="kicker">${escapeHtml(category)}</div>
		<h1>${escapeHtml(title)}</h1>
		<p class="intro">${escapeHtml(intro)}</p>
		<div class="byline">${author ? `<span class="author">${author}</span> &middot; ` : ''}
			<time datetime="${escapeHtml(story.publishedDate)}">${published}</time>${updated && updated !== published ? ` &middot; <span>Updated ${updated}</span>` : ''}
		</div>
		<div class="story-body">
			${content}
		</div>
		<span class="outbound">Originally published at <a href="${escapeHtml(storyUrl)}">Stuff</a></span>
	</article>
	${needsInstagramScript ? `<script async src="https://www.instagram.com/embed.js"></script>` : ''}
</body></html>`;
}
