"use client"

import { useState, useCallback } from "react"
import { listLogFiles, readLogFile, getLogsDirectory, getAppRootDirectory } from "@/lib/serial"

/**
 * Custom hook for managing log files and directories
 *
 * Provides functionality to:
 * - Load and manage log files
 * - Read log data for connections
 * - Handle log visibility states
 * - Manage directory paths
 *
 * @returns Object containing log file state and management functions
 *
 * @example
 * \`\`\`typescript
 * const {
 *   logFiles,
 *   logData,
 *   loadLogFiles,
 *   loadLogData,
 *   toggleLogData
 * } = useLogFiles()
 *
 * // Load log files
 * await loadLogFiles()
 *
 * // Load log data for connection
 * await loadLogData("connection-id")
 * \`\`\`
 */
export function useLogFiles() {
  const [logFiles, setLogFiles] = useState<string[]>([])
  const [logData, setLogData] = useState<Record<string, string[]>>({})
  const [showLogData, setShowLogData] = useState<Record<string, boolean>>({})
  const [logsDirectory, setLogsDirectory] = useState("")
  const [appRootDirectory, setAppRootDirectory] = useState("")

  const loadLogFiles = useCallback(async () => {
    try {
      const files = await listLogFiles()
      setLogFiles(files)
      console.log("Loaded log files:", files)
    } catch (error) {
      console.error("Failed to load log files:", error)
    }
  }, [])

  const loadLogData = useCallback(async (connectionId: string) => {
    try {
      const data = await readLogFile(connectionId)
      setLogData((prev) => ({
        ...prev,
        [connectionId]: data,
      }))
      setShowLogData((prev) => ({
        ...prev,
        [connectionId]: true,
      }))
    } catch (error) {
      console.error("Failed to load log data:", error)
    }
  }, [])

  const toggleLogData = useCallback((connectionId: string) => {
    setShowLogData((prev) => ({
      ...prev,
      [connectionId]: !prev[connectionId],
    }))
  }, [])

  const loadLogsDirectory = useCallback(async () => {
    try {
      const dir = await getLogsDirectory()
      setLogsDirectory(dir as string)
    } catch (error) {
      console.error("Failed to load logs directory:", error)
    }
  }, [])

  const loadAppRootDirectory = useCallback(async () => {
    try {
      const dir = await getAppRootDirectory()
      setAppRootDirectory(dir)
    } catch (error) {
      console.error("Failed to load app root directory:", error)
    }
  }, [])

  const clearLogFiles = useCallback(() => {
    setLogFiles([])
    setLogData({})
    setShowLogData({})
  }, [])

  return {
    /** Array of available log file names */
    logFiles,
    /** Log data organized by connection ID */
    logData,
    /** Log visibility state by connection ID */
    showLogData,
    /** Path to logs directory */
    logsDirectory,
    /** Path to application root directory */
    appRootDirectory,
    /** Function to load available log files */
    loadLogFiles,
    /** Function to load log data for connection */
    loadLogData,
    /** Function to toggle log data visibility */
    toggleLogData,
    /** Function to load logs directory path */
    loadLogsDirectory,
    /** Function to load app root directory path */
    loadAppRootDirectory,
    /** Function to clear all log files and data */
    clearLogFiles,
  }
}
