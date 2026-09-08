import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MASRIA',
    short_name: 'MASRIA',
    description: 'MASRIA Academy for software engineering and programming education.',
    start_url: '/',
    display: 'standalone',
    background_color: '#080c14',
    theme_color: '#06b6d4',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}