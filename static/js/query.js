// Query execution and result handling
async function executeQuery() {
    const queryInput = document.getElementById('queryInput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorContainer = document.getElementById('errorContainer');
    const resultsSection = document.getElementById('resultsSection');
    
    if (!queryInput.value.trim()) {
        showError('Please enter a query');
        return;
    }
    
    try {
        // Show loading, hide other containers
        loadingIndicator.style.display = 'block';
        errorContainer.style.display = 'none';
        resultsSection.style.display = 'none';
        
        const response = await fetch('/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: queryInput.value.trim() })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Display SQL
            const sqlElement = document.getElementById('sqlQuery');
            sqlElement.textContent = data.sql_query;
            sqlElement.style.display = 'block';
            
            // Display results
            if (data.data && data.data.length > 0) {
                displayResults(data.data);
                resultsSection.style.display = 'block';
            } else {
                showError('No results found for your query');
            }
        } else {
            throw new Error(data.error || 'Failed to execute query');
        }
    } catch (error) {
        console.error('Query error:', error);
        showError(error.message);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Display query results in table
function displayResults(data) {
    if (!data || data.length === 0) {
        showError('No results found');
        return;
    }
    
    const headers = Object.keys(data[0]);
    const resultsTable = document.getElementById('resultsTable');
    
    // Create header
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = formatHeader(header);
        th.scope = 'col';
        headerRow.appendChild(th);
    });
    document.getElementById('resultsHeader').innerHTML = '';
    document.getElementById('resultsHeader').appendChild(headerRow);
    
    // Create body
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';
    
    data.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = formatValue(row[header]);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    
    resultsTable.style.display = 'table';
}

// Format header text
function formatHeader(header) {
    return header
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Format cell values
function formatValue(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }
    if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
        return new Date(value).toLocaleDateString();
    }
    return value.toString();
}

// Show error message
function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    const errorMessage = document.getElementById('errorMessage');
    const resultsSection = document.getElementById('resultsSection');
    
    errorMessage.textContent = message;
    errorContainer.style.display = 'block';
    resultsSection.style.display = 'none';
}

// Handle Enter key in textarea
document.getElementById('queryInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executeQuery();
    }
});

// Voice recognition setup
let recognition;
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
}

// Voice input handling
function toggleVoiceInput() {
    const micButton = document.getElementById('micButton');
    const queryInput = document.getElementById('queryInput');

    if (micButton.classList.contains('recording')) {
        // Stop recording
        recognition.stop();
        micButton.classList.remove('recording');
    } else {
        // Start recording
        recognition.start();
        micButton.classList.add('recording');
    }
}

// Voice recognition event handlers
if (recognition) {
    recognition.onresult = function(event) {
        const micButton = document.getElementById('micButton');
        const queryInput = document.getElementById('queryInput');
        const transcript = event.results[0][0].transcript;
        queryInput.value = transcript;
        micButton.classList.remove('recording');
    };

    recognition.onend = function() {
        const micButton = document.getElementById('micButton');
        micButton.classList.remove('recording');
    };
}

// Copy SQL query
function copySQL() {
    const sqlQuery = document.getElementById('sqlQuery');
    navigator.clipboard.writeText(sqlQuery.textContent)
        .then(() => {
            const copyBtn = document.querySelector('.copy-btn');
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
            showError('Failed to copy SQL query');
        });
}

// Download results as CSV
function downloadResults() {
    const table = document.getElementById('resultsTable');
    if (!table) return;
    
    const rows = table.querySelectorAll('tr');
    const csv = [];
    
    for (const row of rows) {
        const rowData = [];
        const cols = row.querySelectorAll('td, th');
        
        for (const col of cols) {
            let text = col.textContent.replace(/"/g, '""');
            rowData.push(`"${text}"`);
        }
        
        csv.push(rowData.join(','));
    }
    
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, 'query_results.csv');
        return;
    }
    
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'query_results.csv');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
