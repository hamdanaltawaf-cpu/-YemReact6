import type { CategoryId } from './categories';
/** A library item. Demo clips are explicitly identified in every viewing surface. */
export type Reaction = {
  code: string;
  caption: string;
  situation: string;
  category: CategoryId;
  duration: number;
  keywords: string[];
  publishedAt: string;
  corner: 'tr' | 'tl';
  gradient: string;
  poster: string;
  media: string;
  isDemo: boolean;
};
const rows: [string, string, CategoryId, number, string[]][] = [
  ['يا ساتر!', 'لما تسمع خبر صادم', 'shock', 3, ['خبر', 'صدمة', 'مفاجأة']],
  ['عاد شي عقل؟', 'لما حد يقولك كلام مالوش داعي', 'reject', 3, ['رفض', 'كلام', 'عقل']],
  ['قوية... قوية جدًا', 'لما حد يسولف عليك', 'sarcasm', 4, ['سخرية', 'تعليق', 'قوية']],
  ['قوية!', 'لما فريقك يسجل هدف', 'hype', 3, ['حماس', 'فرح', 'رياضة', 'هدف']],
  ['صلّي على النبي', 'لما تشوف شي ما تصدق عيونك', 'surprise', 4, ['استغراب', 'انبهار']],
  ['ياخي وربي', 'لما صاحبك يقع بموقف محرج', 'laugh', 3, ['ضحك', 'موقف']],
  ['...', 'لما ما تلقى رد على كلامك', 'embarrass', 3, ['إحراج', 'صمت']],
  ['برضه؟', 'لما صاحبك يقول بكرة أسددلك', 'reject', 3, ['رفض', 'دين', 'بكرة']],
  ['معك حق', 'لما حد يقنعك بفكرة', 'approve', 3, ['موافقة', 'اقتناع']],
  ['كفاية!', 'لما حد يضيّع وقتك', 'anger', 3, ['غضب', 'ضيق']],
  ['بس بس بس', 'لما واحد يمزح وما يوقف', 'laugh', 3, ['ضحك', 'هزار']],
  ['يووه!', 'لما تسمع خبر يفرحك', 'hype', 3, ['حماس', 'فرح']],
];
const portraits = [1, 3, 3, 6, 1, 2, 5, 5, 4, 5, 2, 6];
export const REACTIONS: Reaction[] = rows.map((r, i) => ({
  code: `YR-${String(i + 1).padStart(4, '0')}`,
  caption: r[0],
  situation: r[1],
  category: r[2],
  duration: [2, 3, 4, 3, 5, 2][portraits[i] - 1],
  keywords: r[4],
  publishedAt: `2026-09-${String(i + 1).padStart(2, '0')}`,
  corner: i % 2 ? 'tl' : 'tr',
  gradient: 'linear-gradient(155deg,#392b24,#171211)',
  poster: `/media/portrait-${portraits[i]}.webp`,
  media: `/media/demo-${portraits[i]}.mp4`,
  isDemo: true,
}));
export const getReaction = (code: string) => REACTIONS.find((r) => r.code === code);
/** Normalize common Arabic spelling variants without changing the displayed text. */
export const normalizeArabic = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
export function filterReactions(
  items: Reaction[],
  q: string,
  cat = '',
  sort = 'newest',
  maxDuration = 8,
) {
  const words = normalizeArabic(q).split(/\s+/).filter(Boolean);
  return items
    .filter(
      (r) =>
        (!cat || r.category === cat) &&
        r.duration <= maxDuration &&
        words.every((w) =>
          normalizeArabic([r.caption, r.situation, r.code, ...r.keywords].join(' ')).includes(w),
        ),
    )
    .sort((a, b) =>
      sort === 'shortest'
        ? a.duration - b.duration
        : sort === 'oldest'
          ? a.publishedAt.localeCompare(b.publishedAt)
          : b.publishedAt.localeCompare(a.publishedAt),
    );
}
export const searchReactions = (q: string, cat?: string) => filterReactions(REACTIONS, q, cat);
