import { Injectable } from '@angular/core';
import { SocialPlatform, SocialPost, SocialComment } from '../models/models';
import { YoutubeService } from './social/youtube.service';
import { SocialService } from './social/social.service';
import { getIndices } from '../utils';
import * as d3 from 'd3';
import { toArray } from 'rxjs/operators';
import _ from 'lodash';

@Injectable({
  providedIn: 'root'
})
export class KandinskyService {

  // current active post data
  private postId: string;
  private post: SocialPost;
  private postComments: SocialComment[];
  private postCommentsByTimestamp: SocialComment[];

  private readonly PLATFORMS: Map<SocialPlatform, SocialService> = new Map([
    [SocialPlatform.YOUTUBE, this.youtubeService]
  ]);

  constructor(
    private youtubeService: YoutubeService
  ) {
  }

  public extractPostId(postUrl: string) {
    for (let socialPlatform of this.PLATFORMS.values()) {
      const postId = socialPlatform.extractPostId(postUrl);
      if (postId) return postId;
    }
  }

  public async getPosts(): Promise<SocialPost[]> {
    const socialPlatforms = [...this.PLATFORMS.values()];
    const posts = _.flatten(await Promise.all(socialPlatforms.map(socialPlatform => socialPlatform.getPosts())));
    return _.orderBy(posts, 'metadata.createTimestamp', 'desc');
  }

  public async setActivePost(postId: string, platform: SocialPlatform, loading?: HTMLIonLoadingElement): Promise<void> {

    const socialPlatform = this.PLATFORMS.get(platform);

    if (loading) loading.message = 'Fetching post data...';
    console.time('preparing data');
    let socialPost = await socialPlatform.getPost(postId, true, true).toPromise();
    const areCommentsInStorage = socialPost.metadata.comments.lastUpdateTimestamp !== null;
    const areCommentsAnalyzed = socialPost.metadata.comments.lastAnalysisTimestamp !== null;

    if (loading) loading.message = 'Fetching post comments...';
    const socialComments: SocialComment[] = await socialPlatform.getComments(postId, areCommentsInStorage, !areCommentsInStorage)
      .pipe(toArray())
      .toPromise()
      .then(async (comments) => {
        if (areCommentsAnalyzed) {
          return await socialPlatform.sentimentanalyzeComments(postId);
        }
  
        if (loading) loading.message = 'Running topic modelling and looking for similar comments...';
        await socialPlatform.analyzeComments(postId); 
        if (loading) loading.message = 'Running sentiment analysis...';
        return await socialPlatform.sentimentanalyzeComments(postId); // Reference sentimentanalyzeComments function

      });
    
    console.timeEnd('preparing data');

    if (!areCommentsInStorage || !areCommentsAnalyzed) {
      socialPost = await socialPlatform.getPost(postId, true).toPromise();
    }

    this.postId = postId;
    this.post = socialPost;
    this.postComments = socialComments;

    this.postCommentsByTimestamp = socialPlatform.flattenComments(socialComments)
      .sort((a, b) => a.publishTimestamp - b.publishTimestamp);
  }

  public groupCommentsByTimestamp(groups: number): CommentGroupInterval[] {

    const utcScale = d3.scaleUtc()
      .domain([this.post.publishTimestamp, this.post.metadata.comments.lastTimestamp])
      .range([0, groups - 1]);

    const commentsByDate: CommentGroupInterval[] = _.range(0, groups).map(i => ({
      start: utcScale.invert(i).getTime(),
      stop: utcScale.invert(i + 1).getTime(),
      count: 0,
      comments: []
    }));

    let groupIndex = 0;
    this.postCommentsByTimestamp.forEach(comment => {

      let group = commentsByDate[groupIndex];

      while (comment.publishTimestamp >= group.stop) {
        groupIndex += 1;
        group = commentsByDate[groupIndex];
      }

      group.comments.push(comment);
      group.count += 1;
    });

    return commentsByDate;
  }

  public getActivePost(): SocialPost {
    return this.post;
  }

  public getActivePostComments(): SocialComment[] {
    return this.postComments;
  }

  public getCommentTimestampByIndex(index: number): number {
    return this.postCommentsByTimestamp[index].publishTimestamp;
  }

  public getSimilarComments(commentId: string): SimilarComment[] {
    const comment = this.postCommentsByTimestamp.find(c => c.id === commentId);
    return comment ? comment.analytics.similarity.comments : [];
  }

  public searchComments(query: string, minLength: number = 3): SearchResult[] {

    // this.searchResults = this.commentsFuse.search<string, true, true>(query)
    //   .filter(r => r.matches.length > 0)
    //   .filter(r => r.score > 0.5);

    if (query.length < minLength) {
      return [];
    }

    const queryRegex = new RegExp(query, 'gi');

    return this.postCommentsByTimestamp.reduce((results, comment) => {
      const indices = getIndices(queryRegex, comment.content);

      if (indices.length > 0) {
        results.push({
          commentId: comment.id,
          indices: indices
        });
      }

      return results;
    }, [] as SearchResult[]);
  }

  public deletePost(postId: string, platform: SocialPlatform): Promise<void> {
    return this.PLATFORMS.get(platform).deletePost(postId);
  }

  public async reloadActivePost(): Promise<void> {
    const platform = this.post.platform;
    await this.deletePost(this.postId, platform);
    await this.setActivePost(this.postId, platform);
  }
  
}

export type SimilarComment = {
  commentId: string;
  score: number;
}

export type SearchResult = {
  commentId: string;
  indices: [number, number][];
}

export type CommentGroupInterval = {
  start: number,
  stop: number,
  count: 0,
  comments: SocialComment[]
}