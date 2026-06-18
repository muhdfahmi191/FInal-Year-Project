// data_table.js - Raw Data Explorer with Pagination & Color Encoding

let tableData = [];
let currentPage = 1;
const rowsPerPage = 10;

// Consistent Visual Encoding Map (Matches the Hex codes in pie_chart.js)
const categoryColors = {
    'Electronics': 'bg-blue-100 text-blue-800',            // #3b82f6
    'Clothing & Apparel': 'bg-emerald-100 text-emerald-800', // #10b981
    'Home & Furniture': 'bg-amber-100 text-amber-800',       // #f59e0b
    'Accessories': 'bg-violet-100 text-violet-800',          // #8b5cf6
    'Other': 'bg-red-100 text-red-800'                       // #ef4444
};

// data_table.js - High-Density Raw Data Explorer

// data_table.js - Interactive Raw Data Explorer with Page Jump & Color Tags

function drawDataTable(data) {
    const tbody = d3.select("#dataTableBody");
    tbody.selectAll("*").remove(); 

    if (data.length === 0) {
        d3.select("#table-start").text(0);
        d3.select("#table-end").text(0);
        d3.select("#table-total").text(0);
        return;
    }

    const itemsPerPage = 10;
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Core state tracking initialization
    if (window.currentTablePage === undefined) window.currentTablePage = 1;
    if (window.currentTablePage > totalPages) window.currentTablePage = totalPages;
    if (window.currentTablePage < 1) window.currentTablePage = 1;

    const startIndex = (window.currentTablePage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    // Update numbers
    d3.select("#table-start").text(startIndex + 1);
    d3.select("#table-end").text(endIndex);
    d3.select("#table-total").text(totalItems);
    d3.select("#page-indicator").text(`of ${totalPages}`);
    
    // Sync the input box value to the current page
    d3.select("#page-jump-input").property("value", window.currentTablePage);

    // Toggle button disabled states
    d3.select("#btn-prev-page").property("disabled", window.currentTablePage === 1);
    d3.select("#btn-next-page").property("disabled", window.currentTablePage === totalPages);

    const pageData = data.slice(startIndex, endIndex);

    pageData.forEach(d => {
        const row = tbody.append("tr").attr("class", "hover:bg-gray-50 border-b border-gray-100 transition-colors");
        
        // 1. Date
        row.append("td").attr("class", "px-4 py-3 font-medium text-gray-900").text(d.Order_Date);
        
        // 2. Region (Styled with a clean gray subtle badge background)
        const regionCell = row.append("td").attr("class", "px-4 py-3");
        regionCell.append("span")
            .attr("class", "px-2 py-1 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100")
            .text(d.Region);
        
        // 3. Category (Styled with a distinct blue badge layout)
        const catCell = row.append("td").attr("class", "px-4 py-3");
        catCell.append("span")
            .attr("class", "px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100")
            .text(d.Category);
        
        // 4. Product Name
        row.append("td").attr("class", "px-4 py-3 text-gray-600 max-w-xs truncate").text(d.Product_Name).attr("title", d.Product_Name);
        
        // 5. Revenue
        row.append("td").attr("class", "px-4 py-3 text-right font-semibold text-gray-800").text("$" + d3.format(",.2f")(d.Revenue));
        
        // 6. Profit
        const profitClass = d.Profit >= 0 ? "text-green-600" : "text-red-600";
        row.append("td").attr("class", `px-4 py-3 text-right font-semibold ${profitClass}`).text("$" + d3.format(",.2f")(d.Profit));
        
        // 7. Margin
        const margin = d.Revenue > 0 ? (d.Profit / d.Revenue) * 100 : 0;
        row.append("td").attr("class", "px-4 py-3 text-right font-medium text-gray-500").text(d3.format(".1f")(margin) + "%");
    });
}

function updatePaginationUI(start, end, total) {
    document.getElementById('table-start').innerText = start;
    document.getElementById('table-end').innerText = end;
    document.getElementById('table-total').innerText = total;
    
    const totalPages = Math.ceil(total / rowsPerPage) || 1;
    document.getElementById('page-indicator').innerText = `Page ${currentPage} of ${totalPages}`;

    document.getElementById('btn-prev-page').disabled = (currentPage === 1);
    document.getElementById('btn-next-page').disabled = (currentPage === totalPages);
}

let tableEventsAttached = false;
function setupTableInteractions() {
    if (tableEventsAttached) return;
    
    document.getElementById('btn-prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    document.getElementById('btn-next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(tableData.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    tableEventsAttached = true;
}