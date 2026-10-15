/**
 * أسطح «بلا واجهة»: بوّابة الدخول شاشة قائمة بذاتها — يُخفى فيها رأس الموقع
 * والفوتر والشريط السفلي للجوال. مساران فقط بلا استثناءات جزئية:
 * الجذر «/» (بوّابة الزائر) و«/login» (بما فيها الوصول عبر /login?next=…).
 * يعمل على الخادم مع usePathname أثناء SSR فيخفي الرأس من أول بايت — بلا وميض.
 */
export function isGatewayPath(pathname: string | null | undefined): boolean {
  return pathname === '/' || pathname === '/login';
}
