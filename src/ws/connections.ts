// Create a more abstract interface that captures just what you need
interface WebSocketInterface {
  send: (data: string) => void;
  close: () => void;
}

export const activeConnections = new Map<string, WebSocketInterface>();

// Use type assertion to make TypeScript accept the parameter
export function addConnection(userId: string, ws: any): void {
  // Store only what we need from the ws object
  const connection: WebSocketInterface = {
    send: (data: string) => ws.send(data),
    close: () => ws.close(),
  };

  activeConnections.set(userId, connection);
  console.log(
    `User ${userId} connected. Active connections: ${activeConnections.size}`,
  );
}

export function removeConnection(userId: string): void {
  if (activeConnections.has(userId)) {
    activeConnections.delete(userId);
    console.log(
      `User ${userId} disconnected. Active connections: ${activeConnections.size}`,
    );
  }
}

export function getConnection(userId: string): WebSocketInterface | undefined {
  return activeConnections.get(userId);
}

export function getUserIds(): string[] {
  return Array.from(activeConnections.keys());
}
