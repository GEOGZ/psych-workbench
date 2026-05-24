'use client';
import { useRef } from 'react';

export function ImeInput({ onChange, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const composing = useRef(false);
  return (
    <input
      {...props}
      onChange={e => { if (!composing.current) onChange?.(e); }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={e => {
        composing.current = false;
        onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>);
      }}
    />
  );
}

export function ImeTextarea({ onChange, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const composing = useRef(false);
  return (
    <textarea
      {...props}
      onChange={e => { if (!composing.current) onChange?.(e); }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={e => {
        composing.current = false;
        onChange?.(e as unknown as React.ChangeEvent<HTMLTextAreaElement>);
      }}
    />
  );
}
