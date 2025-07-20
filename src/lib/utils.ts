import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate a short UUID (8 chars) for connection ids
/**
 * Generate a short connection ID with type prefix
 * @param type 'serial' | 'udp'
 */
export function generateShortId(type: 'serial' | 'udp') {
  const short = crypto.randomUUID().split('-')[0];
  return `${type}_${short}`;
}
