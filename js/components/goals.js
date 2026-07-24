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

        const topLevelGoals = GoalTree.getTopLevelGoals(filteredGoals);
        
        topLevelGoals.forEach(goal => {
            const card = this.renderGoalCard(goal, goals, tasks, 0);
            
            if (this.viewMode === 'grid') {
                gridEl.appendChild(card);
            } else {
                const metrics = GrowthModels.calculateRollupProgress(goal, goals, tasks);
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

    renderGoalCard(goal, allGoals, tasks, level = 0) {
        // Calculate hierarchical rollup metrics for this goal
        const metrics = GrowthModels.calculateRollupProgress(goal, allGoals, tasks);

        let tagClass = 'tag-career';
        if (goal.category === 'Health') tagClass = 'tag-health';
        if (goal.category === 'Financial') tagClass = 'tag-financial';
        if (goal.category === 'Personal') tagClass = 'tag-personal';
        if (goal.category === 'Skills') tagClass = 'tag-skills';

        const card = document.createElement('div');
        card.className = 'goal-card';
        if (level > 0) {
            card.style.marginLeft = `${level * 2}rem`;
            card.style.borderLeft = `4px solid var(--border-color)`;
            card.style.borderRadius = '0 var(--radius-md) var(--radius-md) 0';
        }
        
        const cats = goal.categories && goal.categories.length > 0 ? goal.categories : (goal.category ? [goal.category] : ['Goal']);
        const catString = cats.join(', ');
        
        const children = GoalTree.getChildren(goal.id, allGoals);
        const hasChildren = children.length > 0;
        // Recursive children rendering removed in favor of GoalExplorer modal

        card.innerHTML = `
            <div class="goal-card-top">
                <span class="goal-category-tag ${tagClass}">${catString}</span>
                <div class="goal-actions">
                    <button class="icon-btn btn-add-subgoal" data-goal-id="${goal.id}" title="Add Subgoal">➕</button>
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
                        ${hasChildren ? `Rollup from ${children.length} subgoals` : `Auto-linked to ${metrics.linkedTasksCount} assigned daily task(s)`}
                    </div>
                `}
            </div>
            ${hasChildren ? `
                <button class="btn btn-secondary" style="width: 100%; margin-top: 1rem; border-color: var(--accent-cyan); display: flex; justify-content: space-between; align-items: center;" onclick="GoalExplorer.open('${goal.id}')">
                    <span>Explore ${children.length} Sub-goals</span>
                    <span style="font-size: 1.2rem;">›</span>
                </button>
            ` : ''}
        `;

        // No longer appending children directly to the card

        // Attach slider listener
        const slider = card.querySelector('.goal-manual-slider');
        if (slider) {
            slider.addEventListener('input', async (e) => {
                const newVal = Number(e.target.value);
                goal.currentValue = newVal;
                await db.saveGoal(goal);
                await this.render(this.currentFilter);
                if (typeof DashboardComponent !== 'undefined' && DashboardComponent.render) DashboardComponent.render();
                if (typeof AnalyticsComponent !== 'undefined' && AnalyticsComponent.render) AnalyticsComponent.render();
            });
        }

        // Attach buttons
        const btnAddSub = card.querySelector('.btn-add-subgoal');
        if (btnAddSub) {
            btnAddSub.addEventListener('click', () => this.openGoalModal(null, goal.id));
        }

        const btnEdit = card.querySelector('.btn-edit-goal');
        if (btnEdit) {
            btnEdit.addEventListener('click', () => this.openGoalModal(goal));
        }

        const btnDelete = card.querySelector('.btn-delete-goal');
        if (btnDelete) {
            btnDelete.addEventListener('click', async () => {
                if (await GrowthUtils.confirm(`Are you sure you want to delete goal "${goal.title}"?`, 'Delete Goal', '🗑️')) {
                    await db.deleteGoal(goal.id);
                    GrowthUtils.showToast('Target goal deleted.', 'rose');
                    await this.render(this.currentFilter);
                    if (typeof DashboardComponent !== 'undefined' && DashboardComponent.render) DashboardComponent.render();
                }
            });
        }

        const aiBtn = card.querySelector('.btn-ai-habits');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => {
                if (typeof AICoachComponent !== 'undefined') {
                    AICoachComponent.generateHabitsForGoal(goal.id);
                }
            });
        }
        
        return card;
    },

    openGoalModal(goal = null, parentGoalId = null) {
        const modal = document.getElementById('goal-modal');
        const form = document.getElementById('goal-form');
        const titleEl = document.getElementById('goal-modal-title');
        const sliderContainer = document.getElementById('manual-slider-container');
        if (!modal || !form) return;

        form.reset();
        
        // Stash parentGoalId on the form for saveForm to use
        form.dataset.parentGoalId = parentGoalId || '';

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
            form.dataset.parentGoalId = goal.parentGoalId || '';
            titleInput.value = goal.title || '';
            descInput.value = goal.description || '';
            
            const goalCategories = goal.categories || (goal.category ? [goal.category] : ['Career']);
            document.querySelectorAll('#goal-category-input input[type="checkbox"]').forEach(cb => {
                cb.checked = goalCategories.includes(cb.value);
                if (cb.checked) cb.parentElement.classList.add('selected');
                else cb.parentElement.classList.remove('selected');
            });
            
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
            
            document.querySelectorAll('#goal-category-input input[type="checkbox"]').forEach(cb => {
                cb.checked = (cb.value === 'Career');
                if (cb.checked) cb.parentElement.classList.add('selected');
                else cb.parentElement.classList.remove('selected');
            });
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
        
        const catCheckboxes = document.querySelectorAll('#goal-category-input input[type="checkbox"]:checked');
        const categories = Array.from(catCheckboxes).map(cb => cb.value);
        if (categories.length === 0) categories.push('Career'); // fallback
        
        const targetInput = document.getElementById('goal-target-val');
        const unitInput = document.getElementById('goal-unit-input');
        const startInput = document.getElementById('goal-start-date');
        const endInput = document.getElementById('goal-end-date');
        const manualCheck = document.getElementById('goal-manual-progress-check');
        const currentSlider = document.getElementById('goal-current-val');
        const formEl = document.getElementById('goal-form');
        const parentGoalId = formEl.dataset.parentGoalId || null;

        const goalObj = {
            id: idInput.value || undefined,
            title: titleInput.value.trim(),
            description: descInput.value.trim(),
            categories: categories,
            category: categories[0], // for legacy compat
            targetValue: Number(targetInput.value) || 100,
            unit: unitInput.value.trim() || 'Units',
            startDate: startInput.value,
            endDate: endInput.value,
            isManualProgress: manualCheck.checked,
            currentValue: manualCheck.checked ? Number(currentSlider.value) : 0,
            status: 'In Progress',
            parentGoalId: parentGoalId,
            childWeight: 1
        };

        // Check for cycles before saving
        const allGoals = await db.getAllGoals();
        if (goalObj.id && parentGoalId) {
            const canSet = await GoalTree.canSetParent(goalObj.id, parentGoalId, allGoals);
            if (!canSet) {
                GrowthUtils.showToast('Cannot set this parent goal (would create a cycle or exceed max depth).', 'rose');
                return;
            }
        }

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

const GoalExplorer = {
    navigationStack: [],
    
    async open(goalId) {
        this.navigationStack = [goalId];
        const modal = document.getElementById('goal-explorer-modal');
        modal.style.display = 'flex';
        modal.classList.add('active');
        await this.renderContent('fade');
    },

    close() {
        const modal = document.getElementById('goal-explorer-modal');
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300); // Wait for transition
        this.navigationStack = [];
    },

    async navigateDeeper(childId) {
        this.navigationStack.push(childId);
        await this.renderContent('slide-left');
    },

    async navigateBack() {
        if (this.navigationStack.length > 1) {
            this.navigationStack.pop();
            await this.renderContent('slide-right');
        }
    },

    async renderContent(transitionDirection = 'fade') {
        const slider = document.getElementById('goal-explorer-slider');
        const backBtn = document.getElementById('goal-explorer-back');
        const breadcrumbs = document.getElementById('goal-explorer-breadcrumbs');
        
        if (this.navigationStack.length === 0) return;
        
        const currentGoalId = this.navigationStack[this.navigationStack.length - 1];
        
        const allGoals = await db.getAllGoals();
        const allTasks = await db.getAllTasks();
        const currentGoal = allGoals.find(g => g.id === currentGoalId);
        
        if (!currentGoal) return;
        
        // Setup Header / Breadcrumbs
        if (this.navigationStack.length > 1) {
            backBtn.style.display = 'block';
            backBtn.onclick = () => this.navigateBack();
            const parentGoalId = this.navigationStack[this.navigationStack.length - 2];
            const parentGoal = allGoals.find(g => g.id === parentGoalId);
            breadcrumbs.textContent = `← ${parentGoal ? parentGoal.title : 'Back'}`;
        } else {
            backBtn.style.display = 'none';
            breadcrumbs.textContent = 'Target Goals';
        }

        // Setup Content Container with Animation
        const container = document.createElement('div');
        container.className = `slide-container ${transitionDirection === 'slide-left' ? 'slide-in-right' : (transitionDirection === 'slide-right' ? 'slide-in-left' : '')}`;
        container.style.padding = '1.5rem';

        const metrics = GrowthModels.calculateRollupProgress(currentGoal, allGoals, allTasks);
        const children = GoalTree.getChildren(currentGoal.id, allGoals);

        // Header Section (Context)
        container.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <h2 style="font-size: 1.5rem; color: var(--text-primary); margin: 0;">${currentGoal.title}</h2>
                    <button class="btn btn-secondary btn-sm" onclick="GoalExplorer.close(); db.getGoalById('${currentGoal.id}').then(g => GoalsComponent.openGoalModal(g))" style="padding: 0.25rem 0.5rem;">✏️ Edit</button>
                </div>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">${currentGoal.description || 'No description provided.'}</p>
                <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--glass-border);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-weight: 600; color: var(--text-primary);">Progress</span>
                        <span style="color: var(--accent-cyan); font-weight: 700;">${metrics.actualProgressPercent}%</span>
                    </div>
                    <div class="progress-track" style="margin-bottom: 0;">
                        <div class="progress-fill" style="width: ${metrics.actualProgressPercent}%;"></div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="font-size: 1.1rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Sub-Goals</h3>
                <button class="btn btn-secondary btn-sm" onclick="GoalExplorer.close(); GoalsComponent.openGoalModal(null, '${currentGoal.id}')">➕ Add Sub-Goal</button>
            </div>
            
            <div id="explorer-children-list"></div>
        `;

        const childrenList = container.querySelector('#explorer-children-list');
        
        if (children.length === 0) {
            childrenList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem; border: 1px dashed var(--glass-border); border-radius: var(--radius-md);">
                    No sub-goals yet.
                </div>
            `;
        } else {
            children.forEach(child => {
                const childMetrics = GrowthModels.calculateRollupProgress(child, allGoals, allTasks);
                const grandChildren = GoalTree.getChildren(child.id, allGoals);
                
                const node = document.createElement('div');
                node.className = 'explorer-node';
                node.onclick = () => {
                    this.navigateDeeper(child.id);
                };

                node.innerHTML = `
                    <div style="flex: 1;">
                        <div class="explorer-node-title">
                            ${grandChildren.length > 0 ? '📚' : '🎯'} ${child.title}
                        </div>
                        <div class="explorer-node-meta">
                            Progress: ${childMetrics.actualProgressPercent}% ${grandChildren.length > 0 ? `• ${grandChildren.length} sub-goals` : '• Leaf goal'}
                        </div>
                        <div class="progress-track" style="height: 4px; margin-top: 0.5rem; background: rgba(255,255,255,0.05);">
                            <div class="progress-fill" style="width: ${childMetrics.actualProgressPercent}%;"></div>
                        </div>
                    </div>
                    <div class="explorer-node-arrow">›</div>
                `;
                childrenList.appendChild(node);
            });
        }

        slider.innerHTML = '';
        slider.appendChild(container);
    }
};
