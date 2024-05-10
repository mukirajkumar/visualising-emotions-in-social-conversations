import { Component, Input, AfterViewInit } from '@angular/core';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-radar-chart',
  templateUrl: './sentiment-visualisation.component.html',
  styleUrls: ['./sentiment-visualisation.component.scss'],
})
export class RadarChartComponent implements AfterViewInit {
  @Input() chartData: any;
  @Input() commentContent: string;
  @Input() commentScore: number;

  radarChart: Chart;
  averageSentimentScore: number | null = null;
  sentimentIcon: string | null = null;

  constructor() {}

  ngAfterViewInit() {
    console.log('what I have to visualize -> chartData:', this.chartData);
    this.renderRadarChart();
    this.calculateAverageSentiment();
  }

  renderRadarChart() {
    if (!this.chartData || !this.chartData.datasets) {
      console.error('chartData or datasets are not defined.');
      return;
    }
    
    const color = this.getColorFromScore(this.commentScore);

    this.radarChart = new Chart('radarChartCanvas', {
      type: 'radar',
      data: {
        ...this.chartData,
        datasets: this.chartData.datasets.map((dataset) => ({
          ...dataset,
          borderColor: color,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderWidth: 2
        }))
      },
      options: {
        scale: {
          ticks: {
            suggestedMin: -1,
            suggestedMax: 1
          }
        },
        devicePixelRatio: window.devicePixelRatio || 1
      }
    });
  }

  getColorFromScore(score: number): string {
    const normalizedScore = (score + 1) / 2;
    const hue = normalizedScore * 120;
    return `hsl(${hue}, 100%, 50%)`;
  }

  calculateAverageSentiment() {
    if (!this.chartData || !this.chartData.datasets) {
      return;
    }
  
    if (this.commentScore >= 0.05) {
      this.sentimentIcon = "happy";
    } else if (this.commentScore <= -0.05) {
      this.sentimentIcon = "sad";
    } else {
      this.sentimentIcon = "neutral";
    }
  }
}
