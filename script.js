const DEFAULT_CAUGHT_TIME = 0;
const DEFAULT_CAPTURE_DURATION = 60;
const COLLECT_TIME_SECONDS = 60;

let caughtTime = DEFAULT_CAUGHT_TIME;
let capturedDuration = 0;
let lastCapture = 0;
let totalLostTime = 0;
let elapsed = 0;
let isRunning = false;
let timerInterval = null;
let collectInterval = null;
let catchHistory = [];
let currentCatch = null;

function formatClockTime(date) {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  return h + ":" + m + ":" + s;
}

function setCookie(name, value, days = 365) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function saveRunningCatch() {
  setCookie("running_catch", JSON.stringify({
    startTimestamp: currentCatch.startTimestamp,
    duration: currentCatch.duration
  }));
}

function clearRunningCatch() {
  document.cookie = "running_catch=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
}

function loadState() {
  const savedTime = parseInt(getCookie("time_total"), 10);
  if (!isNaN(savedTime)) caughtTime = savedTime;

  const savedLost = parseInt(getCookie("time_lost_total"), 10);
  if (!isNaN(savedLost)) totalLostTime = savedLost;

  const savedHistory = getCookie("catch_history");
  if (savedHistory) {
    try {
      catchHistory = JSON.parse(savedHistory);
      catchHistory.forEach(entry => {
        entry.startTime = new Date(entry.startTime);
        if (entry.canceledAt) entry.canceledAt = new Date(entry.canceledAt);
        if (entry.finishedAt) entry.finishedAt = new Date(entry.finishedAt);
      });
      renderHistory();
    } catch (e) {
      console.error("Failed to parse catch history:", e);
    }
  }

  const savedCatch = getCookie("running_catch");
  if (savedCatch) {
    try {
      const { startTimestamp, duration, canceled } = JSON.parse(savedCatch);

      capturedDuration = duration;
      lastCapture = duration;

      if (canceled) {
        currentCatch = {
          startTime: new Date(startTimestamp),
          startTimestamp,
          expectedEndTime: new Date(startTimestamp + duration * 1000),
          duration,
          status: "canceled",
          canceledAt: new Date(startTimestamp + duration * 1000),
          finishedAt: null,
        };
        document.getElementById("lost-time").textContent = formatDuration(duration);
        document.getElementById("catch-section").style.display = "none";
        document.getElementById("lost-section").style.display = "block";
        return;
      }

      const now = Date.now();
      const catchEndTime = startTimestamp + duration * 1000;
      const collectDeadline = catchEndTime + COLLECT_TIME_SECONDS * 1000;

      currentCatch = {
        startTime: new Date(startTimestamp),
        startTimestamp,
        expectedEndTime: new Date(catchEndTime),
        duration,
        status: "running",
        canceledAt: null,
        finishedAt: null,
      };

      if (now < catchEndTime) {
        setupProgressBar(duration);
        document.getElementById("open-time").textContent = formatClockTime(new Date(catchEndTime));
        document.getElementById("expected-time").textContent = formatDuration(duration);
        document.getElementById("catch-section").style.display = "none";
        document.getElementById("catching-section").style.display = "block";
        startCatchTimer(startTimestamp, duration, catchEndTime);
      } else if (now < collectDeadline) {
        document.getElementById("captured-time").textContent = formatDuration(duration);
        document.getElementById("catch-section").style.display = "none";
        document.getElementById("collect-section").style.display = "block";
        startCollectCountdown(collectDeadline);
      } else {
        // Collect window already passed — show lost screen; history/state saved on reset()
        currentCatch.status = "missed";
        currentCatch.finishedAt = new Date(collectDeadline);
        document.getElementById("lost-time").textContent = formatDuration(duration);
        document.getElementById("catch-section").style.display = "none";
        document.getElementById("lost-section").style.display = "block";
      }
    } catch (e) {
      console.error("Failed to parse running catch:", e);
    }
  }
}

function saveState() {
  setCookie("time_total", caughtTime);
  setCookie("time_lost_total", totalLostTime);
  setCookie("catch_history", JSON.stringify(catchHistory));
}

