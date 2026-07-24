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

        // 3. (Removed modal population from here, moved to openTaskModal)

        // 4. Filter tasks
        const listEl = document.getElementById('all-tasks-list');
        if (!listEl) return;

        const filteredTasks = tasks.filter(task => {
            // Goal filter
            if (this.currentGoalFilter && (!task.goalIds || !task.goalIds.includes(this.currentGoalFilter))) {
                if (task.goalId !== this.currentGoalFilter) return false;
            }

            // Type/Priority filter
            if (this.currentFilter === 'today') {
                if (task.frequency === 'Daily') return true;
                
                const taskDateParts = task.dueDate.split('-');
                const taskDay = parseInt(taskDateParts[2], 10);
                const taskMonth = parseInt(taskDateParts[1], 10) - 1; // JS months are 0-indexed
                
                const today = new Date();
                
                if (task.frequency === 'Monthly') {
                    // Same day of the month
                    return taskDay === today.getDate();
                }
                
                if (task.frequency === 'Yearly') {
                    // Same day and month
                    return taskDay === today.getDate() && taskMonth === today.getMonth();
                }

                if (task.frequency === 'OneTime') {
                    return task.dueDate === todayStr;
                }

                // Legacy fallback
                if (task.frequency === 'Weekdays') {
                    const day = today.getDay();
                    return day >= 1 && day <= 5;
                }
                if (task.frequency === 'Weekends') {
                    const day = today.getDay();
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

        listEl.innerHTML = '';

        const renderTaskTree = (tasks, parentId = null, depth = 0, containerEl = listEl) => {
            const children = tasks.filter(t => (t.parentTaskId || null) === parentId);
            
            children.forEach(task => {
                const isCompleted = task.completedDates && task.completedDates.includes(todayStr);
                const gIds = task.goalIds || (task.goalId ? [task.goalId] : []);
                const linkedGoalsCount = gIds.length;
                const hasChildren = tasks.some(t => t.parentTaskId === task.id);
                
                let linkedText = '<span>• Standalone Task</span>';
                if (linkedGoalsCount === 1) {
                    const linkedGoal = goals.find(g => g.id === gIds[0]);
                    if (linkedGoal) linkedText = `<span style="color: var(--accent-cyan);">• 🎯 Linked to: ${linkedGoal.title}</span>`;
                } else if (linkedGoalsCount > 1) {
                    linkedText = `<span style="color: var(--accent-cyan);">• 🎯 Linked to ${linkedGoalsCount} Goals</span>`;
                }

                let badgeClass = 'badge-priority-low';
                if (task.priority === 'High') badgeClass = 'badge-priority-high';
                if (task.priority === 'Medium') badgeClass = 'badge-priority-medium';

                const item = document.createElement('div');
                item.className = `task-item ${isCompleted ? 'completed' : ''}`;
                if (depth > 0) {
                    item.style.marginLeft = `${depth * 1.5}rem`;
                    item.style.borderLeft = '2px solid var(--border-color)';
                    item.style.borderBottomLeftRadius = '0';
                    item.style.borderTopLeftRadius = '0';
                }

                item.innerHTML = `
                    <div class="task-left">
                        <div class="custom-checkbox ${isCompleted ? 'checked' : ''}" data-task-id="${task.id}" style="${hasChildren ? 'opacity: 0.5; pointer-events: none;' : ''}" title="${hasChildren ? 'Auto-completes when sub-tasks are done' : 'Complete task'}">
                            ${isCompleted ? '✓' : ''}
                        </div>
                        <div class="task-info">
                            <span class="task-title" style="display: flex; align-items: center; gap: 0.5rem;">
                                ${task.title}
                                ${hasChildren ? `<button class="icon-btn btn-toggle-subtasks" data-task-id="${task.id}" title="Toggle Sub-Tasks" style="font-size: 0.75rem; padding: 0.1rem 0.3rem;">🔽</button>` : ''}
                            </span>
                            <div class="task-meta">
                                <span class="task-badge ${badgeClass}">${task.priority || 'Normal'}</span>
                                <span>• Frequency: <b>${task.frequency || 'Daily'}</b></span>
                                ${task.dueTime ? `<span>• ⏰ ${task.dueTime}</span>` : ''}
                                ${linkedText}
                            </div>
                        </div>
                    </div>
                    <div class="task-right">
                        <span class="xp-pill">+${task.xpReward || 30} XP</span>
                        <button class="icon-btn btn-add-subtask" data-task-id="${task.id}" title="Add Sub-Task">➕</button>
                        <button class="icon-btn btn-edit-task" data-task-id="${task.id}" title="Edit Task">✏️</button>
                        <button class="icon-btn btn-delete-task" data-task-id="${task.id}" title="Delete Task">🗑️</button>
                    </div>
                `;

                const checkbox = item.querySelector('.custom-checkbox');
                if (checkbox && !hasChildren) {
                    checkbox.addEventListener('click', async () => {
                        await DashboardComponent.handleCheckIn(task.id, todayStr);
                        await this.render(this.currentFilter, this.currentGoalFilter);
                    });
                }

                const btnToggle = item.querySelector('.btn-toggle-subtasks');
                if (btnToggle) {
                    btnToggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const subContainer = document.getElementById(`subtasks-tasks-${task.id}`);
                        if (subContainer) {
                            if (subContainer.style.display === 'none') {
                                subContainer.style.display = 'block';
                                btnToggle.textContent = '🔼';
                            } else {
                                subContainer.style.display = 'none';
                                btnToggle.textContent = '🔽';
                            }
                        }
                    });
                }
                
                const btnAddSub = item.querySelector('.btn-add-subtask');
                if (btnAddSub) {
                    btnAddSub.addEventListener('click', () => this.openTaskModal(null, task.id));
                }

                const btnEdit = item.querySelector('.btn-edit-task');
                if (btnEdit) {
                    btnEdit.addEventListener('click', () => this.openTaskModal(task));
                }

                const btnDelete = item.querySelector('.btn-delete-task');
                if (btnDelete) {
                    btnDelete.addEventListener('click', async () => {
                        if (await GrowthUtils.confirm(`Delete task "${task.title}" and any sub-tasks?`, 'Delete Task', '🗑️')) {
                            await db.deleteTask(task.id);
                            GrowthUtils.showToast('Task removed.', 'rose');
                            await this.render(this.currentFilter, this.currentGoalFilter);
                            if (typeof DashboardComponent !== 'undefined' && DashboardComponent.render) DashboardComponent.render();
                        }
                    });
                }

                containerEl.appendChild(item);
                
                if (hasChildren) {
                    const subContainer = document.createElement('div');
                    subContainer.className = 'subtasks-container';
                    subContainer.id = `subtasks-tasks-${task.id}`;
                    subContainer.style.display = 'none'; // Start collapsed
                    containerEl.appendChild(subContainer);
                    
                    // Recursively render children into this container
                    renderTaskTree(tasks, task.id, depth + 1, subContainer);
                }
            });
        };
        
        renderTaskTree(filteredTasks);
    },

    async openTaskModal(task = null, parentId = null) {
        const modal = document.getElementById('task-modal');
        const titleEl = document.getElementById('task-modal-title');
        const idInput = document.getElementById('task-id');
        const parentIdInput = document.getElementById('task-parent-id');
        const titleInput = document.getElementById('task-title-input');
        const priorityInput = document.getElementById('task-priority-input');
        const freqInput = document.getElementById('task-freq-input');
        const dueDateInput = document.getElementById('task-date-input');
        const dueTimeInput = document.getElementById('task-time-input');

        const todayStr = new Date().toISOString().split('T')[0];

        // Fetch goals and populate modal
        const allGoals = await db.getAllGoals();
        
        // Filter out orphaned goals (whose parents were deleted previously)
        const isGoalValid = (g) => {
            if (!g.parentGoalId) return true;
            const parent = allGoals.find(p => p.id === g.parentGoalId);
            if (!parent) return false;
            return isGoalValid(parent); // recursively check all the way to top
        };
        const goals = allGoals.filter(isGoalValid);

        const effectsContainer = document.getElementById('task-effects-container');
        
        if (effectsContainer) {
            effectsContainer.innerHTML = '';
            goals.forEach(g => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.justifyContent = 'space-between';
                row.style.marginBottom = '0.5rem';
                
                const existingEffect = task && task.effects ? task.effects.find(e => e.targetId === g.id) : null;
                const isChecked = !!existingEffect;
                const amount = existingEffect ? existingEffect.amount : 30;

                row.innerHTML = `
                    <label style="display: flex; align-items: center; gap: 0.5rem; flex: 1; cursor: pointer; color: var(--text-primary); font-size: 0.9rem;">
                        <input type="checkbox" class="effect-checkbox" value="${g.id}" ${isChecked ? 'checked' : ''}>
                        <span>🎯 ${g.title}</span>
                    </label>
                    <div class="effect-amount-container" style="display: ${isChecked ? 'flex' : 'none'}; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">Amount:</span>
                        <input type="number" class="effect-amount" value="${amount}" min="1" style="width: 70px; padding: 0.25rem; font-size: 0.9rem;">
                    </div>
                `;

                const checkbox = row.querySelector('.effect-checkbox');
                const amtContainer = row.querySelector('.effect-amount-container');
                checkbox.addEventListener('change', () => {
                    amtContainer.style.display = checkbox.checked ? 'flex' : 'none';
                });

                effectsContainer.appendChild(row);
            });
        }

        if (task) {
            if (titleEl) titleEl.textContent = '✏️ Edit Task';
            idInput.value = task.id;
            if (parentIdInput) parentIdInput.value = task.parentTaskId || '';
            titleInput.value = task.title || '';
            priorityInput.value = task.priority || 'Medium';
            freqInput.value = task.frequency || 'Daily';
            dueDateInput.value = task.dueDate || todayStr;
            dueTimeInput.value = task.dueTime || '';
            
            // Legacy compat logic removed for cleaner tree handling
        } else {
            if (titleEl) titleEl.textContent = parentId ? '➕ Assign Sub-Task' : '➕ Assign Daily Task';
            idInput.value = '';
            if (parentIdInput) parentIdInput.value = parentId || '';
            if (dueDateInput) dueDateInput.value = todayStr;
            if (dueTimeInput) dueTimeInput.value = '';
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
        const parentIdInput = document.getElementById('task-parent-id');
        const titleInput = document.getElementById('task-title-input');
        const priorityInput = document.getElementById('task-priority-input');
        const freqInput = document.getElementById('task-freq-input');
        const dueDateInput = document.getElementById('task-date-input');
        const dueTimeInput = document.getElementById('task-time-input');
        
        const checkedBoxes = document.querySelectorAll('#task-effects-container .effect-checkbox:checked');
        const effects = Array.from(checkedBoxes).map(cb => {
            const amountInput = cb.closest('div').querySelector('.effect-amount');
            return {
                targetType: 'goal',
                targetId: cb.value,
                amount: Number(amountInput.value) || 30
            };
        });

        let xp = 30;
        if (priorityInput.value === 'High') xp = 50;
        if (priorityInput.value === 'Low') xp = 15;

        const taskObj = {
            id: idInput.value || undefined,
            title: titleInput.value.trim(),
            effects: effects,
            goalIds: effects.map(e => e.targetId), // for legacy filter compat
            priority: priorityInput.value,
            frequency: freqInput.value,
            xpReward: xp,
            dueDate: dueDateInput.value || new Date().toISOString().split('T')[0],
            dueTime: dueTimeInput.value || '',
            parentTaskId: parentIdInput && parentIdInput.value ? parentIdInput.value : null
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
