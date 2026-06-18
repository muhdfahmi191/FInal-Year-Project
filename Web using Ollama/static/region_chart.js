function drawRegionChart(data) {
    const container = d3.select("#regionChart");
    container.selectAll("*").remove();

    if (data.length === 0) {
        container.append("div").attr("class", "flex items-center justify-center h-full text-gray-500").text("No data available.");
        return;
    }

    // 1. Aggregate Revenue by Region Column
    const regionMap = d3.rollup(data, v => d3.sum(v, d => d.Revenue || 0), d => d.Region);
    const regionData = Array.from(regionMap, ([region, rev]) => ({ region, rev }))
        .sort((a, b) => b.rev - a.rev);

    const margin = { top: 15, right: 20, bottom: 30, left: 55 };
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = container.node().getBoundingClientRect().height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 2. Set Scales
    const x = d3.scaleBand()
        .domain(regionData.map(d => d.region))
        .range([0, width])
        .padding(0.4);

    const y = d3.scaleLinear()
        .domain([0, d3.max(regionData, d => d.rev) * 1.15])
        .range([height, 0]);

    // 3. Draw Axes & Gridlines
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .attr("color", "#6b7280");

    svg.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => "$" + d3.format(".1s")(d)))
        .attr("color", "#6b7280")
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone().attr("x2", width).attr("stroke-opacity", 0.05));
        
    // 4. Draw Vertical Bars (Now Interactive)
    const bars = svg.selectAll(".bar")
        .data(regionData)
        .enter()
        .append("rect")
        .attr("class", "bar cursor-pointer transition-opacity duration-200 hover:opacity-80")
        .attr("x", d => x(d.region))
        .attr("y", d => y(d.rev))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.rev))
        .attr("fill", "#9333ea") 
        .attr("rx", 4)
        // Dim the bar if another region is currently selected
        .attr("opacity", d => (currentRegion === "All" || currentRegion === d.region) ? 1 : 0.3)
        // Cross-Filtering Click Event
        .on("click", (event, d) => {
            if (window.setRegionFilter) window.setRegionFilter(d.region);
        });

    // Add native browser tooltip
    bars.append("title")
        .text(d => `${d.region} Region\nTotal Revenue: $${d3.format(",.2f")(d.rev)}`);
}