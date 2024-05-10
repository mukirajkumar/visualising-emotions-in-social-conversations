import { Observable, from, of } from 'rxjs';
import { SocialPost, SocialComment, RawSocialPost, RawSocialComment, PostCommentsMetadata } from 'src/app/models/models';
import { switchMap, map, tap, mapTo } from 'rxjs/operators';
import * as d3 from 'd3';
import { AnalyticsService } from '../analytics.service';
import { SentimentsService } from 'src/app/services/sentiments.service'

export abstract class SocialService {
  
  constructor(
    private analyticsService: AnalyticsService,
    private postStorage: LocalForage,
    private commentStorage: LocalForage,
    private sentimentService: SentimentsService
  ) {
  }
  
  protected abstract fetchPost(postId: string): Observable<RawSocialPost>;
  protected abstract fetchComments(postId: string): Observable<RawSocialComment>;
  public abstract extractPostId(postUrl: string): string;

  public async getPosts(): Promise<SocialPost[]> {
    const postIds = await this.postStorage.keys();
    return Promise.all(postIds.map(postId => this.postStorage.getItem<SocialPost>(postId)));
  }

  public async clearStorage() {
    await this.postStorage.clear();
    await this.commentStorage.clear();
    console.log(`successfully cleared post and comment storage`);
  }

  public async deleteComments(postId: string): Promise<void> {
    const keys = await this.getPostCommentStorageKeys(postId);
    await Promise.all(keys.map(key => this.commentStorage.removeItem(key)));
    console.log(`successfully deleted comments of post ${postId}`);
  }

  public async deletePost(postId: string, includeComments: boolean = true): Promise<void> {
    if (includeComments) {
      await this.deleteComments(postId);
    }
    await this.postStorage.removeItem(postId);
    console.log(`successfully deleted post ${postId}`);
  }

  public async archivePost(postId: string, archive: boolean = true) {
    const post = await this.getPostFromStorage(postId);

    const now = new Date().getTime();
    post.metadata.archiveTimestamp = now;
    post.metadata.lastUpdateTimestamp = now;
    post.metadata.archived = archive;

    await this.savePost(postId, post);
    console.log(`successfully ${archive ? '' : 'un'}archived post ${postId}`);
  }

  private mapToSocialComment(comment: RawSocialComment): SocialComment {
    return {
      ...comment,
      comments: comment.comments.map(c => this.mapToSocialComment(c)),
      analytics: {
        similarity: {
          comments: null,
          topics: null
        }
      },
      sentiments: {
        sentiment: {
          neg_sentimentScore: null,
          neu_sentimentScore: null,
          pos_sentimentScore: null,
          compound_sentimentScore: null
        },
        label: null
      }
    };
  }

  public async getCommentsFromStorage(postId: string): Promise<SocialComment[]> {
    const keys = await this.getPostCommentStorageKeys(postId);
    const comments = await Promise.all(keys.map(key => this.commentStorage.getItem<SocialComment>(key)));
    if (!comments) {
      console.warn(`no comments of post ${postId} was found in storage`);
    }
    console.log(`found comments of post ${postId} in storage`);
    return comments;
  }

  private buildPostCommentStorageKey(postId: string, comment: SocialComment) {
    return `${postId}_${comment.id}`;
  }

  private async getPostCommentStorageKeys(postId: string) {
    const allKeys = await this.commentStorage.keys();
    return allKeys.filter(key => key.startsWith(postId));
  }

  protected async saveComments(postId: string, comments: SocialComment[], updatePostMetadata: boolean = true, analyzedComments: boolean = false): Promise<void> {

    await Promise.all(comments.map(async comment => {
      const key = this.buildPostCommentStorageKey(postId, comment);
      await this.commentStorage.setItem(key, comment);
    }));
    console.log(`successfully saved ${analyzedComments ? 'analyzed' : ''} comments of post ${postId}`);

    if (!updatePostMetadata) {
      return;
    }

    const post = await this.getPostFromStorage(postId);
    if (!post) {
      console.warn(`tried to update post ${postId} comments metadata but the post was not found in storage`);
      return;
    }

    const now = new Date().getTime();
    post.metadata.lastUpdateTimestamp = now;
    post.metadata.comments = this.buildPostCommentsMetadata(comments, now, analyzedComments);

    await this.savePost(postId, post);
    console.log(`successfully updated post ${postId} comments metadata`);
  }

  private buildPostCommentsMetadata(comments: SocialComment[], timestamp: number = new Date().getTime(), analyzed = false): PostCommentsMetadata {

    const commentTimestamps = this.flattenComments(comments)
      .map(c => c.publishTimestamp)
      .sort((a, b) => a - b);

    return {
      actualCount: commentTimestamps.length,
      lastUpdateTimestamp: timestamp,
      lastAnalysisTimestamp: analyzed ? timestamp : null,
      firstTimestamp: commentTimestamps[0],
      lastTimestamp: commentTimestamps[commentTimestamps.length - 1],
    }
  }

