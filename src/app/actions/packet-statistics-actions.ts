import { 
  getPacketStatistics as getPacketStatsFromLib,
  resetPacketCounters as resetPacketCountersFromLib,
  getTotalPacketsReceived as getTotalPacketsReceivedFromLib,
  getTotalPacketsSent as getTotalPacketsSentFromLib,
  getConnectionPacketCounts as getConnectionPacketCountsFromLib,
  getConnectionCount as getConnectionCountFromLib
} from "@/lib/communication-actions"
import { invoke } from "@tauri-apps/api/core"

export interface PacketStatistics {
  total_received: number
  total_sent: number
  connection_count: number
  connection_counts: Record<string, { received: number; sent: number }>
}

export interface ConnectionPacketCounts {
  [connectionId: string]: { received: number; sent: number }
}

/**
 * Get comprehensive packet statistics from backend
 * This replaces multiple individual calls with a single consolidated call
 */
export async function getPacketStatistics(): Promise<PacketStatistics> {
  return getPacketStatsFromLib()
}

/**
 * Reset all packet counters
 */
export async function resetPacketCounters(): Promise<void> {
  return resetPacketCountersFromLib()
}

/**
 * Get total packets received (legacy function for backward compatibility)
 */
export async function getTotalPacketsReceived(): Promise<number> {
  return getTotalPacketsReceivedFromLib()
}

/**
 * Get total packets sent (legacy function for backward compatibility)
 */
export async function getTotalPacketsSent(): Promise<number> {
  return getTotalPacketsSentFromLib()
}

/**
 * Get connection packet counts (legacy function for backward compatibility)
 */
export async function getConnectionPacketCounts(): Promise<ConnectionPacketCounts> {
  return getConnectionPacketCountsFromLib()
}

/**
 * Get connection count (legacy function for backward compatibility)
 */
export async function getConnectionCount(): Promise<number> {
  return getConnectionCountFromLib()
} 