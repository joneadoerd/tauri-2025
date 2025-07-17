// // src/app/serial-tab.tsx
// "use client";

// import { useEffect, useState } from "react";
// import {
//   startConnection,
//   stopConnection,
//   sendPacket,
//   listSerialPorts,
//   listConnections,
//   startShare,
//   stopShare,
//   getSavedData,
//   clearSavedData,
//   getAllSavedData,
//   getStorageStats,
//   clearAllSavedData,
//   readLogFile,
//   listLogFiles,
//   getLogsDirectory,
//   getAppRootDirectory,
//   SerialConnectionInfo,
// } from "@/lib/serial";
// import { listen } from "@tauri-apps/api/event";
// import { UnlistenFn, Event } from "@tauri-apps/api/event";
// import { invoke } from "@tauri-apps/api/core";

// // Update these imports to the correct paths for your project structure
// import {
//   Card,
//   CardHeader,
//   CardTitle,
//   CardContent,
//   CardDescription,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Separator } from "@/components/ui/separator";
// import { Badge } from "@/components/ui/badge";
// import { Packet } from "@/gen/packet";
// import { Check, Activity, RefreshCw } from "lucide-react";
// import { SerialPacketEvent } from "@/gen/packet";
// import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// import React from "react"; // Added for React.Fragment
// import {
//   SimulationResultList,
//   SimulationResult,
//   F16State,
// } from "@/gen/simulation";

// export default function SerialTabGeneral() {
//   const [ports, setPorts] = useState<string[]>([]);
//   const [connections, setConnections] = useState<
//     { id: string; name: string }[]
//   >([]);
//   const [data, setData] = useState<
//     Record<string, { packet: Packet; timestamp: number; id?: string }[]>
//   >({});
//   const [activeTab, setActiveTab] = useState<string>("");
//   // Define allowed ID prefixes
//   const idPrefixes = ["COM", "USB", "UART", "DEV"];
//   // Track processed packets to prevent duplicates
//   const [processedPackets] = useState<Set<string>>(new Set());
//   const [form, setForm] = useState({
//     id: "", // This will be the prefix
//     port: "",
//     baud: "115200",
//     json: '{ "id": 1, "length": 2, "checksum": 3, "version": 4, "flags": 5 }',
//   });
//   const [logs, setLogs] = useState<Record<string, string[]>>({});
//   const [packetType, setPacketType] = useState("Header");
//   const [shareFrom, setShareFrom] = useState("");
//   const [shareTo, setShareTo] = useState("");
//   const [shareInterval, setShareInterval] = useState(10); // ms
//   const [sharing, setSharing] = useState(false);
//   const [packetTypes, setPacketTypes] = useState<string[]>([
//     "Header",
//     "Payload",
//     "Command",
//     "State",
//   ]);
//   const [packetCounts, setPacketCounts] = useState<
//     Record<
//       string,
//       {
//         count: number;
//         lastReset: number;
//         headerCount: number;
//         payloadCount: number;
//         totalCount: number;
//       }
//     >
//   >({});
//   const [savedData, setSavedData] = useState<Record<string, string[]>>({});
//   const [showSavedData, setShowSavedData] = useState<Record<string, boolean>>(
//     {}
//   );
//   const [storageStats, setStorageStats] = useState<Record<string, number>>({});
//   const [logFiles, setLogFiles] = useState<string[]>([]);
//   const [logData, setLogData] = useState<Record<string, string[]>>({});
//   const [showLogData, setShowLogData] = useState<Record<string, boolean>>({});
//   const [logsDirectory, setLogsDirectory] = useState<string>("");
//   // Add global packet type counter state
//   const [globalPacketTypeCounts, setGlobalPacketTypeCounts] = useState<
//     Record<string, number>
//   >({});
//   // Add per-connection packet type counter state
//   const [connectionPacketTypeCounts, setConnectionPacketTypeCounts] = useState<
//     Record<string, Record<string, number>>
//   >({});
//   const [activeShares, setActiveShares] = useState<
//     { shareId: string; connectionId: string }[]
//   >([]);
//   const [refreshing, setRefreshing] = useState(false);
//   const [autoRefresh, setAutoRefresh] = useState(true);

//   // --- Simulation UDP Streaming Section ---
//   const [simLocalAddr, setSimLocalAddr] = useState("0.0.0.0:6000");
//   const [simRemoteAddr, setSimRemoteAddr] = useState("127.0.0.1:9000");
//   const [simInterval, setSimInterval] = useState(1000);
//   const [simUdpConnId, setSimUdpConnId] = useState<string | null>(null);
//   const [simUdpError, setSimUdpError] = useState<string | null>(null);
//   const [activeSimulationStreams, setActiveSimulationStreams] = useState<string[]>([]);
//   const [isStoppingSimUdp, setIsStoppingSimUdp] = useState(false);
//   const [isStartingSimUdp, setIsStartingSimUdp] = useState(false);

//   const fetchActiveSimulationStreams = async () => {
//     try {
//       const streams = await invoke<string[]>("list_active_simulation_streams");
//       setActiveSimulationStreams(streams);
//     } catch (e) {
//       console.error("Failed to fetch active simulation streams:", e);
//       setActiveSimulationStreams([]);
//     }
//   };

//   const handleStartSimUdp = async () => {
//     if (isStartingSimUdp) return; // Prevent multiple clicks
    
//     setSimUdpError(null);
//     setIsStartingSimUdp(true);
    
//     try {
//       const id = await invokeWithTimeout("start_simulation_udp_streaming", {
//         localAddr: simLocalAddr,
//         remoteAddr: simRemoteAddr,
//         intervalMs: simInterval,
//       }, 5000) as string;
//       setSimUdpConnId(id);
      
//       // Refresh with a small delay to let backend settle
//       setTimeout(() => {
//         fetchActiveSimulationStreams();
//       }, 1000);
//     } catch (e: any) {
//       const errorMsg = e?.toString() || "Failed to start UDP simulation streaming";
//       setSimUdpError(errorMsg);
//       // If it's a socket address conflict, suggest stopping existing connections
//       if (errorMsg.includes("already in use")) {
//         setSimUdpError(`${errorMsg}. Please stop any existing connections or simulation streaming using this address first.`);
//       }
//     } finally {
//       setIsStartingSimUdp(false);
//     }
//   };

//   // Helper function to add timeout to invoke calls
//   const invokeWithTimeout = async (command: string, args: any, timeoutMs: number = 5000) => {
//     return Promise.race([
//       invoke(command, args),
//       new Promise((_, reject) => 
//         setTimeout(() => reject(new Error(`${command} timed out after ${timeoutMs}ms`)), timeoutMs)
//       )
//     ]);
//   };

//   const handleStopSimUdp = async () => {
//     if (isStoppingSimUdp) return; // Prevent multiple clicks
    
//     setSimUdpError(null);
//     setIsStoppingSimUdp(true);
    
//     try {
//       // If we have a specific simUdpConnId, stop that one
//       if (simUdpConnId) {
//         try {
//           await invokeWithTimeout("stop_simulation_udp_streaming", {
//             connectionId: simUdpConnId,
//           }, 3000);
//           setSimUdpConnId(null);
//         } catch (e) {
//           console.error("Failed to stop specific simulation stream:", e);
//           // Even if it fails, clear the state
//           setSimUdpConnId(null);
//         }
//       } 
//       // If no specific simUdpConnId but we have active simulation streams, stop them one by one
//       else if (activeSimulationStreams.length > 0) {
//         // Stop streams one by one to avoid overwhelming the backend
//         for (const streamId of activeSimulationStreams) {
//           try {
//             await invokeWithTimeout("stop_simulation_udp_streaming", {
//               connectionId: streamId,
//             }, 3000);
//             console.log(`Successfully stopped stream: ${streamId}`);
//           } catch (e) {
//             console.error(`Failed to stop stream ${streamId}:`, e);
//             // Continue with other streams even if one fails
//           }
//         }
//       }
      
//       // Always refresh the state, even if some operations failed
//       setTimeout(() => {
//         fetchActiveSimulationStreams();
//       }, 1000); // Small delay to let backend settle
      
//     } catch (e: any) {
//       console.error("Error in handleStopSimUdp:", e);
//       setSimUdpError(
//         e?.toString() || "Failed to stop UDP simulation streaming"
//       );
//     } finally {
//       setIsStoppingSimUdp(false);
      
//       // Force refresh state after a longer delay as fallback
//       setTimeout(() => {
//         fetchActiveSimulationStreams();
//       }, 3000);
//     }
//   };

//   const [simResults, setSimResults] = useState<SimulationResultList | null>(
//     null
//   );
//   const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
//   const [loadingSimResults, setLoadingSimResults] = useState(false);
//   // Add state for target count
//   const [targetCount, setTargetCount] = useState<number>(0);

//   const isSimulationResultList = (res: any): res is SimulationResultList => {
//     return res && typeof res === "object" && Array.isArray(res.results);
//   };

//   const fetchSimResults = async () => {
//     setLoadingSimResults(true);
//     try {
//       const res = await invoke("get_simulation_data");
//       console.log("Fetched simulation results:", res);
//       if (isSimulationResultList(res) && res.results.length > 0) {
//         setSimResults(res as SimulationResultList);
//         setTargetCount(res.results.length);
//         console.log(`Loaded ${res.results.length} targets from simulation results`);
//       } else {
//         setSimResults(null);
//         setTargetCount(0);
//       }
//     } catch (e) {
//       setSimResults(null);
//       setTargetCount(0);
//       console.error("Failed to fetch simulation results", e);
//     } finally {
//       setLoadingSimResults(false);
//     }
//   };

