// Function to determine if data is suitable for visualization
function canVisualize(data) {
    if (!data || data.length === 0) return false;
    
    // Check if we have numeric values
    const hasNumeric = Object.values(data[0]).some(val => !isNaN(val));
    return hasNumeric;
}

// Function to suggest chart type based on data
function suggestChartType(data) {
    if (!data || data.length === 0) return null;
    
    const columns = Object.keys(data[0]);
    const numericColumns = columns.filter(col => 
        !isNaN(data[0][col])
    );
    
    if (numericColumns.length === 0) return null;
    
    // For 1 category and 1 numeric value
    if (columns.length === 2 && numericColumns.length === 1) {
        return data.length <= 10 ? 'pie' : 'bar';
    }
    
    // For time series data
    if (columns.some(col => data[0][col] instanceof Date)) {
        return 'line';
    }
    
    // For multiple numeric columns
    if (numericColumns.length > 1) {
        return 'bar';
    }
    
    return 'bar'; // default
}

// Function to prepare data for visualization
function prepareChartData(data, chartType) {
    const columns = Object.keys(data[0]);
    const numericColumns = columns.filter(col => 
        !isNaN(data[0][col])
    );
    const categoryColumns = columns.filter(col => 
        isNaN(data[0][col])
    );
    
    if (chartType === 'pie') {
        return {
            labels: data.map(row => row[categoryColumns[0]]),
            datasets: [{
                data: data.map(row => row[numericColumns[0]]),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                    '#9966FF', '#FF9F40', '#FF6384', '#36A2EB'
                ]
            }]
        };
    }
    
    if (chartType === 'bar') {
        return {
            labels: data.map(row => row[categoryColumns[0]]),
            datasets: numericColumns.map(col => ({
                label: col,
                data: data.map(row => row[col]),
                backgroundColor: '#36A2EB',
                borderColor: '#36A2EB'
            }))
        };
    }
    
    if (chartType === 'line') {
        return {
            labels: data.map(row => row[categoryColumns[0]]),
            datasets: numericColumns.map(col => ({
                label: col,
                data: data.map(row => row[col]),
                fill: false,
                borderColor: '#36A2EB'
            }))
        };
    }
}

// Function to create chart
function createChart(data) {
    if (!canVisualize(data)) {
        document.getElementById('chartContainer').style.display = 'none';
        return;
    }
    
    const chartType = suggestChartType(data);
    if (!chartType) {
        document.getElementById('chartContainer').style.display = 'none';
        return;
    }
    
    document.getElementById('chartContainer').style.display = 'block';
    const chartData = prepareChartData(data, chartType);
    
    // Destroy existing chart if any
    if (window.currentChart) {
        window.currentChart.destroy();
    }
    
    const ctx = document.getElementById('resultChart').getContext('2d');
    window.currentChart = new Chart(ctx, {
        type: chartType,
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Query Results Visualization'
                },
                legend: {
                    position: 'top'
                }
            },
            scales: chartType !== 'pie' ? {
                y: {
                    beginAtZero: true
                }
            } : undefined
        }
    });
}
