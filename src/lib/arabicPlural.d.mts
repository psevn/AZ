export type ArabicCountForms = {
  zero: string;
  one: string;
  two: string;
  few: string;
  many: string;
};

export function formatArabicCount(count: number, forms: ArabicCountForms): string;
