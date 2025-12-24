import { getImageSize, requestStory } from "./stuff";

export async function handleOembed(request: Request): Promise<Response> {
	const parsedUrl = new URL(request.url);
	const url = parsedUrl.searchParams.get('url');
	
	if (!url) {
		return new Response('Missing url parameter', { status: 400 });
	}
	
	// Parse the story URL
	const storyUrl = new URL(url);
	const m = storyUrl.pathname.match(/^\/([^\/]+)\/([1-9][0-9]*)\/([^\/]+)\/?$/);
	if (!m) {
		return new Response('Invalid URL format', { status: 400 });
	}
	
	const urlMatch = { category: m[1], id: Number(m[2]), urlTitle: m[3] };
	const story = await requestStory(urlMatch.id);
	
	// Build oEmbed response
	const oembedResponse: any = {
		author_name: story.author.name,
		author_url: `https://www.stuff.co.nz${story.author.url}`,
		provider_name: "FxStuff by BirdMakingStuff",
		provider_url: "https://birdmakingstuff.nz",
		provider_icon_url: "https://www.stuff.co.nz/assets/icon/Favicon-Stuff-32x32.png",
		title: story.teaser.title,
		type: "rich",
		version: "1.0"
	};
	
	// Add teaser image if it exists
	if (story.teaser.image?.url) {
		const imageSize = await getImageSize(story.teaser.image.url);
		oembedResponse.thumbnail_url = story.teaser.image.url;
		if (imageSize) {
			oembedResponse.thumbnail_width = imageSize.width;
			oembedResponse.thumbnail_height = imageSize.height;
      oembedResponse.width = imageSize.width;
      oembedResponse.height = imageSize.height;
		}
	}
	
	return new Response(JSON.stringify(oembedResponse), {
		headers: { 'content-type': 'application/json; charset=utf-8' }
	});
}