function addHistory(entry) {
  catchHistory.unshift(entry);
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById("history-list");
  if (!container) return;
  if (catchHistory.length === 0) {
    container.innerHTML = "<p>No catches yet.</p>";
    return;
  }

  container.innerHTML = catchHistory.map(entry => {
    const start = formatDateTime(entry.startTime);
    const end = entry.finishedAt ? formatDateTime(entry.finishedAt) : "--";
    const timeframe = formatDuration(entry.duration);
    let entryHtml = '<div class="history-entry ' + entry.status + '">';

    if (entry.status === "success") {
      entryHtml += `<p><strong>You have collected: ${timeframe}</strong></p>`;
      entryHtml += `<p>Start: ${start}</p>`;
      entryHtml += `<p>End: ${end}</p>`;
    } else if (entry.status === "canceled") {
      const canceled = formatDateTime(entry.canceledAt);
      entryHtml += '<p><strong>Catch canceled.</strong></p>';
      entryHtml += `<p>Time lost: ${timeframe}</p>`;
      entryHtml += `<p>Start: ${start}</p>`;
      entryHtml += `<p>Canceled at: ${canceled}</p>`;
    } else if (entry.status === "missed") {
      entryHtml += `<p><strong>Catch lost: ${timeframe}</strong></p>`;
      entryHtml += `<p>Start: ${start}</p>`;
      entryHtml += `<p>End: ${end} — not collected.</p>`;
    }

    entryHtml += '</div>';
    return entryHtml;
  }).join('<hr>');
}

function updateRange() {
  const maxSec = parseInt(document.getElementById("range-select").value);
  const slider = document.getElementById("duration");
  const currentSeconds = parseInt(slider.value);
  slider.max = maxSec;
  slider.step = 1;
  slider.value = Math.min(currentSeconds, maxSec);
  updateSliderLabel();
}

