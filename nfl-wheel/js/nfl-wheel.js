(function () {
    'use strict';

    const TEAMS = [
        { name: 'Arizona Cardinals',     abbr: 'ARI', color1: '#97233F', color2: '#000000' },
        { name: 'Atlanta Falcons',       abbr: 'ATL', color1: '#A71930', color2: '#000000' },
        { name: 'Baltimore Ravens',      abbr: 'BAL', color1: '#241773', color2: '#000000' },
        { name: 'Buffalo Bills',         abbr: 'BUF', color1: '#00338D', color2: '#C60C30' },
        { name: 'Carolina Panthers',     abbr: 'CAR', color1: '#0085CA', color2: '#101820' },
        { name: 'Chicago Bears',         abbr: 'CHI', color1: '#0B162A', color2: '#C83803' },
        { name: 'Cincinnati Bengals',    abbr: 'CIN', color1: '#FB4F14', color2: '#000000' },
        { name: 'Cleveland Browns',      abbr: 'CLE', color1: '#311D00', color2: '#FF3C00' },
        { name: 'Dallas Cowboys',        abbr: 'DAL', color1: '#003594', color2: '#869397' },
        { name: 'Denver Broncos',        abbr: 'DEN', color1: '#FB4F14', color2: '#002244' },
        { name: 'Detroit Lions',         abbr: 'DET', color1: '#0076B6', color2: '#B0B7BC' },
        { name: 'Green Bay Packers',     abbr: 'GB',  color1: '#203731', color2: '#FFB612' },
        { name: 'Houston Texans',        abbr: 'HOU', color1: '#03202F', color2: '#A71930' },
        { name: 'Indianapolis Colts',    abbr: 'IND', color1: '#002C5F', color2: '#A2AAAD' },
        { name: 'Jacksonville Jaguars',  abbr: 'JAX', color1: '#101820', color2: '#D7A22A' },
        { name: 'Kansas City Chiefs',    abbr: 'KC',  color1: '#E31837', color2: '#FFB81C' },
        { name: 'Las Vegas Raiders',     abbr: 'LV',  color1: '#000000', color2: '#A5ACAF' },
        { name: 'Los Angeles Chargers',  abbr: 'LAC', color1: '#0080C6', color2: '#FFC20E' },
        { name: 'Los Angeles Rams',      abbr: 'LAR', color1: '#003594', color2: '#FFA300' },
        { name: 'Miami Dolphins',        abbr: 'MIA', color1: '#008E97', color2: '#FC4C02' },
        { name: 'Minnesota Vikings',     abbr: 'MIN', color1: '#4F2683', color2: '#FFC62F' },
        { name: 'New England Patriots',  abbr: 'NE',  color1: '#002244', color2: '#C60C30' },
        { name: 'New Orleans Saints',    abbr: 'NO',  color1: '#D3BC8D', color2: '#101820' },
        { name: 'New York Giants',       abbr: 'NYG', color1: '#0B2265', color2: '#A71930' },
        { name: 'New York Jets',         abbr: 'NYJ', color1: '#125740', color2: '#000000' },
        { name: 'Philadelphia Eagles',   abbr: 'PHI', color1: '#004C54', color2: '#A5ACAF' },
        { name: 'Pittsburgh Steelers',   abbr: 'PIT', color1: '#FFB612', color2: '#101820' },
        { name: 'San Francisco 49ers',   abbr: 'SF',  color1: '#AA0000', color2: '#B3995D' },
        { name: 'Seattle Seahawks',      abbr: 'SEA', color1: '#002244', color2: '#69BE28' },
        { name: 'Tampa Bay Buccaneers',  abbr: 'TB',  color1: '#D50A0A', color2: '#FF7900' },
        { name: 'Tennessee Titans',      abbr: 'TEN', color1: '#0C2340', color2: '#4B92DB' },
        { name: 'Washington Commanders', abbr: 'WSH', color1: '#5A1414', color2: '#FFB612' },
    ];

    const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'Defense', 'Coach'];

    const canvas = document.getElementById('wheel-canvas');
    const ctx = canvas.getContext('2d');
    const spinBtn = document.getElementById('spin-btn');
    const pickModal = document.getElementById('pick-modal');
    const resultsOverlay = document.getElementById('results-overlay');
    const modalTeamBanner = document.getElementById('modal-team-banner');
    const modalTeamName = document.getElementById('modal-team-name');
    const positionButtonsContainer = document.getElementById('position-buttons');
    const nameEntry = document.getElementById('name-entry');
    const nameLabel = document.getElementById('name-label');
    const playerInput = document.getElementById('player-input');
    const confirmBtn = document.getElementById('confirm-btn');
    const playAgainBtn = document.getElementById('play-again-btn');
    const rosterProgress = document.getElementById('roster-progress');

    const DPR = window.devicePixelRatio || 1;
    const CANVAS_SIZE = 500;

    let usedTeams = new Set();
    let filledPositions = {};
    let currentAngle = 0;
    let spinning = false;
    let selectedPosition = null;
    let landedTeamIndex = null;

    function init() {
        canvas.width = CANVAS_SIZE * DPR;
        canvas.height = CANVAS_SIZE * DPR;
        ctx.scale(DPR, DPR);

        usedTeams = new Set();
        filledPositions = {};
        currentAngle = 0;
        spinning = false;
        selectedPosition = null;
        landedTeamIndex = null;

        document.querySelectorAll('.roster-slot').forEach(slot => {
            slot.classList.remove('filled');
            slot.style.borderLeftColor = '#ddd';
            slot.style.removeProperty('--team-color');
            const nameEl = slot.querySelector('.player-name');
            nameEl.textContent = '—';
            nameEl.style.color = '';
            slot.querySelector('.team-badge').textContent = '';
        });

        updateProgress();
        drawWheel();
        spinBtn.disabled = false;
        pickModal.classList.remove('active');
        resultsOverlay.classList.remove('active');
    }

    function luminance(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    function textColor(bgHex) {
        return luminance(bgHex) > 0.5 ? '#111' : '#fff';
    }

    function drawWheel() {
        const cx = CANVAS_SIZE / 2;
        const cy = CANVAS_SIZE / 2;
        const r = CANVAS_SIZE / 2 - 4;
        const sliceAngle = (2 * Math.PI) / TEAMS.length;

        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        TEAMS.forEach((team, i) => {
            const startAngle = currentAngle + i * sliceAngle;
            const endAngle = startAngle + sliceAngle;
            const isUsed = usedTeams.has(i);

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, startAngle, endAngle);
            ctx.closePath();

            if (isUsed) {
                ctx.fillStyle = '#d0d0d0';
            } else {
                ctx.fillStyle = team.color1;
            }
            ctx.fill();

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // abbreviation text
            const midAngle = startAngle + sliceAngle / 2;
            const textR = r * 0.72;
            const tx = cx + Math.cos(midAngle) * textR;
            const ty = cy + Math.sin(midAngle) * textR;

            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(midAngle + Math.PI / 2);
            ctx.font = '500 11px "Roboto Slab", serif';
            ctx.fillStyle = isUsed ? '#aaa' : textColor(team.color1);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(team.abbr, 0, 0);
            ctx.restore();
        });

        // center circle
        ctx.beginPath();
        ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = '500 10px "Roboto Slab", serif';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('NFL', cx, cy);
    }

    function getTeamAtPointer() {
        // pointer is at the top (12 o'clock = -π/2)
        const sliceAngle = (2 * Math.PI) / TEAMS.length;
        let pointerAngle = (-Math.PI / 2 - currentAngle) % (2 * Math.PI);
        if (pointerAngle < 0) pointerAngle += 2 * Math.PI;
        return Math.floor(pointerAngle / sliceAngle) % TEAMS.length;
    }

    function findValidLandingAngle(rawFinalAngle) {
        const sliceAngle = (2 * Math.PI) / TEAMS.length;
        const tempAngle = rawFinalAngle % (2 * Math.PI);

        let pointerAngle = (-Math.PI / 2 - tempAngle) % (2 * Math.PI);
        if (pointerAngle < 0) pointerAngle += 2 * Math.PI;
        const idx = Math.floor(pointerAngle / sliceAngle) % TEAMS.length;

        if (!usedTeams.has(idx)) return rawFinalAngle;

        // search for nearest valid team
        for (let offset = 1; offset < TEAMS.length; offset++) {
            for (const dir of [1, -1]) {
                const candidate = (idx + offset * dir + TEAMS.length) % TEAMS.length;
                if (!usedTeams.has(candidate)) {
                    const sliceMid = candidate * sliceAngle + sliceAngle / 2;
                    const targetPointerAngle = sliceMid;
                    const needed = -Math.PI / 2 - targetPointerAngle;
                    const fullRotations = Math.floor(rawFinalAngle / (2 * Math.PI)) * (2 * Math.PI);
                    let adjusted = fullRotations + needed;
                    while (adjusted < rawFinalAngle - Math.PI) adjusted += 2 * Math.PI;
                    while (adjusted > rawFinalAngle + Math.PI) adjusted -= 2 * Math.PI;
                    return adjusted;
                }
            }
        }
        return rawFinalAngle;
    }

    function spin() {
        if (spinning) return;
        if (Object.keys(filledPositions).length >= POSITIONS.length) return;

        spinning = true;
        spinBtn.disabled = true;

        const baseSpins = 4 + Math.random() * 3;
        const extraAngle = Math.random() * 2 * Math.PI;
        let targetAngle = currentAngle + baseSpins * 2 * Math.PI + extraAngle;

        targetAngle = findValidLandingAngle(targetAngle);

        const startAngle = currentAngle;
        const totalDelta = targetAngle - startAngle;
        const duration = 3500 + Math.random() * 1500;
        const startTime = performance.now();

        function easeOutQuart(t) {
            return 1 - Math.pow(1 - t, 4);
        }

        function animate(now) {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = easeOutQuart(t);

            currentAngle = startAngle + totalDelta * eased;
            drawWheel();

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                currentAngle = targetAngle;
                drawWheel();
                spinning = false;
                landedTeamIndex = getTeamAtPointer();
                showPickModal();
            }
        }

        requestAnimationFrame(animate);
    }

    function showPickModal() {
        const team = TEAMS[landedTeamIndex];
        modalTeamBanner.style.background = `linear-gradient(135deg, ${team.color1}, ${team.color2})`;
        modalTeamName.textContent = team.name;

        positionButtonsContainer.innerHTML = '';
        selectedPosition = null;
        nameEntry.style.display = 'none';
        playerInput.value = '';

        const remaining = POSITIONS.filter(p => !filledPositions[p]);
        remaining.forEach(pos => {
            const btn = document.createElement('button');
            btn.className = 'pos-btn';
            btn.textContent = pos;
            btn.addEventListener('click', () => selectPosition(pos, btn));
            positionButtonsContainer.appendChild(btn);
        });

        pickModal.classList.add('active');
    }

    function selectPosition(pos, btn) {
        document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedPosition = pos;

        const team = TEAMS[landedTeamIndex];
        const isAutoFill = pos === 'Coach' || pos === 'Defense';

        if (isAutoFill) {
            confirmPick(team.name);
        } else {
            nameLabel.textContent = `Enter a ${pos} for the ${team.name}:`;
            nameEntry.style.display = 'block';
            playerInput.value = '';
            playerInput.focus();
            confirmBtn.disabled = false;
        }
    }

    function confirmPick(overrideName) {
        const name = overrideName !== undefined ? overrideName : playerInput.value.trim();
        if (!name || !selectedPosition || landedTeamIndex === null) return;

        const team = TEAMS[landedTeamIndex];

        filledPositions[selectedPosition] = {
            name: name,
            teamIndex: landedTeamIndex,
            teamName: team.name,
            teamAbbr: team.abbr,
            color1: team.color1,
            color2: team.color2,
        };

        usedTeams.add(landedTeamIndex);

        const slot = document.querySelector(`.roster-slot[data-position="${selectedPosition}"]`);
        slot.classList.add('filled');
        slot.style.borderLeftColor = team.color1;
        slot.style.setProperty('--team-color', team.color1);
        const nameEl = slot.querySelector('.player-name');
        nameEl.textContent = name;
        nameEl.style.color = (selectedPosition === 'Coach' || selectedPosition === 'Defense') ? team.color1 : '';
        slot.querySelector('.team-badge').textContent = team.abbr;

        pickModal.classList.remove('active');
        drawWheel();
        updateProgress();

        if (Object.keys(filledPositions).length >= POSITIONS.length) {
            setTimeout(showResults, 600);
        } else {
            spinBtn.disabled = false;
        }
    }

    function updateProgress() {
        const count = Object.keys(filledPositions).length;
        rosterProgress.textContent = `${count} / ${POSITIONS.length} positions filled`;
    }

    function showResults() {
        const resultsRoster = document.getElementById('results-roster');
        resultsRoster.innerHTML = '';

        POSITIONS.forEach(pos => {
            const entry = filledPositions[pos];
            if (!entry) return;

            const row = document.createElement('div');
            row.className = 'results-row';
            row.style.borderLeftColor = entry.color1;
            row.style.setProperty('--team-color', entry.color1);

            const nameStyle = (pos === 'Coach' || pos === 'Defense') ? ` style="color: ${entry.color1}; font-weight: 600;"` : '';
            row.innerHTML = `
                <span class="position-label">${pos === 'Defense' ? 'DEF' : pos === 'Coach' ? 'HC' : pos}</span>
                <span class="player-name"${nameStyle}>${entry.name}</span>
                <span class="team-badge">${entry.teamAbbr}</span>
            `;
            resultsRoster.appendChild(row);
        });

        resultsOverlay.classList.add('active');
    }

    spinBtn.addEventListener('click', spin);

    confirmBtn.addEventListener('click', () => confirmPick());

    playerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmPick();
    });

    playAgainBtn.addEventListener('click', init);

    init();
})();
