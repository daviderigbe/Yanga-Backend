import {
  activeConnections,
  addConnection,
  getConnection,
  removeConnection,
} from "./connections";
import { validateSessionToken } from "../lib/auth";
import { createBaseElysia } from "../base";

export const wsHandler = createBaseElysia().ws("/ws/messages", {
  // Handle new WebSocket connections
  async open(ws) {
    try {
      // Extract user ID and session token from query params
      const sessionToken = ws.data.query.token as string;

      if (!sessionToken) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Authentication required",
          }),
        );
        ws.close();
        return;
      }

      // Validate the session token
      const { session, user } = await validateSessionToken(sessionToken);

      if (!session || !user) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid session",
          }),
        );
        ws.close();
        return;
      }

      // Store the connection with the user ID
      addConnection(user.id, ws);

      // Send connection confirmation
      ws.send(
        JSON.stringify({
          type: "connected",
          userId: user.id,
          timestamp: Date.now(),
        }),
      );
    } catch (error) {
      console.error("WebSocket connection error:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Connection error",
        }),
      );
      ws.close();
    }
  },

  // Handle client messages (e.g., typing indicators)
  // Handle client messages (e.g., typing indicators)
  message(ws, message) {
    try {
      // Parse the message if it's a string
      if (typeof message === "string") {
        message = JSON.parse(message);
      }

      if (typeof message !== "object" || message === null) {
        return;
      }

      // Handle different message types
      if ("type" in message) {
        // For TYPING or other user-to-user events
        if (message.type === "TYPING" || message.type === "CUSTOM_EVENT") {
          const { from, to, conversationId } = message;
          if (from && to && conversationId) {
            const connection = getConnection(to);
            if (connection) {
              connection.send(
                JSON.stringify({
                  type: message.type,
                  from,
                  conversationId,
                  payload: message.payload || {},
                  timestamp: Date.now(),
                }),
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  },

  // Handle disconnections
  close(ws) {
    try {
      // Find the user ID associated with this connection
      for (const [userId, conn] of activeConnections.entries()) {
        if (conn === ws) {
          removeConnection(userId);
          break;
        }
      }
    } catch (error) {
      console.error("Error handling WebSocket close:", error);
    }
  },
});
