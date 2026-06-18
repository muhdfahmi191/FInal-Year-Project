function drawForecastChart(historyData, forecastData, currentCategory, selectedMonth) {
    const container = d3.select("#mainChart");
    container.selectAll("*").remove(); 

    if (historyData.length === 0) {
        container.append("div").attr("class", "flex items-center justify-center h-full text-gray-500").text("No data available.");
        return;
    }

    const margin = {top: 20, right: 30, bottom: 30, left: 60};
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = container.node().getBoundingClientRect().height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. DATA PREPARATION (Fixing the Scaling & Gap Issues)
    let dailyHistoryMap = d3.rollup(historyData, v => d3.sum(v, d => d.Revenue || 0), d => d.Order_Date);
    
    // Convert map to sorted array of objects
    let historyLineData = Array.from(dailyHistoryMap, ([date, rev]) => ({ 
        date: new Date(date), 
        histRev: rev,
        foreRev: null
    })).sort((a, b) => a.date - b.date);

    let forecastLineData = [];
    if (forecastData.length > 0) {
        forecastLineData = forecastData.map(d => ({
            date: new Date(d.Date),
            histRev: null,
            foreRev: d.Forecast_Revenue
        })).sort((a, b) => a.date - b.date);

        // Connect the two lines if there's a gap
        if (historyLineData.length > 0) {
            let lastHist = historyLineData[historyLineData.length - 1];
            forecastLineData.unshift({
                date: lastHist.date,
                histRev: null,
                foreRev: lastHist.histRev 
            });
        }
    }

    // Merge for the tooltip engine
    let combinedData = [...historyLineData, ...forecastLineData].sort((a, b) => a.date - b.date);

    // 2. SCALES (Fixing the "Out of Box" ceiling break)
    const x = d3.scaleTime()
        .domain(d3.extent(combinedData, d => d.date))
        .range([0, width]);

    // Calculate max from the aggregated arrays, not raw data
    const maxVal = d3.max(combinedData, d => Math.max(d.histRev || 0, d.foreRev || 0));
    
    const y = d3.scaleLinear()
        .domain([0, maxVal * 1.15]) // 15% padding so the peak never hits the roof
        .range([height, 0]);

    // 3. AXES
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%b '%y")))
        .attr("color", "#6b7280");

    svg.append("g")
        .call(d3.axisLeft(y).ticks(6).tickFormat(d => "$" + d3.format(".2s")(d)))
        .attr("color", "#6b7280")
        .call(g => g.select(".domain").remove()) 
        .call(g => g.selectAll(".tick line").clone().attr("x2", width).attr("stroke-opacity", 0.1));

    // 4. DRAW LINES
    const histLine = d3.line()
        .defined(d => d.histRev !== null)
        .x(d => x(d.date))
        .y(d => y(d.histRev))
        .curve(d3.curveMonotoneX);

    const foreLine = d3.line()
        .defined(d => d.foreRev !== null)
        .x(d => x(d.date))
        .y(d => y(d.foreRev))
        .curve(d3.curveMonotoneX);

    svg.append("path")
        .datum(historyLineData)
        .attr("fill", "none")
        .attr("stroke", "#3b82f6") 
        .attr("stroke-width", 2.5)
        .attr("d", histLine);

    svg.append("path")
        .datum(forecastLineData)
        .attr("fill", "none")
        .attr("stroke", "#f59e0b") 
        .attr("stroke-width", 2.5)
        .attr("stroke-dasharray", "5,5")
        .attr("d", foreLine);

    // 5. INTERACTIVITY (Restoring the Hover Engine)
    const focus = svg.append("g").style("display", "none");

    // Crosshair line
    focus.append("line").attr("class", "hover-line")
        .attr("stroke", "#9ca3af").attr("stroke-width", 1).attr("stroke-dasharray", "3,3")
        .attr("y1", 0).attr("y2", height);

    // Tracking Circle
    focus.append("circle").attr("class", "hover-circle").attr("r", 5).attr("fill", "#ffffff").attr("stroke-width", 2);

    // Tooltip Text Background
    focus.append("rect").attr("class", "hover-box")
        .attr("width", 130).attr("height", 45).attr("fill", "white")
        .attr("stroke", "#e5e7eb").attr("rx", 4).attr("y", -55).attr("x", -65)
        .style("filter", "drop-shadow(0px 2px 4px rgba(0,0,0,0.1))");

    // Tooltip Text
    const textDate = focus.append("text").attr("class", "hover-text-date")
        .attr("x", 0).attr("y", -40).attr("text-anchor", "middle")
        .attr("font-size", "11px").attr("fill", "#6b7280").attr("font-weight", "500");

    const textRev = focus.append("text").attr("class", "hover-text-rev")
        .attr("x", 0).attr("y", -22).attr("text-anchor", "middle")
        .attr("font-size", "13px").attr("font-weight", "bold");

    // Invisible Overlay to catch mouse movements
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", () => focus.style("display", null))
        .on("mouseout", () => focus.style("display", "none"))
        .on("mousemove", mousemove);

    const bisectDate = d3.bisector(d => d.date).left;

    function mousemove(event) {
        const x0 = x.invert(d3.pointer(event)[0]);
        const i = bisectDate(combinedData, x0, 1);
        if (i >= combinedData.length) return;
        
        const d0 = combinedData[i - 1];
        const d1 = combinedData[i];
        const d = x0 - d0.date > d1.date - x0 ? d1 : d0;

        const isForecast = d.foreRev !== null && d.histRev === null;
        const val = isForecast ? d.foreRev : d.histRev;
        const color = isForecast ? "#f59e0b" : "#3b82f6";

        focus.attr("transform", `translate(${x(d.date)},${y(val)})`);
        
        // Update styling dynamically based on history vs forecast
        focus.select(".hover-line").attr("y1", -y(val)); 
        focus.select(".hover-circle").attr("stroke", color);
        textRev.attr("fill", color).text("$" + d3.format(",.0f")(val));
        textDate.text(d3.timeFormat("%b %d, %Y")(d.date));
    }
}