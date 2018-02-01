(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _polyfills = require('../js-vendor/polyfills');

var _Helpers = require('../js-exports/Helpers');

var _Charts = require('../js-exports/Charts');

var _d3Tip = require('../js-vendor/d3-tip');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /* exported D3Charts, Helpers, d3Tip, reflect, arrayFind, SVGInnerHTML, SVGFocus */ // let's jshint know that D3Charts can be "defined but not used" in this file
/* polyfills needed: Promise, Array.isArray, Array.find, Array.filter, Reflect, Object.ownPropertyDescriptors
*/

/*
initialized by windows.D3Charts.Init() which creates a new D3ChartGroup for each div.d3-group in the DOM.
each div's data attributes supply the configuration needed. individual charts inherit from the group's onfiguration
data but can also specify their own.

groups are collected in groupCollection array 

*/


var D3Charts = function () {

    "use strict";

    var groupCollection = [];
    var D3ChartGroup = function D3ChartGroup(container, index) {
        var _this = this;

        this.container = container;
        this.index = index;
        this.config = container.dataset.convert(); // method provided in Helpers

        this.dataPromises = this.returnDataPromises();
        this.children = [];
        this.collectAll = [];
        this.dataPromises.then(function () {
            // when the data promises resolve, charts are initialized
            _this.initializeCharts(container, index);
        });
    };
    //prototype begins here
    D3ChartGroup.prototype = {
        returnDataPromises: function returnDataPromises() {
            var _this2 = this;

            // gets data from Google Sheet, converst rows to key-value pairs, nests the data
            // as specified by the config object, and creates array of summarized data at different
            // nesting levels                                
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
                        resolve(_this2.returnKeyValues(values, nestBy, true, nestType, i, _this2.config.normalizeColumnsStart));
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
            var nestByArray = this.nestByArray.map(function (a) {
                return a;
            });
            var variableX = this.config.variableX;

            function reduceVariables(d) {
                return {
                    y: {
                        max: d3.max(d, function (d) {
                            return d.value;
                        }),
                        min: d3.min(d, function (d) {
                            return d.value;
                        }),
                        mean: d3.mean(d, function (d) {
                            return d.value;
                        }),
                        sum: d3.sum(d, function (d) {
                            return d.value;
                        }),
                        median: d3.median(d, function (d) {
                            return d.value;
                        }),
                        variance: d3.variance(d, function (d) {
                            return d.value;
                        }),
                        deviation: d3.deviation(d, function (d) {
                            return d.value;
                        })
                    },
                    x: {
                        max: d3.max(d, function (d) {
                            return d[variableX];
                        }),
                        min: d3.min(d, function (d) {
                            return d[variableX];
                        }),
                        mean: d3.mean(d, function (d) {
                            return d[variableX];
                        }),
                        sum: d3.sum(d, function (d) {
                            return d[variableX];
                        }),
                        median: d3.median(d, function (d) {
                            return d[variableX];
                        }),
                        variance: d3.variance(d, function (d) {
                            return d[variableX];
                        }),
                        deviation: d3.deviation(d, function (d) {
                            return d[variableX];
                        })
                    }
                };
            }

            while (nestByArray.length > 0) {
                var summarized = this.nestPrelim(nestByArray).rollup(reduceVariables).object(this.unnested);
                summaries.push(summarized);
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
        returnNormalizedValues: function returnNormalizedValues(values, start) {

            var newRowsArray = [[].concat(_toConsumableArray(values[0].slice(0, start)), ['property', 'value'])];
            values.slice(1).forEach(function (row) {
                var repeat = row.slice(0, start);
                row.slice(start).forEach(function (value, i) {
                    var newRow = [].concat(_toConsumableArray(repeat), [values[0][i + start], value]);
                    if (value !== "") {
                        newRowsArray.push(newRow);
                    }
                });
            });

            return newRowsArray;
        },
        returnKeyValues: function returnKeyValues(values, nestBy) {
            var coerce = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
            var nestType = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'series';
            var tabIndex = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;
            var normalizeColumnsStart = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : undefined;

            // this fn takes normalized data fetched as an array of rows and uses the values in the first row as keys for values in
            // subsequent rows
            // nestBy = string or array of field(s) to nest by, or a custom function, or an array of strings or functions;
            // coerce = BOOL coerce to num or not; nestType = object or series nest (d3)
            var prelim;
            if (normalizeColumnsStart !== undefined && tabIndex === 0) {
                values = this.returnNormalizedValues(values, normalizeColumnsStart);
            }
            var unnested = values.slice(1).map(function (row) {
                return row.reduce(function (acc, cur, i) {

                    // 1. params: total, currentValue, currentIndex[, arr]
                    // 3. // acc is an object , key is corresponding value from row 0, value is current value of array

                    acc[values[0][i]] = coerce === true ? isNaN(+cur) || cur === '' ? cur : +cur : cur;
                    return acc;

                    // test for empty strings before coercing bc +'' => 0
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
                    this.nestByArray = [nestBy];
                } else {
                    if (!Array.isArray(nestBy)) {
                        throw 'nestBy variable must be a string, function, or array of strings or functions';
                    }
                    this.nestByArray = nestBy;
                }
                prelim = this.nestPrelim(this.nestByArray);
            }
            if (nestType === 'object') {
                return prelim.object(unnested);
            } else {
                return prelim.entries(unnested);
            }
        },
        initializeCharts: function initializeCharts(container, index) {

            var group = this;
            d3.selectAll('.d3-chart.group-' + index) // select all `div.d3-chart`s that are associated
            // with the group by classname "group-" + index 
            .each(function () {
                group.children.push(new _Charts.Charts.ChartDiv(this, group)); // constructor provided in Charts
            });
        }
    }; // D3ChartGroup prototype ends here

    /* PUBLIC API */
    window.D3Charts = {
        // need to specify window bc after transpiling all this will be wrapped in IIFEs
        // and `return`ing won't get the export into window's global scope
        Init: function Init() {
            var groupDivs = document.querySelectorAll('.d3-group');
            for (var i = 0; i < groupDivs.length; i++) {
                groupCollection.push(new D3ChartGroup(groupDivs[i], i));
            } // container, index 

        },

        collectAll: [],
        UpdateAll: function UpdateAll(variableY) {

            this.collectAll.forEach(function (each) {
                each.update(variableY);
            });
        },
        UpdateGroup: function UpdateGroup(index, variableY) {
            groupCollection[index].collectAll.forEach(function (each) {
                each.update(variableY);
            });
        }
    };
}(); // end var D3Charts IIFE

},{"../js-exports/Charts":2,"../js-exports/Helpers":3,"../js-vendor/d3-tip":4,"../js-vendor/polyfills":5}],2:[function(require,module,exports){
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

        // constructor called from scripts once for each div.d3-chart
        // in the DOM. container is the DOM element; parent is the 
        // D3ChartGroup to which it belongs
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
        // parent.data is the entire dataset from the Google Sheet. line above selects from that dataset the object
        // matching the category specified for the current ChartDiv. here is why the data has to be nested first by 
        // the category

        /* remove seriesInstruct bc groupSeries can handle it */

        this.groupedSeriesData = this.groupSeries(); // organizes data acc to instruction re grouping series  

        this.dictionary = this.parent.dictionary;
        if (this.config.heading !== false) {
            this.addHeading(this.config.heading);
        }
        d3.select(this.container).append('div');
        this.createCharts(); // a new Chart for each grouped series
    };

    ChartDiv.prototype = {

        chartTypes: {
            line: 'LineChart',
            column: 'ColumnChart',
            bar: 'BarChart' // so on . . .
        },
        createCharts: function createCharts() {
            var _this2 = this;

            this.groupedSeriesData.forEach(function (each) {
                _this2.children.push(new LineChart(_this2, each)); // TO DO distinguish chart types here
            }); // parent, data   
        },
        groupSeries: function groupSeries() {
            var _this3 = this;

            // takes the datum for the chartDiv (the data matching the specified category)
            // and organizes the series according the seriesGroup instructions from the data attributes 
            // 'all' puts all series together in one array with consequence of all series being rendered
            // in the same SVG.  'none' puts each series in its own array; each is rendered in its own SVG;
            // if an array of arrays is specified in the configuration for the ChartDiv, the grouped series
            // are rendered together.
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
                heading.html(heading.html() + '<svg focusable="false" class="inline heading-info"><a focusable="true" tabindex="0" xlink:href="#"><text x="4" y="12" class="info-mark">?</text></a></svg>');

                heading.select('.heading-info a').classed('has-tooltip', true).on('mouseover', function () {
                    this.focus();
                }).on('focus', function () {
                    mouseover.call(_this4);
                }).on('mouseout', function () {
                    this.blur();
                    //this.setAttribute('disabled','true');
                }).on('blur', labelTooltip.hide).on('click', function () {
                    d3.event.preventDefault();
                }).call(labelTooltip);
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

    var LineChart = function LineChart(parent, data) {
        // one chart is created for each group of series to be rendered
        // together. charts with the same parent are rendered in the same chartDiv
        // the data for each chart is already filtered to be only the series intended
        // for that chart

        this.parent = parent;
        this.config = parent.config;
        this.marginTop = +this.config.marginTop || this.defaultMargins.top;
        this.marginRight = +this.config.marginRight || this.defaultMargins.right;
        this.marginBottom = +this.config.marginBottom || this.defaultMargins.bottom;
        this.marginLeft = +this.config.marginLeft || this.defaultMargins.left;
        this.width = this.config.svgWidth ? +this.config.svgWidth - this.marginRight - this.marginLeft : 320 - this.marginRight - this.marginLeft;
        this.height = this.config.svgHeight ? +this.config.svgHeight - this.marginTop - this.marginBottom : (this.width + this.marginRight + this.marginLeft) / 2 - this.marginTop - this.marginBottom;
        this.data = data;
        this.resetColors = this.config.resetColors || false;
        this.container = this.init(parent.container); // TO DO  this is kinda weird
        this.xScaleType = this.config.xScaleType || 'time';
        this.yScaleType = this.config.yScaleType || 'linear';
        this.xTimeType = this.config.xTimeType || '%Y';
        this.scaleBy = this.config.scaleBy || this.config.variableY;
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
            D3Charts.collectAll.push(this); // pushes all charts on the page to one collection
            this.parent.parent.collectAll.push(this); // pushes all charts from one ChartGroup to the ChartGroup's collection

            var container = d3.select(chartDiv).select('div').append('svg').attr('focusable', false).attr('width', this.width + this.marginRight + this.marginLeft).attr('height', this.height + this.marginTop + this.marginBottom);

            this.svg = container.append('g').attr('transform', 'translate(' + this.marginLeft + ', ' + this.marginTop + ')');

            this.xAxisGroup = this.svg.append('g');

            this.yAxisGroup = this.svg.append('g');

            this.allSeries = this.svg.append('g') // ie the group that will hold all the series groups
            // specified to be rendered in this chart
            .classed('all-series', true);

            if (this.resetColors) {
                // if the div's data-reset-colors attribute is true,
                // chart will render series as if from the beginning
                this.parent.seriesCount = 0;
            }
            // TO DO : THIS HSOULD BE IN CHART PROTOTYPE
            this.potentialSeries = this.allSeries.selectAll('potential-series') // potential series bc the series
            // may not have data for the current
            // y variable
            .data(function () {
                // append a g for potential series in the Charts data (seriesGroup)
                // HERE IS WHERE NESTING BY Y VARIABLE WOULD COME INTO PLAY       

                // return this.data.find(each => each.key === this.config.variableY).values;
                return _this5.data;
            }, function (d) {
                return d.key;
            }).enter().append('g').attr('class', 'potential-series');

            this.bindData();

            if (this.config.stackSeries && this.config.stackSeries === true) {
                this.prepareStacking(); // TO DO. SEPARATE STACKING FROM AREA. STACKING COULD APPLY TO MANY CHART TYPES
            }

            return container.node();
        },
        bindData: function bindData() {
            var _this6 = this;

            // TO DO : THIS HSOULD BE IN CHART PROTOTYPE
            var update = this.potentialSeries.selectAll('each-series').data(function (d) {
                return [d.values.find(function (each) {
                    return each.key === _this6.config.variableY;
                })];
            }, function (d) {
                return d.values[0].series;
            });
            update.exit().remove();
            update.classed('update', true);

            this.eachSeries = update.enter().append('g').merge(update).attr('class', function () {
                return 'each-series series-' + _this6.parent.seriesCount + ' color-' + _this6.parent.seriesCount++ % 4;
            }).classed('enter', true);
        },
        update: function update() {
            var variableY = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.config.variableY;

            this.config.variableY = variableY;
            this.prepareStacking();
            this.setScales();
            this.updateLines();
        },
        prepareStacking: function prepareStacking() {
            var _this7 = this;

            // TO DO. SEPARATE STACKING FROM AREA. STACKING COULD APPLY TO MANY CHART TYPES
            var forStacking = this.data.reduce(function (acc, cur, i) {

                if (i === 0) {
                    cur.values.forEach(function (each) {
                        var _acc$push;

                        acc.push((_acc$push = {}, _defineProperty(_acc$push, _this7.config.variableX, each[_this7.config.variableX]), _defineProperty(_acc$push, cur.key, each[_this7.config.variableY]), _acc$push));
                    });
                } else {
                    cur.values.forEach(function (each) {
                        acc.find(function (obj) {
                            return obj[_this7.config.variableX] === each[_this7.config.variableX];
                        })[cur.key] = each[_this7.config.variableY];
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
            var _this8 = this;

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

            var yVariables = Array.isArray(this.scaleBy) ? this.scaleBy : Array.isArray(this.config.variableY) ? this.config.variableY : [this.config.variableY];

            this.data.forEach(function (each) {
                xMaxes.push(_this8.parent.parent.summaries[1][_this8.config.category][each.key].x.max);
                xMins.push(_this8.parent.parent.summaries[1][_this8.config.category][each.key].x.min);
                yVariables.forEach(function (yVar) {
                    yMaxes.push(_this8.parent.parent.summaries[0][_this8.config.category][each.key][yVar].y.max);
                    yMins.push(_this8.parent.parent.summaries[0][_this8.config.category][each.key][yVar].y.min);
                });
            });

            this.xMax = d3.max(xMaxes);
            this.xMin = d3.max(xMins);
            this.yMax = d3.max(yMaxes);
            this.yMin = d3.min(yMins);
            this.xValuesUnique = [];

            if (this.config.stackSeries && this.config.stackSeries === true) {

                var yValues = this.stackData.reduce(function (acc, cur) {

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
            var _this9 = this;

            var zeroValueline = d3.line().x(function (d) {
                if (_this9.xValuesUnique.indexOf(d[_this9.config.variableX]) === -1) {
                    _this9.xValuesUnique.push(d[_this9.config.variableX]);
                }
                return _this9.xScale(d3.timeParse(_this9.xTimeType)(d[_this9.config.variableX]));
            }).y(function () {
                return _this9.yScale(0);
            });

            this.lines = this.eachSeries.append('path').attr('class', 'line').attr('d', function (d) {
                return zeroValueline(d.values);
            });

            this.updateLines();
            /*  var valueline = d3.line()
                  .x(d => {
                      if ( this.xValuesUnique.indexOf(d[this.config.variableX]) === -1 ){
                          this.xValuesUnique.push(d[this.config.variableX]);
                      }
                      return this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX]));
                  }) 
                  .y((d) => {
                      
                      return this.yScale(d.value);
                  });*/
            // TO DO : ADD BACK IN STACKED SERIES  
            /* if ( this.config.stackSeries && this.config.stackSeries === true ){
                 
                 var area = d3.area()
                     .x(d => this.xScale(d3.timeParse(this.xTimeType)(d.data[this.config.variableX])))
                     .y0(d => this.yScale(d[0]))
                     .y1(d => this.yScale(d[1]));
                  var line = d3.line()
                     .x(d => this.xScale(d3.timeParse(this.xTimeType)(d.data[this.config.variableX])))
                     .y(d => this.yScale(d[1]));
                  var stackGroup = this.svg.append('g')
                     .attr('class', 'stacked-area');
                     
                  stackGroup    
                     .selectAll('stacked-area')
                     .data(this.stackData)
                     .enter().append('path') // TO DO: add zero-line equivalent and logic for transition on update
                     .attr('class', (d,i) => 'area-line color-' + i) // TO DO not quite right that color shold be `i`
                                                                          // if you have more than one group of series, will repeat
                     .attr('d', d => area(d));
                  stackGroup
                     .selectAll('stacked-line') // TO DO: add zero-line equivalent and logic for transition on update
                     .data(this.stackData)
                     .enter().append('path')
                     .attr('class', (d,i) => 'line color-' + i) 
                     .attr('d', d => line(d));
                  
             } else { 
                 if ( this.isFirstRender ){ */

            /* .transition().duration(500).delay(150)
             .attr('d', (d) => {
                 return valueline(d.values);
             });
             /*.on('end', (d,i,array) => {
                 
                 if ( i === array.length - 1 ){
                     
                     this.addPoints();
                     this.addLabels();
                 }
             });*/
            /* } else {
                 d3.selectAll(this.lines.nodes())
                     .each((d,i,array) => {
                         if ( isNaN(d.values[0][this.config.variableY]) ){ // this a workaround for handling NAs
                                                                           // would be nicer to handle via exit()
                                                                           // but may be hard bc of how data is
                                                                           // structured
                              d3.select(array[i])
                                 .transition().duration(500)
                                 .style('opacity',0)
                                 .on('end', function(){
                                     d3.select(this)
                                         .classed('display-none', true);
                                 });
                         } else {
                         d3.select(array[i])
                             .classed('display-none', false)
                             .transition().duration(500)
                             .style('opacity',1)
                             .attr('d', (d) => {
                                 return valueline(d.values);
                             });
                         }
                     });
                  d3.selectAll(this.points.nodes())
                     .each((d,i,array) => {
                         if ( isNaN(d[this.config.variableY]) ){ // this a workaround for handling NAs
                                                                           // would be nicer to handle via exit()
                                                                           // but may be hard bc of how data is
                                                                           // structured
                              d3.select(array[i])
                                 .transition().duration(500)
                                 .style('opacity',0)
                                 .on('end', function(){
                                     d3.select(this)
                                         .classed('display-none', true);
                                 });
                         } else {
                             d3.select(array[i])
                                 .classed('display-none', false)
                                 .transition().duration(500)
                                 .style('opacity',1)
                                 .attr('cx', d => this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX])))
                                 .attr('cy', d => {
                                     return this.yScale(d[this.config.variableY]);
                                 });
                         }
                     });
                   d3.selectAll(this.labelGroups.nodes())
                     .each((d,i,array) => {
                         var labelGroup = d3.select(array[i]);
                         if ( isNaN(d.values[d.values.length - 1][this.config.variableY]) ){
                             
                              labelGroup
                                 .transition().duration(500)
                                 .style('opacity',0)
                                 .on('end', function(){
                                     labelGroup
                                         .classed('display-none', true);
                                     labelGroup.select('.has-tooltip')
                                         .attr('tabindex', -1);
                                 });
                         } else {
                             
                             labelGroup
                                 .classed('display-none', false)
                                 .transition().duration(500)
                                 .style('opacity',1)
                                 .attr('transform', (d) => `translate(${this.width + 8}, ${this.yScale(d.values[d.values.length - 1][this.config.variableY]) + 3})`);
                              labelGroup.select('.has-tooltip')
                                 .attr('tabindex',0);
                         }
                     });
                         
                 
                 
                  d3.selectAll(this.labels.nodes())
                     .transition().duration(500)
                     .attr('y', 0)
                     .on('end', (d,i,array) => {
                         if (i === array.length - 1 ){
                             this.relaxLabels();
                         }
                     });
                
                 d3.selectAll(this.yAxisGroup.nodes())
                     .transition().duration(500)
                     .call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5))
                     .on('end',(d,i,array) => {
                         setTimeout(() => {
                             d3.select(array[i])
                                 .selectAll('.tick')
                                 .each((d,i,array) => {
                                     d3.select(array[i])
                                         .classed('zero', ( d === 0 && i !== 0 && this.yMin < 0 ));
                                 });
                         },50);
                     });
             }
            }*/
        },
        updateLines: function updateLines() {
            var _this10 = this;

            var valueline = d3.line().x(function (d) {
                if (_this10.xValuesUnique.indexOf(d[_this10.config.variableX]) === -1) {
                    _this10.xValuesUnique.push(d[_this10.config.variableX]);
                }
                return _this10.xScale(d3.timeParse(_this10.xTimeType)(d[_this10.config.variableX]));
            }).y(function (d) {

                return _this10.yScale(d.value);
            });

            this.lines.transition().duration(500).delay(150).attr('d', function (d) {
                return valueline(d.values);
            });
        },
        addXAxis: function addXAxis() {
            var _this11 = this;

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
                    return d3.timeParse(_this11.xTimeType)(each);
                })); // TO DO: allow for other xAxis Adjustments
            }
            this.xAxisGroup.attr('transform', 'translate(0,' + (this.yScale(xAxisPosition) + xAxisOffset) + ')') // not programatic placement of x-axis
            .attr('class', 'axis x-axis').call(axis);
        },
        addYAxis: function addYAxis() {
            var _this12 = this;

            /* axis */
            this.yAxisGroup.attr('class', function () {
                return 'axis y-axis ';
            }).call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5));

            this.yAxisGroup.selectAll('.tick').each(function (d, i, array) {
                d3.select(array[i]).classed('zero', d === 0 && i !== 0 && _this12.yMin < 0);
            });

            /* labels */

            var unitsLabels = this.allSeries.select('.each-series').append('a').attr('xlink:href', '#').attr('tabindex', -1).attr('focusable', false).on('click', function () {
                d3.event.preventDefault();
            }).append('text').attr('class', 'units').attr('transform', function () {
                return 'translate(-' + (_this12.marginLeft - 5) + ',-' + (_this12.marginTop - 14) + ')';
            }).html(function (d, i) {
                return i === 0 ? _this12.parent.units(d.values[0].series) : null;
            });

            var labelTooltip = d3.tip().attr("class", "d3-tip label-tip").direction('e').offset([-2, 4]);

            function mouseover(d) {
                if (window.openTooltip) {
                    window.openTooltip.hide();
                }
                labelTooltip.html(this.parent.unitsDescription(d.values[0].series));
                labelTooltip.show();
                window.openTooltip = labelTooltip;
            }

            unitsLabels.each(function (d, i, array) {
                // TO DO this is repetitive of addLabels()
                if (_this12.parent.unitsDescription(d.values[0].series) !== undefined && d3.select(array[i]).html() !== '') {
                    d3.select(array[i].parentNode).attr('tabindex', 0).attr('focusable', true).classed('has-tooltip', true).on('mouseover', function (d, i, array) {
                        array[i].focus();
                    }).on('focus', function (d) {
                        mouseover.call(_this12, d);
                    }).on('mouseout', function (d, i, array) {
                        array[i].blur();
                    }).on('blur', labelTooltip.hide).call(labelTooltip);

                    d3.select(array[i]).html(function () {
                        return d3.select(this).html() + '<tspan dy="-0.4em" dx="0.2em" class="info-mark">?</tspan>';
                    });
                }
            });
        },
        addLabels: function addLabels() {
            var _this13 = this;

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

                return 'translate(' + (_this13.width + 8) + ', ' + (_this13.yScale(d.values[d.values.length - 1].value) + 3) + ')';
            }).append('a').attr('title', 'click to bring to front').attr('xlink:href', '#').attr('tabindex', -1).attr('focusable', false).attr('y', 0).on('click', function (d, i, array) {
                d3.event.preventDefault();
                _this13.bringToTop.call(array[i].parentNode);
            }).append('text').attr('class', 'series-label').html(function (d) {

                return '<tspan x="0">' + _this13.parent.label(d.values[0].series).replace(/\\n/g, '</tspan><tspan x="0.5em" dy="1.2em">') + '</tspan>';
            });

            this.labels.each(function (d, i, array) {
                if (_this13.parent.description(d.key) !== undefined && _this13.parent.description(d.key) !== '') {
                    d3.select(array[i].parentNode).attr('tabindex', 0).attr('focusable', true).classed('has-tooltip', true).on('mouseover', function (d, i, array) {
                        array[i].focus();
                    }).on('focus', function (d) {
                        mouseover.call(_this13, d);
                    }).on('mouseout', function (d, i, array) {
                        array[i].blur();
                    }).on('blur', labelTooltip.hide).call(labelTooltip);

                    d3.select(array[i]).html(function () {
                        return d3.select(this).html() + '<tspan dy="-0.4em" dx="0.2em" class="info-mark">?</tspan>';
                    });
                }
            });
            this.isFirstRender = false;

            this.relaxLabels();
        },
        relaxLabels: function relaxLabels() {
            var _this14 = this;

            // HT http://jsfiddle.net/thudfactor/B2WBU/ adapted technique
            var alpha = 1,
                spacing = 0,
                again = false;

            this.labels.each(function (d, i, array1) {

                var a = array1[i],
                    $a = d3.select(a),
                    yA = $a.attr('y'),
                    aRange = d3.range(Math.round(a.getCTM().f) - spacing + parseInt(yA), Math.round(a.getCTM().f) + Math.round(a.getBBox().height) + 1 + spacing + parseInt(yA));

                _this14.labels.each(function () {
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
                        _this14.relaxLabels();
                    }, 20);
                }
            });
        },
        addPoints: function addPoints() {
            var _this15 = this;

            function mouseover(d, i, array) {

                if (window.openTooltip) {
                    window.openTooltip.hide();
                }

                var klass = d3.select(array[i].parentNode).attr('class').match(/color-\d/)[0]; // get the color class of the parent g
                this.tooltip.attr('class', this.tooltip.attr('class') + ' ' + klass);
                var prefix = '';
                var suffix = '';
                if (this.parent.units(d.series) && this.parent.units(d.series)[0] === '$') {
                    prefix = '$'; // TO DO:  handle other prefixes
                }
                var html = '<strong>' + this.parent.tipText(d.series) + '</strong> (' + d.year + ')<br />' + prefix + d3.format(',')(d[this.config.variableY]);
                if (this.parent.units(d.series) && this.parent.units(d.series) !== '') {
                    suffix = this.parent.units(d.series).replace('$', '');
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

                this.tooltip.attr('class', this.tooltip.attr('class').replace(/ color-\d/g, ''));
                this.tooltip.html('');
                this.tooltip.hide();
            }
            this.points = this.eachSeries.selectAll('points').data(function (d) {
                return d.values;
            }, function (d) {
                return d.key;
            }).enter().append('circle').attr('tabindex', 0).attr('focusable', true).attr('opacity', 0).attr('class', 'data-point').attr('r', '4').attr('cx', function (d) {
                return _this15.xScale(d3.timeParse(_this15.xTimeType)(d[_this15.config.variableX]));
            }).attr('cy', function (d) {
                return _this15.yScale(d[_this15.config.variableY]);
            }).on('mouseover', function (d, i, array) {

                array[i].focus();
            }).on('focus', function (d, i, array) {
                mouseover.call(_this15, d, i, array);
            }).on('mouseout', function (d, i, array) {
                array[i].blur();
            }).on('blur', function () {
                mouseout.call(_this15);
            }).on('click', this.bringToTop).on('keyup', function (d, i, array) {

                if (d3.event.keyCode === 13) {

                    _this15.bringToTop.call(array[i]);
                }
            }).call(this.tooltip).transition().duration(500).attr('opacity', 1);
        },
        bringToTop: function bringToTop() {

            if (this.parentNode !== this.parentNode.parentNode.lastChild) {

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
        // will fail lte IE10
        var newObj = {};
        for (var key in this) {
            if (this.hasOwnProperty(key)) {
                try {
                    newObj[key] = JSON.parse(this[key]); // if the value can be interpretted as JSON, it is
                    // if it can't it isn't   
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

},{}],5:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * SVG focus 
 * Copyright(c) 2017, John Osterman
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and 
 * associated documentation files (the "Software"), to deal in the Software without restriction, including 
 * without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell 
 * copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the 
 * following conditions:

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT 
 * LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO 
 * EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER 
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE 
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// IE/Edge (perhaps others) does not allow programmatic focusing of SVG Elements (via `focus()`). Same for `blur()`.

var SVGFocus = exports.SVGFocus = function () {
  if ('focus' in SVGElement.prototype === false) {
    SVGElement.prototype.focus = HTMLElement.prototype.focus;
  }
  if ('blur' in SVGElement.prototype === false) {
    SVGElement.prototype.blur = HTMLElement.prototype.blur;
  }
}();

/**
 * innerHTML property for SVGElement
 * Copyright(c) 2010, Jeff Schiller
 *
 * Licensed under the Apache License, Version 2
 *
 * Works in a SVG document in Chrome 6+, Safari 5+, Firefox 4+ and IE9+.
 * Works in a HTML5 document in Chrome 7+, Firefox 4+ and IE9+.
 * Does not work in Opera since it doesn't support the SVGElement interface yet.
 *
 * I haven't decided on the best name for this property - thus the duplication.
 */
// edited by John Osterman to declare the variable `sXML`, which was referenced without being declared
// which failed silently in implicit strict mode of an export

// most browsers allow setting innerHTML of svg elements but IE does not (not an HTML element)
// this polyfill provides that. necessary for d3 method `.html()` on svg elements

var SVGInnerHTML = exports.SVGInnerHTML = function () {
  var serializeXML = function serializeXML(node, output) {
    var nodeType = node.nodeType;
    if (nodeType == 3) {
      // TEXT nodes.
      // Replace special XML characters with their entities.
      output.push(node.textContent.replace(/&/, '&amp;').replace(/</, '&lt;').replace('>', '&gt;'));
    } else if (nodeType == 1) {
      // ELEMENT nodes.
      // Serialize Element nodes.
      output.push('<', node.tagName);
      if (node.hasAttributes()) {
        var attrMap = node.attributes;
        for (var i = 0, len = attrMap.length; i < len; ++i) {
          var attrNode = attrMap.item(i);
          output.push(' ', attrNode.name, '=\'', attrNode.value, '\'');
        }
      }
      if (node.hasChildNodes()) {
        output.push('>');
        var childNodes = node.childNodes;
        for (var i = 0, len = childNodes.length; i < len; ++i) {
          serializeXML(childNodes.item(i), output);
        }
        output.push('</', node.tagName, '>');
      } else {
        output.push('/>');
      }
    } else if (nodeType == 8) {
      // TODO(codedread): Replace special characters with XML entities?
      output.push('<!--', node.nodeValue, '-->');
    } else {
      // TODO: Handle CDATA nodes.
      // TODO: Handle ENTITY nodes.
      // TODO: Handle DOCUMENT nodes.
      throw 'Error serializing XML. Unhandled node of type: ' + nodeType;
    }
  };
  // The innerHTML DOM property for SVGElement.
  if ('innerHTML' in SVGElement.prototype === false) {
    Object.defineProperty(SVGElement.prototype, 'innerHTML', {
      get: function get() {
        var output = [];
        var childNode = this.firstChild;
        while (childNode) {
          serializeXML(childNode, output);
          childNode = childNode.nextSibling;
        }
        return output.join('');
      },
      set: function set(markupText) {
        console.log(this);
        // Wipe out the current contents of the element.
        while (this.firstChild) {
          this.removeChild(this.firstChild);
        }

        try {
          // Parse the markup into valid nodes.
          var dXML = new DOMParser();
          dXML.async = false;
          // Wrap the markup into a SVG node to ensure parsing works.
          console.log(markupText);
          var sXML = '<svg xmlns="http://www.w3.org/2000/svg">' + markupText + '</svg>';
          console.log(sXML);
          var svgDocElement = dXML.parseFromString(sXML, 'text/xml').documentElement;

          // Now take each node, import it and append to this element.
          var childNode = svgDocElement.firstChild;
          while (childNode) {
            this.appendChild(this.ownerDocument.importNode(childNode, true));
            childNode = childNode.nextSibling;
          }
        } catch (e) {
          throw new Error('Error parsing XML string');
        };
      }
    });

    // The innerSVG DOM property for SVGElement.
    Object.defineProperty(SVGElement.prototype, 'innerSVG', {
      get: function get() {
        return this.innerHTML;
      },
      set: function set(markupText) {
        this.innerHTML = markupText;
      }
    });
  }
}();

// https://tc39.github.io/ecma262/#sec-array.prototype.find
var arrayFind = exports.arrayFind = function () {
  if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
      value: function value(predicate) {
        // 1. Let O be ? ToObject(this value).
        if (this == null) {
          throw new TypeError('"this" is null or not defined');
        }

        var o = Object(this);

        // 2. Let len be ? ToLength(? Get(O, "length")).
        var len = o.length >>> 0;

        // 3. If IsCallable(predicate) is false, throw a TypeError exception.
        if (typeof predicate !== 'function') {
          throw new TypeError('predicate must be a function');
        }

        // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
        var thisArg = arguments[1];

        // 5. Let k be 0.
        var k = 0;

        // 6. Repeat, while k < len
        while (k < len) {
          // a. Let Pk be ! ToString(k).
          // b. Let kValue be ? Get(O, Pk).
          // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
          // d. If testResult is true, return kValue.
          var kValue = o[k];
          if (predicate.call(thisArg, kValue, k, o)) {
            return kValue;
          }
          // e. Increase k by 1.
          k++;
        }

        // 7. Return undefined.
        return undefined;
      }
    });
  }
}();

// Copyright (C) 2011-2012 Software Languages Lab, Vrije Universiteit Brussel
// This code is dual-licensed under both the Apache License and the MPL

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is a shim for the ES-Harmony reflection module
 *
 * The Initial Developer of the Original Code is
 * Tom Van Cutsem, Vrije Universiteit Brussel.
 * Portions created by the Initial Developer are Copyright (C) 2011-2012
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 */

// ----------------------------------------------------------------------------

// This file is a polyfill for the upcoming ECMAScript Reflect API,
// including support for Proxies. See the draft specification at:
// http://wiki.ecmascript.org/doku.php?id=harmony:reflect_api
// http://wiki.ecmascript.org/doku.php?id=harmony:direct_proxies

// For an implementation of the Handler API, see handlers.js, which implements:
// http://wiki.ecmascript.org/doku.php?id=harmony:virtual_object_api

// This implementation supersedes the earlier polyfill at:
// code.google.com/p/es-lab/source/browse/trunk/src/proxies/DirectProxies.js

// This code was tested on tracemonkey / Firefox 12
//  (and should run fine on older Firefox versions starting with FF4)
// The code also works correctly on
//   v8 --harmony_proxies --harmony_weakmaps (v3.6.5.1)

// Language Dependencies:
//  - ECMAScript 5/strict
//  - "old" (i.e. non-direct) Harmony Proxies
//  - Harmony WeakMaps
// Patches:
//  - Object.{freeze,seal,preventExtensions}
//  - Object.{isFrozen,isSealed,isExtensible}
//  - Object.getPrototypeOf
//  - Object.keys
//  - Object.prototype.valueOf
//  - Object.prototype.isPrototypeOf
//  - Object.prototype.toString
//  - Object.prototype.hasOwnProperty
//  - Object.getOwnPropertyDescriptor
//  - Object.defineProperty
//  - Object.defineProperties
//  - Object.getOwnPropertyNames
//  - Object.getOwnPropertySymbols
//  - Object.getPrototypeOf
//  - Object.setPrototypeOf
//  - Object.assign
//  - Function.prototype.toString
//  - Date.prototype.toString
//  - Array.isArray
//  - Array.prototype.concat
//  - Proxy
// Adds new globals:
//  - Reflect

// Direct proxies can be created via Proxy(target, handler)

// ----------------------------------------------------------------------------

var reflect = exports.reflect = function (global) {
  // function-as-module pattern
  "use strict";

  // === Direct Proxies: Invariant Enforcement ===

  // Direct proxies build on non-direct proxies by automatically wrapping
  // all user-defined proxy handlers in a Validator handler that checks and
  // enforces ES5 invariants.

  // A direct proxy is a proxy for an existing object called the target object.

  // A Validator handler is a wrapper for a target proxy handler H.
  // The Validator forwards all operations to H, but additionally
  // performs a number of integrity checks on the results of some traps,
  // to make sure H does not violate the ES5 invariants w.r.t. non-configurable
  // properties and non-extensible, sealed or frozen objects.

  // For each property that H exposes as own, non-configurable
  // (e.g. by returning a descriptor from a call to getOwnPropertyDescriptor)
  // the Validator handler defines those properties on the target object.
  // When the proxy becomes non-extensible, also configurable own properties
  // are checked against the target.
  // We will call properties that are defined on the target object
  // "fixed properties".

  // We will name fixed non-configurable properties "sealed properties".
  // We will name fixed non-configurable non-writable properties "frozen
  // properties".

  // The Validator handler upholds the following invariants w.r.t. non-configurability:
  // - getOwnPropertyDescriptor cannot report sealed properties as non-existent
  // - getOwnPropertyDescriptor cannot report incompatible changes to the
  //   attributes of a sealed property (e.g. reporting a non-configurable
  //   property as configurable, or reporting a non-configurable, non-writable
  //   property as writable)
  // - getPropertyDescriptor cannot report sealed properties as non-existent
  // - getPropertyDescriptor cannot report incompatible changes to the
  //   attributes of a sealed property. It _can_ report incompatible changes
  //   to the attributes of non-own, inherited properties.
  // - defineProperty cannot make incompatible changes to the attributes of
  //   sealed properties
  // - deleteProperty cannot report a successful deletion of a sealed property
  // - hasOwn cannot report a sealed property as non-existent
  // - has cannot report a sealed property as non-existent
  // - get cannot report inconsistent values for frozen data
  //   properties, and must report undefined for sealed accessors with an
  //   undefined getter
  // - set cannot report a successful assignment for frozen data
  //   properties or sealed accessors with an undefined setter.
  // - get{Own}PropertyNames lists all sealed properties of the target.
  // - keys lists all enumerable sealed properties of the target.
  // - enumerate lists all enumerable sealed properties of the target.
  // - if a property of a non-extensible proxy is reported as non-existent,
  //   then it must forever be reported as non-existent. This applies to
  //   own and inherited properties and is enforced in the
  //   deleteProperty, get{Own}PropertyDescriptor, has{Own},
  //   get{Own}PropertyNames, keys and enumerate traps

  // Violation of any of these invariants by H will result in TypeError being
  // thrown.

  // Additionally, once Object.preventExtensions, Object.seal or Object.freeze
  // is invoked on the proxy, the set of own property names for the proxy is
  // fixed. Any property name that is not fixed is called a 'new' property.

  // The Validator upholds the following invariants regarding extensibility:
  // - getOwnPropertyDescriptor cannot report new properties as existent
  //   (it must report them as non-existent by returning undefined)
  // - defineProperty cannot successfully add a new property (it must reject)
  // - getOwnPropertyNames cannot list new properties
  // - hasOwn cannot report true for new properties (it must report false)
  // - keys cannot list new properties

  // Invariants currently not enforced:
  // - getOwnPropertyNames lists only own property names
  // - keys lists only enumerable own property names
  // Both traps may list more property names than are actually defined on the
  // target.

  // Invariants with regard to inheritance are currently not enforced.
  // - a non-configurable potentially inherited property on a proxy with
  //   non-mutable ancestry cannot be reported as non-existent
  // (An object with non-mutable ancestry is a non-extensible object whose
  // [[Prototype]] is either null or an object with non-mutable ancestry.)

  // Changes in Handler API compared to previous harmony:proxies, see:
  // http://wiki.ecmascript.org/doku.php?id=strawman:direct_proxies
  // http://wiki.ecmascript.org/doku.php?id=harmony:direct_proxies

  // ----------------------------------------------------------------------------

  // ---- WeakMap polyfill ----

  // TODO: find a proper WeakMap polyfill

  // define an empty WeakMap so that at least the Reflect module code
  // will work in the absence of WeakMaps. Proxy emulation depends on
  // actual WeakMaps, so will not work with this little shim.

  if (typeof WeakMap === "undefined") {
    global.WeakMap = function () {};
    global.WeakMap.prototype = {
      get: function get(k) {
        return undefined;
      },
      set: function set(k, v) {
        throw new Error("WeakMap not supported");
      }
    };
  }

  // ---- Normalization functions for property descriptors ----

  function isStandardAttribute(name) {
    return (/^(get|set|value|writable|enumerable|configurable)$/.test(name)
    );
  }

  // Adapted from ES5 section 8.10.5
  function toPropertyDescriptor(obj) {
    if (Object(obj) !== obj) {
      throw new TypeError("property descriptor should be an Object, given: " + obj);
    }
    var desc = {};
    if ('enumerable' in obj) {
      desc.enumerable = !!obj.enumerable;
    }
    if ('configurable' in obj) {
      desc.configurable = !!obj.configurable;
    }
    if ('value' in obj) {
      desc.value = obj.value;
    }
    if ('writable' in obj) {
      desc.writable = !!obj.writable;
    }
    if ('get' in obj) {
      var getter = obj.get;
      if (getter !== undefined && typeof getter !== "function") {
        throw new TypeError("property descriptor 'get' attribute must be " + "callable or undefined, given: " + getter);
      }
      desc.get = getter;
    }
    if ('set' in obj) {
      var setter = obj.set;
      if (setter !== undefined && typeof setter !== "function") {
        throw new TypeError("property descriptor 'set' attribute must be " + "callable or undefined, given: " + setter);
      }
      desc.set = setter;
    }
    if ('get' in desc || 'set' in desc) {
      if ('value' in desc || 'writable' in desc) {
        throw new TypeError("property descriptor cannot be both a data and an " + "accessor descriptor: " + obj);
      }
    }
    return desc;
  }

  function isAccessorDescriptor(desc) {
    if (desc === undefined) return false;
    return 'get' in desc || 'set' in desc;
  }
  function isDataDescriptor(desc) {
    if (desc === undefined) return false;
    return 'value' in desc || 'writable' in desc;
  }
  function isGenericDescriptor(desc) {
    if (desc === undefined) return false;
    return !isAccessorDescriptor(desc) && !isDataDescriptor(desc);
  }

  function toCompletePropertyDescriptor(desc) {
    var internalDesc = toPropertyDescriptor(desc);
    if (isGenericDescriptor(internalDesc) || isDataDescriptor(internalDesc)) {
      if (!('value' in internalDesc)) {
        internalDesc.value = undefined;
      }
      if (!('writable' in internalDesc)) {
        internalDesc.writable = false;
      }
    } else {
      if (!('get' in internalDesc)) {
        internalDesc.get = undefined;
      }
      if (!('set' in internalDesc)) {
        internalDesc.set = undefined;
      }
    }
    if (!('enumerable' in internalDesc)) {
      internalDesc.enumerable = false;
    }
    if (!('configurable' in internalDesc)) {
      internalDesc.configurable = false;
    }
    return internalDesc;
  }

  function isEmptyDescriptor(desc) {
    return !('get' in desc) && !('set' in desc) && !('value' in desc) && !('writable' in desc) && !('enumerable' in desc) && !('configurable' in desc);
  }

  function isEquivalentDescriptor(desc1, desc2) {
    return sameValue(desc1.get, desc2.get) && sameValue(desc1.set, desc2.set) && sameValue(desc1.value, desc2.value) && sameValue(desc1.writable, desc2.writable) && sameValue(desc1.enumerable, desc2.enumerable) && sameValue(desc1.configurable, desc2.configurable);
  }

  // copied from http://wiki.ecmascript.org/doku.php?id=harmony:egal
  function sameValue(x, y) {
    if (x === y) {
      // 0 === -0, but they are not identical
      return x !== 0 || 1 / x === 1 / y;
    }

    // NaN !== NaN, but they are identical.
    // NaNs are the only non-reflexive value, i.e., if x !== x,
    // then x is a NaN.
    // isNaN is broken: it converts its argument to number, so
    // isNaN("foo") => true
    return x !== x && y !== y;
  }

  /**
   * Returns a fresh property descriptor that is guaranteed
   * to be complete (i.e. contain all the standard attributes).
   * Additionally, any non-standard enumerable properties of
   * attributes are copied over to the fresh descriptor.
   *
   * If attributes is undefined, returns undefined.
   *
   * See also: http://wiki.ecmascript.org/doku.php?id=harmony:proxies_semantics
   */
  function normalizeAndCompletePropertyDescriptor(attributes) {
    if (attributes === undefined) {
      return undefined;
    }
    var desc = toCompletePropertyDescriptor(attributes);
    // Note: no need to call FromPropertyDescriptor(desc), as we represent
    // "internal" property descriptors as proper Objects from the start
    for (var name in attributes) {
      if (!isStandardAttribute(name)) {
        Object.defineProperty(desc, name, { value: attributes[name],
          writable: true,
          enumerable: true,
          configurable: true });
      }
    }
    return desc;
  }

  /**
   * Returns a fresh property descriptor whose standard
   * attributes are guaranteed to be data properties of the right type.
   * Additionally, any non-standard enumerable properties of
   * attributes are copied over to the fresh descriptor.
   *
   * If attributes is undefined, will throw a TypeError.
   *
   * See also: http://wiki.ecmascript.org/doku.php?id=harmony:proxies_semantics
   */
  function normalizePropertyDescriptor(attributes) {
    var desc = toPropertyDescriptor(attributes);
    // Note: no need to call FromGenericPropertyDescriptor(desc), as we represent
    // "internal" property descriptors as proper Objects from the start
    for (var name in attributes) {
      if (!isStandardAttribute(name)) {
        Object.defineProperty(desc, name, { value: attributes[name],
          writable: true,
          enumerable: true,
          configurable: true });
      }
    }
    return desc;
  }

  // store a reference to the real ES5 primitives before patching them later
  var prim_preventExtensions = Object.preventExtensions,
      prim_seal = Object.seal,
      prim_freeze = Object.freeze,
      prim_isExtensible = Object.isExtensible,
      prim_isSealed = Object.isSealed,
      prim_isFrozen = Object.isFrozen,
      prim_getPrototypeOf = Object.getPrototypeOf,
      prim_getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor,
      prim_defineProperty = Object.defineProperty,
      prim_defineProperties = Object.defineProperties,
      prim_keys = Object.keys,
      prim_getOwnPropertyNames = Object.getOwnPropertyNames,
      prim_getOwnPropertySymbols = Object.getOwnPropertySymbols,
      prim_assign = Object.assign,
      prim_isArray = Array.isArray,
      prim_concat = Array.prototype.concat,
      prim_isPrototypeOf = Object.prototype.isPrototypeOf,
      prim_hasOwnProperty = Object.prototype.hasOwnProperty;

  // these will point to the patched versions of the respective methods on
  // Object. They are used within this module as the "intrinsic" bindings
  // of these methods (i.e. the "original" bindings as defined in the spec)
  var Object_isFrozen, Object_isSealed, Object_isExtensible, Object_getPrototypeOf, Object_getOwnPropertyNames;

  /**
   * A property 'name' is fixed if it is an own property of the target.
   */
  function isFixed(name, target) {
    return {}.hasOwnProperty.call(target, name);
  }
  function isSealed(name, target) {
    var desc = Object.getOwnPropertyDescriptor(target, name);
    if (desc === undefined) {
      return false;
    }
    return desc.configurable === false;
  }
  function isSealedDesc(desc) {
    return desc !== undefined && desc.configurable === false;
  }

  /**
   * Performs all validation that Object.defineProperty performs,
   * without actually defining the property. Returns a boolean
   * indicating whether validation succeeded.
   *
   * Implementation transliterated from ES5.1 section 8.12.9
   */
  function isCompatibleDescriptor(extensible, current, desc) {
    if (current === undefined && extensible === false) {
      return false;
    }
    if (current === undefined && extensible === true) {
      return true;
    }
    if (isEmptyDescriptor(desc)) {
      return true;
    }
    if (isEquivalentDescriptor(current, desc)) {
      return true;
    }
    if (current.configurable === false) {
      if (desc.configurable === true) {
        return false;
      }
      if ('enumerable' in desc && desc.enumerable !== current.enumerable) {
        return false;
      }
    }
    if (isGenericDescriptor(desc)) {
      return true;
    }
    if (isDataDescriptor(current) !== isDataDescriptor(desc)) {
      if (current.configurable === false) {
        return false;
      }
      return true;
    }
    if (isDataDescriptor(current) && isDataDescriptor(desc)) {
      if (current.configurable === false) {
        if (current.writable === false && desc.writable === true) {
          return false;
        }
        if (current.writable === false) {
          if ('value' in desc && !sameValue(desc.value, current.value)) {
            return false;
          }
        }
      }
      return true;
    }
    if (isAccessorDescriptor(current) && isAccessorDescriptor(desc)) {
      if (current.configurable === false) {
        if ('set' in desc && !sameValue(desc.set, current.set)) {
          return false;
        }
        if ('get' in desc && !sameValue(desc.get, current.get)) {
          return false;
        }
      }
    }
    return true;
  }

  // ES6 7.3.11 SetIntegrityLevel
  // level is one of "sealed" or "frozen"
  function setIntegrityLevel(target, level) {
    var ownProps = Object_getOwnPropertyNames(target);
    var pendingException = undefined;
    if (level === "sealed") {
      var l = +ownProps.length;
      var k;
      for (var i = 0; i < l; i++) {
        k = String(ownProps[i]);
        try {
          Object.defineProperty(target, k, { configurable: false });
        } catch (e) {
          if (pendingException === undefined) {
            pendingException = e;
          }
        }
      }
    } else {
      // level === "frozen"
      var l = +ownProps.length;
      var k;
      for (var i = 0; i < l; i++) {
        k = String(ownProps[i]);
        try {
          var currentDesc = Object.getOwnPropertyDescriptor(target, k);
          if (currentDesc !== undefined) {
            var desc;
            if (isAccessorDescriptor(currentDesc)) {
              desc = { configurable: false };
            } else {
              desc = { configurable: false, writable: false };
            }
            Object.defineProperty(target, k, desc);
          }
        } catch (e) {
          if (pendingException === undefined) {
            pendingException = e;
          }
        }
      }
    }
    if (pendingException !== undefined) {
      throw pendingException;
    }
    return Reflect.preventExtensions(target);
  }

  // ES6 7.3.12 TestIntegrityLevel
  // level is one of "sealed" or "frozen"
  function testIntegrityLevel(target, level) {
    var isExtensible = Object_isExtensible(target);
    if (isExtensible) return false;

    var ownProps = Object_getOwnPropertyNames(target);
    var pendingException = undefined;
    var configurable = false;
    var writable = false;

    var l = +ownProps.length;
    var k;
    var currentDesc;
    for (var i = 0; i < l; i++) {
      k = String(ownProps[i]);
      try {
        currentDesc = Object.getOwnPropertyDescriptor(target, k);
        configurable = configurable || currentDesc.configurable;
        if (isDataDescriptor(currentDesc)) {
          writable = writable || currentDesc.writable;
        }
      } catch (e) {
        if (pendingException === undefined) {
          pendingException = e;
          configurable = true;
        }
      }
    }
    if (pendingException !== undefined) {
      throw pendingException;
    }
    if (level === "frozen" && writable === true) {
      return false;
    }
    if (configurable === true) {
      return false;
    }
    return true;
  }

  // ---- The Validator handler wrapper around user handlers ----

  /**
   * @param target the object wrapped by this proxy.
   * As long as the proxy is extensible, only non-configurable properties
   * are checked against the target. Once the proxy becomes non-extensible,
   * invariants w.r.t. non-extensibility are also enforced.
   *
   * @param handler the handler of the direct proxy. The object emulated by
   * this handler is validated against the target object of the direct proxy.
   * Any violations that the handler makes against the invariants
   * of the target will cause a TypeError to be thrown.
   *
   * Both target and handler must be proper Objects at initialization time.
   */
  function Validator(target, handler) {
    // for non-revokable proxies, these are const references
    // for revokable proxies, on revocation:
    // - this.target is set to null
    // - this.handler is set to a handler that throws on all traps
    this.target = target;
    this.handler = handler;
  }

  Validator.prototype = {

    /**
     * If getTrap returns undefined, the caller should perform the
     * default forwarding behavior.
     * If getTrap returns normally otherwise, the return value
     * will be a callable trap function. When calling the trap function,
     * the caller is responsible for binding its |this| to |this.handler|.
     */
    getTrap: function getTrap(trapName) {
      var trap = this.handler[trapName];
      if (trap === undefined) {
        // the trap was not defined,
        // perform the default forwarding behavior
        return undefined;
      }

      if (typeof trap !== "function") {
        throw new TypeError(trapName + " trap is not callable: " + trap);
      }

      return trap;
    },

    // === fundamental traps ===

    /**
     * If name denotes a fixed property, check:
     *   - whether targetHandler reports it as existent
     *   - whether the returned descriptor is compatible with the fixed property
     * If the proxy is non-extensible, check:
     *   - whether name is not a new property
     * Additionally, the returned descriptor is normalized and completed.
     */
    getOwnPropertyDescriptor: function getOwnPropertyDescriptor(name) {
      "use strict";

      var trap = this.getTrap("getOwnPropertyDescriptor");
      if (trap === undefined) {
        return Reflect.getOwnPropertyDescriptor(this.target, name);
      }

      name = String(name);
      var desc = trap.call(this.handler, this.target, name);
      desc = normalizeAndCompletePropertyDescriptor(desc);

      var targetDesc = Object.getOwnPropertyDescriptor(this.target, name);
      var extensible = Object.isExtensible(this.target);

      if (desc === undefined) {
        if (isSealedDesc(targetDesc)) {
          throw new TypeError("cannot report non-configurable property '" + name + "' as non-existent");
        }
        if (!extensible && targetDesc !== undefined) {
          // if handler is allowed to return undefined, we cannot guarantee
          // that it will not return a descriptor for this property later.
          // Once a property has been reported as non-existent on a non-extensible
          // object, it should forever be reported as non-existent
          throw new TypeError("cannot report existing own property '" + name + "' as non-existent on a non-extensible object");
        }
        return undefined;
      }

      // at this point, we know (desc !== undefined), i.e.
      // targetHandler reports 'name' as an existing property

      // Note: we could collapse the following two if-tests into a single
      // test. Separating out the cases to improve error reporting.

      if (!extensible) {
        if (targetDesc === undefined) {
          throw new TypeError("cannot report a new own property '" + name + "' on a non-extensible object");
        }
      }

      if (name !== undefined) {
        if (!isCompatibleDescriptor(extensible, targetDesc, desc)) {
          throw new TypeError("cannot report incompatible property descriptor " + "for property '" + name + "'");
        }
      }

      if (desc.configurable === false) {
        if (targetDesc === undefined || targetDesc.configurable === true) {
          // if the property is configurable or non-existent on the target,
          // but is reported as a non-configurable property, it may later be
          // reported as configurable or non-existent, which violates the
          // invariant that if the property might change or disappear, the
          // configurable attribute must be true.
          throw new TypeError("cannot report a non-configurable descriptor " + "for configurable or non-existent property '" + name + "'");
        }
        if ('writable' in desc && desc.writable === false) {
          if (targetDesc.writable === true) {
            // if the property is non-configurable, writable on the target,
            // but is reported as non-configurable, non-writable, it may later
            // be reported as non-configurable, writable again, which violates
            // the invariant that a non-configurable, non-writable property
            // may not change state.
            throw new TypeError("cannot report non-configurable, writable property '" + name + "' as non-configurable, non-writable");
          }
        }
      }

      return desc;
    },

    /**
     * In the direct proxies design with refactored prototype climbing,
     * this trap is deprecated. For proxies-as-prototypes, instead
     * of calling this trap, the get, set, has or enumerate traps are
     * called instead.
     *
     * In this implementation, we "abuse" getPropertyDescriptor to
     * support trapping the get or set traps for proxies-as-prototypes.
     * We do this by returning a getter/setter pair that invokes
     * the corresponding traps.
     *
     * While this hack works for inherited property access, it has some
     * quirks:
     *
     * In Firefox, this trap is only called after a prior invocation
     * of the 'has' trap has returned true. Hence, expect the following
     * behavior:
     * <code>
     * var child = Object.create(Proxy(target, handler));
     * child[name] // triggers handler.has(target, name)
     * // if that returns true, triggers handler.get(target, name, child)
     * </code>
     *
     * On v8, the 'in' operator, when applied to an object that inherits
     * from a proxy, will call getPropertyDescriptor and walk the proto-chain.
     * That calls the below getPropertyDescriptor trap on the proxy. The
     * result of the 'in'-operator is then determined by whether this trap
     * returns undefined or a property descriptor object. That is why
     * we first explicitly trigger the 'has' trap to determine whether
     * the property exists.
     *
     * This has the side-effect that when enumerating properties on
     * an object that inherits from a proxy in v8, only properties
     * for which 'has' returns true are returned:
     *
     * <code>
     * var child = Object.create(Proxy(target, handler));
     * for (var prop in child) {
     *   // only enumerates prop if (prop in child) returns true
     * }
     * </code>
     */
    getPropertyDescriptor: function getPropertyDescriptor(name) {
      var handler = this;

      if (!handler.has(name)) return undefined;

      return {
        get: function get() {
          return handler.get(this, name);
        },
        set: function set(val) {
          if (handler.set(this, name, val)) {
            return val;
          } else {
            throw new TypeError("failed assignment to " + name);
          }
        },
        enumerable: true,
        configurable: true
      };
    },

    /**
     * If name denotes a fixed property, check for incompatible changes.
     * If the proxy is non-extensible, check that new properties are rejected.
     */
    defineProperty: function defineProperty(name, desc) {
      // TODO(tvcutsem): the current tracemonkey implementation of proxies
      // auto-completes 'desc', which is not correct. 'desc' should be
      // normalized, but not completed. Consider:
      // Object.defineProperty(proxy, 'foo', {enumerable:false})
      // This trap will receive desc =
      //  {value:undefined,writable:false,enumerable:false,configurable:false}
      // This will also set all other attributes to their default value,
      // which is unexpected and different from [[DefineOwnProperty]].
      // Bug filed: https://bugzilla.mozilla.org/show_bug.cgi?id=601329

      var trap = this.getTrap("defineProperty");
      if (trap === undefined) {
        // default forwarding behavior
        return Reflect.defineProperty(this.target, name, desc);
      }

      name = String(name);
      var descObj = normalizePropertyDescriptor(desc);
      var success = trap.call(this.handler, this.target, name, descObj);
      success = !!success; // coerce to Boolean

      if (success === true) {

        var targetDesc = Object.getOwnPropertyDescriptor(this.target, name);
        var extensible = Object.isExtensible(this.target);

        // Note: we could collapse the following two if-tests into a single
        // test. Separating out the cases to improve error reporting.

        if (!extensible) {
          if (targetDesc === undefined) {
            throw new TypeError("cannot successfully add a new property '" + name + "' to a non-extensible object");
          }
        }

        if (targetDesc !== undefined) {
          if (!isCompatibleDescriptor(extensible, targetDesc, desc)) {
            throw new TypeError("cannot define incompatible property " + "descriptor for property '" + name + "'");
          }
          if (isDataDescriptor(targetDesc) && targetDesc.configurable === false && targetDesc.writable === true) {
            if (desc.configurable === false && desc.writable === false) {
              // if the property is non-configurable, writable on the target
              // but was successfully reported to be updated to
              // non-configurable, non-writable, it can later be reported
              // again as non-configurable, writable, which violates
              // the invariant that non-configurable, non-writable properties
              // cannot change state
              throw new TypeError("cannot successfully define non-configurable, writable " + " property '" + name + "' as non-configurable, non-writable");
            }
          }
        }

        if (desc.configurable === false && !isSealedDesc(targetDesc)) {
          // if the property is configurable or non-existent on the target,
          // but is successfully being redefined as a non-configurable property,
          // it may later be reported as configurable or non-existent, which violates
          // the invariant that if the property might change or disappear, the
          // configurable attribute must be true.
          throw new TypeError("cannot successfully define a non-configurable " + "descriptor for configurable or non-existent property '" + name + "'");
        }
      }

      return success;
    },

    /**
     * On success, check whether the target object is indeed non-extensible.
     */
    preventExtensions: function preventExtensions() {
      var trap = this.getTrap("preventExtensions");
      if (trap === undefined) {
        // default forwarding behavior
        return Reflect.preventExtensions(this.target);
      }

      var success = trap.call(this.handler, this.target);
      success = !!success; // coerce to Boolean
      if (success) {
        if (Object_isExtensible(this.target)) {
          throw new TypeError("can't report extensible object as non-extensible: " + this.target);
        }
      }
      return success;
    },

    /**
     * If name denotes a sealed property, check whether handler rejects.
     */
    delete: function _delete(name) {
      "use strict";

      var trap = this.getTrap("deleteProperty");
      if (trap === undefined) {
        // default forwarding behavior
        return Reflect.deleteProperty(this.target, name);
      }

      name = String(name);
      var res = trap.call(this.handler, this.target, name);
      res = !!res; // coerce to Boolean

      var targetDesc;
      if (res === true) {
        targetDesc = Object.getOwnPropertyDescriptor(this.target, name);
        if (targetDesc !== undefined && targetDesc.configurable === false) {
          throw new TypeError("property '" + name + "' is non-configurable " + "and can't be deleted");
        }
        if (targetDesc !== undefined && !Object_isExtensible(this.target)) {
          // if the property still exists on a non-extensible target but
          // is reported as successfully deleted, it may later be reported
          // as present, which violates the invariant that an own property,
          // deleted from a non-extensible object cannot reappear.
          throw new TypeError("cannot successfully delete existing property '" + name + "' on a non-extensible object");
        }
      }

      return res;
    },

    /**
     * The getOwnPropertyNames trap was replaced by the ownKeys trap,
     * which now also returns an array (of strings or symbols) and
     * which performs the same rigorous invariant checks as getOwnPropertyNames
     *
     * See issue #48 on how this trap can still get invoked by external libs
     * that don't use the patched Object.getOwnPropertyNames function.
     */
    getOwnPropertyNames: function getOwnPropertyNames() {
      // Note: removed deprecation warning to avoid dependency on 'console'
      // (and on node, should anyway use util.deprecate). Deprecation warnings
      // can also be annoying when they are outside of the user's control, e.g.
      // when an external library calls unpatched Object.getOwnPropertyNames.
      // Since there is a clean fallback to `ownKeys`, the fact that the
      // deprecated method is still called is mostly harmless anyway.
      // See also issues #65 and #66.
      // console.warn("getOwnPropertyNames trap is deprecated. Use ownKeys instead");
      return this.ownKeys();
    },

    /**
     * Checks whether the trap result does not contain any new properties
     * if the proxy is non-extensible.
     *
     * Any own non-configurable properties of the target that are not included
     * in the trap result give rise to a TypeError. As such, we check whether the
     * returned result contains at least all sealed properties of the target
     * object.
     *
     * Additionally, the trap result is normalized.
     * Instead of returning the trap result directly:
     *  - create and return a fresh Array,
     *  - of which each element is coerced to a String
     *
     * This trap is called a.o. by Reflect.ownKeys, Object.getOwnPropertyNames
     * and Object.keys (the latter filters out only the enumerable own properties).
     */
    ownKeys: function ownKeys() {
      var trap = this.getTrap("ownKeys");
      if (trap === undefined) {
        // default forwarding behavior
        return Reflect.ownKeys(this.target);
      }

      var trapResult = trap.call(this.handler, this.target);

      // propNames is used as a set of strings
      var propNames = Object.create(null);
      var numProps = +trapResult.length;
      var result = new Array(numProps);

      for (var i = 0; i < numProps; i++) {
        var s = String(trapResult[i]);
        if (!Object.isExtensible(this.target) && !isFixed(s, this.target)) {
          // non-extensible proxies don't tolerate new own property names
          throw new TypeError("ownKeys trap cannot list a new " + "property '" + s + "' on a non-extensible object");
        }

        propNames[s] = true;
        result[i] = s;
      }

      var ownProps = Object_getOwnPropertyNames(this.target);
      var target = this.target;
      ownProps.forEach(function (ownProp) {
        if (!propNames[ownProp]) {
          if (isSealed(ownProp, target)) {
            throw new TypeError("ownKeys trap failed to include " + "non-configurable property '" + ownProp + "'");
          }
          if (!Object.isExtensible(target) && isFixed(ownProp, target)) {
            // if handler is allowed to report ownProp as non-existent,
            // we cannot guarantee that it will never later report it as
            // existent. Once a property has been reported as non-existent
            // on a non-extensible object, it should forever be reported as
            // non-existent
            throw new TypeError("ownKeys trap cannot report existing own property '" + ownProp + "' as non-existent on a non-extensible object");
          }
        }
      });

      return result;
    },

    /**
     * Checks whether the trap result is consistent with the state of the
     * wrapped target.
     */
    isExtensible: function isExtensible() {
      var trap = this.getTrap("isExtensible");
      if (trap === undefined) {
        // default forwarding behavior
        return Reflect.isExtensible(this.target);
      }

      var result = trap.call(this.handler, this.target);
      result = !!result; // coerce to Boolean
      var state = Object_isExtensible(this.target);
      if (result !== state) {
        if (result) {
          throw new TypeError("cannot report non-extensible object as extensible: " + this.target);
        } else {
          throw new TypeError("cannot report extensible object as non-extensible: " + this.target);
        }
      }
      return state;
    },

    /**
     * Check whether the trap result corresponds to the target's [[Prototype]]
     */
    getPrototypeOf: function getPrototypeOf() {
      var trap = this.getTrap("getPrototypeOf");
      if (trap === undefined) {
        // default forwarding behavior
        return Reflect.getPrototypeOf(this.target);
      }

      var allegedProto = trap.call(this.handler, this.target);

      if (!Object_isExtensible(this.target)) {
        var actualProto = Object_getPrototypeOf(this.target);
        if (!sameValue(allegedProto, actualProto)) {
          throw new TypeError("prototype value does not match: " + this.target);
        }
      }

      return allegedProto;
    },

    /**
     * If target is non-extensible and setPrototypeOf trap returns true,
     * check whether the trap result corresponds to the target's [[Prototype]]
     */
    setPrototypeOf: function setPrototypeOf(newProto) {
      var trap = this.getTrap("setPrototypeOf");
      if (trap === undefined) {
        // default forwarding behavior
        return Reflect.setPrototypeOf(this.target, newProto);
      }

      var success = trap.call(this.handler, this.target, newProto);

      success = !!success;
      if (success && !Object_isExtensible(this.target)) {
        var actualProto = Object_getPrototypeOf(this.target);
        if (!sameValue(newProto, actualProto)) {
          throw new TypeError("prototype value does not match: " + this.target);
        }
      }

      return success;
    },

    /**
     * In the direct proxies design with refactored prototype climbing,
     * this trap is deprecated. For proxies-as-prototypes, for-in will
     * call the enumerate() trap. If that trap is not defined, the
     * operation is forwarded to the target, no more fallback on this
     * fundamental trap.
     */
    getPropertyNames: function getPropertyNames() {
      throw new TypeError("getPropertyNames trap is deprecated");
    },

    // === derived traps ===

    /**
     * If name denotes a fixed property, check whether the trap returns true.
     */
    has: function has(name) {
      var trap = this.getTrap("has");
      if (trap === undefined) {
        // default forwarding behavior
        return Reflect.has(this.target, name);
      }

      name = String(name);
      var res = trap.call(this.handler, this.target, name);
      res = !!res; // coerce to Boolean

      if (res === false) {
        if (isSealed(name, this.target)) {
          throw new TypeError("cannot report existing non-configurable own " + "property '" + name + "' as a non-existent " + "property");
        }
        if (!Object.isExtensible(this.target) && isFixed(name, this.target)) {
          // if handler is allowed to return false, we cannot guarantee
          // that it will not return true for this property later.
          // Once a property has been reported as non-existent on a non-extensible
          // object, it should forever be reported as non-existent
          throw new TypeError("cannot report existing own property '" + name + "' as non-existent on a non-extensible object");
        }
      }

      // if res === true, we don't need to check for extensibility
      // even for a non-extensible proxy that has no own name property,
      // the property may have been inherited

      return res;
    },

    /**
     * If name denotes a fixed non-configurable, non-writable data property,
     * check its return value against the previously asserted value of the
     * fixed property.
     */
    get: function get(receiver, name) {

      // experimental support for invoke() trap on platforms that
      // support __noSuchMethod__
      /*
      if (name === '__noSuchMethod__') {
        var handler = this;
        return function(name, args) {
          return handler.invoke(receiver, name, args);
        }
      }
      */

      var trap = this.getTrap("get");
      if (trap === undefined) {
        // default forwarding behavior
        return Reflect.get(this.target, name, receiver);
      }

      name = String(name);
      var res = trap.call(this.handler, this.target, name, receiver);

      var fixedDesc = Object.getOwnPropertyDescriptor(this.target, name);
      // check consistency of the returned value
      if (fixedDesc !== undefined) {
        // getting an existing property
        if (isDataDescriptor(fixedDesc) && fixedDesc.configurable === false && fixedDesc.writable === false) {
          // own frozen data property
          if (!sameValue(res, fixedDesc.value)) {
            throw new TypeError("cannot report inconsistent value for " + "non-writable, non-configurable property '" + name + "'");
          }
        } else {
          // it's an accessor property
          if (isAccessorDescriptor(fixedDesc) && fixedDesc.configurable === false && fixedDesc.get === undefined) {
            if (res !== undefined) {
              throw new TypeError("must report undefined for non-configurable " + "accessor property '" + name + "' without getter");
            }
          }
        }
      }

      return res;
    },

    /**
     * If name denotes a fixed non-configurable, non-writable data property,
     * check that the trap rejects the assignment.
     */
    set: function set(receiver, name, val) {
      var trap = this.getTrap("set");
      if (trap === undefined) {
        // default forwarding behavior
        return Reflect.set(this.target, name, val, receiver);
      }

      name = String(name);
      var res = trap.call(this.handler, this.target, name, val, receiver);
      res = !!res; // coerce to Boolean

      // if success is reported, check whether property is truly assignable
      if (res === true) {
        var fixedDesc = Object.getOwnPropertyDescriptor(this.target, name);
        if (fixedDesc !== undefined) {
          // setting an existing property
          if (isDataDescriptor(fixedDesc) && fixedDesc.configurable === false && fixedDesc.writable === false) {
            if (!sameValue(val, fixedDesc.value)) {
              throw new TypeError("cannot successfully assign to a " + "non-writable, non-configurable property '" + name + "'");
            }
          } else {
            if (isAccessorDescriptor(fixedDesc) && fixedDesc.configurable === false && // non-configurable
            fixedDesc.set === undefined) {
              // accessor with undefined setter
              throw new TypeError("setting a property '" + name + "' that has " + " only a getter");
            }
          }
        }
      }

      return res;
    },

    /**
     * Any own enumerable non-configurable properties of the target that are not
     * included in the trap result give rise to a TypeError. As such, we check
     * whether the returned result contains at least all sealed enumerable properties
     * of the target object.
     *
     * The trap should return an iterator.
     *
     * However, as implementations of pre-direct proxies still expect enumerate
     * to return an array of strings, we convert the iterator into an array.
     */
    enumerate: function enumerate() {
      var trap = this.getTrap("enumerate");
      if (trap === undefined) {
        // default forwarding behavior
        var trapResult = Reflect.enumerate(this.target);
        var result = [];
        var nxt = trapResult.next();
        while (!nxt.done) {
          result.push(String(nxt.value));
          nxt = trapResult.next();
        }
        return result;
      }

      var trapResult = trap.call(this.handler, this.target);

      if (trapResult === null || trapResult === undefined || trapResult.next === undefined) {
        throw new TypeError("enumerate trap should return an iterator, got: " + trapResult);
      }

      // propNames is used as a set of strings
      var propNames = Object.create(null);

      // var numProps = +trapResult.length;
      var result = []; // new Array(numProps);

      // trapResult is supposed to be an iterator
      // drain iterator to array as current implementations still expect
      // enumerate to return an array of strings
      var nxt = trapResult.next();

      while (!nxt.done) {
        var s = String(nxt.value);
        if (propNames[s]) {
          throw new TypeError("enumerate trap cannot list a " + "duplicate property '" + s + "'");
        }
        propNames[s] = true;
        result.push(s);
        nxt = trapResult.next();
      }

      /*for (var i = 0; i < numProps; i++) {
        var s = String(trapResult[i]);
        if (propNames[s]) {
          throw new TypeError("enumerate trap cannot list a "+
                              "duplicate property '"+s+"'");
        }
         propNames[s] = true;
        result[i] = s;
      } */

      var ownEnumerableProps = Object.keys(this.target);
      var target = this.target;
      ownEnumerableProps.forEach(function (ownEnumerableProp) {
        if (!propNames[ownEnumerableProp]) {
          if (isSealed(ownEnumerableProp, target)) {
            throw new TypeError("enumerate trap failed to include " + "non-configurable enumerable property '" + ownEnumerableProp + "'");
          }
          if (!Object.isExtensible(target) && isFixed(ownEnumerableProp, target)) {
            // if handler is allowed not to report ownEnumerableProp as an own
            // property, we cannot guarantee that it will never report it as
            // an own property later. Once a property has been reported as
            // non-existent on a non-extensible object, it should forever be
            // reported as non-existent
            throw new TypeError("cannot report existing own property '" + ownEnumerableProp + "' as non-existent on a " + "non-extensible object");
          }
        }
      });

      return result;
    },

    /**
     * The iterate trap is deprecated by the enumerate trap.
     */
    iterate: Validator.prototype.enumerate,

    /**
     * Any own non-configurable properties of the target that are not included
     * in the trap result give rise to a TypeError. As such, we check whether the
     * returned result contains at least all sealed properties of the target
     * object.
     *
     * The trap result is normalized.
     * The trap result is not returned directly. Instead:
     *  - create and return a fresh Array,
     *  - of which each element is coerced to String,
     *  - which does not contain duplicates
     *
     * FIXME: keys trap is deprecated
     */
    /*
    keys: function() {
      var trap = this.getTrap("keys");
      if (trap === undefined) {
        // default forwarding behavior
        return Reflect.keys(this.target);
      }
       var trapResult = trap.call(this.handler, this.target);
       // propNames is used as a set of strings
      var propNames = Object.create(null);
      var numProps = +trapResult.length;
      var result = new Array(numProps);
       for (var i = 0; i < numProps; i++) {
       var s = String(trapResult[i]);
       if (propNames[s]) {
         throw new TypeError("keys trap cannot list a "+
                             "duplicate property '"+s+"'");
       }
       if (!Object.isExtensible(this.target) && !isFixed(s, this.target)) {
         // non-extensible proxies don't tolerate new own property names
         throw new TypeError("keys trap cannot list a new "+
                             "property '"+s+"' on a non-extensible object");
       }
        propNames[s] = true;
       result[i] = s;
      }
       var ownEnumerableProps = Object.keys(this.target);
      var target = this.target;
      ownEnumerableProps.forEach(function (ownEnumerableProp) {
        if (!propNames[ownEnumerableProp]) {
          if (isSealed(ownEnumerableProp, target)) {
            throw new TypeError("keys trap failed to include "+
                                "non-configurable enumerable property '"+
                                ownEnumerableProp+"'");
          }
          if (!Object.isExtensible(target) &&
              isFixed(ownEnumerableProp, target)) {
              // if handler is allowed not to report ownEnumerableProp as an own
              // property, we cannot guarantee that it will never report it as
              // an own property later. Once a property has been reported as
              // non-existent on a non-extensible object, it should forever be
              // reported as non-existent
              throw new TypeError("cannot report existing own property '"+
                                  ownEnumerableProp+"' as non-existent on a "+
                                  "non-extensible object");
          }
        }
      });
       return result;
    },
    */

    /**
     * New trap that reifies [[Call]].
     * If the target is a function, then a call to
     *   proxy(...args)
     * Triggers this trap
     */
    apply: function apply(target, thisBinding, args) {
      var trap = this.getTrap("apply");
      if (trap === undefined) {
        return Reflect.apply(target, thisBinding, args);
      }

      if (typeof this.target === "function") {
        return trap.call(this.handler, target, thisBinding, args);
      } else {
        throw new TypeError("apply: " + target + " is not a function");
      }
    },

    /**
     * New trap that reifies [[Construct]].
     * If the target is a function, then a call to
     *   new proxy(...args)
     * Triggers this trap
     */
    construct: function construct(target, args, newTarget) {
      var trap = this.getTrap("construct");
      if (trap === undefined) {
        return Reflect.construct(target, args, newTarget);
      }

      if (typeof target !== "function") {
        throw new TypeError("new: " + target + " is not a function");
      }

      if (newTarget === undefined) {
        newTarget = target;
      } else {
        if (typeof newTarget !== "function") {
          throw new TypeError("new: " + newTarget + " is not a function");
        }
      }
      return trap.call(this.handler, target, args, newTarget);
    }
  };

  // ---- end of the Validator handler wrapper handler ----

  // In what follows, a 'direct proxy' is a proxy
  // whose handler is a Validator. Such proxies can be made non-extensible,
  // sealed or frozen without losing the ability to trap.

  // maps direct proxies to their Validator handlers
  var directProxies = new WeakMap();

  // patch Object.{preventExtensions,seal,freeze} so that
  // they recognize fixable proxies and act accordingly
  Object.preventExtensions = function (subject) {
    var vhandler = directProxies.get(subject);
    if (vhandler !== undefined) {
      if (vhandler.preventExtensions()) {
        return subject;
      } else {
        throw new TypeError("preventExtensions on " + subject + " rejected");
      }
    } else {
      return prim_preventExtensions(subject);
    }
  };
  Object.seal = function (subject) {
    setIntegrityLevel(subject, "sealed");
    return subject;
  };
  Object.freeze = function (subject) {
    setIntegrityLevel(subject, "frozen");
    return subject;
  };
  Object.isExtensible = Object_isExtensible = function Object_isExtensible(subject) {
    var vHandler = directProxies.get(subject);
    if (vHandler !== undefined) {
      return vHandler.isExtensible();
    } else {
      return prim_isExtensible(subject);
    }
  };
  Object.isSealed = Object_isSealed = function Object_isSealed(subject) {
    return testIntegrityLevel(subject, "sealed");
  };
  Object.isFrozen = Object_isFrozen = function Object_isFrozen(subject) {
    return testIntegrityLevel(subject, "frozen");
  };
  Object.getPrototypeOf = Object_getPrototypeOf = function Object_getPrototypeOf(subject) {
    var vHandler = directProxies.get(subject);
    if (vHandler !== undefined) {
      return vHandler.getPrototypeOf();
    } else {
      return prim_getPrototypeOf(subject);
    }
  };

  // patch Object.getOwnPropertyDescriptor to directly call
  // the Validator.prototype.getOwnPropertyDescriptor trap
  // This is to circumvent an assertion in the built-in Proxy
  // trapping mechanism of v8, which disallows that trap to
  // return non-configurable property descriptors (as per the
  // old Proxy design)
  Object.getOwnPropertyDescriptor = function (subject, name) {
    var vhandler = directProxies.get(subject);
    if (vhandler !== undefined) {
      return vhandler.getOwnPropertyDescriptor(name);
    } else {
      return prim_getOwnPropertyDescriptor(subject, name);
    }
  };

  // patch Object.defineProperty to directly call
  // the Validator.prototype.defineProperty trap
  // This is to circumvent two issues with the built-in
  // trap mechanism:
  // 1) the current tracemonkey implementation of proxies
  // auto-completes 'desc', which is not correct. 'desc' should be
  // normalized, but not completed. Consider:
  // Object.defineProperty(proxy, 'foo', {enumerable:false})
  // This trap will receive desc =
  //  {value:undefined,writable:false,enumerable:false,configurable:false}
  // This will also set all other attributes to their default value,
  // which is unexpected and different from [[DefineOwnProperty]].
  // Bug filed: https://bugzilla.mozilla.org/show_bug.cgi?id=601329
  // 2) the current spidermonkey implementation does not
  // throw an exception when this trap returns 'false', but instead silently
  // ignores the operation (this is regardless of strict-mode)
  // 2a) v8 does throw an exception for this case, but includes the rather
  //     unhelpful error message:
  // 'Proxy handler #<Object> returned false from 'defineProperty' trap'
  Object.defineProperty = function (subject, name, desc) {
    var vhandler = directProxies.get(subject);
    if (vhandler !== undefined) {
      var normalizedDesc = normalizePropertyDescriptor(desc);
      var success = vhandler.defineProperty(name, normalizedDesc);
      if (success === false) {
        throw new TypeError("can't redefine property '" + name + "'");
      }
      return subject;
    } else {
      return prim_defineProperty(subject, name, desc);
    }
  };

  Object.defineProperties = function (subject, descs) {
    var vhandler = directProxies.get(subject);
    if (vhandler !== undefined) {
      var names = Object.keys(descs);
      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        var normalizedDesc = normalizePropertyDescriptor(descs[name]);
        var success = vhandler.defineProperty(name, normalizedDesc);
        if (success === false) {
          throw new TypeError("can't redefine property '" + name + "'");
        }
      }
      return subject;
    } else {
      return prim_defineProperties(subject, descs);
    }
  };

  Object.keys = function (subject) {
    var vHandler = directProxies.get(subject);
    if (vHandler !== undefined) {
      var ownKeys = vHandler.ownKeys();
      var result = [];
      for (var i = 0; i < ownKeys.length; i++) {
        var k = String(ownKeys[i]);
        var desc = Object.getOwnPropertyDescriptor(subject, k);
        if (desc !== undefined && desc.enumerable === true) {
          result.push(k);
        }
      }
      return result;
    } else {
      return prim_keys(subject);
    }
  };

  Object.getOwnPropertyNames = Object_getOwnPropertyNames = function Object_getOwnPropertyNames(subject) {
    var vHandler = directProxies.get(subject);
    if (vHandler !== undefined) {
      return vHandler.ownKeys();
    } else {
      return prim_getOwnPropertyNames(subject);
    }
  };

  // fixes issue #71 (Calling Object.getOwnPropertySymbols() on a Proxy
  // throws an error)
  if (prim_getOwnPropertySymbols !== undefined) {
    Object.getOwnPropertySymbols = function (subject) {
      var vHandler = directProxies.get(subject);
      if (vHandler !== undefined) {
        // as this shim does not support symbols, a Proxy never advertises
        // any symbol-valued own properties
        return [];
      } else {
        return prim_getOwnPropertySymbols(subject);
      }
    };
  }

  // fixes issue #72 ('Illegal access' error when using Object.assign)
  // Object.assign polyfill based on a polyfill posted on MDN: 
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/\
  //  Global_Objects/Object/assign
  // Note that this polyfill does not support Symbols, but this Proxy Shim
  // does not support Symbols anyway.
  if (prim_assign !== undefined) {
    Object.assign = function (target) {

      // check if any argument is a proxy object
      var noProxies = true;
      for (var i = 0; i < arguments.length; i++) {
        var vHandler = directProxies.get(arguments[i]);
        if (vHandler !== undefined) {
          noProxies = false;
          break;
        }
      }
      if (noProxies) {
        // not a single argument is a proxy, perform built-in algorithm
        return prim_assign.apply(Object, arguments);
      }

      // there is at least one proxy argument, use the polyfill

      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var output = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var source = arguments[index];
        if (source !== undefined && source !== null) {
          for (var nextKey in source) {
            if (source.hasOwnProperty(nextKey)) {
              output[nextKey] = source[nextKey];
            }
          }
        }
      }
      return output;
    };
  }

  // returns whether an argument is a reference to an object,
  // which is legal as a WeakMap key.
  function isObject(arg) {
    var type = typeof arg === 'undefined' ? 'undefined' : _typeof(arg);
    return type === 'object' && arg !== null || type === 'function';
  };

  // a wrapper for WeakMap.get which returns the undefined value
  // for keys that are not objects (in which case the underlying
  // WeakMap would have thrown a TypeError).
  function safeWeakMapGet(map, key) {
    return isObject(key) ? map.get(key) : undefined;
  };

  // returns a new function of zero arguments that recursively
  // unwraps any proxies specified as the |this|-value.
  // The primitive is assumed to be a zero-argument method
  // that uses its |this|-binding.
  function makeUnwrapping0ArgMethod(primitive) {
    return function builtin() {
      var vHandler = safeWeakMapGet(directProxies, this);
      if (vHandler !== undefined) {
        return builtin.call(vHandler.target);
      } else {
        return primitive.call(this);
      }
    };
  };

  // returns a new function of 1 arguments that recursively
  // unwraps any proxies specified as the |this|-value.
  // The primitive is assumed to be a 1-argument method
  // that uses its |this|-binding.
  function makeUnwrapping1ArgMethod(primitive) {
    return function builtin(arg) {
      var vHandler = safeWeakMapGet(directProxies, this);
      if (vHandler !== undefined) {
        return builtin.call(vHandler.target, arg);
      } else {
        return primitive.call(this, arg);
      }
    };
  };

  Object.prototype.valueOf = makeUnwrapping0ArgMethod(Object.prototype.valueOf);
  Object.prototype.toString = makeUnwrapping0ArgMethod(Object.prototype.toString);
  Function.prototype.toString = makeUnwrapping0ArgMethod(Function.prototype.toString);
  Date.prototype.toString = makeUnwrapping0ArgMethod(Date.prototype.toString);

  Object.prototype.isPrototypeOf = function builtin(arg) {
    // bugfix thanks to Bill Mark:
    // built-in isPrototypeOf does not unwrap proxies used
    // as arguments. So, we implement the builtin ourselves,
    // based on the ECMAScript 6 spec. Our encoding will
    // make sure that if a proxy is used as an argument,
    // its getPrototypeOf trap will be called.
    while (true) {
      var vHandler2 = safeWeakMapGet(directProxies, arg);
      if (vHandler2 !== undefined) {
        arg = vHandler2.getPrototypeOf();
        if (arg === null) {
          return false;
        } else if (sameValue(arg, this)) {
          return true;
        }
      } else {
        return prim_isPrototypeOf.call(this, arg);
      }
    }
  };

  Array.isArray = function (subject) {
    var vHandler = safeWeakMapGet(directProxies, subject);
    if (vHandler !== undefined) {
      return Array.isArray(vHandler.target);
    } else {
      return prim_isArray(subject);
    }
  };

  function isProxyArray(arg) {
    var vHandler = safeWeakMapGet(directProxies, arg);
    if (vHandler !== undefined) {
      return Array.isArray(vHandler.target);
    }
    return false;
  }

  // Array.prototype.concat internally tests whether one of its
  // arguments is an Array, by checking whether [[Class]] == "Array"
  // As such, it will fail to recognize proxies-for-arrays as arrays.
  // We patch Array.prototype.concat so that it "unwraps" proxies-for-arrays
  // by making a copy. This will trigger the exact same sequence of
  // traps on the proxy-for-array as if we would not have unwrapped it.
  // See <https://github.com/tvcutsem/harmony-reflect/issues/19> for more.
  Array.prototype.concat = function () /*...args*/{
    var length;
    for (var i = 0; i < arguments.length; i++) {
      if (isProxyArray(arguments[i])) {
        length = arguments[i].length;
        arguments[i] = Array.prototype.slice.call(arguments[i], 0, length);
      }
    }
    return prim_concat.apply(this, arguments);
  };

  // setPrototypeOf support on platforms that support __proto__

  var prim_setPrototypeOf = Object.setPrototypeOf;

  // patch and extract original __proto__ setter
  var __proto__setter = function () {
    var protoDesc = prim_getOwnPropertyDescriptor(Object.prototype, '__proto__');
    if (protoDesc === undefined || typeof protoDesc.set !== "function") {
      return function () {
        throw new TypeError("setPrototypeOf not supported on this platform");
      };
    }

    // see if we can actually mutate a prototype with the generic setter
    // (e.g. Chrome v28 doesn't allow setting __proto__ via the generic setter)
    try {
      protoDesc.set.call({}, {});
    } catch (e) {
      return function () {
        throw new TypeError("setPrototypeOf not supported on this platform");
      };
    }

    prim_defineProperty(Object.prototype, '__proto__', {
      set: function set(newProto) {
        return Object.setPrototypeOf(this, Object(newProto));
      }
    });

    return protoDesc.set;
  }();

  Object.setPrototypeOf = function (target, newProto) {
    var handler = directProxies.get(target);
    if (handler !== undefined) {
      if (handler.setPrototypeOf(newProto)) {
        return target;
      } else {
        throw new TypeError("proxy rejected prototype mutation");
      }
    } else {
      if (!Object_isExtensible(target)) {
        throw new TypeError("can't set prototype on non-extensible object: " + target);
      }
      if (prim_setPrototypeOf) return prim_setPrototypeOf(target, newProto);

      if (Object(newProto) !== newProto || newProto === null) {
        throw new TypeError("Object prototype may only be an Object or null: " + newProto);
        // throw new TypeError("prototype must be an object or null")
      }
      __proto__setter.call(target, newProto);
      return target;
    }
  };

  Object.prototype.hasOwnProperty = function (name) {
    var handler = safeWeakMapGet(directProxies, this);
    if (handler !== undefined) {
      var desc = handler.getOwnPropertyDescriptor(name);
      return desc !== undefined;
    } else {
      return prim_hasOwnProperty.call(this, name);
    }
  };

  // ============= Reflection module =============
  // see http://wiki.ecmascript.org/doku.php?id=harmony:reflect_api

  var Reflect = global.Reflect = {
    getOwnPropertyDescriptor: function getOwnPropertyDescriptor(target, name) {
      return Object.getOwnPropertyDescriptor(target, name);
    },
    defineProperty: function defineProperty(target, name, desc) {

      // if target is a proxy, invoke its "defineProperty" trap
      var handler = directProxies.get(target);
      if (handler !== undefined) {
        return handler.defineProperty(target, name, desc);
      }

      // Implementation transliterated from [[DefineOwnProperty]]
      // see ES5.1 section 8.12.9
      // this is the _exact same algorithm_ as the isCompatibleDescriptor
      // algorithm defined above, except that at every place it
      // returns true, this algorithm actually does define the property.
      var current = Object.getOwnPropertyDescriptor(target, name);
      var extensible = Object.isExtensible(target);
      if (current === undefined && extensible === false) {
        return false;
      }
      if (current === undefined && extensible === true) {
        Object.defineProperty(target, name, desc); // should never fail
        return true;
      }
      if (isEmptyDescriptor(desc)) {
        return true;
      }
      if (isEquivalentDescriptor(current, desc)) {
        return true;
      }
      if (current.configurable === false) {
        if (desc.configurable === true) {
          return false;
        }
        if ('enumerable' in desc && desc.enumerable !== current.enumerable) {
          return false;
        }
      }
      if (isGenericDescriptor(desc)) {
        // no further validation necessary
      } else if (isDataDescriptor(current) !== isDataDescriptor(desc)) {
        if (current.configurable === false) {
          return false;
        }
      } else if (isDataDescriptor(current) && isDataDescriptor(desc)) {
        if (current.configurable === false) {
          if (current.writable === false && desc.writable === true) {
            return false;
          }
          if (current.writable === false) {
            if ('value' in desc && !sameValue(desc.value, current.value)) {
              return false;
            }
          }
        }
      } else if (isAccessorDescriptor(current) && isAccessorDescriptor(desc)) {
        if (current.configurable === false) {
          if ('set' in desc && !sameValue(desc.set, current.set)) {
            return false;
          }
          if ('get' in desc && !sameValue(desc.get, current.get)) {
            return false;
          }
        }
      }
      Object.defineProperty(target, name, desc); // should never fail
      return true;
    },
    deleteProperty: function deleteProperty(target, name) {
      var handler = directProxies.get(target);
      if (handler !== undefined) {
        return handler.delete(name);
      }

      var desc = Object.getOwnPropertyDescriptor(target, name);
      if (desc === undefined) {
        return true;
      }
      if (desc.configurable === true) {
        delete target[name];
        return true;
      }
      return false;
    },
    getPrototypeOf: function getPrototypeOf(target) {
      return Object.getPrototypeOf(target);
    },
    setPrototypeOf: function setPrototypeOf(target, newProto) {

      var handler = directProxies.get(target);
      if (handler !== undefined) {
        return handler.setPrototypeOf(newProto);
      }

      if (Object(newProto) !== newProto || newProto === null) {
        throw new TypeError("Object prototype may only be an Object or null: " + newProto);
      }

      if (!Object_isExtensible(target)) {
        return false;
      }

      var current = Object.getPrototypeOf(target);
      if (sameValue(current, newProto)) {
        return true;
      }

      if (prim_setPrototypeOf) {
        try {
          prim_setPrototypeOf(target, newProto);
          return true;
        } catch (e) {
          return false;
        }
      }

      __proto__setter.call(target, newProto);
      return true;
    },
    preventExtensions: function preventExtensions(target) {
      var handler = directProxies.get(target);
      if (handler !== undefined) {
        return handler.preventExtensions();
      }
      prim_preventExtensions(target);
      return true;
    },
    isExtensible: function isExtensible(target) {
      return Object.isExtensible(target);
    },
    has: function has(target, name) {
      return name in target;
    },
    get: function get(target, name, receiver) {
      receiver = receiver || target;

      // if target is a proxy, invoke its "get" trap
      var handler = directProxies.get(target);
      if (handler !== undefined) {
        return handler.get(receiver, name);
      }

      var desc = Object.getOwnPropertyDescriptor(target, name);
      if (desc === undefined) {
        var proto = Object.getPrototypeOf(target);
        if (proto === null) {
          return undefined;
        }
        return Reflect.get(proto, name, receiver);
      }
      if (isDataDescriptor(desc)) {
        return desc.value;
      }
      var getter = desc.get;
      if (getter === undefined) {
        return undefined;
      }
      return desc.get.call(receiver);
    },
    // Reflect.set implementation based on latest version of [[SetP]] at
    // http://wiki.ecmascript.org/doku.php?id=harmony:proto_climbing_refactoring
    set: function set(target, name, value, receiver) {
      receiver = receiver || target;

      // if target is a proxy, invoke its "set" trap
      var handler = directProxies.get(target);
      if (handler !== undefined) {
        return handler.set(receiver, name, value);
      }

      // first, check whether target has a non-writable property
      // shadowing name on receiver
      var ownDesc = Object.getOwnPropertyDescriptor(target, name);

      if (ownDesc === undefined) {
        // name is not defined in target, search target's prototype
        var proto = Object.getPrototypeOf(target);

        if (proto !== null) {
          // continue the search in target's prototype
          return Reflect.set(proto, name, value, receiver);
        }

        // Rev16 change. Cf. https://bugs.ecmascript.org/show_bug.cgi?id=1549
        // target was the last prototype, now we know that 'name' is not shadowed
        // by an existing (accessor or data) property, so we can add the property
        // to the initial receiver object
        // (this branch will intentionally fall through to the code below)
        ownDesc = { value: undefined,
          writable: true,
          enumerable: true,
          configurable: true };
      }

      // we now know that ownDesc !== undefined
      if (isAccessorDescriptor(ownDesc)) {
        var setter = ownDesc.set;
        if (setter === undefined) return false;
        setter.call(receiver, value); // assumes Function.prototype.call
        return true;
      }
      // otherwise, isDataDescriptor(ownDesc) must be true
      if (ownDesc.writable === false) return false;
      // we found an existing writable data property on the prototype chain.
      // Now update or add the data property on the receiver, depending on
      // whether the receiver already defines the property or not.
      var existingDesc = Object.getOwnPropertyDescriptor(receiver, name);
      if (existingDesc !== undefined) {
        var updateDesc = { value: value,
          // FIXME: it should not be necessary to describe the following
          // attributes. Added to circumvent a bug in tracemonkey:
          // https://bugzilla.mozilla.org/show_bug.cgi?id=601329
          writable: existingDesc.writable,
          enumerable: existingDesc.enumerable,
          configurable: existingDesc.configurable };
        Object.defineProperty(receiver, name, updateDesc);
        return true;
      } else {
        if (!Object.isExtensible(receiver)) return false;
        var newDesc = { value: value,
          writable: true,
          enumerable: true,
          configurable: true };
        Object.defineProperty(receiver, name, newDesc);
        return true;
      }
    },
    /*invoke: function(target, name, args, receiver) {
      receiver = receiver || target;
       var handler = directProxies.get(target);
      if (handler !== undefined) {
        return handler.invoke(receiver, name, args);
      }
       var fun = Reflect.get(target, name, receiver);
      return Function.prototype.apply.call(fun, receiver, args);
    },*/
    enumerate: function enumerate(target) {
      var handler = directProxies.get(target);
      var result;
      if (handler !== undefined) {
        // handler.enumerate should return an iterator directly, but the
        // iterator gets converted to an array for backward-compat reasons,
        // so we must re-iterate over the array
        result = handler.enumerate(handler.target);
      } else {
        result = [];
        for (var name in target) {
          result.push(name);
        };
      }
      var l = +result.length;
      var idx = 0;
      return {
        next: function next() {
          if (idx === l) return { done: true };
          return { done: false, value: result[idx++] };
        }
      };
    },
    // imperfect ownKeys implementation: in ES6, should also include
    // symbol-keyed properties.
    ownKeys: function ownKeys(target) {
      return Object_getOwnPropertyNames(target);
    },
    apply: function apply(target, receiver, args) {
      // target.apply(receiver, args)
      return Function.prototype.apply.call(target, receiver, args);
    },
    construct: function construct(target, args, newTarget) {
      // return new target(...args);

      // if target is a proxy, invoke its "construct" trap
      var handler = directProxies.get(target);
      if (handler !== undefined) {
        return handler.construct(handler.target, args, newTarget);
      }

      if (typeof target !== "function") {
        throw new TypeError("target is not a function: " + target);
      }
      if (newTarget === undefined) {
        newTarget = target;
      } else {
        if (typeof newTarget !== "function") {
          throw new TypeError("newTarget is not a function: " + target);
        }
      }

      return new (Function.prototype.bind.apply(newTarget, [null].concat(args)))();
    }
  };

  // feature-test whether the Proxy global exists, with
  // the harmony-era Proxy.create API
  if (typeof Proxy !== "undefined" && typeof Proxy.create !== "undefined") {

    var primCreate = Proxy.create,
        primCreateFunction = Proxy.createFunction;

    var revokedHandler = primCreate({
      get: function get() {
        throw new TypeError("proxy is revoked");
      }
    });

    global.Proxy = function (target, handler) {
      // check that target is an Object
      if (Object(target) !== target) {
        throw new TypeError("Proxy target must be an Object, given " + target);
      }
      // check that handler is an Object
      if (Object(handler) !== handler) {
        throw new TypeError("Proxy handler must be an Object, given " + handler);
      }

      var vHandler = new Validator(target, handler);
      var proxy;
      if (typeof target === "function") {
        proxy = primCreateFunction(vHandler,
        // call trap
        function () {
          var args = Array.prototype.slice.call(arguments);
          return vHandler.apply(target, this, args);
        },
        // construct trap
        function () {
          var args = Array.prototype.slice.call(arguments);
          return vHandler.construct(target, args);
        });
      } else {
        proxy = primCreate(vHandler, Object.getPrototypeOf(target));
      }
      directProxies.set(proxy, vHandler);
      return proxy;
    };

    global.Proxy.revocable = function (target, handler) {
      var proxy = new Proxy(target, handler);
      var revoke = function revoke() {
        var vHandler = directProxies.get(proxy);
        if (vHandler !== null) {
          vHandler.target = null;
          vHandler.handler = revokedHandler;
        }
        return undefined;
      };
      return { proxy: proxy, revoke: revoke };
    };

    // add the old Proxy.create and Proxy.createFunction methods
    // so old code that still depends on the harmony-era Proxy object
    // is not broken. Also ensures that multiple versions of this
    // library should load fine
    global.Proxy.create = primCreate;
    global.Proxy.createFunction = primCreateFunction;
  } else {
    // Proxy global not defined, or old API not available
    if (typeof Proxy === "undefined") {
      // Proxy global not defined, add a Proxy function stub
      global.Proxy = function (_target, _handler) {
        throw new Error("proxies not supported on this platform. On v8/node/iojs, make sure to pass the --harmony_proxies flag");
      };
    }
    // Proxy global defined but old API not available
    // presumably Proxy global already supports new API, leave untouched
  }

  // for node.js modules, export every property in the Reflect object
  // as part of the module interface
  if (typeof exports !== 'undefined') {
    Object.keys(Reflect).forEach(function (key) {
      exports[key] = Reflect[key];
    });
  }

  // function-as-module pattern
}(typeof exports !== 'undefined' ? global : undefined);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvc2NyaXB0cy5lczYiLCJqcy1leHBvcnRzL0NoYXJ0cy5qcyIsImpzLWV4cG9ydHMvSGVscGVycy5qcyIsImpzLXZlbmRvci9kMy10aXAuanMiLCJqcy12ZW5kb3IvcG9seWZpbGxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNZQTs7QUFDQTs7QUFDQTs7QUFDQTs7b01BZkMsbUYsQ0FBb0Y7QUFDcEY7OztBQUdEOzs7Ozs7Ozs7O0FBYUEsSUFBSSxXQUFZLFlBQVU7O0FBRTFCOztBQUVJLFFBQUksa0JBQWtCLEVBQXRCO0FBQ0EsUUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLFNBQVQsRUFBb0IsS0FBcEIsRUFBMEI7QUFBQTs7QUFDekMsYUFBSyxTQUFMLEdBQWlCLFNBQWpCO0FBQ0EsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssTUFBTCxHQUFjLFVBQVUsT0FBVixDQUFrQixPQUFsQixFQUFkLENBSHlDLENBR0U7O0FBRTNDLGFBQUssWUFBTCxHQUFvQixLQUFLLGtCQUFMLEVBQXBCO0FBQ0EsYUFBSyxRQUFMLEdBQWdCLEVBQWhCO0FBQ0EsYUFBSyxVQUFMLEdBQWtCLEVBQWxCO0FBQ0EsYUFBSyxZQUFMLENBQWtCLElBQWxCLENBQXVCLFlBQU07QUFBRTtBQUMzQixrQkFBSyxnQkFBTCxDQUFzQixTQUF0QixFQUFpQyxLQUFqQztBQUNILFNBRkQ7QUFHSCxLQVhEO0FBWUE7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBRWpCLDBCQUZpQixnQ0FFRztBQUFBOztBQUFFO0FBQ0E7QUFDQTtBQUNsQixnQkFBSSxlQUFlLEVBQW5CO0FBQ0EsZ0JBQUksVUFBVSxLQUFLLE1BQUwsQ0FBWSxPQUExQjtBQUFBLGdCQUNJLE9BQU8sQ0FBQyxLQUFLLE1BQUwsQ0FBWSxPQUFiLEVBQXFCLEtBQUssTUFBTCxDQUFZLGFBQWpDLENBRFgsQ0FKZ0IsQ0FL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S0FBbEIsQ0FBZjtBQUNBLFlBQUksYUFBYSxJQUFqQixFQUF1QjtBQUNyQixtQkFBUyxNQUFULEdBQW1CLElBQW5CO0FBQ0EsbUJBQVMsT0FBVCxHQUFtQixjQUFuQjtBQUNEO0FBQ0QsZUFBTyxTQUFQO0FBQ0QsT0FQRDtBQVFBLGFBQU8sRUFBQyxPQUFPLEtBQVIsRUFBZSxRQUFRLE1BQXZCLEVBQVA7QUFDRCxLQVhEOztBQWFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsV0FBTyxLQUFQLENBQWEsTUFBYixHQUFzQixVQUF0QjtBQUNBLFdBQU8sS0FBUCxDQUFhLGNBQWIsR0FBOEIsa0JBQTlCO0FBRUQsR0E3REQsTUE2RE87QUFDTDtBQUNBLFFBQUksT0FBTyxLQUFQLEtBQWlCLFdBQXJCLEVBQWtDO0FBQ2hDO0FBQ0EsYUFBTyxLQUFQLEdBQWUsVUFBUyxPQUFULEVBQWtCLFFBQWxCLEVBQTRCO0FBQ3pDLGNBQU0sSUFBSSxLQUFKLENBQVUsdUdBQVYsQ0FBTjtBQUNELE9BRkQ7QUFHRDtBQUNEO0FBQ0E7QUFDRDs7QUFFRDtBQUNBO0FBQ0EsTUFBSSxPQUFPLE9BQVAsS0FBbUIsV0FBdkIsRUFBb0M7QUFDbEMsV0FBTyxJQUFQLENBQVksT0FBWixFQUFxQixPQUFyQixDQUE2QixVQUFVLEdBQVYsRUFBZTtBQUMxQyxjQUFRLEdBQVIsSUFBZSxRQUFRLEdBQVIsQ0FBZjtBQUNELEtBRkQ7QUFHRDs7QUFFRDtBQUNDLENBcGlFdUIsQ0FvaUV0QixPQUFPLE9BQVAsS0FBbUIsV0FBbkIsR0FBaUMsTUFBakMsWUFwaUVzQixDQUFqQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIgLyogZXhwb3J0ZWQgRDNDaGFydHMsIEhlbHBlcnMsIGQzVGlwLCByZWZsZWN0LCBhcnJheUZpbmQsIFNWR0lubmVySFRNTCwgU1ZHRm9jdXMgKi8gLy8gbGV0J3MganNoaW50IGtub3cgdGhhdCBEM0NoYXJ0cyBjYW4gYmUgXCJkZWZpbmVkIGJ1dCBub3QgdXNlZFwiIGluIHRoaXMgZmlsZVxuIC8qIHBvbHlmaWxscyBuZWVkZWQ6IFByb21pc2UsIEFycmF5LmlzQXJyYXksIEFycmF5LmZpbmQsIEFycmF5LmZpbHRlciwgUmVmbGVjdCwgT2JqZWN0Lm93blByb3BlcnR5RGVzY3JpcHRvcnNcbiAqL1xuXG4vKlxuaW5pdGlhbGl6ZWQgYnkgd2luZG93cy5EM0NoYXJ0cy5Jbml0KCkgd2hpY2ggY3JlYXRlcyBhIG5ldyBEM0NoYXJ0R3JvdXAgZm9yIGVhY2ggZGl2LmQzLWdyb3VwIGluIHRoZSBET00uXG5lYWNoIGRpdidzIGRhdGEgYXR0cmlidXRlcyBzdXBwbHkgdGhlIGNvbmZpZ3VyYXRpb24gbmVlZGVkLiBpbmRpdmlkdWFsIGNoYXJ0cyBpbmhlcml0IGZyb20gdGhlIGdyb3VwJ3Mgb25maWd1cmF0aW9uXG5kYXRhIGJ1dCBjYW4gYWxzbyBzcGVjaWZ5IHRoZWlyIG93bi5cblxuZ3JvdXBzIGFyZSBjb2xsZWN0ZWQgaW4gZ3JvdXBDb2xsZWN0aW9uIGFycmF5IFxuXG4qL1xuaW1wb3J0IHsgcmVmbGVjdCwgYXJyYXlGaW5kLCBTVkdJbm5lckhUTUwsIFNWR0ZvY3VzIH0gZnJvbSAnLi4vanMtdmVuZG9yL3BvbHlmaWxscyc7XG5pbXBvcnQgeyBIZWxwZXJzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9IZWxwZXJzJztcbmltcG9ydCB7IENoYXJ0cyB9IGZyb20gJy4uL2pzLWV4cG9ydHMvQ2hhcnRzJztcbmltcG9ydCB7IGQzVGlwIH0gZnJvbSAnLi4vanMtdmVuZG9yL2QzLXRpcCc7XG5cbnZhciBEM0NoYXJ0cyA9IChmdW5jdGlvbigpeyBcblxuXCJ1c2Ugc3RyaWN0XCI7ICBcbiAgICAgXG4gICAgdmFyIGdyb3VwQ29sbGVjdGlvbiA9IFtdO1xuICAgIHZhciBEM0NoYXJ0R3JvdXAgPSBmdW5jdGlvbihjb250YWluZXIsIGluZGV4KXtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgICAgIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb250YWluZXIuZGF0YXNldC5jb252ZXJ0KCk7IC8vIG1ldGhvZCBwcm92aWRlZCBpbiBIZWxwZXJzXG4gICAgICAgIFxuICAgICAgICB0aGlzLmRhdGFQcm9taXNlcyA9IHRoaXMucmV0dXJuRGF0YVByb21pc2VzKCk7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSBbXTsgXG4gICAgICAgIHRoaXMuY29sbGVjdEFsbCA9IFtdO1xuICAgICAgICB0aGlzLmRhdGFQcm9taXNlcy50aGVuKCgpID0+IHsgLy8gd2hlbiB0aGUgZGF0YSBwcm9taXNlcyByZXNvbHZlLCBjaGFydHMgYXJlIGluaXRpYWxpemVkXG4gICAgICAgICAgICB0aGlzLmluaXRpYWxpemVDaGFydHMoY29udGFpbmVyLCBpbmRleCk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgLy9wcm90b3R5cGUgYmVnaW5zIGhlcmVcbiAgICBEM0NoYXJ0R3JvdXAucHJvdG90eXBlID0ge1xuICAgICAgICBcbiAgICAgICAgICAgIHJldHVybkRhdGFQcm9taXNlcygpeyAvLyBnZXRzIGRhdGEgZnJvbSBHb29nbGUgU2hlZXQsIGNvbnZlcnN0IHJvd3MgdG8ga2V5LXZhbHVlIHBhaXJzLCBuZXN0cyB0aGUgZGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFzIHNwZWNpZmllZCBieSB0aGUgY29uZmlnIG9iamVjdCwgYW5kIGNyZWF0ZXMgYXJyYXkgb2Ygc3VtbWFyaXplZCBkYXRhIGF0IGRpZmZlcmVudFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5lc3RpbmcgbGV2ZWxzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgZGF0YVByb21pc2VzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHNoZWV0SUQgPSB0aGlzLmNvbmZpZy5zaGVldElkLCBcbiAgICAgICAgICAgICAgICAgICAgdGFicyA9IFt0aGlzLmNvbmZpZy5kYXRhVGFiLHRoaXMuY29uZmlnLmRpY3Rpb25hcnlUYWJdOyAvLyB0aGlzIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlzIHRoZXJlIGEgY2FzZSBmb3IgbW9yZSB0aGFuIG9uZSBzaGVldCBvZiBkYXRhP1xuICAgICAgICAgICAgICAgIHRhYnMuZm9yRWFjaCgoZWFjaCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZDMuanNvbignaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLycgKyBzaGVldElEICsgJy92YWx1ZXMvJyArIGVhY2ggKyAnP2tleT1BSXphU3lERDNXNXdKZUpGMmVzZmZaTVF4TnRFbDl0dC1PZmdTcTQnLCAoZXJyb3IsZGF0YSkgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZXMgPSBkYXRhLnZhbHVlcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdFR5cGUgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyAnb2JqZWN0JyA6ICdzZXJpZXMnOyAvLyBuZXN0VHlwZSBmb3IgZGF0YSBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5ID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gZmFsc2UgOiB0aGlzLmNvbmZpZy5uZXN0Qnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgdHJ1ZSwgbmVzdFR5cGUsIGksIHRoaXMuY29uZmlnLm5vcm1hbGl6ZUNvbHVtbnNTdGFydCkpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgUHJvbWlzZS5hbGwoZGF0YVByb21pc2VzKS50aGVuKHZhbHVlcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YSA9IHZhbHVlc1swXTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGljdGlvbmFyeSA9IHZhbHVlc1sxXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSB0aGlzLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoZGF0YVByb21pc2VzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdW1tYXJpemVEYXRhKCl7IC8vIHRoaXMgZm4gY3JlYXRlcyBhbiBhcnJheSBvZiBvYmplY3RzIHN1bW1hcml6aW5nIHRoZSBkYXRhIGluIG1vZGVsLmRhdGEuIG1vZGVsLmRhdGEgaXMgbmVzdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBuZXN0aW5nIGFuZCByb2xsaW5nIHVwIGNhbm5vdCBiZSBkb25lIGVhc2lseSBhdCB0aGUgc2FtZSB0aW1lLCBzbyB0aGV5J3JlIGRvbmUgc2VwYXJhdGVseS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHN1bW1hcmllcyBwcm92aWRlIGF2ZXJhZ2UsIG1heCwgbWluIG9mIGFsbCBmaWVsZHMgaW4gdGhlIGRhdGEgYXQgYWxsIGxldmVscyBvZiBuZXN0aW5nLiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLCB0aGUgc2Vjb25kIGlzIHR3bywgYW5kIHNvIG9uLlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgIHZhciBzdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgICAgIHZhciBuZXN0QnlBcnJheSA9IHRoaXMubmVzdEJ5QXJyYXkubWFwKGEgPT4gYSk7XG4gICAgICAgICAgICAgICB2YXIgdmFyaWFibGVYID0gdGhpcy5jb25maWcudmFyaWFibGVYO1xuXG4gICAgICAgICAgICAgICBmdW5jdGlvbiByZWR1Y2VWYXJpYWJsZXMoZCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4OiAgICAgICBkMy5tYXgoZCwgZCA9PiBkLnZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW46ICAgICAgIGQzLm1pbihkLCBkID0+IGQudmFsdWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lYW46ICAgICAgZDMubWVhbihkLCBkID0+IGQudmFsdWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1bTogICAgICAgZDMuc3VtKGQsIGQgPT4gZC52YWx1ZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFuOiAgICBkMy5tZWRpYW4oZCwgZCA9PiBkLnZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW5jZTogIGQzLnZhcmlhbmNlKGQsIGQgPT4gZC52YWx1ZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWF0aW9uOiBkMy5kZXZpYXRpb24oZCwgZCA9PiBkLnZhbHVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHg6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXg6ICAgICAgIGQzLm1heChkLCBkID0+IGRbdmFyaWFibGVYXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluOiAgICAgICBkMy5taW4oZCwgZCA9PiBkW3ZhcmlhYmxlWF0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lYW46ICAgICAgZDMubWVhbihkLCBkID0+IGRbdmFyaWFibGVYXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VtOiAgICAgICBkMy5zdW0oZCwgZCA9PiBkW3ZhcmlhYmxlWF0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lZGlhbjogICAgZDMubWVkaWFuKGQsIGQgPT4gZFt2YXJpYWJsZVhdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW5jZTogIGQzLnZhcmlhbmNlKGQsIGQgPT4gZFt2YXJpYWJsZVhdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpYXRpb246IGQzLmRldmlhdGlvbihkLCBkID0+IGRbdmFyaWFibGVYXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgd2hpbGUgKCBuZXN0QnlBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnJvbGx1cChyZWR1Y2VWYXJpYWJsZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHRoaXMudW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgICAgICBzdW1tYXJpZXMucHVzaChzdW1tYXJpemVkKTsgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiBzdW1tYXJpZXM7XG4gICAgICAgICAgICB9LCBcbiAgICAgICAgICAgIG5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpe1xuICAgICAgICAgICAgICAgIC8vIHJlY3Vyc2l2ZSAgbmVzdGluZyBmdW5jdGlvbiB1c2VkIGJ5IHN1bW1hcml6ZURhdGEgYW5kIHJldHVybktleVZhbHVlc1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXN0QnlBcnJheS5yZWR1Y2UoKGFjYywgY3VyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyICE9PSAnc3RyaW5nJyAmJiB0eXBlb2YgY3VyICE9PSAnZnVuY3Rpb24nICkgeyB0aHJvdyAnZWFjaCBuZXN0QnkgaXRlbSBtdXN0IGJlIGEgc3RyaW5nIG9yIGZ1bmN0aW9uJzsgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgcnRuO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdzdHJpbmcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkW2N1cl07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTsgICAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjdXIoZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJ0bjtcbiAgICAgICAgICAgICAgICB9LCBkMy5uZXN0KCkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJldHVybk5vcm1hbGl6ZWRWYWx1ZXModmFsdWVzLCBzdGFydCl7XG5cbiAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgICAgIHZhciBuZXdSb3dzQXJyYXkgPSBbWy4uLnZhbHVlc1swXS5zbGljZSgwLHN0YXJ0KSwgJ3Byb3BlcnR5JywndmFsdWUnXV07XG4gICAgICAgICAgICAgICAgdmFsdWVzLnNsaWNlKDEpLmZvckVhY2gocm93ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlcGVhdCA9IHJvdy5zbGljZSgwLHN0YXJ0KTtcbiAgICAgICAgICAgICAgICAgICAgcm93LnNsaWNlKHN0YXJ0KS5mb3JFYWNoKCh2YWx1ZSwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1JvdyA9IFsuLi5yZXBlYXQsIHZhbHVlc1swXVtpICsgc3RhcnRdLCB2YWx1ZV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHZhbHVlICE9PSBcIlwiICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Um93c0FycmF5LnB1c2gobmV3Um93KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7ICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiBuZXdSb3dzQXJyYXk7XG4gICAgICAgICAgICB9LCAgICAgICBcbiAgICAgICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycsIHRhYkluZGV4ID0gMCwgbm9ybWFsaXplQ29sdW1uc1N0YXJ0ID0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgIC8vIHRoaXMgZm4gdGFrZXMgbm9ybWFsaXplZCBkYXRhIGZldGNoZWQgYXMgYW4gYXJyYXkgb2Ygcm93cyBhbmQgdXNlcyB0aGUgdmFsdWVzIGluIHRoZSBmaXJzdCByb3cgYXMga2V5cyBmb3IgdmFsdWVzIGluXG4gICAgICAgICAgICAvLyBzdWJzZXF1ZW50IHJvd3NcbiAgICAgICAgICAgIC8vIG5lc3RCeSA9IHN0cmluZyBvciBhcnJheSBvZiBmaWVsZChzKSB0byBuZXN0IGJ5LCBvciBhIGN1c3RvbSBmdW5jdGlvbiwgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnM7XG4gICAgICAgICAgICAvLyBjb2VyY2UgPSBCT09MIGNvZXJjZSB0byBudW0gb3Igbm90OyBuZXN0VHlwZSA9IG9iamVjdCBvciBzZXJpZXMgbmVzdCAoZDMpXG4gICAgICAgICAgICAgICAgdmFyIHByZWxpbTtcbiAgICAgICAgICAgICAgICBpZiAoIG5vcm1hbGl6ZUNvbHVtbnNTdGFydCAhPT0gdW5kZWZpbmVkICYmIHRhYkluZGV4ID09PSAwICkgIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzID0gdGhpcy5yZXR1cm5Ob3JtYWxpemVkVmFsdWVzKHZhbHVlcywgbm9ybWFsaXplQ29sdW1uc1N0YXJ0KTtcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIHZhciB1bm5lc3RlZCA9IHZhbHVlcy5zbGljZSgxKS5tYXAocm93ID0+IHJvdy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIsIGkpIHsgXG5cbiAgICAgICAgICAgICAgICAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgICAvLyAzLiAvLyBhY2MgaXMgYW4gb2JqZWN0ICwga2V5IGlzIGNvcnJlc3BvbmRpbmcgdmFsdWUgZnJvbSByb3cgMCwgdmFsdWUgaXMgY3VycmVudCB2YWx1ZSBvZiBhcnJheVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGFjY1t2YWx1ZXNbMF1baV1dID0gY29lcmNlID09PSB0cnVlID8gaXNOYU4oK2N1cikgfHwgY3VyID09PSAnJyA/IGN1ciA6ICtjdXIgOiBjdXI7IFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0IGZvciBlbXB0eSBzdHJpbmdzIGJlZm9yZSBjb2VyY2luZyBiYyArJycgPT4gMFxuICAgICAgICAgICAgICAgIH0sIHt9KSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCB0YWJJbmRleCA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51bm5lc3RlZCA9IHVubmVzdGVkO1xuICAgICAgICAgICAgICAgIH0gICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICggIW5lc3RCeSApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgbmVzdEJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbmVzdEJ5ID09PSAnZnVuY3Rpb24nICkgeyAvLyBpZSBvbmx5IG9uZSBuZXN0QnkgZmllbGQgb3IgZnVuY2l0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubmVzdEJ5QXJyYXkgPSBbbmVzdEJ5XTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5uZXN0QnlBcnJheSA9IG5lc3RCeTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSB0aGlzLm5lc3RQcmVsaW0odGhpcy5uZXN0QnlBcnJheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICggbmVzdFR5cGUgPT09ICdvYmplY3QnICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRyaWVzKHVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5pdGlhbGl6ZUNoYXJ0cyhjb250YWluZXIsIGluZGV4KXtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgZ3JvdXAgPSB0aGlzO1xuICAgICAgICAgICAgICAgIGQzLnNlbGVjdEFsbCgnLmQzLWNoYXJ0Lmdyb3VwLScgKyBpbmRleCkgLy8gc2VsZWN0IGFsbCBgZGl2LmQzLWNoYXJ0YHMgdGhhdCBhcmUgYXNzb2NpYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2l0aCB0aGUgZ3JvdXAgYnkgY2xhc3NuYW1lIFwiZ3JvdXAtXCIgKyBpbmRleCBcbiAgICAgICAgICAgICAgICAgICAgLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyb3VwLmNoaWxkcmVuLnB1c2gobmV3IENoYXJ0cy5DaGFydERpdih0aGlzLCBncm91cCkpOyAvLyBjb25zdHJ1Y3RvciBwcm92aWRlZCBpbiBDaGFydHNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9ICAgICAgICBcbiAgICB9OyAvLyBEM0NoYXJ0R3JvdXAgcHJvdG90eXBlIGVuZHMgaGVyZVxuICAgIFxuICAgIC8qIFBVQkxJQyBBUEkgKi9cbiAgICB3aW5kb3cuRDNDaGFydHMgPSB7IC8vIG5lZWQgdG8gc3BlY2lmeSB3aW5kb3cgYmMgYWZ0ZXIgdHJhbnNwaWxpbmcgYWxsIHRoaXMgd2lsbCBiZSB3cmFwcGVkIGluIElJRkVzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgYHJldHVybmBpbmcgd29uJ3QgZ2V0IHRoZSBleHBvcnQgaW50byB3aW5kb3cncyBnbG9iYWwgc2NvcGVcbiAgICAgICAgSW5pdCgpe1xuICAgICAgICAgICAgdmFyIGdyb3VwRGl2cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5kMy1ncm91cCcpO1xuICAgICAgICAgICAgZm9yICggbGV0IGkgPSAwOyBpIDwgZ3JvdXBEaXZzLmxlbmd0aDsgaSsrICl7XG4gICAgICAgICAgICAgICAgZ3JvdXBDb2xsZWN0aW9uLnB1c2gobmV3IEQzQ2hhcnRHcm91cChncm91cERpdnNbaV0sIGkpKTtcbiAgICAgICAgICAgIH0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb250YWluZXIsIGluZGV4IFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBcbiAgICAgICAgfSxcbiAgICAgICAgY29sbGVjdEFsbDpbXSxcbiAgICAgICAgVXBkYXRlQWxsKHZhcmlhYmxlWSl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdEFsbC5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgIGVhY2gudXBkYXRlKHZhcmlhYmxlWSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgVXBkYXRlR3JvdXAoaW5kZXgsdmFyaWFibGVZKXtcbiAgICAgICAgICAgIGdyb3VwQ29sbGVjdGlvbltpbmRleF0uY29sbGVjdEFsbC5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgIGVhY2gudXBkYXRlKHZhcmlhYmxlWSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59KCkpOyAvLyBlbmQgdmFyIEQzQ2hhcnRzIElJRkUiLCJleHBvcnQgY29uc3QgQ2hhcnRzID0gKGZ1bmN0aW9uKCl7ICAgIFxuICAgIC8qIGdsb2JhbHMgRDNDaGFydHMgKi9cblxuICAgIHZhciBDaGFydERpdiA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgcGFyZW50KXsgLy8gY29uc3RydWN0b3IgY2FsbGVkIGZyb20gc2NyaXB0cyBvbmNlIGZvciBlYWNoIGRpdi5kMy1jaGFydFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW4gdGhlIERPTS4gY29udGFpbmVyIGlzIHRoZSBET00gZWxlbWVudDsgcGFyZW50IGlzIHRoZSBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEQzQ2hhcnRHcm91cCB0byB3aGljaCBpdCBiZWxvbmdzXG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgICAgICB0aGlzLnNlcmllc0NvdW50ID0gMDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBPYmplY3QuY3JlYXRlKCBwYXJlbnQuY29uZmlnLCBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyggY29udGFpbmVyLmRhdGFzZXQuY29udmVydCgpICkgKTtcbiAgICAgICAgICAgIC8vIGxpbmUgYWJvdmUgY3JlYXRlcyBhIGNvbmZpZyBvYmplY3QgZnJvbSB0aGUgSFRNTCBkYXRhc2V0IGZvciB0aGUgY2hhcnREaXYgY29udGFpbmVyXG4gICAgICAgICAgICAvLyB0aGF0IGluaGVyaXRzIGZyb20gdGhlIHBhcmVudHMgY29uZmlnIG9iamVjdC4gYW55IGNvbmZpZ3Mgbm90IHNwZWNpZmllZCBmb3IgdGhlIGNoYXJ0RGl2IChhbiBvd24gcHJvcGVydHkpXG4gICAgICAgICAgICAvLyB3aWxsIGNvbWUgZnJvbSB1cCB0aGUgaW5oZXJpdGFuY2UgY2hhaW5cbiAgICAgICAgdGhpcy5kYXR1bSA9IHBhcmVudC5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gdGhpcy5jb25maWcuY2F0ZWdvcnkpOyBcbiAgICAgICAgICAgIC8vIHBhcmVudC5kYXRhIGlzIHRoZSBlbnRpcmUgZGF0YXNldCBmcm9tIHRoZSBHb29nbGUgU2hlZXQuIGxpbmUgYWJvdmUgc2VsZWN0cyBmcm9tIHRoYXQgZGF0YXNldCB0aGUgb2JqZWN0XG4gICAgICAgICAgICAvLyBtYXRjaGluZyB0aGUgY2F0ZWdvcnkgc3BlY2lmaWVkIGZvciB0aGUgY3VycmVudCBDaGFydERpdi4gaGVyZSBpcyB3aHkgdGhlIGRhdGEgaGFzIHRvIGJlIG5lc3RlZCBmaXJzdCBieSBcbiAgICAgICAgICAgIC8vIHRoZSBjYXRlZ29yeVxuXG4gICAgICAgICAgICAvKiByZW1vdmUgc2VyaWVzSW5zdHJ1Y3QgYmMgZ3JvdXBTZXJpZXMgY2FuIGhhbmRsZSBpdCAqL1xuXG5cbiAgICAgICAgdGhpcy5ncm91cGVkU2VyaWVzRGF0YSA9IHRoaXMuZ3JvdXBTZXJpZXMoKTsgLy8gb3JnYW5pemVzIGRhdGEgYWNjIHRvIGluc3RydWN0aW9uIHJlIGdyb3VwaW5nIHNlcmllcyAgXG4gICAgICAgIFxuICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB0aGlzLnBhcmVudC5kaWN0aW9uYXJ5O1xuICAgICAgICBpZiAoIHRoaXMuY29uZmlnLmhlYWRpbmcgIT09IGZhbHNlICl7XG4gICAgICAgICAgICB0aGlzLmFkZEhlYWRpbmcodGhpcy5jb25maWcuaGVhZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgZDMuc2VsZWN0KHRoaXMuY29udGFpbmVyKS5hcHBlbmQoJ2RpdicpO1xuICAgICAgICB0aGlzLmNyZWF0ZUNoYXJ0cygpOyAvLyBhIG5ldyBDaGFydCBmb3IgZWFjaCBncm91cGVkIHNlcmllc1xuICAgICAgfTtcblxuICAgIENoYXJ0RGl2LnByb3RvdHlwZSA9IHtcblxuICAgICAgICBjaGFydFR5cGVzOiB7IFxuICAgICAgICAgICAgbGluZTogICAnTGluZUNoYXJ0JyxcbiAgICAgICAgICAgIGNvbHVtbjogJ0NvbHVtbkNoYXJ0JyxcbiAgICAgICAgICAgIGJhcjogICAgJ0JhckNoYXJ0JyAvLyBzbyBvbiAuIC4gLlxuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVDaGFydHMoKXtcbiAgICAgICAgICAgIHRoaXMuZ3JvdXBlZFNlcmllc0RhdGEuZm9yRWFjaCgoZWFjaCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChuZXcgTGluZUNoYXJ0KHRoaXMsIGVhY2gpKTsgLy8gVE8gRE8gZGlzdGluZ3Vpc2ggY2hhcnQgdHlwZXMgaGVyZVxuICAgICAgICAgICAgfSk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBhcmVudCwgZGF0YSAgIFxuICAgICAgICB9LFxuICAgICAgICBncm91cFNlcmllcygpeyAvLyB0YWtlcyB0aGUgZGF0dW0gZm9yIHRoZSBjaGFydERpdiAodGhlIGRhdGEgbWF0Y2hpbmcgdGhlIHNwZWNpZmllZCBjYXRlZ29yeSlcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIG9yZ2FuaXplcyB0aGUgc2VyaWVzIGFjY29yZGluZyB0aGUgc2VyaWVzR3JvdXAgaW5zdHJ1Y3Rpb25zIGZyb20gdGhlIGRhdGEgYXR0cmlidXRlcyBcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gJ2FsbCcgcHV0cyBhbGwgc2VyaWVzIHRvZ2V0aGVyIGluIG9uZSBhcnJheSB3aXRoIGNvbnNlcXVlbmNlIG9mIGFsbCBzZXJpZXMgYmVpbmcgcmVuZGVyZWRcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gaW4gdGhlIHNhbWUgU1ZHLiAgJ25vbmUnIHB1dHMgZWFjaCBzZXJpZXMgaW4gaXRzIG93biBhcnJheTsgZWFjaCBpcyByZW5kZXJlZCBpbiBpdHMgb3duIFNWRztcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgYW4gYXJyYXkgb2YgYXJyYXlzIGlzIHNwZWNpZmllZCBpbiB0aGUgY29uZmlndXJhdGlvbiBmb3IgdGhlIENoYXJ0RGl2LCB0aGUgZ3JvdXBlZCBzZXJpZXNcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJlIHJlbmRlcmVkIHRvZ2V0aGVyLlxuICAgICAgICAgICAgdmFyIHNlcmllc0dyb3VwcyxcbiAgICAgICAgICAgICAgICBncm91cHNJbnN0cnVjdCA9IHRoaXMuY29uZmlnLnNlcmllc0dyb3VwIHx8ICdub25lJztcbiAgICAgICAgICAgIGlmICggQXJyYXkuaXNBcnJheSggZ3JvdXBzSW5zdHJ1Y3QgKSApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5zZXJpZXNHcm91cC5mb3JFYWNoKGdyb3VwID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzLnB1c2godGhpcy5kYXR1bS52YWx1ZXMuZmlsdGVyKHNlcmllcyA9PiBncm91cC5pbmRleE9mKHNlcmllcy5rZXkpICE9PSAtMSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdub25lJyApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSB0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBbZWFjaF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdhbGwnICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFt0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBlYWNoKV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBJbnZhbGlkIGRhdGEtZ3JvdXAtc2VyaWVzIGluc3RydWN0aW9uIGZyb20gaHRtbC4gXG4gICAgICAgICAgICAgICAgICAgICAgIE11c3QgYmUgdmFsaWQgSlNPTjogXCJOb25lXCIgb3IgXCJBbGxcIiBvciBhbiBhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICBvZiBhcnJheXMgY29udGFpbmluZyB0aGUgc2VyaWVzIHRvIGJlIGdyb3VwZWRcbiAgICAgICAgICAgICAgICAgICAgICAgdG9nZXRoZXIuIEFsbCBzdHJpbmdzIG11c3QgYmUgZG91YmxlLXF1b3RlZC5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHNlcmllc0dyb3VwcztcbiAgICAgICAgfSwgLy8gZW5kIGdyb3VwU2VyaWVzKClcbiAgICAgICAgYWRkSGVhZGluZyhpbnB1dCl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBoZWFkaW5nID0gZDMuc2VsZWN0KHRoaXMuY29udGFpbmVyKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3AnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ3JlbGF0aXZlJylcbiAgICAgICAgICAgICAgICAuaHRtbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBoZWFkaW5nID0gdHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJyA/IGlucHV0IDogdGhpcy5sYWJlbCh0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nICsgaGVhZGluZyArICc8L3N0cm9uZz4nO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgdmFyIGxhYmVsVG9vbHRpcCA9IGQzLnRpcCgpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcImQzLXRpcCBsYWJlbC10aXBcIilcbiAgICAgICAgICAgICAgICAuZGlyZWN0aW9uKCdzJylcbiAgICAgICAgICAgICAgICAub2Zmc2V0KFs0LCAwXSlcbiAgICAgICAgICAgICAgICAuaHRtbCh0aGlzLmRlc2NyaXB0aW9uKHRoaXMuY29uZmlnLmNhdGVnb3J5KSk7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG1vdXNlb3Zlcigpe1xuICAgICAgICAgICAgICAgIGlmICggd2luZG93Lm9wZW5Ub29sdGlwICkge1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAuaGlkZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsYWJlbFRvb2x0aXAuc2hvdygpO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcCA9IGxhYmVsVG9vbHRpcDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCB0aGlzLmRlc2NyaXB0aW9uKHRoaXMuY29uZmlnLmNhdGVnb3J5KSAhPT0gdW5kZWZpbmVkICYmIHRoaXMuZGVzY3JpcHRpb24odGhpcy5jb25maWcuY2F0ZWdvcnkpICE9PSAnJyApe1xuICAgICAgICAgICAgICAgIGhlYWRpbmcuaHRtbChoZWFkaW5nLmh0bWwoKSArICc8c3ZnIGZvY3VzYWJsZT1cImZhbHNlXCIgY2xhc3M9XCJpbmxpbmUgaGVhZGluZy1pbmZvXCI+PGEgZm9jdXNhYmxlPVwidHJ1ZVwiIHRhYmluZGV4PVwiMFwiIHhsaW5rOmhyZWY9XCIjXCI+PHRleHQgeD1cIjRcIiB5PVwiMTJcIiBjbGFzcz1cImluZm8tbWFya1wiPj88L3RleHQ+PC9hPjwvc3ZnPicpO1xuXG4gICAgICAgICAgICAgICAgaGVhZGluZy5zZWxlY3QoJy5oZWFkaW5nLWluZm8gYScpXG4gICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdoYXMtdG9vbHRpcCcsIHRydWUpXG4gICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9jdXMoKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsICgpID0+IHsgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbW91c2VvdmVyLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdXQnLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5ibHVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3RoaXMuc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsJ3RydWUnKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLm9uKCdibHVyJywgbGFiZWxUb29sdGlwLmhpZGUpXG4gICAgICAgICAgICAgICAgICAgIC5vbignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5ldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2FsbChsYWJlbFRvb2x0aXApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBsYWJlbChrZXkpeyAvLyBUTyBETzogY29tYmluZSB0aGVzZSBpbnRvIG9uZSBtZXRob2QgdGhhdCByZXR1cm5zIG9iamVjdFxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbDtcbiAgICAgICAgfSxcbiAgICAgICAgZGVzY3JpcHRpb24oa2V5KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLmRlc2NyaXB0aW9uO1xuICAgICAgICB9LFxuICAgICAgICB1bml0c0Rlc2NyaXB0aW9uKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS51bml0c19kZXNjcmlwdGlvbjtcbiAgICAgICAgfSwgICBcbiAgICAgICAgdW5pdHMoa2V5KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLnVuaXRzOyAgXG4gICAgICAgIH0sXG4gICAgICAgIHRpcFRleHQoa2V5KXtcbiAgICAgICAgICAgIHZhciBzdHIgPSB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLmxhYmVsLnJlcGxhY2UoL1xcXFxuL2csJyAnKTtcbiAgICAgICAgICAgIHJldHVybiBzdHIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHIuc2xpY2UoMSk7XG4gICAgICAgIH1cblxuICAgIH07IC8vIGVuZCBMaW5lQ2hhcnQucHJvdG90eXBlXG5cbiAgICB2YXIgTGluZUNoYXJ0ID0gZnVuY3Rpb24ocGFyZW50LCBkYXRhKXsgLy8gb25lIGNoYXJ0IGlzIGNyZWF0ZWQgZm9yIGVhY2ggZ3JvdXAgb2Ygc2VyaWVzIHRvIGJlIHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvZ2V0aGVyLiBjaGFydHMgd2l0aCB0aGUgc2FtZSBwYXJlbnQgYXJlIHJlbmRlcmVkIGluIHRoZSBzYW1lIGNoYXJ0RGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBkYXRhIGZvciBlYWNoIGNoYXJ0IGlzIGFscmVhZHkgZmlsdGVyZWQgdG8gYmUgb25seSB0aGUgc2VyaWVzIGludGVuZGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZvciB0aGF0IGNoYXJ0XG4gICAgICAgIFxuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBwYXJlbnQuY29uZmlnO1xuICAgICAgICB0aGlzLm1hcmdpblRvcCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5Ub3AgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy50b3A7XG4gICAgICAgIHRoaXMubWFyZ2luUmlnaHQgPSArdGhpcy5jb25maWcubWFyZ2luUmlnaHQgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5yaWdodDtcbiAgICAgICAgdGhpcy5tYXJnaW5Cb3R0b20gPSArdGhpcy5jb25maWcubWFyZ2luQm90dG9tIHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMuYm90dG9tO1xuICAgICAgICB0aGlzLm1hcmdpbkxlZnQgPSArdGhpcy5jb25maWcubWFyZ2luTGVmdCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLmxlZnQ7XG4gICAgICAgIHRoaXMud2lkdGggPSB0aGlzLmNvbmZpZy5zdmdXaWR0aCA/ICt0aGlzLmNvbmZpZy5zdmdXaWR0aCAtIHRoaXMubWFyZ2luUmlnaHQgLSB0aGlzLm1hcmdpbkxlZnQgOiAzMjAgLSB0aGlzLm1hcmdpblJpZ2h0IC0gdGhpcy5tYXJnaW5MZWZ0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IHRoaXMuY29uZmlnLnN2Z0hlaWdodCA/ICt0aGlzLmNvbmZpZy5zdmdIZWlnaHQgLSB0aGlzLm1hcmdpblRvcCAtIHRoaXMubWFyZ2luQm90dG9tIDogKCB0aGlzLndpZHRoICsgdGhpcy5tYXJnaW5SaWdodCArIHRoaXMubWFyZ2luTGVmdCApIC8gMiAtIHRoaXMubWFyZ2luVG9wIC0gdGhpcy5tYXJnaW5Cb3R0b207XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgICAgIHRoaXMucmVzZXRDb2xvcnMgPSB0aGlzLmNvbmZpZy5yZXNldENvbG9ycyB8fCBmYWxzZTtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSB0aGlzLmluaXQocGFyZW50LmNvbnRhaW5lcik7IC8vIFRPIERPICB0aGlzIGlzIGtpbmRhIHdlaXJkXG4gICAgICAgIHRoaXMueFNjYWxlVHlwZSA9IHRoaXMuY29uZmlnLnhTY2FsZVR5cGUgfHwgJ3RpbWUnO1xuICAgICAgICB0aGlzLnlTY2FsZVR5cGUgPSB0aGlzLmNvbmZpZy55U2NhbGVUeXBlIHx8ICdsaW5lYXInO1xuICAgICAgICB0aGlzLnhUaW1lVHlwZSA9IHRoaXMuY29uZmlnLnhUaW1lVHlwZSB8fCAnJVknO1xuICAgICAgICB0aGlzLnNjYWxlQnkgPSB0aGlzLmNvbmZpZy5zY2FsZUJ5IHx8IHRoaXMuY29uZmlnLnZhcmlhYmxlWTtcbiAgICAgICAgdGhpcy5pc0ZpcnN0UmVuZGVyID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zZXRTY2FsZXMoKTsgLy8gLy9TSE9VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFIFxuICAgICAgICB0aGlzLnNldFRvb2x0aXBzKCk7XG4gICAgICAgIHRoaXMuYWRkTGluZXMoKTtcbiAgICAgIC8vICB0aGlzLmFkZFBvaW50cygpO1xuICAgICAgICB0aGlzLmFkZFhBeGlzKCk7XG4gICAgICAgIHRoaXMuYWRkWUF4aXMoKTtcbiAgICAgICAgXG5cbiAgICAgICAgICAgICAgIFxuICAgIH07XG5cbiAgICBMaW5lQ2hhcnQucHJvdG90eXBlID0geyAvLyBlYWNoIExpbmVDaGFydCBpcyBhbiBzdmcgdGhhdCBob2xkIGdyb3VwZWQgc2VyaWVzXG4gICAgICAgIGRlZmF1bHRNYXJnaW5zOiB7XG4gICAgICAgICAgICB0b3A6MjcsXG4gICAgICAgICAgICByaWdodDo2NSxcbiAgICAgICAgICAgIGJvdHRvbToyNSxcbiAgICAgICAgICAgIGxlZnQ6MzVcbiAgICAgICAgfSxcbiAgICAgICAgICAgICAgXG4gICAgICAgIGluaXQoY2hhcnREaXYpeyAvLyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgdGhpcyBpcyBjYWxsZWQgb25jZSBmb3IgZWFjaCBzZXJpZXNHcm91cCBvZiBlYWNoIGNhdGVnb3J5LiBcbiAgICAgICAgICAgIEQzQ2hhcnRzLmNvbGxlY3RBbGwucHVzaCh0aGlzKTsgLy8gcHVzaGVzIGFsbCBjaGFydHMgb24gdGhlIHBhZ2UgdG8gb25lIGNvbGxlY3Rpb25cbiAgICAgICAgICAgIHRoaXMucGFyZW50LnBhcmVudC5jb2xsZWN0QWxsLnB1c2godGhpcyk7ICAvLyBwdXNoZXMgYWxsIGNoYXJ0cyBmcm9tIG9uZSBDaGFydEdyb3VwIHRvIHRoZSBDaGFydEdyb3VwJ3MgY29sbGVjdGlvblxuXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gIGQzLnNlbGVjdChjaGFydERpdikuc2VsZWN0KCdkaXYnKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3N2ZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2ZvY3VzYWJsZScsIGZhbHNlKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIHRoaXMud2lkdGggKyB0aGlzLm1hcmdpblJpZ2h0ICsgdGhpcy5tYXJnaW5MZWZ0IClcbiAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgdGhpcy5oZWlnaHQgICsgdGhpcy5tYXJnaW5Ub3AgKyB0aGlzLm1hcmdpbkJvdHRvbSApO1xuXG4gICAgICAgICAgICB0aGlzLnN2ZyA9IGNvbnRhaW5lci5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLGB0cmFuc2xhdGUoJHt0aGlzLm1hcmdpbkxlZnR9LCAke3RoaXMubWFyZ2luVG9wfSlgKTtcblxuICAgICAgICAgICAgdGhpcy54QXhpc0dyb3VwID0gdGhpcy5zdmcuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgIHRoaXMueUF4aXNHcm91cCA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICB0aGlzLmFsbFNlcmllcyA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpIC8vIGllIHRoZSBncm91cCB0aGF0IHdpbGwgaG9sZCBhbGwgdGhlIHNlcmllcyBncm91cHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3BlY2lmaWVkIHRvIGJlIHJlbmRlcmVkIGluIHRoaXMgY2hhcnRcbiAgICAgICAgICAgICAgICAuY2xhc3NlZCgnYWxsLXNlcmllcycsdHJ1ZSk7XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5yZXNldENvbG9ycyApeyAgICAvLyBpZiB0aGUgZGl2J3MgZGF0YS1yZXNldC1jb2xvcnMgYXR0cmlidXRlIGlzIHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2hhcnQgd2lsbCByZW5kZXIgc2VyaWVzIGFzIGlmIGZyb20gdGhlIGJlZ2lubmluZ1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50LnNlcmllc0NvdW50ID0gMDsgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBUTyBETyA6IFRISVMgSFNPVUxEIEJFIElOIENIQVJUIFBST1RPVFlQRVxuICAgICAgICAgICAgdGhpcy5wb3RlbnRpYWxTZXJpZXMgPSB0aGlzLmFsbFNlcmllcy5zZWxlY3RBbGwoJ3BvdGVudGlhbC1zZXJpZXMnKSAvLyBwb3RlbnRpYWwgc2VyaWVzIGJjIHRoZSBzZXJpZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbWF5IG5vdCBoYXZlIGRhdGEgZm9yIHRoZSBjdXJyZW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHkgdmFyaWFibGVcbiAgICAgICAgICAgICAgICAuZGF0YSgoKSA9PiB7IC8vIGFwcGVuZCBhIGcgZm9yIHBvdGVudGlhbCBzZXJpZXMgaW4gdGhlIENoYXJ0cyBkYXRhIChzZXJpZXNHcm91cClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhFUkUgSVMgV0hFUkUgTkVTVElORyBCWSBZIFZBUklBQkxFIFdPVUxEIENPTUUgSU5UTyBQTEFZICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAvLyByZXR1cm4gdGhpcy5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gdGhpcy5jb25maWcudmFyaWFibGVZKS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGF0YTtcbiAgICAgICAgICAgICAgICB9LCBkID0+IGQua2V5KVxuICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywncG90ZW50aWFsLXNlcmllcycpO1xuXG4gICAgICAgICAgICB0aGlzLmJpbmREYXRhKCk7XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgJiYgdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgPT09IHRydWUgKXtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXBhcmVTdGFja2luZygpOyAvLyBUTyBETy4gU0VQQVJBVEUgU1RBQ0tJTkcgRlJPTSBBUkVBLiBTVEFDS0lORyBDT1VMRCBBUFBMWSBUTyBNQU5ZIENIQVJUIFRZUEVTXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb250YWluZXIubm9kZSgpO1xuICAgICAgICB9LFxuICAgICAgICBiaW5kRGF0YSgpe1xuICAgICAgICAgICAgLy8gVE8gRE8gOiBUSElTIEhTT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEVcbiAgICAgICAgICAgIHZhciB1cGRhdGUgPSB0aGlzLnBvdGVudGlhbFNlcmllcy5zZWxlY3RBbGwoJ2VhY2gtc2VyaWVzJylcbiAgICAgICAgICAgICAgICAuZGF0YShkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtkLnZhbHVlcy5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IHRoaXMuY29uZmlnLnZhcmlhYmxlWSldO1xuICAgICAgICAgICAgICAgICAgICB9LCBkID0+IGQudmFsdWVzWzBdLnNlcmllcyk7XG4gICAgICAgICAgICB1cGRhdGUuZXhpdCgpLnJlbW92ZSgpO1xuICAgICAgICAgICAgdXBkYXRlLmNsYXNzZWQoJ3VwZGF0ZScsIHRydWUpO1xuXG4gICAgICAgICAgICB0aGlzLmVhY2hTZXJpZXMgPSB1cGRhdGUuZW50ZXIoKS5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgIC5tZXJnZSh1cGRhdGUpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2VhY2gtc2VyaWVzIHNlcmllcy0nICsgdGhpcy5wYXJlbnQuc2VyaWVzQ291bnQgKyAnIGNvbG9yLScgKyB0aGlzLnBhcmVudC5zZXJpZXNDb3VudCsrICUgNDtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdlbnRlcicsIHRydWUpO1xuICAgICAgICB9LFxuICAgICAgICB1cGRhdGUodmFyaWFibGVZID0gdGhpcy5jb25maWcudmFyaWFibGVZKXtcbiAgICAgICAgICAgIHRoaXMuY29uZmlnLnZhcmlhYmxlWSA9IHZhcmlhYmxlWTtcbiAgICAgICAgICAgIHRoaXMucHJlcGFyZVN0YWNraW5nKCk7XG4gICAgICAgICAgICB0aGlzLnNldFNjYWxlcygpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVMaW5lcygpO1xuXG4gICAgICAgIH0sXG4gICAgICAgIHByZXBhcmVTdGFja2luZygpeyAvLyBUTyBETy4gU0VQQVJBVEUgU1RBQ0tJTkcgRlJPTSBBUkVBLiBTVEFDS0lORyBDT1VMRCBBUFBMWSBUTyBNQU5ZIENIQVJUIFRZUEVTXG4gICAgICAgICAgICB2YXIgZm9yU3RhY2tpbmcgPSB0aGlzLmRhdGEucmVkdWNlKChhY2MsY3VyLGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmICggaSA9PT0gMCApe1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VyLnZhbHVlcy5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjYy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW3RoaXMuY29uZmlnLnZhcmlhYmxlWF06IGVhY2hbdGhpcy5jb25maWcudmFyaWFibGVYXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW2N1ci5rZXldOiBlYWNoW3RoaXMuY29uZmlnLnZhcmlhYmxlWV1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VyLnZhbHVlcy5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjYy5maW5kKG9iaiA9PiBvYmpbdGhpcy5jb25maWcudmFyaWFibGVYXSA9PT0gZWFjaFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKVtjdXIua2V5XSA9IGVhY2hbdGhpcy5jb25maWcudmFyaWFibGVZXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgfSxbXSk7XG5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLnN0YWNrID0gZDMuc3RhY2soKVxuICAgICAgICAgICAgICAgICAgICAua2V5cyh0aGlzLmRhdGEubWFwKGVhY2ggPT4gZWFjaC5rZXkpKVxuICAgICAgICAgICAgICAgICAgICAub3JkZXIoZDMuc3RhY2tPcmRlck5vbmUpXG4gICAgICAgICAgICAgICAgICAgIC5vZmZzZXQoZDMuc3RhY2tPZmZzZXROb25lKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLnN0YWNrRGF0YSA9IHRoaXMuc3RhY2soZm9yU3RhY2tpbmcpO1xuICAgICAgICB9LFxuICAgICAgICBzZXRTY2FsZXMoKXsgLy9TSE9VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFIC8vIFRPIERPOiBTRVQgU0NBTEVTIEZPUiBPVEhFUiBHUk9VUCBUWVBFU1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgZDNTY2FsZSA9IHtcbiAgICAgICAgICAgICAgICB0aW1lOiBkMy5zY2FsZVRpbWUoKSxcbiAgICAgICAgICAgICAgICBsaW5lYXI6IGQzLnNjYWxlTGluZWFyKClcbiAgICAgICAgICAgICAgICAvLyBUTyBETzogYWRkIGFsbCBzY2FsZSB0eXBlcy5cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgeE1heGVzID0gW10sIHhNaW5zID0gW10sIHlNYXhlcyA9IFtdLCB5TWlucyA9IFtdO1xuXG4gICAgICAgICAgICB2YXIgeVZhcmlhYmxlcyA9IEFycmF5LmlzQXJyYXkodGhpcy5zY2FsZUJ5KSA/IHRoaXMuc2NhbGVCeSA6IEFycmF5LmlzQXJyYXkodGhpcy5jb25maWcudmFyaWFibGVZKSA/IHRoaXMuY29uZmlnLnZhcmlhYmxlWSA6IFt0aGlzLmNvbmZpZy52YXJpYWJsZVldO1xuXG4gICAgICAgICAgICBcblxuICAgICAgICAgICAgdGhpcy5kYXRhLmZvckVhY2goZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgeE1heGVzLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldLngubWF4KTtcbiAgICAgICAgICAgICAgICB4TWlucy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XS54Lm1pbik7XG4gICAgICAgICAgICAgICAgeVZhcmlhYmxlcy5mb3JFYWNoKHlWYXIgPT4ge1xuICAgICAgICAgICAgICAgICAgICB5TWF4ZXMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzBdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1beVZhcl0ueS5tYXgpO1xuICAgICAgICAgICAgICAgICAgICB5TWlucy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMF1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt5VmFyXS55Lm1pbik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy54TWF4ID0gZDMubWF4KHhNYXhlcyk7XG4gICAgICAgICAgICB0aGlzLnhNaW4gPSBkMy5tYXgoeE1pbnMpO1xuICAgICAgICAgICAgdGhpcy55TWF4ID0gZDMubWF4KHlNYXhlcyk7XG4gICAgICAgICAgICB0aGlzLnlNaW4gPSBkMy5taW4oeU1pbnMpO1xuICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlID0gW107XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgJiYgdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgPT09IHRydWUgKXtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgeVZhbHVlcyA9IHRoaXMuc3RhY2tEYXRhLnJlZHVjZSgoYWNjLCBjdXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGFjYy5wdXNoKC4uLmN1ci5yZWR1Y2UoKGFjYzEsIGN1cjEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjYzEucHVzaChjdXIxWzBdLCBjdXIxWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2MxO1xuICAgICAgICAgICAgICAgICAgICB9LFtdKSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgfSxbXSk7XG4gICAgICAgICAgICAgICAgdGhpcy55TWF4ID0gZDMubWF4KHlWYWx1ZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMueU1pbiA9IGQzLm1pbih5VmFsdWVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB4UmFuZ2UgPSBbMCwgdGhpcy53aWR0aF0sXG4gICAgICAgICAgICAgICAgeVJhbmdlID0gW3RoaXMuaGVpZ2h0LCAwXSxcbiAgICAgICAgICAgICAgICB4RG9tYWluLFxuICAgICAgICAgICAgICAgIHlEb21haW47XG4gICAgICAgICAgICBpZiAoIHRoaXMueFNjYWxlVHlwZSA9PT0gJ3RpbWUnKSB7XG4gICAgICAgICAgICAgICAgeERvbWFpbiA9IFtkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKHRoaXMueE1pbiksIGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkodGhpcy54TWF4KV07XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBUTyBETzogT1RIRVIgZGF0YSB0eXBlcyA/XG4gICAgICAgICAgICAgICAgeERvbWFpbiA9IFt0aGlzLnhNaW4sIHRoaXMueE1heF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIHRoaXMueVNjYWxlVHlwZSA9PT0gJ3RpbWUnKSB7XG4gICAgICAgICAgICAgICAgeURvbWFpbiA9IFtkMy50aW1lUGFyc2UodGhpcy55VGltZVR5cGUpKHRoaXMueU1pbiksIGQzLnRpbWVQYXJzZSh0aGlzLnlUaW1lVHlwZSkodGhpcy55TWF4KV07XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBUTyBETzogT1RIRVIgZGF0YSB0eXBlcyA/XG4gICAgICAgICAgICAgICAgeURvbWFpbiA9IFt0aGlzLnlNaW4sIHRoaXMueU1heF07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMueFNjYWxlID0gZDNTY2FsZVt0aGlzLnhTY2FsZVR5cGVdLmRvbWFpbih4RG9tYWluKS5yYW5nZSh4UmFuZ2UpO1xuICAgICAgICAgICAgdGhpcy55U2NhbGUgPSBkM1NjYWxlW3RoaXMueVNjYWxlVHlwZV0uZG9tYWluKHlEb21haW4pLnJhbmdlKHlSYW5nZSk7XG5cblxuICAgICAgICB9LFxuICAgICAgICBhZGRMaW5lcygpe1xuICAgICAgICAgICAgdmFyIHplcm9WYWx1ZWxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAueChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnhWYWx1ZXNVbmlxdWUuaW5kZXhPZihkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pID09PSAtMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlLnB1c2goZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKTtcbiAgICAgICAgICAgICAgICB9KSBcbiAgICAgICAgICAgICAgICAueSgoKSA9PiB0aGlzLnlTY2FsZSgwKSk7XG5cbiAgICAgICAgICAgIHRoaXMubGluZXMgPSB0aGlzLmVhY2hTZXJpZXMuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCdsaW5lJylcbiAgICAgICAgICAgICAgICAuYXR0cignZCcsIChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB6ZXJvVmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy51cGRhdGVMaW5lcygpO1xuICAgICAgICAgIC8qICB2YXIgdmFsdWVsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgLngoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdGhpcy54VmFsdWVzVW5pcXVlLmluZGV4T2YoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSA9PT0gLTEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMueFZhbHVlc1VuaXF1ZS5wdXNoKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSk7XG4gICAgICAgICAgICAgICAgfSkgXG4gICAgICAgICAgICAgICAgLnkoKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnlTY2FsZShkLnZhbHVlKTtcbiAgICAgICAgICAgICAgICB9KTsqL1xuICAgICAgICAgIC8vIFRPIERPIDogQUREIEJBQ0sgSU4gU1RBQ0tFRCBTRVJJRVMgIFxuICAgICAgICAgICAvKiBpZiAoIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzICYmIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzID09PSB0cnVlICl7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIGFyZWEgPSBkMy5hcmVhKClcbiAgICAgICAgICAgICAgICAgICAgLngoZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGQuZGF0YVt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSkpXG4gICAgICAgICAgICAgICAgICAgIC55MChkID0+IHRoaXMueVNjYWxlKGRbMF0pKVxuICAgICAgICAgICAgICAgICAgICAueTEoZCA9PiB0aGlzLnlTY2FsZShkWzFdKSk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbGluZSA9IGQzLmxpbmUoKVxuICAgICAgICAgICAgICAgICAgICAueChkID0+IHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZC5kYXRhW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKSlcbiAgICAgICAgICAgICAgICAgICAgLnkoZCA9PiB0aGlzLnlTY2FsZShkWzFdKSk7XG5cbiAgICAgICAgICAgICAgICB2YXIgc3RhY2tHcm91cCA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdzdGFja2VkLWFyZWEnKTtcbiAgICAgICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICBzdGFja0dyb3VwICAgIFxuICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzdGFja2VkLWFyZWEnKVxuICAgICAgICAgICAgICAgICAgICAuZGF0YSh0aGlzLnN0YWNrRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJykgLy8gVE8gRE86IGFkZCB6ZXJvLWxpbmUgZXF1aXZhbGVudCBhbmQgbG9naWMgZm9yIHRyYW5zaXRpb24gb24gdXBkYXRlXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsIChkLGkpID0+ICdhcmVhLWxpbmUgY29sb3ItJyArIGkpIC8vIFRPIERPIG5vdCBxdWl0ZSByaWdodCB0aGF0IGNvbG9yIHNob2xkIGJlIGBpYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHlvdSBoYXZlIG1vcmUgdGhhbiBvbmUgZ3JvdXAgb2Ygc2VyaWVzLCB3aWxsIHJlcGVhdFxuICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGQgPT4gYXJlYShkKSk7XG5cbiAgICAgICAgICAgICAgICBzdGFja0dyb3VwXG4gICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3N0YWNrZWQtbGluZScpIC8vIFRPIERPOiBhZGQgemVyby1saW5lIGVxdWl2YWxlbnQgYW5kIGxvZ2ljIGZvciB0cmFuc2l0aW9uIG9uIHVwZGF0ZVxuICAgICAgICAgICAgICAgICAgICAuZGF0YSh0aGlzLnN0YWNrRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKGQsaSkgPT4gJ2xpbmUgY29sb3ItJyArIGkpIFxuICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGQgPT4gbGluZShkKSk7XG5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0gZWxzZSB7IFxuICAgICAgICAgICAgICAgIGlmICggdGhpcy5pc0ZpcnN0UmVuZGVyICl7ICovXG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgIC8qIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKS5kZWxheSgxNTApXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qLm9uKCdlbmQnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpID09PSBhcnJheS5sZW5ndGggLSAxICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZFBvaW50cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZExhYmVscygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pOyovICAgXG4gICAgICAgICAgICAgICAvKiB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3RBbGwodGhpcy5saW5lcy5ub2RlcygpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVhY2goKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggaXNOYU4oZC52YWx1ZXNbMF1bdGhpcy5jb25maWcudmFyaWFibGVZXSkgKXsgLy8gdGhpcyBhIHdvcmthcm91bmQgZm9yIGhhbmRsaW5nIE5Bc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd291bGQgYmUgbmljZXIgdG8gaGFuZGxlIHZpYSBleGl0KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ1dCBtYXkgYmUgaGFyZCBiYyBvZiBob3cgZGF0YSBpc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RydWN0dXJlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAub24oJ2VuZCcsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkaXNwbGF5LW5vbmUnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2xhc3NlZCgnZGlzcGxheS1ub25lJywgZmFsc2UpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLDEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3RBbGwodGhpcy5wb2ludHMubm9kZXMoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5lYWNoKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGlzTmFOKGRbdGhpcy5jb25maWcudmFyaWFibGVZXSkgKXsgLy8gdGhpcyBhIHdvcmthcm91bmQgZm9yIGhhbmRsaW5nIE5Bc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd291bGQgYmUgbmljZXIgdG8gaGFuZGxlIHZpYSBleGl0KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ1dCBtYXkgYmUgaGFyZCBiYyBvZiBob3cgZGF0YSBpc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RydWN0dXJlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAub24oJ2VuZCcsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkaXNwbGF5LW5vbmUnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkaXNwbGF5LW5vbmUnLCBmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywxKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2N4JywgZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2N5JywgZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueVNjYWxlKGRbdGhpcy5jb25maWcudmFyaWFibGVZXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdEFsbCh0aGlzLmxhYmVsR3JvdXBzLm5vZGVzKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZWFjaCgoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxhYmVsR3JvdXAgPSBkMy5zZWxlY3QoYXJyYXlbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggaXNOYU4oZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdGhpcy5jb25maWcudmFyaWFibGVZXSkgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbEdyb3VwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zdHlsZSgnb3BhY2l0eScsMClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vbignZW5kJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbEdyb3VwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkaXNwbGF5LW5vbmUnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbEdyb3VwLnNlbGVjdCgnLmhhcy10b29sdGlwJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywgLTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsR3JvdXBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkaXNwbGF5LW5vbmUnLCBmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywxKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIChkKSA9PiBgdHJhbnNsYXRlKCR7dGhpcy53aWR0aCArIDh9LCAke3RoaXMueVNjYWxlKGQudmFsdWVzW2QudmFsdWVzLmxlbmd0aCAtIDFdW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pICsgM30pYCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWxHcm91cC5zZWxlY3QoJy5oYXMtdG9vbHRpcCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0QWxsKHRoaXMubGFiZWxzLm5vZGVzKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd5JywgMClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignZW5kJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpID09PSBhcnJheS5sZW5ndGggLSAxICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVsYXhMYWJlbHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0QWxsKHRoaXMueUF4aXNHcm91cC5ub2RlcygpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzTGVmdCh0aGlzLnlTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDUpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdlbmQnLChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnLnRpY2snKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVhY2goKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ3plcm8nLCAoIGQgPT09IDAgJiYgaSAhPT0gMCAmJiB0aGlzLnlNaW4gPCAwICkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSw1MCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9Ki9cbiAgICAgICAgfSxcbiAgICAgICAgdXBkYXRlTGluZXMoKXtcbiAgICAgICAgICAgIHZhciB2YWx1ZWxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAueChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnhWYWx1ZXNVbmlxdWUuaW5kZXhPZihkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pID09PSAtMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlLnB1c2goZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKTtcbiAgICAgICAgICAgICAgICB9KSBcbiAgICAgICAgICAgICAgICAueSgoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueVNjYWxlKGQudmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmxpbmVzLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApLmRlbGF5KDE1MClcbiAgICAgICAgICAgICAgICAuYXR0cignZCcsIChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBhZGRYQXhpcygpeyAvLyBjb3VsZCBiZSBpbiBDaGFydCBwcm90b3R5cGUgP1xuICAgICAgICAgICAgdmFyIHhBeGlzUG9zaXRpb24sXG4gICAgICAgICAgICAgICAgeEF4aXNPZmZzZXQsXG4gICAgICAgICAgICAgICAgYXhpc1R5cGU7XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5jb25maWcueEF4aXNQb3NpdGlvbiA9PT0gJ3RvcCcgKXtcbiAgICAgICAgICAgICAgICB4QXhpc1Bvc2l0aW9uID0gdGhpcy55TWF4O1xuICAgICAgICAgICAgICAgIHhBeGlzT2Zmc2V0ID0gLXRoaXMubWFyZ2luVG9wO1xuICAgICAgICAgICAgICAgIGF4aXNUeXBlID0gZDMuYXhpc1RvcDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgeEF4aXNQb3NpdGlvbiA9IHRoaXMueU1pbjtcbiAgICAgICAgICAgICAgICB4QXhpc09mZnNldCA9IHRoaXMubWFyZ2luQm90dG9tIC0gMTU7XG4gICAgICAgICAgICAgICAgYXhpc1R5cGUgPSBkMy5heGlzQm90dG9tO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGF4aXMgPSBheGlzVHlwZSh0aGlzLnhTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnhTY2FsZVR5cGUgPT09ICd0aW1lJyApe1xuICAgICAgICAgICAgICAgIGF4aXMudGlja1ZhbHVlcyh0aGlzLnhWYWx1ZXNVbmlxdWUubWFwKGVhY2ggPT4gZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShlYWNoKSkpOyAvLyBUTyBETzogYWxsb3cgZm9yIG90aGVyIHhBeGlzIEFkanVzdG1lbnRzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnhBeGlzR3JvdXBcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLCcgKyAoIHRoaXMueVNjYWxlKHhBeGlzUG9zaXRpb24pICsgeEF4aXNPZmZzZXQgKSArICcpJykgLy8gbm90IHByb2dyYW1hdGljIHBsYWNlbWVudCBvZiB4LWF4aXNcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgIC5jYWxsKGF4aXMpO1xuICAgICAgICB9LFxuICAgICAgICBhZGRZQXhpcygpe1xuICAgICAgICAgICAgLyogYXhpcyAqL1xuICAgICAgICAgICAgdGhpcy55QXhpc0dyb3VwXG4gICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+ICdheGlzIHktYXhpcyAnKVxuICAgICAgICAgICAgICAuY2FsbChkMy5heGlzTGVmdCh0aGlzLnlTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDUpKTtcblxuICAgICAgICAgICAgdGhpcy55QXhpc0dyb3VwXG4gICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnLnRpY2snKVxuICAgICAgICAgICAgICAgIC5lYWNoKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ3plcm8nLCAoIGQgPT09IDAgJiYgaSAhPT0gMCAmJiB0aGlzLnlNaW4gPCAwICkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG5cblxuICAgICAgICAgICAgLyogbGFiZWxzICovXG5cbiAgICAgICAgICAgIHZhciB1bml0c0xhYmVscyA9IHRoaXMuYWxsU2VyaWVzLnNlbGVjdCgnLmVhY2gtc2VyaWVzJylcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdhJylcbiAgICAgICAgICAgICAgICAuYXR0cigneGxpbms6aHJlZicsICcjJylcbiAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLCAtMSlcbiAgICAgICAgICAgICAgICAuYXR0cignZm9jdXNhYmxlJywgZmFsc2UpXG4gICAgICAgICAgICAgICAgLm9uKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZDMuZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICd1bml0cycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICgpID0+IGB0cmFuc2xhdGUoLSR7dGhpcy5tYXJnaW5MZWZ0IC01IH0sLSR7dGhpcy5tYXJnaW5Ub3AgLSAxNH0pYClcbiAgICAgICAgICAgICAgICAuaHRtbCgoZCxpKSA9PiBpID09PSAwID8gdGhpcy5wYXJlbnQudW5pdHMoZC52YWx1ZXNbMF0uc2VyaWVzKSA6IG51bGwpO1xuXG4gICAgICAgICAgICB2YXIgbGFiZWxUb29sdGlwID0gZDMudGlwKClcbiAgICAgICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwiZDMtdGlwIGxhYmVsLXRpcFwiKVxuICAgICAgICAgICAgICAgIC5kaXJlY3Rpb24oJ2UnKVxuICAgICAgICAgICAgICAgIC5vZmZzZXQoWy0yLCA0XSk7XG4gICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG1vdXNlb3ZlcihkKXtcbiAgICAgICAgICAgICAgICBpZiAoIHdpbmRvdy5vcGVuVG9vbHRpcCApIHtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwLmhpZGUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGFiZWxUb29sdGlwLmh0bWwodGhpcy5wYXJlbnQudW5pdHNEZXNjcmlwdGlvbihkLnZhbHVlc1swXS5zZXJpZXMpKTtcbiAgICAgICAgICAgICAgICBsYWJlbFRvb2x0aXAuc2hvdygpO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcCA9IGxhYmVsVG9vbHRpcDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdW5pdHNMYWJlbHMuZWFjaCgoZCwgaSwgYXJyYXkpID0+IHsgLy8gVE8gRE8gdGhpcyBpcyByZXBldGl0aXZlIG9mIGFkZExhYmVscygpXG4gICAgICAgICAgICAgICAgaWYgKCB0aGlzLnBhcmVudC51bml0c0Rlc2NyaXB0aW9uKGQudmFsdWVzWzBdLnNlcmllcykgIT09IHVuZGVmaW5lZCAmJiBkMy5zZWxlY3QoYXJyYXlbaV0pLmh0bWwoKSAhPT0gJycpe1xuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QoYXJyYXlbaV0ucGFyZW50Tm9kZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0YWJpbmRleCcsMClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdmb2N1c2FibGUnLHRydWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2xhc3NlZCgnaGFzLXRvb2x0aXAnLCB0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdtb3VzZW92ZXInLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXlbaV0uZm9jdXMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAub24oJ2ZvY3VzJywgZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW91c2VvdmVyLmNhbGwodGhpcyxkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAub24oJ21vdXNlb3V0JywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5W2ldLmJsdXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAub24oJ2JsdXInLCBsYWJlbFRvb2x0aXAuaGlkZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsKGxhYmVsVG9vbHRpcCk7ICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAuaHRtbChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkMy5zZWxlY3QodGhpcykuaHRtbCgpICsgJzx0c3BhbiBkeT1cIi0wLjRlbVwiIGR4PVwiMC4yZW1cIiBjbGFzcz1cImluZm8tbWFya1wiPj88L3RzcGFuPic7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICBcbiAgICAgICAgfSxcbiAgICAgICAgYWRkTGFiZWxzKCl7XG5cbiAgICAgICAgICAgIHZhciBsYWJlbFRvb2x0aXAgPSBkMy50aXAoKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJkMy10aXAgbGFiZWwtdGlwXCIpXG4gICAgICAgICAgICAgICAgLmRpcmVjdGlvbignbicpXG4gICAgICAgICAgICAgICAgLm9mZnNldChbLTQsIDEyXSk7XG4gICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG1vdXNlb3ZlcihkKXtcbiAgICAgICAgICAgICAgICBpZiAoIHdpbmRvdy5vcGVuVG9vbHRpcCApIHtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwLmhpZGUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGFiZWxUb29sdGlwLmh0bWwodGhpcy5wYXJlbnQuZGVzY3JpcHRpb24oZC5rZXkpKTtcbiAgICAgICAgICAgICAgICBsYWJlbFRvb2x0aXAuc2hvdygpO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcCA9IGxhYmVsVG9vbHRpcDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5sYWJlbEdyb3VwcyA9IHRoaXMuZWFjaFNlcmllc1xuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ2cnKTtcblxuICAgICAgICAgICAgdGhpcy5sYWJlbHMgPSB0aGlzLmxhYmVsR3JvdXBzXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYHRyYW5zbGF0ZSgke3RoaXMud2lkdGggKyA4fSwgJHt0aGlzLnlTY2FsZShkLnZhbHVlc1tkLnZhbHVlcy5sZW5ndGggLSAxXS52YWx1ZSkgKyAzfSlgO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgnYScpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RpdGxlJywnY2xpY2sgdG8gYnJpbmcgdG8gZnJvbnQnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd4bGluazpocmVmJywnIycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywtMSlcbiAgICAgICAgICAgICAgICAuYXR0cignZm9jdXNhYmxlJyxmYWxzZSlcbiAgICAgICAgICAgICAgICAuYXR0cigneScsIDApXG4gICAgICAgICAgICAgICAgLm9uKCdjbGljaycsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZDMuZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5icmluZ1RvVG9wLmNhbGwoYXJyYXlbaV0ucGFyZW50Tm9kZSk7IFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgndGV4dCcpIFxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdzZXJpZXMtbGFiZWwnKVxuICAgICAgICAgICAgICAgIC5odG1sKChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJzx0c3BhbiB4PVwiMFwiPicgKyB0aGlzLnBhcmVudC5sYWJlbChkLnZhbHVlc1swXS5zZXJpZXMpLnJlcGxhY2UoL1xcXFxuL2csJzwvdHNwYW4+PHRzcGFuIHg9XCIwLjVlbVwiIGR5PVwiMS4yZW1cIj4nKSArICc8L3RzcGFuPic7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMubGFiZWxzLmVhY2goKGQsIGksIGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCB0aGlzLnBhcmVudC5kZXNjcmlwdGlvbihkLmtleSkgIT09IHVuZGVmaW5lZCAmJiB0aGlzLnBhcmVudC5kZXNjcmlwdGlvbihkLmtleSkgIT09ICcnKXtcbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldLnBhcmVudE5vZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZm9jdXNhYmxlJyx0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2hhcy10b29sdGlwJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5W2ldLmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsIGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vdXNlb3Zlci5jYWxsKHRoaXMsZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5ibHVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdibHVyJywgbGFiZWxUb29sdGlwLmhpZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChsYWJlbFRvb2x0aXApO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5odG1sKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQzLnNlbGVjdCh0aGlzKS5odG1sKCkgKyAnPHRzcGFuIGR5PVwiLTAuNGVtXCIgZHg9XCIwLjJlbVwiIGNsYXNzPVwiaW5mby1tYXJrXCI+PzwvdHNwYW4+JzsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuaXNGaXJzdFJlbmRlciA9IGZhbHNlO1xuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIHRoaXMucmVsYXhMYWJlbHMoKTtcbiAgICAgICAgICAgXG4gICAgICAgICAgIFxuICAgICAgICB9LFxuICAgICAgICByZWxheExhYmVscygpeyAvLyBIVCBodHRwOi8vanNmaWRkbGUubmV0L3RodWRmYWN0b3IvQjJXQlUvIGFkYXB0ZWQgdGVjaG5pcXVlXG4gICAgICAgICAgICB2YXIgYWxwaGEgPSAxLFxuICAgICAgICAgICAgICAgIHNwYWNpbmcgPSAwLFxuICAgICAgICAgICAgICAgIGFnYWluID0gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMubGFiZWxzLmVhY2goKGQsaSxhcnJheTEpID0+IHtcblxuICAgICAgICAgICAgICAgIHZhciBhID0gYXJyYXkxW2ldLFxuICAgICAgICAgICAgICAgICAgICAkYSA9IGQzLnNlbGVjdChhKSxcbiAgICAgICAgICAgICAgICAgICAgeUEgPSAkYS5hdHRyKCd5JyksXG4gICAgICAgICAgICAgICAgICAgIGFSYW5nZSA9IGQzLnJhbmdlKE1hdGgucm91bmQoYS5nZXRDVE0oKS5mKSAtIHNwYWNpbmcgKyBwYXJzZUludCh5QSksIE1hdGgucm91bmQoYS5nZXRDVE0oKS5mKSArIE1hdGgucm91bmQoYS5nZXRCQm94KCkuaGVpZ2h0KSArIDEgKyBzcGFjaW5nICsgcGFyc2VJbnQoeUEpKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubGFiZWxzLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGIgPSB0aGlzLFxuICAgICAgICAgICAgICAgICAgICAkYiA9IGQzLnNlbGVjdChiKSxcbiAgICAgICAgICAgICAgICAgICAgeUIgPSAkYi5hdHRyKCd5Jyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICggYSA9PT0gYiApIHtyZXR1cm47fVxuICAgICAgICAgICAgICAgICAgICB2YXIgYkxpbWl0cyA9IFtNYXRoLnJvdW5kKGIuZ2V0Q1RNKCkuZikgLSBzcGFjaW5nICsgcGFyc2VJbnQoeUIpLCBNYXRoLnJvdW5kKGIuZ2V0Q1RNKCkuZikgKyBiLmdldEJCb3goKS5oZWlnaHQgKyBzcGFjaW5nICsgcGFyc2VJbnQoeUIpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCAoYVJhbmdlWzBdIDwgYkxpbWl0c1swXSAmJiBhUmFuZ2VbYVJhbmdlLmxlbmd0aCAtIDFdIDwgYkxpbWl0c1swXSkgfHwgKGFSYW5nZVswXSA+IGJMaW1pdHNbMV0gJiYgYVJhbmdlW2FSYW5nZS5sZW5ndGggLSAxXSA+IGJMaW1pdHNbMV0pICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCdubyBjb2xsaXNpb24nLCBhLCBiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfSAvLyBubyBjb2xsaXNvblxuICAgICAgICAgICAgICAgICAgICB2YXIgc2lnbiA9IGJMaW1pdHNbMF0gLSBhUmFuZ2VbYVJhbmdlLmxlbmd0aCAtIDFdIDw9IGFSYW5nZVswXSAtIGJMaW1pdHNbMV0gPyAxIDogLTEsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGp1c3QgPSBzaWduICogYWxwaGE7XG4gICAgICAgICAgICAgICAgICAgICRiLmF0dHIoJ3knLCAoK3lCIC0gYWRqdXN0KSApO1xuICAgICAgICAgICAgICAgICAgICAkYS5hdHRyKCd5JywgKCt5QSArIGFkanVzdCkgKTtcbiAgICAgICAgICAgICAgICAgICAgYWdhaW4gPSB0cnVlOyBcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIGkgPT09IGFycmF5MS5sZW5ndGggLSAxICYmIGFnYWluID09PSB0cnVlICkge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVsYXhMYWJlbHMoKTtcbiAgICAgICAgICAgICAgICAgICAgfSwyMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGFkZFBvaW50cygpe1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmdW5jdGlvbiBtb3VzZW92ZXIoZCxpLGFycmF5KXtcbiAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoIHdpbmRvdy5vcGVuVG9vbHRpcCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcC5oaWRlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdmFyIGtsYXNzID0gZDMuc2VsZWN0KGFycmF5W2ldLnBhcmVudE5vZGUpLmF0dHIoJ2NsYXNzJykubWF0Y2goL2NvbG9yLVxcZC8pWzBdOyAvLyBnZXQgdGhlIGNvbG9yIGNsYXNzIG9mIHRoZSBwYXJlbnQgZ1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJywgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJykgKyAnICcgKyBrbGFzcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJlZml4ID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3VmZml4ID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50LnVuaXRzKGQuc2VyaWVzKSAmJiB0aGlzLnBhcmVudC51bml0cyhkLnNlcmllcylbMF0gPT09ICckJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZWZpeCA9ICckJzsgLy8gVE8gRE86ICBoYW5kbGUgb3RoZXIgcHJlZml4ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBodG1sID0gJzxzdHJvbmc+JyArIHRoaXMucGFyZW50LnRpcFRleHQoZC5zZXJpZXMpICsgJzwvc3Ryb25nPiAoJyArIGQueWVhciArICcpPGJyIC8+JyArIHByZWZpeCArIGQzLmZvcm1hdCgnLCcpKGRbdGhpcy5jb25maWcudmFyaWFibGVZXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50LnVuaXRzKGQuc2VyaWVzKSAmJiB0aGlzLnBhcmVudC51bml0cyhkLnNlcmllcykgIT09ICcnKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWZmaXggPSB0aGlzLnBhcmVudC51bml0cyhkLnNlcmllcykucmVwbGFjZSgnJCcsJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGh0bWwgKz0gJyAnICsgc3VmZml4O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGN1bSA9IHRoaXMuY29uZmlnLnZhcmlhYmxlWS5yZXBsYWNlKCdfdmFsdWUnLCdfY3VtJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGRbY3VtXSAhPT0gJycgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBodG1sICs9ICc8YnIgLz4oJyArIHByZWZpeCArIGQzLmZvcm1hdCgnLCcpKGRbY3VtXSkgKyBzdWZmaXggKyAnIGN1bXVsYXRpdmUpJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5odG1sKGh0bWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLnNob3coKTtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwID0gdGhpcy50b29sdGlwO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZnVuY3Rpb24gbW91c2VvdXQoKXtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuYXR0cignY2xhc3MnLCB0aGlzLnRvb2x0aXAuYXR0cignY2xhc3MnKS5yZXBsYWNlKC8gY29sb3ItXFxkL2csICcnKSk7XG4gICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmh0bWwoJycpO1xuICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5oaWRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnBvaW50cyA9IHRoaXMuZWFjaFNlcmllcy5zZWxlY3RBbGwoJ3BvaW50cycpXG4gICAgICAgICAgICAgICAgLmRhdGEoZCA9PiBkLnZhbHVlcywgZCA9PiBkLmtleSlcbiAgICAgICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ2NpcmNsZScpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywwKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdmb2N1c2FibGUnLCB0cnVlKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdvcGFjaXR5JywgMClcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnZGF0YS1wb2ludCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3InLCAnNCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2N4JywgZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjeScsIGQgPT4gdGhpcy55U2NhbGUoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVldKSlcbiAgICAgICAgICAgICAgICAub24oJ21vdXNlb3ZlcicsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGFycmF5W2ldLmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub24oJ2ZvY3VzJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtb3VzZW92ZXIuY2FsbCh0aGlzLGQsaSxhcnJheSk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub24oJ21vdXNlb3V0JywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5ibHVyKCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub24oJ2JsdXInLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIG1vdXNlb3V0LmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub24oJ2NsaWNrJywgdGhpcy5icmluZ1RvVG9wKVxuICAgICAgICAgICAgICAgIC5vbigna2V5dXAnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoZDMuZXZlbnQua2V5Q29kZSA9PT0gMTMgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5icmluZ1RvVG9wLmNhbGwoYXJyYXlbaV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2FsbCh0aGlzLnRvb2x0aXApXG4gICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ29wYWNpdHknLCAxKTtcbiAgICAgICAgICAgIFxuXG4gICAgICAgIH0sXG4gICAgICAgIGJyaW5nVG9Ub3AoKXtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCB0aGlzLnBhcmVudE5vZGUgIT09IHRoaXMucGFyZW50Tm9kZS5wYXJlbnROb2RlLmxhc3RDaGlsZCApe1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzLnBhcmVudE5vZGUpLm1vdmVUb0Zyb250KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5mb2N1cygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzZXRUb29sdGlwcygpe1xuXG4gICAgICAgICAgICB0aGlzLnRvb2x0aXAgPSBkMy50aXAoKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJkMy10aXBcIilcbiAgICAgICAgICAgICAgICAuZGlyZWN0aW9uKCduJylcbiAgICAgICAgICAgICAgICAub2Zmc2V0KFstOCwgMF0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgfTtcblxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgQ2hhcnREaXZcbiAgICB9O1xuXG59KSgpO1xuIiwiZXhwb3J0IGNvbnN0IEhlbHBlcnMgPSAoZnVuY3Rpb24oKXtcbiAgICAvKiBnbG9iYWxzIERPTVN0cmluZ01hcCwgZDMgKi9cbiAgICBTdHJpbmcucHJvdG90eXBlLmNsZWFuU3RyaW5nID0gZnVuY3Rpb24oKSB7IC8vIGxvd2VyY2FzZSBhbmQgcmVtb3ZlIHB1bmN0dWF0aW9uIGFuZCByZXBsYWNlIHNwYWNlcyB3aXRoIGh5cGhlbnM7IGRlbGV0ZSBwdW5jdHVhdGlvblxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9bIFxcXFxcXC9dL2csJy0nKS5yZXBsYWNlKC9bJ1wi4oCd4oCZ4oCc4oCYLFxcLiFcXD87XFwoXFwpJl0vZywnJykudG9Mb3dlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgU3RyaW5nLnByb3RvdHlwZS5yZW1vdmVVbmRlcnNjb3JlcyA9IGZ1bmN0aW9uKCkgeyBcbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvXy9nLCcgJyk7XG4gICAgfTtcblxuICAgIERPTVN0cmluZ01hcC5wcm90b3R5cGUuY29udmVydCA9IGZ1bmN0aW9uKCkgeyAvLyB3aWxsIGZhaWwgbHRlIElFMTBcbiAgICAgICAgdmFyIG5ld09iaiA9IHt9O1xuICAgICAgICBmb3IgKCB2YXIga2V5IGluIHRoaXMgKXtcbiAgICAgICAgICAgIGlmICh0aGlzLmhhc093blByb3BlcnR5KGtleSkpe1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld09ialtrZXldID0gSlNPTi5wYXJzZSh0aGlzW2tleV0pOyAvLyBpZiB0aGUgdmFsdWUgY2FuIGJlIGludGVycHJldHRlZCBhcyBKU09OLCBpdCBpc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgaXQgY2FuJ3QgaXQgaXNuJ3QgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld09ialtrZXldID0gdGhpc1trZXldOyAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3T2JqO1xuICAgIH07XG5cbiAgICBkMy5zZWxlY3Rpb24ucHJvdG90eXBlLm1vdmVUb0Zyb250ID0gZnVuY3Rpb24oKXtcbiAgICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5wYXJlbnROb2RlLmFwcGVuZENoaWxkKHRoaXMpO1xuICAgICAgICAgIH0pO1xuICAgIH07XG4gICAgZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5tb3ZlVG9CYWNrID0gZnVuY3Rpb24oKXsgXG4gICAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHZhciBmaXJzdENoaWxkID0gdGhpcy5wYXJlbnROb2RlLmZpcnN0Q2hpbGQ7XG4gICAgICAgICAgICBpZiAoIGZpcnN0Q2hpbGQgKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnROb2RlLmluc2VydEJlZm9yZSh0aGlzLCBmaXJzdENoaWxkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIGlmICh3aW5kb3cuTm9kZUxpc3QgJiYgIU5vZGVMaXN0LnByb3RvdHlwZS5mb3JFYWNoKSB7XG4gICAgICAgIE5vZGVMaXN0LnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24gKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgICAgICAgICB0aGlzQXJnID0gdGhpc0FyZyB8fCB3aW5kb3c7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHRoaXNbaV0sIGksIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGlmICghT2JqZWN0Lmhhc093blByb3BlcnR5KCdnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzJykpIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShcbiAgICAgICAgT2JqZWN0LFxuICAgICAgICAnZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycycsXG4gICAgICAgIHtcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgdmFsdWU6IGZ1bmN0aW9uIGdldE93blByb3BlcnR5RGVzY3JpcHRvcnMob2JqZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4gUmVmbGVjdC5vd25LZXlzKG9iamVjdCkucmVkdWNlKChkZXNjcmlwdG9ycywga2V5KSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkoXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRvcnMsXG4gICAgICAgICAgICAgICAga2V5LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIHZhbHVlOiBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iamVjdCwga2V5KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0sIHt9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxufSkoKTtcbiIsIi8vIGQzLnRpcFxuLy8gQ29weXJpZ2h0IChjKSAyMDEzIEp1c3RpbiBQYWxtZXJcbi8vIEVTNiAvIEQzIHY0IEFkYXB0aW9uIENvcHlyaWdodCAoYykgMjAxNiBDb25zdGFudGluIEdhdnJpbGV0ZVxuLy8gUmVtb3ZhbCBvZiBFUzYgZm9yIEQzIHY0IEFkYXB0aW9uIENvcHlyaWdodCAoYykgMjAxNiBEYXZpZCBHb3R6XG4vL1xuLy8gVG9vbHRpcHMgZm9yIGQzLmpzIFNWRyB2aXN1YWxpemF0aW9uc1xuXG5leHBvcnQgY29uc3QgZDNUaXAgPSAoZnVuY3Rpb24oKXtcbiAgZDMuZnVuY3RvciA9IGZ1bmN0aW9uIGZ1bmN0b3Iodikge1xuICAgIHJldHVybiB0eXBlb2YgdiA9PT0gXCJmdW5jdGlvblwiID8gdiA6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHY7XG4gICAgfTtcbiAgfTtcblxuICBkMy50aXAgPSBmdW5jdGlvbigpIHtcblxuICAgIHZhciBkaXJlY3Rpb24gPSBkM190aXBfZGlyZWN0aW9uLFxuICAgICAgICBvZmZzZXQgICAgPSBkM190aXBfb2Zmc2V0LFxuICAgICAgICBodG1sICAgICAgPSBkM190aXBfaHRtbCxcbiAgICAgICAgbm9kZSAgICAgID0gaW5pdE5vZGUoKSxcbiAgICAgICAgc3ZnICAgICAgID0gbnVsbCxcbiAgICAgICAgcG9pbnQgICAgID0gbnVsbCxcbiAgICAgICAgdGFyZ2V0ICAgID0gbnVsbFxuXG4gICAgZnVuY3Rpb24gdGlwKHZpcykge1xuICAgICAgc3ZnID0gZ2V0U1ZHTm9kZSh2aXMpXG4gICAgICBwb2ludCA9IHN2Zy5jcmVhdGVTVkdQb2ludCgpXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG5vZGUpXG4gICAgfVxuXG4gICAgLy8gUHVibGljIC0gc2hvdyB0aGUgdG9vbHRpcCBvbiB0aGUgc2NyZWVuXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGEgdGlwXG4gICAgdGlwLnNob3cgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxuICAgICAgaWYoYXJnc1thcmdzLmxlbmd0aCAtIDFdIGluc3RhbmNlb2YgU1ZHRWxlbWVudCkgdGFyZ2V0ID0gYXJncy5wb3AoKVxuXG4gICAgICB2YXIgY29udGVudCA9IGh0bWwuYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgcG9mZnNldCA9IG9mZnNldC5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBkaXIgICAgID0gZGlyZWN0aW9uLmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIG5vZGVsICAgPSBnZXROb2RlRWwoKSxcbiAgICAgICAgICBpICAgICAgID0gZGlyZWN0aW9ucy5sZW5ndGgsXG4gICAgICAgICAgY29vcmRzLFxuICAgICAgICAgIHNjcm9sbFRvcCAgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wIHx8IGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wLFxuICAgICAgICAgIHNjcm9sbExlZnQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdCB8fCBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnRcblxuICAgICAgbm9kZWwuaHRtbChjb250ZW50KVxuICAgICAgICAuc3R5bGUoJ3Bvc2l0aW9uJywgJ2Fic29sdXRlJylcbiAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywgMSlcbiAgICAgICAgLnN0eWxlKCdwb2ludGVyLWV2ZW50cycsICdhbGwnKVxuXG4gICAgICB3aGlsZShpLS0pIG5vZGVsLmNsYXNzZWQoZGlyZWN0aW9uc1tpXSwgZmFsc2UpXG4gICAgICBjb29yZHMgPSBkaXJlY3Rpb25fY2FsbGJhY2tzW2Rpcl0uYXBwbHkodGhpcylcbiAgICAgIG5vZGVsLmNsYXNzZWQoZGlyLCB0cnVlKVxuICAgICAgICAuc3R5bGUoJ3RvcCcsIChjb29yZHMudG9wICsgIHBvZmZzZXRbMF0pICsgc2Nyb2xsVG9wICsgJ3B4JylcbiAgICAgICAgLnN0eWxlKCdsZWZ0JywgKGNvb3Jkcy5sZWZ0ICsgcG9mZnNldFsxXSkgKyBzY3JvbGxMZWZ0ICsgJ3B4JylcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYyAtIGhpZGUgdGhlIHRvb2x0aXBcbiAgICAvL1xuICAgIC8vIFJldHVybnMgYSB0aXBcbiAgICB0aXAuaGlkZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG5vZGVsID0gZ2V0Tm9kZUVsKClcbiAgICAgIG5vZGVsXG4gICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDApXG4gICAgICAgIC5zdHlsZSgncG9pbnRlci1ldmVudHMnLCAnbm9uZScpXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBQcm94eSBhdHRyIGNhbGxzIHRvIHRoZSBkMyB0aXAgY29udGFpbmVyLiAgU2V0cyBvciBnZXRzIGF0dHJpYnV0ZSB2YWx1ZS5cbiAgICAvL1xuICAgIC8vIG4gLSBuYW1lIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAvLyB2IC0gdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3IgYXR0cmlidXRlIHZhbHVlXG4gICAgdGlwLmF0dHIgPSBmdW5jdGlvbihuLCB2KSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIgJiYgdHlwZW9mIG4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBnZXROb2RlRWwoKS5hdHRyKG4pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgYXJncyA9ICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgICAgIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUuYXR0ci5hcHBseShnZXROb2RlRWwoKSwgYXJncylcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogUHJveHkgc3R5bGUgY2FsbHMgdG8gdGhlIGQzIHRpcCBjb250YWluZXIuICBTZXRzIG9yIGdldHMgYSBzdHlsZSB2YWx1ZS5cbiAgICAvL1xuICAgIC8vIG4gLSBuYW1lIG9mIHRoZSBwcm9wZXJ0eVxuICAgIC8vIHYgLSB2YWx1ZSBvZiB0aGUgcHJvcGVydHlcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIHN0eWxlIHByb3BlcnR5IHZhbHVlXG4gICAgdGlwLnN0eWxlID0gZnVuY3Rpb24obiwgdikge1xuICAgICAgLy8gZGVidWdnZXI7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIgJiYgdHlwZW9mIG4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBnZXROb2RlRWwoKS5zdHlsZShuKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICBpZiAoYXJncy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICB2YXIgc3R5bGVzID0gYXJnc1swXTtcbiAgICAgICAgICBPYmplY3Qua2V5cyhzdHlsZXMpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5zdHlsZS5hcHBseShnZXROb2RlRWwoKSwgW2tleSwgc3R5bGVzW2tleV1dKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBTZXQgb3IgZ2V0IHRoZSBkaXJlY3Rpb24gb2YgdGhlIHRvb2x0aXBcbiAgICAvL1xuICAgIC8vIHYgLSBPbmUgb2Ygbihub3J0aCksIHMoc291dGgpLCBlKGVhc3QpLCBvciB3KHdlc3QpLCBudyhub3J0aHdlc3QpLFxuICAgIC8vICAgICBzdyhzb3V0aHdlc3QpLCBuZShub3J0aGVhc3QpIG9yIHNlKHNvdXRoZWFzdClcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIGRpcmVjdGlvblxuICAgIHRpcC5kaXJlY3Rpb24gPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkaXJlY3Rpb25cbiAgICAgIGRpcmVjdGlvbiA9IHYgPT0gbnVsbCA/IHYgOiBkMy5mdW5jdG9yKHYpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFNldHMgb3IgZ2V0cyB0aGUgb2Zmc2V0IG9mIHRoZSB0aXBcbiAgICAvL1xuICAgIC8vIHYgLSBBcnJheSBvZiBbeCwgeV0gb2Zmc2V0XG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIG9mZnNldCBvclxuICAgIHRpcC5vZmZzZXQgPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBvZmZzZXRcbiAgICAgIG9mZnNldCA9IHYgPT0gbnVsbCA/IHYgOiBkMy5mdW5jdG9yKHYpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IHNldHMgb3IgZ2V0cyB0aGUgaHRtbCB2YWx1ZSBvZiB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIFN0cmluZyB2YWx1ZSBvZiB0aGUgdGlwXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGh0bWwgdmFsdWUgb3IgdGlwXG4gICAgdGlwLmh0bWwgPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBodG1sXG4gICAgICBodG1sID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogZGVzdHJveXMgdGhlIHRvb2x0aXAgYW5kIHJlbW92ZXMgaXQgZnJvbSB0aGUgRE9NXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGEgdGlwXG4gICAgdGlwLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmKG5vZGUpIHtcbiAgICAgICAgZ2V0Tm9kZUVsKCkucmVtb3ZlKCk7XG4gICAgICAgIG5vZGUgPSBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRpcDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkM190aXBfZGlyZWN0aW9uKCkgeyByZXR1cm4gJ24nIH1cbiAgICBmdW5jdGlvbiBkM190aXBfb2Zmc2V0KCkgeyByZXR1cm4gWzAsIDBdIH1cbiAgICBmdW5jdGlvbiBkM190aXBfaHRtbCgpIHsgcmV0dXJuICcgJyB9XG5cbiAgICB2YXIgZGlyZWN0aW9uX2NhbGxiYWNrcyA9IHtcbiAgICAgIG46ICBkaXJlY3Rpb25fbixcbiAgICAgIHM6ICBkaXJlY3Rpb25fcyxcbiAgICAgIGU6ICBkaXJlY3Rpb25fZSxcbiAgICAgIHc6ICBkaXJlY3Rpb25fdyxcbiAgICAgIG53OiBkaXJlY3Rpb25fbncsXG4gICAgICBuZTogZGlyZWN0aW9uX25lLFxuICAgICAgc3c6IGRpcmVjdGlvbl9zdyxcbiAgICAgIHNlOiBkaXJlY3Rpb25fc2VcbiAgICB9O1xuXG4gICAgdmFyIGRpcmVjdGlvbnMgPSBPYmplY3Qua2V5cyhkaXJlY3Rpb25fY2FsbGJhY2tzKTtcblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9uKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubi55IC0gbm9kZS5vZmZzZXRIZWlnaHQsXG4gICAgICAgIGxlZnQ6IGJib3gubi54IC0gbm9kZS5vZmZzZXRXaWR0aCAvIDJcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fcygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LnMueSxcbiAgICAgICAgbGVmdDogYmJveC5zLnggLSBub2RlLm9mZnNldFdpZHRoIC8gMlxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9lKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guZS55IC0gbm9kZS5vZmZzZXRIZWlnaHQgLyAyLFxuICAgICAgICBsZWZ0OiBiYm94LmUueFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl93KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gudy55IC0gbm9kZS5vZmZzZXRIZWlnaHQgLyAyLFxuICAgICAgICBsZWZ0OiBiYm94LncueCAtIG5vZGUub2Zmc2V0V2lkdGhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fbncoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5udy55IC0gbm9kZS5vZmZzZXRIZWlnaHQsXG4gICAgICAgIGxlZnQ6IGJib3gubncueCAtIG5vZGUub2Zmc2V0V2lkdGhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fbmUoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5uZS55IC0gbm9kZS5vZmZzZXRIZWlnaHQsXG4gICAgICAgIGxlZnQ6IGJib3gubmUueFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9zdygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LnN3LnksXG4gICAgICAgIGxlZnQ6IGJib3guc3cueCAtIG5vZGUub2Zmc2V0V2lkdGhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fc2UoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zZS55LFxuICAgICAgICBsZWZ0OiBiYm94LmUueFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGluaXROb2RlKCkge1xuICAgICAgdmFyIG5vZGUgPSBkMy5zZWxlY3QoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpXG4gICAgICBub2RlXG4gICAgICAgIC5zdHlsZSgncG9zaXRpb24nLCAnYWJzb2x1dGUnKVxuICAgICAgICAuc3R5bGUoJ3RvcCcsIDApXG4gICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDApXG4gICAgICAgIC5zdHlsZSgncG9pbnRlci1ldmVudHMnLCAnbm9uZScpXG4gICAgICAgIC5zdHlsZSgnYm94LXNpemluZycsICdib3JkZXItYm94JylcblxuICAgICAgcmV0dXJuIG5vZGUubm9kZSgpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0U1ZHTm9kZShlbCkge1xuICAgICAgZWwgPSBlbC5ub2RlKClcbiAgICAgIGlmKGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ3N2ZycpXG4gICAgICAgIHJldHVybiBlbFxuXG4gICAgICByZXR1cm4gZWwub3duZXJTVkdFbGVtZW50XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0Tm9kZUVsKCkge1xuICAgICAgaWYobm9kZSA9PT0gbnVsbCkge1xuICAgICAgICBub2RlID0gaW5pdE5vZGUoKTtcbiAgICAgICAgLy8gcmUtYWRkIG5vZGUgdG8gRE9NXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm9kZSk7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIGQzLnNlbGVjdChub2RlKTtcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlIC0gZ2V0cyB0aGUgc2NyZWVuIGNvb3JkaW5hdGVzIG9mIGEgc2hhcGVcbiAgICAvL1xuICAgIC8vIEdpdmVuIGEgc2hhcGUgb24gdGhlIHNjcmVlbiwgd2lsbCByZXR1cm4gYW4gU1ZHUG9pbnQgZm9yIHRoZSBkaXJlY3Rpb25zXG4gICAgLy8gbihub3J0aCksIHMoc291dGgpLCBlKGVhc3QpLCB3KHdlc3QpLCBuZShub3J0aGVhc3QpLCBzZShzb3V0aGVhc3QpLCBudyhub3J0aHdlc3QpLFxuICAgIC8vIHN3KHNvdXRod2VzdCkuXG4gICAgLy9cbiAgICAvLyAgICArLSstK1xuICAgIC8vICAgIHwgICB8XG4gICAgLy8gICAgKyAgICtcbiAgICAvLyAgICB8ICAgfFxuICAgIC8vICAgICstKy0rXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGFuIE9iamVjdCB7biwgcywgZSwgdywgbncsIHN3LCBuZSwgc2V9XG4gICAgZnVuY3Rpb24gZ2V0U2NyZWVuQkJveCgpIHtcbiAgICAgIHZhciB0YXJnZXRlbCAgID0gdGFyZ2V0IHx8IGQzLmV2ZW50LnRhcmdldDtcblxuICAgICAgd2hpbGUgKCd1bmRlZmluZWQnID09PSB0eXBlb2YgdGFyZ2V0ZWwuZ2V0U2NyZWVuQ1RNICYmICd1bmRlZmluZWQnID09PSB0YXJnZXRlbC5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgdGFyZ2V0ZWwgPSB0YXJnZXRlbC5wYXJlbnROb2RlO1xuICAgICAgfVxuXG4gICAgICB2YXIgYmJveCAgICAgICA9IHt9LFxuICAgICAgICAgIG1hdHJpeCAgICAgPSB0YXJnZXRlbC5nZXRTY3JlZW5DVE0oKSxcbiAgICAgICAgICB0YmJveCAgICAgID0gdGFyZ2V0ZWwuZ2V0QkJveCgpLFxuICAgICAgICAgIHdpZHRoICAgICAgPSB0YmJveC53aWR0aCxcbiAgICAgICAgICBoZWlnaHQgICAgID0gdGJib3guaGVpZ2h0LFxuICAgICAgICAgIHggICAgICAgICAgPSB0YmJveC54LFxuICAgICAgICAgIHkgICAgICAgICAgPSB0YmJveC55XG5cbiAgICAgIHBvaW50LnggPSB4XG4gICAgICBwb2ludC55ID0geVxuICAgICAgYmJveC5udyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54ICs9IHdpZHRoXG4gICAgICBiYm94Lm5lID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnkgKz0gaGVpZ2h0XG4gICAgICBiYm94LnNlID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggLT0gd2lkdGhcbiAgICAgIGJib3guc3cgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSAtPSBoZWlnaHQgLyAyXG4gICAgICBiYm94LncgID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggKz0gd2lkdGhcbiAgICAgIGJib3guZSA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54IC09IHdpZHRoIC8gMlxuICAgICAgcG9pbnQueSAtPSBoZWlnaHQgLyAyXG4gICAgICBiYm94Lm4gPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSArPSBoZWlnaHRcbiAgICAgIGJib3gucyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG5cbiAgICAgIHJldHVybiBiYm94XG4gICAgfVxuXG4gICAgcmV0dXJuIHRpcFxuICB9O1xufSkoKTsiLCIvKipcbiAqIFNWRyBmb2N1cyBcbiAqIENvcHlyaWdodChjKSAyMDE3LCBKb2huIE9zdGVybWFuXG4gKlxuICogTUlUIExpY2Vuc2VcbiAqXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIFxuICogYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIFxuICogd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIFxuICogZm9sbG93aW5nIGNvbmRpdGlvbnM6XG5cbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgXG4gKiBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gXG4gKiBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgXG4gKiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBcbiAqIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG4gKi9cblxuIC8vIElFL0VkZ2UgKHBlcmhhcHMgb3RoZXJzKSBkb2VzIG5vdCBhbGxvdyBwcm9ncmFtbWF0aWMgZm9jdXNpbmcgb2YgU1ZHIEVsZW1lbnRzICh2aWEgYGZvY3VzKClgKS4gU2FtZSBmb3IgYGJsdXIoKWAuXG5cbiBleHBvcnQgY29uc3QgU1ZHRm9jdXMgPSAoZnVuY3Rpb24oKXtcbiAgICBpZiAoICdmb2N1cycgaW4gU1ZHRWxlbWVudC5wcm90b3R5cGUgPT09IGZhbHNlICkge1xuICAgICAgU1ZHRWxlbWVudC5wcm90b3R5cGUuZm9jdXMgPSBIVE1MRWxlbWVudC5wcm90b3R5cGUuZm9jdXM7XG4gICAgfVxuICAgIGlmICggJ2JsdXInIGluIFNWR0VsZW1lbnQucHJvdG90eXBlID09PSBmYWxzZSApIHtcbiAgICAgIFNWR0VsZW1lbnQucHJvdG90eXBlLmJsdXIgPSBIVE1MRWxlbWVudC5wcm90b3R5cGUuYmx1cjtcbiAgICB9XG4gfSkoKTtcblxuXG5cblxuLyoqXG4gKiBpbm5lckhUTUwgcHJvcGVydHkgZm9yIFNWR0VsZW1lbnRcbiAqIENvcHlyaWdodChjKSAyMDEwLCBKZWZmIFNjaGlsbGVyXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDJcbiAqXG4gKiBXb3JrcyBpbiBhIFNWRyBkb2N1bWVudCBpbiBDaHJvbWUgNissIFNhZmFyaSA1KywgRmlyZWZveCA0KyBhbmQgSUU5Ky5cbiAqIFdvcmtzIGluIGEgSFRNTDUgZG9jdW1lbnQgaW4gQ2hyb21lIDcrLCBGaXJlZm94IDQrIGFuZCBJRTkrLlxuICogRG9lcyBub3Qgd29yayBpbiBPcGVyYSBzaW5jZSBpdCBkb2Vzbid0IHN1cHBvcnQgdGhlIFNWR0VsZW1lbnQgaW50ZXJmYWNlIHlldC5cbiAqXG4gKiBJIGhhdmVuJ3QgZGVjaWRlZCBvbiB0aGUgYmVzdCBuYW1lIGZvciB0aGlzIHByb3BlcnR5IC0gdGh1cyB0aGUgZHVwbGljYXRpb24uXG4gKi9cbi8vIGVkaXRlZCBieSBKb2huIE9zdGVybWFuIHRvIGRlY2xhcmUgdGhlIHZhcmlhYmxlIGBzWE1MYCwgd2hpY2ggd2FzIHJlZmVyZW5jZWQgd2l0aG91dCBiZWluZyBkZWNsYXJlZFxuLy8gd2hpY2ggZmFpbGVkIHNpbGVudGx5IGluIGltcGxpY2l0IHN0cmljdCBtb2RlIG9mIGFuIGV4cG9ydFxuXG4vLyBtb3N0IGJyb3dzZXJzIGFsbG93IHNldHRpbmcgaW5uZXJIVE1MIG9mIHN2ZyBlbGVtZW50cyBidXQgSUUgZG9lcyBub3QgKG5vdCBhbiBIVE1MIGVsZW1lbnQpXG4vLyB0aGlzIHBvbHlmaWxsIHByb3ZpZGVzIHRoYXQuIG5lY2Vzc2FyeSBmb3IgZDMgbWV0aG9kIGAuaHRtbCgpYCBvbiBzdmcgZWxlbWVudHNcblxuZXhwb3J0IGNvbnN0IFNWR0lubmVySFRNTCA9IChmdW5jdGlvbigpIHtcbiAgdmFyIHNlcmlhbGl6ZVhNTCA9IGZ1bmN0aW9uKG5vZGUsIG91dHB1dCkge1xuICAgIHZhciBub2RlVHlwZSA9IG5vZGUubm9kZVR5cGU7XG4gICAgaWYgKG5vZGVUeXBlID09IDMpIHsgLy8gVEVYVCBub2Rlcy5cbiAgICAgIC8vIFJlcGxhY2Ugc3BlY2lhbCBYTUwgY2hhcmFjdGVycyB3aXRoIHRoZWlyIGVudGl0aWVzLlxuICAgICAgb3V0cHV0LnB1c2gobm9kZS50ZXh0Q29udGVudC5yZXBsYWNlKC8mLywgJyZhbXA7JykucmVwbGFjZSgvPC8sICcmbHQ7JykucmVwbGFjZSgnPicsICcmZ3Q7JykpO1xuICAgIH0gZWxzZSBpZiAobm9kZVR5cGUgPT0gMSkgeyAvLyBFTEVNRU5UIG5vZGVzLlxuICAgICAgLy8gU2VyaWFsaXplIEVsZW1lbnQgbm9kZXMuXG4gICAgICBvdXRwdXQucHVzaCgnPCcsIG5vZGUudGFnTmFtZSk7XG4gICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGVzKCkpIHtcbiAgICAgICAgdmFyIGF0dHJNYXAgPSBub2RlLmF0dHJpYnV0ZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhdHRyTWFwLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgdmFyIGF0dHJOb2RlID0gYXR0ck1hcC5pdGVtKGkpO1xuICAgICAgICAgIG91dHB1dC5wdXNoKCcgJywgYXR0ck5vZGUubmFtZSwgJz1cXCcnLCBhdHRyTm9kZS52YWx1ZSwgJ1xcJycpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAobm9kZS5oYXNDaGlsZE5vZGVzKCkpIHtcbiAgICAgICAgb3V0cHV0LnB1c2goJz4nKTtcbiAgICAgICAgdmFyIGNoaWxkTm9kZXMgPSBub2RlLmNoaWxkTm9kZXM7XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjaGlsZE5vZGVzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgc2VyaWFsaXplWE1MKGNoaWxkTm9kZXMuaXRlbShpKSwgb3V0cHV0KTtcbiAgICAgICAgfVxuICAgICAgICBvdXRwdXQucHVzaCgnPC8nLCBub2RlLnRhZ05hbWUsICc+Jyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXQucHVzaCgnLz4nKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5vZGVUeXBlID09IDgpIHtcbiAgICAgIC8vIFRPRE8oY29kZWRyZWFkKTogUmVwbGFjZSBzcGVjaWFsIGNoYXJhY3RlcnMgd2l0aCBYTUwgZW50aXRpZXM/XG4gICAgICBvdXRwdXQucHVzaCgnPCEtLScsIG5vZGUubm9kZVZhbHVlLCAnLS0+Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRPRE86IEhhbmRsZSBDREFUQSBub2Rlcy5cbiAgICAgIC8vIFRPRE86IEhhbmRsZSBFTlRJVFkgbm9kZXMuXG4gICAgICAvLyBUT0RPOiBIYW5kbGUgRE9DVU1FTlQgbm9kZXMuXG4gICAgICB0aHJvdyAnRXJyb3Igc2VyaWFsaXppbmcgWE1MLiBVbmhhbmRsZWQgbm9kZSBvZiB0eXBlOiAnICsgbm9kZVR5cGU7XG4gICAgfVxuICB9XG4gIC8vIFRoZSBpbm5lckhUTUwgRE9NIHByb3BlcnR5IGZvciBTVkdFbGVtZW50LlxuICBpZiAoICdpbm5lckhUTUwnIGluIFNWR0VsZW1lbnQucHJvdG90eXBlID09PSBmYWxzZSApe1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTVkdFbGVtZW50LnByb3RvdHlwZSwgJ2lubmVySFRNTCcsIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBvdXRwdXQgPSBbXTtcbiAgICAgICAgdmFyIGNoaWxkTm9kZSA9IHRoaXMuZmlyc3RDaGlsZDtcbiAgICAgICAgd2hpbGUgKGNoaWxkTm9kZSkge1xuICAgICAgICAgIHNlcmlhbGl6ZVhNTChjaGlsZE5vZGUsIG91dHB1dCk7XG4gICAgICAgICAgY2hpbGROb2RlID0gY2hpbGROb2RlLm5leHRTaWJsaW5nO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRwdXQuam9pbignJyk7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbihtYXJrdXBUZXh0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMpO1xuICAgICAgICAvLyBXaXBlIG91dCB0aGUgY3VycmVudCBjb250ZW50cyBvZiB0aGUgZWxlbWVudC5cbiAgICAgICAgd2hpbGUgKHRoaXMuZmlyc3RDaGlsZCkge1xuICAgICAgICAgIHRoaXMucmVtb3ZlQ2hpbGQodGhpcy5maXJzdENoaWxkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gUGFyc2UgdGhlIG1hcmt1cCBpbnRvIHZhbGlkIG5vZGVzLlxuICAgICAgICAgIHZhciBkWE1MID0gbmV3IERPTVBhcnNlcigpO1xuICAgICAgICAgIGRYTUwuYXN5bmMgPSBmYWxzZTtcbiAgICAgICAgICAvLyBXcmFwIHRoZSBtYXJrdXAgaW50byBhIFNWRyBub2RlIHRvIGVuc3VyZSBwYXJzaW5nIHdvcmtzLlxuICAgICAgICAgIGNvbnNvbGUubG9nKG1hcmt1cFRleHQpO1xuICAgICAgICAgIHZhciBzWE1MID0gJzxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPicgKyBtYXJrdXBUZXh0ICsgJzwvc3ZnPic7XG4gICAgICAgICAgY29uc29sZS5sb2coc1hNTCk7XG4gICAgICAgICAgdmFyIHN2Z0RvY0VsZW1lbnQgPSBkWE1MLnBhcnNlRnJvbVN0cmluZyhzWE1MLCAndGV4dC94bWwnKS5kb2N1bWVudEVsZW1lbnQ7XG5cbiAgICAgICAgICAvLyBOb3cgdGFrZSBlYWNoIG5vZGUsIGltcG9ydCBpdCBhbmQgYXBwZW5kIHRvIHRoaXMgZWxlbWVudC5cbiAgICAgICAgICB2YXIgY2hpbGROb2RlID0gc3ZnRG9jRWxlbWVudC5maXJzdENoaWxkO1xuICAgICAgICAgIHdoaWxlKGNoaWxkTm9kZSkge1xuICAgICAgICAgICAgdGhpcy5hcHBlbmRDaGlsZCh0aGlzLm93bmVyRG9jdW1lbnQuaW1wb3J0Tm9kZShjaGlsZE5vZGUsIHRydWUpKTtcbiAgICAgICAgICAgIGNoaWxkTm9kZSA9IGNoaWxkTm9kZS5uZXh0U2libGluZztcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXJyb3IgcGFyc2luZyBYTUwgc3RyaW5nJyk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBUaGUgaW5uZXJTVkcgRE9NIHByb3BlcnR5IGZvciBTVkdFbGVtZW50LlxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTVkdFbGVtZW50LnByb3RvdHlwZSwgJ2lubmVyU1ZHJywge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW5uZXJIVE1MO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24obWFya3VwVGV4dCkge1xuICAgICAgICB0aGlzLmlubmVySFRNTCA9IG1hcmt1cFRleHQ7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0pKCk7XG5cblxuLy8gaHR0cHM6Ly90YzM5LmdpdGh1Yi5pby9lY21hMjYyLyNzZWMtYXJyYXkucHJvdG90eXBlLmZpbmRcbmV4cG9ydCBjb25zdCBhcnJheUZpbmQgPSAoZnVuY3Rpb24oKXtcbiAgaWYgKCFBcnJheS5wcm90b3R5cGUuZmluZCkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShBcnJheS5wcm90b3R5cGUsICdmaW5kJywge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKHByZWRpY2F0ZSkge1xuICAgICAgIC8vIDEuIExldCBPIGJlID8gVG9PYmplY3QodGhpcyB2YWx1ZSkuXG4gICAgICAgIGlmICh0aGlzID09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInRoaXNcIiBpcyBudWxsIG9yIG5vdCBkZWZpbmVkJyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbyA9IE9iamVjdCh0aGlzKTtcblxuICAgICAgICAvLyAyLiBMZXQgbGVuIGJlID8gVG9MZW5ndGgoPyBHZXQoTywgXCJsZW5ndGhcIikpLlxuICAgICAgICB2YXIgbGVuID0gby5sZW5ndGggPj4+IDA7XG5cbiAgICAgICAgLy8gMy4gSWYgSXNDYWxsYWJsZShwcmVkaWNhdGUpIGlzIGZhbHNlLCB0aHJvdyBhIFR5cGVFcnJvciBleGNlcHRpb24uXG4gICAgICAgIGlmICh0eXBlb2YgcHJlZGljYXRlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncHJlZGljYXRlIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gNC4gSWYgdGhpc0FyZyB3YXMgc3VwcGxpZWQsIGxldCBUIGJlIHRoaXNBcmc7IGVsc2UgbGV0IFQgYmUgdW5kZWZpbmVkLlxuICAgICAgICB2YXIgdGhpc0FyZyA9IGFyZ3VtZW50c1sxXTtcblxuICAgICAgICAvLyA1LiBMZXQgayBiZSAwLlxuICAgICAgICB2YXIgayA9IDA7XG5cbiAgICAgICAgLy8gNi4gUmVwZWF0LCB3aGlsZSBrIDwgbGVuXG4gICAgICAgIHdoaWxlIChrIDwgbGVuKSB7XG4gICAgICAgICAgLy8gYS4gTGV0IFBrIGJlICEgVG9TdHJpbmcoaykuXG4gICAgICAgICAgLy8gYi4gTGV0IGtWYWx1ZSBiZSA/IEdldChPLCBQaykuXG4gICAgICAgICAgLy8gYy4gTGV0IHRlc3RSZXN1bHQgYmUgVG9Cb29sZWFuKD8gQ2FsbChwcmVkaWNhdGUsIFQsIMKrIGtWYWx1ZSwgaywgTyDCuykpLlxuICAgICAgICAgIC8vIGQuIElmIHRlc3RSZXN1bHQgaXMgdHJ1ZSwgcmV0dXJuIGtWYWx1ZS5cbiAgICAgICAgICB2YXIga1ZhbHVlID0gb1trXTtcbiAgICAgICAgICBpZiAocHJlZGljYXRlLmNhbGwodGhpc0FyZywga1ZhbHVlLCBrLCBvKSkge1xuICAgICAgICAgICAgcmV0dXJuIGtWYWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZS4gSW5jcmVhc2UgayBieSAxLlxuICAgICAgICAgIGsrKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIDcuIFJldHVybiB1bmRlZmluZWQuXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn0pKCk7IFxuXG4vLyBDb3B5cmlnaHQgKEMpIDIwMTEtMjAxMiBTb2Z0d2FyZSBMYW5ndWFnZXMgTGFiLCBWcmlqZSBVbml2ZXJzaXRlaXQgQnJ1c3NlbFxuLy8gVGhpcyBjb2RlIGlzIGR1YWwtbGljZW5zZWQgdW5kZXIgYm90aCB0aGUgQXBhY2hlIExpY2Vuc2UgYW5kIHRoZSBNUExcblxuLy8gTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbi8vIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbi8vIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuLy9cbi8vIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuLy9cbi8vIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbi8vIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbi8vIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuLy8gU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuLy8gbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG5cbi8qIFZlcnNpb246IE1QTCAxLjFcbiAqXG4gKiBUaGUgY29udGVudHMgb2YgdGhpcyBmaWxlIGFyZSBzdWJqZWN0IHRvIHRoZSBNb3ppbGxhIFB1YmxpYyBMaWNlbnNlIFZlcnNpb25cbiAqIDEuMSAodGhlIFwiTGljZW5zZVwiKTsgeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoXG4gKiB0aGUgTGljZW5zZS4gWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKiBodHRwOi8vd3d3Lm1vemlsbGEub3JnL01QTC9cbiAqXG4gKiBTb2Z0d2FyZSBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgYmFzaXMsXG4gKiBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLiBTZWUgdGhlIExpY2Vuc2VcbiAqIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHJpZ2h0cyBhbmQgbGltaXRhdGlvbnMgdW5kZXIgdGhlXG4gKiBMaWNlbnNlLlxuICpcbiAqIFRoZSBPcmlnaW5hbCBDb2RlIGlzIGEgc2hpbSBmb3IgdGhlIEVTLUhhcm1vbnkgcmVmbGVjdGlvbiBtb2R1bGVcbiAqXG4gKiBUaGUgSW5pdGlhbCBEZXZlbG9wZXIgb2YgdGhlIE9yaWdpbmFsIENvZGUgaXNcbiAqIFRvbSBWYW4gQ3V0c2VtLCBWcmlqZSBVbml2ZXJzaXRlaXQgQnJ1c3NlbC5cbiAqIFBvcnRpb25zIGNyZWF0ZWQgYnkgdGhlIEluaXRpYWwgRGV2ZWxvcGVyIGFyZSBDb3B5cmlnaHQgKEMpIDIwMTEtMjAxMlxuICogdGhlIEluaXRpYWwgRGV2ZWxvcGVyLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIENvbnRyaWJ1dG9yKHMpOlxuICpcbiAqL1xuXG4gLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gLy8gVGhpcyBmaWxlIGlzIGEgcG9seWZpbGwgZm9yIHRoZSB1cGNvbWluZyBFQ01BU2NyaXB0IFJlZmxlY3QgQVBJLFxuIC8vIGluY2x1ZGluZyBzdXBwb3J0IGZvciBQcm94aWVzLiBTZWUgdGhlIGRyYWZ0IHNwZWNpZmljYXRpb24gYXQ6XG4gLy8gaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTpyZWZsZWN0X2FwaVxuIC8vIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6ZGlyZWN0X3Byb3hpZXNcblxuIC8vIEZvciBhbiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgSGFuZGxlciBBUEksIHNlZSBoYW5kbGVycy5qcywgd2hpY2ggaW1wbGVtZW50czpcbiAvLyBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OnZpcnR1YWxfb2JqZWN0X2FwaVxuXG4gLy8gVGhpcyBpbXBsZW1lbnRhdGlvbiBzdXBlcnNlZGVzIHRoZSBlYXJsaWVyIHBvbHlmaWxsIGF0OlxuIC8vIGNvZGUuZ29vZ2xlLmNvbS9wL2VzLWxhYi9zb3VyY2UvYnJvd3NlL3RydW5rL3NyYy9wcm94aWVzL0RpcmVjdFByb3hpZXMuanNcblxuIC8vIFRoaXMgY29kZSB3YXMgdGVzdGVkIG9uIHRyYWNlbW9ua2V5IC8gRmlyZWZveCAxMlxuLy8gIChhbmQgc2hvdWxkIHJ1biBmaW5lIG9uIG9sZGVyIEZpcmVmb3ggdmVyc2lvbnMgc3RhcnRpbmcgd2l0aCBGRjQpXG4gLy8gVGhlIGNvZGUgYWxzbyB3b3JrcyBjb3JyZWN0bHkgb25cbiAvLyAgIHY4IC0taGFybW9ueV9wcm94aWVzIC0taGFybW9ueV93ZWFrbWFwcyAodjMuNi41LjEpXG5cbiAvLyBMYW5ndWFnZSBEZXBlbmRlbmNpZXM6XG4gLy8gIC0gRUNNQVNjcmlwdCA1L3N0cmljdFxuIC8vICAtIFwib2xkXCIgKGkuZS4gbm9uLWRpcmVjdCkgSGFybW9ueSBQcm94aWVzXG4gLy8gIC0gSGFybW9ueSBXZWFrTWFwc1xuIC8vIFBhdGNoZXM6XG4gLy8gIC0gT2JqZWN0LntmcmVlemUsc2VhbCxwcmV2ZW50RXh0ZW5zaW9uc31cbiAvLyAgLSBPYmplY3Que2lzRnJvemVuLGlzU2VhbGVkLGlzRXh0ZW5zaWJsZX1cbiAvLyAgLSBPYmplY3QuZ2V0UHJvdG90eXBlT2ZcbiAvLyAgLSBPYmplY3Qua2V5c1xuIC8vICAtIE9iamVjdC5wcm90b3R5cGUudmFsdWVPZlxuIC8vICAtIE9iamVjdC5wcm90b3R5cGUuaXNQcm90b3R5cGVPZlxuIC8vICAtIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdcbiAvLyAgLSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5XG4gLy8gIC0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvclxuIC8vICAtIE9iamVjdC5kZWZpbmVQcm9wZXJ0eVxuIC8vICAtIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzXG4gLy8gIC0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXNcbiAvLyAgLSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzXG4gLy8gIC0gT2JqZWN0LmdldFByb3RvdHlwZU9mXG4gLy8gIC0gT2JqZWN0LnNldFByb3RvdHlwZU9mXG4gLy8gIC0gT2JqZWN0LmFzc2lnblxuIC8vICAtIEZ1bmN0aW9uLnByb3RvdHlwZS50b1N0cmluZ1xuIC8vICAtIERhdGUucHJvdG90eXBlLnRvU3RyaW5nXG4gLy8gIC0gQXJyYXkuaXNBcnJheVxuIC8vICAtIEFycmF5LnByb3RvdHlwZS5jb25jYXRcbiAvLyAgLSBQcm94eVxuIC8vIEFkZHMgbmV3IGdsb2JhbHM6XG4gLy8gIC0gUmVmbGVjdFxuXG4gLy8gRGlyZWN0IHByb3hpZXMgY2FuIGJlIGNyZWF0ZWQgdmlhIFByb3h5KHRhcmdldCwgaGFuZGxlcilcblxuIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGNvbnN0IHJlZmxlY3QgPSAoZnVuY3Rpb24oZ2xvYmFsKXsgLy8gZnVuY3Rpb24tYXMtbW9kdWxlIHBhdHRlcm5cblwidXNlIHN0cmljdFwiO1xuIFxuLy8gPT09IERpcmVjdCBQcm94aWVzOiBJbnZhcmlhbnQgRW5mb3JjZW1lbnQgPT09XG5cbi8vIERpcmVjdCBwcm94aWVzIGJ1aWxkIG9uIG5vbi1kaXJlY3QgcHJveGllcyBieSBhdXRvbWF0aWNhbGx5IHdyYXBwaW5nXG4vLyBhbGwgdXNlci1kZWZpbmVkIHByb3h5IGhhbmRsZXJzIGluIGEgVmFsaWRhdG9yIGhhbmRsZXIgdGhhdCBjaGVja3MgYW5kXG4vLyBlbmZvcmNlcyBFUzUgaW52YXJpYW50cy5cblxuLy8gQSBkaXJlY3QgcHJveHkgaXMgYSBwcm94eSBmb3IgYW4gZXhpc3Rpbmcgb2JqZWN0IGNhbGxlZCB0aGUgdGFyZ2V0IG9iamVjdC5cblxuLy8gQSBWYWxpZGF0b3IgaGFuZGxlciBpcyBhIHdyYXBwZXIgZm9yIGEgdGFyZ2V0IHByb3h5IGhhbmRsZXIgSC5cbi8vIFRoZSBWYWxpZGF0b3IgZm9yd2FyZHMgYWxsIG9wZXJhdGlvbnMgdG8gSCwgYnV0IGFkZGl0aW9uYWxseVxuLy8gcGVyZm9ybXMgYSBudW1iZXIgb2YgaW50ZWdyaXR5IGNoZWNrcyBvbiB0aGUgcmVzdWx0cyBvZiBzb21lIHRyYXBzLFxuLy8gdG8gbWFrZSBzdXJlIEggZG9lcyBub3QgdmlvbGF0ZSB0aGUgRVM1IGludmFyaWFudHMgdy5yLnQuIG5vbi1jb25maWd1cmFibGVcbi8vIHByb3BlcnRpZXMgYW5kIG5vbi1leHRlbnNpYmxlLCBzZWFsZWQgb3IgZnJvemVuIG9iamVjdHMuXG5cbi8vIEZvciBlYWNoIHByb3BlcnR5IHRoYXQgSCBleHBvc2VzIGFzIG93biwgbm9uLWNvbmZpZ3VyYWJsZVxuLy8gKGUuZy4gYnkgcmV0dXJuaW5nIGEgZGVzY3JpcHRvciBmcm9tIGEgY2FsbCB0byBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IpXG4vLyB0aGUgVmFsaWRhdG9yIGhhbmRsZXIgZGVmaW5lcyB0aG9zZSBwcm9wZXJ0aWVzIG9uIHRoZSB0YXJnZXQgb2JqZWN0LlxuLy8gV2hlbiB0aGUgcHJveHkgYmVjb21lcyBub24tZXh0ZW5zaWJsZSwgYWxzbyBjb25maWd1cmFibGUgb3duIHByb3BlcnRpZXNcbi8vIGFyZSBjaGVja2VkIGFnYWluc3QgdGhlIHRhcmdldC5cbi8vIFdlIHdpbGwgY2FsbCBwcm9wZXJ0aWVzIHRoYXQgYXJlIGRlZmluZWQgb24gdGhlIHRhcmdldCBvYmplY3Rcbi8vIFwiZml4ZWQgcHJvcGVydGllc1wiLlxuXG4vLyBXZSB3aWxsIG5hbWUgZml4ZWQgbm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0aWVzIFwic2VhbGVkIHByb3BlcnRpZXNcIi5cbi8vIFdlIHdpbGwgbmFtZSBmaXhlZCBub24tY29uZmlndXJhYmxlIG5vbi13cml0YWJsZSBwcm9wZXJ0aWVzIFwiZnJvemVuXG4vLyBwcm9wZXJ0aWVzXCIuXG5cbi8vIFRoZSBWYWxpZGF0b3IgaGFuZGxlciB1cGhvbGRzIHRoZSBmb2xsb3dpbmcgaW52YXJpYW50cyB3LnIudC4gbm9uLWNvbmZpZ3VyYWJpbGl0eTpcbi8vIC0gZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIGNhbm5vdCByZXBvcnQgc2VhbGVkIHByb3BlcnRpZXMgYXMgbm9uLWV4aXN0ZW50XG4vLyAtIGdldE93blByb3BlcnR5RGVzY3JpcHRvciBjYW5ub3QgcmVwb3J0IGluY29tcGF0aWJsZSBjaGFuZ2VzIHRvIHRoZVxuLy8gICBhdHRyaWJ1dGVzIG9mIGEgc2VhbGVkIHByb3BlcnR5IChlLmcuIHJlcG9ydGluZyBhIG5vbi1jb25maWd1cmFibGVcbi8vICAgcHJvcGVydHkgYXMgY29uZmlndXJhYmxlLCBvciByZXBvcnRpbmcgYSBub24tY29uZmlndXJhYmxlLCBub24td3JpdGFibGVcbi8vICAgcHJvcGVydHkgYXMgd3JpdGFibGUpXG4vLyAtIGdldFByb3BlcnR5RGVzY3JpcHRvciBjYW5ub3QgcmVwb3J0IHNlYWxlZCBwcm9wZXJ0aWVzIGFzIG5vbi1leGlzdGVudFxuLy8gLSBnZXRQcm9wZXJ0eURlc2NyaXB0b3IgY2Fubm90IHJlcG9ydCBpbmNvbXBhdGlibGUgY2hhbmdlcyB0byB0aGVcbi8vICAgYXR0cmlidXRlcyBvZiBhIHNlYWxlZCBwcm9wZXJ0eS4gSXQgX2Nhbl8gcmVwb3J0IGluY29tcGF0aWJsZSBjaGFuZ2VzXG4vLyAgIHRvIHRoZSBhdHRyaWJ1dGVzIG9mIG5vbi1vd24sIGluaGVyaXRlZCBwcm9wZXJ0aWVzLlxuLy8gLSBkZWZpbmVQcm9wZXJ0eSBjYW5ub3QgbWFrZSBpbmNvbXBhdGlibGUgY2hhbmdlcyB0byB0aGUgYXR0cmlidXRlcyBvZlxuLy8gICBzZWFsZWQgcHJvcGVydGllc1xuLy8gLSBkZWxldGVQcm9wZXJ0eSBjYW5ub3QgcmVwb3J0IGEgc3VjY2Vzc2Z1bCBkZWxldGlvbiBvZiBhIHNlYWxlZCBwcm9wZXJ0eVxuLy8gLSBoYXNPd24gY2Fubm90IHJlcG9ydCBhIHNlYWxlZCBwcm9wZXJ0eSBhcyBub24tZXhpc3RlbnRcbi8vIC0gaGFzIGNhbm5vdCByZXBvcnQgYSBzZWFsZWQgcHJvcGVydHkgYXMgbm9uLWV4aXN0ZW50XG4vLyAtIGdldCBjYW5ub3QgcmVwb3J0IGluY29uc2lzdGVudCB2YWx1ZXMgZm9yIGZyb3plbiBkYXRhXG4vLyAgIHByb3BlcnRpZXMsIGFuZCBtdXN0IHJlcG9ydCB1bmRlZmluZWQgZm9yIHNlYWxlZCBhY2Nlc3NvcnMgd2l0aCBhblxuLy8gICB1bmRlZmluZWQgZ2V0dGVyXG4vLyAtIHNldCBjYW5ub3QgcmVwb3J0IGEgc3VjY2Vzc2Z1bCBhc3NpZ25tZW50IGZvciBmcm96ZW4gZGF0YVxuLy8gICBwcm9wZXJ0aWVzIG9yIHNlYWxlZCBhY2Nlc3NvcnMgd2l0aCBhbiB1bmRlZmluZWQgc2V0dGVyLlxuLy8gLSBnZXR7T3dufVByb3BlcnR5TmFtZXMgbGlzdHMgYWxsIHNlYWxlZCBwcm9wZXJ0aWVzIG9mIHRoZSB0YXJnZXQuXG4vLyAtIGtleXMgbGlzdHMgYWxsIGVudW1lcmFibGUgc2VhbGVkIHByb3BlcnRpZXMgb2YgdGhlIHRhcmdldC5cbi8vIC0gZW51bWVyYXRlIGxpc3RzIGFsbCBlbnVtZXJhYmxlIHNlYWxlZCBwcm9wZXJ0aWVzIG9mIHRoZSB0YXJnZXQuXG4vLyAtIGlmIGEgcHJvcGVydHkgb2YgYSBub24tZXh0ZW5zaWJsZSBwcm94eSBpcyByZXBvcnRlZCBhcyBub24tZXhpc3RlbnQsXG4vLyAgIHRoZW4gaXQgbXVzdCBmb3JldmVyIGJlIHJlcG9ydGVkIGFzIG5vbi1leGlzdGVudC4gVGhpcyBhcHBsaWVzIHRvXG4vLyAgIG93biBhbmQgaW5oZXJpdGVkIHByb3BlcnRpZXMgYW5kIGlzIGVuZm9yY2VkIGluIHRoZVxuLy8gICBkZWxldGVQcm9wZXJ0eSwgZ2V0e093bn1Qcm9wZXJ0eURlc2NyaXB0b3IsIGhhc3tPd259LFxuLy8gICBnZXR7T3dufVByb3BlcnR5TmFtZXMsIGtleXMgYW5kIGVudW1lcmF0ZSB0cmFwc1xuXG4vLyBWaW9sYXRpb24gb2YgYW55IG9mIHRoZXNlIGludmFyaWFudHMgYnkgSCB3aWxsIHJlc3VsdCBpbiBUeXBlRXJyb3IgYmVpbmdcbi8vIHRocm93bi5cblxuLy8gQWRkaXRpb25hbGx5LCBvbmNlIE9iamVjdC5wcmV2ZW50RXh0ZW5zaW9ucywgT2JqZWN0LnNlYWwgb3IgT2JqZWN0LmZyZWV6ZVxuLy8gaXMgaW52b2tlZCBvbiB0aGUgcHJveHksIHRoZSBzZXQgb2Ygb3duIHByb3BlcnR5IG5hbWVzIGZvciB0aGUgcHJveHkgaXNcbi8vIGZpeGVkLiBBbnkgcHJvcGVydHkgbmFtZSB0aGF0IGlzIG5vdCBmaXhlZCBpcyBjYWxsZWQgYSAnbmV3JyBwcm9wZXJ0eS5cblxuLy8gVGhlIFZhbGlkYXRvciB1cGhvbGRzIHRoZSBmb2xsb3dpbmcgaW52YXJpYW50cyByZWdhcmRpbmcgZXh0ZW5zaWJpbGl0eTpcbi8vIC0gZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIGNhbm5vdCByZXBvcnQgbmV3IHByb3BlcnRpZXMgYXMgZXhpc3RlbnRcbi8vICAgKGl0IG11c3QgcmVwb3J0IHRoZW0gYXMgbm9uLWV4aXN0ZW50IGJ5IHJldHVybmluZyB1bmRlZmluZWQpXG4vLyAtIGRlZmluZVByb3BlcnR5IGNhbm5vdCBzdWNjZXNzZnVsbHkgYWRkIGEgbmV3IHByb3BlcnR5IChpdCBtdXN0IHJlamVjdClcbi8vIC0gZ2V0T3duUHJvcGVydHlOYW1lcyBjYW5ub3QgbGlzdCBuZXcgcHJvcGVydGllc1xuLy8gLSBoYXNPd24gY2Fubm90IHJlcG9ydCB0cnVlIGZvciBuZXcgcHJvcGVydGllcyAoaXQgbXVzdCByZXBvcnQgZmFsc2UpXG4vLyAtIGtleXMgY2Fubm90IGxpc3QgbmV3IHByb3BlcnRpZXNcblxuLy8gSW52YXJpYW50cyBjdXJyZW50bHkgbm90IGVuZm9yY2VkOlxuLy8gLSBnZXRPd25Qcm9wZXJ0eU5hbWVzIGxpc3RzIG9ubHkgb3duIHByb3BlcnR5IG5hbWVzXG4vLyAtIGtleXMgbGlzdHMgb25seSBlbnVtZXJhYmxlIG93biBwcm9wZXJ0eSBuYW1lc1xuLy8gQm90aCB0cmFwcyBtYXkgbGlzdCBtb3JlIHByb3BlcnR5IG5hbWVzIHRoYW4gYXJlIGFjdHVhbGx5IGRlZmluZWQgb24gdGhlXG4vLyB0YXJnZXQuXG5cbi8vIEludmFyaWFudHMgd2l0aCByZWdhcmQgdG8gaW5oZXJpdGFuY2UgYXJlIGN1cnJlbnRseSBub3QgZW5mb3JjZWQuXG4vLyAtIGEgbm9uLWNvbmZpZ3VyYWJsZSBwb3RlbnRpYWxseSBpbmhlcml0ZWQgcHJvcGVydHkgb24gYSBwcm94eSB3aXRoXG4vLyAgIG5vbi1tdXRhYmxlIGFuY2VzdHJ5IGNhbm5vdCBiZSByZXBvcnRlZCBhcyBub24tZXhpc3RlbnRcbi8vIChBbiBvYmplY3Qgd2l0aCBub24tbXV0YWJsZSBhbmNlc3RyeSBpcyBhIG5vbi1leHRlbnNpYmxlIG9iamVjdCB3aG9zZVxuLy8gW1tQcm90b3R5cGVdXSBpcyBlaXRoZXIgbnVsbCBvciBhbiBvYmplY3Qgd2l0aCBub24tbXV0YWJsZSBhbmNlc3RyeS4pXG5cbi8vIENoYW5nZXMgaW4gSGFuZGxlciBBUEkgY29tcGFyZWQgdG8gcHJldmlvdXMgaGFybW9ueTpwcm94aWVzLCBzZWU6XG4vLyBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1zdHJhd21hbjpkaXJlY3RfcHJveGllc1xuLy8gaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTpkaXJlY3RfcHJveGllc1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8vIC0tLS0gV2Vha01hcCBwb2x5ZmlsbCAtLS0tXG5cbi8vIFRPRE86IGZpbmQgYSBwcm9wZXIgV2Vha01hcCBwb2x5ZmlsbFxuXG4vLyBkZWZpbmUgYW4gZW1wdHkgV2Vha01hcCBzbyB0aGF0IGF0IGxlYXN0IHRoZSBSZWZsZWN0IG1vZHVsZSBjb2RlXG4vLyB3aWxsIHdvcmsgaW4gdGhlIGFic2VuY2Ugb2YgV2Vha01hcHMuIFByb3h5IGVtdWxhdGlvbiBkZXBlbmRzIG9uXG4vLyBhY3R1YWwgV2Vha01hcHMsIHNvIHdpbGwgbm90IHdvcmsgd2l0aCB0aGlzIGxpdHRsZSBzaGltLlxuaWYgKHR5cGVvZiBXZWFrTWFwID09PSBcInVuZGVmaW5lZFwiKSB7XG4gIGdsb2JhbC5XZWFrTWFwID0gZnVuY3Rpb24oKXt9O1xuICBnbG9iYWwuV2Vha01hcC5wcm90b3R5cGUgPSB7XG4gICAgZ2V0OiBmdW5jdGlvbihrKSB7IHJldHVybiB1bmRlZmluZWQ7IH0sXG4gICAgc2V0OiBmdW5jdGlvbihrLHYpIHsgdGhyb3cgbmV3IEVycm9yKFwiV2Vha01hcCBub3Qgc3VwcG9ydGVkXCIpOyB9XG4gIH07XG59XG5cbi8vIC0tLS0gTm9ybWFsaXphdGlvbiBmdW5jdGlvbnMgZm9yIHByb3BlcnR5IGRlc2NyaXB0b3JzIC0tLS1cblxuZnVuY3Rpb24gaXNTdGFuZGFyZEF0dHJpYnV0ZShuYW1lKSB7XG4gIHJldHVybiAvXihnZXR8c2V0fHZhbHVlfHdyaXRhYmxlfGVudW1lcmFibGV8Y29uZmlndXJhYmxlKSQvLnRlc3QobmFtZSk7XG59XG5cbi8vIEFkYXB0ZWQgZnJvbSBFUzUgc2VjdGlvbiA4LjEwLjVcbmZ1bmN0aW9uIHRvUHJvcGVydHlEZXNjcmlwdG9yKG9iaikge1xuICBpZiAoT2JqZWN0KG9iaikgIT09IG9iaikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJwcm9wZXJ0eSBkZXNjcmlwdG9yIHNob3VsZCBiZSBhbiBPYmplY3QsIGdpdmVuOiBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iaik7XG4gIH1cbiAgdmFyIGRlc2MgPSB7fTtcbiAgaWYgKCdlbnVtZXJhYmxlJyBpbiBvYmopIHsgZGVzYy5lbnVtZXJhYmxlID0gISFvYmouZW51bWVyYWJsZTsgfVxuICBpZiAoJ2NvbmZpZ3VyYWJsZScgaW4gb2JqKSB7IGRlc2MuY29uZmlndXJhYmxlID0gISFvYmouY29uZmlndXJhYmxlOyB9XG4gIGlmICgndmFsdWUnIGluIG9iaikgeyBkZXNjLnZhbHVlID0gb2JqLnZhbHVlOyB9XG4gIGlmICgnd3JpdGFibGUnIGluIG9iaikgeyBkZXNjLndyaXRhYmxlID0gISFvYmoud3JpdGFibGU7IH1cbiAgaWYgKCdnZXQnIGluIG9iaikge1xuICAgIHZhciBnZXR0ZXIgPSBvYmouZ2V0O1xuICAgIGlmIChnZXR0ZXIgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZ2V0dGVyICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJwcm9wZXJ0eSBkZXNjcmlwdG9yICdnZXQnIGF0dHJpYnV0ZSBtdXN0IGJlIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcImNhbGxhYmxlIG9yIHVuZGVmaW5lZCwgZ2l2ZW46IFwiK2dldHRlcik7XG4gICAgfVxuICAgIGRlc2MuZ2V0ID0gZ2V0dGVyO1xuICB9XG4gIGlmICgnc2V0JyBpbiBvYmopIHtcbiAgICB2YXIgc2V0dGVyID0gb2JqLnNldDtcbiAgICBpZiAoc2V0dGVyICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIHNldHRlciAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicHJvcGVydHkgZGVzY3JpcHRvciAnc2V0JyBhdHRyaWJ1dGUgbXVzdCBiZSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCJjYWxsYWJsZSBvciB1bmRlZmluZWQsIGdpdmVuOiBcIitzZXR0ZXIpO1xuICAgIH1cbiAgICBkZXNjLnNldCA9IHNldHRlcjtcbiAgfVxuICBpZiAoJ2dldCcgaW4gZGVzYyB8fCAnc2V0JyBpbiBkZXNjKSB7XG4gICAgaWYgKCd2YWx1ZScgaW4gZGVzYyB8fCAnd3JpdGFibGUnIGluIGRlc2MpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJwcm9wZXJ0eSBkZXNjcmlwdG9yIGNhbm5vdCBiZSBib3RoIGEgZGF0YSBhbmQgYW4gXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiYWNjZXNzb3IgZGVzY3JpcHRvcjogXCIrb2JqKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlc2M7XG59XG5cbmZ1bmN0aW9uIGlzQWNjZXNzb3JEZXNjcmlwdG9yKGRlc2MpIHtcbiAgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gKCdnZXQnIGluIGRlc2MgfHwgJ3NldCcgaW4gZGVzYyk7XG59XG5mdW5jdGlvbiBpc0RhdGFEZXNjcmlwdG9yKGRlc2MpIHtcbiAgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gKCd2YWx1ZScgaW4gZGVzYyB8fCAnd3JpdGFibGUnIGluIGRlc2MpO1xufVxuZnVuY3Rpb24gaXNHZW5lcmljRGVzY3JpcHRvcihkZXNjKSB7XG4gIGlmIChkZXNjID09PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICFpc0FjY2Vzc29yRGVzY3JpcHRvcihkZXNjKSAmJiAhaXNEYXRhRGVzY3JpcHRvcihkZXNjKTtcbn1cblxuZnVuY3Rpb24gdG9Db21wbGV0ZVByb3BlcnR5RGVzY3JpcHRvcihkZXNjKSB7XG4gIHZhciBpbnRlcm5hbERlc2MgPSB0b1Byb3BlcnR5RGVzY3JpcHRvcihkZXNjKTtcbiAgaWYgKGlzR2VuZXJpY0Rlc2NyaXB0b3IoaW50ZXJuYWxEZXNjKSB8fCBpc0RhdGFEZXNjcmlwdG9yKGludGVybmFsRGVzYykpIHtcbiAgICBpZiAoISgndmFsdWUnIGluIGludGVybmFsRGVzYykpIHsgaW50ZXJuYWxEZXNjLnZhbHVlID0gdW5kZWZpbmVkOyB9XG4gICAgaWYgKCEoJ3dyaXRhYmxlJyBpbiBpbnRlcm5hbERlc2MpKSB7IGludGVybmFsRGVzYy53cml0YWJsZSA9IGZhbHNlOyB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKCEoJ2dldCcgaW4gaW50ZXJuYWxEZXNjKSkgeyBpbnRlcm5hbERlc2MuZ2V0ID0gdW5kZWZpbmVkOyB9XG4gICAgaWYgKCEoJ3NldCcgaW4gaW50ZXJuYWxEZXNjKSkgeyBpbnRlcm5hbERlc2Muc2V0ID0gdW5kZWZpbmVkOyB9XG4gIH1cbiAgaWYgKCEoJ2VudW1lcmFibGUnIGluIGludGVybmFsRGVzYykpIHsgaW50ZXJuYWxEZXNjLmVudW1lcmFibGUgPSBmYWxzZTsgfVxuICBpZiAoISgnY29uZmlndXJhYmxlJyBpbiBpbnRlcm5hbERlc2MpKSB7IGludGVybmFsRGVzYy5jb25maWd1cmFibGUgPSBmYWxzZTsgfVxuICByZXR1cm4gaW50ZXJuYWxEZXNjO1xufVxuXG5mdW5jdGlvbiBpc0VtcHR5RGVzY3JpcHRvcihkZXNjKSB7XG4gIHJldHVybiAhKCdnZXQnIGluIGRlc2MpICYmXG4gICAgICAgICAhKCdzZXQnIGluIGRlc2MpICYmXG4gICAgICAgICAhKCd2YWx1ZScgaW4gZGVzYykgJiZcbiAgICAgICAgICEoJ3dyaXRhYmxlJyBpbiBkZXNjKSAmJlxuICAgICAgICAgISgnZW51bWVyYWJsZScgaW4gZGVzYykgJiZcbiAgICAgICAgICEoJ2NvbmZpZ3VyYWJsZScgaW4gZGVzYyk7XG59XG5cbmZ1bmN0aW9uIGlzRXF1aXZhbGVudERlc2NyaXB0b3IoZGVzYzEsIGRlc2MyKSB7XG4gIHJldHVybiBzYW1lVmFsdWUoZGVzYzEuZ2V0LCBkZXNjMi5nZXQpICYmXG4gICAgICAgICBzYW1lVmFsdWUoZGVzYzEuc2V0LCBkZXNjMi5zZXQpICYmXG4gICAgICAgICBzYW1lVmFsdWUoZGVzYzEudmFsdWUsIGRlc2MyLnZhbHVlKSAmJlxuICAgICAgICAgc2FtZVZhbHVlKGRlc2MxLndyaXRhYmxlLCBkZXNjMi53cml0YWJsZSkgJiZcbiAgICAgICAgIHNhbWVWYWx1ZShkZXNjMS5lbnVtZXJhYmxlLCBkZXNjMi5lbnVtZXJhYmxlKSAmJlxuICAgICAgICAgc2FtZVZhbHVlKGRlc2MxLmNvbmZpZ3VyYWJsZSwgZGVzYzIuY29uZmlndXJhYmxlKTtcbn1cblxuLy8gY29waWVkIGZyb20gaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTplZ2FsXG5mdW5jdGlvbiBzYW1lVmFsdWUoeCwgeSkge1xuICBpZiAoeCA9PT0geSkge1xuICAgIC8vIDAgPT09IC0wLCBidXQgdGhleSBhcmUgbm90IGlkZW50aWNhbFxuICAgIHJldHVybiB4ICE9PSAwIHx8IDEgLyB4ID09PSAxIC8geTtcbiAgfVxuXG4gIC8vIE5hTiAhPT0gTmFOLCBidXQgdGhleSBhcmUgaWRlbnRpY2FsLlxuICAvLyBOYU5zIGFyZSB0aGUgb25seSBub24tcmVmbGV4aXZlIHZhbHVlLCBpLmUuLCBpZiB4ICE9PSB4LFxuICAvLyB0aGVuIHggaXMgYSBOYU4uXG4gIC8vIGlzTmFOIGlzIGJyb2tlbjogaXQgY29udmVydHMgaXRzIGFyZ3VtZW50IHRvIG51bWJlciwgc29cbiAgLy8gaXNOYU4oXCJmb29cIikgPT4gdHJ1ZVxuICByZXR1cm4geCAhPT0geCAmJiB5ICE9PSB5O1xufVxuXG4vKipcbiAqIFJldHVybnMgYSBmcmVzaCBwcm9wZXJ0eSBkZXNjcmlwdG9yIHRoYXQgaXMgZ3VhcmFudGVlZFxuICogdG8gYmUgY29tcGxldGUgKGkuZS4gY29udGFpbiBhbGwgdGhlIHN0YW5kYXJkIGF0dHJpYnV0ZXMpLlxuICogQWRkaXRpb25hbGx5LCBhbnkgbm9uLXN0YW5kYXJkIGVudW1lcmFibGUgcHJvcGVydGllcyBvZlxuICogYXR0cmlidXRlcyBhcmUgY29waWVkIG92ZXIgdG8gdGhlIGZyZXNoIGRlc2NyaXB0b3IuXG4gKlxuICogSWYgYXR0cmlidXRlcyBpcyB1bmRlZmluZWQsIHJldHVybnMgdW5kZWZpbmVkLlxuICpcbiAqIFNlZSBhbHNvOiBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OnByb3hpZXNfc2VtYW50aWNzXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZUFuZENvbXBsZXRlUHJvcGVydHlEZXNjcmlwdG9yKGF0dHJpYnV0ZXMpIHtcbiAgaWYgKGF0dHJpYnV0ZXMgPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG4gIHZhciBkZXNjID0gdG9Db21wbGV0ZVByb3BlcnR5RGVzY3JpcHRvcihhdHRyaWJ1dGVzKTtcbiAgLy8gTm90ZTogbm8gbmVlZCB0byBjYWxsIEZyb21Qcm9wZXJ0eURlc2NyaXB0b3IoZGVzYyksIGFzIHdlIHJlcHJlc2VudFxuICAvLyBcImludGVybmFsXCIgcHJvcGVydHkgZGVzY3JpcHRvcnMgYXMgcHJvcGVyIE9iamVjdHMgZnJvbSB0aGUgc3RhcnRcbiAgZm9yICh2YXIgbmFtZSBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgaWYgKCFpc1N0YW5kYXJkQXR0cmlidXRlKG5hbWUpKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZGVzYywgbmFtZSxcbiAgICAgICAgeyB2YWx1ZTogYXR0cmlidXRlc1tuYW1lXSxcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlc2M7XG59XG5cbi8qKlxuICogUmV0dXJucyBhIGZyZXNoIHByb3BlcnR5IGRlc2NyaXB0b3Igd2hvc2Ugc3RhbmRhcmRcbiAqIGF0dHJpYnV0ZXMgYXJlIGd1YXJhbnRlZWQgdG8gYmUgZGF0YSBwcm9wZXJ0aWVzIG9mIHRoZSByaWdodCB0eXBlLlxuICogQWRkaXRpb25hbGx5LCBhbnkgbm9uLXN0YW5kYXJkIGVudW1lcmFibGUgcHJvcGVydGllcyBvZlxuICogYXR0cmlidXRlcyBhcmUgY29waWVkIG92ZXIgdG8gdGhlIGZyZXNoIGRlc2NyaXB0b3IuXG4gKlxuICogSWYgYXR0cmlidXRlcyBpcyB1bmRlZmluZWQsIHdpbGwgdGhyb3cgYSBUeXBlRXJyb3IuXG4gKlxuICogU2VlIGFsc286IGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6cHJveGllc19zZW1hbnRpY3NcbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplUHJvcGVydHlEZXNjcmlwdG9yKGF0dHJpYnV0ZXMpIHtcbiAgdmFyIGRlc2MgPSB0b1Byb3BlcnR5RGVzY3JpcHRvcihhdHRyaWJ1dGVzKTtcbiAgLy8gTm90ZTogbm8gbmVlZCB0byBjYWxsIEZyb21HZW5lcmljUHJvcGVydHlEZXNjcmlwdG9yKGRlc2MpLCBhcyB3ZSByZXByZXNlbnRcbiAgLy8gXCJpbnRlcm5hbFwiIHByb3BlcnR5IGRlc2NyaXB0b3JzIGFzIHByb3BlciBPYmplY3RzIGZyb20gdGhlIHN0YXJ0XG4gIGZvciAodmFyIG5hbWUgaW4gYXR0cmlidXRlcykge1xuICAgIGlmICghaXNTdGFuZGFyZEF0dHJpYnV0ZShuYW1lKSkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGRlc2MsIG5hbWUsXG4gICAgICAgIHsgdmFsdWU6IGF0dHJpYnV0ZXNbbmFtZV0sXG4gICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUgfSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBkZXNjO1xufVxuXG4vLyBzdG9yZSBhIHJlZmVyZW5jZSB0byB0aGUgcmVhbCBFUzUgcHJpbWl0aXZlcyBiZWZvcmUgcGF0Y2hpbmcgdGhlbSBsYXRlclxudmFyIHByaW1fcHJldmVudEV4dGVuc2lvbnMgPSAgICAgICAgT2JqZWN0LnByZXZlbnRFeHRlbnNpb25zLFxuICAgIHByaW1fc2VhbCA9ICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LnNlYWwsXG4gICAgcHJpbV9mcmVlemUgPSAgICAgICAgICAgICAgICAgICBPYmplY3QuZnJlZXplLFxuICAgIHByaW1faXNFeHRlbnNpYmxlID0gICAgICAgICAgICAgT2JqZWN0LmlzRXh0ZW5zaWJsZSxcbiAgICBwcmltX2lzU2VhbGVkID0gICAgICAgICAgICAgICAgIE9iamVjdC5pc1NlYWxlZCxcbiAgICBwcmltX2lzRnJvemVuID0gICAgICAgICAgICAgICAgIE9iamVjdC5pc0Zyb3plbixcbiAgICBwcmltX2dldFByb3RvdHlwZU9mID0gICAgICAgICAgIE9iamVjdC5nZXRQcm90b3R5cGVPZixcbiAgICBwcmltX2dldE93blByb3BlcnR5RGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IsXG4gICAgcHJpbV9kZWZpbmVQcm9wZXJ0eSA9ICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHksXG4gICAgcHJpbV9kZWZpbmVQcm9wZXJ0aWVzID0gICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyxcbiAgICBwcmltX2tleXMgPSAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzLFxuICAgIHByaW1fZ2V0T3duUHJvcGVydHlOYW1lcyA9ICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMsXG4gICAgcHJpbV9nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPSAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzLFxuICAgIHByaW1fYXNzaWduID0gICAgICAgICAgICAgICAgICAgT2JqZWN0LmFzc2lnbixcbiAgICBwcmltX2lzQXJyYXkgPSAgICAgICAgICAgICAgICAgIEFycmF5LmlzQXJyYXksXG4gICAgcHJpbV9jb25jYXQgPSAgICAgICAgICAgICAgICAgICBBcnJheS5wcm90b3R5cGUuY29uY2F0LFxuICAgIHByaW1faXNQcm90b3R5cGVPZiA9ICAgICAgICAgICAgT2JqZWN0LnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mLFxuICAgIHByaW1faGFzT3duUHJvcGVydHkgPSAgICAgICAgICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLy8gdGhlc2Ugd2lsbCBwb2ludCB0byB0aGUgcGF0Y2hlZCB2ZXJzaW9ucyBvZiB0aGUgcmVzcGVjdGl2ZSBtZXRob2RzIG9uXG4vLyBPYmplY3QuIFRoZXkgYXJlIHVzZWQgd2l0aGluIHRoaXMgbW9kdWxlIGFzIHRoZSBcImludHJpbnNpY1wiIGJpbmRpbmdzXG4vLyBvZiB0aGVzZSBtZXRob2RzIChpLmUuIHRoZSBcIm9yaWdpbmFsXCIgYmluZGluZ3MgYXMgZGVmaW5lZCBpbiB0aGUgc3BlYylcbnZhciBPYmplY3RfaXNGcm96ZW4sXG4gICAgT2JqZWN0X2lzU2VhbGVkLFxuICAgIE9iamVjdF9pc0V4dGVuc2libGUsXG4gICAgT2JqZWN0X2dldFByb3RvdHlwZU9mLFxuICAgIE9iamVjdF9nZXRPd25Qcm9wZXJ0eU5hbWVzO1xuXG4vKipcbiAqIEEgcHJvcGVydHkgJ25hbWUnIGlzIGZpeGVkIGlmIGl0IGlzIGFuIG93biBwcm9wZXJ0eSBvZiB0aGUgdGFyZ2V0LlxuICovXG5mdW5jdGlvbiBpc0ZpeGVkKG5hbWUsIHRhcmdldCkge1xuICByZXR1cm4gKHt9KS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHRhcmdldCwgbmFtZSk7XG59XG5mdW5jdGlvbiBpc1NlYWxlZChuYW1lLCB0YXJnZXQpIHtcbiAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgbmFtZSk7XG4gIGlmIChkZXNjID09PSB1bmRlZmluZWQpIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHJldHVybiBkZXNjLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2U7XG59XG5mdW5jdGlvbiBpc1NlYWxlZERlc2MoZGVzYykge1xuICByZXR1cm4gZGVzYyAhPT0gdW5kZWZpbmVkICYmIGRlc2MuY29uZmlndXJhYmxlID09PSBmYWxzZTtcbn1cblxuLyoqXG4gKiBQZXJmb3JtcyBhbGwgdmFsaWRhdGlvbiB0aGF0IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBwZXJmb3JtcyxcbiAqIHdpdGhvdXQgYWN0dWFsbHkgZGVmaW5pbmcgdGhlIHByb3BlcnR5LiBSZXR1cm5zIGEgYm9vbGVhblxuICogaW5kaWNhdGluZyB3aGV0aGVyIHZhbGlkYXRpb24gc3VjY2VlZGVkLlxuICpcbiAqIEltcGxlbWVudGF0aW9uIHRyYW5zbGl0ZXJhdGVkIGZyb20gRVM1LjEgc2VjdGlvbiA4LjEyLjlcbiAqL1xuZnVuY3Rpb24gaXNDb21wYXRpYmxlRGVzY3JpcHRvcihleHRlbnNpYmxlLCBjdXJyZW50LCBkZXNjKSB7XG4gIGlmIChjdXJyZW50ID09PSB1bmRlZmluZWQgJiYgZXh0ZW5zaWJsZSA9PT0gZmFsc2UpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGN1cnJlbnQgPT09IHVuZGVmaW5lZCAmJiBleHRlbnNpYmxlID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKGlzRW1wdHlEZXNjcmlwdG9yKGRlc2MpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKGlzRXF1aXZhbGVudERlc2NyaXB0b3IoY3VycmVudCwgZGVzYykpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBpZiAoY3VycmVudC5jb25maWd1cmFibGUgPT09IGZhbHNlKSB7XG4gICAgaWYgKGRlc2MuY29uZmlndXJhYmxlID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmICgnZW51bWVyYWJsZScgaW4gZGVzYyAmJiBkZXNjLmVudW1lcmFibGUgIT09IGN1cnJlbnQuZW51bWVyYWJsZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICBpZiAoaXNHZW5lcmljRGVzY3JpcHRvcihkZXNjKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGlmIChpc0RhdGFEZXNjcmlwdG9yKGN1cnJlbnQpICE9PSBpc0RhdGFEZXNjcmlwdG9yKGRlc2MpKSB7XG4gICAgaWYgKGN1cnJlbnQuY29uZmlndXJhYmxlID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBpZiAoaXNEYXRhRGVzY3JpcHRvcihjdXJyZW50KSAmJiBpc0RhdGFEZXNjcmlwdG9yKGRlc2MpKSB7XG4gICAgaWYgKGN1cnJlbnQuY29uZmlndXJhYmxlID09PSBmYWxzZSkge1xuICAgICAgaWYgKGN1cnJlbnQud3JpdGFibGUgPT09IGZhbHNlICYmIGRlc2Mud3JpdGFibGUgPT09IHRydWUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGN1cnJlbnQud3JpdGFibGUgPT09IGZhbHNlKSB7XG4gICAgICAgIGlmICgndmFsdWUnIGluIGRlc2MgJiYgIXNhbWVWYWx1ZShkZXNjLnZhbHVlLCBjdXJyZW50LnZhbHVlKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBpZiAoaXNBY2Nlc3NvckRlc2NyaXB0b3IoY3VycmVudCkgJiYgaXNBY2Nlc3NvckRlc2NyaXB0b3IoZGVzYykpIHtcbiAgICBpZiAoY3VycmVudC5jb25maWd1cmFibGUgPT09IGZhbHNlKSB7XG4gICAgICBpZiAoJ3NldCcgaW4gZGVzYyAmJiAhc2FtZVZhbHVlKGRlc2Muc2V0LCBjdXJyZW50LnNldCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKCdnZXQnIGluIGRlc2MgJiYgIXNhbWVWYWx1ZShkZXNjLmdldCwgY3VycmVudC5nZXQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIEVTNiA3LjMuMTEgU2V0SW50ZWdyaXR5TGV2ZWxcbi8vIGxldmVsIGlzIG9uZSBvZiBcInNlYWxlZFwiIG9yIFwiZnJvemVuXCJcbmZ1bmN0aW9uIHNldEludGVncml0eUxldmVsKHRhcmdldCwgbGV2ZWwpIHtcbiAgdmFyIG93blByb3BzID0gT2JqZWN0X2dldE93blByb3BlcnR5TmFtZXModGFyZ2V0KTtcbiAgdmFyIHBlbmRpbmdFeGNlcHRpb24gPSB1bmRlZmluZWQ7XG4gIGlmIChsZXZlbCA9PT0gXCJzZWFsZWRcIikge1xuICAgIHZhciBsID0gK293blByb3BzLmxlbmd0aDtcbiAgICB2YXIgaztcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgayA9IFN0cmluZyhvd25Qcm9wc1tpXSk7XG4gICAgICB0cnkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrLCB7IGNvbmZpZ3VyYWJsZTogZmFsc2UgfSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChwZW5kaW5nRXhjZXB0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBwZW5kaW5nRXhjZXB0aW9uID0gZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBsZXZlbCA9PT0gXCJmcm96ZW5cIlxuICAgIHZhciBsID0gK293blByb3BzLmxlbmd0aDtcbiAgICB2YXIgaztcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgayA9IFN0cmluZyhvd25Qcm9wc1tpXSk7XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgY3VycmVudERlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgayk7XG4gICAgICAgIGlmIChjdXJyZW50RGVzYyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFyIGRlc2M7XG4gICAgICAgICAgaWYgKGlzQWNjZXNzb3JEZXNjcmlwdG9yKGN1cnJlbnREZXNjKSkge1xuICAgICAgICAgICAgZGVzYyA9IHsgY29uZmlndXJhYmxlOiBmYWxzZSB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlc2MgPSB7IGNvbmZpZ3VyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiBmYWxzZSB9XG4gICAgICAgICAgfVxuICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGssIGRlc2MpO1xuICAgICAgICB9ICAgICAgICBcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKHBlbmRpbmdFeGNlcHRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHBlbmRpbmdFeGNlcHRpb24gPSBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChwZW5kaW5nRXhjZXB0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBwZW5kaW5nRXhjZXB0aW9uO1xuICB9XG4gIHJldHVybiBSZWZsZWN0LnByZXZlbnRFeHRlbnNpb25zKHRhcmdldCk7XG59XG5cbi8vIEVTNiA3LjMuMTIgVGVzdEludGVncml0eUxldmVsXG4vLyBsZXZlbCBpcyBvbmUgb2YgXCJzZWFsZWRcIiBvciBcImZyb3plblwiXG5mdW5jdGlvbiB0ZXN0SW50ZWdyaXR5TGV2ZWwodGFyZ2V0LCBsZXZlbCkge1xuICB2YXIgaXNFeHRlbnNpYmxlID0gT2JqZWN0X2lzRXh0ZW5zaWJsZSh0YXJnZXQpO1xuICBpZiAoaXNFeHRlbnNpYmxlKSByZXR1cm4gZmFsc2U7XG4gIFxuICB2YXIgb3duUHJvcHMgPSBPYmplY3RfZ2V0T3duUHJvcGVydHlOYW1lcyh0YXJnZXQpO1xuICB2YXIgcGVuZGluZ0V4Y2VwdGlvbiA9IHVuZGVmaW5lZDtcbiAgdmFyIGNvbmZpZ3VyYWJsZSA9IGZhbHNlO1xuICB2YXIgd3JpdGFibGUgPSBmYWxzZTtcbiAgXG4gIHZhciBsID0gK293blByb3BzLmxlbmd0aDtcbiAgdmFyIGs7XG4gIHZhciBjdXJyZW50RGVzYztcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICBrID0gU3RyaW5nKG93blByb3BzW2ldKTtcbiAgICB0cnkge1xuICAgICAgY3VycmVudERlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgayk7XG4gICAgICBjb25maWd1cmFibGUgPSBjb25maWd1cmFibGUgfHwgY3VycmVudERlc2MuY29uZmlndXJhYmxlO1xuICAgICAgaWYgKGlzRGF0YURlc2NyaXB0b3IoY3VycmVudERlc2MpKSB7XG4gICAgICAgIHdyaXRhYmxlID0gd3JpdGFibGUgfHwgY3VycmVudERlc2Mud3JpdGFibGU7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKHBlbmRpbmdFeGNlcHRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwZW5kaW5nRXhjZXB0aW9uID0gZTtcbiAgICAgICAgY29uZmlndXJhYmxlID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKHBlbmRpbmdFeGNlcHRpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IHBlbmRpbmdFeGNlcHRpb247XG4gIH1cbiAgaWYgKGxldmVsID09PSBcImZyb3plblwiICYmIHdyaXRhYmxlID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChjb25maWd1cmFibGUgPT09IHRydWUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIC0tLS0gVGhlIFZhbGlkYXRvciBoYW5kbGVyIHdyYXBwZXIgYXJvdW5kIHVzZXIgaGFuZGxlcnMgLS0tLVxuXG4vKipcbiAqIEBwYXJhbSB0YXJnZXQgdGhlIG9iamVjdCB3cmFwcGVkIGJ5IHRoaXMgcHJveHkuXG4gKiBBcyBsb25nIGFzIHRoZSBwcm94eSBpcyBleHRlbnNpYmxlLCBvbmx5IG5vbi1jb25maWd1cmFibGUgcHJvcGVydGllc1xuICogYXJlIGNoZWNrZWQgYWdhaW5zdCB0aGUgdGFyZ2V0LiBPbmNlIHRoZSBwcm94eSBiZWNvbWVzIG5vbi1leHRlbnNpYmxlLFxuICogaW52YXJpYW50cyB3LnIudC4gbm9uLWV4dGVuc2liaWxpdHkgYXJlIGFsc28gZW5mb3JjZWQuXG4gKlxuICogQHBhcmFtIGhhbmRsZXIgdGhlIGhhbmRsZXIgb2YgdGhlIGRpcmVjdCBwcm94eS4gVGhlIG9iamVjdCBlbXVsYXRlZCBieVxuICogdGhpcyBoYW5kbGVyIGlzIHZhbGlkYXRlZCBhZ2FpbnN0IHRoZSB0YXJnZXQgb2JqZWN0IG9mIHRoZSBkaXJlY3QgcHJveHkuXG4gKiBBbnkgdmlvbGF0aW9ucyB0aGF0IHRoZSBoYW5kbGVyIG1ha2VzIGFnYWluc3QgdGhlIGludmFyaWFudHNcbiAqIG9mIHRoZSB0YXJnZXQgd2lsbCBjYXVzZSBhIFR5cGVFcnJvciB0byBiZSB0aHJvd24uXG4gKlxuICogQm90aCB0YXJnZXQgYW5kIGhhbmRsZXIgbXVzdCBiZSBwcm9wZXIgT2JqZWN0cyBhdCBpbml0aWFsaXphdGlvbiB0aW1lLlxuICovXG5mdW5jdGlvbiBWYWxpZGF0b3IodGFyZ2V0LCBoYW5kbGVyKSB7XG4gIC8vIGZvciBub24tcmV2b2thYmxlIHByb3hpZXMsIHRoZXNlIGFyZSBjb25zdCByZWZlcmVuY2VzXG4gIC8vIGZvciByZXZva2FibGUgcHJveGllcywgb24gcmV2b2NhdGlvbjpcbiAgLy8gLSB0aGlzLnRhcmdldCBpcyBzZXQgdG8gbnVsbFxuICAvLyAtIHRoaXMuaGFuZGxlciBpcyBzZXQgdG8gYSBoYW5kbGVyIHRoYXQgdGhyb3dzIG9uIGFsbCB0cmFwc1xuICB0aGlzLnRhcmdldCAgPSB0YXJnZXQ7XG4gIHRoaXMuaGFuZGxlciA9IGhhbmRsZXI7XG59XG5cblZhbGlkYXRvci5wcm90b3R5cGUgPSB7XG5cbiAgLyoqXG4gICAqIElmIGdldFRyYXAgcmV0dXJucyB1bmRlZmluZWQsIHRoZSBjYWxsZXIgc2hvdWxkIHBlcmZvcm0gdGhlXG4gICAqIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvci5cbiAgICogSWYgZ2V0VHJhcCByZXR1cm5zIG5vcm1hbGx5IG90aGVyd2lzZSwgdGhlIHJldHVybiB2YWx1ZVxuICAgKiB3aWxsIGJlIGEgY2FsbGFibGUgdHJhcCBmdW5jdGlvbi4gV2hlbiBjYWxsaW5nIHRoZSB0cmFwIGZ1bmN0aW9uLFxuICAgKiB0aGUgY2FsbGVyIGlzIHJlc3BvbnNpYmxlIGZvciBiaW5kaW5nIGl0cyB8dGhpc3wgdG8gfHRoaXMuaGFuZGxlcnwuXG4gICAqL1xuICBnZXRUcmFwOiBmdW5jdGlvbih0cmFwTmFtZSkge1xuICAgIHZhciB0cmFwID0gdGhpcy5oYW5kbGVyW3RyYXBOYW1lXTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyB0aGUgdHJhcCB3YXMgbm90IGRlZmluZWQsXG4gICAgICAvLyBwZXJmb3JtIHRoZSBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB0cmFwICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IodHJhcE5hbWUgKyBcIiB0cmFwIGlzIG5vdCBjYWxsYWJsZTogXCIrdHJhcCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRyYXA7XG4gIH0sXG5cbiAgLy8gPT09IGZ1bmRhbWVudGFsIHRyYXBzID09PVxuXG4gIC8qKlxuICAgKiBJZiBuYW1lIGRlbm90ZXMgYSBmaXhlZCBwcm9wZXJ0eSwgY2hlY2s6XG4gICAqICAgLSB3aGV0aGVyIHRhcmdldEhhbmRsZXIgcmVwb3J0cyBpdCBhcyBleGlzdGVudFxuICAgKiAgIC0gd2hldGhlciB0aGUgcmV0dXJuZWQgZGVzY3JpcHRvciBpcyBjb21wYXRpYmxlIHdpdGggdGhlIGZpeGVkIHByb3BlcnR5XG4gICAqIElmIHRoZSBwcm94eSBpcyBub24tZXh0ZW5zaWJsZSwgY2hlY2s6XG4gICAqICAgLSB3aGV0aGVyIG5hbWUgaXMgbm90IGEgbmV3IHByb3BlcnR5XG4gICAqIEFkZGl0aW9uYWxseSwgdGhlIHJldHVybmVkIGRlc2NyaXB0b3IgaXMgbm9ybWFsaXplZCBhbmQgY29tcGxldGVkLlxuICAgKi9cbiAgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcImdldE93blByb3BlcnR5RGVzY3JpcHRvclwiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gUmVmbGVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGhpcy50YXJnZXQsIG5hbWUpO1xuICAgIH1cblxuICAgIG5hbWUgPSBTdHJpbmcobmFtZSk7XG4gICAgdmFyIGRlc2MgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCwgbmFtZSk7XG4gICAgZGVzYyA9IG5vcm1hbGl6ZUFuZENvbXBsZXRlUHJvcGVydHlEZXNjcmlwdG9yKGRlc2MpO1xuXG4gICAgdmFyIHRhcmdldERlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRoaXMudGFyZ2V0LCBuYW1lKTtcbiAgICB2YXIgZXh0ZW5zaWJsZSA9IE9iamVjdC5pc0V4dGVuc2libGUodGhpcy50YXJnZXQpO1xuXG4gICAgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGlzU2VhbGVkRGVzYyh0YXJnZXREZXNjKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHJlcG9ydCBub24tY29uZmlndXJhYmxlIHByb3BlcnR5ICdcIituYW1lK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiJyBhcyBub24tZXhpc3RlbnRcIik7XG4gICAgICB9XG4gICAgICBpZiAoIWV4dGVuc2libGUgJiYgdGFyZ2V0RGVzYyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gaWYgaGFuZGxlciBpcyBhbGxvd2VkIHRvIHJldHVybiB1bmRlZmluZWQsIHdlIGNhbm5vdCBndWFyYW50ZWVcbiAgICAgICAgICAvLyB0aGF0IGl0IHdpbGwgbm90IHJldHVybiBhIGRlc2NyaXB0b3IgZm9yIHRoaXMgcHJvcGVydHkgbGF0ZXIuXG4gICAgICAgICAgLy8gT25jZSBhIHByb3BlcnR5IGhhcyBiZWVuIHJlcG9ydGVkIGFzIG5vbi1leGlzdGVudCBvbiBhIG5vbi1leHRlbnNpYmxlXG4gICAgICAgICAgLy8gb2JqZWN0LCBpdCBzaG91bGQgZm9yZXZlciBiZSByZXBvcnRlZCBhcyBub24tZXhpc3RlbnRcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHJlcG9ydCBleGlzdGluZyBvd24gcHJvcGVydHkgJ1wiK25hbWUrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIicgYXMgbm9uLWV4aXN0ZW50IG9uIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0XCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvLyBhdCB0aGlzIHBvaW50LCB3ZSBrbm93IChkZXNjICE9PSB1bmRlZmluZWQpLCBpLmUuXG4gICAgLy8gdGFyZ2V0SGFuZGxlciByZXBvcnRzICduYW1lJyBhcyBhbiBleGlzdGluZyBwcm9wZXJ0eVxuXG4gICAgLy8gTm90ZTogd2UgY291bGQgY29sbGFwc2UgdGhlIGZvbGxvd2luZyB0d28gaWYtdGVzdHMgaW50byBhIHNpbmdsZVxuICAgIC8vIHRlc3QuIFNlcGFyYXRpbmcgb3V0IHRoZSBjYXNlcyB0byBpbXByb3ZlIGVycm9yIHJlcG9ydGluZy5cblxuICAgIGlmICghZXh0ZW5zaWJsZSkge1xuICAgICAgaWYgKHRhcmdldERlc2MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHJlcG9ydCBhIG5ldyBvd24gcHJvcGVydHkgJ1wiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgKyBcIicgb24gYSBub24tZXh0ZW5zaWJsZSBvYmplY3RcIik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKCFpc0NvbXBhdGlibGVEZXNjcmlwdG9yKGV4dGVuc2libGUsIHRhcmdldERlc2MsIGRlc2MpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgcmVwb3J0IGluY29tcGF0aWJsZSBwcm9wZXJ0eSBkZXNjcmlwdG9yIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZm9yIHByb3BlcnR5ICdcIituYW1lK1wiJ1wiKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYgKGRlc2MuY29uZmlndXJhYmxlID09PSBmYWxzZSkge1xuICAgICAgaWYgKHRhcmdldERlc2MgPT09IHVuZGVmaW5lZCB8fCB0YXJnZXREZXNjLmNvbmZpZ3VyYWJsZSA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBpZiB0aGUgcHJvcGVydHkgaXMgY29uZmlndXJhYmxlIG9yIG5vbi1leGlzdGVudCBvbiB0aGUgdGFyZ2V0LFxuICAgICAgICAvLyBidXQgaXMgcmVwb3J0ZWQgYXMgYSBub24tY29uZmlndXJhYmxlIHByb3BlcnR5LCBpdCBtYXkgbGF0ZXIgYmVcbiAgICAgICAgLy8gcmVwb3J0ZWQgYXMgY29uZmlndXJhYmxlIG9yIG5vbi1leGlzdGVudCwgd2hpY2ggdmlvbGF0ZXMgdGhlXG4gICAgICAgIC8vIGludmFyaWFudCB0aGF0IGlmIHRoZSBwcm9wZXJ0eSBtaWdodCBjaGFuZ2Ugb3IgZGlzYXBwZWFyLCB0aGVcbiAgICAgICAgLy8gY29uZmlndXJhYmxlIGF0dHJpYnV0ZSBtdXN0IGJlIHRydWUuXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgXCJjYW5ub3QgcmVwb3J0IGEgbm9uLWNvbmZpZ3VyYWJsZSBkZXNjcmlwdG9yIFwiICtcbiAgICAgICAgICBcImZvciBjb25maWd1cmFibGUgb3Igbm9uLWV4aXN0ZW50IHByb3BlcnR5ICdcIiArIG5hbWUgKyBcIidcIik7XG4gICAgICB9XG4gICAgICBpZiAoJ3dyaXRhYmxlJyBpbiBkZXNjICYmIGRlc2Mud3JpdGFibGUgPT09IGZhbHNlKSB7XG4gICAgICAgIGlmICh0YXJnZXREZXNjLndyaXRhYmxlID09PSB0cnVlKSB7XG4gICAgICAgICAgLy8gaWYgdGhlIHByb3BlcnR5IGlzIG5vbi1jb25maWd1cmFibGUsIHdyaXRhYmxlIG9uIHRoZSB0YXJnZXQsXG4gICAgICAgICAgLy8gYnV0IGlzIHJlcG9ydGVkIGFzIG5vbi1jb25maWd1cmFibGUsIG5vbi13cml0YWJsZSwgaXQgbWF5IGxhdGVyXG4gICAgICAgICAgLy8gYmUgcmVwb3J0ZWQgYXMgbm9uLWNvbmZpZ3VyYWJsZSwgd3JpdGFibGUgYWdhaW4sIHdoaWNoIHZpb2xhdGVzXG4gICAgICAgICAgLy8gdGhlIGludmFyaWFudCB0aGF0IGEgbm9uLWNvbmZpZ3VyYWJsZSwgbm9uLXdyaXRhYmxlIHByb3BlcnR5XG4gICAgICAgICAgLy8gbWF5IG5vdCBjaGFuZ2Ugc3RhdGUuXG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgIFwiY2Fubm90IHJlcG9ydCBub24tY29uZmlndXJhYmxlLCB3cml0YWJsZSBwcm9wZXJ0eSAnXCIgKyBuYW1lICtcbiAgICAgICAgICAgIFwiJyBhcyBub24tY29uZmlndXJhYmxlLCBub24td3JpdGFibGVcIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZGVzYztcbiAgfSxcblxuICAvKipcbiAgICogSW4gdGhlIGRpcmVjdCBwcm94aWVzIGRlc2lnbiB3aXRoIHJlZmFjdG9yZWQgcHJvdG90eXBlIGNsaW1iaW5nLFxuICAgKiB0aGlzIHRyYXAgaXMgZGVwcmVjYXRlZC4gRm9yIHByb3hpZXMtYXMtcHJvdG90eXBlcywgaW5zdGVhZFxuICAgKiBvZiBjYWxsaW5nIHRoaXMgdHJhcCwgdGhlIGdldCwgc2V0LCBoYXMgb3IgZW51bWVyYXRlIHRyYXBzIGFyZVxuICAgKiBjYWxsZWQgaW5zdGVhZC5cbiAgICpcbiAgICogSW4gdGhpcyBpbXBsZW1lbnRhdGlvbiwgd2UgXCJhYnVzZVwiIGdldFByb3BlcnR5RGVzY3JpcHRvciB0b1xuICAgKiBzdXBwb3J0IHRyYXBwaW5nIHRoZSBnZXQgb3Igc2V0IHRyYXBzIGZvciBwcm94aWVzLWFzLXByb3RvdHlwZXMuXG4gICAqIFdlIGRvIHRoaXMgYnkgcmV0dXJuaW5nIGEgZ2V0dGVyL3NldHRlciBwYWlyIHRoYXQgaW52b2tlc1xuICAgKiB0aGUgY29ycmVzcG9uZGluZyB0cmFwcy5cbiAgICpcbiAgICogV2hpbGUgdGhpcyBoYWNrIHdvcmtzIGZvciBpbmhlcml0ZWQgcHJvcGVydHkgYWNjZXNzLCBpdCBoYXMgc29tZVxuICAgKiBxdWlya3M6XG4gICAqXG4gICAqIEluIEZpcmVmb3gsIHRoaXMgdHJhcCBpcyBvbmx5IGNhbGxlZCBhZnRlciBhIHByaW9yIGludm9jYXRpb25cbiAgICogb2YgdGhlICdoYXMnIHRyYXAgaGFzIHJldHVybmVkIHRydWUuIEhlbmNlLCBleHBlY3QgdGhlIGZvbGxvd2luZ1xuICAgKiBiZWhhdmlvcjpcbiAgICogPGNvZGU+XG4gICAqIHZhciBjaGlsZCA9IE9iamVjdC5jcmVhdGUoUHJveHkodGFyZ2V0LCBoYW5kbGVyKSk7XG4gICAqIGNoaWxkW25hbWVdIC8vIHRyaWdnZXJzIGhhbmRsZXIuaGFzKHRhcmdldCwgbmFtZSlcbiAgICogLy8gaWYgdGhhdCByZXR1cm5zIHRydWUsIHRyaWdnZXJzIGhhbmRsZXIuZ2V0KHRhcmdldCwgbmFtZSwgY2hpbGQpXG4gICAqIDwvY29kZT5cbiAgICpcbiAgICogT24gdjgsIHRoZSAnaW4nIG9wZXJhdG9yLCB3aGVuIGFwcGxpZWQgdG8gYW4gb2JqZWN0IHRoYXQgaW5oZXJpdHNcbiAgICogZnJvbSBhIHByb3h5LCB3aWxsIGNhbGwgZ2V0UHJvcGVydHlEZXNjcmlwdG9yIGFuZCB3YWxrIHRoZSBwcm90by1jaGFpbi5cbiAgICogVGhhdCBjYWxscyB0aGUgYmVsb3cgZ2V0UHJvcGVydHlEZXNjcmlwdG9yIHRyYXAgb24gdGhlIHByb3h5LiBUaGVcbiAgICogcmVzdWx0IG9mIHRoZSAnaW4nLW9wZXJhdG9yIGlzIHRoZW4gZGV0ZXJtaW5lZCBieSB3aGV0aGVyIHRoaXMgdHJhcFxuICAgKiByZXR1cm5zIHVuZGVmaW5lZCBvciBhIHByb3BlcnR5IGRlc2NyaXB0b3Igb2JqZWN0LiBUaGF0IGlzIHdoeVxuICAgKiB3ZSBmaXJzdCBleHBsaWNpdGx5IHRyaWdnZXIgdGhlICdoYXMnIHRyYXAgdG8gZGV0ZXJtaW5lIHdoZXRoZXJcbiAgICogdGhlIHByb3BlcnR5IGV4aXN0cy5cbiAgICpcbiAgICogVGhpcyBoYXMgdGhlIHNpZGUtZWZmZWN0IHRoYXQgd2hlbiBlbnVtZXJhdGluZyBwcm9wZXJ0aWVzIG9uXG4gICAqIGFuIG9iamVjdCB0aGF0IGluaGVyaXRzIGZyb20gYSBwcm94eSBpbiB2OCwgb25seSBwcm9wZXJ0aWVzXG4gICAqIGZvciB3aGljaCAnaGFzJyByZXR1cm5zIHRydWUgYXJlIHJldHVybmVkOlxuICAgKlxuICAgKiA8Y29kZT5cbiAgICogdmFyIGNoaWxkID0gT2JqZWN0LmNyZWF0ZShQcm94eSh0YXJnZXQsIGhhbmRsZXIpKTtcbiAgICogZm9yICh2YXIgcHJvcCBpbiBjaGlsZCkge1xuICAgKiAgIC8vIG9ubHkgZW51bWVyYXRlcyBwcm9wIGlmIChwcm9wIGluIGNoaWxkKSByZXR1cm5zIHRydWVcbiAgICogfVxuICAgKiA8L2NvZGU+XG4gICAqL1xuICBnZXRQcm9wZXJ0eURlc2NyaXB0b3I6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgaGFuZGxlciA9IHRoaXM7XG5cbiAgICBpZiAoIWhhbmRsZXIuaGFzKG5hbWUpKSByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBoYW5kbGVyLmdldCh0aGlzLCBuYW1lKTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICBpZiAoaGFuZGxlci5zZXQodGhpcywgbmFtZSwgdmFsKSkge1xuICAgICAgICAgIHJldHVybiB2YWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImZhaWxlZCBhc3NpZ25tZW50IHRvIFwiK25hbWUpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH07XG4gIH0sXG5cbiAgLyoqXG4gICAqIElmIG5hbWUgZGVub3RlcyBhIGZpeGVkIHByb3BlcnR5LCBjaGVjayBmb3IgaW5jb21wYXRpYmxlIGNoYW5nZXMuXG4gICAqIElmIHRoZSBwcm94eSBpcyBub24tZXh0ZW5zaWJsZSwgY2hlY2sgdGhhdCBuZXcgcHJvcGVydGllcyBhcmUgcmVqZWN0ZWQuXG4gICAqL1xuICBkZWZpbmVQcm9wZXJ0eTogZnVuY3Rpb24obmFtZSwgZGVzYykge1xuICAgIC8vIFRPRE8odHZjdXRzZW0pOiB0aGUgY3VycmVudCB0cmFjZW1vbmtleSBpbXBsZW1lbnRhdGlvbiBvZiBwcm94aWVzXG4gICAgLy8gYXV0by1jb21wbGV0ZXMgJ2Rlc2MnLCB3aGljaCBpcyBub3QgY29ycmVjdC4gJ2Rlc2MnIHNob3VsZCBiZVxuICAgIC8vIG5vcm1hbGl6ZWQsIGJ1dCBub3QgY29tcGxldGVkLiBDb25zaWRlcjpcbiAgICAvLyBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJveHksICdmb28nLCB7ZW51bWVyYWJsZTpmYWxzZX0pXG4gICAgLy8gVGhpcyB0cmFwIHdpbGwgcmVjZWl2ZSBkZXNjID1cbiAgICAvLyAge3ZhbHVlOnVuZGVmaW5lZCx3cml0YWJsZTpmYWxzZSxlbnVtZXJhYmxlOmZhbHNlLGNvbmZpZ3VyYWJsZTpmYWxzZX1cbiAgICAvLyBUaGlzIHdpbGwgYWxzbyBzZXQgYWxsIG90aGVyIGF0dHJpYnV0ZXMgdG8gdGhlaXIgZGVmYXVsdCB2YWx1ZSxcbiAgICAvLyB3aGljaCBpcyB1bmV4cGVjdGVkIGFuZCBkaWZmZXJlbnQgZnJvbSBbW0RlZmluZU93blByb3BlcnR5XV0uXG4gICAgLy8gQnVnIGZpbGVkOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02MDEzMjlcblxuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwiZGVmaW5lUHJvcGVydHlcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gUmVmbGVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLnRhcmdldCwgbmFtZSwgZGVzYyk7XG4gICAgfVxuXG4gICAgbmFtZSA9IFN0cmluZyhuYW1lKTtcbiAgICB2YXIgZGVzY09iaiA9IG5vcm1hbGl6ZVByb3BlcnR5RGVzY3JpcHRvcihkZXNjKTtcbiAgICB2YXIgc3VjY2VzcyA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0LCBuYW1lLCBkZXNjT2JqKTtcbiAgICBzdWNjZXNzID0gISFzdWNjZXNzOyAvLyBjb2VyY2UgdG8gQm9vbGVhblxuXG4gICAgaWYgKHN1Y2Nlc3MgPT09IHRydWUpIHtcblxuICAgICAgdmFyIHRhcmdldERlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRoaXMudGFyZ2V0LCBuYW1lKTtcbiAgICAgIHZhciBleHRlbnNpYmxlID0gT2JqZWN0LmlzRXh0ZW5zaWJsZSh0aGlzLnRhcmdldCk7XG5cbiAgICAgIC8vIE5vdGU6IHdlIGNvdWxkIGNvbGxhcHNlIHRoZSBmb2xsb3dpbmcgdHdvIGlmLXRlc3RzIGludG8gYSBzaW5nbGVcbiAgICAgIC8vIHRlc3QuIFNlcGFyYXRpbmcgb3V0IHRoZSBjYXNlcyB0byBpbXByb3ZlIGVycm9yIHJlcG9ydGluZy5cblxuICAgICAgaWYgKCFleHRlbnNpYmxlKSB7XG4gICAgICAgIGlmICh0YXJnZXREZXNjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHN1Y2Nlc3NmdWxseSBhZGQgYSBuZXcgcHJvcGVydHkgJ1wiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSArIFwiJyB0byBhIG5vbi1leHRlbnNpYmxlIG9iamVjdFwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodGFyZ2V0RGVzYyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICghaXNDb21wYXRpYmxlRGVzY3JpcHRvcihleHRlbnNpYmxlLCB0YXJnZXREZXNjLCBkZXNjKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgZGVmaW5lIGluY29tcGF0aWJsZSBwcm9wZXJ0eSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZGVzY3JpcHRvciBmb3IgcHJvcGVydHkgJ1wiK25hbWUrXCInXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc0RhdGFEZXNjcmlwdG9yKHRhcmdldERlc2MpICYmXG4gICAgICAgICAgICB0YXJnZXREZXNjLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UgJiZcbiAgICAgICAgICAgIHRhcmdldERlc2Mud3JpdGFibGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgIGlmIChkZXNjLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UgJiYgZGVzYy53cml0YWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgLy8gaWYgdGhlIHByb3BlcnR5IGlzIG5vbi1jb25maWd1cmFibGUsIHdyaXRhYmxlIG9uIHRoZSB0YXJnZXRcbiAgICAgICAgICAgICAgLy8gYnV0IHdhcyBzdWNjZXNzZnVsbHkgcmVwb3J0ZWQgdG8gYmUgdXBkYXRlZCB0b1xuICAgICAgICAgICAgICAvLyBub24tY29uZmlndXJhYmxlLCBub24td3JpdGFibGUsIGl0IGNhbiBsYXRlciBiZSByZXBvcnRlZFxuICAgICAgICAgICAgICAvLyBhZ2FpbiBhcyBub24tY29uZmlndXJhYmxlLCB3cml0YWJsZSwgd2hpY2ggdmlvbGF0ZXNcbiAgICAgICAgICAgICAgLy8gdGhlIGludmFyaWFudCB0aGF0IG5vbi1jb25maWd1cmFibGUsIG5vbi13cml0YWJsZSBwcm9wZXJ0aWVzXG4gICAgICAgICAgICAgIC8vIGNhbm5vdCBjaGFuZ2Ugc3RhdGVcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgICAgICBcImNhbm5vdCBzdWNjZXNzZnVsbHkgZGVmaW5lIG5vbi1jb25maWd1cmFibGUsIHdyaXRhYmxlIFwiICtcbiAgICAgICAgICAgICAgICBcIiBwcm9wZXJ0eSAnXCIgKyBuYW1lICsgXCInIGFzIG5vbi1jb25maWd1cmFibGUsIG5vbi13cml0YWJsZVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChkZXNjLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UgJiYgIWlzU2VhbGVkRGVzYyh0YXJnZXREZXNjKSkge1xuICAgICAgICAvLyBpZiB0aGUgcHJvcGVydHkgaXMgY29uZmlndXJhYmxlIG9yIG5vbi1leGlzdGVudCBvbiB0aGUgdGFyZ2V0LFxuICAgICAgICAvLyBidXQgaXMgc3VjY2Vzc2Z1bGx5IGJlaW5nIHJlZGVmaW5lZCBhcyBhIG5vbi1jb25maWd1cmFibGUgcHJvcGVydHksXG4gICAgICAgIC8vIGl0IG1heSBsYXRlciBiZSByZXBvcnRlZCBhcyBjb25maWd1cmFibGUgb3Igbm9uLWV4aXN0ZW50LCB3aGljaCB2aW9sYXRlc1xuICAgICAgICAvLyB0aGUgaW52YXJpYW50IHRoYXQgaWYgdGhlIHByb3BlcnR5IG1pZ2h0IGNoYW5nZSBvciBkaXNhcHBlYXIsIHRoZVxuICAgICAgICAvLyBjb25maWd1cmFibGUgYXR0cmlidXRlIG11c3QgYmUgdHJ1ZS5cbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBcImNhbm5vdCBzdWNjZXNzZnVsbHkgZGVmaW5lIGEgbm9uLWNvbmZpZ3VyYWJsZSBcIiArXG4gICAgICAgICAgXCJkZXNjcmlwdG9yIGZvciBjb25maWd1cmFibGUgb3Igbm9uLWV4aXN0ZW50IHByb3BlcnR5ICdcIiArXG4gICAgICAgICAgbmFtZSArIFwiJ1wiKTtcbiAgICAgIH1cblxuICAgIH1cblxuICAgIHJldHVybiBzdWNjZXNzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBPbiBzdWNjZXNzLCBjaGVjayB3aGV0aGVyIHRoZSB0YXJnZXQgb2JqZWN0IGlzIGluZGVlZCBub24tZXh0ZW5zaWJsZS5cbiAgICovXG4gIHByZXZlbnRFeHRlbnNpb25zOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcInByZXZlbnRFeHRlbnNpb25zXCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIFJlZmxlY3QucHJldmVudEV4dGVuc2lvbnModGhpcy50YXJnZXQpO1xuICAgIH1cblxuICAgIHZhciBzdWNjZXNzID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQpO1xuICAgIHN1Y2Nlc3MgPSAhIXN1Y2Nlc3M7IC8vIGNvZXJjZSB0byBCb29sZWFuXG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgIGlmIChPYmplY3RfaXNFeHRlbnNpYmxlKHRoaXMudGFyZ2V0KSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2FuJ3QgcmVwb3J0IGV4dGVuc2libGUgb2JqZWN0IGFzIG5vbi1leHRlbnNpYmxlOiBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRhcmdldCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdWNjZXNzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBJZiBuYW1lIGRlbm90ZXMgYSBzZWFsZWQgcHJvcGVydHksIGNoZWNrIHdoZXRoZXIgaGFuZGxlciByZWplY3RzLlxuICAgKi9cbiAgZGVsZXRlOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJkZWxldGVQcm9wZXJ0eVwiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiBSZWZsZWN0LmRlbGV0ZVByb3BlcnR5KHRoaXMudGFyZ2V0LCBuYW1lKTtcbiAgICB9XG5cbiAgICBuYW1lID0gU3RyaW5nKG5hbWUpO1xuICAgIHZhciByZXMgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCwgbmFtZSk7XG4gICAgcmVzID0gISFyZXM7IC8vIGNvZXJjZSB0byBCb29sZWFuXG5cbiAgICB2YXIgdGFyZ2V0RGVzYztcbiAgICBpZiAocmVzID09PSB0cnVlKSB7XG4gICAgICB0YXJnZXREZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0aGlzLnRhcmdldCwgbmFtZSk7XG4gICAgICBpZiAodGFyZ2V0RGVzYyAhPT0gdW5kZWZpbmVkICYmIHRhcmdldERlc2MuY29uZmlndXJhYmxlID09PSBmYWxzZSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicHJvcGVydHkgJ1wiICsgbmFtZSArIFwiJyBpcyBub24tY29uZmlndXJhYmxlIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiYW5kIGNhbid0IGJlIGRlbGV0ZWRcIik7XG4gICAgICB9XG4gICAgICBpZiAodGFyZ2V0RGVzYyAhPT0gdW5kZWZpbmVkICYmICFPYmplY3RfaXNFeHRlbnNpYmxlKHRoaXMudGFyZ2V0KSkge1xuICAgICAgICAvLyBpZiB0aGUgcHJvcGVydHkgc3RpbGwgZXhpc3RzIG9uIGEgbm9uLWV4dGVuc2libGUgdGFyZ2V0IGJ1dFxuICAgICAgICAvLyBpcyByZXBvcnRlZCBhcyBzdWNjZXNzZnVsbHkgZGVsZXRlZCwgaXQgbWF5IGxhdGVyIGJlIHJlcG9ydGVkXG4gICAgICAgIC8vIGFzIHByZXNlbnQsIHdoaWNoIHZpb2xhdGVzIHRoZSBpbnZhcmlhbnQgdGhhdCBhbiBvd24gcHJvcGVydHksXG4gICAgICAgIC8vIGRlbGV0ZWQgZnJvbSBhIG5vbi1leHRlbnNpYmxlIG9iamVjdCBjYW5ub3QgcmVhcHBlYXIuXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgXCJjYW5ub3Qgc3VjY2Vzc2Z1bGx5IGRlbGV0ZSBleGlzdGluZyBwcm9wZXJ0eSAnXCIgKyBuYW1lICtcbiAgICAgICAgICBcIicgb24gYSBub24tZXh0ZW5zaWJsZSBvYmplY3RcIik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbiAgfSxcblxuICAvKipcbiAgICogVGhlIGdldE93blByb3BlcnR5TmFtZXMgdHJhcCB3YXMgcmVwbGFjZWQgYnkgdGhlIG93bktleXMgdHJhcCxcbiAgICogd2hpY2ggbm93IGFsc28gcmV0dXJucyBhbiBhcnJheSAob2Ygc3RyaW5ncyBvciBzeW1ib2xzKSBhbmRcbiAgICogd2hpY2ggcGVyZm9ybXMgdGhlIHNhbWUgcmlnb3JvdXMgaW52YXJpYW50IGNoZWNrcyBhcyBnZXRPd25Qcm9wZXJ0eU5hbWVzXG4gICAqXG4gICAqIFNlZSBpc3N1ZSAjNDggb24gaG93IHRoaXMgdHJhcCBjYW4gc3RpbGwgZ2V0IGludm9rZWQgYnkgZXh0ZXJuYWwgbGlic1xuICAgKiB0aGF0IGRvbid0IHVzZSB0aGUgcGF0Y2hlZCBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyBmdW5jdGlvbi5cbiAgICovXG4gIGdldE93blByb3BlcnR5TmFtZXM6IGZ1bmN0aW9uKCkge1xuICAgIC8vIE5vdGU6IHJlbW92ZWQgZGVwcmVjYXRpb24gd2FybmluZyB0byBhdm9pZCBkZXBlbmRlbmN5IG9uICdjb25zb2xlJ1xuICAgIC8vIChhbmQgb24gbm9kZSwgc2hvdWxkIGFueXdheSB1c2UgdXRpbC5kZXByZWNhdGUpLiBEZXByZWNhdGlvbiB3YXJuaW5nc1xuICAgIC8vIGNhbiBhbHNvIGJlIGFubm95aW5nIHdoZW4gdGhleSBhcmUgb3V0c2lkZSBvZiB0aGUgdXNlcidzIGNvbnRyb2wsIGUuZy5cbiAgICAvLyB3aGVuIGFuIGV4dGVybmFsIGxpYnJhcnkgY2FsbHMgdW5wYXRjaGVkIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzLlxuICAgIC8vIFNpbmNlIHRoZXJlIGlzIGEgY2xlYW4gZmFsbGJhY2sgdG8gYG93bktleXNgLCB0aGUgZmFjdCB0aGF0IHRoZVxuICAgIC8vIGRlcHJlY2F0ZWQgbWV0aG9kIGlzIHN0aWxsIGNhbGxlZCBpcyBtb3N0bHkgaGFybWxlc3MgYW55d2F5LlxuICAgIC8vIFNlZSBhbHNvIGlzc3VlcyAjNjUgYW5kICM2Ni5cbiAgICAvLyBjb25zb2xlLndhcm4oXCJnZXRPd25Qcm9wZXJ0eU5hbWVzIHRyYXAgaXMgZGVwcmVjYXRlZC4gVXNlIG93bktleXMgaW5zdGVhZFwiKTtcbiAgICByZXR1cm4gdGhpcy5vd25LZXlzKCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIENoZWNrcyB3aGV0aGVyIHRoZSB0cmFwIHJlc3VsdCBkb2VzIG5vdCBjb250YWluIGFueSBuZXcgcHJvcGVydGllc1xuICAgKiBpZiB0aGUgcHJveHkgaXMgbm9uLWV4dGVuc2libGUuXG4gICAqXG4gICAqIEFueSBvd24gbm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0aWVzIG9mIHRoZSB0YXJnZXQgdGhhdCBhcmUgbm90IGluY2x1ZGVkXG4gICAqIGluIHRoZSB0cmFwIHJlc3VsdCBnaXZlIHJpc2UgdG8gYSBUeXBlRXJyb3IuIEFzIHN1Y2gsIHdlIGNoZWNrIHdoZXRoZXIgdGhlXG4gICAqIHJldHVybmVkIHJlc3VsdCBjb250YWlucyBhdCBsZWFzdCBhbGwgc2VhbGVkIHByb3BlcnRpZXMgb2YgdGhlIHRhcmdldFxuICAgKiBvYmplY3QuXG4gICAqXG4gICAqIEFkZGl0aW9uYWxseSwgdGhlIHRyYXAgcmVzdWx0IGlzIG5vcm1hbGl6ZWQuXG4gICAqIEluc3RlYWQgb2YgcmV0dXJuaW5nIHRoZSB0cmFwIHJlc3VsdCBkaXJlY3RseTpcbiAgICogIC0gY3JlYXRlIGFuZCByZXR1cm4gYSBmcmVzaCBBcnJheSxcbiAgICogIC0gb2Ygd2hpY2ggZWFjaCBlbGVtZW50IGlzIGNvZXJjZWQgdG8gYSBTdHJpbmdcbiAgICpcbiAgICogVGhpcyB0cmFwIGlzIGNhbGxlZCBhLm8uIGJ5IFJlZmxlY3Qub3duS2V5cywgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXNcbiAgICogYW5kIE9iamVjdC5rZXlzICh0aGUgbGF0dGVyIGZpbHRlcnMgb3V0IG9ubHkgdGhlIGVudW1lcmFibGUgb3duIHByb3BlcnRpZXMpLlxuICAgKi9cbiAgb3duS2V5czogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJvd25LZXlzXCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIFJlZmxlY3Qub3duS2V5cyh0aGlzLnRhcmdldCk7XG4gICAgfVxuXG4gICAgdmFyIHRyYXBSZXN1bHQgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCk7XG5cbiAgICAvLyBwcm9wTmFtZXMgaXMgdXNlZCBhcyBhIHNldCBvZiBzdHJpbmdzXG4gICAgdmFyIHByb3BOYW1lcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgdmFyIG51bVByb3BzID0gK3RyYXBSZXN1bHQubGVuZ3RoO1xuICAgIHZhciByZXN1bHQgPSBuZXcgQXJyYXkobnVtUHJvcHMpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBudW1Qcm9wczsgaSsrKSB7XG4gICAgICB2YXIgcyA9IFN0cmluZyh0cmFwUmVzdWx0W2ldKTtcbiAgICAgIGlmICghT2JqZWN0LmlzRXh0ZW5zaWJsZSh0aGlzLnRhcmdldCkgJiYgIWlzRml4ZWQocywgdGhpcy50YXJnZXQpKSB7XG4gICAgICAgIC8vIG5vbi1leHRlbnNpYmxlIHByb3hpZXMgZG9uJ3QgdG9sZXJhdGUgbmV3IG93biBwcm9wZXJ0eSBuYW1lc1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwib3duS2V5cyB0cmFwIGNhbm5vdCBsaXN0IGEgbmV3IFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicHJvcGVydHkgJ1wiK3MrXCInIG9uIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0XCIpO1xuICAgICAgfVxuXG4gICAgICBwcm9wTmFtZXNbc10gPSB0cnVlO1xuICAgICAgcmVzdWx0W2ldID0gcztcbiAgICB9XG5cbiAgICB2YXIgb3duUHJvcHMgPSBPYmplY3RfZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzLnRhcmdldCk7XG4gICAgdmFyIHRhcmdldCA9IHRoaXMudGFyZ2V0O1xuICAgIG93blByb3BzLmZvckVhY2goZnVuY3Rpb24gKG93blByb3ApIHtcbiAgICAgIGlmICghcHJvcE5hbWVzW293blByb3BdKSB7XG4gICAgICAgIGlmIChpc1NlYWxlZChvd25Qcm9wLCB0YXJnZXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm93bktleXMgdHJhcCBmYWlsZWQgdG8gaW5jbHVkZSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0eSAnXCIrb3duUHJvcCtcIidcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFPYmplY3QuaXNFeHRlbnNpYmxlKHRhcmdldCkgJiZcbiAgICAgICAgICAgIGlzRml4ZWQob3duUHJvcCwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgLy8gaWYgaGFuZGxlciBpcyBhbGxvd2VkIHRvIHJlcG9ydCBvd25Qcm9wIGFzIG5vbi1leGlzdGVudCxcbiAgICAgICAgICAgIC8vIHdlIGNhbm5vdCBndWFyYW50ZWUgdGhhdCBpdCB3aWxsIG5ldmVyIGxhdGVyIHJlcG9ydCBpdCBhc1xuICAgICAgICAgICAgLy8gZXhpc3RlbnQuIE9uY2UgYSBwcm9wZXJ0eSBoYXMgYmVlbiByZXBvcnRlZCBhcyBub24tZXhpc3RlbnRcbiAgICAgICAgICAgIC8vIG9uIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0LCBpdCBzaG91bGQgZm9yZXZlciBiZSByZXBvcnRlZCBhc1xuICAgICAgICAgICAgLy8gbm9uLWV4aXN0ZW50XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwib3duS2V5cyB0cmFwIGNhbm5vdCByZXBvcnQgZXhpc3Rpbmcgb3duIHByb3BlcnR5ICdcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3duUHJvcCtcIicgYXMgbm9uLWV4aXN0ZW50IG9uIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0XCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LFxuXG4gIC8qKlxuICAgKiBDaGVja3Mgd2hldGhlciB0aGUgdHJhcCByZXN1bHQgaXMgY29uc2lzdGVudCB3aXRoIHRoZSBzdGF0ZSBvZiB0aGVcbiAgICogd3JhcHBlZCB0YXJnZXQuXG4gICAqL1xuICBpc0V4dGVuc2libGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwiaXNFeHRlbnNpYmxlXCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIFJlZmxlY3QuaXNFeHRlbnNpYmxlKHRoaXMudGFyZ2V0KTtcbiAgICB9XG5cbiAgICB2YXIgcmVzdWx0ID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQpO1xuICAgIHJlc3VsdCA9ICEhcmVzdWx0OyAvLyBjb2VyY2UgdG8gQm9vbGVhblxuICAgIHZhciBzdGF0ZSA9IE9iamVjdF9pc0V4dGVuc2libGUodGhpcy50YXJnZXQpO1xuICAgIGlmIChyZXN1bHQgIT09IHN0YXRlKSB7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgcmVwb3J0IG5vbi1leHRlbnNpYmxlIG9iamVjdCBhcyBleHRlbnNpYmxlOiBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50YXJnZXQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCByZXBvcnQgZXh0ZW5zaWJsZSBvYmplY3QgYXMgbm9uLWV4dGVuc2libGU6IFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRhcmdldCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdGF0ZTtcbiAgfSxcblxuICAvKipcbiAgICogQ2hlY2sgd2hldGhlciB0aGUgdHJhcCByZXN1bHQgY29ycmVzcG9uZHMgdG8gdGhlIHRhcmdldCdzIFtbUHJvdG90eXBlXV1cbiAgICovXG4gIGdldFByb3RvdHlwZU9mOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcImdldFByb3RvdHlwZU9mXCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIFJlZmxlY3QuZ2V0UHJvdG90eXBlT2YodGhpcy50YXJnZXQpO1xuICAgIH1cblxuICAgIHZhciBhbGxlZ2VkUHJvdG8gPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCk7XG5cbiAgICBpZiAoIU9iamVjdF9pc0V4dGVuc2libGUodGhpcy50YXJnZXQpKSB7XG4gICAgICB2YXIgYWN0dWFsUHJvdG8gPSBPYmplY3RfZ2V0UHJvdG90eXBlT2YodGhpcy50YXJnZXQpO1xuICAgICAgaWYgKCFzYW1lVmFsdWUoYWxsZWdlZFByb3RvLCBhY3R1YWxQcm90bykpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInByb3RvdHlwZSB2YWx1ZSBkb2VzIG5vdCBtYXRjaDogXCIgKyB0aGlzLnRhcmdldCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGFsbGVnZWRQcm90bztcbiAgfSxcblxuICAvKipcbiAgICogSWYgdGFyZ2V0IGlzIG5vbi1leHRlbnNpYmxlIGFuZCBzZXRQcm90b3R5cGVPZiB0cmFwIHJldHVybnMgdHJ1ZSxcbiAgICogY2hlY2sgd2hldGhlciB0aGUgdHJhcCByZXN1bHQgY29ycmVzcG9uZHMgdG8gdGhlIHRhcmdldCdzIFtbUHJvdG90eXBlXV1cbiAgICovXG4gIHNldFByb3RvdHlwZU9mOiBmdW5jdGlvbihuZXdQcm90bykge1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwic2V0UHJvdG90eXBlT2ZcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gUmVmbGVjdC5zZXRQcm90b3R5cGVPZih0aGlzLnRhcmdldCwgbmV3UHJvdG8pO1xuICAgIH1cblxuICAgIHZhciBzdWNjZXNzID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQsIG5ld1Byb3RvKTtcblxuICAgIHN1Y2Nlc3MgPSAhIXN1Y2Nlc3M7XG4gICAgaWYgKHN1Y2Nlc3MgJiYgIU9iamVjdF9pc0V4dGVuc2libGUodGhpcy50YXJnZXQpKSB7XG4gICAgICB2YXIgYWN0dWFsUHJvdG8gPSBPYmplY3RfZ2V0UHJvdG90eXBlT2YodGhpcy50YXJnZXQpO1xuICAgICAgaWYgKCFzYW1lVmFsdWUobmV3UHJvdG8sIGFjdHVhbFByb3RvKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicHJvdG90eXBlIHZhbHVlIGRvZXMgbm90IG1hdGNoOiBcIiArIHRoaXMudGFyZ2V0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3VjY2VzcztcbiAgfSxcblxuICAvKipcbiAgICogSW4gdGhlIGRpcmVjdCBwcm94aWVzIGRlc2lnbiB3aXRoIHJlZmFjdG9yZWQgcHJvdG90eXBlIGNsaW1iaW5nLFxuICAgKiB0aGlzIHRyYXAgaXMgZGVwcmVjYXRlZC4gRm9yIHByb3hpZXMtYXMtcHJvdG90eXBlcywgZm9yLWluIHdpbGxcbiAgICogY2FsbCB0aGUgZW51bWVyYXRlKCkgdHJhcC4gSWYgdGhhdCB0cmFwIGlzIG5vdCBkZWZpbmVkLCB0aGVcbiAgICogb3BlcmF0aW9uIGlzIGZvcndhcmRlZCB0byB0aGUgdGFyZ2V0LCBubyBtb3JlIGZhbGxiYWNrIG9uIHRoaXNcbiAgICogZnVuZGFtZW50YWwgdHJhcC5cbiAgICovXG4gIGdldFByb3BlcnR5TmFtZXM6IGZ1bmN0aW9uKCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJnZXRQcm9wZXJ0eU5hbWVzIHRyYXAgaXMgZGVwcmVjYXRlZFwiKTtcbiAgfSxcblxuICAvLyA9PT0gZGVyaXZlZCB0cmFwcyA9PT1cblxuICAvKipcbiAgICogSWYgbmFtZSBkZW5vdGVzIGEgZml4ZWQgcHJvcGVydHksIGNoZWNrIHdoZXRoZXIgdGhlIHRyYXAgcmV0dXJucyB0cnVlLlxuICAgKi9cbiAgaGFzOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJoYXNcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gUmVmbGVjdC5oYXModGhpcy50YXJnZXQsIG5hbWUpO1xuICAgIH1cblxuICAgIG5hbWUgPSBTdHJpbmcobmFtZSk7XG4gICAgdmFyIHJlcyA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0LCBuYW1lKTtcbiAgICByZXMgPSAhIXJlczsgLy8gY29lcmNlIHRvIEJvb2xlYW5cblxuICAgIGlmIChyZXMgPT09IGZhbHNlKSB7XG4gICAgICBpZiAoaXNTZWFsZWQobmFtZSwgdGhpcy50YXJnZXQpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgcmVwb3J0IGV4aXN0aW5nIG5vbi1jb25maWd1cmFibGUgb3duIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicHJvcGVydHkgJ1wiKyBuYW1lICsgXCInIGFzIGEgbm9uLWV4aXN0ZW50IFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicHJvcGVydHlcIik7XG4gICAgICB9XG4gICAgICBpZiAoIU9iamVjdC5pc0V4dGVuc2libGUodGhpcy50YXJnZXQpICYmXG4gICAgICAgICAgaXNGaXhlZChuYW1lLCB0aGlzLnRhcmdldCkpIHtcbiAgICAgICAgICAvLyBpZiBoYW5kbGVyIGlzIGFsbG93ZWQgdG8gcmV0dXJuIGZhbHNlLCB3ZSBjYW5ub3QgZ3VhcmFudGVlXG4gICAgICAgICAgLy8gdGhhdCBpdCB3aWxsIG5vdCByZXR1cm4gdHJ1ZSBmb3IgdGhpcyBwcm9wZXJ0eSBsYXRlci5cbiAgICAgICAgICAvLyBPbmNlIGEgcHJvcGVydHkgaGFzIGJlZW4gcmVwb3J0ZWQgYXMgbm9uLWV4aXN0ZW50IG9uIGEgbm9uLWV4dGVuc2libGVcbiAgICAgICAgICAvLyBvYmplY3QsIGl0IHNob3VsZCBmb3JldmVyIGJlIHJlcG9ydGVkIGFzIG5vbi1leGlzdGVudFxuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgcmVwb3J0IGV4aXN0aW5nIG93biBwcm9wZXJ0eSAnXCIrbmFtZStcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiJyBhcyBub24tZXhpc3RlbnQgb24gYSBub24tZXh0ZW5zaWJsZSBvYmplY3RcIik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaWYgcmVzID09PSB0cnVlLCB3ZSBkb24ndCBuZWVkIHRvIGNoZWNrIGZvciBleHRlbnNpYmlsaXR5XG4gICAgLy8gZXZlbiBmb3IgYSBub24tZXh0ZW5zaWJsZSBwcm94eSB0aGF0IGhhcyBubyBvd24gbmFtZSBwcm9wZXJ0eSxcbiAgICAvLyB0aGUgcHJvcGVydHkgbWF5IGhhdmUgYmVlbiBpbmhlcml0ZWRcblxuICAgIHJldHVybiByZXM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIElmIG5hbWUgZGVub3RlcyBhIGZpeGVkIG5vbi1jb25maWd1cmFibGUsIG5vbi13cml0YWJsZSBkYXRhIHByb3BlcnR5LFxuICAgKiBjaGVjayBpdHMgcmV0dXJuIHZhbHVlIGFnYWluc3QgdGhlIHByZXZpb3VzbHkgYXNzZXJ0ZWQgdmFsdWUgb2YgdGhlXG4gICAqIGZpeGVkIHByb3BlcnR5LlxuICAgKi9cbiAgZ2V0OiBmdW5jdGlvbihyZWNlaXZlciwgbmFtZSkge1xuXG4gICAgLy8gZXhwZXJpbWVudGFsIHN1cHBvcnQgZm9yIGludm9rZSgpIHRyYXAgb24gcGxhdGZvcm1zIHRoYXRcbiAgICAvLyBzdXBwb3J0IF9fbm9TdWNoTWV0aG9kX19cbiAgICAvKlxuICAgIGlmIChuYW1lID09PSAnX19ub1N1Y2hNZXRob2RfXycpIHtcbiAgICAgIHZhciBoYW5kbGVyID0gdGhpcztcbiAgICAgIHJldHVybiBmdW5jdGlvbihuYW1lLCBhcmdzKSB7XG4gICAgICAgIHJldHVybiBoYW5kbGVyLmludm9rZShyZWNlaXZlciwgbmFtZSwgYXJncyk7XG4gICAgICB9XG4gICAgfVxuICAgICovXG5cbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcImdldFwiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiBSZWZsZWN0LmdldCh0aGlzLnRhcmdldCwgbmFtZSwgcmVjZWl2ZXIpO1xuICAgIH1cblxuICAgIG5hbWUgPSBTdHJpbmcobmFtZSk7XG4gICAgdmFyIHJlcyA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0LCBuYW1lLCByZWNlaXZlcik7XG5cbiAgICB2YXIgZml4ZWREZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0aGlzLnRhcmdldCwgbmFtZSk7XG4gICAgLy8gY2hlY2sgY29uc2lzdGVuY3kgb2YgdGhlIHJldHVybmVkIHZhbHVlXG4gICAgaWYgKGZpeGVkRGVzYyAhPT0gdW5kZWZpbmVkKSB7IC8vIGdldHRpbmcgYW4gZXhpc3RpbmcgcHJvcGVydHlcbiAgICAgIGlmIChpc0RhdGFEZXNjcmlwdG9yKGZpeGVkRGVzYykgJiZcbiAgICAgICAgICBmaXhlZERlc2MuY29uZmlndXJhYmxlID09PSBmYWxzZSAmJlxuICAgICAgICAgIGZpeGVkRGVzYy53cml0YWJsZSA9PT0gZmFsc2UpIHsgLy8gb3duIGZyb3plbiBkYXRhIHByb3BlcnR5XG4gICAgICAgIGlmICghc2FtZVZhbHVlKHJlcywgZml4ZWREZXNjLnZhbHVlKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgcmVwb3J0IGluY29uc2lzdGVudCB2YWx1ZSBmb3IgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm5vbi13cml0YWJsZSwgbm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0eSAnXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lK1wiJ1wiKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHsgLy8gaXQncyBhbiBhY2Nlc3NvciBwcm9wZXJ0eVxuICAgICAgICBpZiAoaXNBY2Nlc3NvckRlc2NyaXB0b3IoZml4ZWREZXNjKSAmJlxuICAgICAgICAgICAgZml4ZWREZXNjLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UgJiZcbiAgICAgICAgICAgIGZpeGVkRGVzYy5nZXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGlmIChyZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm11c3QgcmVwb3J0IHVuZGVmaW5lZCBmb3Igbm9uLWNvbmZpZ3VyYWJsZSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJhY2Nlc3NvciBwcm9wZXJ0eSAnXCIrbmFtZStcIicgd2l0aG91dCBnZXR0ZXJcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbiAgfSxcblxuICAvKipcbiAgICogSWYgbmFtZSBkZW5vdGVzIGEgZml4ZWQgbm9uLWNvbmZpZ3VyYWJsZSwgbm9uLXdyaXRhYmxlIGRhdGEgcHJvcGVydHksXG4gICAqIGNoZWNrIHRoYXQgdGhlIHRyYXAgcmVqZWN0cyB0aGUgYXNzaWdubWVudC5cbiAgICovXG4gIHNldDogZnVuY3Rpb24ocmVjZWl2ZXIsIG5hbWUsIHZhbCkge1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwic2V0XCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIFJlZmxlY3Quc2V0KHRoaXMudGFyZ2V0LCBuYW1lLCB2YWwsIHJlY2VpdmVyKTtcbiAgICB9XG5cbiAgICBuYW1lID0gU3RyaW5nKG5hbWUpO1xuICAgIHZhciByZXMgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCwgbmFtZSwgdmFsLCByZWNlaXZlcik7XG4gICAgcmVzID0gISFyZXM7IC8vIGNvZXJjZSB0byBCb29sZWFuXG5cbiAgICAvLyBpZiBzdWNjZXNzIGlzIHJlcG9ydGVkLCBjaGVjayB3aGV0aGVyIHByb3BlcnR5IGlzIHRydWx5IGFzc2lnbmFibGVcbiAgICBpZiAocmVzID09PSB0cnVlKSB7XG4gICAgICB2YXIgZml4ZWREZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0aGlzLnRhcmdldCwgbmFtZSk7XG4gICAgICBpZiAoZml4ZWREZXNjICE9PSB1bmRlZmluZWQpIHsgLy8gc2V0dGluZyBhbiBleGlzdGluZyBwcm9wZXJ0eVxuICAgICAgICBpZiAoaXNEYXRhRGVzY3JpcHRvcihmaXhlZERlc2MpICYmXG4gICAgICAgICAgICBmaXhlZERlc2MuY29uZmlndXJhYmxlID09PSBmYWxzZSAmJlxuICAgICAgICAgICAgZml4ZWREZXNjLndyaXRhYmxlID09PSBmYWxzZSkge1xuICAgICAgICAgIGlmICghc2FtZVZhbHVlKHZhbCwgZml4ZWREZXNjLnZhbHVlKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCBzdWNjZXNzZnVsbHkgYXNzaWduIHRvIGEgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibm9uLXdyaXRhYmxlLCBub24tY29uZmlndXJhYmxlIHByb3BlcnR5ICdcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZStcIidcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChpc0FjY2Vzc29yRGVzY3JpcHRvcihmaXhlZERlc2MpICYmXG4gICAgICAgICAgICAgIGZpeGVkRGVzYy5jb25maWd1cmFibGUgPT09IGZhbHNlICYmIC8vIG5vbi1jb25maWd1cmFibGVcbiAgICAgICAgICAgICAgZml4ZWREZXNjLnNldCA9PT0gdW5kZWZpbmVkKSB7ICAgICAgLy8gYWNjZXNzb3Igd2l0aCB1bmRlZmluZWQgc2V0dGVyXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwic2V0dGluZyBhIHByb3BlcnR5ICdcIituYW1lK1wiJyB0aGF0IGhhcyBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIgb25seSBhIGdldHRlclwiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBBbnkgb3duIGVudW1lcmFibGUgbm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0aWVzIG9mIHRoZSB0YXJnZXQgdGhhdCBhcmUgbm90XG4gICAqIGluY2x1ZGVkIGluIHRoZSB0cmFwIHJlc3VsdCBnaXZlIHJpc2UgdG8gYSBUeXBlRXJyb3IuIEFzIHN1Y2gsIHdlIGNoZWNrXG4gICAqIHdoZXRoZXIgdGhlIHJldHVybmVkIHJlc3VsdCBjb250YWlucyBhdCBsZWFzdCBhbGwgc2VhbGVkIGVudW1lcmFibGUgcHJvcGVydGllc1xuICAgKiBvZiB0aGUgdGFyZ2V0IG9iamVjdC5cbiAgICpcbiAgICogVGhlIHRyYXAgc2hvdWxkIHJldHVybiBhbiBpdGVyYXRvci5cbiAgICpcbiAgICogSG93ZXZlciwgYXMgaW1wbGVtZW50YXRpb25zIG9mIHByZS1kaXJlY3QgcHJveGllcyBzdGlsbCBleHBlY3QgZW51bWVyYXRlXG4gICAqIHRvIHJldHVybiBhbiBhcnJheSBvZiBzdHJpbmdzLCB3ZSBjb252ZXJ0IHRoZSBpdGVyYXRvciBpbnRvIGFuIGFycmF5LlxuICAgKi9cbiAgZW51bWVyYXRlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcImVudW1lcmF0ZVwiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHZhciB0cmFwUmVzdWx0ID0gUmVmbGVjdC5lbnVtZXJhdGUodGhpcy50YXJnZXQpO1xuICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgdmFyIG54dCA9IHRyYXBSZXN1bHQubmV4dCgpO1xuICAgICAgd2hpbGUgKCFueHQuZG9uZSkge1xuICAgICAgICByZXN1bHQucHVzaChTdHJpbmcobnh0LnZhbHVlKSk7XG4gICAgICAgIG54dCA9IHRyYXBSZXN1bHQubmV4dCgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICB2YXIgdHJhcFJlc3VsdCA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0KTtcbiAgICBcbiAgICBpZiAodHJhcFJlc3VsdCA9PT0gbnVsbCB8fFxuICAgICAgICB0cmFwUmVzdWx0ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgdHJhcFJlc3VsdC5uZXh0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJlbnVtZXJhdGUgdHJhcCBzaG91bGQgcmV0dXJuIGFuIGl0ZXJhdG9yLCBnb3Q6IFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICB0cmFwUmVzdWx0KTsgICAgXG4gICAgfVxuICAgIFxuICAgIC8vIHByb3BOYW1lcyBpcyB1c2VkIGFzIGEgc2V0IG9mIHN0cmluZ3NcbiAgICB2YXIgcHJvcE5hbWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBcbiAgICAvLyB2YXIgbnVtUHJvcHMgPSArdHJhcFJlc3VsdC5sZW5ndGg7XG4gICAgdmFyIHJlc3VsdCA9IFtdOyAvLyBuZXcgQXJyYXkobnVtUHJvcHMpO1xuICAgIFxuICAgIC8vIHRyYXBSZXN1bHQgaXMgc3VwcG9zZWQgdG8gYmUgYW4gaXRlcmF0b3JcbiAgICAvLyBkcmFpbiBpdGVyYXRvciB0byBhcnJheSBhcyBjdXJyZW50IGltcGxlbWVudGF0aW9ucyBzdGlsbCBleHBlY3RcbiAgICAvLyBlbnVtZXJhdGUgdG8gcmV0dXJuIGFuIGFycmF5IG9mIHN0cmluZ3NcbiAgICB2YXIgbnh0ID0gdHJhcFJlc3VsdC5uZXh0KCk7XG4gICAgXG4gICAgd2hpbGUgKCFueHQuZG9uZSkge1xuICAgICAgdmFyIHMgPSBTdHJpbmcobnh0LnZhbHVlKTtcbiAgICAgIGlmIChwcm9wTmFtZXNbc10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImVudW1lcmF0ZSB0cmFwIGNhbm5vdCBsaXN0IGEgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkdXBsaWNhdGUgcHJvcGVydHkgJ1wiK3MrXCInXCIpO1xuICAgICAgfVxuICAgICAgcHJvcE5hbWVzW3NdID0gdHJ1ZTtcbiAgICAgIHJlc3VsdC5wdXNoKHMpO1xuICAgICAgbnh0ID0gdHJhcFJlc3VsdC5uZXh0KCk7XG4gICAgfVxuICAgIFxuICAgIC8qZm9yICh2YXIgaSA9IDA7IGkgPCBudW1Qcm9wczsgaSsrKSB7XG4gICAgICB2YXIgcyA9IFN0cmluZyh0cmFwUmVzdWx0W2ldKTtcbiAgICAgIGlmIChwcm9wTmFtZXNbc10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImVudW1lcmF0ZSB0cmFwIGNhbm5vdCBsaXN0IGEgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkdXBsaWNhdGUgcHJvcGVydHkgJ1wiK3MrXCInXCIpO1xuICAgICAgfVxuXG4gICAgICBwcm9wTmFtZXNbc10gPSB0cnVlO1xuICAgICAgcmVzdWx0W2ldID0gcztcbiAgICB9ICovXG5cbiAgICB2YXIgb3duRW51bWVyYWJsZVByb3BzID0gT2JqZWN0LmtleXModGhpcy50YXJnZXQpO1xuICAgIHZhciB0YXJnZXQgPSB0aGlzLnRhcmdldDtcbiAgICBvd25FbnVtZXJhYmxlUHJvcHMuZm9yRWFjaChmdW5jdGlvbiAob3duRW51bWVyYWJsZVByb3ApIHtcbiAgICAgIGlmICghcHJvcE5hbWVzW293bkVudW1lcmFibGVQcm9wXSkge1xuICAgICAgICBpZiAoaXNTZWFsZWQob3duRW51bWVyYWJsZVByb3AsIHRhcmdldCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZW51bWVyYXRlIHRyYXAgZmFpbGVkIHRvIGluY2x1ZGUgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm5vbi1jb25maWd1cmFibGUgZW51bWVyYWJsZSBwcm9wZXJ0eSAnXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvd25FbnVtZXJhYmxlUHJvcCtcIidcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFPYmplY3QuaXNFeHRlbnNpYmxlKHRhcmdldCkgJiZcbiAgICAgICAgICAgIGlzRml4ZWQob3duRW51bWVyYWJsZVByb3AsIHRhcmdldCkpIHtcbiAgICAgICAgICAgIC8vIGlmIGhhbmRsZXIgaXMgYWxsb3dlZCBub3QgdG8gcmVwb3J0IG93bkVudW1lcmFibGVQcm9wIGFzIGFuIG93blxuICAgICAgICAgICAgLy8gcHJvcGVydHksIHdlIGNhbm5vdCBndWFyYW50ZWUgdGhhdCBpdCB3aWxsIG5ldmVyIHJlcG9ydCBpdCBhc1xuICAgICAgICAgICAgLy8gYW4gb3duIHByb3BlcnR5IGxhdGVyLiBPbmNlIGEgcHJvcGVydHkgaGFzIGJlZW4gcmVwb3J0ZWQgYXNcbiAgICAgICAgICAgIC8vIG5vbi1leGlzdGVudCBvbiBhIG5vbi1leHRlbnNpYmxlIG9iamVjdCwgaXQgc2hvdWxkIGZvcmV2ZXIgYmVcbiAgICAgICAgICAgIC8vIHJlcG9ydGVkIGFzIG5vbi1leGlzdGVudFxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCByZXBvcnQgZXhpc3Rpbmcgb3duIHByb3BlcnR5ICdcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3duRW51bWVyYWJsZVByb3ArXCInIGFzIG5vbi1leGlzdGVudCBvbiBhIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm5vbi1leHRlbnNpYmxlIG9iamVjdFwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcblxuICAvKipcbiAgICogVGhlIGl0ZXJhdGUgdHJhcCBpcyBkZXByZWNhdGVkIGJ5IHRoZSBlbnVtZXJhdGUgdHJhcC5cbiAgICovXG4gIGl0ZXJhdGU6IFZhbGlkYXRvci5wcm90b3R5cGUuZW51bWVyYXRlLFxuXG4gIC8qKlxuICAgKiBBbnkgb3duIG5vbi1jb25maWd1cmFibGUgcHJvcGVydGllcyBvZiB0aGUgdGFyZ2V0IHRoYXQgYXJlIG5vdCBpbmNsdWRlZFxuICAgKiBpbiB0aGUgdHJhcCByZXN1bHQgZ2l2ZSByaXNlIHRvIGEgVHlwZUVycm9yLiBBcyBzdWNoLCB3ZSBjaGVjayB3aGV0aGVyIHRoZVxuICAgKiByZXR1cm5lZCByZXN1bHQgY29udGFpbnMgYXQgbGVhc3QgYWxsIHNlYWxlZCBwcm9wZXJ0aWVzIG9mIHRoZSB0YXJnZXRcbiAgICogb2JqZWN0LlxuICAgKlxuICAgKiBUaGUgdHJhcCByZXN1bHQgaXMgbm9ybWFsaXplZC5cbiAgICogVGhlIHRyYXAgcmVzdWx0IGlzIG5vdCByZXR1cm5lZCBkaXJlY3RseS4gSW5zdGVhZDpcbiAgICogIC0gY3JlYXRlIGFuZCByZXR1cm4gYSBmcmVzaCBBcnJheSxcbiAgICogIC0gb2Ygd2hpY2ggZWFjaCBlbGVtZW50IGlzIGNvZXJjZWQgdG8gU3RyaW5nLFxuICAgKiAgLSB3aGljaCBkb2VzIG5vdCBjb250YWluIGR1cGxpY2F0ZXNcbiAgICpcbiAgICogRklYTUU6IGtleXMgdHJhcCBpcyBkZXByZWNhdGVkXG4gICAqL1xuICAvKlxuICBrZXlzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcImtleXNcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gUmVmbGVjdC5rZXlzKHRoaXMudGFyZ2V0KTtcbiAgICB9XG5cbiAgICB2YXIgdHJhcFJlc3VsdCA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0KTtcblxuICAgIC8vIHByb3BOYW1lcyBpcyB1c2VkIGFzIGEgc2V0IG9mIHN0cmluZ3NcbiAgICB2YXIgcHJvcE5hbWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICB2YXIgbnVtUHJvcHMgPSArdHJhcFJlc3VsdC5sZW5ndGg7XG4gICAgdmFyIHJlc3VsdCA9IG5ldyBBcnJheShudW1Qcm9wcyk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG51bVByb3BzOyBpKyspIHtcbiAgICAgdmFyIHMgPSBTdHJpbmcodHJhcFJlc3VsdFtpXSk7XG4gICAgIGlmIChwcm9wTmFtZXNbc10pIHtcbiAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwia2V5cyB0cmFwIGNhbm5vdCBsaXN0IGEgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBcImR1cGxpY2F0ZSBwcm9wZXJ0eSAnXCIrcytcIidcIik7XG4gICAgIH1cbiAgICAgaWYgKCFPYmplY3QuaXNFeHRlbnNpYmxlKHRoaXMudGFyZ2V0KSAmJiAhaXNGaXhlZChzLCB0aGlzLnRhcmdldCkpIHtcbiAgICAgICAvLyBub24tZXh0ZW5zaWJsZSBwcm94aWVzIGRvbid0IHRvbGVyYXRlIG5ldyBvd24gcHJvcGVydHkgbmFtZXNcbiAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwia2V5cyB0cmFwIGNhbm5vdCBsaXN0IGEgbmV3IFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJwcm9wZXJ0eSAnXCIrcytcIicgb24gYSBub24tZXh0ZW5zaWJsZSBvYmplY3RcIik7XG4gICAgIH1cblxuICAgICBwcm9wTmFtZXNbc10gPSB0cnVlO1xuICAgICByZXN1bHRbaV0gPSBzO1xuICAgIH1cblxuICAgIHZhciBvd25FbnVtZXJhYmxlUHJvcHMgPSBPYmplY3Qua2V5cyh0aGlzLnRhcmdldCk7XG4gICAgdmFyIHRhcmdldCA9IHRoaXMudGFyZ2V0O1xuICAgIG93bkVudW1lcmFibGVQcm9wcy5mb3JFYWNoKGZ1bmN0aW9uIChvd25FbnVtZXJhYmxlUHJvcCkge1xuICAgICAgaWYgKCFwcm9wTmFtZXNbb3duRW51bWVyYWJsZVByb3BdKSB7XG4gICAgICAgIGlmIChpc1NlYWxlZChvd25FbnVtZXJhYmxlUHJvcCwgdGFyZ2V0KSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJrZXlzIHRyYXAgZmFpbGVkIHRvIGluY2x1ZGUgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm5vbi1jb25maWd1cmFibGUgZW51bWVyYWJsZSBwcm9wZXJ0eSAnXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvd25FbnVtZXJhYmxlUHJvcCtcIidcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFPYmplY3QuaXNFeHRlbnNpYmxlKHRhcmdldCkgJiZcbiAgICAgICAgICAgIGlzRml4ZWQob3duRW51bWVyYWJsZVByb3AsIHRhcmdldCkpIHtcbiAgICAgICAgICAgIC8vIGlmIGhhbmRsZXIgaXMgYWxsb3dlZCBub3QgdG8gcmVwb3J0IG93bkVudW1lcmFibGVQcm9wIGFzIGFuIG93blxuICAgICAgICAgICAgLy8gcHJvcGVydHksIHdlIGNhbm5vdCBndWFyYW50ZWUgdGhhdCBpdCB3aWxsIG5ldmVyIHJlcG9ydCBpdCBhc1xuICAgICAgICAgICAgLy8gYW4gb3duIHByb3BlcnR5IGxhdGVyLiBPbmNlIGEgcHJvcGVydHkgaGFzIGJlZW4gcmVwb3J0ZWQgYXNcbiAgICAgICAgICAgIC8vIG5vbi1leGlzdGVudCBvbiBhIG5vbi1leHRlbnNpYmxlIG9iamVjdCwgaXQgc2hvdWxkIGZvcmV2ZXIgYmVcbiAgICAgICAgICAgIC8vIHJlcG9ydGVkIGFzIG5vbi1leGlzdGVudFxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCByZXBvcnQgZXhpc3Rpbmcgb3duIHByb3BlcnR5ICdcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3duRW51bWVyYWJsZVByb3ArXCInIGFzIG5vbi1leGlzdGVudCBvbiBhIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm5vbi1leHRlbnNpYmxlIG9iamVjdFwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcbiAgKi9cbiAgXG4gIC8qKlxuICAgKiBOZXcgdHJhcCB0aGF0IHJlaWZpZXMgW1tDYWxsXV0uXG4gICAqIElmIHRoZSB0YXJnZXQgaXMgYSBmdW5jdGlvbiwgdGhlbiBhIGNhbGwgdG9cbiAgICogICBwcm94eSguLi5hcmdzKVxuICAgKiBUcmlnZ2VycyB0aGlzIHRyYXBcbiAgICovXG4gIGFwcGx5OiBmdW5jdGlvbih0YXJnZXQsIHRoaXNCaW5kaW5nLCBhcmdzKSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJhcHBseVwiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gUmVmbGVjdC5hcHBseSh0YXJnZXQsIHRoaXNCaW5kaW5nLCBhcmdzKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRoaXMudGFyZ2V0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHJldHVybiB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0YXJnZXQsIHRoaXNCaW5kaW5nLCBhcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImFwcGx5OiBcIisgdGFyZ2V0ICsgXCIgaXMgbm90IGEgZnVuY3Rpb25cIik7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBOZXcgdHJhcCB0aGF0IHJlaWZpZXMgW1tDb25zdHJ1Y3RdXS5cbiAgICogSWYgdGhlIHRhcmdldCBpcyBhIGZ1bmN0aW9uLCB0aGVuIGEgY2FsbCB0b1xuICAgKiAgIG5ldyBwcm94eSguLi5hcmdzKVxuICAgKiBUcmlnZ2VycyB0aGlzIHRyYXBcbiAgICovXG4gIGNvbnN0cnVjdDogZnVuY3Rpb24odGFyZ2V0LCBhcmdzLCBuZXdUYXJnZXQpIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcImNvbnN0cnVjdFwiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gUmVmbGVjdC5jb25zdHJ1Y3QodGFyZ2V0LCBhcmdzLCBuZXdUYXJnZXQpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJuZXc6IFwiKyB0YXJnZXQgKyBcIiBpcyBub3QgYSBmdW5jdGlvblwiKTtcbiAgICB9XG5cbiAgICBpZiAobmV3VGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIG5ld1RhcmdldCA9IHRhcmdldDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHR5cGVvZiBuZXdUYXJnZXQgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwibmV3OiBcIisgbmV3VGFyZ2V0ICsgXCIgaXMgbm90IGEgZnVuY3Rpb25cIik7XG4gICAgICB9ICAgICAgXG4gICAgfVxuICAgIHJldHVybiB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0YXJnZXQsIGFyZ3MsIG5ld1RhcmdldCk7XG4gIH1cbn07XG5cbi8vIC0tLS0gZW5kIG9mIHRoZSBWYWxpZGF0b3IgaGFuZGxlciB3cmFwcGVyIGhhbmRsZXIgLS0tLVxuXG4vLyBJbiB3aGF0IGZvbGxvd3MsIGEgJ2RpcmVjdCBwcm94eScgaXMgYSBwcm94eVxuLy8gd2hvc2UgaGFuZGxlciBpcyBhIFZhbGlkYXRvci4gU3VjaCBwcm94aWVzIGNhbiBiZSBtYWRlIG5vbi1leHRlbnNpYmxlLFxuLy8gc2VhbGVkIG9yIGZyb3plbiB3aXRob3V0IGxvc2luZyB0aGUgYWJpbGl0eSB0byB0cmFwLlxuXG4vLyBtYXBzIGRpcmVjdCBwcm94aWVzIHRvIHRoZWlyIFZhbGlkYXRvciBoYW5kbGVyc1xudmFyIGRpcmVjdFByb3hpZXMgPSBuZXcgV2Vha01hcCgpO1xuXG4vLyBwYXRjaCBPYmplY3Que3ByZXZlbnRFeHRlbnNpb25zLHNlYWwsZnJlZXplfSBzbyB0aGF0XG4vLyB0aGV5IHJlY29nbml6ZSBmaXhhYmxlIHByb3hpZXMgYW5kIGFjdCBhY2NvcmRpbmdseVxuT2JqZWN0LnByZXZlbnRFeHRlbnNpb25zID0gZnVuY3Rpb24oc3ViamVjdCkge1xuICB2YXIgdmhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldChzdWJqZWN0KTtcbiAgaWYgKHZoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAodmhhbmRsZXIucHJldmVudEV4dGVuc2lvbnMoKSkge1xuICAgICAgcmV0dXJuIHN1YmplY3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJwcmV2ZW50RXh0ZW5zaW9ucyBvbiBcIitzdWJqZWN0K1wiIHJlamVjdGVkXCIpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJpbV9wcmV2ZW50RXh0ZW5zaW9ucyhzdWJqZWN0KTtcbiAgfVxufTtcbk9iamVjdC5zZWFsID0gZnVuY3Rpb24oc3ViamVjdCkge1xuICBzZXRJbnRlZ3JpdHlMZXZlbChzdWJqZWN0LCBcInNlYWxlZFwiKTtcbiAgcmV0dXJuIHN1YmplY3Q7XG59O1xuT2JqZWN0LmZyZWV6ZSA9IGZ1bmN0aW9uKHN1YmplY3QpIHtcbiAgc2V0SW50ZWdyaXR5TGV2ZWwoc3ViamVjdCwgXCJmcm96ZW5cIik7XG4gIHJldHVybiBzdWJqZWN0O1xufTtcbk9iamVjdC5pc0V4dGVuc2libGUgPSBPYmplY3RfaXNFeHRlbnNpYmxlID0gZnVuY3Rpb24oc3ViamVjdCkge1xuICB2YXIgdkhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldChzdWJqZWN0KTtcbiAgaWYgKHZIYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gdkhhbmRsZXIuaXNFeHRlbnNpYmxlKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHByaW1faXNFeHRlbnNpYmxlKHN1YmplY3QpO1xuICB9XG59O1xuT2JqZWN0LmlzU2VhbGVkID0gT2JqZWN0X2lzU2VhbGVkID0gZnVuY3Rpb24oc3ViamVjdCkge1xuICByZXR1cm4gdGVzdEludGVncml0eUxldmVsKHN1YmplY3QsIFwic2VhbGVkXCIpO1xufTtcbk9iamVjdC5pc0Zyb3plbiA9IE9iamVjdF9pc0Zyb3plbiA9IGZ1bmN0aW9uKHN1YmplY3QpIHtcbiAgcmV0dXJuIHRlc3RJbnRlZ3JpdHlMZXZlbChzdWJqZWN0LCBcImZyb3plblwiKTtcbn07XG5PYmplY3QuZ2V0UHJvdG90eXBlT2YgPSBPYmplY3RfZ2V0UHJvdG90eXBlT2YgPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gIHZhciB2SGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHN1YmplY3QpO1xuICBpZiAodkhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB2SGFuZGxlci5nZXRQcm90b3R5cGVPZigpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwcmltX2dldFByb3RvdHlwZU9mKHN1YmplY3QpO1xuICB9XG59O1xuXG4vLyBwYXRjaCBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIHRvIGRpcmVjdGx5IGNhbGxcbi8vIHRoZSBWYWxpZGF0b3IucHJvdG90eXBlLmdldE93blByb3BlcnR5RGVzY3JpcHRvciB0cmFwXG4vLyBUaGlzIGlzIHRvIGNpcmN1bXZlbnQgYW4gYXNzZXJ0aW9uIGluIHRoZSBidWlsdC1pbiBQcm94eVxuLy8gdHJhcHBpbmcgbWVjaGFuaXNtIG9mIHY4LCB3aGljaCBkaXNhbGxvd3MgdGhhdCB0cmFwIHRvXG4vLyByZXR1cm4gbm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0eSBkZXNjcmlwdG9ycyAoYXMgcGVyIHRoZVxuLy8gb2xkIFByb3h5IGRlc2lnbilcbk9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgPSBmdW5jdGlvbihzdWJqZWN0LCBuYW1lKSB7XG4gIHZhciB2aGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHN1YmplY3QpO1xuICBpZiAodmhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB2aGFuZGxlci5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobmFtZSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHByaW1fZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHN1YmplY3QsIG5hbWUpO1xuICB9XG59O1xuXG4vLyBwYXRjaCBPYmplY3QuZGVmaW5lUHJvcGVydHkgdG8gZGlyZWN0bHkgY2FsbFxuLy8gdGhlIFZhbGlkYXRvci5wcm90b3R5cGUuZGVmaW5lUHJvcGVydHkgdHJhcFxuLy8gVGhpcyBpcyB0byBjaXJjdW12ZW50IHR3byBpc3N1ZXMgd2l0aCB0aGUgYnVpbHQtaW5cbi8vIHRyYXAgbWVjaGFuaXNtOlxuLy8gMSkgdGhlIGN1cnJlbnQgdHJhY2Vtb25rZXkgaW1wbGVtZW50YXRpb24gb2YgcHJveGllc1xuLy8gYXV0by1jb21wbGV0ZXMgJ2Rlc2MnLCB3aGljaCBpcyBub3QgY29ycmVjdC4gJ2Rlc2MnIHNob3VsZCBiZVxuLy8gbm9ybWFsaXplZCwgYnV0IG5vdCBjb21wbGV0ZWQuIENvbnNpZGVyOlxuLy8gT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3h5LCAnZm9vJywge2VudW1lcmFibGU6ZmFsc2V9KVxuLy8gVGhpcyB0cmFwIHdpbGwgcmVjZWl2ZSBkZXNjID1cbi8vICB7dmFsdWU6dW5kZWZpbmVkLHdyaXRhYmxlOmZhbHNlLGVudW1lcmFibGU6ZmFsc2UsY29uZmlndXJhYmxlOmZhbHNlfVxuLy8gVGhpcyB3aWxsIGFsc28gc2V0IGFsbCBvdGhlciBhdHRyaWJ1dGVzIHRvIHRoZWlyIGRlZmF1bHQgdmFsdWUsXG4vLyB3aGljaCBpcyB1bmV4cGVjdGVkIGFuZCBkaWZmZXJlbnQgZnJvbSBbW0RlZmluZU93blByb3BlcnR5XV0uXG4vLyBCdWcgZmlsZWQ6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTYwMTMyOVxuLy8gMikgdGhlIGN1cnJlbnQgc3BpZGVybW9ua2V5IGltcGxlbWVudGF0aW9uIGRvZXMgbm90XG4vLyB0aHJvdyBhbiBleGNlcHRpb24gd2hlbiB0aGlzIHRyYXAgcmV0dXJucyAnZmFsc2UnLCBidXQgaW5zdGVhZCBzaWxlbnRseVxuLy8gaWdub3JlcyB0aGUgb3BlcmF0aW9uICh0aGlzIGlzIHJlZ2FyZGxlc3Mgb2Ygc3RyaWN0LW1vZGUpXG4vLyAyYSkgdjggZG9lcyB0aHJvdyBhbiBleGNlcHRpb24gZm9yIHRoaXMgY2FzZSwgYnV0IGluY2x1ZGVzIHRoZSByYXRoZXJcbi8vICAgICB1bmhlbHBmdWwgZXJyb3IgbWVzc2FnZTpcbi8vICdQcm94eSBoYW5kbGVyICM8T2JqZWN0PiByZXR1cm5lZCBmYWxzZSBmcm9tICdkZWZpbmVQcm9wZXJ0eScgdHJhcCdcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eSA9IGZ1bmN0aW9uKHN1YmplY3QsIG5hbWUsIGRlc2MpIHtcbiAgdmFyIHZoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQoc3ViamVjdCk7XG4gIGlmICh2aGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIG5vcm1hbGl6ZWREZXNjID0gbm9ybWFsaXplUHJvcGVydHlEZXNjcmlwdG9yKGRlc2MpO1xuICAgIHZhciBzdWNjZXNzID0gdmhhbmRsZXIuZGVmaW5lUHJvcGVydHkobmFtZSwgbm9ybWFsaXplZERlc2MpO1xuICAgIGlmIChzdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbid0IHJlZGVmaW5lIHByb3BlcnR5ICdcIituYW1lK1wiJ1wiKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1YmplY3Q7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHByaW1fZGVmaW5lUHJvcGVydHkoc3ViamVjdCwgbmFtZSwgZGVzYyk7XG4gIH1cbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzID0gZnVuY3Rpb24oc3ViamVjdCwgZGVzY3MpIHtcbiAgdmFyIHZoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQoc3ViamVjdCk7XG4gIGlmICh2aGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIG5hbWVzID0gT2JqZWN0LmtleXMoZGVzY3MpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBuYW1lID0gbmFtZXNbaV07XG4gICAgICB2YXIgbm9ybWFsaXplZERlc2MgPSBub3JtYWxpemVQcm9wZXJ0eURlc2NyaXB0b3IoZGVzY3NbbmFtZV0pO1xuICAgICAgdmFyIHN1Y2Nlc3MgPSB2aGFuZGxlci5kZWZpbmVQcm9wZXJ0eShuYW1lLCBub3JtYWxpemVkRGVzYyk7XG4gICAgICBpZiAoc3VjY2VzcyA9PT0gZmFsc2UpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbid0IHJlZGVmaW5lIHByb3BlcnR5ICdcIituYW1lK1wiJ1wiKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHN1YmplY3Q7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHByaW1fZGVmaW5lUHJvcGVydGllcyhzdWJqZWN0LCBkZXNjcyk7XG4gIH1cbn07XG5cbk9iamVjdC5rZXlzID0gZnVuY3Rpb24oc3ViamVjdCkge1xuICB2YXIgdkhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldChzdWJqZWN0KTtcbiAgaWYgKHZIYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgb3duS2V5cyA9IHZIYW5kbGVyLm93bktleXMoKTtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvd25LZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgayA9IFN0cmluZyhvd25LZXlzW2ldKTtcbiAgICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihzdWJqZWN0LCBrKTtcbiAgICAgIGlmIChkZXNjICE9PSB1bmRlZmluZWQgJiYgZGVzYy5lbnVtZXJhYmxlID09PSB0cnVlKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGspO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwcmltX2tleXMoc3ViamVjdCk7XG4gIH1cbn1cblxuT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgPSBPYmplY3RfZ2V0T3duUHJvcGVydHlOYW1lcyA9IGZ1bmN0aW9uKHN1YmplY3QpIHtcbiAgdmFyIHZIYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQoc3ViamVjdCk7XG4gIGlmICh2SGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHZIYW5kbGVyLm93bktleXMoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJpbV9nZXRPd25Qcm9wZXJ0eU5hbWVzKHN1YmplY3QpO1xuICB9XG59XG5cbi8vIGZpeGVzIGlzc3VlICM3MSAoQ2FsbGluZyBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKCkgb24gYSBQcm94eVxuLy8gdGhyb3dzIGFuIGVycm9yKVxuaWYgKHByaW1fZ2V0T3duUHJvcGVydHlTeW1ib2xzICE9PSB1bmRlZmluZWQpIHtcbiAgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9IGZ1bmN0aW9uKHN1YmplY3QpIHtcbiAgICB2YXIgdkhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldChzdWJqZWN0KTtcbiAgICBpZiAodkhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gYXMgdGhpcyBzaGltIGRvZXMgbm90IHN1cHBvcnQgc3ltYm9scywgYSBQcm94eSBuZXZlciBhZHZlcnRpc2VzXG4gICAgICAvLyBhbnkgc3ltYm9sLXZhbHVlZCBvd24gcHJvcGVydGllc1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcHJpbV9nZXRPd25Qcm9wZXJ0eVN5bWJvbHMoc3ViamVjdCk7XG4gICAgfVxuICB9O1xufVxuXG4vLyBmaXhlcyBpc3N1ZSAjNzIgKCdJbGxlZ2FsIGFjY2VzcycgZXJyb3Igd2hlbiB1c2luZyBPYmplY3QuYXNzaWduKVxuLy8gT2JqZWN0LmFzc2lnbiBwb2x5ZmlsbCBiYXNlZCBvbiBhIHBvbHlmaWxsIHBvc3RlZCBvbiBNRE46IFxuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvXFxcbi8vICBHbG9iYWxfT2JqZWN0cy9PYmplY3QvYXNzaWduXG4vLyBOb3RlIHRoYXQgdGhpcyBwb2x5ZmlsbCBkb2VzIG5vdCBzdXBwb3J0IFN5bWJvbHMsIGJ1dCB0aGlzIFByb3h5IFNoaW1cbi8vIGRvZXMgbm90IHN1cHBvcnQgU3ltYm9scyBhbnl3YXkuXG5pZiAocHJpbV9hc3NpZ24gIT09IHVuZGVmaW5lZCkge1xuICBPYmplY3QuYXNzaWduID0gZnVuY3Rpb24gKHRhcmdldCkge1xuICAgIFxuICAgIC8vIGNoZWNrIGlmIGFueSBhcmd1bWVudCBpcyBhIHByb3h5IG9iamVjdFxuICAgIHZhciBub1Byb3hpZXMgPSB0cnVlO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdkhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldChhcmd1bWVudHNbaV0pO1xuICAgICAgaWYgKHZIYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbm9Qcm94aWVzID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobm9Qcm94aWVzKSB7XG4gICAgICAvLyBub3QgYSBzaW5nbGUgYXJndW1lbnQgaXMgYSBwcm94eSwgcGVyZm9ybSBidWlsdC1pbiBhbGdvcml0aG1cbiAgICAgIHJldHVybiBwcmltX2Fzc2lnbi5hcHBseShPYmplY3QsIGFyZ3VtZW50cyk7XG4gICAgfVxuICAgIFxuICAgIC8vIHRoZXJlIGlzIGF0IGxlYXN0IG9uZSBwcm94eSBhcmd1bWVudCwgdXNlIHRoZSBwb2x5ZmlsbFxuICAgIFxuICAgIGlmICh0YXJnZXQgPT09IHVuZGVmaW5lZCB8fCB0YXJnZXQgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjb252ZXJ0IHVuZGVmaW5lZCBvciBudWxsIHRvIG9iamVjdCcpO1xuICAgIH1cblxuICAgIHZhciBvdXRwdXQgPSBPYmplY3QodGFyZ2V0KTtcbiAgICBmb3IgKHZhciBpbmRleCA9IDE7IGluZGV4IDwgYXJndW1lbnRzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpbmRleF07XG4gICAgICBpZiAoc291cmNlICE9PSB1bmRlZmluZWQgJiYgc291cmNlICE9PSBudWxsKSB7XG4gICAgICAgIGZvciAodmFyIG5leHRLZXkgaW4gc291cmNlKSB7XG4gICAgICAgICAgaWYgKHNvdXJjZS5oYXNPd25Qcm9wZXJ0eShuZXh0S2V5KSkge1xuICAgICAgICAgICAgb3V0cHV0W25leHRLZXldID0gc291cmNlW25leHRLZXldO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9O1xufVxuXG4vLyByZXR1cm5zIHdoZXRoZXIgYW4gYXJndW1lbnQgaXMgYSByZWZlcmVuY2UgdG8gYW4gb2JqZWN0LFxuLy8gd2hpY2ggaXMgbGVnYWwgYXMgYSBXZWFrTWFwIGtleS5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICB2YXIgdHlwZSA9IHR5cGVvZiBhcmc7XG4gIHJldHVybiAodHlwZSA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsKSB8fCAodHlwZSA9PT0gJ2Z1bmN0aW9uJyk7XG59O1xuXG4vLyBhIHdyYXBwZXIgZm9yIFdlYWtNYXAuZ2V0IHdoaWNoIHJldHVybnMgdGhlIHVuZGVmaW5lZCB2YWx1ZVxuLy8gZm9yIGtleXMgdGhhdCBhcmUgbm90IG9iamVjdHMgKGluIHdoaWNoIGNhc2UgdGhlIHVuZGVybHlpbmdcbi8vIFdlYWtNYXAgd291bGQgaGF2ZSB0aHJvd24gYSBUeXBlRXJyb3IpLlxuZnVuY3Rpb24gc2FmZVdlYWtNYXBHZXQobWFwLCBrZXkpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGtleSkgPyBtYXAuZ2V0KGtleSkgOiB1bmRlZmluZWQ7XG59O1xuXG4vLyByZXR1cm5zIGEgbmV3IGZ1bmN0aW9uIG9mIHplcm8gYXJndW1lbnRzIHRoYXQgcmVjdXJzaXZlbHlcbi8vIHVud3JhcHMgYW55IHByb3hpZXMgc3BlY2lmaWVkIGFzIHRoZSB8dGhpc3wtdmFsdWUuXG4vLyBUaGUgcHJpbWl0aXZlIGlzIGFzc3VtZWQgdG8gYmUgYSB6ZXJvLWFyZ3VtZW50IG1ldGhvZFxuLy8gdGhhdCB1c2VzIGl0cyB8dGhpc3wtYmluZGluZy5cbmZ1bmN0aW9uIG1ha2VVbndyYXBwaW5nMEFyZ01ldGhvZChwcmltaXRpdmUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGJ1aWx0aW4oKSB7XG4gICAgdmFyIHZIYW5kbGVyID0gc2FmZVdlYWtNYXBHZXQoZGlyZWN0UHJveGllcywgdGhpcyk7XG4gICAgaWYgKHZIYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBidWlsdGluLmNhbGwodkhhbmRsZXIudGFyZ2V0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHByaW1pdGl2ZS5jYWxsKHRoaXMpO1xuICAgIH1cbiAgfVxufTtcblxuLy8gcmV0dXJucyBhIG5ldyBmdW5jdGlvbiBvZiAxIGFyZ3VtZW50cyB0aGF0IHJlY3Vyc2l2ZWx5XG4vLyB1bndyYXBzIGFueSBwcm94aWVzIHNwZWNpZmllZCBhcyB0aGUgfHRoaXN8LXZhbHVlLlxuLy8gVGhlIHByaW1pdGl2ZSBpcyBhc3N1bWVkIHRvIGJlIGEgMS1hcmd1bWVudCBtZXRob2Rcbi8vIHRoYXQgdXNlcyBpdHMgfHRoaXN8LWJpbmRpbmcuXG5mdW5jdGlvbiBtYWtlVW53cmFwcGluZzFBcmdNZXRob2QocHJpbWl0aXZlKSB7XG4gIHJldHVybiBmdW5jdGlvbiBidWlsdGluKGFyZykge1xuICAgIHZhciB2SGFuZGxlciA9IHNhZmVXZWFrTWFwR2V0KGRpcmVjdFByb3hpZXMsIHRoaXMpO1xuICAgIGlmICh2SGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gYnVpbHRpbi5jYWxsKHZIYW5kbGVyLnRhcmdldCwgYXJnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHByaW1pdGl2ZS5jYWxsKHRoaXMsIGFyZyk7XG4gICAgfVxuICB9XG59O1xuXG5PYmplY3QucHJvdG90eXBlLnZhbHVlT2YgPVxuICBtYWtlVW53cmFwcGluZzBBcmdNZXRob2QoT2JqZWN0LnByb3RvdHlwZS52YWx1ZU9mKTtcbk9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcgPVxuICBtYWtlVW53cmFwcGluZzBBcmdNZXRob2QoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZyk7XG5GdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmcgPVxuICBtYWtlVW53cmFwcGluZzBBcmdNZXRob2QoRnVuY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nKTtcbkRhdGUucHJvdG90eXBlLnRvU3RyaW5nID1cbiAgbWFrZVVud3JhcHBpbmcwQXJnTWV0aG9kKERhdGUucHJvdG90eXBlLnRvU3RyaW5nKTtcblxuT2JqZWN0LnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mID0gZnVuY3Rpb24gYnVpbHRpbihhcmcpIHtcbiAgLy8gYnVnZml4IHRoYW5rcyB0byBCaWxsIE1hcms6XG4gIC8vIGJ1aWx0LWluIGlzUHJvdG90eXBlT2YgZG9lcyBub3QgdW53cmFwIHByb3hpZXMgdXNlZFxuICAvLyBhcyBhcmd1bWVudHMuIFNvLCB3ZSBpbXBsZW1lbnQgdGhlIGJ1aWx0aW4gb3Vyc2VsdmVzLFxuICAvLyBiYXNlZCBvbiB0aGUgRUNNQVNjcmlwdCA2IHNwZWMuIE91ciBlbmNvZGluZyB3aWxsXG4gIC8vIG1ha2Ugc3VyZSB0aGF0IGlmIGEgcHJveHkgaXMgdXNlZCBhcyBhbiBhcmd1bWVudCxcbiAgLy8gaXRzIGdldFByb3RvdHlwZU9mIHRyYXAgd2lsbCBiZSBjYWxsZWQuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgdmFyIHZIYW5kbGVyMiA9IHNhZmVXZWFrTWFwR2V0KGRpcmVjdFByb3hpZXMsIGFyZyk7XG4gICAgaWYgKHZIYW5kbGVyMiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBhcmcgPSB2SGFuZGxlcjIuZ2V0UHJvdG90eXBlT2YoKTtcbiAgICAgIGlmIChhcmcgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVmFsdWUoYXJnLCB0aGlzKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHByaW1faXNQcm90b3R5cGVPZi5jYWxsKHRoaXMsIGFyZyk7XG4gICAgfVxuICB9XG59O1xuXG5BcnJheS5pc0FycmF5ID0gZnVuY3Rpb24oc3ViamVjdCkge1xuICB2YXIgdkhhbmRsZXIgPSBzYWZlV2Vha01hcEdldChkaXJlY3RQcm94aWVzLCBzdWJqZWN0KTtcbiAgaWYgKHZIYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheSh2SGFuZGxlci50YXJnZXQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwcmltX2lzQXJyYXkoc3ViamVjdCk7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGlzUHJveHlBcnJheShhcmcpIHtcbiAgdmFyIHZIYW5kbGVyID0gc2FmZVdlYWtNYXBHZXQoZGlyZWN0UHJveGllcywgYXJnKTtcbiAgaWYgKHZIYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheSh2SGFuZGxlci50YXJnZXQpO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLy8gQXJyYXkucHJvdG90eXBlLmNvbmNhdCBpbnRlcm5hbGx5IHRlc3RzIHdoZXRoZXIgb25lIG9mIGl0c1xuLy8gYXJndW1lbnRzIGlzIGFuIEFycmF5LCBieSBjaGVja2luZyB3aGV0aGVyIFtbQ2xhc3NdXSA9PSBcIkFycmF5XCJcbi8vIEFzIHN1Y2gsIGl0IHdpbGwgZmFpbCB0byByZWNvZ25pemUgcHJveGllcy1mb3ItYXJyYXlzIGFzIGFycmF5cy5cbi8vIFdlIHBhdGNoIEFycmF5LnByb3RvdHlwZS5jb25jYXQgc28gdGhhdCBpdCBcInVud3JhcHNcIiBwcm94aWVzLWZvci1hcnJheXNcbi8vIGJ5IG1ha2luZyBhIGNvcHkuIFRoaXMgd2lsbCB0cmlnZ2VyIHRoZSBleGFjdCBzYW1lIHNlcXVlbmNlIG9mXG4vLyB0cmFwcyBvbiB0aGUgcHJveHktZm9yLWFycmF5IGFzIGlmIHdlIHdvdWxkIG5vdCBoYXZlIHVud3JhcHBlZCBpdC5cbi8vIFNlZSA8aHR0cHM6Ly9naXRodWIuY29tL3R2Y3V0c2VtL2hhcm1vbnktcmVmbGVjdC9pc3N1ZXMvMTk+IGZvciBtb3JlLlxuQXJyYXkucHJvdG90eXBlLmNvbmNhdCA9IGZ1bmN0aW9uKC8qLi4uYXJncyovKSB7XG4gIHZhciBsZW5ndGg7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGlzUHJveHlBcnJheShhcmd1bWVudHNbaV0pKSB7XG4gICAgICBsZW5ndGggPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xuICAgICAgYXJndW1lbnRzW2ldID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzW2ldLCAwLCBsZW5ndGgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcHJpbV9jb25jYXQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbi8vIHNldFByb3RvdHlwZU9mIHN1cHBvcnQgb24gcGxhdGZvcm1zIHRoYXQgc3VwcG9ydCBfX3Byb3RvX19cblxudmFyIHByaW1fc2V0UHJvdG90eXBlT2YgPSBPYmplY3Quc2V0UHJvdG90eXBlT2Y7XG5cbi8vIHBhdGNoIGFuZCBleHRyYWN0IG9yaWdpbmFsIF9fcHJvdG9fXyBzZXR0ZXJcbnZhciBfX3Byb3RvX19zZXR0ZXIgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBwcm90b0Rlc2MgPSBwcmltX2dldE93blByb3BlcnR5RGVzY3JpcHRvcihPYmplY3QucHJvdG90eXBlLCdfX3Byb3RvX18nKTtcbiAgaWYgKHByb3RvRGVzYyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICB0eXBlb2YgcHJvdG9EZXNjLnNldCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInNldFByb3RvdHlwZU9mIG5vdCBzdXBwb3J0ZWQgb24gdGhpcyBwbGF0Zm9ybVwiKTtcbiAgICB9XG4gIH1cblxuICAvLyBzZWUgaWYgd2UgY2FuIGFjdHVhbGx5IG11dGF0ZSBhIHByb3RvdHlwZSB3aXRoIHRoZSBnZW5lcmljIHNldHRlclxuICAvLyAoZS5nLiBDaHJvbWUgdjI4IGRvZXNuJ3QgYWxsb3cgc2V0dGluZyBfX3Byb3RvX18gdmlhIHRoZSBnZW5lcmljIHNldHRlcilcbiAgdHJ5IHtcbiAgICBwcm90b0Rlc2Muc2V0LmNhbGwoe30se30pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInNldFByb3RvdHlwZU9mIG5vdCBzdXBwb3J0ZWQgb24gdGhpcyBwbGF0Zm9ybVwiKTtcbiAgICB9XG4gIH1cblxuICBwcmltX2RlZmluZVByb3BlcnR5KE9iamVjdC5wcm90b3R5cGUsICdfX3Byb3RvX18nLCB7XG4gICAgc2V0OiBmdW5jdGlvbihuZXdQcm90bykge1xuICAgICAgcmV0dXJuIE9iamVjdC5zZXRQcm90b3R5cGVPZih0aGlzLCBPYmplY3QobmV3UHJvdG8pKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBwcm90b0Rlc2Muc2V0O1xufSgpKTtcblxuT2JqZWN0LnNldFByb3RvdHlwZU9mID0gZnVuY3Rpb24odGFyZ2V0LCBuZXdQcm90bykge1xuICB2YXIgaGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHRhcmdldCk7XG4gIGlmIChoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoaGFuZGxlci5zZXRQcm90b3R5cGVPZihuZXdQcm90bykpIHtcbiAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJwcm94eSByZWplY3RlZCBwcm90b3R5cGUgbXV0YXRpb25cIik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmICghT2JqZWN0X2lzRXh0ZW5zaWJsZSh0YXJnZXQpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2FuJ3Qgc2V0IHByb3RvdHlwZSBvbiBub24tZXh0ZW5zaWJsZSBvYmplY3Q6IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0KTtcbiAgICB9XG4gICAgaWYgKHByaW1fc2V0UHJvdG90eXBlT2YpXG4gICAgICByZXR1cm4gcHJpbV9zZXRQcm90b3R5cGVPZih0YXJnZXQsIG5ld1Byb3RvKTtcblxuICAgIGlmIChPYmplY3QobmV3UHJvdG8pICE9PSBuZXdQcm90byB8fCBuZXdQcm90byA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBwcm90b3R5cGUgbWF5IG9ubHkgYmUgYW4gT2JqZWN0IG9yIG51bGw6IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICBuZXdQcm90byk7XG4gICAgICAvLyB0aHJvdyBuZXcgVHlwZUVycm9yKFwicHJvdG90eXBlIG11c3QgYmUgYW4gb2JqZWN0IG9yIG51bGxcIilcbiAgICB9XG4gICAgX19wcm90b19fc2V0dGVyLmNhbGwodGFyZ2V0LCBuZXdQcm90byk7XG4gICAgcmV0dXJuIHRhcmdldDtcbiAgfVxufVxuXG5PYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5ID0gZnVuY3Rpb24obmFtZSkge1xuICB2YXIgaGFuZGxlciA9IHNhZmVXZWFrTWFwR2V0KGRpcmVjdFByb3hpZXMsIHRoaXMpO1xuICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIGRlc2MgPSBoYW5kbGVyLmdldE93blByb3BlcnR5RGVzY3JpcHRvcihuYW1lKTtcbiAgICByZXR1cm4gZGVzYyAhPT0gdW5kZWZpbmVkO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwcmltX2hhc093blByb3BlcnR5LmNhbGwodGhpcywgbmFtZSk7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PSBSZWZsZWN0aW9uIG1vZHVsZSA9PT09PT09PT09PT09XG4vLyBzZWUgaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTpyZWZsZWN0X2FwaVxuXG52YXIgUmVmbGVjdCA9IGdsb2JhbC5SZWZsZWN0ID0ge1xuICBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3I6IGZ1bmN0aW9uKHRhcmdldCwgbmFtZSkge1xuICAgIHJldHVybiBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgbmFtZSk7XG4gIH0sXG4gIGRlZmluZVByb3BlcnR5OiBmdW5jdGlvbih0YXJnZXQsIG5hbWUsIGRlc2MpIHtcblxuICAgIC8vIGlmIHRhcmdldCBpcyBhIHByb3h5LCBpbnZva2UgaXRzIFwiZGVmaW5lUHJvcGVydHlcIiB0cmFwXG4gICAgdmFyIGhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldCh0YXJnZXQpO1xuICAgIGlmIChoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBoYW5kbGVyLmRlZmluZVByb3BlcnR5KHRhcmdldCwgbmFtZSwgZGVzYyk7XG4gICAgfVxuXG4gICAgLy8gSW1wbGVtZW50YXRpb24gdHJhbnNsaXRlcmF0ZWQgZnJvbSBbW0RlZmluZU93blByb3BlcnR5XV1cbiAgICAvLyBzZWUgRVM1LjEgc2VjdGlvbiA4LjEyLjlcbiAgICAvLyB0aGlzIGlzIHRoZSBfZXhhY3Qgc2FtZSBhbGdvcml0aG1fIGFzIHRoZSBpc0NvbXBhdGlibGVEZXNjcmlwdG9yXG4gICAgLy8gYWxnb3JpdGhtIGRlZmluZWQgYWJvdmUsIGV4Y2VwdCB0aGF0IGF0IGV2ZXJ5IHBsYWNlIGl0XG4gICAgLy8gcmV0dXJucyB0cnVlLCB0aGlzIGFsZ29yaXRobSBhY3R1YWxseSBkb2VzIGRlZmluZSB0aGUgcHJvcGVydHkuXG4gICAgdmFyIGN1cnJlbnQgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgbmFtZSk7XG4gICAgdmFyIGV4dGVuc2libGUgPSBPYmplY3QuaXNFeHRlbnNpYmxlKHRhcmdldCk7XG4gICAgaWYgKGN1cnJlbnQgPT09IHVuZGVmaW5lZCAmJiBleHRlbnNpYmxlID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoY3VycmVudCA9PT0gdW5kZWZpbmVkICYmIGV4dGVuc2libGUgPT09IHRydWUpIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIG5hbWUsIGRlc2MpOyAvLyBzaG91bGQgbmV2ZXIgZmFpbFxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChpc0VtcHR5RGVzY3JpcHRvcihkZXNjKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChpc0VxdWl2YWxlbnREZXNjcmlwdG9yKGN1cnJlbnQsIGRlc2MpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGN1cnJlbnQuY29uZmlndXJhYmxlID09PSBmYWxzZSkge1xuICAgICAgaWYgKGRlc2MuY29uZmlndXJhYmxlID09PSB0cnVlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmICgnZW51bWVyYWJsZScgaW4gZGVzYyAmJiBkZXNjLmVudW1lcmFibGUgIT09IGN1cnJlbnQuZW51bWVyYWJsZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChpc0dlbmVyaWNEZXNjcmlwdG9yKGRlc2MpKSB7XG4gICAgICAvLyBubyBmdXJ0aGVyIHZhbGlkYXRpb24gbmVjZXNzYXJ5XG4gICAgfSBlbHNlIGlmIChpc0RhdGFEZXNjcmlwdG9yKGN1cnJlbnQpICE9PSBpc0RhdGFEZXNjcmlwdG9yKGRlc2MpKSB7XG4gICAgICBpZiAoY3VycmVudC5jb25maWd1cmFibGUgPT09IGZhbHNlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzRGF0YURlc2NyaXB0b3IoY3VycmVudCkgJiYgaXNEYXRhRGVzY3JpcHRvcihkZXNjKSkge1xuICAgICAgaWYgKGN1cnJlbnQuY29uZmlndXJhYmxlID09PSBmYWxzZSkge1xuICAgICAgICBpZiAoY3VycmVudC53cml0YWJsZSA9PT0gZmFsc2UgJiYgZGVzYy53cml0YWJsZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3VycmVudC53cml0YWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICBpZiAoJ3ZhbHVlJyBpbiBkZXNjICYmICFzYW1lVmFsdWUoZGVzYy52YWx1ZSwgY3VycmVudC52YWx1ZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzQWNjZXNzb3JEZXNjcmlwdG9yKGN1cnJlbnQpICYmIGlzQWNjZXNzb3JEZXNjcmlwdG9yKGRlc2MpKSB7XG4gICAgICBpZiAoY3VycmVudC5jb25maWd1cmFibGUgPT09IGZhbHNlKSB7XG4gICAgICAgIGlmICgnc2V0JyBpbiBkZXNjICYmICFzYW1lVmFsdWUoZGVzYy5zZXQsIGN1cnJlbnQuc2V0KSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoJ2dldCcgaW4gZGVzYyAmJiAhc2FtZVZhbHVlKGRlc2MuZ2V0LCBjdXJyZW50LmdldCkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgbmFtZSwgZGVzYyk7IC8vIHNob3VsZCBuZXZlciBmYWlsXG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG4gIGRlbGV0ZVByb3BlcnR5OiBmdW5jdGlvbih0YXJnZXQsIG5hbWUpIHtcbiAgICB2YXIgaGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHRhcmdldCk7XG4gICAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGhhbmRsZXIuZGVsZXRlKG5hbWUpO1xuICAgIH1cbiAgICBcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBuYW1lKTtcbiAgICBpZiAoZGVzYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGRlc2MuY29uZmlndXJhYmxlID09PSB0cnVlKSB7XG4gICAgICBkZWxldGUgdGFyZ2V0W25hbWVdO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTsgICAgXG4gIH0sXG4gIGdldFByb3RvdHlwZU9mOiBmdW5jdGlvbih0YXJnZXQpIHtcbiAgICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKHRhcmdldCk7XG4gIH0sXG4gIHNldFByb3RvdHlwZU9mOiBmdW5jdGlvbih0YXJnZXQsIG5ld1Byb3RvKSB7XG4gICAgXG4gICAgdmFyIGhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldCh0YXJnZXQpO1xuICAgIGlmIChoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBoYW5kbGVyLnNldFByb3RvdHlwZU9mKG5ld1Byb3RvKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKE9iamVjdChuZXdQcm90bykgIT09IG5ld1Byb3RvIHx8IG5ld1Byb3RvID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IHByb3RvdHlwZSBtYXkgb25seSBiZSBhbiBPYmplY3Qgb3IgbnVsbDogXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1Byb3RvKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKCFPYmplY3RfaXNFeHRlbnNpYmxlKHRhcmdldCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgdmFyIGN1cnJlbnQgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YodGFyZ2V0KTtcbiAgICBpZiAoc2FtZVZhbHVlKGN1cnJlbnQsIG5ld1Byb3RvKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIFxuICAgIGlmIChwcmltX3NldFByb3RvdHlwZU9mKSB7XG4gICAgICB0cnkge1xuICAgICAgICBwcmltX3NldFByb3RvdHlwZU9mKHRhcmdldCwgbmV3UHJvdG8pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIF9fcHJvdG9fX3NldHRlci5jYWxsKHRhcmdldCwgbmV3UHJvdG8pO1xuICAgIHJldHVybiB0cnVlO1xuICB9LFxuICBwcmV2ZW50RXh0ZW5zaW9uczogZnVuY3Rpb24odGFyZ2V0KSB7XG4gICAgdmFyIGhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldCh0YXJnZXQpO1xuICAgIGlmIChoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBoYW5kbGVyLnByZXZlbnRFeHRlbnNpb25zKCk7XG4gICAgfVxuICAgIHByaW1fcHJldmVudEV4dGVuc2lvbnModGFyZ2V0KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcbiAgaXNFeHRlbnNpYmxlOiBmdW5jdGlvbih0YXJnZXQpIHtcbiAgICByZXR1cm4gT2JqZWN0LmlzRXh0ZW5zaWJsZSh0YXJnZXQpO1xuICB9LFxuICBoYXM6IGZ1bmN0aW9uKHRhcmdldCwgbmFtZSkge1xuICAgIHJldHVybiBuYW1lIGluIHRhcmdldDtcbiAgfSxcbiAgZ2V0OiBmdW5jdGlvbih0YXJnZXQsIG5hbWUsIHJlY2VpdmVyKSB7XG4gICAgcmVjZWl2ZXIgPSByZWNlaXZlciB8fCB0YXJnZXQ7XG5cbiAgICAvLyBpZiB0YXJnZXQgaXMgYSBwcm94eSwgaW52b2tlIGl0cyBcImdldFwiIHRyYXBcbiAgICB2YXIgaGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHRhcmdldCk7XG4gICAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGhhbmRsZXIuZ2V0KHJlY2VpdmVyLCBuYW1lKTtcbiAgICB9XG5cbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBuYW1lKTtcbiAgICBpZiAoZGVzYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YodGFyZ2V0KTtcbiAgICAgIGlmIChwcm90byA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFJlZmxlY3QuZ2V0KHByb3RvLCBuYW1lLCByZWNlaXZlcik7XG4gICAgfVxuICAgIGlmIChpc0RhdGFEZXNjcmlwdG9yKGRlc2MpKSB7XG4gICAgICByZXR1cm4gZGVzYy52YWx1ZTtcbiAgICB9XG4gICAgdmFyIGdldHRlciA9IGRlc2MuZ2V0O1xuICAgIGlmIChnZXR0ZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIGRlc2MuZ2V0LmNhbGwocmVjZWl2ZXIpO1xuICB9LFxuICAvLyBSZWZsZWN0LnNldCBpbXBsZW1lbnRhdGlvbiBiYXNlZCBvbiBsYXRlc3QgdmVyc2lvbiBvZiBbW1NldFBdXSBhdFxuICAvLyBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OnByb3RvX2NsaW1iaW5nX3JlZmFjdG9yaW5nXG4gIHNldDogZnVuY3Rpb24odGFyZ2V0LCBuYW1lLCB2YWx1ZSwgcmVjZWl2ZXIpIHtcbiAgICByZWNlaXZlciA9IHJlY2VpdmVyIHx8IHRhcmdldDtcblxuICAgIC8vIGlmIHRhcmdldCBpcyBhIHByb3h5LCBpbnZva2UgaXRzIFwic2V0XCIgdHJhcFxuICAgIHZhciBoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQodGFyZ2V0KTtcbiAgICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gaGFuZGxlci5zZXQocmVjZWl2ZXIsIG5hbWUsIHZhbHVlKTtcbiAgICB9XG5cbiAgICAvLyBmaXJzdCwgY2hlY2sgd2hldGhlciB0YXJnZXQgaGFzIGEgbm9uLXdyaXRhYmxlIHByb3BlcnR5XG4gICAgLy8gc2hhZG93aW5nIG5hbWUgb24gcmVjZWl2ZXJcbiAgICB2YXIgb3duRGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBuYW1lKTtcblxuICAgIGlmIChvd25EZXNjID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIG5hbWUgaXMgbm90IGRlZmluZWQgaW4gdGFyZ2V0LCBzZWFyY2ggdGFyZ2V0J3MgcHJvdG90eXBlXG4gICAgICB2YXIgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YodGFyZ2V0KTtcblxuICAgICAgaWYgKHByb3RvICE9PSBudWxsKSB7XG4gICAgICAgIC8vIGNvbnRpbnVlIHRoZSBzZWFyY2ggaW4gdGFyZ2V0J3MgcHJvdG90eXBlXG4gICAgICAgIHJldHVybiBSZWZsZWN0LnNldChwcm90bywgbmFtZSwgdmFsdWUsIHJlY2VpdmVyKTtcbiAgICAgIH1cblxuICAgICAgLy8gUmV2MTYgY2hhbmdlLiBDZi4gaHR0cHM6Ly9idWdzLmVjbWFzY3JpcHQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNTQ5XG4gICAgICAvLyB0YXJnZXQgd2FzIHRoZSBsYXN0IHByb3RvdHlwZSwgbm93IHdlIGtub3cgdGhhdCAnbmFtZScgaXMgbm90IHNoYWRvd2VkXG4gICAgICAvLyBieSBhbiBleGlzdGluZyAoYWNjZXNzb3Igb3IgZGF0YSkgcHJvcGVydHksIHNvIHdlIGNhbiBhZGQgdGhlIHByb3BlcnR5XG4gICAgICAvLyB0byB0aGUgaW5pdGlhbCByZWNlaXZlciBvYmplY3RcbiAgICAgIC8vICh0aGlzIGJyYW5jaCB3aWxsIGludGVudGlvbmFsbHkgZmFsbCB0aHJvdWdoIHRvIHRoZSBjb2RlIGJlbG93KVxuICAgICAgb3duRGVzYyA9XG4gICAgICAgIHsgdmFsdWU6IHVuZGVmaW5lZCxcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9O1xuICAgIH1cblxuICAgIC8vIHdlIG5vdyBrbm93IHRoYXQgb3duRGVzYyAhPT0gdW5kZWZpbmVkXG4gICAgaWYgKGlzQWNjZXNzb3JEZXNjcmlwdG9yKG93bkRlc2MpKSB7XG4gICAgICB2YXIgc2V0dGVyID0gb3duRGVzYy5zZXQ7XG4gICAgICBpZiAoc2V0dGVyID09PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgICAgIHNldHRlci5jYWxsKHJlY2VpdmVyLCB2YWx1ZSk7IC8vIGFzc3VtZXMgRnVuY3Rpb24ucHJvdG90eXBlLmNhbGxcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICAvLyBvdGhlcndpc2UsIGlzRGF0YURlc2NyaXB0b3Iob3duRGVzYykgbXVzdCBiZSB0cnVlXG4gICAgaWYgKG93bkRlc2Mud3JpdGFibGUgPT09IGZhbHNlKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gd2UgZm91bmQgYW4gZXhpc3Rpbmcgd3JpdGFibGUgZGF0YSBwcm9wZXJ0eSBvbiB0aGUgcHJvdG90eXBlIGNoYWluLlxuICAgIC8vIE5vdyB1cGRhdGUgb3IgYWRkIHRoZSBkYXRhIHByb3BlcnR5IG9uIHRoZSByZWNlaXZlciwgZGVwZW5kaW5nIG9uXG4gICAgLy8gd2hldGhlciB0aGUgcmVjZWl2ZXIgYWxyZWFkeSBkZWZpbmVzIHRoZSBwcm9wZXJ0eSBvciBub3QuXG4gICAgdmFyIGV4aXN0aW5nRGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocmVjZWl2ZXIsIG5hbWUpO1xuICAgIGlmIChleGlzdGluZ0Rlc2MgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIHVwZGF0ZURlc2MgPVxuICAgICAgICB7IHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAvLyBGSVhNRTogaXQgc2hvdWxkIG5vdCBiZSBuZWNlc3NhcnkgdG8gZGVzY3JpYmUgdGhlIGZvbGxvd2luZ1xuICAgICAgICAgIC8vIGF0dHJpYnV0ZXMuIEFkZGVkIHRvIGNpcmN1bXZlbnQgYSBidWcgaW4gdHJhY2Vtb25rZXk6XG4gICAgICAgICAgLy8gaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9NjAxMzI5XG4gICAgICAgICAgd3JpdGFibGU6ICAgICBleGlzdGluZ0Rlc2Mud3JpdGFibGUsXG4gICAgICAgICAgZW51bWVyYWJsZTogICBleGlzdGluZ0Rlc2MuZW51bWVyYWJsZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IGV4aXN0aW5nRGVzYy5jb25maWd1cmFibGUgfTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZWNlaXZlciwgbmFtZSwgdXBkYXRlRGVzYyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFPYmplY3QuaXNFeHRlbnNpYmxlKHJlY2VpdmVyKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgdmFyIG5ld0Rlc2MgPVxuICAgICAgICB7IHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9O1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHJlY2VpdmVyLCBuYW1lLCBuZXdEZXNjKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfSxcbiAgLyppbnZva2U6IGZ1bmN0aW9uKHRhcmdldCwgbmFtZSwgYXJncywgcmVjZWl2ZXIpIHtcbiAgICByZWNlaXZlciA9IHJlY2VpdmVyIHx8IHRhcmdldDtcblxuICAgIHZhciBoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQodGFyZ2V0KTtcbiAgICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gaGFuZGxlci5pbnZva2UocmVjZWl2ZXIsIG5hbWUsIGFyZ3MpO1xuICAgIH1cblxuICAgIHZhciBmdW4gPSBSZWZsZWN0LmdldCh0YXJnZXQsIG5hbWUsIHJlY2VpdmVyKTtcbiAgICByZXR1cm4gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoZnVuLCByZWNlaXZlciwgYXJncyk7XG4gIH0sKi9cbiAgZW51bWVyYXRlOiBmdW5jdGlvbih0YXJnZXQpIHtcbiAgICB2YXIgaGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHRhcmdldCk7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBoYW5kbGVyLmVudW1lcmF0ZSBzaG91bGQgcmV0dXJuIGFuIGl0ZXJhdG9yIGRpcmVjdGx5LCBidXQgdGhlXG4gICAgICAvLyBpdGVyYXRvciBnZXRzIGNvbnZlcnRlZCB0byBhbiBhcnJheSBmb3IgYmFja3dhcmQtY29tcGF0IHJlYXNvbnMsXG4gICAgICAvLyBzbyB3ZSBtdXN0IHJlLWl0ZXJhdGUgb3ZlciB0aGUgYXJyYXlcbiAgICAgIHJlc3VsdCA9IGhhbmRsZXIuZW51bWVyYXRlKGhhbmRsZXIudGFyZ2V0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gW107XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHRhcmdldCkgeyByZXN1bHQucHVzaChuYW1lKTsgfTsgICAgICBcbiAgICB9XG4gICAgdmFyIGwgPSArcmVzdWx0Lmxlbmd0aDtcbiAgICB2YXIgaWR4ID0gMDtcbiAgICByZXR1cm4ge1xuICAgICAgbmV4dDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChpZHggPT09IGwpIHJldHVybiB7IGRvbmU6IHRydWUgfTtcbiAgICAgICAgcmV0dXJuIHsgZG9uZTogZmFsc2UsIHZhbHVlOiByZXN1bHRbaWR4KytdIH07XG4gICAgICB9XG4gICAgfTtcbiAgfSxcbiAgLy8gaW1wZXJmZWN0IG93bktleXMgaW1wbGVtZW50YXRpb246IGluIEVTNiwgc2hvdWxkIGFsc28gaW5jbHVkZVxuICAvLyBzeW1ib2wta2V5ZWQgcHJvcGVydGllcy5cbiAgb3duS2V5czogZnVuY3Rpb24odGFyZ2V0KSB7XG4gICAgcmV0dXJuIE9iamVjdF9nZXRPd25Qcm9wZXJ0eU5hbWVzKHRhcmdldCk7XG4gIH0sXG4gIGFwcGx5OiBmdW5jdGlvbih0YXJnZXQsIHJlY2VpdmVyLCBhcmdzKSB7XG4gICAgLy8gdGFyZ2V0LmFwcGx5KHJlY2VpdmVyLCBhcmdzKVxuICAgIHJldHVybiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbCh0YXJnZXQsIHJlY2VpdmVyLCBhcmdzKTtcbiAgfSxcbiAgY29uc3RydWN0OiBmdW5jdGlvbih0YXJnZXQsIGFyZ3MsIG5ld1RhcmdldCkge1xuICAgIC8vIHJldHVybiBuZXcgdGFyZ2V0KC4uLmFyZ3MpO1xuXG4gICAgLy8gaWYgdGFyZ2V0IGlzIGEgcHJveHksIGludm9rZSBpdHMgXCJjb25zdHJ1Y3RcIiB0cmFwXG4gICAgdmFyIGhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldCh0YXJnZXQpO1xuICAgIGlmIChoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBoYW5kbGVyLmNvbnN0cnVjdChoYW5kbGVyLnRhcmdldCwgYXJncywgbmV3VGFyZ2V0KTtcbiAgICB9XG4gICAgXG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInRhcmdldCBpcyBub3QgYSBmdW5jdGlvbjogXCIgKyB0YXJnZXQpO1xuICAgIH1cbiAgICBpZiAobmV3VGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIG5ld1RhcmdldCA9IHRhcmdldDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHR5cGVvZiBuZXdUYXJnZXQgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwibmV3VGFyZ2V0IGlzIG5vdCBhIGZ1bmN0aW9uOiBcIiArIHRhcmdldCk7XG4gICAgICB9ICAgICAgXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyAoRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQuYXBwbHkobmV3VGFyZ2V0LCBbbnVsbF0uY29uY2F0KGFyZ3MpKSk7XG4gIH1cbn07XG5cbi8vIGZlYXR1cmUtdGVzdCB3aGV0aGVyIHRoZSBQcm94eSBnbG9iYWwgZXhpc3RzLCB3aXRoXG4vLyB0aGUgaGFybW9ueS1lcmEgUHJveHkuY3JlYXRlIEFQSVxuaWYgKHR5cGVvZiBQcm94eSAhPT0gXCJ1bmRlZmluZWRcIiAmJlxuICAgIHR5cGVvZiBQcm94eS5jcmVhdGUgIT09IFwidW5kZWZpbmVkXCIpIHtcblxuICB2YXIgcHJpbUNyZWF0ZSA9IFByb3h5LmNyZWF0ZSxcbiAgICAgIHByaW1DcmVhdGVGdW5jdGlvbiA9IFByb3h5LmNyZWF0ZUZ1bmN0aW9uO1xuXG4gIHZhciByZXZva2VkSGFuZGxlciA9IHByaW1DcmVhdGUoe1xuICAgIGdldDogZnVuY3Rpb24oKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoXCJwcm94eSBpcyByZXZva2VkXCIpOyB9XG4gIH0pO1xuXG4gIGdsb2JhbC5Qcm94eSA9IGZ1bmN0aW9uKHRhcmdldCwgaGFuZGxlcikge1xuICAgIC8vIGNoZWNrIHRoYXQgdGFyZ2V0IGlzIGFuIE9iamVjdFxuICAgIGlmIChPYmplY3QodGFyZ2V0KSAhPT0gdGFyZ2V0KSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJveHkgdGFyZ2V0IG11c3QgYmUgYW4gT2JqZWN0LCBnaXZlbiBcIit0YXJnZXQpO1xuICAgIH1cbiAgICAvLyBjaGVjayB0aGF0IGhhbmRsZXIgaXMgYW4gT2JqZWN0XG4gICAgaWYgKE9iamVjdChoYW5kbGVyKSAhPT0gaGFuZGxlcikge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByb3h5IGhhbmRsZXIgbXVzdCBiZSBhbiBPYmplY3QsIGdpdmVuIFwiK2hhbmRsZXIpO1xuICAgIH1cblxuICAgIHZhciB2SGFuZGxlciA9IG5ldyBWYWxpZGF0b3IodGFyZ2V0LCBoYW5kbGVyKTtcbiAgICB2YXIgcHJveHk7XG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgcHJveHkgPSBwcmltQ3JlYXRlRnVuY3Rpb24odkhhbmRsZXIsXG4gICAgICAgIC8vIGNhbGwgdHJhcFxuICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgcmV0dXJuIHZIYW5kbGVyLmFwcGx5KHRhcmdldCwgdGhpcywgYXJncyk7XG4gICAgICAgIH0sXG4gICAgICAgIC8vIGNvbnN0cnVjdCB0cmFwXG4gICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICByZXR1cm4gdkhhbmRsZXIuY29uc3RydWN0KHRhcmdldCwgYXJncyk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBwcm94eSA9IHByaW1DcmVhdGUodkhhbmRsZXIsIE9iamVjdC5nZXRQcm90b3R5cGVPZih0YXJnZXQpKTtcbiAgICB9XG4gICAgZGlyZWN0UHJveGllcy5zZXQocHJveHksIHZIYW5kbGVyKTtcbiAgICByZXR1cm4gcHJveHk7XG4gIH07XG5cbiAgZ2xvYmFsLlByb3h5LnJldm9jYWJsZSA9IGZ1bmN0aW9uKHRhcmdldCwgaGFuZGxlcikge1xuICAgIHZhciBwcm94eSA9IG5ldyBQcm94eSh0YXJnZXQsIGhhbmRsZXIpO1xuICAgIHZhciByZXZva2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciB2SGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHByb3h5KTtcbiAgICAgIGlmICh2SGFuZGxlciAhPT0gbnVsbCkge1xuICAgICAgICB2SGFuZGxlci50YXJnZXQgID0gbnVsbDtcbiAgICAgICAgdkhhbmRsZXIuaGFuZGxlciA9IHJldm9rZWRIYW5kbGVyO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9O1xuICAgIHJldHVybiB7cHJveHk6IHByb3h5LCByZXZva2U6IHJldm9rZX07XG4gIH1cbiAgXG4gIC8vIGFkZCB0aGUgb2xkIFByb3h5LmNyZWF0ZSBhbmQgUHJveHkuY3JlYXRlRnVuY3Rpb24gbWV0aG9kc1xuICAvLyBzbyBvbGQgY29kZSB0aGF0IHN0aWxsIGRlcGVuZHMgb24gdGhlIGhhcm1vbnktZXJhIFByb3h5IG9iamVjdFxuICAvLyBpcyBub3QgYnJva2VuLiBBbHNvIGVuc3VyZXMgdGhhdCBtdWx0aXBsZSB2ZXJzaW9ucyBvZiB0aGlzXG4gIC8vIGxpYnJhcnkgc2hvdWxkIGxvYWQgZmluZVxuICBnbG9iYWwuUHJveHkuY3JlYXRlID0gcHJpbUNyZWF0ZTtcbiAgZ2xvYmFsLlByb3h5LmNyZWF0ZUZ1bmN0aW9uID0gcHJpbUNyZWF0ZUZ1bmN0aW9uO1xuXG59IGVsc2Uge1xuICAvLyBQcm94eSBnbG9iYWwgbm90IGRlZmluZWQsIG9yIG9sZCBBUEkgbm90IGF2YWlsYWJsZVxuICBpZiAodHlwZW9mIFByb3h5ID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgLy8gUHJveHkgZ2xvYmFsIG5vdCBkZWZpbmVkLCBhZGQgYSBQcm94eSBmdW5jdGlvbiBzdHViXG4gICAgZ2xvYmFsLlByb3h5ID0gZnVuY3Rpb24oX3RhcmdldCwgX2hhbmRsZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInByb3hpZXMgbm90IHN1cHBvcnRlZCBvbiB0aGlzIHBsYXRmb3JtLiBPbiB2OC9ub2RlL2lvanMsIG1ha2Ugc3VyZSB0byBwYXNzIHRoZSAtLWhhcm1vbnlfcHJveGllcyBmbGFnXCIpO1xuICAgIH07XG4gIH1cbiAgLy8gUHJveHkgZ2xvYmFsIGRlZmluZWQgYnV0IG9sZCBBUEkgbm90IGF2YWlsYWJsZVxuICAvLyBwcmVzdW1hYmx5IFByb3h5IGdsb2JhbCBhbHJlYWR5IHN1cHBvcnRzIG5ldyBBUEksIGxlYXZlIHVudG91Y2hlZFxufVxuXG4vLyBmb3Igbm9kZS5qcyBtb2R1bGVzLCBleHBvcnQgZXZlcnkgcHJvcGVydHkgaW4gdGhlIFJlZmxlY3Qgb2JqZWN0XG4vLyBhcyBwYXJ0IG9mIHRoZSBtb2R1bGUgaW50ZXJmYWNlXG5pZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gIE9iamVjdC5rZXlzKFJlZmxlY3QpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIGV4cG9ydHNba2V5XSA9IFJlZmxlY3Rba2V5XTtcbiAgfSk7XG59XG5cbi8vIGZ1bmN0aW9uLWFzLW1vZHVsZSBwYXR0ZXJuXG59KHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6IHRoaXMpKTsiXX0=
