/**
 * GrowthOS AI Growth Coach Controller (ai_coach.js)
 * Hybrid Intelligence Engine: Smart local statistical heuristic coach + optional Gemini/OpenAI API key integration.
 * Features: Markdown formatting, unified deficit & velocity analysis, dynamic chat responses, periodic proactive check-ins.
 */

const AICoachComponent = {
    async render() {
        const goals = await db.getAllGoals();
        const tasks = await db.getAllTasks();
        const journal = await db.getAllJournalEntries();
        const settings = await db.getSettings();

        // Update API Status badge
        const badgeEl = document.getElementById('ai-provider-badge');
        if (badgeEl) {
            if (settings.aiApiKey && settings.aiApiKey.trim().length > 5) {
                badgeEl.textContent = `⚡ LLM Enabled (${settings.aiProvider || 'Gemini'})`;
                badgeEl.className = 'period-status status-ontrack';
            } else {
                badgeEl.textContent = '🧠 Local Heuristic AI Engine (Offline Engine)';
                badgeEl.className = 'period-status status-ontrack';
            }
        }

        // Run local heuristic diagnosis
        const diagnosis = this.runLocalAnalysis(goals, tasks, journal, settings);
        this.renderDiagnosisCards(diagnosis);

        // Run Periodic / Proactive Executive Check-in
        if (settings.aiPeriodicSync !== false) {
            await this.runProactiveCheckIn();
        }
    },

    formatMarkdown(text) {
        if (!text) return '';
        return text
            // Bold text (**bold** -> strong)
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff; font-weight: 700;">$1</strong>')
            // Italic text (*italic* -> em)
            .replace(/\*(.*?)\*/g, '<em style="color: var(--accent-cyan);">$1</em>')
            // Inline code (`code` -> code)
            .replace(/`([^`]+)`/g, '<code style="background: rgba(255, 255, 255, 0.12); padding: 0.15rem 0.45rem; border-radius: 4px; font-family: monospace; font-size: 0.88em; color: var(--accent-emerald);">$1</code>')
            // Bullet points (- item or * item at start of line)
            .replace(/^[•\-\*]\s+(.*)$/gm, '<div style="display: flex; gap: 0.5rem; margin: 0.35rem 0;"><span style="color: var(--accent-cyan);">•</span><span>$1</span></div>')
            // Numbered lists (1. item at start of line)
            .replace(/^(\d+)\.\s+(.*)$/gm, '<div style="display: flex; gap: 0.5rem; margin: 0.4rem 0;"><span style="color: var(--accent-purple); font-weight: 700; min-width: 1.2rem;">$1.</span><span>$2</span></div>');
    },

    runLocalAnalysis(goals, tasks, journal, settings) {
        // 1. Goal Velocity Deficit Analysis
        let behindGoal = null;
        let maxDeficit = -1;
        let topGoal = null;
        let maxProgress = -1;

        goals.forEach(g => {
            const m = GrowthModels.calculateGoalMetrics(g, tasks);
            const deficit = m.timeProgressPercent - m.actualProgressPercent;
            // A goal is considered behind if actual progress lags behind elapsed time or if it's marked overdue/behind
            if ((deficit > 0 || m.statusClass !== 'status-ontrack') && m.status !== 'Completed') {
                if (deficit > maxDeficit) {
                    maxDeficit = deficit;
                    behindGoal = { goal: g, metrics: m, deficit: Math.max(1, deficit) };
                }
            }
            if (m.actualProgressPercent > maxProgress) {
                maxProgress = m.actualProgressPercent;
                topGoal = { goal: g, metrics: m };
            }
        });

        // 2. Journal & Mood Correlation Analysis
        let recentMoods = journal.slice(0, 5).map(j => j.mood || 'Productive');
        let hasLowEnergy = recentMoods.some(m => m.toLowerCase().includes('tired') || m.toLowerCase().includes('stressed') || m.toLowerCase().includes('blocked') || m.toLowerCase().includes('overwhelmed'));

        // 3. Task Completion Velocity
        const todayStr = new Date().toISOString().split('T')[0];
        const completedToday = tasks.filter(t => t.completedDates && t.completedDates.includes(todayStr)).length;
        const totalActiveTasks = tasks.length;

        return {
            behindGoal,
            topGoal,
            hasLowEnergy,
            completedToday,
            totalActiveTasks,
            streakDays: GrowthModels.calculateStreak(settings.checkInHistory),
            xp: settings.xp || 0,
            goals,
            tasks
        };
    },

    renderDiagnosisCards(diagnosis) {
        const container = document.getElementById('ai-diagnosis-container');
        if (!container) return;

        let strategyTitle = '🚀 Accelerate Your Top Priority';
        let strategyText = 'All target goals are pacing well or waiting for initial data. Focus on checking off your daily action tasks today!';
        let strategyColor = 'var(--accent-cyan)';

        if (diagnosis.behindGoal) {
            const bg = diagnosis.behindGoal;
            strategyTitle = `⚠️ Velocity Deficit Alert: "${bg.goal.title}"`;
            strategyText = `You are currently **${Math.round(bg.deficit)}% behind target pace** for **${bg.goal.title}**. With **${bg.metrics.daysRemaining} days remaining**, your required daily velocity has increased to **${bg.metrics.requiredDailyVelocity} ${bg.goal.unit || 'units'}/day**.\n\n**Action Strategy**: Dedicate your first 25-minute Deep Work block today exclusively to this target. Complete at least 2 linked daily tasks before noon to eliminate the pacing deficit.`;
            strategyColor = 'var(--accent-rose)';
        } else if (diagnosis.topGoal) {
            strategyTitle = `🔥 Momentum Champion: "${diagnosis.topGoal.goal.title}"`;
            strategyText = `You are leading with **${diagnosis.topGoal.metrics.actualProgressPercent}% progress** on **${diagnosis.topGoal.goal.title}**! You are pacing ahead of schedule with a **${diagnosis.streakDays}-day streak** across your OS.\n\n**Action Strategy**: Leverage this high momentum by tackling one challenging daily task you've been postponing in your other categories.`;
        }

        let mindsetTitle = '🧘 Root-Cause & Mindset Diagnosis';
        let mindsetText = 'Your recent reflection logs show strong focus and consistent execution. Keep logging your daily gratitude streak to maintain mental clarity and high morale.';
        if (diagnosis.hasLowEnergy) {
            mindsetTitle = '⚡ Energy Management Diagnosis';
            mindsetText = 'Your recent journal logs indicate elevated cognitive friction or fatigue. When cognitive load is high, willpower drops sharply.\n\n**Recommendation**: Switch to **Ultradian Micro-Sprints** (15 minutes of hyper-focus followed by 5 minutes of rest). Lower your standalone task volume today by 20% to protect your consistency streak without burnout.';
        }

        container.innerHTML = `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-left: 4px solid ${strategyColor}; border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem;">
                <div style="font-weight: 700; font-size: 1.05rem; color: #ffffff; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span>${strategyTitle}</span>
                </div>
                <div style="font-size: 0.92rem; color: var(--text-secondary); line-height: 1.6;">${this.formatMarkdown(strategyText)}</div>
            </div>

            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-left: 4px solid var(--accent-purple); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem;">
                <div style="font-weight: 700; font-size: 1.05rem; color: #ffffff; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span>${mindsetTitle}</span>
                </div>
                <div style="font-size: 0.92rem; color: var(--text-secondary); line-height: 1.6;">${this.formatMarkdown(mindsetText)}</div>
            </div>

            <div style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.25); border-radius: var(--radius-md); padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--accent-emerald);">🎯 Today's Execution Checklist</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">You have completed **${diagnosis.completedToday}** out of **${diagnosis.totalActiveTasks}** daily habits today.</div>
                </div>
                <button class="btn btn-emerald btn-sm" onclick="document.querySelector('[data-tab=dashboard]').click()">✓ Go to Today's Tasks</button>
            </div>
        `;
    },

    async askCoach(promptText) {
        if (!promptText || !promptText.trim()) return;

        const responseBox = document.getElementById('ai-chat-response');
        if (!responseBox) return;

        responseBox.style.display = 'block';
        responseBox.innerHTML = `<div style="color: var(--accent-cyan); font-weight: 600;">🤖 AI Coach is evaluating your live dashboard metrics & trajectory...</div>`;

        const settings = await db.getSettings();
        const goals = await db.getAllGoals();
        const tasks = await db.getAllTasks();
        const journal = await db.getAllJournalEntries();

        // Check if user has LLM API key configured
        if (settings.aiApiKey && settings.aiApiKey.trim().length > 5) {
            try {
                const llmReply = await this.callLLM(promptText, settings.aiApiKey, settings.aiProvider || 'gemini', goals, tasks);
                responseBox.innerHTML = `
                    <div style="font-weight: 700; color: var(--accent-purple); margin-bottom: 0.5rem; font-size: 1rem;">⚡ AI Executive Response (${settings.aiProvider || 'Gemini'}):</div>
                    <div style="line-height: 1.6; color: var(--text-primary); font-size: 0.92rem;">${this.formatMarkdown(llmReply)}</div>
                `;
                return;
            } catch (err) {
                console.error("LLM API error:", err);
                responseBox.innerHTML = `<div style="color: var(--accent-rose); font-size: 0.85rem; margin-bottom: 0.5rem;">Note: LLM API call encountered an issue (${err.message}). Using Smart Local Heuristic Engine:</div>`;
            }
        }

        // Local Heuristic AI Chat Response
        setTimeout(() => {
            const reply = this.generateLocalChatReply(promptText, goals, tasks, journal, settings);
            responseBox.innerHTML = `
                <div style="font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.6rem; font-size: 1rem;">🧠 Local AI Coach Strategy:</div>
                <div style="line-height: 1.6; color: var(--text-primary); font-size: 0.92rem;">${this.formatMarkdown(reply)}</div>
            `;
        }, 450);
    },

    generateLocalChatReply(prompt, goals, tasks, journal, settings) {
        const q = prompt.trim().toLowerCase();
        
        // 1. Handle Greetings / Short Check-ins (hi, hello, hey, hiii, sup, yo, good morning, etc.)
        const greetings = ['hi', 'hello', 'hey', 'hiii', 'hiiii', 'sup', 'yo', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings'];
        if (greetings.includes(q) || q.length <= 3) {
            let behindSummary = '';
            const behindGoals = goals.filter(g => {
                const m = GrowthModels.calculateGoalMetrics(g, tasks);
                return (m.timeProgressPercent - m.actualProgressPercent > 0 || m.statusClass !== 'status-ontrack') && m.status !== 'Completed';
            });

            if (behindGoals.length > 0) {
                const bg = behindGoals[0];
                const bm = GrowthModels.calculateGoalMetrics(bg, tasks);
                behindSummary = `You have **${goals.length} Active Target Goal(s)**. Attention needed on: **${bg.title}** (Currently **${bm.actualProgressPercent}% progress** vs ${bm.timeProgressPercent}% time elapsed, **${bm.daysRemaining} days remaining**).`;
            } else if (goals.length > 0) {
                behindSummary = `You are tracking **${goals.length} Target Goal(s)** and **${tasks.length} Daily Habit(s)**—and all your active targets are currently pacing on schedule!`;
            } else {
                behindSummary = `You currently have **0 Target Goals** configured. Head over to the Target Goals tab to create your first milestone!`;
            }

            const currentStreak = GrowthModels.calculateStreak(settings.checkInHistory);
            return `Hey there! 👋 I am your GrowthOS AI Executive Coach.\n\n**Current Instance Status**:\n• ${behindSummary}\n• Consistency Streak: **${currentStreak} Days** (Level ${settings.level || 1}, ${settings.xp || 0} XP)\n\n**How can I assist your execution right now?**\n1. Ask *"How do I speed up [Goal Name]?"* for custom required velocity math.\n2. Ask *"How do I protect my streak?"* for habit stacking strategies.\n3. Ask *"Run my daily check-in"* for a full execution breakdown.`;
        }

        // 2. Check if prompt specifically mentions any Goal Title or Category
        const matchedGoal = goals.find(g => 
            q.includes(g.title.toLowerCase()) || 
            q.includes(g.category.toLowerCase()) || 
            g.title.toLowerCase().split(' ').some(word => word.length > 3 && q.includes(word))
        );

        if (matchedGoal) {
            const m = GrowthModels.calculateGoalMetrics(matchedGoal, tasks);
            const deficit = Math.max(0, m.timeProgressPercent - m.actualProgressPercent);
            const linkedCount = tasks.filter(t => t.goalId === matchedGoal.id).length;

            return `**Strategic Analysis for "${matchedGoal.title}" (${matchedGoal.category})**:\n` +
                   `• **Current Progress**: **${m.actualProgressPercent}%** completed (Target: **${matchedGoal.targetValue} ${matchedGoal.unit || 'units'}**)\n` +
                   `• **Time Elapsed**: **${m.timeProgressPercent}%** (${m.daysRemaining} days remaining until ${matchedGoal.endDate})\n` +
                   `• **Required Daily Velocity**: **${m.requiredDailyVelocity} ${matchedGoal.unit || 'units'}/day** to cross the finish line on time.\n` +
                   `• **Linked Daily Habits**: **${linkedCount} task(s)** assigned.\n\n` +
                   `**3-Step Execution Plan for "${matchedGoal.title}"**:\n` +
                   `1. **Daily Target Anchor**: Commit to completing exactly **${m.requiredDailyVelocity} ${matchedGoal.unit || 'units'}** every single day without exception.\n` +
                   `2. **Deep Work Flow**: Schedule a dedicated 50-minute Pomodoro block in the **Focus Room** specifically for this goal during your peak morning focus hours.\n` +
                   `3. **Habit Coupling**: Make sure your ${linkedCount} linked task(s) are set to High Priority so you earn **+50 XP** for every completion!`;
        }

        // 3. Handle Status / Check-in / How am I doing queries
        if (q.includes('status') || q.includes('how am i') || q.includes('update') || q.includes('checkin') || q.includes('check in') || q.includes('progress') || q.includes('help') || q.includes('what should i do')) {
            let behindCount = 0;
            let ontrackCount = 0;
            goals.forEach(g => {
                const m = GrowthModels.calculateGoalMetrics(g, tasks);
                if ((m.timeProgressPercent - m.actualProgressPercent > 0 || m.statusClass !== 'status-ontrack') && m.status !== 'Completed') {
                    behindCount++;
                } else {
                    ontrackCount++;
                }
            });

            const todayStr = new Date().toISOString().split('T')[0];
            const completedToday = tasks.filter(t => t.completedDates && t.completedDates.includes(todayStr)).length;

            const currentStreak = GrowthModels.calculateStreak(settings.checkInHistory);
            return `**Executive Dashboard Diagnosis**:\n` +
                   `• **Goal Portfolio**: **${ontrackCount} target(s) on track**, **${behindCount} target(s) requiring velocity boost**.\n` +
                   `• **Today's Habit Execution**: **${completedToday} / ${tasks.length}** daily action tasks completed today.\n` +
                   `• **Consistency Engine**: **${currentStreak}-Day Streak** (Level ${settings.level || 1}, ${settings.xp || 0} XP).\n\n` +
                   `**Coach's Immediate Directive**:\n` +
                   `1. **Eliminate Deficits First**: Prioritize any target goal pacing behind schedule before starting low-priority tasks.\n` +
                   `2. **Check Off Daily Tasks**: Click **Go to Today's Tasks** to finish remaining daily habits and lock in your daily streak.\n` +
                   `3. **Log Reflection**: Visit the **Growth Journal** tonight to record lessons learned (+25 XP).`;
        }

        // 4. Handle Speed / Fast / Behind / Deadline queries
        if (q.includes('fast') || q.includes('speed') || q.includes('behind') || q.includes('deadline') || q.includes('late') || q.includes('accelerate')) {
            const behind = goals.find(g => {
                const m = GrowthModels.calculateGoalMetrics(g, tasks);
                return (m.timeProgressPercent - m.actualProgressPercent > 0 || m.statusClass !== 'status-ontrack') && m.status !== 'Completed';
            });
            if (behind) {
                const m = GrowthModels.calculateGoalMetrics(behind, tasks);
                return `To recover "**${behind.title}**" before your deadline (${behind.endDate}):\n` +
                       `1. **Boost Daily Velocity**: Increase your execution to **${m.requiredDailyVelocity} ${behind.unit || 'units'}/day** immediately.\n` +
                       `2. **Link High-Priority Habits**: Create 2 recurring High-Priority tasks specifically linked to this target goal.\n` +
                       `3. **Morning Sprint**: Schedule a 50-minute Deep Work sprint first thing every morning until progress reaches **${m.timeProgressPercent}%**.`;
            }
            return `To accelerate your target velocity across active goals:\n` +
                   `1. **Eliminate Standalone Clutter**: Remove low-priority unlinked tasks that drain your morning mental energy.\n` +
                   `2. **Apply the Pomodoro 50/10 Rule**: 50 minutes of single-tasking flow in the **Focus Room** followed by 10 minutes of physical reset.\n` +
                   `3. **Monitor Burn-Down**: Check your Velocity Burn-Down chart in the Analytics Hub daily to catch deficits within 48 hours.`;
        }

        // 5. Handle Habit / Streak / Consistency queries
        if (q.includes('streak') || q.includes('habit') || q.includes('routine') || q.includes('consistent')) {
            const currentStreak = GrowthModels.calculateStreak(settings.checkInHistory);
            return `You are currently maintaining a **${currentStreak}-day check-in streak** across your GrowthOS instance!\n\n` +
                   `**How to Protect and Scale Your Consistency**:\n` +
                   `1. **The 2-Minute Rule**: On high-stress or low-energy days, execute just 2 minutes of your daily habit. Keeping the streak alive builds permanent neural pathways.\n` +
                   `2. **Habit Stacking**: Attach your hardest daily action step immediately after an anchored existing habit (like morning coffee or logging into your workstation).\n` +
                   `3. **Reward Reinforcement**: Visit the **Rewards Shop** tab to cash in your **${settings.xp || 0} XP** on personal rewards when you cross major streak milestones!`;
        }

        // 6. Handle Reward / XP / Level queries
        if (q.includes('reward') || q.includes('xp') || q.includes('level') || q.includes('shop') || q.includes('points')) {
            return `You currently have **${settings.xp || 0} XP** and are sitting at **Level ${settings.level || 1}**.\n\n` +
                   `**How to Maximize Your XP Engine**:\n` +
                   `1. **Assign High Priority (+50 XP)** to urgent daily tasks needing immediate turnaround.\n` +
                   `2. **Complete Pomodoros (+50 XP)** by running 25-minute or 50-minute blocks in the **Focus Room**.\n` +
                   `3. **Daily Reflection (+25 XP)** by logging your gratitude and bottlenecks in the **Growth Journal** every evening.\n` +
                   `4. **Spend Your XP**: Head to the **Rewards Shop** to set custom real-life rewards (` + "`🎬 Movie Night`" + `, ` + "`🍔 Cheat Meal`" + `) so your brain gets dopamine for completing real work!`;
        }

        // 7. Default Holistic Strategic Advice
        const activeGoalsCount = goals.length;
        const activeTasksCount = tasks.length;
        return `Analyzing your GrowthOS instance (**${activeGoalsCount} Target Goal(s)**, **${activeTasksCount} Daily Habit(s)**, **Level ${settings.level || 1}**)...\n\n` +
               `**Strategic Action Blueprint for "${prompt}"**:\n` +
               `1. **Numerical Clarity**: Ensure every target goal has exact numerical target values ($ / hours / reps) and a firm deadline.\n` +
               `2. **Task Alignment**: Make sure every daily task is directly linked (` + "`🎯 Linked Goal`" + `) rather than standalone busywork.\n` +
               `3. **Daily Reflection**: Use the **Growth Journal** to spot exact bottlenecks every evening before rest.`;
    },

    async callLLM(prompt, apiKey, provider, goals, tasks, rawMode = false) {
        let finalPrompt = prompt;

        if (!rawMode) {
            // Build clean context summary
            const activeGoals = goals.filter(g => g.status !== 'Completed').slice(0, 10);
            const summary = activeGoals.map(g => {
                const m = GrowthModels.calculateGoalMetrics(g, tasks);
                return `Goal: "${g.title}" (${g.category}) -> Progress: ${m.actualProgressPercent}% (Target: ${g.targetValue} ${g.unit || ''}, Days Left: ${m.daysRemaining})`;
            }).join('\\n');

            // Optimize token usage for journal context
            let journalContext = '';
            if (typeof journal !== 'undefined' && journal && journal.length > 0) {
                const recentJournal = journal.slice(0, 5); // Only send last 5 days
                journalContext = '\\nRecent Mindset: ' + recentJournal.map(j => `[${j.date}] Mood: ${j.mood} - ${j.reflection.substring(0, 100)}...`).join('; ');
            }

            finalPrompt = `You are an elite personal growth executive coach. You are analyzing the user's GrowthOS dashboard:\n${summary}${journalContext}\n\nUser Question: "${prompt}"\nProvide a punchy, hyper-actionable, structured 3-step strategy formatted cleanly in Markdown with bold key terms and actionable bullet points. Keep it under 250 words.`;
        }

        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: finalPrompt }]
                })
            });
            if (!res.ok) throw new Error('OpenAI HTTP error ' + res.status);
            const data = await res.json();
            return data.choices[0].message.content;
        } else if (provider === 'groq') {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [{ role: 'user', content: finalPrompt }]
                })
            });
            if (!res.ok) throw new Error('Groq HTTP error ' + res.status);
            const data = await res.json();
            return data.choices[0].message.content;
        } else {
            // Gemini API
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: finalPrompt }] }]
                })
            });
            if (!res.ok) throw new Error('Gemini HTTP error ' + res.status);
            const data = await res.json();
            return data.candidates[0].content.parts[0].text;
        }
    },

    async runProactiveCheckIn() {
        const resultBox = document.getElementById('proactive-checkin-result');
        if (!resultBox) return;

        resultBox.style.display = 'block';
        resultBox.innerHTML = `<div style="color: var(--accent-cyan); font-weight: 600;">🤖 AI Executive Coach is evaluating your active targets and daily velocity...</div>`;

        const settings = await db.getSettings();
        const goals = await db.getAllGoals();
        const tasks = await db.getAllTasks();
        const journal = await db.getAllJournalEntries();

        // Check if API key is present
        if (settings.aiApiKey && settings.aiApiKey.trim().length > 5) {
            try {
                const prompt = `Perform a comprehensive, periodic executive check-in on my overall growth velocity across my ${goals.length} active target goals, ${tasks.length} daily habits, and recent journal entries. Identify any velocity bottlenecks, calculate pacing risk, and give me a 3-step prioritized action plan for today.`;
                const llmReply = await this.callLLM(prompt, settings.aiApiKey, settings.aiProvider || 'gemini', goals, tasks);
                resultBox.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
                        <span style="font-weight: 700; color: #ffffff; font-size: 1.05rem;">⚡ Proactive Executive Assessment (${settings.aiProvider || 'Gemini'} Live Sync)</span>
                        <span class="period-status status-ontrack" style="font-size: 0.75rem;">Sync Complete: ${new Date().toLocaleTimeString()}</span>
                    </div>
                    <div style="line-height: 1.6; color: var(--text-primary); font-size: 0.92rem;">${this.formatMarkdown(llmReply)}</div>
                `;
                return;
            } catch (err) {
                console.error("Proactive LLM check-in error:", err);
                resultBox.innerHTML = `<div style="color: var(--accent-rose); font-size: 0.85rem; margin-bottom: 0.5rem;">Note: Periodic LLM sync failed (${err.message}). Using Smart Local Heuristic Executive Summary:</div>`;
            }
        } else {
            // Prompt user if no key, but still run rich offline heuristic check-in
            resultBox.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
                    <span style="font-weight: 700; color: var(--accent-cyan); font-size: 1.05rem;">🧠 Local Heuristic Executive Check-In</span>
                    <button class="btn btn-purple btn-sm" onclick="AICoachComponent.openSettingsModal()">⚡ Configure API Key for Live LLM Check-ins</button>
                </div>
            `;
        }

        // Unified offline / fallback evaluation exactly aligned with diagnosis cards
        let behindCount = 0;
        let ontrackCount = 0;
        let mostBehindGoal = null;
        let maxDef = -1;

        goals.forEach(g => {
            const m = GrowthModels.calculateGoalMetrics(g, tasks);
            const deficit = m.timeProgressPercent - m.actualProgressPercent;
            if ((deficit > 0 || m.statusClass !== 'status-ontrack') && m.status !== 'Completed') {
                behindCount++;
                if (deficit > maxDef) {
                    maxDef = deficit;
                    mostBehindGoal = { goal: g, metrics: m, deficit };
                }
            } else {
                ontrackCount++;
            }
        });

        const recentMoods = journal.slice(-3).map(j => j.mood).filter(Boolean);
        let summaryText = `**Periodic Growth Snapshot (${new Date().toLocaleDateString()})**:\n`;
        summaryText += `• **Target Goal Health**: **${ontrackCount} target(s) pacing on schedule**, **${behindCount} target(s) experiencing a velocity deficit**.\n`;
        if (mostBehindGoal) {
            summaryText += `• **Primary Bottleneck**: **${mostBehindGoal.goal.title}** is currently **${Math.round(mostBehindGoal.deficit)}% behind pace** (${mostBehindGoal.metrics.daysRemaining} days remaining).\n`;
        }
        
        const currentStreak = GrowthModels.calculateStreak(settings.checkInHistory);
        summaryText += `• **Habit System**: Maintaining a **${currentStreak}-day check-in streak** across **${tasks.length} active daily tasks**.\n`;
        if (recentMoods.length > 0) {
            summaryText += `• **Recent Mindset Trend**: ${recentMoods.join(' → ')}.\n\n`;
        } else {
            summaryText += `• **Recent Mindset Trend**: No recent journal entries. Log today's reflection (+25 XP) to unlock mood trend correlations.\n\n`;
        }

        summaryText += `**Coach's Priority Directive for Next 24 Hours**:\n`;
        if (behindCount > 0 && mostBehindGoal) {
            summaryText += `1. **Focus 80% Energy on ${mostBehindGoal.goal.title}**: Dedicate a 50-minute deep work block to close your **${Math.round(mostBehindGoal.deficit)}% deficit** today.\n` +
                           `2. **Check Off Linked Tasks**: Complete at least 2 daily tasks linked to this target before noon.\n` +
                           `3. **Eliminate Standalone Distractions**: Do not begin low-priority standalone tasks until your main deficit is cleared.`;
        } else {
            summaryText += `1. **Maintain Steady Execution**: Your target burn-down velocity is healthy across all active goals today!\n` +
                           `2. **Deep Work Flow**: Run a 50-minute block in the **Focus Room** to get ahead of schedule for next week.\n` +
                           `3. **Celebrate Milestones**: Review the **Rewards Shop** and claim a personal reward to reinforce your streak!`;
        }

        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = "line-height: 1.6; color: var(--text-primary); font-size: 0.92rem; margin-top: 0.5rem;";
        contentDiv.innerHTML = this.formatMarkdown(summaryText);
        resultBox.appendChild(contentDiv);
    },

    openSettingsModal() {
        const modal = document.getElementById('ai-settings-modal');
        const form = document.getElementById('ai-settings-form');
        if (!modal || !form) return;

        db.getSettings().then(settings => {
            document.getElementById('ai-api-key-input').value = settings.aiApiKey || '';
            document.getElementById('ai-provider-input').value = settings.aiProvider || 'gemini';
            const periodicCheck = document.getElementById('ai-periodic-sync-check');
            if (periodicCheck) periodicCheck.checked = settings.aiPeriodicSync !== false;
            modal.classList.add('active');
        });
    },

    closeSettingsModal() {
        const modal = document.getElementById('ai-settings-modal');
        if (modal) modal.classList.remove('active');
    },

    async saveSettings(e) {
        e.preventDefault();
        const apiKey = document.getElementById('ai-api-key-input').value.trim();
        const provider = document.getElementById('ai-provider-input').value;
        const periodicCheck = document.getElementById('ai-periodic-sync-check');
        const isPeriodic = periodicCheck ? periodicCheck.checked : true;

        await db.updateSetting('aiApiKey', apiKey);
        await db.updateSetting('aiProvider', provider);
        await db.updateSetting('aiPeriodicSync', isPeriodic);

        GrowthUtils.showToast('🤖 AI Coach Settings & Periodic Check-in Saved!', 'cyan');
        this.closeSettingsModal();
        await this.render();
        
        if (apiKey.length > 5 && isPeriodic) {
            await this.runProactiveCheckIn();
        }
    },

    async generateHabitsForGoal(goalId) {
        const goal = await db.getGoalById(goalId);
        if (!goal) return;
        
        const settings = await db.getSettings();
        const apiKey = settings.aiApiKey;
        const provider = settings.aiProvider || 'gemini';

        if (!apiKey || apiKey.trim().length < 5) {
            GrowthUtils.showToast('Please configure your AI API Key in the Coach tab to auto-generate habits.', 'rose');
            this.openSettingsModal();
            return;
        }

        GrowthUtils.showToast(`✨ Generating daily habits for: ${goal.title}...`, 'cyan');

        const prompt = `Act as an elite productivity behavioral coach. The user wants to achieve this target goal:
Title: ${goal.title}
Category: ${goal.category}
Description: ${goal.description || 'No description'}
Target: ${goal.targetValue} ${goal.unit}
Deadline: ${goal.endDate}

Based on behavioral psychology (like Atomic Habits), give me EXACTLY 3 micro-habits the user should do DAILY to effortlessly reach this goal. 
Format your response as a raw JSON array of 3 strings (no markdown blocks, no code fences, just the raw array).
Example: ["Read 5 pages of documentation", "Write 20 lines of code", "Review pull requests for 10 minutes"]`;

        try {
            const resultText = await this.callLLM(prompt, apiKey, provider, [], [], true);
            
            let habits = [];
            const match = resultText.match(/\[[\s\S]*\]/);
            if (match) {
                const cleanJson = match[0].trim();
                habits = JSON.parse(cleanJson);
            } else {
                throw new Error("No JSON array found in response");
            }
            
            if (Array.isArray(habits)) {
                for (let i = 0; i < habits.length; i++) {
                    const habitTitle = habits[i];
                    await db.saveTask({
                        title: habitTitle,
                        priority: 'Medium',
                        frequency: 'Daily',
                        dueDate: new Date().toISOString().split('T')[0],
                        xpReward: 30,
                        goalId: goal.id,
                        completedDates: []
                    });
                }
                GrowthUtils.showToast('✨ 3 AI Habits injected into your Daily Tasks!', 'emerald');
                if (typeof DashboardComponent !== 'undefined' && DashboardComponent.render) DashboardComponent.render();
                if (typeof GoalsComponent !== 'undefined' && GoalsComponent.render) GoalsComponent.render();
                if (typeof TasksComponent !== 'undefined' && TasksComponent.render) TasksComponent.render();
            } else {
                throw new Error("Invalid format from AI");
            }
        } catch (err) {
            console.error("AI Habit generation error:", err);
            GrowthUtils.showToast('Failed to parse AI habits. Ensure LLM returns raw JSON array.', 'rose');
        }
    }
};
