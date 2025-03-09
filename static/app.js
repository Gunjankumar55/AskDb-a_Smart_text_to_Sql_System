document.addEventListener('DOMContentLoaded', () => {
    const queryInput = document.getElementById('queryInput');
    const submitButton = document.getElementById('submitQuery');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultContainer = document.getElementById('resultContainer');
    const resultHeader = document.getElementById('resultHeader');
    const resultBody = document.getElementById('resultBody');
    const errorContainer = document.getElementById('errorContainer');
    const errorMessage = document.getElementById('errorMessage');

    submitButton.addEventListener('click', async () => {
        const query = queryInput.value.trim();
        
        if (!query) {
            showError('Please enter a query');
            return;
        }

        try {
            // Show loading state
            loadingIndicator.classList.remove('hidden');
            resultContainer.classList.add('hidden');
            errorContainer.classList.add('hidden');
            submitButton.disabled = true;

            const response = await fetch('/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to execute query');
            }

            if (data.success) {
                displayResults(data.data);
                saveQuery(query, data.data);
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
        } catch (error) {
            showError(error.message);
        } finally {
            loadingIndicator.classList.add('hidden');
            submitButton.disabled = false;
        }
    });

    function displayResults(data) {
        if (!data || data.length === 0) {
            showError('No results found');
            return;
        }

        // Clear previous results
        resultHeader.innerHTML = '';
        resultBody.innerHTML = '';

        // Create table header
        const headerRow = document.createElement('tr');
        Object.keys(data[0]).forEach(key => {
            const th = document.createElement('th');
            th.textContent = key;
            headerRow.appendChild(th);
        });
        resultHeader.appendChild(headerRow);

        // Create table body
        data.forEach(row => {
            const tr = document.createElement('tr');
            Object.values(row).forEach(value => {
                const td = document.createElement('td');
                td.textContent = value;
                tr.appendChild(td);
            });
            resultBody.appendChild(tr);
        });

        resultContainer.classList.remove('hidden');
        errorContainer.classList.add('hidden');
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorContainer.classList.remove('hidden');
        resultContainer.classList.add('hidden');
    }

    // Add query history tracking
    let queryHistory = [];

    function saveQuery(query, result) {
        queryHistory.push({
            query: query,
            result: result,
            timestamp: new Date()
        });
        updateHistoryDisplay();
    }

    function updateHistoryDisplay() {
        const historyDiv = document.getElementById('queryHistory');
        historyDiv.innerHTML = queryHistory.map(item => `
            <div class="history-item">
                <div class="query">${item.query}</div>
                <div class="timestamp">${item.timestamp.toLocaleString()}</div>
                <button onclick="rerunQuery('${item.query}')">Rerun</button>
            </div>
        `).join('');
    }

    // Add chart rendering
    function renderChart(data, type) {
        const ctx = document.getElementById('resultChart').getContext('2d');
        new Chart(ctx, {
            type: type,
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Query Results Visualization' }
                }
            }
        });
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            submitQuery();
        }
        if (e.ctrlKey && e.key === 'l') {
            clearResults();
        }
    });
});
