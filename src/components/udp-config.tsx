"use client";

import type React from "react";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { truncateText } from "@/utils/text-utils";
import { isValidAddress } from "@/utils/validation-utils";
import type { UdpListener, BaseComponentProps } from "@/types";

/**
 * Props for UdpListeners component
 */
interface UdpListenersProps extends BaseComponentProps {
  /** Array of active UDP listeners */
  udpListeners: UdpListener[];
  /** Function to add a new UDP listener */
  onAddUdpListener: (address: string) => Promise<
    {
      id: string;
      name: string;
    }[]
  >;
  /** Function to remove a UDP listener */
  onRemoveUdpListener: (listenerId: string) => Promise<void>;
  /** Function to refresh connections after listener changes */
  onRefreshConnections: () => Promise<void>;
}

/**
 * UdpListeners Component
 *
 * Manages UDP listener configuration and lifecycle:
 * - Add new UDP listeners with address validation
 * - Display active listeners with status information
 * - Remove listeners with connection cleanup
 * - Scrollable list for multiple listeners
 *
 * @param props - Component props
 * @returns JSX element for UDP listeners management
 *
 * @example
 * \`\`\`tsx
 * <UdpListeners
 *   udpListeners={listeners}
 *   onAddUdpListener={handleAddListener}
 *   onRemoveUdpListener={handleRemoveListener}
 *   onRefreshConnections={handleRefresh}
 * />
 * \`\`\`
 */
export function UdpListeners({
  udpListeners,
  onAddUdpListener,
  onRemoveUdpListener,
  onRefreshConnections,
  className,
}: UdpListenersProps) {
  const [newUdpListenAddr, setNewUdpListenAddr] = useState("127.0.0.1:5000");
  const [loading, setLoading] = useState(false);

  /**
   * Validates the new listener address
   */
  const isAddressValid = isValidAddress(newUdpListenAddr);

  /**
   * Handles adding a new UDP listener
   */
  const handleAddListener = async () => {
    if (!newUdpListenAddr || !isAddressValid) return;

    setLoading(true);
    try {
      await onAddUdpListener(newUdpListenAddr);
      await onRefreshConnections();
      setNewUdpListenAddr("");
    } catch (error: any) {
      alert(error.message || "Failed to add UDP listener");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles removing a UDP listener
   */
  const handleRemoveListener = async (listenerId: string) => {
    try {
      await onRemoveUdpListener(listenerId);
      await onRefreshConnections();
    } catch (error: any) {
      console.error("Failed to remove UDP listener:", error);
      alert(error.message || "Failed to remove UDP listener");
    }
  };

  /**
   * Handles Enter key press in address input
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isAddressValid && !loading) {
      handleAddListener();
    }
  };

  /**
   * Gets status badge variant based on listener status
   */
  const getStatusVariant = (status: string) => {
    if (status.includes("Listening")) return "default";
    if (status.includes("Failed") || status.includes("Error"))
      return "destructive";
    return "secondary";
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>UDP Listeners</span>
          <Badge variant="secondary">{udpListeners.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Listener Form */}
        <div className="flex gap-4 items-end">
          <div className="flex-1 flex flex-col">
            <Label htmlFor="listener-address">Local Listen Address</Label>
            <Input
              id="listener-address"
              value={newUdpListenAddr}
              onChange={(e) => setNewUdpListenAddr(e.target.value)}
              placeholder="127.0.0.1:5000"
              onKeyDown={handleKeyDown}
              className={
                !isAddressValid && newUdpListenAddr ? "border-red-500" : ""
              }
            />
            {newUdpListenAddr && !isAddressValid && (
              <span className="text-xs text-red-500 mt-1">
                Invalid address format (use IP:PORT)
              </span>
            )}
          </div>
          <Button
            onClick={handleAddListener}
            disabled={!newUdpListenAddr || !isAddressValid || loading}
            title={
              !isAddressValid
                ? "Enter valid IP:PORT format"
                : "Add UDP listener"
            }
          >
            {loading ? "Adding..." : "Add Listener"}
          </Button>
        </div>

        {/* Active Listeners List */}
        {udpListeners.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h5 className="font-semibold">Active Listeners</h5>
              <Badge variant="secondary">{udpListeners.length}</Badge>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {udpListeners.map((listener) => (
                <div
                  key={listener.id}
                  className="flex items-center justify-between p-3 border rounded bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-mono text-sm truncate"
                      title={listener.address}
                    >
                      {truncateText(listener.address, 30)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={getStatusVariant(listener.status)}
                        className="text-xs"
                      >
                        {listener.status}
                      </Badge>
                      {listener.connectionId && (
                        <span
                          className="text-xs text-muted-foreground truncate"
                          title={listener.connectionId}
                        >
                          ID: {truncateText(listener.connectionId, 15)}
                        </span>
                      )}
                    </div>
                    {listener.error && (
                      <div
                        className="text-xs text-red-600 mt-1 truncate"
                        title={listener.error}
                      >
                        {truncateText(listener.error, 40)}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleRemoveListener(listener.id)}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {udpListeners.length === 0 && (
          <div className="text-muted-foreground text-center py-4 text-sm">
            No UDP listeners configured. Add one above to start listening for
            UDP data.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
