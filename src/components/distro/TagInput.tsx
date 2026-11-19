import { useState } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** id d'un <datalist> pour proposer les artistes existants */
  listId?: string;
}

/** Saisie par tags : tapez un nom puis "," ou Entrée (ex : Drake, Kanye West). */
export function TagInput({ value, onChange, placeholder, listId }: TagInputProps) {
  const [text, setText] = useState('');

  const addMany = (raw: string) => {
    const parts = raw
      .split(',')
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) {
      if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next);
  };

  const commit = () => {
    if (text.trim()) addMany(text);
    setText('');
  };

  return (
    <div
      className="field flex min-h-[46px] flex-wrap items-center gap-1.5 !py-1.5 focus-within:!border-accent focus-within:shadow-[0_0_0_3px_rgb(var(--accent)/0.22)]"
      onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}
    >
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent/15 py-1 pl-3 pr-1.5 text-xs font-semibold text-accent">
          {tag}
          <button
            type="button"
            aria-label={`Retirer ${tag}`}
            className="grid h-4 w-4 place-items-center rounded-full hover:bg-accent/25"
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            <X size={11} strokeWidth={3} />
          </button>
        </span>
      ))}
      <input
        value={text}
        list={listId}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[120px] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted/70"
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) {
            addMany(v);
            setText('');
          } else {
            setText(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}
