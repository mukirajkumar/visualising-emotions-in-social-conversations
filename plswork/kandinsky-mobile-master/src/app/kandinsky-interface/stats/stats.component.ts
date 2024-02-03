import { Component, OnInit, Input } from '@angular/core';
import { SocialPost } from 'src/app/models/models';

@Component({
  selector: 'ksky-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss'],
})
export class StatsComponent implements OnInit {

  @Input()
  post: SocialPost;

  constructor() {
    // this.post.
  }

  ngOnInit() {}

}
