/* ============================================================
   1) CONFIG — replace this with your own Apps Script Web App URL
   ============================================================ */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz3ARePup44_h55lsHNyCgaLclyZaLdfHAAiyvpse9H_0CllUJ49hlPTv-4r6t0acHDCw/exec";

/* ============================================================
   2) WEATHER API — Open-Meteo (free, no API key needed)
   We use two Open-Meteo endpoints:
   - geocoding-api: turns a city name into latitude/longitude
   - api.open-meteo.com: turns lat/long into current weather
   ============================================================ */

const cityInput = document.getElementById("city");
const weatherResult = document.getElementById("weatherResult");
const weatherSummaryField = document.getElementById("weatherSummary");

// Simple lookup so weather codes from the API become readable text
const WEATHER_CODES = {
    0: "Clear sky",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Foggy",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Violent showers",
    95: "Thunderstorm"
};

async function fetchWeatherForCity(city) {
    weatherResult.innerHTML = `<p class="weather-placeholder">Looking up ${city}…</p>`;

    try {
        // Step A: turn the city name into coordinates
        const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
        );
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            weatherResult.innerHTML = `<p class="weather-placeholder">Couldn't find "${city}". Try a different spelling.</p>`;
            weatherSummaryField.value = "";
            return;
        }

        const place = geoData.results[0];

        // Step B: get current weather for those coordinates
        const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current_weather=true`
        );
        const weatherData = await weatherRes.json();
        const current = weatherData.current_weather;

        const description = WEATHER_CODES[current.weathercode] || "Unclassified conditions";
        const placeLabel = [place.name, place.admin1, place.country].filter(Boolean).join(", ");

        weatherResult.innerHTML = `
      <div class="weather-reading">
        <span class="weather-temp">${Math.round(current.temperature)}°C</span>
        <span class="weather-desc">${description} in ${placeLabel} · wind ${Math.round(current.windspeed)} km/h</span>
      </div>
    `;

        // Save a plain-text summary so it can be included in the emailed PDF later
        weatherSummaryField.value = `${description}, ${Math.round(current.temperature)}°C, wind ${Math.round(current.windspeed)} km/h (${placeLabel})`;

    } catch (err) {
        console.error("Weather lookup failed:", err);
        weatherResult.innerHTML = `<p class="weather-placeholder">Weather lookup failed. Check your connection and try again.</p>`;
        weatherSummaryField.value = "";
    }
}

// Look up weather when the user finishes typing a city (on blur),
// and also a moment after they stop typing (debounced).
let debounceTimer;
cityInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const value = cityInput.value.trim();
    if (value.length < 3) return;
    debounceTimer = setTimeout(() => fetchWeatherForCity(value), 700);
});
cityInput.addEventListener("blur", () => {
    const value = cityInput.value.trim();
    if (value.length >= 3) fetchWeatherForCity(value);
});

/* ============================================================
   3) FORM SUBMISSION — send booking data to Google Apps Script
   ============================================================ */

const form = document.getElementById("bookingForm");
const submitBtn = document.getElementById("submitBtn");
const formStatus = document.getElementById("formStatus");

form.addEventListener("submit", async(event) => {
    event.preventDefault();

    const payload = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        city: document.getElementById("city").value.trim(),
        date: document.getElementById("date").value,
        guests: document.getElementById("guests").value,
        spot: document.getElementById("spot").value,
        weatherSummary: weatherSummaryField.value || "Not checked"
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    formStatus.textContent = "";
    formStatus.className = "form-status";

    try {
        // IMPORTANT: Content-Type must stay "text/plain" here.
        // Apps Script Web Apps don't handle CORS preflight (OPTIONS) requests,
        // so using text/plain avoids the browser sending a preflight at all.
        const response = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === "success") {
            formStatus.textContent = `Booked! A confirmation PDF is on its way to ${payload.email}.`;
            formStatus.className = "form-status success";
            form.reset();
            weatherResult.innerHTML = `<p class="weather-placeholder">Enter a city below to see the forecast.</p>`;
        } else {
            throw new Error(result.message || "Unknown error from server.");
        }

    } catch (err) {
        console.error("Booking submission failed:", err);
        formStatus.textContent = "Something went wrong sending your booking. Please try again.";
        formStatus.className = "form-status error";
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm booking";
    }
});