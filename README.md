# Serial Monitor Application

A comprehensive real-time serial communication monitoring application built with React, TypeScript, and Tauri. This application provides advanced packet monitoring, UDP streaming, data sharing, and simulation capabilities.

## 🚀 Features

### Core Functionality
- **Real-time Serial Communication**: Monitor multiple serial ports simultaneously
- **UDP Data Streaming**: Handle UDP connections and data streaming
- **Packet Analysis**: Real-time packet parsing and visualization
- **Data Sharing**: Share data between different connections
- **Simulation Support**: Built-in simulation data streaming
- **Log Management**: Comprehensive logging and log file management

### Advanced Features
- **Multi-connection Support**: Handle multiple serial and UDP connections
- **Target Sharing**: Share specific targets between UDP and serial connections
- **Packet Filtering**: Filter and analyze different packet types
- **Real-time Statistics**: Live packet counters and performance metrics
- **Export Capabilities**: Export logs and data for analysis

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Rust** (latest stable version)
- **Tauri CLI** (`cargo install tauri-cli`)
- **Operating System**: Windows, macOS, or Linux

## 🛠️ Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd serial-monitor
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Build the application**
   \`\`\`bash
   npm run tauri build
   \`\`\`

4. **Run in development mode**
   \`\`\`bash
   npm run tauri dev
   \`\`\`

## 📖 Usage Guide

### Basic Serial Connection

1. **Connect to Serial Port**
   \`\`\`typescript
   // Using the connection form
   await connect("COM", "COM3", 115200, "Header")
   \`\`\`

2. **Monitor Packets**
   - Packets appear in real-time in the packet display
   - Different packet types are color-coded
   - Statistics are updated automatically

### UDP Operations

1. **Start UDP Listener**
   \`\`\`typescript
   // Add UDP listener
   await addUdpListener("127.0.0.1:5000")
   \`\`\`

2. **Share UDP Targets**
   \`\`\`typescript
   // Share target data between connections
   await startUdpShare(sourceId, targetId, destId, interval)
   \`\`\`

### Data Management

1. **View Logs**
   - Click "Load Log" on any connection
   - Logs are displayed in scrollable format
   - Export logs for external analysis

2. **Clear Data**
   - Clear individual connection data
   - Clear all data across connections
   - Reset packet counters

## 🏗️ Architecture

### Component Structure

\`\`\`
src/
├── components/           # Reusable UI components
│   ├── connection-form.tsx
│   ├── packet-display.tsx
│   ├── connection-list.tsx
│   └── ...
├── hooks/               # Custom React hooks
│   ├── use-serial-connections.ts
│   ├── use-packet-data.ts
│   └── ...
├── lib/                 # Core library functions
│   ├── communication-actions.ts
│   └── log-actions.ts
├── actions/             # Action functions
│   └── packet-actions.ts
├── types/               # TypeScript type definitions
│   └── index.ts
├── utils/               # Utility functions
│   ├── text-utils.ts
│   └── validation-utils.ts
└── serial-tab-general.tsx  # Main application component
\`\`\`

### Key Components

#### ConnectionForm
Handles serial port connections and configuration.

\`\`\`typescript
interface ConnectionFormProps {
  ports: string[]
  onConnect: (prefix: string, port: string, baud: number, packetType: string) => Promise<void>
  onInitComs: () => Promise<void>
  onRefresh: () => Promise<void>
  refreshing: boolean
}
\`\`\`

#### PacketDisplay
Real-time packet visualization and analysis.

\`\`\`typescript
interface PacketDisplayProps {
  data: Record<string, PacketData[]>
  packetCounts: Record<string, PacketCounts>
  onClearAll: () => void
  onClearCurrent: (id: string) => void
}
\`\`\`

#### ConnectionList
Manages active connections and their operations.

### Custom Hooks

#### useSerialConnections
Manages serial port connections and operations.

\`\`\`typescript
const {
  ports,
  connections,
  refreshing,
  refreshConnections,
  connect,
  disconnect,
  disconnectAll
} = useSerialConnections()
\`\`\`

#### usePacketData
Handles real-time packet data processing.

\`\`\`typescript
const {
  data,
  packetCounts,
  globalPacketTypeCounts,
  connectionPacketTypeCounts,
  clearData,
  clearAllData,
  removeConnectionData
} = usePacketData()
\`\`\`

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

\`\`\`env
# Development settings
RUST_LOG=debug
TAURI_DEBUG=true

# Application settings
DEFAULT_BAUD_RATE=115200
MAX_PACKET_HISTORY=100
LOG_RETENTION_DAYS=30
\`\`\`

### Tauri Configuration

The application uses Tauri for native functionality. Key configurations:

- **Serial Port Access**: Native serial port communication
- **UDP Networking**: UDP socket operations
- **File System**: Log file management
- **Process Management**: Connection lifecycle management

## 🧪 Testing

### Unit Tests
\`\`\`bash
npm run test
\`\`\`

### Integration Tests
\`\`\`bash
npm run test:integration
\`\`\`

### E2E Tests
\`\`\`bash
npm run test:e2e
\`\`\`

## 📊 API Reference

### Serial Actions

#### `listSerialPorts()`
Lists all available serial ports.

**Returns:** `Promise<string[]>`

#### `startSerialConnection(params: SerialConnectionParams)`
Starts a new serial connection.

**Parameters:**
- `params.prefix`: Connection identifier prefix
- `params.port`: Serial port name
- `params.baud`: Baud rate
- `params.packetType`: Type of packets to handle

**Returns:** `Promise<string>` - Connection ID

#### `stopConnection(connectionId: string)`
Stops an active connection.

**Parameters:**
- `connectionId`: ID of connection to stop

### UDP Actions

#### `startUdpConnection(params: UdpConnectionParams)`
Starts a new UDP connection.

**Parameters:**
- `params.prefix`: Connection identifier prefix
- `params.localAddr`: Local address to bind to

**Returns:** `Promise<string>` - Connection ID

#### `listUdpTargets(connectionId: string)`
Lists UDP targets for a connection.

**Parameters:**
- `connectionId`: Connection ID to get targets for

**Returns:** `Promise<any[]>` - Array of UDP targets

### Packet Actions

#### `sendHeaderPacket(connectionId: string)`
Sends a header packet to a connection.

**Parameters:**
- `connectionId`: Target connection ID

#### `sendPayloadPacket(connectionId: string)`
Sends a payload packet to a connection.

**Parameters:**
- `connectionId`: Target connection ID

### Log Actions

#### `listLogFiles()`
Lists all available log files.

**Returns:** `Promise<string[]>` - Array of log file names

#### `readLogFile(connectionId: string)`
Reads log file content for a specific connection.

**Parameters:**
- `connectionId`: Connection ID to read logs for

**Returns:** `Promise<string[]>` - Array of log lines

## 🎨 Styling

The application uses Tailwind CSS for styling with a custom design system:

### Color Scheme
- **Primary**: Blue tones for main actions
- **Secondary**: Gray tones for secondary elements
- **Success**: Green for successful operations
- **Warning**: Yellow for warnings
- **Error**: Red for errors

### Component Styling
- **Cards**: Rounded corners with subtle shadows
- **Buttons**: Consistent sizing and hover effects
- **Forms**: Clean input styling with validation states
- **Tables**: Striped rows with hover effects

## 🔍 Troubleshooting

### Common Issues

#### Serial Port Access Denied
\`\`\`bash
# Linux: Add user to dialout group
sudo usermod -a -G dialout $USER

# Windows: Run as administrator
# macOS: Check system preferences for serial port access
\`\`\`

#### UDP Port Already in Use
\`\`\`typescript
// Check for existing connections before starting new ones
const existingConnections = await listConnections()
const portInUse = existingConnections.some(conn => 
  conn.name.includes(targetPort)
)
\`\`\`

#### High Memory Usage
- Limit packet history: Adjust `MAX_PACKET_HISTORY` in configuration
- Clear data regularly: Use clear functions in the UI
- Monitor connection count: Disconnect unused connections

### Debug Mode

Enable debug logging:

\`\`\`bash
RUST_LOG=debug npm run tauri dev
\`\`\`

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
   \`\`\`bash
   git checkout -b feature/amazing-feature
   \`\`\`
3. **Commit your changes**
   \`\`\`bash
   git commit -m 'Add amazing feature'
   \`\`\`
4. **Push to the branch**
   \`\`\`bash
   git push origin feature/amazing-feature
   \`\`\`
5. **Open a Pull Request**

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Add JSDoc comments for all functions
- Write unit tests for new features
- Update documentation for API changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Tauri Team** - For the excellent desktop app framework
- **React Team** - For the powerful UI library
- **TypeScript Team** - For type safety and developer experience
- **Tailwind CSS** - For the utility-first CSS framework

## 📞 Support

For support and questions:

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Email**: support@yourapp.com

---

**Happy Monitoring!** 🚀