//   useEffect(() => {
//     fetchSimResults();
//     fetchActiveSimulationStreams();
//   }, []);
//   // Use only one set of shareInterval/shareLocalAddr/shareRemoteAddr state for both simulation and target sharing
//   const [shareLocalAddr, setShareLocalAddr] = useState("0.0.0.0:6001");
//   const [shareRemoteAddr, setShareRemoteAddr] = useState("127.0.0.1:7001");
//   const [shareError, setShareError] = useState<string | null>(null);
//   const [shareConnId, setShareConnId] = useState<string | null>(null);
//   const [selectedConnectionId, setSelectedConnectionId] = useState<
//     string | null
//   >(null);

//   // Fetch simulation results from backend
//   useEffect(() => {
//     invoke("get_simulation_data").then((res: any) => {
//       if (res && res.results) {
//         setSimResults(res as SimulationResultList);
//         setTargetCount(res.results.length);
//       }
//     });
//   }, []);

//   useEffect(() => {
//     invoke("list_connections").then((res: any) => {
//       if (Array.isArray(res)) setConnections(res);
//     });
//   }, []);

//   const handleShareTarget = async () => {
//     setShareError(null);
//     if (!selectedTargetId || !selectedConnectionId) {
//       setShareError("Select a target and a connection");
//       return;
//     }
//     try {
//       const id = await invoke<string>("share_target_to_connection", {
//         targetId: selectedTargetId,
//         connectionId: selectedConnectionId,
//         intervalMs: shareInterval,
//       });
//       setShareConnId(id);
//     } catch (e: any) {
//       setShareError(e?.toString() || "Failed to share target");
//     }
//   };

//   const handleStopShare = async () => {
//     setShareError(null);
//     if (!shareConnId || !selectedConnectionId) return;
//     try {
//       await invoke("stop_share_to_connection", {
//         shareId: shareConnId,
//         connectionId: selectedConnectionId,
//       });
//       setShareConnId(null);
//     } catch (e: any) {
//       setShareError(e?.toString() || "Failed to stop sharing");
//     }
//   };

//   useEffect(() => {
//     const init = async () => {
//       const available = await listSerialPorts();
//       const conns = await listConnections();
//       setPorts(available);
//       setConnections(conns);
//     };
//     init();
//   }, []);

//   useEffect(() => {
//     const unlistenAll: UnlistenFn[] = [];

//     const unlisten = listen(
//       "serial_packet",
//       (event: Event<SerialPacketEvent>) => {
//         const { id, packet } = event.payload;
//         if (!packet) {
//           console.log("Received event with no packet");
//           return;
//         }

//         console.log(`Received packet for ${id}:`, packet);

//         // Process the packet - keep original structure
//         let normalizedPacket: Packet = packet;

//         // Determine packet type from the kind structure first
//         let packetType = "other";
//         const packetAny = normalizedPacket as any; // Type assertion to handle kind structure
//         if (packetAny.kind) {
//           if (packetAny.kind.Header) packetType = "header";
//           else if (packetAny.kind.Payload) packetType = "payload";
//           else if (packetAny.kind.Command) packetType = "command";
//           else if (packetAny.kind.State) packetType = "state";
//           else if (packetAny.kind.TargetPacket) packetType = "TargetPacket";
//           else if (packetAny.kind.TargetPacketList)
//             packetType = "TargetPacketList";
//           else packetType = "other";
//         } else {
//           // Fallback: check top-level fields for protobuf-style packets
//           if (packetAny.header) packetType = "header";
//           else if (packetAny.payload) packetType = "payload";
//           else if (packetAny.command) packetType = "command";
//           else if (packetAny.state) packetType = "state";
//           else if (packetAny.TargetPacket) packetType = "TargetPacket";
//           else if (packetAny.TargetPacketList) packetType = "TargetPacketList";
//           else packetType = "other";
//         }

//         console.log(`Detected packet type: ${packetType} for ${id}`);

//         // Process immediately for real-time display
//         const now = Date.now();

//         // Create a unique fingerprint for this packet to prevent duplicates
//         const packetFingerprint = `${id}_${JSON.stringify(
//           normalizedPacket
//         )}_${now}`;

//         // Check if we've already processed this exact packet
//         if (processedPackets.has(packetFingerprint)) {
//           console.log(`Skipping already processed packet for ${id}`);
//           return;
//         }

//         // Add to processed set
//         processedPackets.add(packetFingerprint);

//         // Update global packet type counter
//         setGlobalPacketTypeCounts((prev) => ({
//           ...prev,
//           [packetType]: (prev[packetType] || 0) + 1,
//         }));

//         setData((prev) => {
//           const currentPackets = prev[id] || [];

//           // Create a unique identifier for this packet to prevent duplicates
//           const packetId = `${id}_${now}_${Math.random()
//             .toString(36)
//             .substr(2, 9)}`;
//           const newPacket = {
//             packet: normalizedPacket,
//             timestamp: now,
//             id: packetId,
//             packetType: packetType, // Store the detected packet type
//           };

//           // Keep only the last 100 packets per connection to improve performance
//           const updatedPackets = [...currentPackets, newPacket].slice(-100);

//           const updated = {
//             ...prev,
//             [id]: updatedPackets,
//           };
//           // Set the first tab as active if none is selected
//           if (!activeTab) setActiveTab(id);

//           console.log(
//             `Updated data for ${id}, total packets: ${updatedPackets.length}`
//           );
//           return updated;
//         });

//         // Update packet count with real-time tracking and type-specific counts
//         setPacketCounts((prev) => {
//           const current = prev[id] || {
//             count: 0,
//             lastReset: now,
//             headerCount: 0,
//             payloadCount: 0,
//             totalCount: 0,
//           };
//           const timeSinceReset = now - current.lastReset;

//           // Use the packetType we already determined above
//           console.log(`Counting packet for ${id}, type: ${packetType}`);

//           // Reset counter every 1000ms for accurate per-second display
//           if (timeSinceReset >= 1000) {
//             console.log(
//               `Resetting packet count for ${id}, type: ${packetType}`
//             );
//             return {
//               ...prev,
//               [id]: {
//                 count: 1,
//                 lastReset: now,
//                 headerCount: packetType === "header" ? 1 : 0,
//                 payloadCount: packetType === "payload" ? 1 : 0,
//                 totalCount: current.totalCount + 1,
//               },
//             };
//           } else {
//             const newCount = current.count + 1;
//             const newHeaderCount =
//               current.headerCount + (packetType === "header" ? 1 : 0);
//             const newPayloadCount =
//               current.payloadCount + (packetType === "payload" ? 1 : 0);
//             console.log(
//               `Updated packet count for ${id}: ${newCount}/s (H:${newHeaderCount}, P:${newPayloadCount}, T:${
//                 current.totalCount + 1
//               })`
//             );
//             return {
//               ...prev,
//               [id]: {
//                 count: newCount,
//                 lastReset: current.lastReset,
//                 headerCount: newHeaderCount,
//                 payloadCount: newPayloadCount,
//                 totalCount: current.totalCount + 1,
//               },
//             };
//           }
//         });

//         // Update per-connection packet type counter
//         setConnectionPacketTypeCounts((prev) => ({
//           ...prev,
//           [id]: {
//             ...(prev[id] || {}),
//             [packetType]: (prev[id]?.[packetType] || 0) + 1,
//           },
//         }));

//         // Update logs with packet details
//         setLogs((prev) => {
//           const currentLogs = prev[id] || [];
//           const logEntry = `[${new Date(
//             now
//           ).toLocaleTimeString()}] Received packet: ${JSON.stringify(
//             normalizedPacket,
//             null,
//             2
//           )}`;
//           const updatedLogs = [...currentLogs, logEntry].slice(-50); // Keep last 50 log entries
//           return {
//             ...prev,
//             [id]: updatedLogs,
//           };
//         });

//         // Update total UDP targets when we receive TargetPacket or TargetPacketList
//         if (packetType === "TargetPacket" || packetType === "TargetPacketList") {
//           fetchTotalUdpTargets();
//         }
//       }
//     );
//     unlisten.then((un) => unlistenAll.push(un));
//     return () => {
//       unlistenAll.forEach((fn) => fn());
//     };
//   }, [activeTab]);

//   // Add useEffect to fetch total targets on component mount
//   useEffect(() => {
//     fetchTotalUdpTargets();
//   }, []);

//   useEffect(() => {
//     if (connections.length > 0 && !shareFrom) {
//       setShareFrom(connections.find((conn) => !!conn.id)?.id ?? "");
//     }
//     if (connections.length > 0 && !shareTo) {
//       setShareTo(connections.find((conn) => !!conn.id)?.id ?? "");
//     }
//   }, [connections]);

//   const connect = async () => {
//     // Only send the prefix to the backend
//     const prefix = form.id || idPrefixes[0];
//     await startConnection(prefix, form.port, parseInt(form.baud), packetType);
//     const updated = await listConnections();
//     setConnections(updated);
//   };
//   function clearAllStates() {
//     setConnections([]);
//     setData({});
//     setLogs({});
//     setPacketCounts({});
//     setConnectionPacketTypeCounts({});
//   }
//   const disconnect = async (id: string, port: string, packetType: string) => {
//     await stopConnection(id);
//     // Clear the received data for this connection
//     setData((prev) => {
//       const updated = { ...prev };
//       delete updated[id];
//       return updated;
//     });
//     // Clear logs for this connection
//     setLogs((prev) => {
//       const updated = { ...prev };
//       delete updated[id];
//       return updated;
//     });
//     // Clear packet counts for this connection
//     setPacketCounts((prev) => {
//       const updated = { ...prev };
//       delete updated[id];
//       return updated;
//     });
//     // Remove per-connection packet type counters
//     setConnectionPacketTypeCounts((prev) => {
//       const updated = { ...prev };
//       delete updated[id];
//       return updated;
//     });
    
//     // If this is a simulation UDP connection, also update simUdpConnId
//     if (id.startsWith("sim_udp_") && simUdpConnId === id) {
//       setSimUdpConnId(null);
//       console.log("Simulation UDP connection stopped from disconnect button");
//     }
    
//     const updated = await listConnections();
//     setConnections(updated);
//   };

