'use client';

import { useCallback, useState } from 'react';

type Props = {
  text: string;
  label?: string;
  className?: string;
};

export function CopyButton({ text, label = 'Copy', className }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [text]);

  return (
    <button
      type="button"
      className={className ?? 'button-copy'}
      onClick={() => void onClick()}
      aria-label={copied ? 'Copied' : `Copy ${label}`}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}
