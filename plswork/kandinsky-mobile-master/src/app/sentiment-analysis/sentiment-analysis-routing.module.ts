// sentiment-analysis-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SentimentAnalysisPage } from './sentiment-analysis.page';

const routes: Routes = [
  {
    path: '',
    component: SentimentAnalysisPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SentimentAnalysisPageRoutingModule {}
