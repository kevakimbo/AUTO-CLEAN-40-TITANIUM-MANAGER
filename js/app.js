const app = {
    data: {
        company: {
            name: 'AUTO CLEAN 40',
            address: '491 Rue Forestière\n40600 Biscarrosse',
            phone: '07 66 36 70 51',
            email: 'autoclean40600@gmail.com',
            siret: '910 220 425 00011',
            website: 'autoclean40.fr',
            legal: 'TVA non applicable, art. 293 B du CGI. En cas de retard de paiement, indemnité forfaitaire pour frais de recouvrement de 40€ et pénalités de retard au taux légal en vigueur.',
            logo: '', // Base64 string for logo
            services: [
                { id: 1, name: 'Formule LUXE', desc: 'Nettoyage complet Intérieur/Extérieur + Cire', price: 165 },
                { id: 2, name: 'Intérieur Prestige', desc: 'Aspiration, Shampoing sièges, Plastiques, Vitres', price: 125 },
                { id: 3, name: 'Intérieur Clean', desc: 'Aspiration, Poussière, Vitres', price: 95 },
                { id: 4, name: 'Extérieur Brillance', desc: 'Lavage main, Jantes, Cire de protection', price: 65 },
                { id: 5, name: 'Nettoyage Moteur', desc: 'Dégraissage et protection plastiques', price: 70 },
                { id: 6, name: 'Rénovation Phares', desc: 'Polissage optiques ternis', price: 90 },
                { id: 7, name: 'Shampoing Sièges', desc: 'Extraction taches et odeurs', price: 45 }
            ],
            editingServiceIndex: null
        },
        counters: { facture: 100, devis: 48 },
        currentDoc: {
            type: 'facture',
            autoNumber: '',
            manualNumber: '',
            date: new Date().toISOString().split('T')[0],
            client: { name: '', email: '', address: '', phone: '' },
            lines: []
        },
        history: []
    },

    init() {
        this.loadData();
        this.setupNavigation();
        this.setupListeners();
        this.renderCatalogSelect();
        this.renderCatalogList();
        this.renderStats();
        this.renderHistory();
        this.renderChart();
        this.newDocument('facture');
    },

    loadData() {
        const stored = localStorage.getItem('ac40_titanium_db');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.history) this.data.history = parsed.history;
            if (parsed.counters) this.data.counters = parsed.counters;
            if (parsed.company) {
                if (parsed.company.services && parsed.company.services.length > 0) {
                    if (!parsed.company.services[0].desc) {
                        parsed.company.services = parsed.company.services.map((s, i) => ({
                            id: i, name: s.name, desc: '', price: s.price
                        }));
                    }
                }
                this.data.company = { ...this.data.company, ...parsed.company };
            }
        }
    },

    saveData() {
        localStorage.setItem('ac40_titanium_db', JSON.stringify({
            company: this.data.company,
            history: this.data.history,
            counters: this.data.counters
        }));
        this.renderStats();
        this.renderChart();
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetView = btn.dataset.view;
                if (!targetView) return;
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                document.getElementById('view-' + targetView).classList.add('active');

                const titles = { 'dashboard': 'Tableau de bord', 'editor': 'Éditeur & Devis', 'history': 'Historique', 'settings': 'Configuration' };
                document.getElementById('page-title').textContent = titles[targetView];

                if (targetView === 'settings') this.renderSettings();
                if (targetView === 'dashboard') this.renderChart();
                if (targetView === 'editor') {
                    // Slight delay to ensure display:block has rendered
                    setTimeout(() => this.adjustPDFScale(), 50);
                }
            });
        });
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = new Date().toLocaleDateString('fr-FR', options);
    },

    setupListeners() {
        document.getElementById('doc-number-manual').addEventListener('input', (e) => {
            this.data.currentDoc.manualNumber = e.target.value;
            this.updatePreview();
        });

        document.getElementById('doc-date').addEventListener('input', (e) => {
            this.data.currentDoc.date = e.target.value;
            this.updatePreview();
        });

        ['client-name', 'client-email', 'client-address', 'client-phone'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                this.data.currentDoc.client[id.replace('client-', '')] = e.target.value;
                this.updatePreview();
            });
        });
    },

    handleLogoUpload(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.data.company.logo = e.target.result;
                this.saveData();
                this.renderSettings(); // Update preview in settings
                this.updatePreview();  // Update PDF preview
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    // --- CATALOG MANAGEMENT ---
    renderCatalogSelect() {
        const select = document.getElementById('catalog-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- Ajouter une prestation --</option>';
        this.data.company.services.forEach((s, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = `${s.name} (${s.price}€)`;
            select.appendChild(opt);
        });
    },

    renderCatalogList() {
        const tbody = document.getElementById('catalog-list-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.data.company.services.forEach((s, index) => {
            tbody.innerHTML += `
                <tr>
                    <td data-label="Prestation">
                        <div style="font-weight:600;">${s.name}</div>
                        <div style="font-size:0.8em; color:#777;">${s.desc || ''}</div>
                    </td>
                    <td style="text-align:right;" data-label="Prix">${s.price} €</td>
                    <td style="text-align:right;" data-label="Action">
                        <button class="btn btn-ghost" onclick="app.editService(${index})" style="color:var(--text-main); margin-right:5px;"><i data-lucide="pencil" style="width:14px"></i></button>
                        <button class="btn btn-ghost" onclick="app.removeService(${index})" style="color:#ef4444;"><i data-lucide="trash-2" style="width:14px"></i></button>
                    </td>
                </tr>
            `;
        });
        lucide.createIcons();
    },

    editService(index) {
        const s = this.data.company.services[index];
        if (!s) return;

        this.data.editingServiceIndex = index;

        document.getElementById('new-service-name').value = s.name;
        document.getElementById('new-service-desc').value = s.desc || '';
        document.getElementById('new-service-price').value = s.price;

        const btn = document.getElementById('btn-add-service');
        const title = document.getElementById('catalog-form-title');
        if (btn) btn.textContent = 'Modifier la prestation';
        if (title) title.textContent = 'Modifier une prestation';

        // Scroll to form if needed
        document.getElementById('new-service-name').focus();
    },

    addServiceToCatalog() {
        const name = document.getElementById('new-service-name').value;
        const desc = document.getElementById('new-service-desc').value;
        const price = parseFloat(document.getElementById('new-service-price').value);

        if (!name || isNaN(price)) return alert('Nom et Prix requis');

        if (this.data.editingServiceIndex !== null) {
            // Update existing
            const index = this.data.editingServiceIndex;
            if (this.data.company.services[index]) {
                this.data.company.services[index].name = name;
                this.data.company.services[index].desc = desc;
                this.data.company.services[index].price = price;
            }
            this.data.editingServiceIndex = null;
            document.getElementById('btn-add-service').textContent = 'Ajouter au catalogue';
            document.getElementById('catalog-form-title').textContent = 'Ajouter une prestation';
        } else {
            // Add new
            this.data.company.services.push({ id: Date.now(), name, desc, price });
        }

        this.saveData();
        this.renderCatalogList();
        this.renderCatalogSelect();

        // Clear
        document.getElementById('new-service-name').value = '';
        document.getElementById('new-service-desc').value = '';
        document.getElementById('new-service-price').value = '';
    },

    removeService(index) {
        if (confirm('Supprimer cette prestation du catalogue ?')) {
            this.data.company.services.splice(index, 1);
            this.saveData();
            this.renderCatalogList();
            this.renderCatalogSelect();
        }
    },

    addFromCatalog(index) {
        if (index === "") return;
        const s = this.data.company.services[index];
        const fullDesc = s.desc ? `${s.name}\n${s.desc}` : s.name;
        this.data.currentDoc.lines.push({ desc: fullDesc, qty: 1, price: s.price, discount: 0 });
        this.renderLines();
        this.updatePreview();
        document.getElementById('catalog-select').value = ""; // Reset
    },

    // --- EDITOR LOGIC ---
    newDocument(type) {
        // Increment next num logic safely
        const nextNum = (this.data.counters[type] || 0) + 1;
        this.data.currentDoc = {
            type: type,
            autoNumber: `${nextNum}`, // Official Proposed Number
            manualNumber: '',         // Manual Override
            date: new Date().toISOString().split('T')[0],
            client: { name: '', email: '', address: '', phone: '' },
            lines: []
        };
        this.syncInputs();
        this.renderLines();
        this.updatePreview();
    },

    syncInputs() {
        const doc = this.data.currentDoc;
        const c = this.data.company;

        // Editor inputs
        const elAuto = document.getElementById('doc-number-auto');
        if (elAuto) elAuto.value = doc.autoNumber || '';

        const elManual = document.getElementById('doc-number-manual');
        if (elManual) elManual.value = doc.manualNumber || '';

        const elDate = document.getElementById('doc-date');
        if (elDate) elDate.value = doc.date;

        ['client-name', 'client-email', 'client-address', 'client-phone'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = doc.client[id.replace('client-', '')] || '';
        });
    },

    addLine() {
        this.data.currentDoc.lines.push({ desc: '', qty: 1, price: 0, discount: 0 });
        this.renderLines();
    },

    renderLines() {
        const container = document.getElementById('lines-container');
        container.innerHTML = '';
        this.data.currentDoc.lines.forEach((line, index) => {
            const div = document.createElement('div');
            div.className = 'grid-2';
            div.style.display = 'grid';
            div.style.gridTemplateColumns = '2fr 0.5fr 0.8fr 0.8fr auto';
            div.style.marginBottom = '0.5rem';
            div.style.gap = '0.5rem';

            div.innerHTML = `
                <textarea class="input" placeholder="Description & Détails" onchange="app.updateLine(${index}, 'desc', this.value)" style="min-height:38px; height:auto; resize:vertical; padding: 0.6rem;">${line.desc}</textarea>
                <input type="number" class="input" placeholder="Qté" value="${line.qty}" onchange="app.updateLine(${index}, 'qty', this.value)">
                <input type="number" class="input" placeholder="Prix" value="${line.price}" onchange="app.updateLine(${index}, 'price', this.value)">
                <input type="number" class="input" placeholder="Rem. %" value="${line.discount || 0}" onchange="app.updateLine(${index}, 'discount', this.value)" title="Remise en %">
                <button class="btn btn-ghost" onclick="app.removeLine(${index})" style="padding: 0.5rem; color: #ef4444;"><i data-lucide="trash-2" style="width:16px"></i></button>
            `;
            container.appendChild(div);
        });
        lucide.createIcons();
    },

    updateLine(index, field, value) {
        this.data.currentDoc.lines[index][field] = field === 'desc' ? value : parseFloat(value) || 0;
        this.updatePreview();
    },

    removeLine(index) {
        this.data.currentDoc.lines.splice(index, 1);
        this.renderLines();
        this.updatePreview();
    },

    updatePreview() {
        const doc = this.data.currentDoc;
        const company = this.data.company;

        // Priority: Manual > Auto
        const displayNum = doc.manualNumber ? doc.manualNumber : doc.autoNumber;

        let totalHT = 0;
        const linesHtml = doc.lines.map(l => {
            const baseTotal = l.qty * l.price;
            const discountAmount = baseTotal * ((l.discount || 0) / 100);
            const finalLineTotal = baseTotal - discountAmount;
            totalHT += finalLineTotal;

            const discountDisplay = l.discount > 0 ? `<div style="font-size:0.85em; font-style:italic;">Remise: ${l.discount}% (-${discountAmount.toFixed(2)}€)</div>` : '';
            const descDisplay = l.desc.replace(/\n/g, '<br>');

            return `
                <tr>
                    <td style="padding: 12px 8px; border-bottom: 1px solid #000;">
                        <span style="font-weight:600; font-size: 1.05em; display:block; margin-bottom: 2px;">${descDisplay.split('<br>')[0]}</span>
                        ${descDisplay.includes('<br>') ? `<div style="font-size:0.9em; line-height: 1.4; margin-top:2px;">${descDisplay.substring(descDisplay.indexOf('<br>') + 4)}</div>` : ''}
                    </td>
                    <td style="text-align: center; padding: 12px 0; border-bottom: 1px solid #000; font-weight: 500;">${l.qty}</td>
                    <td style="text-align: right; padding: 12px 0; border-bottom: 1px solid #000;">${l.price.toFixed(2)} €</td>
                    <td style="text-align: right; padding: 12px 8px; border-bottom: 1px solid #000; font-weight: 600;">
                        ${finalLineTotal.toFixed(2)} €
                        ${discountDisplay}
                    </td>
                </tr>
            `;
        }).join('');

        const totalTTC = totalHT;

        // --- NEW PREMIUM WIDE LAYOUT (Strict Monochrome) ---
        const logoHtml = company.logo
            // Force grayscale filter for print safety
            ? `<div style="margin-bottom: 15px;"><img src="${company.logo}" style="height: 80px; width: auto; object-fit: contain; filter: grayscale(100%);"></div>`
            : `<div style="width: 60px; height: 60px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                 <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
               </div>`;

        const html = `
            <div style="font-family: 'Outfit', sans-serif; color: #000; line-height: 1.4; padding: 20px;">
                <!-- HEADER -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 4px solid #000; padding-bottom: 20px;">
                    <div style="flex: 1;">
                        ${logoHtml}
                        <h1 style="font-size: 1.5em; font-weight: 900; text-transform: uppercase;">${company.name}</h1>
                        <div style="font-size: 0.95em; margin-top: 5px;">
                            ${company.address.replace(/\n/g, '<br>')}
                            <div style="margin-top: 8px;">
                                ${company.phone} • ${company.email}<br>
                                ${company.website || ''}
                            </div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 3em; font-weight: 900; letter-spacing: 2px; line-height: 1;">${doc.type.toUpperCase()}</div>
                        <div style="font-size: 1.4em; font-weight: 600; margin-top: 5px;">N° ${displayNum}</div>
                        <div style="font-size: 1em; margin-top: 5px;">Date : ${new Date(doc.date).toLocaleDateString('fr-FR')}</div>
                    </div>
                </div>

                <!-- CLIENT BOX (THIN BORDER RIGHT) -->
                <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
                     <div style="width: 45%; border: 1px solid #000; padding: 20px;">
                        <div style="font-size: 0.8em; text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 10px;">Facturé à :</div>
                        <div style="font-size: 1.2em; font-weight: 800; margin-bottom: 5px;">${doc.client.name || 'Nom du Client'}</div>
                        <div style="font-size: 1em; white-space: pre-wrap;">${doc.client.address || ''}</div>
                        <div style="margin-top: 10px;">${doc.client.phone || ''}</div>
                        <div>${doc.client.email || ''}</div>
                    </div>
                </div>

                <!-- TABLE -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr>
                            <th style="text-align: left; border-bottom: 2px solid #000; padding: 10px 8px; font-weight: 800; text-transform: uppercase; font-size: 0.9em;">Désignation</th>
                            <th style="text-align: center; width: 10%; border-bottom: 2px solid #000; padding: 10px 0; font-weight: 800; text-transform: uppercase; font-size: 0.9em;">Qté</th>
                            <th style="text-align: right; width: 20%; border-bottom: 2px solid #000; padding: 10px 0; font-weight: 800; text-transform: uppercase; font-size: 0.9em;">Prix Unit.</th>
                            <th style="text-align: right; width: 20%; border-bottom: 2px solid #000; padding: 10px 8px; font-weight: 800; text-transform: uppercase; font-size: 0.9em;">Total HT</th>
                        </tr>
                    </thead>
                    <tbody style="font-size: 0.95em;">
                        ${linesHtml}
                    </tbody>
                </table>

                <!-- TOTALS -->
                <div style="display: flex; justify-content: flex-end;">
                    <div style="width: 300px;">
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 15px;">
                            <span style="font-weight: 600;">Total HT</span> 
                            <span style="font-weight: 700;">${totalHT.toFixed(2)} €</span>
                        </div>
                        
                        <div style="background: #000; color: #fff; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; text-transform: uppercase;">Net à Payer</span>
                            <span style="font-weight: 900; font-size: 1.6em;">${totalTTC.toFixed(2)} €</span>
                        </div>
                        <div style="text-align: right; margin-top: 5px; font-size: 0.8em; font-style: italic;">TVA non applicable, art. 293 B du CGI</div>
                    </div>
                </div>

                <!-- FOOTER -->
                <div style="position: fixed; bottom: 0; left: 0; right: 0; padding: 30px 40px; text-align: center; font-size: 0.75em; border-top: 1px solid #000; background: #fff;">
                    <p style="font-weight: 700; margin-bottom: 5px;">${company.name} - SIRET : ${company.siret}</p>
                    <p>${company.legal}</p>
                </div>
            </div>
        `;
        document.getElementById('pdf-preview').innerHTML = html;
        document.getElementById('pdf-preview').style.filter = "grayscale(100%)";

        // Recalculate scale
        this.adjustPDFScale();
    },

    saveDocument() {
        if (!this.data.currentDoc.client.name) return alert('Nom du client requis');

        let totalDoc = 0;
        this.data.currentDoc.lines.forEach(l => {
            totalDoc += (l.price * l.qty) * (1 - (l.discount || 0) / 100);
        });

        const finalNumber = this.data.currentDoc.manualNumber || this.data.currentDoc.autoNumber;

        const docRecord = {
            ...JSON.parse(JSON.stringify(this.data.currentDoc)),
            number: finalNumber,
            totalTTC: totalDoc,
            timestamp: Date.now()
        };

        this.data.history.push(docRecord);

        if (!this.data.currentDoc.manualNumber) {
            this.data.counters[this.data.currentDoc.type]++;
        }

        this.saveData();
        alert(`Document N° ${finalNumber} enregistré !`);
        this.renderHistory();
        this.renderStats();

        this.newDocument(this.data.currentDoc.type);
    },

    loadFromHistory(index) {
        const realIndex = this.data.history.length - 1 - index;
        const doc = this.data.history[realIndex];

        this.data.currentDoc = { ...doc };
        if (!this.data.currentDoc.lines) this.data.currentDoc.lines = [];

        this.syncInputs();
        this.renderLines();
        this.updatePreview();
        document.querySelector('[data-view="editor"]').click();
        alert(`Document N° ${doc.number} chargé.`);
    },

    // Config Logic
    saveSettings() {
        // Company
        this.data.company.name = document.getElementById('conf-company').value;
        this.data.company.siret = document.getElementById('conf-siret').value;
        this.data.company.address = document.getElementById('conf-address').value;
        this.data.company.phone = document.getElementById('conf-phone').value;
        this.data.company.email = document.getElementById('conf-email').value;
        this.data.company.website = document.getElementById('conf-website').value;
        this.data.company.legal = document.getElementById('conf-legal').value;

        // Counters
        const newFacture = parseInt(document.getElementById('conf-counter-facture').value);
        const newDevis = parseInt(document.getElementById('conf-counter-devis').value);

        if (!isNaN(newFacture)) this.data.counters.facture = newFacture;
        if (!isNaN(newDevis)) this.data.counters.devis = newDevis;

        this.saveData();
        alert('Configuration sauvegardée');
        this.updatePreview();
    },

    renderSettings() {
        // Company
        const c = this.data.company;
        document.getElementById('conf-company').value = c.name || '';
        document.getElementById('conf-siret').value = c.siret || '';
        document.getElementById('conf-address').value = c.address || '';
        document.getElementById('conf-phone').value = c.phone || '';
        document.getElementById('conf-email').value = c.email || '';
        document.getElementById('conf-website').value = c.website || '';
        document.getElementById('conf-legal').value = c.legal || '';

        // Logo Preview
        const preview = document.getElementById('conf-logo-preview');
        if (c.logo) {
            preview.src = c.logo;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }

        // Counters
        document.getElementById('conf-counter-facture').value = this.data.counters.facture;
        document.getElementById('conf-counter-devis').value = this.data.counters.devis;

        this.renderCatalogList();
    },

    // Stats & Chart
    renderStats() {
        const totalDocs = this.data.history.length;
        const revenue = this.data.history.reduce((s, d) => s + d.totalTTC, 0);
        document.getElementById('stat-docs-total').textContent = totalDocs;
        document.getElementById('stat-revenue-month').textContent = revenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
        document.getElementById('stat-avg-cart').textContent = (totalDocs ? revenue / totalDocs : 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    },

    renderChart() {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;
        const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        const currentMonth = new Date().getMonth();
        const labels = [];
        const data = [];
        for (let i = 5; i >= 0; i--) {
            const mIndex = (currentMonth - i + 12) % 12;
            labels.push(months[mIndex]);
            const targetMonth = mIndex;
            const rev = this.data.history.filter(d => new Date(d.date).getMonth() === targetMonth).reduce((sum, d) => sum + d.totalTTC, 0);
            data.push(rev);
        }
        if (this.chartInstance) this.chartInstance.destroy();
        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'CA (€)',
                    data: data,
                    borderColor: '#e5e5e5', backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 2, fill: true, tension: 0.4,
                    pointBackgroundColor: '#000', pointBorderColor: '#fff', pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#525252' } },
                    x: { grid: { display: false }, ticks: { color: '#525252' } }
                }
            }
        });
    },

    renderHistory() {
        const tbody = document.getElementById('history-list');
        const recentBody = document.getElementById('recent-activities');
        tbody.innerHTML = '';
        recentBody.innerHTML = '';
        [...this.data.history].reverse().forEach((doc, i) => {
            const dateStr = new Date(doc.date).toLocaleDateString();
            const row = `<tr>
                <td style="font-family:monospace; color: #fff;" data-label="Numéro">N° ${doc.number}</td>
                <td data-label="Client">${doc.client.name}</td>
                <td data-label="Date">${dateStr}</td>
                <td data-label="Type"><span class="badge" style="background:#333; padding:2px 6px; border-radius:4px; font-size:0.7em;">${doc.type}</span></td>
                <td style="text-align:right; font-weight:bold;" data-label="Montant">${doc.totalTTC.toFixed(2)} €</td>
                <td style="text-align:right;" data-label="Actions">
                     <button class="btn btn-ghost" onclick="app.loadFromHistory(${i})" style="padding:4px;"><i data-lucide="eye" style="width:14px"></i></button>
                     <button class="btn btn-ghost" onclick="app.deleteDoc(${i})" style="padding:4px; color:#ef4444;"><i data-lucide="trash-2" style="width:14px"></i></button>
                </td>
            </tr>`;
            tbody.innerHTML += row;
            if (i < 5) recentBody.innerHTML += `<tr><td style="font-family:monospace;" data-label="Numéro">N° ${doc.number}</td><td data-label="Client">${doc.client.name}</td><td data-label="Date">${dateStr}</td><td data-label="Type">${doc.type}</td><td style="text-align:right;" data-label="Montant">${doc.totalTTC.toFixed(2)}€</td></tr>`;
        });
        lucide.createIcons();
    },

    deleteDoc(index) {
        if (confirm('Supprimer ?')) {
            const realIndex = this.data.history.length - 1 - index;
            this.data.history.splice(realIndex, 1);
            this.saveData();
            this.renderHistory();
        }
    },

    filterHistory(query) {
        const rows = document.getElementById('history-list').querySelectorAll('tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
        });
    },

    generatePDF() {
        const element = document.getElementById('pdf-preview');
        const opt = {
            margin: 0,
            filename: `${this.data.currentDoc.type}_${this.data.currentDoc.number}.pdf`,
            image: { type: 'jpeg', quality: 0.99 }, // Max quality
            html2canvas: { scale: 2, useCORS: true, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    },

    adjustPDFScale() {
        const wrapper = document.querySelector('.paper-wrapper');
        const paper = document.getElementById('pdf-preview');
        if (!wrapper || !paper) return;

        // Reset first to get real width
        paper.style.transform = 'none';

        // Only run on mobile/smaller screens where it might overflow
        if (window.innerWidth <= 768) {
            const containerWidth = wrapper.parentElement.clientWidth;
            const paperWidth = 794; // Fixed A4 width

            // Calculate scale
            const scale = containerWidth / paperWidth;

            // Apply scale
            paper.style.transform = `scale(${scale})`;
            paper.style.transformOrigin = 'top left';

            // Adjust wrapper height to match scaled content so it doesn't collapse or hide
            const scaledHeight = paper.offsetHeight * scale;
            wrapper.style.height = `${scaledHeight}px`;
            wrapper.style.marginBottom = '20px'; // Space below
        } else {
            // Desktop reset
            paper.style.transform = 'none';
            wrapper.style.height = 'auto';
            wrapper.style.marginBottom = '0';
        }
    }
};

app.init();

// Global Resize Listener
window.addEventListener('resize', () => {
    app.adjustPDFScale();
});

// Also run slightly after load to ensure layout is ready
setTimeout(() => app.adjustPDFScale(), 500);
