import type { PacketData, PacketType } from "@/types"

/**
 * Determines packet type from packet data
 * @param packet - Packet data to analyze
 * @returns PacketType - Classified packet type
 *
 * @example
 * ```typescript
 * const type = getPacketType({ kind: { Header: { id: 1 } } })
 * // Returns: "header"
 * ```
 */
export function getPacketType(packet: any): PacketType {
  if (!packet || typeof packet !== "object") {
    return "other"
  }

  const kind = packet.kind
  if (!kind || typeof kind !== "object") {
    return "other"
  }

  if (kind.Header) return "header"
  if (kind.Payload) return "payload"
  if (kind.Command) return "command"
  if (kind.State) return "state"
  if (kind.TargetPacket) return "TargetPacket"
  if (kind.TargetPacketList) return "TargetPacketList"

  return "other"
}

/**
 * Checks if packet is a target packet
 * @param packet - Packet data to check
 * @returns boolean - True if packet is a target packet
 *
 * @example
 * ```typescript
 * const isTarget = isTargetPacket(packet)
 * ```
 */
export function isTargetPacket(packet: any): boolean {
  return getPacketType(packet) === "TargetPacket"
}

/**
 * Checks if packet is a target packet list
 * @param packet - Packet data to check
 * @returns boolean - True if packet is a target packet list
 *
 * @example
 * ```typescript
 * const isTargetList = isTargetPacketList(packet)
 * ```
 */
export function isTargetPacketList(packet: any): boolean {
  return getPacketType(packet) === "TargetPacketList"
}

/**
 * Extracts target data from target packet
 * @param packet - Target packet data
 * @returns any | null - Target data or null if not a target packet
 *
 * @example
 * ```typescript
 * const targetData = extractTargetData(packet)
 * ```
 */
export function extractTargetData(packet: any): any | null {
  if (!isTargetPacket(packet)) {
    return null
  }

  return packet.kind?.TargetPacket || null
}

/**
 * Extracts target list from target packet list
 * @param packet - Target packet list data
 * @returns any[] | null - Array of targets or null if not a target packet list
 *
 * @example
 * ```typescript
 * const targets = extractTargetList(packet)
 * ```
 */
export function extractTargetList(packet: any): any[] | null {
  if (!isTargetPacketList(packet)) {
    return null
  }

  const targetPacketList = packet.kind?.TargetPacketList
  return Array.isArray(targetPacketList?.packets) ? targetPacketList.packets : null
}

/**
 * Calculates packet size estimate
 * @param packet - Packet data
 * @returns number - Estimated size in bytes
 *
 * @example
 * ```typescript
 * const size = estimatePacketSize(packet)
 * ```
 */
export function estimatePacketSize(packet: any): number {
  try {
    const jsonString = JSON.stringify(packet)
    return new Blob([jsonString]).size
  } catch (error) {
    return 0
  }
}

/**
 * Validates packet structure
 * @param packet - Packet data to validate
 * @returns boolean - True if packet has valid structure
 *
 * @example
 * ```typescript
 * const isValid = isValidPacket(packet)
 * ```
 */
export function isValidPacket(packet: any): boolean {
  if (!packet || typeof packet !== "object") {
    return false
  }

  // Check for basic packet structure
  return true // Basic validation - can be extended
}

/**
 * Creates a packet fingerprint for deduplication
 * @param packet - Packet data
 * @param connectionId - Connection ID
 * @param timestamp - Packet timestamp
 * @returns string - Unique packet fingerprint
 *
 * @example
 * ```typescript
 * const fingerprint = createPacketFingerprint(packet, "conn_123", Date.now())
 * ```
 */
export function createPacketFingerprint(packet: any, connectionId: string, timestamp: number): string {
  try {
    const packetString = JSON.stringify(packet)
    return `${connectionId}_${packetString}_${timestamp}`
  } catch (error) {
    return `${connectionId}_invalid_${timestamp}`
  }
}

/**
 * Filters packets by type
 * @param packets - Array of packet data
 * @param type - Packet type to filter by
 * @returns PacketData[] - Filtered packets
 *
 * @example
 * ```typescript
 * const headerPackets = filterPacketsByType(packets, "header")
 * ```
 */
export function filterPacketsByType(packets: PacketData[], type: PacketType): PacketData[] {
  return packets.filter((packetData) => packetData.packetType === type)
}

/**
 * Groups packets by type
 * @param packets - Array of packet data
 * @returns Record<PacketType, PacketData[]> - Packets grouped by type
 *
 * @example
 * ```typescript
 * const grouped = groupPacketsByType(packets)
 * ```
 */
export function groupPacketsByType(packets: PacketData[]): Record<string, PacketData[]> {
  const grouped: Record<string, PacketData[]> = {}

  for (const packetData of packets) {
    const type = packetData.packetType || "other"
    if (!grouped[type]) {
      grouped[type] = []
    }
    grouped[type].push(packetData)
  }

  return grouped
}

/**
 * Calculates packet statistics
 * @param packets - Array of packet data
 * @returns Object with packet statistics
 *
 * @example
 * ```typescript
 * const stats = calculatePacketStats(packets)
 * // Returns: { total: 100, byType: { header: 50, payload: 50 }, ... }
 * ```
 */
export function calculatePacketStats(packets: PacketData[]) {
  const stats = {
    total: packets.length,
    byType: {} as Record<string, number>,
    timeRange: {
      start: 0,
      end: 0,
      duration: 0,
    },
    averageSize: 0,
    totalSize: 0,
  }

  if (packets.length === 0) {
    return stats
  }

  // Calculate type distribution
  const grouped = groupPacketsByType(packets)
  for (const [type, typePackets] of Object.entries(grouped)) {
    stats.byType[type] = typePackets.length
  }

  // Calculate time range
  const timestamps = packets.map((p) => p.timestamp).sort((a, b) => a - b)
  stats.timeRange.start = timestamps[0]
  stats.timeRange.end = timestamps[timestamps.length - 1]
  stats.timeRange.duration = stats.timeRange.end - stats.timeRange.start

  // Calculate size statistics
  let totalSize = 0
  for (const packetData of packets) {
    const size = estimatePacketSize(packetData.packet)
    totalSize += size
  }
  stats.totalSize = totalSize
  stats.averageSize = totalSize / packets.length

  return stats
}

/**
 * Formats packet for display
 * @param packet - Packet data to format
 * @param maxDepth - Maximum nesting depth for JSON
 * @returns string - Formatted packet string
 *
 * @example
 * ```typescript
 * const formatted = formatPacketForDisplay(packet, 3)
 * ```
 */
export function formatPacketForDisplay(packet: any, maxDepth = 3): string {
  try {
    return JSON.stringify(packet, null, 2)
  } catch (error) {
    return "Invalid packet data"
  }
}

/**
 * Extracts packet metadata
 * @param packet - Packet data
 * @returns Object with packet metadata
 *
 * @example
 * ```typescript
 * const metadata = extractPacketMetadata(packet)
 * ```
 */
export function extractPacketMetadata(packet: any) {
  return {
    type: getPacketType(packet),
    size: estimatePacketSize(packet),
    fieldCount: Object.keys(packet).length,
    hasKind: Boolean(packet.kind),
    isValid: isValidPacket(packet),
  }
}
