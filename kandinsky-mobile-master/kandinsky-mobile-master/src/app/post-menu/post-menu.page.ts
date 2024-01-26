import { Component, OnInit } from '@angular/core';
import { KandinskyService } from '../services/kandinsky.service';
import { SocialPost } from '../models/models';
import { AlertController, NavController, LoadingController, ToastController } from '@ionic/angular';

@Component({
  selector: 'ksky-post-menu',
  templateUrl: './post-menu.page.html',
  styleUrls: ['./post-menu.page.scss'],
})
export class PostMenuPage implements OnInit {

  posts: SocialPost[];

  constructor(
    private kandinskyService: KandinskyService,
    private alertController: AlertController,
    private navController: NavController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) { }

  ionViewDidEnter() {
    this.fetchPosts();
  }

  private async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000
    });
    await toast.present();
  }

  async presentAddPostAlert() {
    const alert = await this.alertController.create({
      header: 'Add Post',
      subHeader: 'Enter the URL of the social media post to be added. Only Youtube videos are supported at the moment.',
      inputs: [
        {
          name: 'postUrl',
          type: 'url',
          placeholder: 'https://youtube.com/watch?v=...'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Add',
          handler: data => {
            const url: string = data.postUrl;
            const postId = this.kandinskyService.extractPostId(url);
            if (!postId) {
              this.presentToast('Unsupported URL provided.');
              return false;
            }
            this.presentToast('Added new post successfully!');
            this.navController.navigateForward(['', 'kandinsky-interface', postId]);
          }
        }
      ]
    });
    await alert.present();
  }

  ngOnInit() { }

  async fetchPosts() {
    const loading = await this.loadingController.create();
    loading.present();
    this.posts = await this.kandinskyService.getPosts();
    loading.dismiss();
  }

}
