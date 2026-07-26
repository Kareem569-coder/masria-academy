import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // السطر اللي جاي ده بيمنع جوجل من أرشفة أي صفحة داخلية أو لوحة تحكم
      disallow: [
        '/teacher-dashboard/',
        '/student-dashboard/',
        '/parent-dashboard/',
        '/api/',
      ],
    },
    sitemap: 'https://nucleus-platform-delta.vercel.app/sitemap.xml',
  };
}