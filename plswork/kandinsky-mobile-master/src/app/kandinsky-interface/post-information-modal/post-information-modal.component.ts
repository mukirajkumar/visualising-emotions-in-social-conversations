import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { SocialPost } from 'src/app/models/models';

@Component({
  selector: 'ksky-post-information-modal',
  templateUrl: './post-information-modal.component.html',
  styleUrls: ['./post-information-modal.component.scss'],
})
export class PostInformationModalComponent implements OnInit {

  post: SocialPost;

  constructor(
    private modalController: ModalController,
    private navParams: NavParams
  ) { }

  ngOnInit() {
    this.post = this.navParams.get('post');
  }

  dismiss() {
    this.modalController.dismiss();
  }

}
