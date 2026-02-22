// ui.js - Handles UI controls and button interactions

export class UIManager {
    constructor() {
        this.linkDiv = document.getElementById("link");
        this.statusEl = document.getElementById("status");
        this.btnLink = document.getElementById("btnLink");
        this.btnCopy = document.getElementById("btnCopy");
        this.btnDeleteLink = document.getElementById("btnDeleteLink");
        this.btnSendWhatsApp = document.getElementById("btnSendWhatsApp");
        this.btnSendSMS = document.getElementById("btnSendSMS");
        this.btnRecord = document.getElementById("btnRecord");
        this.btnBlur = document.getElementById("btnBlur");
        this.recipientPhone = document.getElementById("recipientPhone");
        this.isBlurred = false; // Recipient video blur state (local)
        this.isSenderBlurred = true; // Default: Sender video is blurred (Inhibited)
        this.generatedLink = "";
        this.whatsappWindow = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.autoReloadInterval = null;

        this.setupPhoneInput();
    }

    setupPhoneInput() {
        this.recipientPhone.addEventListener("input", () => {
            let digits = this.recipientPhone.value.replace(/\D/g, "");
            if (!digits.startsWith("55")) {
                digits = "55" + digits;
            }
            digits = digits.slice(0, 13);

            const country = "+55";
            const ddd = digits.slice(2, 4);
            const firstDigit = digits.slice(4, 5);
            const middle = digits.slice(5, 9);
            const last = digits.slice(9, 13);

            let formatted = country;
            if (ddd) {
                formatted += ` (${ddd}`;
                if (ddd.length === 2) {
                    formatted += ") ";
                }
            }
            if (firstDigit) formatted += firstDigit;
            if (middle) formatted += middle;
            if (last) formatted += `-${last}`;

            this.recipientPhone.value = formatted;
        });
    }

    loadStoredLink() {
        const storedLink = localStorage.getItem("livecam_link");
        const params = new URLSearchParams(location.search);
        const room = params.get("r");
        
        if (storedLink && !room) {
            this.generatedLink = storedLink;
            this.linkDiv.innerText = storedLink;
            this.btnCopy.disabled = false;
            this.btnSendWhatsApp.disabled = false;
            this.btnSendSMS.disabled = false;
            this.btnDeleteLink.disabled = false;
        }
    }

    hideControlsForRecipient(isMonitoring = false) {
        // Hide all control buttons except reload
        const controlButtons = document.getElementById("controlButtons");
        if (controlButtons) {
            controlButtons.style.display = 'flex';
            // Hide all children except reload button
            Array.from(controlButtons.children).forEach(child => {
                if (child.id !== 'btnReload') {
                    child.style.display = 'none';
                }
            });
        }
        
        // Hide toggle controls button
        const btnToggleControls = document.getElementById("btnToggleControls");
        if (btnToggleControls) btnToggleControls.style.display = 'none';
        
        // Hide individual buttons
        this.btnLink.style.display = 'none';
        this.btnCopy.style.display = 'none';
        this.btnDeleteLink.style.display = 'none';
        this.btnRecord.style.display = 'none';
        this.btnBlur.style.display = 'none';
        this.btnSendWhatsApp.style.display = 'none';
        this.btnSendSMS.style.display = 'none';
        this.recipientPhone.style.display = 'none';
        this.linkDiv.style.display = 'none';
        
        const btnToggleSenderVideo = document.getElementById("btnToggleSenderVideo");
        if (btnToggleSenderVideo) btnToggleSenderVideo.style.display = 'none';
        
        const btnToggleChat = document.getElementById("btnToggleChat");
        if (btnToggleChat) btnToggleChat.style.display = 'none';
        
        const btnSwitchCamera = document.getElementById("btnSwitchCamera");
        if (btnSwitchCamera) btnSwitchCamera.style.display = 'none';
        
        // Show and enable reload button for recipient
        const btnReload = document.getElementById("btnReload");
        if (btnReload) {
            btnReload.style.display = 'inline-block';
            btnReload.disabled = false;
        }
        
        // For monitoring mode, also show logout and admin buttons
        if (isMonitoring) {
            const btnLogout = document.getElementById("btnLogout");
            if (btnLogout) btnLogout.style.display = 'inline-block';
            
            const btnAdmin = document.getElementById("btnAdmin");
            if (btnAdmin) btnAdmin.style.display = 'inline-block';
        }
    }

    setStatus(message, color = null) {
        this.statusEl.innerText = message;
        if (color) {
            this.statusEl.style.color = color;
        }
    }