//   const clearData = (id: string) => {
//     setData((prev) => {
//       const updated = { ...prev };
//       if (updated[id]) {
//         updated[id] = [];
//       }
//       return updated;
//     });
//     setLogs((prev) => {
//       const updated = { ...prev };
//       if (updated[id]) {
//         updated[id] = [];
//       }
//       return updated;
//     });
//     setPacketCounts((prev) => {
//       const updated = { ...prev };
//       if (updated[id]) {
//         updated[id] = {
//           count: 0,
//           lastReset: Date.now(),
//           headerCount: 0,
//           payloadCount: 0,
//           totalCount: 0,
//         };
//       }
//       return updated;
//     });
//     // Reset per-connection packet type counters
//     setConnectionPacketTypeCounts((prev) => {
//       const updated = { ...prev };
//       if (updated[id]) {
//         updated[id] = {};
//       }
//       return updated;
//     });
//   };

//   const loadLogFiles = async () => {
//     try {
//       const files = await listLogFiles();
//       setLogFiles(files);
//       console.log("Loaded log files:", files);
//     } catch (error) {
//       console.error("Failed to load log files:", error);
//     }
//   };

//   const loadLogsDirectory = async () => {
//     try {
//       const dir = await getLogsDirectory();
//       setLogsDirectory(dir as any);
//     } catch (error) {
//       console.error("Failed to load logs directory:", error);
//     }
//   };

//   const [appRootDirectory, setAppRootDirectory] = useState<string>("");

//   const loadAppRootDirectory = async () => {
//     try {
//       const dir = await getAppRootDirectory();
//       setAppRootDirectory(dir);
//     } catch (error) {
//       console.error("Failed to load app root directory:", error);
//     }
//   };

//   const loadLogData = async (connectionId: string) => {
//     try {
//       const data = await readLogFile(connectionId);
//       setLogData((prev) => ({
//         ...prev,
//         [connectionId]: data,
//       }));
//       setShowLogData((prev) => ({
//         ...prev,
//         [connectionId]: true,
//       }));
//     } catch (error) {
//       console.error("Failed to load log data:", error);
//     }
//   };

//   const toggleLogData = (connectionId: string) => {
//     setShowLogData((prev) => ({
//       ...prev,
//       [connectionId]: !prev[connectionId],
//     }));
//   };

//   const send = async (id: string, port: string, packetType: string) => {
//     // Use example data instead of form data
//     const exampleDataForType = exampleData[packetType];

//     if (!exampleDataForType) {
//       setLogs((prev: Record<string, string[]>) => ({
//         ...prev,
//         [id]: [...(prev[id] || []), `No example data for ${packetType}`],
//       }));
//       return;
//     }

//     // Create the packet with proper structure for Rust backend
//     let packet: any = {}; // Use any to bypass TypeScript interface mismatch
//     if (packetType === "Header") {
//       packet = { kind: { Header: exampleDataForType } };
//     } else if (packetType === "Payload") {
//       // Ensure data is properly formatted as Uint8Array
//       const payloadData = exampleDataForType.data
//         ? new Uint8Array(exampleDataForType.data)
//         : new Uint8Array();
//       packet = {
//         kind: {
//           Payload: {
//             ...exampleDataForType,
//             data: payloadData,
//           },
//         },
//       };
//     } else {
//       packet = { kind: { [packetType]: exampleDataForType } };
//     }

//     try {
//       console.log(`Sending ${packetType} packet:`, packet);
//       await sendPacket(id, packet);
//       setLogs((prev: Record<string, string[]>) => ({
//         ...prev,
//         [id]: [
//           ...(prev[id] || []),
//           `Sent ${packetType}: ${JSON.stringify(packet)}`,
//         ],
//       }));
//     } catch (error) {
//       console.error(`Error sending ${packetType}:`, error);
//       setLogs((prev: Record<string, string[]>) => ({
//         ...prev,
//         [id]: [...(prev[id] || []), `Error sending ${packetType}: ${error}`],
//       }));
//     }
//   };

//   const handleStartShare = async () => {
//     if (!shareFrom || !shareTo || shareFrom === shareTo) return;
//     await startShare(shareFrom, shareTo, shareInterval);
//   };

//   const fetchActiveShares = async () => {
//     const res = await invoke<[string, string][]>("list_active_shares");
//     setActiveShares(
//       res.map(([shareId, connectionId]) => ({ shareId, connectionId }))
//     );
//   };

//   useEffect(() => {
//     fetchActiveShares();
//   }, [shareConnId]); // Refresh when a share is started/stopped

//   const handleStopActiveShare = async (
//     shareId: string,
//     connectionId: string
//   ) => {
//     await invoke("stop_share_to_connection", { shareId, connectionId });
//     fetchActiveShares();
//   };

//   const handleInitComs = async () => {
//     await startConnection("com3_id", "COM3", 115200, "Header");
//     await startConnection("com6_id", "COM6", 115200, "Header");
//     const updated = await listConnections();
//     setConnections(updated);
//   };

//   async function disconnectAllConnections() {
//     await invoke("disconnect_all_connections");
//     clearAllStates();
//   }

//   const refreshConnections = async () => {
//     setRefreshing(true);
//     try {
//       const conns = await listConnections();
//       setConnections(conns);
//       await fetchAllActiveShares();
//       await fetchTotalUdpTargets();
//       await fetchActiveSimulationStreams();
//     } catch (e) {
//       console.error("Failed to refresh connections:", e);
//     } finally {
//       setRefreshing(false);
//     }
//   };

//   // Auto-refresh effect
//   useEffect(() => {
//     if (!autoRefresh) return;
//     const interval = setInterval(() => {
//       refreshConnections();
//     }, 2000);
//     return () => clearInterval(interval);
//   }, [autoRefresh]);

//   // Example/template data for each packet type
//   const exampleData: Record<string, any> = {
//     Header: {
//       id: 1,
//       length: 42,
//       checksum: 1234,
//       version: 1,
//       flags: 0,
//     },
//     Payload: {
//       type_value: 2,
//       data: [22], // "Hello" as bytes
//       size: 5,
//       encoding: "utf8",
//     },
//   };
//   const [udpAddress, setUdpAddress] = useState("");
//   const [udpRemoteInputs, setUdpRemoteInputs] = useState<
//     Record<string, string>
//   >({});
//   const [udpStatus, setUdpStatus] = useState("");
//   // For UDP server init
//   const [initA, setInitA] = useState("127.0.0.1:9000");
//   const [initB, setInitB] = useState("127.0.0.1:9001");
//   // Filter UDP connections
//   const udpConnections = connections.filter(
//     (c) => c.name && c.name.startsWith("Udp(")
//   );

//   // Start UDP connection
//   const startUdp = async () => {
//     try {
//       await invoke("start_udp_connection", {
//         prefix: "udp",
//         localAddr: udpAddress,
//       });
//       setUdpStatus("UDP connection started");
//       setUdpAddress("");
//       refreshConnections();
//     } catch (e: any) {
//       const errorMsg = e?.toString() || "Failed to start UDP connection";
//       if (errorMsg.includes("already in use")) {
//         setUdpStatus(`${errorMsg}. Please stop any existing connections or simulation streaming using this address first.`);
//       } else {
//         setUdpStatus("Error: " + errorMsg);
//       }
//     }
//   };

//   // Init two UDP servers and connect them
//   const initTwoServers = async () => {
//     try {
//       // Start A
//       await invoke("start_udp_connection", {
//         prefix: "udpA",
//         localAddr: initA,
//       });
//       // Start B
//       await invoke("start_udp_connection", {
//         prefix: "udpB",
//         localAddr: initB,
//       });
//       // Refresh and get IDs
//       await refreshConnections();
//       const all = await invoke<{ id: string; name: string }[]>(
//         "list_connections"
//       );
//       const udpA = all.find((c) => c.name.includes(initA));
//       const udpB = all.find((c) => c.name.includes(initB));
//       if (udpA && udpB) {
//         await invoke("set_udp_remote_addr", { id: udpA.id, remoteAddr: initB });
//         await invoke("set_udp_remote_addr", { id: udpB.id, remoteAddr: initA });
//         setUdpStatus(`Started and connected ${initA} <-> ${initB}`);
//       } else {
//         setUdpStatus("Could not find both UDP servers after starting.");
//       }
//       refreshConnections();
//     } catch (e: any) {
//       const errorMsg = e?.toString() || "Failed to initialize two servers";
//       if (errorMsg.includes("already in use")) {
//         setUdpStatus(`${errorMsg}. Please stop any existing connections or simulation streaming using these addresses first.`);
//       } else {
//         setUdpStatus("Error initializing two servers: " + errorMsg);
//       }
//     }
//   };

//   // Set remote address for a UDP connection
//   const setUdpRemoteAddr = async (id: string) => {
//     const remoteAddr = udpRemoteInputs[id];
//     if (!remoteAddr) {
//       setUdpStatus("Enter a remote address.");
//       return;
//     }
//     try {
//       await invoke("set_udp_remote_addr", { id, remoteAddr });
//       setUdpStatus(`Set remote address for ${id}`);
//       refreshConnections();
//     } catch (e) {
//       setUdpStatus("Error setting remote address: " + e);
//     }
//   };

//   // --- UDP Target Share Section State ---
//   const [udpShareSourceId, setUdpShareSourceId] = useState<string>("");
//   const [udpShareTargets, setUdpShareTargets] = useState<any[]>([]); // TargetPacket[]
//   const [udpShareSelectedTargetId, setUdpShareSelectedTargetId] = useState<
//     number | null
//   >(null);
//   const [udpShareDestConnId, setUdpShareDestConnId] = useState<string>("");
//   const [udpShareInterval, setUdpShareInterval] = useState(100);
//   // Replace single-share state with array
//   const [udpShareActive, setUdpShareActive] = useState<
//     Array<{
//       shareId: string;
//       sourceId: string;
//       targetId: number;
//       destId: string;
//       interval: number;
//     }>
//   >([]);
//   const [udpShareError, setUdpShareError] = useState<string | null>(null);
//   const [udpShareLoadingTargets, setUdpShareLoadingTargets] = useState(false);