  public flattenComments(comments: SocialComment[]): SocialComment[] {
    return d3.hierarchy({ comments }, c => c.comments)
      .descendants().splice(1)
      .map(c => c.data as SocialComment);
  }

  public async analyzeComments(postId: string, similarityThreshold = 0.5): Promise<SocialComment[]> {
    console.time('analyzing comments');
    const comments = await this.getCommentsFromStorage(postId);
    const allComments = this.flattenComments(comments);

    console.log(`generating topics for comments of post ${postId}`);
    allComments.forEach(comment => {
      const topics = this.analyticsService.generateTopics(comment.content);
      comment.analytics = { similarity: { topics, comments: [] } };
    });
    
    console.log(`finding similar comments for comments of post ${postId}`);
    allComments.forEach(comment => {
      comment.analytics.similarity.comments = allComments
        .filter(c => c.id !== comment.id)
        .map(c => ({
          commentId: c.id,
          score: this.analyticsService.calculateTopicSimilarity(comment.analytics.similarity.topics, c.analytics.similarity.topics)
        }))
        .filter(c => c.score > similarityThreshold);
    });

    await this.saveComments(postId, comments, true, true);
    console.timeEnd('analyzing comments');
    return comments;
  }

  public async sentimentanalyseComments(postId: string): Promise<SocialComment[]> {
    console.time('extracting sentiments');
    const comments = await this.getCommentsFromStorage(postId);
    const allComments = this.flattenComments(comments);
  
    console.log(`extracting sentiments for comments of post ${postId}`);
    allComments.forEach(comment => {
      const { scores, label } = this.sentimentService.analyseSentiments(comment.content);
    const [neg_sentimentScore, neu_sentimentScore, pos_sentimentScore, compound_sentimentScore] = scores;
    comment.sentiments = { 
        sentiment: { 
            neg_sentimentScore, 
            neu_sentimentScore, 
            pos_sentimentScore, 
            compound_sentimentScore 
        },
        label: label
    };
    console.log(comment.sentiments);
    });
  
    await this.saveComments(postId, comments, true, true);
    console.timeEnd('extracting sentiments');
    return comments;
  }

  public getComments(postId: string, fromStorage: boolean, saveToStorage: boolean = true): Observable<SocialComment> {
    return from(this.getCommentsFromStorage(postId)).pipe(
      switchMap(storedComments => {

        if (storedComments && fromStorage) {
          return from(storedComments);
        }

        console.time('fetch comments from platform')
        const comments: SocialComment[] = [];
        return this.fetchComments(postId).pipe(
          map(comment => this.mapToSocialComment(comment)),
          tap(
            comment => comments.push(comment),
            err => console.error(`failed to fetch comments of post ${postId}: ${err}`),
            () => {
              console.timeEnd('fetch comments from platform')
              console.log(`successfully fetched comments of post ${postId}`);

              if (!saveToStorage) {
                console.warn(`skipping saving commments of post ${postId} to storage`);
                return;
              }

              this.saveComments(postId, comments);
            }
          )
        );
      })
    );
  }

  public async getPostFromStorage(postId: string): Promise<SocialPost> {
    const post = await this.postStorage.getItem<SocialPost>(postId);
    if (!post) {
      console.warn(`no post ${postId} was found in storage`);
    }
    console.log(`found post ${postId} in storage`);
    return post;
  }

  protected async savePost(postId: string, post: SocialPost): Promise<void> {
    await this.postStorage.setItem(postId, post);
    console.log(`successfully saved post ${postId}`);
  }

  private mapToSocialPost(post: RawSocialPost): SocialPost {
    return {
      ...post,
      metadata: {
        archived: false,
        archiveTimestamp: null,
        createTimestamp: null,
        lastUpdateTimestamp: null,
        comments: {
          actualCount: null,
          lastUpdateTimestamp: null,
          lastAnalysisTimestamp: null,
          firstTimestamp: null,
          lastTimestamp: null
        }
      }
    };
  }
  
  public getPost(postId: string, fromStorage: boolean, saveToStorage: boolean = true): Observable<SocialPost> {
    return from(this.getPostFromStorage(postId)).pipe(
      switchMap(storedPost => {

        if (storedPost && fromStorage) {
          return of(storedPost);
        }

        console.time('fetch post from platform')
        return this.fetchPost(postId).pipe(
          switchMap(post => {
            console.timeEnd('fetch post from platform')
            console.log(`successfully fetched post ${postId}`);
            const socialPost = this.mapToSocialPost(post);

            const now = new Date().getTime();
            socialPost.metadata.createTimestamp = now;
            socialPost.metadata.lastUpdateTimestamp = now;

            if (saveToStorage) {
              return from(this.savePost(postId, socialPost))
                .pipe(mapTo(socialPost));
            }

            console.warn(`skipping saving of post ${postId} to storage`);
            return of(socialPost);
          })
        )
      })
    );
  }

}