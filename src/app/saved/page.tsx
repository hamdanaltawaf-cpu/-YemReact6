import Saved from '@/features/Saved';
export const metadata = {
  title: 'المحفوظات',
  description: 'الصور والفيديوهات التي احتفظت بها، في مكان واحد.',
  robots: { index: false },
};
export default function Page() {
  return <Saved />;
}
