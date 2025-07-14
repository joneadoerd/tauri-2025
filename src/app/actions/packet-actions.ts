import { sendPacket } from "@/lib/communication-actions"

/**
 * Example packet data for testing
 */
const EXAMPLE_PACKET_DATA = {
  Header: {
    id: 1,
    length: 42,
    checksum: 1234,
    version: 1,
    flags: 0,
  },
  Payload: {
    type_value: 2,
    data: [22],
    size: 5,
    encoding: "utf8",
  },
} as const

/**
 * Sends a header packet to a connection
 * @param connectionId - Target connection ID
 * @throws Error if sending fails
 */
export async function sendHeaderPacket(connectionId: string): Promise<void> {
  try {
    const packet = {
      kind: {
        Header: EXAMPLE_PACKET_DATA.Header,
      },
    }
    await sendPacket(connectionId, packet)
  } catch (error) {
    console.error(`Failed to send header packet to ${connectionId}:`, error)
    throw new Error(`Failed to send header packet: ${error}`)
  }
}

/**
 * Sends a payload packet to a connection
 * @param connectionId - Target connection ID
 * @throws Error if sending fails
 */
export async function sendPayloadPacket(connectionId: string): Promise<void> {
  try {
    const payloadData = EXAMPLE_PACKET_DATA.Payload.data
      ? new Uint8Array(EXAMPLE_PACKET_DATA.Payload.data)
      : new Uint8Array()

    const packet = {
      kind: {
        Payload: {
          ...EXAMPLE_PACKET_DATA.Payload,
          data: payloadData,
        },
      },
    }

    await sendPacket(connectionId, packet)
  } catch (error) {
    console.error(`Failed to send payload packet to ${connectionId}:`, error)
    throw new Error(`Failed to send payload packet: ${error}`)
  }
}

/**
 * Sends a custom packet to a connection
 * @param connectionId - Target connection ID
 * @param packetData - Custom packet data
 * @throws Error if sending fails
 */
export async function sendCustomPacket(connectionId: string, packetData: any): Promise<void> {
  try {
    await sendPacket(connectionId, packetData)
  } catch (error) {
    console.error(`Failed to send custom packet to ${connectionId}:`, error)
    throw new Error(`Failed to send custom packet: ${error}`)
  }
}
