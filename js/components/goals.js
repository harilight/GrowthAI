/**
 * GrowthOS Target Goals Controller (goals.js)
 * Handles goal creation, manual period/deadline tuning, manual progress override sliders, and status calculation.
 */

const GoalsComponent = {
    currentFilter: 'all',
    viewMode: 'grid', // 'grid' or 'kanban'

    toggleViewMode() {
        this.viewMode = this.viewMode === 'grid' ? 'kanban' : 'grid';
        const btn = document.getElementById('btn-toggle-kanban');
        if (btn) {
            btn.innerHTML = this.viewMode === 'grid' ? '📋 Switch to Kanban' : '🔲 Switch to Grid';
        }
        
        const gridEl = document.getElementById('goals-list-grid');
        const kanbanEl = document.getElementById('goals-kanban-board');
        if (gridEl && kanbanEl) {
            if (this.viewMode === 'grid') {
                gridEl.style.display = 'grid';
                kanbanEl.style.display = 'none';
            } else {
                gridEl.style.display = 'none';
                kanbanEl.style.display = 'flex';
            }
        }
        
        this.render();
    },

    async render(filter = null) {
        if (filter) this.currentFilter = filter;
        const goals = await db.getAllGoals();
        const tasks = await db.getAllTasks();

        // Update category filter pills UI
        document.querySelectorAll('[data-goal-filter]').forEach(btn => {
            if (btn.getAttribute('data-goal-filter') === this.currentFilter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const gridEl = document.getElementById('goals-list-grid');
        const kanbanEl = document.getElementById('goals-kanban-board');
        if (!gridEl || !kanbanEl) return;

        const filteredGoals = goals.filter(g => {
            if (this.currentFilter === 'all') return true;
            return g.category === this.currentFilter;
        });

        if (filteredGoals.length === 0) {
            gridEl.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; background: var(--glass-bg); border: 1px dashed var(--glass-border); border-radius: var(--radius-lg); color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 0.75rem;">🎯</div>
                    <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-primary);">No Target Goals Found</div>
                    <p style="font-size: 0.9rem; max-width: 450px; margin: 0.5rem auto 1.5rem;">Create specific targets with custom timeframes and daily task velocity to turn ambitions into real progress.</p>
                    <button class="btn btn-emerald" onclick="GoalsComponent.openGoalModal()">➕ Create First Target Goal</button>
                </div>
            `;
            return;
        }

        gridEl.innerHTML = '';
        document.getElementById('kanban-col-progress').innerHTML = '';
        document.getElementById('kanban-col-completed').innerHTML = '';
        document.getElementById('kanban-col-overachieved').innerHTML = '';

        filteredGoals.forEach(goal => {
            const metrics = GrowthModels.calculateGoalMetrics(goal, tasks);

            let tagClass = 'tag-career';
            if (goal.category === 'Health') tagClass = 'tag-health';
            if (goal.category === 'Financial') tagClass = 'tag-financial';
            if (goal.category === 'Personal') tagClass = 'tag-personal';
            if (goal.category === 'Skills') tagClass = 'tag-skills';

            const card = document.createElement('div');
            card.className = 'goal-card';
            card.innerHTML = `
                <div class="goal-card-top">
                    <span class="goal-category-tag ${tagClass}">${goal.category || 'Goal'}</span>
                    <div class="goal-actions">
                        <button class="icon-btn btn-ai-habits" data-goal-id="${goal.id}" title="✨ Auto-Generate AI Habits">✨</button>
                        <button class="icon-btn btn-edit-goal" data-goal-id="${goal.id}" title="Edit Goal & Timeframe">✏️</button>
                        <button class="icon-btn btn-delete-goal" data-goal-id="${goal.id}" title="Delete Goal">🗑️</button>
                    </div>
                </div>

                <div>
                    <h3 class="goal-title">${goal.title}</h3>
                    <p class="goal-desc">${goal.description || 'No description provided.'}</p>
                </div>

                <div class="goal-period-banner">
                    <div class="period-dates">
                        <span>📅 ${GrowthUtils.formatDate(goal.startDate)} → ${GrowthUtils.formatDate(goal.endDate)}</span>
                    </div>
                    <span class="period-status ${metrics.statusClass}">${metrics.statusText}</span>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-secondary);">
                    <span>⏳ <b>${metrics.daysRemaining} days</b> remaining</span>
                    <span>Required Velocity: <b>${metrics.requiredDailyVelocity} ${goal.unit || ''}/day</b></span>
                </div>

                <div class="goal-progress-section">
                    <div class="progress-header">
                        <span>Progress (${metrics.currentValue} / ${metrics.targetValue} ${goal.unit || ''})</span>
                        <span class="value">${metrics.actualProgressPercent}%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${metrics.actualProgressPercent}%;"></div>
                    </div>
                    ${goal.isManualProgress ? `
                        <div style="margin-top: 0.35rem;">
                            <input type="range" min="0" max="${metrics.targetValue}" value="${metrics.currentValue}" class="goal-manual-slider" data-slider-goal-id="${goal.id}">
                            <div style="font-size: 0.72rem; color: var(--text-muted); text-align: right;">Manual Progress Override Slider</div>
                        </div>
                    ` : `
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-align: right; margin-top: 0.25rem;">
                            Auto-linked to ${metrics.linkedTasksCount} assigned daily task(s)
                        </div>
                    `}
                </div>
            `;

            // Attach slider listener
            const slider = card.querySelector('.goal-manual-slider');
            if (slider) {
                slider.addEventListener('input', async (e) => {
                    const newVal = Number(e.target.value);
                    goal.currentValue = newVal;
                    await db.saveGoal(goal);
                    
                    // Update progress fill and text on the fly
                    const newMetrics = GrowthModels.calculateGoalMetrics(goal, tasks);
                    const fill = card.querySelector('.progress-fill');
                    const valueText = card.querySelector('.progress-header .value');
                    const headerText = card.querySelector('.progress-header span:first-child');
                    
                    if (fill) fill.style.width = `${newMetrics.actualProgressPercent}%`;
                    if (valueText) valueText.textContent = `${newMetrics.actualProgressPercent}%`;
                    if (headerText) headerText.textContent = `Progress (${newMetrics.currentValue} / ${newMetrics.targetValue} ${goal.unit || ''})`;

                    if (newMetrics.actualProgressPercent >= 100) {
                        GrowthUtils.triggerConfetti();
                        GrowthUtils.showToast(`🎉 Target Goal "${goal.title}" Achieved!`, 'emerald');
                    }
                });

                slider.addEventListener('change', async () => {
                    await this.render(this.currentFilter);
                    if (typeof DashboardComponent !== 'undefined' && DashboardComponent.render) DashboardComponent.render();
                    if (typeof AnalyticsComponent !== 'undefined' && AnalyticsComponent.render) AnalyticsComponent.render();
                });
            }

            // Attach Edit & Delete buttons
            const btnEdit = card.querySelector('.btn-edit-goal');
            if (btnEdit) {
                btnEdit.addEventListener('click', () => this.openGoalModal(goal));
            }

            const btnDelete = card.querySelector('.btn-delete-goal');
            if (btnDelete) {
                btnDelete.addEventListener('click', async () => {
                    if (confirm(`Are you sure you want to delete goal "${goal.title}"?`)) {
                        await db.deleteGoal(goal.id);
                        GrowthUtils.showToast('Target goal deleted.', 'rose');
                        await this.render(this.currentFilter);
                        if (typeof DashboardComponent !== 'undefined' && DashboardComponent.render) DashboardComponent.render();
                    }
                });
            }

            // Event listener for AI Habits
            const aiBtn = card.querySelector('.btn-ai-habits');
            if (aiBtn) {
                aiBtn.addEventListener('click', () => {
                    if (typeof AICoachComponent !== 'undefined') {
                        AICoachComponent.generateHabitsForGoal(goal.id);
                    }
                });
            }
            
            if (this.viewMode === 'grid') {
                gridEl.appendChild(card);
            } else {
                // Route to kanban columns based on progress percentage
                if (metrics.actualProgressPercent >= 100 && metrics.statusText === '🏆 Overachieved') {
                    document.getElementById('kanban-col-overachieved').appendChild(card);
                } else if (metrics.actualProgressPercent >= 100) {
                    document.getElementById('kanban-col-completed').appendChild(card);
                } else {
                    document.getElementById('kanban-col-progress').appendChild(card);
                }
            }
        });
    },

    openGoalModal(goal = null) {
        const modal = document.getElementById('goal-modal');
        const form = document.getElementById('goal-form');
        const titleEl = document.getElementById('goal-modal-title');
        const sliderContainer = document.getElementById('manual-slider-container');
        if (!modal || !form) return;

        form.reset();

        const idInput = document.getElementById('goal-id');
        const titleInput = document.getElementById('goal-title-input');
        const descInput = document.getElementById('goal-desc-input');
        const catInput = document.getElementById('goal-category-input');
        const targetInput = document.getElementById('goal-target-val');
        const unitInput = document.getElementById('goal-unit-input');
        const startInput = document.getElementById('goal-start-date');
        const endInput = document.getElementById('goal-end-date');
        const manualCheck = document.getElementById('goal-manual-progress-check');
        const currentSlider = document.getElementById('goal-current-val');
        const currentDisplay = document.getElementById('goal-current-display');

        const nowStr = new Date().toISOString().split('T')[0];
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 90);
        const futureStr = futureDate.toISOString().split('T')[0];

        if (goal) {
            titleEl.textContent = '✏️ Edit Target Goal & Period';
            idInput.value = goal.id;
            titleInput.value = goal.title || '';
            descInput.value = goal.description || '';
            catInput.value = goal.category || 'Career';
            targetInput.value = goal.targetValue || 100;
            unitInput.value = goal.unit || '';
            startInput.value = goal.startDate || nowStr;
            endInput.value = goal.endDate || futureStr;
            manualCheck.checked = !!goal.isManualProgress;
            
            if (manualCheck.checked) {
                sliderContainer.style.display = 'block';
                currentSlider.max = goal.targetValue || 100;
                currentSlider.value = goal.currentValue || 0;
                currentDisplay.textContent = goal.currentValue || 0;
            } else {
                sliderContainer.style.display = 'none';
            }
        } else {
            titleEl.textContent = '🎯 Create Target Goal';
            idInput.value = '';
            startInput.value = nowStr;
            endInput.value = futureStr;
            manualCheck.checked = true;
            sliderContainer.style.display = 'block';
            currentSlider.max = 100;
            currentSlider.value = 0;
            currentDisplay.textContent = '0';
        }

        modal.classList.add('active');
    },

    closeGoalModal() {
        const modal = document.getElementById('goal-modal');
        if (modal) modal.classList.remove('active');
    },

    async saveForm(e) {
        e.preventDefault();
        const idInput = document.getElementById('goal-id');
        const titleInput = document.getElementById('goal-title-input');
        const descInput = document.getElementById('goal-desc-input');
        const catInput = document.getElementById('goal-category-input');
        const targetInput = document.getElementById('goal-target-val');
        const unitInput = document.getElementById('goal-unit-input');
        const startInput = document.getElementById('goal-start-date');
        const endInput = document.getElementById('goal-end-date');
        const manualCheck = document.getElementById('goal-manual-progress-check');
        const currentSlider = document.getElementById('goal-current-val');

        const goalObj = {
            id: idInput.value || undefined,
            title: titleInput.value.trim(),
            description: descInput.value.trim(),
            category: catInput.value,
            targetValue: Number(targetInput.value) || 100,
            unit: unitInput.value.trim() || 'Units',
            startDate: startInput.value,
            endDate: endInput.value,
            isManualProgress: manualCheck.checked,
            currentValue: manualCheck.checked ? Number(currentSlider.value) : 0,
            status: 'In Progress'
        };

        // If existing goal and not manual progress, preserve currentValue
        if (goalObj.id && !goalObj.isManualProgress) {
            const existing = await db.getGoalById(goalObj.id);
            if (existing) goalObj.currentValue = existing.currentValue || 0;
        }

        await db.saveGoal(goalObj);
        GrowthUtils.showToast(goalObj.id ? 'Target goal updated!' : '🎯 Target goal created!', 'emerald');
        this.closeGoalModal();

        await this.render(this.currentFilter);
        if (typeof DashboardComponent !== 'undefined' && DashboardComponent.render) DashboardComponent.render();
        if (typeof TasksComponent !== 'undefined' && TasksComponent.render) TasksComponent.render();
        if (typeof AnalyticsComponent !== 'undefined' && AnalyticsComponent.render) AnalyticsComponent.render();
    }
};
