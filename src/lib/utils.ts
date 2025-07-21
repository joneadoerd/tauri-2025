import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate a short UUID (8 chars) for connection ids
/**
 * Generate a short connection ID with type prefix and name
 * @param type 'serial' | 'udp'
 * @param name - connection name to include in the ID
 */
export function generateShortId(type: 'serial' | 'udp', name?: string) {
  const short = crypto.randomUUID().split('-')[0];
  let safeName = 'noname';
  if (name) {
    if (type === 'udp') {
      // Replace dots and colons with underscores for UDP addresses
      safeName = name.replace(/[.:]/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    } else {
      // For serial, just remove non-alphanumeric
      safeName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    }
  }
  return `${type}_${safeName}_${short}`;
}
