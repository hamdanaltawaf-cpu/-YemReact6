import Link from 'next/link';
import { Qusasa } from '@/components/Qusasa';
export default function NotFound() {
  return (
    <section className="container page-section empty-state">
      <Qusasa size={70} />
      <span className="mono">404 / NOT FOUND</span>
      <h1>عاد وين راحت؟</h1>
      <p>الصفحة أو اللقطة مش موجودة. يمكن تغيّر رابطها، بس في المكتبة ردود كثيرة.</p>
      <Link className="btn btn-dark" href="/library">
        ارجع للمكتبة
      </Link>
    </section>
  );
}
