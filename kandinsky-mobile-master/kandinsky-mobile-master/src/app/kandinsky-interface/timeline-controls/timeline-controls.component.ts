import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'ksky-timeline-controls',
  templateUrl: './timeline-controls.component.html',
  styleUrls: ['./timeline-controls.component.scss'],
})
export class TimelineControlsComponent implements OnInit {

  playing = false;
  interval: NodeJS.Timeout;

  readonly MIN_PROGRESS = -1;
  
  @Input()
  readonly maxProgress = 100;
  
  @Input()
  readonly step = 1;
  
  @Input()
  readonly playIntervalMs = 500;

  @Input()
  progress: number;

  @Output()
  progressChange: EventEmitter<number>;

  constructor() {
    this.progressChange = new EventEmitter();
  }

  ngOnInit() {}

  play() {
    this.playing = true;
    this.progressChange.emit(this.progress);
    this.interval = setInterval(() => {
      this.progress += this.step;
      if (this.progress === this.maxProgress) {
        this.pause();
      }
    }, this.playIntervalMs);
  }

  pause() {
    if (!this.playing) {
      return;
    }

    this.playing = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  rangeChange() {
    this.progressChange.emit(this.progress);
    if (this.progress === this.maxProgress && this.playing) {
      this.pause();
    }
  }
}
