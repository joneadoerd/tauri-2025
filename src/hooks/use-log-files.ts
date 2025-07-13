"use client"

import { useState, useCallback } from "react"
import { listLogFiles, readLogFile, getLogsDirectory, getAppRootDirectory } from "@/lib/serial"

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
    logFiles,
    logData,
    showLogData,
    logsDirectory,
    appRootDirectory,
    loadLogFiles,
    loadLogData,
    toggleLogData,
    loadLogsDirectory,
    loadAppRootDirectory,
    clearLogFiles,
  }
}
