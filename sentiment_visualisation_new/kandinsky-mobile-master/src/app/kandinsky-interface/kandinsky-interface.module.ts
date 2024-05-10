import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule} from '@ionic/angular';
import { ModalController } from '@ionic/angular';
import { MomentModule } from 'ngx-moment';
import { KandinskyInterfacePageRoutingModule } from './kandinsky-interface-routing.module';
import { KandinskyInterfacePage } from './kandinsky-interface.page';
import { CanvasComponent } from './canvas/canvas.component';
import { TimelineControlsComponent } from './timeline-controls/timeline-controls.component';
import { StatsComponent } from './stats/stats.component';
import { HighlightPipe } from '../highlight.pipe';
import { PostInformationModalComponent } from './post-information-modal/post-information-modal.component';
import { SpectrumControlsComponent } from './spectrum-controls/spectrum-controls.component';
import { RadarChartComponent } from '../sentiment-visualisation/sentiment-visualisation.component';
import { SanitizeHtmlPipe } from '../sanitize-html.pipe';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    KandinskyInterfacePageRoutingModule,
    MomentModule,
    
  ],
  declarations: [
    KandinskyInterfacePage,
    CanvasComponent,
    TimelineControlsComponent,
    RadarChartComponent,
    StatsComponent,
    HighlightPipe,
    PostInformationModalComponent,
    SpectrumControlsComponent,
    SanitizeHtmlPipe
  ],
  entryComponents: [
    PostInformationModalComponent,
    RadarChartComponent
  ]
})
export class KandinskyInterfacePageModule {}
