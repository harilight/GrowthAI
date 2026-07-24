/**
 * GrowthOS Utilities (utils.js)
 * Handles toast notifications, confetti celebrations, demo data seeding, and CSV/JSON exports.
 */

const GrowthUtils = {
    /**
     * Show animated toast notification
     */
    showToast(message, type = 'cyan') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '⚡';
        if (type === 'emerald') icon = '🎉';
        if (type === 'purple') icon = '✨';
        if (type === 'rose') icon = '⚠️';

        toast.innerHTML = `
            <span style="font-size: 1.35rem;">${icon}</span>
            <div style="font-size: 0.92rem; font-weight: 500;">${message}</div>
        `;

        container.appendChild(toast);

        // Remove after 3.5 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    /**
     * Trigger celebratory confetti
     */
    triggerConfetti() {
        if (typeof confetti !== 'function') return;
        
        confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#06b6d4', '#10b981', '#8b5cf6', '#f59e0b']
        });
    },

    /**
     * Format date nicely (e.g. "Jul 16, 2026")
     */
    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    /**
     * Export JSON Backup File
     */
    downloadJSONBackup(backupObj) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `GrowthOS_Backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    },

    /**
     * Export Tasks & Goals as CSV
     */
    downloadCSV(goals = [], tasks = []) {
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Goals Header
        csvContent += "Type,ID,Title,Category,Status,TargetValue,CurrentValue,Unit,StartDate,EndDate\r\n";
        goals.forEach(g => {
            const row = [
                "GOAL",
                g.id,
                `"${(g.title || '').replace(/"/g, '""')}"`,
                g.category,
                g.status || 'In Progress',
                g.targetValue,
                g.currentValue,
                `"${g.unit || ''}"`,
                g.startDate || '',
                g.endDate || ''
            ];
            csvContent += row.join(",") + "\r\n";
        });

        csvContent += "\r\nType,ID,GoalID,Title,Priority,Frequency,XPReward,CompletedDatesCount\r\n";
        tasks.forEach(t => {
            const row = [
                "TASK",
                t.id,
                t.goalId || 'Standalone',
                `"${(t.title || '').replace(/"/g, '""')}"`,
                t.priority,
                t.frequency,
                t.xpReward || 30,
                t.completedDates ? t.completedDates.length : 0
            ];
            csvContent += row.join(",") + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `GrowthOS_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    /**
     * Seed Rich Demo Data for testing accuracy and all visual charts
     */
    async seedDemoData(dbInstance) {
        await dbInstance.resetDatabase();

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Helper to generate past dates
        const getPastDateStr = (daysAgo) => {
            const d = new Date();
            d.setDate(d.getDate() - daysAgo);
            return d.toISOString().split('T')[0];
        };

        const getFutureDateStr = (daysAhead) => {
            const d = new Date();
            d.setDate(d.getDate() + daysAhead);
            return d.toISOString().split('T')[0];
        };

        // 1. Create Sample Goals
        const goal1 = await dbInstance.saveGoal({
            id: 'goal_demo_1',
            title: 'Master Full-Stack & Agentic AI Dev',
            description: 'Build 12 production-ready web apps with AI integration and clean architecture.',
            category: 'Career',
            targetValue: 12,
            currentValue: 7,
            unit: 'Apps Built',
            startDate: getPastDateStr(30),
            endDate: getFutureDateStr(60),
            isManualProgress: true,
            status: 'On Track'
        });

        const goal2 = await dbInstance.saveGoal({
            id: 'goal_demo_2',
            title: 'Sub-50 Min 10km Marathon Pace',
            description: 'Improve cardiovascular endurance and leg stamina through interval speed training.',
            category: 'Health',
            targetValue: 100,
            currentValue: 65,
            unit: 'Kilometers Run',
            startDate: getPastDateStr(20),
            endDate: getFutureDateStr(40),
            isManualProgress: false,
            status: 'On Track'
        });

        const goal3 = await dbInstance.saveGoal({
            id: 'goal_demo_3',
            title: '$15,000 High-Yield Emergency Fund',
            description: 'Consistent monthly automated savings and freelance side income allocation.',
            category: 'Financial',
            targetValue: 15000,
            currentValue: 11200,
            unit: 'USD ($)',
            startDate: getPastDateStr(45),
            endDate: getFutureDateStr(90),
            isManualProgress: true,
            status: 'Ahead'
        });

        const goal4 = await dbInstance.saveGoal({
            id: 'goal_demo_4',
            title: 'Read 24 Non-Fiction & Tech Books',
            description: 'Expand mental models, software design patterns, and philosophy knowledge.',
            category: 'Skills',
            targetValue: 24,
            currentValue: 10,
            unit: 'Books Completed',
            startDate: getPastDateStr(60),
            endDate: getFutureDateStr(120),
            isManualProgress: true,
            status: 'On Track'
        });

        // 2. Create Sample Daily Tasks & Habits
        // We will inject completedDates across the past 25 days to fill the heatmap & charts!
        const sampleCompletedDates1 = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 17, 18, 19, 21, 22, 24].map(getPastDateStr);
        const sampleCompletedDates2 = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25].map(getPastDateStr);
        const sampleCompletedDates3 = [1, 2, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22].map(getPastDateStr);

        await dbInstance.saveTask({
            id: 'task_demo_1',
            goalId: 'goal_demo_1',
            title: 'Complete 2 Hours of Deep Coding & System Architecture',
            priority: 'High',
            frequency: 'Daily',
            xpReward: 50,
            completedDates: sampleCompletedDates1
        });

        await dbInstance.saveTask({
            id: 'task_demo_2',
            goalId: 'goal_demo_2',
            title: 'Run 5km Morning Cardio or Interval Sprints',
            priority: 'High',
            frequency: 'Weekdays',
            xpReward: 50,
            completedDates: sampleCompletedDates2
        });

        await dbInstance.saveTask({
            id: 'task_demo_3',
            goalId: 'goal_demo_4',
            title: 'Read 30 Pages before Sleep & Take Notes',
            priority: 'Medium',
            frequency: 'Daily',
            xpReward: 30,
            completedDates: sampleCompletedDates3
        });

        await dbInstance.saveTask({
            id: 'task_demo_4',
            goalId: 'goal_demo_3',
            title: 'Review Expense Tracker & Log Daily Budget',
            priority: 'Low',
            frequency: 'Daily',
            xpReward: 15,
            completedDates: [0, 2, 4, 6, 8, 10, 12].map(getPastDateStr)
        });

        await dbInstance.saveTask({
            id: 'task_demo_5',
            goalId: '',
            title: '15 Min Mindful Meditation & Breathing Exercises',
            priority: 'Medium',
            frequency: 'Daily',
            xpReward: 30,
            completedDates: [0, 1, 2, 3, 5, 6, 7, 8].map(getPastDateStr)
        });

        // 3. Create Sample Journal Reflections
        await dbInstance.saveJournalEntry({
            id: 'journal_demo_1',
            date: todayStr,
            mood: '🔥 Laser Focused',
            gratitude: '1. Having a clear growth plan.\n2. Completed a major technical refactor.\n3. Excellent workout recovery.',
            reflection: 'When I timeblock my morning specifically for high-priority tasks before checking messages, my daily velocity triples. Keep maintaining this habit.'
        });

        await dbInstance.saveJournalEntry({
            id: 'journal_demo_2',
            date: getPastDateStr(1),
            mood: '😊 Productive',
            gratitude: '1. Great conversation with a mentor.\n2. Hit my 10km run milestone under target pace.\n3. Grateful for discipline.',
            reflection: 'Consistency beats intensity every single time. Small 1% improvements compounding over 30 days have transformed my health and skill level.'
        });

        // 3.5 Create Sample Custom Rewards
        await dbInstance.saveReward({
            id: 'reward_demo_1',
            title: 'Guilt-Free Movie & Pizza Night 🍕',
            description: 'An afternoon/evening off to enjoy movies with zero guilt after completing targets.',
            cost: 200,
            icon: '🎬'
        });

        await dbInstance.saveReward({
            id: 'reward_demo_2',
            title: 'Cheat Meal / Favorite Dessert 🍰',
            description: 'Treat yourself to your favorite dessert or weekend brunch.',
            cost: 300,
            icon: '🍔'
        });

        await dbInstance.saveReward({
            id: 'reward_demo_3',
            title: 'New Tech Book or Udemy Course 📚',
            description: 'Invest in your next skill upgrade with an inspiring book or course.',
            cost: 500,
            icon: '📚'
        });

        await dbInstance.saveReward({
            id: 'reward_demo_4',
            title: 'Mechanical Keyboard / Tech Gadget Fund ⌨️',
            description: 'Unlock your hardware fund milestone after hitting Level 8+.',
            cost: 1000,
            icon: '🎮'
        });

        // 4. Set Gamification State
        const totalXP = (sampleCompletedDates1.length * 50) + 
                        (sampleCompletedDates2.length * 50) + 
                        (sampleCompletedDates3.length * 30) + 
                        (7 * 15) + (8 * 30); // ~2600 XP -> Level 8!

        await dbInstance.updateSetting('xp', totalXP);
        await dbInstance.updateSetting('level', Math.floor(Math.sqrt(totalXP / 50)) + 1);
        await dbInstance.updateSetting('streakDays', 5);
        await dbInstance.updateSetting('checkInHistory', sampleCompletedDates1);

        return true;
    }
};
