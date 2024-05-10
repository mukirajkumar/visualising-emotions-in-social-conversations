import { NgModule, Component, Input, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Circle, CanvasComponent, ConcentricCircleDatum, CircleDatum } from './canvas/canvas.component';
import { SocialComment, SocialPlatform, SocialPost } from '../models/models';
import { IonDatetime, ActionSheetController, ModalController, AlertController, IonSearchbar, LoadingController, NavController } from '@ionic/angular';
import { TimelineControlsComponent } from './timeline-controls/timeline-controls.component';
import { PostInformationModalComponent } from './post-information-modal/post-information-modal.component';
import { KandinskyService, SearchResult, CommentGroupInterval } from '../services/kandinsky.service';
import { ScaleLinear } from 'd3';
import _ from 'lodash';
import * as d3 from 'd3';
import { SpectrumRange, SpectrumInterval } from './spectrum-controls/spectrum-controls.component';
import { HighlightOption } from '../highlight.pipe';
import { ActivatedRoute } from '@angular/router';
import { SentimentsService } from '../services/sentiments.service';
import { RadarChartComponent } from '../sentiment-visualisation/sentiment-visualisation.component';

@Component({
  selector: 'ksky-kandinsky-interface',
  templateUrl: './kandinsky-interface.page.html',
  styleUrls: ['./kandinsky-interface.page.scss'],
})

@NgModule({
  declarations: [
    RadarChartComponent
  ],

})

export class KandinskyInterfacePage implements OnInit {
  loading: HTMLIonLoadingElement;
  post: SocialPost;
  circles: Circle[];
  timestamp: number = 0;
  progress: number = -1;
  maxProgress = 100;
  readonly STEP = 1;
  readonly PLAY_INTERVAL_MS = 100;
  spectrum: boolean = false;
  spectrumIntervals: SpectrumInterval[];
  spectrumRange: SpectrumRange;
  spectrumStartTime: number;
  spectrumEndTime: number;
  focus: boolean = false;
  searchQuery: string = '';
  searchResults: SearchResult[];
  selectedCircle: ConcentricCircleDatum;
  showComments: boolean = false;
  visibleCommentsCount: number = 0;
  barWidthScale: ScaleLinear<number, number>;
  groupedCommentsByTimestamp: CommentGroupInterval[];
  readonly MAX_COMMENT_BAR_WIDTH = 10;
  readonly MIN_COMMENT_BAR_WIDTH = 1;
  showSimilarComments: boolean = false;
  minimizeReferenceComment: boolean = true;
  visibleSimilarCommentsCount: number = 0;
  commentContext: CommentItemContext;
  commentRepliesContexts: CommentItemContext[];
  referenceCommentContext: CommentItemContext;
  similarCommentsContexts: CommentItemContext[];
  @Input() sentimentScores: number[];


  @ViewChild('timelineControls', { static: false })
  timelineControls: TimelineControlsComponent;

  @ViewChild('canvas', { static: true })
  canvas: CanvasComponent;

  @ViewChild('commentsList', { static: false, read: ElementRef })
  commentsList: ElementRef;

  @ViewChild('searchbar', { static: false })
  searchbar: IonSearchbar;
  showRadarChart: boolean;

  

