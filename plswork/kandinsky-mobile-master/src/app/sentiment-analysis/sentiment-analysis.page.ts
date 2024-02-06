// new-page.page.ts
import { Component } from '@angular/core';
import { ApiService } from '../services/senti-api.service';
import * as moment from 'moment';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-sentiment-analysis',
  templateUrl: './sentiment-analysis.page.html',
  styleUrls: ['./sentiment-analysis.page.scss'],
})
export class SentimentAnalysisPage {
  youtubeUrl: string ='';
  chart: Chart; // Chart.js chart instance
  
  constructor(private apiService: ApiService) { }

  sendToApi() {
    // Call the API service to send the YouTube URL
    this.apiService.sendYoutubeUrl(this.youtubeUrl).subscribe(response => {
      // Handle the API response, visualize with Chart.js
      this.visualizeData(response);
    });
  }
  chartRendered: boolean = false
  visualizeData(data: any) {
    // Implement Chart.js logic to visualize the data as a stacked bar chart
    // Example: display the data in the console
    console.log(data);
    // Convert dates to formatted strings using moment.js
    const formattedDates = data.dates.map(date => moment(date, 'YYYY-MM-DD').format('MMM DD'));
  
    // Function to get color based on compound score
    const getColor = (value: number): string => {
      const normalizedValue = (value + 1) / 2;
      const hue = normalizedValue * 120;
      return `hsl(${hue}, 100%, 50%)`;
    };
  
    // Prepare data for Chart.js
    const chartData = {
      labels: formattedDates,
      datasets: [{
        data: data.compound_scores,
        backgroundColor: data.compound_scores.map(score => getColor(score)),
      }]
    };

    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
    }

    // Create new Chart.js chart
    const ctx = document.getElementById('timelineChart') as HTMLCanvasElement;
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: chartData,
      options: {
        scales: {
          xAxes: [{
            type: 'category',
          }],
          yAxes: [{
            id: 'y',
            display: true,
            scaleLabel: {
              display: true,
              labelString: 'value'
            }
          }]
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (context) => {
                return moment(context[0].label, 'MMM DD').format('MMM DD');
              }
            }
          }
        },
        elements: {
          rectangle:{
            backgroundColor: 'black',
          }
        },
      }
    });
    this.chartRendered = true;
  }
}
