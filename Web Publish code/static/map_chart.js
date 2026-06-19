// map_chart.js - Interactive Geospatial Mapping via Plotly

function drawMapChart(data) {
    const containerId = 'mapChart';
    document.getElementById(containerId).innerHTML = '';

    if (data.length === 0) {
        document.getElementById(containerId).innerHTML = '<div class="flex items-center justify-center h-full text-gray-500 text-sm">No data available for active filters.</div>';
        return;
    }

    // 1. ADVANCED AGGREGATION: Collect ALL unique regions for a single country
    const countryDataMap = d3.rollup(data, 
        v => {
            // Extract all unique regions for this country, filter out blanks
            const uniqueRegions = [...new Set(v.map(d => d.Region).filter(r => r && r !== "Unknown" && r !== "null"))];
            return {
                revenue: d3.sum(v, d => d.Revenue || 0),
                // Join them with a comma (e.g., "East, West, South")
                region: uniqueRegions.length > 0 ? uniqueRegions.join(", ") : "Unknown" 
            };
        }, 
        d => d.Country
    );

    // 2. Format Data for Plotly
    const locations = [];
    const zValues = [];
    const hoverTexts = [];

    for (let [country, stats] of countryDataMap) {
        if (!country || country === "Unknown" || country === "null" || country.trim() === "") continue; 
        
        locations.push(country);
        zValues.push(stats.revenue);
        hoverTexts.push(`<b>${country}</b><br>Active Regions: ${stats.region}<br>Total Revenue: $${d3.format(",.2f")(stats.revenue)}`);
    }

    // 3. Configure Plotly Trace
    const plotData = [{
        type: 'choropleth',
        locationmode: 'country names',
        locations: locations,
        z: zValues,
        text: hoverTexts,
        hoverinfo: 'text',
        colorscale: [
            [0, '#eff6ff'], // Light blue
            [1, '#1d4ed8']  // Deep blue
        ],
        colorbar: {
            title: 'Revenue ($)',
            thickness: 15,
            len: 0.8,
            outlinewidth: 0,
            tickfont: { color: '#6b7280', size: 10 },
            titlefont: { color: '#374151', size: 12, weight: 'bold' }
        },
        marker: { 
            line: { 
                color: '#64748b', // UPGRADE: Darker Slate Gray borders for colored countries
                width: 0.8 
            } 
        }
    }];

    // 4. Configure Plotly Layout
    const layout = {
        autosize: true,
        geo: {
            showframe: false,
            showcoastlines: true,
            showcountries: true, // UPGRADE: Force borders for ALL countries, even empty ones
            countrycolor: '#cbd5e1', // Slate-300 color for empty countries
            coastlinecolor: '#cbd5e1',
            projection: { type: 'mercator' },
            bgcolor: 'rgba(0,0,0,0)'
        },
        margin: { l: 0, r: 0, t: 0, b: 0 }, 
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    };

    Plotly.newPlot(containerId, plotData, layout, { responsive: true, displayModeBar: false });
}