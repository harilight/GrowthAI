/**
 * GrowthOS Analytics Controller (analytics.js)
 * Renders interactive Chart.js charts and visual data graphs.
 */

const AnalyticsComponent = {
    velocityChartInstance: null,
    categoryChartInstance: null,
    streakChartInstance: null,
    radarChartInstance: null,
    scatterChartInstance: null,
    flowStateChartInstance: null,

    async render() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded yet.');
            return;
        }

        const goals = await db.getAllGoals();
        const tasks = await db.getAllTasks();
        const sessions = await db.getAllSessions();

        this.renderVelocityChart(goals, tasks);
        this.renderCategoryChart(goals, tasks);
        this.renderStreakChart(tasks);
        this.renderFlowStateChart(sessions);
        this.renderRadarChart(goals, tasks);
        this.renderScatterChart(tasks, sessions);

        this.initParticles();
    },

    initParticles() {
        const canvas = document.getElementById('analytics-particles');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let width = canvas.width = canvas.offsetWidth;
        let height = canvas.height = canvas.offsetHeight;
        
        const particles = [];
        for (let i = 0; i < 60; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.7,
                vy: (Math.random() - 0.5) * 0.7,
                radius: Math.random() * 2 + 1
            });
        }

        let mouseX = -1000;
        let mouseY = -1000;

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        });

        canvas.addEventListener('mouseleave', () => {
            mouseX = -1000;
            mouseY = -1000;
        });

        function animate() {
            ctx.clearRect(0, 0, width, height);
            
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                // Mouse interaction
                const dx = mouseX - p.x;
                const dy = mouseY - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    p.x -= dx * 0.015;
                    p.y -= dy * 0.015;
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
                ctx.fill();

                // Draw lines between nearby particles
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const d2 = Math.sqrt((p.x - p2.x)**2 + (p.y - p2.y)**2);
                    if (d2 < 100) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(6, 182, 212, ${0.15 - d2/600})`;
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animate);
        }
        
        // Stop any previous animation loops if render is called multiple times
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = requestAnimationFrame(animate);

        window.addEventListener('resize', () => {
            if(canvas) {
                width = canvas.width = canvas.offsetWidth;
                height = canvas.height = canvas.offsetHeight;
            }
        });
    },

    renderRadarChart(goals, tasks) {
        const ctxEl = document.getElementById('radar-chart');
        if (!ctxEl) return;
        if (this.radarChartInstance) this.radarChartInstance.destroy();

        const dist = GrowthModels.getCategoryDistribution(goals, tasks);
        const hasData = dist.xpEarned.some(x => x > 0);
        const dataValues = hasData ? dist.xpEarned : [0, 0, 0, 0, 0];

        this.radarChartInstance = new Chart(ctxEl, {
            type: 'radar',
            data: {
                labels: dist.labels,
                datasets: [{
                    label: 'OS Level Distribution',
                    data: dataValues,
                    backgroundColor: 'rgba(139, 92, 246, 0.4)',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    pointBackgroundColor: '#06b6d4',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#06b6d4',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } },
                        ticks: { display: false }
                    }
                },
                plugins: { legend: { display: false } },
                animation: { duration: 1200, easing: 'easeOutQuart' }
            }
        });
    },

    renderScatterChart(tasks, sessions) {
        const ctxEl = document.getElementById('scatter-chart');
        if (!ctxEl) return;
        if (this.scatterChartInstance) this.scatterChartInstance.destroy();

        const dataPoints = [];
        const today = new Date();
        
        for(let i=0; i<14; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            
            let dailyXP = 0;
            tasks.forEach(t => {
                if(t.completedDates && t.completedDates.includes(dateStr)) {
                    dailyXP += (t.xpReward || 10);
                }
            });

            let focusMins = 0;
            sessions.forEach(s => {
                if (s.timestamp && s.timestamp.startsWith(dateStr)) {
                    focusMins += (s.durationMinutes || 25);
                }
            });

            if (dailyXP > 0 || focusMins > 0) {
                dataPoints.push({ x: focusMins, y: dailyXP });
            }
        }

        this.scatterChartInstance = new Chart(ctxEl, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Daily Momentum',
                    data: dataPoints,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    pointRadius: 6,
                    pointHoverRadius: 10,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Focus Mins', color: '#94a3b8' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3b8' },
                        beginAtZero: true
                    },
                    y: {
                        title: { display: true, text: 'XP Earned', color: '#94a3b8' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3b8' },
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#10b981',
                        bodyColor: '#f8fafc',
                        callbacks: {
                            label: (ctx) => ` Focus: ${ctx.raw.x}m, XP: ${ctx.raw.y}`
                        }
                    }
                },
                animation: { duration: 1500, easing: 'easeOutElastic' }
            }
        });
    },

    renderVelocityChart(goals, tasks) {
        const ctxEl = document.getElementById('velocity-chart');
        if (!ctxEl) return;

        if (this.velocityChartInstance) {
            this.velocityChartInstance.destroy();
        }

        const activeGoals = goals.length > 0 ? goals.slice(0, 6) : [];
        const labels = activeGoals.map(g => g.title.length > 18 ? g.title.substring(0, 18) + '...' : g.title);
        const actualProgress = activeGoals.map(g => GrowthModels.calculateGoalMetrics(g, tasks).actualProgressPercent);
        const expectedTimeProgress = activeGoals.map(g => GrowthModels.calculateGoalMetrics(g, tasks).timeProgressPercent);

        const finalLabels = labels.length > 0 ? labels : [];
        const finalActual = actualProgress.length > 0 ? actualProgress : [];
        const finalExpected = expectedTimeProgress.length > 0 ? expectedTimeProgress : [];

        this.velocityChartInstance = new Chart(ctxEl, {
            type: 'bar',
            data: {
                labels: finalLabels,
                datasets: [
                    {
                        label: 'Actual Progress (%)',
                        data: finalActual,
                        backgroundColor: 'rgba(6, 182, 212, 0.75)',
                        borderColor: '#06b6d4',
                        borderWidth: 2,
                        borderRadius: 6
                    },
                    {
                        label: 'Time Elapsed / Target Pace (%)',
                        data: finalExpected,
                        type: 'line',
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        borderWidth: 2,
                        pointBackgroundColor: '#f59e0b',
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#f8fafc', font: { family: 'Inter', size: 12 } }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#06b6d4',
                        bodyColor: '#f8fafc',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { display: false }
                    }
                },
                animation: { duration: 1000 }
            }
        });
    },

    renderCategoryChart(goals, tasks) {
        const ctxEl = document.getElementById('category-chart');
        if (!ctxEl) return;

        if (this.categoryChartInstance) {
            this.categoryChartInstance.destroy();
        }

        const dist = GrowthModels.getCategoryDistribution(goals, tasks);
        const hasData = dist.goalCounts.some(c => c > 0) || dist.xpEarned.some(x => x > 0);
        const dataValues = hasData ? dist.xpEarned.map((x, idx) => Math.max(x, dist.goalCounts[idx] * 50)) : [];

        this.categoryChartInstance = new Chart(ctxEl, {
            type: 'doughnut',
            data: {
                labels: dist.labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: [
                        'rgba(6, 182, 212, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                        'rgba(244, 63, 94, 0.8)'
                    ],
                    borderColor: '#0f172a',
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#f8fafc', font: { family: 'Inter', size: 12 }, padding: 15 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#06b6d4',
                        bodyColor: '#f8fafc',
                        callbacks: {
                            label: (context) => ` ${context.label}: ${context.raw} XP / Energy Units`
                        }
                    }
                },
                cutout: '65%',
                animation: { animateScale: true, animateRotate: true, duration: 1200 }
            }
        });
    },

    renderStreakChart(allTasks) {
        const ctxEl = document.getElementById('streak-chart');
        if (!ctxEl) return;

        if (this.streakChartInstance) {
            this.streakChartInstance.destroy();
        }

        const labels = [];
        const completionCounts = [];
        const today = new Date();

        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const displayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            let count = 0;
            allTasks.forEach(t => {
                if (t.completedDates && t.completedDates.includes(dateStr)) {
                    count++;
                }
            });

            labels.push(displayStr);
            completionCounts.push(count);
        }

        const hasCompletions = completionCounts.some(c => c > 0);
        const finalCounts = hasCompletions ? completionCounts : new Array(14).fill(0);

        this.streakChartInstance = new Chart(ctxEl, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Task Completions',
                    data: finalCounts,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#ffffff',
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#f8fafc', font: { family: 'Inter', size: 12 } }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#10b981',
                        bodyColor: '#f8fafc'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#94a3b8', stepSize: 1 },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { display: false }
                    }
                },
                animation: { duration: 1000 }
            }
        });
    },

    renderFlowStateChart(sessions) {
        const ctxEl = document.getElementById('flow-state-chart');
        if (!ctxEl) return;

        if (this.flowStateChartInstance) {
            this.flowStateChartInstance.destroy();
        }

        const hourlyData = new Array(24).fill(0);
        sessions.forEach(s => {
            if (s.timestamp) {
                const hour = new Date(s.timestamp).getHours();
                hourlyData[hour] += (s.durationMinutes || 25);
            }
        });

        const labels = Array.from({length: 24}, (_, i) => {
            const ampm = i >= 12 ? 'PM' : 'AM';
            const h = i % 12 === 0 ? 12 : i % 12;
            return `${h} ${ampm}`;
        });

        this.flowStateChartInstance = new Chart(ctxEl, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Focus Minutes in Flow State',
                    data: hourlyData,
                    backgroundColor: 'rgba(139, 92, 246, 0.6)',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Minutes', color: '#94a3b8' },
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                },
                plugins: {
                    legend: { display: false }
                },
                animation: { duration: 1000 }
            }
        });
    }
};
