/**
 * GrowthOS IndexedDB Wrapper (GrowthDB) - Version 2
 * Provides 0-latency relational client-side database storage with Promises.
 * V2 adds Rewards Shop (`rewards`) and (`redemptions`) tracking.
 */

class GrowthDatabase {
    constructor() {
        this.dbName = 'GrowthOS_DB';
        this.version = 3; // Upgraded to v3 for Hierarchical Goals/Tasks
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject("Could not open GrowthOS database.");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("GrowthDB v" + this.version + " initialized successfully.");
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. Goals Store
                if (!db.objectStoreNames.contains('goals')) {
                    const goalsStore = db.createObjectStore('goals', { keyPath: 'id' });
                    goalsStore.createIndex('category', 'category', { unique: false });
                    goalsStore.createIndex('status', 'status', { unique: false });
                    goalsStore.createIndex('parentGoalId', 'parentGoalId', { unique: false });
                } else {
                    const goalsStore = event.target.transaction.objectStore('goals');
                    if (!goalsStore.indexNames.contains('parentGoalId')) {
                        goalsStore.createIndex('parentGoalId', 'parentGoalId', { unique: false });
                    }
                }

                // 2. Tasks Store
                if (!db.objectStoreNames.contains('tasks')) {
                    const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
                    tasksStore.createIndex('goalId', 'goalId', { unique: false });
                    tasksStore.createIndex('priority', 'priority', { unique: false });
                    tasksStore.createIndex('parentTaskId', 'parentTaskId', { unique: false });
                } else {
                    const tasksStore = event.target.transaction.objectStore('tasks');
                    if (!tasksStore.indexNames.contains('parentTaskId')) {
                        tasksStore.createIndex('parentTaskId', 'parentTaskId', { unique: false });
                    }
                }

                // 3. Journal Store
                if (!db.objectStoreNames.contains('journal')) {
                    const journalStore = db.createObjectStore('journal', { keyPath: 'id' });
                    journalStore.createIndex('date', 'date', { unique: false });
                }

                // 4. Focus Sessions Store
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
                    sessionsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // 5. Settings / Gamification State Store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // 6. [V2 NEW] Rewards Shop Store
                if (!db.objectStoreNames.contains('rewards')) {
                    const rewardsStore = db.createObjectStore('rewards', { keyPath: 'id' });
                    rewardsStore.createIndex('cost', 'cost', { unique: false });
                }

                // 7. [V2 NEW] Redemptions Log Store
                if (!db.objectStoreNames.contains('redemptions')) {
                    const redemptionsStore = db.createObjectStore('redemptions', { keyPath: 'id' });
                    redemptionsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // Generic Transaction Helper
    async _performTx(storeName, mode, callback) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const req = callback(store);

            tx.oncomplete = () => resolve(req ? req.result : true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // --- GOALS CRUD ---
    async getAllGoals() {
        return this._performTx('goals', 'readonly', (store) => store.getAll());
    }

    async getGoalById(id) {
        return this._performTx('goals', 'readonly', (store) => store.get(id));
    }

    async getChildGoals(parentGoalId) {
        return this._performTx('goals', 'readonly', (store) => 
            store.index('parentGoalId').getAll(parentGoalId || null)
        );
    }

    async saveGoal(goal) {
        if (!goal.id) goal.id = 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        goal.updatedAt = new Date().toISOString();
        if (!goal.createdAt) goal.createdAt = goal.updatedAt;
        await this._performTx('goals', 'readwrite', (store) => store.put(goal));
        return goal;
    }

    async deleteGoal(id) {
        // 1. Unlink tasks that reference this goal
        const tasks = await this.getAllTasks();
        for (let task of tasks) {
            let taskModified = false;
            if (task.goalId === id) {
                task.goalId = '';
                taskModified = true;
            }
            if (task.effects && Array.isArray(task.effects)) {
                const initialLength = task.effects.length;
                task.effects = task.effects.filter(e => e.targetId !== id);
                if (task.effects.length !== initialLength) taskModified = true;
            }
            if (taskModified) {
                await this.saveTask(task);
            }
        }

        // 2. Find all descendants recursively
        const allGoals = await this.getAllGoals();
        const getDescendants = (goalId) => {
            let descendants = [];
            const children = allGoals.filter(g => g.parentGoalId === goalId);
            children.forEach(child => {
                descendants.push(child.id);
                descendants = descendants.concat(getDescendants(child.id));
            });
            return descendants;
        };
        const idsToDelete = [id, ...getDescendants(id)];

        // 3. Delete all descendants and the goal itself
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('goals', 'readwrite');
            const store = tx.objectStore('goals');
            idsToDelete.forEach(deleteId => store.delete(deleteId));
            
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // --- TASKS CRUD ---
    async getAllTasks() {
        return this._performTx('tasks', 'readonly', (store) => store.getAll());
    }

    async getChildTasks(parentTaskId) {
        return this._performTx('tasks', 'readonly', (store) => 
            store.index('parentTaskId').getAll(parentTaskId || null)
        );
    }

    async saveTask(task) {
        if (!task.id) task.id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        if (!task.completedDates) task.completedDates = [];
        task.updatedAt = new Date().toISOString();
        if (!task.createdAt) task.createdAt = task.updatedAt;
        await this._performTx('tasks', 'readwrite', (store) => store.put(task));
        return task;
    }

    async deleteTask(id) {
        const allTasks = await this.getAllTasks();
        
        const getDescendants = (parentId) => {
            let descendants = [];
            const children = allTasks.filter(t => t.parentTaskId === parentId);
            children.forEach(child => {
                descendants.push(child.id);
                descendants = descendants.concat(getDescendants(child.id));
            });
            return descendants;
        };
        const idsToDelete = [id, ...getDescendants(id)];

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('tasks', 'readwrite');
            const store = tx.objectStore('tasks');
            idsToDelete.forEach(deleteId => store.delete(deleteId));
            
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async toggleTaskCompletion(taskId, dateStr) {
        const task = await this._performTx('tasks', 'readonly', (store) => store.get(taskId));
        if (!task) return null;

        if (!task.completedDates) task.completedDates = [];
        const idx = task.completedDates.indexOf(dateStr);
        let completed = false;
        if (idx > -1) {
            task.completedDates.splice(idx, 1);
            completed = false;
        } else {
            task.completedDates.push(dateStr);
            completed = true;
        }
        
        await this.saveTask(task);
        return { task, completed };
    }

    // --- JOURNAL CRUD ---
    async getAllJournalEntries() {
        const entries = await this._performTx('journal', 'readonly', (store) => store.getAll());
        return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async saveJournalEntry(entry) {
        if (!entry.id) entry.id = 'journal_' + Date.now();
        await this._performTx('journal', 'readwrite', (store) => store.put(entry));
        return entry;
    }

    async deleteJournalEntry(id) {
        return this._performTx('journal', 'readwrite', (store) => store.delete(id));
    }

    // --- FOCUS SESSIONS CRUD ---
    async getAllSessions() {
        return this._performTx('sessions', 'readonly', (store) => store.getAll());
    }

    async saveSession(session) {
        if (!session.id) session.id = 'session_' + Date.now();
        session.timestamp = new Date().toISOString();
        await this._performTx('sessions', 'readwrite', (store) => store.put(session));
        return session;
    }

    // --- [NEW] REWARDS & REDEMPTIONS CRUD ---
    async getAllRewards() {
        return this._performTx('rewards', 'readonly', (store) => store.getAll());
    }

    async saveReward(reward) {
        if (!reward.id) reward.id = 'reward_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        if (!reward.createdAt) reward.createdAt = new Date().toISOString();
        await this._performTx('rewards', 'readwrite', (store) => store.put(reward));
        return reward;
    }

    async deleteReward(id) {
        return this._performTx('rewards', 'readwrite', (store) => store.delete(id));
    }

    async getAllRedemptions() {
        const redemptions = await this._performTx('redemptions', 'readonly', (store) => store.getAll());
        return redemptions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    async redeemReward(rewardId) {
        const reward = await this._performTx('rewards', 'readonly', (store) => store.get(rewardId));
        if (!reward) throw new Error("Reward not found.");

        const settings = await this.getSettings();
        const currentXP = Number(settings.xp || 0);
        const cost = Number(reward.cost || 100);

        if (currentXP < cost) {
            throw new Error(`Insufficient XP! You have ${currentXP} XP, but need ${cost} XP.`);
        }

        // Deduct XP
        const newXP = currentXP - cost;
        await this.updateSetting('xp', newXP);
        await this.updateSetting('level', Math.floor(Math.sqrt(newXP / 50)) + 1);

        // Record redemption log
        const redemption = {
            id: 'redemption_' + Date.now(),
            rewardId: reward.id,
            title: reward.title,
            cost: cost,
            icon: reward.icon || '🎁',
            timestamp: new Date().toISOString()
        };
        await this._performTx('redemptions', 'readwrite', (store) => store.put(redemption));

        return { redemption, newXP, reward };
    }

    // --- SETTINGS & GAMIFICATION STATE ---
    async getSettings() {
        const settingsArr = await this._performTx('settings', 'readonly', (store) => store.getAll());
        const settingsMap = {};
        settingsArr.forEach(s => settingsMap[s.key] = s.value);

        if (settingsMap.xp === undefined) settingsMap.xp = 0;
        if (settingsMap.level === undefined) settingsMap.level = 1;
        if (settingsMap.streakDays === undefined) settingsMap.streakDays = 0;
        if (settingsMap.lastCheckInDate === undefined) settingsMap.lastCheckInDate = null;
        if (settingsMap.checkInHistory === undefined) settingsMap.checkInHistory = [];
        if (settingsMap.aiApiKey === undefined) settingsMap.aiApiKey = '';
        if (settingsMap.aiProvider === undefined) settingsMap.aiProvider = 'local';

        return settingsMap;
    }

    async updateSetting(key, value) {
        return this._performTx('settings', 'readwrite', (store) => store.put({ key, value }));
    }

    // --- BACKUP & RESTORE ---
    async exportBackup() {
        const goals = await this.getAllGoals();
        const tasks = await this.getAllTasks();
        const journal = await this.getAllJournalEntries();
        const sessions = await this.getAllSessions();
        const rewards = await this.getAllRewards();
        const redemptions = await this.getAllRedemptions();
        const settingsArr = await this._performTx('settings', 'readonly', (store) => store.getAll());

        return {
            version: this.version,
            exportDate: new Date().toISOString(),
            data: {
                goals,
                tasks,
                journal,
                sessions,
                rewards,
                redemptions,
                settings: settingsArr
            }
        };
    }

    async importBackup(backupObj) {
        if (!backupObj || !backupObj.data) throw new Error("Invalid backup file format.");
        
        await this.resetDatabase();

        const { goals = [], tasks = [], journal = [], sessions = [], rewards = [], redemptions = [], settings = [] } = backupObj.data;

        for (let g of goals) await this.saveGoal(g);
        for (let t of tasks) await this.saveTask(t);
        for (let j of journal) await this.saveJournalEntry(j);
        for (let s of sessions) await this.saveSession(s);
        for (let r of rewards) await this.saveReward(r);
        for (let rd of redemptions) await this._performTx('redemptions', 'readwrite', (store) => store.put(rd));
        for (let st of settings) await this.updateSetting(st.key, st.value);

        return true;
    }

    async resetDatabase() {
        const storeNames = ['goals', 'tasks', 'journal', 'sessions', 'rewards', 'redemptions', 'settings'];
        for (let name of storeNames) {
            try {
                await this._performTx(name, 'readwrite', (store) => store.clear());
            } catch (e) {
                console.log(`Store ${name} might not exist yet during reset:`, e);
            }
        }
        await this.updateSetting('xp', 0);
        await this.updateSetting('level', 1);
        await this.updateSetting('streakDays', 0);
        await this.updateSetting('lastCheckInDate', null);
        await this.updateSetting('checkInHistory', []);
        await this.updateSetting('aiApiKey', '');
        await this.updateSetting('aiProvider', 'local');
        return true;
    }
}

const db = new GrowthDatabase();
