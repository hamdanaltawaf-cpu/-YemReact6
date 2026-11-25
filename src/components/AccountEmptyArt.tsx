import { Bookmark, Send } from 'lucide-react';

/** A decorative stack of reaction cards, not a representation of account data. */
export function AccountEmptyArt({ kind }: { kind: 'saved' | 'contributions' }) {
  return (
    <div className={`account-empty-art account-empty-art-${kind}`} aria-hidden="true">
      <span className="account-art-sheet account-art-back" />
      <span className="account-art-sheet account-art-middle">
        <i />
        <i />
      </span>
      <span className="account-art-sheet account-art-front">
        {kind === 'saved' ? <Bookmark size={28} /> : <Send size={27} />}
      </span>
      <span className="account-art-spark">✦</span>
      <span className="account-art-dot" />
    </div>
  );
}
