const API_BASE_URL = "https://fahmi191-retail-forecasting-api.hf.space";

// dashboard.js - Global State & Filtering Engine

// --- SPA VIEW MANAGEMENT ---
const uploadView = document.getElementById('upload-view');
const dashboardView = document.getElementById('dashboard-view');
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const uploadLoading = document.getElementById('upload-loading');
const btnReplaceData = document.getElementById('btn-replace-data');

// Trigger hidden file input when clicking the dropzone
dropzone.addEventListener('click', () => fileInput.click());

// Escape Hatch: Return to Upload Screen
if (btnReplaceData) {
    btnReplaceData.addEventListener('click', () => {
        dashboardView.classList.add('hidden');
        uploadView.classList.remove('hidden');
        // Reset the dropzone state
        fileInput.value = '';
        dropzone.classList.remove('hidden');
        uploadLoading.classList.add('hidden');
    });
}

function showDashboard() {
    uploadView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
}

let globalHistory = [];
let globalForecast = [];
let globalShapData = [];
let insightDebounceTimer;
let currentCategory = "All";
let currentRegion = "All";  
let currentDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Range State
let availableMonths = []; // Chronological list of "YYYY-MM"
let startIndex = 0;
let endIndex = 0;

// --- INGESTION PIPELINE ---
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-blue-500', 'bg-blue-50');
});
dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-blue-500', 'bg-blue-50');
});
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-blue-500', 'bg-blue-50');
    if (e.dataTransfer.files.length) processUploadedFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) processUploadedFile(e.target.files[0]);
});

async function processUploadedFile(file) {
    if (!file.name.endsWith('.csv')) {
        alert("Please upload a valid CSV file.");
        return;
    }

    dropzone.classList.add('hidden');
    uploadLoading.classList.remove('hidden');

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch(`${API_BASE_URL}/api/upload`, { 
            method: 'POST', 
            body: formData,
            headers: {
            }
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.detail || "Upload failed");

        // 1. Assign Data
        globalHistory = data.history;
        globalForecast = data.forecast;
        globalShapData = data.shap_data || [];

        // 2. Build Category Dropdown Dynamically
        const categories = [...new Set(globalHistory.map(item => item.Category))];
        const select = document.getElementById('categoryFilter');
        select.innerHTML = '<option value="All">All Categories</option>';
        categories.forEach(cat => select.innerHTML += `<option value="${cat}">${cat}</option>`);

        // 3. Build Timeline Array
        let allDates = globalHistory.map(d => new Date(d.Order_Date));
        if (globalForecast.length > 0) allDates = allDates.concat(globalForecast.map(d => new Date(d.Date)));
        
        let uniqueMonths = [...new Set(allDates.map(d => d3.timeFormat("%Y-%m")(d)))];
        availableMonths = uniqueMonths.sort((a, b) => d3.ascending(a, b));
        
        startIndex = 0;
        endIndex = availableMonths.length - 1;

        const sliderStart = document.getElementById('monthSliderStart');
        const sliderEnd = document.getElementById('monthSliderEnd');
        sliderStart.max = availableMonths.length - 1;
        sliderEnd.max = availableMonths.length - 1;

        // 4. Boot the UI
        setupEventListeners();
        updateMonthUI();
        showDashboard();
        updateDashboard();

    } catch (error) {
        console.error("Ingestion Error:", error);
        alert("Error processing file: " + error.message);
        dropzone.classList.remove('hidden');
        uploadLoading.classList.add('hidden');
        fileInput.value = '';
    }
}

