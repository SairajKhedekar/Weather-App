// Replace the placeholder with your OpenWeatherMap API key before publishing
const API_KEY = 'YOUR_OPENWEATHERMAP_API_KEY_HERE';

const el = id => document.getElementById(id);
const bg = el('bg');
const card = el('weatherCard');
const errorEl = el('error');
const iconEl = el('weatherIcon');
const paramsSection = el('weatherParams');

document.getElementById('searchBtn').addEventListener('click', () => doSearch());
document.getElementById('locationInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

async function doSearch(){
  const q = document.getElementById('locationInput').value.trim();
  clearError();
  if (!q) { showError('Please enter a location.'); return; }
  showLoading();
  try{
    // Fetch current weather
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&units=metric&appid=${API_KEY}`;
    const weatherRes = await fetch(weatherUrl);
    if (!weatherRes.ok){
      if (weatherRes.status === 404) showError('Location not found. Try a different name.');
      else showError('Weather service error. Try again later.');
      hideLoading();
      return;
    }
    const weatherData = await weatherRes.json();
    
    // Fetch forecast for 24-hour temperature
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(q)}&units=metric&appid=${API_KEY}`;
    const forecastRes = await fetch(forecastUrl);
    let forecastData = null;
    if (forecastRes.ok) {
      forecastData = await forecastRes.json();
    }
    
    // Fetch air quality
    const lat = weatherData.coord.lat;
    const lon = weatherData.coord.lon;
    const airQualityUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
    const airQualityRes = await fetch(airQualityUrl);
    let airQualityData = null;
    if (airQualityRes.ok) {
      airQualityData = await airQualityRes.json();
    }
    
    renderWeather(weatherData, forecastData, airQualityData);
  }catch(err){
    showError('Network error. Check your connection.');
    console.error(err);
  }finally{ hideLoading(); }
}

function renderWeather(data, forecastData, airQualityData){
  if (!data || !data.weather || !data.weather[0]){ showError('Unexpected response from API'); return; }
  const w = data.weather[0];
  const main = w.main; // e.g., Rain, Clear, Clouds
  const description = w.description;
  const temp = Math.round(data.main.temp);
  const place = `${data.name}${data.sys && data.sys.country ? ', ' + data.sys.country : ''}`;

  el('place').textContent = place;
  el('temp').innerHTML = `${temp}<span style="font-size:0.6em">°C</span>`;
  el('desc').textContent = description;

  const iconCode = w.icon; // e.g., 10d
  iconEl.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  iconEl.alt = description;
  card.classList.remove('hidden');

  // Render weather parameters
  renderWeatherParams(data, forecastData, airQualityData);
  
  applyBackgroundFor(main);
}

function renderWeatherParams(data, forecastData, airQualityData){
  // Precipitation (rain volume for last 3 hours if available, else 0)
  const precipitation = (data.rain && data.rain['3h']) ? data.rain['3h'].toFixed(1) : 
                       (data.rain && data.rain['1h']) ? data.rain['1h'].toFixed(1) : '0.0';
  el('precipitation').textContent = precipitation;
  
  // Humidity
  el('humidity').textContent = data.main.humidity || '--';
  
  // Wind speed
  const windSpeed = data.wind ? (data.wind.speed || 0).toFixed(1) : '0.0';
  el('wind').textContent = windSpeed;
  
  // Air Quality
  if (airQualityData && airQualityData.list && airQualityData.list[0]) {
    const aqi = airQualityData.list[0].main.aqi;
    const aqiLabels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
    el('airQuality').textContent = aqiLabels[aqi - 1] || '--';
    el('aqUnit').textContent = '';
  } else {
    el('airQuality').textContent = '--';
    el('aqUnit').textContent = '';
  }
  
  // Cloud Cover
  el('cloudCover').textContent = data.clouds ? data.clouds.all : '--';
  
  // Visibility (convert from meters to km)
  const visibility = data.visibility ? (data.visibility / 1000).toFixed(1) : '--';
  el('visibility').textContent = visibility;
  
  // 24 Hour Temperature Chart
  renderHourlyChart(forecastData);
  
  // Show parameters section with animation
  paramsSection.classList.remove('hidden');
}

function renderHourlyChart(forecastData){
  const chartContainer = el('hourlyChart');
  chartContainer.innerHTML = '';
  
  if (!forecastData || !forecastData.list) {
    chartContainer.innerHTML = '<div style="color:var(--muted);padding:20px">24-hour forecast data not available</div>';
    return;
  }
  
  // Get next 24 hours of data (forecast provides 3-hour intervals, so ~8 data points)
  const hourlyData = forecastData.list.slice(0, 8);
  const temps = hourlyData.map(item => Math.round(item.main.temp));
  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);
  const tempRange = maxTemp - minTemp || 1;
  
  hourlyData.forEach((item, index) => {
    const date = new Date(item.dt * 1000);
    const hours = date.getHours();
    const timeStr = hours.toString().padStart(2, '0') + ':00';
    const temp = Math.round(item.main.temp);
    const heightPercent = ((temp - minTemp) / tempRange) * 80 + 20; // Scale between 20-100%
    
    const hourItem = document.createElement('div');
    hourItem.className = 'hour-item';
    hourItem.style.animationDelay = `${index * 0.1}s`;
    
    const bar = document.createElement('div');
    bar.className = 'hour-bar';
    bar.style.height = `${heightPercent}%`;
    bar.title = `${timeStr}: ${temp}°C`;
    
    const timeLabel = document.createElement('div');
    timeLabel.className = 'hour-time';
    timeLabel.textContent = timeStr;
    
    const tempLabel = document.createElement('div');
    tempLabel.className = 'hour-temp';
    tempLabel.textContent = `${temp}°`;
    
    hourItem.appendChild(bar);
    hourItem.appendChild(timeLabel);
    hourItem.appendChild(tempLabel);
    chartContainer.appendChild(hourItem);
  });
}

