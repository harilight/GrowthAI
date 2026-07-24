/**
 * GrowthOS Focus Room & Multi-Track Soundscape Controller (focus.js)
 * Controls Pomodoro/Ultradian focus timers and simultaneous multi-track Web Audio API mixing.
 */

const FocusComponent = {
    timerInterval: null,
    durationSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    isRunning: false,
    elapsedSeconds: 0,
    
    // Multi-track active nodes (HTML5 Audio)
    tracks: {
        rain: { audio: null, volume: 0 },
        forest: { audio: null, volume: 0 },
        piano: { audio: null, volume: 0 },
        vocals: { audio: null, volume: 0 }
    },

    audioSources: {
        rain: 'audio/rain.ogg',
        forest: 'audio/forest.mp3',
        piano: 'audio/piano.mp3',
        vocals: 'audio/ambient.mp3'
    },

    init() {
        this.updateDisplay();

        const btnStart = document.getElementById('btn-focus-start');
        const btnPause = document.getElementById('btn-focus-pause');
        const btnReset = document.getElementById('btn-focus-reset');

        if (btnStart) btnStart.addEventListener('click', () => this.startTimer());
        if (btnPause) btnPause.addEventListener('click', () => this.pauseTimer());
        if (btnReset) btnReset.addEventListener('click', () => this.resetTimer());

        // Timer Presets
        document.querySelectorAll('.timer-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.timer-preset-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const mins = Number(e.target.getAttribute('data-minutes')) || 25;
                this.setDuration(mins);
            });
        });

        // Multi-Track Audio Mixing Sliders
        document.querySelectorAll('.audio-track-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const trackName = e.target.getAttribute('data-track');
                const valPercent = Number(e.target.value);
                const valueDisplay = document.getElementById(`track-val-${trackName}`);
                if (valueDisplay) valueDisplay.textContent = `${valPercent}%`;

                this.updateSoundTrack(trackName, valPercent / 100);
            });
        });

        // Audio Presets
        document.querySelectorAll('.sound-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.sound-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const sound = e.target.getAttribute('data-sound');
                
                // Mute all first
                document.querySelectorAll('.audio-track-slider').forEach(s => {
                    s.value = 0;
                    const valDisplay = document.getElementById(`track-val-${s.getAttribute('data-track')}`);
                    if (valDisplay) valDisplay.textContent = '0%';
                    this.updateSoundTrack(s.getAttribute('data-track'), 0);
                });

                // Set preset volume
                if (sound !== 'mute') {
                    const slider = document.querySelector(`.audio-track-slider[data-track="${sound}"]`);
                    if (slider) {
                        slider.value = 100;
                        const valDisplay = document.getElementById(`track-val-${sound}`);
                        if (valDisplay) valDisplay.textContent = '100%';
                        this.updateSoundTrack(sound, 1);
                    }
                }
            });
        });
    },

    setDuration(minutes) {
        this.pauseTimer();
        this.durationSeconds = minutes * 60;
        this.remainingSeconds = this.durationSeconds;
        this.updateDisplay();
        GrowthUtils.showToast(`⏱️ Flow timer set to ${minutes} minutes.`, 'cyan');
    },

    updateDisplay() {
        const displayEl = document.getElementById('focus-timer-display');
        if (!displayEl) return;

        const mins = Math.floor(this.remainingSeconds / 60);
        const secs = this.remainingSeconds % 60;
        displayEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    startTimer() {
        if (this.isRunning) return;
        this.isRunning = true;

        const circleEl = document.getElementById('focus-timer-circle');
        const statusEl = document.getElementById('focus-timer-status');
        const btnStart = document.getElementById('btn-focus-start');
        const btnPause = document.getElementById('btn-focus-pause');

        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        if (circleEl) circleEl.classList.add('running');
        if (statusEl) statusEl.textContent = 'IN FLOW STATE 🔥';
        if (btnStart) btnStart.style.display = 'none';
        if (btnPause) btnPause.style.display = 'inline-flex';

        this.timerInterval = setInterval(() => {
            if (this.remainingSeconds > 0) {
                this.remainingSeconds--;
                this.elapsedSeconds++;
                this.updateDisplay();

                // 20-20-20 Rule for eye strain
                if (this.elapsedSeconds > 0 && this.elapsedSeconds % 1200 === 0) {
                    this.trigger2020Rule();
                }
            } else {
                this.completeSession();
            }
        }, 1000);
    },

    pauseTimer() {
        if (!this.isRunning) return;
        this.isRunning = false;
        clearInterval(this.timerInterval);

        const circleEl = document.getElementById('focus-timer-circle');
        const statusEl = document.getElementById('focus-timer-status');
        const btnStart = document.getElementById('btn-focus-start');
        const btnPause = document.getElementById('btn-focus-pause');

        if (circleEl) circleEl.classList.remove('running');
        if (statusEl) statusEl.textContent = 'PAUSED ⏸️';
        if (btnStart) btnStart.style.display = 'inline-flex';
        if (btnPause) btnPause.style.display = 'none';
    },

    resetTimer() {
        this.pauseTimer();
        this.remainingSeconds = this.durationSeconds;
        this.elapsedSeconds = 0;
        this.updateDisplay();
        const statusEl = document.getElementById('focus-timer-status');
        if (statusEl) statusEl.textContent = 'READY';
    },

    trigger2020Rule() {
        const overlay = document.getElementById('eye-strain-overlay');
        const countdownEl = document.getElementById('eye-strain-countdown');
        if (!overlay || !countdownEl) return;

        overlay.classList.add('active');
        let secondsLeft = 20;
        countdownEl.textContent = secondsLeft;

        // Push desktop notification if in background
        if (document.hidden && Notification.permission === 'granted') {
            new Notification('GrowthOS: 20-20-20 Rule', { 
                body: 'Look 20 feet away for 20 seconds to protect your eyes.' 
            });
        }
        
        GrowthUtils.showToast('👁️ 20-20-20 Rule active.', 'purple');

        const interval = setInterval(() => {
            if (!overlay.classList.contains('active')) {
                clearInterval(interval); // user skipped
                return;
            }
            secondsLeft--;
            countdownEl.textContent = secondsLeft;
            
            if (secondsLeft <= 0) {
                clearInterval(interval);
                overlay.classList.remove('active');
                GrowthUtils.showToast('Back to focus!', 'emerald');
            }
        }, 1000);
    },

    async completeSession() {
        this.resetTimer();
        this.playCompletionChime();

        const mins = Math.round(this.durationSeconds / 60);
        await db.saveSession({
            durationMinutes: mins,
            type: `${mins}-Minute Flow Sprint`
        });

        // Award bonus XP based on duration
        const bonusXP = mins >= 50 ? 100 : 50;
        const settings = await db.getSettings();
        const currentXP = (settings.xp || 0) + bonusXP;
        await db.updateSetting('xp', currentXP);
        await db.updateSetting('level', Math.floor(Math.sqrt(currentXP / 50)) + 1);

        GrowthUtils.showToast(`🎯 ${mins}-Minute Flow Session Completed! +${bonusXP} XP Bonus!`, 'emerald');
        GrowthUtils.triggerConfetti();

        if (typeof DashboardComponent !== 'undefined' && DashboardComponent.render) DashboardComponent.render();
    },

    playCompletionChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.3); // E5
            osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.6); // G5
            osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.9); // C6

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.5);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 2.5);
        } catch (e) {
            console.log('Audio playback blocked or not supported:', e);
        }
    },

    updateSoundTrack(trackName, volumeRatio) {
        const track = this.tracks[trackName];
        if (!track) return;

        track.volume = volumeRatio;

        // If volume drops to 0, stop and cleanup node
        if (volumeRatio <= 0.01) {
            if (track.audio) {
                track.audio.pause();
                track.audio = null;
            }
            return;
        }

        // If audio object doesn't exist yet, initialize it
        if (!track.audio) {
            const url = this.audioSources[trackName];
            if (!url) return;

            track.audio = new Audio(url);
            track.audio.loop = true;
            // CrossOrigin needed in some browsers
            track.audio.crossOrigin = 'anonymous';
            track.audio.volume = volumeRatio;
            
            track.audio.play().catch(e => {
                console.warn(`Could not play ${trackName} audio:`, e);
                GrowthUtils.showToast(`Tap anywhere to enable ${trackName} audio playback.`, 'amber');
            });
        } else {
            // Smoothly adjust volume of running track
            track.audio.volume = volumeRatio;
        }
    }
};
