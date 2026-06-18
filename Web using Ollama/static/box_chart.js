// box_chart.js - D3.js Logic for Revenue Volatility

function drawBoxChart(data) {
    const container = d3.select("#boxChart");
    container.selectAll("*").remove();

    if (!data || data.length === 0) {
        container.append("svg").attr("viewBox", "0 0 400 250")
            .append("text").attr("x", 200).attr("y", 125).attr("text-anchor", "middle").text("No Data Available");
        return;
    }

    // 1. Dimensions
    const width = container.node().getBoundingClientRect().width || 400;
    const height = 250;
    const margin = { top: 20, right: 30, bottom: 30, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 2. Data Processing (Calculate total revenue per unique day)
    let dailyTotalsMap = d3.rollup(data, v => d3.sum(v, d => d.Revenue || 0), d => d.Order_Date);
    let dailyRevenues = Array.from(dailyTotalsMap.values()).sort(d3.ascending);

    if (dailyRevenues.length < 4) {
        svg.append("text").attr("x", innerWidth/2).attr("y", innerHeight/2).attr("text-anchor", "middle").text("Not enough data for volatility");
        return;
    }

    // 3. Statistical Calculations (The Math)
    const q1 = d3.quantile(dailyRevenues, 0.25);
    const median = d3.quantile(dailyRevenues, 0.5);
    const q3 = d3.quantile(dailyRevenues, 0.75);
    const iqr = q3 - q1;
    
    // Whiskers (1.5 * IQR)
    const minWhisker = Math.max(d3.min(dailyRevenues), q1 - 1.5 * iqr);
    const maxWhisker = Math.min(d3.max(dailyRevenues), q3 + 1.5 * iqr);
    
    // Identify Outliers
    const outliers = dailyRevenues.filter(d => d < minWhisker || d > maxWhisker);

    // 4. Scales
    const y = d3.scaleLinear()
        .domain([0, d3.max(dailyRevenues) * 1.1])
        .range([innerHeight, 0]);

    // Box horizontal positioning (Center it)
    const boxWidth = 80;
    const center = innerWidth / 2;

    // 5. Draw Axis
    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d => "$" + d3.format(".2s")(d)).ticks(6))
        .style("font-size", "10px")
        .attr("color", "#6b7280")
        .call(g => g.select(".domain").remove()) 
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", innerWidth)
            .attr("stroke-opacity", 0.1));

    // 6. Draw the Box Plot Elements
    const chartGroup = svg.append("g").attr("class", "box-plot-group");

    // A. Vertical Line (Main Whisker Line)
    chartGroup.append("line")
        .attr("x1", center)
        .attr("x2", center)
        .attr("y1", y(minWhisker))
        .attr("y2", y(maxWhisker))
        .attr("stroke", "#4b5563") // Tailwind gray-600
        .attr("stroke-width", 2);

    // B. The Box (Q1 to Q3)
    chartGroup.append("rect")
        .attr("x", center - boxWidth/2)
        .attr("y", y(q3))
        .attr("height", y(q1) - y(q3))
        .attr("width", boxWidth)
        .attr("stroke", "#4b5563")
        .attr("stroke-width", 2)
        .attr("fill", "#8b5cf6") // Tailwind Purple
        .style("opacity", 0.8)
        .append("title")
        .text(`Q3: $${d3.format(",.0f")(q3)}\nMedian: $${d3.format(",.0f")(median)}\nQ1: $${d3.format(",.0f")(q1)}`);

    // C. Median Line
    chartGroup.append("line")
        .attr("x1", center - boxWidth/2)
        .attr("x2", center + boxWidth/2)
        .attr("y1", y(median))
        .attr("y2", y(median))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 3);

    // D. Top and Bottom Whisker Caps
    const capWidth = boxWidth / 2;
    chartGroup.append("line")
        .attr("x1", center - capWidth/2).attr("x2", center + capWidth/2)
        .attr("y1", y(minWhisker)).attr("y2", y(minWhisker))
        .attr("stroke", "#4b5563").attr("stroke-width", 2);
        
    chartGroup.append("line")
        .attr("x1", center - capWidth/2).attr("x2", center + capWidth/2)
        .attr("y1", y(maxWhisker)).attr("y2", y(maxWhisker))
        .attr("stroke", "#4b5563").attr("stroke-width", 2);

    // E. Draw Outliers (Dots)
    chartGroup.selectAll("circle")
        .data(outliers)
        .enter()
        .append("circle")
        .attr("cx", center)
        .attr("cy", d => y(d))
        .attr("r", 4)
        .attr("fill", "#ef4444") // Red for outliers to draw attention
        .attr("stroke", "#ffffff")
        .style("opacity", 0.7)
        .append("title")
        .text(d => `Outlier: $${d3.format(",.0f")(d)}`);
}