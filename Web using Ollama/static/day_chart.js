// day_chart.js - D3.js Logic for Seasonal Day-of-Week Averages

function drawDayChart(data) {
    const container = d3.select("#dayChart");
    container.selectAll("*").remove();

    if (!data || data.length === 0) {
        container.append("svg").attr("viewBox", "0 0 400 250")
            .append("text").attr("x", 200).attr("y", 125).attr("text-anchor", "middle").text("No Data Available");
        return;
    }

    const width = container.node().getBoundingClientRect().width || 400;
    const height = 250;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let dayStats = {};
    dayNames.forEach(day => { dayStats[day] = { totalRevenue: 0, uniqueDates: new Set() }; });

    data.forEach(row => {
        let dateObj = new Date(row.Order_Date);
        let dayName = dayNames[dateObj.getDay()];
        if (dayStats[dayName]) {
            dayStats[dayName].totalRevenue += (row.Revenue || 0);
            dayStats[dayName].uniqueDates.add(row.Order_Date);
        }
    });

    const orderedDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    let chartData = orderedDays
        .filter(day => dayStats[day].uniqueDates.size > 0) // Only draw days that exist in the filtered data
        .map(day => {
            let daysCount = dayStats[day].uniqueDates.size;
            let average = daysCount > 0 ? (dayStats[day].totalRevenue / daysCount) : 0;
            return { day, average };
        });

    const x = d3.scaleBand().domain(chartData.map(d => d.day)).range([0, innerWidth]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.average) * 1.1]).range([innerHeight, 0]);

    svg.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x))
        .style("font-size", "10px").attr("color", "#6b7280").call(g => g.select(".domain").attr("stroke", "#e5e7eb"));

    svg.append("g").call(d3.axisLeft(y).tickFormat(d => "$" + d3.format(".2s")(d)).ticks(5))
        .style("font-size", "10px").attr("color", "#6b7280").call(g => g.select(".domain").remove()) 
        .call(g => g.selectAll(".tick line").clone().attr("x2", innerWidth).attr("stroke-opacity", 0.1));

    svg.selectAll(".bar")
        .data(chartData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.day))
        .attr("y", d => y(d.average))
        .attr("width", x.bandwidth())
        .attr("height", d => innerHeight - y(d.average))
        // SMART FILL: Purple for weekends, Blue for weekdays
        .attr("fill", d => (d.day === "Saturday" || d.day === "Sunday") ? "#8b5cf6" : "#3b82f6") 
        .attr("rx", 3)
        .style("cursor", "pointer")
        .style("transition", "fill 0.2s ease")
        
        // INTERACTIVITY
        .on("mouseover", function(event, d) {
            // Make it darker based on its base color
            let baseColor = (d.day === "Saturday" || d.day === "Sunday") ? "#8b5cf6" : "#3b82f6";
            d3.select(this).attr("fill", d3.color(baseColor).darker(0.5)); 
        })
        .on("mouseout", function(event, d) {
            // Return to base color
            let baseColor = (d.day === "Saturday" || d.day === "Sunday") ? "#8b5cf6" : "#3b82f6";
            d3.select(this).attr("fill", baseColor);
        })
        .on("click", function(event, d) {
            if (window.toggleDayFilter) window.toggleDayFilter(d.day);
        })
        .append("title")
        .text(d => `${d.day}\nAvg Revenue: $${d3.format(",.0f")(d.average)}`);
}