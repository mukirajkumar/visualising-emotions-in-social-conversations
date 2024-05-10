import { Component, Input, AfterViewInit } from '@angular/core';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-radar-chart',
  templateUrl: './sentiment-visualisation.component.html',
  styleUrls: ['./sentiment-visualisation.component.scss'],
})
export class RadarChartComponent implements AfterViewInit {
  @Input() chartData: any;

  radarChart: Chart;
  averageSentimentScore: number | null = null;
  selectedComment: string | null = null;
  allComments: string[] = [];
  comments: string[] = [];
  sentimentIcon: string | null = null

  constructor() {}

  ngOnInit() {
    if (this.chartData && this.chartData.datasets) {
      this.allComments = Array.from(new Set(this.chartData.datasets.map(dataset => dataset.label)));
    }
  }

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
    let filteredData: any[];
    if (this.selectedComment === "all") {
      filteredData = this.chartData.datasets;
    } else {
      filteredData = this.chartData.datasets.filter(dataset => dataset.label === this.selectedComment);
    }
    const colors = filteredData.map(dataset => this.getColorFromScore(dataset.data[3]));

    this.radarChart = new Chart('radarChartCanvas', {
      type: 'radar',
      data: {
        ...this.chartData,
        datasets: filteredData.map((dataset, index) => ({
          ...dataset,
          borderColor: colors[index],
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
        }
      }
    });
    this.comments = filteredData.map(dataset => dataset.label);
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
  
    let filteredData = this.selectedComment === "all" ? this.chartData.datasets : this.chartData.datasets.filter(dataset => dataset.label === this.selectedComment);
  
    if (filteredData.length === 0) {
      this.averageSentimentScore = null;
      return;
    }
  
    let sum = 0;
    let totalDatasets = 0;
  
    filteredData.forEach(dataset => {
      sum += dataset.data[3];
      totalDatasets++;
    });
  
    this.averageSentimentScore = sum / totalDatasets;
    if (this.averageSentimentScore >= 0.05) {
      this.sentimentIcon = "happy";
    } else if (this.averageSentimentScore <= -0.05) {
      this.sentimentIcon = "sad";
    } else {
      this.sentimentIcon = "neutral";
    }
  }
  

  filterChartData() {
    if (!this.chartData || !this.chartData.datasets) {
      return;
    }
    this.renderRadarChart();
    this.calculateAverageSentiment();
  }
}