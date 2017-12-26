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
        },

        CollectAll: [],
        UpdateAll: function UpdateAll(variableY) {
            console.log(this.CollectAll);
            this.CollectAll.forEach(function (each) {
                each.update(variableY);
            });
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
    /* globals D3Charts */

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

            var heading = d3.select(this.container).append('p').attr('class', 'relative').html(function () {
                var heading = typeof input === 'string' ? input : _this4.label(_this4.config.category);
                return '<strong>' + heading + '</strong>';
            });

            var labelTooltip = d3.tip().attr("class", "d3-tip label-tip").direction('s').offset([4, 0]).html(this.description(this.config.category));

            function mouseover() {
                if (window.openTooltip) {
                    window.openTooltip.hide();
                }
                labelTooltip.show();
                window.openTooltip = labelTooltip;
            }

            if (this.description(this.config.category) !== undefined && this.description(this.config.category) !== '') {
                heading.html(heading.html() + '<svg class="inline heading-info"><text x="4" y="16" class="info-mark">&#9432;</text></svg>');

                heading.select('.info-mark').attr('tabindex', 0).classed('has-tooltip', true).on('mouseover', function () {
                    this.focus();
                }).on('focus', function () {
                    mouseover.call(_this4);
                }).on('mouseout', function () {
                    this.blur();
                }).on('blur', labelTooltip.hide).call(labelTooltip);
            }
        },
        label: function label(key) {
            // TO DO: combine these into one method that returns object
            return this.dictionary.find(function (each) {
                return each.key === key;
            }).label;
        },
        description: function description(key) {
            return this.dictionary.find(function (each) {
                return each.key === key;
            }).description;
        },
        unitsDescription: function unitsDescription(key) {
            return this.dictionary.find(function (each) {
                return each.key === key;
            }).units_description;
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
        this.isFirstRender = true;
        this.setScales(); // //SHOULD BE IN CHART PROTOTYPE 
        this.setTooltips();
        this.addLines();
        //  this.addPoints();
        this.addXAxis();
        this.addYAxis();
    };

    LineChart.prototype = { // each LineChart is an svg that hold grouped series
        defaultMargins: {
            top: 27,
            right: 65,
            bottom: 25,
            left: 35
        },

        init: function init(chartDiv) {
            var _this5 = this;

            // //SHOULD BE IN CHART PROTOTYPE this is called once for each seriesGroup of each category. 
            D3Charts.CollectAll.push(this);
            var container = d3.select(chartDiv).append('svg').attr('width', this.width + this.marginRight + this.marginLeft).attr('height', this.height + this.marginTop + this.marginBottom);

            this.svg = container.append('g').attr('transform', 'translate(' + this.marginLeft + ', ' + this.marginTop + ')');

            this.xAxisGroup = this.svg.append('g');

            this.yAxisGroup = this.svg.append('g');

            this.allSeries = this.svg.append('g');

            this.eachSeries = this.allSeries.selectAll('each-series').data(this.data, function (d) {
                return d.key;
            }).enter().append('g').attr('class', function () {
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
        update: function update() {
            var variableY = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.config.variableY;

            this.config.variableY = variableY;
            console.log(this.config.variableY, this.isFirstRender);

            this.prepareStacking();
            this.setScales();
            this.addLines();
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

                stackGroup.selectAll('stacked-area').data(this.stackData).enter().append('path') // TO DO: add zero-line equivalent and logic for transition on update
                .attr('class', function (d, i) {
                    return 'area-line color-' + i;
                }) // TO DO not quite right that color shold be `i`
                // if you have more than one group of series, will repeat
                .attr('d', function (d) {
                    return area(d);
                });

                stackGroup.selectAll('stacked-line') // TO DO: add zero-line equivalent and logic for transition on update
                .data(this.stackData).enter().append('path').attr('class', function (d, i) {
                    return 'line color-' + i;
                }).attr('d', function (d) {
                    return line(d);
                });
            } else {
                if (this.isFirstRender) {

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
                } else {

                    d3.selectAll(this.lines.nodes()).transition().duration(500).attr('d', function (d) {
                        return valueline(d.values);
                    });

                    d3.selectAll(this.points.nodes()).transition().duration(500).attr('cx', function (d) {
                        return _this8.xScale(d3.timeParse(_this8.xTimeType)(d[_this8.config.variableX]));
                    }).attr('cy', function (d) {
                        console.log(_this8.config.variableY);
                        return _this8.yScale(d[_this8.config.variableY]);
                    });

                    d3.selectAll(this.labelGroups.nodes()).transition().duration(500).attr('transform', function (d) {
                        return 'translate(' + (_this8.width + 8) + ', ' + (_this8.yScale(d.values[d.values.length - 1][_this8.config.variableY]) + 3) + ')';
                    });

                    d3.selectAll(this.labels.nodes()).transition().duration(500).attr('y', 0).on('end', function (d, i, array) {
                        if (i === array.length - 1) {
                            _this8.relaxLabels();
                        }
                    });

                    d3.selectAll(this.yAxisGroup.nodes()).transition().duration(500).call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5));
                }
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
            var unitsLabels = this.eachSeries.append('text').attr('class', 'units').attr('transform', function () {
                return 'translate(-' + (_this10.marginLeft - 5) + ',-' + (_this10.marginTop - 14) + ')';
            }).html(function (d, i) {
                return i === 0 ? _this10.parent.units(d.key) : null;
            });

            var labelTooltip = d3.tip().attr("class", "d3-tip label-tip").direction('e').offset([-2, 4]);

            function mouseover(d) {
                if (window.openTooltip) {
                    window.openTooltip.hide();
                }
                labelTooltip.html(this.parent.unitsDescription(d.key));
                labelTooltip.show();
                window.openTooltip = labelTooltip;
            }

            unitsLabels.each(function (d, i, array) {
                // TO DO this is repetitive of addLabels()
                if (_this10.parent.unitsDescription(d.key) !== undefined && d3.select(array[i]).html() !== '') {
                    console.log(_this10.parent.unitsDescription(d.key));
                    d3.select(array[i]).html(function () {
                        return d3.select(this).html() + '<tspan dy="-0.2em" class="info-mark">&#9432;</tspan>';
                    }).attr('tabindex', 0).classed('has-tooltip', true).on('mouseover', function (d, i, array) {
                        array[i].focus();
                    }).on('focus', function (d) {
                        mouseover.call(_this10, d);
                    }).on('mouseout', function (d, i, array) {
                        array[i].blur();
                    }).on('blur', labelTooltip.hide).call(labelTooltip);
                }
            });
        },
        addLabels: function addLabels() {
            var _this11 = this;

            var labelTooltip = d3.tip().attr("class", "d3-tip label-tip").direction('n').offset([-4, 12]);

            function mouseover(d) {
                if (window.openTooltip) {
                    window.openTooltip.hide();
                }
                labelTooltip.html(this.parent.description(d.key));
                labelTooltip.show();
                window.openTooltip = labelTooltip;
            }

            this.labelGroups = this.eachSeries.append('g');

            this.labels = this.labelGroups.attr('transform', function (d) {
                return 'translate(' + (_this11.width + 8) + ', ' + (_this11.yScale(d.values[d.values.length - 1][_this11.config.variableY]) + 3) + ')';
            }).append('text').attr('y', 0).attr('class', 'series-label').html(function (d) {
                return '<tspan x="0">' + _this11.parent.label(d.key).replace(/\\n/g, '</tspan><tspan x="0.5em" dy="1.2em">') + '</tspan>';
            });

            this.labels.each(function (d, i, array) {
                if (_this11.parent.description(d.key) !== undefined && _this11.parent.description(d.key) !== '') {
                    d3.select(array[i]).html(function () {
                        return d3.select(this).html() + '<tspan dy="-0.2em" class="info-mark">&#9432;</tspan>';
                    }).attr('tabindex', 0).classed('has-tooltip', true).on('mouseover', function (d, i, array) {
                        array[i].focus();
                    }).on('focus', function (d) {
                        mouseover.call(_this11, d);
                    }).on('mouseout', function (d, i, array) {
                        array[i].blur();
                    }).on('blur', labelTooltip.hide).call(labelTooltip);
                }
            });
            this.isFirstRender = false;

            this.relaxLabels();
        },
        relaxLabels: function relaxLabels() {
            var _this12 = this;

            // HT http://jsfiddle.net/thudfactor/B2WBU/ adapted technique
            var alpha = 1,
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
                        //console.log('no collision', a, b);
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
                        _this12.relaxLabels();
                    }, 20);
                }
            });
        },
        addPoints: function addPoints() {
            var _this13 = this;

            function mouseover(d, i, array) {

                if (window.openTooltip) {
                    window.openTooltip.hide();
                }

                var klass = array[i].parentNode.classList.value.match(/color-\d/)[0]; // get the color class of the parent g
                this.tooltip.attr('class', this.tooltip.attr('class') + ' ' + klass);
                this.tooltip.html('<strong>' + this.parent.tipText(d.series) + '</strong> (' + d.year + ')<br />' + d[this.config.variableY] + ' ' + this.parent.units(d.series));
                this.tooltip.show();
                window.openTooltip = this.tooltip;
            }
            function mouseout() {
                console.log('mouseout');
                this.tooltip.attr('class', this.tooltip.attr('class').replace(/ color-\d/g, ''));
                this.tooltip.html('');
                this.tooltip.hide();
            }
            this.points = this.eachSeries.selectAll('points').data(function (d) {
                return d.values;
            }, function (d) {
                return d.key;
            }).enter().append('circle').attr('tabindex', 0).attr('opacity', 0).attr('class', 'data-point').attr('r', '4').attr('cx', function (d) {
                return _this13.xScale(d3.timeParse(_this13.xTimeType)(d[_this13.config.variableX]));
            }).attr('cy', function (d) {
                return _this13.yScale(d[_this13.config.variableY]);
            }).on('mouseover', function (d, i, array) {
                array[i].focus();
            }).on('focus', function (d, i, array) {
                mouseover.call(_this13, d, i, array);
            }).on('mouseout', function (d, i, array) {
                array[i].blur();
            }).on('blur', function () {
                mouseout.call(_this13);
            }).on('click', this.bringToTop).on('keyup', function (d, i, array) {
                console.log(d3.event);
                if (d3.event.keyCode === 13) {

                    _this13.bringToTop.call(array[i]);
                }
            }).call(this.tooltip).transition().duration(500).attr('opacity', 1);
        },
        bringToTop: function bringToTop() {
            console.log(this.parentNode !== this.parentNode.parentNode.lastChild);
            if (this.parentNode !== this.parentNode.parentNode.lastChild) {
                console.log('click', this);
                d3.select(this.parentNode).moveToFront();
                this.focus();
            }
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
    /* globals DOMStringMap, d3 */
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

    d3.selection.prototype.moveToFront = function () {
        return this.each(function () {
            this.parentNode.appendChild(this);
        });
    };
    d3.selection.prototype.moveToBack = function () {
        return this.each(function () {
            var firstChild = this.parentNode.firstChild;
            if (firstChild) {
                this.parentNode.insertBefore(this, firstChild);
            }
        });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9DaGFydHMuanMiLCJqcy1leHBvcnRzL0hlbHBlcnMuanMiLCJqcy12ZW5kb3IvZDMtdGlwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNJQTs7QUFDQTs7QUFDQTs7QUFFQSxJQUFJLFdBQVksWUFBVTs7QUFFMUI7O0FBRUksUUFBSSxrQkFBa0IsRUFBdEI7QUFDQSxRQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEwQjtBQUFBOztBQUV6QyxhQUFLLFNBQUwsR0FBaUIsU0FBakI7QUFDQSxhQUFLLEtBQUwsR0FBYSxLQUFiO0FBQ0EsYUFBSyxNQUFMLEdBQWMsVUFBVSxPQUFWLENBQWtCLE9BQWxCLEVBQWQ7O0FBRUEsYUFBSyxZQUFMLEdBQW9CLEtBQUssa0JBQUwsQ0FBd0IsU0FBeEIsQ0FBcEI7QUFDQSxhQUFLLFFBQUwsR0FBZ0IsRUFBaEI7O0FBRUE7QUFDQSxhQUFLLFlBQUwsQ0FBa0IsSUFBbEIsQ0FBdUIsWUFBTTtBQUN6QixrQkFBSyxnQkFBTCxDQUFzQixTQUF0QjtBQUNILFNBRkQ7QUFHSCxLQWJEO0FBY0E7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBRWpCLDBCQUZpQixnQ0FFRztBQUFBOztBQUNoQixnQkFBSSxlQUFlLEVBQW5CO0FBQ0EsZ0JBQUksVUFBVSxLQUFLLE1BQUwsQ0FBWSxPQUExQjtBQUFBLGdCQUNJLE9BQU8sQ0FBQyxLQUFLLE1BQUwsQ0FBWSxPQUFiLEVBQXFCLEtBQUssTUFBTCxDQUFZLGFBQWpDLENBRFgsQ0FGZ0IsQ0FHNEM7QUFDeEI7QUFDcEMsaUJBQUssT0FBTCxDQUFhLFVBQUMsSUFBRCxFQUFPLENBQVAsRUFBYTtBQUN0QixvQkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsdUJB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Q0EsWUFBTSxDQUFOLElBQVcsU0FBUyxDQUFwQjtBQUNBLFdBQUssQ0FBTCxHQUFVLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFWO0FBQ0EsWUFBTSxDQUFOLElBQVcsS0FBWDtBQUNBLFdBQUssQ0FBTCxHQUFTLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFUO0FBQ0EsWUFBTSxDQUFOLElBQVcsUUFBUSxDQUFuQjtBQUNBLFlBQU0sQ0FBTixJQUFXLFNBQVMsQ0FBcEI7QUFDQSxXQUFLLENBQUwsR0FBUyxNQUFNLGVBQU4sQ0FBc0IsTUFBdEIsQ0FBVDtBQUNBLFlBQU0sQ0FBTixJQUFXLE1BQVg7QUFDQSxXQUFLLENBQUwsR0FBUyxNQUFNLGVBQU4sQ0FBc0IsTUFBdEIsQ0FBVDs7QUFFQSxhQUFPLElBQVA7QUFDRDs7QUFFRCxXQUFPLEdBQVA7QUFDRCxHQWxURDtBQW1URCxDQTFUb0IsRUFBZCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIgLyogZXhwb3J0ZWQgRDNDaGFydHMsIEhlbHBlcnMsIGQzVGlwICovIC8vIGxldCdzIGpzaGludCBrbm93IHRoYXQgRDNDaGFydHMgY2FuIGJlIFwiZGVmaW5lZCBidXQgbm90IHVzZWRcIiBpbiB0aGlzIGZpbGVcbiAvKiBwb2x5ZmlsbHMgbmVlZGVkOiBQcm9taXNlLCBBcnJheS5pc0FycmF5LCBBcnJheS5maW5kLCBBcnJheS5maWx0ZXJcblxuICovXG5pbXBvcnQgeyBIZWxwZXJzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9IZWxwZXJzJztcbmltcG9ydCB7IENoYXJ0cyB9IGZyb20gJy4uL2pzLWV4cG9ydHMvQ2hhcnRzJztcbmltcG9ydCB7IGQzVGlwIH0gZnJvbSAnLi4vanMtdmVuZG9yL2QzLXRpcCc7XG5cbnZhciBEM0NoYXJ0cyA9IChmdW5jdGlvbigpe1xuXG5cInVzZSBzdHJpY3RcIjsgXG4gICAgIFxuICAgIHZhciBncm91cENvbGxlY3Rpb24gPSBbXTtcbiAgICB2YXIgRDNDaGFydEdyb3VwID0gZnVuY3Rpb24oY29udGFpbmVyLCBpbmRleCl7XG4gICAgICAgIFxuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICAgICAgdGhpcy5pbmRleCA9IGluZGV4O1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbnRhaW5lci5kYXRhc2V0LmNvbnZlcnQoKTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMuZGF0YVByb21pc2VzID0gdGhpcy5yZXR1cm5EYXRhUHJvbWlzZXMoY29udGFpbmVyKTtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgICAgICBcbiAgICAgICAgLy90aGlzLmNvbnRyb2xsZXIuaW5pdENvbnRyb2xsZXIoY29udGFpbmVyLCB0aGlzLm1vZGVsLCB0aGlzLnZpZXcpO1xuICAgICAgICB0aGlzLmRhdGFQcm9taXNlcy50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNoYXJ0cyhjb250YWluZXIpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8vcHJvdG90eXBlIGJlZ2lucyBoZXJlXG4gICAgRDNDaGFydEdyb3VwLnByb3RvdHlwZSA9IHtcbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm5EYXRhUHJvbWlzZXMoKXsgXG4gICAgICAgICAgICAgICAgdmFyIGRhdGFQcm9taXNlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBzaGVldElEID0gdGhpcy5jb25maWcuc2hlZXRJZCwgXG4gICAgICAgICAgICAgICAgICAgIHRhYnMgPSBbdGhpcy5jb25maWcuZGF0YVRhYix0aGlzLmNvbmZpZy5kaWN0aW9uYXJ5VGFiXTsgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpcyB0aGVyZSBhIGNhc2UgZm9yIG1vcmUgdGhhbiBvbmUgc2hlZXQgb2YgZGF0YT9cbiAgICAgICAgICAgICAgICB0YWJzLmZvckVhY2goKGVhY2gsIGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSxyZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLmpzb24oJ2h0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8nICsgc2hlZXRJRCArICcvdmFsdWVzLycgKyBlYWNoICsgJz9rZXk9QUl6YVN5REQzVzV3SmVKRjJlc2ZmWk1ReE50RWw5dHQtT2ZnU3E0JywgKGVycm9yLGRhdGEpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWVzID0gZGF0YS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RUeXBlID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gJ29iamVjdCcgOiAnc2VyaWVzJzsgLy8gbmVzdFR5cGUgZm9yIGRhdGEgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RCeSA9IGVhY2ggPT09ICdkaWN0aW9uYXJ5JyA/IGZhbHNlIDogdGhpcy5jb25maWcubmVzdEJ5O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBuZXN0QnksIHRydWUsIG5lc3RUeXBlLCBpKSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBkYXRhUHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBQcm9taXNlLmFsbChkYXRhUHJvbWlzZXMpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhID0gdmFsdWVzWzBdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB2YWx1ZXNbMV07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3VtbWFyaWVzID0gdGhpcy5zdW1tYXJpemVEYXRhKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKGRhdGFQcm9taXNlcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3VtbWFyaXplRGF0YSgpeyAvLyB0aGlzIGZuIGNyZWF0ZXMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBzdW1tYXJpemluZyB0aGUgZGF0YSBpbiBtb2RlbC5kYXRhLiBtb2RlbC5kYXRhIGlzIG5lc3RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgbmVzdGluZyBhbmQgcm9sbGluZyB1cCBjYW5ub3QgYmUgZG9uZSBlYXNpbHkgYXQgdGhlIHNhbWUgdGltZSwgc28gdGhleSdyZSBkb25lIHNlcGFyYXRlbHkuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzdW1tYXJpZXMgcHJvdmlkZSBhdmVyYWdlLCBtYXgsIG1pbiBvZiBhbGwgZmllbGRzIGluIHRoZSBkYXRhIGF0IGFsbCBsZXZlbHMgb2YgbmVzdGluZy4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBmaXJzdCAoaW5kZXggMCkgaXMgb25lIGxheWVyIG5lc3RlZCwgdGhlIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgc3VtbWFyaWVzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHZhcmlhYmxlcyA9IE9iamVjdC5rZXlzKHRoaXMudW5uZXN0ZWRbMF0pOyAvLyBhbGwgbmVlZCB0byBoYXZlIHRoZSBzYW1lIGZpZWxkc1xuICAgICAgICAgICAgICAgIHZhciBuZXN0QnkgPSB0aGlzLmNvbmZpZy5uZXN0QnkgPyB0aGlzLmNvbmZpZy5uZXN0QnkubWFwKGVhY2ggPT4gZWFjaCkgOiBmYWxzZTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlcyBtYXAgdG8gY3JlYXRlIG5ldyBhcnJheSByYXRoZXIgdGhhbiBhc3NpZ25pbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBieSByZWZlcmVuY2UuIHRoZSBgcG9wKClgIGJlbG93IHdvdWxkIGFmZmVjdCBvcmlnaW5hbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFycmF5IGlmIGRvbmUgYnkgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgdmFyIG5lc3RCeUFycmF5ID0gQXJyYXkuaXNBcnJheShuZXN0QnkpID8gbmVzdEJ5IDogW25lc3RCeV07XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gcmVkdWNlVmFyaWFibGVzKGQpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFyaWFibGVzLnJlZHVjZShmdW5jdGlvbihhY2MsIGN1cil7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NbY3VyXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXg6ICAgICAgIGQzLm1heChkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluOiAgICAgICBkMy5taW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lYW46ICAgICAgZDMubWVhbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VtOiAgICAgICBkMy5zdW0oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lZGlhbjogICAgZDMubWVkaWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW5jZTogIGQzLnZhcmlhbmNlKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpYXRpb246IGQzLmRldmlhdGlvbihkLCBkID0+IGRbY3VyXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgICAgICB9LHt9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgd2hpbGUgKCBuZXN0QnlBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnJvbGx1cChyZWR1Y2VWYXJpYWJsZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHRoaXMudW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgICAgICBzdW1tYXJpZXMudW5zaGlmdChzdW1tYXJpemVkKTsgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBzdW1tYXJpZXM7XG4gICAgICAgICAgICB9LCBcbiAgICAgICAgICAgIG5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpe1xuICAgICAgICAgICAgICAgIC8vIHJlY3Vyc2l2ZSAgbmVzdGluZyBmdW5jdGlvbiB1c2VkIGJ5IHN1bW1hcml6ZURhdGEgYW5kIHJldHVybktleVZhbHVlc1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXN0QnlBcnJheS5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ciAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGN1ciAhPT0gJ2Z1bmN0aW9uJyApIHsgdGhyb3cgJ2VhY2ggbmVzdEJ5IGl0ZW0gbXVzdCBiZSBhIHN0cmluZyBvciBmdW5jdGlvbic7IH1cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJ0bjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnc3RyaW5nJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZFtjdXJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7ICAgIFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ2Z1bmN0aW9uJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VyKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJ0bjtcbiAgICAgICAgICAgICAgICB9LCBkMy5uZXN0KCkpO1xuICAgICAgICAgICAgfSwgICAgICAgXG4gICAgICAgICAgICByZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBuZXN0QnksIGNvZXJjZSA9IGZhbHNlLCBuZXN0VHlwZSA9ICdzZXJpZXMnLCB0YWJJbmRleCA9IDApe1xuICAgICAgICAgICAgLy8gdGhpcyBmbiB0YWtlcyBub3JtYWxpemVkIGRhdGEgZmV0Y2hlZCBhcyBhbiBhcnJheSBvZiByb3dzIGFuZCB1c2VzIHRoZSB2YWx1ZXMgaW4gdGhlIGZpcnN0IHJvdyBhcyBrZXlzIGZvciB2YWx1ZXMgaW5cbiAgICAgICAgICAgIC8vIHN1YnNlcXVlbnQgcm93c1xuICAgICAgICAgICAgLy8gbmVzdEJ5ID0gc3RyaW5nIG9yIGFycmF5IG9mIGZpZWxkKHMpIHRvIG5lc3QgYnksIG9yIGEgY3VzdG9tIGZ1bmN0aW9uLCBvciBhbiBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucztcbiAgICAgICAgICAgIC8vIGNvZXJjZSA9IEJPT0wgY29lcmNlIHRvIG51bSBvciBub3Q7IG5lc3RUeXBlID0gb2JqZWN0IG9yIHNlcmllcyBuZXN0IChkMylcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgcHJlbGltO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciB1bm5lc3RlZCA9IHZhbHVlcy5zbGljZSgxKS5tYXAocm93ID0+IHJvdy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIsIGkpIHsgXG4gICAgICAgICAgICAgICAgLy8gMS4gcGFyYW1zOiB0b3RhbCwgY3VycmVudFZhbHVlLCBjdXJyZW50SW5kZXhbLCBhcnJdXG4gICAgICAgICAgICAgICAgLy8gMy4gLy8gYWNjIGlzIGFuIG9iamVjdCAsIGtleSBpcyBjb3JyZXNwb25kaW5nIHZhbHVlIGZyb20gcm93IDAsIHZhbHVlIGlzIGN1cnJlbnQgdmFsdWUgb2YgYXJyYXlcbiAgICAgICAgICAgICAgICAgIGFjY1t2YWx1ZXNbMF1baV1dID0gY29lcmNlID09PSB0cnVlID8gaXNOYU4oK2N1cikgfHwgY3VyID09PSAnJyA/IGN1ciA6ICtjdXIgOiBjdXI7IFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0IGZvciBlbXB0eSBzdHJpbmdzIGJlZm9yZSBjb2VyY2luZyBiYyArJycgPT4gMFxuICAgICAgICAgICAgICAgIH0sIHt9KSk7XG4gICAgICAgICAgICAgICAgaWYgKCB0YWJJbmRleCA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51bm5lc3RlZCA9IHVubmVzdGVkO1xuICAgICAgICAgICAgICAgIH0gICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICggIW5lc3RCeSApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgbmVzdEJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbmVzdEJ5ID09PSAnZnVuY3Rpb24nICkgeyAvLyBpZSBvbmx5IG9uZSBuZXN0QnkgZmllbGQgb3IgZnVuY2l0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IHRoaXMubmVzdFByZWxpbShbbmVzdEJ5XSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkobmVzdEJ5KSkgeyB0aHJvdyAnbmVzdEJ5IHZhcmlhYmxlIG11c3QgYmUgYSBzdHJpbmcsIGZ1bmN0aW9uLCBvciBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucyc7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IHRoaXMubmVzdFByZWxpbShuZXN0QnkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICggbmVzdFR5cGUgPT09ICdvYmplY3QnICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRyaWVzKHVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5pdGlhbGl6ZUNoYXJ0cyhjb250YWluZXIpe1xuICAgICAgICAgICAgICAgIHZhciBncm91cCA9IHRoaXM7XG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KGNvbnRhaW5lcikuc2VsZWN0QWxsKCcuZDMtY2hhcnQnKVxuICAgICAgICAgICAgICAgICAgICAuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgZ3JvdXAuY2hpbGRyZW4ucHVzaChuZXcgQ2hhcnRzLkNoYXJ0RGl2KHRoaXMsIGdyb3VwKSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSAgICAgICAgXG4gICAgfTsgLy8gRDNDaGFydEdyb3VwIHByb3RvdHlwZSBlbmRzIGhlcmVcbiAgICBcbiAgICB3aW5kb3cuRDNDaGFydHMgPSB7IC8vIG5lZWQgdG8gc3BlY2lmeSB3aW5kb3cgYmMgYWZ0ZXIgdHJhbnNwaWxpbmcgYWxsIHRoaXMgd2lsbCBiZSB3cmFwcGVkIGluIElJRkVzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgYHJldHVybmBpbmcgd29uJ3QgZ2V0IHRoZSBleHBvcnQgaW50byB3aW5kb3cncyBnbG9iYWwgc2NvcGVcbiAgICAgICAgSW5pdCgpe1xuICAgICAgICAgICAgdmFyIGdyb3VwRGl2cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5kMy1ncm91cCcpO1xuICAgICAgICAgICAgZm9yICggbGV0IGkgPSAwOyBpIDwgZ3JvdXBEaXZzLmxlbmd0aDsgaSsrICl7XG4gICAgICAgICAgICAgICAgZ3JvdXBDb2xsZWN0aW9uLnB1c2gobmV3IEQzQ2hhcnRHcm91cChncm91cERpdnNbaV0sIGkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9LFxuICAgICAgICBDb2xsZWN0QWxsOltdLFxuICAgICAgICBVcGRhdGVBbGwodmFyaWFibGVZKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHRoaXMuQ29sbGVjdEFsbCk7XG4gICAgICAgICAgICB0aGlzLkNvbGxlY3RBbGwuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICBlYWNoLnVwZGF0ZSh2YXJpYWJsZVkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufSgpKTsgLy8gZW5kIHZhciBEM0NoYXJ0cyBJSUZFIiwiZXhwb3J0IGNvbnN0IENoYXJ0cyA9IChmdW5jdGlvbigpe1xuICAgIC8qIGdsb2JhbHMgRDNDaGFydHMgKi9cblxuICAgIHZhciBDaGFydERpdiA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgcGFyZW50KXtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gW107XG4gICAgICAgIHRoaXMuc2VyaWVzQ291bnQgPSAwO1xuICAgICAgICB0aGlzLmNvbmZpZyA9IE9iamVjdC5jcmVhdGUoIHBhcmVudC5jb25maWcsIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKCBjb250YWluZXIuZGF0YXNldC5jb252ZXJ0KCkgKSApO1xuICAgICAgICAgICAgLy8gbGluZSBhYm92ZSBjcmVhdGVzIGEgY29uZmlnIG9iamVjdCBmcm9tIHRoZSBIVE1MIGRhdGFzZXQgZm9yIHRoZSBjaGFydERpdiBjb250YWluZXJcbiAgICAgICAgICAgIC8vIHRoYXQgaW5oZXJpdHMgZnJvbSB0aGUgcGFyZW50cyBjb25maWcgb2JqZWN0LiBhbnkgY29uZmlncyBub3Qgc3BlY2lmaWVkIGZvciB0aGUgY2hhcnREaXYgKGFuIG93biBwcm9wZXJ0eSlcbiAgICAgICAgICAgIC8vIHdpbGwgY29tZSBmcm9tIHVwIHRoZSBpbmhlcml0YW5jZSBjaGFpblxuICAgICAgICB0aGlzLmRhdHVtID0gcGFyZW50LmRhdGEuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSB0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgIHZhciBzZXJpZXNJbnN0cnVjdCA9IHRoaXMuY29uZmlnLnNlcmllcyB8fCAnYWxsJztcbiAgICAgICAgXG4gICAgICAgIGlmICggQXJyYXkuaXNBcnJheShzZXJpZXNJbnN0cnVjdCkgKXtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5kYXR1bS52YWx1ZXMgPSB0aGlzLmRhdHVtLnZhbHVlcy5maWx0ZXIoZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlcmllc0luc3RydWN0LmluZGV4T2YoZWFjaC5rZXkpICE9PSAtMTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKCBzZXJpZXNJbnN0cnVjdCAhPT0gJ2FsbCcgKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBJbnZhbGlkIGluc3RydWN0aW9uIGZyb20gSFRNTCBmb3Igd2hpY2ggY2F0ZWdvcmllcyB0byBpbmNsdWRlIFxuICAgICAgICAgICAgICAgICAgICAodmFyIHNlcmllc0luc3RydWN0KS4gRmFsbGJhY2sgdG8gYWxsLmApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2VyaWVzR3JvdXBzID0gdGhpcy5ncm91cFNlcmllcygpO1xuICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB0aGlzLnBhcmVudC5kaWN0aW9uYXJ5O1xuICAgICAgICBpZiAoIHRoaXMuY29uZmlnLmhlYWRpbmcgIT09IGZhbHNlICl7XG4gICAgICAgICAgICB0aGlzLmFkZEhlYWRpbmcodGhpcy5jb25maWcuaGVhZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jcmVhdGVDaGFydHMoKTtcblxuICAgIH07XG4gICAgXG4gICAgQ2hhcnREaXYucHJvdG90eXBlID0ge1xuICAgICAgICBjaGFydFR5cGVzOiB7XG4gICAgICAgICAgICBsaW5lOiAgICdMaW5lQ2hhcnQnLFxuICAgICAgICAgICAgY29sdW1uOiAnQ29sdW1uQ2hhcnQnLFxuICAgICAgICAgICAgYmFyOiAgICAnQmFyQ2hhcnQnIC8vIHNvIG9uIC4gLiAuXG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZUNoYXJ0cygpe1xuICAgICAgICAgICAgdGhpcy5zZXJpZXNHcm91cHMuZm9yRWFjaCgoZWFjaCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChuZXcgTGluZUNoYXJ0KHRoaXMsIGVhY2gpKTsgLy8gVE8gRE8gZGlzdGluZ3Vpc2ggY2hhcnQgdHlwZXMgaGVyZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGdyb3VwU2VyaWVzKCl7XG4gICAgICAgICAgICB2YXIgc2VyaWVzR3JvdXBzLFxuICAgICAgICAgICAgICAgIGdyb3Vwc0luc3RydWN0ID0gdGhpcy5jb25maWcuc2VyaWVzR3JvdXAgfHwgJ25vbmUnO1xuICAgICAgICAgICAgaWYgKCBBcnJheS5pc0FycmF5KCBncm91cHNJbnN0cnVjdCApICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFtdO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLnNlcmllc0dyb3VwLmZvckVhY2goZ3JvdXAgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMucHVzaCh0aGlzLmRhdHVtLnZhbHVlcy5maWx0ZXIoc2VyaWVzID0+IGdyb3VwLmluZGV4T2Yoc2VyaWVzLmtleSkgIT09IC0xKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBncm91cHNJbnN0cnVjdCA9PT0gJ25vbmUnICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IHRoaXMuZGF0dW0udmFsdWVzLm1hcChlYWNoID0+IFtlYWNoXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBncm91cHNJbnN0cnVjdCA9PT0gJ2FsbCcgKSB7XG4gICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW3RoaXMuZGF0dW0udmFsdWVzLm1hcChlYWNoID0+IGVhY2gpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEludmFsaWQgZGF0YS1ncm91cC1zZXJpZXMgaW5zdHJ1Y3Rpb24gZnJvbSBodG1sLiBcbiAgICAgICAgICAgICAgICAgICAgICAgTXVzdCBiZSB2YWxpZCBKU09OOiBcIk5vbmVcIiBvciBcIkFsbFwiIG9yIGFuIGFycmF5XG4gICAgICAgICAgICAgICAgICAgICAgIG9mIGFycmF5cyBjb250YWluaW5nIHRoZSBzZXJpZXMgdG8gYmUgZ3JvdXBlZFxuICAgICAgICAgICAgICAgICAgICAgICB0b2dldGhlci4gQWxsIHN0cmluZ3MgbXVzdCBiZSBkb3VibGUtcXVvdGVkLmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNlcmllc0dyb3VwcztcbiAgICAgICAgfSwgLy8gZW5kIGdyb3VwU2VyaWVzKClcbiAgICAgICAgYWRkSGVhZGluZyhpbnB1dCl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBoZWFkaW5nID0gZDMuc2VsZWN0KHRoaXMuY29udGFpbmVyKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3AnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ3JlbGF0aXZlJylcbiAgICAgICAgICAgICAgICAuaHRtbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBoZWFkaW5nID0gdHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJyA/IGlucHV0IDogdGhpcy5sYWJlbCh0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nICsgaGVhZGluZyArICc8L3N0cm9uZz4nO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgdmFyIGxhYmVsVG9vbHRpcCA9IGQzLnRpcCgpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcImQzLXRpcCBsYWJlbC10aXBcIilcbiAgICAgICAgICAgICAgICAuZGlyZWN0aW9uKCdzJylcbiAgICAgICAgICAgICAgICAub2Zmc2V0KFs0LCAwXSlcbiAgICAgICAgICAgICAgICAuaHRtbCh0aGlzLmRlc2NyaXB0aW9uKHRoaXMuY29uZmlnLmNhdGVnb3J5KSk7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG1vdXNlb3Zlcigpe1xuICAgICAgICAgICAgICAgIGlmICggd2luZG93Lm9wZW5Ub29sdGlwICkge1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAuaGlkZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsYWJlbFRvb2x0aXAuc2hvdygpO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcCA9IGxhYmVsVG9vbHRpcDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCB0aGlzLmRlc2NyaXB0aW9uKHRoaXMuY29uZmlnLmNhdGVnb3J5KSAhPT0gdW5kZWZpbmVkICYmIHRoaXMuZGVzY3JpcHRpb24odGhpcy5jb25maWcuY2F0ZWdvcnkpICE9PSAnJyApe1xuICAgICAgICAgICAgICAgIGhlYWRpbmcuaHRtbChoZWFkaW5nLmh0bWwoKSArICc8c3ZnIGNsYXNzPVwiaW5saW5lIGhlYWRpbmctaW5mb1wiPjx0ZXh0IHg9XCI0XCIgeT1cIjE2XCIgY2xhc3M9XCJpbmZvLW1hcmtcIj4mIzk0MzI7PC90ZXh0Pjwvc3ZnPicpO1xuXG4gICAgICAgICAgICAgICAgaGVhZGluZy5zZWxlY3QoJy5pbmZvLW1hcmsnKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApXG4gICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdoYXMtdG9vbHRpcCcsIHRydWUpXG4gICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9jdXMoKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdXNlb3Zlci5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAub24oJ21vdXNlb3V0JywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmx1cigpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAub24oJ2JsdXInLCBsYWJlbFRvb2x0aXAuaGlkZSlcbiAgICAgICAgICAgICAgICAgICAgLmNhbGwobGFiZWxUb29sdGlwKTtcblxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgfSxcbiAgICAgICAgbGFiZWwoa2V5KXsgLy8gVE8gRE86IGNvbWJpbmUgdGhlc2UgaW50byBvbmUgbWV0aG9kIHRoYXQgcmV0dXJucyBvYmplY3RcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLmxhYmVsO1xuICAgICAgICB9LFxuICAgICAgICBkZXNjcmlwdGlvbihrZXkpe1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkuZGVzY3JpcHRpb247XG4gICAgICAgIH0sXG4gICAgICAgIHVuaXRzRGVzY3JpcHRpb24oa2V5KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLnVuaXRzX2Rlc2NyaXB0aW9uO1xuICAgICAgICB9LCAgIFxuICAgICAgICB1bml0cyhrZXkpe1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkudW5pdHM7ICBcbiAgICAgICAgfSxcbiAgICAgICAgdGlwVGV4dChrZXkpe1xuICAgICAgICAgICAgdmFyIHN0ciA9IHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkubGFiZWwucmVwbGFjZSgvXFxcXG4vZywnICcpO1xuICAgICAgICAgICAgcmV0dXJuIHN0ci5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0ci5zbGljZSgxKTtcbiAgICAgICAgfVxuXG4gICAgfTsgLy8gZW5kIExpbmVDaGFydC5wcm90b3R5cGVcblxuICAgIHZhciBMaW5lQ2hhcnQgPSBmdW5jdGlvbihwYXJlbnQsIHNlcmllc0dyb3VwKXtcbiAgICAgICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgIHRoaXMuY29uZmlnID0gcGFyZW50LmNvbmZpZztcbiAgICAgICAgdGhpcy5tYXJnaW5Ub3AgPSArdGhpcy5jb25maWcubWFyZ2luVG9wIHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMudG9wO1xuICAgICAgICB0aGlzLm1hcmdpblJpZ2h0ID0gK3RoaXMuY29uZmlnLm1hcmdpblJpZ2h0IHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMucmlnaHQ7XG4gICAgICAgIHRoaXMubWFyZ2luQm90dG9tID0gK3RoaXMuY29uZmlnLm1hcmdpbkJvdHRvbSB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLmJvdHRvbTtcbiAgICAgICAgdGhpcy5tYXJnaW5MZWZ0ID0gK3RoaXMuY29uZmlnLm1hcmdpbkxlZnQgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5sZWZ0O1xuICAgICAgICB0aGlzLndpZHRoID0gdGhpcy5jb25maWcuc3ZnV2lkdGggPyArdGhpcy5jb25maWcuc3ZnV2lkdGggLSB0aGlzLm1hcmdpblJpZ2h0IC0gdGhpcy5tYXJnaW5MZWZ0IDogMzIwIC0gdGhpcy5tYXJnaW5SaWdodCAtIHRoaXMubWFyZ2luTGVmdDtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLmNvbmZpZy5zdmdIZWlnaHQgPyArdGhpcy5jb25maWcuc3ZnSGVpZ2h0IC0gdGhpcy5tYXJnaW5Ub3AgLSB0aGlzLm1hcmdpbkJvdHRvbSA6ICggdGhpcy53aWR0aCArIHRoaXMubWFyZ2luUmlnaHQgKyB0aGlzLm1hcmdpbkxlZnQgKSAvIDIgLSB0aGlzLm1hcmdpblRvcCAtIHRoaXMubWFyZ2luQm90dG9tO1xuICAgICAgICB0aGlzLmRhdGEgPSBzZXJpZXNHcm91cDtcbiAgICAgICAgXG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gdGhpcy5pbml0KHBhcmVudC5jb250YWluZXIpOyAvLyBUTyBETyAgdGhpcyBpcyBraW5kYSB3ZWlyZFxuICAgICAgICB0aGlzLnhTY2FsZVR5cGUgPSB0aGlzLmNvbmZpZy54U2NhbGVUeXBlIHx8ICd0aW1lJztcbiAgICAgICAgdGhpcy55U2NhbGVUeXBlID0gdGhpcy5jb25maWcueVNjYWxlVHlwZSB8fCAnbGluZWFyJztcbiAgICAgICAgdGhpcy54VGltZVR5cGUgPSB0aGlzLmNvbmZpZy54VGltZVR5cGUgfHwgJyVZJztcbiAgICAgICAgdGhpcy5zY2FsZUJ5ID0gdGhpcy5jb25maWcuc2NhbGVCeSB8fCAnc2VyaWVzLWdyb3VwJztcbiAgICAgICAgdGhpcy5pc0ZpcnN0UmVuZGVyID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zZXRTY2FsZXMoKTsgLy8gLy9TSE9VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFIFxuICAgICAgICB0aGlzLnNldFRvb2x0aXBzKCk7XG4gICAgICAgIHRoaXMuYWRkTGluZXMoKTtcbiAgICAgIC8vICB0aGlzLmFkZFBvaW50cygpO1xuICAgICAgICB0aGlzLmFkZFhBeGlzKCk7XG4gICAgICAgIHRoaXMuYWRkWUF4aXMoKTtcbiAgICAgICAgXG5cbiAgICAgICAgICAgICAgIFxuICAgIH07XG5cbiAgICBMaW5lQ2hhcnQucHJvdG90eXBlID0geyAvLyBlYWNoIExpbmVDaGFydCBpcyBhbiBzdmcgdGhhdCBob2xkIGdyb3VwZWQgc2VyaWVzXG4gICAgICAgIGRlZmF1bHRNYXJnaW5zOiB7XG4gICAgICAgICAgICB0b3A6MjcsXG4gICAgICAgICAgICByaWdodDo2NSxcbiAgICAgICAgICAgIGJvdHRvbToyNSxcbiAgICAgICAgICAgIGxlZnQ6MzVcbiAgICAgICAgfSxcbiAgICAgICAgICAgICAgXG4gICAgICAgIGluaXQoY2hhcnREaXYpeyAvLyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgdGhpcyBpcyBjYWxsZWQgb25jZSBmb3IgZWFjaCBzZXJpZXNHcm91cCBvZiBlYWNoIGNhdGVnb3J5LiBcbiAgICAgICAgICAgIEQzQ2hhcnRzLkNvbGxlY3RBbGwucHVzaCh0aGlzKTtcbiAgICAgICAgICAgIHZhciBjb250YWluZXIgPSAgZDMuc2VsZWN0KGNoYXJ0RGl2KVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3N2ZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3dpZHRoJywgdGhpcy53aWR0aCArIHRoaXMubWFyZ2luUmlnaHQgKyB0aGlzLm1hcmdpbkxlZnQgKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdoZWlnaHQnLCB0aGlzLmhlaWdodCAgKyB0aGlzLm1hcmdpblRvcCArIHRoaXMubWFyZ2luQm90dG9tICk7XG5cbiAgICAgICAgICAgIHRoaXMuc3ZnID0gY29udGFpbmVyLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsYHRyYW5zbGF0ZSgke3RoaXMubWFyZ2luTGVmdH0sICR7dGhpcy5tYXJnaW5Ub3B9KWApO1xuXG4gICAgICAgICAgICB0aGlzLnhBeGlzR3JvdXAgPSB0aGlzLnN2Zy5hcHBlbmQoJ2cnKTtcblxuICAgICAgICAgICAgdGhpcy55QXhpc0dyb3VwID0gdGhpcy5zdmcuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgIHRoaXMuYWxsU2VyaWVzID0gdGhpcy5zdmcuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcyA9IHRoaXMuYWxsU2VyaWVzLnNlbGVjdEFsbCgnZWFjaC1zZXJpZXMnKVxuICAgICAgICAgICAgICAgIC5kYXRhKHRoaXMuZGF0YSwgZCA9PiBkLmtleSlcbiAgICAgICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdlYWNoLXNlcmllcyBzZXJpZXMtJyArIHRoaXMucGFyZW50LnNlcmllc0NvdW50ICsgJyBjb2xvci0nICsgdGhpcy5wYXJlbnQuc2VyaWVzQ291bnQrKyAlIDQ7XG4gICAgICAgICAgICAgICAgfSk7XG4vKlxuICAgICAgICAgICAgdGhpcy5lYWNoU2VyaWVzLmVhY2goKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50LnNlcmllc0FycmF5LnB1c2goYXJyYXlbaV0pO1xuICAgICAgICAgICAgfSk7Ki9cbiAgICAgICAgICAgIGlmICggdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgJiYgdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgPT09IHRydWUgKXtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXBhcmVTdGFja2luZygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29udGFpbmVyLm5vZGUoKTtcbiAgICAgICAgfSxcbiAgICAgICAgdXBkYXRlKHZhcmlhYmxlWSA9IHRoaXMuY29uZmlnLnZhcmlhYmxlWSl7XG4gICAgICAgICAgICB0aGlzLmNvbmZpZy52YXJpYWJsZVkgPSB2YXJpYWJsZVk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmNvbmZpZy52YXJpYWJsZVksIHRoaXMuaXNGaXJzdFJlbmRlcik7XG5cbiAgICAgICAgICAgIHRoaXMucHJlcGFyZVN0YWNraW5nKCk7XG4gICAgICAgICAgICB0aGlzLnNldFNjYWxlcygpO1xuICAgICAgICAgICAgdGhpcy5hZGRMaW5lcygpO1xuXG4gICAgICAgIH0sXG4gICAgICAgIHByZXBhcmVTdGFja2luZygpe1xuICAgICAgICAgICAgdmFyIGZvclN0YWNraW5nID0gdGhpcy5kYXRhLnJlZHVjZSgoYWNjLGN1cixpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoIGkgPT09IDAgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1ci52YWx1ZXMuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY2MucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdOiBlYWNoW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtjdXIua2V5XTogZWFjaFt0aGlzLmNvbmZpZy52YXJpYWJsZVldXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1ci52YWx1ZXMuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY2MuZmluZChvYmogPT4gb2JqW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0gPT09IGVhY2hbdGhpcy5jb25maWcudmFyaWFibGVYXSlbY3VyLmtleV0gPSBlYWNoW3RoaXMuY29uZmlnLnZhcmlhYmxlWV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgIH0sW10pO1xuXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5zdGFjayA9IGQzLnN0YWNrKClcbiAgICAgICAgICAgICAgICAgICAgLmtleXModGhpcy5kYXRhLm1hcChlYWNoID0+IGVhY2gua2V5KSlcbiAgICAgICAgICAgICAgICAgICAgLm9yZGVyKGQzLnN0YWNrT3JkZXJOb25lKVxuICAgICAgICAgICAgICAgICAgICAub2Zmc2V0KGQzLnN0YWNrT2Zmc2V0Tm9uZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5zdGFja0RhdGEgPSB0aGlzLnN0YWNrKGZvclN0YWNraW5nKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0U2NhbGVzKCl7IC8vU0hPVUxEIEJFIElOIENIQVJUIFBST1RPVFlQRSAvLyBUTyBETzogU0VUIFNDQUxFUyBGT1IgT1RIRVIgR1JPVVAgVFlQRVNcblxuICAgICAgICAgICAgdmFyIGQzU2NhbGUgPSB7XG4gICAgICAgICAgICAgICAgdGltZTogZDMuc2NhbGVUaW1lKCksXG4gICAgICAgICAgICAgICAgbGluZWFyOiBkMy5zY2FsZUxpbmVhcigpXG4gICAgICAgICAgICAgICAgLy8gVE8gRE86IGFkZCBhbGwgc2NhbGUgdHlwZXMuXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIHhNYXhlcyA9IFtdLCB4TWlucyA9IFtdLCB5TWF4ZXMgPSBbXSwgeU1pbnMgPSBbXTtcbiAgICAgICAgICAgIGlmICggdGhpcy5zY2FsZUJ5ID09PSAnc2VyaWVzLWdyb3VwJyApe1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgeE1heGVzLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0ubWF4KTtcbiAgICAgICAgICAgICAgICAgICAgeE1pbnMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1bdGhpcy5jb25maWcudmFyaWFibGVYXS5taW4pO1xuICAgICAgICAgICAgICAgICAgICB5TWF4ZXMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1bdGhpcy5jb25maWcudmFyaWFibGVZXS5tYXgpO1xuICAgICAgICAgICAgICAgICAgICB5TWlucy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt0aGlzLmNvbmZpZy52YXJpYWJsZVldLm1pbik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnhNYXggPSBkMy5tYXgoeE1heGVzKTtcbiAgICAgICAgICAgIHRoaXMueE1pbiA9IGQzLm1pbih4TWlucyk7XG4gICAgICAgICAgICB0aGlzLnlNYXggPSBkMy5tYXgoeU1heGVzKTtcbiAgICAgICAgICAgIHRoaXMueU1pbiA9IGQzLm1pbih5TWlucyk7XG4gICAgICAgICAgICB0aGlzLnhWYWx1ZXNVbmlxdWUgPSBbXTtcblxuICAgICAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy5zdGFja1NlcmllcyAmJiB0aGlzLmNvbmZpZy5zdGFja1NlcmllcyA9PT0gdHJ1ZSApe1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHRoaXMuc3RhY2tEYXRhKTtcbiAgICAgICAgICAgICAgICB2YXIgeVZhbHVlcyA9IHRoaXMuc3RhY2tEYXRhLnJlZHVjZSgoYWNjLCBjdXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coY3VyKTtcbiAgICAgICAgICAgICAgICAgICAgYWNjLnB1c2goLi4uY3VyLnJlZHVjZSgoYWNjMSwgY3VyMSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjMS5wdXNoKGN1cjFbMF0sIGN1cjFbMV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYzE7XG4gICAgICAgICAgICAgICAgICAgIH0sW10pKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgICAgICAgICB9LFtdKTtcbiAgICAgICAgICAgICAgICB0aGlzLnlNYXggPSBkMy5tYXgoeVZhbHVlcyk7XG4gICAgICAgICAgICAgICAgdGhpcy55TWluID0gZDMubWluKHlWYWx1ZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHhSYW5nZSA9IFswLCB0aGlzLndpZHRoXSxcbiAgICAgICAgICAgICAgICB5UmFuZ2UgPSBbdGhpcy5oZWlnaHQsIDBdLFxuICAgICAgICAgICAgICAgIHhEb21haW4sXG4gICAgICAgICAgICAgICAgeURvbWFpbjtcbiAgICAgICAgICAgIGlmICggdGhpcy54U2NhbGVUeXBlID09PSAndGltZScpIHtcbiAgICAgICAgICAgICAgICB4RG9tYWluID0gW2QzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkodGhpcy54TWluKSwgZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKSh0aGlzLnhNYXgpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIFRPIERPOiBPVEhFUiBkYXRhIHR5cGVzID9cbiAgICAgICAgICAgICAgICB4RG9tYWluID0gW3RoaXMueE1pbiwgdGhpcy54TWF4XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICggdGhpcy55U2NhbGVUeXBlID09PSAndGltZScpIHtcbiAgICAgICAgICAgICAgICB5RG9tYWluID0gW2QzLnRpbWVQYXJzZSh0aGlzLnlUaW1lVHlwZSkodGhpcy55TWluKSwgZDMudGltZVBhcnNlKHRoaXMueVRpbWVUeXBlKSh0aGlzLnlNYXgpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIFRPIERPOiBPVEhFUiBkYXRhIHR5cGVzID9cbiAgICAgICAgICAgICAgICB5RG9tYWluID0gW3RoaXMueU1pbiwgdGhpcy55TWF4XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy54U2NhbGUgPSBkM1NjYWxlW3RoaXMueFNjYWxlVHlwZV0uZG9tYWluKHhEb21haW4pLnJhbmdlKHhSYW5nZSk7XG4gICAgICAgICAgICB0aGlzLnlTY2FsZSA9IGQzU2NhbGVbdGhpcy55U2NhbGVUeXBlXS5kb21haW4oeURvbWFpbikucmFuZ2UoeVJhbmdlKTtcblxuXG4gICAgICAgIH0sXG4gICAgICAgIGFkZExpbmVzKCl7XG4gICAgICAgICAgICB2YXIgemVyb1ZhbHVlbGluZSA9IGQzLmxpbmUoKVxuICAgICAgICAgICAgICAgIC54KGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMueFZhbHVlc1VuaXF1ZS5pbmRleE9mKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkgPT09IC0xICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnhWYWx1ZXNVbmlxdWUucHVzaChkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpO1xuICAgICAgICAgICAgICAgIH0pIFxuICAgICAgICAgICAgICAgIC55KCgpID0+IHRoaXMueVNjYWxlKDApKTtcblxuICAgICAgICAgICAgdmFyIHZhbHVlbGluZSA9IGQzLmxpbmUoKVxuICAgICAgICAgICAgICAgIC54KGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMueFZhbHVlc1VuaXF1ZS5pbmRleE9mKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkgPT09IC0xICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnhWYWx1ZXNVbmlxdWUucHVzaChkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpO1xuICAgICAgICAgICAgICAgIH0pIFxuICAgICAgICAgICAgICAgIC55KChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy55U2NhbGUoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVldKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy5zdGFja1NlcmllcyAmJiB0aGlzLmNvbmZpZy5zdGFja1NlcmllcyA9PT0gdHJ1ZSApe1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBhcmVhID0gZDMuYXJlYSgpXG4gICAgICAgICAgICAgICAgICAgIC54KGQgPT4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkLmRhdGFbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgICAgICAueTAoZCA9PiB0aGlzLnlTY2FsZShkWzBdKSlcbiAgICAgICAgICAgICAgICAgICAgLnkxKGQgPT4gdGhpcy55U2NhbGUoZFsxXSkpO1xuXG4gICAgICAgICAgICAgICAgdmFyIGxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAgICAgLngoZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGQuZGF0YVt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSkpXG4gICAgICAgICAgICAgICAgICAgIC55KGQgPT4gdGhpcy55U2NhbGUoZFsxXSkpO1xuXG4gICAgICAgICAgICAgICAgdmFyIHN0YWNrR3JvdXAgPSB0aGlzLnN2Zy5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnc3RhY2tlZC1hcmVhJyk7XG4gICAgICAgICAgICAgICAgICAgIFxuXG4gICAgICAgICAgICAgICAgc3RhY2tHcm91cCAgICBcbiAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnc3RhY2tlZC1hcmVhJylcbiAgICAgICAgICAgICAgICAgICAgLmRhdGEodGhpcy5zdGFja0RhdGEpXG4gICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgncGF0aCcpIC8vIFRPIERPOiBhZGQgemVyby1saW5lIGVxdWl2YWxlbnQgYW5kIGxvZ2ljIGZvciB0cmFuc2l0aW9uIG9uIHVwZGF0ZVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoZCxpKSA9PiAnYXJlYS1saW5lIGNvbG9yLScgKyBpKSAvLyBUTyBETyBub3QgcXVpdGUgcmlnaHQgdGhhdCBjb2xvciBzaG9sZCBiZSBgaWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiB5b3UgaGF2ZSBtb3JlIHRoYW4gb25lIGdyb3VwIG9mIHNlcmllcywgd2lsbCByZXBlYXRcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCBkID0+IGFyZWEoZCkpO1xuXG4gICAgICAgICAgICAgICAgc3RhY2tHcm91cFxuICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzdGFja2VkLWxpbmUnKSAvLyBUTyBETzogYWRkIHplcm8tbGluZSBlcXVpdmFsZW50IGFuZCBsb2dpYyBmb3IgdHJhbnNpdGlvbiBvbiB1cGRhdGVcbiAgICAgICAgICAgICAgICAgICAgLmRhdGEodGhpcy5zdGFja0RhdGEpXG4gICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsIChkLGkpID0+ICdsaW5lIGNvbG9yLScgKyBpKSBcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCBkID0+IGxpbmUoZCkpO1xuXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICggdGhpcy5pc0ZpcnN0UmVuZGVyICl7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmxpbmVzID0gdGhpcy5lYWNoU2VyaWVzLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCdsaW5lJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gemVyb1ZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApLmRlbGF5KDE1MClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAub24oJ2VuZCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGkgPT09IGFycmF5Lmxlbmd0aCAtIDEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkUG9pbnRzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkTGFiZWxzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdEFsbCh0aGlzLmxpbmVzLm5vZGVzKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdEFsbCh0aGlzLnBvaW50cy5ub2RlcygpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY3gnLCBkID0+IHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY3knLCBkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmNvbmZpZy52YXJpYWJsZVkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnlTY2FsZShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3RBbGwodGhpcy5sYWJlbEdyb3Vwcy5ub2RlcygpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKGQpID0+IGB0cmFuc2xhdGUoJHt0aGlzLndpZHRoICsgOH0sICR7dGhpcy55U2NhbGUoZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdGhpcy5jb25maWcudmFyaWFibGVZXSkgKyAzfSlgKTtcblxuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3RBbGwodGhpcy5sYWJlbHMubm9kZXMoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdlbmQnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGkgPT09IGFycmF5Lmxlbmd0aCAtIDEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWxheExhYmVscygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdEFsbCh0aGlzLnlBeGlzR3JvdXAubm9kZXMoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQodGhpcy55U2NhbGUpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrcyg1KSk7XG5cblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgYWRkWEF4aXMoKXsgLy8gY291bGQgYmUgaW4gQ2hhcnQgcHJvdG90eXBlID9cbiAgICAgICAgICAgIHZhciB4QXhpc1Bvc2l0aW9uLFxuICAgICAgICAgICAgICAgIHhBeGlzT2Zmc2V0LFxuICAgICAgICAgICAgICAgIGF4aXNUeXBlO1xuXG4gICAgICAgICAgICBpZiAoIHRoaXMuY29uZmlnLnhBeGlzUG9zaXRpb24gPT09ICd0b3AnICl7XG4gICAgICAgICAgICAgICAgeEF4aXNQb3NpdGlvbiA9IHRoaXMueU1heDtcbiAgICAgICAgICAgICAgICB4QXhpc09mZnNldCA9IC10aGlzLm1hcmdpblRvcDtcbiAgICAgICAgICAgICAgICBheGlzVHlwZSA9IGQzLmF4aXNUb3A7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHhBeGlzUG9zaXRpb24gPSB0aGlzLnlNaW47XG4gICAgICAgICAgICAgICAgeEF4aXNPZmZzZXQgPSB0aGlzLm1hcmdpbkJvdHRvbSAtIDE1O1xuICAgICAgICAgICAgICAgIGF4aXNUeXBlID0gZDMuYXhpc0JvdHRvbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBheGlzID0gYXhpc1R5cGUodGhpcy54U2NhbGUpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKTtcbiAgICAgICAgICAgIGlmICggdGhpcy54U2NhbGVUeXBlID09PSAndGltZScgKXtcbiAgICAgICAgICAgICAgICBheGlzLnRpY2tWYWx1ZXModGhpcy54VmFsdWVzVW5pcXVlLm1hcChlYWNoID0+IGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZWFjaCkpKTsgLy8gVE8gRE86IGFsbG93IGZvciBvdGhlciB4QXhpcyBBZGp1c3RtZW50c1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy54QXhpc0dyb3VwXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoMCwnICsgKCB0aGlzLnlTY2FsZSh4QXhpc1Bvc2l0aW9uKSArIHhBeGlzT2Zmc2V0ICkgKyAnKScpIC8vIG5vdCBwcm9ncmFtYXRpYyBwbGFjZW1lbnQgb2YgeC1heGlzXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2F4aXMgeC1heGlzJylcbiAgICAgICAgICAgICAgICAuY2FsbChheGlzKTtcbiAgICAgICAgfSxcbiAgICAgICAgYWRkWUF4aXMoKXtcbiAgICAgICAgICAgIC8qIGF4aXMgKi9cbiAgICAgICAgICAgIHRoaXMueUF4aXNHcm91cFxuICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiAnYXhpcyB5LWF4aXMgJylcbiAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQodGhpcy55U2NhbGUpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrcyg1KSk7XG5cbiAgICAgICAgICAgIGlmICggdGhpcy55TWluIDwgMCApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnlBeGlzR3JvdXBcbiAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnLnRpY2snKVxuICAgICAgICAgICAgICAgICAgICAuZWFjaChmdW5jdGlvbihkLGkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCd6ZXJvJywgZCA9PT0gMCAmJiBpICE9PSAwKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgLyogbGFiZWxzICovXG4gICAgICAgICAgICB2YXIgdW5pdHNMYWJlbHMgPSB0aGlzLmVhY2hTZXJpZXMuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3VuaXRzJylcbiAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICgpID0+IGB0cmFuc2xhdGUoLSR7dGhpcy5tYXJnaW5MZWZ0IC01IH0sLSR7dGhpcy5tYXJnaW5Ub3AgLSAxNH0pYClcbiAgICAgICAgICAgICAgLmh0bWwoKGQsaSkgPT4gaSA9PT0gMCA/IHRoaXMucGFyZW50LnVuaXRzKGQua2V5KSA6IG51bGwpO1xuXG4gICAgICAgICAgICB2YXIgbGFiZWxUb29sdGlwID0gZDMudGlwKClcbiAgICAgICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwiZDMtdGlwIGxhYmVsLXRpcFwiKVxuICAgICAgICAgICAgICAgIC5kaXJlY3Rpb24oJ2UnKVxuICAgICAgICAgICAgICAgIC5vZmZzZXQoWy0yLCA0XSk7XG4gICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG1vdXNlb3ZlcihkKXtcbiAgICAgICAgICAgICAgICBpZiAoIHdpbmRvdy5vcGVuVG9vbHRpcCApIHtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwLmhpZGUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGFiZWxUb29sdGlwLmh0bWwodGhpcy5wYXJlbnQudW5pdHNEZXNjcmlwdGlvbihkLmtleSkpO1xuICAgICAgICAgICAgICAgIGxhYmVsVG9vbHRpcC5zaG93KCk7XG4gICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwID0gbGFiZWxUb29sdGlwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1bml0c0xhYmVscy5lYWNoKChkLCBpLCBhcnJheSkgPT4geyAvLyBUTyBETyB0aGlzIGlzIHJlcGV0aXRpdmUgb2YgYWRkTGFiZWxzKClcbiAgICAgICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50LnVuaXRzRGVzY3JpcHRpb24oZC5rZXkpICE9PSB1bmRlZmluZWQgJiYgZDMuc2VsZWN0KGFycmF5W2ldKS5odG1sKCkgIT09ICcnKXtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5wYXJlbnQudW5pdHNEZXNjcmlwdGlvbihkLmtleSkpO1xuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QoYXJyYXlbaV0pXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC5odG1sKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQzLnNlbGVjdCh0aGlzKS5odG1sKCkgKyAnPHRzcGFuIGR5PVwiLTAuMmVtXCIgY2xhc3M9XCJpbmZvLW1hcmtcIj4mIzk0MzI7PC90c3Bhbj4nOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2xhc3NlZCgnaGFzLXRvb2x0aXAnLCB0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdtb3VzZW92ZXInLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXlbaV0uZm9jdXMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAub24oJ2ZvY3VzJywgZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW91c2VvdmVyLmNhbGwodGhpcyxkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAub24oJ21vdXNlb3V0JywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5W2ldLmJsdXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAub24oJ2JsdXInLCBsYWJlbFRvb2x0aXAuaGlkZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsKGxhYmVsVG9vbHRpcCk7ICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgXG4gICAgICAgIH0sXG4gICAgICAgIGFkZExhYmVscygpe1xuXG4gICAgICAgICAgICB2YXIgbGFiZWxUb29sdGlwID0gZDMudGlwKClcbiAgICAgICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwiZDMtdGlwIGxhYmVsLXRpcFwiKVxuICAgICAgICAgICAgICAgIC5kaXJlY3Rpb24oJ24nKVxuICAgICAgICAgICAgICAgIC5vZmZzZXQoWy00LCAxMl0pO1xuICAgICAgICAgICAgICAgIFxuXG4gICAgICAgICAgICBmdW5jdGlvbiBtb3VzZW92ZXIoZCl7XG4gICAgICAgICAgICAgICAgaWYgKCB3aW5kb3cub3BlblRvb2x0aXAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcC5oaWRlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxhYmVsVG9vbHRpcC5odG1sKHRoaXMucGFyZW50LmRlc2NyaXB0aW9uKGQua2V5KSk7XG4gICAgICAgICAgICAgICAgbGFiZWxUb29sdGlwLnNob3coKTtcbiAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAgPSBsYWJlbFRvb2x0aXA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubGFiZWxHcm91cHMgPSB0aGlzLmVhY2hTZXJpZXNcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgIHRoaXMubGFiZWxzID0gdGhpcy5sYWJlbEdyb3Vwc1xuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoZCkgPT4gYHRyYW5zbGF0ZSgke3RoaXMud2lkdGggKyA4fSwgJHt0aGlzLnlTY2FsZShkLnZhbHVlc1tkLnZhbHVlcy5sZW5ndGggLSAxXVt0aGlzLmNvbmZpZy52YXJpYWJsZVldKSArIDN9KWApXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdzZXJpZXMtbGFiZWwnKVxuICAgICAgICAgICAgICAgIC5odG1sKChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnPHRzcGFuIHg9XCIwXCI+JyArIHRoaXMucGFyZW50LmxhYmVsKGQua2V5KS5yZXBsYWNlKC9cXFxcbi9nLCc8L3RzcGFuPjx0c3BhbiB4PVwiMC41ZW1cIiBkeT1cIjEuMmVtXCI+JykgKyAnPC90c3Bhbj4nO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLmxhYmVscy5lYWNoKChkLCBpLCBhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICggdGhpcy5wYXJlbnQuZGVzY3JpcHRpb24oZC5rZXkpICE9PSB1bmRlZmluZWQgJiYgdGhpcy5wYXJlbnQuZGVzY3JpcHRpb24oZC5rZXkpICE9PSAnJyl7XG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5odG1sKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQzLnNlbGVjdCh0aGlzKS5odG1sKCkgKyAnPHRzcGFuIGR5PVwiLTAuMmVtXCIgY2xhc3M9XCJpbmZvLW1hcmtcIj4mIzk0MzI7PC90c3Bhbj4nOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApIFxuICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2hhcy10b29sdGlwJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5W2ldLmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsIGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vdXNlb3Zlci5jYWxsKHRoaXMsZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5ibHVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdibHVyJywgbGFiZWxUb29sdGlwLmhpZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChsYWJlbFRvb2x0aXApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5pc0ZpcnN0UmVuZGVyID0gZmFsc2U7XG4gICAgICAgICAgICBcblxuICAgICAgICAgICAgdGhpcy5yZWxheExhYmVscygpO1xuICAgICAgICAgICBcbiAgICAgICAgICAgXG4gICAgICAgIH0sXG4gICAgICAgIHJlbGF4TGFiZWxzKCl7IC8vIEhUIGh0dHA6Ly9qc2ZpZGRsZS5uZXQvdGh1ZGZhY3Rvci9CMldCVS8gYWRhcHRlZCB0ZWNobmlxdWVcbiAgICAgICAgICAgIHZhciBhbHBoYSA9IDEsXG4gICAgICAgICAgICAgICAgc3BhY2luZyA9IDAsXG4gICAgICAgICAgICAgICAgYWdhaW4gPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5sYWJlbHMuZWFjaCgoZCxpLGFycmF5MSkgPT4ge1xuICAgICAgICAgICAgICAgIHZhciBhID0gYXJyYXkxW2ldLFxuICAgICAgICAgICAgICAgICAgICAkYSA9IGQzLnNlbGVjdChhKSxcbiAgICAgICAgICAgICAgICAgICAgeUEgPSAkYS5hdHRyKCd5JyksXG4gICAgICAgICAgICAgICAgICAgIGFSYW5nZSA9IGQzLnJhbmdlKE1hdGgucm91bmQoYS5nZXRDVE0oKS5mKSAtIHNwYWNpbmcgKyBwYXJzZUludCh5QSksIE1hdGgucm91bmQoYS5nZXRDVE0oKS5mKSArIE1hdGgucm91bmQoYS5nZXRCQm94KCkuaGVpZ2h0KSArIDEgKyBzcGFjaW5nICsgcGFyc2VJbnQoeUEpKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubGFiZWxzLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGIgPSB0aGlzLFxuICAgICAgICAgICAgICAgICAgICAkYiA9IGQzLnNlbGVjdChiKSxcbiAgICAgICAgICAgICAgICAgICAgeUIgPSAkYi5hdHRyKCd5Jyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICggYSA9PT0gYiApIHtyZXR1cm47fVxuICAgICAgICAgICAgICAgICAgICB2YXIgYkxpbWl0cyA9IFtNYXRoLnJvdW5kKGIuZ2V0Q1RNKCkuZikgLSBzcGFjaW5nICsgcGFyc2VJbnQoeUIpLCBNYXRoLnJvdW5kKGIuZ2V0Q1RNKCkuZikgKyBiLmdldEJCb3goKS5oZWlnaHQgKyBzcGFjaW5nICsgcGFyc2VJbnQoeUIpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCAoYVJhbmdlWzBdIDwgYkxpbWl0c1swXSAmJiBhUmFuZ2VbYVJhbmdlLmxlbmd0aCAtIDFdIDwgYkxpbWl0c1swXSkgfHwgKGFSYW5nZVswXSA+IGJMaW1pdHNbMV0gJiYgYVJhbmdlW2FSYW5nZS5sZW5ndGggLSAxXSA+IGJMaW1pdHNbMV0pICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdubyBjb2xsaXNpb24nLCBhLCBiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfSAvLyBubyBjb2xsaXNvblxuICAgICAgICAgICAgICAgICAgICB2YXIgc2lnbiA9IGJMaW1pdHNbMF0gLSBhUmFuZ2VbYVJhbmdlLmxlbmd0aCAtIDFdIDw9IGFSYW5nZVswXSAtIGJMaW1pdHNbMV0gPyAxIDogLTEsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGp1c3QgPSBzaWduICogYWxwaGE7XG4gICAgICAgICAgICAgICAgICAgICRiLmF0dHIoJ3knLCAoK3lCIC0gYWRqdXN0KSApO1xuICAgICAgICAgICAgICAgICAgICAkYS5hdHRyKCd5JywgKCt5QSArIGFkanVzdCkgKTtcbiAgICAgICAgICAgICAgICAgICAgYWdhaW4gPSB0cnVlOyBcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIGkgPT09IGFycmF5MS5sZW5ndGggLSAxICYmIGFnYWluID09PSB0cnVlICkge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVsYXhMYWJlbHMoKTtcbiAgICAgICAgICAgICAgICAgICAgfSwyMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGFkZFBvaW50cygpe1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmdW5jdGlvbiBtb3VzZW92ZXIoZCxpLGFycmF5KXtcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoIHdpbmRvdy5vcGVuVG9vbHRpcCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcC5oaWRlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdmFyIGtsYXNzID0gYXJyYXlbaV0ucGFyZW50Tm9kZS5jbGFzc0xpc3QudmFsdWUubWF0Y2goL2NvbG9yLVxcZC8pWzBdOyAvLyBnZXQgdGhlIGNvbG9yIGNsYXNzIG9mIHRoZSBwYXJlbnQgZ1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJywgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJykgKyAnICcgKyBrbGFzcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuaHRtbCgnPHN0cm9uZz4nICsgdGhpcy5wYXJlbnQudGlwVGV4dChkLnNlcmllcykgKyAnPC9zdHJvbmc+ICgnICsgZC55ZWFyICsgJyk8YnIgLz4nICsgZFt0aGlzLmNvbmZpZy52YXJpYWJsZVldICsgJyAnICsgdGhpcy5wYXJlbnQudW5pdHMoZC5zZXJpZXMpICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuc2hvdygpO1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAgPSB0aGlzLnRvb2x0aXA7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmdW5jdGlvbiBtb3VzZW91dCgpe1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdtb3VzZW91dCcpO1xuICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycsIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycpLnJlcGxhY2UoLyBjb2xvci1cXGQvZywgJycpKTtcbiAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuaHRtbCgnJyk7XG4gICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmhpZGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucG9pbnRzID0gdGhpcy5lYWNoU2VyaWVzLnNlbGVjdEFsbCgncG9pbnRzJylcbiAgICAgICAgICAgICAgICAuZGF0YShkID0+IGQudmFsdWVzLCBkID0+IGQua2V5KVxuICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnY2lyY2xlJylcbiAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ29wYWNpdHknLCAwKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdkYXRhLXBvaW50JylcbiAgICAgICAgICAgICAgICAuYXR0cigncicsICc0JylcbiAgICAgICAgICAgICAgICAuYXR0cignY3gnLCBkID0+IHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSkpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2N5JywgZCA9PiB0aGlzLnlTY2FsZShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pKVxuICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5mb2N1cygpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbW91c2VvdmVyLmNhbGwodGhpcyxkLGksYXJyYXkpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgYXJyYXlbaV0uYmx1cigpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdibHVyJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtb3VzZW91dC5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdjbGljaycsIHRoaXMuYnJpbmdUb1RvcClcbiAgICAgICAgICAgICAgICAub24oJ2tleXVwJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkMy5ldmVudCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkMy5ldmVudC5rZXlDb2RlID09PSAxMyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJyaW5nVG9Ub3AuY2FsbChhcnJheVtpXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYWxsKHRoaXMudG9vbHRpcClcbiAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAuYXR0cignb3BhY2l0eScsIDEpO1xuICAgICAgICAgICAgXG5cbiAgICAgICAgfSxcbiAgICAgICAgYnJpbmdUb1RvcCgpe1xuICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5wYXJlbnROb2RlICE9PSB0aGlzLnBhcmVudE5vZGUucGFyZW50Tm9kZS5sYXN0Q2hpbGQpO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnBhcmVudE5vZGUgIT09IHRoaXMucGFyZW50Tm9kZS5wYXJlbnROb2RlLmxhc3RDaGlsZCApe1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjbGljaycsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzLnBhcmVudE5vZGUpLm1vdmVUb0Zyb250KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5mb2N1cygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzZXRUb29sdGlwcygpe1xuXG4gICAgICAgICAgICB0aGlzLnRvb2x0aXAgPSBkMy50aXAoKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJkMy10aXBcIilcbiAgICAgICAgICAgICAgICAuZGlyZWN0aW9uKCduJylcbiAgICAgICAgICAgICAgICAub2Zmc2V0KFstOCwgMF0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgfTtcblxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgQ2hhcnREaXZcbiAgICB9O1xuXG59KSgpO1xuIiwiZXhwb3J0IGNvbnN0IEhlbHBlcnMgPSAoZnVuY3Rpb24oKXtcbiAgICAvKiBnbG9iYWxzIERPTVN0cmluZ01hcCwgZDMgKi9cbiAgICBTdHJpbmcucHJvdG90eXBlLmNsZWFuU3RyaW5nID0gZnVuY3Rpb24oKSB7IC8vIGxvd2VyY2FzZSBhbmQgcmVtb3ZlIHB1bmN0dWF0aW9uIGFuZCByZXBsYWNlIHNwYWNlcyB3aXRoIGh5cGhlbnM7IGRlbGV0ZSBwdW5jdHVhdGlvblxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9bIFxcXFxcXC9dL2csJy0nKS5yZXBsYWNlKC9bJ1wi4oCd4oCZ4oCc4oCYLFxcLiFcXD87XFwoXFwpJl0vZywnJykudG9Mb3dlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgU3RyaW5nLnByb3RvdHlwZS5yZW1vdmVVbmRlcnNjb3JlcyA9IGZ1bmN0aW9uKCkgeyBcbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvXy9nLCcgJyk7XG4gICAgfTtcblxuICAgIERPTVN0cmluZ01hcC5wcm90b3R5cGUuY29udmVydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbmV3T2JqID0ge307XG4gICAgICAgIGZvciAoIHZhciBrZXkgaW4gdGhpcyApe1xuICAgICAgICAgICAgaWYgKHRoaXMuaGFzT3duUHJvcGVydHkoa2V5KSl7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbmV3T2JqW2tleV0gPSBKU09OLnBhcnNlKHRoaXNba2V5XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgICAgICBuZXdPYmpba2V5XSA9IHRoaXNba2V5XTsgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld09iajtcbiAgICB9O1xuXG4gICAgZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5tb3ZlVG9Gcm9udCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHRoaXMucGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0aGlzKTtcbiAgICAgICAgICB9KTtcbiAgICB9O1xuICAgIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUubW92ZVRvQmFjayA9IGZ1bmN0aW9uKCl7IFxuICAgICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICB2YXIgZmlyc3RDaGlsZCA9IHRoaXMucGFyZW50Tm9kZS5maXJzdENoaWxkO1xuICAgICAgICAgICAgaWYgKCBmaXJzdENoaWxkICkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUodGhpcywgZmlyc3RDaGlsZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG59KSgpO1xuIiwiLy8gZDMudGlwXG4vLyBDb3B5cmlnaHQgKGMpIDIwMTMgSnVzdGluIFBhbG1lclxuLy8gRVM2IC8gRDMgdjQgQWRhcHRpb24gQ29weXJpZ2h0IChjKSAyMDE2IENvbnN0YW50aW4gR2F2cmlsZXRlXG4vLyBSZW1vdmFsIG9mIEVTNiBmb3IgRDMgdjQgQWRhcHRpb24gQ29weXJpZ2h0IChjKSAyMDE2IERhdmlkIEdvdHpcbi8vXG4vLyBUb29sdGlwcyBmb3IgZDMuanMgU1ZHIHZpc3VhbGl6YXRpb25zXG5cbmV4cG9ydCBjb25zdCBkM1RpcCA9IChmdW5jdGlvbigpe1xuICBkMy5mdW5jdG9yID0gZnVuY3Rpb24gZnVuY3Rvcih2KSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2ID09PSBcImZ1bmN0aW9uXCIgPyB2IDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdjtcbiAgICB9O1xuICB9O1xuXG4gIGQzLnRpcCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIGRpcmVjdGlvbiA9IGQzX3RpcF9kaXJlY3Rpb24sXG4gICAgICAgIG9mZnNldCAgICA9IGQzX3RpcF9vZmZzZXQsXG4gICAgICAgIGh0bWwgICAgICA9IGQzX3RpcF9odG1sLFxuICAgICAgICBub2RlICAgICAgPSBpbml0Tm9kZSgpLFxuICAgICAgICBzdmcgICAgICAgPSBudWxsLFxuICAgICAgICBwb2ludCAgICAgPSBudWxsLFxuICAgICAgICB0YXJnZXQgICAgPSBudWxsXG5cbiAgICBmdW5jdGlvbiB0aXAodmlzKSB7XG4gICAgICBzdmcgPSBnZXRTVkdOb2RlKHZpcylcbiAgICAgIHBvaW50ID0gc3ZnLmNyZWF0ZVNWR1BvaW50KClcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm9kZSlcbiAgICB9XG5cbiAgICAvLyBQdWJsaWMgLSBzaG93IHRoZSB0b29sdGlwIG9uIHRoZSBzY3JlZW5cbiAgICAvL1xuICAgIC8vIFJldHVybnMgYSB0aXBcbiAgICB0aXAuc2hvdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgICBpZihhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gaW5zdGFuY2VvZiBTVkdFbGVtZW50KSB0YXJnZXQgPSBhcmdzLnBvcCgpXG5cbiAgICAgIHZhciBjb250ZW50ID0gaHRtbC5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBwb2Zmc2V0ID0gb2Zmc2V0LmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIGRpciAgICAgPSBkaXJlY3Rpb24uYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgbm9kZWwgICA9IGdldE5vZGVFbCgpLFxuICAgICAgICAgIGkgICAgICAgPSBkaXJlY3Rpb25zLmxlbmd0aCxcbiAgICAgICAgICBjb29yZHMsXG4gICAgICAgICAgc2Nyb2xsVG9wICA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AsXG4gICAgICAgICAgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdFxuXG4gICAgICBub2RlbC5odG1sKGNvbnRlbnQpXG4gICAgICAgIC5zdHlsZSgncG9zaXRpb24nLCAnYWJzb2x1dGUnKVxuICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAxKVxuICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ2FsbCcpXG5cbiAgICAgIHdoaWxlKGktLSkgbm9kZWwuY2xhc3NlZChkaXJlY3Rpb25zW2ldLCBmYWxzZSlcbiAgICAgIGNvb3JkcyA9IGRpcmVjdGlvbl9jYWxsYmFja3NbZGlyXS5hcHBseSh0aGlzKVxuICAgICAgbm9kZWwuY2xhc3NlZChkaXIsIHRydWUpXG4gICAgICAgIC5zdHlsZSgndG9wJywgKGNvb3Jkcy50b3AgKyAgcG9mZnNldFswXSkgKyBzY3JvbGxUb3AgKyAncHgnKVxuICAgICAgICAuc3R5bGUoJ2xlZnQnLCAoY29vcmRzLmxlZnQgKyBwb2Zmc2V0WzFdKSArIHNjcm9sbExlZnQgKyAncHgnKVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljIC0gaGlkZSB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5oaWRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbm9kZWwgPSBnZXROb2RlRWwoKVxuICAgICAgbm9kZWxcbiAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywgMClcbiAgICAgICAgLnN0eWxlKCdwb2ludGVyLWV2ZW50cycsICdub25lJylcbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFByb3h5IGF0dHIgY2FsbHMgdG8gdGhlIGQzIHRpcCBjb250YWluZXIuICBTZXRzIG9yIGdldHMgYXR0cmlidXRlIHZhbHVlLlxuICAgIC8vXG4gICAgLy8gbiAtIG5hbWUgb2YgdGhlIGF0dHJpYnV0ZVxuICAgIC8vIHYgLSB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIHRpcCBvciBhdHRyaWJ1dGUgdmFsdWVcbiAgICB0aXAuYXR0ciA9IGZ1bmN0aW9uKG4sIHYpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMiAmJiB0eXBlb2YgbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGdldE5vZGVFbCgpLmF0dHIobilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBhcmdzID0gIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgICAgZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5hdHRyLmFwcGx5KGdldE5vZGVFbCgpLCBhcmdzKVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBQcm94eSBzdHlsZSBjYWxscyB0byB0aGUgZDMgdGlwIGNvbnRhaW5lci4gIFNldHMgb3IgZ2V0cyBhIHN0eWxlIHZhbHVlLlxuICAgIC8vXG4gICAgLy8gbiAtIG5hbWUgb2YgdGhlIHByb3BlcnR5XG4gICAgLy8gdiAtIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3Igc3R5bGUgcHJvcGVydHkgdmFsdWVcbiAgICB0aXAuc3R5bGUgPSBmdW5jdGlvbihuLCB2KSB7XG4gICAgICAvLyBkZWJ1Z2dlcjtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMiAmJiB0eXBlb2YgbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGdldE5vZGVFbCgpLnN0eWxlKG4pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIHZhciBzdHlsZXMgPSBhcmdzWzBdO1xuICAgICAgICAgIE9iamVjdC5rZXlzKHN0eWxlcykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBkMy5zZWxlY3Rpb24ucHJvdG90eXBlLnN0eWxlLmFwcGx5KGdldE5vZGVFbCgpLCBba2V5LCBzdHlsZXNba2V5XV0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFNldCBvciBnZXQgdGhlIGRpcmVjdGlvbiBvZiB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIE9uZSBvZiBuKG5vcnRoKSwgcyhzb3V0aCksIGUoZWFzdCksIG9yIHcod2VzdCksIG53KG5vcnRod2VzdCksXG4gICAgLy8gICAgIHN3KHNvdXRod2VzdCksIG5lKG5vcnRoZWFzdCkgb3Igc2Uoc291dGhlYXN0KVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3IgZGlyZWN0aW9uXG4gICAgdGlwLmRpcmVjdGlvbiA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGRpcmVjdGlvblxuICAgICAgZGlyZWN0aW9uID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogU2V0cyBvciBnZXRzIHRoZSBvZmZzZXQgb2YgdGhlIHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIEFycmF5IG9mIFt4LCB5XSBvZmZzZXRcbiAgICAvL1xuICAgIC8vIFJldHVybnMgb2Zmc2V0IG9yXG4gICAgdGlwLm9mZnNldCA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIG9mZnNldFxuICAgICAgb2Zmc2V0ID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogc2V0cyBvciBnZXRzIHRoZSBodG1sIHZhbHVlIG9mIHRoZSB0b29sdGlwXG4gICAgLy9cbiAgICAvLyB2IC0gU3RyaW5nIHZhbHVlIG9mIHRoZSB0aXBcbiAgICAvL1xuICAgIC8vIFJldHVybnMgaHRtbCB2YWx1ZSBvciB0aXBcbiAgICB0aXAuaHRtbCA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGh0bWxcbiAgICAgIGh0bWwgPSB2ID09IG51bGwgPyB2IDogZDMuZnVuY3Rvcih2KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBkZXN0cm95cyB0aGUgdG9vbHRpcCBhbmQgcmVtb3ZlcyBpdCBmcm9tIHRoZSBET01cbiAgICAvL1xuICAgIC8vIFJldHVybnMgYSB0aXBcbiAgICB0aXAuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYobm9kZSkge1xuICAgICAgICBnZXROb2RlRWwoKS5yZW1vdmUoKTtcbiAgICAgICAgbm9kZSA9IG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGlwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGQzX3RpcF9kaXJlY3Rpb24oKSB7IHJldHVybiAnbicgfVxuICAgIGZ1bmN0aW9uIGQzX3RpcF9vZmZzZXQoKSB7IHJldHVybiBbMCwgMF0gfVxuICAgIGZ1bmN0aW9uIGQzX3RpcF9odG1sKCkgeyByZXR1cm4gJyAnIH1cblxuICAgIHZhciBkaXJlY3Rpb25fY2FsbGJhY2tzID0ge1xuICAgICAgbjogIGRpcmVjdGlvbl9uLFxuICAgICAgczogIGRpcmVjdGlvbl9zLFxuICAgICAgZTogIGRpcmVjdGlvbl9lLFxuICAgICAgdzogIGRpcmVjdGlvbl93LFxuICAgICAgbnc6IGRpcmVjdGlvbl9udyxcbiAgICAgIG5lOiBkaXJlY3Rpb25fbmUsXG4gICAgICBzdzogZGlyZWN0aW9uX3N3LFxuICAgICAgc2U6IGRpcmVjdGlvbl9zZVxuICAgIH07XG5cbiAgICB2YXIgZGlyZWN0aW9ucyA9IE9iamVjdC5rZXlzKGRpcmVjdGlvbl9jYWxsYmFja3MpO1xuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX24oKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5uLnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5uLnggLSBub2RlLm9mZnNldFdpZHRoIC8gMlxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9zKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gucy55LFxuICAgICAgICBsZWZ0OiBiYm94LnMueCAtIG5vZGUub2Zmc2V0V2lkdGggLyAyXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX2UoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5lLnkgLSBub2RlLm9mZnNldEhlaWdodCAvIDIsXG4gICAgICAgIGxlZnQ6IGJib3guZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3coKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC53LnkgLSBub2RlLm9mZnNldEhlaWdodCAvIDIsXG4gICAgICAgIGxlZnQ6IGJib3gudy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9udygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm53LnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5udy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9uZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm5lLnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5uZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3N3KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guc3cueSxcbiAgICAgICAgbGVmdDogYmJveC5zdy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9zZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LnNlLnksXG4gICAgICAgIGxlZnQ6IGJib3guZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5pdE5vZGUoKSB7XG4gICAgICB2YXIgbm9kZSA9IGQzLnNlbGVjdChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSlcbiAgICAgIG5vZGVcbiAgICAgICAgLnN0eWxlKCdwb3NpdGlvbicsICdhYnNvbHV0ZScpXG4gICAgICAgIC5zdHlsZSgndG9wJywgMClcbiAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywgMClcbiAgICAgICAgLnN0eWxlKCdwb2ludGVyLWV2ZW50cycsICdub25lJylcbiAgICAgICAgLnN0eWxlKCdib3gtc2l6aW5nJywgJ2JvcmRlci1ib3gnKVxuXG4gICAgICByZXR1cm4gbm9kZS5ub2RlKClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRTVkdOb2RlKGVsKSB7XG4gICAgICBlbCA9IGVsLm5vZGUoKVxuICAgICAgaWYoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnc3ZnJylcbiAgICAgICAgcmV0dXJuIGVsXG5cbiAgICAgIHJldHVybiBlbC5vd25lclNWR0VsZW1lbnRcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXROb2RlRWwoKSB7XG4gICAgICBpZihub2RlID09PSBudWxsKSB7XG4gICAgICAgIG5vZGUgPSBpbml0Tm9kZSgpO1xuICAgICAgICAvLyByZS1hZGQgbm9kZSB0byBET01cbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKTtcbiAgICAgIH07XG4gICAgICByZXR1cm4gZDMuc2VsZWN0KG5vZGUpO1xuICAgIH1cblxuICAgIC8vIFByaXZhdGUgLSBnZXRzIHRoZSBzY3JlZW4gY29vcmRpbmF0ZXMgb2YgYSBzaGFwZVxuICAgIC8vXG4gICAgLy8gR2l2ZW4gYSBzaGFwZSBvbiB0aGUgc2NyZWVuLCB3aWxsIHJldHVybiBhbiBTVkdQb2ludCBmb3IgdGhlIGRpcmVjdGlvbnNcbiAgICAvLyBuKG5vcnRoKSwgcyhzb3V0aCksIGUoZWFzdCksIHcod2VzdCksIG5lKG5vcnRoZWFzdCksIHNlKHNvdXRoZWFzdCksIG53KG5vcnRod2VzdCksXG4gICAgLy8gc3coc291dGh3ZXN0KS5cbiAgICAvL1xuICAgIC8vICAgICstKy0rXG4gICAgLy8gICAgfCAgIHxcbiAgICAvLyAgICArICAgK1xuICAgIC8vICAgIHwgICB8XG4gICAgLy8gICAgKy0rLStcbiAgICAvL1xuICAgIC8vIFJldHVybnMgYW4gT2JqZWN0IHtuLCBzLCBlLCB3LCBudywgc3csIG5lLCBzZX1cbiAgICBmdW5jdGlvbiBnZXRTY3JlZW5CQm94KCkge1xuICAgICAgdmFyIHRhcmdldGVsICAgPSB0YXJnZXQgfHwgZDMuZXZlbnQudGFyZ2V0O1xuXG4gICAgICB3aGlsZSAoJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiB0YXJnZXRlbC5nZXRTY3JlZW5DVE0gJiYgJ3VuZGVmaW5lZCcgPT09IHRhcmdldGVsLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICB0YXJnZXRlbCA9IHRhcmdldGVsLnBhcmVudE5vZGU7XG4gICAgICB9XG5cbiAgICAgIHZhciBiYm94ICAgICAgID0ge30sXG4gICAgICAgICAgbWF0cml4ICAgICA9IHRhcmdldGVsLmdldFNjcmVlbkNUTSgpLFxuICAgICAgICAgIHRiYm94ICAgICAgPSB0YXJnZXRlbC5nZXRCQm94KCksXG4gICAgICAgICAgd2lkdGggICAgICA9IHRiYm94LndpZHRoLFxuICAgICAgICAgIGhlaWdodCAgICAgPSB0YmJveC5oZWlnaHQsXG4gICAgICAgICAgeCAgICAgICAgICA9IHRiYm94LngsXG4gICAgICAgICAgeSAgICAgICAgICA9IHRiYm94LnlcblxuICAgICAgcG9pbnQueCA9IHhcbiAgICAgIHBvaW50LnkgPSB5XG4gICAgICBiYm94Lm53ID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggKz0gd2lkdGhcbiAgICAgIGJib3gubmUgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSArPSBoZWlnaHRcbiAgICAgIGJib3guc2UgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCAtPSB3aWR0aFxuICAgICAgYmJveC5zdyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55IC09IGhlaWdodCAvIDJcbiAgICAgIGJib3gudyAgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCArPSB3aWR0aFxuICAgICAgYmJveC5lID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggLT0gd2lkdGggLyAyXG4gICAgICBwb2ludC55IC09IGhlaWdodCAvIDJcbiAgICAgIGJib3gubiA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55ICs9IGhlaWdodFxuICAgICAgYmJveC5zID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcblxuICAgICAgcmV0dXJuIGJib3hcbiAgICB9XG5cbiAgICByZXR1cm4gdGlwXG4gIH07XG59KSgpOyJdfQ==
