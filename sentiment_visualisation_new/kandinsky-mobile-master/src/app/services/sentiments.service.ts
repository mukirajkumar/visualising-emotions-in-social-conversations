import { Injectable } from '@angular/core';
import * as vader from 'vader-sentiment';

@Injectable({
  providedIn: 'root'
})
export class SentimentsService {
  constructor() {}

  analyseSentiments(comment: string): { scores: number[], label: string } {
    try {
      const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(comment);
      console.log(comment, " :", intensity);
      const { neg: neg_sentimentScore, neu: neu_sentimentScore, pos: pos_sentimentScore, compound: compound_sentimentScore } = intensity;
        
      // Determine the maximum score and its corresponding label
      const maxScore = Math.max(neg_sentimentScore, neu_sentimentScore, pos_sentimentScore);
      let label: string;
      if (compound_sentimentScore >= 0.05) {
          label = 'Positive';
      } else if (compound_sentimentScore <= -0.05) {
          label = 'Negative';
      }  else {
          label = 'Neutral';
      }

      return { scores: [neg_sentimentScore, neu_sentimentScore, pos_sentimentScore, compound_sentimentScore], label };
  } catch (error) {
      console.error('Error analysing sentiment:', error);
      return { scores: [0, 0, 0, 0], label: 'Error' };
  }
  }
}