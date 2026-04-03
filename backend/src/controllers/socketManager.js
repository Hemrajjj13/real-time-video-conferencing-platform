import { Server } from "socket.io";

const connections = {};
const messages = {};
const timeOnline = {};
const socketMeta = {};

const getRoomForSocket = (socketId) =>
  socketMeta[socketId]?.roomId ?? "";

const emitChatHistory = (io, roomId, socketId) => {
  (messages[roomId] ?? []).forEach((entry) => {
    io.to(socketId).emit("chat-message", entry);
  });
};

const createPeerConnectionList = (roomId, socketId) => {
  const roomConnections = connections[roomId] ?? [];
  const peers = roomConnections
    .filter((id) => id !== socketId)
    .map((id) => ({
      socketId: id,
      username: socketMeta[id]?.username || "Guest",
    }));
  return peers;
};

const joinRoom = (io, socket, roomId, username = "Guest") => {
  if (!roomId) {
    return;
  }

  if (!connections[roomId]) {
    connections[roomId] = [];
  }

  if (connections[roomId].includes(socket.id)) {
    return;
  }

  const peers = createPeerConnectionList(roomId, socket.id);
  connections[roomId].push(socket.id);
  timeOnline[socket.id] = new Date();
  socketMeta[socket.id] = { roomId, username };

  socket.emit("room-users", peers);
  emitChatHistory(io, roomId, socket.id);

  peers.forEach((peer) => {
    io.to(peer.socketId).emit("user-joined", {
      socketId: socket.id,
      username,
    });
  });
};

const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["*"],
        credentials: true
    }
  });

  io.on("connection", (socket) => {
    socket.on("join-call", (roomId, username) => {
      joinRoom(io, socket, roomId, username);
    });

    // Backward compatibility for the previous client event name.
    socket.on("accept-call", (roomId, username) => {
      joinRoom(io, socket, roomId, username);
    });

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("chat-message", (payload, sender) => {
      const roomId = getRoomForSocket(socket.id);
      if (!roomId) {
        return;
      }

      if (!messages[roomId]) {
        messages[roomId] = [];
      }

      const entry =
        typeof payload === "object" && payload !== null
          ? {
              sender: payload.sender || sender || socketMeta[socket.id]?.username || "Guest",
              data: payload.data || "",
              socketIdSender: socket.id,
              timestamp: payload.timestamp || new Date().toISOString(),
            }
          : {
              sender: sender || socketMeta[socket.id]?.username || "Guest",
              data: payload || "",
              socketIdSender: socket.id,
              timestamp: new Date().toISOString(),
            };

      messages[roomId].push(entry);

      connections[roomId].forEach((connectionId) => {
        io.to(connectionId).emit("chat-message", entry);
      });
    });

    socket.on("media-state", (payload = {}) => {
      const roomId = getRoomForSocket(socket.id);
      if (!roomId || !connections[roomId]) {
        return;
      }

      const entry = {
        socketId: socket.id,
        username: socketMeta[socket.id]?.username || "Guest",
        cameraEnabled: Boolean(payload.cameraEnabled),
        micEnabled: Boolean(payload.micEnabled),
        screenSharing: Boolean(payload.screenSharing),
      };

      connections[roomId].forEach((connectionId) => {
        io.to(connectionId).emit("media-state", entry);
      });
    });

    socket.on("disconnect", () => {
      const roomId = getRoomForSocket(socket.id);
      if (roomId && connections[roomId]) {
        connections[roomId] = connections[roomId].filter((id) => id !== socket.id);

        connections[roomId].forEach((connectionId) => {
          io.to(connectionId).emit("user-left", {
            socketId: socket.id,
            username: socketMeta[socket.id]?.username || "Guest",
            durationMs: Math.abs(timeOnline[socket.id] - new Date()),
          });
        });

        if (connections[roomId].length === 0) {
          delete connections[roomId];
          delete messages[roomId];
        }
      }

      delete socketMeta[socket.id];
      delete timeOnline[socket.id];
    });
  });

  return io;
};

export default connectToSocket;
