import Home from '@/features/Home';
export const metadata = { alternates: { canonical: '/' } };
export default function Page() {
  const url = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'YemReact — يمن رياكت',
    url,
    inLanguage: 'ar',
    description: 'مكتبة رياكشنات يمنية بالموقف. النماذج التجريبية معلّمة بوضوح.',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: url + '/library?q={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
      />
      <Home />
    </>
  );
}
