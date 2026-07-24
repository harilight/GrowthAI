/**
 * GrowthOS API Wrapper (GrowthDB) - Version 3 (SQL)
 * Provides relational client-side database storage via Node.js backend.
 */

class GrowthDatabase {
    constructor() {
        this.baseUrl = 'http://localhost:3000/api';
    }

    async init() {
        console.log("GrowthDB v3 (SQL Backend) initialized.");
        return true;
    }

    async _fetch(endpoint, method = 'GET', body = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        try {
            const res = await fetch(`${this.baseUrl}${endpoint}`, options);
            if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
            return await res.json();
        } catch (e) {
            console.error("Backend request failed:", e);
            throw e;
        }
    }

    // --- GOALS CRUD ---
    async getAllGoals() {
        return this._fetch('/goals');
    }

    async getGoalById(id) {
        return this._fetch(`/goals/${id}`);
    }

    async saveGoal(goal) {
        if (!goal.id) goal.id = 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        goal.updatedAt = new Date().toISOString();
        if (!goal.createdAt) goal.createdAt = goal.updatedAt;
        return this._fetch('/goals', 'POST', goal);
    }

    async deleteGoal(id) {
        const tasks = await this.getAllTasks();
        for (let task of tasks) {
            if (task.goalId === id) {
                task.goalId = '';
                await this.saveTask(task);
            }
        }
        return this._fetch(`/goals/${id}`, 'DELETE');
    }

    // --- TASKS CRUD ---
    async getAllTasks() {
        return this._fetch('/tasks');
    }

    async saveTask(task) {
        if (!task.id) task.id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        if (!task.completedDates) task.completedDates = [];
        task.updatedAt = new Date().toISOString();
        if (!task.createdAt) task.createdAt = task.updatedAt;
        return this._fetch('/tasks', 'POST', task);
    }

    async deleteTask(id) {
        return this._fetch(`/tasks/${id}`, 'DELETE');
    }

    async toggleTaskCompletion(taskId, dateStr) {
        const tasks = await this.getAllTasks();
        const task = tasks.find(t => t.id === taskId);
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
        const entries = await this._fetch('/journal');
        return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async saveJournalEntry(entry) {
        if (!entry.id) entry.id = 'journal_' + Date.now();
        return this._fetch('/journal', 'POST', entry);
    }

    async deleteJournalEntry(id) {
        return this._fetch(`/journal/${id}`, 'DELETE');
    }

    // --- FOCUS SESSIONS CRUD ---
    async getAllSessions() {
        return this._fetch('/sessions');
    }

    async saveSession(session) {
        if (!session.id) session.id = 'session_' + Date.now();
        session.timestamp = new Date().toISOString();
        return this._fetch('/sessions', 'POST', session);
    }

    // --- [NEW] REWARDS & REDEMPTIONS CRUD ---
    async getAllRewards() {
        return this._fetch('/rewards');
    }

    async saveReward(reward) {
        if (!reward.id) reward.id = 'reward_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        if (!reward.createdAt) reward.createdAt = new Date().toISOString();
        return this._fetch('/rewards', 'POST', reward);
    }

    async deleteReward(id) {
        return this._fetch(`/rewards/${id}`, 'DELETE');
    }

    async getAllRedemptions() {
        const redemptions = await this._fetch('/redemptions');
        return redemptions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    async redeemReward(rewardId) {
        const rewards = await this.getAllRewards();
        const reward = rewards.find(r => r.id === rewardId);
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
        await this._fetch('/redemptions', 'POST', redemption);

        return { redemption, newXP, reward };
    }

    // --- SETTINGS & GAMIFICATION STATE ---
    async getSettings() {
        const settingsArr = await this._fetch('/settings');
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
        return this._fetch('/settings', 'POST', { key, value });
    }

    // --- BACKUP & RESTORE ---
    async exportBackup() {
        const goals = await this.getAllGoals();
        const tasks = await this.getAllTasks();
        const journal = await this.getAllJournalEntries();
        const sessions = await this.getAllSessions();
        const rewards = await this.getAllRewards();
        const redemptions = await this.getAllRedemptions();
        const settingsArr = await this._fetch('/settings');

        return {
            version: 3,
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
        for (let rd of redemptions) await this._fetch('/redemptions', 'POST', rd);
        for (let st of settings) await this.updateSetting(st.key, st.value);

        return true;
    }

    async resetDatabase() {
        const tasks = await this.getAllTasks();
        for (let t of tasks) await this.deleteTask(t.id);

        const goals = await this.getAllGoals();
        for (let g of goals) await this.deleteGoal(g.id);

        const journals = await this.getAllJournalEntries();
        for (let j of journals) await this.deleteJournalEntry(j.id);

        const rewards = await this.getAllRewards();
        for (let r of rewards) await this.deleteReward(r.id);

        await this._fetch('/settings', 'DELETE');

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