function applyBackgroundFor(main){
  const map = {
    'Clear':'clear',
    'Clouds':'clouds',
    'Rain':'rain',
    'Drizzle':'rain',
    'Thunderstorm':'thunderstorm',
    'Snow':'snow',
    'Mist':'fog','Smoke':'fog','Haze':'fog','Dust':'fog','Fog':'fog','Sand':'fog','Ash':'fog','Squall':'fog','Tornado':'fog'
  };
  const cls = map[main] || 'clouds';
  // Reset
  bg.className = cls;
  // Ensure specific elements exist for some classes
  bg.innerHTML = '';
  if (cls === 'clear'){
    const s = document.createElement('div'); s.className='sun'; bg.appendChild(s);
  }
  if (cls === 'clouds'){
    const c1 = document.createElement('div'); c1.className='cloud c1'; bg.appendChild(c1);
    const c2 = document.createElement('div'); c2.className='cloud c2'; bg.appendChild(c2);
  }
  if (cls === 'rain'){
    for(let i=1;i<=5;i++){const d=document.createElement('div');d.className=`drop d${i}`;bg.appendChild(d)}
  }
  if (cls === 'snow'){
    for(let i=1;i<=6;i++){const f=document.createElement('div');f.className=`flake f${i}`;f.style.left=(10*i)+'%';bg.appendChild(f)}
  }
  if (cls === 'thunderstorm'){
    const flash = document.createElement('div'); flash.className='flash'; bg.appendChild(flash);
  }
}

function showError(msg){ errorEl.textContent = msg; }
function clearError(){ errorEl.textContent = ''; }
function showLoading(){ el('searchBtn').textContent='Loading...'; el('searchBtn').disabled=true }
function hideLoading(){ el('searchBtn').textContent='Get Weather'; el('searchBtn').disabled=false }
