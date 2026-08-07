/* ==========================================================================
   Aether3D - Main Application Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Three.js Engine
    const sceneManager = new WeatherSceneManager('canvas-container');

    // 2. State & Variables
    let soundEnabled = false;
    let currentActiveAudio = null;
    let activeWeatherProfile = 'sunny';
    let localTimeInterval = null;

    // DOM Elements
    const cityInput = document.getElementById('city-input');
    const searchSubmit = document.getElementById('search-submit');
    const autocompleteList = document.getElementById('autocomplete-list');
    const viewGlobeBtn = document.getElementById('view-globe');
    const viewDioramaBtn = document.getElementById('view-diorama');
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    
    // Display elements
    const displayCity = document.getElementById('display-city');
    const displayCountry = document.getElementById('display-country');
    const displayTemp = document.getElementById('display-temp');
    const displayCondition = document.getElementById('display-condition');
    const displayTime = document.getElementById('display-time');
    const displayMainIcon = document.getElementById('weather-main-icon');
    const detailTempRange = document.getElementById('detail-temp-range');
    const detailHumidity = document.getElementById('detail-humidity');
    const detailWind = document.getElementById('detail-wind');
    const detailUv = document.getElementById('detail-uv');
    const forecastContainer = document.getElementById('forecast-container');

    // Audio dictionary
    const audioLoops = {
        sunny: document.getElementById('audio-sunny'),
        cloudy: document.getElementById('audio-wind'),
        rainy: document.getElementById('audio-rain'),
        stormy: document.getElementById('audio-storm'),
        snowy: document.getElementById('audio-snow'),
        foggy: document.getElementById('audio-wind') // fallback to wind
    };

    // Set lower volumes for background loops
    Object.values(audioLoops).forEach(audio => {
        if (audio) audio.volume = 0;
    });

    // ==========================================================================
    // Weather Code & Icon Mapping (WMO Interpretation)
    // ==========================================================================
    
    const weatherMap = {
        0: { desc: 'clear sky', icon: 'fa-sun text-yellow', profile: 'sunny' },
        1: { desc: 'mainly clear', icon: 'fa-cloud-sun text-yellow', profile: 'sunny' },
        2: { desc: 'partly cloudy', icon: 'fa-cloud-sun text-gray', profile: 'cloudy' },
        3: { desc: 'overcast', icon: 'fa-cloud text-gray', profile: 'cloudy' },
        45: { desc: 'foggy', icon: 'fa-smog text-teal', profile: 'foggy' },
        48: { desc: 'depositing rime fog', icon: 'fa-smog text-teal', profile: 'foggy' },
        51: { desc: 'light drizzle', icon: 'fa-cloud-showers-heavy text-blue', profile: 'rainy' },
        53: { desc: 'moderate drizzle', icon: 'fa-cloud-showers-heavy text-blue', profile: 'rainy' },
        55: { desc: 'heavy drizzle', icon: 'fa-cloud-showers-heavy text-blue', profile: 'rainy' },
        61: { desc: 'slight rain', icon: 'fa-cloud-showers-heavy text-blue', profile: 'rainy' },
        63: { desc: 'moderate rain', icon: 'fa-cloud-showers-heavy text-blue', profile: 'rainy' },
        65: { desc: 'heavy rain', icon: 'fa-cloud-showers-heavy text-blue', profile: 'rainy' },
        66: { desc: 'light freezing rain', icon: 'fa-snowflake text-cyan', profile: 'snowy' },
        67: { desc: 'heavy freezing rain', icon: 'fa-snowflake text-cyan', profile: 'snowy' },
        71: { desc: 'slight snow fall', icon: 'fa-snowflake text-cyan', profile: 'snowy' },
        73: { desc: 'moderate snow fall', icon: 'fa-snowflake text-cyan', profile: 'snowy' },
        75: { desc: 'heavy snow fall', icon: 'fa-snowflake text-cyan', profile: 'snowy' },
        77: { desc: 'snow grains', icon: 'fa-snowflake text-cyan', profile: 'snowy' },
        80: { desc: 'slight rain showers', icon: 'fa-cloud-showers-heavy text-blue', profile: 'rainy' },
        81: { desc: 'moderate rain showers', icon: 'fa-cloud-showers-heavy text-blue', profile: 'rainy' },
        82: { desc: 'violent rain showers', icon: 'fa-cloud-showers-heavy text-blue', profile: 'rainy' },
        85: { desc: 'slight snow showers', icon: 'fa-snowflake text-cyan', profile: 'snowy' },
        86: { desc: 'heavy snow showers', icon: 'fa-snowflake text-cyan', profile: 'snowy' },
        95: { desc: 'thunderstorm', icon: 'fa-cloud-bolt text-purple', profile: 'stormy' },
        96: { desc: 'thunderstorm with slight hail', icon: 'fa-cloud-bolt text-purple', profile: 'stormy' },
        99: { desc: 'thunderstorm with heavy hail', icon: 'fa-cloud-bolt text-purple', profile: 'stormy' }
    };

    function getWeatherInfo(code) {
        return weatherMap[code] || { desc: 'unknown', icon: 'fa-cloud-sun text-gray', profile: 'cloudy' };
    }

    // ==========================================================================
    // API Integrations (Open-Meteo)
    // ==========================================================================

    // Fetch cities suggestions based on text input
    async function searchCities(query) {
        if (!query || query.length < 2) {
            autocompleteList.style.display = 'none';
            return;
        }

        try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                renderAutocomplete(data.results);
            } else {
                autocompleteList.style.display = 'none';
            }
        } catch (error) {
            console.error('Geocoding API error:', error);
        }
    }

    // Render autocomplete matches
    function renderAutocomplete(cities) {
        autocompleteList.innerHTML = '';
        cities.forEach(city => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            
            const region = [city.admin1, city.country].filter(Boolean).join(', ');
            item.innerHTML = `
                <span class="city-title">${city.name}</span>
                <span class="region-title">${region}</span>
            `;
            
            item.addEventListener('click', () => {
                cityInput.value = city.name;
                autocompleteList.style.display = 'none';
                loadWeatherForCoords(city.latitude, city.longitude, city.name, city.country, city.timezone);
            });
            autocompleteList.appendChild(item);
        });
        autocompleteList.style.display = 'block';
    }

    // Fetch Weather Data from Coordinates
    async function loadWeatherForCoords(lat, lon, cityName, countryName, timezoneStr) {
        try {
            // Skeleton load state
            forecastContainer.querySelectorAll('.forecast-card').forEach(card => card.classList.add('skeleton'));
            displayCity.textContent = 'Updating...';
            displayTemp.textContent = '--';
            displayCondition.textContent = 'Connecting...';

            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto`;
            const response = await fetch(weatherUrl);
            const data = await response.json();

            updateWeatherUI(data, cityName, countryName, timezoneStr || data.timezone);
            
            // 3D Scene Interactions: Add marker pin to globe & trigger target focusing
            sceneManager.addPinAtCoordinates(lat, lon, cityName);
            
            // Set 3D environment weather
            const currentWCode = data.current.weather_code;
            const wInfo = getWeatherInfo(currentWCode);
            activeWeatherProfile = wInfo.profile;
            sceneManager.setWeather(wInfo.profile);
            
            // Trigger audio sync
            syncAudioToWeather();

            // Set sandbox simulator button states matching active weather
            syncSandboxButtons(wInfo.profile);

            // Cache last search locally
            localStorage.setItem('last_weather_search', JSON.stringify({
                lat, lon, cityName, countryName, timezone: timezoneStr || data.timezone
            }));

        } catch (error) {
            console.error('Weather API error:', error);
            displayCity.textContent = 'Error loading';
            displayCondition.textContent = 'Please try again later';
        }
    }

    // Update Dashboard UI Elements
    function updateWeatherUI(data, cityName, countryName, timezone) {
        const current = data.current;
        const daily = data.daily;
        const wInfo = getWeatherInfo(current.weather_code);

        // Header info
        displayCity.textContent = cityName;
        displayCountry.textContent = countryName;
        displayTemp.textContent = Math.round(current.temperature_2m);
        displayCondition.textContent = wInfo.desc;

        // Reset and set weather icon class
        displayMainIcon.className = `fa-solid ${wInfo.icon}`;

        // Local clock loop inside target timezone
        if (localTimeInterval) clearInterval(localTimeInterval);
        const updateClock = () => {
            try {
                const options = { timeStyle: 'short', timeZone: timezone, hour12: false };
                const formattedTime = new Date().toLocaleTimeString('en-US', options);
                displayTime.textContent = `Local Time: ${formattedTime}`;
            } catch (e) {
                // timezone string may fall back
                const local = new Date().toLocaleTimeString('en-US', { timeStyle: 'short', hour12: false });
                displayTime.textContent = `Local Time: ${local}`;
            }
        };
        updateClock();
        localTimeInterval = setInterval(updateClock, 30000);

        // Sidebar Grid Details
        detailTempRange.textContent = `${Math.round(daily.temperature_2m_min[0])} / ${Math.round(daily.temperature_2m_max[0])} °C`;
        detailHumidity.textContent = `${current.relative_humidity_2m} %`;
        detailWind.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
        detailUv.textContent = daily.uv_index_max[0] ? daily.uv_index_max[0].toFixed(1) : '--';

        // Render 5-Day Forecast Grid
        forecastContainer.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const dateStr = daily.time[i];
            const date = new Date(dateStr + 'T00:00:00'); // avoid timezone offsets shifting day
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            
            const maxTemp = Math.round(daily.temperature_2m_max[i]);
            const minTemp = Math.round(daily.temperature_2m_min[i]);
            const dayCode = daily.weather_code[i];
            const dayInfo = getWeatherInfo(dayCode);

            const card = document.createElement('div');
            card.className = 'forecast-card glass-card animate-fade-in';
            card.style.animationDelay = `${i * 0.08}s`;
            card.innerHTML = `
                <span class="forecast-day">${dayName}</span>
                <i class="fa-solid ${dayInfo.icon} forecast-icon"></i>
                <div class="forecast-temp">
                    <span class="forecast-temp-max">${maxTemp}°</span>
                    <span class="forecast-temp-min">${minTemp}°</span>
                </div>
            `;
            forecastContainer.appendChild(card);
        }
    }

    // Sync button borders/classes inside Simulator HUD
    function syncSandboxButtons(profile) {
        document.querySelectorAll('.sandbox-btn').forEach(btn => {
            if (btn.getAttribute('data-weather') === profile) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // ==========================================================================
    // Interactive Controls & Audio Mix Manager
    // ==========================================================================

    // Smoothly crossfade between weather audio loops to prevent audio pops
    function fadeAudio(audioToPlay) {
        if (!soundEnabled) return;
        
        // If sound is matching, keep playing
        if (currentActiveAudio === audioToPlay) return;

        const duration = 1.5; // seconds
        
        // Fade out previous audio
        if (currentActiveAudio) {
            const previous = currentActiveAudio;
            gsap.to(previous, {
                volume: 0,
                duration: duration,
                onComplete: () => {
                    previous.pause();
                }
            });
        }

        // Fade in new audio
        if (audioToPlay) {
            audioToPlay.currentTime = 0;
            audioToPlay.play().catch(err => console.log('Audio playback blocked:', err));
            gsap.to(audioToPlay, {
                volume: 0.25, // background level
                duration: duration
            });
            currentActiveAudio = audioToPlay;
        } else {
            currentActiveAudio = null;
        }
    }

    function syncAudioToWeather() {
        if (!soundEnabled) return;
        const targetAudio = audioLoops[activeWeatherProfile];
        fadeAudio(targetAudio);
    }

    // Toggle Global Sound Option
    soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        
        if (soundEnabled) {
            soundToggleBtn.classList.add('active');
            soundToggleBtn.querySelector('i').className = 'fa-solid fa-volume-high';
            soundToggleBtn.querySelector('span').textContent = 'Sound On';
            
            // Play sound for active weather
            const targetAudio = audioLoops[activeWeatherProfile];
            if (targetAudio) {
                targetAudio.currentTime = 0;
                targetAudio.play().catch(e => console.log('Playback blocked', e));
                gsap.to(targetAudio, { volume: 0.25, duration: 1.0 });
                currentActiveAudio = targetAudio;
            }
        } else {
            soundToggleBtn.classList.remove('active');
            soundToggleBtn.querySelector('i').className = 'fa-solid fa-volume-xmark';
            soundToggleBtn.querySelector('span').textContent = 'Sound Off';
            
            // Fade out active
            if (currentActiveAudio) {
                const active = currentActiveAudio;
                gsap.to(active, {
                    volume: 0,
                    duration: 0.8,
                    onComplete: () => {
                        active.pause();
                    }
                });
                currentActiveAudio = null;
            }
        }
    });

    // View Switching event listeners
    viewGlobeBtn.addEventListener('click', () => {
        viewGlobeBtn.classList.add('active');
        viewDioramaBtn.classList.remove('active');
        sceneManager.setView('globe');
    });

    viewDioramaBtn.addEventListener('click', () => {
        viewDioramaBtn.classList.add('active');
        viewGlobeBtn.classList.remove('active');
        sceneManager.setView('diorama');
    });

    // Sandbox Weather Sim overrides
    document.querySelectorAll('.sandbox-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const weatherOverride = btn.getAttribute('data-weather');
            
            // Highlight current button
            document.querySelectorAll('.sandbox-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update 3D environment condition
            activeWeatherProfile = weatherOverride;
            sceneManager.setWeather(weatherOverride);
            
            // Update Sound loop
            syncAudioToWeather();

            // Update main status description to indicate simulation override
            displayCondition.textContent = `${weatherOverride} (Simulated)`;
        });
    });

    // ==========================================================================
    // Search bar keystroke handlers
    // ==========================================================================
    let searchDebounceTimeout = null;
    
    cityInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        clearTimeout(searchDebounceTimeout);
        
        searchDebounceTimeout = setTimeout(() => {
            searchCities(val);
        }, 300);
    });

    cityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = cityInput.value.trim();
            if (val.length > 0) {
                // If there's an autocomplete result, pick the first one
                const firstResult = autocompleteList.querySelector('.autocomplete-item');
                if (firstResult) {
                    firstResult.click();
                } else {
                    // Otherwise search name directly (might be less accurate coords but works as direct lookup)
                    autocompleteList.style.display = 'none';
                    executeFallbackSearch(val);
                }
            }
        }
    });

    searchSubmit.addEventListener('click', () => {
        const val = cityInput.value.trim();
        if (val.length > 0) {
            const firstResult = autocompleteList.querySelector('.autocomplete-item');
            if (firstResult) {
                firstResult.click();
            } else {
                executeFallbackSearch(val);
            }
        }
    });

    // Fallback Geocoding query if autocomplete clicked isn't matching
    async function executeFallbackSearch(cityName) {
        try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const first = data.results[0];
                loadWeatherForCoords(first.latitude, first.longitude, first.name, first.country, first.timezone);
            } else {
                displayCity.textContent = 'Not Found';
                displayCondition.textContent = 'Search coordinates failed';
            }
        } catch (e) {
            console.error(e);
        }
    }

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!cityInput.contains(e.target) && !autocompleteList.contains(e.target)) {
            autocompleteList.style.display = 'none';
        }
    });

    // ==========================================================================
    // Init Setup (Load Default Location)
    // ==========================================================================
    const cachedSearch = localStorage.getItem('last_weather_search');
    if (cachedSearch) {
        const target = JSON.parse(cachedSearch);
        loadWeatherForCoords(target.lat, target.lon, target.cityName, target.countryName, target.timezone);
    } else {
        // Fallback default: New York City
        loadWeatherForCoords(40.7128, -74.0060, 'New York', 'United States', 'America/New_York');
    }
});
