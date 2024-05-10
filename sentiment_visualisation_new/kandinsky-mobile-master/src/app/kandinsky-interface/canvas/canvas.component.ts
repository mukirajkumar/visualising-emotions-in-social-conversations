import { Component, OnInit, OnChanges, SimpleChanges, Input, EventEmitter, Output } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Selection, ScalePower, Simulation, ForceManyBody, ForceLink, ForceX, ForceY, ZoomBehavior } from 'd3';
import ColorHash from 'color-hash';
import { customForceCollide } from './force-collide';
import * as d3 from 'd3';
import _ from 'lodash';
import { customForceManyBody } from './force-many-body';
import { SentimentsService } from 'src/app/services/sentiments.service';

@Component({
  selector: 'ksky-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
})
export class CanvasComponent implements OnInit, OnChanges {

  @Input()
  circles: Circle[];

  @Input()
  selectedCircle: ConcentricCircleDatum;

  @Output()
  selectedCircleChange: EventEmitter<ConcentricCircleDatum>;

  @Input()
  timestamp: number = 0;

  @Input()
  highlightMode: boolean;

  @Input()
  focusMode: boolean;

  @Output()
  ready: EventEmitter<void>;
  sentimentScores: number[] = [];
  lastIndex: number = -1;

  readonly SCALE_MULTIPLIER = 0.8;
  readonly MIN_CIRCLE_RADIUS = 4;
  readonly MAX_CIRCLE_RADIUS = 6;
  readonly LAYOUT_PADDING = 80;
  readonly FORCE_STRENGTH = 0.3;
  readonly COLLIDE_PADDING = 20;
  readonly SELECT_BOX_SELECTED_COLOR = 'red';
  readonly SELECT_BOX_FOCUSED_COLOR = 'white';

  readonly CLASS = {
    CONTAINER: 'container',
    CLICK_NET: 'click-net',
    CIRCLE: 'circle',
    CONCENTRIC_CIRCLE: 'concentric-circle',
    PIVOT: 'pivot',
    NUCLEUS: 'nucleus',
    PERIPHERAL: 'peripheral',
    SELECT_BOX: 'select-box',
    COLLISION_CIRCLE: 'collision-circle',
    SELECTED: 'selected',
    FOCUSED: 'focused',
    HIGHLIGHTED: 'highlighted',
    VISIBLE: 'visible'
  };

  readonly PREFIX = {
    CONCENTRIC_CIRCLE: 'concentric-circle',
    CIRCLE: 'circle',
    PIVOT: 'pivot'
  };
  
  private container: Selection<SVGGElement, any, HTMLElement, any>;
  private zoom: ZoomBehavior<SVGElement, unknown>;
  private svg: Selection<SVGElement, unknown, HTMLElement, unknown>;

  private radiusScale: ScalePower<number, number>;
  private graph: KandinskyGraph<ConcentricCircleDatum, ConcentricCircleDatumLink>;
  private concentricCircles: Selection<SVGGElement, ConcentricCircleDatum, SVGGElement, unknown>;

  private circlesByTimestamp: CircleDatum[];

  private width: number;
  private height: number;
  private center: { x: number, y: number };
  private maxScale: number;

  private minValue: number;
  private maxValue: number;

  private colorHash = new ColorHash();

  constructor(private sentimentService: SentimentsService, public alertController: AlertController) {
    this.selectedCircleChange = new EventEmitter();
    this.ready = new EventEmitter();
  }
  

  ngOnInit() {
  }

  getCircleData(circleIds: string[]) {

    return this.circlesByTimestamp
      .filter(c => circleIds.includes(c.circleId));
  }

  setHighlighted(circleIds: string[]) {

    const setCircleIds = new Set(circleIds);
    this.circlesByTimestamp.forEach(c => {
      c.isHighlighted = setCircleIds.has(c.circleId);
      const concentricCircle = this.concentricCircles
        .filter(concentricCircle => concentricCircle.id === c.concentricCircleId).datum();

      if (!concentricCircle.isNucleus && !c.isPivot && c.innerId === concentricCircle.pivot.id) {
        concentricCircle.pivot.isHighlighted = setCircleIds.has(c.innerId);
      }
    });
    this.redrawConcentricCircles();
  }

