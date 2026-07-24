/**
 * GrowthOS Dashboard Controller (dashboard.js)
 * Controls hero statistics, 30-day consistency heatmap, and today's action checklist.
 */

const DashboardComponent = {
    async render() {
        const goals = await db.getAllGoals();
        const tasks = await db.getAllTasks();
        const settings = await db.getSettings();

        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Update Date Display
        const dateEl = document.getElementById('dashboard-date-display');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            }) + " — Stay focused on your target velocity.";
        }

        // 2. Update Hero Stat Counters
        const activeGoalsCount = goals.filter(g => g.status !== 'Completed').length;
        const dashStatGoals = document.getElementById('dash-stat-goals');
        if (dashStatGoals) dashStatGoals.textContent = `${activeGoalsCount} / ${goals.length}`;

        // Today's velocity (% of tasks due today completed)
        const todayTasks = tasks.filter(t => {
            if (t.frequency === 'Daily') return true;
            if (t.frequency === 'Weekdays') {
                const day = new Date().getDay();
                return day >= 1 && day <= 5;
            }
            if (t.frequency === 'Weekends') {
                const day = new Date().getDay();
                return day === 0 || day === 6;
            }
            if (t.dueDate === todayStr) return true;
            return false;
        });

        const todayCompletedCount = todayTasks.filter(t => t.completedDates && t.completedDates.includes(todayStr)).length;
        const velocityPercent = todayTasks.length > 0 
            ? Math.round((todayCompletedCount / todayTasks.length) * 100) 
            : 100;

        const dashStatVelocity = document.getElementById('dash-stat-tasks-done');
        if (dashStatVelocity) dashStatVelocity.textContent = `${velocityPercent}%`;

        // Calculate and update streak & level
        const checkInHistory = settings.checkInHistory || [];
        const currentStreak = GrowthModels.calculateStreak(checkInHistory);
        const dashStatStreak = document.getElementById('dash-stat-streak');
        if (dashStatStreak) dashStatStreak.textContent = `${currentStreak} Days`;

        // Update Sidebar Level & Streak Card
        this.updateSidebarGamification(settings.xp || 0, currentStreak);

        // 3. Render GitHub-Style 30-Day Heatmap
        this.renderHeatmap(tasks);

        // 4. Render Today's Tasks Checklist
        this.renderTodayTasks(todayTasks, todayStr);
    },

    updateSidebarGamification(totalXP, currentStreak) {
        const levelInfo = GrowthModels.calculateLevelInfo(totalXP);

        const sidebarLevel = document.getElementById('sidebar-level');
        const sidebarStreak = document.getElementById('sidebar-streak');
        const sidebarXpBar = document.getElementById('sidebar-xp-bar');
        const sidebarXpCurr = document.getElementById('sidebar-xp-current');
        const sidebarXpNext = document.getElementById('sidebar-xp-next');

        if (sidebarLevel) sidebarLevel.textContent = `⚡ Level ${levelInfo.level}`;
        if (sidebarStreak) sidebarStreak.textContent = `🔥 ${currentStreak} Days`;
        if (sidebarXpBar) sidebarXpBar.style.width = `${levelInfo.progressPercent}%`;
        if (sidebarXpCurr) sidebarXpCurr.textContent = `${levelInfo.xpInCurrentLevel} XP`;
        if (sidebarXpNext) sidebarXpNext.textContent = `Next: ${levelInfo.xpNeededForLevel} XP`;
    },

    renderHeatmap(allTasks) {
        const gridEl = document.getElementById('dash-heatmap-grid');
        if (!gridEl) return;

        const heatmapData = GrowthModels.get30DayHeatmap(allTasks);
        gridEl.innerHTML = '';

        heatmapData.forEach(item => {
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            cell.setAttribute('data-level', item.level);
            cell.title = `${item.formattedDate}: ${item.completions} task${item.completions === 1 ? '' : 's'} completed`;
            gridEl.appendChild(cell);
        });
    },

    renderTodayTasks(todayTasks, todayStr) {
        const listEl = document.getElementById('dash-tasks-list');
        const counterEl = document.getElementById('dash-task-counter');
        if (!listEl) return;

        const remainingCount = todayTasks.filter(t => !(t.completedDates && t.completedDates.includes(todayStr))).length;
        if (counterEl) counterEl.textContent = `${remainingCount} of ${todayTasks.length} remaining today`;

        if (todayTasks.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
                    <div style="font-weight: 600; font-size: 1.05rem;">No action tasks scheduled for today!</div>
                    <p style="font-size: 0.85rem; margin-top: 0.25rem;">Use the quick task button above or check Target Goals to assign new tasks.</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = '';
        
        const renderTaskTree = (tasks, parentId = null, depth = 0, containerEl = listEl) => {
            const children = tasks.filter(t => (t.parentTaskId || null) === parentId);
            children.forEach(task => {
                const isCompleted = task.completedDates && task.completedDates.includes(todayStr);
                const hasChildren = tasks.some(t => t.parentTaskId === task.id);

                const taskItem = document.createElement('div');
                taskItem.className = `task-item ${isCompleted ? 'completed' : ''}`;
                if (depth > 0) {
                    taskItem.style.marginLeft = `${depth * 1.5}rem`;
                    taskItem.style.borderLeft = '2px solid var(--border-color)';
                    taskItem.style.borderBottomLeftRadius = '0';
                    taskItem.style.borderTopLeftRadius = '0';
                }

                let badgeClass = 'badge-priority-low';
                if (task.priority === 'High') badgeClass = 'badge-priority-high';
                if (task.priority === 'Medium') badgeClass = 'badge-priority-medium';

                taskItem.innerHTML = `
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
                                <span class="task-badge ${badgeClass}">${task.priority || 'Normal'} Priority</span>
                                <span>• Frequency: ${task.frequency || 'Daily'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="task-right">
                        <span class="xp-pill">+${task.xpReward || 30} XP</span>
                        <button class="icon-btn btn-add-subtask" data-task-id="${task.id}" title="Add Sub-Task" style="font-size: 0.85rem; padding: 0.2rem 0.5rem; background: var(--glass-bg); border-radius: var(--radius-sm);">➕ Sub-Task</button>
                    </div>
                `;

                const checkbox = taskItem.querySelector('.custom-checkbox');
                if (!hasChildren) {
                    checkbox.addEventListener('click', async () => {
                        await this.handleCheckIn(task.id, todayStr);
                    });
                }

                const btnToggle = taskItem.querySelector('.btn-toggle-subtasks');
                if (btnToggle) {
                    btnToggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const subContainer = document.getElementById(`subtasks-dash-${task.id}`);
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

                const btnAddSubtask = taskItem.querySelector('.btn-add-subtask');
                if (btnAddSubtask) {
                    btnAddSubtask.addEventListener('click', () => {
                        if (typeof TasksComponent !== 'undefined' && TasksComponent.openTaskModal) {
                            TasksComponent.openTaskModal(null, task.id);
                        }
                    });
                }

                containerEl.appendChild(taskItem);
                
                if (hasChildren) {
                    const subContainer = document.createElement('div');
                    subContainer.className = 'subtasks-container';
                    subContainer.id = `subtasks-dash-${task.id}`;
                    subContainer.style.display = 'none'; // Start collapsed
                    containerEl.appendChild(subContainer);
                    
                    // Render children recursively into this container
                    renderTaskTree(tasks, task.id, depth + 1, subContainer);
                }
            });
        };

        renderTaskTree(todayTasks);
    },

    async handleCheckIn(taskId, todayStr) {
        const result = await db.toggleTaskCompletion(taskId, todayStr);
        if (!result) return;

        const { task, completed } = result;
        const settings = await db.getSettings();
        let currentXP = Number(settings.xp || 0);
        let checkInHistory = settings.checkInHistory || [];

        if (completed) {
            const reward = Number(task.xpReward || 30);
            currentXP += reward;
            if (!checkInHistory.includes(todayStr)) {
                checkInHistory.push(todayStr);
            }
            
            // Apply hierarchical task effects
            await GoalTree.applyTaskEffects(task, true);
            
            GrowthUtils.showToast(`🎉 Task completed! +${reward} XP earned!`, 'emerald');
            GrowthUtils.triggerConfetti();
        } else {
            const reward = Number(task.xpReward || 30);
            currentXP = Math.max(0, currentXP - reward);
            
            // Revert hierarchical task effects
            await GoalTree.applyTaskEffects(task, false);
            
            // Exploit Fix: If no tasks are completed today, remove today from history
            const allTasks = await db.getAllTasks();
            const completedTodayCount = allTasks.filter(t => t.completedDates && t.completedDates.includes(todayStr)).length;
            if (completedTodayCount === 0) {
                checkInHistory = checkInHistory.filter(d => d !== todayStr);
            }

            GrowthUtils.showToast(`Task marked uncompleted. -${reward} XP`, 'rose');
        }

        await db.updateSetting('xp', currentXP);
        await db.updateSetting('level', Math.floor(Math.sqrt(currentXP / 50)) + 1);
        await db.updateSetting('checkInHistory', checkInHistory);
        await db.updateSetting('lastCheckInDate', todayStr);
        
        // Auto-Complete Parent Task Logic
        if (task.parentTaskId) {
            const parent = await db.getAllTasks().then(tasks => tasks.find(t => t.id === task.parentTaskId));
            if (parent) {
                const siblings = await db.getChildTasks(parent.id);
                const allCompleted = siblings.every(s => s.completedDates && s.completedDates.includes(todayStr));
                const parentCompleted = parent.completedDates && parent.completedDates.includes(todayStr);
                
                if (allCompleted && !parentCompleted) {
                    await this.handleCheckIn(parent.id, todayStr);
                } else if (!allCompleted && parentCompleted) {
                    await this.handleCheckIn(parent.id, todayStr);
                }
            }
        }

        // Re-render dashboard & keep goals/analytics updated
        await this.render();
        if (typeof AnalyticsComponent !== 'undefined' && AnalyticsComponent.render) {
            AnalyticsComponent.render();
        }
    }
};
