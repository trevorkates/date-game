document.addEventListener('DOMContentLoaded', async () => {
  console.log('Loaded script.js v4 (with “Why?” explanation)');

  // show intro popup
  alert("Guess the day of the week for the randomly generated date!");

  const daysOrdered = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let currentDate, score = { correct:0, wrong:0, streak:0 }, solveTimes = [], streakTimes = [];

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
        lbModal        = document.getElementById('leaderboard-modal'),
        lbList         = document.getElementById('leaderboard-list'),
        closeLbBtn     = document.getElementById('close-leaderboard'),
        whyModal       = document.getElementById('why-modal'),
        whyContent     = document.getElementById('why-content'),
        closeWhyBtn    = document.getElementById('close-why');

  const streaksRef = db.collection('streaks');
  let timerInterval, startTime;

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
      if (d.timestamp && d.timestamp.toDate) {
        dateSet = d.timestamp.toDate().toLocaleDateString('en-US', {
          year:'numeric', month:'long', day:'numeric'
        });
      }
      return { name:d.name, streak:d.streak, avgTime:d.avgTime||'--:--.--', dateSet };
    });
  }

  // date/timer utils
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
  function stopTimer() {
    clearInterval(timerInterval);
  }

  // render buttons
  function renderButtons() {
    buttonsDiv.innerHTML = '';
    // Monday-first? original code used Monday-first; user code stored daysOrdered Sunday-first,
    // but currentAnswer is JavaScript Date.getDay(), so keep Sunday-first array.
    ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      .forEach(day => {
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

  // Odd+11 year-code
  function computeYearCode(year) {
    let y = year % 100;
    if (y % 2) y += 11;
    y /= 2;
    if (y % 2) y += 11;
    return y % 7;
  }
  function monthCode(month, year) {
    const leap = (year%4===0 && year%100!==0) || (year%400===0);
    const map  = {1: leap?6:0, 2: leap?2:3, 3:3,4:6,5:1,6:4,7:6,8:2,9:5,10:0,11:3,12:5};
    return map[month];
  }
  function centuryCode(year) {
    const c = Math.floor(year/100) % 4;
    return (6 - 2*c + 7) % 7;
  }

  // explanation builder
  function buildExplanation(d) {
    const D = d.getDate(),
          M = d.getMonth()+1,
          Y = d.getFullYear(),
          YC1 = Y % 100;
    // steps
    let step1 = YC1, desc1 = `${step1} (last two digits)`;
    if (step1%2) { step1 +=11; desc1 = `<span style="color:var(--highlight)">${YC1} is odd → +11 = ${step1}</span>`; }
    let step2 = step1/2,
        desc2 = `${step2} (divide by 2)`;
    if (step2%2) { step2 +=11; desc2 = `<span style="color:var(--highlight)">${step1} is odd → +11 = ${step2}</span>`; }
    const yearCode = step2 % 7;
    const cCode    = centuryCode(Y),
          mCode    = monthCode(M,Y),
          total    = D + cCode + mCode + yearCode,
          dowIndex = total % 7,
          dowName  = daysOrdered[dowIndex];

    return `
      <p>For <strong>${d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</strong>:</p>
      <ul style="list-style:none;padding:0;">
        <li>1) <strong>Century code</strong> for ${Y}: ${cCode}</li>
        <li>2) <strong>Month code</strong> for ${d.toLocaleString('en-US',{month:'long'})}: ${mCode}</li>
        <li>3) <strong>Day</strong>: ${D}</li>
        <li>4) <strong>Year code</strong> via odd+11 method:
          <ul>
            <li>${desc1}</li>
            <li>${desc2}</li>
            <li>→ <span style="color:var(--navy)">${step2} mod 7 = ${yearCode}</span></li>
          </ul>
        </li>
        <li>5) Sum: ${D} + ${cCode} + ${mCode} + ${yearCode} = ${total}</li>
        <li>6) Mod 7: ${total} mod 7 = ${dowIndex} → <strong>${dowName}</strong></li>
      </ul>
      <p>Your answer was <strong style="color:var(--red)">${currentAnswer}</strong>, correct is <strong style="color:var(--green)">${dowName}</strong>.</p>
    `;
  }

  // handle guess
  async function handleGuess(btn, day) {
    stopTimer();
    const elapsed = Date.now() - startTime;
    updateMetrics(elapsed);
    document.querySelectorAll('.day-btn').forEach(b=>b.disabled=true);

    if (day === currentAnswer) {
      btn.classList.add('correct');
      dateDisplay.classList.add('correct');
      score.correct++;
      score.streak++;
      streakTimes.push(elapsed);

    } else {
      // end streak & prompt if record
      const finalStreak = score.streak,
            prevMax     = await getHighScore();
      if (finalStreak > prevMax) {
        const sumSt = streakTimes.reduce((a,b)=>a+b,0),
              avgSt = sumSt / streakTimes.length,
              avgStr= formatTime(avgSt);
        const name = prompt(`🎉 New record! Streak: ${finalStreak}\nAvg time: ${avgStr}\nEnter your name:`);
        if (name) await saveStreak(name.trim(), finalStreak, avgStr);
      }

      btn.classList.add('wrong');
      dateDisplay.classList.add('wrong');
      score.wrong++;
      score.streak=0;
      streakTimes=[];

      // highlight correct, show Why?
      document.querySelectorAll('.day-btn').forEach(b=>{
        if (b.textContent===currentAnswer) b.classList.add('expected');
      });
      whyBtn.style.display = 'inline-block';
    }

    correctEl.textContent = score.correct;
    wrongEl.textContent   = score.wrong;
    streakEl.textContent  = score.streak;
    nextBtn.style.display  = 'inline-block';
  }

  // new round
  function newRound() {
    dateDisplay.classList.remove('correct','wrong');
    buttonsDiv.innerHTML='';
    whyBtn.style.display   = 'none';
    nextBtn.style.display  = 'none';
    startBtn.style.display = 'none';

    currentDate = pickRandomDate();
    currentAnswer = daysOrdered[currentDate.getDay()];
    dateDisplay.textContent = currentDate.toLocaleDateString('en-US', {
      year:'numeric', month:'long', day:'numeric'
    });

    renderButtons();
    startTimer();
  }

  // show leaderboard
  leaderboardBtn.onclick = async () => {
    const entries = await loadLeaderboardData();
    lbList.innerHTML='';
    entries.forEach(e=>{
      const li = document.createElement('li');
      li.innerHTML = `<strong>${e.name}</strong> – Streak: ${e.streak}, Avg: ${e.avgTime}, Date: ${e.dateSet}`;
      lbList.appendChild(li);
    });
    lbModal.classList.remove('hidden');
  };
  closeLbBtn.onclick = ()=> lbModal.classList.add('hidden');

  // show explanation
  whyBtn.onclick = () => {
    whyContent.innerHTML = buildExplanation(currentDate);
    whyModal.classList.remove('hidden');
  };
  closeWhyBtn.onclick = () => whyModal.classList.add('hidden');

  // wire Start/Next
  startBtn.onclick = newRound;
  nextBtn.onclick  = newRound;

  // initial UI
  nextBtn.style.display  = 'none';
  startBtn.style.display = 'inline-block';
  lbModal.classList.add('hidden');
  whyModal.classList.add('hidden');
});
