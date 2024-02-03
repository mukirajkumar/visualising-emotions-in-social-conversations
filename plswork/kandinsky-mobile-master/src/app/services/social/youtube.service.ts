import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SocialPlatform, RawSocialComment, RawSocialPost } from 'src/app/models/models';
import { StorageService } from '../storage.service';
import { map, concatMap, startWith, merge, toArray } from 'rxjs/operators';
import { Observable, of, from } from 'rxjs';
import { SocialService } from './social.service';
import _ from 'lodash';
import { AnalyticsService } from '../analytics.service';

@Injectable({
  providedIn: 'root'
})
export class YoutubeService extends SocialService {

  private readonly API_URL = 'https://www.googleapis.com/youtube/v3';
  private readonly API_KEY = 'AIzaSyAI9KpF4fGzx6r8zxmTzizsvoUnjnD0E4U';

  private readonly API_URL_VIDEOS = `${this.API_URL}/videos`;
  private readonly API_URL_COMMENTS = `${this.API_URL}/commentThreads`;
  private readonly API_URL_REPLIES = `${this.API_URL}/comments`;

  private static STORAGE_KEY_POST = 'youtube-posts';
  private static STORAGE_KEY_COMMENTS = 'youtube-comments';

  constructor(
    private http: HttpClient,
    analyticsService: AnalyticsService,
    storageService: StorageService,
  ) {
    super(
      analyticsService,
      storageService.getStorage(YoutubeService.STORAGE_KEY_POST),
      storageService.getStorage(YoutubeService.STORAGE_KEY_COMMENTS)
    );
  }

  // https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url
  public extractPostId(videoUrl: string) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var match = videoUrl.match(regExp);
    return (match&&match[7].length==11)? match[7] : undefined;
  }

  private buildPostUrl(videoId: string) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  private buildPostRequestParams(videoId: string): {[param: string]: string | string[]} {
    return {
      part: ['id', 'statistics', 'snippet'].join(','),
      key: this.API_KEY,
      id: videoId
    };
  }

  private mapPostRequestResponse(response: any): RawSocialPost {
    const data = response.items[0];
    return {
      id: data.id,
      content: data.snippet.title,
      imageUrl: data.snippet.thumbnails.default.url,
      authorName: data.snippet.channelTitle,
      publishTimestamp: Date.parse(data.snippet.publishedAt),
      likeCount: data.statistics.likeCount,
      commentCount: data.statistics.commentCount,
      raw: response,
      platform: SocialPlatform.YOUTUBE,
      sourceUrl: this.buildPostUrl(data.id)
    };
  }

  protected fetchPost(videoId: string) {
    const params = this.buildPostRequestParams(videoId);
    return this.http.get(this.API_URL_VIDEOS, { params }).pipe(
      map(r => this.mapPostRequestResponse(r))
    );
  }

  private buildCommentsRequestParams(videoId: string, pageToken?: string): {[param: string]: string | string[]} {
    return {
      part: ['snippet'].join(','),
      maxResults: '100',
      textFormat: 'plainText',
      key: this.API_KEY,
      videoId,
      ...(pageToken ? { pageToken } : {})
    };
  }

  private buildRepliesRequestParameters(commentId: string, pageToken?: string): {[param: string]: string | string[]} {
    return {
      part: ['id', 'snippet'].join(','),
      maxResults: '100',
      textFormat: 'plainText',
      key: this.API_KEY,
      parentId: commentId,
      ...(pageToken ? { pageToken } : {})
    };
  }

  private mapCommentData(data: any) {
    return {
      id: data.id,
      content: data.snippet.textDisplay,
      imageUrl: data.snippet.authorProfileImageUrl,
      authorName: data.snippet.authorDisplayName,
      publishTimestamp: Date.parse(data.snippet.publishedAt),
      likeCount: data.snippet.likeCount,
      commentCount: 0,
      comments: [],
      parentId: null,
      parentAuthorName: null,
    }
  }

  private mapCommentResponse(response: any): RawSocialComment {
    return this.buildCommentTree({
      ...this.mapCommentData(response.snippet.topLevelComment),
      postId: response.snippet.videoId,
      raw: response
    }, response.replies.map((reply: any): RawSocialComment => ({
      ...this.mapCommentData(reply),
      postId: reply.snippet.videoId,
      raw: reply
    })));
  }

  private buildCommentTree(comment: RawSocialComment, replies: RawSocialComment[]): RawSocialComment {

    const knownAuthors = new Set([comment.authorName]);

    _.orderBy(replies, ['publishTimestamp']).reduce((map, reply) => {

      const authorPattern = new RegExp(`^${[...knownAuthors].map(a => `(${_.escapeRegExp(a)})`).join('|')}`);
      const found = (reply.content.match(new RegExp('^(@|\\+)')) ? reply.content.substr(1) : reply.content).match(authorPattern);
      const replyToAuthor = found ? found[0] : null;

      const parentComment = map.get(replyToAuthor);

      reply.parentAuthorName = replyToAuthor ? replyToAuthor : comment.authorName;
      reply.parentId = parentComment.id;

      parentComment.comments.push(reply);
      parentComment.commentCount += 1;

      map.set(reply.authorName, reply);

      knownAuthors.add(reply.authorName);

      return map;
    }, new Map([
      [null, comment],
      [comment.authorName, comment]
    ]));

    return comment;
  }

  private fetchRepliesNextPage(commentId: string, params: {[param: string]: string | string[]}) {
    return this.http.get(this.API_URL_REPLIES, { params }).pipe(
      concatMap((result: any) => {
        if (result.nextPageToken) {
          const nextParams = this.buildRepliesRequestParameters(commentId, result.nextPageToken);
          return this.fetchRepliesNextPage(commentId, nextParams).pipe(startWith(result.items));
        }
        return of(result.items);
      })
    );
  }

  private fetchReplies(commentId: string): Observable<any> {
    const params = this.buildRepliesRequestParameters(commentId);
    return this.fetchRepliesNextPage(commentId, params);
  }

  private fetchCommentsNextPage(videoId: string, params: {[param: string]: string | string[]}): Observable<any> {
    return this.http.get(this.API_URL_COMMENTS, { params }).pipe(
      concatMap((result: any) => {
        const comments = from(result.items as any[]).pipe(
          concatMap(comment => {
            const totalReplyCount = comment.snippet.totalReplyCount;

            if (totalReplyCount === 0) {
              return of({
                ...comment,
                replies: []
              });
            }

            return this.fetchReplies(comment.id).pipe(
              toArray(),
              concatMap(replies => of({
                ...comment,
                replies: _.flatten(replies)
              }))
            );
          })
        );

        if (result.nextPageToken) {
          const nextParams = this.buildCommentsRequestParams(videoId, result.nextPageToken);
          return comments.pipe(merge(this.fetchCommentsNextPage(videoId, nextParams)));
        }

        return comments;
      })
    )
  }

  protected fetchComments(videoId: string): Observable<RawSocialComment> {
    const params = this.buildCommentsRequestParams(videoId);
    return this.fetchCommentsNextPage(videoId, params).pipe(
      map(comment => this.mapCommentResponse(comment))
    );
  }
}