//   // Fetch targets for selected UDP connection
//   const fetchUdpShareTargets = async (connId: string) => {
//     setUdpShareLoadingTargets(true);
//     setUdpShareTargets([]);
//     setUdpShareSelectedTargetId(null);
//     try {
//       const targets = await invoke<any[]>("list_udp_targets", {
//         connectionId: connId,
//       });
//       setUdpShareTargets(targets);
//       if (targets.length > 0) setUdpShareSelectedTargetId(targets[0].target_id);
//     } catch (e) {
//       setUdpShareTargets([]);
//     } finally {
//       setUdpShareLoadingTargets(false);
//     }
//   };

//   // When UDP source changes, fetch targets
//   useEffect(() => {
//     if (udpShareSourceId) fetchUdpShareTargets(udpShareSourceId);
//   }, [udpShareSourceId]);

//   // Auto-select first UDP connection
//   useEffect(() => {
//     if (!udpShareSourceId) {
//       const udp = connections.find((c) => c.name && c.name.startsWith("Udp("));
//       if (udp) setUdpShareSourceId(udp.id);
//     }
//   }, [connections, udpShareSourceId]);

//   // Auto-select first destination connection
//   useEffect(() => {
//     if (!udpShareDestConnId && connections.length > 0) {
//       setUdpShareDestConnId(connections[0].id);
//     }
//   }, [connections, udpShareDestConnId]);

//   // On Start Share, add to array
//   const handleStartUdpShare = async () => {
//     setUdpShareError(null);
//     if (!udpShareSourceId || !udpShareSelectedTargetId || !udpShareDestConnId) {
//       setUdpShareError("Select UDP source, target, and destination");
//       return;
//     }
//     // Prevent duplicate share (same source, target, dest)
//     if (
//       udpShareActive.some(
//         (s) =>
//           s.sourceId === udpShareSourceId &&
//           s.targetId === udpShareSelectedTargetId &&
//           s.destId === udpShareDestConnId
//       )
//     ) {
//       setUdpShareError("This share is already active.");
//       return;
//     }
//     try {
//       const shareId = await invoke<string>("share_udp_target_to_connection", {
//         udpConnectionId: udpShareSourceId,
//         targetId: udpShareSelectedTargetId,
//         destConnectionId: udpShareDestConnId,
//         intervalMs: udpShareInterval,
//       });
//       setUdpShareActive((prev) => [
//         ...prev,
//         {
//           shareId,
//           sourceId: udpShareSourceId,
//           targetId: udpShareSelectedTargetId,
//           destId: udpShareDestConnId,
//           interval: udpShareInterval,
//         },
//       ]);
//     } catch (e: any) {
//       setUdpShareError(e?.toString() || "Failed to start UDP share");
//     }
//   };

//   // On Stop Share, remove from array
//   const handleStopUdpShare = async (shareId: string, destId: string) => {
//     setUdpShareError(null);
//     try {
//       await invoke("stop_share_to_connection", {
//         shareId,
//         connectionId: destId,
//       });
//       setUdpShareActive((prev) => prev.filter((s) => s.shareId !== shareId));
//     } catch (e: any) {
//       setUdpShareError(e?.toString() || "Failed to stop UDP share");
//     }
//   };

//   // Add state for all active shares
//   const [allActiveShares, setAllActiveShares] = useState<
//     { shareId: string; connectionId: string }[]
//   >([]);
//   // Fetch all active shares
//   const fetchAllActiveShares = async () => {
//     const res = await invoke<[string, string][]>("list_active_shares");
//     setAllActiveShares(
//       res.map(([shareId, connectionId]) => ({ shareId, connectionId }))
//     );
//   };
//   // Fetch on mount and when shares change
//   useEffect(() => {
//     fetchAllActiveShares();
//   }, []);
//   useEffect(() => {
//     fetchAllActiveShares();
//   }, [udpShareActive]);
//   // Helper function to check if a connection has active shares
//   const hasActiveShares = (connectionId: string): boolean => {
//     return allActiveShares.some(share => share.connectionId === connectionId);
//   };

//   // Helper function to count active shares for a connection
//   const getActiveSharesCount = (connectionId: string): number => {
//     return allActiveShares.filter(share => share.connectionId === connectionId).length;
//   };

//   // Helper function to check if any shares are active across all connections
//   const hasAnyActiveShares = (): boolean => {
//     return allActiveShares.length > 0;
//   };

//   // Helper function to check if there are any active simulation streams
//   const hasActiveSimulationStreams = (): boolean => {
//     return activeSimulationStreams.length > 0;
//   };

//   // Handler to stop any share
//   const handleStopAnyShare = async (shareId: string, connectionId: string) => {
//     await invoke("stop_share_to_connection", { shareId, connectionId });
//     fetchAllActiveShares();
//     // Also update udpShareActive if needed
//     setUdpShareActive((prev) => prev.filter((s) => s.shareId !== shareId));
    
//     // If this is a simulation UDP stream, also update simUdpConnId
//     if (connectionId.startsWith("sim_udp_") && simUdpConnId === connectionId) {
//       setSimUdpConnId(null);
//       console.log("Simulation UDP connection stopped from active shares table");
//     }
//   };

//   // --- Multiple UDP Listeners Section ---
// interface UdpListener {
//   id: string;
//   address: string;
//   connectionId: string | null;
//   status: string;
//   error: string | null;
// }

// const [udpListeners, setUdpListeners] = useState<UdpListener[]>([]);
// const [newUdpListenAddr, setNewUdpListenAddr] = useState("127.0.0.1:5000");

// const handleAddUdpListener = async () => {
//   if (!newUdpListenAddr) return;
  
//   // Check if address is already in use
//   if (udpListeners.some(listener => listener.address === newUdpListenAddr)) {
//     alert("A listener on this address already exists!");
//     return;
//   }
  
//   const listenerId = `listener_${Date.now()}`;
//   const newListener: UdpListener = {
//     id: listenerId,
//     address: newUdpListenAddr,
//     connectionId: null,
//     status: "Starting...",
//     error: null,
//   };
  
//   setUdpListeners(prev => [...prev, newListener]);
  
//   try {
//     await invoke("start_udp_connection", {
//       prefix: "udp_listener",
//       localAddr: newUdpListenAddr,
//     });
    
//     // Refresh connections to get the new connection ID
//     const updated = await listConnections();
//     setConnections(updated);
    
//     // Find the new UDP connection by address
//     const udpConn = updated.find(
//       (c) => c.name && c.name.includes(newUdpListenAddr)
//     );
    
//     setUdpListeners(prev => prev.map(listener => 
//       listener.id === listenerId 
//         ? { 
//             ...listener, 
//             connectionId: udpConn?.id || null,
//             status: udpConn ? `Listening on ${newUdpListenAddr}` : "Failed to get connection ID",
//             error: null
//           }
//         : listener
//     ));
    
//     setNewUdpListenAddr(""); // Clear input
//   } catch (e: any) {
//     setUdpListeners(prev => prev.map(listener => 
//       listener.id === listenerId 
//         ? { ...listener, status: "Failed", error: e?.toString() || "Failed to start UDP listener" }
//         : listener
//     ));
//   }
// };

// const handleRemoveUdpListener = async (listenerId: string) => {
//   const listener = udpListeners.find(l => l.id === listenerId);
//   if (!listener) return;
  
//   if (listener.connectionId) {
//     try {
//       await invoke("stop_connection", { id: listener.connectionId });
//     } catch (e: any) {
//       console.error("Failed to stop connection:", e);
//     }
//   }
  
//   setUdpListeners(prev => prev.filter(l => l.id !== listenerId));
  
//   // Refresh connections
//   const updated = await listConnections();
//   setConnections(updated);
// };

// const handleStopUdpListener = async (listenerId: string) => {
//   const listener = udpListeners.find(l => l.id === listenerId);
//   if (!listener || !listener.connectionId) return;
  
//   try {
//     await invoke("stop_connection", { id: listener.connectionId });
//     setUdpListeners(prev => prev.map(l => 
//       l.id === listenerId 
//         ? { ...l, status: "Stopped", connectionId: null }
//         : l
//     ));
//   } catch (e: any) {
//     setUdpListeners(prev => prev.map(l => 
//       l.id === listenerId 
//         ? { ...l, error: e?.toString() || "Failed to stop listener" }
//         : l
//     ));
//   }
  
//   // Refresh connections
//   const updated = await listConnections();
//   setConnections(updated);
// };

// const handleStartUdpListener = async (listenerId: string) => {
//   const listener = udpListeners.find(l => l.id === listenerId);
//   if (!listener) return;
  
//   try {
//     await invoke("start_udp_connection", {
//       prefix: "udp_listener",
//       localAddr: listener.address,
//     });
    
//     // Refresh connections to get the new connection ID
//     const updated = await listConnections();
//     setConnections(updated);
    
//     // Find the new UDP connection by address
//     const udpConn = updated.find(
//       (c) => c.name && c.name.includes(listener.address)
//     );
    
//     setUdpListeners(prev => prev.map(l => 
//       l.id === listenerId 
//         ? { 
//             ...l, 
//             connectionId: udpConn?.id || null,
//             status: udpConn ? `Listening on ${listener.address}` : "Failed to get connection ID",
//             error: null
//           }
//         : l
//     ));
//   } catch (e: any) {
//     setUdpListeners(prev => prev.map(l => 
//       l.id === listenerId 
//         ? { ...l, status: "Failed", error: e?.toString() || "Failed to start UDP listener" }
//         : l
//     ));
//   }
// };

//   // Add state for total targets from all connections
//   const [totalUdpTargets, setTotalUdpTargets] = useState<number>(0);

