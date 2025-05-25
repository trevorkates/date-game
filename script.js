document.addEventListener('DOMContentLoaded', async () => {
  console.log('Loaded script.js v9');

  // Intro popup
  alert("Guess the day of the week for the randomly generated date!");

  // Day names
  const daysOrdered = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  // State
  let currentDate, lastGuess;
  let score = { correct: 0, wrong: 0, streak: 0 };
  let solveTimes = [], streakTimes = [];
  let timerInterval, startTime;

  // DOM refs
  const dateDisplay    = document.getElementById('date-display'),
        timerEl        = document.getElementById('timer'),
        buttonsDiv     = document.getElementById('buttons'),
        startBtn       = document.getElementById('start-btn'),
        nextBtn        = document.getElementById('next-btn'),
        leaderboardBtn = document.getElementById('leaderboard-btn'),
        whyBtn         = document.getElementById('why-btn'),
        correctEl      = document.getElementById('correct-count'),
        wrongEl        = document.getElementById('wrong-count'),
        streakEl       = document.getElementById('streak-count'),
        bestTimeEl     = document.getElementById('best-time'),
        avgTimeEl      = document.getElementById('avg-time'),
        whyModal       = document.getElementById('why-modal'),
        whyContent     = document.getElementById('why-content'),
        closeWhyBtn    = document.getElementById('close-why'),
        lbModal        = document.getElementById('leaderboard-modal'),
        lbList         = document.getElementById('leaderboard-list'),
        closeLbBtn     = document.getElementById('close-leaderboard');

  // Firestore collection
  const streaksRef = db.collection('streaks');

  // Firestore helpers
  async function getHighScore() {
    const snap = await streaksRef.orderBy('streak','desc').limit(1).get();
    return snap.empty ? 0 : snap.docs[0].data().streak;
  }
  async function saveStreak(name, streak, avgTime) {
    await streaksRef.add({
      name,
      streak,
      avgTime,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  async function loadLeaderboardData() {
    const snap = await streaksRef.orderBy('streak','desc').limit(10).get();
    return snap.docs.map(doc => {
      const d = doc.data();
      let dateSet = '--';
      if (d.timestamp?.toDate) {
        dateSet = d.timestamp.toDate().toLocaleDateString('en-US',{
          year:'numeric', month:'long', day:'numeric'
        });
      }
      return {
        name:    d.name,
        streak:  d.streak,
        avgTime: d.avgTime || '--:--.--',
        dateSet
      };
    });
  }

  // Date & timer utils
  function pickRandomDate() {
    const modern = Math.random() < 0.85;
    const start  = modern
      ? new Date(1970,0,1)
      : new Date(1900,0,1);
    const end    = modern
      ? new Date()
      : new Date(1969,11,31);
    return new Date(start.getTime() + Math.random()*(end.getTime() - start.getTime()));
  }
  function formatTime(ms) {
    const m = Math.floor(ms/60000),
          s = Math.floor((ms%60000)/1000),
          h = Math.floor((ms%1000)/10);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(h).padStart(2,'0')}`;
  }
  function startTimer() {
    clearInterval(timerInterval);
    startTime = Date.now();
    timerEl.textContent = '00:00.00';
    timerInterval = setInterval(() => {
      timerEl.textContent = formatTime(Date.now() - startTime);
    }, 30);
  }
  function stopTimer() {
    clearInterval(timerInterval);
  }

  // UI rendering
  function renderButtons() {
    buttonsDiv.innerHTML = '';
    daysOrdered.forEach(day => {
      const btn = document.createElement('button');
      btn.textContent = day;
      btn.className   = 'day-btn';
      btn.disabled    = false;
      btn.onclick     = () => handleGuess(btn, day);
      buttonsDiv.appendChild(btn);
    });
  }
  function updateMetrics(elapsed) {
    solveTimes.push(elapsed);
    const best = Math.min(...solveTimes),
          sum  = solveTimes.reduce((a,b)=>a+b, 0),
          avg  = sum / solveTimes.length;
    bestTimeEl.textContent = formatTime(best);
    avgTimeEl.textContent  = formatTime(avg);
  }

  // Century & month codes
  const centuryTable = {17:0,18:5,19:3,20:2};
  function centuryCode(year) {
    return centuryTable[Math.floor(year/100)] || 0;
  }

  function anchorDay(month, year) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  if (month === 1) return leap ? 4 : 3;
  if (month === 2) return leap ? 15 : 14;          // ← now handles Feb 14 vs Feb 15
  const table = {
    3: 14, 4: 4, 5: 9, 6: 6,
    7: 4,  8: 8, 9: 5, 10: 10,
    11: 7, 12:12
  };
  return table[month] || 0;
}

  // Odd+11 year-code (two-step + 7's complement)
  function computeYearCode(year) {
    let y = year % 100;
    const steps = [];
    steps.push(`<span style="color:var(--navy)">${y}</span> (last two digits)`);

    // Step 1: if odd
    if (y % 2 !== 0) {
      steps.push(`<span style="color:var(--highlight)">${y} is odd → +11 = ${y+11}</span>`);
      y += 11;
    }
    // Step 2: divide by 2
    steps.push(`<span style="color:var(--gold)">${y} ÷ 2 = ${y/2}</span>`);
    y = y / 2;

    // if still odd
    if (y % 2 !== 0) {
      steps.push(`<span style="color:var(--highlight)">${y} is odd → +11 = ${y+11}</span>`);
      y += 11;
    }

    // mod 7
    const rem = y % 7;
    steps.push(`<span style="color:var(--green)">${y} mod 7 = ${rem}</span>`);

    // 7's complement
    const code = (7 - rem) % 7;
    steps.push(`<span style="color:var(--navy)">7 − ${rem} = ${code}</span>`);

    return { code, steps };
  }

  // Build “Why?” explanation
  function buildExplanation(d, guess) {
    const Y = d.getFullYear(),
          M = d.getMonth() + 1,
          D = d.getDate();

    // compute codes
    const yc = computeYearCode(Y),
          cc = centuryCode(Y);

    // final weekday
    const total   = yc.code + cc,
          wdIndex = total % 7;

    // anchor-day
    const aDay     = anchorDay(M, Y),
          diff     = D - aDay,
          idx = ((wdIndex + diff) % 7 + 7) % 7,
          correct = daysOrdered[idx],
      // helper to pick “s” only if the number isn’t 1
          plural = n => n === 1 ? '' : 's',
          diffText = diff > 0
              ? `${diff} day${plural(diff)} after`
              : `${Math.abs(diff)} day${plural(Math.abs(diff))} before`;

    return `
      <p>For <strong>${d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</strong>:</p>

      <p><strong>1) Year code</strong> via odd+11:<br>
      ${yc.steps.join('<br>')}</p>

      <p><strong>2) Century code</strong> (1700→0,1800→5,1900→3,2000→2): <strong>${cc}</strong></p>

      <p><strong>3) Total</strong>: ${yc.code} + ${cc} = <strong>${total}</strong><br>

      <hr>

      <p><strong>Anchor-day method</strong> (this day is always year code + century code)</p>
      <ul style="list-style:none;text-align:left;padding:0;">
        <li>Jan ${anchorDay(1,Y)}, Feb ${anchorDay(2,Y)}, Mar 14, Apr 4, May 9, Jun 6,</li>
        <li>Jul 4, Aug 8, Sep 5, Oct 10, Nov 7, Dec 12</li>
      </ul> 
      Your date <strong>${M}/${D}</strong> is ${diffText} <strong>${M}/${aDay}</strong> → <strong>${correct}</strong>.
      <hr>
      <p>Your answer was <strong style="color:var(--red)">${guess}</strong>, 
      correct is <strong style="color:var(--green)">${correct}</strong>.</p>
    `;
  }

  // Handle a guess
  async function handleGuess(btn, day) {
    stopTimer();
    const elapsed = Date.now() - startTime;
    updateMetrics(elapsed);
    document.querySelectorAll('.day-btn').forEach(b => b.disabled = true);

    lastGuess = day;
    if (day === daysOrdered[currentDate.getDay()]) {
      btn.classList.add('correct');
      dateDisplay.classList.add('correct');
      score.correct++;
      score.streak++;
      streakTimes.push(elapsed);
    } else {
      btn.classList.add('wrong');
      dateDisplay.classList.add('wrong');
      score.wrong++;
      whyBtn.style.display = 'inline-block';

      // end-of-streak record check
      const prevMax = await getHighScore();
      if (score.streak > prevMax) {
        const sum   = streakTimes.reduce((a,b)=>a+b,0),
              avg   = formatTime(sum / streakTimes.length),
              name  = prompt(`🎉 New record! Streak: ${score.streak}\nAvg time: ${avg}\nEnter your name:`);
        if (name) await saveStreak(name.trim(), score.streak, avg);
      }
      score.streak = 0;
      streakTimes = [];

      document.querySelectorAll('.day-btn').forEach(b => {
        if (b.textContent === daysOrdered[currentDate.getDay()]) {
          b.classList.add('expected');
        }
      });
    }

    correctEl.textContent = score.correct;
    wrongEl.textContent   = score.wrong;
    streakEl.textContent  = score.streak;
    nextBtn.style.display  = 'inline-block';
  }

  // Start a new round
  function newRound() {
    dateDisplay.classList.remove('correct','wrong');
    buttonsDiv.innerHTML  = '';
    whyBtn.style.display   = 'none';
    nextBtn.style.display  = 'none';
    startBtn.style.display = 'none';

    currentDate = pickRandomDate();
    dateDisplay.textContent = currentDate.toLocaleDateString('en-US',{
      year:'numeric', month:'long', day:'numeric'
    });

    renderButtons();
    startTimer();
  }

  // “Why?” popup
  whyBtn.onclick = () => {
    whyContent.innerHTML = buildExplanation(currentDate, lastGuess);
    whyModal.classList.remove('hidden');
  };
  closeWhyBtn.onclick = () => {
    whyModal.classList.add('hidden');
  };

  // Leaderboard popup
  leaderboardBtn.onclick = async () => {
    const entries = await loadLeaderboardData();
    lbList.innerHTML = '';
    entries.forEach(e => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${e.name}</strong> – Streak: ${e.streak}, Avg: ${e.avgTime}, Date: ${e.dateSet}`;
      lbList.appendChild(li);
    });
    lbModal.classList.remove('hidden');
  };
  closeLbBtn.onclick = () => {
    lbModal.classList.add('hidden');
  };

  // Wire Start & Next
  startBtn.onclick = newRound;
  nextBtn.onclick  = newRound;

  // Initial UI
  nextBtn.style.display  = 'none';
  startBtn.style.display = 'inline-block';
  lbModal.classList.add('hidden');
  whyModal.classList.add('hidden');
});
