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

const TIERS = [
  { threshold: 1e168, name: "Sexquinquagintillion" },
  { threshold: 1e165, name: "Quinquinquagintillion" },
  { threshold: 1e162, name: "Quattuorquinquagintillion" },
  { threshold: 1e159, name: "Trequinquagintillion" },
  { threshold: 1e156, name: "Duoquinquagintillion" },
  { threshold: 1e153, name: "Unquinquagintillion" },
  { threshold: 1e150, name: "Novemquadragintillion" },
  { threshold: 1e147, name: "Octoquadragintillion" },
  { threshold: 1e144, name: "Septenquadragintillion" },
  { threshold: 1e141, name: "Sexquadragintillion" },
  { threshold: 1e138, name: "Quinquadragintillion" },
  { threshold: 1e135, name: "Quattuorquadragintillion" },
  { threshold: 1e132, name: "Trequadragintillion" },
  { threshold: 1e129, name: "Duoquadragintillion" },
  { threshold: 1e126, name: "Unquadragintillion" },
  { threshold: 1e123, name: "Quadragintillion" },
  { threshold: 1e120, name: "Novemtrigintillion" },
  { threshold: 1e117, name: "Octotrigintillion" },
  { threshold: 1e114, name: "Septentrigintillion" },
  { threshold: 1e111, name: "Sextrigintillion" },
  { threshold: 1e108, name: "Quintrigintillion" },
  { threshold: 1e105, name: "Quattuortrigintillion" },
  { threshold: 1e102, name: "Tretrigintillion" },
  { threshold: 1e99,  name: "Duotrigintillion" },
  { threshold: 1e96,  name: "Untrigintillion" },
  { threshold: 1e93,  name: "Trigintillion" },
  { threshold: 1e90,  name: "Novemvigintillion" },
  { threshold: 1e87,  name: "Octovigintillion" },
  { threshold: 1e84,  name: "Septenvigintillion" },
  { threshold: 1e81,  name: "Sexvigintillion" },
  { threshold: 1e78,  name: "Quinvigintillion" },
  { threshold: 1e75,  name: "Quattuorvigintillion" },
  { threshold: 1e72,  name: "Trevigintillion" },
  { threshold: 1e69,  name: "Duovigintillion" },
  { threshold: 1e66,  name: "Unvigintillion" },
  { threshold: 1e63,  name: "Vigintillion" },
  { threshold: 1e60,  name: "Novemdecillion" },
  { threshold: 1e57,  name: "Octodecillion" },
  { threshold: 1e54,  name: "Septendecillion" },
  { threshold: 1e51,  name: "Sexdecillion" },
  { threshold: 1e48,  name: "Quindecillion" },
  { threshold: 1e45,  name: "Quattuordecillion" },
  { threshold: 1e42,  name: "Tredecillion" },
  { threshold: 1e39,  name: "Duodecillion" },
  { threshold: 1e36,  name: "Undecillion" },
  { threshold: 1e33,  name: "Decillion" },
  { threshold: 1e30,  name: "Nonillion" },
  { threshold: 1e27,  name: "Octillion" },
  { threshold: 1e24,  name: "Septillion" },
  { threshold: 1e21,  name: "Sextillion" },
  { threshold: 1e18,  name: "Quintillion" },
  { threshold: 1e15,  name: "Quadrillion" },
  { threshold: 1e12,  name: "Trillion" },
  { threshold: 1e9,   name: "Billion" },
  { threshold: 1e6,   name: "Million" },
  { threshold: 1e3,   name: "Thousand" },
];

function formatNum(n) {
  if (n === null || n === undefined || isNaN(n)) return "--";
  for (const tier of TIERS) {
    if (Math.abs(n) >= tier.threshold) {
      return (n / tier.threshold).toFixed(4) + " " + tier.name;
    }
  }
  return n.toFixed(6);
}

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