  redrawConcentricCircles() {

    const anyIsFocusedOrSelected = this.focusMode || this.concentricCircles.filter(c => c.isFocused || c.isSelected).size() > 0;
    const defaultConcentricCircleOpacity = anyIsFocusedOrSelected ? 0.5 : 1;
    const defaultCircleOpacity = this.highlightMode ? 0.01 : 1;

    this.concentricCircles
      .select(`.${this.CLASS.SELECT_BOX}`)
        .transition()
          .duration(250)
          .ease(d3.easeLinear)
          .style('opacity', d => ((d.isSelected || d.isFocused) && d.isDisplayed) ? 1 : 0)
          .style('stroke', c => c.isSelected ? this.SELECT_BOX_SELECTED_COLOR : this.SELECT_BOX_FOCUSED_COLOR)

    this.concentricCircles
      .transition()
        .duration(250)
        .ease(d3.easeLinear)
        .style('opacity', d => (d.isSelected || d.isFocused) ? 1 : defaultConcentricCircleOpacity);
    
    this.concentricCircles
      .selectAll<SVGCircleElement, CircleDatum>(`.${this.CLASS.CIRCLE}`)
      .classed(this.CLASS.VISIBLE, d => d.isDisplayed)
      .filter(d => d.isDisplayed)
        .transition()
          .duration(250)
          .ease(d3.easeLinear)
          .style('opacity', d => d.isHighlighted ? 1 : defaultCircleOpacity);
    
    this.concentricCircles
      .classed(this.CLASS.SELECTED, d => d.isSelected)
      .classed(this.CLASS.FOCUSED, d => d.isFocused);
  }

