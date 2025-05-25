document.addEventListener('DOMContentLoaded', async () => {
  console.log('Loaded script.js v5 (enhanced explanation)');

  alert("Guess the day of the week for the randomly generated date!");

  const daysOrdered = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let currentDate, lastGuess;
  let score = { correct:0, wrong:0, streak:0 },
      solveTimes = [],
      streakTimes = [];

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

  const streaksRef = db.collection('streaks');
  let timerInterval, startTime;

  // Firestore helpers (unchanged) …
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
        dateSet = d.timestamp.toDate().toLocaleDateString('en-US', {
          year:'numeric', month:'long', day:'numeric'
        });
      }
      return {
        name: d.name,
        streak: d.streak,
        avgTime: d.avgTime || '--:--.--',
        dateSet
      };
    });
  }

  // date + timer util (unchanged) …
  function pickRandomDate() {
    const p = Math.random() < 0.85;
    const start = p ? new Date(1970,0,1) : new Date(1900,0,1);
    const end   = p ? new Date() : new Date(1969,11,31);
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
  function stopTimer() { clearInterval(timerInterval); }

  // UI renderers (unchanged) …
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
          sum  = solveTimes.reduce((a,b)=>a+b,0),
          avg  = sum/solveTimes.length;
    bestTimeEl.textContent = formatTime(best);
    avgTimeEl.textContent  = formatTime(avg);
  }

  // Century & month codes
  function centuryCode(year) {
    const table = {17:0,18:5,19:3,20:2};
    return table[Math.floor(year/100)] ?? 0;
  }
  function monthCode(month) {
    // Jan=1…Dec=12
    const map = {1:0,2:3,3:3,4:6,5:1,6:4,7:6,8:2,9:5,10:0,11:3,12:5};
    return map[month];
  }
  function yearCode(y) {
    // odd+11 method on last two digits
    let a = y % 100;
    let steps = [];
    steps.push(`${a} (last two digits)`);
    if (a %2) { a+=11; steps.push(`<span style="color:var(--highlight)">was odd → +11 = ${a}</span>`); }
    a = a/2;
    steps.push(`${a} (÷2)`);
    if (a %2) { a+=11; steps.push(`<span style="color:var(--highlight)">was odd → +11 = ${a}</span>`); }
    return { code: a %7, steps };
  }

  // Build the teaching explanation
  function buildExplanation(d, userGuess) {
    const Y = d.getFullYear(),
          M = d.getMonth()+1,
          D = d.getDate();

    // 1) year code
    const yc = yearCode(Y);
    // 2) century code
    const cc = centuryCode(Y);
    // 3) month code
    const mc = monthCode(M);
    // total & weekday
    const total = yc.code + cc + mc + D,
          wdIdx = total %7,
          correct = daysOrdered[wdIdx];

    // anchor demonstration (doomsday)
    const anchorDay = M===2 && ((Y%4===0&&Y%100!==0)||(Y%400===0)) ? 29 : // Feb leap
                      [4,6,8,10,12].includes(M) ? M :  // even months: 4/4,6/6,8/8,...
                      M-1;                              // odd months pick previous even
    const diff = D - anchorDay; // simple difference
    const anchorWeekdayIdx = (total - D + anchorDay) %7;
    const anchorWeekday = daysOrdered[anchorWeekdayIdx];

    return `
      <p><strong>Overview:</strong> First compute your <em>year code</em> via odd+11, then add the <em>century code</em> (1700→0, 1800→5, 1900→3, 2000→2), then add the <em>month code</em>, and finally add the <em>day of the month</em>.  Modulo 7 gives you the weekday.</p>
      <ol style="text-align:left">
        <li><strong>Year code</strong> for ${Y}:<br>${yc.steps.join('<br>')}<br>&rarr; <em>Year code</em> = ${yc.code}</li>
        <li><strong>Century code</strong> for ${Y}: = ${cc}</li>
        <li><strong>Month code</strong> for ${d.toLocaleString('en-US',{month:'long'})}: = ${mc}</li>
        <li><strong>Day</strong>: ${D}</li>
        <li><strong>Total</strong>: ${yc.code} + ${cc} + ${mc} + ${D} = ${total}</li>
        <li><strong>Total mod 7</strong>: ${total} mod 7 = ${wdIdx} → <em>${correct}</em></li>
      </ol>
      <p><strong>Anchor‐day method:</strong> each even month has a “doomsday” date (e.g. 4/4, 6/6, 8/8…), and in leap years Feb 29 is the anchor.  That date always falls on the same weekday as your computed weekday.  Here, the anchor is <strong>${M}/${anchorDay}</strong> which is <strong>${anchorWeekday}</strong>.  Your target day ${M}/${D} is ${diff>0?diff+' day'+(diff>1?'s':'')+' after':''+Math.abs(diff)+' day'+(Math.abs(diff)>1?'s':'')+' before'} → <strong>${correct}</strong>.</p>
      <p>Your answer was <strong style="color:var(--red)">${userGuess}</strong>, correct is <strong style="color:var(--green)">${correct}</strong>.</p>
    `;
  }

  // handle guess
  async function handleGuess(btn, day) {
    stopTimer();
    const elapsed = Date.now() - startTime;
    updateMetrics(elapsed);
    document.querySelectorAll('.day-btn').forEach(b=>b.disabled=true);

    lastGuess = day;  // store for explanation

    if (day === daysOrdered[currentDate.getDay()]) {
      // correct
      btn.classList.add('correct');
      dateDisplay.classList.add('correct');
      score.correct++; score.streak++;
      streakTimes.push(elapsed);

    } else {
      // wrong
      btn.classList.add('wrong');
      dateDisplay.classList.add('wrong');
      score.wrong++;

      // show Why? button
      whyBtn.style.display = 'inline-block';

      // check record end (unchanged) …
      const finalStreak = score.streak,
            prevMax     = await getHighScore();
      if (finalStreak > prevMax) {
        const sumSt = streakTimes.reduce((a,b)=>a+b,0),
              avgStr = formatTime(sumSt / streakTimes.length);
        const name = prompt(`🎉 New record! Streak: ${finalStreak}\nAvg time: ${avgStr}\nEnter your name:`);
        if (name) await saveStreak(name.trim(), finalStreak, avgStr);
      }
      score.streak = 0;
      streakTimes = [];

      // highlight correct
      document.querySelectorAll('.day-btn').forEach(b=>{
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

  // New round
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

  // Why? explanation popup
  whyBtn.onclick = () => {
    whyContent.innerHTML = buildExplanation(currentDate, lastGuess);
    whyModal.classList.remove('hidden');
  };
  closeWhyBtn.onclick = () => whyModal.classList.add('hidden');

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
  closeLbBtn.onclick = () => lbModal.classList.add('hidden');

  // Wire Start/Next
  startBtn.onclick = newRound;
  nextBtn.onclick  = newRound;

  // Initial state
  nextBtn.style.display  = 'none';
  startBtn.style.display = 'inline-block';
  lbModal.classList.add('hidden');
  whyModal.classList.add('hidden');
});
