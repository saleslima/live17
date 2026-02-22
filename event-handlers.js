// event-handlers.js - All button and input event handlers

export class EventHandlers {
    constructor(peerConnection, camera, chat, ui) {
        this.peerConnection = peerConnection;
        this.camera = camera;
        this.chat = chat;
        this.ui = ui;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Toggle controls visibility
        const btnToggleControls = document.getElementById("btnToggleControls");
        const controlButtons = document.getElementById("controlButtons");
        btnToggleControls.onclick = () => {
            if (controlButtons.style.display === 'none') {
                controlButtons.style.display = 'flex';
                btnToggleControls.textContent = '➖ Ocultar Botões';
            } else {
                controlButtons.style.display = 'none';
                btnToggleControls.textContent = '➕ Mostrar Botões';
            }
        };
        
        // Link management buttons
        this.ui.btnLink.onclick = () => this.handleGenerateLink();
        this.ui.btnCopy.onclick = () => this.handleCopyLink();
        this.ui.btnDeleteLink.onclick = () => this.handleDeleteLink();
        
        // Communication buttons
        this.ui.btnSendWhatsApp.onclick = () => this.ui.sendWhatsApp();
        this.ui.btnSendSMS.onclick = () => this.ui.sendSMS();
        
        // Video controls
        this.ui.btnRecord.onclick = () => this.handleRecord();
        this.ui.btnBlur.onclick = () => this.handleBlur();
        
        const btnToggleSenderVideo = document.getElementById("btnToggleSenderVideo");
        btnToggleSenderVideo.onclick = () => this.handleToggleSenderVideo();
        
        const btnSwitchCamera = document.getElementById("btnSwitchCamera");
        btnSwitchCamera.onclick = () => this.handleSwitchCamera();
        
        const btnReload = document.getElementById("btnReload");
        btnReload.onclick = () => window.location.reload();
        
        // Chat controls
        const btnSend = document.getElementById("btnSend");
        const messageInput = document.getElementById("messageInput");
        const btnImage = document.getElementById("btnImage");
        const imageInput = document.getElementById("imageInput");
        
        btnSend.onclick = () => this.chat.sendMessage(messageInput.value);
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.chat.sendMessage(messageInput.value);
            }
        });
        
        btnImage.onclick = () => imageInput.click();
        
        imageInput.addEventListener('change', () => {
            const file = imageInput.files[0];
            if (file) {
                const type = file.type.toLowerCase();
                if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/gif') {
                    this.chat.sendImage(file);
                } else {
                    alert('Formato de imagem não suportado. Use JPEG, JPG ou GIF.');
                }
            }
            imageInput.value = '';
        });
        
        // Chat toggle
        const btnToggleChat = document.getElementById("btnToggleChat");
        const chat = document.getElementById("chat");
        
        btnToggleChat.onclick = () => {
            if (chat.style.display === 'none') {
                chat.style.display = 'flex';
                btnToggleChat.textContent = '➖ Ocultar Chat';
            } else {
                chat.style.display = 'none';
                btnToggleChat.textContent = '➕ Mostrar Chat';
            }
        };
    }

    handleGenerateLink() {
        this.ui.generateLink(this.peerConnection.peerId);
    }

    handleCopyLink() {
        this.ui.copyLink();
    }

    async handleDeleteLink() {
        if (!this.ui.generatedLink) return;

        try {
            this.peerConnection.sendData({ type: 'link_deleted' });
            this.peerConnection.sendData({ type: 'stop_camera' });
        } catch (e) {
            console.error("Erro ao enviar comandos:", e);
        }

        // Deactivate link permanently in Firebase
        const authModule = await import('./auth.js');
        const tempAuth = new authModule.AuthManager();
        const adminModule = await import('./admin.js');
        const tempAdmin = new adminModule.AdminManager(tempAuth);
        
        await tempAdmin.deactivateLink(this.peerConnection.peerId);

        localStorage.removeItem("livecam_link");
        localStorage.removeItem("livecam_peerId");
        this.ui.generatedLink = "";
        this.ui.linkDiv.innerText = "";
        this.ui.btnCopy.disabled = true;
        this.ui.btnSendWhatsApp.disabled = true;
        this.ui.btnSendSMS.disabled = true;
        this.ui.btnDeleteLink.disabled = true;
        this.ui.setStatus("Link excluído. Recarregando para gerar um novo...");
        
        setTimeout(() => {
            try {
                this.peerConnection.destroy();
            } catch (e) {}
            window.location.reload();
        }, 500);
    }

    handleRecord() {
        if (!this.ui.isRecording && this.camera.remoteVideoElement && this.camera.remoteVideoElement.srcObject) {
            this.ui.startRecording(this.camera.remoteVideoElement.srcObject);
        } else if (this.ui.isRecording) {
            this.ui.stopRecording();
        }
    }

    handleBlur() {
        this.ui.toggleBlur(this.camera.remoteVideoElement);
    }

    async handleSwitchCamera() {
        try {
            const newStream = await this.camera.switchCamera();
            
            if (this.peerConnection.currentCall && this.peerConnection.currentCall.peerConnection) {
                const videoTrack = newStream.getVideoTracks()[0];
                const audioTrack = newStream.getAudioTracks()[0];
                
                const senders = this.peerConnection.currentCall.peerConnection.getSenders();
                for (const sender of senders) {
                    if (sender.track && sender.track.kind === 'audio') {
                        if (audioTrack) await sender.replaceTrack(audioTrack).catch(e => console.error("Erro replace audio:", e));
                    } else {
                        // Se for track de vídeo ou nula (assumimos ser o sender de vídeo), substitui
                        if (videoTrack) await sender.replaceTrack(videoTrack).catch(e => console.error("Erro replace video:", e));
                    }
                }
                
                this.ui.setStatus("Câmera trocada");
            }
        } catch (err) {
            console.error("Erro ao trocar câmera:", err);
            this.ui.setStatus("Erro ao trocar câmera", "#ef4444");
        }
    }

    handleToggleSenderVideo() {
        this.ui.toggleSenderVideo();
        const btnToggleSenderVideo = document.getElementById("btnToggleSenderVideo");
        
        // Sender always sees their own video and recipient's video
        // This button only controls what the recipient sees
        
        if (this.ui.senderVideoVisible) {
            btnToggleSenderVideo.textContent = '👁️ Inibir Meu Vídeo';
            this.peerConnection.sendData({ type: 'sender_video_visible', visible: true });
        } else {
            btnToggleSenderVideo.textContent = '👁️ Mostrar Meu Vídeo';
            this.peerConnection.sendData({ type: 'sender_video_visible', visible: false });
        }
    }

}