function formatDateTime(date) {
  const d = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const t = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${d} ${t}`;
}

function updateSliderLabel() {
  const seconds = parseInt(document.getElementById("duration").value, 10);
  const endTime = new Date(Date.now() + seconds * 1000);
  document.getElementById("lbl-duration").textContent = formatDuration(seconds);
  document.getElementById("lbl-endtime").textContent = formatDateTime(endTime);
  document.getElementById("caught-total").textContent = formatDuration(caughtTime);
  document.getElementById("lost-total").textContent = formatDuration(totalLostTime);
}

loadState();
updateSliderLabel();
setInterval(updateSliderLabel, 1000);

function setupProgressBar(duration) {
  const progressEl = document.getElementById("progress");
  const parent = progressEl.parentNode;
  const nextSibling = progressEl.nextSibling;
  parent.removeChild(progressEl);
  const newProgress = document.createElement("progress");
  newProgress.id = "progress";
  newProgress.value = "0";
  newProgress.max = String(duration);
  parent.insertBefore(newProgress, nextSibling);
}

function startCatchTimer(startTimestamp, duration, catchEndTime) {
  isRunning = true;

  function tick() {
    if (!isRunning) return;
    const actualElapsed = Math.floor((Date.now() - startTimestamp) / 1000);
    const remaining = Math.max(0, duration - actualElapsed);
    elapsed = actualElapsed;
    document.getElementById("timer").textContent = formatDuration(remaining);
    document.getElementById("progress").value = actualElapsed;
    if (actualElapsed >= duration) {
      clearInterval(timerInterval);
      timerInterval = null;
      isRunning = false;
      document.getElementById("catching-section").style.display = "none";
      document.getElementById("collect-section").style.display = "block";
      document.getElementById("captured-time").textContent = formatDuration(duration);
      startCollectCountdown(catchEndTime + COLLECT_TIME_SECONDS * 1000);
    }
  }

  timerInterval = setInterval(tick, 100);
  tick();
}

function startCatch() {
  capturedDuration = parseInt(document.getElementById("duration").value, 10);
  const duration = capturedDuration;

  setupProgressBar(duration);
  lastCapture = duration;

  const startTimestamp = Date.now();
  const catchEndTime = startTimestamp + duration * 1000;

  currentCatch = {
    startTime: new Date(startTimestamp),
    startTimestamp,
    expectedEndTime: new Date(catchEndTime),
    duration,
    status: "running",
    canceledAt: null,
    finishedAt: null,
  };

  saveRunningCatch();

  document.getElementById("open-time").textContent = formatClockTime(new Date(catchEndTime));
  document.getElementById("catch-section").style.display = "none";
  document.getElementById("catching-section").style.display = "block";
  document.getElementById("expected-time").textContent = formatDuration(duration);

  startCatchTimer(startTimestamp, duration, catchEndTime);
}

function startCollectCountdown(collectDeadline) {
  function updateCollect() {
    const remaining = Math.max(0, Math.floor((collectDeadline - Date.now()) / 1000));
    document.getElementById("collect-timer").textContent = remaining + "s";
    document.getElementById("collect-progress").value = remaining;
    if (remaining <= 0) {
      clearInterval(collectInterval);
      collectInterval = null;
      if (currentCatch) {
        currentCatch.status = "missed";
        currentCatch.finishedAt = new Date();
      }
      document.getElementById("caught-total").textContent = formatDuration(caughtTime);
      document.getElementById("lost-time").textContent = formatDuration(lastCapture);
      document.getElementById("collect-section").style.display = "none";
      document.getElementById("lost-section").style.display = "block";
    }
  }
  updateCollect();
  collectInterval = setInterval(updateCollect, 100);
}

function collect() {
  clearInterval(collectInterval);
  collectInterval = null;

  if (!currentCatch || currentCatch.status !== "running") {
    document.getElementById("collect-section").style.display = "none";
    document.getElementById("lost-section").style.display = "block";
    return;
  }

  caughtTime += capturedDuration;
  currentCatch.status = "success";
  currentCatch.finishedAt = new Date();
  addHistory(currentCatch);
  currentCatch = null;
  clearRunningCatch();

  document.getElementById("caught-total").textContent = formatDuration(caughtTime);
  saveState();
  document.getElementById("collect-section").style.display = "none";
  document.getElementById("catch-section").style.display = "block";
  updateSliderLabel();
}

function cancelCatch() {
  isRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  lastCapture = elapsed;
  if (currentCatch) {
    currentCatch.status = "canceled";
    currentCatch.canceledAt = new Date();
    currentCatch.duration = elapsed;
    setCookie("running_catch", JSON.stringify({
      startTimestamp: currentCatch.startTimestamp,
      duration: elapsed,
      canceled: true
    }));
  } else {
    clearRunningCatch();
  }
  document.getElementById("lost-time").textContent = formatDuration(lastCapture);
  document.getElementById("catching-section").style.display = "none";
  document.getElementById("lost-section").style.display = "block";
}

function reset() {
  if (currentCatch) {
    if (currentCatch.status !== "success") {
      addHistory(currentCatch);
    }
    currentCatch = null;
  }
  clearRunningCatch();
  totalLostTime += lastCapture;
  document.getElementById("lost-total").textContent = formatDuration(totalLostTime);
  saveState();
  document.getElementById("lost-section").style.display = "none";
  document.getElementById("catch-section").style.display = "block";
  updateSliderLabel();
}

function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return totalSeconds + "s";
  const years = Math.floor(totalSeconds / 31536000);
  const months = Math.floor((totalSeconds % 31536000) / 2592000);
  const weeks = Math.floor((totalSeconds % 2592000) / 604800);
  const days = Math.floor((totalSeconds % 604800) / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let parts = [];
  if (years > 0) parts.push(years + "y");
  if (months > 0) parts.push(months + "mo");
  if (weeks > 0) parts.push(weeks + "w");
  if (days > 0) parts.push(days + "d");
  if (hours > 0) parts.push(hours + "h");
  if (minutes > 0) parts.push(minutes + "m");
  if (seconds > 0 && years === 0 && months === 0) parts.push(seconds + "s");
  return parts.join(" ");
}
