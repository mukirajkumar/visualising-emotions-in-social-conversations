// new-page.page.ts
import { Component } from '@angular/core';
import { ApiService } from '../services/senti-api.service';

@Component({
  selector: 'app-sentiment-analysis',
  templateUrl: './sentiment-analysis.page.html',
  styleUrls: ['./sentiment-analysis.page.scss'],
})
export class SentimentAnalysisPage {
  youtubeUrl: string ='';

  constructor(private apiService: ApiService) { }

  sendToApi() {
    // Call the API service to send the YouTube URL
    this.apiService.sendYoutubeUrl(this.youtubeUrl).subscribe(response => {
      // Handle the API response, visualize with Chart.js
      this.visualizeData(response);
    });
  }

  visualizeData(data: any) {
    // Implement Chart.js logic to visualize the data as a stacked bar chart
    // Example: display the data in the console
    console.log(data);
  }
}
