/**
 * GrowthOS Business Logic & Calculations (models.js)
 * Handles goal progress, velocity forecasting, deadline status, gamification XP, and streaks.
 */

const GrowthModels = {
    /**
     * Calculate comprehensive goal status and required daily pace.
     */
    calculateGoalMetrics(goal, allTasks = []) {
        const now = new Date();
        const start = new Date(goal.startDate || goal.createdAt || now);
        const end = new Date(goal.endDate || now);
        
        // Time calculations
        const totalDurationDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        const daysElapsed = Math.max(0, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
        const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
        
        const timeProgressPercent = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDurationDays) * 100)));

        // Linked tasks
        const linkedTasks = allTasks.filter(t => t.goalId === goal.id);
        
        // Progress percentage calculation
        let actualProgressPercent = 0;
        let currentValue = Number(goal.currentValue || 0);
        const targetValue = Number(goal.targetValue || 100);

        if (goal.isManualProgress) {
            actualProgressPercent = Math.round((currentValue / targetValue) * 100);
        } else if (linkedTasks.length > 0) {
            // Calculate progress based on linked task completion
            let totalCompletedCheckins = 0;
            linkedTasks.forEach(t => {
                totalCompletedCheckins += (t.completedDates ? t.completedDates.length : 0);
            });
            // If tasks are daily/recurring, compare completed check-ins to expected check-ins
            const expectedCheckins = Math.max(1, linkedTasks.length * Math.min(daysElapsed, totalDurationDays));
            actualProgressPercent = Math.round((totalCompletedCheckins / expectedCheckins) * 100);
            currentValue = Math.round((actualProgressPercent / 100) * targetValue);
        } else {
            actualProgressPercent = Math.round((currentValue / targetValue) * 100);
        }
        
        let isOverachieved = actualProgressPercent > 100;
        actualProgressPercent = Math.min(100, Math.max(0, actualProgressPercent));

        // Status analysis
        let status = 'In Progress';
        let statusClass = 'status-ontrack';
        let statusText = '🟢 On Track';

        if (isOverachieved) {
            status = 'Overachieved';
            statusClass = 'status-completed';
            statusText = '🏆 Overachieved!';
        } else if (actualProgressPercent >= 100) {
            status = 'Completed';
            statusClass = 'status-completed';
            statusText = '🎉 Completed';
        } else if (daysRemaining <= 0 && actualProgressPercent < 100) {
            status = 'Overdue';
            statusClass = 'status-behind';
            statusText = '🔴 Overdue / Missed';
        } else if (timeProgressPercent - actualProgressPercent > 15) {
            status = 'Behind';
            statusClass = 'status-behind';
            statusText = '⚠️ Needs Attention';
        } else if (actualProgressPercent - timeProgressPercent > 10) {
            status = 'Ahead';
            statusClass = 'status-ontrack';
            statusText = '🚀 Ahead of Schedule';
        }

        // Required velocity calculator
        const remainingValue = Math.max(0, targetValue - currentValue);
        const requiredDailyVelocity = daysRemaining > 0 
            ? (remainingValue / daysRemaining).toFixed(1) 
            : remainingValue;

        return {
            currentValue,
            targetValue,
            actualProgressPercent,
            timeProgressPercent,
            daysElapsed,
            daysRemaining,
            totalDurationDays,
            status,
            statusClass,
            statusText,
            requiredDailyVelocity,
            linkedTasksCount: linkedTasks.length
        };
    },

    /**
     * Gamification: Level & XP logic
     */
    calculateLevelInfo(totalXP = 0) {
        // Level progression: level = floor(sqrt(XP / 50)) + 1
        const level = Math.floor(Math.sqrt(totalXP / 50)) + 1;
        
        // XP required for current level start
        const prevLevel = level - 1;
        const currentLevelStartXP = prevLevel * prevLevel * 50;
        const nextLevelStartXP = level * level * 50;
        
        const xpInCurrentLevel = totalXP - currentLevelStartXP;
        const xpNeededForLevel = nextLevelStartXP - currentLevelStartXP;
        const progressPercent = Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / xpNeededForLevel) * 100)));

        return {
            level,
            totalXP,
            xpInCurrentLevel,
            xpNeededForLevel,
            nextLevelStartXP,
            progressPercent
        };
    },

    /**
     * Streak calculations
     */
    calculateStreak(checkInHistory = []) {
        if (!checkInHistory || checkInHistory.length === 0) return 0;
        
        // Sort dates descending
        const sortedDates = [...new Set(checkInHistory)].sort().reverse();
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Check if checked in today or yesterday
        let streak = 0;
        let currentDate = new Date(todayStr);
        
        // If today is not in history, check if yesterday is in history (to allow continuing streak today)
        const latestDate = sortedDates[0];
        const todayDate = new Date(todayStr);
        const latestDateObj = new Date(latestDate);
        const diffDays = Math.round((todayDate - latestDateObj) / (1000 * 60 * 60 * 24));

        if (diffDays > 1) {
            // Streak broken
            return 0;
        }

        // Count consecutive days backwards
        let checkDateStr = diffDays === 0 ? todayStr : latestDate;
        let d = new Date(checkDateStr);

        for (let idx = 0; idx < sortedDates.length; idx++) {
            const expectedStr = d.toISOString().split('T')[0];
            if (sortedDates.includes(expectedStr)) {
                streak++;
                d.setDate(d.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    },

    /**
     * Generate 30-day activity heatmap data
     */
    get30DayHeatmap(allTasks = []) {
        const heatmap = [];
        const today = new Date();

        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            // Count completions on this date across all tasks
            let completions = 0;
            allTasks.forEach(t => {
                if (t.completedDates && t.completedDates.includes(dateStr)) {
                    completions++;
                }
            });

            // Determine level (0 to 4)
            let level = 0;
            if (completions === 1) level = 1;
            else if (completions === 2) level = 2;
            else if (completions === 3) level = 3;
            else if (completions >= 4) level = 4;

            heatmap.push({
                date: dateStr,
                completions,
                level,
                formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            });
        }

        return heatmap;
    },

    /**
     * Category distribution for Analytics Radar/Donut
     */
    getCategoryDistribution(goals = [], tasks = []) {
        const categories = ['Career', 'Health', 'Financial', 'Personal', 'Skills'];
        const counts = { Career: 0, Health: 0, Financial: 0, Personal: 0, Skills: 0 };
        const xpDistribution = { Career: 0, Health: 0, Financial: 0, Personal: 0, Skills: 0 };

        goals.forEach(g => {
            if (counts[g.category] !== undefined) {
                counts[g.category]++;
            }
        });

        tasks.forEach(t => {
            if (t.goalId) {
                const goal = goals.find(g => g.id === t.goalId);
                if (goal && xpDistribution[goal.category] !== undefined) {
                    const completedCount = t.completedDates ? t.completedDates.length : 0;
                    xpDistribution[goal.category] += (t.xpReward || 30) * completedCount;
                }
            }
        });

        return {
            labels: categories,
            goalCounts: categories.map(c => counts[c]),
            xpEarned: categories.map(c => xpDistribution[c])
        };
    }
};
