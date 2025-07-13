import { sendPacket } from "@/lib/serial"

const exampleData: Record<string, any> = {
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
}

export async function sendHeaderPacket(id: string) {
  const packet = { kind: { Header: exampleData.Header } }
  await sendPacket(id, packet)
}

export async function sendPayloadPacket(id: string) {
  const payloadData = exampleData.Payload.data ? new Uint8Array(exampleData.Payload.data) : new Uint8Array()

  const packet = {
    kind: {
      Payload: {
        ...exampleData.Payload,
        data: payloadData,
      },
    },
  }
  await sendPacket(id, packet)
}
