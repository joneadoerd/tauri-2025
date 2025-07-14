export function isValidIP(ip: string): boolean {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  return ipRegex.test(ip)
}

/**
 * Validates if a string is a valid port number
 * @param port - Port number string to validate
 * @returns True if valid port number (1-65535)
 *
 * @example
 * ```typescript
 * isValidPort("8080") // true
 * isValidPort("70000") // false
 * ```
 */
export function isValidPort(port: string): boolean {
  const portNum = Number.parseInt(port, 10)
  return !isNaN(portNum) && portNum >= 1 && portNum <= 65535
}

/**
 * Validates if a string is a valid IP:Port combination
 * @param address - Address string to validate (format: "IP:PORT")
 * @returns True if valid IP:Port combination
 *
 * @example
 * ```typescript
 * isValidAddress("192.168.1.1:8080") // true
 * isValidAddress("invalid:port") // false
 * ```
 */
export function isValidAddress(address: string): boolean {
  const parts = address.split(":")
  if (parts.length !== 2) return false

  const [ip, port] = parts
  return isValidIP(ip) && isValidPort(port)
}

/**
 * Validates if a baud rate is valid
 * @param baud - Baud rate to validate
 * @returns True if valid baud rate
 *
 * @example
 * ```typescript
 * isValidBaudRate(115200) // true
 * isValidBaudRate(123) // false
 * ```
 */
export function isValidBaudRate(baud: number): boolean {
  const validBaudRates = [
    110, 300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200, 230400, 460800, 921600,
  ]
  return validBaudRates.includes(baud)
}

/**
 * Validates if an interval is within acceptable range
 * @param interval - Interval in milliseconds
 * @param min - Minimum allowed interval (default: 1)
 * @param max - Maximum allowed interval (default: 60000)
 * @returns True if interval is valid
 *
 * @example
 * ```typescript
 * isValidInterval(1000) // true
 * isValidInterval(0) // false
 * ```
 */
export function isValidInterval(interval: number, min = 1, max = 60000): boolean {
  return !isNaN(interval) && interval >= min && interval <= max
}

/**
 * Validates if a connection ID is valid format
 * @param id - Connection ID to validate
 * @returns True if valid connection ID format
 *
 * @example
 * ```typescript
 * isValidConnectionId("COM_123") // true
 * isValidConnectionId("") // false
 * ```
 */
export function isValidConnectionId(id: string): boolean {
  return typeof id === "string" && id.length > 0 && id.trim() === id
}
