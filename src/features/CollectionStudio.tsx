'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderPlus, Pencil, Trash2 } from 'lucide-react';
import type { Collection } from '@/lib/collections';
import { useApp } from '@/components/AppProvider';
import { Modal } from '@/components/ui/Modal';

type Draft = Pick<
  Collection,
  'slug' | 'kind' | 'title' | 'description' | 'memberCodes' | 'coverCode' | 'active'
>;
const blank: Draft = {
  slug: '',
  kind: 'thematic',
  title: '',
  description: '',
  memberCodes: [],
  coverCode: null,
  active: true,
};

export default function CollectionStudio() {
  const app = useApp();
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [edit, setEdit] = useState(false);
  const [remove, setRemove] = useState<Collection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/collections?scope=admin');
    if (!response.ok) throw Error('تعذّر تحميل المجموعات.');
    setCollections((await response.json()).collections);
  }, []);
  useEffect(() => {
    load().catch((failure) => setError(failure.message));
  }, [load]);
  function patch(change: Partial<Draft>) {
    setDraft((current) => current && { ...current, ...change });
  }
  function toggle(code: string) {
    if (!draft) return;
    const memberCodes = draft.memberCodes.includes(code)
      ? draft.memberCodes.filter((member) => member !== code)
      : [...draft.memberCodes, code];
    patch({
      memberCodes,
      coverCode: memberCodes.includes(draft.coverCode || '')
        ? draft.coverCode
        : memberCodes[0] || null,
    });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/collections', {
        method: edit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'تعذّر حفظ المجموعة.');
      await load();
      router.refresh();
      setDraft(null);
      app.toast(edit ? 'حُفظت المجموعة' : 'نُشرت المجموعة');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'تعذّر حفظ المجموعة.');
    } finally {
      setBusy(false);
    }
  }
  async function destroy() {
    if (!remove) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/collections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: remove.slug }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'تعذّر حذف المجموعة.');
      await load();
      router.refresh();
      setRemove(null);
      app.toast('حُذفت المجموعة؛ الرياكشنات كما هي.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'تعذّر الحذف.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="collection-studio">
      <div className="admin-subtoolbar">
        <p className="muted">أنشئ مجموعات منتقاة. يمكن للرياكشن أن يظهر في أكثر من مجموعة.</p>
        <button
          type="button"
          className="btn btn-dark btn-small"
          onClick={() => {
            setEdit(false);
            setError('');
            setDraft({ ...blank });
          }}
        >
          <FolderPlus size={16} aria-hidden="true" /> مجموعة جديدة
        </button>
      </div>
      {error && !draft && !remove && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-collections-grid">
        {collections.map((collection) => (
          <div className="admin-collection" key={collection.slug}>
            <div className="admin-collection-cover">
              {collection.cover && <Image src={collection.cover} alt="" fill sizes="180px" />}
            </div>
            <div className="admin-collection-copy">
              <strong>{collection.title}</strong>
              <span>
                {collection.count} رياكشن ·{' '}
                {{ thematic: 'موضوعية', person: 'شخصية', place: 'جغرافية' }[collection.kind]} ·{' '}
                {collection.active ? 'منشورة' : 'مسودة'}
              </span>
              <div>
                {collection.active && (
                  <Link href={`/collections/${collection.slug}`} className="text-button">
                    عرض
                  </Link>
                )}
                <button
                  className="icon-btn"
                  aria-label={`تعديل مجموعة ${collection.title}`}
                  onClick={() => {
                    setEdit(true);
                    setError('');
                    setDraft({
                      slug: collection.slug,
                      kind: collection.kind,
                      title: collection.title,
                      description: collection.description,
                      coverCode: collection.coverCode,
                      memberCodes: [...collection.memberCodes],
                      active: collection.active,
                    });
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-btn danger-btn"
                  aria-label={`حذف مجموعة ${collection.title}`}
                  onClick={() => {
                    setError('');
                    setRemove(collection);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {draft && (
        <Modal
          open
          title={edit ? 'تعديل المجموعة' : 'مجموعة جديدة'}
          onClose={() => {
            if (!busy) {
              setDraft(null);
              setError('');
            }
          }}
        >
          <form className="stack-form collection-form" onSubmit={save}>
            <label>
              عنوان المجموعة
              <input
                value={draft.title}
                maxLength={70}
                required
                onChange={(event) => patch({ title: event.target.value })}
                placeholder="مثال: طلاب"
              />
            </label>
            <label>
              الرابط المختصر (أحرف لاتينية)
              <input
                value={draft.slug}
                maxLength={64}
                required
                readOnly={edit}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                dir="ltr"
                onChange={(event) => patch({ slug: event.target.value.toLowerCase() })}
                placeholder="students"
              />
            </label>
            <label>
              نوع المجموعة
              <select
                value={draft.kind}
                onChange={(event) => patch({ kind: event.target.value as Draft['kind'] })}
              >
                <option value="thematic">موضوعية</option>
                <option value="person">شخصية</option>
                <option value="place">جغرافية</option>
              </select>
            </label>
            <label>
              الوصف (اختياري)
              <textarea
                value={draft.description}
                maxLength={300}
                rows={2}
                onChange={(event) => patch({ description: event.target.value })}
              />
            </label>
            <fieldset className="collection-members">
              <legend>رياكشنات المجموعة</legend>
              <div>
                {app.reactions.map((reaction) => (
                  <label key={reaction.code}>
                    <input
                      type="checkbox"
                      checked={draft.memberCodes.includes(reaction.code)}
                      onChange={() => toggle(reaction.code)}
                    />
                    {reaction.caption}
                  </label>
                ))}
              </div>
            </fieldset>
            {draft.memberCodes.length > 0 && (
              <label>
                غلاف المجموعة
                <select
                  value={draft.coverCode || draft.memberCodes[0]}
                  onChange={(event) => patch({ coverCode: event.target.value })}
                >
                  {draft.memberCodes.map((code) => (
                    <option value={code} key={code}>
                      {app.reactions.find((r) => r.code === code)?.caption || code}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => patch({ active: event.target.checked })}
              />{' '}
              نشر المجموعة
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="btn btn-dark" type="submit" disabled={busy}>
              {busy ? 'جارٍ الحفظ…' : 'حفظ المجموعة'}
            </button>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          open
          title="حذف المجموعة؟"
          onClose={() => {
            if (!busy) setRemove(null);
          }}
        >
          <p>ستختفي مجموعة «{remove.title}». لا تُحذف الرياكشنات نفسها.</p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="reaction-actions" style={{ marginTop: 20 }}>
            <button className="btn btn-dark" disabled={busy} onClick={destroy}>
              تأكيد الحذف
            </button>
            <button className="btn btn-outline" disabled={busy} onClick={() => setRemove(null)}>
              إلغاء
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