//   const fetchTotalUdpTargets = async () => {
//     try {
//       const total = await invoke<number>("get_total_udp_targets");
//       setTotalUdpTargets(total);
//     } catch (e) {
//       console.error("Failed to fetch total UDP targets:", e);
//       setTotalUdpTargets(0);
//     }
//   };

//   // Add function to check if simulation UDP connection is still active
//   const checkSimUdpConnectionStatus = async () => {
//     if (!simUdpConnId) return;
    
//     try {
//       // Get all connections and check if our simUdpConnId still exists
//       const allConnections = await listConnections();
//       const connectionExists = allConnections.some(conn => conn.id === simUdpConnId);
      
//       if (!connectionExists) {
//         // Connection was stopped/removed from elsewhere, update our state
//         setSimUdpConnId(null);
//         console.log("Simulation UDP connection was stopped externally");
//       }
      
//       // Also refresh active simulation streams
//       await fetchActiveSimulationStreams();
//     } catch (e) {
//       console.error("Failed to check simulation UDP connection status:", e);
//     }
//   };

//   // Add useEffect to periodically check connection status
//   useEffect(() => {
//     if (!simUdpConnId) return;
    
//     const interval = setInterval(checkSimUdpConnectionStatus, 2000); // Check every 2 seconds
    
//     return () => clearInterval(interval);
//   }, [simUdpConnId]);

//   // Also check when connections list changes
//   useEffect(() => {
//     if (simUdpConnId) {
//       checkSimUdpConnectionStatus();
//     }
//   }, [connections]);

//   return (
//     <div className="max-w-7xl mx-auto p-6 space-y-6">
//       {/* Header Section */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="text-3xl font-bold tracking-tight">
//             Serial Communication Monitor
//           </h1>
//           <p className="text-muted-foreground">
//             Real-time packet monitoring and analysis
//           </p>
//         </div>
//         <div className="flex items-center gap-2">
//           <Button onClick={handleInitComs} className="flex items-center gap-2">
//             <Activity className="h-4 w-4" />
//             Init COM3 & COM6
//           </Button>
//         </div>
//       </div>
//       {/* Share Target from UDP Data Section (moved to top) */}
//       <div className="border rounded p-4 bg-muted mt-6">
//         <h4 className="font-semibold mb-2">Share Target from UDP Data</h4>
//         <div className="flex flex-col md:flex-row gap-4 items-end mb-2">
//           <div className="flex-1">
//             <Label>UDP Source Connection</Label>
//             <Select
//               value={udpShareSourceId}
//               onValueChange={(v) => setUdpShareSourceId(v)}
//             >
//               <SelectTrigger>
//                 <SelectValue placeholder="Select UDP connection" />
//               </SelectTrigger>
//               <SelectContent>
//                 {connections
//                   .filter((c) => c.name && c.name.startsWith("Udp("))
//                   .map((c) => (
//                     <SelectItem key={c.id} value={c.id}>
//                       {c.name} ({c.id})
//                     </SelectItem>
//                   ))}
//               </SelectContent>
//             </Select>
//           </div>
//           <div className="flex-1">
//             <Label>Target</Label>
//             <Select
//               value={udpShareSelectedTargetId?.toString() ?? ""}
//               onValueChange={(v) => setUdpShareSelectedTargetId(Number(v))}
//               disabled={udpShareLoadingTargets || udpShareTargets.length === 0}
//             >
//               <SelectTrigger>
//                 <SelectValue
//                   placeholder={
//                     udpShareLoadingTargets ? "Loading..." : "Select target"
//                   }
//                 />
//               </SelectTrigger>
//               <SelectContent>
//                 {udpShareTargets.map((t) => (
//                   <SelectItem key={t.target_id} value={t.target_id.toString()}>
//                     Target {t.target_id}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//           </div>
//           <div className="flex-1">
//             <Label>Destination Connection</Label>
//             <Select
//               value={udpShareDestConnId}
//               onValueChange={(v) => setUdpShareDestConnId(v)}
//             >
//               <SelectTrigger>
//                 <SelectValue placeholder="Select destination" />
//               </SelectTrigger>
//               <SelectContent>
//                 {connections.map((c) => (
//                   <SelectItem key={c.id} value={c.id}>
//                     {c.name} ({c.id})
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//           </div>
//           <div className="flex-1">
//             <Label>Interval (ms)</Label>
//             <Input
//               type="number"
//               min={1}
//               value={udpShareInterval}
//               onChange={(e) => setUdpShareInterval(Number(e.target.value))}
//               className="w-24"
//             />
//           </div>
//           <Button
//             onClick={handleStartUdpShare}
//             disabled={
//               !udpShareSourceId ||
//               !udpShareSelectedTargetId ||
//               !udpShareDestConnId
//             }
//             variant="default"
//           >
//             Start Share
//           </Button>
//         </div>
//         {udpShareActive.length > 0 && (
//           <div className="mt-2">
//             <table className="w-full text-xs border">
//               <thead>
//                 <tr>
//                   <th>Share ID</th>
//                   <th>Source</th>
//                   <th>Target</th>
//                   <th>Destination</th>
//                   <th>Interval (ms)</th>
//                   <th></th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {udpShareActive.map((s) => (
//                   <tr key={s.shareId}>
//                     <td className="font-mono">{s.shareId}</td>
//                     <td>{s.sourceId}</td>
//                     <td>{s.targetId}</td>
//                     <td>{s.destId}</td>
//                     <td>{s.interval}</td>
//                     <td>
//                       <Button
//                         size="sm"
//                         variant="destructive"
//                         onClick={() => handleStopUdpShare(s.shareId, s.destId)}
//                       >
//                         Stop
//                       </Button>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//         {udpShareActive.length === 0 && (
//           <div className="text-xs text-muted-foreground mt-2">
//             No active UDP shares. Stopping a share will NOT remove the data for
//             the destination connection. The monitor will keep showing the last
//             received packets until you disconnect or clear data.
//           </div>
//         )}
//         {udpShareError && (
//           <div style={{ color: "red", marginTop: 8 }}>{udpShareError}</div>
//         )}
//         {udpShareTargets.length > 0 && (
//           <div className="mt-2 text-xs text-muted-foreground">
//             Latest targets received:{" "}
//             {udpShareTargets.map((t) => t.target_id).join(", ")}
//           </div>
//         )}
//       </div>
//       {/* Global Packet Type Counters */}
//       {Object.keys(globalPacketTypeCounts || {}).length > 0 && (
//         <div className="mt-4">
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <Activity className="h-5 w-5" />
//                 All Packets Received by Type
//               </CardTitle>
//               <CardDescription>
//                 Total packets received, grouped by type (all connections)
//               </CardDescription>
//             </CardHeader>
//             <CardContent>
//               <div className="flex flex-wrap gap-4">
//                 {Object.entries(globalPacketTypeCounts || {}).map(([type, count]) => {
//                   let label = type;
//                   if (type.toLowerCase() === "targetpacket")
//                     label = "TargetPacket";
//                   if (type.toLowerCase() === "targetpacketlist")
//                     label = "TargetPacketList";
//                   if (type.toLowerCase() === "other") label = "Other";
//                   return (
//                     <div
//                       key={type}
//                       className="flex flex-col items-center p-4 bg-blue-50 rounded shadow min-w-[100px]"
//                     >
//                       <span className="text-lg font-bold text-blue-700 capitalize">
//                         {label}
//                       </span>
//                       <span className="text-2xl font-mono text-green-700">
//                         {count}
//                       </span>
//                     </div>
//                   );
//                 })}
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       )}
//       {/* Scroll to top button */}
//       <div className="fixed bottom-4 right-4 z-50">
//         <Button
//           onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
//           size="sm"
//           variant="outline"
//           className="rounded-full w-10 h-10 p-0 shadow-lg"
//         >
//           ↑
//         </Button>
//       </div>
//       {/* Serial Config */}
//       <div className="grid md:grid-cols-4 gap-4">
//         <div>
//           <Label>ID Prefix</Label>
//           <Select
//             value={form.id}
//             onValueChange={(v) => setForm((f) => ({ ...f, id: v }))}
//           >
//             <SelectTrigger>
//               <SelectValue placeholder="Select ID Prefix" />
//             </SelectTrigger>
//             <SelectContent>
//               {idPrefixes.map((prefix) => (
//                 <SelectItem key={prefix} value={prefix}>
//                   {prefix}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </div>
//         <div>
//           <Label>Port</Label>
//           <Select
//             value={form.port}
//             onValueChange={(v) => setForm((f) => ({ ...f, port: v }))}
//           >
//             <SelectTrigger>
//               <SelectValue placeholder="Select Port" />
//             </SelectTrigger>
//             <SelectContent>
//               {ports
//                 .filter((port) => port !== "")
//                 .map((port, index) => (
//                   <SelectItem key={port + index} value={port}>
//                     {port}
//                   </SelectItem>
//                 ))}
//             </SelectContent>
//           </Select>
//         </div>
//         <div>
//           <Label>Baud</Label>
//           <Input
//             value={form.baud}
//             onChange={(e) => setForm((f) => ({ ...f, baud: e.target.value }))}
//           />
//         </div>
//         <Button onClick={connect} className="self-end">
//           Connect
//         </Button>

//         <div className="flex items-center gap-2">
//           <Button 
//             onClick={disconnectAllConnections} 
//             variant="destructive"
//             disabled={hasAnyActiveShares()}
//             title={hasAnyActiveShares() ? "Cannot disconnect all connections while shares are running. Stop all shares first." : "Disconnect All Connections"}
//             className={hasAnyActiveShares() ? "opacity-50 cursor-not-allowed" : ""}
//           >
//             Disconnect All Connections
//           </Button>
//           {hasAnyActiveShares() && (
//             <Badge variant="secondary" className="text-xs">
//               {allActiveShares.length} active share{allActiveShares.length !== 1 ? 's' : ''}
//             </Badge>
//           )}
//         </div>

