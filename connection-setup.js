// connection-setup.js - Handles sender and recipient mode initialization

export class ConnectionSetup {
    constructor(peerConnection, camera, chat, location, ui) {
        this.peerConnection = peerConnection;
        this.camera = camera;
        this.chat = chat;
        this.location = location;
        this.ui = ui;
    }

    async setupSenderMode() {
        // Handle incoming calls
        this.peerConnection.onStream(async (call) => {
            // Start video for sender
            const mediaStream = this.camera.senderStream || await this.camera.startSenderMedia();
            call.answer(mediaStream);
            this.peerConnection.currentCall = call;
            
            call.on("stream", remoteStream => {
                // Add recipient's video to sender's screen
                this.camera.addVideo(remoteStream, false, false);
                this.ui.setStatus("Visitante conectado");
                this.ui.btnRecord.disabled = false;
                this.ui.btnBlur.disabled = false;
                
                const btnToggleSenderVideo = document.getElementById("btnToggleSenderVideo");
                if (btnToggleSenderVideo) btnToggleSenderVideo.disabled = false;
                
                // Send default hidden state to recipient
                setTimeout(() => {
                    this.peerConnection.sendData({ type: 'sender_video_visible', visible: false });
                }, 500);
            });
            
            call.on('track', (track, stream) => {
                if (this.camera.remoteVideoElement) {
                    this.camera.remoteVideoElement.srcObject = stream;
                    if (track.kind === 'video') {
                        this.camera.remoteVideoElement.style.display = 'block';
                    }
                }
            });
        });

        // Handle incoming data
        this.peerConnection.onData((data) => {
            if (data.type === 'location') {
                this.location.displayLocation(data.latitude, data.longitude, {
                    address: data.address,
                    via: data.via || '',
                    numero: data.numero || '',
                    bairro: data.bairro || '',
                    municipio: data.municipio || '',
                    cep: data.cep || ''
                });
            } else if (data.type === 'chat') {
                this.chat.receiveMessage(data.message);
            } else if (data.type === 'image') {
                this.chat.receiveImage(data.dataUrl);
            }
        });
    }

