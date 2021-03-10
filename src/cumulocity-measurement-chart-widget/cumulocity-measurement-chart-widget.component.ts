/** @format */

import { Component, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { WidgetConfig } from "./widget-config";
import * as _ from "lodash";
import { ChartDataSets, ChartOptions, PositionType } from "chart.js";
import { ThemeService, BaseChartDirective, Label } from "ng2-charts";
import { DatePipe } from "@angular/common";
import {
  MeasurementList,
  MeasurementOptions,
  MeasurementHelper,
} from "./widget-measurements";
import { MeasurementService, Realtime } from "@c8y/ngx-components/api";
import { WidgetHelper } from "./widget-helper";
import * as moment from "moment";
import boll from "bollinger-bands";
import "chartjs-plugin-labels";
import * as Chart from "chart.js";

@Component({
  templateUrl: "./cumulocity-measurement-chart-widget.component.html",
  styleUrls: ["./cumulocity-measurement-chart-widget.component.css"],
  providers: [DatePipe, ThemeService],
})
export class CumulocityMeasurementChartWidget implements OnInit, OnDestroy {
  @Input() config;
  @ViewChild(BaseChartDirective, { static: false })
  chartElement: BaseChartDirective;

  dataLoaded: boolean = false;
  widgetHelper: WidgetHelper<WidgetConfig>;
  measurementHelper: MeasurementHelper;
  seriesData: { [key: string]: MeasurementList };
  subscription: { [key: string]: Object } = {}; //record per device subscriptions

  chartData: ChartDataSets[];
  chartLabels: Label[];
  chartOptions: ChartOptions = {
    maintainAspectRatio: false,
    events: ["click"],
    legend: {
      display: false,
    },
    elements: {
      line: {
        borderWidth: 1,
      },
      point: {
        radius: 0,
      },
    },
    tooltips: {
      enabled: true,
    },
    responsive: true,
    scales: {
      xAxes: [],
      yAxes: [],
    },
  };
  chartLegend: boolean;

  verifyConfig(): boolean {
    return (
      this.widgetHelper.getWidgetConfig() !== undefined &&
      this.widgetHelper.getWidgetConfig().selectedDevices.length > 0 &&
      this.widgetHelper.getWidgetConfig().selectedMeasurements.length > 0
    );
  }

  constructor(
    //        private http: HttpClient,
    private measurementService: MeasurementService,
    public datepipe: DatePipe,
    private realtimeService: Realtime
  ) {
    this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //default
    this.measurementHelper = new MeasurementHelper();
    this.seriesData = {};
  }

  ngOnDestroy(): void {
    for (const sub in this.subscription) {
      if (Object.prototype.hasOwnProperty.call(this.subscription, sub)) {
        const tbd = this.subscription[sub];
        this.realtimeService.unsubscribe(tbd);
      }
    }
  }

  handleRealtime(data: any, key: string, options: MeasurementOptions): void {
    //get the values
    let measurementDate = data.data.data.time;
    let measurementValue = 0; //default
    let measurementUnit = undefined; //default
    //need the fragment, series
    if (_.has(data.data.data, options.fragment)) {
      // console.log(`RAW ${key}`);
      // console.log(data.data.data);
      // console.log(`---------------`);
      let frag = _.get(data.data.data, options.fragment);
      if (_.has(frag, options.series)) {
        let ser = _.get(frag, options.series);
        measurementValue = ser.value;
        if (_.has(ser, "unit")) {
          measurementUnit = ser.unit;
        }

        let datum = {
          x: measurementDate,
          y: measurementValue,
        };

        if (
          this.widgetHelper.getChartConfig().type == "pie" ||
          this.widgetHelper.getChartConfig().type == "doughnut"
        ) {
          this.seriesData[key].valtimes.push(datum);

          if (this.widgetHelper.getChartConfig().aggregation.id == 0) {
            let mapped = this.measurementHelper.categorize(options, datum);

            let index = -1;
            this.seriesData[key].labels.some((v, i) => {
              if (v === mapped) {
                index = i;
                return true;
              }
              return false;
            });

            if (index === -1) {
              this.seriesData[key].labels.push(mapped);
              this.seriesData[key].bucket.push(1);
            } else {
              this.seriesData[key].bucket[index] =
                this.seriesData[key].bucket[index] + 1;
            }

            console.log(this.seriesData[key].bucket);
          } else {
            let vals = this.seriesData[key].valtimes.map((val) => val.y);
            let hist = this.measurementHelper.calculateHistogram(vals, 5);
            //
            // In this case we want to replace the data
            //
            this.seriesData[key].labels.length = 0;
            this.seriesData[key].bucket.length = 0;
            this.seriesData[key].labels.push(...hist.labels);
            this.seriesData[key].bucket.push(...hist.counts);
            console.log(this.seriesData[key].labels);
            console.log(this.seriesData[key].bucket);
          }
        } else if (this.widgetHelper.getChartConfig().type == "horizontalBar") {
          datum = {
            y: measurementDate,
            x: measurementValue,
          };
          //Adjust series
          this.seriesData[key].valtimes.push(datum);
        } else {
          //Adjust series
          this.seriesData[key].valtimes.push(datum);

          //Only take the last N values to create the average
          if (options.avgPeriod > 0) {
            let source = this.seriesData[key].valtimes.slice(
              Math.max(
                this.seriesData[key].valtimes.length - options.avgPeriod,
                0
              )
            );

            //just the values
            source = source.map((val) => val.y);
            // let a = sma(source, options.avgPeriod, 3);
            let avper =
              options.avgPeriod > source.length
                ? source.length
                : options.avgPeriod;
            let a = boll(source, avper, 2);

            //aggregate needs x and y coordinates but we use only the last
            this.seriesData[key].upper.push({
              x: measurementDate,
              y: a.upper[a.upper.length - 1],
            });
            this.seriesData[key].aggregate.push({
              x: measurementDate,
              y: a.mid[a.mid.length - 1],
            });
            this.seriesData[key].lower.push({
              x: measurementDate,
              y: a.lower[a.lower.length - 1],
            });
          }
        }
      }
      if (this.chartElement) {
        //range required...
        let { from, to } = this.getDateRange();

        //
        // Line has the bollinger bands
        //
        if (this.widgetHelper.getChartConfig().type === "line") {
          while (
            moment(this.seriesData[key].aggregate[0].x).isBefore(moment(from))
          ) {
            this.seriesData[key].upper.shift();
            this.seriesData[key].aggregate.shift();
            this.seriesData[key].lower.shift();
          }
        }

        if (
          this.widgetHelper.getChartConfig().type === "pie" ||
          this.widgetHelper.getChartConfig().type === "doughnut"
        ) {
          //all graph types
          // console.log(
          //     `checking ${this.seriesData[key].labels[0]} (${moment(
          //         this.seriesData[key].labels[0],
          //         this.widgetHelper.getChartConfig().rangeDisplay[
          //             this.widgetHelper.getChartConfig()
          //                 .aggregationFreq.text
          //         ] //time format
          //     ).format()} | ${moment(from).format()})`
          // );
          //only remove data when we deal with times...
          if (this.widgetHelper.getChartConfig().aggregation.id == 0) {
            while (
              moment(
                this.seriesData[key].labels[0],
                this.widgetHelper.getChartConfig().rangeDisplay[
                  this.widgetHelper.getChartConfig().aggregationFreq.text
                ]
              ).isBefore(from)
            ) {
              this.seriesData[key].bucket.shift();
              this.seriesData[key].labels.shift();
            }
          }
        }
        if (
          this.widgetHelper.getChartConfig().type === "line" ||
          this.widgetHelper.getChartConfig().type === "bar"
        ) {
          //all graph types
          while (
            moment(this.seriesData[key].valtimes[0].x).isBefore(moment(from))
          ) {
            this.seriesData[key].valtimes.shift();
          }
        }
        if (this.widgetHelper.getChartConfig().type === "horizontalBar") {
          //all graph types
          while (
            moment(this.seriesData[key].valtimes[0].y).isBefore(moment(from))
          ) {
            this.seriesData[key].valtimes.shift();
          }
        }
        this.setAxes();
        this.chartElement.update();
      }
    }
  }

  /**
   * Lifecycle
   */
  async ngOnInit(): Promise<void> {
    this.widgetHelper = new WidgetHelper(this.config, WidgetConfig); //use config

    //Clean up
    this.chartData = [];

    let seriesKeys = Object.keys(this.widgetHelper.getChartConfig().series);
    for (const subKey in this.subscription) {
      if (Object.prototype.hasOwnProperty.call(this.subscription, subKey)) {
        const sub = this.subscription[subKey];
        if (!(subKey in seriesKeys)) {
          this.realtimeService.unsubscribe(sub);
          delete this.subscription[subKey];
        }
      }
    }

    //
    // Display Legend or not - needs logic for certain conditions
    // lhs display can cause issues if widget size is too small
    //
    this.setAxes();

    let localChartData = []; //build list locally because empty dataset is added by framework

    if (!this.widgetHelper.getChartConfig().multivariateplot) {
      //for each fragment/series to be plotted
      //ChartSeries has most of the config for the series
      //the MeasurementList contains the data (and its independent)
      for (let key of Object.keys(this.widgetHelper.getChartConfig().series)) {
        if (
          Object.prototype.hasOwnProperty.call(
            this.widgetHelper.getChartConfig().series,
            key
          )
        ) {
          const measurement = this.widgetHelper.getChartConfig().series[key];

          //each series (aggregates and functions of raw data too) gets this
          let options: MeasurementOptions = new MeasurementOptions(
            measurement.id.split(".")[0],
            measurement.name,
            measurement.id.split(".")[1],
            measurement.id.split(".")[2],
            this.widgetHelper.getChartConfig().series[key].avgPeriod,
            this.widgetHelper.getChartConfig().type
          );

          //a period of time where quantity is the # of units,
          // and type(unit) has the # of seconds per unit in the id field
          let { from, to } = this.getDateRange();

          //
          // WorkHorse Functionality - retrieve and calculate derived numbers
          //
          this.seriesData[key] = await this.measurementHelper.getMeasurements(
            this.measurementService,
            options,
            from,
            to,
            null,
            this.widgetHelper.getChartConfig().type,
            this.widgetHelper.getChartConfig().aggregation.id == 0, //count = true
            this.widgetHelper.getChartConfig().aggregationFreq.text, //period of count (time)
            this.widgetHelper.getChartConfig().rangeDisplay[
              this.widgetHelper.getChartConfig().aggregationFreq.text
            ] //time format
          );

          if (
            options.targetGraphType == "pie" ||
            options.targetGraphType == "doughnut"
          ) {
            //different to line/bar type plots
            let thisSeries: ChartDataSets = {
              data: [],
              backgroundColor: [
                ...this.widgetHelper.getChartConfig().colorList,
                ...this.widgetHelper.getChartConfig().colorList,
                ...this.widgetHelper.getChartConfig().colorList,
                ...this.widgetHelper.getChartConfig().colorList,
                ...this.widgetHelper.getChartConfig().colorList,
                ...this.widgetHelper.getChartConfig().colorList,
              ], //repeated so we can avoid having to update
            };

            this.chartLegend =
              this.widgetHelper.getChartConfig().position !== "none";
            this.chartLabels = this.seriesData[key].labels;
            thisSeries.data = this.seriesData[key].bucket;
            localChartData.push(thisSeries);

            //Update series as measurments come in.
            if (this.widgetHelper.getChartConfig().series[key].realTime) {
              //console.log(`Subscribing to ${options.name}`);
              if (!this.subscription[key]) {
                this.subscription[
                  key
                ] = this.realtimeService.subscribe(
                  "/measurements/" + options.deviceId,
                  (data) => this.handleRealtime(data, key, options)
                );
              }
            }
          } else {
            //Normal plot
            if (
              this.widgetHelper.getChartConfig().series[key]
                .hideMeasurements !== true
            ) {
              let thisSeries: ChartDataSets = this.createSeries(
                key,
                this.widgetHelper.getChartConfig().series[key].name,
                this.widgetHelper.getWidgetConfig().chart.series[key].color
              );
              thisSeries.data = this.seriesData[key].valtimes;
              thisSeries.barPercentage = 0.9;
              thisSeries.categoryPercentage = 0.9;
              localChartData.push(thisSeries);
            }

            //If average or other function then add series for that
            if (
              this.widgetHelper.getChartConfig().series[key].avgType !== "None"
            ) {
              if (
                this.widgetHelper
                  .getChartConfig()
                  .series[key].avgType.indexOf("Moving Average") > -1
              ) {
                let aggregateSeries: ChartDataSets = this.createSeries(
                  key,
                  `${options.name} - ${
                    this.widgetHelper.getChartConfig().series[key].avgPeriod
                  } period`,
                  this.widgetHelper.getWidgetConfig().chart.series[key].avgColor
                );
                //Need to apply the correct function in the series calculations
                aggregateSeries.data = this.seriesData[key].aggregate;
                localChartData.push(aggregateSeries);
              }

              if (
                this.widgetHelper
                  .getChartConfig()
                  .series[key].avgType.indexOf("Bollinger Bands") > -1
              ) {
                let upperBoll: ChartDataSets = this.createSeries(
                  key,
                  `${options.name} - upper Bollinger Band`,
                  this.widgetHelper.getWidgetConfig().chart.series[key].avgColor
                );

                //Need to apply the correct function in the series calculations
                upperBoll.data = this.seriesData[key].upper;
                localChartData.push(upperBoll);

                let lowerBoll: ChartDataSets = this.createSeries(
                  key,
                  `${options.name} - lower Bollinger Band`,
                  this.widgetHelper.getWidgetConfig().chart.series[key].avgColor
                );

                //Need to apply the correct function in the series calculations
                lowerBoll.data = this.seriesData[key].lower;
                localChartData.push(lowerBoll);
              }
            }

            //Update series as measurments come in.
            if (this.widgetHelper.getChartConfig().series[key].realTime) {
              //console.log(`Subscribing to ${options.name}`);
              if (!this.subscription[key]) {
                this.subscription[
                  key
                ] = this.realtimeService.subscribe(
                  "/measurements/" + options.deviceId,
                  (data) => this.handleRealtime(data, key, options)
                );
              }
            }
          }
        }
      }
    } else {
      let seriesList = [];
      //
      // Get the data - there will be 1-3 series that will get
      // compressed into a single with x,y,x values
      //
      for (let key of Object.keys(this.widgetHelper.getChartConfig().series)) {
        if (
          Object.prototype.hasOwnProperty.call(
            this.widgetHelper.getChartConfig().series,
            key
          )
        ) {
          seriesList.push(key);

          //For each variable retrieve the measurements
          //we need to match up measurements to get the
          //graph - omit gaps - for real time we will
          const measurement = this.widgetHelper.getChartConfig().series[key];

          //each series (aggregates and functions of raw data too) gets this
          let options: MeasurementOptions = new MeasurementOptions(
            measurement.id.split(".")[0],
            measurement.name,
            measurement.id.split(".")[1],
            measurement.id.split(".")[2],
            this.widgetHelper.getChartConfig().series[key].avgPeriod,
            this.widgetHelper.getChartConfig().type
          );

          //a period of time where quantity is the # of units,
          // and type(unit) has the # of seconds per unit in the id field
          let { from, to } = this.getDateRange();

          //
          // WorkHorse Functionality - retrieve and calculate derived numbers
          //
          this.seriesData[key] = await this.measurementHelper.getMeasurements(
            this.measurementService,
            options,
            from,
            to,
            null,
            this.widgetHelper.getChartConfig().type,
            this.widgetHelper.getChartConfig().aggregation.id == 0, //count = true
            this.widgetHelper.getChartConfig().aggregationFreq.text, //period of count (time)
            this.widgetHelper.getChartConfig().rangeDisplay[
              this.widgetHelper.getChartConfig().aggregationFreq.text
            ] //time format
          );
        }
      }
      //
      // We have all the data, now we create the actual displayed data
      //
      let thisSeries: ChartDataSets = this.createSeries(
        seriesList[0],
        `${this.widgetHelper.getChartConfig().series[seriesList[0]].name} vs ${
          this.widgetHelper.getChartConfig().series[seriesList[1]].name
        }`,
        this.widgetHelper.getWidgetConfig().chart.series[seriesList[0]].color
      );

      //x/y series (!!Date Order!!) - make sure x/y values match timestamps
      let result: { x: number; y: number }[] = [];
      for (
        let index = 0;
        index < this.seriesData[seriesList[0]].valtimes.length;
        index++
      ) {
        const xval = this.seriesData[seriesList[0]].valtimes[index];
        let yval = this.seriesData[seriesList[1]].valtimes.filter((val) => {
          return (
            //Match dates within a tolerence
            Math.abs(val.x.getTime() - xval.x.getTime()) <
            this.widgetHelper.getChartConfig().multivariateplotTolerence * 1000
          );
        });
        if (0 in yval) {
          result.push({ x: xval.y, y: yval[0].y });
        }
      }

      //x increasing - assume y function of x
      result = result.sort((a, b) => a.x - b.x);

      thisSeries.data = result;
      localChartData.push(thisSeries);
      this.chartOptions.scales.xAxes[0].scaleLabel = {
        display: this.widgetHelper.getChartConfig().showAxesLabels,
        labelString: this.widgetHelper.getChartConfig().series[seriesList[0]]
          .name,
      };
      this.chartOptions.scales.yAxes[0].scaleLabel = {
        display: this.widgetHelper.getChartConfig().showAxesLabels,
        labelString: this.widgetHelper.getChartConfig().series[seriesList[1]]
          .name,
      };
    }
    this.chartData = localChartData; //replace
    this.dataLoaded = true;
  }

  /**
   * This method returns a default line/bar dataset which can then have
   * data added - no labels are set on this as a default so that they are retrieved
   * from the data points themselves. data is co-ordinate pair {x,y}
   * @param key
   * @param label
   * @param col
   * @returns
   */
  createSeries(key: string, label: string, col: string): ChartDataSets {
    let series: ChartDataSets = {
      data: [],
      label: label,
      fill: this.widgetHelper.getChartConfig().fillArea,
      spanGaps: true,
      backgroundColor: col,
      borderColor: col,
      barThickness: "flex",
    };
    return series;
  }

  /**
   *
   * @returns Pair of dates representing the from and to dates the range extends over
   */
  private getDateRange(): { from: Date; to: Date } {
    let to = Date.now();
    let from = new Date(
      to -
        this.widgetHelper.getChartConfig().rangeValue *
          this.widgetHelper.getChartConfig().rangeType.id *
          1000
    );
    return { from, to: new Date(to) };
  }

  /**
   * Create the axes and set options
   * begin at zero either starts the y axis at zero or nearer the range of values
   * the x axis is a time axis for measurmeents so se this appropriately
   */
  private setAxes() {
    //Legend
    this.chartOptions.legend.display =
      this.widgetHelper.getChartConfig().position !== "None";
    if (this.chartOptions.legend.display) {
      this.chartOptions.legend.position = <PositionType>(
        this.widgetHelper.getChartConfig().position
      );
    }
    if (this.widgetHelper.getChartConfig().type === "horizontalBar") {
      //swapped x & y
      this.chartOptions.scales.yAxes.length = 0; //reset axes
      this.chartOptions.scales.yAxes.push({
        display: this.widgetHelper.getChartConfig().showx,
        stacked: this.widgetHelper.getChartConfig().stackSeries,
        type: "time",
        time: {
          displayFormats: this.widgetHelper.getChartConfig().rangeDisplay,
          unit: this.widgetHelper.getChartConfig().rangeType.text,
        },
      });

      //Y axis
      this.chartOptions.scales.xAxes.length = 0; //reset axes
      this.chartOptions.scales.xAxes.push({
        display: this.widgetHelper.getChartConfig().showy,
        stacked: this.widgetHelper.getChartConfig().stackSeries,
        ticks: {
          beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
        },
      });

      this.chartOptions.plugins = {
        labels: [],
      };
    } else if (
      this.widgetHelper.getChartConfig().type == "pie" ||
      this.widgetHelper.getChartConfig().type == "doughnut"
    ) {
      this.chartOptions.scales.yAxes.length = 0; //reset axes
      this.chartOptions.scales.yAxes.push({
        display: false,
      });

      //Y axis
      this.chartOptions.scales.xAxes.length = 0; //reset axes
      this.chartOptions.scales.xAxes.push({
        display: false,
      });

      this.chartOptions.plugins = {
        labels: [
          {
            render: "label",
            position: "outside",
            fontColor: "#000",
          },
          {
            render: "percentage",
            fontColor: "#FFF",
          },
        ],
      };
    } else {
      //X axis
      this.chartOptions.scales.xAxes.length = 0; //reset axes
      if (this.widgetHelper.getChartConfig().multivariateplot) {
        this.chartOptions.scales.xAxes.push({
          display: this.widgetHelper.getChartConfig().showx,
          stacked: this.widgetHelper.getChartConfig().stackSeries,
          type: "linear",
          ticks: {
            beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
          },
        });
      } else {
        this.chartOptions.scales.xAxes.push({
          display: this.widgetHelper.getChartConfig().showx,
          stacked: this.widgetHelper.getChartConfig().stackSeries,
          type: "time",
          time: {
            displayFormats: this.widgetHelper.getChartConfig().rangeDisplay,
            unit: this.widgetHelper.getChartConfig().rangeType.text,
          },
        });
        this.chartOptions.plugins = {
          labels: [],
        };
      }

      //Y axis
      this.chartOptions.scales.yAxes.length = 0; //reset axes
      this.chartOptions.scales.yAxes.push({
        display: this.widgetHelper.getChartConfig().showy,
        stacked: this.widgetHelper.getChartConfig().stackSeries,
        ticks: {
          beginAtZero: !this.widgetHelper.getChartConfig().fitAxis,
        },
      });
    }

    //labels affect the plot greatly so allow the chart to naturally do that it's self.
    //console.log(`Chart Axes Set :`, this.chartOptions.scales);
  }
}
