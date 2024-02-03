import { Pipe, PipeTransform } from '@angular/core';
import _ from 'lodash';

@Pipe({
  name: 'highlight'
})
export class HighlightPipe implements PipeTransform {

  constructor() {

  }

  private overlaps(indicesA: [number, number], indicesB: [number, number]) {
    return (indicesA[0] <= indicesB[0] && indicesA[1] > indicesB[0]) ||
      (indicesB[0] <= indicesA[0] && indicesB[1] > indicesA[0]);
  }

  transform(text: string, options: HighlightOption[]): string {

    let transformedString = '';

    const intervals = _.chain(options)
      .map<HighlightInterval[]>((option, optionIndex) => option.indices.map(intervalIndices => ({
        color: option.color,
        textColor: option.textColor,
        i: _.clone(intervalIndices),
        priority: optionIndex
      })))
      .flatten()
      .orderBy([interval => interval.i[0], interval => interval.priority], ['asc', 'desc'])
      .value();

    for (let i = 0; i < intervals.length; i++) {
      let interval = intervals[i];
      let nextIntervalIndex = i + 1;
      while (nextIntervalIndex < intervals.length) {

        let nextInterval = intervals[nextIntervalIndex];
        if (interval.priority === nextInterval.priority) {
          break;
        }

        if (this.overlaps(interval.i, nextInterval.i)) {

          const isCurrentOverNext = interval.priority > nextInterval.priority;
          const topInterval = isCurrentOverNext ? interval : nextInterval;
          const btmInterval = isCurrentOverNext ? nextInterval : interval;
          const btmIntervalIndex = isCurrentOverNext ? nextIntervalIndex : i;

          if (topInterval.i[0] <= btmInterval.i[0]) {
            if (topInterval.i[1] >= btmInterval.i[1]) {
              intervals.splice(btmIntervalIndex, 1);  
            } else {
              btmInterval.i[0] = topInterval.i[1];
            }
          } else {
            if (topInterval.i[1] < btmInterval.i[1]) {
              intervals.splice(btmIntervalIndex + 2, 0, {
                ...btmInterval,
                i: [topInterval.i[1], btmInterval.i[1]]
              });
            }
            btmInterval.i[1] = topInterval.i[0];
          }
        } else {
          break;
        }

        nextIntervalIndex += 1;
      }
    }


    let prevIntervalStop = 0;
    intervals.forEach(interval => {
      transformedString += text.slice(prevIntervalStop, interval.i[0]);
      transformedString += `<span style="background-color: ${interval.color}; color: ${interval.textColor};">${text.slice(interval.i[0], interval.i[1])}</span>`;
      prevIntervalStop = interval.i[1];
    });
    transformedString += text.slice(prevIntervalStop);
    return transformedString;
  }

}

export type HighlightInterval = {
  i: [number, number];
  color: string;
  textColor: string;
  priority: number;
}

export type HighlightOption = {
  indices: [number, number][];
  color: string;
  textColor: string;
}

