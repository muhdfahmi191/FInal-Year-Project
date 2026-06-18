// product_chart.js - Horizontal Top 10 Products Visualization

function drawProductChart(data, currentProduct = "All") {
    const container = d3.select("#productChart");
    container.selectAll("*").remove();

    if (data.length === 0) {
        container.append("div").attr("class", "flex items-center justify-center h-full text-gray-500").text("No data available.");
        return;
    }

    // 1. Aggregate and isolate the Top 10 Products
    const productMap = d3.rollup(data, v => d3.sum(v, d => d.Revenue || 0), d => d.Product_Name);
    const sortedProducts = Array.from(productMap, ([name, rev]) => ({ name, rev }))
        .sort((a, b) => b.rev - a.rev)
        .slice(0, 10); // UPGRADED: Expanded to Top 10

    // Adjusted margins to give the 10 bars breathing room
    const margin = { top: 10, right: 35, bottom: 25, left: 110 }; 
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = container.node().getBoundingClientRect().height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 2. Set Scales
    const y = d3.scaleBand()
        .domain(sortedProducts.map(d => d.name))
        .range([0, height])
        .padding(0.25); // Slightly reduced padding to fit more bars

    const x = d3.scaleLinear()
        .domain([0, d3.max(sortedProducts, d => d.rev) * 1.15]) // 15% right-padding so labels don't clip
        .range([0, width]);

    // 3. Draw Axes
    svg.append("g")
        .call(d3.axisLeft(y).tickSize(0))
        .attr("color", "#4b5563")
        .selectAll("text")
        .text(d => d.length > 15 ? d.substring(0, 15) + "..." : d)
        .attr("font-size", "10px") // Slightly smaller font to accommodate 10 rows
        .attr("font-weight", "500");

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d => "$" + d3.format(".1s")(d)))
        .attr("color", "#9ca3af")
        .attr("font-size", "10px")
        .call(g => g.select(".domain").remove());

    // 4. Draw Horizontal Bars (Hover Only, No Click)
    const bars = svg.selectAll(".bar")
        .data(sortedProducts)
        .enter()
        .append("rect")
        // Removed cursor-pointer. Kept the transition for the hover effect.
        .attr("class", "bar transition-opacity duration-200 hover:opacity-80") 
        .attr("y", d => y(d.name))
        .attr("x", 0)
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.rev))
        .attr("fill", "#2563eb")
        .attr("rx", 3);
        // Removed the .attr("opacity") logic and the .on("click") event entirely.

    bars.append("title")
        .text(d => `${d.name}\nTotal Revenue: $${d3.format(",.2f")(d.rev)}`);

    // 5. Value Labels on inside edge of bars
    svg.selectAll(".label")
        .data(sortedProducts)
        .enter()
        .append("text")
        // Dynamically vertically center the text based on bandwidth
        .attr("y", d => y(d.name) + y.bandwidth() / 2 + 3.5) 
        .attr("x", d => x(d.rev) > 40 ? x(d.rev) - 5 : x(d.rev) + 5)
        .attr("text-anchor", d => x(d.rev) > 40 ? "end" : "start")
        .attr("fill", d => x(d.rev) > 40 ? "#ffffff" : "#1f2937")
        .attr("font-size", "9px")
        .attr("font-weight", "bold")
        .style("pointer-events", "none") // Prevents text from blocking the bar's click/hover event
        .text(d => "$" + d3.format(",.0f")(d.rev));
}