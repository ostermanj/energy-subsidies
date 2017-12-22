(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _Helpers = require('../js-exports/Helpers');

var _Charts = require('../js-exports/Charts');

var _d3Tip = require('../js-vendor/d3-tip');

var D3Charts = function () {

    "use strict";

    var groupCollection = [];
    var D3ChartGroup = function D3ChartGroup(container, index) {
        var _this = this;

        this.container = container;
        this.index = index;
        this.config = container.dataset.convert();

        this.dataPromises = this.returnDataPromises(container);
        this.children = [];

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
        }
    };
}(); // end var D3Charts IIFE
/* exported D3Charts, Helpers, d3Tip */ // let's jshint know that D3Charts can be "defined but not used" in this file
/* polyfills needed: Promise, Array.isArray, Array.find, Array.filter
 */

},{"../js-exports/Charts":2,"../js-exports/Helpers":3,"../js-vendor/d3-tip":4}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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

        if (Array.isArray(seriesInstruct)) {

            this.datum.values = this.datum.values.filter(function (each) {

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
        },
        tipText: function tipText(key) {
            var str = this.dictionary.find(function (each) {
                return each.key === key;
            }).label.replace(/\\n/g, ' ');
            return str.charAt(0).toUpperCase() + str.slice(1);
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

        this.container = this.init(parent.container); // TO DO  this is kinda weird
        this.xScaleType = this.config.xScaleType || 'time';
        this.yScaleType = this.config.yScaleType || 'linear';
        this.xTimeType = this.config.xTimeType || '%Y';
        this.scaleBy = this.config.scaleBy || 'series-group';
        this.setScales(); // //SHOULD BE IN CHART PROTOTYPE 
        this.setTooltips();
        this.addLines();
        //  this.addPoints();
        this.addXAxis();
        this.addYAxis();
        if (this.config.directLabel === true) {
            //    this.addLabels();
        } else {
                // this.addLegends();
            }
    };

    LineChart.prototype = { // each LineChart is an svg that hold grouped series
        defaultMargins: {
            top: 20,
            right: 45,
            bottom: 25,
            left: 35
        },

        init: function init(chartDiv) {
            var _this5 = this;

            // //SHOULD BE IN CHART PROTOTYPE this is called once for each seriesGroup of each category. 
            var container = d3.select(chartDiv).append('svg').attr('width', this.width + this.marginRight + this.marginLeft).attr('height', this.height + this.marginTop + this.marginBottom);

            this.svg = container.append('g').attr('transform', 'translate(' + this.marginLeft + ', ' + this.marginTop + ')');

            this.xAxisGroup = this.svg.append('g');

            this.yAxisGroup = this.svg.append('g');

            this.eachSeries = this.svg.selectAll('each-series').data(this.data).enter().append('g').attr('class', function () {
                return 'each-series series-' + _this5.parent.seriesCount + ' color-' + _this5.parent.seriesCount++ % 4;
            });
            /*
                        this.eachSeries.each((d,i,array) => {
                            this.parent.seriesArray.push(array[i]);
                        });*/
            if (this.config.stackSeries && this.config.stackSeries === true) {
                this.prepareStacking();
            }

            return container.node();
        },
        prepareStacking: function prepareStacking() {
            var _this6 = this;

            var forStacking = this.data.reduce(function (acc, cur, i) {

                if (i === 0) {
                    cur.values.forEach(function (each) {
                        var _acc$push;

                        acc.push((_acc$push = {}, _defineProperty(_acc$push, _this6.config.variableX, each[_this6.config.variableX]), _defineProperty(_acc$push, cur.key, each[_this6.config.variableY]), _acc$push));
                    });
                } else {
                    cur.values.forEach(function (each) {
                        acc.find(function (obj) {
                            return obj[_this6.config.variableX] === each[_this6.config.variableX];
                        })[cur.key] = each[_this6.config.variableY];
                    });
                }
                return acc;
            }, []);

            this.stack = d3.stack().keys(this.data.map(function (each) {
                return each.key;
            })).order(d3.stackOrderNone).offset(d3.stackOffsetNone);

            this.stackData = this.stack(forStacking);
        },
        setScales: function setScales() {
            var _this7 = this;

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

                    xMaxes.push(_this7.parent.parent.summaries[1][_this7.config.category][each.key][_this7.config.variableX].max);
                    xMins.push(_this7.parent.parent.summaries[1][_this7.config.category][each.key][_this7.config.variableX].min);
                    yMaxes.push(_this7.parent.parent.summaries[1][_this7.config.category][each.key][_this7.config.variableY].max);
                    yMins.push(_this7.parent.parent.summaries[1][_this7.config.category][each.key][_this7.config.variableY].min);
                });
            }
            this.xMax = d3.max(xMaxes);
            this.xMin = d3.min(xMins);
            this.yMax = d3.max(yMaxes);
            this.yMin = d3.min(yMins);
            this.xValuesUnique = [];

            if (this.config.stackSeries && this.config.stackSeries === true) {
                console.log(this.stackData);
                var yValues = this.stackData.reduce(function (acc, cur) {
                    console.log(cur);
                    acc.push.apply(acc, _toConsumableArray(cur.reduce(function (acc1, cur1) {
                        acc1.push(cur1[0], cur1[1]);
                        return acc1;
                    }, [])));
                    return acc;
                }, []);
                this.yMax = d3.max(yValues);
                this.yMin = d3.min(yValues);
            }
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
            var _this8 = this;

            var zeroValueline = d3.line().x(function (d) {
                if (_this8.xValuesUnique.indexOf(d[_this8.config.variableX]) === -1) {
                    _this8.xValuesUnique.push(d[_this8.config.variableX]);
                }
                return _this8.xScale(d3.timeParse(_this8.xTimeType)(d[_this8.config.variableX]));
            }).y(function () {
                return _this8.yScale(0);
            });

            var valueline = d3.line().x(function (d) {
                if (_this8.xValuesUnique.indexOf(d[_this8.config.variableX]) === -1) {
                    _this8.xValuesUnique.push(d[_this8.config.variableX]);
                }
                return _this8.xScale(d3.timeParse(_this8.xTimeType)(d[_this8.config.variableX]));
            }).y(function (d) {

                return _this8.yScale(d[_this8.config.variableY]);
            });

            if (this.config.stackSeries && this.config.stackSeries === true) {

                var area = d3.area().x(function (d) {
                    return _this8.xScale(d3.timeParse(_this8.xTimeType)(d.data[_this8.config.variableX]));
                }).y0(function (d) {
                    return _this8.yScale(d[0]);
                }).y1(function (d) {
                    return _this8.yScale(d[1]);
                });

                var line = d3.line().x(function (d) {
                    return _this8.xScale(d3.timeParse(_this8.xTimeType)(d.data[_this8.config.variableX]));
                }).y(function (d) {
                    return _this8.yScale(d[1]);
                });

                var stackGroup = this.svg.append('g').attr('class', 'stacked-area');

                stackGroup.selectAll('stacked-area').data(this.stackData).enter().append('path').attr('class', function (d, i) {
                    return 'area-line color-' + i;
                }) // TO DO not quite right that color shold be `i`
                // if you have more than one group of series, will repeat
                .attr('d', function (d) {
                    return area(d);
                });

                stackGroup.selectAll('stacked-line').data(this.stackData).enter().append('path').attr('class', function (d, i) {
                    return 'line color-' + i;
                }).attr('d', function (d) {
                    return line(d);
                });
            } else {
                this.lines = this.eachSeries.append('path').attr('class', 'line').attr('d', function (d) {
                    return zeroValueline(d.values);
                }).transition().duration(500).delay(150).attr('d', function (d) {
                    return valueline(d.values);
                }).on('end', function (d, i, array) {
                    if (i === array.length - 1) {

                        _this8.addPoints();
                        _this8.addLabels();
                    }
                });
            }
        },
        addXAxis: function addXAxis() {
            var _this9 = this;

            // could be in Chart prototype ?
            var xAxisPosition, xAxisOffset, axisType;

            if (this.config.xAxisPosition === 'top') {
                xAxisPosition = this.yMax;
                xAxisOffset = -this.marginTop;
                axisType = d3.axisTop;
            } else {
                xAxisPosition = this.yMin;
                xAxisOffset = this.marginBottom - 15;
                axisType = d3.axisBottom;
            }
            var axis = axisType(this.xScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1);
            if (this.xScaleType === 'time') {
                axis.tickValues(this.xValuesUnique.map(function (each) {
                    return d3.timeParse(_this9.xTimeType)(each);
                })); // TO DO: allow for other xAxis Adjustments
            }
            this.xAxisGroup.attr('transform', 'translate(0,' + (this.yScale(xAxisPosition) + xAxisOffset) + ')') // not programatic placement of x-axis
            .attr('class', 'axis x-axis').call(axis);
        },
        addYAxis: function addYAxis() {
            var _this10 = this;

            /* axis */
            this.yAxisGroup.attr('class', function () {
                return 'axis y-axis ';
            }).call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5));

            if (this.yMin < 0) {
                this.yAxisGroup.selectAll('.tick').each(function (d, i) {
                    d3.select(this).classed('zero', d === 0 && i !== 0);
                });
            }

            /* labels */
            this.eachSeries.append('text').attr('class', 'units').attr('transform', function () {
                return 'translate(-' + _this10.marginLeft + ',-' + (_this10.marginTop - 10) + ')';
            }).text(function (d, i) {
                return i === 0 ? _this10.parent.units(d.key) : null;
            });
        },
        addLabels: function addLabels() {
            var _this11 = this;

            this.labels = this.eachSeries.append('g').attr('transform', function (d) {
                return 'translate(' + (_this11.width + 5) + ', ' + (_this11.yScale(d.values[d.values.length - 1][_this11.config.variableY]) + 3) + ')';
            }).append('text').attr('y', 0).attr('class', 'series-label').html(function (d) {
                return '<tspan x="0">' + _this11.parent.label(d.key).replace(/\\n/g, '</tspan><tspan x="0" dy="1.2em">') + '</tspan>';
            });

            relax.call(this);

            function relax() {
                var _this12 = this;

                var alpha = 0.5,
                    spacing = 0,
                    again = false;

                this.labels.each(function (d, i, array1) {
                    var a = array1[i],
                        $a = d3.select(a),
                        yA = $a.attr('y'),
                        aRange = d3.range(Math.round(a.getCTM().f) - spacing + parseInt(yA), Math.round(a.getCTM().f) + Math.round(a.getBBox().height) + 1 + spacing + parseInt(yA));

                    _this12.labels.each(function () {
                        var b = this,
                            $b = d3.select(b),
                            yB = $b.attr('y');
                        if (a === b) {
                            return;
                        }
                        var bLimits = [Math.round(b.getCTM().f) - spacing + parseInt(yB), Math.round(b.getCTM().f) + b.getBBox().height + spacing + parseInt(yB)];
                        if (aRange[0] < bLimits[0] && aRange[aRange.length - 1] < bLimits[0] || aRange[0] > bLimits[1] && aRange[aRange.length - 1] > bLimits[1]) {
                            return;
                        } // no collison
                        var sign = bLimits[0] - aRange[aRange.length - 1] <= aRange[0] - bLimits[1] ? 1 : -1,
                            adjust = sign * alpha;
                        $b.attr('y', +yB - adjust);
                        $a.attr('y', +yA + adjust);
                        again = true;
                    });
                    if (i === array1.length - 1 && again === true) {
                        setTimeout(function () {
                            relax.call(_this12);
                        }, 20);
                    }
                });
            }
        },
        addPoints: function addPoints() {
            var _this13 = this;

            this.points = this.eachSeries.selectAll('points').data(function (d) {
                return d.values;
            }).enter().append('circle').attr('opacity', 0).attr('class', 'data-point').attr('r', '4').attr('cx', function (d) {
                return _this13.xScale(d3.timeParse(_this13.xTimeType)(d[_this13.config.variableX]));
            }).attr('cy', function (d) {
                return _this13.yScale(d[_this13.config.variableY]);
            }).on('mouseover', function (d, i, array) {

                var klass = array[i].parentNode.classList.value.match(/color-\d/)[0]; // get the color class of the parent g
                _this13.tooltip.attr('class', _this13.tooltip.attr('class') + ' ' + klass);
                _this13.tooltip.html('<strong>' + _this13.parent.tipText(d.series) + '</strong> (' + d.year + ')<br />' + d[_this13.config.variableY] + ' ' + _this13.parent.units(d.series));
                _this13.tooltip.show();
            }).on('mouseout', function () {
                _this13.tooltip.attr('class', _this13.tooltip.attr('class').replace(/ color-\d/g, ''));
                _this13.tooltip.html('');
                _this13.tooltip.hide();
            }).call(this.tooltip).transition().duration(500).attr('opacity', 1);
        },
        setTooltips: function setTooltips() {

            this.tooltip = d3.tip().attr("class", "d3-tip").direction('n').offset([-8, 0]);
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

},{}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
// d3.tip
// Copyright (c) 2013 Justin Palmer
// ES6 / D3 v4 Adaption Copyright (c) 2016 Constantin Gavrilete
// Removal of ES6 for D3 v4 Adaption Copyright (c) 2016 David Gotz
//
// Tooltips for d3.js SVG visualizations

