// pie_chart.js - D3.js Logic with Interactive Side Legend

function drawPieChart(data, selectedCategory) {
    const container = d3.select("#pieChart");
    container.selectAll("*").remove();

    if (!data || data.length === 0) {
        container.append("svg").attr("viewBox", "0 0 400 250")
            .append("text").attr("x", 200).attr("y", 125).attr("text-anchor", "middle").text("No Data Available");
        return;
    }

    // 1. Setup Dimensions (Wider layout to accommodate legend)
    const width = container.node().getBoundingClientRect().width || 400;
    const height = 250;
    // Shift pie to the left side of the container (35% mark)
    const pieCenterX = width * 0.35; 
    const radius = Math.min(pieCenterX * 2, height) / 2 - 15;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Group for the Pie Chart
    const pieGroup = svg.append("g")
        .attr("transform", `translate(${pieCenterX},${height / 2})`);

    // 2. Process Data
    let categoryMap = d3.rollup(data, v => d3.sum(v, d => d.Revenue || 0), d => d.Category);
    let categoryData = Array.from(categoryMap, ([category, revenue]) => ({ category, revenue }));

    // 3. Hardcoded Color Scale (Maintains consistency across filters)
    const categoriesList = ['Electronics', 'Clothing & Apparel', 'Home & Furniture', 'Accessories', 'Other'];
    const color = d3.scaleOrdinal()
        .domain(categoriesList)
        .range(['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']); 

    const pie = d3.pie().value(d => d.revenue).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius); 
    const hoverArc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius + 5);

    // 4. Draw Slices
    const arcs = pieGroup.selectAll(".arc")
        .data(pie(categoryData))
        .enter()
        .append("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.category))
        .attr("stroke", "white")
        .attr("stroke-width", "2px")
        .style("cursor", "pointer")
        .style("opacity", d => (selectedCategory === "All" || selectedCategory === d.data.category) ? 1 : 0.25)
        .on("mouseover", function() {
            d3.select(this).transition().duration(200).attr("d", hoverArc);
        })
        .on("mouseout", function() {
            d3.select(this).transition().duration(200).attr("d", arc);
        })
        .on("click", function(event, d) {
            if (window.setCategoryFilter) window.setCategoryFilter(d.data.category);
        })
        .append("title")
        .text(d => `${d.data.category}\n$${d3.format(",.0f")(d.data.revenue)}`);

    // --- 5. INTERACTIVE SIDE LEGEND ---

    // Create a lookup map so the legend can display the revenue numbers
    let revLookup = new Map(categoryData.map(d => [d.category, d.revenue]));

    // Group for the Legend (Positioned on the right side)
    const legendSpacing = 40;
    const legendGroup = svg.append("g")
        .attr("transform", `translate(${width * 0.65}, ${height * 0.15})`);

    const legendItems = legendGroup.selectAll(".legend-item")
        .data(categoriesList)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * legendSpacing})`)
        .style("cursor", "pointer")
        // Dim the legend items exactly like the pie slices when filtering
        .style("opacity", d => (selectedCategory === "All" || selectedCategory === d) ? 1 : 0.25)
        .on("click", function(event, d) {
            if (window.setCategoryFilter) window.setCategoryFilter(d);
        });

    // Color Box
    legendItems.append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("rx", 3)
        .attr("fill", d => color(d));

    // Category Name Label
    legendItems.append("text")
        .attr("x", 24)
        .attr("y", 11)
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("fill", "#374151") // Tailwind gray-700
        .text(d => d);

    // Revenue Number Label
    legendItems.append("text")
        .attr("x", 24)
        .attr("y", 26)
        .style("font-size", "11px")
        .style("fill", "#6b7280") // Tailwind gray-500
        .text(d => {
            let val = revLookup.has(d) ? revLookup.get(d) : 0;
            return `$${d3.format(",.0f")(val)}`;
        });
}