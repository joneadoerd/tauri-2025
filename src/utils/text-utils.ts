export function truncateText(text: string, maxLength = 30): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}

/**
 * Formats a timestamp to a readable time string
 * @param timestamp - Timestamp in milliseconds
 * @returns Formatted time string
 *
 * @example
 * ```typescript
 * formatTimestamp(Date.now()) // "14:30:25"
 * ```
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

/**
 * Formats a timestamp to a readable date and time string
 * @param timestamp - Timestamp in milliseconds
 * @returns Formatted date and time string
 *
 * @example
 * ```typescript
 * formatDateTime(Date.now()) // "2024-01-15 14:30:25"
 * ```
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
}

/**
 * Capitalizes the first letter of a string
 * @param text - Text to capitalize
 * @returns Text with first letter capitalized
 *
 * @example
 * ```typescript
 * capitalize("hello world") // "Hello world"
 * ```
 */
export function capitalize(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Converts camelCase or PascalCase to readable text
 * @param text - Text to convert
 * @returns Human-readable text
 *
 * @example
 * ```typescript
 * camelToReadable("targetPacketList") // "Target Packet List"
 * ```
 */
export function camelToReadable(text: string): string {
  if (!text) return text
  return text
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

/**
 * Formats bytes to human readable format
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted byte string
 *
 * @example
 * ```typescript
 * formatBytes(1024) // "1.00 KB"
 * formatBytes(1048576) // "1.00 MB"
 * ```
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}
