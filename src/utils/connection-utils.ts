import type { Connection, ConnectionType } from "@/types"

/**
 * Determines the connection type based on connection name or ID
 * @param connection - Connection object or name string
 * @returns ConnectionType - Type of the connection
 *
 * @example
 * ```typescript
 * const type = getConnectionType({ id: "udp_123", name: "Udp(127.0.0.1:5000)" })
 * // Returns: "udp"
 * ```
 */
export function getConnectionType(connection: Connection | string): ConnectionType {
  const name = typeof connection === "string" ? connection : connection.name

  if (name.toLowerCase().includes("udp") || name.includes("127.0.0.1") || name.includes("0.0.0.0")) {
    return "udp"
  }

  if (name.toLowerCase().includes("sim") || name.includes("simulation")) {
    return "simulation"
  }

  return "serial"
}

/**
 * Checks if a connection is a UDP connection
 * @param connection - Connection object or name string
 * @returns boolean - True if connection is UDP
 *
 * @example
 * ```typescript
 * const isUdp = isUdpConnection("Udp(127.0.0.1:5000)")
 * // Returns: true
 * ```
 */
export function isUdpConnection(connection: Connection | string): boolean {
  return getConnectionType(connection) === "udp"
}

/**
 * Checks if a connection is a serial connection
 * @param connection - Connection object or name string
 * @returns boolean - True if connection is serial
 *
 * @example
 * ```typescript
 * const isSerial = isSerialConnection("COM3")
 * // Returns: true
 * ```
 */
export function isSerialConnection(connection: Connection | string): boolean {
  return getConnectionType(connection) === "serial"
}

/**
 * Checks if a connection is a simulation connection
 * @param connection - Connection object or name string
 * @returns boolean - True if connection is simulation
 *
 * @example
 * ```typescript
 * const isSim = isSimulationConnection("sim_udp_123")
 * // Returns: true
 * ```
 */
export function isSimulationConnection(connection: Connection | string): boolean {
  return getConnectionType(connection) === "simulation"
}

/**
 * Extracts port information from connection name
 * @param connectionName - Name of the connection
 * @returns string | null - Port information or null if not found
 *
 * @example
 * ```typescript
 * const port = extractPortFromName("Serial(COM3, 115200)")
 * // Returns: "COM3"
 * ```
 */
export function extractPortFromName(connectionName: string): string | null {
  // Serial port pattern: Serial(PORT, BAUD)
  const serialMatch = connectionName.match(/Serial\(([^,]+),/)
  if (serialMatch) {
    return serialMatch[1].trim()
  }

  // UDP pattern: Udp(IP:PORT)
  const udpMatch = connectionName.match(/Udp$$([^)]+)$$/)
  if (udpMatch) {
    return udpMatch[1].trim()
  }

  return null
}

/**
 * Extracts baud rate from serial connection name
 * @param connectionName - Name of the serial connection
 * @returns number | null - Baud rate or null if not found
 *
 * @example
 * ```typescript
 * const baud = extractBaudFromName("Serial(COM3, 115200)")
 * // Returns: 115200
 * ```
 */
export function extractBaudFromName(connectionName: string): number | null {
  const match = connectionName.match(/Serial$$[^,]+,\s*(\d+)$$/)
  if (match) {
    return Number.parseInt(match[1], 10)
  }
  return null
}

/**
 * Formats connection name for display
 * @param connection - Connection object
 * @param maxLength - Maximum length for truncation
 * @returns string - Formatted connection name
 *
 * @example
 * ```typescript
 * const formatted = formatConnectionName(
 *   { id: "conn_123", name: "Serial(COM3, 115200)" },
 *   20
 * )
 * // Returns: "COM3 (115200)"
 * ```
 */
export function formatConnectionName(connection: Connection, maxLength = 30): string {
  const port = extractPortFromName(connection.name)
  const baud = extractBaudFromName(connection.name)
  const type = getConnectionType(connection)

  let formatted = connection.name

  if (type === "serial" && port && baud) {
    formatted = `${port} (${baud})`
  } else if (type === "udp" && port) {
    formatted = `UDP ${port}`
  }

  return formatted.length > maxLength ? formatted.substring(0, maxLength) + "..." : formatted
}

/**
 * Groups connections by type
 * @param connections - Array of connections
 * @returns Record<ConnectionType, Connection[]> - Connections grouped by type
 *
 * @example
 * ```typescript
 * const grouped = groupConnectionsByType(connections)
 * // Returns: { serial: [...], udp: [...], simulation: [...] }
 * ```
 */
export function groupConnectionsByType(connections: Connection[]): Record<ConnectionType, Connection[]> {
  const grouped: Record<ConnectionType, Connection[]> = {
    serial: [],
    udp: [],
    simulation: [],
  }

  for (const connection of connections) {
    const type = getConnectionType(connection)
    grouped[type].push(connection)
  }

  return grouped
}

/**
 * Sorts connections by type and name
 * @param connections - Array of connections to sort
 * @returns Connection[] - Sorted connections
 *
 * @example
 * ```typescript
 * const sorted = sortConnections(connections)
 * ```
 */
export function sortConnections(connections: Connection[]): Connection[] {
  return [...connections].sort((a, b) => {
    const typeA = getConnectionType(a)
    const typeB = getConnectionType(b)

    // Sort by type first (serial, udp, simulation)
    const typeOrder = { serial: 0, udp: 1, simulation: 2 }
    const typeDiff = typeOrder[typeA] - typeOrder[typeB]

    if (typeDiff !== 0) {
      return typeDiff
    }

    // Then sort by name
    return a.name.localeCompare(b.name)
  })
}

/**
 * Filters connections by type
 * @param connections - Array of connections
 * @param type - Connection type to filter by
 * @returns Connection[] - Filtered connections
 *
 * @example
 * ```typescript
 * const udpConnections = filterConnectionsByType(connections, "udp")
 * ```
 */
export function filterConnectionsByType(connections: Connection[], type: ConnectionType): Connection[] {
  return connections.filter((connection) => getConnectionType(connection) === type)
}

/**
 * Validates connection ID format
 * @param connectionId - Connection ID to validate
 * @returns boolean - True if valid format
 *
 * @example
 * ```typescript
 * const isValid = isValidConnectionId("conn_123")
 * // Returns: true
 * ```
 */
export function isValidConnectionId(connectionId: string): boolean {
  return typeof connectionId === "string" && connectionId.length > 0 && connectionId.trim() === connectionId
}

/**
 * Generates a unique connection ID
 * @param prefix - Prefix for the connection ID
 * @returns string - Generated connection ID
 *
 * @example
 * ```typescript
 * const id = generateConnectionId("COM")
 * // Returns: "COM_1234567890123"
 * ```
 */
export function generateConnectionId(prefix: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${timestamp}_${random}`
}