//         <Button onClick={loadLogFiles} variant="outline" className="self-end">
//           Load Log Files
//         </Button>

//         <Button
//           onClick={loadLogsDirectory}
//           variant="outline"
//           className="self-end"
//         >
//           Get Logs Path
//         </Button>
//         <Button
//           onClick={loadAppRootDirectory}
//           variant="outline"
//           className="self-end"
//         >
//           Get App Root
//         </Button>
//         <Button
//           onClick={refreshConnections}
//           variant="outline"
//           className="w-full md:w-auto"
//           disabled={refreshing}
//         >
//           <RefreshCw
//             className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
//           />
//           Refresh
//         </Button>
//         <Button
//           onClick={() => setAutoRefresh((v) => !v)}
//           variant={autoRefresh ? "default" : "outline"}
//           className="w-full md:w-auto"
//         >
//           {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
//         </Button>
//         <div className="flex items-center gap-2">
//           <Button onClick={fetchSimResults} disabled={loadingSimResults}>
//             {loadingSimResults 
//               ? "Refreshing..." 
//               : simResults 
//                 ? `Refresh Results Simulation (${targetCount} targets)`
//                 : "Refresh Results Simulation"
//             }
//           </Button>
//           {targetCount > 0 && (
//             <Badge variant="secondary" className="ml-2">
//               {targetCount} targets loaded
//             </Badge>
//           )}
//           {totalUdpTargets > 0 && (
//             <Badge variant="outline" className="ml-2">
//               {totalUdpTargets} UDP targets across all connections
//             </Badge>
//           )}
//         </div>
//       </div>
//       {/* UDP Config Section */}
//       <div className="border rounded p-4 bg-muted mt-6">
//         <h4 className="font-semibold mb-2">UDP Config</h4>
//         <div className="flex flex-col md:flex-row gap-4 items-end mb-2">
//           <div className="flex-1">
//             <Label className="mb-1 block">Local Address (host:port)</Label>
//             <Input
//               value={udpAddress}
//               onChange={(e) => setUdpAddress(e.target.value)}
//               placeholder="127.0.0.1:9000"
//             />
//           </div>
//           <Button
//             onClick={startUdp}
//             disabled={!udpAddress}
//             className="w-full md:w-auto"
//           >
//             Start UDP Connection
//           </Button>
//           {/* UDP Init 2 Servers UI */}
//           <div className="flex-1">
//             <Label className="mb-1 block">Init 2 Servers</Label>
//             <Input
//               value={initA}
//               onChange={(e) => setInitA(e.target.value)}
//               placeholder="127.0.0.1:9000"
//               className="mb-2"
//             />
//             <Input
//               value={initB}
//               onChange={(e) => setInitB(e.target.value)}
//               placeholder="127.0.0.1:9001"
//             />
//           </div>
//           <Button onClick={initTwoServers} className="w-full md:w-auto">
//             Init 2 Servers & Connect
//           </Button>
//         </div>
//         <div>
//           <h5 className="font-semibold mb-1">Active UDP Connections</h5>
//           {udpConnections.length === 0 ? (
//             <div className="text-muted-foreground">No UDP connections.</div>
//           ) : (
//             <ul className="space-y-2">
//               {udpConnections.map((c) => (
//                 <li
//                   key={c.id}
//                   className="flex flex-col gap-2 border rounded p-2"
//                 >
//                   <div className="flex items-center gap-2">
//                     <Badge variant="outline">{c.name}</Badge>
//                     <span className="font-mono text-xs">{c.id}</span>
//                     <Input
//                       className="w-48"
//                       value={udpRemoteInputs[c.id] || ""}
//                       onChange={(e) =>
//                         setUdpRemoteInputs((prev) => ({
//                           ...prev,
//                           [c.id]: e.target.value,
//                         }))
//                       }
//                       placeholder="Remote address (host:port)"
//                     />
//                     <Button size="sm" onClick={() => setUdpRemoteAddr(c.id)}>
//                       Set Remote
//                     </Button>
//                   </div>
//                 </li>
//               ))}
//             </ul>
//           )}
//         </div>
//         <div className="text-sm text-muted-foreground mt-2">{udpStatus}</div>
//       </div>
//       <Separator />
//       <div className="flex items-center gap-4">
//         {logFiles.length > 0 ? (
//           <Card className="mt-6">
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <span>Log Files</span>
//                 <span className="text-xs text-muted-foreground">
//                   ({logFiles.length})
//                 </span>
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <ul className="divide-y divide-gray-200">
//                 {logFiles.map((file) => (
//                   <li key={file} className="py-2 flex items-center gap-2">
//                     <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
//                     <span className="font-mono text-blue-700 text-sm">
//                       {file}
//                     </span>
//                   </li>
//                 ))}
//               </ul>
//               <Button
//                 variant="destructive"
//                 className="mt-4"
//                 onClick={async () => {
//                   setLogFiles([]);
//                   // Optionally, call a backend command to delete log files here
//                   // await invoke("clear_log_files");
//                 }}
//               >
//                 Clear Log Files
//               </Button>
//             </CardContent>
//           </Card>
//         ) : (
//           <Card className="mt-6">
//             <CardHeader>
//               <CardTitle>Log Files</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="text-gray-500">No log files found.</div>
//             </CardContent>
//           </Card>
//         )}
//         <div>
//           <Label>Share From</Label>
//           <Select value={shareFrom} onValueChange={setShareFrom}>
//             <SelectTrigger>
//               <SelectValue placeholder="From Connection" />
//             </SelectTrigger>
//             <SelectContent>
//               {connections
//                 .filter((conn) => !!conn.id)
//                 .map((conn) => (
//                   <SelectItem key={conn.id} value={conn.id}>
//                     {conn.id}
//                   </SelectItem>
//                 ))}
//             </SelectContent>
//           </Select>
//         </div>
//         <div>
//           <Label>Destination Connection</Label>
//           <Select
//             value={selectedConnectionId ?? ""}
//             onValueChange={(v) => setSelectedConnectionId(v)}
//           >
//             <SelectTrigger style={{ width: 200 }}>
//               <SelectValue placeholder="Select connection" />
//             </SelectTrigger>
//             <SelectContent>
//               {connections.map((conn) => (
//                 <SelectItem key={conn.id} value={conn.id}>
//                   {conn.name} ({conn.id})
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         </div>
//         <div>
//           <Label>Share Interval (ms)</Label>
//           <Input
//             type="number"
//             min={1}
//             value={shareInterval}
//             onChange={(e) => setShareInterval(Number(e.target.value))}
//             className="w-24"
//           />
//         </div>
//         <Button
//           onClick={handleShareTarget}
//           disabled={!selectedTargetId || !selectedConnectionId}
//           variant="default"
//         >
//           Start Share ({shareInterval}ms)
//         </Button>
//       </div>
//       {activeShares.length > 0 && (
//         <div className="mt-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Active Shares</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <ul className="space-y-2">
//                 {activeShares.map(({ shareId, connectionId }) => (
//                   <li
//                     key={shareId + "->" + connectionId}
//                     className="flex items-center gap-2"
//                   >
//                     <span className="font-mono">
//                       {shareId} → {connectionId}
//                     </span>
//                     <Button
//                       variant="destructive"
//                       size="sm"
//                       onClick={() =>
//                         handleStopActiveShare(shareId, connectionId)
//                       }
//                     >
//                       Stop
//                     </Button>
//                   </li>
//                 ))}
//               </ul>
//             </CardContent>
//           </Card>
//         </div>
//       )}
//       {shareConnId && (
//         <div
//           style={{
//             marginTop: 8,
//             display: "flex",
//             alignItems: "center",
//             gap: 12,
//           }}
//         >
//           <Badge>
//             Sharing Target {selectedTargetId} to {selectedConnectionId} (Share
//             ID: {shareConnId})
//           </Badge>
//           <Button onClick={handleStopShare} variant="destructive" size="sm">
//             Stop Share
//           </Button>
//         </div>
//       )}
//       {shareError && (
//         <div style={{ color: "red", marginTop: 8 }}>{shareError}</div>
//       )}
//       {/* Storage Statistics */}
//       {Object.keys(storageStats).length > 0 && (
//         <div className="mt-4">
//           <Card className="p-4">
//             <CardHeader>
//               <CardTitle className="text-sm font-mono">
//                 Storage Statistics
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//                 {Object.entries(storageStats).map(
//                   ([connectionId, packetCount]) => (
//                     <div
//                       key={connectionId}
//                       className="text-center p-3 bg-blue-50 rounded"
//                     >
//                       <div className="text-lg font-bold text-blue-600">
//                         {packetCount}
//                       </div>
//                       <div className="text-xs text-gray-600">Saved Packets</div>
//                       <div className="text-xs text-blue-500">
//                         {connectionId}
//                       </div>
//                     </div>
//                   )
//                 )}
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       )}
//       {/* Debug Information */}
//       {(logsDirectory || appRootDirectory) && (
//         <div className="mt-4">
//           <Card className="p-4">
//             <CardHeader>
//               <CardTitle className="text-sm font-mono">
//                 Debug Information
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-2">
//                 {appRootDirectory && (
//                   <div>
//                     <div className="text-xs font-semibold text-gray-600 mb-1">
//                       App Root Directory:
//                     </div>
//                     <div className="bg-blue-50 p-2 rounded font-mono text-sm">
//                       {appRootDirectory}
//                     </div>
//                   </div>
//                 )}
//                 {logsDirectory && (
//                   <div>
//                     <div className="text-xs font-semibold text-gray-600 mb-1">
//                       Logs Directory:
//                     </div>
//                     <div className="bg-gray-100 p-2 rounded font-mono text-sm">
//                       {logsDirectory}
//                     </div>
//                   </div>
//                 )}
//                 <div>
//                   <div className="text-xs font-semibold text-gray-600 mb-1">
//                     Connection Status:
//                   </div>
//                   <div className="bg-yellow-50 p-2 rounded font-mono text-sm">
//                     Active Connections: {connections.length} | Total Packets:{" "}
//                     {Object.values(data).reduce(
//                       (sum, packets) => sum + packets.length,
//                       0
//                     )}{" "}
//                     | Active Tabs: {Object.keys(data).length}
//                   </div>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       )}

