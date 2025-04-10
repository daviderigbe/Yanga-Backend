import { activeConnections } from "./connections";

// Define event types
export type MessageEvent = {
  type: "NEW_MESSAGE" | "MESSAGE_READ" | "USER_TYPING" | "NOTIFICATION";
  to: string; // Recipient user ID
  from?: string; // Sender user ID (optional)
  conversationId?: string; // Related conversation ID (optional)
  data: any; // Event payload
};

// Function to send event to a specific user
export function broadcastToUser(userId: string, event: any): boolean {
  const connection = activeConnections.get(userId);

  if (connection) {
    try {
      connection.send(JSON.stringify(event));
      return true;
    } catch (error) {
      console.error(`Error broadcasting to user ${userId}:`, error);
      return false;
    }
  }

  return false;
}

// Main broadcast function for message events
export function broadcastMessageEvent(event: MessageEvent): void {
  // Send to recipient
  broadcastToUser(event.to, {
    type: event.type,
    from: event.from,
    conversationId: event.conversationId,
    data: event.data,
    timestamp: Date.now(),
  });

  // If this is a conversation message, also notify the sender if they're connected
  if (event.from && event.type === "NEW_MESSAGE") {
    broadcastToUser(event.from, {
      type: "MESSAGE_SENT",
      to: event.to,
      conversationId: event.conversationId,
      data: event.data,
      timestamp: Date.now(),
    });
  }
}

// Broadcast to all users except specified ones
export function broadcastToAll(
  event: any,
  excludeUserIds: string[] = [],
): void {
  for (const [userId, connection] of activeConnections.entries()) {
    if (!excludeUserIds.includes(userId)) {
      try {
        connection.send(JSON.stringify(event));
      } catch (error) {
        console.error(`Error broadcasting to user ${userId}:`, error);
      }
    }
  }
}
