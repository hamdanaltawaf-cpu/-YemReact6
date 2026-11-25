import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AccountEmptyArt } from './AccountEmptyArt';

/** No production contributions service exists; never present mock records as real. */
export function AccountContributions() {
  return (
    <div className="account-empty account-empty-feature">
      <div className="account-empty-copy">
        <span className="account-empty-kicker">مساحة المساهمة</span>
        <strong>متابعة المساهمات الحقيقية غير متاحة حاليًا.</strong>
        <p>الإرسالات المتاحة الآن تجربة محلية فقط؛ ليست ملفات مرسلة أو قرارات نشر حقيقية.</p>
        <Link href="/account/submissions" className="btn btn-dark">
          عرض الإرسالات التجريبية <ArrowLeft size={16} aria-hidden="true" />
        </Link>
      </div>
      <AccountEmptyArt kind="contributions" />
    </div>
  );
}
