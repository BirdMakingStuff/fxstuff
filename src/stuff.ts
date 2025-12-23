
interface Story {
  type: string;
  teaser: {
    title: string;
    intro: string;
    image: {
      id: string;
      alt: string;
      url: string;
    }
  }
}

export async function requestStory(storyId: number): Promise<Story> {
  const response = await fetch(`https://www.stuff.co.nz/api/v1.0/stuff/story/${storyId}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  const data = await response.json();
  return data as Story;
}