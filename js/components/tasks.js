/**
 * GrowthOS Daily Tasks Controller (tasks.js)
 * Controls daily task assignment, recurring frequency rules, filtering, and completion check-in.
 */

const TasksComponent = {
    currentFilter: 'today',
    currentGoalFilter: '',

    async render(filter = null, goalFilter = null) {
        if (filter !== null) this.currentFilter = filter;
        if (goalFilter !== null) this.currentGoalFilter = goalFilter;

        const tasks = await db.getAllTasks();
        const goals = await db.getAllGoals();
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Update filter buttons UI
        document.querySelectorAll('[data-task-filter]').forEach(btn => {
            if (btn.getAttribute('data-task-filter') === this.currentFilter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 2. Populate goal filter dropdown if empty or out of sync
        const goalSelect = document.getElementById('task-filter-goal');
        if (goalSelect) {
            const currentVal = goalSelect.value;
            goalSelect.innerHTML = `<option value="">-- All Linked Goals --</option>`;
            goals.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = `🎯 ${g.title}`;
                if (g.id === currentVal || g.id === this.currentGoalFilter) opt.selected = true;
                goalSelect.appendChild(opt);
            });
        }

        // 3. Populate Modal Goal Link dropdown
        const modalGoalLink = document.getElementById('task-goal-link');
        if (modalGoalLink && modalGoalLink.options.length <= 1) {
            modalGoalLink.innerHTML = `<option value="">-- No Linked Goal (Standalone) --</option>`;
            goals.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = `🎯 ${g.title}`;
                modalGoalLink.appendChild(opt);
            });
        }

        // 4. Filter tasks
        const listEl = document.getElementById('all-tasks-list');
        if (!listEl) return;

        const filteredTasks = tasks.filter(task => {
            // Goal filter
            if (this.currentGoalFilter && task.goalId !== this.currentGoalFilter) {
                return false;
            }

            // Type/Priority filter
            if (this.currentFilter === 'today') {
                if (task.frequency === 'Daily') return true;
                if (task.frequency === 'Weekdays') {
                    const day = new Date().getDay();
                    return day >= 1 && day <= 5;
                }
                if (task.frequency === 'Weekends') {
                    const day = new Date().getDay();
                    return day === 0 || day === 6;
                }
                return task.dueDate === todayStr;
            }

            if (this.currentFilter === 'High') {
                return task.priority === 'High';
            }

            return true; // 'all'
        });

        if (filteredTasks.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 3.5rem 2rem; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">📝</div>
                    <div style="font-weight: 700; font-size: 1.15rem; color: var(--text-primary);">No Daily Tasks Assigned</div>
                    <p style="font-size: 0.88rem; max-width: 420px; margin: 0.35rem auto 1.25rem;">Assign daily action tasks or recurring habits to drive your target goals and earn XP rewards every day.</p>
                    <button class="btn btn-primary" onclick="TasksComponent.openTaskModal()">➕ Assign First Daily Task</button>
                </div>
            `;
            return;
        }

        listEl.innerHTML = '';

        filteredTasks.forEach(task => {
            const isCompleted = task.completedDates && task.completedDates.includes(todayStr);
            const linkedGoal = goals.find(g => g.id === task.goalId);

            let badgeClass = 'badge-priority-low';
            if (task.priority === 'High') badgeClass = 'badge-priority-high';
            if (task.priority === 'Medium') badgeClass = 'badge-priority-medium';

            const item = document.createElement('div');
            item.className = `task-item ${isCompleted ? 'completed' : ''}`;

            item.innerHTML = `
                <div class="task-left">
                    <div class="custom-checkbox ${isCompleted ? 'checked' : ''}" data-task-id="${task.id}">
                        ${isCompleted ? '✓' : ''}
                    </div>
                    <div class="task-info">
                        <span class="task-title">${task.title}</span>
                        <div class="task-meta">
                            <span class="task-badge ${badgeClass}">${task.priority || 'Normal'}</span>
                            <span>• Frequency: <b>${task.frequency || 'Daily'}</b></span>
                            ${linkedGoal ? `<span style="color: var(--accent-cyan);">• 🎯 Linked to: ${linkedGoal.title}</span>` : '<span>• Standalone Task</span>'}
                        </div>
                    </div>
                </div>
                <div class="task-right">
                    <span class="xp-pill">+${task.xpReward || 30} XP</span>
                    <button class="icon-btn btn-edit-task" data-task-id="${task.id}" title="Edit Task">✏️</button>
                    <button class="icon-btn btn-delete-task" data-task-id="${task.id}" title="Delete Task">🗑️</button>
                </div>
            `;

            const checkbox = item.querySelector('.custom-checkbox');
            if (checkbox) {
                checkbox.addEventListener('click', async () => {
                    await DashboardComponent.handleCheckIn(task.id, todayStr);
                    await this.render(this.currentFilter, this.currentGoalFilter);
                });
            }

            const btnEdit = item.querySelector('.btn-edit-task');
            if (btnEdit) {
                btnEdit.addEventListener('click', () => this.openTaskModal(task));
            }

            const btnDelete = item.querySelector('.btn-delete-task');
            if (btnDelete) {
                btnDelete.addEventListener('click', async () => {
                    if (confirm(`Delete task "${task.title}"?`)) {
                        await db.deleteTask(task.id);
                        GrowthUtils.showToast('Task removed.', 'rose');
                        await this.render(this.currentFilter, this.currentGoalFilter);
                        if (typeof DashboardComponent !== 'undefined' && DashboardComponent.render) DashboardComponent.render();
                    }
                });
            }

            listEl.appendChild(item);
        });
    },

    openTaskModal(task = null) {
        const modal = document.getElementById('task-modal');
        const form = document.getElementById('task-form');
        const titleEl = document.getElementById('task-modal-title');
        if (!modal || !form) return;

        form.reset();
        
        const idInput = document.getElementById('task-id');
        const titleInput = document.getElementById('task-title-input');
        const goalInput = document.getElementById('task-goal-link');
        const priorityInput = document.getElementById('task-priority-input');
        const freqInput = document.getElementById('task-freq-input');
        const dueDateInput = document.getElementById('task-due-date');

        const todayStr = new Date().toISOString().split('T')[0];

        // Ensure goal links dropdown is populated
        this.render();

        if (task) {
            if (titleEl) titleEl.textContent = '✏️ Edit Task';
            idInput.value = task.id;
            titleInput.value = task.title || '';
            goalInput.value = task.goalId || '';
            priorityInput.value = task.priority || 'Medium';
            freqInput.value = task.frequency || 'Daily';
            dueDateInput.value = task.dueDate || todayStr;
        } else {
            if (titleEl) titleEl.textContent = '➕ Assign Daily Task';
            idInput.value = '';
            if (dueDateInput) dueDateInput.value = todayStr;
        }

        modal.classList.add('active');
    },

    closeTaskModal() {
        const modal = document.getElementById('task-modal');
        if (modal) modal.classList.remove('active');
    },

    async saveForm(e) {
        e.preventDefault();
        const idInput = document.getElementById('task-id');
        const titleInput = document.getElementById('task-title-input');
        const goalInput = document.getElementById('task-goal-link');
        const priorityInput = document.getElementById('task-priority-input');
        const freqInput = document.getElementById('task-freq-input');
        const dueDateInput = document.getElementById('task-due-date');

        let xp = 30;
        if (priorityInput.value === 'High') xp = 50;
        if (priorityInput.value === 'Low') xp = 15;

        const taskObj = {
            id: idInput.value || undefined,
            title: titleInput.value.trim(),
            goalId: goalInput.value || '',
            priority: priorityInput.value,
            frequency: freqInput.value,
            xpReward: xp,
            dueDate: dueDateInput.value || new Date().toISOString().split('T')[0]
        };

        if (taskObj.id) {
            const existing = await db._performTx('tasks', 'readonly', s => s.get(taskObj.id));
            if (existing) taskObj.completedDates = existing.completedDates || [];
        }

        await db.saveTask(taskObj);
        GrowthUtils.showToast(taskObj.id ? 'Task updated!' : '📝 Daily task assigned!', 'emerald');
        this.closeTaskModal();

        await this.render(this.currentFilter, this.currentGoalFilter);
        if (typeof DashboardComponent !== 'undefined' && DashboardComponent.render) DashboardComponent.render();
        if (typeof GoalsComponent !== 'undefined' && GoalsComponent.render) GoalsComponent.render();
        if (typeof AnalyticsComponent !== 'undefined' && AnalyticsComponent.render) AnalyticsComponent.render();
    }
};
