document.addEventListener('DOMContentLoaded', async () => {
  console.log('Loaded script.js v7');

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

  // → Firestore helpers
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
        dateSet = d.timestamp.toDate().toLocaleDateString('en-US',{ year:'numeric', month:'long', day:'numeric' });
      }
      return { name:d.name, streak:d.streak, avgTime:d.avgTime||'--:--.--', dateSet };
    });
  }

  // → Date & timer utilities
  function pickRandomDate() {
    const useModern = Math.random() < 0.85;
    const start = useModern ? new Date(1970,0,1) : new Date(1900,0,1);
    const end   = useModern ? new Date()           : new Date(1969,11,31);
    return new Date(start.getTime() + Math.random()*(end.getTime()-start.getTime()));
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

  // → Render UI
  function renderButtons() {
    buttonsDiv.innerHTML = '';
    daysOrdered.forEach(day => {
      const btn = document.createElement('button');
      btn.textContent = day;
      btn.className = 'day-btn';
      btn.disabled  = false;
      btn.onclick   = () => handleGuess(btn, day);
      buttonsDiv.appendChild(btn);
    });
  }
  function updateMetrics(elapsed) {
    solveTimes.push(elapsed);
    const best = Math.min(...solveTimes),
          sum  = solveTimes.reduce((a,b)=>a+b,0),
          avg  = sum/solveTimes.length;
    bestTimeEl.textContent = formatTime(best);
    avgTimeEl.textContent  = formatTime(avg);
  }

  // → Century & month codes
  const centuryTable = {17:0,18:5,19:3,20:2};
  function centuryCode(year) {
    return centuryTable[Math.floor(year/100)] || 0;
  }
  function monthCode(month) {
    const map = {1:0,2:3,3:3,4:6,5:1,6:4,7:6,8:2,9:5,10:0,11:3,12:5};
    return map[month] || 0;
  }
  // “Doomsday” anchors as you specified
  function anchorDay(month, year) {
    const leap = (year%4===0 && year%100!==0) || (year%400===0);
    const anchors = {1:leap?4:3,2:14,3:14,4:4,5:9,6:6,7:4,8:8,9:5,10:10,11:7,12:12};
    return anchors[month];
  }

  // → Odd+11 year-code
  function computeYearCode(year) {
    let y = year % 100,
        steps = [`${y} (last two digits)`];
    while (y % 2 !== 0) {
      steps.push(`<span style="color:var(--highlight)">${y} is odd → +11 = ${y+11}</span>`);
      y += 11;
    }
    steps.push(`${y} (now even)`);
    while (y > 0 && y % 2 === 0) {
      y /= 2;
      steps.push(`${y} (÷2)`);
      if (y %2 !==0) {
        steps.push(`<span style="color:var(--highlight)">${y} is odd → +11 = ${y+11}</span>`);
        y += 11;
      }
    }
    const code = y % 7;
    steps.push(`→ Year code = ${code}`);
    return { code, steps };
  }

  // → Build “Why?” explanation
  function buildExplanation(d, guess) {
    const Y = d.getFullYear(),
          M = d.getMonth()+1,
          D = d.getDate();
    // Year, century, month, day
    const yc = computeYearCode(Y),
          cc = centuryCode(Y),
          mc = monthCode(M),
          total = yc.code + cc + mc + D,
          wdIndex = total %7,
          correct = daysOrdered[wdIndex];
    // Anchor method
    const aDay = anchorDay(M,Y),
          sumA = yc.code + cc + mc + aDay,
          aWd  = daysOrdered[sumA %7],
          diff = D - aDay,
          diffText = diff>0
                     ? `${diff} day${diff>1?'s':''} after`
                     : `${Math.abs(diff)} day${Math.abs(diff)>1?'s':''} before`;

    return `
      <p>For <strong>${d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</strong>:</p>
      <p><strong>1) Year code</strong> via odd+11:<br>${yc.steps.join('<br>')}</p>
      <p><strong>2) Century code</strong> (1700→0,1800→5,1900→3,2000→2): <strong>${cc}</strong></p>
      <p><strong>3) Month code</strong>: <strong>${mc}</strong> &nbsp; <strong>4) Day</strong>: <strong>${D}</strong></p>
      <p><strong>5) Total</strong>: ${yc.code} + ${cc} + ${mc} + ${D} = <strong>${total}</strong><br>
      <strong>6) Mod 7</strong>: ${total} mod 7 = <strong>${wdIndex}</strong> → <strong>${correct}</strong></p>
      <hr>
      <p><strong>Anchor-day method</strong> (“doomsday”):</p>
      <ul style="list-style:none;text-align:left;padding:0;">
        <li>Jan ${anchorDay(1,Y)}, Feb 14, Mar 14, Apr 4, May 9, Jun 6,</li>
        <li>Jul 4, Aug 8, Sep 5, Oct 10, Nov 7, Dec 12</li>
      </ul>
      <p>${M}/${aDay} is on <strong>${aWd}</strong>. ${M}/${D} is ${diffText} → <strong>${correct}</strong>.</p>
      <hr>
      <p>Your answer was <strong style="color:var(--red)">${guess}</strong>, correct is <strong style="color:var(--green)">${correct}</strong>.</p>
    `;
  }

  // → Handle a guess
  async function handleGuess(btn, day) {
    stopTimer();
    const elapsed = Date.now() - startTime;
    updateMetrics(elapsed);
    document.querySelectorAll('.day-btn').forEach(b=>b.disabled=true);

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

      // check record end
      const prevMax = await getHighScore();
      if (score.streak > prevMax) {
        const sumSt = streakTimes.reduce((a,b)=>a+b,0),
              avgStr= formatTime(sumSt/streakTimes.length),
              name  = prompt(`🎉 New record! Streak: ${score.streak}\nAvg time: ${avgStr}\nEnter your name:`);
        if (name) await saveStreak(name.trim(), score.streak, avgStr);
      }
      score.streak=0; streakTimes=[];
      document.querySelectorAll('.day-btn').forEach(b=>{
        if (b.textContent===daysOrdered[currentDate.getDay()]) b.classList.add('expected');
      });
    }

    correctEl.textContent = score.correct;
    wrongEl.textContent   = score.wrong;
    streakEl.textContent  = score.streak;
    nextBtn.style.display  = 'inline-block';
  }

  // → New round
  function newRound() {
    dateDisplay.classList.remove('correct','wrong');
    buttonsDiv.innerHTML = '';
    whyBtn.style.display   = 'none';
    nextBtn.style.display  = 'none';
    startBtn.style.display = 'none';

    currentDate = pickRandomDate();
    dateDisplay.textContent = currentDate.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});

    renderButtons();
    startTimer();
  }

  // → “Why?” popup
  whyBtn.onclick = () => {
    whyContent.innerHTML = buildExplanation(currentDate, lastGuess);
    whyModal.classList.remove('hidden');
  };
  closeWhyBtn.onclick = () => whyModal.classList.add('hidden');

  // → Leaderboard popup
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
  closeLbBtn.onclick = () => lbModal.classList.add('hidden');

  // → Wire Start/Next
  startBtn.onclick = newRound;
  nextBtn.onclick  = newRound;

  // → Initial UI state
  nextBtn.style.display  = 'none';
  startBtn.style.display = 'inline-block';
  lbModal.classList.add('hidden');
  whyModal.classList.add('hidden');
});
