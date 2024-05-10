import { Injectable } from '@angular/core';
import * as vader from 'vader-sentiment';

@Injectable({
  providedIn: 'root'
})
export class SentimentsService {
  constructor() {}

  analyseSentiments(comment: string): number[] {
    try {
      const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(comment);
      console.log(comment, " :", intensity);
      const { neg: neg_sentimentScore, neu: neu_sentimentScore, pos: pos_sentimentScore, compound: compound_sentimentScore } = intensity;
      return [neg_sentimentScore, neu_sentimentScore, pos_sentimentScore, compound_sentimentScore];
    } catch (error) {
      console.error('Error analysing sentiment:', error);
      return [0, 0, 0, 0];
    }
  }
}