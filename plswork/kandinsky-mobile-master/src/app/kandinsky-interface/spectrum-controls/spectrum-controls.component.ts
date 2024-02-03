import { Component, OnInit, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { Selection, ScaleBand, ScaleLogarithmic } from 'd3';
import * as d3 from 'd3';
import _ from 'lodash';

@Component({
  selector: 'ksky-spectrum-controls',
  templateUrl: './spectrum-controls.component.html',
  styleUrls: ['./spectrum-controls.component.scss'],
})
export class SpectrumControlsComponent implements OnInit, OnChanges {

  readonly MIN_RANGE_VALUE = 0;

  @Input()
  range: SpectrumRange;

  @Input()
  intervals: SpectrumInterval[];

  @Output()
  rangeChange: EventEmitter<SpectrumRange>;

  private svg: Selection<SVGElement, unknown, HTMLElement, unknown>;
  private container: Selection<SVGGElement, any, HTMLElement, any>;
  private width: number;
  private height: number;
  private canvasReady: boolean = false;

  private yScale: ScaleLogarithmic<number, number>;
  private xScale: ScaleBand<string>;

  readonly ACTIVE_BAR_COLOR = '#428cff';
  readonly PASSIVE_BAR_COLOR = '#2e4366';

  constructor() {
    this.rangeChange = new EventEmitter();
  }

  ngOnInit() { }

  ngOnChanges(changes: SimpleChanges) {

    if (changes.range && !this.range) {
      this.range = {
        lower: Math.floor(this.intervals.length * 0.25),
        upper: Math.floor(this.intervals.length * 0.75)
      };
    }

    if (changes.intervals && this.intervals && this.intervals.length > 0) {
      setTimeout(() => {
        this.prepareLayout();
        this.update(this.intervals);
      });
    }
  }

  private dualRangeChange() {
    this.rangeChange.emit(this.range);
    this.repaint();
  }

  private repaint() {

    this.svg.selectAll<any, SpectrumInterval>(".bar")
      .style("fill", (d, i) => i >= this.range.lower && i <= this.range.upper ? this.ACTIVE_BAR_COLOR : this.PASSIVE_BAR_COLOR);
    
    this.container
      .select(".select-overlay")
      .attr("x", d => this.xScale(this.range.lower + ''))
      .attr("width", (this.xScale.step()) * (this.range.upper - this.range.lower + 1));
  }

  update(data: SpectrumInterval[]) {

    const values = data.map(b => b.value);

    this.yScale = d3.scaleLog()
      .clamp(true)
      .domain([0.1, Math.max(...values)])
      .range([this.height, 0])
      .nice();
   
    this.xScale = d3.scaleBand()
      .domain(_.range(0, data.length).map(i => i + ''))
      .range([0, this.width])
      .padding(0.1);

    this.container
      .selectAll(".bar")
      .data(data)
      .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("fill", this.PASSIVE_BAR_COLOR)
        .attr("x", (d, i) => this.xScale(i + ''))
        .attr("width", this.xScale.bandwidth())
        .attr("y", d => this.yScale(d.value))
        .attr("height", d => this.height - this.yScale(d.value));
    
    this.container
      .append("rect")
      .attr("class", "select-overlay")
      .attr("fill", "black")
      .style("opacity", 0.25)
      .attr("y", 0)
      .attr("height", d => this.height)

    this.canvasReady = true;
  }

  prepareLayout() {

    this.svg = d3.select<SVGElement, unknown>('svg.spectrum-canvas');

    this.width = this.svg.property('clientWidth');
    this.height = this.svg.property('clientHeight');

    this.container = this.svg
      .append('g')
      .attr('width', this.width)
      .attr('height', this.height);
  }

}

export type SpectrumRange = {
  upper: number;
  lower: number;
}

export type SpectrumInterval = {
  progress: number;
  value: number;
}