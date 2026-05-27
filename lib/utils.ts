import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  locale = "en-US",
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatCurrency(
  amount: number,
  currency = "USD",
  locale = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
