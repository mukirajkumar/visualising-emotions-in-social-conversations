import { Component } from '@angular/core';
import { ApiService } from '../services/senti-api.service';
import * as moment from 'moment';
import { Chart } from 'chart.js';

// Define a custom type for monthly data
interface MonthlyData {
  [month: string]: {
    sum: number;
    count: number;
    compoundScores: number[];
  };
}

@Component({
  selector: 'app-sentiment-analysis',
  templateUrl: './sentiment-analysis.page.html',
  styleUrls: ['./sentiment-analysis.page.scss'],
})
export class SentimentAnalysisPage {
  youtubeUrl: string = '';
  overviewChart: Chart; // Monthly overview chart
  detailedChart: Chart; // Detailed chart for selected month

  constructor(private apiService: ApiService) {}

  sendToApi() {
    // Call the API service to send the YouTube URL
    this.apiService.sendYoutubeUrl(this.youtubeUrl).subscribe(response => {
      // Handle the API response, visualize with Chart.js
      this.visualizeData(response);
    });
  }

  visualizeData(data: any) {
    // Convert dates to formatted strings using moment.js
    const formattedDates = data.dates.map(date => moment(date, 'YYYY-MM-DD').format('MMM'));

    // Define monthlyData with explicit type annotation
    const monthlyData: MonthlyData = {};

    data.dates.forEach((date, index) => {
      const month = moment(date, 'YYYY-MM-DD').format('MMM');
      if (!monthlyData[month]) {
        monthlyData[month] = { sum: 0, count: 0, compoundScores: [] };
      }
      monthlyData[month].sum += data.compound_scores[index];
      monthlyData[month].count++;
      monthlyData[month].compoundScores.push(data.compound_scores[index]);
    });

    const averageScores = Object.keys(monthlyData).map(month => {
      return monthlyData[month].sum / monthlyData[month].count;
    });

    // Function to get color based on average compound score
    const getColor = (value: number): string => {
      const normalizedValue = (value + 1) / 2;
      const hue = normalizedValue * 120;
      return `hsl(${hue}, 100%, 50%)`;
    };

    // Prepare data for monthly overview chart
    const overviewChartData = {
      labels: Object.keys(monthlyData),
      datasets: [
        {
          data: averageScores,
          backgroundColor: averageScores.map(score => getColor(score)),
        },
      ],
    };

    // Destroy existing overview chart if it exists
    if (this.overviewChart) {
      this.overviewChart.destroy();
    }

    // Create new monthly overview Chart.js chart
    const overviewCtx = document.getElementById('overviewChart') as HTMLCanvasElement;
    this.overviewChart = new Chart(overviewCtx, {
      type: 'bar',
      data: overviewChartData,
      options: {
        scales: {
          xAxes: [
            {
              type: 'category',
            },
          ],
          yAxes: [
            {
              id: 'y',
              display: true,
              scaleLabel: {
                display: true,
                labelString: 'Average Compound Score',
              },
            },
          ],
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: context => {
                return context[0].label;
              },
            },
          },
        },
        elements: {
          rectangle: {
            backgroundColor: 'black',
          },
        },
        onClick: (evt, item: { index?: number }[]) => {
          if (item && item.length > 0 && 'index' in item[0]) {
            const monthIndex = item[0].index;
            const selectedMonth = Object.keys(monthlyData)[monthIndex];
            const monthCompoundScores = monthlyData[selectedMonth].compoundScores;
            this.updateDetailedChart(selectedMonth, monthCompoundScores);
          }
        },
      },
    });
  }

  updateDetailedChart(month: string, compoundScores: number[]) {
    const detailedChartData = {
      labels: Array.from({ length: compoundScores.length }, (_, i) => (i + 1).toString()),
      datasets: [
        {
          labels: `Sentiments for ${month}`,
          data: compoundScores,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    };

    if (this.detailedChart) {
      this.detailedChart.destroy();
    }

    const detailedCtx = document.getElementById('detailedChart') as HTMLCanvasElement;
    this.detailedChart = new Chart(detailedCtx, {
      type: 'line',
      data: detailedChartData,
      options: {
        scales: {
          xAxes: [
            {
              scaleLabel: {
                display: true,
                labelString: 'Comment Number',
              },
            },
          ],
          yAxes: [
            {
              scaleLabel: {
                display: true,
                labelString: 'Compound Score',
              },
            },
          ],
        },
      },
    });
  }
}
