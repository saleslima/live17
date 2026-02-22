export class AdminManager {
    constructor(auth) {
        this.auth = auth;
        this.db = auth.db;
        this.editingUser = null;
    }

    async loadUsers() {
        const ref = this.db.ref('users');
        const snapshot = await ref.once('value');
        const users = snapshot.val() || {};
        
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        
        Object.keys(users).forEach(username => {
            const user = users[username];
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            userDiv.innerHTML = `
                <span><strong>${user.username}</strong> - ${user.profile}</span>
                <div>
                    <button class="btn-edit" data-username="${user.username}">Editar</button>
                    <button class="btn-delete" data-username="${user.username}">Excluir</button>
                </div>
            `;
            usersList.appendChild(userDiv);
        });
        
        // Add event listeners
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = () => this.editUser(btn.dataset.username);
        });
        
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = () => this.deleteUser(btn.dataset.username);
        });
    }

    async createUser(username, password, profile) {
        if (!username || !password) {
            throw new Error('Usuário e senha são obrigatórios');
        }
        
        const ref = this.db.ref(`users/${username}`);
        const snapshot = await ref.once('value');
        
        if (snapshot.exists()) {
            throw new Error('Usuário já existe');
        }
        
        await ref.set({
            username,
            password,
            profile
        });
        
        await this.loadUsers();
    }

    async editUser(username) {
        const ref = this.db.ref(`users/${username}`);
        const snapshot = await ref.once('value');
        const user = snapshot.val();
        
        if (!user) return;
        
        this.editingUser = username;
        document.getElementById('newUsername').value = user.username;
        document.getElementById('newPassword').value = user.password;
        document.getElementById('newProfile').value = user.profile;
        document.getElementById('newUsername').disabled = true;
        
        document.getElementById('btnCreateUser').style.display = 'none';
        document.getElementById('btnUpdateUser').style.display = 'inline-block';
        document.getElementById('btnCancelEdit').style.display = 'inline-block';
    }

    async updateUser(username, password, profile) {
        if (!password) {
            throw new Error('Senha é obrigatória');
        }
        
        const ref = this.db.ref(`users/${username}`);
        await ref.update({
            password,
            profile
        });
        
        this.cancelEdit();
        await this.loadUsers();
    }

    async deleteUser(username) {
        if (!confirm(`Excluir usuário ${username}?`)) return;
        
        if (username === 'sales') {
            alert('Não é possível excluir o usuário supervisor padrão');
            return;
        }
        
        const ref = this.db.ref(`users/${username}`);
        await ref.remove();
        await this.loadUsers();
    }

    cancelEdit() {
        this.editingUser = null;
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('newProfile').value = 'operador';
        document.getElementById('newUsername').disabled = false;
        
        document.getElementById('btnCreateUser').style.display = 'inline-block';
        document.getElementById('btnUpdateUser').style.display = 'none';
        document.getElementById('btnCancelEdit').style.display = 'none';
    }

    async trackConnection(peerId, username) {
        const ref = this.db.ref(`connections/${peerId}`);
        await ref.set({
            peerId,
            username,
            timestamp: Date.now(),
            active: true
        });
    }

    async deactivateConnection(peerId) {
        const ref = this.db.ref(`connections/${peerId}`);
        await ref.update({
            active: false,
            disconnectedAt: Date.now()
        });
    }

    async loadConnections() {
        const ref = this.db.ref('connections');
        const snapshot = await ref.once('value');
        const connections = snapshot.val() || {};
        
        const connectionsList = document.getElementById('connectionsList');
        connectionsList.innerHTML = '<h4>Conexões Ativas</h4>';
        
        Object.keys(connections).forEach(peerId => {
            const conn = connections[peerId];
            if (conn.active) {
                const connDiv = document.createElement('div');
                connDiv.className = 'connection-item';
                const date = new Date(conn.timestamp).toLocaleString();
                
                const storedLink = localStorage.getItem("livecam_link");
                const linkUrl = storedLink || `${location.origin}${location.pathname}?r=${conn.peerId}`;
                
                connDiv.innerHTML = `
                    <div>
                        <strong>${conn.username}</strong> - ${date}<br>
                        <small style="color: #94a3b8;">${linkUrl}</small>
                    </div>
                    <button class="btn-monitor" data-peerid="${conn.peerId}">Monitorar</button>
                `;
                connectionsList.appendChild(connDiv);
            }
        });
        
        document.querySelectorAll('.btn-monitor').forEach(btn => {
            btn.onclick = () => this.monitorConnection(btn.dataset.peerid);
        });
    }

    monitorConnection(peerId) {
        // Navigate to monitoring view in same window
        const monitorUrl = `${location.origin}${location.pathname}?r=${peerId}&monitor=true`;
        window.location.href = monitorUrl;
    }

    async saveFile(phone, type, data, metadata = {}) {
        const timestamp = Date.now();
        const fileRef = this.db.ref(`files/${phone}/${timestamp}`);
        await fileRef.set({
            type, // 'chat' or 'video'
            data,
            metadata,
            timestamp,
            date: new Date(timestamp).toISOString()
        });
    }

    async loadFiles(phone) {
        const ref = this.db.ref(`files/${phone}`);
        const snapshot = await ref.once('value');
        const files = snapshot.val() || {};
        
        const filesList = document.getElementById('filesList');
        filesList.innerHTML = '';
        
        const fileEntries = Object.entries(files).sort((a, b) => b[1].timestamp - a[1].timestamp);
        
        if (fileEntries.length === 0) {
            filesList.innerHTML = '<p style="color: #94a3b8;">Nenhum arquivo encontrado para este telefone.</p>';
            return;
        }
        
        fileEntries.forEach(([key, file]) => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'file-item';
            const date = new Date(file.timestamp).toLocaleString();
            
            let content = '';
            if (file.type === 'chat') {
                content = `<strong>Chat:</strong> ${file.data}`;
            } else if (file.type === 'video') {
                content = `<strong>Vídeo:</strong> ${file.metadata.filename || 'video.webm'}`;
            }
            
            fileDiv.innerHTML = `
                <div>
                    ${content}<br>
                    <small style="color: #94a3b8;">${date}</small>
                </div>
            `;
            filesList.appendChild(fileDiv);
        });
    }
    
    async deactivateLink(peerId) {
        const ref = this.db.ref(`deactivated_links/${peerId}`);
        await ref.set({
            deactivatedAt: Date.now(),
            timestamp: new Date().toISOString()
        });
    }
    
    async isLinkDeactivated(peerId) {
        const ref = this.db.ref(`deactivated_links/${peerId}`);
        const snapshot = await ref.once('value');
        return snapshot.exists();
    }
}