const result = document.getElementById("result");
const input = document.getElementById("cityInput");
const btn = document.getElementById("searchBtn");
const suggestionsEl = document.getElementById("suggestions");

const codeToLabel = (code) => {
  if ([0].includes(code)) return "☀️ Clear";
  if ([1,2,3].includes(code)) return "⛅ Partly cloudy";
  if ([45,48].includes(code)) return "🌫️ Fog";
  if ([51,53,55,56,57].includes(code)) return "🌦️ Drizzle";
  if ([61,63,65,66,67].includes(code)) return "🌧️ Rain";
  if ([71,73,75,77].includes(code)) return "❄️ Snow";
  if ([80,81,82].includes(code)) return "🌧️ Showers";
  if ([95,96,99].includes(code)) return "⛈️ Thunderstorm";
  return "🌡️";
};

// Add: fetch helper with retries and exponential backoff
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      // If server error and we have retries left, retry
      if (!res.ok && res.status >= 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, backoff * Math.pow(2, attempt)));
        continue;
      }
      return res;
    } catch (err) {
      // Network error - retry if attempts remain
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, backoff * Math.pow(2, attempt)));
    }
  }
}

async function getWeather(city) {
  const res = await fetchWithRetry(`/api/weather?city=${encodeURIComponent(city)}`);
  return res.json();
}

async function handleSearch() {
  const city = input.value.trim();
  if (!city) {
    result.textContent = "Please enter a city name.";
    return;
  }
  suggestionsEl.classList.remove("show");
  result.textContent = "Loading…";

  try {
    const data = await getWeather(city);
    if (data.error) {
      result.textContent = data.error;
      return;
    }
    const cw = data.current_weather;
    result.innerHTML = `
      <div class="center">
        <h2>${data.city}, ${data.country}</h2>
        <div class="muted">Lat: ${data.latitude}, Lng: ${data.longitude}</div>
      </div>
      <div class="weather">
        <div class="tile">
          <div class="muted">Condition</div>
          <div><strong>${codeToLabel(cw.weathercode)}</strong></div>
        </div>
        <div class="tile">
          <div class="muted">Temperature</div>
          <div><strong>${cw.temperature} °C</strong></div>
        </div>
        <div class="tile">
          <div class="muted">Wind</div>
          <div><strong>${cw.windspeed} km/h</strong></div>
        </div>
        <div class="tile">
          <div class="muted">As of</div>
          <div><strong>${cw.time}</strong></div>
        </div>
      </div>
    `;
  } catch (e) {
    result.textContent = "Something went wrong.";
  }
}

async function fetchSuggestions(q) {
  const res = await fetchWithRetry(`/api/search?q=${encodeURIComponent(q)}`);
  return res.json();
}

let suggestTimer;
input.addEventListener("input", () => {
  const q = input.value.trim();
  clearTimeout(suggestTimer);
  if (!q) {
    suggestionsEl.classList.remove("show");
    suggestionsEl.innerHTML = "";
    return;
  }
  suggestTimer = setTimeout(async () => {
    const items = await fetchSuggestions(q);
    if (!items.length) {
      suggestionsEl.classList.remove("show");
      suggestionsEl.innerHTML = "";
      return;
    }
    suggestionsEl.innerHTML = items
      .map(i => `<li data-name="${i.name}">${i.name}, ${i.country}</li>`)
      .join("");
    suggestionsEl.classList.add("show");
  }, 200);
});

suggestionsEl.addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  const name = li.getAttribute("data-name");
  input.value = name;
  suggestionsEl.classList.remove("show");
  handleSearch();
});

btn.addEventListener("click", handleSearch);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSearch();
});
