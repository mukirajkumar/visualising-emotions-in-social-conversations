// Sample data
var data = {
    dates: [
        "2022-01-01", "2022-01-02", "2022-01-03", "2022-01-04", "2022-01-05",
        "2022-01-06", "2022-01-07", "2022-01-08", "2022-01-09", "2022-01-10",
        "2022-01-11", "2022-01-12", "2022-01-13", "2022-01-14", "2022-01-15",
        "2022-01-16", "2022-01-17", "2022-01-18", "2022-01-19", "2022-01-20",
        "2022-01-21", "2022-01-22", "2022-01-23", "2022-01-24", "2022-01-25",
        "2022-01-26", "2022-01-27", "2022-01-28", "2022-01-29", "2022-01-30",
        // Add 30 more dates as needed
    ],
    compound_scores: [
        0.8, -0.4, 0.2, -0.6, 0.9,
        0.1, -0.2, 0.7, -0.5, 0.3,
        -0.8, 0.6, -0.1, 0.4, -0.3,
        0.2, -0.7, 0.5, -0.9, 0.8,
        -0.2, 0.6, -0.4, 0.7, -0.1,
        0.3, -0.5, 0.9, -0.8, 0.4,
        // Add 30 more compound scores as needed
    ]
};

// Convert dates to JavaScript Date objects
var formattedDates = data.dates.map(date => moment(date, 'YYYY-MM-DD').format('MMM DD'));

// Function to get color based on compound score
var getColor = function (value) {
    // Map values from the range [-1, 1] to the range [0, 1]
    var normalizedValue = (value + 1) / 2;

    // Interpolate between red, yellow, and green based on the normalized value
    var hue = normalizedValue * 120; // Adjust hue based on normalized value
    return 'hsl(' + hue + ', 100%, 50%)'; // Use HSL for color representation
};

// Prepare data for Chart.js
var chartData = {
    labels: formattedDates,
    datasets: [{
        data: data.compound_scores,
        backgroundColor: data.compound_scores.map(score => getColor(score)),
    }]
};

// Create timeline chart
var ctx = document.getElementById('timelineChart').getContext('2d');
var timelineChart = new Chart(ctx, {
    type: 'bar',
    data: chartData,
    options: {
        scales: {
            x: {
                type: 'category', // Use category scale for date labels
            },
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Compound Score'
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    title: function (context) {
                        // Display the formatted date in tooltips
                        return moment(context[0].label, 'MMM DD').format('MMM DD');
                    }
                }
            }
        },

        elements: {
            bar:{
                backgroundColor: 'black',
            }
        },
        legend: {
            display: false // Hide the default legend
        }
    }
});
