// sentiment-analysis.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SentimentAnalysisPageRoutingModule } from './sentiment-analysis-routing.module';
import { SentimentAnalysisPage } from './sentiment-analysis.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SentimentAnalysisPageRoutingModule,
  ],
  declarations: [SentimentAnalysisPage],
})
export class SentimentAnalysisPageModule { }
