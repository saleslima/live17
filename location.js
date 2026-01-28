// location.js - Handles geolocation and mapping

export class LocationManager {
    constructor() {
        this.addressLeft = document.getElementById("addressLeft");
        this.addressRight = document.getElementById("addressRight");
        this.mapContainer = document.getElementById("map");
        this.map = null;
        this.isExpanded = false;
        this.currentLocationData = null;
    }

    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
    }

    async getAddressFromCoords(latitude, longitude) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const data = await response.json();
            
            const addr = data.address || {};
            return {
                address: data.display_name || "Endereço não encontrado",
                via: addr.road || addr.pedestrian || addr.cycleway || addr.footway || "",
                numero: addr.house_number || "",
                bairro: addr.suburb || addr.neighbourhood || addr.city_district || "",
                municipio: addr.city || addr.town || addr.village || addr.municipality || "",
                cep: addr.postcode || ""
            };
        } catch (e) {
            return {
                address: "Erro ao buscar endereço",
                via: "", numero: "", bairro: "", municipio: "", cep: ""
            };
        }
    }

    displayLocation(latitude, longitude, addressData) {
        this.currentLocationData = { latitude, longitude, addressData };
        this.renderLocation();
    }

    renderLocation() {
        if (!this.currentLocationData) return;
        
        const { latitude, longitude, addressData } = this.currentLocationData;
        const { address, via, numero, bairro, municipio, cep } = addressData;
        
        let infoHtml;
        if (this.isExpanded) {
            infoHtml = `
                <div class="info-box">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong>📍 Localização do Visitante</strong>
                        <button id="btnToggleLocation" style="padding: 4px 8px; font-size: 12px;">➖ Ocultar</button>
                    </div>
                    <strong>Endereço:</strong> ${address}<br>
                    <strong>Via:</strong> ${via}<br>
                    <strong>Número:</strong> ${numero}<br>
                    <strong>Bairro:</strong> ${bairro}<br>
                    <strong>Município:</strong> ${municipio}<br>
                    <strong>CEP:</strong> ${cep}<br>
                    <strong>Latitude:</strong> ${latitude.toFixed(6)}<br>
                    <strong>Longitude:</strong> ${longitude.toFixed(6)}
                </div>
            `;
        } else {
            infoHtml = `
                <div class="info-box">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong>📍 Localização do Visitante</strong>
                        <button id="btnToggleLocation" style="padding: 4px 8px; font-size: 12px;">➕ Exibir</button>
                    </div>
                    ${via} ${numero}, ${bairro} - ${municipio}
                </div>
            `;
        }

        if (this.addressLeft) this.addressLeft.innerHTML = infoHtml;
        if (this.addressRight) this.addressRight.innerHTML = infoHtml;

        // Add event listener to toggle buttons
        document.querySelectorAll('#btnToggleLocation').forEach(btn => {
            btn.onclick = () => this.toggleLocationDisplay();
        });

        if (this.mapContainer) {
            if (this.isExpanded) {
                this.mapContainer.style.display = 'block';
                if (!this.map) {
                    this.mapContainer.innerHTML = '';
                    this.map = L.map(this.mapContainer).setView([latitude, longitude], 15);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap'
                    }).addTo(this.map);
                    L.marker([latitude, longitude]).addTo(this.map)
                        .bindPopup('Visitante está aqui')
                        .openPopup();
                }
            } else {
                this.mapContainer.style.display = 'none';
            }
        }
    }

    toggleLocationDisplay() {
        this.isExpanded = !this.isExpanded;
        this.renderLocation();
    }
}