import type { MetadataRoute } from 'next';
import { publicOrigin } from '@/lib/site-url';
// Railway يشغّل بناء الصورة بلا متغيّرات الخدمة، فلو بُني هذا الملف وقت البناء
// لتسرّب العنوان الافتراضي (localhost) إلى ملف منشور. التنفيذ عند الطلب يقرأ
// متغيّرات وقت التشغيل، تمامًا كخريطة الموقع.
export const dynamic = 'force-dynamic';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/login', '/saved'] },
    sitemap: `${publicOrigin()}/sitemap.xml`,
  };
}
