<!-- @format -->

# Data points charting widget
The Data Points Charting Widget allows you to create real time graphs showing customizable amounts of data from one or more devices.

## Fork
This is a fork of the TechCommunity Data Points Charting Widget, but altered to be run inside a cockpit clone instead of being a Runtime Widget. This way it is very easy to just extract the widget code itself from the project: 

All you need to do is to copy the cumulocity-datapoints-charting-widget folder into your project and import the CumulocityDatapointsChartingWidgetModule into your app.module.ts.

Further improvements are:
- bugfix where widget didn't show any datapoints when used inside a group dashboard
- update to WebSDK 1010.0.15

## Installation
- run npm i
### Runtime Widget Deployment?

-   If you want to deploy the widget using the runtime widget deployment process, please go back to the original repo: https://github.com/SoftwareAG/cumulocity-datapoints-charting-widget

---

These tools are provided as-is and without warranty or support. They do not constitute part of the Software AG product suite. Users are free to use, fork and modify them, subject to the license agreement. While Software AG welcomes contributions, we cannot guarantee to include every contribution in the master project.

---

For more information you can Ask a Question in the [Tech Community Forums](https://tech.forums.softwareag.com/tags/c/forum/1/Cumulocity-IoT).

You can find additional information in the [Software AG Tech Community](https://techcommunity.softwareag.com/en_en/cumulocity-iot.html).
