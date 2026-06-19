// bar_chart.js - D3.js Logic for Grouped Bar Chart (Revenue vs Profit)

function drawBarChart(data, selectedCategory) {
    const container = d3.select("#barChart");
    container.selectAll("*").remove();

    if (!data || data.length === 0) {
        container.append("svg").attr("viewBox", "0 0 400 250")
            .append("text").attr("x", 200).attr("y", 125).attr("text-anchor", "middle").text("No Data Available");
        return;
    }

    // 1. Dimensions and Setup
    const width = container.node().getBoundingClientRect().width || 400;
    const height = 250;
    const margin = { top: 30, right: 20, bottom: 40, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 2. Data Processing (Group by Category, sum Revenue & Profit)
    let categoryMap = d3.rollup(data, 
        v => ({ 
            Revenue: d3.sum(v, d => d.Revenue || 0), 
            Profit: d3.sum(v, d => d.Profit || 0) 
        }), 
        d => d.Category
    );

    let categoryData = Array.from(categoryMap, ([category, values]) => ({ 
        category, 
        Revenue: values.Revenue, 
        Profit: values.Profit 
    }));

    // Ensure all categories always appear in the same order
    const hardcodedCategories = ['Electronics', 'Clothing & Apparel', 'Home & Furniture', 'Accessories', 'Other'];
    categoryData.sort((a, b) => hardcodedCategories.indexOf(a.category) - hardcodedCategories.indexOf(b.category));

    // 3. Scales
    const subgroups = ['Revenue', 'Profit'];
    
    // x0: Positions the category groups
    const x0 = d3.scaleBand()
        .domain(categoryData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);

    // x1: Positions Revenue vs Profit within the category group
    const x1 = d3.scaleBand()
        .domain(subgroups)
        .range([0, x0.bandwidth()])
        .padding(0.05);

    // y: Linear scale for the dollar amounts
    const maxVal = d3.max(categoryData, d => Math.max(d.Revenue, d.Profit));
    const y = d3.scaleLinear()
        .domain([0, maxVal * 1.1]) // Add 10% headroom
        .range([innerHeight, 0]);

    // Colors
    const color = d3.scaleOrdinal()
        .domain(subgroups)
        .range(['#3b82f6', '#10b981']); // Blue for Revenue, Green for Profit

    // 4. Draw Axes
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x0))
        .selectAll("text")
        .attr("transform", "translate(-10,0)rotate(-25)")
        .style("text-anchor", "end")
        .style("font-size", "10px")
        .attr("color", "#6b7280");

    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d => "$" + d3.format(".2s")(d)).ticks(5))
        .attr("color", "#6b7280")
        .call(g => g.select(".domain").remove()) // Clean vertical line
        .call(g => g.selectAll(".tick line").clone() // Grid lines
            .attr("x2", innerWidth)
            .attr("stroke-opacity", 0.1));

    // 5. Draw Bars
    const barGroups = svg.append("g")
        .selectAll("g")
        .data(categoryData)
        .enter()
        .append("g")
        .attr("transform", d => `translate(${x0(d.category)},0)`);

    barGroups.selectAll("rect")
        .data(d => subgroups.map(key => ({ key, value: d[key], category: d.category })))
        .enter()
        .append("rect")
        .attr("x", d => x1(d.key))
        .attr("y", d => y(d.value))
        .attr("width", x1.bandwidth())
        .attr("height", d => innerHeight - y(d.value))
        .attr("fill", d => color(d.key))
        .attr("rx", 2) // Rounded top corners
        // Filter Interaction: Dim unselected categories
        .style("opacity", d => (selectedCategory === "All" || selectedCategory === d.category) ? 1 : 0.25)
        .style("cursor", "pointer")
        .on("click", function(event, d) {
            if (window.setCategoryFilter) window.setCategoryFilter(d.category);
        })
        .append("title")
        .text(d => `${d.category} - ${d.key}\n$${d3.format(",.0f")(d.value)}`);

    // 6. Built-in Top Legend
    const legend = svg.append("g")
        .attr("transform", `translate(${innerWidth - 120}, -20)`);

    subgroups.forEach((key, i) => {
        const legendRow = legend.append("g").attr("transform", `translate(${i * 60}, 0)`);
        legendRow.append("rect").attr("width", 10).attr("height", 10).attr("fill", color(key)).attr("rx", 2);
        legendRow.append("text").attr("x", 15).attr("y", 9).text(key).style("font-size", "10px").style("fill", "#6b7280");
    });
}