function setupEventListeners() {
    // 1. Category & Days
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        currentCategory = e.target.value;
        updateDashboard();
    });

    const selectAllBtn = document.getElementById('selectAllDays');
    const dayBoxes = document.querySelectorAll('.day-filter');

    selectAllBtn.addEventListener('change', (e) => {
        dayBoxes.forEach(box => box.checked = e.target.checked);
        updateDaysState();
    });

    dayBoxes.forEach(box => {
        box.addEventListener('change', () => {
            updateDaysState();
            if (!box.checked) selectAllBtn.checked = false; 
        });
    });

    // 2. Dual Slider Logic
    const sliderStart = document.getElementById('monthSliderStart');
    const sliderEnd = document.getElementById('monthSliderEnd');

    sliderStart.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (val > endIndex) {
            sliderStart.value = endIndex; 
            val = endIndex;
        }
        startIndex = val;
        updateMonthUI();
        updateDashboard();
    });

    sliderEnd.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (val < startIndex) {
            sliderEnd.value = startIndex; 
            val = startIndex;
        }
        endIndex = val;
        updateMonthUI();
        updateDashboard();
    });

    // 3. Raw Data Explorer Pagination & Jump Engine
    const prevBtn = document.getElementById("btn-prev-page");
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (window.currentTablePage > 1) {
                window.currentTablePage--;
                drawDataTable(window.currentActiveData || []);
            }
        });
    }

    const nextBtn = document.getElementById("btn-next-page");
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            const totalItems = (window.currentActiveData || []).length;
            const totalPages = Math.ceil(totalItems / 10);
            if (window.currentTablePage < totalPages) {
                window.currentTablePage++;
                drawDataTable(window.currentActiveData || []);
            }
        });
    }

    const jumpInput = document.getElementById("page-jump-input");
    if (jumpInput) {
        jumpInput.addEventListener("change", (e) => {
            let targetPage = parseInt(e.target.value);
            const totalItems = (window.currentActiveData || []).length;
            const totalPages = Math.ceil(totalItems / 10);

            // Validation bounds
            if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
            if (targetPage > totalPages) targetPage = totalPages;

            window.currentTablePage = targetPage;
            drawDataTable(window.currentActiveData || []);
        });
    }
}

function updateDaysState() {
    const dayBoxes = document.querySelectorAll('.day-filter');
    currentDays = Array.from(dayBoxes).filter(box => box.checked).map(box => box.value);
    updateDashboard();
}

// --- TWO-WAY BINDING LOGIC ---

// 1. Called by D3 Chart on click (Snaps both sliders to the clicked month)
window.setMonthFilter = function(monthString) {
    if (monthString === "All") {
        startIndex = 0;
        endIndex = availableMonths.length - 1;
    } else {
        const index = availableMonths.indexOf(monthString);
        if (index !== -1) {
            startIndex = index;
            endIndex = index;
        }
    }
    updateMonthUI();
    updateDashboard();
};

// Called by D3 Day Chart on click
window.toggleDayFilter = function(clickedDay) {
    const checkbox = document.querySelector(`input.day-filter[value="${clickedDay}"]`);
    const selectAllBtn = document.getElementById('selectAllDays');

    if (checkbox) {
        // If "Select All" is currently active, clicking a bar isolates that specific day
        if (selectAllBtn.checked) {
            document.querySelectorAll('.day-filter').forEach(box => box.checked = false);
            checkbox.checked = true;
            selectAllBtn.checked = false;
        } else {
            // Otherwise, just toggle the clicked day on/off
            checkbox.checked = !checkbox.checked;

            // If the user unchecks the very last active day, reset by checking all of them
            const anyChecked = Array.from(document.querySelectorAll('.day-filter')).some(box => box.checked);
            if (!anyChecked) {
                document.querySelectorAll('.day-filter').forEach(box => box.checked = true);
                selectAllBtn.checked = true;
            }
        }
        // Force the dashboard to read the new checkbox states and redraw
        updateDaysState();
    }
};

// Called by D3 Pie Chart on click
window.setCategoryFilter = function(category) {
    // If clicking the currently active category, toggle it off (reset to "All")
    currentCategory = (currentCategory === category) ? "All" : category;
    
    // Update the physical dropdown menu in the sidebar
    document.getElementById('categoryFilter').value = currentCategory;
    
    updateDashboard();
};

// Called by D3 Region Chart on click
window.setRegionFilter = function(regionName) {
    currentRegion = (currentRegion === regionName) ? "All" : regionName;
    updateDashboard();
};