    generateLink(peerId) {
        this.generatedLink = `${location.origin}${location.pathname}?r=${peerId}`;
        this.linkDiv.innerText = this.generatedLink;
        this.setStatus("Link gerado. Aguardando acesso...");
        this.btnCopy.disabled = false;
        this.btnSendWhatsApp.disabled = false;
        this.btnSendSMS.disabled = false;
        this.btnDeleteLink.disabled = false;
        localStorage.setItem("livecam_link", this.generatedLink);
    }

    copyLink() {
        if (!this.generatedLink) return;
        navigator.clipboard.writeText(this.generatedLink);
        this.setStatus("Link copiado!");
    }

    sendWhatsApp() {
        const phone = this.recipientPhone.value.replace(/\D/g, '');
        if (!phone || phone.length !== 13) {
            alert("Digite o telefone completo no formato +55 (DDD) 9XXXX-XXXX");
            return;
        }
        const message = encodeURIComponent(`Acesse este link: ${this.generatedLink}`);
        const url = `https://wa.me/${phone}?text=${message}`;

        this.whatsappWindow = window.open(url, 'whatsappWindow');
        if (this.whatsappWindow) {
            this.whatsappWindow.focus();
        }
    }

    sendSMS() {
        const phone = this.recipientPhone.value.replace(/\D/g, '');
        if (!phone || phone.length !== 13) {
            alert("Digite o telefone completo no formato +55 (DDD) 9XXXX-XXXX");
            return;
        }
        const message = encodeURIComponent(`Acesse este link: ${this.generatedLink}`);
        window.open(`sms:${phone}?body=${message}`);
    }

    startRecording(stream) {
        if (!stream) return;
        
        this.recordedChunks = [];
        this.recordingStartTime = Date.now();
        this.mediaRecorder = new MediaRecorder(stream);
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };
        
        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Calculate duration
            const durationMs = Date.now() - this.recordingStartTime;
            const durationSec = Math.floor(durationMs / 1000);
            const minutes = Math.floor(durationSec / 60);
            const seconds = durationSec % 60;
            const durationStr = `${minutes}min${seconds}sec`;
            
            // Get phone number and format date
            const phone = this.recipientPhone.value.replace(/\D/g, '') || 'sem-numero';
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            
            a.download = `${phone}_${day}_${month}_${year}_${durationStr}.webm`;
            a.click();
            this.setStatus('Gravação salva!');
        };
        
        this.mediaRecorder.start();
        this.isRecording = true;
        this.btnRecord.textContent = '⏹️ Parar Gravação';
        this.btnRecord.style.background = '#ef4444';
        this.setStatus('Gravando...');
    }

    stopRecording() {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.btnRecord.textContent = '⏺️ Gravar Vídeo';
            this.btnRecord.style.background = '#0b5cff';
        }
    }

    showBlurModal() {
        const modal = document.getElementById('blurModal');
        if (modal) modal.style.display = 'flex';
    }

    hideBlurModal() {
        const modal = document.getElementById('blurModal');
        if (modal) modal.style.display = 'none';
    }

    toggleLocalSenderBlur(peerConnection) {
        this.isSenderBlurred = !this.isSenderBlurred;
        this.updateSenderBlurState(peerConnection);
    }

    updateSenderBlurState(peerConnection) {
        // Apply to local PIP if it exists
        const senderVideo = document.getElementById('senderPipVideo');
        const btnToggleSenderVideo = document.getElementById("btnToggleSenderVideo");

        if (this.isSenderBlurred) {
            if (senderVideo) senderVideo.style.filter = 'blur(20px)';
            if (btnToggleSenderVideo) btnToggleSenderVideo.textContent = '👁️ Mostrar Meu Vídeo';
            this.setStatus('Seu vídeo está desfocado (Inibido)');
        } else {
            if (senderVideo) senderVideo.style.filter = 'none';
            if (btnToggleSenderVideo) btnToggleSenderVideo.textContent = '👁️ Inibir Meu Vídeo';
            this.setStatus('Seu vídeo está visível');
        }

        // Send state to recipient
        if (peerConnection) {
            peerConnection.sendData({ type: 'sender_blur', blurred: this.isSenderBlurred });
        }
    }

    toggleRecipientBlur(peerConnection, remoteVideoElement) {
        this.isBlurred = !this.isBlurred;
        
        if (this.isBlurred) {
            if (remoteVideoElement) remoteVideoElement.style.filter = 'blur(20px)';
            this.setStatus('Vídeo do visitante desfocado');
        } else {
            if (remoteVideoElement) remoteVideoElement.style.filter = 'none';
            this.setStatus('Desfoque do visitante removido');
        }
        
        // We only blur locally for visitor video, as per usual privacy controls
    }

}