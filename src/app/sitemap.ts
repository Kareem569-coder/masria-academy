import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://nucleus-platform-delta.vercel.app',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    // تقدر تضيف أي روابط لصفحات تانية جوه المنصة بنفس الشكل هنا
  ];
}