    async setupRecipientMode() {
        try {
            // Check if this is monitoring mode
            const params = new URLSearchParams(window.location.search);
            const room = params.get("r");
            const isMonitoring = params.get("monitor") === "true";
            
            if (!room) {
                this.ui.setStatus("Link inválido", "#ef4444");
                return;
            }
            
            // Check if link has been deactivated
            const authModule = await import('./auth.js');
            const tempAuth = new authModule.AuthManager();
            const adminModule = await import('./admin.js');
            const tempAdmin = new adminModule.AdminManager(tempAuth);
            
            const isDeactivated = await tempAdmin.isLinkDeactivated(room);
            if (isDeactivated) {
                this.ui.setStatus("Este link foi desativado e não está mais disponível.", "#ef4444");
                this.camera.stopLocalCamera();
                return;
            }
            
            // Check if recipient had video enabled (not applicable for monitoring)
            const recipientVideoEnabled = !isMonitoring && localStorage.getItem("livecam_recipientVideo") !== "false";

            // Add error handler BEFORE starting camera or making call
            this.peerConnection.onError((err) => {
                console.error("Peer error:", err);
                this.ui.setStatus("Erro: Link inválido ou expirado. Recarregue a página.", "#ef4444");
                this.camera.stopLocalCamera();
            });

            if (recipientVideoEnabled) {
                await this.camera.startCamera();
            } else {
                await this.camera.startAudioOnly();
            }
            this.ui.setStatus("Conectando...");

            const call = this.peerConnection.call(room, this.camera.localStream);
            this.peerConnection.currentCall = call;
            
            call.on("stream", remoteStream => {
                const hasVideo = remoteStream.getVideoTracks().length > 0;
                const hasAudio = remoteStream.getAudioTracks().length > 0;
                
                if (hasVideo) {
                    this.camera.addVideo(remoteStream, false, false, true);
                    this.ui.setStatus("Conectado");
                    
                    // Show logo by default on recipient
                    this.camera.showLogoOnRecipient();
                    
                    // Show green status indicator and hide reload
                    const statusIndicator = document.getElementById("connectionStatus");
                    const btnReload = document.getElementById("btnReload");
                    if (statusIndicator) statusIndicator.style.display = 'inline-block';
                    if (btnReload) btnReload.disabled = true;
                } else if (hasAudio) {
                    const audioElement = new Audio();
                    audioElement.srcObject = remoteStream;
                    audioElement.autoplay = true;
                    audioElement.play().catch(() => {});
                    this.ui.setStatus("Conectado (áudio)");
                }
            });
            
            this.peerConnection.connect(room);
            
            this.peerConnection.onConnectionReady(async () => {
                this.ui.setStatus("Chat conectado");
                
                // Retry location capture until successful
                const captureLocation = async () => {
                    try {
                        const position = await this.location.getCurrentLocation();
                        const { latitude, longitude } = position.coords;
                        const addressData = await this.location.getAddressFromCoords(latitude, longitude);
                        
                        // Don't display location on recipient's screen
                        // Location is only sent to sender
                        
                        this.peerConnection.sendData({ 
                            type: 'location', 
                            latitude, 
                            longitude, 
                            address: addressData.address,
                            via: addressData.via,
                            numero: addressData.numero,
                            bairro: addressData.bairro,
                            municipio: addressData.municipio,
                            cep: addressData.cep
                        });
                        
                        return true;
                    } catch (e) {
                        console.error("Erro ao obter localização, tentando novamente em 5s:", e);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        return false;
                    }
                };
                
                // Keep retrying until location is captured
                let locationCaptured = false;
                while (!locationCaptured) {
                    locationCaptured = await captureLocation();
                }
            });
            
            this.peerConnection.onData((data) => {
                if (data.type === 'chat' && !isMonitoring) {
                    this.chat.receiveMessage(data.message);
                } else if (data.type === 'image' && !isMonitoring) {
                    this.chat.receiveImage(data.dataUrl);
                } else if (data.type === 'stop_camera' && !isMonitoring) {
                    this.camera.stopLocalCamera();
                    this.ui.setStatus('Câmera encerrada pelo remetente.');
                } else if (data.type === 'recipient_video_toggle') {
                    if (data.enabled) {
                        this.ui.setStatus('Visitante ativou vídeo');
                        if (this.camera.remoteVideoElement && this.camera.remoteVideoElement.srcObject) {
                            this.camera.remoteVideoElement.style.display = 'block';
                        }
                    } else {
                        this.ui.setStatus('Visitante desativou vídeo');
                        if (this.camera.remoteVideoElement) {
                            this.camera.remoteVideoElement.style.display = 'none';
                        }
                    }
                } else if (data.type === 'sender_video_visible') {
                    // Hide/show sender's video on recipient only (not recipient's own camera)
                    if (data.visible) {
                        // Show sender's video (PIP), hide logo
                        if (this.camera.remoteVideoElement) {
                            this.camera.remoteVideoElement.style.display = 'block';
                        }
                        this.camera.hideLogoOnRecipient();
                        
                        // Show green status, disable reload
                        const statusIndicator = document.getElementById("connectionStatus");
                        const btnReload = document.getElementById("btnReload");
                        if (statusIndicator) statusIndicator.style.display = 'inline-block';
                        if (btnReload) btnReload.disabled = true;
                    } else {
                        // Hide sender's video (PIP), show logo
                        if (this.camera.remoteVideoElement) {
                            this.camera.remoteVideoElement.style.display = 'none';
                        }
                        this.camera.showLogoOnRecipient();
                        
                        // Hide green status, enable reload
                        const statusIndicator = document.getElementById("connectionStatus");
                        const btnReload = document.getElementById("btnReload");
                        if (statusIndicator) statusIndicator.style.display = 'none';
                        if (btnReload) btnReload.disabled = false;
                    }
                } else if (data.type === 'link_deleted' && !isMonitoring) {
                    this.camera.stopLocalCamera();
                    this.ui.setStatus('Link excluído. Conexão encerrada.', '#ef4444');
                    
                    const btnSwitchCamera = document.getElementById("btnSwitchCamera");
                    const btnReload = document.getElementById("btnReload");
                    if (btnSwitchCamera) btnSwitchCamera.disabled = true;
                    if (btnReload) btnReload.disabled = true;
                    
                    if (this.camera.localVideoElement) {
                        this.camera.localVideoElement.style.display = 'none';
                    }
                }
            });
        } catch (error) {
            this.ui.setStatus("Erro ao conectar com câmera", "#ef4444");
            console.error(error);
        }
    }
}