//       {/* Simulation UDP Streaming Section */}
//       <Separator className="my-6" />
//       <Card>
//         <CardHeader>
//           <CardTitle>Simulation UDP Streaming</CardTitle>
//           <CardDescription>
//             Start or stop UDP streaming of simulation results.
//           </CardDescription>
//         </CardHeader>
//         <CardContent>
//           <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
//             <Label>Local Addr</Label>
//             <Input
//               value={simLocalAddr}
//               onChange={(e) => setSimLocalAddr(e.target.value)}
//               style={{ width: 160 }}
//             />
//             <Label>Remote Addr</Label>
//             <Input
//               value={simRemoteAddr}
//               onChange={(e) => setSimRemoteAddr(e.target.value)}
//               style={{ width: 160 }}
//             />
//             <Label>Interval (ms)</Label>
//             <Input
//               type="number"
//               value={simInterval}
//               onChange={(e) => setSimInterval(Number(e.target.value))}
//               style={{ width: 100 }}
//             />
//             <Button 
//               onClick={handleStartSimUdp} 
//               disabled={!!simUdpConnId || activeSimulationStreams.length > 0 || isStartingSimUdp}
//               title={activeSimulationStreams.length > 0 ? "Stop existing simulation streams first" : "Start Simulation UDP Streaming"}
//             >
//               {isStartingSimUdp ? "Starting..." : "Start"}
//             </Button>
//             <Button
//               onClick={handleStopSimUdp}
//               disabled={(!simUdpConnId && activeSimulationStreams.length === 0) || isStoppingSimUdp}
//               variant="destructive"
//               title={!simUdpConnId && activeSimulationStreams.length === 0 ? "No simulation streaming to stop" : "Stop Simulation UDP Streaming"}
//             >
//               {isStoppingSimUdp ? "Stopping..." : "Stop"}
//             </Button>
//             {(simUdpConnId || activeSimulationStreams.length > 0) && (
//               <Button
//                 onClick={() => {
//                   // Emergency stop - just clear the state
//                   setSimUdpConnId(null);
//                   setActiveSimulationStreams([]);
//                   setSimUdpError(null);
//                 }}
//                 variant="outline"
//                 size="sm"
//                 title="Emergency stop - clear state without backend call"
//               >
//                 Force Clear
//               </Button>
//             )}
//           </div>
//           {(simUdpConnId || activeSimulationStreams.length > 0) && (
//             <div style={{ marginTop: 8 }}>
//               {simUdpConnId && (
//                 <Badge className="mr-2">UDP Streaming Connection ID: {simUdpConnId}</Badge>
//               )}
//               {activeSimulationStreams.length > 0 && (
//                 <Badge variant="secondary">
//                   {activeSimulationStreams.length} Active Stream{activeSimulationStreams.length !== 1 ? 's' : ''}
//                 </Badge>
//               )}
//             </div>
//           )}
//           {simUdpError && (
//             <div style={{ color: "red", marginTop: 8 }}>{simUdpError}</div>
//           )}
//           {activeSimulationStreams.length > 0 && (
//             <div style={{ marginTop: 16 }}>
//               <Label>Active Simulation Streams:</Label>
//               <div style={{ marginTop: 8 }}>
//                 {activeSimulationStreams.map((streamId) => (
//                   <Badge key={streamId} style={{ marginRight: 8, marginBottom: 4 }}>
//                     {streamId}
//                   </Badge>
//                 ))}
//               </div>
//             </div>
//           )}
//         </CardContent>
//       </Card>
//       {allActiveShares.filter((s) => s.connectionId.startsWith("sim_udp_"))
//         .length > 0 && (
//         <div className="mt-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Active Simulation UDP Streams</CardTitle>
//               <CardDescription>
//                 Currently running simulation UDP streaming shares. You can stop
//                 them here.
//               </CardDescription>
//             </CardHeader>
//             <CardContent>
//               <table style={{ width: "100%", fontSize: 14 }}>
//                 <thead>
//                   <tr>
//                     <th style={{ textAlign: "left" }}>Share ID</th>
//                     <th style={{ textAlign: "left" }}>Connection ID</th>
//                     <th></th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {allActiveShares
//                     .filter((s) => s.connectionId.startsWith("sim_udp_"))
//                     .map((s) => (
//                       <tr key={s.shareId + s.connectionId}>
//                         <td>{s.shareId}</td>
//                         <td>{s.connectionId}</td>
//                         <td>
//                           <Button
//                             size="sm"
//                             variant="destructive"
//                             onClick={() =>
//                               handleStopAnyShare(s.shareId, s.connectionId)
//                             }
//                           >
//                             Stop
//                           </Button>
//                         </td>
//                       </tr>
//                     ))}
//                 </tbody>
//               </table>
//             </CardContent>
//           </Card>
//         </div>
//       )}
//       {/* Global Active Shares */}
//       {activeShares.length > 0 && (
//         <div className="mt-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Active Shares</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <ul className="space-y-2">
//                 {activeShares.map(({ shareId, connectionId }) => (
//                   <li
//                     key={shareId + "->" + connectionId}
//                     className="flex items-center gap-2"
//                   >
//                     <span className="font-mono">
//                       {shareId} → {connectionId}
//                     </span>
//                     <Button
//                       variant="destructive"
//                       size="sm"
//                       onClick={() =>
//                         handleStopActiveShare(shareId, connectionId)
//                       }
//                     >
//                       Stop
//                     </Button>
//                   </li>
//                 ))}
//               </ul>
//             </CardContent>
//           </Card>
//         </div>
//       )}
//       {shareConnId && (
//         <div
//           style={{
//             marginTop: 8,
//             display: "flex",
//             alignItems: "center",
//             gap: 12,
//           }}
//         >
//           <Badge>
//             Sharing Target {selectedTargetId} to {selectedConnectionId} (Share
//             ID: {shareConnId})
//           </Badge>
//           <Button onClick={handleStopShare} variant="destructive" size="sm">
//             Stop Share
//           </Button>
//         </div>
//       )}
//       {shareError && (
//         <div style={{ color: "red", marginTop: 8 }}>{shareError}</div>
//       )}

//       {/*List Connection */}

//       {connections.map((conn, index) => (
//         <Card key={index} className="space-y-4">
//           <CardHeader>
//             <div className="flex items-center justify-between">
//               <div>
//                 <CardTitle className="flex items-center gap-2">
//                   <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
//                   {conn.id}
//                   {hasActiveShares(conn.id) && (
//                     <Badge variant="secondary" className="ml-2">
//                       {getActiveSharesCount(conn.id)} Active Share{getActiveSharesCount(conn.id) !== 1 ? 's' : ''}
//                     </Badge>
//                   )}
//                 </CardTitle>
//                 <CardDescription>Connected to {conn.name}</CardDescription>
//               </div>
//               <div className="flex items-center gap-2">
//                 <Button
//                   onClick={() => send(conn.id, conn.name, "Header")}
//                   size="sm"
//                   className="bg-blue-600 hover:bg-blue-700"
//                 >
//                   Send Header
//                 </Button>
//                 <Button
//                   onClick={() => send(conn.id, conn.name, "Payload")}
//                   size="sm"
//                   className="bg-purple-600 hover:bg-purple-700"
//                 >
//                   Send Payload
//                 </Button>
//                 <Button
//                   onClick={() => clearData(conn.id)}
//                   variant="outline"
//                   size="sm"
//                 >
//                   Clear Data
//                 </Button>
//                 <Button
//                   onClick={() => disconnect(conn.id, conn.name, "Header")}
//                   variant="destructive"
//                   size="sm"
//                   disabled={hasActiveShares(conn.id)}
//                   title={hasActiveShares(conn.id) ? "Cannot disconnect while shares are running. Stop all shares first." : "Disconnect"}
//                   className={hasActiveShares(conn.id) ? "opacity-50 cursor-not-allowed" : ""}
//                 >
//                   Disconnect
//                 </Button>
//               </div>
//             </div>
//           </CardHeader>
//           <CardContent className="space-y-4">
//             {/* Per-connection packet type counters */}
//             {connectionPacketTypeCounts[conn.id] && (
//               <div className="flex flex-wrap gap-2 mb-2">
//                 {Object.entries(connectionPacketTypeCounts[conn.id]).map(
//                   ([type, count]) => (
//                     <div
//                       key={type}
//                       className="flex flex-col items-center p-2 bg-blue-100 rounded min-w-[70px]"
//                     >
//                       <span className="text-xs font-semibold text-blue-700 capitalize">
//                         {type}
//                       </span>
//                       <span className="text-lg font-mono text-green-700">
//                         {count}
//                       </span>
//                     </div>
//                   )
//                 )}
//               </div>
//             )}
//             <div className="flex gap-2 flex-wrap">
//               <Button
//                 onClick={() => loadLogData(conn.id)}
//                 variant="outline"
//                 size="sm"
//               >
//                 Load Log
//               </Button>
//               <Button
//                 onClick={() => toggleLogData(conn.id)}
//                 variant="outline"
//                 size="sm"
//               >
//                 {showLogData[conn.id] ? "Hide Log" : "Show Log"}
//               </Button>
//             </div>
            
//             {/* Show active shares for this connection */}
//             {hasActiveShares(conn.id) && (
//               <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
//                 <div className="text-sm font-medium text-yellow-800 mb-2">
//                   Active Shares ({getActiveSharesCount(conn.id)})
//                 </div>
//                 <div className="space-y-1">
//                   {allActiveShares
//                     .filter(share => share.connectionId === conn.id)
//                     .map((share, index) => (
//                       <div key={index} className="flex items-center justify-between text-xs">
//                         <span className="font-mono text-yellow-700">{share.shareId}</span>
//                         <Button
//                           size="sm"
//                           variant="outline"
//                           onClick={() => handleStopAnyShare(share.shareId, share.connectionId)}
//                           className="h-6 px-2 text-xs"
//                         >
//                           Stop
//                         </Button>
//                       </div>
//                     ))}
//                 </div>
//               </div>
//             )}

