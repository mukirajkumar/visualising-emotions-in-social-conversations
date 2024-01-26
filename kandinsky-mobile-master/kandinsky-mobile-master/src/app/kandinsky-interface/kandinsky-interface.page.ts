import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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

@Component({
  selector: 'ksky-kandinsky-interface',
  templateUrl: './kandinsky-interface.page.html',
  styleUrls: ['./kandinsky-interface.page.scss'],
})
export class KandinskyInterfacePage implements OnInit {

  // loading overlay
  loading: HTMLIonLoadingElement;

  // interface
  post: SocialPost;

  // canvas
  circles: Circle[];
  timestamp: number = 0;

  // timeline controls
  progress: number = -1;
  maxProgress = 100;
  readonly STEP = 1;
  readonly PLAY_INTERVAL_MS = 100;

  // spectrum controls
  spectrum: boolean = false;
  spectrumIntervals: SpectrumInterval[];
  spectrumRange: SpectrumRange;
  spectrumStartTime: number;
  spectrumEndTime: number;

  // search
  focus: boolean = false;
  searchQuery: string = '';
  searchResults: SearchResult[];

  // comments
  selectedCircle: ConcentricCircleDatum;
  showComments: boolean = false;
  visibleCommentsCount: number = 0;
  barWidthScale: ScaleLinear<number, number>;
  groupedCommentsByTimestamp: CommentGroupInterval[];
  readonly MAX_COMMENT_BAR_WIDTH = 10;
  readonly MIN_COMMENT_BAR_WIDTH = 1;

  // similar comments
  showSimilarComments: boolean = false;
  minimizeReferenceComment: boolean = true;
  visibleSimilarCommentsCount: number = 0;

  // comment item contexts (used to display comments)
  // used to avoid angular's change detection calling the buidlcontext multiple times
  commentContext: CommentItemContext;
  commentRepliesContexts: CommentItemContext[];
  referenceCommentContext: CommentItemContext;
  similarCommentsContexts: CommentItemContext[];

  @ViewChild('timelineControls', { static: false })
  timelineControls: TimelineControlsComponent;

  @ViewChild('canvas', { static: true })
  canvas: CanvasComponent;

  @ViewChild('commentsList', { static: false, read: ElementRef })
  commentsList: ElementRef;

  @ViewChild('searchbar', { static: false })
  searchbar: IonSearchbar;

  constructor(
    private kandinskyService: KandinskyService,
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

    // timeout because of race condition when propagating highlight changes to canvas
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

    // build colored border width scale from circle
    this.barWidthScale = this.buildBarWidthScaleFromCircle(circle);
    
    // scroll up if there are comments for this circle
    if (this.commentsList) {
      this.commentsList.nativeElement.scrollTop = 0;
    }

    this.commentContext = this.buildCommentItemContext(circle.pivot);
    this.commentRepliesContexts = circle.pivot.children.map(c => this.buildCommentItemContext(c));
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

  // called by timeline controls on change
  updateTimestamp(progress: number) {

    // timeout because of race condition when propagating timestamp to canvas
    setTimeout(() => {

      this.updateCommentContexts();

      if (this.selectedCircle) {

        // if selected circle disappears, unselect the selected circle
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
      colorReference: comment.authorName,
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

    // update the highlightOptions of visible comments
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

        // must replace list of highlightOptions to trigger change detection and call highlight pipe
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

    // extract indices to highlight topic terms
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
        }
      }
    };
  }

  // called when 'View replies' or 'View as reply to ...' button is clicked in a comment
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

    // reset bar width scale back to selected circle's context
    this.barWidthScale = this.buildBarWidthScaleFromCircle(this.selectedCircle);

    this.showSimilarComments = false;
    this.visibleSimilarCommentsCount = 0;
    this.canvas.setFocused([]);
  }

  selectSimilarityReferenceCircleById(circleId: string) {

    // clear search bar
    this.searchQuery = '';

    // get reference circle from selected concentric circle
    const similarityReferenceCircle = [
      this.selectedCircle.pivot,
      ...this.selectedCircle.pivot.children
    ].find(c => c.circleId === circleId);

    const comment: SocialComment = similarityReferenceCircle.data;
    const similarCommentIds = comment.analytics.similarity.comments.map(c => c.commentId);

    const similarCommentCircles = this.canvas.getCircleData(similarCommentIds);

    // rebuild bar witdh scale with values from comment and similar comments
    const values = [comment.likeCount, ...similarCommentCircles.map(d => d.data.likeCount)];
    this.barWidthScale = this.buildBarWidthScale(values);

    // highlight similar circles
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
    }
  }
}
