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
        var configObj = container.dataset.convert();
        console.log(configObj);
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

                    d3.selectAll(this.yAxisGroup.nodes()).transition().duration(500).call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5)).on('end', function (d, i, array) {
                        setTimeout(function () {
                            d3.select(array[i]).selectAll('.tick').each(function (d, i, array) {
                                d3.select(array[i]).classed('zero', d === 0 && i !== 0 && _this8.yMin < 0);
                            });
                        }, 50);
                    });
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

            this.yAxisGroup.selectAll('.tick').each(function (d, i, array) {
                d3.select(array[i]).classed('zero', d === 0 && i !== 0 && _this10.yMin < 0);
            });

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
            }).append('a').attr('xlink:href', '#').attr('y', 0).append('text').attr('class', 'series-label').html(function (d) {
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
                var prefix = '';
                var suffix = '';
                if (this.parent.units(d.series) && this.parent.units(d.series)[0] === '$') {
                    prefix = '$'; // TO DO:  handle other prefixes
                }
                var html = '<strong>' + this.parent.tipText(d.series) + '</strong> (' + d.year + ')<br />' + prefix + d3.format(',')(d[this.config.variableY]);
                if (this.parent.units(d.series) && this.parent.units(d.series) !== '') {
                    suffix = this.parent.units(d.series).replace('$', '').replace(/s$/, '');
                    html += ' ' + suffix;
                }
                var cum = this.config.variableY.replace('_value', '_cum');
                if (d[cum] !== '') {
                    html += '<br />(' + prefix + d3.format(',')(d[cum]) + suffix + ' cumulative)';
                }
                this.tooltip.html(html);
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

    if (window.NodeList && !NodeList.prototype.forEach) {
        NodeList.prototype.forEach = function (callback, thisArg) {
            thisArg = thisArg || window;
            for (var i = 0; i < this.length; i++) {
                callback.call(thisArg, this[i], i, this);
            }
        };
    }

    if (!Object.hasOwnProperty('getOwnPropertyDescriptors')) {
        Object.defineProperty(Object, 'getOwnPropertyDescriptors', {
            configurable: true,
            writable: true,
            value: function getOwnPropertyDescriptors(object) {
                return Reflect.ownKeys(object).reduce(function (descriptors, key) {
                    return Object.defineProperty(descriptors, key, {
                        configurable: true,
                        enumerable: true,
                        writable: true,
                        value: Object.getOwnPropertyDescriptor(object, key)
                    });
                }, {});
            }
        });
    }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9DaGFydHMuanMiLCJqcy1leHBvcnRzL0hlbHBlcnMuanMiLCJqcy12ZW5kb3IvZDMtdGlwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNJQTs7QUFDQTs7QUFDQTs7QUFFQSxJQUFJLFdBQVksWUFBVTs7QUFFMUI7O0FBRUksUUFBSSxrQkFBa0IsRUFBdEI7QUFDQSxRQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEwQjtBQUFBOztBQUV6QyxhQUFLLFNBQUwsR0FBaUIsU0FBakI7QUFDQSxhQUFLLEtBQUwsR0FBYSxLQUFiO0FBQ0EsYUFBSyxNQUFMLEdBQWMsVUFBVSxPQUFWLENBQWtCLE9BQWxCLEVBQWQ7O0FBRUEsYUFBSyxZQUFMLEdBQW9CLEtBQUssa0JBQUwsQ0FBd0IsU0FBeEIsQ0FBcEI7QUFDQSxhQUFLLFFBQUwsR0FBZ0IsRUFBaEI7O0FBRUE7QUFDQSxhQUFLLFlBQUwsQ0FBa0IsSUFBbEIsQ0FBdUIsWUFBTTtBQUN6QixrQkFBSyxnQkFBTCxDQUFzQixTQUF0QjtBQUNILFNBRkQ7QUFHSCxLQWJEO0FBY0E7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBRWpCLDBCQUZpQixnQ0FFRztBQUFBOztBQUNoQixnQkFBSSxlQUFlLEVBQW5CO0FBQ0EsZ0JBQUksVUFBVSxLQUFLLE1BQUwsQ0FBWSxPQUExQjtBQUFBLGdCQUNJLE9BQU8sQ0FBQyxLQUFLLE1BQUwsQ0FBWSxPQUFiLEVBQXFCLEtBQUssTUFBTCxDQUFZLGFBQWpDLENBRFgsQ0FGZ0IsQ0FHNEM7QUFDeEI7QUFDcEMsaUJBQUssT0FBTCxDQUFhLFVBQUMsSUFBRCxFQUFPLENBQVAsRUFBYTtBQUN0QixvQkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsdUJB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QXRCLENBQVY7QUFDQSxZQUFNLENBQU4sSUFBVyxLQUFYO0FBQ0EsV0FBSyxDQUFMLEdBQVMsTUFBTSxlQUFOLENBQXNCLE1BQXRCLENBQVQ7QUFDQSxZQUFNLENBQU4sSUFBVyxRQUFRLENBQW5CO0FBQ0EsWUFBTSxDQUFOLElBQVcsU0FBUyxDQUFwQjtBQUNBLFdBQUssQ0FBTCxHQUFTLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFUO0FBQ0EsWUFBTSxDQUFOLElBQVcsTUFBWDtBQUNBLFdBQUssQ0FBTCxHQUFTLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFUOztBQUVBLGFBQU8sSUFBUDtBQUNEOztBQUVELFdBQU8sR0FBUDtBQUNELEdBbFREO0FBbVRELENBMVRvQixFQUFkIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIiAvKiBleHBvcnRlZCBEM0NoYXJ0cywgSGVscGVycywgZDNUaXAgKi8gLy8gbGV0J3MganNoaW50IGtub3cgdGhhdCBEM0NoYXJ0cyBjYW4gYmUgXCJkZWZpbmVkIGJ1dCBub3QgdXNlZFwiIGluIHRoaXMgZmlsZVxuIC8qIHBvbHlmaWxscyBuZWVkZWQ6IFByb21pc2UsIEFycmF5LmlzQXJyYXksIEFycmF5LmZpbmQsIEFycmF5LmZpbHRlclxuXG4gKi9cbmltcG9ydCB7IEhlbHBlcnMgfSBmcm9tICcuLi9qcy1leHBvcnRzL0hlbHBlcnMnO1xuaW1wb3J0IHsgQ2hhcnRzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9DaGFydHMnO1xuaW1wb3J0IHsgZDNUaXAgfSBmcm9tICcuLi9qcy12ZW5kb3IvZDMtdGlwJztcblxudmFyIEQzQ2hhcnRzID0gKGZ1bmN0aW9uKCl7XG5cblwidXNlIHN0cmljdFwiOyBcbiAgICAgXG4gICAgdmFyIGdyb3VwQ29sbGVjdGlvbiA9IFtdO1xuICAgIHZhciBEM0NoYXJ0R3JvdXAgPSBmdW5jdGlvbihjb250YWluZXIsIGluZGV4KXtcbiAgICAgICAgXG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgICAgICB0aGlzLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIHRoaXMuY29uZmlnID0gY29udGFpbmVyLmRhdGFzZXQuY29udmVydCgpO1xuICAgICAgICBcbiAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMgPSB0aGlzLnJldHVybkRhdGFQcm9taXNlcyhjb250YWluZXIpO1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gW107XG4gICAgICAgIFxuICAgICAgICAvL3RoaXMuY29udHJvbGxlci5pbml0Q29udHJvbGxlcihjb250YWluZXIsIHRoaXMubW9kZWwsIHRoaXMudmlldyk7XG4gICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplQ2hhcnRzKGNvbnRhaW5lcik7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgLy9wcm90b3R5cGUgYmVnaW5zIGhlcmVcbiAgICBEM0NoYXJ0R3JvdXAucHJvdG90eXBlID0ge1xuICAgICAgICBcbiAgICAgICAgICAgIHJldHVybkRhdGFQcm9taXNlcygpeyBcbiAgICAgICAgICAgICAgICB2YXIgZGF0YVByb21pc2VzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHNoZWV0SUQgPSB0aGlzLmNvbmZpZy5zaGVldElkLCBcbiAgICAgICAgICAgICAgICAgICAgdGFicyA9IFt0aGlzLmNvbmZpZy5kYXRhVGFiLHRoaXMuY29uZmlnLmRpY3Rpb25hcnlUYWJdOyAvLyB0aGlzIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlzIHRoZXJlIGEgY2FzZSBmb3IgbW9yZSB0aGFuIG9uZSBzaGVldCBvZiBkYXRhP1xuICAgICAgICAgICAgICAgIHRhYnMuZm9yRWFjaCgoZWFjaCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZDMuanNvbignaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLycgKyBzaGVldElEICsgJy92YWx1ZXMvJyArIGVhY2ggKyAnP2tleT1BSXphU3lERDNXNXdKZUpGMmVzZmZaTVF4TnRFbDl0dC1PZmdTcTQnLCAoZXJyb3IsZGF0YSkgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZXMgPSBkYXRhLnZhbHVlcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdFR5cGUgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyAnb2JqZWN0JyA6ICdzZXJpZXMnOyAvLyBuZXN0VHlwZSBmb3IgZGF0YSBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5ID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gZmFsc2UgOiB0aGlzLmNvbmZpZy5uZXN0Qnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgdHJ1ZSwgbmVzdFR5cGUsIGkpKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFQcm9taXNlcy5wdXNoKHByb21pc2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFByb21pc2UuYWxsKGRhdGFQcm9taXNlcykudGhlbih2YWx1ZXMgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGEgPSB2YWx1ZXNbMF07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGljdGlvbmFyeSA9IHZhbHVlc1sxXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSB0aGlzLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoZGF0YVByb21pc2VzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdW1tYXJpemVEYXRhKCl7IC8vIHRoaXMgZm4gY3JlYXRlcyBhbiBhcnJheSBvZiBvYmplY3RzIHN1bW1hcml6aW5nIHRoZSBkYXRhIGluIG1vZGVsLmRhdGEuIG1vZGVsLmRhdGEgaXMgbmVzdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBuZXN0aW5nIGFuZCByb2xsaW5nIHVwIGNhbm5vdCBiZSBkb25lIGVhc2lseSBhdCB0aGUgc2FtZSB0aW1lLCBzbyB0aGV5J3JlIGRvbmUgc2VwYXJhdGVseS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHN1bW1hcmllcyBwcm92aWRlIGF2ZXJhZ2UsIG1heCwgbWluIG9mIGFsbCBmaWVsZHMgaW4gdGhlIGRhdGEgYXQgYWxsIGxldmVscyBvZiBuZXN0aW5nLiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLCB0aGUgc2Vjb25kIGlzIHR3bywgYW5kIHNvIG9uLlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBzdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgdmFyaWFibGVzID0gT2JqZWN0LmtleXModGhpcy51bm5lc3RlZFswXSk7IC8vIGFsbCBuZWVkIHRvIGhhdmUgdGhlIHNhbWUgZmllbGRzXG4gICAgICAgICAgICAgICAgdmFyIG5lc3RCeSA9IHRoaXMuY29uZmlnLm5lc3RCeSA/IHRoaXMuY29uZmlnLm5lc3RCeS5tYXAoZWFjaCA9PiBlYWNoKSA6IGZhbHNlOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB1c2VzIG1hcCB0byBjcmVhdGUgbmV3IGFycmF5IHJhdGhlciB0aGFuIGFzc2lnbmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ5IHJlZmVyZW5jZS4gdGhlIGBwb3AoKWAgYmVsb3cgd291bGQgYWZmZWN0IG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJyYXkgaWYgZG9uZSBieSByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5QXJyYXkgPSBBcnJheS5pc0FycmF5KG5lc3RCeSkgPyBuZXN0QnkgOiBbbmVzdEJ5XTtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiByZWR1Y2VWYXJpYWJsZXMoZCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY1tjdXJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heDogICAgICAgZDMubWF4KGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW46ICAgICAgIGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVhbjogICAgICBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW06ICAgICAgIGQzLnN1bShkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFuOiAgICBkMy5tZWRpYW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbmNlOiAgZDMudmFyaWFuY2UoZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmlhdGlvbjogZDMuZGV2aWF0aW9uKGQsIGQgPT4gZFtjdXJdKVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgICAgIH0se30pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3aGlsZSAoIG5lc3RCeUFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHN1bW1hcml6ZWQgPSB0aGlzLm5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICAucm9sbHVwKHJlZHVjZVZhcmlhYmxlcylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodGhpcy51bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgICAgIHN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAgICAgIFxuICAgICAgICAgICAgICAgICAgICBuZXN0QnlBcnJheS5wb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1bW1hcmllcztcbiAgICAgICAgICAgIH0sIFxuICAgICAgICAgICAgbmVzdFByZWxpbShuZXN0QnlBcnJheSl7XG4gICAgICAgICAgICAgICAgLy8gcmVjdXJzaXZlICBuZXN0aW5nIGZ1bmN0aW9uIHVzZWQgYnkgc3VtbWFyaXplRGF0YSBhbmQgcmV0dXJuS2V5VmFsdWVzXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5lc3RCeUFycmF5LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1cil7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyICE9PSAnc3RyaW5nJyAmJiB0eXBlb2YgY3VyICE9PSAnZnVuY3Rpb24nICkgeyB0aHJvdyAnZWFjaCBuZXN0QnkgaXRlbSBtdXN0IGJlIGEgc3RyaW5nIG9yIGZ1bmN0aW9uJzsgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgcnRuO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdzdHJpbmcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkW2N1cl07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTsgICAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjdXIoZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcnRuO1xuICAgICAgICAgICAgICAgIH0sIGQzLm5lc3QoKSk7XG4gICAgICAgICAgICB9LCAgICAgICBcbiAgICAgICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycsIHRhYkluZGV4ID0gMCl7XG4gICAgICAgICAgICAvLyB0aGlzIGZuIHRha2VzIG5vcm1hbGl6ZWQgZGF0YSBmZXRjaGVkIGFzIGFuIGFycmF5IG9mIHJvd3MgYW5kIHVzZXMgdGhlIHZhbHVlcyBpbiB0aGUgZmlyc3Qgcm93IGFzIGtleXMgZm9yIHZhbHVlcyBpblxuICAgICAgICAgICAgLy8gc3Vic2VxdWVudCByb3dzXG4gICAgICAgICAgICAvLyBuZXN0QnkgPSBzdHJpbmcgb3IgYXJyYXkgb2YgZmllbGQocykgdG8gbmVzdCBieSwgb3IgYSBjdXN0b20gZnVuY3Rpb24sIG9yIGFuIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zO1xuICAgICAgICAgICAgLy8gY29lcmNlID0gQk9PTCBjb2VyY2UgdG8gbnVtIG9yIG5vdDsgbmVzdFR5cGUgPSBvYmplY3Qgb3Igc2VyaWVzIG5lc3QgKGQzKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBwcmVsaW07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHVubmVzdGVkID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1ciwgaSkgeyBcbiAgICAgICAgICAgICAgICAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgICAvLyAzLiAvLyBhY2MgaXMgYW4gb2JqZWN0ICwga2V5IGlzIGNvcnJlc3BvbmRpbmcgdmFsdWUgZnJvbSByb3cgMCwgdmFsdWUgaXMgY3VycmVudCB2YWx1ZSBvZiBhcnJheVxuICAgICAgICAgICAgICAgICAgYWNjW3ZhbHVlc1swXVtpXV0gPSBjb2VyY2UgPT09IHRydWUgPyBpc05hTigrY3VyKSB8fCBjdXIgPT09ICcnID8gY3VyIDogK2N1ciA6IGN1cjsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRlc3QgZm9yIGVtcHR5IHN0cmluZ3MgYmVmb3JlIGNvZXJjaW5nIGJjICsnJyA9PiAwXG4gICAgICAgICAgICAgICAgfSwge30pKTtcbiAgICAgICAgICAgICAgICBpZiAoIHRhYkluZGV4ID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVubmVzdGVkID0gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCAhbmVzdEJ5ICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bm5lc3RlZDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBuZXN0QnkgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBuZXN0QnkgPT09ICdmdW5jdGlvbicgKSB7IC8vIGllIG9ubHkgb25lIG5lc3RCeSBmaWVsZCBvciBmdW5jaXRvblxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gdGhpcy5uZXN0UHJlbGltKFtuZXN0QnldKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCBuZXN0VHlwZSA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh1bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudHJpZXModW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbml0aWFsaXplQ2hhcnRzKGNvbnRhaW5lcil7XG4gICAgICAgICAgICAgICAgdmFyIGdyb3VwID0gdGhpcztcbiAgICAgICAgICAgICAgICBkMy5zZWxlY3QoY29udGFpbmVyKS5zZWxlY3RBbGwoJy5kMy1jaGFydCcpXG4gICAgICAgICAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICBncm91cC5jaGlsZHJlbi5wdXNoKG5ldyBDaGFydHMuQ2hhcnREaXYodGhpcywgZ3JvdXApKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9ICAgICAgICBcbiAgICB9OyAvLyBEM0NoYXJ0R3JvdXAgcHJvdG90eXBlIGVuZHMgaGVyZVxuICAgIFxuICAgIHdpbmRvdy5EM0NoYXJ0cyA9IHsgLy8gbmVlZCB0byBzcGVjaWZ5IHdpbmRvdyBiYyBhZnRlciB0cmFuc3BpbGluZyBhbGwgdGhpcyB3aWxsIGJlIHdyYXBwZWQgaW4gSUlGRXNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBgcmV0dXJuYGluZyB3b24ndCBnZXQgdGhlIGV4cG9ydCBpbnRvIHdpbmRvdydzIGdsb2JhbCBzY29wZVxuICAgICAgICBJbml0KCl7XG4gICAgICAgICAgICB2YXIgZ3JvdXBEaXZzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmQzLWdyb3VwJyk7XG4gICAgICAgICAgICBmb3IgKCBsZXQgaSA9IDA7IGkgPCBncm91cERpdnMubGVuZ3RoOyBpKysgKXtcbiAgICAgICAgICAgICAgICBncm91cENvbGxlY3Rpb24ucHVzaChuZXcgRDNDaGFydEdyb3VwKGdyb3VwRGl2c1tpXSwgaSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgIH0sXG4gICAgICAgIENvbGxlY3RBbGw6W10sXG4gICAgICAgIFVwZGF0ZUFsbCh2YXJpYWJsZVkpe1xuICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5Db2xsZWN0QWxsKTtcbiAgICAgICAgICAgIHRoaXMuQ29sbGVjdEFsbC5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgIGVhY2gudXBkYXRlKHZhcmlhYmxlWSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59KCkpOyAvLyBlbmQgdmFyIEQzQ2hhcnRzIElJRkUiLCJleHBvcnQgY29uc3QgQ2hhcnRzID0gKGZ1bmN0aW9uKCl7ICAgIFxuICAgIC8qIGdsb2JhbHMgRDNDaGFydHMgKi9cblxuICAgIHZhciBDaGFydERpdiA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgcGFyZW50KXtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gW107XG4gICAgICAgIHRoaXMuc2VyaWVzQ291bnQgPSAwO1xuICAgICAgICB2YXIgY29uZmlnT2JqID0gY29udGFpbmVyLmRhdGFzZXQuY29udmVydCgpO1xuICAgICAgICBjb25zb2xlLmxvZyhjb25maWdPYmopO1xuICAgICAgICB0aGlzLmNvbmZpZyA9IE9iamVjdC5jcmVhdGUoIHBhcmVudC5jb25maWcsIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKCBjb250YWluZXIuZGF0YXNldC5jb252ZXJ0KCkgKSApO1xuICAgICAgICAgICAgLy8gbGluZSBhYm92ZSBjcmVhdGVzIGEgY29uZmlnIG9iamVjdCBmcm9tIHRoZSBIVE1MIGRhdGFzZXQgZm9yIHRoZSBjaGFydERpdiBjb250YWluZXJcbiAgICAgICAgICAgIC8vIHRoYXQgaW5oZXJpdHMgZnJvbSB0aGUgcGFyZW50cyBjb25maWcgb2JqZWN0LiBhbnkgY29uZmlncyBub3Qgc3BlY2lmaWVkIGZvciB0aGUgY2hhcnREaXYgKGFuIG93biBwcm9wZXJ0eSlcbiAgICAgICAgICAgIC8vIHdpbGwgY29tZSBmcm9tIHVwIHRoZSBpbmhlcml0YW5jZSBjaGFpblxuICAgICAgICB0aGlzLmRhdHVtID0gcGFyZW50LmRhdGEuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSB0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgIHZhciBzZXJpZXNJbnN0cnVjdCA9IHRoaXMuY29uZmlnLnNlcmllcyB8fCAnYWxsJztcbiAgICAgICAgXG4gICAgICAgIGlmICggQXJyYXkuaXNBcnJheShzZXJpZXNJbnN0cnVjdCkgKXtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5kYXR1bS52YWx1ZXMgPSB0aGlzLmRhdHVtLnZhbHVlcy5maWx0ZXIoZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlcmllc0luc3RydWN0LmluZGV4T2YoZWFjaC5rZXkpICE9PSAtMTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKCBzZXJpZXNJbnN0cnVjdCAhPT0gJ2FsbCcgKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBJbnZhbGlkIGluc3RydWN0aW9uIGZyb20gSFRNTCBmb3Igd2hpY2ggY2F0ZWdvcmllcyB0byBpbmNsdWRlIFxuICAgICAgICAgICAgICAgICAgICAodmFyIHNlcmllc0luc3RydWN0KS4gRmFsbGJhY2sgdG8gYWxsLmApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2VyaWVzR3JvdXBzID0gdGhpcy5ncm91cFNlcmllcygpOyAgXG4gICAgICAgIHRoaXMuZGljdGlvbmFyeSA9IHRoaXMucGFyZW50LmRpY3Rpb25hcnk7XG4gICAgICAgIGlmICggdGhpcy5jb25maWcuaGVhZGluZyAhPT0gZmFsc2UgKXtcbiAgICAgICAgICAgIHRoaXMuYWRkSGVhZGluZyh0aGlzLmNvbmZpZy5oZWFkaW5nKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNyZWF0ZUNoYXJ0cygpO1xuICAgICAgfTtcblxuICAgIENoYXJ0RGl2LnByb3RvdHlwZSA9IHtcblxuICAgICAgICBjaGFydFR5cGVzOiB7IFxuICAgICAgICAgICAgbGluZTogICAnTGluZUNoYXJ0JyxcbiAgICAgICAgICAgIGNvbHVtbjogJ0NvbHVtbkNoYXJ0JyxcbiAgICAgICAgICAgIGJhcjogICAgJ0JhckNoYXJ0JyAvLyBzbyBvbiAuIC4gLlxuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVDaGFydHMoKXtcbiAgICAgICAgICAgIHRoaXMuc2VyaWVzR3JvdXBzLmZvckVhY2goKGVhY2gpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuLnB1c2gobmV3IExpbmVDaGFydCh0aGlzLCBlYWNoKSk7IC8vIFRPIERPIGRpc3Rpbmd1aXNoIGNoYXJ0IHR5cGVzIGhlcmVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBncm91cFNlcmllcygpe1xuICAgICAgICAgICAgdmFyIHNlcmllc0dyb3VwcyxcbiAgICAgICAgICAgICAgICBncm91cHNJbnN0cnVjdCA9IHRoaXMuY29uZmlnLnNlcmllc0dyb3VwIHx8ICdub25lJztcbiAgICAgICAgICAgIGlmICggQXJyYXkuaXNBcnJheSggZ3JvdXBzSW5zdHJ1Y3QgKSApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5zZXJpZXNHcm91cC5mb3JFYWNoKGdyb3VwID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzLnB1c2godGhpcy5kYXR1bS52YWx1ZXMuZmlsdGVyKHNlcmllcyA9PiBncm91cC5pbmRleE9mKHNlcmllcy5rZXkpICE9PSAtMSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdub25lJyApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSB0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBbZWFjaF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdhbGwnICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFt0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBlYWNoKV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBJbnZhbGlkIGRhdGEtZ3JvdXAtc2VyaWVzIGluc3RydWN0aW9uIGZyb20gaHRtbC4gXG4gICAgICAgICAgICAgICAgICAgICAgIE11c3QgYmUgdmFsaWQgSlNPTjogXCJOb25lXCIgb3IgXCJBbGxcIiBvciBhbiBhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICBvZiBhcnJheXMgY29udGFpbmluZyB0aGUgc2VyaWVzIHRvIGJlIGdyb3VwZWRcbiAgICAgICAgICAgICAgICAgICAgICAgdG9nZXRoZXIuIEFsbCBzdHJpbmdzIG11c3QgYmUgZG91YmxlLXF1b3RlZC5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzZXJpZXNHcm91cHM7XG4gICAgICAgIH0sIC8vIGVuZCBncm91cFNlcmllcygpXG4gICAgICAgIGFkZEhlYWRpbmcoaW5wdXQpe1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgaGVhZGluZyA9IGQzLnNlbGVjdCh0aGlzLmNvbnRhaW5lcilcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdwJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCdyZWxhdGl2ZScpXG4gICAgICAgICAgICAgICAgLmh0bWwoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaGVhZGluZyA9IHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycgPyBpbnB1dCA6IHRoaXMubGFiZWwodGhpcy5jb25maWcuY2F0ZWdvcnkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJzxzdHJvbmc+JyArIGhlYWRpbmcgKyAnPC9zdHJvbmc+JztcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgIHZhciBsYWJlbFRvb2x0aXAgPSBkMy50aXAoKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJkMy10aXAgbGFiZWwtdGlwXCIpXG4gICAgICAgICAgICAgICAgLmRpcmVjdGlvbigncycpXG4gICAgICAgICAgICAgICAgLm9mZnNldChbNCwgMF0pXG4gICAgICAgICAgICAgICAgLmh0bWwodGhpcy5kZXNjcmlwdGlvbih0aGlzLmNvbmZpZy5jYXRlZ29yeSkpO1xuXG4gICAgICAgICAgICBmdW5jdGlvbiBtb3VzZW92ZXIoKXtcbiAgICAgICAgICAgICAgICBpZiAoIHdpbmRvdy5vcGVuVG9vbHRpcCApIHtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwLmhpZGUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGFiZWxUb29sdGlwLnNob3coKTtcbiAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAgPSBsYWJlbFRvb2x0aXA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5kZXNjcmlwdGlvbih0aGlzLmNvbmZpZy5jYXRlZ29yeSkgIT09IHVuZGVmaW5lZCAmJiB0aGlzLmRlc2NyaXB0aW9uKHRoaXMuY29uZmlnLmNhdGVnb3J5KSAhPT0gJycgKXtcbiAgICAgICAgICAgICAgICBoZWFkaW5nLmh0bWwoaGVhZGluZy5odG1sKCkgKyAnPHN2ZyBjbGFzcz1cImlubGluZSBoZWFkaW5nLWluZm9cIj48dGV4dCB4PVwiNFwiIHk9XCIxNlwiIGNsYXNzPVwiaW5mby1tYXJrXCI+JiM5NDMyOzwvdGV4dD48L3N2Zz4nKTtcblxuICAgICAgICAgICAgICAgIGhlYWRpbmcuc2VsZWN0KCcuaW5mby1tYXJrJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywwKVxuICAgICAgICAgICAgICAgICAgICAuY2xhc3NlZCgnaGFzLXRvb2x0aXAnLCB0cnVlKVxuICAgICAgICAgICAgICAgICAgICAub24oJ21vdXNlb3ZlcicsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5vbignZm9jdXMnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtb3VzZW92ZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJsdXIoKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLm9uKCdibHVyJywgbGFiZWxUb29sdGlwLmhpZGUpXG4gICAgICAgICAgICAgICAgICAgIC5jYWxsKGxhYmVsVG9vbHRpcCk7XG5cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgIH0sXG4gICAgICAgIGxhYmVsKGtleSl7IC8vIFRPIERPOiBjb21iaW5lIHRoZXNlIGludG8gb25lIG1ldGhvZCB0aGF0IHJldHVybnMgb2JqZWN0XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbDtcbiAgICAgICAgfSxcbiAgICAgICAgZGVzY3JpcHRpb24oa2V5KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLmRlc2NyaXB0aW9uO1xuICAgICAgICB9LFxuICAgICAgICB1bml0c0Rlc2NyaXB0aW9uKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS51bml0c19kZXNjcmlwdGlvbjtcbiAgICAgICAgfSwgICBcbiAgICAgICAgdW5pdHMoa2V5KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLnVuaXRzOyAgXG4gICAgICAgIH0sXG4gICAgICAgIHRpcFRleHQoa2V5KXtcbiAgICAgICAgICAgIHZhciBzdHIgPSB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLmxhYmVsLnJlcGxhY2UoL1xcXFxuL2csJyAnKTtcbiAgICAgICAgICAgIHJldHVybiBzdHIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHIuc2xpY2UoMSk7XG4gICAgICAgIH1cblxuICAgIH07IC8vIGVuZCBMaW5lQ2hhcnQucHJvdG90eXBlXG5cbiAgICB2YXIgTGluZUNoYXJ0ID0gZnVuY3Rpb24ocGFyZW50LCBzZXJpZXNHcm91cCl7XG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgICAgICB0aGlzLmNvbmZpZyA9IHBhcmVudC5jb25maWc7XG4gICAgICAgIHRoaXMubWFyZ2luVG9wID0gK3RoaXMuY29uZmlnLm1hcmdpblRvcCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLnRvcDtcbiAgICAgICAgdGhpcy5tYXJnaW5SaWdodCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5SaWdodCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLnJpZ2h0O1xuICAgICAgICB0aGlzLm1hcmdpbkJvdHRvbSA9ICt0aGlzLmNvbmZpZy5tYXJnaW5Cb3R0b20gfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5ib3R0b207XG4gICAgICAgIHRoaXMubWFyZ2luTGVmdCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5MZWZ0IHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMubGVmdDtcbiAgICAgICAgdGhpcy53aWR0aCA9IHRoaXMuY29uZmlnLnN2Z1dpZHRoID8gK3RoaXMuY29uZmlnLnN2Z1dpZHRoIC0gdGhpcy5tYXJnaW5SaWdodCAtIHRoaXMubWFyZ2luTGVmdCA6IDMyMCAtIHRoaXMubWFyZ2luUmlnaHQgLSB0aGlzLm1hcmdpbkxlZnQ7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5jb25maWcuc3ZnSGVpZ2h0ID8gK3RoaXMuY29uZmlnLnN2Z0hlaWdodCAtIHRoaXMubWFyZ2luVG9wIC0gdGhpcy5tYXJnaW5Cb3R0b20gOiAoIHRoaXMud2lkdGggKyB0aGlzLm1hcmdpblJpZ2h0ICsgdGhpcy5tYXJnaW5MZWZ0ICkgLyAyIC0gdGhpcy5tYXJnaW5Ub3AgLSB0aGlzLm1hcmdpbkJvdHRvbTtcbiAgICAgICAgdGhpcy5kYXRhID0gc2VyaWVzR3JvdXA7XG4gICAgICAgIFxuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IHRoaXMuaW5pdChwYXJlbnQuY29udGFpbmVyKTsgLy8gVE8gRE8gIHRoaXMgaXMga2luZGEgd2VpcmRcbiAgICAgICAgdGhpcy54U2NhbGVUeXBlID0gdGhpcy5jb25maWcueFNjYWxlVHlwZSB8fCAndGltZSc7XG4gICAgICAgIHRoaXMueVNjYWxlVHlwZSA9IHRoaXMuY29uZmlnLnlTY2FsZVR5cGUgfHwgJ2xpbmVhcic7XG4gICAgICAgIHRoaXMueFRpbWVUeXBlID0gdGhpcy5jb25maWcueFRpbWVUeXBlIHx8ICclWSc7XG4gICAgICAgIHRoaXMuc2NhbGVCeSA9IHRoaXMuY29uZmlnLnNjYWxlQnkgfHwgJ3Nlcmllcy1ncm91cCc7XG4gICAgICAgIHRoaXMuaXNGaXJzdFJlbmRlciA9IHRydWU7XG4gICAgICAgIHRoaXMuc2V0U2NhbGVzKCk7IC8vIC8vU0hPVUxEIEJFIElOIENIQVJUIFBST1RPVFlQRSBcbiAgICAgICAgdGhpcy5zZXRUb29sdGlwcygpO1xuICAgICAgICB0aGlzLmFkZExpbmVzKCk7XG4gICAgICAvLyAgdGhpcy5hZGRQb2ludHMoKTtcbiAgICAgICAgdGhpcy5hZGRYQXhpcygpO1xuICAgICAgICB0aGlzLmFkZFlBeGlzKCk7XG4gICAgICAgIFxuXG4gICAgICAgICAgICAgICBcbiAgICB9O1xuXG4gICAgTGluZUNoYXJ0LnByb3RvdHlwZSA9IHsgLy8gZWFjaCBMaW5lQ2hhcnQgaXMgYW4gc3ZnIHRoYXQgaG9sZCBncm91cGVkIHNlcmllc1xuICAgICAgICBkZWZhdWx0TWFyZ2luczoge1xuICAgICAgICAgICAgdG9wOjI3LFxuICAgICAgICAgICAgcmlnaHQ6NjUsXG4gICAgICAgICAgICBib3R0b206MjUsXG4gICAgICAgICAgICBsZWZ0OjM1XG4gICAgICAgIH0sXG4gICAgICAgICAgICAgIFxuICAgICAgICBpbml0KGNoYXJ0RGl2KXsgLy8gLy9TSE9VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFIHRoaXMgaXMgY2FsbGVkIG9uY2UgZm9yIGVhY2ggc2VyaWVzR3JvdXAgb2YgZWFjaCBjYXRlZ29yeS4gXG4gICAgICAgICAgICBEM0NoYXJ0cy5Db2xsZWN0QWxsLnB1c2godGhpcyk7XG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gIGQzLnNlbGVjdChjaGFydERpdilcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdzdmcnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIHRoaXMud2lkdGggKyB0aGlzLm1hcmdpblJpZ2h0ICsgdGhpcy5tYXJnaW5MZWZ0IClcbiAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgdGhpcy5oZWlnaHQgICsgdGhpcy5tYXJnaW5Ub3AgKyB0aGlzLm1hcmdpbkJvdHRvbSApO1xuXG4gICAgICAgICAgICB0aGlzLnN2ZyA9IGNvbnRhaW5lci5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLGB0cmFuc2xhdGUoJHt0aGlzLm1hcmdpbkxlZnR9LCAke3RoaXMubWFyZ2luVG9wfSlgKTtcblxuICAgICAgICAgICAgdGhpcy54QXhpc0dyb3VwID0gdGhpcy5zdmcuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgIHRoaXMueUF4aXNHcm91cCA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICB0aGlzLmFsbFNlcmllcyA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICB0aGlzLmVhY2hTZXJpZXMgPSB0aGlzLmFsbFNlcmllcy5zZWxlY3RBbGwoJ2VhY2gtc2VyaWVzJylcbiAgICAgICAgICAgICAgICAuZGF0YSh0aGlzLmRhdGEsIGQgPT4gZC5rZXkpXG4gICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnZWFjaC1zZXJpZXMgc2VyaWVzLScgKyB0aGlzLnBhcmVudC5zZXJpZXNDb3VudCArICcgY29sb3ItJyArIHRoaXMucGFyZW50LnNlcmllc0NvdW50KysgJSA0O1xuICAgICAgICAgICAgICAgIH0pO1xuLypcbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcy5lYWNoKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudC5zZXJpZXNBcnJheS5wdXNoKGFycmF5W2ldKTtcbiAgICAgICAgICAgIH0pOyovXG4gICAgICAgICAgICBpZiAoIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzICYmIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzID09PSB0cnVlICl7XG4gICAgICAgICAgICAgICAgdGhpcy5wcmVwYXJlU3RhY2tpbmcoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNvbnRhaW5lci5ub2RlKCk7XG4gICAgICAgIH0sXG4gICAgICAgIHVwZGF0ZSh2YXJpYWJsZVkgPSB0aGlzLmNvbmZpZy52YXJpYWJsZVkpe1xuICAgICAgICAgICAgdGhpcy5jb25maWcudmFyaWFibGVZID0gdmFyaWFibGVZO1xuICAgICAgICAgICAgdGhpcy5wcmVwYXJlU3RhY2tpbmcoKTtcbiAgICAgICAgICAgIHRoaXMuc2V0U2NhbGVzKCk7XG4gICAgICAgICAgICB0aGlzLmFkZExpbmVzKCk7XG5cbiAgICAgICAgfSxcbiAgICAgICAgcHJlcGFyZVN0YWNraW5nKCl7XG4gICAgICAgICAgICB2YXIgZm9yU3RhY2tpbmcgPSB0aGlzLmRhdGEucmVkdWNlKChhY2MsY3VyLGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmICggaSA9PT0gMCApe1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VyLnZhbHVlcy5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjYy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW3RoaXMuY29uZmlnLnZhcmlhYmxlWF06IGVhY2hbdGhpcy5jb25maWcudmFyaWFibGVYXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW2N1ci5rZXldOiBlYWNoW3RoaXMuY29uZmlnLnZhcmlhYmxlWV1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VyLnZhbHVlcy5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjYy5maW5kKG9iaiA9PiBvYmpbdGhpcy5jb25maWcudmFyaWFibGVYXSA9PT0gZWFjaFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKVtjdXIua2V5XSA9IGVhY2hbdGhpcy5jb25maWcudmFyaWFibGVZXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgfSxbXSk7XG5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLnN0YWNrID0gZDMuc3RhY2soKVxuICAgICAgICAgICAgICAgICAgICAua2V5cyh0aGlzLmRhdGEubWFwKGVhY2ggPT4gZWFjaC5rZXkpKVxuICAgICAgICAgICAgICAgICAgICAub3JkZXIoZDMuc3RhY2tPcmRlck5vbmUpXG4gICAgICAgICAgICAgICAgICAgIC5vZmZzZXQoZDMuc3RhY2tPZmZzZXROb25lKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLnN0YWNrRGF0YSA9IHRoaXMuc3RhY2soZm9yU3RhY2tpbmcpO1xuICAgICAgICB9LFxuICAgICAgICBzZXRTY2FsZXMoKXsgLy9TSE9VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFIC8vIFRPIERPOiBTRVQgU0NBTEVTIEZPUiBPVEhFUiBHUk9VUCBUWVBFU1xuXG4gICAgICAgICAgICB2YXIgZDNTY2FsZSA9IHtcbiAgICAgICAgICAgICAgICB0aW1lOiBkMy5zY2FsZVRpbWUoKSxcbiAgICAgICAgICAgICAgICBsaW5lYXI6IGQzLnNjYWxlTGluZWFyKClcbiAgICAgICAgICAgICAgICAvLyBUTyBETzogYWRkIGFsbCBzY2FsZSB0eXBlcy5cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgeE1heGVzID0gW10sIHhNaW5zID0gW10sIHlNYXhlcyA9IFtdLCB5TWlucyA9IFtdO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnNjYWxlQnkgPT09ICdzZXJpZXMtZ3JvdXAnICl7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLmZvckVhY2goZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB4TWF4ZXMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1bdGhpcy5jb25maWcudmFyaWFibGVYXS5tYXgpO1xuICAgICAgICAgICAgICAgICAgICB4TWlucy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt0aGlzLmNvbmZpZy52YXJpYWJsZVhdLm1pbik7XG4gICAgICAgICAgICAgICAgICAgIHlNYXhlcy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt0aGlzLmNvbmZpZy52YXJpYWJsZVldLm1heCk7XG4gICAgICAgICAgICAgICAgICAgIHlNaW5zLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0ubWluKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMueE1heCA9IGQzLm1heCh4TWF4ZXMpO1xuICAgICAgICAgICAgdGhpcy54TWluID0gZDMubWluKHhNaW5zKTtcbiAgICAgICAgICAgIHRoaXMueU1heCA9IGQzLm1heCh5TWF4ZXMpO1xuICAgICAgICAgICAgdGhpcy55TWluID0gZDMubWluKHlNaW5zKTtcbiAgICAgICAgICAgIHRoaXMueFZhbHVlc1VuaXF1ZSA9IFtdO1xuXG4gICAgICAgICAgICBpZiAoIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzICYmIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzID09PSB0cnVlICl7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5zdGFja0RhdGEpO1xuICAgICAgICAgICAgICAgIHZhciB5VmFsdWVzID0gdGhpcy5zdGFja0RhdGEucmVkdWNlKChhY2MsIGN1cikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjdXIpO1xuICAgICAgICAgICAgICAgICAgICBhY2MucHVzaCguLi5jdXIucmVkdWNlKChhY2MxLCBjdXIxKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2MxLnB1c2goY3VyMVswXSwgY3VyMVsxXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjMTtcbiAgICAgICAgICAgICAgICAgICAgfSxbXSkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgIH0sW10pO1xuICAgICAgICAgICAgICAgIHRoaXMueU1heCA9IGQzLm1heCh5VmFsdWVzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnlNaW4gPSBkMy5taW4oeVZhbHVlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgeFJhbmdlID0gWzAsIHRoaXMud2lkdGhdLFxuICAgICAgICAgICAgICAgIHlSYW5nZSA9IFt0aGlzLmhlaWdodCwgMF0sXG4gICAgICAgICAgICAgICAgeERvbWFpbixcbiAgICAgICAgICAgICAgICB5RG9tYWluO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnhTY2FsZVR5cGUgPT09ICd0aW1lJykge1xuICAgICAgICAgICAgICAgIHhEb21haW4gPSBbZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKSh0aGlzLnhNaW4pLCBkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKHRoaXMueE1heCldO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gVE8gRE86IE9USEVSIGRhdGEgdHlwZXMgP1xuICAgICAgICAgICAgICAgIHhEb21haW4gPSBbdGhpcy54TWluLCB0aGlzLnhNYXhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCB0aGlzLnlTY2FsZVR5cGUgPT09ICd0aW1lJykge1xuICAgICAgICAgICAgICAgIHlEb21haW4gPSBbZDMudGltZVBhcnNlKHRoaXMueVRpbWVUeXBlKSh0aGlzLnlNaW4pLCBkMy50aW1lUGFyc2UodGhpcy55VGltZVR5cGUpKHRoaXMueU1heCldO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gVE8gRE86IE9USEVSIGRhdGEgdHlwZXMgP1xuICAgICAgICAgICAgICAgIHlEb21haW4gPSBbdGhpcy55TWluLCB0aGlzLnlNYXhdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnhTY2FsZSA9IGQzU2NhbGVbdGhpcy54U2NhbGVUeXBlXS5kb21haW4oeERvbWFpbikucmFuZ2UoeFJhbmdlKTtcbiAgICAgICAgICAgIHRoaXMueVNjYWxlID0gZDNTY2FsZVt0aGlzLnlTY2FsZVR5cGVdLmRvbWFpbih5RG9tYWluKS5yYW5nZSh5UmFuZ2UpO1xuXG5cbiAgICAgICAgfSxcbiAgICAgICAgYWRkTGluZXMoKXtcbiAgICAgICAgICAgIHZhciB6ZXJvVmFsdWVsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgLngoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdGhpcy54VmFsdWVzVW5pcXVlLmluZGV4T2YoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSA9PT0gLTEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMueFZhbHVlc1VuaXF1ZS5wdXNoKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSk7XG4gICAgICAgICAgICAgICAgfSkgXG4gICAgICAgICAgICAgICAgLnkoKCkgPT4gdGhpcy55U2NhbGUoMCkpO1xuXG4gICAgICAgICAgICB2YXIgdmFsdWVsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgLngoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdGhpcy54VmFsdWVzVW5pcXVlLmluZGV4T2YoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSA9PT0gLTEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMueFZhbHVlc1VuaXF1ZS5wdXNoKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSk7XG4gICAgICAgICAgICAgICAgfSkgXG4gICAgICAgICAgICAgICAgLnkoKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnlTY2FsZShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzICYmIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzID09PSB0cnVlICl7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIGFyZWEgPSBkMy5hcmVhKClcbiAgICAgICAgICAgICAgICAgICAgLngoZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGQuZGF0YVt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSkpXG4gICAgICAgICAgICAgICAgICAgIC55MChkID0+IHRoaXMueVNjYWxlKGRbMF0pKVxuICAgICAgICAgICAgICAgICAgICAueTEoZCA9PiB0aGlzLnlTY2FsZShkWzFdKSk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbGluZSA9IGQzLmxpbmUoKVxuICAgICAgICAgICAgICAgICAgICAueChkID0+IHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZC5kYXRhW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKSlcbiAgICAgICAgICAgICAgICAgICAgLnkoZCA9PiB0aGlzLnlTY2FsZShkWzFdKSk7XG5cbiAgICAgICAgICAgICAgICB2YXIgc3RhY2tHcm91cCA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdzdGFja2VkLWFyZWEnKTtcbiAgICAgICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICBzdGFja0dyb3VwICAgIFxuICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzdGFja2VkLWFyZWEnKVxuICAgICAgICAgICAgICAgICAgICAuZGF0YSh0aGlzLnN0YWNrRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJykgLy8gVE8gRE86IGFkZCB6ZXJvLWxpbmUgZXF1aXZhbGVudCBhbmQgbG9naWMgZm9yIHRyYW5zaXRpb24gb24gdXBkYXRlXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsIChkLGkpID0+ICdhcmVhLWxpbmUgY29sb3ItJyArIGkpIC8vIFRPIERPIG5vdCBxdWl0ZSByaWdodCB0aGF0IGNvbG9yIHNob2xkIGJlIGBpYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHlvdSBoYXZlIG1vcmUgdGhhbiBvbmUgZ3JvdXAgb2Ygc2VyaWVzLCB3aWxsIHJlcGVhdFxuICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGQgPT4gYXJlYShkKSk7XG5cbiAgICAgICAgICAgICAgICBzdGFja0dyb3VwXG4gICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3N0YWNrZWQtbGluZScpIC8vIFRPIERPOiBhZGQgemVyby1saW5lIGVxdWl2YWxlbnQgYW5kIGxvZ2ljIGZvciB0cmFuc2l0aW9uIG9uIHVwZGF0ZVxuICAgICAgICAgICAgICAgICAgICAuZGF0YSh0aGlzLnN0YWNrRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKGQsaSkgPT4gJ2xpbmUgY29sb3ItJyArIGkpIFxuICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGQgPT4gbGluZShkKSk7XG5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCB0aGlzLmlzRmlyc3RSZW5kZXIgKXtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubGluZXMgPSB0aGlzLmVhY2hTZXJpZXMuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ2xpbmUnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCAoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB6ZXJvVmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMCkuZGVsYXkoMTUwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCAoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignZW5kJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggaSA9PT0gYXJyYXkubGVuZ3RoIC0gMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRQb2ludHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRMYWJlbHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0QWxsKHRoaXMubGluZXMubm9kZXMoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCAoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0QWxsKHRoaXMucG9pbnRzLm5vZGVzKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjeCcsIGQgPT4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjeScsIGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnlTY2FsZShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3RBbGwodGhpcy5sYWJlbEdyb3Vwcy5ub2RlcygpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKGQpID0+IGB0cmFuc2xhdGUoJHt0aGlzLndpZHRoICsgOH0sICR7dGhpcy55U2NhbGUoZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdGhpcy5jb25maWcudmFyaWFibGVZXSkgKyAzfSlgKTtcblxuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3RBbGwodGhpcy5sYWJlbHMubm9kZXMoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdlbmQnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGkgPT09IGFycmF5Lmxlbmd0aCAtIDEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWxheExhYmVscygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdEFsbCh0aGlzLnlBeGlzR3JvdXAubm9kZXMoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQodGhpcy55U2NhbGUpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrcyg1KSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignZW5kJywoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJy50aWNrJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5lYWNoKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QoYXJyYXlbaV0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCd6ZXJvJywgKCBkID09PSAwICYmIGkgIT09IDAgJiYgdGhpcy55TWluIDwgMCApKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sNTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBhZGRYQXhpcygpeyAvLyBjb3VsZCBiZSBpbiBDaGFydCBwcm90b3R5cGUgP1xuICAgICAgICAgICAgdmFyIHhBeGlzUG9zaXRpb24sXG4gICAgICAgICAgICAgICAgeEF4aXNPZmZzZXQsXG4gICAgICAgICAgICAgICAgYXhpc1R5cGU7XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5jb25maWcueEF4aXNQb3NpdGlvbiA9PT0gJ3RvcCcgKXtcbiAgICAgICAgICAgICAgICB4QXhpc1Bvc2l0aW9uID0gdGhpcy55TWF4O1xuICAgICAgICAgICAgICAgIHhBeGlzT2Zmc2V0ID0gLXRoaXMubWFyZ2luVG9wO1xuICAgICAgICAgICAgICAgIGF4aXNUeXBlID0gZDMuYXhpc1RvcDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgeEF4aXNQb3NpdGlvbiA9IHRoaXMueU1pbjtcbiAgICAgICAgICAgICAgICB4QXhpc09mZnNldCA9IHRoaXMubWFyZ2luQm90dG9tIC0gMTU7XG4gICAgICAgICAgICAgICAgYXhpc1R5cGUgPSBkMy5heGlzQm90dG9tO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGF4aXMgPSBheGlzVHlwZSh0aGlzLnhTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnhTY2FsZVR5cGUgPT09ICd0aW1lJyApe1xuICAgICAgICAgICAgICAgIGF4aXMudGlja1ZhbHVlcyh0aGlzLnhWYWx1ZXNVbmlxdWUubWFwKGVhY2ggPT4gZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShlYWNoKSkpOyAvLyBUTyBETzogYWxsb3cgZm9yIG90aGVyIHhBeGlzIEFkanVzdG1lbnRzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnhBeGlzR3JvdXBcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLCcgKyAoIHRoaXMueVNjYWxlKHhBeGlzUG9zaXRpb24pICsgeEF4aXNPZmZzZXQgKSArICcpJykgLy8gbm90IHByb2dyYW1hdGljIHBsYWNlbWVudCBvZiB4LWF4aXNcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgIC5jYWxsKGF4aXMpO1xuICAgICAgICB9LFxuICAgICAgICBhZGRZQXhpcygpe1xuICAgICAgICAgICAgLyogYXhpcyAqL1xuICAgICAgICAgICAgdGhpcy55QXhpc0dyb3VwXG4gICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+ICdheGlzIHktYXhpcyAnKVxuICAgICAgICAgICAgICAuY2FsbChkMy5heGlzTGVmdCh0aGlzLnlTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDUpKTtcblxuICAgICAgICAgICAgdGhpcy55QXhpc0dyb3VwXG4gICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnLnRpY2snKVxuICAgICAgICAgICAgICAgIC5lYWNoKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ3plcm8nLCAoIGQgPT09IDAgJiYgaSAhPT0gMCAmJiB0aGlzLnlNaW4gPCAwICkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG5cblxuICAgICAgICAgICAgLyogbGFiZWxzICovXG4gICAgICAgICAgICB2YXIgdW5pdHNMYWJlbHMgPSB0aGlzLmVhY2hTZXJpZXMuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3VuaXRzJylcbiAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICgpID0+IGB0cmFuc2xhdGUoLSR7dGhpcy5tYXJnaW5MZWZ0IC01IH0sLSR7dGhpcy5tYXJnaW5Ub3AgLSAxNH0pYClcbiAgICAgICAgICAgICAgLmh0bWwoKGQsaSkgPT4gaSA9PT0gMCA/IHRoaXMucGFyZW50LnVuaXRzKGQua2V5KSA6IG51bGwpO1xuXG4gICAgICAgICAgICB2YXIgbGFiZWxUb29sdGlwID0gZDMudGlwKClcbiAgICAgICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwiZDMtdGlwIGxhYmVsLXRpcFwiKVxuICAgICAgICAgICAgICAgIC5kaXJlY3Rpb24oJ2UnKVxuICAgICAgICAgICAgICAgIC5vZmZzZXQoWy0yLCA0XSk7XG4gICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG1vdXNlb3ZlcihkKXtcbiAgICAgICAgICAgICAgICBpZiAoIHdpbmRvdy5vcGVuVG9vbHRpcCApIHtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwLmhpZGUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGFiZWxUb29sdGlwLmh0bWwodGhpcy5wYXJlbnQudW5pdHNEZXNjcmlwdGlvbihkLmtleSkpO1xuICAgICAgICAgICAgICAgIGxhYmVsVG9vbHRpcC5zaG93KCk7XG4gICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwID0gbGFiZWxUb29sdGlwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1bml0c0xhYmVscy5lYWNoKChkLCBpLCBhcnJheSkgPT4geyAvLyBUTyBETyB0aGlzIGlzIHJlcGV0aXRpdmUgb2YgYWRkTGFiZWxzKClcbiAgICAgICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50LnVuaXRzRGVzY3JpcHRpb24oZC5rZXkpICE9PSB1bmRlZmluZWQgJiYgZDMuc2VsZWN0KGFycmF5W2ldKS5odG1sKCkgIT09ICcnKXtcbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAuaHRtbChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkMy5zZWxlY3QodGhpcykuaHRtbCgpICsgJzx0c3BhbiBkeT1cIi0wLjJlbVwiIGNsYXNzPVwiaW5mby1tYXJrXCI+JiM5NDMyOzwvdHNwYW4+JzsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2hhcy10b29sdGlwJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5W2ldLmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsIGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vdXNlb3Zlci5jYWxsKHRoaXMsZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5ibHVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdibHVyJywgbGFiZWxUb29sdGlwLmhpZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChsYWJlbFRvb2x0aXApOyAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIFxuICAgICAgICB9LFxuICAgICAgICBhZGRMYWJlbHMoKXtcblxuICAgICAgICAgICAgdmFyIGxhYmVsVG9vbHRpcCA9IGQzLnRpcCgpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcImQzLXRpcCBsYWJlbC10aXBcIilcbiAgICAgICAgICAgICAgICAuZGlyZWN0aW9uKCduJylcbiAgICAgICAgICAgICAgICAub2Zmc2V0KFstNCwgMTJdKTtcbiAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgZnVuY3Rpb24gbW91c2VvdmVyKGQpe1xuICAgICAgICAgICAgICAgIGlmICggd2luZG93Lm9wZW5Ub29sdGlwICkge1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAuaGlkZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsYWJlbFRvb2x0aXAuaHRtbCh0aGlzLnBhcmVudC5kZXNjcmlwdGlvbihkLmtleSkpO1xuICAgICAgICAgICAgICAgIGxhYmVsVG9vbHRpcC5zaG93KCk7XG4gICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwID0gbGFiZWxUb29sdGlwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmxhYmVsR3JvdXBzID0gdGhpcy5lYWNoU2VyaWVzXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICB0aGlzLmxhYmVscyA9IHRoaXMubGFiZWxHcm91cHNcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKGQpID0+IGB0cmFuc2xhdGUoJHt0aGlzLndpZHRoICsgOH0sICR7dGhpcy55U2NhbGUoZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdGhpcy5jb25maWcudmFyaWFibGVZXSkgKyAzfSlgKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ2EnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd4bGluazpocmVmJywnIycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdzZXJpZXMtbGFiZWwnKVxuICAgICAgICAgICAgICAgIC5odG1sKChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnPHRzcGFuIHg9XCIwXCI+JyArIHRoaXMucGFyZW50LmxhYmVsKGQua2V5KS5yZXBsYWNlKC9cXFxcbi9nLCc8L3RzcGFuPjx0c3BhbiB4PVwiMC41ZW1cIiBkeT1cIjEuMmVtXCI+JykgKyAnPC90c3Bhbj4nO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLmxhYmVscy5lYWNoKChkLCBpLCBhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICggdGhpcy5wYXJlbnQuZGVzY3JpcHRpb24oZC5rZXkpICE9PSB1bmRlZmluZWQgJiYgdGhpcy5wYXJlbnQuZGVzY3JpcHRpb24oZC5rZXkpICE9PSAnJyl7XG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5odG1sKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQzLnNlbGVjdCh0aGlzKS5odG1sKCkgKyAnPHRzcGFuIGR5PVwiLTAuMmVtXCIgY2xhc3M9XCJpbmZvLW1hcmtcIj4mIzk0MzI7PC90c3Bhbj4nOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApIFxuICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2hhcy10b29sdGlwJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5W2ldLmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsIGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vdXNlb3Zlci5jYWxsKHRoaXMsZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5ibHVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdibHVyJywgbGFiZWxUb29sdGlwLmhpZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChsYWJlbFRvb2x0aXApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5pc0ZpcnN0UmVuZGVyID0gZmFsc2U7XG4gICAgICAgICAgICBcblxuICAgICAgICAgICAgdGhpcy5yZWxheExhYmVscygpO1xuICAgICAgICAgICBcbiAgICAgICAgICAgXG4gICAgICAgIH0sXG4gICAgICAgIHJlbGF4TGFiZWxzKCl7IC8vIEhUIGh0dHA6Ly9qc2ZpZGRsZS5uZXQvdGh1ZGZhY3Rvci9CMldCVS8gYWRhcHRlZCB0ZWNobmlxdWVcbiAgICAgICAgICAgIHZhciBhbHBoYSA9IDEsXG4gICAgICAgICAgICAgICAgc3BhY2luZyA9IDAsXG4gICAgICAgICAgICAgICAgYWdhaW4gPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5sYWJlbHMuZWFjaCgoZCxpLGFycmF5MSkgPT4ge1xuICAgICAgICAgICAgICAgIHZhciBhID0gYXJyYXkxW2ldLFxuICAgICAgICAgICAgICAgICAgICAkYSA9IGQzLnNlbGVjdChhKSxcbiAgICAgICAgICAgICAgICAgICAgeUEgPSAkYS5hdHRyKCd5JyksXG4gICAgICAgICAgICAgICAgICAgIGFSYW5nZSA9IGQzLnJhbmdlKE1hdGgucm91bmQoYS5nZXRDVE0oKS5mKSAtIHNwYWNpbmcgKyBwYXJzZUludCh5QSksIE1hdGgucm91bmQoYS5nZXRDVE0oKS5mKSArIE1hdGgucm91bmQoYS5nZXRCQm94KCkuaGVpZ2h0KSArIDEgKyBzcGFjaW5nICsgcGFyc2VJbnQoeUEpKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubGFiZWxzLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGIgPSB0aGlzLFxuICAgICAgICAgICAgICAgICAgICAkYiA9IGQzLnNlbGVjdChiKSxcbiAgICAgICAgICAgICAgICAgICAgeUIgPSAkYi5hdHRyKCd5Jyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICggYSA9PT0gYiApIHtyZXR1cm47fVxuICAgICAgICAgICAgICAgICAgICB2YXIgYkxpbWl0cyA9IFtNYXRoLnJvdW5kKGIuZ2V0Q1RNKCkuZikgLSBzcGFjaW5nICsgcGFyc2VJbnQoeUIpLCBNYXRoLnJvdW5kKGIuZ2V0Q1RNKCkuZikgKyBiLmdldEJCb3goKS5oZWlnaHQgKyBzcGFjaW5nICsgcGFyc2VJbnQoeUIpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCAoYVJhbmdlWzBdIDwgYkxpbWl0c1swXSAmJiBhUmFuZ2VbYVJhbmdlLmxlbmd0aCAtIDFdIDwgYkxpbWl0c1swXSkgfHwgKGFSYW5nZVswXSA+IGJMaW1pdHNbMV0gJiYgYVJhbmdlW2FSYW5nZS5sZW5ndGggLSAxXSA+IGJMaW1pdHNbMV0pICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdubyBjb2xsaXNpb24nLCBhLCBiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfSAvLyBubyBjb2xsaXNvblxuICAgICAgICAgICAgICAgICAgICB2YXIgc2lnbiA9IGJMaW1pdHNbMF0gLSBhUmFuZ2VbYVJhbmdlLmxlbmd0aCAtIDFdIDw9IGFSYW5nZVswXSAtIGJMaW1pdHNbMV0gPyAxIDogLTEsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGp1c3QgPSBzaWduICogYWxwaGE7XG4gICAgICAgICAgICAgICAgICAgICRiLmF0dHIoJ3knLCAoK3lCIC0gYWRqdXN0KSApO1xuICAgICAgICAgICAgICAgICAgICAkYS5hdHRyKCd5JywgKCt5QSArIGFkanVzdCkgKTtcbiAgICAgICAgICAgICAgICAgICAgYWdhaW4gPSB0cnVlOyBcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIGkgPT09IGFycmF5MS5sZW5ndGggLSAxICYmIGFnYWluID09PSB0cnVlICkge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVsYXhMYWJlbHMoKTtcbiAgICAgICAgICAgICAgICAgICAgfSwyMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGFkZFBvaW50cygpe1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmdW5jdGlvbiBtb3VzZW92ZXIoZCxpLGFycmF5KXtcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoIHdpbmRvdy5vcGVuVG9vbHRpcCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcC5oaWRlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdmFyIGtsYXNzID0gYXJyYXlbaV0ucGFyZW50Tm9kZS5jbGFzc0xpc3QudmFsdWUubWF0Y2goL2NvbG9yLVxcZC8pWzBdOyAvLyBnZXQgdGhlIGNvbG9yIGNsYXNzIG9mIHRoZSBwYXJlbnQgZ1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJywgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJykgKyAnICcgKyBrbGFzcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJlZml4ID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3VmZml4ID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50LnVuaXRzKGQuc2VyaWVzKSAmJiB0aGlzLnBhcmVudC51bml0cyhkLnNlcmllcylbMF0gPT09ICckJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZWZpeCA9ICckJzsgLy8gVE8gRE86ICBoYW5kbGUgb3RoZXIgcHJlZml4ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBodG1sID0gJzxzdHJvbmc+JyArIHRoaXMucGFyZW50LnRpcFRleHQoZC5zZXJpZXMpICsgJzwvc3Ryb25nPiAoJyArIGQueWVhciArICcpPGJyIC8+JyArIHByZWZpeCArIGQzLmZvcm1hdCgnLCcpKGRbdGhpcy5jb25maWcudmFyaWFibGVZXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50LnVuaXRzKGQuc2VyaWVzKSAmJiB0aGlzLnBhcmVudC51bml0cyhkLnNlcmllcykgIT09ICcnKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWZmaXggPSB0aGlzLnBhcmVudC51bml0cyhkLnNlcmllcykucmVwbGFjZSgnJCcsJycpLnJlcGxhY2UoL3MkLywnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaHRtbCArPSAnICcgKyBzdWZmaXg7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY3VtID0gdGhpcy5jb25maWcudmFyaWFibGVZLnJlcGxhY2UoJ192YWx1ZScsJ19jdW0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggZFtjdW1dICE9PSAnJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGh0bWwgKz0gJzxiciAvPignICsgcHJlZml4ICsgZDMuZm9ybWF0KCcsJykoZFtjdW1dKSArIHN1ZmZpeCArICcgY3VtdWxhdGl2ZSknO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmh0bWwoaHRtbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuc2hvdygpO1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAgPSB0aGlzLnRvb2x0aXA7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmdW5jdGlvbiBtb3VzZW91dCgpe1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdtb3VzZW91dCcpO1xuICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycsIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycpLnJlcGxhY2UoLyBjb2xvci1cXGQvZywgJycpKTtcbiAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuaHRtbCgnJyk7XG4gICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmhpZGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucG9pbnRzID0gdGhpcy5lYWNoU2VyaWVzLnNlbGVjdEFsbCgncG9pbnRzJylcbiAgICAgICAgICAgICAgICAuZGF0YShkID0+IGQudmFsdWVzLCBkID0+IGQua2V5KVxuICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnY2lyY2xlJylcbiAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ29wYWNpdHknLCAwKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdkYXRhLXBvaW50JylcbiAgICAgICAgICAgICAgICAuYXR0cigncicsICc0JylcbiAgICAgICAgICAgICAgICAuYXR0cignY3gnLCBkID0+IHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSkpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2N5JywgZCA9PiB0aGlzLnlTY2FsZShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pKVxuICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5mb2N1cygpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbW91c2VvdmVyLmNhbGwodGhpcyxkLGksYXJyYXkpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgYXJyYXlbaV0uYmx1cigpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdibHVyJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtb3VzZW91dC5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdjbGljaycsIHRoaXMuYnJpbmdUb1RvcClcbiAgICAgICAgICAgICAgICAub24oJ2tleXVwJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkMy5ldmVudCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkMy5ldmVudC5rZXlDb2RlID09PSAxMyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJyaW5nVG9Ub3AuY2FsbChhcnJheVtpXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYWxsKHRoaXMudG9vbHRpcClcbiAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAuYXR0cignb3BhY2l0eScsIDEpO1xuICAgICAgICAgICAgXG5cbiAgICAgICAgfSxcbiAgICAgICAgYnJpbmdUb1RvcCgpe1xuICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5wYXJlbnROb2RlICE9PSB0aGlzLnBhcmVudE5vZGUucGFyZW50Tm9kZS5sYXN0Q2hpbGQpO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnBhcmVudE5vZGUgIT09IHRoaXMucGFyZW50Tm9kZS5wYXJlbnROb2RlLmxhc3RDaGlsZCApe1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjbGljaycsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzLnBhcmVudE5vZGUpLm1vdmVUb0Zyb250KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5mb2N1cygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzZXRUb29sdGlwcygpe1xuXG4gICAgICAgICAgICB0aGlzLnRvb2x0aXAgPSBkMy50aXAoKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJkMy10aXBcIilcbiAgICAgICAgICAgICAgICAuZGlyZWN0aW9uKCduJylcbiAgICAgICAgICAgICAgICAub2Zmc2V0KFstOCwgMF0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgfTtcblxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgQ2hhcnREaXZcbiAgICB9O1xuXG59KSgpO1xuIiwiZXhwb3J0IGNvbnN0IEhlbHBlcnMgPSAoZnVuY3Rpb24oKXtcbiAgICAvKiBnbG9iYWxzIERPTVN0cmluZ01hcCwgZDMgKi9cbiAgICBTdHJpbmcucHJvdG90eXBlLmNsZWFuU3RyaW5nID0gZnVuY3Rpb24oKSB7IC8vIGxvd2VyY2FzZSBhbmQgcmVtb3ZlIHB1bmN0dWF0aW9uIGFuZCByZXBsYWNlIHNwYWNlcyB3aXRoIGh5cGhlbnM7IGRlbGV0ZSBwdW5jdHVhdGlvblxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9bIFxcXFxcXC9dL2csJy0nKS5yZXBsYWNlKC9bJ1wi4oCd4oCZ4oCc4oCYLFxcLiFcXD87XFwoXFwpJl0vZywnJykudG9Mb3dlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgU3RyaW5nLnByb3RvdHlwZS5yZW1vdmVVbmRlcnNjb3JlcyA9IGZ1bmN0aW9uKCkgeyBcbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvXy9nLCcgJyk7XG4gICAgfTtcblxuICAgIERPTVN0cmluZ01hcC5wcm90b3R5cGUuY29udmVydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbmV3T2JqID0ge307XG4gICAgICAgIGZvciAoIHZhciBrZXkgaW4gdGhpcyApe1xuICAgICAgICAgICAgaWYgKHRoaXMuaGFzT3duUHJvcGVydHkoa2V5KSl7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbmV3T2JqW2tleV0gPSBKU09OLnBhcnNlKHRoaXNba2V5XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgICAgICBuZXdPYmpba2V5XSA9IHRoaXNba2V5XTsgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld09iajtcbiAgICB9O1xuXG4gICAgZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5tb3ZlVG9Gcm9udCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHRoaXMucGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0aGlzKTtcbiAgICAgICAgICB9KTtcbiAgICB9O1xuICAgIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUubW92ZVRvQmFjayA9IGZ1bmN0aW9uKCl7IFxuICAgICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICB2YXIgZmlyc3RDaGlsZCA9IHRoaXMucGFyZW50Tm9kZS5maXJzdENoaWxkO1xuICAgICAgICAgICAgaWYgKCBmaXJzdENoaWxkICkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUodGhpcywgZmlyc3RDaGlsZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBpZiAod2luZG93Lk5vZGVMaXN0ICYmICFOb2RlTGlzdC5wcm90b3R5cGUuZm9yRWFjaCkge1xuICAgICAgICBOb2RlTGlzdC5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgICAgICAgdGhpc0FyZyA9IHRoaXNBcmcgfHwgd2luZG93O1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB0aGlzW2ldLCBpLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoIU9iamVjdC5oYXNPd25Qcm9wZXJ0eSgnZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycycpKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoXG4gICAgICAgIE9iamVjdCxcbiAgICAgICAgJ2dldE93blByb3BlcnR5RGVzY3JpcHRvcnMnLFxuICAgICAgICB7XG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKG9iamVjdCkge1xuICAgICAgICAgICAgcmV0dXJuIFJlZmxlY3Qub3duS2V5cyhvYmplY3QpLnJlZHVjZSgoZGVzY3JpcHRvcnMsIGtleSkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0b3JzLFxuICAgICAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICB2YWx1ZTogT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmplY3QsIGtleSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9LCB7fSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbn0pKCk7XG4iLCIvLyBkMy50aXBcbi8vIENvcHlyaWdodCAoYykgMjAxMyBKdXN0aW4gUGFsbWVyXG4vLyBFUzYgLyBEMyB2NCBBZGFwdGlvbiBDb3B5cmlnaHQgKGMpIDIwMTYgQ29uc3RhbnRpbiBHYXZyaWxldGVcbi8vIFJlbW92YWwgb2YgRVM2IGZvciBEMyB2NCBBZGFwdGlvbiBDb3B5cmlnaHQgKGMpIDIwMTYgRGF2aWQgR290elxuLy9cbi8vIFRvb2x0aXBzIGZvciBkMy5qcyBTVkcgdmlzdWFsaXphdGlvbnNcblxuZXhwb3J0IGNvbnN0IGQzVGlwID0gKGZ1bmN0aW9uKCl7XG4gIGQzLmZ1bmN0b3IgPSBmdW5jdGlvbiBmdW5jdG9yKHYpIHtcbiAgICByZXR1cm4gdHlwZW9mIHYgPT09IFwiZnVuY3Rpb25cIiA/IHYgOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB2O1xuICAgIH07XG4gIH07XG5cbiAgZDMudGlwID0gZnVuY3Rpb24oKSB7XG5cbiAgICB2YXIgZGlyZWN0aW9uID0gZDNfdGlwX2RpcmVjdGlvbixcbiAgICAgICAgb2Zmc2V0ICAgID0gZDNfdGlwX29mZnNldCxcbiAgICAgICAgaHRtbCAgICAgID0gZDNfdGlwX2h0bWwsXG4gICAgICAgIG5vZGUgICAgICA9IGluaXROb2RlKCksXG4gICAgICAgIHN2ZyAgICAgICA9IG51bGwsXG4gICAgICAgIHBvaW50ICAgICA9IG51bGwsXG4gICAgICAgIHRhcmdldCAgICA9IG51bGxcblxuICAgIGZ1bmN0aW9uIHRpcCh2aXMpIHtcbiAgICAgIHN2ZyA9IGdldFNWR05vZGUodmlzKVxuICAgICAgcG9pbnQgPSBzdmcuY3JlYXRlU1ZHUG9pbnQoKVxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKVxuICAgIH1cblxuICAgIC8vIFB1YmxpYyAtIHNob3cgdGhlIHRvb2x0aXAgb24gdGhlIHNjcmVlblxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5zaG93ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgIGlmKGFyZ3NbYXJncy5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIFNWR0VsZW1lbnQpIHRhcmdldCA9IGFyZ3MucG9wKClcblxuICAgICAgdmFyIGNvbnRlbnQgPSBodG1sLmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIHBvZmZzZXQgPSBvZmZzZXQuYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgZGlyICAgICA9IGRpcmVjdGlvbi5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBub2RlbCAgID0gZ2V0Tm9kZUVsKCksXG4gICAgICAgICAgaSAgICAgICA9IGRpcmVjdGlvbnMubGVuZ3RoLFxuICAgICAgICAgIGNvb3JkcyxcbiAgICAgICAgICBzY3JvbGxUb3AgID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcCB8fCBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCxcbiAgICAgICAgICBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQgfHwgZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0XG5cbiAgICAgIG5vZGVsLmh0bWwoY29udGVudClcbiAgICAgICAgLnN0eWxlKCdwb3NpdGlvbicsICdhYnNvbHV0ZScpXG4gICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDEpXG4gICAgICAgIC5zdHlsZSgncG9pbnRlci1ldmVudHMnLCAnYWxsJylcblxuICAgICAgd2hpbGUoaS0tKSBub2RlbC5jbGFzc2VkKGRpcmVjdGlvbnNbaV0sIGZhbHNlKVxuICAgICAgY29vcmRzID0gZGlyZWN0aW9uX2NhbGxiYWNrc1tkaXJdLmFwcGx5KHRoaXMpXG4gICAgICBub2RlbC5jbGFzc2VkKGRpciwgdHJ1ZSlcbiAgICAgICAgLnN0eWxlKCd0b3AnLCAoY29vcmRzLnRvcCArICBwb2Zmc2V0WzBdKSArIHNjcm9sbFRvcCArICdweCcpXG4gICAgICAgIC5zdHlsZSgnbGVmdCcsIChjb29yZHMubGVmdCArIHBvZmZzZXRbMV0pICsgc2Nyb2xsTGVmdCArICdweCcpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWMgLSBoaWRlIHRoZSB0b29sdGlwXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGEgdGlwXG4gICAgdGlwLmhpZGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBub2RlbCA9IGdldE5vZGVFbCgpXG4gICAgICBub2RlbFxuICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAwKVxuICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKVxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogUHJveHkgYXR0ciBjYWxscyB0byB0aGUgZDMgdGlwIGNvbnRhaW5lci4gIFNldHMgb3IgZ2V0cyBhdHRyaWJ1dGUgdmFsdWUuXG4gICAgLy9cbiAgICAvLyBuIC0gbmFtZSBvZiB0aGUgYXR0cmlidXRlXG4gICAgLy8gdiAtIHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIGF0dHJpYnV0ZSB2YWx1ZVxuICAgIHRpcC5hdHRyID0gZnVuY3Rpb24obiwgdikge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyICYmIHR5cGVvZiBuID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZ2V0Tm9kZUVsKCkuYXR0cihuKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGFyZ3MgPSAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxuICAgICAgICBkMy5zZWxlY3Rpb24ucHJvdG90eXBlLmF0dHIuYXBwbHkoZ2V0Tm9kZUVsKCksIGFyZ3MpXG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFByb3h5IHN0eWxlIGNhbGxzIHRvIHRoZSBkMyB0aXAgY29udGFpbmVyLiAgU2V0cyBvciBnZXRzIGEgc3R5bGUgdmFsdWUuXG4gICAgLy9cbiAgICAvLyBuIC0gbmFtZSBvZiB0aGUgcHJvcGVydHlcbiAgICAvLyB2IC0gdmFsdWUgb2YgdGhlIHByb3BlcnR5XG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIHRpcCBvciBzdHlsZSBwcm9wZXJ0eSB2YWx1ZVxuICAgIHRpcC5zdHlsZSA9IGZ1bmN0aW9uKG4sIHYpIHtcbiAgICAgIC8vIGRlYnVnZ2VyO1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyICYmIHR5cGVvZiBuID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZ2V0Tm9kZUVsKCkuc3R5bGUobilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgdmFyIHN0eWxlcyA9IGFyZ3NbMF07XG4gICAgICAgICAgT2JqZWN0LmtleXMoc3R5bGVzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUuc3R5bGUuYXBwbHkoZ2V0Tm9kZUVsKCksIFtrZXksIHN0eWxlc1trZXldXSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogU2V0IG9yIGdldCB0aGUgZGlyZWN0aW9uIG9mIHRoZSB0b29sdGlwXG4gICAgLy9cbiAgICAvLyB2IC0gT25lIG9mIG4obm9ydGgpLCBzKHNvdXRoKSwgZShlYXN0KSwgb3Igdyh3ZXN0KSwgbncobm9ydGh3ZXN0KSxcbiAgICAvLyAgICAgc3coc291dGh3ZXN0KSwgbmUobm9ydGhlYXN0KSBvciBzZShzb3V0aGVhc3QpXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIHRpcCBvciBkaXJlY3Rpb25cbiAgICB0aXAuZGlyZWN0aW9uID0gZnVuY3Rpb24odikge1xuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gZGlyZWN0aW9uXG4gICAgICBkaXJlY3Rpb24gPSB2ID09IG51bGwgPyB2IDogZDMuZnVuY3Rvcih2KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBTZXRzIG9yIGdldHMgdGhlIG9mZnNldCBvZiB0aGUgdGlwXG4gICAgLy9cbiAgICAvLyB2IC0gQXJyYXkgb2YgW3gsIHldIG9mZnNldFxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBvZmZzZXQgb3JcbiAgICB0aXAub2Zmc2V0ID0gZnVuY3Rpb24odikge1xuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gb2Zmc2V0XG4gICAgICBvZmZzZXQgPSB2ID09IG51bGwgPyB2IDogZDMuZnVuY3Rvcih2KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBzZXRzIG9yIGdldHMgdGhlIGh0bWwgdmFsdWUgb2YgdGhlIHRvb2x0aXBcbiAgICAvL1xuICAgIC8vIHYgLSBTdHJpbmcgdmFsdWUgb2YgdGhlIHRpcFxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBodG1sIHZhbHVlIG9yIHRpcFxuICAgIHRpcC5odG1sID0gZnVuY3Rpb24odikge1xuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gaHRtbFxuICAgICAgaHRtbCA9IHYgPT0gbnVsbCA/IHYgOiBkMy5mdW5jdG9yKHYpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IGRlc3Ryb3lzIHRoZSB0b29sdGlwIGFuZCByZW1vdmVzIGl0IGZyb20gdGhlIERPTVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZihub2RlKSB7XG4gICAgICAgIGdldE5vZGVFbCgpLnJlbW92ZSgpO1xuICAgICAgICBub2RlID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aXA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZDNfdGlwX2RpcmVjdGlvbigpIHsgcmV0dXJuICduJyB9XG4gICAgZnVuY3Rpb24gZDNfdGlwX29mZnNldCgpIHsgcmV0dXJuIFswLCAwXSB9XG4gICAgZnVuY3Rpb24gZDNfdGlwX2h0bWwoKSB7IHJldHVybiAnICcgfVxuXG4gICAgdmFyIGRpcmVjdGlvbl9jYWxsYmFja3MgPSB7XG4gICAgICBuOiAgZGlyZWN0aW9uX24sXG4gICAgICBzOiAgZGlyZWN0aW9uX3MsXG4gICAgICBlOiAgZGlyZWN0aW9uX2UsXG4gICAgICB3OiAgZGlyZWN0aW9uX3csXG4gICAgICBudzogZGlyZWN0aW9uX253LFxuICAgICAgbmU6IGRpcmVjdGlvbl9uZSxcbiAgICAgIHN3OiBkaXJlY3Rpb25fc3csXG4gICAgICBzZTogZGlyZWN0aW9uX3NlXG4gICAgfTtcblxuICAgIHZhciBkaXJlY3Rpb25zID0gT2JqZWN0LmtleXMoZGlyZWN0aW9uX2NhbGxiYWNrcyk7XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fbigpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm4ueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm4ueCAtIG5vZGUub2Zmc2V0V2lkdGggLyAyXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3MoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zLnksXG4gICAgICAgIGxlZnQ6IGJib3gucy54IC0gbm9kZS5vZmZzZXRXaWR0aCAvIDJcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LmUueSAtIG5vZGUub2Zmc2V0SGVpZ2h0IC8gMixcbiAgICAgICAgbGVmdDogYmJveC5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fdygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LncueSAtIG5vZGUub2Zmc2V0SGVpZ2h0IC8gMixcbiAgICAgICAgbGVmdDogYmJveC53LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX253KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubncueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm53LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX25lKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubmUueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fc3coKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zdy55LFxuICAgICAgICBsZWZ0OiBiYm94LnN3LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3NlKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guc2UueSxcbiAgICAgICAgbGVmdDogYmJveC5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0Tm9kZSgpIHtcbiAgICAgIHZhciBub2RlID0gZDMuc2VsZWN0KGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKVxuICAgICAgbm9kZVxuICAgICAgICAuc3R5bGUoJ3Bvc2l0aW9uJywgJ2Fic29sdXRlJylcbiAgICAgICAgLnN0eWxlKCd0b3AnLCAwKVxuICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAwKVxuICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKVxuICAgICAgICAuc3R5bGUoJ2JveC1zaXppbmcnLCAnYm9yZGVyLWJveCcpXG5cbiAgICAgIHJldHVybiBub2RlLm5vZGUoKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNWR05vZGUoZWwpIHtcbiAgICAgIGVsID0gZWwubm9kZSgpXG4gICAgICBpZihlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdzdmcnKVxuICAgICAgICByZXR1cm4gZWxcblxuICAgICAgcmV0dXJuIGVsLm93bmVyU1ZHRWxlbWVudFxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldE5vZGVFbCgpIHtcbiAgICAgIGlmKG5vZGUgPT09IG51bGwpIHtcbiAgICAgICAgbm9kZSA9IGluaXROb2RlKCk7XG4gICAgICAgIC8vIHJlLWFkZCBub2RlIHRvIERPTVxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG5vZGUpO1xuICAgICAgfTtcbiAgICAgIHJldHVybiBkMy5zZWxlY3Qobm9kZSk7XG4gICAgfVxuXG4gICAgLy8gUHJpdmF0ZSAtIGdldHMgdGhlIHNjcmVlbiBjb29yZGluYXRlcyBvZiBhIHNoYXBlXG4gICAgLy9cbiAgICAvLyBHaXZlbiBhIHNoYXBlIG9uIHRoZSBzY3JlZW4sIHdpbGwgcmV0dXJuIGFuIFNWR1BvaW50IGZvciB0aGUgZGlyZWN0aW9uc1xuICAgIC8vIG4obm9ydGgpLCBzKHNvdXRoKSwgZShlYXN0KSwgdyh3ZXN0KSwgbmUobm9ydGhlYXN0KSwgc2Uoc291dGhlYXN0KSwgbncobm9ydGh3ZXN0KSxcbiAgICAvLyBzdyhzb3V0aHdlc3QpLlxuICAgIC8vXG4gICAgLy8gICAgKy0rLStcbiAgICAvLyAgICB8ICAgfFxuICAgIC8vICAgICsgICArXG4gICAgLy8gICAgfCAgIHxcbiAgICAvLyAgICArLSstK1xuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhbiBPYmplY3Qge24sIHMsIGUsIHcsIG53LCBzdywgbmUsIHNlfVxuICAgIGZ1bmN0aW9uIGdldFNjcmVlbkJCb3goKSB7XG4gICAgICB2YXIgdGFyZ2V0ZWwgICA9IHRhcmdldCB8fCBkMy5ldmVudC50YXJnZXQ7XG5cbiAgICAgIHdoaWxlICgndW5kZWZpbmVkJyA9PT0gdHlwZW9mIHRhcmdldGVsLmdldFNjcmVlbkNUTSAmJiAndW5kZWZpbmVkJyA9PT0gdGFyZ2V0ZWwucGFyZW50Tm9kZSkge1xuICAgICAgICAgIHRhcmdldGVsID0gdGFyZ2V0ZWwucGFyZW50Tm9kZTtcbiAgICAgIH1cblxuICAgICAgdmFyIGJib3ggICAgICAgPSB7fSxcbiAgICAgICAgICBtYXRyaXggICAgID0gdGFyZ2V0ZWwuZ2V0U2NyZWVuQ1RNKCksXG4gICAgICAgICAgdGJib3ggICAgICA9IHRhcmdldGVsLmdldEJCb3goKSxcbiAgICAgICAgICB3aWR0aCAgICAgID0gdGJib3gud2lkdGgsXG4gICAgICAgICAgaGVpZ2h0ICAgICA9IHRiYm94LmhlaWdodCxcbiAgICAgICAgICB4ICAgICAgICAgID0gdGJib3gueCxcbiAgICAgICAgICB5ICAgICAgICAgID0gdGJib3gueVxuXG4gICAgICBwb2ludC54ID0geFxuICAgICAgcG9pbnQueSA9IHlcbiAgICAgIGJib3gubncgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCArPSB3aWR0aFxuICAgICAgYmJveC5uZSA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55ICs9IGhlaWdodFxuICAgICAgYmJveC5zZSA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54IC09IHdpZHRoXG4gICAgICBiYm94LnN3ID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnkgLT0gaGVpZ2h0IC8gMlxuICAgICAgYmJveC53ICA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54ICs9IHdpZHRoXG4gICAgICBiYm94LmUgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCAtPSB3aWR0aCAvIDJcbiAgICAgIHBvaW50LnkgLT0gaGVpZ2h0IC8gMlxuICAgICAgYmJveC5uID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnkgKz0gaGVpZ2h0XG4gICAgICBiYm94LnMgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuXG4gICAgICByZXR1cm4gYmJveFxuICAgIH1cblxuICAgIHJldHVybiB0aXBcbiAgfTtcbn0pKCk7Il19
