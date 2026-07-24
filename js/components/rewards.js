/**
 * GrowthOS Personal Rewards Shop Controller (rewards.js)
 * Controls custom XP rewards, balance checking, redemption transactions, and reward history.
 */

const RewardsComponent = {
    async render() {
        const rewards = await db.getAllRewards();
        const redemptions = await db.getAllRedemptions();
        const settings = await db.getSettings();
        const currentXP = Number(settings.xp || 0);

        // Update XP display in shop header
        const shopXpDisplay = document.getElementById('shop-xp-balance');
        if (shopXpDisplay) {
            shopXpDisplay.textContent = `${currentXP} XP`;
        }

        const gridEl = document.getElementById('rewards-list-grid');
        if (!gridEl) return;

        if (rewards.length === 0) {
            gridEl.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; background: var(--glass-bg); border: 1px dashed var(--glass-border); border-radius: var(--radius-lg); color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 0.75rem;">🏆</div>
                    <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-primary);">No Custom Rewards Available Yet</div>
                    <p style="font-size: 0.9rem; max-width: 450px; margin: 0.5rem auto 1.5rem;">Create personal real-life rewards with custom XP costs (like movie nights, cheat meals, or new books) to stay motivated.</p>
                    <button class="btn btn-purple" onclick="RewardsComponent.openRewardModal()">➕ Create First Reward</button>
                </div>
            `;
        } else {
            gridEl.innerHTML = '';
            rewards.forEach(reward => {
                const canAfford = currentXP >= Number(reward.cost || 100);
                const missingXP = Math.max(0, Number(reward.cost || 100) - currentXP);

                const card = document.createElement('div');
                card.className = 'goal-card'; // Reuse glass card layout
                card.innerHTML = `
                    <div class="goal-card-top">
                        <span style="font-size: 2.25rem; background: rgba(255,255,255,0.05); padding: 0.5rem; border-radius: var(--radius-md);">${reward.icon || '🎁'}</span>
                        <div class="goal-actions">
                            <button class="icon-btn btn-delete-reward" data-reward-id="${reward.id}" title="Delete Reward">🗑️</button>
                        </div>
                    </div>

                    <div>
                        <h3 class="goal-title" style="margin-top: 0.5rem;">${reward.title}</h3>
                        <p class="goal-desc">${reward.description || 'No description provided.'}</p>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--glass-border);">
                        <span class="xp-pill" style="font-size: 0.9rem; padding: 0.35rem 0.85rem;">💎 ${reward.cost} XP</span>
                        ${canAfford ? `
                            <button class="btn btn-purple btn-sm btn-redeem-action" data-reward-id="${reward.id}">
                                ✨ Redeem Now
                            </button>
                        ` : `
                            <button class="btn btn-secondary btn-sm" disabled style="opacity: 0.5; cursor: not-allowed;">
                                🔒 Need ${missingXP} more XP
                            </button>
                        `}
                    </div>
                `;

                const btnRedeem = card.querySelector('.btn-redeem-action');
                if (btnRedeem) {
                    btnRedeem.addEventListener('click', async () => {
                        await this.handleRedemption(reward.id);
                    });
                }

                const btnDelete = card.querySelector('.btn-delete-reward');
                if (btnDelete) {
                    btnDelete.addEventListener('click', async () => {
                        if (confirm(`Delete reward "${reward.title}"?`)) {
                            await db.deleteReward(reward.id);
                            GrowthUtils.showToast('Reward deleted.', 'rose');
                            await this.render();
                        }
                    });
                }

                gridEl.appendChild(card);
            });
        }

        // Render Redemptions History Log
        this.renderHistory(redemptions);
    },

    renderHistory(redemptions = []) {
        const historyEl = document.getElementById('redemptions-history-list');
        if (!historyEl) return;

        if (redemptions.length === 0) {
            historyEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem;">No rewards redeemed yet. Complete tasks, earn XP, and unlock your first reward!</div>`;
            return;
        }

        historyEl.innerHTML = '';
        redemptions.slice(0, 10).forEach(rd => {
            const item = document.createElement('div');
            item.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); margin-bottom: 0.65rem;`;
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 1.5rem;">${rd.icon || '🎁'}</span>
                    <div>
                        <div style="font-weight: 600; font-size: 0.95rem;">${rd.title}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${GrowthUtils.formatDate(rd.timestamp)} at ${new Date(rd.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                </div>
                <span class="xp-pill" style="color: var(--accent-rose); border-color: rgba(244,63,94,0.3);">- ${rd.cost} XP</span>
            `;
            historyEl.appendChild(item);
        });
    },

    async handleRedemption(rewardId) {
        try {
            const result = await db.redeemReward(rewardId);
            GrowthUtils.triggerConfetti();
            GrowthUtils.showToast(`🎉 Redeemed "${result.reward.title}"! Enjoy your reward! (-${result.reward.cost} XP)`, 'emerald');
            
            // Update sidebar gamification stats
            const settings = await db.getSettings();
            if (typeof DashboardComponent !== 'undefined' && DashboardComponent.updateSidebarGamification) {
                const checkInHistory = settings.checkInHistory || [];
                const currentStreak = GrowthModels.calculateStreak(checkInHistory);
                DashboardComponent.updateSidebarGamification(settings.xp || 0, currentStreak);
            }

            await this.render();
        } catch (err) {
            alert(err.message);
        }
    },

    openRewardModal() {
        const modal = document.getElementById('reward-modal');
        const form = document.getElementById('reward-form');
        if (!modal || !form) return;

        form.reset();
        document.getElementById('reward-id').value = '';
        modal.classList.add('active');
    },

    closeRewardModal() {
        const modal = document.getElementById('reward-modal');
        if (modal) modal.classList.remove('active');
    },

    async saveForm(e) {
        e.preventDefault();
        const idInput = document.getElementById('reward-id');
        const titleInput = document.getElementById('reward-title-input');
        const descInput = document.getElementById('reward-desc-input');
        const costInput = document.getElementById('reward-cost-input');
        const iconInput = document.getElementById('reward-icon-input');

        const rewardObj = {
            id: idInput.value || undefined,
            title: titleInput.value.trim(),
            description: descInput.value.trim(),
            cost: Number(costInput.value) || 100,
            icon: iconInput.value.trim() || '🎁'
        };

        await db.saveReward(rewardObj);
        GrowthUtils.showToast(rewardObj.id ? 'Reward updated!' : '🏆 Custom reward created!', 'emerald');
        this.closeRewardModal();
        await this.render();
    }
};
