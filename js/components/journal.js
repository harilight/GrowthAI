/**
 * GrowthOS Reflection Journal Controller (journal.js)
 * Controls daily reflection logs, gratitude entries, mood tracking, and keyword search.
 */

const JournalComponent = {
    async render(searchQuery = '') {
        const entries = await db.getAllJournalEntries();
        const listEl = document.getElementById('journal-list');
        if (!listEl) return;

        const filtered = entries.filter(e => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (e.gratitude && e.gratitude.toLowerCase().includes(query)) ||
                   (e.reflection && e.reflection.toLowerCase().includes(query)) ||
                   (e.mood && e.mood.toLowerCase().includes(query)) ||
                   (e.date && e.date.includes(query));
        });

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 4rem 2rem; background: var(--glass-bg); border: 1px dashed var(--glass-border); border-radius: var(--radius-lg); color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 0.75rem;">📔</div>
                    <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-primary);">No Reflection Logs Found</div>
                    <p style="font-size: 0.9rem; max-width: 450px; margin: 0.5rem auto 1.5rem;">Daily journaling clarifies roadblocks, tracks gratitude, and consolidates your mental growth journey.</p>
                    <button class="btn btn-purple" onclick="JournalComponent.openJournalModal()">➕ Write Today's Reflection</button>
                </div>
            `;
            return;
        }

        listEl.innerHTML = '';

        filtered.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'journal-entry-card';
            card.innerHTML = `
                <div class="journal-entry-header">
                    <span class="journal-date">📅 ${GrowthUtils.formatDate(entry.date)}</span>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span class="journal-mood">${entry.mood || '😊 Productive'}</span>
                        <button class="icon-btn btn-delete-journal" data-journal-id="${entry.id}" title="Delete Reflection">🗑️</button>
                    </div>
                </div>

                <div style="margin-bottom: 1rem; padding: 1rem; background: rgba(255,255,255,0.02); border-left: 3px solid var(--accent-cyan); border-radius: 4px;">
                    <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--accent-cyan); margin-bottom: 0.35rem;">✨ Daily Gratitude & Wins</div>
                    <div style="white-space: pre-line; font-size: 0.9rem; color: var(--text-primary); line-height: 1.5;">${entry.gratitude || 'No gratitude noted.'}</div>
                </div>

                <div style="padding: 1rem; background: rgba(255,255,255,0.02); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--accent-purple); margin-bottom: 0.35rem;">🎯 Key Takeaways & Bottleneck Analysis</div>
                    <div style="white-space: pre-line; font-size: 0.9rem; color: var(--text-primary); line-height: 1.5;">${entry.reflection || 'No reflections noted.'}</div>
                </div>
            `;

            const btnDelete = card.querySelector('.btn-delete-journal');
            if (btnDelete) {
                btnDelete.addEventListener('click', async () => {
                    if (await GrowthUtils.confirm(`Delete reflection from ${entry.date}?`, 'Delete Entry', '🗑️')) {
                        await db.deleteJournalEntry(entry.id);
                        GrowthUtils.showToast('Reflection entry deleted.', 'rose');
                        await this.render(document.getElementById('journal-search')?.value || '');
                    }
                });
            }

            listEl.appendChild(card);
        });
    },

    openJournalModal() {
        const modal = document.getElementById('journal-modal');
        const form = document.getElementById('journal-form');
        if (!modal || !form) return;

        form.reset();
        const dateInput = document.getElementById('journal-date-input');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        modal.classList.add('active');
    },

    closeJournalModal() {
        const modal = document.getElementById('journal-modal');
        if (modal) modal.classList.remove('active');
    },

    async saveForm(e) {
        e.preventDefault();
        const dateInput = document.getElementById('journal-date-input');
        const moodInput = document.getElementById('journal-mood-input');
        const gratitudeInput = document.getElementById('journal-gratitude-input');
        const reflectionInput = document.getElementById('journal-reflection-input');

        const entryObj = {
            date: dateInput.value || new Date().toISOString().split('T')[0],
            mood: moodInput.value,
            gratitude: gratitudeInput.value.trim(),
            reflection: reflectionInput.value.trim()
        };

        await db.saveJournalEntry(entryObj);
        GrowthUtils.showToast('📔 Reflection logged! +25 XP earned!', 'purple');
        
        // Award XP for journaling
        const settings = await db.getSettings();
        const currentXP = (settings.xp || 0) + 25;
        await db.updateSetting('xp', currentXP);
        await db.updateSetting('level', Math.floor(Math.sqrt(currentXP / 50)) + 1);

        this.closeJournalModal();
        await this.render();
        if (typeof DashboardComponent !== 'undefined' && DashboardComponent.render) DashboardComponent.render();
    }
};
