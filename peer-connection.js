// peer-connection.js - Handles all PeerJS connection logic

export class PeerConnection {
    constructor() {
        this.peer = null;
        this.peerId = null;
        this.currentCall = null;
        this.dataConnection = null;
        this.onStreamCallback = null;
        this.onDataCallback = null;
        this.onConnectionReadyCallback = null;
    }

    async initialize() {
        const storedPeerId = localStorage.getItem("livecam_peerId");
        this.peer = new Peer(storedPeerId || undefined);

        return new Promise((resolve) => {
            this.peer.on("open", (id) => {
                this.peerId = id;
                const params = new URLSearchParams(location.search);
                const room = params.get("r");
                
                if (!storedPeerId && !room) {
                    localStorage.setItem("livecam_peerId", this.peerId);
                }
                resolve(id);
            });

            this.peer.on("call", async (call) => {
                if (this.onStreamCallback) {
                    await this.onStreamCallback(call);
                }
            });

            this.peer.on('connection', (conn) => {
                this.dataConnection = conn;
                conn.on('data', (data) => {
                    if (this.onDataCallback) {
                        this.onDataCallback(data);
                    }
                });
            });
        });
    }

    call(targetId, stream) {
        this.currentCall = this.peer.call(targetId, stream);
        
        this.currentCall.on("stream", (remoteStream) => {
            if (this.onStreamCallback) {
                this.onStreamCallback(remoteStream, true);
            }
        });

        return this.currentCall;
    }

    connect(targetId) {
        this.dataConnection = this.peer.connect(targetId);
        
        this.dataConnection.on('open', () => {
            if (this.onConnectionReadyCallback) {
                this.onConnectionReadyCallback();
            }
        });

        this.dataConnection.on('data', (data) => {
            if (this.onDataCallback) {
                this.onDataCallback(data);
            }
        });

        return this.dataConnection;
    }

    sendData(data) {
        if (this.dataConnection && this.dataConnection.open) {
            this.dataConnection.send(data);
        }
    }

    destroy() {
        if (this.peer) {
            this.peer.destroy();
        }
    }

    onStream(callback) {
        this.onStreamCallback = callback;
    }

    onData(callback) {
        this.onDataCallback = callback;
    }

    onConnectionReady(callback) {
        this.onConnectionReadyCallback = callback;
    }
}