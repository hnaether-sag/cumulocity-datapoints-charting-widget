/** @format */
import { RawListItem } from './widget-config';
import { TimeDisplayFormat } from 'chart.js';
import { has } from 'lodash';

export interface Aggregation {
  type: string;
  interval: string;
  count: number;
}

/**
 * Each series chosen can have different properties
 * This class represents the values and options
 * chosen by the user. (and sensible defaults)
 */
export class ChartSeries {
  idList: string[] = []; //series id
  name = ''; //series name
  variable = 'Assign variable'; //part of composite co-ordinate (0 = no order, 1 = x, 2 = y...)
  color = '#4ABBF0'; //display colour default just in case
  showAdvanced = false;
  hideMeasurements = false;
  avgType = 'None';
  avgPeriod = 10;
  avgColor = '#4ABBF0'; //display colour
  memberOf = 'default';
  isParent: boolean;
  constructor(k: string[], n: string, c: string, a: string, g: string, p: boolean) {
    this.idList = k;
    this.name = n;
    this.color = c;
    this.avgColor = a;
    this.memberOf = g;
    this.isParent = p;
  }
}

/**
 * The ChartConfig class is the Main interface into the
 * chart js settings
 */
export class ChartConfig {
  /**
   *  Legend position
   */
  public chartPositions: RawListItem[] = [
    { id: 0, text: 'None' },
    { id: 1, text: 'left' },
    { id: 2, text: 'right' },
    { id: 3, text: 'top' },
    { id: 4, text: 'bottom' },
    { id: 5, text: 'chartArea' },
  ];

  /**
   * Types of aggregation for the single series (Pie/Doughnut and later Histogram)
   */
  public aggregationType: RawListItem[] = [
    { id: 0, text: 'By Time' },
    { id: 1, text: 'Value Buckets' },
  ];

  /**
   * This structure is for selects and mapping of the
   * values into our widget code
   *
   * Chart JS uses seconds-year as a way of getting
   * formatting for the axes labels when they are time
   * these are the defaults - we keep copies per chart
   * so we can independently change them.
   */
  public rangeUnits: RawListItem[] = [
    // { isGroup:false , id: -1, text: "Dates" },
    { id: 0, text: 'measurements', format: 'h:mm:ss.SSS a' },
    { id: 1, text: 'second', format: 'h:mm:ss a' },
    { id: 60, text: 'minute', format: 'h:mm a' },
    { id: 3600, text: 'hour', format: 'hA' },
    { id: 86400, text: 'day', format: 'MMM D' },
    { id: 604800, text: 'week', format: 'week ll' },
    { id: 2592000, text: 'month', format: 'MMM YYYY' },
    { id: 7776000, text: 'quarter', format: '[Q]Q - YYYY' },
    { id: 31536000, text: 'year', format: 'YYYY' },
  ];

  public chartTypeList: RawListItem[] = [
    { id: 0, text: 'line' },
    { id: 5, text: 'spline' },
    { id: 1, text: 'bar' },
    { id: 2, text: 'horizontalBar' },
    { id: 4, text: 'doughnut' },
    { id: 7, text: 'pie' },
    { id: 3, text: 'radar' },
    //{ isGroup:false , id: 5, text: "polarArea" },
    { id: 8, text: 'scatter' },
    { id: 6, text: 'bubble' },
    // { isGroup:false , id: 9, text: "histogram" },
  ];

  /**
   * This structure is the default options and formats
   * for the chart js options - depending on the choice
   * of units chosen for the axes it will pick the format.
   */
  public rangeDisplayTemplate: TimeDisplayFormat = {
    millisecond: 'h:mm:ss a',
    second: 'h:mm:ss a',
    minute: 'h:mm a',
    hour: 'hA',
    day: 'MMM D',
    week: 'll',
    month: 'MMM YYYY',
    quarter: '[Q]Q - YYYY',
    year: 'YYYY',
  };

  /**
   * Default colours so we have a set of main
   * and aggregate colors.
   */
  colorList: string[] = [
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FF00FF',
    '#00FFFF',
    '#808000',
    '#800000',
    '#008000',
    '#008080',
    '#800080',
    '#808080',
    '#FFFF00',
  ];
  avgColorList: string[] = [
    '#800000',
    '#008000',
    '#008080',
    '#800080',
    '#808080',
    '#FFFF00',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FF00FF',
    '#00FFFF',
    '#808000',
  ];

