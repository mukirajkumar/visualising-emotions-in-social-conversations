import Chart from 'https://cdn.jsdelivr.net/npm/chart.js';

const ctx = document.getElementById('commitsGraph').getContext('2d');

const commitsGraph = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['Jan 1', 'Jan 2', 'Jan 3', 'Jan 4', 'Jan 5'], // Sample dates
        datasets: [{
            label: 'Commits',
            data: [5, 10, 8, 15, 12], // Sample commit counts
            backgroundColor: '#ebedf0', // GitHub's background color
            borderWidth: 0
        }]
    },
    options: {
        plugins: {
            legend: {
                display: false
            },
            tooltips: {
                enabled: false
            }
        },
        scales: {
            x: {
                display: false
            },
            y: {
                display: false,
                min: 0,
                max: 20 // Adjust the max value based on your data
            }
        }
    }
});
