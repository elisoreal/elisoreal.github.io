(function () {
    let unlockDateCache = null;
    let celebrationHasRun = false;
    let globalTriggerBound = false;
    let finalCountdownTimer = null;
    let rumbleStopTimeout = null;
    let lastAnnouncedSecond = null;
    const CLOCK_TICK_SOUND_URL = 'clockticking.mp3';
    const RUMBLE_SOUND_URL = 'groundshake.mp3';
    let rumbleAudio = null;
    let clockTickAudio = null;
    let tickingStarted = false;

    document.addEventListener('DOMContentLoaded', initCelebration);

    function initCelebration() {
        const arrivalNode = document.getElementById('arrival');

        if (!arrivalNode) {
            return;
        }

        injectCelebrationStyles();

        const now = new Date();
        unlockDateCache = getUnlockDate(now);
        const previewMode = isPreviewMode();
        bindGlobalTrigger();
        bindPreviewControls();

        if (previewMode) {
            startPreviewSequence(20);
            return;
        }

        startFinalCountdownWatcher(true);

        // Run immediately if the arrival message is already visible and we're past the unlock date.
        if (Date.now() >= unlockDateCache.getTime() && isNodeVisible(arrivalNode)) {
            triggerCelebration();
            return;
        }

        const observer = new MutationObserver(() => {
            if (Date.now() < unlockDateCache.getTime()) {
                return;
            }
            if (isNodeVisible(arrivalNode)) {
                triggerCelebration();
                observer.disconnect();
            }
        });

        observer.observe(arrivalNode, { attributes: true, attributeFilter: ['style', 'class'] });
        startFinalCountdownWatcher();
    }

    function isNodeVisible(node) {
        return window.getComputedStyle(node).display !== 'none';
    }

    function isPreviewMode() {
        const params = new URLSearchParams(window.location.search);
        return params.get('previewDisco') === 'true';
    }

    function getUnlockDate(referenceDate) {
        const year = referenceDate.getFullYear();
        const tentative = new Date(`${year}-11-01T00:00:00`);
        return referenceDate > tentative ? new Date(`${year + 1}-11-01T00:00:00`) : tentative;
    }

    function triggerCelebration(forceLaunch) {
        if (celebrationHasRun) {
            return;
        }

        if (!forceLaunch && unlockDateCache && Date.now() < unlockDateCache.getTime()) {
            return;
        }
        celebrationHasRun = true;
        clearFinalCountdownWatcher();
        stopClockTick();

        const existingOverlay = document.querySelector('.celebration-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const overlay = document.createElement('div');
        overlay.className = 'celebration-overlay';

        const discoBall = document.createElement('div');
        discoBall.className = 'disco-ball';
        discoBall.innerHTML = '<div class="disco-squares"></div>';

        overlay.appendChild(discoBall);

        const confettiContainer = document.createElement('div');
        confettiContainer.className = 'confetti-container';
        overlay.appendChild(confettiContainer);

        const flash = document.createElement('div');
        flash.className = 'celebration-flash';
        overlay.appendChild(flash);

        const shockwave = document.createElement('div');
        shockwave.className = 'celebration-shockwave';
        overlay.appendChild(shockwave);

        createLightBeams(overlay);
        createSparkBurst(overlay);
        populateConfetti(confettiContainer);

        document.body.appendChild(overlay);
        window.dispatchEvent(new CustomEvent('celebration:started'));

        document.body.classList.add('celebration-shake');
        stopGroundRumble();

        const stopRumble = playGroundRumble();
        if (stopRumble) {
            rumbleStopTimeout = setTimeout(() => {
                stopRumble();
                rumbleStopTimeout = null;
            }, 5200);
        }
        setTimeout(() => {
            document.body.classList.remove('celebration-shake');
        }, 5200);

        // Kick off the entrance animations
        requestAnimationFrame(() => {
            overlay.classList.add('is-visible');
            requestAnimationFrame(() => {
                discoBall.classList.add('is-active');
                flash.classList.add('is-active');
                shockwave.classList.add('is-active');
            });
        });
    }

    function populateConfetti(container) {
        const colors = ['#ffce00', '#ff007a', '#6cf7ff', '#a9ff70', '#ff6c6c', '#8c6cff'];
        const totalPieces = 180;

        for (let i = 0; i < totalPieces; i++) {
            const piece = document.createElement('span');
            piece.className = 'confetti-piece';
            piece.style.setProperty('--confetti-left', `${Math.random() * 100}%`);
            piece.style.setProperty('--confetti-rotation', `${Math.random() * 360}deg`);
            piece.style.setProperty('--confetti-delay', `${Math.random() * 2.8}s`);
            piece.style.setProperty('--confetti-duration', `${Math.random() * 3.2 + 5}s`);
            piece.style.setProperty('--confetti-fall', `${Math.random() * 40 + 80}vh`);
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.opacity = (Math.random() * 0.5 + 0.5).toFixed(2);
            container.appendChild(piece);
        }
    }

    function startFinalCountdownWatcher(forceReset = false) {
        if (!unlockDateCache) {
            return;
        }
        if (finalCountdownTimer && !forceReset) {
            return;
        }
        if (finalCountdownTimer) {
            clearInterval(finalCountdownTimer);
        }
        lastAnnouncedSecond = null;

        finalCountdownTimer = setInterval(() => {
            if (celebrationHasRun) {
                clearFinalCountdownWatcher();
                return;
            }
            const remainingMs = unlockDateCache.getTime() - Date.now();
            const remainingSeconds = Math.ceil(remainingMs / 1000);

            if (remainingSeconds <= 8 && remainingSeconds > 0) {
                startClockTick();
            }

            if (lastAnnouncedSecond !== remainingSeconds) {
                window.dispatchEvent(new CustomEvent('celebration:tick', {
                    detail: {
                        remainingSeconds: Math.max(0, remainingSeconds)
                    }
                }));
                lastAnnouncedSecond = remainingSeconds;
            }

            if (remainingSeconds <= 0) {
                triggerCelebration();
            }
        }, 250);
    }

    function clearFinalCountdownWatcher() {
        if (finalCountdownTimer) {
            clearInterval(finalCountdownTimer);
            finalCountdownTimer = null;
        }
        lastAnnouncedSecond = null;
        tickingStarted = false;
    }

    function startClockTick() {
        if (tickingStarted) {
            return;
        }
        tickingStarted = true;
        try {
            if (!clockTickAudio) {
                clockTickAudio = new Audio(CLOCK_TICK_SOUND_URL);
                clockTickAudio.setAttribute('preload', 'auto');
            }
            clockTickAudio.currentTime = 0;
            const playPromise = clockTickAudio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.catch(() => {});
            }
        } catch (err) {
            console.warn('Unable to play countdown tick', err);
        }
    }

    function stopClockTick() {
        if (clockTickAudio) {
            clockTickAudio.pause();
            clockTickAudio.currentTime = 0;
        }
        tickingStarted = false;
    }

    function playGroundRumble() {
        if (!RUMBLE_SOUND_URL) {
            return null;
        }
        try {
            if (!rumbleAudio) {
                rumbleAudio = new Audio(RUMBLE_SOUND_URL);
                rumbleAudio.loop = true;
                rumbleAudio.volume = 0.6;
                rumbleAudio.setAttribute('preload', 'auto');
                if (typeof rumbleAudio.load === 'function') {
                    rumbleAudio.load();
                }
            }
            rumbleAudio.currentTime = 0;
            const playPromise = rumbleAudio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.catch(() => {});
            }
            return () => stopGroundRumble();
        } catch (err) {
            console.warn('Unable to play ground rumble', err);
            return null;
        }
    }

    function stopGroundRumble() {
        if (rumbleStopTimeout) {
            clearTimeout(rumbleStopTimeout);
            rumbleStopTimeout = null;
        }
        if (rumbleAudio) {
            rumbleAudio.pause();
            rumbleAudio.currentTime = 0;
        }
    }

    let previewControlsBound = false;

    function bindPreviewControls() {
        if (previewControlsBound) {
            return;
        }
        previewControlsBound = true;

        window.addEventListener('startCelebrationPreview', (event) => {
            const seconds = Number(event.detail && event.detail.seconds) || 20;
            startPreviewSequence(seconds);
        });

        window.addEventListener('resetCelebrationState', resetCelebrationState);
    }

    function startPreviewSequence(seconds) {
        resetCelebrationState();
        unlockDateCache = new Date(Date.now() + seconds * 1000);
        startFinalCountdownWatcher(true);
    }

    function resetCelebrationState() {
        celebrationHasRun = false;
        clearFinalCountdownWatcher();
        const overlay = document.querySelector('.celebration-overlay');
        if (overlay) {
            overlay.remove();
        }
        document.body.classList.remove('celebration-shake');
        stopGroundRumble();
        stopClockTick();
    }

    function createLightBeams(parent) {
        const positions = ['left', 'right'];
        positions.forEach((pos, index) => {
            const beam = document.createElement('span');
            beam.className = `light-beam light-beam-${pos}`;
            beam.style.animationDelay = `${index * 0.12}s`;
            parent.appendChild(beam);
        });
    }

    function createSparkBurst(parent) {
        const sparkBurst = document.createElement('div');
        sparkBurst.className = 'spark-burst';

        const sparkCount = 18;
        for (let i = 0; i < sparkCount; i++) {
            const spark = document.createElement('span');
            spark.className = 'spark';
            spark.style.setProperty('--spark-rotation', `${(360 / sparkCount) * i}deg`);
            spark.style.setProperty('--spark-distance', `${Math.random() * 32 + 18}vh`);
            spark.style.setProperty('--spark-delay', `${Math.random() * 0.4}s`);
            sparkBurst.appendChild(spark);
        }

        parent.appendChild(sparkBurst);

        requestAnimationFrame(() => {
            sparkBurst.classList.add('is-active');
        });
    }

    function bindGlobalTrigger() {
        if (globalTriggerBound) {
            return;
        }
        globalTriggerBound = true;

        window.addEventListener('triggerDiscoCelebration', (event) => {
            const detail = event.detail || {};
            const force = Boolean(detail.force);
            if (force) {
                resetCelebrationState();
            }
            triggerCelebration(force);
        });
    }

    function injectCelebrationStyles() {
        if (document.getElementById('celebration-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'celebration-style';
        style.textContent = `
            .celebration-overlay {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                pointer-events: none;
                opacity: 0;
                transform: translateY(-6%);
                transition: opacity 0.7s ease, transform 0.7s ease;
                z-index: 9999;
            }
            .celebration-overlay.is-visible {
                opacity: 1;
                transform: translateY(0);
            }
            .celebration-overlay.begin-fade-out {
                opacity: 0;
                transform: translateY(4%);
            }
            .disco-ball {
                position: relative;
                width: min(140px, 40vw);
                height: min(140px, 40vw);
                border-radius: 50%;
                background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.85), rgba(200,200,255,0.4) 45%, rgba(40,40,80,0.7));
                box-shadow: 0 25px 45px rgba(0, 0, 0, 0.45);
                overflow: hidden;
                transform: translateY(-140%);
                opacity: 0;
            }
            .disco-ball::before {
                content: '';
                position: absolute;
                top: calc(-140px);
                left: 50%;
                transform: translateX(-50%);
                width: 4px;
                height: 140px;
                background: linear-gradient(180deg, transparent 10%, rgba(255,255,255,0.7) 95%);
                animation: disco-cable-sway 6s ease-in-out infinite;
            }
            .disco-ball::after {
                content: '';
                position: absolute;
                inset: 0;
                background: radial-gradient(circle at 50% 0%, rgba(255,255,255,0.75), transparent 58%);
                mix-blend-mode: screen;
                opacity: 0.9;
            }
            .disco-ball .disco-squares {
                position: absolute;
                inset: 0;
                background-image:
                    linear-gradient(90deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 8%, transparent 8%, transparent 16%),
                    linear-gradient(180deg, rgba(255,255,255,0.2) 0, rgba(255,255,255,0.2) 8%, transparent 8%, transparent 16%);
                background-size: 18px 18px;
                mix-blend-mode: overlay;
                animation: disco-glimmer 1.2s linear infinite;
            }
            .disco-ball.is-active {
                animation: disco-drop 1.25s ease-out forwards, disco-spin 4.2s linear infinite 1.25s;
            }
            body.celebration-shake {
                animation: screen-shake 0.12s linear infinite;
            }
            .celebration-flash {
                position: fixed;
                inset: 0;
                pointer-events: none;
                background: radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.75), transparent 60%);
                opacity: 0;
                transition: opacity 0.35s ease-out;
                mix-blend-mode: screen;
            }
            .celebration-flash.is-active {
                opacity: 1;
                animation: flash-pulse 1.6s ease-out forwards;
            }
            .celebration-shockwave {
                position: fixed;
                top: 40%;
                left: 50%;
                width: 80px;
                height: 80px;
                border-radius: 50%;
                border: 2px solid rgba(255, 255, 255, 0.55);
                transform: translate(-50%, -50%) scale(0.1);
                opacity: 0;
            }
            .celebration-shockwave.is-active {
                animation: shockwave-expand 2.8s cubic-bezier(0.25, 0.85, 0.45, 1) forwards;
            }
            .confetti-container {
                position: fixed;
                inset: 0;
                overflow: hidden;
                pointer-events: none;
            }
            .confetti-piece {
                position: absolute;
                top: -12vh;
                left: var(--confetti-left);
                width: 8px;
                height: 14px;
                border-radius: 2px;
                transform: rotate(var(--confetti-rotation));
                animation: confetti-fall var(--confetti-duration) linear var(--confetti-delay) infinite;
            }
            .light-beam {
                position: fixed;
                top: -65vh;
                width: 34vw;
                height: 220vh;
                background: linear-gradient(180deg, rgba(140, 120, 255, 0.38), rgba(60, 40, 120, 0.05));
                filter: blur(2px);
                opacity: 0;
                transform-origin: top center;
                mix-blend-mode: screen;
                pointer-events: none;
                animation: beam-sway 6s ease-in-out infinite;
                transition: opacity 0.3s ease;
            }
            .celebration-overlay.is-visible .light-beam {
                opacity: 1;
            }
            .light-beam-left {
                left: -4vw;
                transform: rotate(-12deg);
            }
            .light-beam-right {
                right: -4vw;
                transform: rotate(12deg);
                animation-delay: 0.25s;
            }
            .spark-burst {
                position: fixed;
                top: 42%;
                left: 50%;
                width: 2px;
                height: 2px;
                pointer-events: none;
                transform: translate(-50%, -50%);
                opacity: 0;
            }
            .spark-burst.is-active {
                opacity: 1;
            }
            .spark-burst .spark {
                position: absolute;
                top: 0;
                left: 0;
                width: 6px;
                height: 16px;
                border-radius: 3px;
                background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255, 160, 0, 0.1));
                transform-origin: center 100%;
                transform: rotate(var(--spark-rotation));
                animation: spark-shoot 1.8s ease-out var(--spark-delay) forwards;
            }
            @keyframes disco-drop {
                0% {
                    transform: translateY(-180%);
                    opacity: 0;
                }
                70% {
                    transform: translateY(6%);
                    opacity: 1;
                }
                100% {
                    transform: translateY(0%);
                    opacity: 1;
                }
            }
            @keyframes disco-spin {
                0% {
                    transform: rotate(0deg);
                }
                100% {
                    transform: rotate(360deg);
                }
            }
            @keyframes disco-glimmer {
                0% {
                    filter: brightness(1);
                }
                50% {
                    filter: brightness(1.4);
                }
                100% {
                    filter: brightness(1);
                }
            }
            @keyframes disco-cable-sway {
                0%, 100% {
                    transform: translateX(-50%) rotate(2deg);
                }
                50% {
                    transform: translateX(-50%) rotate(-2deg);
                }
            }
            @keyframes confetti-fall {
                0% {
                    transform: translate3d(0, 0, 0) rotate(0deg);
                    opacity: 0;
                }
                10% {
                    opacity: 1;
                }
                100% {
                    transform: translate3d(0, var(--confetti-fall), 0) rotate(360deg);
                    opacity: 0;
                }
            }
            @keyframes screen-shake {
                0% { transform: translate(1px, -1px) rotate(0deg); }
                25% { transform: translate(-2px, 2px) rotate(-0.6deg); }
                50% { transform: translate(2px, -1px) rotate(0.4deg); }
                75% { transform: translate(-1px, 2px) rotate(-0.3deg); }
                100% { transform: translate(0, 0) rotate(0deg); }
            }
            @keyframes flash-pulse {
                0% { opacity: 1; }
                40% { opacity: 0.35; }
                100% { opacity: 0; }
            }
            @keyframes shockwave-expand {
                0% {
                    transform: translate(-50%, -50%) scale(0.1);
                    opacity: 0.7;
                    border-width: 2px;
                }
                70% {
                    opacity: 0.2;
                    border-width: 6px;
                }
                100% {
                    transform: translate(-50%, -50%) scale(8.2);
                    opacity: 0;
                    border-width: 12px;
                }
            }
            @keyframes beam-sway {
                0%, 100% { transform: rotate(-10deg); }
                50% { transform: rotate(-4deg); }
            }
            .light-beam-right {
                animation-name: beam-sway-right;
            }
            @keyframes beam-sway-right {
                0%, 100% { transform: rotate(10deg); }
                50% { transform: rotate(4deg); }
            }
            @keyframes spark-shoot {
                0% {
                    transform: rotate(var(--spark-rotation)) scaleY(0.2);
                    opacity: 0;
                }
                25% {
                    opacity: 1;
                }
                100% {
                    transform: rotate(var(--spark-rotation)) translateY(calc(var(--spark-distance) * -1)) scaleY(1.2);
                    opacity: 0;
                }
            }
            @media (prefers-reduced-motion: reduce) {
                .disco-ball,
                .disco-ball::before,
                .disco-ball .disco-squares,
                .confetti-piece,
                .celebration-overlay,
                .celebration-flash,
                .light-beam,
                .spark-burst .spark,
                .celebration-shockwave,
                body.celebration-shake {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            }
        `;

        document.head.appendChild(style);
    }
})();
