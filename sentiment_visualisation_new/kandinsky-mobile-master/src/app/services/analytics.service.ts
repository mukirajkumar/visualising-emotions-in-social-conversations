import { Injectable } from '@angular/core';
import * as lda from 'lda';
import * as similarity from 'compute-cosine-similarity';
import _ from 'lodash';
import { getIndices } from '../utils';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {

  constructor() {
  }

  public generateTopics(text: string, terms: number = 10): {[k: string]: Topic} {
    var sentences = text.match(/[^\.!\?]+[\.!\?]+/g);
    const topics: { term: string, probability: number }[] = lda(sentences, 1, terms)[0] || [];
    
    const topicMap = {};
    topics.forEach(topic => {
      const regex = new RegExp(_.escapeRegExp(topic.term), 'gi');

      topicMap[topic.term] = {
        term: topic.term,
        indices: getIndices(regex, text),
        probability: topic.probability
      };
    })

    return topicMap;
  }

  public calculateTopicSimilarity(a: {[k: string]: Topic}, b: {[k: string]: Topic}) {

    const terms = new Set([...Object.keys(a), ...Object.keys(b)]);
    const aVector = [...terms].map(t => t in a ? a[t].probability : 0);
    const bVector = [...terms].map(t => t in b ? b[t].probability : 0);
    
    return similarity(aVector, bVector);
  }

}

export type Topic = {
  term: string;
  indices: [number, number][];
  probability: number;
}