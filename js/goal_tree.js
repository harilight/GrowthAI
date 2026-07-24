/**
 * GrowthOS Goal Tree Helpers (goal_tree.js)
 * Cycle detection, ancestor/descendant lookups, and effect application for hierarchical goals.
 */

const GoalTree = {
    MAX_DEPTH: 5,

    // Walk up from goalId following parentGoalId; return array of ancestor ids.
    async getAncestorIds(goalId, allGoals) {
        const byId = new Map(allGoals.map(g => [g.id, g]));
        const ancestors = [];
        let current = byId.get(goalId);
        let guard = 0;
        
        while (current && current.parentGoalId && guard < this.MAX_DEPTH + 1) {
            ancestors.push(current.parentGoalId);
            current = byId.get(current.parentGoalId);
            guard++;
        }
        
        return ancestors;
    },

    // Call before saving goal.parentGoalId = candidateParentId
    async canSetParent(goalId, candidateParentId, allGoals) {
        if (!candidateParentId) return true;
        if (goalId === candidateParentId) return false; // can't be its own parent
        
        const ancestors = await this.getAncestorIds(candidateParentId, allGoals);
        if (ancestors.includes(goalId)) return false; // would create a cycle
        if (ancestors.length + 1 >= this.MAX_DEPTH) return false; // depth guard
        
        return true;
    },

    getChildren(goalId, allGoals) {
        return allGoals.filter(g => g.parentGoalId === (goalId || null));
    },

    getTopLevelGoals(allGoals) {
        return allGoals.filter(g => !g.parentGoalId);
    },

    // Apply or revert task effects on goals
    async applyTaskEffects(task, isCompleting) {
        const sign = isCompleting ? 1 : -1;
        if (!task.effects || task.effects.length === 0) return [];
        
        const touchedGoalIds = [];
        
        for (const effect of task.effects) {
            if (effect.targetType !== 'goal') continue;
            
            const goal = await db.getGoalById(effect.targetId);
            if (!goal) continue;
            
            goal.currentValue = Math.max(0, (Number(goal.currentValue) || 0) + sign * effect.amount);
            await db.saveGoal(goal);
            touchedGoalIds.push(goal.id);
        }
        
        return touchedGoalIds; // caller re-renders just these + their ancestors
    }
};