  //Global properties
  enabled = true;
  message = 'Loading...';
  /**
   * Most processing and chartjs uses these.
   */
  type = 'line';
  position = 'None'; //legend
  showx = true;
  showy = true;
  showAxesLabels = true;
  showAdvanced = false;
  fitAxis = false;
  stackSeries = false;
  fillArea = false;
  showPoints = 0; //default radius = 0 == no show
  numdp = 2; //2 decimal points numeric by default, can be set in config
  sizeBuckets = 5; //Make default size 5
  minBucket = 0;
  maxBucket = 10;
  groupby = false; // default no grouping by time
  cumulative = false; // not cumulative
  realtime = 'realtime'; // type of update
  timerDelay = 30; // seconds delay if timer (default 30)
  groupbyGroup = false; // default no grouping by "group"
  groupCumulative = false; // default average, if true sum measurements for "Group"

  customFormat = false;
  customFormatString = 'yyyy-MM-DD HH:mm';
  dateExample = ''; //config display field only

  /**
   * Scatter, Bubble, line and certain other charts are plotted
   * using 2 or more series. This flag indicates that the user
   * has chosen that
   */
  multivariateplot = false;
  multivariateplotTolerance = 0.5; //seconds - match timestamps within Tolerance
  multivariateColor: string = this.colorList[0];

  /**
   * The extraction of measurements can be done using a time period
   * or the number of measurements. Time based query underlies all
   * measurement retrieval however.
   *
   * N.B. the time and agg format types may be different and reflect
   * that the format of axes and bucket parameters can differ
   */
  rangeType = 2; //default minutes (index into rangeUnits)

  /** default minutes (index into rangeUnits) */
  timeFormatType = 2;
  aggregation: number = +this.aggregationType[0].id; // conditionally applied default to time base counts

  /** default minutes (index into rangeUnits) */
  aggTimeFormatType = 2;
  rangeValue = 10;

  /**
   * Local copy of the options - values can be changed per chart
   */
  rangeDisplay: TimeDisplayFormat = { ...this.rangeDisplayTemplate };

  /**
   * The individual settings for each data point set
   */
  series: { [key: string]: ChartSeries } = {};
  useCache = true;

  getChartType(): string {
    if (this.type == 'spline') {
      return 'line';
    }
    if (this.type == 'histogram') {
      return 'bar';
    }
    return this.type;
  }

  getChartTypes(): RawListItem[] {
    return [
      { isGroup: false, id: 0, text: 'line' },
      { isGroup: false, id: 5, text: 'spline' },
      { isGroup: false, id: 1, text: 'bar' },
      { isGroup: false, id: 2, text: 'horizontalBar' },
      { isGroup: false, id: 4, text: 'doughnut' },
      { isGroup: false, id: 7, text: 'pie' },
      { isGroup: false, id: 3, text: 'radar' },
      { isGroup: false, id: 8, text: 'scatter' },
      { isGroup: false, id: 6, text: 'bubble' },
    ];
  }
  /**
   *
   * @returns true if series exist
   */
  hasSeries(): boolean {
    return Object.keys(this.series).length > 0;
  }

  /**
   * Checks to see if series held are still valid,
   * or if new series need to be added.
   *
   * @param l is the current list of series held
   */
  clearSeries(l: RawListItem[]): void {
    if (Object.keys(this.series).length > 0) {
      const temp = this.series;
      this.series = {};
      l.forEach((selected) => {
        if (temp[selected.id]) this.series[selected.id] = temp[selected.id];
      });
    }
  }

  /**
   * Used in the config form to display the
   * series settings and allow them to be changed.
   *
   * @returns the series held for display
   */
  seriesKeys(): Array<string> {
    return Object.keys(this.series);
  }

  /**
   * Add a new series to the list held.
   *
   * @param devices is a list of the composite of device, series and fragment
   * @param seriesName is the display name
   * @param seriesColor is the main color
   * @param altColor is the aggregate color
   */
  addSeries(
    devices: string[],
    seriesName: string,
    seriesColor: string,
    altColor: string,
    memberOf = 'default',
    isParent = false
  ): void {
    if (!isParent) {
      if (!has(this.series, devices[0])) {
        this.series[devices[0]] = new ChartSeries(devices, seriesName, seriesColor, altColor, memberOf, isParent);
      }
    } else {
      if (!has(this.series, seriesName)) {
        this.series[seriesName] = new ChartSeries(devices, seriesName, seriesColor, altColor, memberOf, isParent);
      }
    }
  }
}
