(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _Helpers = require('../js-exports/Helpers');

var _Charts = require('../js-exports/Charts');

/* exported D3Charts, Helpers */ // let's jshint know that D3Charts can be "defined but not used" in this file
/* polyfills needed: Promise, Array.isArray, Array.find, Array.filter
 */
var D3Charts = function () {

    "use strict";

    var groupCollection = [];
    var D3ChartGroup = function D3ChartGroup(container, index) {
        var _this = this;

        console.log(index);
        this.container = container;
        this.index = index;
        this.config = container.dataset.convert();
        console.log(this.config.nestBy.toString());
        this.dataPromises = this.returnDataPromises(container);
        this.children = [];
        console.log(this.dataPromises);
        //this.controller.initController(container, this.model, this.view);
        this.dataPromises.then(function () {
            _this.initializeCharts(container);
        });
    };
    //prototype begins here
    D3ChartGroup.prototype = {
        returnDataPromises: function returnDataPromises() {
            var _this2 = this;

            var dataPromises = [];
            var sheetID = this.config.sheetId,
                tabs = [this.config.dataTab, this.config.dictionaryTab]; // this should come from HTML
            // is there a case for more than one sheet of data?
            tabs.forEach(function (each, i) {
                var promise = new Promise(function (resolve, reject) {
                    d3.json('https://sheets.googleapis.com/v4/spreadsheets/' + sheetID + '/values/' + each + '?key=AIzaSyDD3W5wJeJF2esffZMQxNtEl9tt-OfgSq4', function (error, data) {
                        if (error) {
                            reject(error);
                            throw error;
                        }
                        var values = data.values;
                        var nestType = each === 'dictionary' ? 'object' : 'series'; // nestType for data should come from HTML
                        var nestBy = each === 'dictionary' ? false : _this2.config.nestBy;
                        resolve(_this2.returnKeyValues(values, nestBy, true, nestType, i));
                    });
                });
                dataPromises.push(promise);
            });
            Promise.all(dataPromises).then(function (values) {
                _this2.data = values[0];
                _this2.dictionary = values[1];
                _this2.summaries = _this2.summarizeData();
            });
            return Promise.all(dataPromises);
        },
        summarizeData: function summarizeData() {
            // this fn creates an array of objects summarizing the data in model.data. model.data is nested
            // and nesting and rolling up cannot be done easily at the same time, so they're done separately.
            // the summaries provide average, max, min of all fields in the data at all levels of nesting. 
            // the first (index 0) is one layer nested, the second is two, and so on.

            var summaries = [];
            var variables = Object.keys(this.unnested[0]); // all need to have the same fields
            var nestBy = this.config.nestBy ? this.config.nestBy.map(function (each) {
                return each;
            }) : false;
            // uses map to create new array rather than assigning
            // by reference. the `pop()` below would affect original
            // array if done by reference
            var nestByArray = Array.isArray(nestBy) ? nestBy : [nestBy];
            function reduceVariables(d) {
                return variables.reduce(function (acc, cur) {
                    acc[cur] = {
                        max: d3.max(d, function (d) {
                            return d[cur];
                        }),
                        min: d3.min(d, function (d) {
                            return d[cur];
                        }),
                        mean: d3.mean(d, function (d) {
                            return d[cur];
                        }),
                        sum: d3.sum(d, function (d) {
                            return d[cur];
                        }),
                        median: d3.median(d, function (d) {
                            return d[cur];
                        }),
                        variance: d3.variance(d, function (d) {
                            return d[cur];
                        }),
                        deviation: d3.deviation(d, function (d) {
                            return d[cur];
                        })
                    };
                    return acc;
                }, {});
            }
            while (nestByArray.length > 0) {
                var summarized = this.nestPrelim(nestByArray).rollup(reduceVariables).object(this.unnested);
                summaries.unshift(summarized);
                nestByArray.pop();
            }
            return summaries;
        },
        nestPrelim: function nestPrelim(nestByArray) {
            // recursive  nesting function used by summarizeData and returnKeyValues
            return nestByArray.reduce(function (acc, cur) {
                if (typeof cur !== 'string' && typeof cur !== 'function') {
                    throw 'each nestBy item must be a string or function';
                }
                var rtn;
                if (typeof cur === 'string') {
                    rtn = acc.key(function (d) {
                        return d[cur];
                    });
                }
                if (typeof cur === 'function') {
                    rtn = acc.key(function (d) {
                        return cur(d);
                    });
                }
                return rtn;
            }, d3.nest());
        },
        returnKeyValues: function returnKeyValues(values, nestBy) {
            var coerce = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
            var nestType = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'series';
            var tabIndex = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;

            // this fn takes normalized data fetched as an array of rows and uses the values in the first row as keys for values in
            // subsequent rows
            // nestBy = string or array of field(s) to nest by, or a custom function, or an array of strings or functions;
            // coerce = BOOL coerce to num or not; nestType = object or series nest (d3)

            var prelim;

            var unnested = values.slice(1).map(function (row) {
                return row.reduce(function (acc, cur, i) {
                    // 1. params: total, currentValue, currentIndex[, arr]
                    // 3. // acc is an object , key is corresponding value from row 0, value is current value of array
                    acc[values[0][i]] = coerce === true ? isNaN(+cur) || cur === '' ? cur : +cur : cur;
                    return acc; // test for empty strings before coercing bc +'' => 0
                }, {});
            });
            if (tabIndex === 0) {
                this.unnested = unnested;
            }
            if (!nestBy) {
                return unnested;
            } else {
                if (typeof nestBy === 'string' || typeof nestBy === 'function') {
                    // ie only one nestBy field or funciton
                    prelim = this.nestPrelim([nestBy]);
                } else {
                    if (!Array.isArray(nestBy)) {
                        throw 'nestBy variable must be a string, function, or array of strings or functions';
                    }
                    prelim = this.nestPrelim(nestBy);
                }
            }
            if (nestType === 'object') {
                return prelim.object(unnested);
            } else {
                return prelim.entries(unnested);
            }
        },
        initializeCharts: function initializeCharts(container) {
            var group = this;
            d3.select(container).selectAll('.d3-chart').each(function () {
                group.children.push(new _Charts.Charts.ChartDiv(this, group));
            });
        }
    }; // D3ChartGroup prototype ends here

    window.D3Charts = {
        // need to specify window bc after transpiling all this will be wrapped in IIFEs
        // and `return`ing won't get the export into window's global scope
        Init: function Init() {
            var groupDivs = document.querySelectorAll('.d3-group');
            for (var i = 0; i < groupDivs.length; i++) {
                groupCollection.push(new D3ChartGroup(groupDivs[i], i));
            }
            console.log(groupCollection);
        }
    };
}(); // end var D3Charts IIFE

},{"../js-exports/Charts":2,"../js-exports/Helpers":3}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var Charts = exports.Charts = function () {

    var ChartDiv = function ChartDiv(container, parent) {
        var _this = this;

        this.container = container;
        this.parent = parent;
        this.children = [];
        this.seriesCount = 0;
        this.config = Object.create(parent.config, Object.getOwnPropertyDescriptors(container.dataset.convert()));
        // line above creates a config object from the HTML dataset for the chartDiv container
        // that inherits from the parents config object. any configs not specified for the chartDiv (an own property)
        // will come from up the inheritance chain
        this.datum = parent.data.find(function (each) {
            return each.key === _this.config.category;
        });
        var seriesInstruct = this.config.series || 'all';
        console.log(seriesInstruct);
        if (Array.isArray(seriesInstruct)) {
            console.log('is array', this.datum.values);
            this.datum.values = this.datum.values.filter(function (each) {
                console.log(each.key);
                return seriesInstruct.indexOf(each.key) !== -1;
            });
        } else if (seriesInstruct !== 'all') {
            console.log('Invalid instruction from HTML for which categories to include \n                    (var seriesInstruct). Fallback to all.');
        }
        this.seriesGroups = this.groupSeries();
        this.dictionary = this.parent.dictionary;
        if (this.config.heading !== false) {
            this.addHeading(this.config.heading);
        }
        this.createCharts();
    };

    ChartDiv.prototype = {
        chartTypes: {
            line: 'LineChart',
            column: 'ColumnChart',
            bar: 'BarChart' // so on . . .
        },
        createCharts: function createCharts() {
            var _this2 = this;

            this.seriesGroups.forEach(function (each) {
                _this2.children.push(new LineChart(_this2, each)); // TO DO distinguish chart types here
            });
        },
        groupSeries: function groupSeries() {
            var _this3 = this;

            var seriesGroups,
                groupsInstruct = this.config.seriesGroup || 'none';
            if (Array.isArray(groupsInstruct)) {
                seriesGroups = [];
                this.config.seriesGroup.forEach(function (group) {
                    seriesGroups.push(_this3.datum.values.filter(function (series) {
                        return group.indexOf(series.key) !== -1;
                    }));
                });
            } else if (groupsInstruct === 'none') {
                seriesGroups = this.datum.values.map(function (each) {
                    return [each];
                });
            } else if (groupsInstruct === 'all') {
                seriesGroups = [this.datum.values.map(function (each) {
                    return each;
                })];
            } else {
                console.log('Invalid data-group-series instruction from html. \n                       Must be valid JSON: "None" or "All" or an array\n                       of arrays containing the series to be grouped\n                       together. All strings must be double-quoted.');
            }
            return seriesGroups;
        },
        // end groupSeries()
        addHeading: function addHeading(input) {
            var _this4 = this;

            console.log(input);
            d3.select(this.container).append('p').html(function () {
                var heading = typeof input === 'string' ? input : _this4.label(_this4.config.category);
                return '<strong>' + heading + '</strong>';
            });
        },
        label: function label(key) {
            return this.dictionary.find(function (each) {
                return each.key === key;
            }).label;
        },
        units: function units(key) {
            return this.dictionary.find(function (each) {
                return each.key === key;
            }).units;
        }
    }; // end LineChart.prototype

    var LineChart = function LineChart(parent, seriesGroup) {
        this.parent = parent;
        this.config = parent.config;
        this.marginTop = +this.config.marginTop || this.defaultMargins.top;
        this.marginRight = +this.config.marginRight || this.defaultMargins.right;
        this.marginBottom = +this.config.marginBottom || this.defaultMargins.bottom;
        this.marginLeft = +this.config.marginLeft || this.defaultMargins.left;
        this.width = this.config.svgWidth ? +this.config.svgWidth - this.marginRight - this.marginLeft : 320 - this.marginRight - this.marginLeft;
        this.height = this.config.svgHeight ? +this.config.svgHeight - this.marginTop - this.marginBottom : (this.width + this.marginRight + this.marginLeft) / 2 - this.marginTop - this.marginBottom;
        this.data = seriesGroup;
        console.log(this);
        this.container = this.init(parent.container);
        this.xScaleType = this.config.xScaleType || 'time';
        this.yScaleType = this.config.yScaleType || 'linear';
        this.xTimeType = this.config.xTimeType || '%Y';
        this.scaleBy = this.config.scaleBy || 'series-group';
        this.setScales(); // //SHOULD BE IN CHART PROTOTYPE 
        this.addLines();
        this.addXAxis();
        this.addYAxis();
        if (this.config.directLabel === true) {
            this.addLabels();
        }
    };

    LineChart.prototype = { // each LineChart is an svg that hold grouped series
        defaultMargins: {
            top: 20,
            right: 45,
            bottom: 15,
            left: 35
        },

        init: function init(chartDiv) {
            var _this5 = this;

            // //SHOULD BE IN CHART PROTOTYPE this is called once for each seriesGroup of each category. 
            var container = d3.select(chartDiv).append('svg').attr('width', this.width + this.marginRight + this.marginLeft).attr('height', this.height + this.marginTop + this.marginBottom);

            this.svg = container.append('g').attr('transform', 'translate(' + this.marginLeft + ', ' + this.marginTop + ')');

            this.eachSeries = this.svg.selectAll('each-series').data(this.data).enter().append('g').attr('class', function () {
                return 'each-series series-' + _this5.parent.seriesCount + ' color-' + _this5.parent.seriesCount++ % 3;
            });
            /*
                        this.eachSeries.each((d,i,array) => {
                            this.parent.seriesArray.push(array[i]);
                        });*/

            return container.node();
        },
        setScales: function setScales() {
            var _this6 = this;

            //SHOULD BE IN CHART PROTOTYPE // TO DO: SET SCALES FOR OTHER GROUP TYPES
            var d3Scale = {
                time: d3.scaleTime(),
                linear: d3.scaleLinear()
                // TO DO: add all scale types.
            };
            var xMaxes = [],
                xMins = [],
                yMaxes = [],
                yMins = [];
            if (this.scaleBy === 'series-group') {
                this.data.forEach(function (each) {
                    console.log(each, _this6.parent.parent.summaries[1]);
                    xMaxes.push(_this6.parent.parent.summaries[1][_this6.config.category][each.key][_this6.config.variableX].max);
                    xMins.push(_this6.parent.parent.summaries[1][_this6.config.category][each.key][_this6.config.variableX].min);
                    yMaxes.push(_this6.parent.parent.summaries[1][_this6.config.category][each.key][_this6.config.variableY].max);
                    yMins.push(_this6.parent.parent.summaries[1][_this6.config.category][each.key][_this6.config.variableY].min);
                });
            }
            this.xMax = d3.max(xMaxes);
            this.xMin = d3.min(xMins);
            this.yMax = d3.max(yMaxes);
            this.yMin = d3.min(yMins);
            this.xValuesUnique = [];

            var xRange = [0, this.width],
                yRange = [this.height, 0],
                xDomain,
                yDomain;
            if (this.xScaleType === 'time') {
                xDomain = [d3.timeParse(this.xTimeType)(this.xMin), d3.timeParse(this.xTimeType)(this.xMax)];
            } else {
                // TO DO: OTHER data types ?
                xDomain = [this.xMin, this.xMax];
            }
            if (this.yScaleType === 'time') {
                yDomain = [d3.timeParse(this.yTimeType)(this.yMin), d3.timeParse(this.yTimeType)(this.yMax)];
            } else {
                // TO DO: OTHER data types ?
                yDomain = [this.yMin, this.yMax];
            }

            this.xScale = d3Scale[this.xScaleType].domain(xDomain).range(xRange);
            this.yScale = d3Scale[this.yScaleType].domain(yDomain).range(yRange);
        },
        addLines: function addLines() {
            var _this7 = this;

            var valueline = d3.line().x(function (d) {
                if (_this7.xValuesUnique.indexOf(d[_this7.config.variableX]) === -1) {
                    _this7.xValuesUnique.push(d[_this7.config.variableX]);
                }
                return _this7.xScale(d3.timeParse(_this7.xTimeType)(d[_this7.config.variableX]));
            }).y(function (d) {
                return _this7.yScale(d[_this7.config.variableY]);
            }); // !! not programmatic

            this.eachSeries.append('path').attr('class', 'line').attr('d', function (d) {
                return valueline(d.values);
            });
        },
        addXAxis: function addXAxis() {
            var _this8 = this;

            // could be in Chart prototype ?
            var yAxisPosition, yAxisOffset, axisType;

            if (this.config.yAxisPosition === 'zero') {
                yAxisPosition = 0;
                yAxisOffset = 0;
                axisType = d3.axisBottom;
            } else if (this.config.yAxisPosition === 'top') {
                yAxisPosition = this.yMax;
                yAxisOffset = -this.marginTop;
                axisType = d3.axisTop;
            } else {
                yAxisPosition = this.yMin;
                yAxisOffset = 0;
                axisType = d3.axisBottom;
            }
            var axis = axisType(this.xScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1);
            if (this.xScaleType === 'time') {
                axis.tickValues(this.xValuesUnique.map(function (each) {
                    return d3.timeParse(_this8.xTimeType)(each);
                })); // TO DO: allow for other xAxis Adjustments
            }
            this.svg.append('g').attr('transform', 'translate(0,' + (this.yScale(yAxisPosition) + yAxisOffset) + ')') // not programatic placement of x-axis
            .attr('class', 'axis x-axis').call(axis);
        },
        addYAxis: function addYAxis() {
            var _this9 = this;

            /* axis */
            this.svg.append('g').attr('class', function () {
                return 'axis y-axis ';
            }).call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5));

            /* labels */
            this.eachSeries.append('text').attr('class', 'units').attr('transform', function () {
                return 'translate(-' + _this9.marginLeft + ',-' + (_this9.marginTop - 10) + ')';
            }).text(function (d, i) {
                return i === 0 ? _this9.parent.units(d.key) : null;
            });
        },
        addLabels: function addLabels() {
            var _this10 = this;

            this.eachSeries.append('text').attr('class', 'series-label').html(function (d) {
                return '<tspan x="0">' + _this10.parent.label(d.key).replace(/\\n/g, '</tspan><tspan x="0" dy="1.2em">') + '</tspan>';
            }).attr('transform', function (d) {
                return 'translate(' + (_this10.width + 3) + ', ' + (_this10.yScale(d.values[d.values.length - 1][_this10.config.variableY]) + 3) + ')';
            });
        }
    };

    return {
        ChartDiv: ChartDiv
    };
}();

},{}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var Helpers = exports.Helpers = function () {
    /* globals DOMStringMap */
    String.prototype.cleanString = function () {
        // lowercase and remove punctuation and replace spaces with hyphens; delete punctuation
        return this.replace(/[ \\\/]/g, '-').replace(/['"”’“‘,\.!\?;\(\)&]/g, '').toLowerCase();
    };

    String.prototype.removeUnderscores = function () {
        return this.replace(/_/g, ' ');
    };

    DOMStringMap.prototype.convert = function () {
        var newObj = {};
        for (var key in this) {
            if (this.hasOwnProperty(key)) {
                try {
                    newObj[key] = JSON.parse(this[key]);
                } catch (err) {
                    newObj[key] = this[key];
                }
            }
        }
        return newObj;
    };
}();

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9DaGFydHMuanMiLCJqcy1leHBvcnRzL0hlbHBlcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0lBOztBQUNBOztBQUxDLGdDLENBQWlDO0FBQ2pDOztBQU1ELElBQUksV0FBWSxZQUFVOztBQUUxQjs7QUFFSSxRQUFJLGtCQUFrQixFQUF0QjtBQUNBLFFBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxTQUFULEVBQW9CLEtBQXBCLEVBQTBCO0FBQUE7O0FBQ3pDLGdCQUFRLEdBQVIsQ0FBWSxLQUFaO0FBQ0EsYUFBSyxTQUFMLEdBQWlCLFNBQWpCO0FBQ0EsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssTUFBTCxHQUFjLFVBQVUsT0FBVixDQUFrQixPQUFsQixFQUFkO0FBQ0EsZ0JBQVEsR0FBUixDQUFZLEtBQUssTUFBTCxDQUFZLE1BQVosQ0FBbUIsUUFBbkIsRUFBWjtBQUNBLGFBQUssWUFBTCxHQUFvQixLQUFLLGtCQUFMLENBQXdCLFNBQXhCLENBQXBCO0FBQ0EsYUFBSyxRQUFMLEdBQWdCLEVBQWhCO0FBQ0EsZ0JBQVEsR0FBUixDQUFZLEtBQUssWUFBakI7QUFDQTtBQUNBLGFBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixZQUFNO0FBQ3pCLGtCQUFLLGdCQUFMLENBQXNCLFNBQXRCO0FBQ0gsU0FGRDtBQUdILEtBYkQ7QUFjQTtBQUNBLGlCQUFhLFNBQWIsR0FBeUI7QUFFakIsMEJBRmlCLGdDQUVHO0FBQUE7O0FBQ2hCLGdCQUFJLGVBQWUsRUFBbkI7QUFDQSxnQkFBSSxVQUFVLEtBQUssTUFBTCxDQUFZLE9BQTFCO0FBQUEsZ0JBQ0ksT0FBTyxDQUFDLEtBQUssTUFBTCxDQUFZLE9BQWIsRUFBcUIsS0FBSyxNQUFMLENBQVksYUFBakMsQ0FEWCxDQUZnQixDQUc0QztBQUN4QjtBQUNwQyxp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YixDQUF1QixPQUF2QixHQUFpQyxZQUFXO0FBQ3hDLFlBQUksU0FBUyxFQUFiO0FBQ0EsYUFBTSxJQUFJLEdBQVYsSUFBaUIsSUFBakIsRUFBdUI7QUFDbkIsZ0JBQUksS0FBSyxjQUFMLENBQW9CLEdBQXBCLENBQUosRUFBNkI7QUFDekIsb0JBQUk7QUFDQSwyQkFBTyxHQUFQLElBQWMsS0FBSyxLQUFMLENBQVcsS0FBSyxHQUFMLENBQVgsQ0FBZDtBQUNILGlCQUZELENBR0EsT0FBTSxHQUFOLEVBQVc7QUFDUCwyQkFBTyxHQUFQLElBQWMsS0FBSyxHQUFMLENBQWQ7QUFDSDtBQUNKO0FBQ0o7QUFDRCxlQUFPLE1BQVA7QUFDSCxLQWJEO0FBY0gsQ0F4QnNCLEVBQWhCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIiAvKiBleHBvcnRlZCBEM0NoYXJ0cywgSGVscGVycyAqLyAvLyBsZXQncyBqc2hpbnQga25vdyB0aGF0IEQzQ2hhcnRzIGNhbiBiZSBcImRlZmluZWQgYnV0IG5vdCB1c2VkXCIgaW4gdGhpcyBmaWxlXG4gLyogcG9seWZpbGxzIG5lZWRlZDogUHJvbWlzZSwgQXJyYXkuaXNBcnJheSwgQXJyYXkuZmluZCwgQXJyYXkuZmlsdGVyXG5cbiAqL1xuaW1wb3J0IHsgSGVscGVycyB9IGZyb20gJy4uL2pzLWV4cG9ydHMvSGVscGVycyc7XG5pbXBvcnQgeyBDaGFydHMgfSBmcm9tICcuLi9qcy1leHBvcnRzL0NoYXJ0cyc7XG5cbnZhciBEM0NoYXJ0cyA9IChmdW5jdGlvbigpe1xuXG5cInVzZSBzdHJpY3RcIjsgXG4gICAgXG4gICAgdmFyIGdyb3VwQ29sbGVjdGlvbiA9IFtdO1xuICAgIHZhciBEM0NoYXJ0R3JvdXAgPSBmdW5jdGlvbihjb250YWluZXIsIGluZGV4KXtcbiAgICAgICAgY29uc29sZS5sb2coaW5kZXgpO1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICAgICAgdGhpcy5pbmRleCA9IGluZGV4O1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbnRhaW5lci5kYXRhc2V0LmNvbnZlcnQoKTtcbiAgICAgICAgY29uc29sZS5sb2codGhpcy5jb25maWcubmVzdEJ5LnRvU3RyaW5nKCkpO1xuICAgICAgICB0aGlzLmRhdGFQcm9taXNlcyA9IHRoaXMucmV0dXJuRGF0YVByb21pc2VzKGNvbnRhaW5lcik7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcbiAgICAgICAgY29uc29sZS5sb2codGhpcy5kYXRhUHJvbWlzZXMpO1xuICAgICAgICAvL3RoaXMuY29udHJvbGxlci5pbml0Q29udHJvbGxlcihjb250YWluZXIsIHRoaXMubW9kZWwsIHRoaXMudmlldyk7XG4gICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplQ2hhcnRzKGNvbnRhaW5lcik7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgLy9wcm90b3R5cGUgYmVnaW5zIGhlcmVcbiAgICBEM0NoYXJ0R3JvdXAucHJvdG90eXBlID0ge1xuICAgICAgICBcbiAgICAgICAgICAgIHJldHVybkRhdGFQcm9taXNlcygpeyBcbiAgICAgICAgICAgICAgICB2YXIgZGF0YVByb21pc2VzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHNoZWV0SUQgPSB0aGlzLmNvbmZpZy5zaGVldElkLCBcbiAgICAgICAgICAgICAgICAgICAgdGFicyA9IFt0aGlzLmNvbmZpZy5kYXRhVGFiLHRoaXMuY29uZmlnLmRpY3Rpb25hcnlUYWJdOyAvLyB0aGlzIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlzIHRoZXJlIGEgY2FzZSBmb3IgbW9yZSB0aGFuIG9uZSBzaGVldCBvZiBkYXRhP1xuICAgICAgICAgICAgICAgIHRhYnMuZm9yRWFjaCgoZWFjaCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZDMuanNvbignaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLycgKyBzaGVldElEICsgJy92YWx1ZXMvJyArIGVhY2ggKyAnP2tleT1BSXphU3lERDNXNXdKZUpGMmVzZmZaTVF4TnRFbDl0dC1PZmdTcTQnLCAoZXJyb3IsZGF0YSkgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZXMgPSBkYXRhLnZhbHVlcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdFR5cGUgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyAnb2JqZWN0JyA6ICdzZXJpZXMnOyAvLyBuZXN0VHlwZSBmb3IgZGF0YSBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5ID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gZmFsc2UgOiB0aGlzLmNvbmZpZy5uZXN0Qnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgdHJ1ZSwgbmVzdFR5cGUsIGkpKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFQcm9taXNlcy5wdXNoKHByb21pc2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFByb21pc2UuYWxsKGRhdGFQcm9taXNlcykudGhlbih2YWx1ZXMgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGEgPSB2YWx1ZXNbMF07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGljdGlvbmFyeSA9IHZhbHVlc1sxXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSB0aGlzLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoZGF0YVByb21pc2VzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdW1tYXJpemVEYXRhKCl7IC8vIHRoaXMgZm4gY3JlYXRlcyBhbiBhcnJheSBvZiBvYmplY3RzIHN1bW1hcml6aW5nIHRoZSBkYXRhIGluIG1vZGVsLmRhdGEuIG1vZGVsLmRhdGEgaXMgbmVzdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBuZXN0aW5nIGFuZCByb2xsaW5nIHVwIGNhbm5vdCBiZSBkb25lIGVhc2lseSBhdCB0aGUgc2FtZSB0aW1lLCBzbyB0aGV5J3JlIGRvbmUgc2VwYXJhdGVseS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHN1bW1hcmllcyBwcm92aWRlIGF2ZXJhZ2UsIG1heCwgbWluIG9mIGFsbCBmaWVsZHMgaW4gdGhlIGRhdGEgYXQgYWxsIGxldmVscyBvZiBuZXN0aW5nLiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLCB0aGUgc2Vjb25kIGlzIHR3bywgYW5kIHNvIG9uLlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBzdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgdmFyaWFibGVzID0gT2JqZWN0LmtleXModGhpcy51bm5lc3RlZFswXSk7IC8vIGFsbCBuZWVkIHRvIGhhdmUgdGhlIHNhbWUgZmllbGRzXG4gICAgICAgICAgICAgICAgdmFyIG5lc3RCeSA9IHRoaXMuY29uZmlnLm5lc3RCeSA/IHRoaXMuY29uZmlnLm5lc3RCeS5tYXAoZWFjaCA9PiBlYWNoKSA6IGZhbHNlOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB1c2VzIG1hcCB0byBjcmVhdGUgbmV3IGFycmF5IHJhdGhlciB0aGFuIGFzc2lnbmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ5IHJlZmVyZW5jZS4gdGhlIGBwb3AoKWAgYmVsb3cgd291bGQgYWZmZWN0IG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJyYXkgaWYgZG9uZSBieSByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5QXJyYXkgPSBBcnJheS5pc0FycmF5KG5lc3RCeSkgPyBuZXN0QnkgOiBbbmVzdEJ5XTtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiByZWR1Y2VWYXJpYWJsZXMoZCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY1tjdXJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heDogICAgICAgZDMubWF4KGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW46ICAgICAgIGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVhbjogICAgICBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW06ICAgICAgIGQzLnN1bShkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFuOiAgICBkMy5tZWRpYW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbmNlOiAgZDMudmFyaWFuY2UoZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmlhdGlvbjogZDMuZGV2aWF0aW9uKGQsIGQgPT4gZFtjdXJdKVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgICAgIH0se30pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3aGlsZSAoIG5lc3RCeUFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHN1bW1hcml6ZWQgPSB0aGlzLm5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICAucm9sbHVwKHJlZHVjZVZhcmlhYmxlcylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodGhpcy51bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgICAgIHN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAgICAgIFxuICAgICAgICAgICAgICAgICAgICBuZXN0QnlBcnJheS5wb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1bW1hcmllcztcbiAgICAgICAgICAgIH0sIFxuICAgICAgICAgICAgbmVzdFByZWxpbShuZXN0QnlBcnJheSl7XG4gICAgICAgICAgICAgICAgLy8gcmVjdXJzaXZlICBuZXN0aW5nIGZ1bmN0aW9uIHVzZWQgYnkgc3VtbWFyaXplRGF0YSBhbmQgcmV0dXJuS2V5VmFsdWVzXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5lc3RCeUFycmF5LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1cil7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyICE9PSAnc3RyaW5nJyAmJiB0eXBlb2YgY3VyICE9PSAnZnVuY3Rpb24nICkgeyB0aHJvdyAnZWFjaCBuZXN0QnkgaXRlbSBtdXN0IGJlIGEgc3RyaW5nIG9yIGZ1bmN0aW9uJzsgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgcnRuO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdzdHJpbmcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkW2N1cl07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTsgICAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjdXIoZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcnRuO1xuICAgICAgICAgICAgICAgIH0sIGQzLm5lc3QoKSk7XG4gICAgICAgICAgICB9LCAgICAgICBcbiAgICAgICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycsIHRhYkluZGV4ID0gMCl7XG4gICAgICAgICAgICAvLyB0aGlzIGZuIHRha2VzIG5vcm1hbGl6ZWQgZGF0YSBmZXRjaGVkIGFzIGFuIGFycmF5IG9mIHJvd3MgYW5kIHVzZXMgdGhlIHZhbHVlcyBpbiB0aGUgZmlyc3Qgcm93IGFzIGtleXMgZm9yIHZhbHVlcyBpblxuICAgICAgICAgICAgLy8gc3Vic2VxdWVudCByb3dzXG4gICAgICAgICAgICAvLyBuZXN0QnkgPSBzdHJpbmcgb3IgYXJyYXkgb2YgZmllbGQocykgdG8gbmVzdCBieSwgb3IgYSBjdXN0b20gZnVuY3Rpb24sIG9yIGFuIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zO1xuICAgICAgICAgICAgLy8gY29lcmNlID0gQk9PTCBjb2VyY2UgdG8gbnVtIG9yIG5vdDsgbmVzdFR5cGUgPSBvYmplY3Qgb3Igc2VyaWVzIG5lc3QgKGQzKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBwcmVsaW07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHVubmVzdGVkID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1ciwgaSkgeyBcbiAgICAgICAgICAgICAgICAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgICAvLyAzLiAvLyBhY2MgaXMgYW4gb2JqZWN0ICwga2V5IGlzIGNvcnJlc3BvbmRpbmcgdmFsdWUgZnJvbSByb3cgMCwgdmFsdWUgaXMgY3VycmVudCB2YWx1ZSBvZiBhcnJheVxuICAgICAgICAgICAgICAgICAgYWNjW3ZhbHVlc1swXVtpXV0gPSBjb2VyY2UgPT09IHRydWUgPyBpc05hTigrY3VyKSB8fCBjdXIgPT09ICcnID8gY3VyIDogK2N1ciA6IGN1cjsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRlc3QgZm9yIGVtcHR5IHN0cmluZ3MgYmVmb3JlIGNvZXJjaW5nIGJjICsnJyA9PiAwXG4gICAgICAgICAgICAgICAgfSwge30pKTtcbiAgICAgICAgICAgICAgICBpZiAoIHRhYkluZGV4ID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVubmVzdGVkID0gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCAhbmVzdEJ5ICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bm5lc3RlZDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBuZXN0QnkgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBuZXN0QnkgPT09ICdmdW5jdGlvbicgKSB7IC8vIGllIG9ubHkgb25lIG5lc3RCeSBmaWVsZCBvciBmdW5jaXRvblxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gdGhpcy5uZXN0UHJlbGltKFtuZXN0QnldKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCBuZXN0VHlwZSA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh1bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudHJpZXModW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbml0aWFsaXplQ2hhcnRzKGNvbnRhaW5lcil7XG4gICAgICAgICAgICAgICAgdmFyIGdyb3VwID0gdGhpcztcbiAgICAgICAgICAgICAgICBkMy5zZWxlY3QoY29udGFpbmVyKS5zZWxlY3RBbGwoJy5kMy1jaGFydCcpXG4gICAgICAgICAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICBncm91cC5jaGlsZHJlbi5wdXNoKG5ldyBDaGFydHMuQ2hhcnREaXYodGhpcywgZ3JvdXApKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9ICAgICAgICBcbiAgICB9OyAvLyBEM0NoYXJ0R3JvdXAgcHJvdG90eXBlIGVuZHMgaGVyZVxuICAgIFxuICAgIHdpbmRvdy5EM0NoYXJ0cyA9IHsgLy8gbmVlZCB0byBzcGVjaWZ5IHdpbmRvdyBiYyBhZnRlciB0cmFuc3BpbGluZyBhbGwgdGhpcyB3aWxsIGJlIHdyYXBwZWQgaW4gSUlGRXNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBgcmV0dXJuYGluZyB3b24ndCBnZXQgdGhlIGV4cG9ydCBpbnRvIHdpbmRvdydzIGdsb2JhbCBzY29wZVxuICAgICAgICBJbml0KCl7XG4gICAgICAgICAgICB2YXIgZ3JvdXBEaXZzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmQzLWdyb3VwJyk7XG4gICAgICAgICAgICBmb3IgKCBsZXQgaSA9IDA7IGkgPCBncm91cERpdnMubGVuZ3RoOyBpKysgKXtcbiAgICAgICAgICAgICAgICBncm91cENvbGxlY3Rpb24ucHVzaChuZXcgRDNDaGFydEdyb3VwKGdyb3VwRGl2c1tpXSwgaSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc29sZS5sb2coZ3JvdXBDb2xsZWN0aW9uKTtcbiAgICAgICAgfVxuICAgIH07XG59KCkpOyAvLyBlbmQgdmFyIEQzQ2hhcnRzIElJRkUiLCJleHBvcnQgY29uc3QgQ2hhcnRzID0gKGZ1bmN0aW9uKCl7XG4gICAgXG4gICAgdmFyIENoYXJ0RGl2ID0gZnVuY3Rpb24oY29udGFpbmVyLCBwYXJlbnQpe1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICAgICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcbiAgICAgICAgdGhpcy5zZXJpZXNDb3VudCA9IDA7XG4gICAgICAgIHRoaXMuY29uZmlnID0gT2JqZWN0LmNyZWF0ZSggcGFyZW50LmNvbmZpZywgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcnMoIGNvbnRhaW5lci5kYXRhc2V0LmNvbnZlcnQoKSApICk7XG4gICAgICAgICAgICAvLyBsaW5lIGFib3ZlIGNyZWF0ZXMgYSBjb25maWcgb2JqZWN0IGZyb20gdGhlIEhUTUwgZGF0YXNldCBmb3IgdGhlIGNoYXJ0RGl2IGNvbnRhaW5lclxuICAgICAgICAgICAgLy8gdGhhdCBpbmhlcml0cyBmcm9tIHRoZSBwYXJlbnRzIGNvbmZpZyBvYmplY3QuIGFueSBjb25maWdzIG5vdCBzcGVjaWZpZWQgZm9yIHRoZSBjaGFydERpdiAoYW4gb3duIHByb3BlcnR5KVxuICAgICAgICAgICAgLy8gd2lsbCBjb21lIGZyb20gdXAgdGhlIGluaGVyaXRhbmNlIGNoYWluXG4gICAgICAgIHRoaXMuZGF0dW0gPSBwYXJlbnQuZGF0YS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IHRoaXMuY29uZmlnLmNhdGVnb3J5KTtcbiAgICAgICAgdmFyIHNlcmllc0luc3RydWN0ID0gdGhpcy5jb25maWcuc2VyaWVzIHx8ICdhbGwnO1xuICAgICAgICBjb25zb2xlLmxvZyhzZXJpZXNJbnN0cnVjdCk7XG4gICAgICAgIGlmICggQXJyYXkuaXNBcnJheShzZXJpZXNJbnN0cnVjdCkgKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdpcyBhcnJheScsIHRoaXMuZGF0dW0udmFsdWVzKTtcbiAgICAgICAgICAgIHRoaXMuZGF0dW0udmFsdWVzID0gdGhpcy5kYXR1bS52YWx1ZXMuZmlsdGVyKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVhY2gua2V5KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VyaWVzSW5zdHJ1Y3QuaW5kZXhPZihlYWNoLmtleSkgIT09IC0xO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIHNlcmllc0luc3RydWN0ICE9PSAnYWxsJyApe1xuICAgICAgICAgICAgY29uc29sZS5sb2coYEludmFsaWQgaW5zdHJ1Y3Rpb24gZnJvbSBIVE1MIGZvciB3aGljaCBjYXRlZ29yaWVzIHRvIGluY2x1ZGUgXG4gICAgICAgICAgICAgICAgICAgICh2YXIgc2VyaWVzSW5zdHJ1Y3QpLiBGYWxsYmFjayB0byBhbGwuYCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zZXJpZXNHcm91cHMgPSB0aGlzLmdyb3VwU2VyaWVzKCk7XG4gICAgICAgIHRoaXMuZGljdGlvbmFyeSA9IHRoaXMucGFyZW50LmRpY3Rpb25hcnk7XG4gICAgICAgIGlmICggdGhpcy5jb25maWcuaGVhZGluZyAhPT0gZmFsc2UgKXtcbiAgICAgICAgICAgIHRoaXMuYWRkSGVhZGluZyh0aGlzLmNvbmZpZy5oZWFkaW5nKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNyZWF0ZUNoYXJ0cygpO1xuXG4gICAgfTtcbiAgICBcbiAgICBDaGFydERpdi5wcm90b3R5cGUgPSB7XG4gICAgICAgIGNoYXJ0VHlwZXM6IHtcbiAgICAgICAgICAgIGxpbmU6ICAgJ0xpbmVDaGFydCcsXG4gICAgICAgICAgICBjb2x1bW46ICdDb2x1bW5DaGFydCcsXG4gICAgICAgICAgICBiYXI6ICAgICdCYXJDaGFydCcgLy8gc28gb24gLiAuIC5cbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlQ2hhcnRzKCl7XG4gICAgICAgICAgICB0aGlzLnNlcmllc0dyb3Vwcy5mb3JFYWNoKChlYWNoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKG5ldyBMaW5lQ2hhcnQodGhpcywgZWFjaCkpOyAvLyBUTyBETyBkaXN0aW5ndWlzaCBjaGFydCB0eXBlcyBoZXJlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgZ3JvdXBTZXJpZXMoKXtcbiAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHMsXG4gICAgICAgICAgICAgICAgZ3JvdXBzSW5zdHJ1Y3QgPSB0aGlzLmNvbmZpZy5zZXJpZXNHcm91cCB8fCAnbm9uZSc7XG4gICAgICAgICAgICBpZiAoIEFycmF5LmlzQXJyYXkoIGdyb3Vwc0luc3RydWN0ICkgKSB7XG4gICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuc2VyaWVzR3JvdXAuZm9yRWFjaChncm91cCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3Vwcy5wdXNoKHRoaXMuZGF0dW0udmFsdWVzLmZpbHRlcihzZXJpZXMgPT4gZ3JvdXAuaW5kZXhPZihzZXJpZXMua2V5KSAhPT0gLTEpKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnbm9uZScgKSB7XG4gICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gdGhpcy5kYXR1bS52YWx1ZXMubWFwKGVhY2ggPT4gW2VhY2hdKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnYWxsJyApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbdGhpcy5kYXR1bS52YWx1ZXMubWFwKGVhY2ggPT4gZWFjaCldO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgSW52YWxpZCBkYXRhLWdyb3VwLXNlcmllcyBpbnN0cnVjdGlvbiBmcm9tIGh0bWwuIFxuICAgICAgICAgICAgICAgICAgICAgICBNdXN0IGJlIHZhbGlkIEpTT046IFwiTm9uZVwiIG9yIFwiQWxsXCIgb3IgYW4gYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgICAgb2YgYXJyYXlzIGNvbnRhaW5pbmcgdGhlIHNlcmllcyB0byBiZSBncm91cGVkXG4gICAgICAgICAgICAgICAgICAgICAgIHRvZ2V0aGVyLiBBbGwgc3RyaW5ncyBtdXN0IGJlIGRvdWJsZS1xdW90ZWQuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc2VyaWVzR3JvdXBzO1xuICAgICAgICB9LCAvLyBlbmQgZ3JvdXBTZXJpZXMoKVxuICAgICAgICBhZGRIZWFkaW5nKGlucHV0KXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGlucHV0KTtcbiAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzLmNvbnRhaW5lcilcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdwJylcbiAgICAgICAgICAgICAgICAuaHRtbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBoZWFkaW5nID0gdHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJyA/IGlucHV0IDogdGhpcy5sYWJlbCh0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nICsgaGVhZGluZyArICc8L3N0cm9uZz4nO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBsYWJlbChrZXkpe1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkubGFiZWw7XG4gICAgICAgIH0sXG4gICAgICAgIHVuaXRzKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS51bml0czsgIFxuICAgICAgICB9XG5cbiAgICB9OyAvLyBlbmQgTGluZUNoYXJ0LnByb3RvdHlwZVxuXG4gICAgdmFyIExpbmVDaGFydCA9IGZ1bmN0aW9uKHBhcmVudCwgc2VyaWVzR3JvdXApe1xuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBwYXJlbnQuY29uZmlnO1xuICAgICAgICB0aGlzLm1hcmdpblRvcCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5Ub3AgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy50b3A7XG4gICAgICAgIHRoaXMubWFyZ2luUmlnaHQgPSArdGhpcy5jb25maWcubWFyZ2luUmlnaHQgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5yaWdodDtcbiAgICAgICAgdGhpcy5tYXJnaW5Cb3R0b20gPSArdGhpcy5jb25maWcubWFyZ2luQm90dG9tIHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMuYm90dG9tO1xuICAgICAgICB0aGlzLm1hcmdpbkxlZnQgPSArdGhpcy5jb25maWcubWFyZ2luTGVmdCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLmxlZnQ7XG4gICAgICAgIHRoaXMud2lkdGggPSB0aGlzLmNvbmZpZy5zdmdXaWR0aCA/ICt0aGlzLmNvbmZpZy5zdmdXaWR0aCAtIHRoaXMubWFyZ2luUmlnaHQgLSB0aGlzLm1hcmdpbkxlZnQgOiAzMjAgLSB0aGlzLm1hcmdpblJpZ2h0IC0gdGhpcy5tYXJnaW5MZWZ0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IHRoaXMuY29uZmlnLnN2Z0hlaWdodCA/ICt0aGlzLmNvbmZpZy5zdmdIZWlnaHQgLSB0aGlzLm1hcmdpblRvcCAtIHRoaXMubWFyZ2luQm90dG9tIDogKCB0aGlzLndpZHRoICsgdGhpcy5tYXJnaW5SaWdodCArIHRoaXMubWFyZ2luTGVmdCApIC8gMiAtIHRoaXMubWFyZ2luVG9wIC0gdGhpcy5tYXJnaW5Cb3R0b207XG4gICAgICAgIHRoaXMuZGF0YSA9IHNlcmllc0dyb3VwO1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzKTtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSB0aGlzLmluaXQocGFyZW50LmNvbnRhaW5lcik7XG4gICAgICAgIHRoaXMueFNjYWxlVHlwZSA9IHRoaXMuY29uZmlnLnhTY2FsZVR5cGUgfHwgJ3RpbWUnO1xuICAgICAgICB0aGlzLnlTY2FsZVR5cGUgPSB0aGlzLmNvbmZpZy55U2NhbGVUeXBlIHx8ICdsaW5lYXInO1xuICAgICAgICB0aGlzLnhUaW1lVHlwZSA9IHRoaXMuY29uZmlnLnhUaW1lVHlwZSB8fCAnJVknO1xuICAgICAgICB0aGlzLnNjYWxlQnkgPSB0aGlzLmNvbmZpZy5zY2FsZUJ5IHx8ICdzZXJpZXMtZ3JvdXAnO1xuICAgICAgICB0aGlzLnNldFNjYWxlcygpOyAvLyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgXG4gICAgICAgIHRoaXMuYWRkTGluZXMoKTtcbiAgICAgICAgdGhpcy5hZGRYQXhpcygpO1xuICAgICAgICB0aGlzLmFkZFlBeGlzKCk7XG4gICAgICAgIGlmICggdGhpcy5jb25maWcuZGlyZWN0TGFiZWwgPT09IHRydWUgKXtcbiAgICAgICAgICAgIHRoaXMuYWRkTGFiZWxzKCk7XG4gICAgICAgIH1cbiAgICAgICAgICAgICAgIFxuICAgIH07XG5cbiAgICBMaW5lQ2hhcnQucHJvdG90eXBlID0geyAvLyBlYWNoIExpbmVDaGFydCBpcyBhbiBzdmcgdGhhdCBob2xkIGdyb3VwZWQgc2VyaWVzXG4gICAgICAgIGRlZmF1bHRNYXJnaW5zOiB7XG4gICAgICAgICAgICB0b3A6MjAsXG4gICAgICAgICAgICByaWdodDo0NSxcbiAgICAgICAgICAgIGJvdHRvbToxNSxcbiAgICAgICAgICAgIGxlZnQ6MzVcbiAgICAgICAgfSxcbiAgICAgICAgICAgICAgXG4gICAgICAgIGluaXQoY2hhcnREaXYpeyAvLyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgdGhpcyBpcyBjYWxsZWQgb25jZSBmb3IgZWFjaCBzZXJpZXNHcm91cCBvZiBlYWNoIGNhdGVnb3J5LiBcbiAgICAgICAgICAgIHZhciBjb250YWluZXIgPSAgZDMuc2VsZWN0KGNoYXJ0RGl2KVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3N2ZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3dpZHRoJywgdGhpcy53aWR0aCArIHRoaXMubWFyZ2luUmlnaHQgKyB0aGlzLm1hcmdpbkxlZnQgKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdoZWlnaHQnLCB0aGlzLmhlaWdodCAgKyB0aGlzLm1hcmdpblRvcCArIHRoaXMubWFyZ2luQm90dG9tICk7XG5cbiAgICAgICAgICAgIHRoaXMuc3ZnID0gY29udGFpbmVyLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsYHRyYW5zbGF0ZSgke3RoaXMubWFyZ2luTGVmdH0sICR7dGhpcy5tYXJnaW5Ub3B9KWApO1xuXG4gICAgICAgICAgICB0aGlzLmVhY2hTZXJpZXMgPSB0aGlzLnN2Zy5zZWxlY3RBbGwoJ2VhY2gtc2VyaWVzJylcbiAgICAgICAgICAgICAgICAuZGF0YSh0aGlzLmRhdGEpXG4gICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnZWFjaC1zZXJpZXMgc2VyaWVzLScgKyB0aGlzLnBhcmVudC5zZXJpZXNDb3VudCArICcgY29sb3ItJyArIHRoaXMucGFyZW50LnNlcmllc0NvdW50KysgJSAzO1xuICAgICAgICAgICAgICAgIH0pO1xuLypcbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcy5lYWNoKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudC5zZXJpZXNBcnJheS5wdXNoKGFycmF5W2ldKTtcbiAgICAgICAgICAgIH0pOyovXG5cblxuXG4gICAgICAgICAgICByZXR1cm4gY29udGFpbmVyLm5vZGUoKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0U2NhbGVzKCl7IC8vU0hPVUxEIEJFIElOIENIQVJUIFBST1RPVFlQRSAvLyBUTyBETzogU0VUIFNDQUxFUyBGT1IgT1RIRVIgR1JPVVAgVFlQRVNcbiAgICAgICAgICAgIHZhciBkM1NjYWxlID0ge1xuICAgICAgICAgICAgICAgIHRpbWU6IGQzLnNjYWxlVGltZSgpLFxuICAgICAgICAgICAgICAgIGxpbmVhcjogZDMuc2NhbGVMaW5lYXIoKVxuICAgICAgICAgICAgICAgIC8vIFRPIERPOiBhZGQgYWxsIHNjYWxlIHR5cGVzLlxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHZhciB4TWF4ZXMgPSBbXSwgeE1pbnMgPSBbXSwgeU1heGVzID0gW10sIHlNaW5zID0gW107XG4gICAgICAgICAgICBpZiAoIHRoaXMuc2NhbGVCeSA9PT0gJ3Nlcmllcy1ncm91cCcgKXtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZWFjaCwgdGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXSk7XG4gICAgICAgICAgICAgICAgICAgIHhNYXhlcy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt0aGlzLmNvbmZpZy52YXJpYWJsZVhdLm1heCk7XG4gICAgICAgICAgICAgICAgICAgIHhNaW5zLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0ubWluKTtcbiAgICAgICAgICAgICAgICAgICAgeU1heGVzLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0ubWF4KTtcbiAgICAgICAgICAgICAgICAgICAgeU1pbnMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1bdGhpcy5jb25maWcudmFyaWFibGVZXS5taW4pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy54TWF4ID0gZDMubWF4KHhNYXhlcyk7XG4gICAgICAgICAgICB0aGlzLnhNaW4gPSBkMy5taW4oeE1pbnMpO1xuICAgICAgICAgICAgdGhpcy55TWF4ID0gZDMubWF4KHlNYXhlcyk7XG4gICAgICAgICAgICB0aGlzLnlNaW4gPSBkMy5taW4oeU1pbnMpO1xuICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlID0gW107XG5cbiAgICAgICAgICAgIHZhciB4UmFuZ2UgPSBbMCwgdGhpcy53aWR0aF0sXG4gICAgICAgICAgICAgICAgeVJhbmdlID0gW3RoaXMuaGVpZ2h0LCAwXSxcbiAgICAgICAgICAgICAgICB4RG9tYWluLFxuICAgICAgICAgICAgICAgIHlEb21haW47XG4gICAgICAgICAgICBpZiAoIHRoaXMueFNjYWxlVHlwZSA9PT0gJ3RpbWUnKSB7XG4gICAgICAgICAgICAgICAgeERvbWFpbiA9IFtkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKHRoaXMueE1pbiksIGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkodGhpcy54TWF4KV07XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBUTyBETzogT1RIRVIgZGF0YSB0eXBlcyA/XG4gICAgICAgICAgICAgICAgeERvbWFpbiA9IFt0aGlzLnhNaW4sIHRoaXMueE1heF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIHRoaXMueVNjYWxlVHlwZSA9PT0gJ3RpbWUnKSB7XG4gICAgICAgICAgICAgICAgeURvbWFpbiA9IFtkMy50aW1lUGFyc2UodGhpcy55VGltZVR5cGUpKHRoaXMueU1pbiksIGQzLnRpbWVQYXJzZSh0aGlzLnlUaW1lVHlwZSkodGhpcy55TWF4KV07XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBUTyBETzogT1RIRVIgZGF0YSB0eXBlcyA/XG4gICAgICAgICAgICAgICAgeURvbWFpbiA9IFt0aGlzLnlNaW4sIHRoaXMueU1heF07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMueFNjYWxlID0gZDNTY2FsZVt0aGlzLnhTY2FsZVR5cGVdLmRvbWFpbih4RG9tYWluKS5yYW5nZSh4UmFuZ2UpO1xuICAgICAgICAgICAgdGhpcy55U2NhbGUgPSBkM1NjYWxlW3RoaXMueVNjYWxlVHlwZV0uZG9tYWluKHlEb21haW4pLnJhbmdlKHlSYW5nZSk7XG5cbiAgICAgICAgfSxcbiAgICAgICAgYWRkTGluZXMoKXtcbiAgICAgICAgICAgIHZhciB2YWx1ZWxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAueChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnhWYWx1ZXNVbmlxdWUuaW5kZXhPZihkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pID09PSAtMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlLnB1c2goZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKTtcbiAgICAgICAgICAgICAgICB9KSBcbiAgICAgICAgICAgICAgICAueShkID0+IHRoaXMueVNjYWxlKGRbdGhpcy5jb25maWcudmFyaWFibGVZXSkpOyAvLyAhISBub3QgcHJvZ3JhbW1hdGljXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcy5hcHBlbmQoJ3BhdGgnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ2xpbmUnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGFkZFhBeGlzKCl7IC8vIGNvdWxkIGJlIGluIENoYXJ0IHByb3RvdHlwZSA/XG4gICAgICAgICAgICB2YXIgeUF4aXNQb3NpdGlvbixcbiAgICAgICAgICAgICAgICB5QXhpc09mZnNldCxcbiAgICAgICAgICAgICAgICBheGlzVHlwZTtcblxuICAgICAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy55QXhpc1Bvc2l0aW9uID09PSAnemVybycgKXtcbiAgICAgICAgICAgICAgICB5QXhpc1Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgICAgICB5QXhpc09mZnNldCA9IDA7XG4gICAgICAgICAgICAgICAgYXhpc1R5cGUgPSBkMy5heGlzQm90dG9tO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoIHRoaXMuY29uZmlnLnlBeGlzUG9zaXRpb24gPT09ICd0b3AnICl7XG4gICAgICAgICAgICAgICAgeUF4aXNQb3NpdGlvbiA9IHRoaXMueU1heDtcbiAgICAgICAgICAgICAgICB5QXhpc09mZnNldCA9IC10aGlzLm1hcmdpblRvcDtcbiAgICAgICAgICAgICAgICBheGlzVHlwZSA9IGQzLmF4aXNUb3A7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHlBeGlzUG9zaXRpb24gPSB0aGlzLnlNaW47XG4gICAgICAgICAgICAgICAgeUF4aXNPZmZzZXQgPSAwO1xuICAgICAgICAgICAgICAgIGF4aXNUeXBlID0gZDMuYXhpc0JvdHRvbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBheGlzID0gYXhpc1R5cGUodGhpcy54U2NhbGUpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKTtcbiAgICAgICAgICAgIGlmICggdGhpcy54U2NhbGVUeXBlID09PSAndGltZScgKXtcbiAgICAgICAgICAgICAgICBheGlzLnRpY2tWYWx1ZXModGhpcy54VmFsdWVzVW5pcXVlLm1hcChlYWNoID0+IGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZWFjaCkpKTsgLy8gVE8gRE86IGFsbG93IGZvciBvdGhlciB4QXhpcyBBZGp1c3RtZW50c1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zdmcuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLCcgKyAoIHRoaXMueVNjYWxlKHlBeGlzUG9zaXRpb24pICsgeUF4aXNPZmZzZXQgKSArICcpJykgLy8gbm90IHByb2dyYW1hdGljIHBsYWNlbWVudCBvZiB4LWF4aXNcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgIC5jYWxsKGF4aXMpO1xuICAgICAgICB9LFxuICAgICAgICBhZGRZQXhpcygpe1xuICAgICAgICAgICAgLyogYXhpcyAqL1xuICAgICAgICAgICAgdGhpcy5zdmcuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4gJ2F4aXMgeS1heGlzICcpXG4gICAgICAgICAgICAgIC5jYWxsKGQzLmF4aXNMZWZ0KHRoaXMueVNjYWxlKS50aWNrU2l6ZUlubmVyKDQpLnRpY2tTaXplT3V0ZXIoMCkudGlja1BhZGRpbmcoMSkudGlja3MoNSkpO1xuXG4gICAgICAgICAgICAvKiBsYWJlbHMgKi9cbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcy5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAndW5pdHMnKVxuICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKCkgPT4gYHRyYW5zbGF0ZSgtJHt0aGlzLm1hcmdpbkxlZnR9LC0ke3RoaXMubWFyZ2luVG9wIC0gMTB9KWApXG4gICAgICAgICAgICAgIC50ZXh0KChkLGkpID0+IGkgPT09IDAgPyB0aGlzLnBhcmVudC51bml0cyhkLmtleSkgOiBudWxsKTtcbiAgICAgICAgICAgIFxuICAgICAgICB9LFxuICAgICAgICBhZGRMYWJlbHMoKXtcbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcy5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdzZXJpZXMtbGFiZWwnKVxuICAgICAgICAgICAgICAgIC5odG1sKChkKSA9PiAnPHRzcGFuIHg9XCIwXCI+JyArIHRoaXMucGFyZW50LmxhYmVsKGQua2V5KS5yZXBsYWNlKC9cXFxcbi9nLCc8L3RzcGFuPjx0c3BhbiB4PVwiMFwiIGR5PVwiMS4yZW1cIj4nKSArICc8L3RzcGFuPicpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIChkKSA9PiBgdHJhbnNsYXRlKCR7dGhpcy53aWR0aCArIDN9LCAke3RoaXMueVNjYWxlKGQudmFsdWVzW2QudmFsdWVzLmxlbmd0aCAtIDFdW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pICsgM30pYCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG5cbiAgICByZXR1cm4ge1xuICAgICAgICBDaGFydERpdlxuICAgIH07XG5cbn0pKCk7XG4iLCJleHBvcnQgY29uc3QgSGVscGVycyA9IChmdW5jdGlvbigpe1xuICAgIC8qIGdsb2JhbHMgRE9NU3RyaW5nTWFwICovXG4gICAgU3RyaW5nLnByb3RvdHlwZS5jbGVhblN0cmluZyA9IGZ1bmN0aW9uKCkgeyAvLyBsb3dlcmNhc2UgYW5kIHJlbW92ZSBwdW5jdHVhdGlvbiBhbmQgcmVwbGFjZSBzcGFjZXMgd2l0aCBoeXBoZW5zOyBkZWxldGUgcHVuY3R1YXRpb25cbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvWyBcXFxcXFwvXS9nLCctJykucmVwbGFjZSgvWydcIuKAneKAmeKAnOKAmCxcXC4hXFw/O1xcKFxcKSZdL2csJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgfTtcblxuICAgIFN0cmluZy5wcm90b3R5cGUucmVtb3ZlVW5kZXJzY29yZXMgPSBmdW5jdGlvbigpIHsgXG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL18vZywnICcpO1xuICAgIH07XG5cbiAgICBET01TdHJpbmdNYXAucHJvdG90eXBlLmNvbnZlcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG5ld09iaiA9IHt9O1xuICAgICAgICBmb3IgKCB2YXIga2V5IGluIHRoaXMgKXtcbiAgICAgICAgICAgIGlmICh0aGlzLmhhc093blByb3BlcnR5KGtleSkpe1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld09ialtrZXldID0gSlNPTi5wYXJzZSh0aGlzW2tleV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3T2JqW2tleV0gPSB0aGlzW2tleV07ICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdPYmo7XG4gICAgfTtcbn0pKCk7XG4iXX0=
