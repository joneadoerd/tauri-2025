import { invoke } from "@tauri-apps/api/core"

/**
 * Lists all available log files
 * @returns Promise<string[]> Array of log file names
 */
export async function listLogFiles(): Promise<string[]> {
  try {
    return await invoke<string[]>("list_log_files")
  } catch (error) {
    console.error("Failed to list log files:", error)
    throw new Error(`Failed to list log files: ${error}`)
  }
}

/**
 * Reads log file content for a specific connection
 * @param connectionId - Connection ID to read logs for
 * @returns Promise<string[]> Array of log lines
 */
export async function readLogFile(connectionId: string): Promise<string[]> {
  try {
    return await invoke<string[]>("read_log_file", { connectionId })
  } catch (error) {
    console.error("Failed to read log file:", error)
    throw new Error(`Failed to read log file: ${error}`)
  }
}

/**
 * Gets the logs directory path
 * @returns Promise<string> Logs directory path
 */
export async function getLogsDirectory(): Promise<string> {
  try {
    return await invoke<string>("get_logs_directory")
  } catch (error) {
    console.error("Failed to get logs directory:", error)
    throw new Error(`Failed to get logs directory: ${error}`)
  }
}

/**
 * Gets the application root directory path
 * @returns Promise<string> App root directory path
 */
export async function getAppRootDirectory(): Promise<string> {
  try {
    return await invoke<string>("get_app_root_directory")
  } catch (error) {
    console.error("Failed to get app root directory:", error)
    throw new Error(`Failed to get app root directory: ${error}`)
  }
}

/**
 * Clears log file for a specific connection
 * @param connectionId - Connection ID to clear logs for
 */
export async function clearLogFile(connectionId: string): Promise<void> {
  try {
    await invoke("clear_log_file", { connectionId })
  } catch (error) {
    console.error("Failed to clear log file:", error)
    throw new Error(`Failed to clear log file: ${error}`)
  }
}

/**
 * Exports log data to a file
 * @param connectionId - Connection ID to export logs for
 * @param filePath - Path where to save the exported file
 */
export async function exportLogFile(connectionId: string, filePath: string): Promise<void> {
  try {
    await invoke("export_log_file", {
      connectionId: connectionId,
      filePath: filePath,
    })
  } catch (error) {
    console.error("Failed to export log file:", error)
    throw new Error(`Failed to export log file: ${error}`)
  }
}