// 2. Updates HTML visuals
function updateMonthUI() {
    document.getElementById('monthSliderStart').value = startIndex;
    document.getElementById('monthSliderEnd').value = endIndex;
    
    const parseDate = d3.timeParse("%Y-%m");
    const formatLabel = d3.timeFormat("%b '%y");

    const startStr = formatLabel(parseDate(availableMonths[startIndex]));
    const endStr = formatLabel(parseDate(availableMonths[endIndex]));

    document.getElementById('startLabel').innerText = startStr;
    document.getElementById('endLabel').innerText = endStr;

    const mainLabel = document.getElementById('monthRangeLabel');
    if (startIndex === 0 && endIndex === availableMonths.length - 1) {
        mainLabel.innerText = "All Time";
    } else if (startIndex === endIndex) {
        mainLabel.innerText = startStr; // Single month selected
    } else {
        mainLabel.innerText = `${startStr} - ${endStr}`;
    }
}

// --- XAI RENDERER ---
function drawXAIChart(shapData) {
    const container = document.getElementById('xai-container');
    container.innerHTML = '';
    
    if(!shapData || shapData.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400 text-center mt-4">XAI data unavailable.</p>';
        return;
    }
    
    // Find the max impact to scale the bars relative to the strongest feature
    const maxImpact = Math.max(...shapData.map(d => d.impact));
    
    // Render top 5 features
    shapData.slice(0, 5).forEach((item) => {
        const pct = (item.impact / maxImpact) * 100;
        const barHtml = `
            <div class="w-full">
                <div class="flex justify-between text-xs mb-1.5">
                    <span class="font-semibold text-gray-700 truncate">${item.feature}</span>
                </div>
                <div class="w-full bg-purple-100 rounded-full h-1.5">
                    <div class="bg-purple-600 h-1.5 rounded-full transition-all duration-1000" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
        container.innerHTML += barHtml;
    });
}

// --- CORE ENGINE ---

function updateDashboard() {
    const activeRange = availableMonths.slice(startIndex, endIndex + 1);

    // 1. Filter by DATE ONLY (Used for Pie & Bar Chart so they don't collapse)
    let dateFilteredHistory = globalHistory.filter(row => {
        let dateObj = new Date(row.Order_Date);
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        let matchDay = currentDays.includes(dayNames[dateObj.getDay()]);
        
        let rowMonthStr = d3.timeFormat("%Y-%m")(dateObj);
        let matchMonth = activeRange.includes(rowMonthStr);

        return matchDay && matchMonth;
    });

    // 2. Filter by CATEGORY AND REGION ONLY (Product filter removed)
        let fullyFilteredHistory = dateFilteredHistory.filter(row => {
            const matchCat = (currentCategory === "All") || (row.Category === currentCategory);
            const matchReg = (currentRegion === "All") || (row.Region === currentRegion);
            return matchCat && matchReg;
        });

        window.activeDataForAI = fullyFilteredHistory;
        window.currentActiveData = fullyFilteredHistory; 
        
    // 3. Filter Forecast (Time-based only)
    let filteredForecast = globalForecast.filter(row => {
        let dateObj = new Date(row.Date);
        let rowMonthStr = d3.timeFormat("%Y-%m")(dateObj);
        return activeRange.includes(rowMonthStr);
    });
    let chartSelectedMonth = (startIndex === endIndex) ? availableMonths[startIndex] : "Range";
    if (startIndex === 0 && endIndex === availableMonths.length - 1) chartSelectedMonth = "All";
    updateKPIs(fullyFilteredHistory);
        
    // 4. Draw Charts
        // FIX 1: Pass dateFilteredHistory so the forecast ignores micro-filters. Hardcode title to "Total Business".
        drawForecastChart(dateFilteredHistory, filteredForecast, "Total Business", chartSelectedMonth);
        drawXAIChart(globalShapData);  
        drawPieChart(dateFilteredHistory, currentCategory); 
        drawBarChart(dateFilteredHistory, currentCategory); 
        drawDayChart(fullyFilteredHistory);
        drawBoxChart(fullyFilteredHistory);
        drawProductChart(fullyFilteredHistory);
        drawRegionChart(fullyFilteredHistory, currentRegion);
        drawMapChart(fullyFilteredHistory); 
        drawDataTable(fullyFilteredHistory);

    // Trigger AI Summaries with a 1.5 second debounce to protect local RAM
    clearTimeout(insightDebounceTimer);
    insightDebounceTimer = setTimeout(() => {
        generateChartInsights(filteredForecast, fullyFilteredHistory);
    }, 1500);
}

// Ensure this KPI function exists at the bottom of dashboard.js
function updateKPIs(data) {
    let totalRev = data.reduce((sum, row) => sum + (row.Revenue || 0), 0);
    let totalProf = data.reduce((sum, row) => sum + (row.Profit || 0), 0);
    
    let uniqueDates = [...new Set(data.map(item => item.Order_Date))];
    let avgDaily = uniqueDates.length > 0 ? (totalRev / uniqueDates.length) : 0;
    
    document.getElementById('kpi-rev').innerText = "$" + totalRev.toLocaleString('en-US', {maximumFractionDigits: 0});
    document.getElementById('kpi-avg').innerText = "$" + avgDaily.toLocaleString('en-US', {maximumFractionDigits: 0});
    document.getElementById('kpi-prof').innerText = "$" + totalProf.toLocaleString('en-US', {maximumFractionDigits: 0});
    document.getElementById('kpi-marg').innerText = totalRev > 0 ? ((totalProf / totalRev) * 100).toFixed(1) + "%" : "0%";
}

// --- AI COPILOT LOGIC ---

// 1. Get the HTML elements
const chatInput = document.querySelector('#aiCopilot input');
const chatHistory = document.getElementById('chatHistory');

// 2. Listen for the "Enter" key
chatInput.addEventListener('keypress', async function (e) {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
        const userMessage = chatInput.value.trim();
        chatInput.value = ''; 
        
        // Disable input to prevent race conditions
        chatInput.disabled = true;
        chatInput.placeholder = "AI is thinking...";

        appendMessage('user', userMessage);
        const loadingId = appendMessage('ai', 'Thinking...');

       try {
            const currentRevenue = document.getElementById('kpi-rev').innerText;
            const currentMargin = document.getElementById('kpi-marg').innerText;
            const currentProfit = document.getElementById('kpi-prof').innerText;
            
            // 1. Calculate Category Distributions
            let catSummary = {};
            window.activeDataForAI.forEach(row => {
                if (!catSummary[row.Category]) catSummary[row.Category] = { rev: 0, prof: 0 };
                catSummary[row.Category].rev += (row.Revenue || 0);
                catSummary[row.Category].prof += (row.Profit || 0);
            });
            let summaryString = Object.keys(catSummary).map(c => 
                `${c}: Rev $${Math.round(catSummary[c].rev)} (Prof $${Math.round(catSummary[c].prof)})`
            ).join(" | ");

            // 2. Compute Top 3 Products in the active view via clean JS loops
            let prodMap = {};
            window.activeDataForAI.forEach(row => {
                prodMap[row.Product_Name] = (prodMap[row.Product_Name] || 0) + (row.Revenue || 0);
            });
            let topProducts = Object.entries(prodMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([name, rev]) => `${name} ($${Math.round(rev)})`)
                .join(", ");

            // 3. Compute Regional Breakdown in the active view
            let regMap = {};
            window.activeDataForAI.forEach(row => {
                regMap[row.Region] = (regMap[row.Region] || 0) + (row.Revenue || 0);
            });
            let regionalBreakdown = Object.entries(regMap)
                .sort((a, b) => b[1] - a[1])
                .map(([name, rev]) => `${name}: $${Math.round(rev)}`)
                .join(" | ");

            // 4. Calculate Critical Extremes (Best/Worst Days)
            let dailyTotals = d3.rollup(window.activeDataForAI, v => d3.sum(v, d => d.Revenue || 0), d => d.Order_Date);
            let sortedDays = Array.from(dailyTotals).sort((a, b) => b[1] - a[1]);
            let bestDay = sortedDays.length > 0 ? `${sortedDays[0][0]} ($${Math.round(sortedDays[0][1])})` : "N/A";
            let worstDay = sortedDays.length > 0 ? `${sortedDays[sortedDays.length - 1][0]} ($${Math.round(sortedDays[sortedDays.length - 1][1])})` : "N/A";

            let sortedDates = window.activeDataForAI.map(d => d.Order_Date).sort();
            let dateRange = sortedDates.length > 0 ? `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}` : "No active dates";

            // 5. Fire Request with complete dimensional breakdown
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    context: {
                        category: currentCategory,
                        region: currentRegion, 
                        revenue: currentRevenue,
                        profit: currentProfit,
                        margin: currentMargin,
                        dateRange: dateRange,
                        categoryData: summaryString,
                        topProducts: topProducts,
                        regionalData: regionalBreakdown,
                        businessInsights: `Peak Day: ${bestDay} | Lowest Day: ${worstDay}`
                    }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Server failed to process request");
            
            let finalMessage = data.response || data.reply || (data.message && data.message.content) || "No parseable response returned.";
            document.getElementById(loadingId).innerHTML = parseMarkdown(finalMessage);

        }catch (error) {
            console.error("Chat API Error:", error);
            document.getElementById(loadingId).innerText = "❌ Error: " + error.message;
        } finally {
            // Re-enable input once complete
            chatInput.disabled = false;
            chatInput.placeholder = "Ask a question about this data...";
            chatInput.focus();
        }
    }
});

// Reusable Markdown Parser
function parseMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Converts **bold**
        .replace(/\*(.*?)\*/g, '<em>$1</em>')             // Converts *italic*
        .replace(/\n/g, '<br>');                          // Converts line breaks
}

// Helper function with Markdown Parsing and Unique ID generation
function appendMessage(sender, text) {
    const div = document.createElement('div');
    const uniqueId = 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000); 
    div.id = uniqueId;
    
    if (sender === 'user') {
        div.className = "bg-blue-600 text-white p-3 rounded-lg rounded-tr-none self-end max-w-[85%]";
    } else {
        div.className = "bg-gray-100 p-3 rounded-lg rounded-tl-none self-start max-w-[85%] text-gray-800 leading-relaxed";
    }
    
    // 1. A lightweight Regex parser to convert Markdown asterisks to HTML tags
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Converts **bold**
        .replace(/\*(.*?)\*/g, '<em>$1</em>')             // Converts *italic*
        .replace(/\n/g, '<br>');                          // Converts line breaks

    // 2. Use innerHTML instead of innerText so the browser renders the <strong> tags
    div.innerHTML = formattedText;
    
    document.getElementById('chatHistory').appendChild(div);
    document.getElementById('chatHistory').scrollTop = document.getElementById('chatHistory').scrollHeight; 
    
    return uniqueId;
}

// --- AUTOMATED INSIGHT GENERATION (NLG) ---
async function generateChartInsights(forecastData, mapData) {
    const forecastText = document.getElementById('ai-forecast-summary');
    const mapText = document.getElementById('ai-map-summary');

    forecastText.innerHTML = '<span class="animate-pulse text-blue-500">🤖 Local LLM analyzing forecast trajectory...</span>';
    mapText.innerHTML = '<span class="animate-pulse text-purple-500">🤖 Local LLM analyzing geospatial density...</span>';

    // 1. Compress Forecast Context
    let totalForecast = forecastData.reduce((sum, row) => sum + row.Forecast_Revenue, 0);
    let forecastContext = `We are forecasting $${Math.round(totalForecast)} in revenue over the next 90 days.`;

    // 2. Compress Map Context (Top 3 States/Countries)
    let regionMap = d3.rollup(mapData, v => d3.sum(v, d => d.Revenue || 0), d => d.State || d.Country);
    let topRegions = Array.from(regionMap).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([loc, rev]) => `${loc}: $${Math.round(rev)}`).join(", ");
    let mapContext = `Our top 3 geographical revenue drivers are: ${topRegions}.`;

    try {
        // Fire parallel requests to the Local LLM
        const [forecastRes, mapRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/insight`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ chart_type: "90-Day Forecast", context: forecastContext })
            }),
            fetch(`${API_BASE_URL}/api/insight`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ chart_type: "Geospatial Map", context: mapContext })
            })
        ]);

        const forecastJson = await forecastRes.json();
        const mapJson = await mapRes.json();

        forecastText.innerText = forecastJson.insight;
        mapText.innerText = mapJson.insight;

    } catch (error) {
        console.error("NLG API Error:", error);
        forecastText.innerText = "⚠️ Failed to generate insight. Local LLM may be overloaded.";
        mapText.innerText = "⚠️ Failed to generate insight. Local LLM may be overloaded.";
    }
}
