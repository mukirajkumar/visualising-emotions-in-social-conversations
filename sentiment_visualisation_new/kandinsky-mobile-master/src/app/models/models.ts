import { SimilarComment } from '../services/kandinsky.service';
import { Topic } from '../services/analytics.service';

type SocialItem = {
  id: string;
  content: string;
  imageUrl: string;
  authorName: string;
  publishTimestamp: number;
  likeCount: number;
  commentCount: number;
  raw: any;
};

export type RawSocialPost = SocialItem & {
  platform: SocialPlatform;
  sourceUrl: string;
};

export type PostCommentsMetadata = {
  actualCount: number;
  lastUpdateTimestamp: number;
  lastAnalysisTimestamp: number;
  firstTimestamp: number;
  lastTimestamp: number;
}

export type PostMetadata = {
  archived: boolean;
  archiveTimestamp: number;
  createTimestamp: number;
  lastUpdateTimestamp: number;
  comments: PostCommentsMetadata;
};

export type SocialPost = RawSocialPost & {
  metadata: PostMetadata;
};

export type RawSocialComment = SocialItem & {
  postId: string;
  parentId: string;
  parentAuthorName: string;
  comments: RawSocialComment[];
};

export type CommentAnalytics = {
  similarity: {
    comments: SimilarComment[];
    topics: {[k: string]: Topic};
  },
};

export type CommentSentiments ={
  sentiment:{
    neg_sentimentScore ?: number,
    neu_sentimentScore ?: number,
    pos_sentimentScore ?: number,
    compound_sentimentScore ?: number
  }
  label:string
}


export type SocialComment = Omit<RawSocialComment, 'comments'> & {
  comments: SocialComment[];
  analytics: CommentAnalytics;
  sentiments: CommentSentiments
};

export enum SocialPlatform {
  YOUTUBE = 'Youtube, LLC'
};
