/**
 * GrowthOS Core Application Controller (app.js)
 * Initializes IndexedDB, manages tab navigation, sets up global event listeners, and orchestrates components.
 */

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await db.init();
        console.log('GrowthOS Engine initialized.');

        // 1. Check if database is empty upon very first run and offer auto-seed or seed if desired
        const existingGoals = await db.getAllGoals();
        if (existingGoals.length === 0) {
            console.log('No existing goals found. Initializing with default gamification settings.');
        }

        // 2. Initialize Navigation Tabs
        const navItems = document.querySelectorAll('.nav-item');
        const tabViews = document.querySelectorAll('.tab-view');

        navItems.forEach(item => {
            item.addEventListener('click', async () => {
                const targetTab = item.getAttribute('data-tab');

                // Switch active nav class
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // Switch active view class
                tabViews.forEach(view => {
                    if (view.id === `${targetTab}-tab`) {
                        view.classList.add('active');
                    } else {
                        view.classList.remove('active');
                    }
                });

                // Trigger tab-specific renderers
                if (targetTab === 'dashboard') await DashboardComponent.render();
                if (targetTab === 'ai_coach') await AICoachComponent.render();
                if (targetTab === 'goals') await GoalsComponent.render();
                if (targetTab === 'tasks') await TasksComponent.render();
                if (targetTab === 'rewards') await RewardsComponent.render();
                if (targetTab === 'analytics') await AnalyticsComponent.render();
                if (targetTab === 'journal') await JournalComponent.render();
            });
        });

        // 3. Initialize Modals
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
            });
        });

        // Close modal when clicking outside content
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('active');
            });
        });

        // Hook up Forms
        const goalForm = document.getElementById('goal-form');
        if (goalForm) goalForm.addEventListener('submit', (e) => GoalsComponent.saveForm(e));

        const taskForm = document.getElementById('task-form');
        if (taskForm) taskForm.addEventListener('submit', (e) => TasksComponent.saveForm(e));

        const journalForm = document.getElementById('journal-form');
        if (journalForm) journalForm.addEventListener('submit', (e) => JournalComponent.saveForm(e));

        const rewardForm = document.getElementById('reward-form');
        if (rewardForm) rewardForm.addEventListener('submit', (e) => RewardsComponent.saveForm(e));

        // Hook up Goal Manual Progress Checkbox toggle
        const manualCheck = document.getElementById('goal-manual-progress-check');
        const sliderContainer = document.getElementById('manual-slider-container');
        if (manualCheck && sliderContainer) {
            manualCheck.addEventListener('change', () => {
                sliderContainer.style.display = manualCheck.checked ? 'block' : 'none';
            });
        }

        const goalTargetVal = document.getElementById('goal-target-val');
        const goalCurrentSlider = document.getElementById('goal-current-val');
        const goalCurrentDisplay = document.getElementById('goal-current-display');
        if (goalTargetVal && goalCurrentSlider && goalCurrentDisplay) {
            goalTargetVal.addEventListener('input', () => {
                goalCurrentSlider.max = goalTargetVal.value || 100;
            });
            goalCurrentSlider.addEventListener('input', () => {
                goalCurrentDisplay.textContent = goalCurrentSlider.value;
            });
        }

        // 4. Hook up Quick Action Buttons
        const dashAddGoal = document.getElementById('dash-btn-add-goal');
        if (dashAddGoal) dashAddGoal.addEventListener('click', () => GoalsComponent.openGoalModal());

        const dashAddTask = document.getElementById('dash-btn-add-task');
        if (dashAddTask) dashAddTask.addEventListener('click', () => TasksComponent.openTaskModal());

        const goalsAdd = document.getElementById('goals-btn-add');
        if (goalsAdd) goalsAdd.addEventListener('click', () => GoalsComponent.openGoalModal());

        const tasksAdd = document.getElementById('tasks-btn-add');
        if (tasksAdd) tasksAdd.addEventListener('click', () => TasksComponent.openTaskModal());

        const journalAdd = document.getElementById('journal-btn-add');
        if (journalAdd) journalAdd.addEventListener('click', () => JournalComponent.openJournalModal());

        // Goal Category Filters
        document.querySelectorAll('[data-goal-filter]').forEach(btn => {
            btn.addEventListener('click', () => GoalsComponent.render(btn.getAttribute('data-goal-filter')));
        });

        // Task Filters
        document.querySelectorAll('[data-task-filter]').forEach(btn => {
            btn.addEventListener('click', () => TasksComponent.render(btn.getAttribute('data-task-filter'), null));
        });

        const taskGoalDropdown = document.getElementById('task-filter-goal');
        if (taskGoalDropdown) {
            taskGoalDropdown.addEventListener('change', () => {
                TasksComponent.render(null, taskGoalDropdown.value);
            });
        }

        const journalSearchInput = document.getElementById('journal-search');
        if (journalSearchInput) {
            journalSearchInput.addEventListener('input', (e) => JournalComponent.render(e.target.value));
        }

        // 5. Initialize Focus Room
        if (typeof FocusComponent !== 'undefined' && FocusComponent.init) {
            FocusComponent.init();
        }

        // 6. Hook up Database & Settings Actions
        const btnExportJson = document.getElementById('btn-export-json');
        if (btnExportJson) {
            btnExportJson.addEventListener('click', async () => {
                const backup = await db.exportBackup();
                GrowthUtils.downloadJSONBackup(backup);
                GrowthUtils.showToast('📥 Complete database backup exported!', 'cyan');
            });
        }

        const btnImportJson = document.getElementById('btn-import-json');
        if (btnImportJson) {
            btnImportJson.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const backupObj = JSON.parse(event.target.result);
                        await db.importBackup(backupObj);
                        GrowthUtils.showToast('🎉 Database successfully restored from backup!', 'emerald');
                        await DashboardComponent.render();
                    } catch (err) {
                        alert('Could not restore backup file: ' + err.message);
                    }
                };
                reader.readAsText(file);
            });
        }

        const btnExportCsv = document.getElementById('btn-export-csv');
        if (btnExportCsv) {
            btnExportCsv.addEventListener('click', async () => {
                const goals = await db.getAllGoals();
                const tasks = await db.getAllTasks();
                GrowthUtils.downloadCSV(goals, tasks);
                GrowthUtils.showToast('📊 CSV spreadsheet export downloaded!', 'cyan');
            });
        }

        const btnResetDb = document.getElementById('btn-reset-db');
        if (btnResetDb) {
            btnResetDb.addEventListener('click', async () => {
                if (confirm('🚨 Are you sure you want to permanently clear all goals, tasks, and reflections? This cannot be undone!')) {
                    await db.resetDatabase();
                    GrowthUtils.showToast('Database reset to defaults.', 'rose');
                    await DashboardComponent.render();
                }
            });
        }

        const seedDemoHandler = async () => {
            if (confirm('🌱 Load sample Target Goals, Daily Tasks, and 25 days of consistency logs right now? (Existing data will be replaced by demo items)')) {
                await GrowthUtils.seedDemoData(db);
                GrowthUtils.showToast('🌱 Rich demo data loaded! Check out your stats & charts!', 'emerald');
                GrowthUtils.triggerConfetti();
                await DashboardComponent.render();
            }
        };

        const btnSeedSidebar = document.getElementById('btn-seed-data');
        if (btnSeedSidebar) btnSeedSidebar.addEventListener('click', seedDemoHandler);

        const btnSeedSettings = document.getElementById('btn-settings-seed');
        if (btnSeedSettings) btnSeedSettings.addEventListener('click', seedDemoHandler);

        // 7. Initial Dashboard Render
        await DashboardComponent.render();
        GrowthUtils.showToast('✨ GrowthOS Loaded — Ready to accelerate your progress.', 'cyan');

    } catch (err) {
        console.error('Fatal error setting up GrowthOS:', err);
    }
});
