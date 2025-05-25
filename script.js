document.addEventListener('DOMContentLoaded', async () => {
  console.log('Loaded script.js v6 (fixed explanation)');

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

  // … Firestore helpers & date/timer utils unchanged …

  // Century code table
  const centuryTable = {17:0, 18:5, 19:3, 20:2};
  function centuryCode(year) {
    return centuryTable[Math.floor(year/100)] || 0;
  }

  // Month “doomsday” anchors per your list
  function anchorDay(month, year) {
    const leap = (year%4===0 && year%100!==0) || (year%400===0);
    const anchors = {
      1: leap?4:3, 2:14, 3:14, 4:4, 5:9, 6:6,
      7:4, 8:8, 9:5, 10:10, 11:7, 12:12
    };
    return anchors[month];
  }

  // Odd+11 → divide by 2 until even
  function computeYearCode(year) {
    let y = year % 100, steps = [];
    steps.push(`${y} (last two digits)`);
    while (y % 2 !== 0) {
      steps.push(`<span style="color:var(--highlight)">${y} is odd → +11 = ${y+11}</span>`);
      y += 11;
    }
    steps.push(`${y} (now even)`);
    while (y % 2 === 0 && y > 0) {
      y /= 2;
      steps.push(`${y} (÷2)`);
      if (y % 2 !== 0) {
        steps.push(`<span style="color:var(--highlight)">${y} is odd → +11 = ${y+11}</span>`);
        y += 11;
      }
    }
    // final code mod 7
    const code = y % 7;
    steps.push(`→ Year code = ${code}`);
    return { code, steps };
  }

  function monthCode(month) {
    const map = {1:0,2:3,3:3,4:6,5:1,6:4,7:6,8:2,9:5,10:0,11:3,12:5};
    return map[month] || 0;
  }

  // Build the “Why?” explanation
  function buildExplanation(d, guess) {
    const Y = d.getFullYear(),
          M = d.getMonth()+1,
          D = d.getDate();
    // 1) Year code
    const yc = computeYearCode(Y);
    // 2) Century code
    const cc = centuryCode(Y);
    // 3) Month code
    const mc = monthCode(M);
    // 4) Day
    // 5) Sum + mod7
    const total     = yc.code + cc + mc + D,
          wdIndex   = total % 7,
          correct   = daysOrdered[wdIndex];
    // 6) Anchor‐day
    const aDay      = anchorDay(M,Y),
          anchorSum = yc.code + cc + mc + aDay,
          anchorWd  = daysOrdered[anchorSum % 7],
          diff       = D - aDay,
          diffText  = diff > 0
                      ? `${diff} day${diff>1?'s':''} after`
                      : `${Math.abs(diff)} day${Math.abs(diff)>1?'s':''} before`;

    return `
      <p>For <strong>${d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</strong>:</p>
      <p><strong>Step 1 – Year code</strong> via odd+11:<br>
      ${yc.steps.join('<br>')}</p>

      <p><strong>Step 2 – Century code</strong> (1700→0, 1800→5, 1900→3, 2000→2): <strong>${cc}</strong></p>
      <p><strong>Step 3 – Month code</strong> for ${d.toLocaleString('en-US',{month:'long'})}: <strong>${mc}</strong></p>
      <p><strong>Step 4 – Day</strong>: <strong>${D}</strong></p>

      <p><strong>Step 5 – Total</strong>: ${yc.code} + ${cc} + ${mc} + ${D} = <strong>${total}</strong><br>
      <strong>Step 6 – Mod 7</strong>: ${total} mod 7 = <strong>${wdIndex}</strong> → <strong>${correct}</strong></p>

      <hr>

      <p><strong>Anchor‐day method</strong>: each month’s “doomsday” is:</p>
      <ul style="list-style:none; text-align:left; padding-left:0;">
        <li>Jan ${anchorDay(1,Y)}, Feb 14, Mar 14, Apr 4, May 9, Jun 6,</li>
        <li>Jul 4, Aug 8, Sep 5, Oct 10, Nov 7, Dec 12</li>
      </ul>
      <p>That date always falls on the same weekday as your computed day. Here, <strong>${M}/${aDay}</strong> is on <strong>${anchorWd}</strong>, and your target <strong>${M}/${D}</strong> is ${diffText} → <strong>${correct}</strong>.</p>

      <hr>

      <p>Your answer was <strong style="color:var(--red)">${guess}</strong>, correct is <strong style="color:var(--green)">${correct}</strong>.</p>
    `;
  }

  // … handleGuess, newRound, leaderboard code unchanged …
  async function handleGuess(btn, day) {
    stopTimer();
    const elapsed = Date.now() - startTime;
    updateMetrics(elapsed);
    document.querySelectorAll('.day-btn').forEach(b=>b.disabled=true);

    lastGuess = day;
    if (day === daysOrdered[currentDate.getDay()]) {
      btn.classList.add('correct');
      dateDisplay.classList.add('correct');
      score.correct++; score.streak++; streakTimes.push(elapsed);
    } else {
      btn.classList.add('wrong');
      dateDisplay.classList.add('wrong');
      score.wrong++;
      whyBtn.style.display = 'inline-block';
      // record‐end logic …
      const finalStreak = score.streak, prevMax = await getHighScore();
      if (finalStreak > prevMax) {
        const sumSt = streakTimes.reduce((a,b)=>a+b,0),
              avgStr= formatTime(sumSt/streakTimes.length),
              name  = prompt(`🎉 New record! Streak: ${finalStreak}\nAvg time: ${avgStr}\nEnter your name:`);
        if (name) await saveStreak(name.trim(), finalStreak, avgStr);
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

  whyBtn.onclick = () => {
    whyContent.innerHTML = buildExplanation(currentDate, lastGuess);
    whyModal.classList.remove('hidden');
  };
  closeWhyBtn.onclick = ()=> whyModal.classList.add('hidden');

  // … rest of wiring (startBtn, nextBtn, leaderboard) …
  startBtn.onclick = newRound;
  nextBtn.onclick  = newRound;
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
  closeLbBtn.onclick = ()=> lbModal.classList.add('hidden');

  // Initial UI
  nextBtn.style.display  = 'none';
  startBtn.style.display = 'inline-block';
  lbModal.classList.add('hidden');
  whyModal.classList.add('hidden');
});