  constructor(
    private kandinskyService: KandinskyService,
    private sentimentsService: SentimentsService,
    private actionSheetController: ActionSheetController,
    private modalController: ModalController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private route: ActivatedRoute,
    private navController: NavController
  ) {
  }

  
  async presentMenuActionSheet() {
    const actionSheet = await this.actionSheetController.create({
      buttons: [
        {
          text: 'Information',
          handler: () => {
            this.actionSheetController.dismiss();
            this.presentPostInformationModal();
          }
        },
        {
          text: 'Back to Menu',
          handler: () => {
            this.actionSheetController.dismiss();
            this.navController.navigateBack(['']);
          }
        },
        {
          text: 'Reload Data',
          role: 'destructive',
          handler: () => {
            this.actionSheetController.dismiss();
            this.presentConfirmReloadDataAlert();
          }
        },
        {
          text: 'Delete Post',
          role: 'destructive',
          handler: () => {
            this.actionSheetController.dismiss();
            this.presentConfirmDeletePostAlert();
          }
        }, {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async presentConfirmDeletePostAlert() {
    const alert = await this.alertController.create({
      header: 'Delete this post?',
      subHeader: 'This will permanently delete all data extracted related to this post.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Yes, delete post',
          handler: async () => {
            const loading = await this.loadingController.create({
              mode: 'ios'
            });
            await loading.present();
            await this.kandinskyService.deletePost(this.post.id, this.post.platform);
            loading.dismiss();
            this.navController.navigateBack(['']);
          }
        }
      ]
    });
    await alert.present();
  }

  async presentConfirmReloadDataAlert() {
    const alert = await this.alertController.create({
      header: 'Reload post data?',
      subHeader: 'This will delete cached data about this post and re-run data extraction.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Yes, reload data',
          handler: () => {
            this.kandinskyService.reloadActivePost();
          }
        }
      ]
    });
    await alert.present();
  }

  async presentPostInformationModal() {
    const modal = await this.modalController.create({
      component: PostInformationModalComponent,
      componentProps: {
        post: this.post
      },
      cssClass: 'auto-sized-modal'
    });
    await modal.present();
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.initialize(params.id);
    });
  }

  onCanvasReady() {
    if (this.loading) {
      this.loading.dismiss();
      this.loading = undefined;
    }
  }

  async initialize(postId: string) {

    if (!this.loading) {
      this.loading = await this.loadingController.create({
        mode: 'ios'
      });
    }

    this.loading.present();
    console.log('setting active post...')
    await this.kandinskyService.setActivePost(postId, SocialPlatform.YOUTUBE, this.loading);

    console.time('preparing data for canvas');
    this.loading.message = 'Preparing canvas...';
    this.post = this.kandinskyService.getActivePost();
    this.maxProgress = this.post.metadata.comments.actualCount - 1;

    console.log('grouping comments by timestamp...')
    this.groupedCommentsByTimestamp = this.kandinskyService.groupCommentsByTimestamp(100);

    let progress = 0;
    this.spectrumIntervals = this.groupedCommentsByTimestamp.map(g => ({
      progress: progress += g.count,
      value: g.count
    }));

    const comments = this.kandinskyService.getActivePostComments();
    console.log('mapping comments to circle entities...');
    this.circles = comments.map(c => this.mapCommentToCircle(c));
    console.timeEnd('preparing data for canvas');
  }

  onSearchFocus(focused: boolean) {
    this.focus = focused;

    if (focused && this.timelineControls && this.timelineControls.playing) {
      this.timelineControls.pause();
    }
  }

  toggleSpectrum() {
    this.spectrum = !this.spectrum;
    this.canvas.resetZoom();

    if (this.spectrum) {
      this.timestamp = this.kandinskyService.getCommentTimestampByIndex(this.maxProgress);
    } else {
      this.canvas.setHighlighted([]);
    }
  }

 

  spectrumRangeChange() {

    const lowerGroupIndex = this.spectrumRange.lower === -1 ? 0 : this.spectrumRange.lower;
    const upperGroupIndex = this.spectrumRange.upper === -1 ? 0 : this.spectrumRange.upper;

    if (lowerGroupIndex === 0 && upperGroupIndex === 0) {
      return;
    }

    let commentIds: string[] = [];
    for (let index = lowerGroupIndex; index <= upperGroupIndex; index++) {
      const group = this.groupedCommentsByTimestamp[index];

      if (index === lowerGroupIndex) {
        this.spectrumStartTime = group.start;
      }

      if (index === upperGroupIndex) {
        this.spectrumEndTime = group.stop;
      }
      commentIds.push(...group.comments.map(c => c.id));
    }

    this.canvas.setHighlighted(commentIds);
    setTimeout(() => this.updateCommentContexts());

  }

  updateCommentContexts() {

    const commentContextsToUpdate: CommentItemContext[] = [];
    let prevVisibileCommentsCount = 0;
    let newVisibleCommentsCount = 0;

    if (this.showComments) {
      prevVisibileCommentsCount = this.visibleCommentsCount;
      commentContextsToUpdate.push(this.commentContext, ...this.commentRepliesContexts);
      this.visibleCommentsCount = this.countVisibleComments([this.selectedCircle.pivot, ...this.selectedCircle.pivot.children]);
      newVisibleCommentsCount = this.visibleCommentsCount;
    }
    
    if (this.showSimilarComments) {
      prevVisibileCommentsCount = this.visibleSimilarCommentsCount;
      commentContextsToUpdate.push(this.referenceCommentContext, ...this.similarCommentsContexts);
      this.visibleSimilarCommentsCount = this.countVisibleComments(this.similarCommentsContexts.map(c => c.context.circle));
      newVisibleCommentsCount = this.visibleSimilarCommentsCount;
    }

    commentContextsToUpdate.forEach(c => c.context.display.visible = this.canDisplayComment(c.context.circle));
    if (newVisibleCommentsCount > 0 && prevVisibileCommentsCount != newVisibleCommentsCount) {
      const lastCommentContext = commentContextsToUpdate.filter(c => c.context.display.visible).pop();
      setTimeout(() => {
        const target = document.getElementById(lastCommentContext.context.id);
        target.scrollIntoView({
          behavior: 'smooth'
        });
      });
    }
  }

  selectCircle(circle: ConcentricCircleDatum) {

    if (this.showSimilarComments) {
      this.unselectSimilarityReferenceCircle();
    }

    if (this.selectedCircle === circle) {
      return;
    }

    this.selectedCircle = circle;
    this.sentimentScores = this.getSentimentScores(circle);
    console.log("Sentiment Scores:", this.sentimentScores);

    if (!this.selectedCircle) {
      this.showComments = false;
      this.barWidthScale = undefined;
      this.visibleCommentsCount = 0;
      this.commentContext = null;
      this.commentRepliesContexts = [];
      return;
    }

    this.showComments = true;
    this.visibleCommentsCount = this.countVisibleComments([this.selectedCircle.pivot, ...this.selectedCircle.pivot.children]);

    if (this.timelineControls && this.timelineControls.playing) {
      this.timelineControls.pause();
    }
    this.barWidthScale = this.buildBarWidthScaleFromCircle(circle);
    if (this.commentsList) {
      this.commentsList.nativeElement.scrollTop = 0;
    }

    this.commentContext = this.buildCommentItemContext(circle.pivot);
    this.commentRepliesContexts = circle.pivot.children.map(c => this.buildCommentItemContext(c));
    console.log("selectCircle function is done")
  }
  async openSentimentAnalysisModal() {
    console.log("enters openSentimentAnalysisModal");
    await this.selectCircle(this.selectedCircle);
    const chartData = {
        labels: ['Negative', 'Neutral', 'Positive', 'Overall'],
        datasets: []
    };
    for (let i = 0; i < this.sentimentScores.length; i += 4) {
        const commentSentiments = this.sentimentScores.slice(i, i + 4);
        const label = `Comment ${i / 4 + 1}`;
        chartData.datasets.push({
            label: label,
            data: commentSentiments,
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderWidth: 2
        });
    }
    const modal = await this.modalController.create({
        component: RadarChartComponent,
        componentProps: {
            chartData: chartData
        }
    });
    
    console.log("modal presented");
    return await modal.present(); 
}


  
  getSentimentScores(circle: ConcentricCircleDatum): number[] {
    const sentimentScores: number[] = [];
    if (circle.pivot && circle.pivot.data && circle.pivot.data.sentiments && circle.pivot.data.sentiments.sentiment) {
        const sentiment = circle.pivot.data.sentiments.sentiment;
        if (sentiment.neg_sentimentScore != null) {
            sentimentScores.push(sentiment.neg_sentimentScore);
        }
        if (sentiment.neu_sentimentScore != null) {
            sentimentScores.push(sentiment.neu_sentimentScore);
        }
        if (sentiment.pos_sentimentScore != null) {
            sentimentScores.push(sentiment.pos_sentimentScore);
        }
        if (sentiment.compound_sentimentScore != null) {
          sentimentScores.push(sentiment.compound_sentimentScore);
      }
    }
    if (circle.pivot && circle.pivot.children) {
        circle.pivot.children.forEach(comment => {
            if (comment.data && comment.data.sentiments && comment.data.sentiments.sentiment) {
                const sentiment = comment.data.sentiments.sentiment;
                if (sentiment.neg_sentimentScore != null) {
                  sentimentScores.push(sentiment.neg_sentimentScore);
              }
              if (sentiment.neu_sentimentScore != null) {
                  sentimentScores.push(sentiment.neu_sentimentScore);
              }
              if (sentiment.pos_sentimentScore != null) {
                  sentimentScores.push(sentiment.pos_sentimentScore);
              }
              if (sentiment.compound_sentimentScore != null) {
                sentimentScores.push(sentiment.compound_sentimentScore);
            }
            }
        });
    }
    return sentimentScores;
}