var d3Tip = exports.d3Tip = function () {
  d3.functor = function functor(v) {
    return typeof v === "function" ? v : function () {
      return v;
    };
  };

  d3.tip = function () {

    var direction = d3_tip_direction,
        offset = d3_tip_offset,
        html = d3_tip_html,
        node = initNode(),
        svg = null,
        point = null,
        target = null;

    function tip(vis) {
      svg = getSVGNode(vis);
      point = svg.createSVGPoint();
      document.body.appendChild(node);
    }

    // Public - show the tooltip on the screen
    //
    // Returns a tip
    tip.show = function () {
      var args = Array.prototype.slice.call(arguments);
      if (args[args.length - 1] instanceof SVGElement) target = args.pop();

      var content = html.apply(this, args),
          poffset = offset.apply(this, args),
          dir = direction.apply(this, args),
          nodel = getNodeEl(),
          i = directions.length,
          coords,
          scrollTop = document.documentElement.scrollTop || document.body.scrollTop,
          scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;

      nodel.html(content).style('position', 'absolute').style('opacity', 1).style('pointer-events', 'all');

      while (i--) {
        nodel.classed(directions[i], false);
      }coords = direction_callbacks[dir].apply(this);
      nodel.classed(dir, true).style('top', coords.top + poffset[0] + scrollTop + 'px').style('left', coords.left + poffset[1] + scrollLeft + 'px');

      return tip;
    };

    // Public - hide the tooltip
    //
    // Returns a tip
    tip.hide = function () {
      var nodel = getNodeEl();
      nodel.style('opacity', 0).style('pointer-events', 'none');
      return tip;
    };

    // Public: Proxy attr calls to the d3 tip container.  Sets or gets attribute value.
    //
    // n - name of the attribute
    // v - value of the attribute
    //
    // Returns tip or attribute value
    tip.attr = function (n, v) {
      if (arguments.length < 2 && typeof n === 'string') {
        return getNodeEl().attr(n);
      } else {
        var args = Array.prototype.slice.call(arguments);
        d3.selection.prototype.attr.apply(getNodeEl(), args);
      }

      return tip;
    };

    // Public: Proxy style calls to the d3 tip container.  Sets or gets a style value.
    //
    // n - name of the property
    // v - value of the property
    //
    // Returns tip or style property value
    tip.style = function (n, v) {
      // debugger;
      if (arguments.length < 2 && typeof n === 'string') {
        return getNodeEl().style(n);
      } else {
        var args = Array.prototype.slice.call(arguments);
        if (args.length === 1) {
          var styles = args[0];
          Object.keys(styles).forEach(function (key) {
            return d3.selection.prototype.style.apply(getNodeEl(), [key, styles[key]]);
          });
        }
      }

      return tip;
    };

    // Public: Set or get the direction of the tooltip
    //
    // v - One of n(north), s(south), e(east), or w(west), nw(northwest),
    //     sw(southwest), ne(northeast) or se(southeast)
    //
    // Returns tip or direction
    tip.direction = function (v) {
      if (!arguments.length) return direction;
      direction = v == null ? v : d3.functor(v);

      return tip;
    };

    // Public: Sets or gets the offset of the tip
    //
    // v - Array of [x, y] offset
    //
    // Returns offset or
    tip.offset = function (v) {
      if (!arguments.length) return offset;
      offset = v == null ? v : d3.functor(v);

      return tip;
    };

    // Public: sets or gets the html value of the tooltip
    //
    // v - String value of the tip
    //
    // Returns html value or tip
    tip.html = function (v) {
      if (!arguments.length) return html;
      html = v == null ? v : d3.functor(v);

      return tip;
    };

    // Public: destroys the tooltip and removes it from the DOM
    //
    // Returns a tip
    tip.destroy = function () {
      if (node) {
        getNodeEl().remove();
        node = null;
      }
      return tip;
    };

    function d3_tip_direction() {
      return 'n';
    }
    function d3_tip_offset() {
      return [0, 0];
    }
    function d3_tip_html() {
      return ' ';
    }

    var direction_callbacks = {
      n: direction_n,
      s: direction_s,
      e: direction_e,
      w: direction_w,
      nw: direction_nw,
      ne: direction_ne,
      sw: direction_sw,
      se: direction_se
    };

    var directions = Object.keys(direction_callbacks);

    function direction_n() {
      var bbox = getScreenBBox();
      return {
        top: bbox.n.y - node.offsetHeight,
        left: bbox.n.x - node.offsetWidth / 2
      };
    }

    function direction_s() {
      var bbox = getScreenBBox();
      return {
        top: bbox.s.y,
        left: bbox.s.x - node.offsetWidth / 2
      };
    }

    function direction_e() {
      var bbox = getScreenBBox();
      return {
        top: bbox.e.y - node.offsetHeight / 2,
        left: bbox.e.x
      };
    }

    function direction_w() {
      var bbox = getScreenBBox();
      return {
        top: bbox.w.y - node.offsetHeight / 2,
        left: bbox.w.x - node.offsetWidth
      };
    }

    function direction_nw() {
      var bbox = getScreenBBox();
      return {
        top: bbox.nw.y - node.offsetHeight,
        left: bbox.nw.x - node.offsetWidth
      };
    }

    function direction_ne() {
      var bbox = getScreenBBox();
      return {
        top: bbox.ne.y - node.offsetHeight,
        left: bbox.ne.x
      };
    }

    function direction_sw() {
      var bbox = getScreenBBox();
      return {
        top: bbox.sw.y,
        left: bbox.sw.x - node.offsetWidth
      };
    }

    function direction_se() {
      var bbox = getScreenBBox();
      return {
        top: bbox.se.y,
        left: bbox.e.x
      };
    }

    function initNode() {
      var node = d3.select(document.createElement('div'));
      node.style('position', 'absolute').style('top', 0).style('opacity', 0).style('pointer-events', 'none').style('box-sizing', 'border-box');

      return node.node();
    }

    function getSVGNode(el) {
      el = el.node();
      if (el.tagName.toLowerCase() === 'svg') return el;

      return el.ownerSVGElement;
    }

    function getNodeEl() {
      if (node === null) {
        node = initNode();
        // re-add node to DOM
        document.body.appendChild(node);
      };
      return d3.select(node);
    }

    // Private - gets the screen coordinates of a shape
    //
    // Given a shape on the screen, will return an SVGPoint for the directions
    // n(north), s(south), e(east), w(west), ne(northeast), se(southeast), nw(northwest),
    // sw(southwest).
    //
    //    +-+-+
    //    |   |
    //    +   +
    //    |   |
    //    +-+-+
    //
    // Returns an Object {n, s, e, w, nw, sw, ne, se}
    function getScreenBBox() {
      var targetel = target || d3.event.target;

      while ('undefined' === typeof targetel.getScreenCTM && 'undefined' === targetel.parentNode) {
        targetel = targetel.parentNode;
      }

      var bbox = {},
          matrix = targetel.getScreenCTM(),
          tbbox = targetel.getBBox(),
          width = tbbox.width,
          height = tbbox.height,
          x = tbbox.x,
          y = tbbox.y;

      point.x = x;
      point.y = y;
      bbox.nw = point.matrixTransform(matrix);
      point.x += width;
      bbox.ne = point.matrixTransform(matrix);
      point.y += height;
      bbox.se = point.matrixTransform(matrix);
      point.x -= width;
      bbox.sw = point.matrixTransform(matrix);
      point.y -= height / 2;
      bbox.w = point.matrixTransform(matrix);
      point.x += width;
      bbox.e = point.matrixTransform(matrix);
      point.x -= width / 2;
      point.y -= height / 2;
      bbox.n = point.matrixTransform(matrix);
      point.y += height;
      bbox.s = point.matrixTransform(matrix);

      return bbox;
    }

    return tip;
  };
}();

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9DaGFydHMuanMiLCJqcy1leHBvcnRzL0hlbHBlcnMuanMiLCJqcy12ZW5kb3IvZDMtdGlwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNJQTs7QUFDQTs7QUFDQTs7QUFFQSxJQUFJLFdBQVksWUFBVTs7QUFFMUI7O0FBRUksUUFBSSxrQkFBa0IsRUFBdEI7QUFDQSxRQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEwQjtBQUFBOztBQUV6QyxhQUFLLFNBQUwsR0FBaUIsU0FBakI7QUFDQSxhQUFLLEtBQUwsR0FBYSxLQUFiO0FBQ0EsYUFBSyxNQUFMLEdBQWMsVUFBVSxPQUFWLENBQWtCLE9BQWxCLEVBQWQ7O0FBRUEsYUFBSyxZQUFMLEdBQW9CLEtBQUssa0JBQUwsQ0FBd0IsU0FBeEIsQ0FBcEI7QUFDQSxhQUFLLFFBQUwsR0FBZ0IsRUFBaEI7O0FBRUE7QUFDQSxhQUFLLFlBQUwsQ0FBa0IsSUFBbEIsQ0FBdUIsWUFBTTtBQUN6QixrQkFBSyxnQkFBTCxDQUFzQixTQUF0QjtBQUNILFNBRkQ7QUFHSCxLQWJEO0FBY0E7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBRWpCLDBCQUZpQixnQ0FFRztBQUFBOztBQUNoQixnQkFBSSxlQUFlLEVBQW5CO0FBQ0EsZ0JBQUksVUFBVSxLQUFLLE1BQUwsQ0FBWSxPQUExQjtBQUFBLGdCQUNJLE9BQU8sQ0FBQyxLQUFLLE1BQUwsQ0FBWSxPQUFiLEVBQXFCLEtBQUssTUFBTCxDQUFZLGFBQWpDLENBRFgsQ0FGZ0IsQ0FHNEM7QUFDeEI7QUFDcEMsaUJBQUssT0FBTCxDQUFhLFVBQUMsSUFBRCxFQUFPLENBQVAsRUFBYTtBQUN0QixvQkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsdUJB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Y2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIgLyogZXhwb3J0ZWQgRDNDaGFydHMsIEhlbHBlcnMsIGQzVGlwICovIC8vIGxldCdzIGpzaGludCBrbm93IHRoYXQgRDNDaGFydHMgY2FuIGJlIFwiZGVmaW5lZCBidXQgbm90IHVzZWRcIiBpbiB0aGlzIGZpbGVcbiAvKiBwb2x5ZmlsbHMgbmVlZGVkOiBQcm9taXNlLCBBcnJheS5pc0FycmF5LCBBcnJheS5maW5kLCBBcnJheS5maWx0ZXJcblxuICovXG5pbXBvcnQgeyBIZWxwZXJzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9IZWxwZXJzJztcbmltcG9ydCB7IENoYXJ0cyB9IGZyb20gJy4uL2pzLWV4cG9ydHMvQ2hhcnRzJztcbmltcG9ydCB7IGQzVGlwIH0gZnJvbSAnLi4vanMtdmVuZG9yL2QzLXRpcCc7XG5cbnZhciBEM0NoYXJ0cyA9IChmdW5jdGlvbigpe1xuXG5cInVzZSBzdHJpY3RcIjsgXG4gICAgIFxuICAgIHZhciBncm91cENvbGxlY3Rpb24gPSBbXTtcbiAgICB2YXIgRDNDaGFydEdyb3VwID0gZnVuY3Rpb24oY29udGFpbmVyLCBpbmRleCl7XG4gICAgICAgIFxuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICAgICAgdGhpcy5pbmRleCA9IGluZGV4O1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbnRhaW5lci5kYXRhc2V0LmNvbnZlcnQoKTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMuZGF0YVByb21pc2VzID0gdGhpcy5yZXR1cm5EYXRhUHJvbWlzZXMoY29udGFpbmVyKTtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgICAgICBcbiAgICAgICAgLy90aGlzLmNvbnRyb2xsZXIuaW5pdENvbnRyb2xsZXIoY29udGFpbmVyLCB0aGlzLm1vZGVsLCB0aGlzLnZpZXcpO1xuICAgICAgICB0aGlzLmRhdGFQcm9taXNlcy50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNoYXJ0cyhjb250YWluZXIpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8vcHJvdG90eXBlIGJlZ2lucyBoZXJlXG4gICAgRDNDaGFydEdyb3VwLnByb3RvdHlwZSA9IHtcbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm5EYXRhUHJvbWlzZXMoKXsgXG4gICAgICAgICAgICAgICAgdmFyIGRhdGFQcm9taXNlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBzaGVldElEID0gdGhpcy5jb25maWcuc2hlZXRJZCwgXG4gICAgICAgICAgICAgICAgICAgIHRhYnMgPSBbdGhpcy5jb25maWcuZGF0YVRhYix0aGlzLmNvbmZpZy5kaWN0aW9uYXJ5VGFiXTsgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpcyB0aGVyZSBhIGNhc2UgZm9yIG1vcmUgdGhhbiBvbmUgc2hlZXQgb2YgZGF0YT9cbiAgICAgICAgICAgICAgICB0YWJzLmZvckVhY2goKGVhY2gsIGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSxyZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLmpzb24oJ2h0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8nICsgc2hlZXRJRCArICcvdmFsdWVzLycgKyBlYWNoICsgJz9rZXk9QUl6YVN5REQzVzV3SmVKRjJlc2ZmWk1ReE50RWw5dHQtT2ZnU3E0JywgKGVycm9yLGRhdGEpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWVzID0gZGF0YS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RUeXBlID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gJ29iamVjdCcgOiAnc2VyaWVzJzsgLy8gbmVzdFR5cGUgZm9yIGRhdGEgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RCeSA9IGVhY2ggPT09ICdkaWN0aW9uYXJ5JyA/IGZhbHNlIDogdGhpcy5jb25maWcubmVzdEJ5O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBuZXN0QnksIHRydWUsIG5lc3RUeXBlLCBpKSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBkYXRhUHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBQcm9taXNlLmFsbChkYXRhUHJvbWlzZXMpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhID0gdmFsdWVzWzBdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB2YWx1ZXNbMV07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3VtbWFyaWVzID0gdGhpcy5zdW1tYXJpemVEYXRhKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKGRhdGFQcm9taXNlcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3VtbWFyaXplRGF0YSgpeyAvLyB0aGlzIGZuIGNyZWF0ZXMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBzdW1tYXJpemluZyB0aGUgZGF0YSBpbiBtb2RlbC5kYXRhLiBtb2RlbC5kYXRhIGlzIG5lc3RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgbmVzdGluZyBhbmQgcm9sbGluZyB1cCBjYW5ub3QgYmUgZG9uZSBlYXNpbHkgYXQgdGhlIHNhbWUgdGltZSwgc28gdGhleSdyZSBkb25lIHNlcGFyYXRlbHkuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzdW1tYXJpZXMgcHJvdmlkZSBhdmVyYWdlLCBtYXgsIG1pbiBvZiBhbGwgZmllbGRzIGluIHRoZSBkYXRhIGF0IGFsbCBsZXZlbHMgb2YgbmVzdGluZy4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBmaXJzdCAoaW5kZXggMCkgaXMgb25lIGxheWVyIG5lc3RlZCwgdGhlIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgc3VtbWFyaWVzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHZhcmlhYmxlcyA9IE9iamVjdC5rZXlzKHRoaXMudW5uZXN0ZWRbMF0pOyAvLyBhbGwgbmVlZCB0byBoYXZlIHRoZSBzYW1lIGZpZWxkc1xuICAgICAgICAgICAgICAgIHZhciBuZXN0QnkgPSB0aGlzLmNvbmZpZy5uZXN0QnkgPyB0aGlzLmNvbmZpZy5uZXN0QnkubWFwKGVhY2ggPT4gZWFjaCkgOiBmYWxzZTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlcyBtYXAgdG8gY3JlYXRlIG5ldyBhcnJheSByYXRoZXIgdGhhbiBhc3NpZ25pbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBieSByZWZlcmVuY2UuIHRoZSBgcG9wKClgIGJlbG93IHdvdWxkIGFmZmVjdCBvcmlnaW5hbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFycmF5IGlmIGRvbmUgYnkgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgdmFyIG5lc3RCeUFycmF5ID0gQXJyYXkuaXNBcnJheShuZXN0QnkpID8gbmVzdEJ5IDogW25lc3RCeV07XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gcmVkdWNlVmFyaWFibGVzKGQpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFyaWFibGVzLnJlZHVjZShmdW5jdGlvbihhY2MsIGN1cil7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NbY3VyXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXg6ICAgICAgIGQzLm1heChkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluOiAgICAgICBkMy5taW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lYW46ICAgICAgZDMubWVhbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VtOiAgICAgICBkMy5zdW0oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lZGlhbjogICAgZDMubWVkaWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW5jZTogIGQzLnZhcmlhbmNlKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpYXRpb246IGQzLmRldmlhdGlvbihkLCBkID0+IGRbY3VyXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgICAgICB9LHt9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgd2hpbGUgKCBuZXN0QnlBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnJvbGx1cChyZWR1Y2VWYXJpYWJsZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHRoaXMudW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgICAgICBzdW1tYXJpZXMudW5zaGlmdChzdW1tYXJpemVkKTsgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBzdW1tYXJpZXM7XG4gICAgICAgICAgICB9LCBcbiAgICAgICAgICAgIG5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpe1xuICAgICAgICAgICAgICAgIC8vIHJlY3Vyc2l2ZSAgbmVzdGluZyBmdW5jdGlvbiB1c2VkIGJ5IHN1bW1hcml6ZURhdGEgYW5kIHJldHVybktleVZhbHVlc1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXN0QnlBcnJheS5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ciAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGN1ciAhPT0gJ2Z1bmN0aW9uJyApIHsgdGhyb3cgJ2VhY2ggbmVzdEJ5IGl0ZW0gbXVzdCBiZSBhIHN0cmluZyBvciBmdW5jdGlvbic7IH1cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJ0bjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnc3RyaW5nJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZFtjdXJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7ICAgIFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ2Z1bmN0aW9uJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VyKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJ0bjtcbiAgICAgICAgICAgICAgICB9LCBkMy5uZXN0KCkpO1xuICAgICAgICAgICAgfSwgICAgICAgXG4gICAgICAgICAgICByZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBuZXN0QnksIGNvZXJjZSA9IGZhbHNlLCBuZXN0VHlwZSA9ICdzZXJpZXMnLCB0YWJJbmRleCA9IDApe1xuICAgICAgICAgICAgLy8gdGhpcyBmbiB0YWtlcyBub3JtYWxpemVkIGRhdGEgZmV0Y2hlZCBhcyBhbiBhcnJheSBvZiByb3dzIGFuZCB1c2VzIHRoZSB2YWx1ZXMgaW4gdGhlIGZpcnN0IHJvdyBhcyBrZXlzIGZvciB2YWx1ZXMgaW5cbiAgICAgICAgICAgIC8vIHN1YnNlcXVlbnQgcm93c1xuICAgICAgICAgICAgLy8gbmVzdEJ5ID0gc3RyaW5nIG9yIGFycmF5IG9mIGZpZWxkKHMpIHRvIG5lc3QgYnksIG9yIGEgY3VzdG9tIGZ1bmN0aW9uLCBvciBhbiBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucztcbiAgICAgICAgICAgIC8vIGNvZXJjZSA9IEJPT0wgY29lcmNlIHRvIG51bSBvciBub3Q7IG5lc3RUeXBlID0gb2JqZWN0IG9yIHNlcmllcyBuZXN0IChkMylcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgcHJlbGltO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciB1bm5lc3RlZCA9IHZhbHVlcy5zbGljZSgxKS5tYXAocm93ID0+IHJvdy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIsIGkpIHsgXG4gICAgICAgICAgICAgICAgLy8gMS4gcGFyYW1zOiB0b3RhbCwgY3VycmVudFZhbHVlLCBjdXJyZW50SW5kZXhbLCBhcnJdXG4gICAgICAgICAgICAgICAgLy8gMy4gLy8gYWNjIGlzIGFuIG9iamVjdCAsIGtleSBpcyBjb3JyZXNwb25kaW5nIHZhbHVlIGZyb20gcm93IDAsIHZhbHVlIGlzIGN1cnJlbnQgdmFsdWUgb2YgYXJyYXlcbiAgICAgICAgICAgICAgICAgIGFjY1t2YWx1ZXNbMF1baV1dID0gY29lcmNlID09PSB0cnVlID8gaXNOYU4oK2N1cikgfHwgY3VyID09PSAnJyA/IGN1ciA6ICtjdXIgOiBjdXI7IFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0IGZvciBlbXB0eSBzdHJpbmdzIGJlZm9yZSBjb2VyY2luZyBiYyArJycgPT4gMFxuICAgICAgICAgICAgICAgIH0sIHt9KSk7XG4gICAgICAgICAgICAgICAgaWYgKCB0YWJJbmRleCA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51bm5lc3RlZCA9IHVubmVzdGVkO1xuICAgICAgICAgICAgICAgIH0gICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICggIW5lc3RCeSApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgbmVzdEJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbmVzdEJ5ID09PSAnZnVuY3Rpb24nICkgeyAvLyBpZSBvbmx5IG9uZSBuZXN0QnkgZmllbGQgb3IgZnVuY2l0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IHRoaXMubmVzdFByZWxpbShbbmVzdEJ5XSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkobmVzdEJ5KSkgeyB0aHJvdyAnbmVzdEJ5IHZhcmlhYmxlIG11c3QgYmUgYSBzdHJpbmcsIGZ1bmN0aW9uLCBvciBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucyc7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IHRoaXMubmVzdFByZWxpbShuZXN0QnkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICggbmVzdFR5cGUgPT09ICdvYmplY3QnICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRyaWVzKHVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5pdGlhbGl6ZUNoYXJ0cyhjb250YWluZXIpe1xuICAgICAgICAgICAgICAgIHZhciBncm91cCA9IHRoaXM7XG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KGNvbnRhaW5lcikuc2VsZWN0QWxsKCcuZDMtY2hhcnQnKVxuICAgICAgICAgICAgICAgICAgICAuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgZ3JvdXAuY2hpbGRyZW4ucHVzaChuZXcgQ2hhcnRzLkNoYXJ0RGl2KHRoaXMsIGdyb3VwKSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSAgICAgICAgXG4gICAgfTsgLy8gRDNDaGFydEdyb3VwIHByb3RvdHlwZSBlbmRzIGhlcmVcbiAgICBcbiAgICB3aW5kb3cuRDNDaGFydHMgPSB7IC8vIG5lZWQgdG8gc3BlY2lmeSB3aW5kb3cgYmMgYWZ0ZXIgdHJhbnNwaWxpbmcgYWxsIHRoaXMgd2lsbCBiZSB3cmFwcGVkIGluIElJRkVzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgYHJldHVybmBpbmcgd29uJ3QgZ2V0IHRoZSBleHBvcnQgaW50byB3aW5kb3cncyBnbG9iYWwgc2NvcGVcbiAgICAgICAgSW5pdCgpe1xuICAgICAgICAgICAgdmFyIGdyb3VwRGl2cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5kMy1ncm91cCcpO1xuICAgICAgICAgICAgZm9yICggbGV0IGkgPSAwOyBpIDwgZ3JvdXBEaXZzLmxlbmd0aDsgaSsrICl7XG4gICAgICAgICAgICAgICAgZ3JvdXBDb2xsZWN0aW9uLnB1c2gobmV3IEQzQ2hhcnRHcm91cChncm91cERpdnNbaV0sIGkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgfTtcbn0oKSk7IC8vIGVuZCB2YXIgRDNDaGFydHMgSUlGRSIsImV4cG9ydCBjb25zdCBDaGFydHMgPSAoZnVuY3Rpb24oKXtcblxuICAgIHZhciBDaGFydERpdiA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgcGFyZW50KXtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gW107XG4gICAgICAgIHRoaXMuc2VyaWVzQ291bnQgPSAwO1xuICAgICAgICB0aGlzLmNvbmZpZyA9IE9iamVjdC5jcmVhdGUoIHBhcmVudC5jb25maWcsIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKCBjb250YWluZXIuZGF0YXNldC5jb252ZXJ0KCkgKSApO1xuICAgICAgICAgICAgLy8gbGluZSBhYm92ZSBjcmVhdGVzIGEgY29uZmlnIG9iamVjdCBmcm9tIHRoZSBIVE1MIGRhdGFzZXQgZm9yIHRoZSBjaGFydERpdiBjb250YWluZXJcbiAgICAgICAgICAgIC8vIHRoYXQgaW5oZXJpdHMgZnJvbSB0aGUgcGFyZW50cyBjb25maWcgb2JqZWN0LiBhbnkgY29uZmlncyBub3Qgc3BlY2lmaWVkIGZvciB0aGUgY2hhcnREaXYgKGFuIG93biBwcm9wZXJ0eSlcbiAgICAgICAgICAgIC8vIHdpbGwgY29tZSBmcm9tIHVwIHRoZSBpbmhlcml0YW5jZSBjaGFpblxuICAgICAgICB0aGlzLmRhdHVtID0gcGFyZW50LmRhdGEuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSB0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgIHZhciBzZXJpZXNJbnN0cnVjdCA9IHRoaXMuY29uZmlnLnNlcmllcyB8fCAnYWxsJztcbiAgICAgICAgXG4gICAgICAgIGlmICggQXJyYXkuaXNBcnJheShzZXJpZXNJbnN0cnVjdCkgKXtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5kYXR1bS52YWx1ZXMgPSB0aGlzLmRhdHVtLnZhbHVlcy5maWx0ZXIoZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlcmllc0luc3RydWN0LmluZGV4T2YoZWFjaC5rZXkpICE9PSAtMTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKCBzZXJpZXNJbnN0cnVjdCAhPT0gJ2FsbCcgKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBJbnZhbGlkIGluc3RydWN0aW9uIGZyb20gSFRNTCBmb3Igd2hpY2ggY2F0ZWdvcmllcyB0byBpbmNsdWRlIFxuICAgICAgICAgICAgICAgICAgICAodmFyIHNlcmllc0luc3RydWN0KS4gRmFsbGJhY2sgdG8gYWxsLmApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2VyaWVzR3JvdXBzID0gdGhpcy5ncm91cFNlcmllcygpO1xuICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB0aGlzLnBhcmVudC5kaWN0aW9uYXJ5O1xuICAgICAgICBpZiAoIHRoaXMuY29uZmlnLmhlYWRpbmcgIT09IGZhbHNlICl7XG4gICAgICAgICAgICB0aGlzLmFkZEhlYWRpbmcodGhpcy5jb25maWcuaGVhZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jcmVhdGVDaGFydHMoKTtcblxuICAgIH07XG4gICAgXG4gICAgQ2hhcnREaXYucHJvdG90eXBlID0ge1xuICAgICAgICBjaGFydFR5cGVzOiB7XG4gICAgICAgICAgICBsaW5lOiAgICdMaW5lQ2hhcnQnLFxuICAgICAgICAgICAgY29sdW1uOiAnQ29sdW1uQ2hhcnQnLFxuICAgICAgICAgICAgYmFyOiAgICAnQmFyQ2hhcnQnIC8vIHNvIG9uIC4gLiAuXG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZUNoYXJ0cygpe1xuICAgICAgICAgICAgdGhpcy5zZXJpZXNHcm91cHMuZm9yRWFjaCgoZWFjaCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChuZXcgTGluZUNoYXJ0KHRoaXMsIGVhY2gpKTsgLy8gVE8gRE8gZGlzdGluZ3Vpc2ggY2hhcnQgdHlwZXMgaGVyZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGdyb3VwU2VyaWVzKCl7XG4gICAgICAgICAgICB2YXIgc2VyaWVzR3JvdXBzLFxuICAgICAgICAgICAgICAgIGdyb3Vwc0luc3RydWN0ID0gdGhpcy5jb25maWcuc2VyaWVzR3JvdXAgfHwgJ25vbmUnO1xuICAgICAgICAgICAgaWYgKCBBcnJheS5pc0FycmF5KCBncm91cHNJbnN0cnVjdCApICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFtdO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLnNlcmllc0dyb3VwLmZvckVhY2goZ3JvdXAgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMucHVzaCh0aGlzLmRhdHVtLnZhbHVlcy5maWx0ZXIoc2VyaWVzID0+IGdyb3VwLmluZGV4T2Yoc2VyaWVzLmtleSkgIT09IC0xKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBncm91cHNJbnN0cnVjdCA9PT0gJ25vbmUnICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IHRoaXMuZGF0dW0udmFsdWVzLm1hcChlYWNoID0+IFtlYWNoXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBncm91cHNJbnN0cnVjdCA9PT0gJ2FsbCcgKSB7XG4gICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW3RoaXMuZGF0dW0udmFsdWVzLm1hcChlYWNoID0+IGVhY2gpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEludmFsaWQgZGF0YS1ncm91cC1zZXJpZXMgaW5zdHJ1Y3Rpb24gZnJvbSBodG1sLiBcbiAgICAgICAgICAgICAgICAgICAgICAgTXVzdCBiZSB2YWxpZCBKU09OOiBcIk5vbmVcIiBvciBcIkFsbFwiIG9yIGFuIGFycmF5XG4gICAgICAgICAgICAgICAgICAgICAgIG9mIGFycmF5cyBjb250YWluaW5nIHRoZSBzZXJpZXMgdG8gYmUgZ3JvdXBlZFxuICAgICAgICAgICAgICAgICAgICAgICB0b2dldGhlci4gQWxsIHN0cmluZ3MgbXVzdCBiZSBkb3VibGUtcXVvdGVkLmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNlcmllc0dyb3VwcztcbiAgICAgICAgfSwgLy8gZW5kIGdyb3VwU2VyaWVzKClcbiAgICAgICAgYWRkSGVhZGluZyhpbnB1dCl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzLmNvbnRhaW5lcilcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdwJylcbiAgICAgICAgICAgICAgICAuaHRtbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBoZWFkaW5nID0gdHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJyA/IGlucHV0IDogdGhpcy5sYWJlbCh0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nICsgaGVhZGluZyArICc8L3N0cm9uZz4nO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBsYWJlbChrZXkpe1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkubGFiZWw7XG4gICAgICAgIH0sXG4gICAgICAgIHVuaXRzKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS51bml0czsgIFxuICAgICAgICB9LFxuICAgICAgICB0aXBUZXh0KGtleSl7XG4gICAgICAgICAgICB2YXIgc3RyID0gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbC5yZXBsYWNlKC9cXFxcbi9nLCcgJyk7XG4gICAgICAgICAgICByZXR1cm4gc3RyLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgc3RyLnNsaWNlKDEpO1xuICAgICAgICB9XG5cbiAgICB9OyAvLyBlbmQgTGluZUNoYXJ0LnByb3RvdHlwZVxuXG4gICAgdmFyIExpbmVDaGFydCA9IGZ1bmN0aW9uKHBhcmVudCwgc2VyaWVzR3JvdXApe1xuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBwYXJlbnQuY29uZmlnO1xuICAgICAgICB0aGlzLm1hcmdpblRvcCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5Ub3AgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy50b3A7XG4gICAgICAgIHRoaXMubWFyZ2luUmlnaHQgPSArdGhpcy5jb25maWcubWFyZ2luUmlnaHQgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5yaWdodDtcbiAgICAgICAgdGhpcy5tYXJnaW5Cb3R0b20gPSArdGhpcy5jb25maWcubWFyZ2luQm90dG9tIHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMuYm90dG9tO1xuICAgICAgICB0aGlzLm1hcmdpbkxlZnQgPSArdGhpcy5jb25maWcubWFyZ2luTGVmdCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLmxlZnQ7XG4gICAgICAgIHRoaXMud2lkdGggPSB0aGlzLmNvbmZpZy5zdmdXaWR0aCA/ICt0aGlzLmNvbmZpZy5zdmdXaWR0aCAtIHRoaXMubWFyZ2luUmlnaHQgLSB0aGlzLm1hcmdpbkxlZnQgOiAzMjAgLSB0aGlzLm1hcmdpblJpZ2h0IC0gdGhpcy5tYXJnaW5MZWZ0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IHRoaXMuY29uZmlnLnN2Z0hlaWdodCA/ICt0aGlzLmNvbmZpZy5zdmdIZWlnaHQgLSB0aGlzLm1hcmdpblRvcCAtIHRoaXMubWFyZ2luQm90dG9tIDogKCB0aGlzLndpZHRoICsgdGhpcy5tYXJnaW5SaWdodCArIHRoaXMubWFyZ2luTGVmdCApIC8gMiAtIHRoaXMubWFyZ2luVG9wIC0gdGhpcy5tYXJnaW5Cb3R0b207XG4gICAgICAgIHRoaXMuZGF0YSA9IHNlcmllc0dyb3VwO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSB0aGlzLmluaXQocGFyZW50LmNvbnRhaW5lcik7IC8vIFRPIERPICB0aGlzIGlzIGtpbmRhIHdlaXJkXG4gICAgICAgIHRoaXMueFNjYWxlVHlwZSA9IHRoaXMuY29uZmlnLnhTY2FsZVR5cGUgfHwgJ3RpbWUnO1xuICAgICAgICB0aGlzLnlTY2FsZVR5cGUgPSB0aGlzLmNvbmZpZy55U2NhbGVUeXBlIHx8ICdsaW5lYXInO1xuICAgICAgICB0aGlzLnhUaW1lVHlwZSA9IHRoaXMuY29uZmlnLnhUaW1lVHlwZSB8fCAnJVknO1xuICAgICAgICB0aGlzLnNjYWxlQnkgPSB0aGlzLmNvbmZpZy5zY2FsZUJ5IHx8ICdzZXJpZXMtZ3JvdXAnO1xuICAgICAgICB0aGlzLnNldFNjYWxlcygpOyAvLyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgXG4gICAgICAgIHRoaXMuc2V0VG9vbHRpcHMoKTtcbiAgICAgICAgdGhpcy5hZGRMaW5lcygpO1xuICAgICAgLy8gIHRoaXMuYWRkUG9pbnRzKCk7XG4gICAgICAgIHRoaXMuYWRkWEF4aXMoKTtcbiAgICAgICAgdGhpcy5hZGRZQXhpcygpO1xuICAgICAgICBpZiAoIHRoaXMuY29uZmlnLmRpcmVjdExhYmVsID09PSB0cnVlICl7XG4gICAgICAgIC8vICAgIHRoaXMuYWRkTGFiZWxzKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB0aGlzLmFkZExlZ2VuZHMoKTtcbiAgICAgICAgfVxuICAgICAgICAgICAgICAgXG4gICAgfTtcblxuICAgIExpbmVDaGFydC5wcm90b3R5cGUgPSB7IC8vIGVhY2ggTGluZUNoYXJ0IGlzIGFuIHN2ZyB0aGF0IGhvbGQgZ3JvdXBlZCBzZXJpZXNcbiAgICAgICAgZGVmYXVsdE1hcmdpbnM6IHtcbiAgICAgICAgICAgIHRvcDoyMCxcbiAgICAgICAgICAgIHJpZ2h0OjQ1LFxuICAgICAgICAgICAgYm90dG9tOjI1LFxuICAgICAgICAgICAgbGVmdDozNVxuICAgICAgICB9LFxuICAgICAgICAgICAgICBcbiAgICAgICAgaW5pdChjaGFydERpdil7IC8vIC8vU0hPVUxEIEJFIElOIENIQVJUIFBST1RPVFlQRSB0aGlzIGlzIGNhbGxlZCBvbmNlIGZvciBlYWNoIHNlcmllc0dyb3VwIG9mIGVhY2ggY2F0ZWdvcnkuIFxuICAgICAgICAgICAgdmFyIGNvbnRhaW5lciA9ICBkMy5zZWxlY3QoY2hhcnREaXYpXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgnc3ZnJylcbiAgICAgICAgICAgICAgICAuYXR0cignd2lkdGgnLCB0aGlzLndpZHRoICsgdGhpcy5tYXJnaW5SaWdodCArIHRoaXMubWFyZ2luTGVmdCApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2hlaWdodCcsIHRoaXMuaGVpZ2h0ICArIHRoaXMubWFyZ2luVG9wICsgdGhpcy5tYXJnaW5Cb3R0b20gKTtcblxuICAgICAgICAgICAgdGhpcy5zdmcgPSBjb250YWluZXIuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJyxgdHJhbnNsYXRlKCR7dGhpcy5tYXJnaW5MZWZ0fSwgJHt0aGlzLm1hcmdpblRvcH0pYCk7XG5cbiAgICAgICAgICAgIHRoaXMueEF4aXNHcm91cCA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICB0aGlzLnlBeGlzR3JvdXAgPSB0aGlzLnN2Zy5hcHBlbmQoJ2cnKTtcblxuICAgICAgICAgICAgdGhpcy5lYWNoU2VyaWVzID0gdGhpcy5zdmcuc2VsZWN0QWxsKCdlYWNoLXNlcmllcycpXG4gICAgICAgICAgICAgICAgLmRhdGEodGhpcy5kYXRhKVxuICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2VhY2gtc2VyaWVzIHNlcmllcy0nICsgdGhpcy5wYXJlbnQuc2VyaWVzQ291bnQgKyAnIGNvbG9yLScgKyB0aGlzLnBhcmVudC5zZXJpZXNDb3VudCsrICUgNDtcbiAgICAgICAgICAgICAgICB9KTtcbi8qXG4gICAgICAgICAgICB0aGlzLmVhY2hTZXJpZXMuZWFjaCgoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnQuc2VyaWVzQXJyYXkucHVzaChhcnJheVtpXSk7XG4gICAgICAgICAgICB9KTsqL1xuICAgICAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy5zdGFja1NlcmllcyAmJiB0aGlzLmNvbmZpZy5zdGFja1NlcmllcyA9PT0gdHJ1ZSApe1xuICAgICAgICAgICAgICAgIHRoaXMucHJlcGFyZVN0YWNraW5nKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb250YWluZXIubm9kZSgpO1xuICAgICAgICB9LFxuICAgICAgICBwcmVwYXJlU3RhY2tpbmcoKXtcbiAgICAgICAgICAgIHZhciBmb3JTdGFja2luZyA9IHRoaXMuZGF0YS5yZWR1Y2UoKGFjYyxjdXIsaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBpID09PSAwICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXIudmFsdWVzLmZvckVhY2goZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNjLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbdGhpcy5jb25maWcudmFyaWFibGVYXTogZWFjaFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbY3VyLmtleV06IGVhY2hbdGhpcy5jb25maWcudmFyaWFibGVZXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXIudmFsdWVzLmZvckVhY2goZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNjLmZpbmQob2JqID0+IG9ialt0aGlzLmNvbmZpZy52YXJpYWJsZVhdID09PSBlYWNoW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pW2N1ci5rZXldID0gZWFjaFt0aGlzLmNvbmZpZy52YXJpYWJsZVldO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgICAgICAgICB9LFtdKTtcblxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuc3RhY2sgPSBkMy5zdGFjaygpXG4gICAgICAgICAgICAgICAgICAgIC5rZXlzKHRoaXMuZGF0YS5tYXAoZWFjaCA9PiBlYWNoLmtleSkpXG4gICAgICAgICAgICAgICAgICAgIC5vcmRlcihkMy5zdGFja09yZGVyTm9uZSlcbiAgICAgICAgICAgICAgICAgICAgLm9mZnNldChkMy5zdGFja09mZnNldE5vbmUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuc3RhY2tEYXRhID0gdGhpcy5zdGFjayhmb3JTdGFja2luZyk7XG4gICAgICAgIH0sXG4gICAgICAgIHNldFNjYWxlcygpeyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgLy8gVE8gRE86IFNFVCBTQ0FMRVMgRk9SIE9USEVSIEdST1VQIFRZUEVTXG5cbiAgICAgICAgICAgIHZhciBkM1NjYWxlID0ge1xuICAgICAgICAgICAgICAgIHRpbWU6IGQzLnNjYWxlVGltZSgpLFxuICAgICAgICAgICAgICAgIGxpbmVhcjogZDMuc2NhbGVMaW5lYXIoKVxuICAgICAgICAgICAgICAgIC8vIFRPIERPOiBhZGQgYWxsIHNjYWxlIHR5cGVzLlxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHZhciB4TWF4ZXMgPSBbXSwgeE1pbnMgPSBbXSwgeU1heGVzID0gW10sIHlNaW5zID0gW107XG4gICAgICAgICAgICBpZiAoIHRoaXMuc2NhbGVCeSA9PT0gJ3Nlcmllcy1ncm91cCcgKXtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHhNYXhlcy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt0aGlzLmNvbmZpZy52YXJpYWJsZVhdLm1heCk7XG4gICAgICAgICAgICAgICAgICAgIHhNaW5zLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0ubWluKTtcbiAgICAgICAgICAgICAgICAgICAgeU1heGVzLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0ubWF4KTtcbiAgICAgICAgICAgICAgICAgICAgeU1pbnMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1bdGhpcy5jb25maWcudmFyaWFibGVZXS5taW4pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy54TWF4ID0gZDMubWF4KHhNYXhlcyk7XG4gICAgICAgICAgICB0aGlzLnhNaW4gPSBkMy5taW4oeE1pbnMpO1xuICAgICAgICAgICAgdGhpcy55TWF4ID0gZDMubWF4KHlNYXhlcyk7XG4gICAgICAgICAgICB0aGlzLnlNaW4gPSBkMy5taW4oeU1pbnMpO1xuICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlID0gW107XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgJiYgdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgPT09IHRydWUgKXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzLnN0YWNrRGF0YSk7XG4gICAgICAgICAgICAgICAgdmFyIHlWYWx1ZXMgPSB0aGlzLnN0YWNrRGF0YS5yZWR1Y2UoKGFjYywgY3VyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGN1cik7XG4gICAgICAgICAgICAgICAgICAgIGFjYy5wdXNoKC4uLmN1ci5yZWR1Y2UoKGFjYzEsIGN1cjEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjYzEucHVzaChjdXIxWzBdLCBjdXIxWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2MxO1xuICAgICAgICAgICAgICAgICAgICB9LFtdKSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgfSxbXSk7XG4gICAgICAgICAgICAgICAgdGhpcy55TWF4ID0gZDMubWF4KHlWYWx1ZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMueU1pbiA9IGQzLm1pbih5VmFsdWVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB4UmFuZ2UgPSBbMCwgdGhpcy53aWR0aF0sXG4gICAgICAgICAgICAgICAgeVJhbmdlID0gW3RoaXMuaGVpZ2h0LCAwXSxcbiAgICAgICAgICAgICAgICB4RG9tYWluLFxuICAgICAgICAgICAgICAgIHlEb21haW47XG4gICAgICAgICAgICBpZiAoIHRoaXMueFNjYWxlVHlwZSA9PT0gJ3RpbWUnKSB7XG4gICAgICAgICAgICAgICAgeERvbWFpbiA9IFtkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKHRoaXMueE1pbiksIGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkodGhpcy54TWF4KV07XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBUTyBETzogT1RIRVIgZGF0YSB0eXBlcyA/XG4gICAgICAgICAgICAgICAgeERvbWFpbiA9IFt0aGlzLnhNaW4sIHRoaXMueE1heF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIHRoaXMueVNjYWxlVHlwZSA9PT0gJ3RpbWUnKSB7XG4gICAgICAgICAgICAgICAgeURvbWFpbiA9IFtkMy50aW1lUGFyc2UodGhpcy55VGltZVR5cGUpKHRoaXMueU1pbiksIGQzLnRpbWVQYXJzZSh0aGlzLnlUaW1lVHlwZSkodGhpcy55TWF4KV07XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBUTyBETzogT1RIRVIgZGF0YSB0eXBlcyA/XG4gICAgICAgICAgICAgICAgeURvbWFpbiA9IFt0aGlzLnlNaW4sIHRoaXMueU1heF07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMueFNjYWxlID0gZDNTY2FsZVt0aGlzLnhTY2FsZVR5cGVdLmRvbWFpbih4RG9tYWluKS5yYW5nZSh4UmFuZ2UpO1xuICAgICAgICAgICAgdGhpcy55U2NhbGUgPSBkM1NjYWxlW3RoaXMueVNjYWxlVHlwZV0uZG9tYWluKHlEb21haW4pLnJhbmdlKHlSYW5nZSk7XG5cblxuICAgICAgICB9LFxuICAgICAgICBhZGRMaW5lcygpe1xuICAgICAgICAgICAgdmFyIHplcm9WYWx1ZWxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAueChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnhWYWx1ZXNVbmlxdWUuaW5kZXhPZihkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pID09PSAtMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlLnB1c2goZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKTtcbiAgICAgICAgICAgICAgICB9KSBcbiAgICAgICAgICAgICAgICAueSgoKSA9PiB0aGlzLnlTY2FsZSgwKSk7XG5cbiAgICAgICAgICAgIHZhciB2YWx1ZWxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAueChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnhWYWx1ZXNVbmlxdWUuaW5kZXhPZihkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pID09PSAtMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlLnB1c2goZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKTtcbiAgICAgICAgICAgICAgICB9KSBcbiAgICAgICAgICAgICAgICAueSgoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueVNjYWxlKGRbdGhpcy5jb25maWcudmFyaWFibGVZXSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICggdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgJiYgdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgPT09IHRydWUgKXtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgYXJlYSA9IGQzLmFyZWEoKVxuICAgICAgICAgICAgICAgICAgICAueChkID0+IHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZC5kYXRhW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKSlcbiAgICAgICAgICAgICAgICAgICAgLnkwKGQgPT4gdGhpcy55U2NhbGUoZFswXSkpXG4gICAgICAgICAgICAgICAgICAgIC55MShkID0+IHRoaXMueVNjYWxlKGRbMV0pKTtcblxuICAgICAgICAgICAgICAgIHZhciBsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgICAgIC54KGQgPT4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkLmRhdGFbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgICAgICAueShkID0+IHRoaXMueVNjYWxlKGRbMV0pKTtcblxuICAgICAgICAgICAgICAgIHZhciBzdGFja0dyb3VwID0gdGhpcy5zdmcuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3N0YWNrZWQtYXJlYScpO1xuICAgICAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgICAgIHN0YWNrR3JvdXAgICAgXG4gICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3N0YWNrZWQtYXJlYScpXG4gICAgICAgICAgICAgICAgICAgIC5kYXRhKHRoaXMuc3RhY2tEYXRhKVxuICAgICAgICAgICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ3BhdGgnKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoZCxpKSA9PiAnYXJlYS1saW5lIGNvbG9yLScgKyBpKSAvLyBUTyBETyBub3QgcXVpdGUgcmlnaHQgdGhhdCBjb2xvciBzaG9sZCBiZSBgaWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiB5b3UgaGF2ZSBtb3JlIHRoYW4gb25lIGdyb3VwIG9mIHNlcmllcywgd2lsbCByZXBlYXRcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCBkID0+IGFyZWEoZCkpO1xuXG4gICAgICAgICAgICAgICAgc3RhY2tHcm91cFxuICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzdGFja2VkLWxpbmUnKVxuICAgICAgICAgICAgICAgICAgICAuZGF0YSh0aGlzLnN0YWNrRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKGQsaSkgPT4gJ2xpbmUgY29sb3ItJyArIGkpIFxuICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGQgPT4gbGluZShkKSk7XG5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5saW5lcyA9IHRoaXMuZWFjaFNlcmllcy5hcHBlbmQoJ3BhdGgnKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCdsaW5lJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCAoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHplcm9WYWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMCkuZGVsYXkoMTUwKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLm9uKCdlbmQnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGkgPT09IGFycmF5Lmxlbmd0aCAtIDEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZFBvaW50cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkTGFiZWxzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBhZGRYQXhpcygpeyAvLyBjb3VsZCBiZSBpbiBDaGFydCBwcm90b3R5cGUgP1xuICAgICAgICAgICAgdmFyIHhBeGlzUG9zaXRpb24sXG4gICAgICAgICAgICAgICAgeEF4aXNPZmZzZXQsXG4gICAgICAgICAgICAgICAgYXhpc1R5cGU7XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5jb25maWcueEF4aXNQb3NpdGlvbiA9PT0gJ3RvcCcgKXtcbiAgICAgICAgICAgICAgICB4QXhpc1Bvc2l0aW9uID0gdGhpcy55TWF4O1xuICAgICAgICAgICAgICAgIHhBeGlzT2Zmc2V0ID0gLXRoaXMubWFyZ2luVG9wO1xuICAgICAgICAgICAgICAgIGF4aXNUeXBlID0gZDMuYXhpc1RvcDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgeEF4aXNQb3NpdGlvbiA9IHRoaXMueU1pbjtcbiAgICAgICAgICAgICAgICB4QXhpc09mZnNldCA9IHRoaXMubWFyZ2luQm90dG9tIC0gMTU7XG4gICAgICAgICAgICAgICAgYXhpc1R5cGUgPSBkMy5heGlzQm90dG9tO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGF4aXMgPSBheGlzVHlwZSh0aGlzLnhTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnhTY2FsZVR5cGUgPT09ICd0aW1lJyApe1xuICAgICAgICAgICAgICAgIGF4aXMudGlja1ZhbHVlcyh0aGlzLnhWYWx1ZXNVbmlxdWUubWFwKGVhY2ggPT4gZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShlYWNoKSkpOyAvLyBUTyBETzogYWxsb3cgZm9yIG90aGVyIHhBeGlzIEFkanVzdG1lbnRzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnhBeGlzR3JvdXBcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLCcgKyAoIHRoaXMueVNjYWxlKHhBeGlzUG9zaXRpb24pICsgeEF4aXNPZmZzZXQgKSArICcpJykgLy8gbm90IHByb2dyYW1hdGljIHBsYWNlbWVudCBvZiB4LWF4aXNcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgIC5jYWxsKGF4aXMpO1xuICAgICAgICB9LFxuICAgICAgICBhZGRZQXhpcygpe1xuICAgICAgICAgICAgLyogYXhpcyAqL1xuICAgICAgICAgICAgdGhpcy55QXhpc0dyb3VwXG4gICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+ICdheGlzIHktYXhpcyAnKVxuICAgICAgICAgICAgICAuY2FsbChkMy5heGlzTGVmdCh0aGlzLnlTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDUpKTtcblxuICAgICAgICAgICAgaWYgKCB0aGlzLnlNaW4gPCAwICkge1xuICAgICAgICAgICAgICAgIHRoaXMueUF4aXNHcm91cFxuICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCcudGljaycpXG4gICAgICAgICAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uKGQsaSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ3plcm8nLCBkID09PSAwICYmIGkgIT09IDApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAvKiBsYWJlbHMgKi9cbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcy5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAndW5pdHMnKVxuICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKCkgPT4gYHRyYW5zbGF0ZSgtJHt0aGlzLm1hcmdpbkxlZnR9LC0ke3RoaXMubWFyZ2luVG9wIC0gMTB9KWApXG4gICAgICAgICAgICAgIC50ZXh0KChkLGkpID0+IGkgPT09IDAgPyB0aGlzLnBhcmVudC51bml0cyhkLmtleSkgOiBudWxsKTtcbiAgICAgICAgICAgIFxuICAgICAgICB9LFxuICAgICAgICBhZGRMYWJlbHMoKXtcbiAgICAgICAgICAgIHRoaXMubGFiZWxzID0gdGhpcy5lYWNoU2VyaWVzXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIChkKSA9PiBgdHJhbnNsYXRlKCR7dGhpcy53aWR0aCArIDV9LCAke3RoaXMueVNjYWxlKGQudmFsdWVzW2QudmFsdWVzLmxlbmd0aCAtIDFdW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pICsgM30pYClcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgICAgICAgICAuYXR0cigneScsIDApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3Nlcmllcy1sYWJlbCcpXG4gICAgICAgICAgICAgICAgLmh0bWwoKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICc8dHNwYW4geD1cIjBcIj4nICsgdGhpcy5wYXJlbnQubGFiZWwoZC5rZXkpLnJlcGxhY2UoL1xcXFxuL2csJzwvdHNwYW4+PHRzcGFuIHg9XCIwXCIgZHk9XCIxLjJlbVwiPicpICsgJzwvdHNwYW4+JztcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgXG4gICAgICAgICAgICByZWxheC5jYWxsKHRoaXMpO1xuICAgICAgICAgICBcblxuICAgICAgICAgICAgZnVuY3Rpb24gcmVsYXgoKXtcbiAgICAgICAgICAgICAgICB2YXIgYWxwaGEgPSAwLjUsXG4gICAgICAgICAgICAgICAgICAgIHNwYWNpbmcgPSAwLFxuICAgICAgICAgICAgICAgICAgICBhZ2FpbiA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5sYWJlbHMuZWFjaCgoZCxpLGFycmF5MSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYSA9IGFycmF5MVtpXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICRhID0gZDMuc2VsZWN0KGEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgeUEgPSAkYS5hdHRyKCd5JyksXG4gICAgICAgICAgICAgICAgICAgICAgICBhUmFuZ2UgPSBkMy5yYW5nZShNYXRoLnJvdW5kKGEuZ2V0Q1RNKCkuZikgLSBzcGFjaW5nICsgcGFyc2VJbnQoeUEpLCBNYXRoLnJvdW5kKGEuZ2V0Q1RNKCkuZikgKyBNYXRoLnJvdW5kKGEuZ2V0QkJveCgpLmhlaWdodCkgKyAxICsgc3BhY2luZyArIHBhcnNlSW50KHlBKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sYWJlbHMuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGIgPSB0aGlzLFxuICAgICAgICAgICAgICAgICAgICAgICAgJGIgPSBkMy5zZWxlY3QoYiksXG4gICAgICAgICAgICAgICAgICAgICAgICB5QiA9ICRiLmF0dHIoJ3knKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggYSA9PT0gYiApIHtyZXR1cm47fVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGJMaW1pdHMgPSBbTWF0aC5yb3VuZChiLmdldENUTSgpLmYpIC0gc3BhY2luZyArIHBhcnNlSW50KHlCKSwgTWF0aC5yb3VuZChiLmdldENUTSgpLmYpICsgYi5nZXRCQm94KCkuaGVpZ2h0ICsgc3BhY2luZyArIHBhcnNlSW50KHlCKV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIChhUmFuZ2VbMF0gPCBiTGltaXRzWzBdICYmIGFSYW5nZVthUmFuZ2UubGVuZ3RoIC0gMV0gPCBiTGltaXRzWzBdKSB8fCAoYVJhbmdlWzBdID4gYkxpbWl0c1sxXSAmJiBhUmFuZ2VbYVJhbmdlLmxlbmd0aCAtIDFdID4gYkxpbWl0c1sxXSkgKXtyZXR1cm47fSAvLyBubyBjb2xsaXNvblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNpZ24gPSBiTGltaXRzWzBdIC0gYVJhbmdlW2FSYW5nZS5sZW5ndGggLSAxXSA8PSBhUmFuZ2VbMF0gLSBiTGltaXRzWzFdID8gMSA6IC0xLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkanVzdCA9IHNpZ24gKiBhbHBoYTtcbiAgICAgICAgICAgICAgICAgICAgICAgICRiLmF0dHIoJ3knLCAoK3lCIC0gYWRqdXN0KSApO1xuICAgICAgICAgICAgICAgICAgICAgICAgJGEuYXR0cigneScsICgreUEgKyBhZGp1c3QpICk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhZ2FpbiA9IHRydWU7IFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBpID09PSBhcnJheTEubGVuZ3RoIC0gMSAmJiBhZ2FpbiA9PT0gdHJ1ZSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF4LmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LDIwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBhZGRQb2ludHMoKXtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5wb2ludHMgPSB0aGlzLmVhY2hTZXJpZXMuc2VsZWN0QWxsKCdwb2ludHMnKVxuICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4gZC52YWx1ZXMpXG4gICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdjaXJjbGUnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdvcGFjaXR5JywgMClcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnZGF0YS1wb2ludCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3InLCAnNCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2N4JywgZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjeScsIGQgPT4gdGhpcy55U2NhbGUoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVldKSlcbiAgICAgICAgICAgICAgICAub24oJ21vdXNlb3ZlcicsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHZhciBrbGFzcyA9IGFycmF5W2ldLnBhcmVudE5vZGUuY2xhc3NMaXN0LnZhbHVlLm1hdGNoKC9jb2xvci1cXGQvKVswXTsgLy8gZ2V0IHRoZSBjb2xvciBjbGFzcyBvZiB0aGUgcGFyZW50IGdcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJywgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJykgKyAnICcgKyBrbGFzcyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5odG1sKCc8c3Ryb25nPicgKyB0aGlzLnBhcmVudC50aXBUZXh0KGQuc2VyaWVzKSArICc8L3N0cm9uZz4gKCcgKyBkLnllYXIgKyAnKTxiciAvPicgKyBkW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0gKyAnICcgKyB0aGlzLnBhcmVudC51bml0cyhkLnNlcmllcykgKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLnNob3coKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5vbignbW91c2VvdXQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycsIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycpLnJlcGxhY2UoLyBjb2xvci1cXGQvZywgJycpKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmh0bWwoJycpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuaGlkZSgpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhbGwodGhpcy50b29sdGlwKVxuICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdvcGFjaXR5JywgMSk7XG5cbiAgICAgICAgfSxcbiAgICAgICAgc2V0VG9vbHRpcHMoKXtcblxuICAgICAgICAgICAgdGhpcy50b29sdGlwID0gZDMudGlwKClcbiAgICAgICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwiZDMtdGlwXCIpXG4gICAgICAgICAgICAgICAgLmRpcmVjdGlvbignbicpXG4gICAgICAgICAgICAgICAgLm9mZnNldChbLTgsIDBdKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgfVxuICAgIH07XG5cblxuICAgIHJldHVybiB7XG4gICAgICAgIENoYXJ0RGl2XG4gICAgfTtcblxufSkoKTtcbiIsImV4cG9ydCBjb25zdCBIZWxwZXJzID0gKGZ1bmN0aW9uKCl7XG4gICAgLyogZ2xvYmFscyBET01TdHJpbmdNYXAgKi9cbiAgICBTdHJpbmcucHJvdG90eXBlLmNsZWFuU3RyaW5nID0gZnVuY3Rpb24oKSB7IC8vIGxvd2VyY2FzZSBhbmQgcmVtb3ZlIHB1bmN0dWF0aW9uIGFuZCByZXBsYWNlIHNwYWNlcyB3aXRoIGh5cGhlbnM7IGRlbGV0ZSBwdW5jdHVhdGlvblxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9bIFxcXFxcXC9dL2csJy0nKS5yZXBsYWNlKC9bJ1wi4oCd4oCZ4oCc4oCYLFxcLiFcXD87XFwoXFwpJl0vZywnJykudG9Mb3dlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgU3RyaW5nLnByb3RvdHlwZS5yZW1vdmVVbmRlcnNjb3JlcyA9IGZ1bmN0aW9uKCkgeyBcbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvXy9nLCcgJyk7XG4gICAgfTtcblxuICAgIERPTVN0cmluZ01hcC5wcm90b3R5cGUuY29udmVydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbmV3T2JqID0ge307XG4gICAgICAgIGZvciAoIHZhciBrZXkgaW4gdGhpcyApe1xuICAgICAgICAgICAgaWYgKHRoaXMuaGFzT3duUHJvcGVydHkoa2V5KSl7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbmV3T2JqW2tleV0gPSBKU09OLnBhcnNlKHRoaXNba2V5XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgICAgICBuZXdPYmpba2V5XSA9IHRoaXNba2V5XTsgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld09iajtcbiAgICB9O1xufSkoKTtcbiIsIi8vIGQzLnRpcFxuLy8gQ29weXJpZ2h0IChjKSAyMDEzIEp1c3RpbiBQYWxtZXJcbi8vIEVTNiAvIEQzIHY0IEFkYXB0aW9uIENvcHlyaWdodCAoYykgMjAxNiBDb25zdGFudGluIEdhdnJpbGV0ZVxuLy8gUmVtb3ZhbCBvZiBFUzYgZm9yIEQzIHY0IEFkYXB0aW9uIENvcHlyaWdodCAoYykgMjAxNiBEYXZpZCBHb3R6XG4vL1xuLy8gVG9vbHRpcHMgZm9yIGQzLmpzIFNWRyB2aXN1YWxpemF0aW9uc1xuXG5leHBvcnQgY29uc3QgZDNUaXAgPSAoZnVuY3Rpb24oKXtcbiAgZDMuZnVuY3RvciA9IGZ1bmN0aW9uIGZ1bmN0b3Iodikge1xuICAgIHJldHVybiB0eXBlb2YgdiA9PT0gXCJmdW5jdGlvblwiID8gdiA6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHY7XG4gICAgfTtcbiAgfTtcblxuICBkMy50aXAgPSBmdW5jdGlvbigpIHtcblxuICAgIHZhciBkaXJlY3Rpb24gPSBkM190aXBfZGlyZWN0aW9uLFxuICAgICAgICBvZmZzZXQgICAgPSBkM190aXBfb2Zmc2V0LFxuICAgICAgICBodG1sICAgICAgPSBkM190aXBfaHRtbCxcbiAgICAgICAgbm9kZSAgICAgID0gaW5pdE5vZGUoKSxcbiAgICAgICAgc3ZnICAgICAgID0gbnVsbCxcbiAgICAgICAgcG9pbnQgICAgID0gbnVsbCxcbiAgICAgICAgdGFyZ2V0ICAgID0gbnVsbFxuXG4gICAgZnVuY3Rpb24gdGlwKHZpcykge1xuICAgICAgc3ZnID0gZ2V0U1ZHTm9kZSh2aXMpXG4gICAgICBwb2ludCA9IHN2Zy5jcmVhdGVTVkdQb2ludCgpXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG5vZGUpXG4gICAgfVxuXG4gICAgLy8gUHVibGljIC0gc2hvdyB0aGUgdG9vbHRpcCBvbiB0aGUgc2NyZWVuXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGEgdGlwXG4gICAgdGlwLnNob3cgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxuICAgICAgaWYoYXJnc1thcmdzLmxlbmd0aCAtIDFdIGluc3RhbmNlb2YgU1ZHRWxlbWVudCkgdGFyZ2V0ID0gYXJncy5wb3AoKVxuXG4gICAgICB2YXIgY29udGVudCA9IGh0bWwuYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgcG9mZnNldCA9IG9mZnNldC5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBkaXIgICAgID0gZGlyZWN0aW9uLmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIG5vZGVsICAgPSBnZXROb2RlRWwoKSxcbiAgICAgICAgICBpICAgICAgID0gZGlyZWN0aW9ucy5sZW5ndGgsXG4gICAgICAgICAgY29vcmRzLFxuICAgICAgICAgIHNjcm9sbFRvcCAgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wIHx8IGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wLFxuICAgICAgICAgIHNjcm9sbExlZnQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdCB8fCBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnRcblxuICAgICAgbm9kZWwuaHRtbChjb250ZW50KVxuICAgICAgICAuc3R5bGUoJ3Bvc2l0aW9uJywgJ2Fic29sdXRlJylcbiAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywgMSlcbiAgICAgICAgLnN0eWxlKCdwb2ludGVyLWV2ZW50cycsICdhbGwnKVxuXG4gICAgICB3aGlsZShpLS0pIG5vZGVsLmNsYXNzZWQoZGlyZWN0aW9uc1tpXSwgZmFsc2UpXG4gICAgICBjb29yZHMgPSBkaXJlY3Rpb25fY2FsbGJhY2tzW2Rpcl0uYXBwbHkodGhpcylcbiAgICAgIG5vZGVsLmNsYXNzZWQoZGlyLCB0cnVlKVxuICAgICAgICAuc3R5bGUoJ3RvcCcsIChjb29yZHMudG9wICsgIHBvZmZzZXRbMF0pICsgc2Nyb2xsVG9wICsgJ3B4JylcbiAgICAgICAgLnN0eWxlKCdsZWZ0JywgKGNvb3Jkcy5sZWZ0ICsgcG9mZnNldFsxXSkgKyBzY3JvbGxMZWZ0ICsgJ3B4JylcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYyAtIGhpZGUgdGhlIHRvb2x0aXBcbiAgICAvL1xuICAgIC8vIFJldHVybnMgYSB0aXBcbiAgICB0aXAuaGlkZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG5vZGVsID0gZ2V0Tm9kZUVsKClcbiAgICAgIG5vZGVsXG4gICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDApXG4gICAgICAgIC5zdHlsZSgncG9pbnRlci1ldmVudHMnLCAnbm9uZScpXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBQcm94eSBhdHRyIGNhbGxzIHRvIHRoZSBkMyB0aXAgY29udGFpbmVyLiAgU2V0cyBvciBnZXRzIGF0dHJpYnV0ZSB2YWx1ZS5cbiAgICAvL1xuICAgIC8vIG4gLSBuYW1lIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAvLyB2IC0gdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3IgYXR0cmlidXRlIHZhbHVlXG4gICAgdGlwLmF0dHIgPSBmdW5jdGlvbihuLCB2KSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIgJiYgdHlwZW9mIG4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBnZXROb2RlRWwoKS5hdHRyKG4pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgYXJncyA9ICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgICAgIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUuYXR0ci5hcHBseShnZXROb2RlRWwoKSwgYXJncylcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogUHJveHkgc3R5bGUgY2FsbHMgdG8gdGhlIGQzIHRpcCBjb250YWluZXIuICBTZXRzIG9yIGdldHMgYSBzdHlsZSB2YWx1ZS5cbiAgICAvL1xuICAgIC8vIG4gLSBuYW1lIG9mIHRoZSBwcm9wZXJ0eVxuICAgIC8vIHYgLSB2YWx1ZSBvZiB0aGUgcHJvcGVydHlcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIHN0eWxlIHByb3BlcnR5IHZhbHVlXG4gICAgdGlwLnN0eWxlID0gZnVuY3Rpb24obiwgdikge1xuICAgICAgLy8gZGVidWdnZXI7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIgJiYgdHlwZW9mIG4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBnZXROb2RlRWwoKS5zdHlsZShuKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICBpZiAoYXJncy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICB2YXIgc3R5bGVzID0gYXJnc1swXTtcbiAgICAgICAgICBPYmplY3Qua2V5cyhzdHlsZXMpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5zdHlsZS5hcHBseShnZXROb2RlRWwoKSwgW2tleSwgc3R5bGVzW2tleV1dKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBTZXQgb3IgZ2V0IHRoZSBkaXJlY3Rpb24gb2YgdGhlIHRvb2x0aXBcbiAgICAvL1xuICAgIC8vIHYgLSBPbmUgb2Ygbihub3J0aCksIHMoc291dGgpLCBlKGVhc3QpLCBvciB3KHdlc3QpLCBudyhub3J0aHdlc3QpLFxuICAgIC8vICAgICBzdyhzb3V0aHdlc3QpLCBuZShub3J0aGVhc3QpIG9yIHNlKHNvdXRoZWFzdClcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIGRpcmVjdGlvblxuICAgIHRpcC5kaXJlY3Rpb24gPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkaXJlY3Rpb25cbiAgICAgIGRpcmVjdGlvbiA9IHYgPT0gbnVsbCA/IHYgOiBkMy5mdW5jdG9yKHYpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFNldHMgb3IgZ2V0cyB0aGUgb2Zmc2V0IG9mIHRoZSB0aXBcbiAgICAvL1xuICAgIC8vIHYgLSBBcnJheSBvZiBbeCwgeV0gb2Zmc2V0XG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIG9mZnNldCBvclxuICAgIHRpcC5vZmZzZXQgPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBvZmZzZXRcbiAgICAgIG9mZnNldCA9IHYgPT0gbnVsbCA/IHYgOiBkMy5mdW5jdG9yKHYpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IHNldHMgb3IgZ2V0cyB0aGUgaHRtbCB2YWx1ZSBvZiB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIFN0cmluZyB2YWx1ZSBvZiB0aGUgdGlwXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGh0bWwgdmFsdWUgb3IgdGlwXG4gICAgdGlwLmh0bWwgPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBodG1sXG4gICAgICBodG1sID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogZGVzdHJveXMgdGhlIHRvb2x0aXAgYW5kIHJlbW92ZXMgaXQgZnJvbSB0aGUgRE9NXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGEgdGlwXG4gICAgdGlwLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmKG5vZGUpIHtcbiAgICAgICAgZ2V0Tm9kZUVsKCkucmVtb3ZlKCk7XG4gICAgICAgIG5vZGUgPSBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRpcDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkM190aXBfZGlyZWN0aW9uKCkgeyByZXR1cm4gJ24nIH1cbiAgICBmdW5jdGlvbiBkM190aXBfb2Zmc2V0KCkgeyByZXR1cm4gWzAsIDBdIH1cbiAgICBmdW5jdGlvbiBkM190aXBfaHRtbCgpIHsgcmV0dXJuICcgJyB9XG5cbiAgICB2YXIgZGlyZWN0aW9uX2NhbGxiYWNrcyA9IHtcbiAgICAgIG46ICBkaXJlY3Rpb25fbixcbiAgICAgIHM6ICBkaXJlY3Rpb25fcyxcbiAgICAgIGU6ICBkaXJlY3Rpb25fZSxcbiAgICAgIHc6ICBkaXJlY3Rpb25fdyxcbiAgICAgIG53OiBkaXJlY3Rpb25fbncsXG4gICAgICBuZTogZGlyZWN0aW9uX25lLFxuICAgICAgc3c6IGRpcmVjdGlvbl9zdyxcbiAgICAgIHNlOiBkaXJlY3Rpb25fc2VcbiAgICB9O1xuXG4gICAgdmFyIGRpcmVjdGlvbnMgPSBPYmplY3Qua2V5cyhkaXJlY3Rpb25fY2FsbGJhY2tzKTtcblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9uKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubi55IC0gbm9kZS5vZmZzZXRIZWlnaHQsXG4gICAgICAgIGxlZnQ6IGJib3gubi54IC0gbm9kZS5vZmZzZXRXaWR0aCAvIDJcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fcygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LnMueSxcbiAgICAgICAgbGVmdDogYmJveC5zLnggLSBub2RlLm9mZnNldFdpZHRoIC8gMlxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9lKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guZS55IC0gbm9kZS5vZmZzZXRIZWlnaHQgLyAyLFxuICAgICAgICBsZWZ0OiBiYm94LmUueFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl93KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gudy55IC0gbm9kZS5vZmZzZXRIZWlnaHQgLyAyLFxuICAgICAgICBsZWZ0OiBiYm94LncueCAtIG5vZGUub2Zmc2V0V2lkdGhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fbncoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5udy55IC0gbm9kZS5vZmZzZXRIZWlnaHQsXG4gICAgICAgIGxlZnQ6IGJib3gubncueCAtIG5vZGUub2Zmc2V0V2lkdGhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fbmUoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5uZS55IC0gbm9kZS5vZmZzZXRIZWlnaHQsXG4gICAgICAgIGxlZnQ6IGJib3gubmUueFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9zdygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LnN3LnksXG4gICAgICAgIGxlZnQ6IGJib3guc3cueCAtIG5vZGUub2Zmc2V0V2lkdGhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fc2UoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zZS55LFxuICAgICAgICBsZWZ0OiBiYm94LmUueFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGluaXROb2RlKCkge1xuICAgICAgdmFyIG5vZGUgPSBkMy5zZWxlY3QoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpXG4gICAgICBub2RlXG4gICAgICAgIC5zdHlsZSgncG9zaXRpb24nLCAnYWJzb2x1dGUnKVxuICAgICAgICAuc3R5bGUoJ3RvcCcsIDApXG4gICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDApXG4gICAgICAgIC5zdHlsZSgncG9pbnRlci1ldmVudHMnLCAnbm9uZScpXG4gICAgICAgIC5zdHlsZSgnYm94LXNpemluZycsICdib3JkZXItYm94JylcblxuICAgICAgcmV0dXJuIG5vZGUubm9kZSgpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0U1ZHTm9kZShlbCkge1xuICAgICAgZWwgPSBlbC5ub2RlKClcbiAgICAgIGlmKGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ3N2ZycpXG4gICAgICAgIHJldHVybiBlbFxuXG4gICAgICByZXR1cm4gZWwub3duZXJTVkdFbGVtZW50XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0Tm9kZUVsKCkge1xuICAgICAgaWYobm9kZSA9PT0gbnVsbCkge1xuICAgICAgICBub2RlID0gaW5pdE5vZGUoKTtcbiAgICAgICAgLy8gcmUtYWRkIG5vZGUgdG8gRE9NXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm9kZSk7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIGQzLnNlbGVjdChub2RlKTtcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlIC0gZ2V0cyB0aGUgc2NyZWVuIGNvb3JkaW5hdGVzIG9mIGEgc2hhcGVcbiAgICAvL1xuICAgIC8vIEdpdmVuIGEgc2hhcGUgb24gdGhlIHNjcmVlbiwgd2lsbCByZXR1cm4gYW4gU1ZHUG9pbnQgZm9yIHRoZSBkaXJlY3Rpb25zXG4gICAgLy8gbihub3J0aCksIHMoc291dGgpLCBlKGVhc3QpLCB3KHdlc3QpLCBuZShub3J0aGVhc3QpLCBzZShzb3V0aGVhc3QpLCBudyhub3J0aHdlc3QpLFxuICAgIC8vIHN3KHNvdXRod2VzdCkuXG4gICAgLy9cbiAgICAvLyAgICArLSstK1xuICAgIC8vICAgIHwgICB8XG4gICAgLy8gICAgKyAgICtcbiAgICAvLyAgICB8ICAgfFxuICAgIC8vICAgICstKy0rXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGFuIE9iamVjdCB7biwgcywgZSwgdywgbncsIHN3LCBuZSwgc2V9XG4gICAgZnVuY3Rpb24gZ2V0U2NyZWVuQkJveCgpIHtcbiAgICAgIHZhciB0YXJnZXRlbCAgID0gdGFyZ2V0IHx8IGQzLmV2ZW50LnRhcmdldDtcblxuICAgICAgd2hpbGUgKCd1bmRlZmluZWQnID09PSB0eXBlb2YgdGFyZ2V0ZWwuZ2V0U2NyZWVuQ1RNICYmICd1bmRlZmluZWQnID09PSB0YXJnZXRlbC5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgdGFyZ2V0ZWwgPSB0YXJnZXRlbC5wYXJlbnROb2RlO1xuICAgICAgfVxuXG4gICAgICB2YXIgYmJveCAgICAgICA9IHt9LFxuICAgICAgICAgIG1hdHJpeCAgICAgPSB0YXJnZXRlbC5nZXRTY3JlZW5DVE0oKSxcbiAgICAgICAgICB0YmJveCAgICAgID0gdGFyZ2V0ZWwuZ2V0QkJveCgpLFxuICAgICAgICAgIHdpZHRoICAgICAgPSB0YmJveC53aWR0aCxcbiAgICAgICAgICBoZWlnaHQgICAgID0gdGJib3guaGVpZ2h0LFxuICAgICAgICAgIHggICAgICAgICAgPSB0YmJveC54LFxuICAgICAgICAgIHkgICAgICAgICAgPSB0YmJveC55XG5cbiAgICAgIHBvaW50LnggPSB4XG4gICAgICBwb2ludC55ID0geVxuICAgICAgYmJveC5udyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54ICs9IHdpZHRoXG4gICAgICBiYm94Lm5lID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnkgKz0gaGVpZ2h0XG4gICAgICBiYm94LnNlID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggLT0gd2lkdGhcbiAgICAgIGJib3guc3cgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSAtPSBoZWlnaHQgLyAyXG4gICAgICBiYm94LncgID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggKz0gd2lkdGhcbiAgICAgIGJib3guZSA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54IC09IHdpZHRoIC8gMlxuICAgICAgcG9pbnQueSAtPSBoZWlnaHQgLyAyXG4gICAgICBiYm94Lm4gPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSArPSBoZWlnaHRcbiAgICAgIGJib3gucyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG5cbiAgICAgIHJldHVybiBiYm94XG4gICAgfVxuXG4gICAgcmV0dXJuIHRpcFxuICB9O1xufSkoKTsiXX0=
