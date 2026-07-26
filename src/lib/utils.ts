/**
 * Extracts YouTube video ID from various URL formats and returns the embed URL.
 * Supports:
 * - Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
 * - Shortened URL: https://youtu.be/VIDEO_ID
 * - Existing embed URL: https://www.youtube.com/embed/VIDEO_ID
 * - Shorts URL: https://www.youtube.com/shorts/VIDEO_ID
 * 
 * @param url - The YouTube URL in any format
 * @returns The embed URL with proper parameters, or null if invalid
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Regex patterns for different YouTube URL formats
  const patterns = [
    // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    // Shortened URL: https://youtu.be/VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Existing embed URL: https://www.youtube.com/embed/VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Shorts URL: https://www.youtube.com/shorts/VIDEO_ID
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      const videoId = match[1];
      return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
    }
  }

  return null;
}
