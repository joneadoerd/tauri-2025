import { startUdpTargetShare, stopShare, listActiveShares, listUdpTargets } from "@/lib/communication-actions"
import type { UdpShareParams, ActiveShare } from "@/types"

/**
 * Starts a UDP target share with validation and error handling
 * @param params - UDP share parameters
 * @returns Promise<string> Share ID
 * @throws Error if share fails to start
 *
 * @example
 * ```typescript
 * const shareId = await startTargetShare({
 *   udpConnectionId: "udp_123",
 *   targetId: 42,
 *   destConnectionId: "serial_456",
 *   intervalMs: 1000
 * })
 * ```
 */
export async function startTargetShare(params: UdpShareParams): Promise<string> {
  try {
    // Validate parameters
    if (!params.udpConnectionId || !params.destConnectionId) {
      throw new Error("Source and destination connection IDs are required")
    }

    if (params.targetId < 0) {
      throw new Error("Target ID must be non-negative")
    }

    if (params.intervalMs < 1 || params.intervalMs > 60000) {
      throw new Error("Interval must be between 1ms and 60000ms")
    }

    // Check if targets exist for the source connection
    const targets = await listUdpTargets(params.udpConnectionId)
    const targetExists = targets.some((t) => t.target_id === params.targetId)

    if (!targetExists) {
      throw new Error(`Target ${params.targetId} not found in source connection`)
    }

    const shareId = await startUdpTargetShare(params)
    console.log(`Target share started: ${shareId}`)
    return shareId
  } catch (error) {
    console.error("Failed to start target share:", error)
    throw new Error(`Failed to start target share: ${error}`)
  }
}

/**
 * Stops a data share with cleanup
 * @param shareId - ID of share to stop
 * @param connectionId - Connection ID associated with the share
 * @throws Error if share fails to stop
 *
 * @example
 * ```typescript
 * await stopTargetShare("share_123", "conn_456")
 * ```
 */
export async function stopTargetShare(shareId: string, connectionId: string): Promise<void> {
  try {
    await stopShare(shareId, connectionId)
    console.log(`Target share stopped: ${shareId}`)
  } catch (error) {
    console.error("Failed to stop target share:", error)
    throw new Error(`Failed to stop share ${shareId}: ${error}`)
  }
}

/**
 * Gets all active shares with enhanced information
 * @returns Promise<ActiveShare[]> Array of active shares
 * @throws Error if fetching fails
 *
 * @example
 * ```typescript
 * const shares = await getAllActiveShares()
 * ```
 */
export async function getAllActiveShares(): Promise<ActiveShare[]> {
  try {
    const shareData = await listActiveShares()
    return shareData.map(([shareId, connectionId]) => ({
      shareId,
      connectionId,
    }))
  } catch (error) {
    console.error("Failed to get active shares:", error)
    throw new Error(`Failed to get active shares: ${error}`)
  }
}

/**
 * Stops all active shares for a specific connection
 * @param connectionId - Connection ID to stop shares for
 * @returns Promise<number> Number of shares stopped
 * @throws Error if operation fails
 *
 * @example
 * ```typescript
 * const stoppedCount = await stopAllSharesForConnection("conn_123")
 * ```
 */
export async function stopAllSharesForConnection(connectionId: string): Promise<number> {
  try {
    const allShares = await getAllActiveShares()
    const connectionShares = allShares.filter((share) => share.connectionId === connectionId)

    let stoppedCount = 0
    const errors: string[] = []

    for (const share of connectionShares) {
      try {
        await stopTargetShare(share.shareId, share.connectionId)
        stoppedCount++
      } catch (error) {
        errors.push(`Failed to stop share ${share.shareId}: ${error}`)
      }
    }

    if (errors.length > 0) {
      console.warn("Some shares failed to stop:", errors)
    }

    console.log(`Stopped ${stoppedCount} shares for connection ${connectionId}`)
    return stoppedCount
  } catch (error) {
    console.error("Failed to stop shares for connection:", error)
    throw new Error(`Failed to stop shares for connection ${connectionId}: ${error}`)
  }
}

/**
 * Checks if a connection has any active shares
 * @param connectionId - Connection ID to check
 * @returns Promise<boolean> True if connection has active shares
 *
 * @example
 * ```typescript
 * const hasShares = await connectionHasActiveShares("conn_123")
 * ```
 */
export async function connectionHasActiveShares(connectionId: string): Promise<boolean> {
  try {
    const allShares = await getAllActiveShares()
    return allShares.some((share) => share.connectionId === connectionId)
  } catch (error) {
    console.error("Failed to check connection shares:", error)
    return false
  }
}

/**
 * Gets the count of active shares for a connection
 * @param connectionId - Connection ID to count shares for
 * @returns Promise<number> Number of active shares
 *
 * @example
 * ```typescript
 * const shareCount = await getActiveShareCount("conn_123")
 * ```
 */
export async function getActiveShareCount(connectionId: string): Promise<number> {
  try {
    const allShares = await getAllActiveShares()
    return allShares.filter((share) => share.connectionId === connectionId).length
  } catch (error) {
    console.error("Failed to get share count:", error)
    return 0
  }
}

/**
 * Validates share parameters before starting
 * @param params - Share parameters to validate
 * @returns Promise<string[]> Array of validation errors (empty if valid)
 *
 * @example
 * ```typescript
 * const errors = await validateShareParams(params)
 * if (errors.length > 0) {
 *   console.error("Validation errors:", errors)
 * }
 * ```
 */
export async function validateShareParams(params: UdpShareParams): Promise<string[]> {
  const errors: string[] = []

  try {
    // Basic parameter validation
    if (!params.udpConnectionId) {
      errors.push("UDP connection ID is required")
    }

    if (!params.destConnectionId) {
      errors.push("Destination connection ID is required")
    }

    if (params.targetId < 0) {
      errors.push("Target ID must be non-negative")
    }

    if (params.intervalMs < 1 || params.intervalMs > 60000) {
      errors.push("Interval must be between 1ms and 60000ms")
    }

    // Check for duplicate shares
    if (params.udpConnectionId && params.destConnectionId) {
      const allShares = await getAllActiveShares()
      const isDuplicate = allShares.some((share) => share.connectionId === params.destConnectionId)

      if (isDuplicate) {
        errors.push("A share to this destination already exists")
      }
    }

    // Validate target exists
    if (params.udpConnectionId && params.targetId >= 0) {
      try {
        const targets = await listUdpTargets(params.udpConnectionId)
        const targetExists = targets.some((t) => t.target_id === params.targetId)

        if (!targetExists) {
          errors.push(`Target ${params.targetId} not found in source connection`)
        }
      } catch (error) {
        errors.push("Failed to validate target existence")
      }
    }
  } catch (error) {
    errors.push("Failed to validate share parameters")
  }

  return errors
}
