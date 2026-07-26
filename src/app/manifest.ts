import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nucleus Platform',
    short_name: 'Nucleus',
    description: 'منصة متكاملة لإدارة المنظومة التعليمية',
    start_url: '/',
    display: 'standalone', // الكلمة دي هي اللي بتخفي شريط المتصفح وتخليه تطبيق شاشة كاملة
    background_color: '#ffffff', // لون خلفية التطبيق وهو بيحمل
    theme_color: '#000000', // لون شريط الإشعارات والبطارية فوق
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