async closeModal() {
  await this.modalController.dismiss();
}

  buildBarWidthScaleFromCircle(circle: ConcentricCircleDatum) {

    const pivots = d3.hierarchy(circle, c => c.peripherals)
      .descendants()
      .map(c => c.data.pivot);
    
    const values = d3.hierarchy({ children: pivots, data: undefined }, c => c.children)
      .descendants()
      .splice(1)
      .map(c => c.data.data.likeCount);

    return this.buildBarWidthScale(values);
  }

  buildBarWidthScale(values: number[]) {
    return d3.scaleLinear()
      .domain([Math.min(...values), Math.max(...values)])
      .range([this.MIN_COMMENT_BAR_WIDTH, this.MAX_COMMENT_BAR_WIDTH]);
  }

  canDisplayComment(circle: CircleDatum) {
    return circle.isDisplayed && (this.spectrum ? circle.isHighlighted : true);
  }

  countVisibleComments(circles: CircleDatum[]) {
    return circles.filter(c => this.canDisplayComment(c)).length;
  }
  updateTimestamp(progress: number) {
    setTimeout(() => {

      this.updateCommentContexts();

      if (this.selectedCircle) {
        if (!this.selectedCircle.isDisplayed) {

          if (this.showSimilarComments) {
            this.unselectSimilarityReferenceCircle();
          }

          this.canvas.unselect();
        }
      }
    });
    
    if (progress === -1) {
      this.timestamp = 0;
      return;
    }
    
    this.timestamp = this.kandinskyService.getCommentTimestampByIndex(progress);
  }

  private mapCommentToCircle(comment: SocialComment): Circle {
    return {
      id: comment.id,
      colorReference: comment.sentiments.sentiment.compound_sentimentScore,
      children: comment.comments.map(c => this.mapCommentToCircle(c)),
      value: comment.likeCount,
      data: comment,
      timestampCue: comment.publishTimestamp
    };
  }

  search(query: string = "") {

    console.time('keyword search');

    this.focus = query.length > 0;
    this.searchResults = this.kandinskyService.searchComments(query);

    const commentIds = this.searchResults.map(r => r.commentId);
    this.canvas.setFocused(commentIds);
    const commentContextsToUpdate: CommentItemContext[] = [];

    if (this.showComments) {
      commentContextsToUpdate.push(this.commentContext, ...this.commentRepliesContexts);
    }

    if (this.showSimilarComments) {
      commentContextsToUpdate.push(this.referenceCommentContext, ...this.similarCommentsContexts);
    }

    commentContextsToUpdate
      .filter(c => c.context.display.visible)
      .forEach(c => {

        const match = this.searchResults.find(r => r.commentId === c.context.comment.id);
        c.context.display.highlightOptions = [
          c.context.display.highlightOptions[0],
          {
            ...c.context.display.highlightOptions[1],
            indices: match ? match.indices : []
          }
        ];
      });
    
    console.timeEnd('keyword search');
  }

  buildCommentItemContext(circle: CircleDatum, {
    showRepliesButton = true,
    showSimilaritiesButton = true,
    showLines = true,
    forceVisibility = false,
    showSimilarityScore = false,
    similarityScore = 0
  } = {}): CommentItemContext {

    const result = this.searchResults ? this.searchResults.find(r => r.commentId === circle.circleId) : null;
    const comment: SocialComment = circle.data;
    const totalReplyCount = circle.children.length > 0 ? this.countVisibleComments(circle.children) : 0;
    const topicIndices = [].concat.apply([], [...Object.values(comment.analytics.similarity.topics)].map(t => t.indices));
    
    return {
      context: {
        id: `comment-${comment.id}`,
        comment: comment,
        display: {
          visible: forceVisibility || this.canDisplayComment(circle),
          showLines: showLines,
          highlightOptions: [
            {
              indices: topicIndices,
              color: 'yellow',
              textColor: 'black'
            }, {
              indices: result ? result.indices : [],
              color: 'blue',
              textColor: 'white'
            }
          ]
        },
        bar: {
          color: circle.color,
          width: this.barWidthScale(comment.likeCount) + 'px',
        },
        circle: circle,
        replies: {
          count: totalReplyCount,
          showViewAsReplyToParentButton: showRepliesButton && circle.isPivot && comment.parentId !== null,
          showViewRepliesButton: showRepliesButton && !circle.isPivot && totalReplyCount > 0
        },
        analytics: {
          similarity: {
            showButton: showSimilaritiesButton && comment.analytics.similarity.comments.length > 0,
            similarCommentsCount: comment.analytics.similarity.comments.length,
            showScore: showSimilarityScore,
            score: similarityScore
          }
        },
        sentiments: {
          sentiment: {
            neg_sentimentScore: comment.sentiments.sentiment.neg_sentimentScore,
            neu_sentimentScore: comment.sentiments.sentiment.neg_sentimentScore,
            pos_sentimentScore: comment.sentiments.sentiment.neg_sentimentScore,
            compound_sentimentScore: comment.sentiments.sentiment.neg_sentimentScore


          }
        }
      }
    };
  }
  selectCircleByPivotId(pivotId: string, targetCircleId: string) {
    this.canvas.selectByPivotId(pivotId);
    setTimeout(() => {
      const target = document.getElementById(`comment-${targetCircleId}`);
      target.scrollIntoView({
        behavior: 'smooth'
      });
    });
  }

  unselectSimilarityReferenceCircle() {
    this.barWidthScale = this.buildBarWidthScaleFromCircle(this.selectedCircle);

    this.showSimilarComments = false;
    this.visibleSimilarCommentsCount = 0;
    this.canvas.setFocused([]);
  }

  selectSimilarityReferenceCircleById(circleId: string) {
    this.searchQuery = '';
    const similarityReferenceCircle = [
      this.selectedCircle.pivot,
      ...this.selectedCircle.pivot.children
    ].find(c => c.circleId === circleId);

    const comment: SocialComment = similarityReferenceCircle.data;
    const similarCommentIds = comment.analytics.similarity.comments.map(c => c.commentId);

    const similarCommentCircles = this.canvas.getCircleData(similarCommentIds);
    const values = [comment.likeCount, ...similarCommentCircles.map(d => d.data.likeCount)];
    this.barWidthScale = this.buildBarWidthScale(values);
    this.canvas.setFocused(similarCommentIds);

    this.referenceCommentContext = this.buildCommentItemContext(similarityReferenceCircle, {
      showRepliesButton: false,
      showSimilaritiesButton: false,
      showLines: false,
      forceVisibility: true
    });

    this.similarCommentsContexts = similarCommentCircles.map(circle => {

      let similarityScore = 0;
      const similarComment: SocialComment = circle.data;
      const similarity = comment.analytics.similarity.comments.find(c => c.commentId === similarComment.id);
      if (similarity) {
        similarityScore = similarity.score;
      }

      return this.buildCommentItemContext(circle, {
        showRepliesButton: false,
        showSimilaritiesButton: false,
        showSimilarityScore: true,
        similarityScore: similarityScore
      });

    });

    this.visibleSimilarCommentsCount = this.countVisibleComments(similarCommentCircles);
    this.showSimilarComments = true;
  }
  
}

type CommentItemContext = {
  context: {
    id: string;
    comment: SocialComment;
    display: {
      visible: boolean;
      showLines: boolean;
      highlightOptions: HighlightOption[];
    },
    bar: {
      color: string;
      width: string;
    },
    circle: CircleDatum,
    replies: {
      count: number;
      showViewAsReplyToParentButton: boolean;
      showViewRepliesButton: boolean;
    },
    analytics: {
      similarity: {
        showButton: boolean;
        similarCommentsCount: number;
        showScore: boolean;
        score: number;
      }
    },
    sentiments: {
      sentiment:{
        neg_sentimentScore ?: number
        neu_sentimentScore ?: number
        pos_sentimentScore ?: number
        compound_sentimentScore ?: number
      }
    }
  }
}
