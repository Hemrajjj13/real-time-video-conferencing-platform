import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import environment from "../environment";
import { useAuth } from "../contexts/AuthContext";

const emptyMediaStream = () => new MediaStream();

const ParticipantFallback = ({ name, message }) => (
  <div className="video-fallback">
    <div className="video-fallback-avatar">{(name || "G").charAt(0).toUpperCase()}</div>
    <strong>{name || "Guest"}</strong>
    <span>{message}</span>
  </div>
);

const MeetingRoom = () => {
  const navigate = useNavigate();
  const { meetingId = "" } = useParams();
  const { addToHistory, user } = useAuth();

  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const remoteVideoElementsRef = useRef(new Map());
  const localStreamRef = useRef(emptyMediaStream());
  const screenTrackRef = useRef(null);
  const savedHistoryRef = useRef(false);

  const [displayName, setDisplayName] = useState(user?.name || user?.username || "");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState("Camera and microphone preview is optional.");
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [copyState, setCopyState] = useState("Copy invite link");

  const roomCode = useMemo(
    () => meetingId.trim().toLowerCase().replace(/\s+/g, "-"),
    [meetingId],
  );

  const attachLocalStream = () => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  };

  const emitMediaState = ({
    camera = cameraEnabled,
    mic = micEnabled,
    sharing = screenSharing,
  } = {}) => {
    if (!socketRef.current) {
      return;
    }

    socketRef.current.emit("media-state", {
      cameraEnabled: camera,
      micEnabled: mic,
      screenSharing: sharing,
    });
  };

  const syncTrackState = () => {
    const videoTrack = localStreamRef.current.getVideoTracks()[0] || null;
    const audioTrack = localStreamRef.current.getAudioTracks()[0] || null;
    setCameraEnabled(Boolean(videoTrack?.enabled));
    setMicEnabled(Boolean(audioTrack?.enabled));
    attachLocalStream();
  };

  const replaceTrackInLocalStream = (kind, track) => {
    const stream = localStreamRef.current;
    stream
      .getTracks()
      .filter((item) => item.kind === kind)
      .forEach((item) => {
        stream.removeTrack(item);
      });

    if (track) {
      stream.addTrack(track);
    }

    syncTrackState();
  };

  const updateParticipant = (socketId, details) => {
    setParticipants((previous) => {
      const existing = previous.find((item) => item.socketId === socketId);
      if (existing) {
        return previous.map((item) =>
          item.socketId === socketId ? { ...item, ...details } : item,
        );
      }

      return [...previous, { socketId, ...details }];
    });
  };

  const removeParticipant = (socketId) => {
    setParticipants((previous) => previous.filter((item) => item.socketId !== socketId));
    setRemoteStreams((previous) => previous.filter((item) => item.socketId !== socketId));
  };

  const closePeerConnection = (socketId) => {
    const peerConnection = peerConnectionsRef.current.get(socketId);
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.close();
      peerConnectionsRef.current.delete(socketId);
    }
  };

  const broadcastOffer = async (socketId) => {
    const peerConnection = peerConnectionsRef.current.get(socketId);
    const socket = socketRef.current;

    if (!peerConnection || !socket) {
      return;
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("signal", socketId, JSON.stringify({ sdp: offer }));
  };

  const addTrackToConnection = async (peerConnection, track) => {
    const existingSender = peerConnection
      .getSenders()
      .find((sender) => sender.track?.kind === track.kind);

    if (existingSender) {
      await existingSender.replaceTrack(track);
    } else {
      peerConnection.addTrack(track, localStreamRef.current);
    }
  };

  const syncTracksWithPeers = async () => {
    const peerEntries = [...peerConnectionsRef.current.entries()];
    const tracks = localStreamRef.current.getTracks();

    await Promise.all(
      peerEntries.map(async ([socketId, peerConnection]) => {
        await Promise.all(tracks.map((track) => addTrackToConnection(peerConnection, track)));

        await Promise.all(
          peerConnection
            .getSenders()
            .filter((sender) => sender.track && !tracks.some((track) => track.id === sender.track.id))
            .map((sender) => sender.replaceTrack(null)),
        );

        await broadcastOffer(socketId);
      }),
    );
  };

  const requestUserMedia = async () => {
    const attempts = [
      { video: true, audio: true },
      { video: true, audio: false },
      { video: false, audio: true },
    ];

    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const nextStream = emptyMediaStream();
        stream.getTracks().forEach((track) => nextStream.addTrack(track));
        localStreamRef.current = nextStream;
        screenTrackRef.current = null;
        syncTrackState();
        setStatus("Preview ready. Join when you are ready.");
        return;
      } catch {
        continue;
      }
    }

    localStreamRef.current = emptyMediaStream();
    syncTrackState();
    setStatus(
      "Camera preview is unavailable. Chat and room joining still work. If you are testing two browsers on one laptop, the webcam may be locked by the first browser.",
    );
  };

  useEffect(() => {
    requestUserMedia();

    return () => {
      peerConnectionsRef.current.forEach((peerConnection) => peerConnection.close());
      peerConnectionsRef.current.clear();

      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      localStreamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const createPeerConnection = async (socketId, username, shouldCreateOffer) => {
    if (!socketId || peerConnectionsRef.current.has(socketId)) {
      if (username) {
        updateParticipant(socketId, { username });
      }
      return;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnectionsRef.current.set(socketId, peerConnection);
    updateParticipant(socketId, { username: username || "Guest" });

    localStreamRef.current.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStreamRef.current);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit(
          "signal",
          socketId,
          JSON.stringify({ ice: event.candidate }),
        );
      }
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) {
        return;
      }

      setRemoteStreams((previous) => {
        const existing = previous.find((item) => item.socketId === socketId);
        if (existing) {
          return previous.map((item) =>
            item.socketId === socketId ? { ...item, stream } : item,
          );
        }

        return [...previous, { socketId, stream }];
      });
    };

    if (shouldCreateOffer) {
      await broadcastOffer(socketId);
    }
  };

  const handleSignal = async (fromId, rawMessage) => {
    const payload = JSON.parse(rawMessage);

    if (!peerConnectionsRef.current.has(fromId)) {
      await createPeerConnection(fromId, "Guest", false);
    }

    const peerConnection = peerConnectionsRef.current.get(fromId);
    if (!peerConnection) {
      return;
    }

    if (payload.sdp) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));

      if (payload.sdp.type === "offer") {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socketRef.current?.emit("signal", fromId, JSON.stringify({ sdp: answer }));
      }
    }

    if (payload.ice) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(payload.ice));
      } catch {
        setStatus("Network changed while connecting a participant. Refresh if needed.");
      }
    }
  };

  const joinMeeting = async () => {
    if (!roomCode) {
      setStatus("Meeting code is missing.");
      return;
    }

    if (!displayName.trim()) {
      setStatus("Please enter a display name before joining.");
      return;
    }

    setJoining(true);
    setStatus("Joining the meeting room...");

    const socket = io(environment, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", async () => {
      setJoined(true);
      setJoining(false);
      updateParticipant("self", {
        username: displayName.trim(),
        isSelf: true,
        cameraEnabled,
        micEnabled,
        screenSharing,
      });
      socket.emit("join-call", roomCode, displayName.trim());
      emitMediaState({
        camera: cameraEnabled,
        mic: micEnabled,
        sharing: screenSharing,
      });
      setStatus("Connected to the room.");

      if (!savedHistoryRef.current) {
        savedHistoryRef.current = true;
        try {
          await addToHistory(roomCode);
        } catch {
          setStatus("Connected, but meeting history could not be saved this time.");
        }
      }
    });

    socket.on("room-users", async (roomUsers) => {
      for (const peer of roomUsers) {
        updateParticipant(peer.socketId, {
          username: peer.username || "Guest",
          cameraEnabled: true,
          micEnabled: true,
          screenSharing: false,
        });
        await createPeerConnection(peer.socketId, peer.username, true);
      }
    });

    socket.on("user-joined", async ({ socketId, username }) => {
      updateParticipant(socketId, {
        username: username || "Guest",
        cameraEnabled: true,
        micEnabled: true,
        screenSharing: false,
      });
      await createPeerConnection(socketId, username, false);
    });

    socket.on("media-state", ({ socketId, cameraEnabled: nextCameraEnabled, micEnabled: nextMicEnabled, screenSharing: nextScreenSharing, username }) => {
      if (socketId === socket.id) {
        return;
      }

      updateParticipant(socketId, {
        username: username || "Guest",
        cameraEnabled: nextCameraEnabled,
        micEnabled: nextMicEnabled,
        screenSharing: nextScreenSharing,
      });
    });

    socket.on("user-left", ({ socketId }) => {
      closePeerConnection(socketId);
      removeParticipant(socketId);
      setStatus("A participant left the room.");
    });

    socket.on("signal", (fromId, message) => {
      handleSignal(fromId, message).catch(() => {
        setStatus("A media negotiation step failed. Refresh if a remote tile stays blank.");
      });
    });

    socket.on("chat-message", (entry) => {
      setMessages((previous) => [
        ...previous,
        {
          sender: entry.sender || "Guest",
          data: entry.data || "",
          socketIdSender: entry.socketIdSender || "",
          timestamp: entry.timestamp || new Date().toISOString(),
        },
      ]);
    });

    socket.on("disconnect", () => {
      setStatus("You were disconnected from the room.");
    });

    socket.on("connect_error", () => {
      setJoining(false);
      setStatus("Unable to connect to the room server.");
    });
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("Invite link copied");
      window.setTimeout(() => setCopyState("Copy invite link"), 1800);
    } catch {
      setCopyState("Copy failed");
      window.setTimeout(() => setCopyState("Copy invite link"), 1800);
    }
  };

  const toggleTrack = async (kind) => {
    const existingTrack =
      kind === "audio"
        ? localStreamRef.current.getAudioTracks()[0]
        : localStreamRef.current.getVideoTracks()[0];

    if (existingTrack) {
      const nextEnabled = !existingTrack.enabled;

      if (!nextEnabled) {
        existingTrack.stop();
        replaceTrackInLocalStream(kind, null);
      } else {
        try {
          const restoredStream = await navigator.mediaDevices.getUserMedia({
            video: kind === "video",
            audio: kind === "audio",
          });
          const restoredTrack =
            kind === "audio"
              ? restoredStream.getAudioTracks()[0]
              : restoredStream.getVideoTracks()[0];

          if (!restoredTrack) {
            setStatus(`Unable to restore ${kind === "audio" ? "microphone" : "camera"}.`);
            return;
          }

          replaceTrackInLocalStream(kind, restoredTrack);
        } catch {
          setStatus(
            `Unable to access your ${kind === "audio" ? "microphone" : "camera"}. If another browser already uses the same webcam, this is expected on one machine.`,
          );
          return;
        }
      }

      await syncTracksWithPeers();
      if (kind === "video") {
        updateParticipant("self", {
          cameraEnabled: nextEnabled,
          screenSharing: false,
        });
        emitMediaState({ camera: nextEnabled, mic: micEnabled, sharing: false });
      } else {
        updateParticipant("self", { micEnabled: nextEnabled });
        emitMediaState({ camera: cameraEnabled, mic: nextEnabled, sharing: screenSharing });
      }
      setStatus(`${kind === "audio" ? "Microphone" : "Camera"} ${nextEnabled ? "enabled" : "disabled"}.`);
      return;
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: kind === "video",
        audio: kind === "audio",
      });
      const nextTrack = kind === "audio" ? newStream.getAudioTracks()[0] : newStream.getVideoTracks()[0];

      if (!nextTrack) {
        return;
      }

      replaceTrackInLocalStream(kind, nextTrack);
      await syncTracksWithPeers();
      if (kind === "video") {
        updateParticipant("self", {
          cameraEnabled: true,
          screenSharing: false,
        });
        emitMediaState({ camera: true, mic: micEnabled, sharing: false });
      } else {
        updateParticipant("self", { micEnabled: true });
        emitMediaState({ camera: cameraEnabled, mic: true, sharing: screenSharing });
      }
      setStatus(`${kind === "audio" ? "Microphone" : "Camera"} enabled.`);
    } catch {
      setStatus(
        `Unable to access your ${kind === "audio" ? "microphone" : "camera"}. If another browser already uses the same webcam, this is expected on one machine.`,
      );
    }
  };

  const stopScreenShare = async () => {
    const screenTrack = screenTrackRef.current;
    if (screenTrack) {
      screenTrack.onended = null;
      screenTrack.stop();
    }

    screenTrackRef.current = null;
    setScreenSharing(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        replaceTrackInLocalStream("video", videoTrack);
        await syncTracksWithPeers();
      }
    } catch {
      replaceTrackInLocalStream("video", null);
      await syncTracksWithPeers();
      setStatus("Screen share stopped. Camera could not be restored automatically.");
    }

    updateParticipant("self", {
      screenSharing: false,
      cameraEnabled: Boolean(localStreamRef.current.getVideoTracks()[0]),
    });
    emitMediaState({
      camera: Boolean(localStreamRef.current.getVideoTracks()[0]),
      mic: micEnabled,
      sharing: false,
    });
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      await stopScreenShare();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatus("Screen sharing is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];

      if (!track) {
        return;
      }

      screenTrackRef.current = track;
      track.onended = () => {
        stopScreenShare().catch(() => {
          setStatus("Screen share ended.");
        });
      };

      replaceTrackInLocalStream("video", track);
      await syncTracksWithPeers();
      setScreenSharing(true);
      updateParticipant("self", {
        cameraEnabled: true,
        screenSharing: true,
      });
      emitMediaState({ camera: true, mic: micEnabled, sharing: true });
      setStatus("Screen sharing started.");
    } catch {
      setStatus("Screen sharing request was cancelled.");
    }
  };

  const leaveMeeting = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    peerConnectionsRef.current.forEach((peerConnection) => peerConnection.close());
    peerConnectionsRef.current.clear();
    localStreamRef.current.getTracks().forEach((track) => track.stop());
    navigate("/home");
  };

  const sendMessage = () => {
    const trimmed = chatMessage.trim();
    if (!trimmed || !socketRef.current) {
      return;
    }

    socketRef.current.emit("chat-message", {
      data: trimmed,
      sender: displayName.trim() || "Guest",
      timestamp: new Date().toISOString(),
    });
    setChatMessage("");
  };

  useEffect(() => {
    remoteStreams.forEach(({ socketId, stream }) => {
      const videoElement = remoteVideoElementsRef.current.get(socketId);
      if (videoElement && videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  return (
    <div className="meeting-shell">
      {!joined ? (
        <section className="lobby-card">
          <div className="lobby-topbar">
            <Link className="brand brand-inline" to="/home">
              SyncSpace
            </Link>
            <span className="lobby-room-badge">{roomCode}</span>
          </div>

          <div className="lobby-header">
            <div>
              <span className="eyebrow">Meeting lobby</span>
              <h1>Ready to join?</h1>
              <p>{status}</p>
            </div>
          </div>

          <div className="lobby-grid">
            <div className="video-preview-card">
              {cameraEnabled || screenSharing ? (
                <video autoPlay className="meeting-video self-video" muted playsInline ref={localVideoRef} />
              ) : (
                <ParticipantFallback
                  message="No local media yet"
                  name={displayName || "You"}
                />
              )}
              <span className="video-label">Local preview</span>
            </div>

            <div className="lobby-controls-panel">
              <div className="lobby-section">
                <label className="field-block">
                Display name
                <input
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  value={displayName}
                />
                </label>
              </div>

              <div className="lobby-section">
                <div className="lobby-control-row">
                  <button className="meeting-control-button" onClick={() => toggleTrack("video")} type="button">
                  {cameraEnabled ? "Turn camera off" : "Turn camera on"}
                  </button>
                  <button className="meeting-control-button" onClick={() => toggleTrack("audio")} type="button">
                  {micEnabled ? "Mute mic" : "Enable mic"}
                  </button>
                </div>
              </div>

              <div className="lobby-section lobby-note">
                <strong>Tip</strong>
                <span>Use a short display name so other participants can identify you quickly.</span>
              </div>

              <button className="primary-button lobby-join-button" disabled={joining} onClick={joinMeeting} type="button">
                {joining ? "Joining..." : "Join meeting"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="meeting-layout">
          <header className="meeting-header">
            <div>
              <span className="eyebrow">Active room</span>
              <h1>{roomCode}</h1>
              <p>{status}</p>
            </div>

            <div className="inline-actions">
              <button className="ghost-button" onClick={copyInviteLink} type="button">
                {copyState}
              </button>
              <button className="danger-button" onClick={leaveMeeting} type="button">
                Leave meeting
              </button>
            </div>
          </header>

          <div className="meeting-main-grid">
            <div className="video-stage">
              <div className="video-grid">
                <article className="video-tile featured">
                  {cameraEnabled || screenSharing ? (
                    <video autoPlay className="meeting-video self-video" muted playsInline ref={localVideoRef} />
                  ) : (
                    <ParticipantFallback
                      message="You joined without camera"
                      name={displayName || "You"}
                    />
                  )}
                  <span className="video-label">{displayName || "You"}</span>
                </article>

                {participants
                  .filter((entry) => !entry.isSelf)
                  .map((participantEntry) => {
                  const item = remoteStreams.find(
                    (remoteStream) => remoteStream.socketId === participantEntry.socketId,
                  );
                  const participant = participantEntry.username || "Guest";

                  return (
                    <article className="video-tile" key={participantEntry.socketId}>
                      {item && (participantEntry.cameraEnabled || participantEntry.screenSharing) ? (
                        <video
                          autoPlay
                          className="meeting-video"
                          playsInline
                          ref={(element) => {
                            if (element) {
                              remoteVideoElementsRef.current.set(item.socketId, element);
                              if (element.srcObject !== item.stream) {
                                element.srcObject = item.stream;
                              }
                            } else {
                              remoteVideoElementsRef.current.delete(participantEntry.socketId);
                            }
                          }}
                        />
                      ) : (
                        <ParticipantFallback
                          message="Camera is off or still connecting"
                          name={participant}
                        />
                      )}
                      <span className="video-label">{participant}</span>
                    </article>
                  );
                })}
              </div>

              <div className="meeting-toolbar">
                <button className="ghost-button" onClick={() => toggleTrack("video")} type="button">
                  {cameraEnabled ? "Camera off" : "Camera on"}
                </button>
                <button className="ghost-button" onClick={() => toggleTrack("audio")} type="button">
                  {micEnabled ? "Mute" : "Unmute"}
                </button>
                <button className="ghost-button" onClick={toggleScreenShare} type="button">
                  {screenSharing ? "Stop share" : "Share screen"}
                </button>
                <button className="ghost-button" onClick={() => setChatOpen((value) => !value)} type="button">
                  {chatOpen ? "Hide chat" : "Show chat"}
                </button>
              </div>
            </div>

            <aside className={chatOpen ? "chat-panel" : "chat-panel hidden"}>
              <div className="participants-card">
                <h2>Participants</h2>
                <ul className="plain-list">
                  {participants.map((participant) => (
                    <li key={participant.socketId}>
                      {participant.username}
                      {participant.isSelf ? " (You)" : ""}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="chat-card">
                <div className="chat-messages">
                  {messages.length === 0 ? (
                    <p>No messages yet. Start the conversation.</p>
                  ) : (
                    messages.map((item, index) => (
                      <article className="chat-bubble" key={`${item.timestamp}-${index}`}>
                        <strong>{item.sender}</strong>
                        <p>{item.data}</p>
                      </article>
                    ))
                  )}
                </div>

                <div className="chat-compose">
                  <textarea
                    onChange={(event) => setChatMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message"
                    rows="3"
                    value={chatMessage}
                  />
                  <button className="primary-button" onClick={sendMessage} type="button">
                    Send
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}
    </div>
  );
};

export default MeetingRoom;