  setFocused(circleIds: string[]) {

    const setCircleIds = new Set(circleIds);

    const focusedConcentricCircleIds = new Set();
    this.circlesByTimestamp.forEach(c => {
      c.isFocused = setCircleIds.has(c.circleId);
      if (c.isFocused) {
        focusedConcentricCircleIds.add(c.concentricCircleId);
      }
    });

    this.concentricCircles.each(c => {
      c.isFocused = focusedConcentricCircleIds.has(c.id);
    });
    
    setTimeout(() => {
      this.redrawConcentricCircles();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.circles && this.circles && this.circles.length > 0) {
      setTimeout(() => {
        console.time('drawing canvas');
        this.prepareLayout();
        this.update(this.circles).then(() => {
          console.timeEnd('drawing canvas');
        });
      });
    }

    if (changes.timestamp) {
      this.updateDisplayedCirclesByTimestamp(this.timestamp);
    }
  }

  calcVisibleRadius(concentricCircle: ConcentricCircleDatum) {

    let visibleRadius = 0;

    for(let circle of [concentricCircle.pivot, ...concentricCircle.pivot.children]) {
      if (!circle.isDisplayed) {
        break;
      }
      visibleRadius = circle.radius;
    }

    return visibleRadius;
  }

  toggleCircleVisibility(circle: CircleDatum, display: boolean) {
    circle.isDisplayed = display;

    const circleElement = this.selectCircle(circle.id);
    circleElement.transition()
      .duration(250)
      .ease(d3.easeLinear)
      .style('opacity', display ? 1 : 0);
  }

  updateDisplayedCirclesByTimestamp(timestamp: number) {

    const updatedConcentricCircles: ConcentricCircleDatum[] = [];
    const newIndex = this.timestampToIndex(timestamp);

    if (newIndex === this.lastIndex) {
      return;
    }

    if (newIndex > this.lastIndex) {

      // fast-forward
      // update all those circles from lastIndex -> newIndex
      while (this.lastIndex < newIndex) {
        this.lastIndex += 1;
        
        const circleDatum = this.circlesByTimestamp[this.lastIndex];
        this.toggleCircleVisibility(circleDatum, true);

        const concentricCircle = this.graph.nodes.find(n => n.id === circleDatum.concentricCircleId);
        updatedConcentricCircles.push(concentricCircle);
        if (!concentricCircle.pivot.isDisplayed && !circleDatum.isPivot && circleDatum.innerId === concentricCircle.pivot.id) {
          this.toggleCircleVisibility(concentricCircle.pivot, true);
        }
      }
    } else {

      // rewind
      // update all those circles from newIndex -> lastIndex
      while (this.lastIndex > newIndex) {

        const circleDatum = this.circlesByTimestamp[this.lastIndex];
        this.toggleCircleVisibility(circleDatum, false);

        const concentricCircle = this.graph.nodes.find(n => n.id === circleDatum.concentricCircleId);
        updatedConcentricCircles.push(concentricCircle);
        if (concentricCircle.pivot.isDisplayed && !circleDatum.isPivot && circleDatum.innerId === concentricCircle.pivot.id) {
          this.toggleCircleVisibility(concentricCircle.pivot, false);
        }

        this.lastIndex -= 1;
      }
    }

    // selection of updated concentric circles
    const selection = this.concentricCircles
      .filter(c => updatedConcentricCircles.some(u => u.id === c.id));

    selection.each(c => {
      this.resizeSelectBox(c);

      const circles = [c.pivot, ...c.pivot.children];
      c.isFocused = circles.some(c => c.isFocused);
      c.isDisplayed = c.pivot.isDisplayed;
    });
    
    this.redrawConcentricCircles();

  }

  resizeSelectBox(concentricCircleDatum: ConcentricCircleDatum) {

    const concentricCircle = this.selectConcentricCircle(concentricCircleDatum.id);

    const boundaryBox = concentricCircle.node().getBBox();
    const visibleRadius = this.calcVisibleRadius(concentricCircleDatum);
    const posOffset = concentricCircleDatum.radius - visibleRadius;

    return concentricCircle
      .select(`.${this.CLASS.SELECT_BOX}`)
      .attr('width', visibleRadius * 2)
      .attr('height', visibleRadius * 2)
      .attr('x', boundaryBox.x + posOffset)
      .attr('y', boundaryBox.y + posOffset);
  }

  timestampToIndex(timestamp: number): number {
    if (!timestamp) {
      return -1;
    }

    const index = this.circlesByTimestamp.findIndex(c => c.timestampCue > timestamp);
    return (index === -1 ? this.circlesByTimestamp.length : index) - 1;
  }

  selectConcentricCircle(concentricCircleId: string) {
    const escapedId = concentricCircleId.replace('.', '\\.');
    return d3.select<SVGGElement, ConcentricCircleDatum>(`#${escapedId}`); 
  }

  selectCircle(circleDatumId: string) {
    const escapedId = circleDatumId.replace('.', '\\.');
    return d3.select<SVGCircleElement, CircleDatum>(`#${escapedId}`);
  }

  buildGraph(circles: ConcentricCircleDatum[]): KandinskyGraph<ConcentricCircleDatum, ConcentricCircleDatumLink> {


    const nodes: ConcentricCircleDatum[] = [];
    const links: ConcentricCircleDatumLink[] = [];

    const root = d3.hierarchy({ peripherals: circles }, d => d.peripherals);
    root.children.forEach(childNode => {
      childNode.eachBefore(n => {
        nodes.push(n.data as ConcentricCircleDatum);
        links.push(...n.links()
          .map<ConcentricCircleDatumLink>(link => ({
            source: link.source.data as ConcentricCircleDatum,
            target: link.target.data as ConcentricCircleDatum
          }))
        );
      });
    });

    return { nodes, links };
  }

  isRelativeOf(thisCircle: ConcentricCircleDatum, thatCircle: ConcentricCircleDatum) {
    return thisCircle.rootId === thatCircle.rootId;
  }

  isImmediateRelativeOf(thisCircle: ConcentricCircleDatum, thatCircle: ConcentricCircleDatum) {
    return thisCircle.parentId === thatCircle.id || thatCircle.parentId === thisCircle.id;
  }

  calculateTotalRadius(concentricCircle: ConcentricCircleDatum) {
    return concentricCircle.radius + _.sum(concentricCircle.peripherals.map(c => this.calculateTotalRadius(c)));
  }

  async update(circles: Circle[]): Promise<void> {

    return new Promise(resolve => {
        const uniqueValues = new Set(d3.hierarchy({ children: circles, value: 0 }, c => c.children)
        .descendants()
        .map(d => d.data.value)
        .splice(1));

      this.minValue = Math.min(...uniqueValues);
      this.maxValue = Math.max(...uniqueValues);
      
      this.radiusScale = d3.scaleSqrt()
        .domain([this.minValue, this.maxValue])
        .range([this.MIN_CIRCLE_RADIUS, this.MAX_CIRCLE_RADIUS]);

      const nucleicCircleData = circles.map(circle => this.buildCircleDatum(circle));

      const nucleicConcentricCirclesData = nucleicCircleData
        .map(pivot => this.buildConcentricCircleDatum(pivot));

      this.graph = this.buildGraph(nucleicConcentricCirclesData);

      const circleNodes = d3.hierarchy({
        children: nucleicConcentricCirclesData.map(n => n.pivot)
      }, d => d.children).descendants();

      this.circlesByTimestamp = _.orderBy(circleNodes.slice(1)
        .map(n => n.data as CircleDatum), ['timestampCue'], ['asc']);

      this.concentricCircles = this.container.selectAll(`.${this.CLASS.CONCENTRIC_CIRCLE}`)
        .data(this.graph.nodes)
        .enter()
        .append('g')
        .attr('id', d => d.id)
        .classed(this.CLASS.CONCENTRIC_CIRCLE, true)
        .classed(this.CLASS.NUCLEUS, d => d.isNucleus)
        .classed(this.CLASS.PERIPHERAL, d => !d.isNucleus)
        .each(concentricCircleDatum => {
          const escapedId = concentricCircleDatum.id.replace('.', '\\.');
          const concentricCircle = d3.select<SVGGElement, ConcentricCircleDatum>(`#${escapedId}`);
          concentricCircle.selectAll(`.${this.CLASS.CIRCLE}`)
            .data([concentricCircleDatum.pivot, ...concentricCircleDatum.pivot.children])
            .enter()
            .append('circle')
            .attr('r', d => d.radius)
            .attr('id', d => d.id)
            .style('fill', d => d.color)
            .classed(this.CLASS.PIVOT, d => d.isPivot)
            .classed(this.CLASS.CIRCLE, true)
            .lower()
            .style('opacity', '0');

          concentricCircle.append('rect')
            .classed(this.CLASS.SELECT_BOX, true)
            .style('fill', 'transparent')
            .style('pointer-events', 'none')
            .style('opacity', '0');
        })
        .on('click', d => this.select(d));
      
      const forceManyBody = customForceManyBody<ConcentricCircleDatum>()
        .filter((source, target) => source.rootId == target.rootId && !this.isImmediateRelativeOf(source, target))
        .strength(d => d.radius * -60);

      const forceLink = d3.forceLink<ConcentricCircleDatum, ConcentricCircleDatumLink>()
        .id(d => d.id)
        .distance(d => {
          const source = d.source as ConcentricCircleDatum;
          const target = d.target as ConcentricCircleDatum;
          return Math.max(source.radius, target.radius);
          // return source.radius + target.radius;
        })
        .strength(0.2)
        .links(this.graph.links);
      
      const forceX = d3.forceX<ConcentricCircleDatum>(this.center.x).strength(this.FORCE_STRENGTH);
      const forceY = d3.forceY<ConcentricCircleDatum>(this.center.y).strength(this.FORCE_STRENGTH);

      const forceImmediateRelativeCollide = customForceCollide<ConcentricCircleDatum>()
        .filter((source, target) => source.rootId == target.rootId && this.isImmediateRelativeOf(source, target))
        .radius(d => d.radius - 2);

      const forceRelativeCollide = customForceCollide<ConcentricCircleDatum>()
        .filter((source, target) => source.rootId == target.rootId && !this.isImmediateRelativeOf(source, target))
        .radius(d => d.radius);
      
      const forceCollide = customForceCollide<ConcentricCircleDatum>()
        .filter((source, target) => source.rootId != target.rootId)
        .radius(d => d.radius + 30);

      // separate link simulation
      const linkSimulation = d3.forceSimulation<ConcentricCircleDatum, ConcentricCircleDatumLink>()
        .alphaTarget(1) // will run this simulation forever since alphaTarget > alphaMin; need to stop manually
        .force('link', forceLink);
      
      const simulation = d3.forceSimulation<ConcentricCircleDatum, ConcentricCircleDatumLink>()
        .force('manybody', forceManyBody)
        .force('x', forceX)
        .force('y', forceY)
        .force('immediaterelativecollide', forceImmediateRelativeCollide)
        .force('relativecollide', forceRelativeCollide)
        .force('collide', forceCollide)
        .alpha(10)
        .nodes(this.graph.nodes);

      simulation.on('end', () => {

        this.concentricCircles
          .attr('transform', d => `translate(${d.x}, ${d.y})`);

        resolve();
        this.onCanvasReady();
        linkSimulation.stop();
      });
    });
  }

  private onCanvasReady() {
    this.ready.emit();
    const containerWidth = this.container.node().getBBox().width;
    this.maxScale = (this.width / containerWidth) * this.SCALE_MULTIPLIER;
    this.resetZoom();
  }

  unselect(emitEvent: boolean = true, redrawCircles: boolean = true) {

    const selectedCircle = this.graph.nodes.find(d => d.isSelected);

    if (!selectedCircle) {
      return;
    }

    if (emitEvent) {
      this.selectedCircleChange.emit(null);
    }

    this.concentricCircles.filter(c => c.id === selectedCircle.id).interrupt();

    selectedCircle.isSelected = false;
    selectedCircle.fx = null;
    selectedCircle.fy = null;

    if (redrawCircles) {
      this.redrawConcentricCircles();
    }
  }

  public selectByPivotId(circleId: string) {

    if (!circleId) {
      return;
    }

    const concentricCircleId = this.buildId(this.PREFIX.CONCENTRIC_CIRCLE, circleId);
    const circle = this.selectConcentricCircle(concentricCircleId);
    return this.select(circle.datum());
  }

  async select(concentricCircleDatum: ConcentricCircleDatum) {

    if (!concentricCircleDatum.isDisplayed) {
      return;
    }

    const wasSelected = concentricCircleDatum.isSelected;
    if (wasSelected) {
      this.selectedCircleChange.emit(concentricCircleDatum);
      await this.zoomTo(concentricCircleDatum.id);
      return;
    }

    this.unselect(wasSelected, false);
    this.selectedCircleChange.emit(concentricCircleDatum);

    concentricCircleDatum.isSelected = true;

    console.log(concentricCircleDatum);

    this.redrawConcentricCircles();
    await this.zoomTo(concentricCircleDatum.id);
  }

  resetZoom() {
    this.svg.transition()
      .duration(200)
      .call(
        this.zoom.transform,
        d3.zoomIdentity
          .translate(this.center.x, this.center.y)
          .scale(this.maxScale)
          .translate(-this.center.x, -this.center.y)
      );
  }

  zoomTo(concentricCircleId: string): Promise<void> {
    const concentricCircle = this.selectConcentricCircle(concentricCircleId);
    const concentricCircleDatum = concentricCircle.datum();
    // const visibleCircle = d3.select<SVGGElement, CircleDatum>(concentricCircle.node())
    //   .select<SVGCircleElement>(`.${this.CLASS.CIRCLE}.${this.CLASS.VISIBLE}`);
    // const boundaryBox = visibleCircle.node().getBoundingClientRect();
    return new Promise(resolve => {
      this.svg.transition()
      .duration(200)
      .call(
        this.zoom.transform,
        d3.zoomIdentity
          .translate(this.center.x + concentricCircleDatum.x * 2, this.center.y + concentricCircleDatum.y * 2)
          .scale(2)
          .translate(concentricCircleDatum.x * -2, concentricCircleDatum.y * -2)
      )
      .on('end', () => resolve());
    })
  }

  calculateRadius(value: number, offset: number = 0): number {
    return this.radiusScale(value) + offset;
  }

  buildId(prefix: string, id: string) {
    return `${prefix}_${id}`;
  }

  getColourFromScore(score: number): string {
    const normalizedScore = (score + 1) / 2;
    const hue = normalizedScore * 120;
    return `hsl(${hue}, 100%, 50%)`;
  }

  buildCircleDatum(circle: Circle, radiusOffset: number = 0, isPivot: boolean = true): CircleDatum {
    const radius = this.calculateRadius(circle.value, radiusOffset);
    let childRadiusOffset = radius;

    const circleDatum = {
      circleId: circle.id,
      id: this.buildId(isPivot ? this.PREFIX.PIVOT : this.PREFIX.CIRCLE, circle.id),
      x: null,
      y: null,
      fx: null,
      fy: null,
      color: this.getColourFromScore(circle.colorReference),
      children: [],
      data: circle.data,
      timestampCue: circle.timestampCue,
      radius,
      isPivot,
      concentricCircleId: null, // to be populated by concentric circle builder,
      innerId: null,
      isDisplayed: false,
      isFocused: false,
      isHighlighted: false
    };
    let innerId: string = circleDatum.id;
      const children = circle.children.map(child => {
        const childCircleDatum = this.buildCircleDatum(child, childRadiusOffset, false);
  
        childCircleDatum.innerId = innerId;
        innerId = childCircleDatum.id;
  
        childRadiusOffset = childCircleDatum.radius;
        return childCircleDatum;
      });
  
      circleDatum.children = children;
  
      return circleDatum;

  }

  buildConcentricCircleDatum(pivot: CircleDatum, isNucleus: boolean = true, radiusOffset: number = 0, rootId = null, parentId = null): ConcentricCircleDatum {

    const id = this.buildId(this.PREFIX.CONCENTRIC_CIRCLE, pivot.circleId);
    if (!rootId) {
      rootId = id;
    }

    const peripherals = [];

    // concentric circle's radius starting with the pivot
    let radius = pivot.radius;

    // if child is a peripheral, offset the child's radius with this
    let childRadiusOffset = radius * -1;

    let innerId = pivot.id;
    pivot.concentricCircleId = id;
    pivot.children.forEach(child => {

      // update concentric circle id
      child.concentricCircleId = id;
      child.radius += radiusOffset;
      child.innerId = innerId;
      innerId = child.id;

      // set concentric circle's radius as largest child radius
      radius = child.radius;

      // check if has peripheral children
      if (child.children.length > 0) {

        // clone child circle as new peripheral's pivot
        const childPivot = _.clone(child);
        
        childPivot.isPivot = true;
        childPivot.id = this.buildId(this.PREFIX.PIVOT, child.circleId);
        childPivot.radius += childRadiusOffset;

        // build new peripheral circle
        const peripheral = this.buildConcentricCircleDatum(childPivot, false, childRadiusOffset + radiusOffset, rootId, id);
        child.children = peripheral.pivot.children;
        peripherals.push(peripheral);
      }

      // update child radius offset
      childRadiusOffset = radius * -1;
    });
    
    return {
      circleId: pivot.circleId,
      x: this.center.x,
      y: this.center.y,
      fx: null,
      fy: null,
      isSelected: false,
      isFocused: false,
      isDisplayed: false,
      id,
      rootId,
      pivot,
      peripherals,
      radius,
      isNucleus,
      parentId
    }
  }

  prepareLayout() {
    this.svg = d3.select<SVGElement, unknown>('svg.main-canvas')
      .style('background-color', '#212121');
    
    const containerClickNet = this.svg.append('rect')
      .attr('class', this.CLASS.CLICK_NET)
      .attr('width', this.svg.property('clientWidth'))
      .attr('height', this.svg.property('clientHeight'))
      .style('fill', 'transparent')
      .on('click', () => this.unselect());

    this.width = this.svg.property('clientWidth');
    this.height = this.svg.property('clientHeight');

    this.container = this.svg
      .append('g')
      .attr('class', this.CLASS.CONTAINER);

    this.zoom = d3.zoom<SVGElement, unknown>()
      .on('zoom', () => {        
        this.container.attr("transform", d3.event.transform);
      });
    
    this.svg.call(this.zoom);

    this.center = {
      x: this.width * 0.5,
      y: this.height * 0.5
    };
  }

}


export interface Circle {
  id: string;
  value: number;
  colorReference: number;
  children: Circle[];
  data: any;
  timestampCue: number;
}

interface KandinskyGraph<T, K> {
  nodes: T[];
  links: K[];
}

export interface CircleDatum {
  circleId: string;
  id: string;
  x: number;
  y: number;
  fx: number;
  fy: number;
  radius: number;
  color: string;
  children: CircleDatum[];
  data: any;
  isPivot: boolean;
  timestampCue: number;
  concentricCircleId: string;
  innerId: string;
  isDisplayed: boolean;
  isHighlighted: boolean;
  isFocused: boolean;
}

export interface ConcentricCircleDatum {
  circleId: string;
  id: string;
  x: number;
  y: number;
  fx: number;
  fy: number;
  radius: number;
  pivot: CircleDatum;
  rootId: string;
  parentId: string;
  peripherals: ConcentricCircleDatum[];
  isNucleus: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isDisplayed: boolean;
}

interface ConcentricCircleDatumLink {
  target: string | ConcentricCircleDatum;
  source: string | ConcentricCircleDatum;
}
