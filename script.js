document.addEventListener('DOMContentLoaded', async () => {
  const daysOrdered = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  let startTime, timerInterval, currentAnswer;
  let score = { correct:0, wrong:0, streak:0 }, solveTimes = [];

  // grab elements
  const dateDisplay    = document.getElementById('date-display'),
        timerEl        = document.getElementById('timer'),
        buttonsDiv     = document.getElementById('buttons'),
        startBtn       = document.getElementById('start-btn'),
        nextBtn        = document.getElementById('next-btn'),
        leaderboardBtn = document.getElementById('leaderboard-btn'),
        correctEl      = document.getElementById('correct-count'),
        wrongEl        = document.getElementById('wrong-count'),
        streakEl       = document.getElementById('streak-count'),
        bestTimeEl     = document.getElementById('best-time'),
        avgTimeEl      = document.getElementById('avg-time'),
        lbModal        = document.getElementById('leaderboard-modal'),
        lbList         = document.getElementById('leaderboard-list'),
        closeLbBtn     = document.getElementById('close-leaderboard');

  const streaksRef = db.collection('streaks');

  // Firestore helpers
  async function getHighScore() {
    const snap = await streaksRef.orderBy('streak','desc').limit(1).get();
    return snap.empty ? 0 : snap.docs[0].data().streak;
  }
  async function saveStreak(name, streak) {
    await streaksRef.add({
      name: name.trim(),
      streak,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  async function loadLeaderboardData() {
    const snap = await streaksRef.orderBy('streak','desc').limit(10).get();
    return snap.docs.map(d => d.data());
  }

  // date / timer
  function pickRandomDate() {
    if (Math.random() < 0.85) {
      const a = new Date(1970,0,1).getTime(), b = Date.now();
      return new Date(a + Math.random()*(b-a));
    } else {
      const a = new Date(1900,0,1).getTime(), b = new Date(1969,11,31).getTime();
      return new Date(a + Math.random()*(b-a));
    }
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
    timerInterval = setInterval(()=>{
      timerEl.textContent = formatTime(Date.now() - startTime);
    },30);
  }
  function stopTimer(){ clearInterval(timerInterval); }

  // render day buttons
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

  // handle a guess
  async function handleGuess(btn, day) {
    stopTimer();
    const elapsed = Date.now() - startTime;
    updateMetrics(elapsed);

    // lock buttons
    document.querySelectorAll('.day-btn').forEach(b=>b.disabled=true);

    if (day === currentAnswer) {
      // correct
      btn.classList.add('correct');
      dateDisplay.classList.add('correct');
      score.correct++;
      score.streak++;
    } else {
      // wrong: check if you just beat the record
      const finalStreak = score.streak;
      const prevMax    = await getHighScore();
      if (finalStreak > prevMax) {
        const name = prompt(`🎉 You set a new top streak of ${finalStreak}! Enter your name:`);
        if (name) await saveStreak(name, finalStreak);
      }

      btn.classList.add('wrong');
      dateDisplay.classList.add('wrong');
      score.wrong++;
      score.streak = 0;

      // highlight actual day
      document.querySelectorAll('.day-btn').forEach(b=>{
        if (b.textContent === currentAnswer) b.classList.add('expected');
      });
    }

    // update scoreboard & show Next
    correctEl.textContent = score.correct;
    wrongEl.textContent   = score.wrong;
    streakEl.textContent  = score.streak;
    nextBtn.style.display  = 'inline-block';
  }

  // start a new round
  function newRound() {
    dateDisplay.classList.remove('correct','wrong');
    buttonsDiv.innerHTML = '';
    nextBtn.style.display  = 'none';
    startBtn.style.display = 'none';

    const d = pickRandomDate(),
          jsDay = d.getDay(),
          idx   = jsDay===0?6:jsDay-1;
    currentAnswer = daysOrdered[idx];
    dateDisplay.textContent = d.toLocaleDateString('en-US',{
      year:'numeric', month:'long', day:'numeric'
    });

    renderButtons();
    startTimer();
  }

  // leaderboard modal
  leaderboardBtn.onclick = async () => {
    const entries = await loadLeaderboardData();
    lbList.innerHTML = '';
    entries.forEach(e => {
      const li = document.createElement('li');
      li.textContent = `${e.name}: ${e.streak}`;
      lbList.appendChild(li);
    });
    lbModal.classList.remove('hidden');
  };
  closeLbBtn.onclick = () => lbModal.classList.add('hidden');

  // wire start/next
  startBtn.onclick = newRound;
  nextBtn.onclick  = newRound;

  // initial UI
  nextBtn.style.display  = 'none';
  startBtn.style.display = 'inline-block';
  lbModal.classList.add('hidden');
});