//             {/* Log Data Display */}
//             {showLogData[conn.id] && (
//               <div className="space-y-4">
//                 <div>
//                   <Label className="mb-2 block font-medium items-center gap-2">
//                     <div className="w-2 h-2 bg-purple-500 rounded-full"></div>F
//                     Log Data
//                   </Label>
//                   <div className="h-64 overflow-auto rounded-lg border bg-purple-50 text-sm font-mono p-3">
//                     {(logData[conn.id] || []).map((logLine, index) => (
//                       <div
//                         key={index}
//                         className="p-2 border-b border-purple-200 last:border-b-0 bg-purple-100 rounded mb-1"
//                       >
//                         <div className="text-xs text-purple-700">{logLine}</div>
//                       </div>
//                     ))}
//                     {(!logData[conn.id] || logData[conn.id].length === 0) && (
//                       <div className="text-gray-500 italic text-center py-8">
//                         No log data available
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             )}
//           </CardContent>
//         </Card>
//       ))}

//       {/* Received Data Display */}
//       <div className="mt-8">
//         <h3 className="text-lg font-bold mb-4">Real-time Packet Data</h3>

//         {/* Real-time Packet Display */}
//         <div className="mb-6">
//           <Card className="p-4">
//             <CardHeader>
//               <CardTitle className="text-sm font-mono flex justify-between items-center">
//                 <span>Live Packet Stream</span>
//                 <div className="flex gap-2">
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => setData({})}
//                   >
//                     Clear All
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => {
//                       if (activeTab) {
//                         setData((prev) => ({ ...prev, [activeTab]: [] }));
//                       }
//                     }}
//                   >
//                     Clear Current
//                   </Button>
//                 </div>
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <Tabs value={activeTab} onValueChange={setActiveTab}>
//                 <TabsList>
//                   {Object.keys(data).map((id) => (
//                     <TabsTrigger
//                       key={id}
//                       value={id}
//                     >{`Connection: ${id}`}</TabsTrigger>
//                   ))}
//                 </TabsList>
//                 {Object.keys(data).map((id) => (
//                   <TabsContent key={id} value={id}>
//                     <div className="space-y-4">
//                       <div className="flex justify-between items-center text-sm text-muted-foreground">
//                         <span>
//                           Showing last {data[id].length} packets from {id}
//                         </span>
//                         <div className="flex gap-4">
//                           <span className="text-blue-600 font-semibold">
//                             Total: {data[id].length}
//                           </span>
//                           <span className="text-green-600 font-semibold">
//                             {packetCounts[id]?.count || 0} packets/sec
//                           </span>
//                         </div>
//                       </div>

//                       <div className="max-h-96 overflow-y-auto space-y-3">
//                         {data[id]
//                           .slice(-20)
//                           .reverse()
//                           .map(({ packet, timestamp, id: packetId }, index) => {
//                             const kind: any = (packet as any).kind || {};
//                             let isTargetPacket = false;
//                             let isTargetPacketList = false;
//                             let targetPacket: any = null;
//                             let targetPacketList: any = null;
//                             if (kind.TargetPacket) {
//                               isTargetPacket = true;
//                               targetPacket = kind.TargetPacket;
//                             } else if (kind.TargetPacketList) {
//                               isTargetPacketList = true;
//                               targetPacketList = kind.TargetPacketList;
//                             }
//                             return (
//                               <div
//                                 key={packetId || `packet-${index}`}
//                                 className="p-4 border rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
//                               >
//                                 <div className="flex justify-between items-start mb-3">
//                                   <div className="flex items-center gap-2">
//                                     <span className="text-xs text-muted-foreground">
//                                       {new Date(timestamp).toLocaleTimeString()}
//                                     </span>
//                                     <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
//                                       Packet #{data[id].length - index}
//                                     </span>
//                                   </div>
//                                   <div className="text-xs text-muted-foreground">
//                                     {Object.keys(packet).length} fields
//                                   </div>
//                                 </div>
//                                 <div className="space-y-2">
//                                   {isTargetPacket && (
//                                     <div className="bg-blue-50 p-3 rounded border">
//                                       <div className="font-bold text-blue-700 mb-1">
//                                         TargetPacket
//                                       </div>
//                                       <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-muted p-2 rounded">
//                                         {JSON.stringify(targetPacket, null, 2)}
//                                       </pre>
//                                     </div>
//                                   )}
//                                   {isTargetPacketList && (
//                                     <div className="bg-green-50 p-3 rounded border">
//                                       <div className="font-bold text-green-700 mb-1">
//                                         TargetPacketList (
//                                         {Array.isArray(targetPacketList.packets)
//                                           ? targetPacketList.packets.length
//                                           : 0}{" "}
//                                         packets)
//                                       </div>
//                                       <div className="space-y-1">
//                                         {Array.isArray(
//                                           targetPacketList.packets
//                                         ) &&
//                                           targetPacketList.packets.map(
//                                             (tp: any, i: number) => {
//                                               return (
//                                                 <div
//                                                   key={i}
//                                                   className="bg-white border rounded p-2 text-xs"
//                                                 >
//                                                   <b>Target ID:</b>{" "}
//                                                   {tp.target_id}, <b>lat:</b>{" "}
//                                                   {tp.lat}, <b>lon:</b> {tp.lon}
//                                                   , <b>alt:</b> {tp.alt},{" "}
//                                                   <b>time:</b> {tp.time}
//                                                 </div>
//                                               );
//                                             }
//                                           )}
//                                       </div>
//                                     </div>
//                                   )}
//                                   {!isTargetPacket &&
//                                     !isTargetPacketList &&
//                                     Object.entries(packet).map(
//                                       ([key, value]) => (
//                                         <div
//                                           key={key}
//                                           className="bg-background p-3 rounded border"
//                                         >
//                                           <div className="flex justify-between items-center mb-1">
//                                             <div className="text-sm font-semibold text-blue-600">
//                                               {key}
//                                             </div>
//                                             <div className="text-xs text-gray-500">
//                                               {typeof value} •{" "}
//                                               {Array.isArray(value)
//                                                 ? value.length
//                                                 : "N/A"}{" "}
//                                               items
//                                             </div>
//                                           </div>
//                                           <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-muted p-2 rounded">
//                                             {JSON.stringify(value, null, 2)}
//                                           </pre>
//                                         </div>
//                                       )
//                                     )}
//                                   {Object.keys(packet).length === 0 &&
//                                     !isTargetPacket &&
//                                     !isTargetPacketList && (
//                                       <div className="text-xs text-gray-500 italic">
//                                         Empty packet
//                                       </div>
//                                     )}
//                                 </div>
//                               </div>
//                             );
//                           })}

//                         {data[id].length === 0 && (
//                           <div className="text-center py-8 text-muted-foreground">
//                             <p className="text-lg">No packets received yet</p>
//                             <p className="text-sm">
//                               Packets will appear here in real-time as they are
//                               received
//                             </p>
//                           </div>
//                         )}
//                       </div>
//                     </div>
//                   </TabsContent>
//                 ))}
//               </Tabs>
//             </CardContent>
//           </Card>
//         </div>

//         {/* Packet Type Breakdown */}
//       </div>
//       <Separator className="my-6" />
//       <Card>
//         <CardHeader>
//           <CardTitle>Multiple UDP Listeners</CardTitle>
//           <CardDescription>
//             Start multiple UDP listeners on different ports to receive data from various sources simultaneously.
//           </CardDescription>
//         </CardHeader>
//         <CardContent>
//           {/* Add New Listener */}
//           <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
//             <Label>Local Listen Addr</Label>
//             <Input
//               value={newUdpListenAddr}
//               onChange={(e) => setNewUdpListenAddr(e.target.value)}
//               style={{ width: 160 }}
//               placeholder="127.0.0.1:5000"
//             />
//             <Button onClick={handleAddUdpListener} disabled={!newUdpListenAddr}>
//               Add Listener
//             </Button>
//           </div>
          
//           {/* List of Active Listeners */}
//           {udpListeners.length > 0 && (
//             <div className="space-y-4">
//               <h4 className="font-semibold">Active Listeners ({udpListeners.length})</h4>
//               {udpListeners.map((listener) => (
//                 <div key={listener.id} className="border rounded p-4 bg-gray-50">
//                   <div className="flex items-center justify-between">
//                     <div>
//                       <div className="font-mono text-sm">{listener.address}</div>
//                       <div className="text-xs text-gray-600">
//                         Status: {listener.status}
//                         {listener.connectionId && (
//                           <span className="ml-2">(ID: {listener.connectionId})</span>
//                         )}
//                       </div>
//                       {listener.error && (
//                         <div className="text-xs text-red-600 mt-1">{listener.error}</div>
//                       )}
//                     </div>
//                     <div className="flex gap-2">
//                       {listener.connectionId ? (
//                         <Button
//                           onClick={() => handleStopUdpListener(listener.id)}
//                           variant="destructive"
//                           size="sm"
//                         >
//                           Stop
//                         </Button>
//                       ) : (
//                         <Button
//                           onClick={() => handleStartUdpListener(listener.id)}
//                           size="sm"
//                         >
//                           Start
//                         </Button>
//                       )}
//                       <Button
//                         onClick={() => handleRemoveUdpListener(listener.id)}
//                         variant="outline"
//                         size="sm"
//                       >
//                         Remove
//                       </Button>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
          
//           {udpListeners.length === 0 && (
//             <div className="text-gray-500 text-center py-4">
//               No UDP listeners configured. Add one above to start listening for UDP data.
//             </div>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// }