function loadState() {
  const savedTime = parseInt(getCookie("time_total"), 10);
  if (!isNaN(savedTime)) {
    caughtTime = savedTime;
  }
  const savedLost = parseInt(getCookie("time_lost_total"), 10);
  if (!isNaN(savedLost)) {
    totalLostTime = savedLost;
  }
}

function saveState() {
  setCookie("time_total", caughtTime);
  setCookie("time_lost_total", totalLostTime);
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

function updateSliderLabel() {
  const seconds = parseInt(document.getElementById("duration").value, 10);
  document.getElementById("lbl-duration").textContent = formatDuration(seconds);
  document.getElementById("lbl-pct").textContent = "100.0000";
  document.getElementById("lbl-profit").textContent = formatDuration(seconds);
  document.getElementById("lbl-persec").textContent = formatNum(1);
  document.getElementById("lbl-principal").textContent = formatDuration(caughtTime);
  document.getElementById("lbl-t").textContent = seconds;
  document.getElementById("money").textContent = formatDuration(caughtTime);
  document.getElementById("lost-total").textContent = formatDuration(totalLostTime);
}

loadState();
updateSliderLabel();

function invest() {
  capturedDuration = parseInt(document.getElementById("duration").value, 10);
  const seconds = capturedDuration;
  lastCapture = capturedDuration;
  const newTotal = caughtTime + seconds;

  const openTime = new Date(Date.now() + seconds * 1000);
  document.getElementById("open-time").textContent = formatClockTime(openTime);

  document.getElementById("invest-section").style.display = "none";
  document.getElementById("investing-section").style.display = "block";
  document.getElementById("expected-profit").textContent = formatDuration(seconds);

  elapsed = 0;
  isRunning = true;
  document.getElementById("timer").textContent = formatDuration(seconds);
  document.getElementById("progress").max = seconds;
  document.getElementById("progress").value = 0;

  timerInterval = setInterval(function() {
    if (!isRunning) return;
    elapsed++;
    const remaining = seconds - elapsed;
    document.getElementById("timer").textContent = formatDuration(remaining);
    document.getElementById("progress").value = elapsed;

    if (elapsed >= seconds) {
      clearInterval(timerInterval);
      timerInterval = null;
      isRunning = false;
      document.getElementById("investing-section").style.display = "none";
      document.getElementById("collect-section").style.display = "block";
      document.getElementById("earned-profit").textContent = formatDuration(seconds);
      document.getElementById("new-balance").textContent = formatDuration(newTotal);
      startCollectCountdown(newTotal);
    }
  }, 1000);
}

function startCollectCountdown(newTotal) {
  let remaining = COLLECT_TIME_SECONDS;
  document.getElementById("collect-timer").textContent = remaining + "s";
  document.getElementById("collect-progress").value = remaining;

  collectInterval = setInterval(function() {
    remaining--;
    document.getElementById("collect-timer").textContent = remaining + "s";
    document.getElementById("collect-progress").value = remaining;

    if (remaining <= 0) {
      clearInterval(collectInterval);
      document.getElementById("money").textContent = formatDuration(caughtTime);
      document.getElementById("lost-profit").textContent = formatDuration(lastCapture);
      document.getElementById("collect-section").style.display = "none";
      document.getElementById("lost-section").style.display = "block";
    }
  }, 1000);
}

function collect() {
  clearInterval(collectInterval);
  caughtTime += capturedDuration;
  document.getElementById("money").textContent = formatDuration(caughtTime);
  saveState();
  document.getElementById("collect-section").style.display = "none";
  document.getElementById("invest-section").style.display = "block";
  updateSliderLabel();
}

function cancelInvestment() {
  isRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  lastCapture = elapsed;
  document.getElementById("lost-profit").textContent = formatDuration(lastCapture);
  document.getElementById("investing-section").style.display = "none";
  document.getElementById("lost-section").style.display = "block";
}

function reset() {
  totalLostTime += lastCapture;
  document.getElementById("lost-total").textContent = formatDuration(totalLostTime);
  saveState();
  document.getElementById("lost-section").style.display = "none";
  document.getElementById("invest-section").style.display = "block";
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
