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
        this.properties = [];
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
                console.log(_this2.data);
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

            var _this3 = this;

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
                    if (values[0][i] === 'property' && _this3.properties.indexOf(cur) === -1) {
                        _this3.properties.push(cur); // use this array in the setScales fn of chart.js
                    }
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

            d3.request('https://api.zotero.org/groups/26940/items/top', function (xhr) {
                console.log(xhr.getResponseHeader('Total-Results'));
            });

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
            console.log(this.dictionary, key);
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
        //  this.isFirstRender = true;
        this.setScales(); // //SHOULD BE IN CHART PROTOTYPE 
        this.setTooltips();
        this.addLines();
        this.addLabels();
        this.addPoints();
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
                console.log(_this5.data);
                return _this5.data;
            }, function (d) {
                return d.key;
            }).enter().append('g').attr('class', function (d) {
                return 'potential-series ' + d.key + ' series-' + _this5.parent.seriesCount + ' color-' + _this5.parent.seriesCount++ % 4;
            });

            this.bindData();

            if (this.config.stackSeries && this.config.stackSeries === true) {
                this.prepareStacking(); // TO DO. SEPARATE STACKING FROM AREA. STACKING COULD APPLY TO MANY CHART TYPES
            }

            return container.node();
        },
        bindData: function bindData() {
            var _this6 = this;

            // TO DO : THIS HSOULD BE IN CHART PROTOTYPE
            var eachSeries = this.potentialSeries.selectAll('g.each-series').data(function (d) {
                var rtn = d.values.find(function (each) {
                    return each.key === _this6.config.variableY;
                });
                return rtn !== undefined ? [rtn] : []; // need to acct for possibility
                // that the series is absent given the 
                // config.variableY. if find() returns
                // undefined, data should be empty array
            }, function (d) {
                console.log(d.values[0].series);
                return d.values[0].series;
            });

            // update existing
            eachSeries.classed('enter', false).classed('update', true);

            // clear exiting
            eachSeries.exit().transition().duration(500).style('opacity', 0).remove();

            var entering = eachSeries.enter().append('g').attr('class', function (d) {
                return d.values[0].series + ' each-series';
            }).classed('enter', true);

            this.eachSeries = entering.merge(eachSeries);
        },
        update: function update() {
            var variableY = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.config.variableY;

            this.config.variableY = variableY;
            this.setScales();
            this.bindData();
            this.addLines();
            this.adjustYAxis();
            this.addPoints();
            this.adjustLabels();
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
                yMins = [],
                yVariables;
            console.log(this.scaleBy, this.scaleBy !== undefined, this.scaleBy !== 'all', Array.isArray(this.scaleBy) !== true);
            if (this.scaleBy !== undefined && this.scaleBy !== 'all' && Array.isArray(this.scaleBy) !== true && typeof this.scaleBy !== 'string') {
                console.log('Invalid data-scale-by configuration. Must be string or array of y variable(s).');
                this.scaleBy = undefined;
            }
            if (this.scaleBy === 'all') {
                yVariables = this.parent.parent.properties;
            } else {
                yVariables = Array.isArray(this.scaleBy) ? this.scaleBy : Array.isArray(this.config.variableY) ? this.config.variableY : [this.config.variableY];
            }

            console.log(yVariables, this.parent.parent.properties);

            this.data.forEach(function (each) {
                xMaxes.push(_this8.parent.parent.summaries[1][_this8.config.category][each.key].x.max);
                xMins.push(_this8.parent.parent.summaries[1][_this8.config.category][each.key].x.min);
                yVariables.forEach(function (yVar) {
                    if (_this8.parent.parent.summaries[0][_this8.config.category][each.key][yVar] !== undefined) {
                        // need to acct for poss
                        // that the yVar does not exist in 
                        // the specified series
                        yMaxes.push(_this8.parent.parent.summaries[0][_this8.config.category][each.key][yVar].y.max);
                        yMins.push(_this8.parent.parent.summaries[0][_this8.config.category][each.key][yVar].y.min);
                    }
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
            var lines = this.eachSeries.selectAll('path').data(function (d) {
                return [d];
            });

            this.lines = lines.enter().append('path').attr('class', 'line').attr('d', function (d) {
                return zeroValueline(d.values);
            }).merge(lines);

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
        adjustYAxis: function adjustYAxis() {
            var _this12 = this;

            this.yAxisGroup.transition().duration(500).call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5)).on('end', function () {
                _this12.markZero();
            });
            // to do make this DRYer (repeated below) and programmatic

            //this.markZero();
        },
        markZero: function markZero() {
            var _this13 = this;

            // if zero is not the first tick mark, mark it with bold type
            this.yAxisGroup.selectAll('.tick').each(function (d, i, array) {
                d3.select(array[i]).classed('zero', function (d) {
                    console.log(d, i, _this13.yMin);
                    return d === 0 && i !== 0 && _this13.yMin < 0;
                });
            });
        },
        addYAxis: function addYAxis() {
            var _this14 = this;

            /* axis */
            this.yAxisGroup.attr('class', 'axis y-axis').call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5));

            this.markZero();

            /* labels */

            var unitsLabels = this.allSeries.select('.each-series').append('a').attr('xlink:href', '#').attr('tabindex', -1).attr('focusable', false).on('click', function () {
                d3.event.preventDefault();
            }).append('text').attr('class', 'units').attr('transform', function () {
                return 'translate(-' + (_this14.marginLeft - 5) + ',-' + (_this14.marginTop - 14) + ')';
            }).html(function (d, i) {
                return i === 0 ? _this14.parent.units(d.values[0].series) : null;
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
                if (_this14.parent.unitsDescription(d.values[0].series) !== undefined && d3.select(array[i]).html() !== '') {
                    d3.select(array[i].parentNode).attr('tabindex', 0).attr('focusable', true).classed('has-tooltip', true).on('mouseover', function (d, i, array) {
                        array[i].focus();
                    }).on('focus', function (d) {
                        mouseover.call(_this14, d);
                    }).on('mouseout', function (d, i, array) {
                        array[i].blur();
                    }).on('blur', labelTooltip.hide).call(labelTooltip);

                    d3.select(array[i]).html(function () {
                        return d3.select(this).html() + '<tspan dy="-0.4em" dx="0.2em" class="info-mark">?</tspan>';
                    });
                }
            });
        },
        adjustLabels: function adjustLabels() {
            var _this15 = this;

            this.allSeries.selectAll('text.series-label').transition().duration(200).attr('y', 0).on('end', function (d, i, array) {
                if (i === array.length - 1) {
                    _this15.addLabels();
                }
            });
        },
        addLabels: function addLabels() {
            var _this16 = this;

            var labelTooltip = d3.tip().attr("class", "d3-tip label-tip").direction('n').offset([-4, 12]);

            function mouseover(d) {
                if (window.openTooltip) {
                    window.openTooltip.hide();
                }
                labelTooltip.html(this.parent.description(d.values[0].series));
                labelTooltip.show();
                window.openTooltip = labelTooltip;
            }

            /* this.labelGroups = this.eachSeries
                 .append('g'); */

            var labels = this.eachSeries.selectAll('a.label-anchor').data(function (d) {

                return [d];
            }, function (d) {
                return d.values[0].series + '-label';
            });

            this.allSeries.selectAll('a.label-anchor').transition().duration(500).attr('transform', function (d) {

                return 'translate(' + (_this16.width + 8) + ', ' + (_this16.yScale(d.values[d.values.length - 1].value) + 3) + ')';
            }).on('end', function (d, i, array) {
                if (i === array.length - 1) {
                    _this16.relaxLabels(); // do i need additional time for the entering ones to finish? gate?
                }
            });

            var newLabels = labels.enter().append('a').style('opacity', 0).attr('transform', function (d) {
                return 'translate(' + (_this16.width + 8) + ', ' + (_this16.yScale(d.values[d.values.length - 1].value) + 3) + ')';
            }).attr('class', 'label-anchor').attr('title', 'click to bring to front').attr('xlink:href', '#').attr('tabindex', -1).attr('focusable', false).on('click', function (d, i, array) {
                d3.event.preventDefault();
                _this16.bringToTop.call(array[i].parentNode);
            });

            newLabels.append('text').attr('class', 'series-label').html(function (d) {

                return '<tspan x="0">' + _this16.parent.label(d.values[0].series).replace(/\\n/g, '</tspan><tspan x="0.5em" dy="1.2em">') + '</tspan>';
            }).each(function (d, i, array) {
                console.log(d);
                if (_this16.parent.description(d.values[0].series) !== undefined && _this16.parent.description(d.values[0].series) !== '') {
                    d3.select(array[i].parentNode).attr('tabindex', 0).attr('focusable', true).classed('has-tooltip', true).on('mouseover', function (d, i, array) {
                        array[i].focus();
                    }).on('focus', function (d) {
                        mouseover.call(_this16, d);
                    }).on('mouseout', function (d, i, array) {
                        array[i].blur();
                    }).on('blur', labelTooltip.hide).call(labelTooltip);

                    d3.select(array[i]).html(function () {
                        return d3.select(this).html() + '<tspan dy="-0.4em" dx="0.2em" class="info-mark">?</tspan>';
                    });
                }
            });

            newLabels.transition().duration(500).style('opacity', 1);

            this.labels = newLabels.merge(labels).selectAll('text.series-label');

            /*   newLabels.each((d, i, array) => {
                   console.log(d);
                   if ( this.parent.description(d.values[0].series) !== undefined && this.parent.description(d.values[0].series) !== ''){
                       d3.select(array[i].parentNode)
                           .attr('tabindex',0)
                           .attr('focusable',true)
                           .classed('has-tooltip', true)
                           .on('mouseover', (d,i,array) => {
                               array[i].focus();
                           })
                           .on('focus', d => {
                               mouseover.call(this,d);
                           })
                           .on('mouseout', (d,i,array) => {
                               array[i].blur();
                           })
                           .on('blur', labelTooltip.hide)
                           .call(labelTooltip);
                           
                       d3.select(array[i])
                           .html(function(){
                               return d3.select(this).html() + '<tspan dy="-0.4em" dx="0.2em" class="info-mark">?</tspan>'; 
                           });
                   }
               });*/
            // this.isFirstRender = false;

            if (labels.nodes().length === 0) {
                // ie there are no exiting labels (first render or all have
                // exited). if there are existing labels, relaxLabels is called
                // on 'end' of their transition above.
                this.relaxLabels();
            }
        },
        relaxLabels: function relaxLabels() {
            var _this17 = this;

            // HT http://jsfiddle.net/thudfactor/B2WBU/ adapted technique
            var alpha = 1,
                spacing = 0,
                again = false;

            this.labels.each(function (d, i, array1) {

                var a = array1[i],
                    $a = d3.select(a),
                    yA = $a.attr('y'),
                    aRange = d3.range(Math.round(a.getCTM().f) - spacing + parseInt(yA), Math.round(a.getCTM().f) + Math.round(a.getBBox().height) + 1 + spacing + parseInt(yA));

                _this17.labels.each(function () {
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
                        _this17.relaxLabels();
                    }, 20);
                }
            });
        },
        addPoints: function addPoints() {
            var _this18 = this;

            // existing
            var points = this.eachSeries.selectAll('circle.data-point').data(function (d) {
                //console.log(d);
                return d.values;
            }, function (d) {
                console.log(d.series + '-' + d[_this18.config.variableX]);
                return d.series + '-' + d[_this18.config.variableX];
            });

            // update existing
            points.classed('enter', false).classed('update', true).transition().duration(500).delay(150).attr('cx', function (d) {
                return _this18.xScale(d3.timeParse(_this18.xTimeType)(d[_this18.config.variableX]));
            }).attr('cy', function (d) {
                return _this18.yScale(d.value);
            });

            points.exit().remove();

            var enter = points.enter();

            enter.append('circle').attr('tabindex', 0).attr('focusable', true).attr('opacity', 0).attr('class', 'data-point enter').attr('r', '4').attr('cx', function (d) {
                return _this18.xScale(d3.timeParse(_this18.xTimeType)(d[_this18.config.variableX]));
            }).attr('cy', function (d) {
                return _this18.yScale(d.value);
            }).on('mouseover', function (d, i, array) {
                mouseover.call(_this18, d, i, array);
            }).on('focus', function (d, i, array) {
                mouseover.call(_this18, d, i, array);
            }).on('mouseout', function () {
                mouseout.call(_this18);
            }).on('blur', function () {
                mouseout.call(_this18);
            }).on('click', this.bringToTop).on('keyup', function (d, i, array) {

                if (d3.event.keyCode === 13) {

                    _this18.bringToTop.call(array[i]);
                }
            }).call(this.tooltip).transition().duration(500).delay(650).attr('opacity', 1);

            this.points = enter.merge(points);

            console.log(this.points);

            function mouseover(d, i, array) {
                console.log(d);
                if (window.openTooltip) {
                    window.openTooltip.hide();
                }

                var klass = d3.select(array[i].parentNode.parentNode).attr('class').match(/color-\d/)[0]; // get the color class of the parent g
                this.tooltip.attr('class', this.tooltip.attr('class') + ' ' + klass);
                var prefix = '';
                var suffix = '';
                if (this.parent.units(d.series) && this.parent.units(d.series)[0] === '$') {
                    prefix = '$'; // TO DO:  handle other prefixes
                }
                var html = '<strong>' + this.parent.tipText(d.series) + '</strong> (' + d.year + ')<br />' + prefix + d3.format(',')(d.value);
                if (this.parent.units(d.series) && this.parent.units(d.series) !== '') {
                    suffix = this.parent.units(d.series).replace('$', '');
                    html += ' ' + suffix;
                }
                // TO DO: HANDLE THE CUMULATVE VALUES 
                /*  var cum = this.config.variableY.replace('_value','_cum');
                  if ( d[cum] !== '' ){
                      html += '<br />(' + prefix + d3.format(',')(d[cum]) + suffix + ' cumulative)';
                  }*/
                this.tooltip.html(html);
                this.tooltip.show();
                window.openTooltip = this.tooltip;
            }
            function mouseout() {

                this.tooltip.attr('class', this.tooltip.attr('class').replace(/ color-\d/g, ''));
                this.tooltip.html('');
                this.tooltip.hide();
            }
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
      if (!svg) {
        // HT https://github.com/Caged/d3-tip/pull/96/files
        return;
      }
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
      console.log(el);
      el = el.node();
      if (!el) {
        // HT https://github.com/Caged/d3-tip/pull/96/files
        return;
      }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvc2NyaXB0cy5lczYiLCJqcy1leHBvcnRzL0NoYXJ0cy5qcyIsImpzLWV4cG9ydHMvSGVscGVycy5qcyIsImpzLXZlbmRvci9kMy10aXAuanMiLCJqcy12ZW5kb3IvcG9seWZpbGxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNZQTs7QUFDQTs7QUFDQTs7QUFDQTs7b01BZkMsbUYsQ0FBb0Y7QUFDcEY7OztBQUdEOzs7Ozs7Ozs7O0FBYUEsSUFBSSxXQUFZLFlBQVU7O0FBRTFCOztBQUVJLFFBQUksa0JBQWtCLEVBQXRCO0FBQ0EsUUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLFNBQVQsRUFBb0IsS0FBcEIsRUFBMEI7QUFBQTs7QUFDekMsYUFBSyxTQUFMLEdBQWlCLFNBQWpCO0FBQ0EsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssTUFBTCxHQUFjLFVBQVUsT0FBVixDQUFrQixPQUFsQixFQUFkLENBSHlDLENBR0U7O0FBRTNDLGFBQUssWUFBTCxHQUFvQixLQUFLLGtCQUFMLEVBQXBCO0FBQ0EsYUFBSyxRQUFMLEdBQWdCLEVBQWhCO0FBQ0EsYUFBSyxVQUFMLEdBQWtCLEVBQWxCO0FBQ0EsYUFBSyxVQUFMLEdBQWtCLEVBQWxCO0FBQ0EsYUFBSyxZQUFMLENBQWtCLElBQWxCLENBQXVCLFlBQU07QUFBRTtBQUMzQixrQkFBSyxnQkFBTCxDQUFzQixTQUF0QixFQUFpQyxLQUFqQztBQUNILFNBRkQ7QUFHSCxLQVpEO0FBYUE7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBRWpCLDBCQUZpQixnQ0FFRztBQUFBOztBQUFFO0FBQ0E7QUFDQTtBQUNsQixnQkFBSSxlQUFlLEVBQW5CO0FBQ0EsZ0JBQUksVUFBVSxLQUFLLE1BQUwsQ0FBWSxPQUExQjtBQUFBLGdCQUNJLE9BQU8sQ0FBQyxLQUFLLE1BQUwsQ0FBWSxPQUFiLEVBQXFCLEtBQUssTUFB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T0FBakIsRUFBMEI7QUFDakQsVUFBSSxRQUFRLElBQUksS0FBSixDQUFVLE1BQVYsRUFBa0IsT0FBbEIsQ0FBWjtBQUNBLFVBQUksU0FBUyxTQUFULE1BQVMsR0FBVztBQUN0QixZQUFJLFdBQVcsY0FBYyxHQUFkLENBQWtCLEtBQWxCLENBQWY7QUFDQSxZQUFJLGFBQWEsSUFBakIsRUFBdUI7QUFDckIsbUJBQVMsTUFBVCxHQUFtQixJQUFuQjtBQUNBLG1CQUFTLE9BQVQsR0FBbUIsY0FBbkI7QUFDRDtBQUNELGVBQU8sU0FBUDtBQUNELE9BUEQ7QUFRQSxhQUFPLEVBQUMsT0FBTyxLQUFSLEVBQWUsUUFBUSxNQUF2QixFQUFQO0FBQ0QsS0FYRDs7QUFhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFdBQU8sS0FBUCxDQUFhLE1BQWIsR0FBc0IsVUFBdEI7QUFDQSxXQUFPLEtBQVAsQ0FBYSxjQUFiLEdBQThCLGtCQUE5QjtBQUVELEdBN0RELE1BNkRPO0FBQ0w7QUFDQSxRQUFJLE9BQU8sS0FBUCxLQUFpQixXQUFyQixFQUFrQztBQUNoQztBQUNBLGFBQU8sS0FBUCxHQUFlLFVBQVMsT0FBVCxFQUFrQixRQUFsQixFQUE0QjtBQUN6QyxjQUFNLElBQUksS0FBSixDQUFVLHVHQUFWLENBQU47QUFDRCxPQUZEO0FBR0Q7QUFDRDtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBLE1BQUksT0FBTyxPQUFQLEtBQW1CLFdBQXZCLEVBQW9DO0FBQ2xDLFdBQU8sSUFBUCxDQUFZLE9BQVosRUFBcUIsT0FBckIsQ0FBNkIsVUFBVSxHQUFWLEVBQWU7QUFDMUMsY0FBUSxHQUFSLElBQWUsUUFBUSxHQUFSLENBQWY7QUFDRCxLQUZEO0FBR0Q7O0FBRUQ7QUFDQyxDQXBpRXVCLENBb2lFdEIsT0FBTyxPQUFQLEtBQW1CLFdBQW5CLEdBQWlDLE1BQWpDLFlBcGlFc0IsQ0FBakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiIC8qIGV4cG9ydGVkIEQzQ2hhcnRzLCBIZWxwZXJzLCBkM1RpcCwgcmVmbGVjdCwgYXJyYXlGaW5kLCBTVkdJbm5lckhUTUwsIFNWR0ZvY3VzICovIC8vIGxldCdzIGpzaGludCBrbm93IHRoYXQgRDNDaGFydHMgY2FuIGJlIFwiZGVmaW5lZCBidXQgbm90IHVzZWRcIiBpbiB0aGlzIGZpbGVcbiAvKiBwb2x5ZmlsbHMgbmVlZGVkOiBQcm9taXNlLCBBcnJheS5pc0FycmF5LCBBcnJheS5maW5kLCBBcnJheS5maWx0ZXIsIFJlZmxlY3QsIE9iamVjdC5vd25Qcm9wZXJ0eURlc2NyaXB0b3JzXG4gKi9cblxuLypcbmluaXRpYWxpemVkIGJ5IHdpbmRvd3MuRDNDaGFydHMuSW5pdCgpIHdoaWNoIGNyZWF0ZXMgYSBuZXcgRDNDaGFydEdyb3VwIGZvciBlYWNoIGRpdi5kMy1ncm91cCBpbiB0aGUgRE9NLlxuZWFjaCBkaXYncyBkYXRhIGF0dHJpYnV0ZXMgc3VwcGx5IHRoZSBjb25maWd1cmF0aW9uIG5lZWRlZC4gaW5kaXZpZHVhbCBjaGFydHMgaW5oZXJpdCBmcm9tIHRoZSBncm91cCdzIG9uZmlndXJhdGlvblxuZGF0YSBidXQgY2FuIGFsc28gc3BlY2lmeSB0aGVpciBvd24uXG5cbmdyb3VwcyBhcmUgY29sbGVjdGVkIGluIGdyb3VwQ29sbGVjdGlvbiBhcnJheSBcblxuKi8gXG5pbXBvcnQgeyByZWZsZWN0LCBhcnJheUZpbmQsIFNWR0lubmVySFRNTCwgU1ZHRm9jdXMgfSBmcm9tICcuLi9qcy12ZW5kb3IvcG9seWZpbGxzJztcbmltcG9ydCB7IEhlbHBlcnMgfSBmcm9tICcuLi9qcy1leHBvcnRzL0hlbHBlcnMnO1xuaW1wb3J0IHsgQ2hhcnRzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9DaGFydHMnO1xuaW1wb3J0IHsgZDNUaXAgfSBmcm9tICcuLi9qcy12ZW5kb3IvZDMtdGlwJztcblxudmFyIEQzQ2hhcnRzID0gKGZ1bmN0aW9uKCl7IFxuIFxuXCJ1c2Ugc3RyaWN0XCI7ICBcbiAgICAgXG4gICAgdmFyIGdyb3VwQ29sbGVjdGlvbiA9IFtdO1xuICAgIHZhciBEM0NoYXJ0R3JvdXAgPSBmdW5jdGlvbihjb250YWluZXIsIGluZGV4KXtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgICAgIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb250YWluZXIuZGF0YXNldC5jb252ZXJ0KCk7IC8vIG1ldGhvZCBwcm92aWRlZCBpbiBIZWxwZXJzXG4gICAgICAgIFxuICAgICAgICB0aGlzLmRhdGFQcm9taXNlcyA9IHRoaXMucmV0dXJuRGF0YVByb21pc2VzKCk7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSBbXTsgXG4gICAgICAgIHRoaXMuY29sbGVjdEFsbCA9IFtdO1xuICAgICAgICB0aGlzLnByb3BlcnRpZXMgPSBbXTtcbiAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMudGhlbigoKSA9PiB7IC8vIHdoZW4gdGhlIGRhdGEgcHJvbWlzZXMgcmVzb2x2ZSwgY2hhcnRzIGFyZSBpbml0aWFsaXplZFxuICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplQ2hhcnRzKGNvbnRhaW5lciwgaW5kZXgpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8vcHJvdG90eXBlIGJlZ2lucyBoZXJlXG4gICAgRDNDaGFydEdyb3VwLnByb3RvdHlwZSA9IHtcbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm5EYXRhUHJvbWlzZXMoKXsgLy8gZ2V0cyBkYXRhIGZyb20gR29vZ2xlIFNoZWV0LCBjb252ZXJzdCByb3dzIHRvIGtleS12YWx1ZSBwYWlycywgbmVzdHMgdGhlIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhcyBzcGVjaWZpZWQgYnkgdGhlIGNvbmZpZyBvYmplY3QsIGFuZCBjcmVhdGVzIGFycmF5IG9mIHN1bW1hcml6ZWQgZGF0YSBhdCBkaWZmZXJlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBuZXN0aW5nIGxldmVscyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIGRhdGFQcm9taXNlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBzaGVldElEID0gdGhpcy5jb25maWcuc2hlZXRJZCwgXG4gICAgICAgICAgICAgICAgICAgIHRhYnMgPSBbdGhpcy5jb25maWcuZGF0YVRhYix0aGlzLmNvbmZpZy5kaWN0aW9uYXJ5VGFiXTsgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpcyB0aGVyZSBhIGNhc2UgZm9yIG1vcmUgdGhhbiBvbmUgc2hlZXQgb2YgZGF0YT9cbiAgICAgICAgICAgICAgICB0YWJzLmZvckVhY2goKGVhY2gsIGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSxyZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLmpzb24oJ2h0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8nICsgc2hlZXRJRCArICcvdmFsdWVzLycgKyBlYWNoICsgJz9rZXk9QUl6YVN5REQzVzV3SmVKRjJlc2ZmWk1ReE50RWw5dHQtT2ZnU3E0JywgKGVycm9yLGRhdGEpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWVzID0gZGF0YS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RUeXBlID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gJ29iamVjdCcgOiAnc2VyaWVzJzsgLy8gbmVzdFR5cGUgZm9yIGRhdGEgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RCeSA9IGVhY2ggPT09ICdkaWN0aW9uYXJ5JyA/IGZhbHNlIDogdGhpcy5jb25maWcubmVzdEJ5O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBuZXN0QnksIHRydWUsIG5lc3RUeXBlLCBpLCB0aGlzLmNvbmZpZy5ub3JtYWxpemVDb2x1bW5zU3RhcnQpKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFQcm9taXNlcy5wdXNoKHByb21pc2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFByb21pc2UuYWxsKGRhdGFQcm9taXNlcykudGhlbih2YWx1ZXMgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGEgPSB2YWx1ZXNbMF07XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHRoaXMuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGljdGlvbmFyeSA9IHZhbHVlc1sxXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSB0aGlzLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoZGF0YVByb21pc2VzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdW1tYXJpemVEYXRhKCl7IC8vIHRoaXMgZm4gY3JlYXRlcyBhbiBhcnJheSBvZiBvYmplY3RzIHN1bW1hcml6aW5nIHRoZSBkYXRhIGluIG1vZGVsLmRhdGEuIG1vZGVsLmRhdGEgaXMgbmVzdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBuZXN0aW5nIGFuZCByb2xsaW5nIHVwIGNhbm5vdCBiZSBkb25lIGVhc2lseSBhdCB0aGUgc2FtZSB0aW1lLCBzbyB0aGV5J3JlIGRvbmUgc2VwYXJhdGVseS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHN1bW1hcmllcyBwcm92aWRlIGF2ZXJhZ2UsIG1heCwgbWluIG9mIGFsbCBmaWVsZHMgaW4gdGhlIGRhdGEgYXQgYWxsIGxldmVscyBvZiBuZXN0aW5nLiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLCB0aGUgc2Vjb25kIGlzIHR3bywgYW5kIHNvIG9uLlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgIHZhciBzdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgICAgIHZhciBuZXN0QnlBcnJheSA9IHRoaXMubmVzdEJ5QXJyYXkubWFwKGEgPT4gYSk7XG4gICAgICAgICAgICAgICB2YXIgdmFyaWFibGVYID0gdGhpcy5jb25maWcudmFyaWFibGVYO1xuXG4gICAgICAgICAgICAgICBmdW5jdGlvbiByZWR1Y2VWYXJpYWJsZXMoZCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4OiAgICAgICBkMy5tYXgoZCwgZCA9PiBkLnZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW46ICAgICAgIGQzLm1pbihkLCBkID0+IGQudmFsdWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lYW46ICAgICAgZDMubWVhbihkLCBkID0+IGQudmFsdWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1bTogICAgICAgZDMuc3VtKGQsIGQgPT4gZC52YWx1ZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFuOiAgICBkMy5tZWRpYW4oZCwgZCA9PiBkLnZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW5jZTogIGQzLnZhcmlhbmNlKGQsIGQgPT4gZC52YWx1ZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWF0aW9uOiBkMy5kZXZpYXRpb24oZCwgZCA9PiBkLnZhbHVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHg6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXg6ICAgICAgIGQzLm1heChkLCBkID0+IGRbdmFyaWFibGVYXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluOiAgICAgICBkMy5taW4oZCwgZCA9PiBkW3ZhcmlhYmxlWF0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lYW46ICAgICAgZDMubWVhbihkLCBkID0+IGRbdmFyaWFibGVYXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VtOiAgICAgICBkMy5zdW0oZCwgZCA9PiBkW3ZhcmlhYmxlWF0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lZGlhbjogICAgZDMubWVkaWFuKGQsIGQgPT4gZFt2YXJpYWJsZVhdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW5jZTogIGQzLnZhcmlhbmNlKGQsIGQgPT4gZFt2YXJpYWJsZVhdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpYXRpb246IGQzLmRldmlhdGlvbihkLCBkID0+IGRbdmFyaWFibGVYXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgd2hpbGUgKCBuZXN0QnlBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnJvbGx1cChyZWR1Y2VWYXJpYWJsZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHRoaXMudW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgICAgICBzdW1tYXJpZXMucHVzaChzdW1tYXJpemVkKTsgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiBzdW1tYXJpZXM7XG4gICAgICAgICAgICB9LCBcbiAgICAgICAgICAgIG5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpe1xuICAgICAgICAgICAgICAgIC8vIHJlY3Vyc2l2ZSAgbmVzdGluZyBmdW5jdGlvbiB1c2VkIGJ5IHN1bW1hcml6ZURhdGEgYW5kIHJldHVybktleVZhbHVlc1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXN0QnlBcnJheS5yZWR1Y2UoKGFjYywgY3VyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyICE9PSAnc3RyaW5nJyAmJiB0eXBlb2YgY3VyICE9PSAnZnVuY3Rpb24nICkgeyB0aHJvdyAnZWFjaCBuZXN0QnkgaXRlbSBtdXN0IGJlIGEgc3RyaW5nIG9yIGZ1bmN0aW9uJzsgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgcnRuO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdzdHJpbmcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkW2N1cl07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTsgICAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjdXIoZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJ0bjtcbiAgICAgICAgICAgICAgICB9LCBkMy5uZXN0KCkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJldHVybk5vcm1hbGl6ZWRWYWx1ZXModmFsdWVzLCBzdGFydCl7XG5cbiAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgICAgIHZhciBuZXdSb3dzQXJyYXkgPSBbWy4uLnZhbHVlc1swXS5zbGljZSgwLHN0YXJ0KSwgJ3Byb3BlcnR5JywndmFsdWUnXV07XG4gICAgICAgICAgICAgICAgdmFsdWVzLnNsaWNlKDEpLmZvckVhY2gocm93ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlcGVhdCA9IHJvdy5zbGljZSgwLHN0YXJ0KTtcbiAgICAgICAgICAgICAgICAgICAgcm93LnNsaWNlKHN0YXJ0KS5mb3JFYWNoKCh2YWx1ZSwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5ld1JvdyA9IFsuLi5yZXBlYXQsIHZhbHVlc1swXVtpICsgc3RhcnRdLCB2YWx1ZV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHZhbHVlICE9PSBcIlwiICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3Um93c0FycmF5LnB1c2gobmV3Um93KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7ICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiBuZXdSb3dzQXJyYXk7XG4gICAgICAgICAgICB9LCAgICAgICBcbiAgICAgICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycsIHRhYkluZGV4ID0gMCwgbm9ybWFsaXplQ29sdW1uc1N0YXJ0ID0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgIC8vIHRoaXMgZm4gdGFrZXMgbm9ybWFsaXplZCBkYXRhIGZldGNoZWQgYXMgYW4gYXJyYXkgb2Ygcm93cyBhbmQgdXNlcyB0aGUgdmFsdWVzIGluIHRoZSBmaXJzdCByb3cgYXMga2V5cyBmb3IgdmFsdWVzIGluXG4gICAgICAgICAgICAvLyBzdWJzZXF1ZW50IHJvd3NcbiAgICAgICAgICAgIC8vIG5lc3RCeSA9IHN0cmluZyBvciBhcnJheSBvZiBmaWVsZChzKSB0byBuZXN0IGJ5LCBvciBhIGN1c3RvbSBmdW5jdGlvbiwgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnM7XG4gICAgICAgICAgICAvLyBjb2VyY2UgPSBCT09MIGNvZXJjZSB0byBudW0gb3Igbm90OyBuZXN0VHlwZSA9IG9iamVjdCBvciBzZXJpZXMgbmVzdCAoZDMpXG4gICAgICAgICAgICAgICAgdmFyIHByZWxpbTtcbiAgICAgICAgICAgICAgICBpZiAoIG5vcm1hbGl6ZUNvbHVtbnNTdGFydCAhPT0gdW5kZWZpbmVkICYmIHRhYkluZGV4ID09PSAwICkgIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVzID0gdGhpcy5yZXR1cm5Ob3JtYWxpemVkVmFsdWVzKHZhbHVlcywgbm9ybWFsaXplQ29sdW1uc1N0YXJ0KTtcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgIHZhciB1bm5lc3RlZCA9IHZhbHVlcy5zbGljZSgxKS5tYXAocm93ID0+IHJvdy5yZWR1Y2UoKGFjYywgY3VyLCBpKSA9PiB7IFxuICAgICAgICAgICAgICAgIGlmICggdmFsdWVzWzBdW2ldID09PSAncHJvcGVydHknICYmIHRoaXMucHJvcGVydGllcy5pbmRleE9mKGN1cikgPT09IC0xICl7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvcGVydGllcy5wdXNoKGN1cik7IC8vIHVzZSB0aGlzIGFycmF5IGluIHRoZSBzZXRTY2FsZXMgZm4gb2YgY2hhcnQuanNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gMS4gcGFyYW1zOiB0b3RhbCwgY3VycmVudFZhbHVlLCBjdXJyZW50SW5kZXhbLCBhcnJdXG4gICAgICAgICAgICAgICAgLy8gMy4gLy8gYWNjIGlzIGFuIG9iamVjdCAsIGtleSBpcyBjb3JyZXNwb25kaW5nIHZhbHVlIGZyb20gcm93IDAsIHZhbHVlIGlzIGN1cnJlbnQgdmFsdWUgb2YgYXJyYXlcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhY2NbdmFsdWVzWzBdW2ldXSA9IGNvZXJjZSA9PT0gdHJ1ZSA/IGlzTmFOKCtjdXIpIHx8IGN1ciA9PT0gJycgPyBjdXIgOiArY3VyIDogY3VyOyBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGVzdCBmb3IgZW1wdHkgc3RyaW5ncyBiZWZvcmUgY29lcmNpbmcgYmMgKycnID0+IDBcbiAgICAgICAgICAgICAgICB9LCB7fSkpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICggdGFiSW5kZXggPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudW5uZXN0ZWQgPSB1bm5lc3RlZDtcbiAgICAgICAgICAgICAgICB9ICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoICFuZXN0QnkgKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVubmVzdGVkO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIG5lc3RCeSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG5lc3RCeSA9PT0gJ2Z1bmN0aW9uJyApIHsgLy8gaWUgb25seSBvbmUgbmVzdEJ5IGZpZWxkIG9yIGZ1bmNpdG9uXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm5lc3RCeUFycmF5ID0gW25lc3RCeV07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkobmVzdEJ5KSkgeyB0aHJvdyAnbmVzdEJ5IHZhcmlhYmxlIG11c3QgYmUgYSBzdHJpbmcsIGZ1bmN0aW9uLCBvciBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucyc7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubmVzdEJ5QXJyYXkgPSBuZXN0Qnk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gdGhpcy5uZXN0UHJlbGltKHRoaXMubmVzdEJ5QXJyYXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIG5lc3RUeXBlID09PSAnb2JqZWN0JyApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJlbGltXG4gICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJlbGltXG4gICAgICAgICAgICAgICAgICAgICAgICAuZW50cmllcyh1bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGluaXRpYWxpemVDaGFydHMoY29udGFpbmVyLCBpbmRleCl7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIGdyb3VwID0gdGhpcztcbiAgICAgICAgICAgICAgICBkMy5zZWxlY3RBbGwoJy5kMy1jaGFydC5ncm91cC0nICsgaW5kZXgpIC8vIHNlbGVjdCBhbGwgYGRpdi5kMy1jaGFydGBzIHRoYXQgYXJlIGFzc29jaWF0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdpdGggdGhlIGdyb3VwIGJ5IGNsYXNzbmFtZSBcImdyb3VwLVwiICsgaW5kZXggXG4gICAgICAgICAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICBncm91cC5jaGlsZHJlbi5wdXNoKG5ldyBDaGFydHMuQ2hhcnREaXYodGhpcywgZ3JvdXApKTsgLy8gY29uc3RydWN0b3IgcHJvdmlkZWQgaW4gQ2hhcnRzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSAgICAgICAgXG4gICAgfTsgLy8gRDNDaGFydEdyb3VwIHByb3RvdHlwZSBlbmRzIGhlcmVcbiAgICBcbiAgICAvKiBQVUJMSUMgQVBJICovXG4gICAgd2luZG93LkQzQ2hhcnRzID0geyAvLyBuZWVkIHRvIHNwZWNpZnkgd2luZG93IGJjIGFmdGVyIHRyYW5zcGlsaW5nIGFsbCB0aGlzIHdpbGwgYmUgd3JhcHBlZCBpbiBJSUZFc1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGByZXR1cm5gaW5nIHdvbid0IGdldCB0aGUgZXhwb3J0IGludG8gd2luZG93J3MgZ2xvYmFsIHNjb3BlXG4gICAgICAgIEluaXQoKXtcblxuICAgICAgICAgICAgZDMucmVxdWVzdCgnaHR0cHM6Ly9hcGkuem90ZXJvLm9yZy9ncm91cHMvMjY5NDAvaXRlbXMvdG9wJywgZnVuY3Rpb24oeGhyKXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ1RvdGFsLVJlc3VsdHMnKSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdmFyIGdyb3VwRGl2cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5kMy1ncm91cCcpO1xuICAgICAgICAgICAgZm9yICggbGV0IGkgPSAwOyBpIDwgZ3JvdXBEaXZzLmxlbmd0aDsgaSsrICl7XG4gICAgICAgICAgICAgICAgZ3JvdXBDb2xsZWN0aW9uLnB1c2gobmV3IEQzQ2hhcnRHcm91cChncm91cERpdnNbaV0sIGkpKTtcbiAgICAgICAgICAgIH0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb250YWluZXIsIGluZGV4IFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBcbiAgICAgICAgfSxcbiAgICAgICAgY29sbGVjdEFsbDpbXSxcbiAgICAgICAgVXBkYXRlQWxsKHZhcmlhYmxlWSl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdEFsbC5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgIGVhY2gudXBkYXRlKHZhcmlhYmxlWSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgVXBkYXRlR3JvdXAoaW5kZXgsdmFyaWFibGVZKXtcbiAgICAgICAgICAgIGdyb3VwQ29sbGVjdGlvbltpbmRleF0uY29sbGVjdEFsbC5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgIGVhY2gudXBkYXRlKHZhcmlhYmxlWSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59KCkpOyAvLyBlbmQgdmFyIEQzQ2hhcnRzIElJRkUiLCJleHBvcnQgY29uc3QgQ2hhcnRzID0gKGZ1bmN0aW9uKCl7ICAgIFxuICAgIC8qIGdsb2JhbHMgRDNDaGFydHMgKi9cblxuICAgIHZhciBDaGFydERpdiA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgcGFyZW50KXsgLy8gY29uc3RydWN0b3IgY2FsbGVkIGZyb20gc2NyaXB0cyBvbmNlIGZvciBlYWNoIGRpdi5kMy1jaGFydFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW4gdGhlIERPTS4gY29udGFpbmVyIGlzIHRoZSBET00gZWxlbWVudDsgcGFyZW50IGlzIHRoZSBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEQzQ2hhcnRHcm91cCB0byB3aGljaCBpdCBiZWxvbmdzXG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgICAgICB0aGlzLnNlcmllc0NvdW50ID0gMDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBPYmplY3QuY3JlYXRlKCBwYXJlbnQuY29uZmlnLCBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyggY29udGFpbmVyLmRhdGFzZXQuY29udmVydCgpICkgKTtcbiAgICAgICAgICAgIC8vIGxpbmUgYWJvdmUgY3JlYXRlcyBhIGNvbmZpZyBvYmplY3QgZnJvbSB0aGUgSFRNTCBkYXRhc2V0IGZvciB0aGUgY2hhcnREaXYgY29udGFpbmVyXG4gICAgICAgICAgICAvLyB0aGF0IGluaGVyaXRzIGZyb20gdGhlIHBhcmVudHMgY29uZmlnIG9iamVjdC4gYW55IGNvbmZpZ3Mgbm90IHNwZWNpZmllZCBmb3IgdGhlIGNoYXJ0RGl2IChhbiBvd24gcHJvcGVydHkpXG4gICAgICAgICAgICAvLyB3aWxsIGNvbWUgZnJvbSB1cCB0aGUgaW5oZXJpdGFuY2UgY2hhaW5cbiAgICAgICAgdGhpcy5kYXR1bSA9IHBhcmVudC5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gdGhpcy5jb25maWcuY2F0ZWdvcnkpOyBcbiAgICAgICAgICAgIC8vIHBhcmVudC5kYXRhIGlzIHRoZSBlbnRpcmUgZGF0YXNldCBmcm9tIHRoZSBHb29nbGUgU2hlZXQuIGxpbmUgYWJvdmUgc2VsZWN0cyBmcm9tIHRoYXQgZGF0YXNldCB0aGUgb2JqZWN0XG4gICAgICAgICAgICAvLyBtYXRjaGluZyB0aGUgY2F0ZWdvcnkgc3BlY2lmaWVkIGZvciB0aGUgY3VycmVudCBDaGFydERpdi4gaGVyZSBpcyB3aHkgdGhlIGRhdGEgaGFzIHRvIGJlIG5lc3RlZCBmaXJzdCBieSBcbiAgICAgICAgICAgIC8vIHRoZSBjYXRlZ29yeVxuXG4gICAgICAgICAgICAvKiByZW1vdmUgc2VyaWVzSW5zdHJ1Y3QgYmMgZ3JvdXBTZXJpZXMgY2FuIGhhbmRsZSBpdCAqL1xuXG5cbiAgICAgICAgdGhpcy5ncm91cGVkU2VyaWVzRGF0YSA9IHRoaXMuZ3JvdXBTZXJpZXMoKTsgLy8gb3JnYW5pemVzIGRhdGEgYWNjIHRvIGluc3RydWN0aW9uIHJlIGdyb3VwaW5nIHNlcmllcyAgXG4gICAgICAgIFxuICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB0aGlzLnBhcmVudC5kaWN0aW9uYXJ5O1xuICAgICAgICBpZiAoIHRoaXMuY29uZmlnLmhlYWRpbmcgIT09IGZhbHNlICl7XG4gICAgICAgICAgICB0aGlzLmFkZEhlYWRpbmcodGhpcy5jb25maWcuaGVhZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgZDMuc2VsZWN0KHRoaXMuY29udGFpbmVyKS5hcHBlbmQoJ2RpdicpO1xuICAgICAgICB0aGlzLmNyZWF0ZUNoYXJ0cygpOyAvLyBhIG5ldyBDaGFydCBmb3IgZWFjaCBncm91cGVkIHNlcmllc1xuICAgICAgfTtcblxuICAgIENoYXJ0RGl2LnByb3RvdHlwZSA9IHtcblxuICAgICAgICBjaGFydFR5cGVzOiB7IFxuICAgICAgICAgICAgbGluZTogICAnTGluZUNoYXJ0JyxcbiAgICAgICAgICAgIGNvbHVtbjogJ0NvbHVtbkNoYXJ0JyxcbiAgICAgICAgICAgIGJhcjogICAgJ0JhckNoYXJ0JyAvLyBzbyBvbiAuIC4gLlxuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVDaGFydHMoKXtcbiAgICAgICAgICAgIHRoaXMuZ3JvdXBlZFNlcmllc0RhdGEuZm9yRWFjaCgoZWFjaCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChuZXcgTGluZUNoYXJ0KHRoaXMsIGVhY2gpKTsgLy8gVE8gRE8gZGlzdGluZ3Vpc2ggY2hhcnQgdHlwZXMgaGVyZVxuICAgICAgICAgICAgfSk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBhcmVudCwgZGF0YSAgIFxuICAgICAgICB9LFxuICAgICAgICBncm91cFNlcmllcygpeyAvLyB0YWtlcyB0aGUgZGF0dW0gZm9yIHRoZSBjaGFydERpdiAodGhlIGRhdGEgbWF0Y2hpbmcgdGhlIHNwZWNpZmllZCBjYXRlZ29yeSlcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIG9yZ2FuaXplcyB0aGUgc2VyaWVzIGFjY29yZGluZyB0aGUgc2VyaWVzR3JvdXAgaW5zdHJ1Y3Rpb25zIGZyb20gdGhlIGRhdGEgYXR0cmlidXRlcyBcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gJ2FsbCcgcHV0cyBhbGwgc2VyaWVzIHRvZ2V0aGVyIGluIG9uZSBhcnJheSB3aXRoIGNvbnNlcXVlbmNlIG9mIGFsbCBzZXJpZXMgYmVpbmcgcmVuZGVyZWRcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gaW4gdGhlIHNhbWUgU1ZHLiAgJ25vbmUnIHB1dHMgZWFjaCBzZXJpZXMgaW4gaXRzIG93biBhcnJheTsgZWFjaCBpcyByZW5kZXJlZCBpbiBpdHMgb3duIFNWRztcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgYW4gYXJyYXkgb2YgYXJyYXlzIGlzIHNwZWNpZmllZCBpbiB0aGUgY29uZmlndXJhdGlvbiBmb3IgdGhlIENoYXJ0RGl2LCB0aGUgZ3JvdXBlZCBzZXJpZXNcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJlIHJlbmRlcmVkIHRvZ2V0aGVyLlxuICAgICAgICAgICAgdmFyIHNlcmllc0dyb3VwcyxcbiAgICAgICAgICAgICAgICBncm91cHNJbnN0cnVjdCA9IHRoaXMuY29uZmlnLnNlcmllc0dyb3VwIHx8ICdub25lJztcbiAgICAgICAgICAgIGlmICggQXJyYXkuaXNBcnJheSggZ3JvdXBzSW5zdHJ1Y3QgKSApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5zZXJpZXNHcm91cC5mb3JFYWNoKGdyb3VwID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzLnB1c2godGhpcy5kYXR1bS52YWx1ZXMuZmlsdGVyKHNlcmllcyA9PiBncm91cC5pbmRleE9mKHNlcmllcy5rZXkpICE9PSAtMSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdub25lJyApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSB0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBbZWFjaF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdhbGwnICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFt0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBlYWNoKV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBJbnZhbGlkIGRhdGEtZ3JvdXAtc2VyaWVzIGluc3RydWN0aW9uIGZyb20gaHRtbC4gXG4gICAgICAgICAgICAgICAgICAgICAgIE11c3QgYmUgdmFsaWQgSlNPTjogXCJOb25lXCIgb3IgXCJBbGxcIiBvciBhbiBhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICBvZiBhcnJheXMgY29udGFpbmluZyB0aGUgc2VyaWVzIHRvIGJlIGdyb3VwZWRcbiAgICAgICAgICAgICAgICAgICAgICAgdG9nZXRoZXIuIEFsbCBzdHJpbmdzIG11c3QgYmUgZG91YmxlLXF1b3RlZC5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHNlcmllc0dyb3VwcztcbiAgICAgICAgfSwgLy8gZW5kIGdyb3VwU2VyaWVzKClcbiAgICAgICAgYWRkSGVhZGluZyhpbnB1dCl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBoZWFkaW5nID0gZDMuc2VsZWN0KHRoaXMuY29udGFpbmVyKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3AnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ3JlbGF0aXZlJylcbiAgICAgICAgICAgICAgICAuaHRtbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBoZWFkaW5nID0gdHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJyA/IGlucHV0IDogdGhpcy5sYWJlbCh0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nICsgaGVhZGluZyArICc8L3N0cm9uZz4nO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgdmFyIGxhYmVsVG9vbHRpcCA9IGQzLnRpcCgpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcImQzLXRpcCBsYWJlbC10aXBcIilcbiAgICAgICAgICAgICAgICAuZGlyZWN0aW9uKCdzJylcbiAgICAgICAgICAgICAgICAub2Zmc2V0KFs0LCAwXSlcbiAgICAgICAgICAgICAgICAuaHRtbCh0aGlzLmRlc2NyaXB0aW9uKHRoaXMuY29uZmlnLmNhdGVnb3J5KSk7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG1vdXNlb3Zlcigpe1xuICAgICAgICAgICAgICAgIGlmICggd2luZG93Lm9wZW5Ub29sdGlwICkge1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAuaGlkZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsYWJlbFRvb2x0aXAuc2hvdygpO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcCA9IGxhYmVsVG9vbHRpcDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCB0aGlzLmRlc2NyaXB0aW9uKHRoaXMuY29uZmlnLmNhdGVnb3J5KSAhPT0gdW5kZWZpbmVkICYmIHRoaXMuZGVzY3JpcHRpb24odGhpcy5jb25maWcuY2F0ZWdvcnkpICE9PSAnJyApe1xuICAgICAgICAgICAgICAgIGhlYWRpbmcuaHRtbChoZWFkaW5nLmh0bWwoKSArICc8c3ZnIGZvY3VzYWJsZT1cImZhbHNlXCIgY2xhc3M9XCJpbmxpbmUgaGVhZGluZy1pbmZvXCI+PGEgZm9jdXNhYmxlPVwidHJ1ZVwiIHRhYmluZGV4PVwiMFwiIHhsaW5rOmhyZWY9XCIjXCI+PHRleHQgeD1cIjRcIiB5PVwiMTJcIiBjbGFzcz1cImluZm8tbWFya1wiPj88L3RleHQ+PC9hPjwvc3ZnPicpO1xuXG4gICAgICAgICAgICAgICAgaGVhZGluZy5zZWxlY3QoJy5oZWFkaW5nLWluZm8gYScpXG4gICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdoYXMtdG9vbHRpcCcsIHRydWUpXG4gICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9jdXMoKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsICgpID0+IHsgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbW91c2VvdmVyLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdXQnLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5ibHVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3RoaXMuc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsJ3RydWUnKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLm9uKCdibHVyJywgbGFiZWxUb29sdGlwLmhpZGUpXG4gICAgICAgICAgICAgICAgICAgIC5vbignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5ldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2FsbChsYWJlbFRvb2x0aXApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBsYWJlbChrZXkpeyAvLyBUTyBETzogY29tYmluZSB0aGVzZSBpbnRvIG9uZSBtZXRob2QgdGhhdCByZXR1cm5zIG9iamVjdFxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbDtcbiAgICAgICAgfSxcbiAgICAgICAgZGVzY3JpcHRpb24oa2V5KXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHRoaXMuZGljdGlvbmFyeSwga2V5KTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLmRlc2NyaXB0aW9uO1xuICAgICAgICB9LFxuICAgICAgICB1bml0c0Rlc2NyaXB0aW9uKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS51bml0c19kZXNjcmlwdGlvbjtcbiAgICAgICAgfSwgICBcbiAgICAgICAgdW5pdHMoa2V5KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLnVuaXRzOyAgXG4gICAgICAgIH0sXG4gICAgICAgIHRpcFRleHQoa2V5KXtcbiAgICAgICAgICAgIHZhciBzdHIgPSB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLmxhYmVsLnJlcGxhY2UoL1xcXFxuL2csJyAnKTtcbiAgICAgICAgICAgIHJldHVybiBzdHIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHIuc2xpY2UoMSk7XG4gICAgICAgIH1cblxuICAgIH07IC8vIGVuZCBMaW5lQ2hhcnQucHJvdG90eXBlXG5cbiAgICB2YXIgTGluZUNoYXJ0ID0gZnVuY3Rpb24ocGFyZW50LCBkYXRhKXsgLy8gb25lIGNoYXJ0IGlzIGNyZWF0ZWQgZm9yIGVhY2ggZ3JvdXAgb2Ygc2VyaWVzIHRvIGJlIHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvZ2V0aGVyLiBjaGFydHMgd2l0aCB0aGUgc2FtZSBwYXJlbnQgYXJlIHJlbmRlcmVkIGluIHRoZSBzYW1lIGNoYXJ0RGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBkYXRhIGZvciBlYWNoIGNoYXJ0IGlzIGFscmVhZHkgZmlsdGVyZWQgdG8gYmUgb25seSB0aGUgc2VyaWVzIGludGVuZGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZvciB0aGF0IGNoYXJ0XG4gICAgICAgIFxuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBwYXJlbnQuY29uZmlnO1xuICAgICAgICB0aGlzLm1hcmdpblRvcCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5Ub3AgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy50b3A7XG4gICAgICAgIHRoaXMubWFyZ2luUmlnaHQgPSArdGhpcy5jb25maWcubWFyZ2luUmlnaHQgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5yaWdodDtcbiAgICAgICAgdGhpcy5tYXJnaW5Cb3R0b20gPSArdGhpcy5jb25maWcubWFyZ2luQm90dG9tIHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMuYm90dG9tO1xuICAgICAgICB0aGlzLm1hcmdpbkxlZnQgPSArdGhpcy5jb25maWcubWFyZ2luTGVmdCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLmxlZnQ7XG4gICAgICAgIHRoaXMud2lkdGggPSB0aGlzLmNvbmZpZy5zdmdXaWR0aCA/ICt0aGlzLmNvbmZpZy5zdmdXaWR0aCAtIHRoaXMubWFyZ2luUmlnaHQgLSB0aGlzLm1hcmdpbkxlZnQgOiAzMjAgLSB0aGlzLm1hcmdpblJpZ2h0IC0gdGhpcy5tYXJnaW5MZWZ0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IHRoaXMuY29uZmlnLnN2Z0hlaWdodCA/ICt0aGlzLmNvbmZpZy5zdmdIZWlnaHQgLSB0aGlzLm1hcmdpblRvcCAtIHRoaXMubWFyZ2luQm90dG9tIDogKCB0aGlzLndpZHRoICsgdGhpcy5tYXJnaW5SaWdodCArIHRoaXMubWFyZ2luTGVmdCApIC8gMiAtIHRoaXMubWFyZ2luVG9wIC0gdGhpcy5tYXJnaW5Cb3R0b207XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgICAgIHRoaXMucmVzZXRDb2xvcnMgPSB0aGlzLmNvbmZpZy5yZXNldENvbG9ycyB8fCBmYWxzZTtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSB0aGlzLmluaXQocGFyZW50LmNvbnRhaW5lcik7IC8vIFRPIERPICB0aGlzIGlzIGtpbmRhIHdlaXJkXG4gICAgICAgIHRoaXMueFNjYWxlVHlwZSA9IHRoaXMuY29uZmlnLnhTY2FsZVR5cGUgfHwgJ3RpbWUnO1xuICAgICAgICB0aGlzLnlTY2FsZVR5cGUgPSB0aGlzLmNvbmZpZy55U2NhbGVUeXBlIHx8ICdsaW5lYXInO1xuICAgICAgICB0aGlzLnhUaW1lVHlwZSA9IHRoaXMuY29uZmlnLnhUaW1lVHlwZSB8fCAnJVknO1xuICAgICAgICB0aGlzLnNjYWxlQnkgPSB0aGlzLmNvbmZpZy5zY2FsZUJ5IHx8IHRoaXMuY29uZmlnLnZhcmlhYmxlWTtcbiAgICAgIC8vICB0aGlzLmlzRmlyc3RSZW5kZXIgPSB0cnVlO1xuICAgICAgICB0aGlzLnNldFNjYWxlcygpOyAvLyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgXG4gICAgICAgIHRoaXMuc2V0VG9vbHRpcHMoKTtcbiAgICAgICAgdGhpcy5hZGRMaW5lcygpO1xuICAgICAgICB0aGlzLmFkZExhYmVscygpO1xuICAgICAgICB0aGlzLmFkZFBvaW50cygpO1xuICAgICAgICB0aGlzLmFkZFhBeGlzKCk7XG4gICAgICAgIHRoaXMuYWRkWUF4aXMoKTtcbiAgICAgICAgXG5cbiAgICAgICAgICAgICAgIFxuICAgIH07XG5cbiAgICBMaW5lQ2hhcnQucHJvdG90eXBlID0geyAvLyBlYWNoIExpbmVDaGFydCBpcyBhbiBzdmcgdGhhdCBob2xkIGdyb3VwZWQgc2VyaWVzXG4gICAgICAgIGRlZmF1bHRNYXJnaW5zOiB7XG4gICAgICAgICAgICB0b3A6MjcsXG4gICAgICAgICAgICByaWdodDo2NSxcbiAgICAgICAgICAgIGJvdHRvbToyNSxcbiAgICAgICAgICAgIGxlZnQ6MzVcbiAgICAgICAgfSxcbiAgICAgICAgICAgICAgXG4gICAgICAgIGluaXQoY2hhcnREaXYpeyAvLyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgdGhpcyBpcyBjYWxsZWQgb25jZSBmb3IgZWFjaCBzZXJpZXNHcm91cCBvZiBlYWNoIGNhdGVnb3J5LiBcbiAgICAgICAgICAgIEQzQ2hhcnRzLmNvbGxlY3RBbGwucHVzaCh0aGlzKTsgLy8gcHVzaGVzIGFsbCBjaGFydHMgb24gdGhlIHBhZ2UgdG8gb25lIGNvbGxlY3Rpb25cbiAgICAgICAgICAgIHRoaXMucGFyZW50LnBhcmVudC5jb2xsZWN0QWxsLnB1c2godGhpcyk7ICAvLyBwdXNoZXMgYWxsIGNoYXJ0cyBmcm9tIG9uZSBDaGFydEdyb3VwIHRvIHRoZSBDaGFydEdyb3VwJ3MgY29sbGVjdGlvblxuXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gIGQzLnNlbGVjdChjaGFydERpdikuc2VsZWN0KCdkaXYnKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3N2ZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2ZvY3VzYWJsZScsIGZhbHNlKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIHRoaXMud2lkdGggKyB0aGlzLm1hcmdpblJpZ2h0ICsgdGhpcy5tYXJnaW5MZWZ0IClcbiAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgdGhpcy5oZWlnaHQgICsgdGhpcy5tYXJnaW5Ub3AgKyB0aGlzLm1hcmdpbkJvdHRvbSApO1xuXG4gICAgICAgICAgICB0aGlzLnN2ZyA9IGNvbnRhaW5lci5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLGB0cmFuc2xhdGUoJHt0aGlzLm1hcmdpbkxlZnR9LCAke3RoaXMubWFyZ2luVG9wfSlgKTtcblxuICAgICAgICAgICAgdGhpcy54QXhpc0dyb3VwID0gdGhpcy5zdmcuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgIHRoaXMueUF4aXNHcm91cCA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICB0aGlzLmFsbFNlcmllcyA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpIC8vIGllIHRoZSBncm91cCB0aGF0IHdpbGwgaG9sZCBhbGwgdGhlIHNlcmllcyBncm91cHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3BlY2lmaWVkIHRvIGJlIHJlbmRlcmVkIGluIHRoaXMgY2hhcnRcbiAgICAgICAgICAgICAgICAuY2xhc3NlZCgnYWxsLXNlcmllcycsdHJ1ZSk7XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5yZXNldENvbG9ycyApeyAgICAvLyBpZiB0aGUgZGl2J3MgZGF0YS1yZXNldC1jb2xvcnMgYXR0cmlidXRlIGlzIHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2hhcnQgd2lsbCByZW5kZXIgc2VyaWVzIGFzIGlmIGZyb20gdGhlIGJlZ2lubmluZ1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50LnNlcmllc0NvdW50ID0gMDsgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBUTyBETyA6IFRISVMgSFNPVUxEIEJFIElOIENIQVJUIFBST1RPVFlQRVxuICAgICAgICAgICAgdGhpcy5wb3RlbnRpYWxTZXJpZXMgPSB0aGlzLmFsbFNlcmllcy5zZWxlY3RBbGwoJ3BvdGVudGlhbC1zZXJpZXMnKSAvLyBwb3RlbnRpYWwgc2VyaWVzIGJjIHRoZSBzZXJpZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbWF5IG5vdCBoYXZlIGRhdGEgZm9yIHRoZSBjdXJyZW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHkgdmFyaWFibGVcbiAgICAgICAgICAgICAgICAuZGF0YSgoKSA9PiB7IC8vIGFwcGVuZCBhIGcgZm9yIHBvdGVudGlhbCBzZXJpZXMgaW4gdGhlIENoYXJ0cyBkYXRhIChzZXJpZXNHcm91cClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhFUkUgSVMgV0hFUkUgTkVTVElORyBCWSBZIFZBUklBQkxFIFdPVUxEIENPTUUgSU5UTyBQTEFZICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAvLyByZXR1cm4gdGhpcy5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gdGhpcy5jb25maWcudmFyaWFibGVZKS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kYXRhO1xuICAgICAgICAgICAgICAgIH0sIGQgPT4gZC5rZXkpXG4gICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCBkID0+ICdwb3RlbnRpYWwtc2VyaWVzICcgKyBkLmtleSArICcgc2VyaWVzLScgKyB0aGlzLnBhcmVudC5zZXJpZXNDb3VudCArICcgY29sb3ItJyArIHRoaXMucGFyZW50LnNlcmllc0NvdW50KysgJSA0KTtcblxuICAgICAgICAgICAgdGhpcy5iaW5kRGF0YSgpO1xuXG4gICAgICAgICAgICBpZiAoIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzICYmIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzID09PSB0cnVlICl7XG4gICAgICAgICAgICAgICAgdGhpcy5wcmVwYXJlU3RhY2tpbmcoKTsgLy8gVE8gRE8uIFNFUEFSQVRFIFNUQUNLSU5HIEZST00gQVJFQS4gU1RBQ0tJTkcgQ09VTEQgQVBQTFkgVE8gTUFOWSBDSEFSVCBUWVBFU1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29udGFpbmVyLm5vZGUoKTtcbiAgICAgICAgfSxcbiAgICAgICAgYmluZERhdGEoKXtcbiAgICAgICAgICAgIC8vIFRPIERPIDogVEhJUyBIU09VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFXG4gICAgICAgICAgICB2YXIgZWFjaFNlcmllcyA9IHRoaXMucG90ZW50aWFsU2VyaWVzLnNlbGVjdEFsbCgnZy5lYWNoLXNlcmllcycpXG4gICAgICAgICAgICAgICAgLmRhdGEoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBydG4gPSBkLnZhbHVlcy5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IHRoaXMuY29uZmlnLnZhcmlhYmxlWSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBydG4gIT09IHVuZGVmaW5lZCA/IFtydG5dIDogW107IC8vIG5lZWQgdG8gYWNjdCBmb3IgcG9zc2liaWxpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhhdCB0aGUgc2VyaWVzIGlzIGFic2VudCBnaXZlbiB0aGUgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbmZpZy52YXJpYWJsZVkuIGlmIGZpbmQoKSByZXR1cm5zXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVuZGVmaW5lZCwgZGF0YSBzaG91bGQgYmUgZW1wdHkgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgfSwgZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLnZhbHVlc1swXS5zZXJpZXMpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkLnZhbHVlc1swXS5zZXJpZXM7IFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gdXBkYXRlIGV4aXN0aW5nXG4gICAgICAgICAgICBlYWNoU2VyaWVzXG4gICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2VudGVyJywgZmFsc2UpXG4gICAgICAgICAgICAgICAgLmNsYXNzZWQoJ3VwZGF0ZScsIHRydWUpO1xuXG4gICAgICAgICAgICAvLyBjbGVhciBleGl0aW5nXG4gICAgICAgICAgICBlYWNoU2VyaWVzLmV4aXQoKVxuICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDApXG4gICAgICAgICAgICAgICAgLnJlbW92ZSgpO1xuXG4gICAgICAgICAgICB2YXIgZW50ZXJpbmcgPSBlYWNoU2VyaWVzLmVudGVyKCkuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCBkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQudmFsdWVzWzBdLnNlcmllcyArICcgZWFjaC1zZXJpZXMnO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2VudGVyJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLmVhY2hTZXJpZXMgPSBlbnRlcmluZy5tZXJnZShlYWNoU2VyaWVzKTtcbiAgICAgICAgfSxcbiAgICAgICAgdXBkYXRlKHZhcmlhYmxlWSA9IHRoaXMuY29uZmlnLnZhcmlhYmxlWSl7XG4gICAgICAgICAgICB0aGlzLmNvbmZpZy52YXJpYWJsZVkgPSB2YXJpYWJsZVk7XG4gICAgICAgICAgICB0aGlzLnNldFNjYWxlcygpO1xuICAgICAgICAgICAgdGhpcy5iaW5kRGF0YSgpO1xuICAgICAgICAgICAgdGhpcy5hZGRMaW5lcygpO1xuICAgICAgICAgICAgdGhpcy5hZGp1c3RZQXhpcygpO1xuICAgICAgICAgICAgdGhpcy5hZGRQb2ludHMoKTtcbiAgICAgICAgICAgIHRoaXMuYWRqdXN0TGFiZWxzKCk7XG5cbiAgICAgICAgfSxcbiAgICAgICAgcHJlcGFyZVN0YWNraW5nKCl7IC8vIFRPIERPLiBTRVBBUkFURSBTVEFDS0lORyBGUk9NIEFSRUEuIFNUQUNLSU5HIENPVUxEIEFQUExZIFRPIE1BTlkgQ0hBUlQgVFlQRVNcbiAgICAgICAgICAgIHZhciBmb3JTdGFja2luZyA9IHRoaXMuZGF0YS5yZWR1Y2UoKGFjYyxjdXIsaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBpID09PSAwICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXIudmFsdWVzLmZvckVhY2goZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNjLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbdGhpcy5jb25maWcudmFyaWFibGVYXTogZWFjaFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbY3VyLmtleV06IGVhY2hbdGhpcy5jb25maWcudmFyaWFibGVZXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXIudmFsdWVzLmZvckVhY2goZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWNjLmZpbmQob2JqID0+IG9ialt0aGlzLmNvbmZpZy52YXJpYWJsZVhdID09PSBlYWNoW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pW2N1ci5rZXldID0gZWFjaFt0aGlzLmNvbmZpZy52YXJpYWJsZVldO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgICAgICAgICB9LFtdKTtcblxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuc3RhY2sgPSBkMy5zdGFjaygpXG4gICAgICAgICAgICAgICAgICAgIC5rZXlzKHRoaXMuZGF0YS5tYXAoZWFjaCA9PiBlYWNoLmtleSkpXG4gICAgICAgICAgICAgICAgICAgIC5vcmRlcihkMy5zdGFja09yZGVyTm9uZSlcbiAgICAgICAgICAgICAgICAgICAgLm9mZnNldChkMy5zdGFja09mZnNldE5vbmUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuc3RhY2tEYXRhID0gdGhpcy5zdGFjayhmb3JTdGFja2luZyk7XG4gICAgICAgIH0sXG4gICAgICAgIHNldFNjYWxlcygpeyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgLy8gVE8gRE86IFNFVCBTQ0FMRVMgRk9SIE9USEVSIEdST1VQIFRZUEVTXG4gICAgICAgICAgICBcblxuXG4gICAgICAgICAgICB2YXIgZDNTY2FsZSA9IHtcbiAgICAgICAgICAgICAgICB0aW1lOiBkMy5zY2FsZVRpbWUoKSxcbiAgICAgICAgICAgICAgICBsaW5lYXI6IGQzLnNjYWxlTGluZWFyKClcbiAgICAgICAgICAgICAgICAvLyBUTyBETzogYWRkIGFsbCBzY2FsZSB0eXBlcy5cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgeE1heGVzID0gW10sIHhNaW5zID0gW10sIHlNYXhlcyA9IFtdLCB5TWlucyA9IFtdLCB5VmFyaWFibGVzO1xuICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5zY2FsZUJ5LHRoaXMuc2NhbGVCeSAhPT0gdW5kZWZpbmVkLHRoaXMuc2NhbGVCeSAhPT0gJ2FsbCcsQXJyYXkuaXNBcnJheSh0aGlzLnNjYWxlQnkpICE9PSB0cnVlICk7XG4gICAgICAgICAgICBpZiAoIHRoaXMuc2NhbGVCeSAhPT0gdW5kZWZpbmVkICYmIHRoaXMuc2NhbGVCeSAhPT0gJ2FsbCcgJiYgQXJyYXkuaXNBcnJheSh0aGlzLnNjYWxlQnkpICE9PSB0cnVlICYmIHR5cGVvZiB0aGlzLnNjYWxlQnkgIT09ICdzdHJpbmcnICkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbnZhbGlkIGRhdGEtc2NhbGUtYnkgY29uZmlndXJhdGlvbi4gTXVzdCBiZSBzdHJpbmcgb3IgYXJyYXkgb2YgeSB2YXJpYWJsZShzKS4nKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNjYWxlQnkgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIHRoaXMuc2NhbGVCeSA9PT0gJ2FsbCcpIHtcbiAgICAgICAgICAgICAgICB5VmFyaWFibGVzID0gdGhpcy5wYXJlbnQucGFyZW50LnByb3BlcnRpZXM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHlWYXJpYWJsZXMgPSBBcnJheS5pc0FycmF5KHRoaXMuc2NhbGVCeSkgPyB0aGlzLnNjYWxlQnkgOiBBcnJheS5pc0FycmF5KHRoaXMuY29uZmlnLnZhcmlhYmxlWSkgPyB0aGlzLmNvbmZpZy52YXJpYWJsZVkgOiBbdGhpcy5jb25maWcudmFyaWFibGVZXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc29sZS5sb2coeVZhcmlhYmxlcywgdGhpcy5wYXJlbnQucGFyZW50LnByb3BlcnRpZXMpO1xuXG4gICAgICAgICAgICB0aGlzLmRhdGEuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICB4TWF4ZXMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV0ueC5tYXgpO1xuICAgICAgICAgICAgICAgIHhNaW5zLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldLngubWluKTtcbiAgICAgICAgICAgICAgICB5VmFyaWFibGVzLmZvckVhY2goeVZhciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1swXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3lWYXJdICE9PSB1bmRlZmluZWQgKXsgIC8vIG5lZWQgdG8gYWNjdCBmb3IgcG9zc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGF0IHRoZSB5VmFyIGRvZXMgbm90IGV4aXN0IGluIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgc3BlY2lmaWVkIHNlcmllc1xuICAgICAgICAgICAgICAgICAgICAgICAgeU1heGVzLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1swXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3lWYXJdLnkubWF4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHlNaW5zLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1swXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3lWYXJdLnkubWluKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMueE1heCA9IGQzLm1heCh4TWF4ZXMpO1xuICAgICAgICAgICAgdGhpcy54TWluID0gZDMubWF4KHhNaW5zKTtcbiAgICAgICAgICAgIHRoaXMueU1heCA9IGQzLm1heCh5TWF4ZXMpO1xuICAgICAgICAgICAgdGhpcy55TWluID0gZDMubWluKHlNaW5zKTtcbiAgICAgICAgICAgIHRoaXMueFZhbHVlc1VuaXF1ZSA9IFtdO1xuXG4gICAgICAgICAgICBpZiAoIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzICYmIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzID09PSB0cnVlICl7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHlWYWx1ZXMgPSB0aGlzLnN0YWNrRGF0YS5yZWR1Y2UoKGFjYywgY3VyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBhY2MucHVzaCguLi5jdXIucmVkdWNlKChhY2MxLCBjdXIxKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2MxLnB1c2goY3VyMVswXSwgY3VyMVsxXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjMTtcbiAgICAgICAgICAgICAgICAgICAgfSxbXSkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgIH0sW10pO1xuICAgICAgICAgICAgICAgIHRoaXMueU1heCA9IGQzLm1heCh5VmFsdWVzKTtcbiAgICAgICAgICAgICAgICB0aGlzLnlNaW4gPSBkMy5taW4oeVZhbHVlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgeFJhbmdlID0gWzAsIHRoaXMud2lkdGhdLFxuICAgICAgICAgICAgICAgIHlSYW5nZSA9IFt0aGlzLmhlaWdodCwgMF0sXG4gICAgICAgICAgICAgICAgeERvbWFpbixcbiAgICAgICAgICAgICAgICB5RG9tYWluO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnhTY2FsZVR5cGUgPT09ICd0aW1lJykge1xuICAgICAgICAgICAgICAgIHhEb21haW4gPSBbZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKSh0aGlzLnhNaW4pLCBkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKHRoaXMueE1heCldO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gVE8gRE86IE9USEVSIGRhdGEgdHlwZXMgP1xuICAgICAgICAgICAgICAgIHhEb21haW4gPSBbdGhpcy54TWluLCB0aGlzLnhNYXhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCB0aGlzLnlTY2FsZVR5cGUgPT09ICd0aW1lJykge1xuICAgICAgICAgICAgICAgIHlEb21haW4gPSBbZDMudGltZVBhcnNlKHRoaXMueVRpbWVUeXBlKSh0aGlzLnlNaW4pLCBkMy50aW1lUGFyc2UodGhpcy55VGltZVR5cGUpKHRoaXMueU1heCldO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gVE8gRE86IE9USEVSIGRhdGEgdHlwZXMgP1xuICAgICAgICAgICAgICAgIHlEb21haW4gPSBbdGhpcy55TWluLCB0aGlzLnlNYXhdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnhTY2FsZSA9IGQzU2NhbGVbdGhpcy54U2NhbGVUeXBlXS5kb21haW4oeERvbWFpbikucmFuZ2UoeFJhbmdlKTtcbiAgICAgICAgICAgIHRoaXMueVNjYWxlID0gZDNTY2FsZVt0aGlzLnlTY2FsZVR5cGVdLmRvbWFpbih5RG9tYWluKS5yYW5nZSh5UmFuZ2UpO1xuXG5cbiAgICAgICAgfSxcbiAgICAgICAgYWRkTGluZXMoKXtcbiAgICAgICAgICAgIHZhciB6ZXJvVmFsdWVsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgLngoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdGhpcy54VmFsdWVzVW5pcXVlLmluZGV4T2YoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSA9PT0gLTEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMueFZhbHVlc1VuaXF1ZS5wdXNoKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSk7XG4gICAgICAgICAgICAgICAgfSkgXG4gICAgICAgICAgICAgICAgLnkoKCkgPT4gdGhpcy55U2NhbGUoMCkpO1xuICAgICAgICAgICAgdmFyIGxpbmVzID0gdGhpcy5lYWNoU2VyaWVzLnNlbGVjdEFsbCgncGF0aCcpXG4gICAgICAgICAgICAgICAgLmRhdGEoZCA9PiBbZF0pO1xuICAgICAgICAgICAgICAgIFxuXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMubGluZXMgPSBsaW5lcy5lbnRlcigpLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywnbGluZScpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCAoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gemVyb1ZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAubWVyZ2UobGluZXMpO1xuXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUxpbmVzKCk7XG4gICAgICAgICAgLyogIHZhciB2YWx1ZWxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAueChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnhWYWx1ZXNVbmlxdWUuaW5kZXhPZihkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pID09PSAtMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlLnB1c2goZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKTtcbiAgICAgICAgICAgICAgICB9KSBcbiAgICAgICAgICAgICAgICAueSgoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueVNjYWxlKGQudmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pOyovXG4gICAgICAgICAgLy8gVE8gRE8gOiBBREQgQkFDSyBJTiBTVEFDS0VEIFNFUklFUyAgXG4gICAgICAgICAgIC8qIGlmICggdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgJiYgdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgPT09IHRydWUgKXtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgYXJlYSA9IGQzLmFyZWEoKVxuICAgICAgICAgICAgICAgICAgICAueChkID0+IHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZC5kYXRhW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKSlcbiAgICAgICAgICAgICAgICAgICAgLnkwKGQgPT4gdGhpcy55U2NhbGUoZFswXSkpXG4gICAgICAgICAgICAgICAgICAgIC55MShkID0+IHRoaXMueVNjYWxlKGRbMV0pKTtcblxuICAgICAgICAgICAgICAgIHZhciBsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgICAgIC54KGQgPT4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkLmRhdGFbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgICAgICAueShkID0+IHRoaXMueVNjYWxlKGRbMV0pKTtcblxuICAgICAgICAgICAgICAgIHZhciBzdGFja0dyb3VwID0gdGhpcy5zdmcuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3N0YWNrZWQtYXJlYScpO1xuICAgICAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgICAgIHN0YWNrR3JvdXAgICAgXG4gICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3N0YWNrZWQtYXJlYScpXG4gICAgICAgICAgICAgICAgICAgIC5kYXRhKHRoaXMuc3RhY2tEYXRhKVxuICAgICAgICAgICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ3BhdGgnKSAvLyBUTyBETzogYWRkIHplcm8tbGluZSBlcXVpdmFsZW50IGFuZCBsb2dpYyBmb3IgdHJhbnNpdGlvbiBvbiB1cGRhdGVcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKGQsaSkgPT4gJ2FyZWEtbGluZSBjb2xvci0nICsgaSkgLy8gVE8gRE8gbm90IHF1aXRlIHJpZ2h0IHRoYXQgY29sb3Igc2hvbGQgYmUgYGlgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgeW91IGhhdmUgbW9yZSB0aGFuIG9uZSBncm91cCBvZiBzZXJpZXMsIHdpbGwgcmVwZWF0XG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgZCA9PiBhcmVhKGQpKTtcblxuICAgICAgICAgICAgICAgIHN0YWNrR3JvdXBcbiAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnc3RhY2tlZC1saW5lJykgLy8gVE8gRE86IGFkZCB6ZXJvLWxpbmUgZXF1aXZhbGVudCBhbmQgbG9naWMgZm9yIHRyYW5zaXRpb24gb24gdXBkYXRlXG4gICAgICAgICAgICAgICAgICAgIC5kYXRhKHRoaXMuc3RhY2tEYXRhKVxuICAgICAgICAgICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ3BhdGgnKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoZCxpKSA9PiAnbGluZSBjb2xvci0nICsgaSkgXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgZCA9PiBsaW5lKGQpKTtcblxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfSBlbHNlIHsgXG4gICAgICAgICAgICAgICAgaWYgKCB0aGlzLmlzRmlyc3RSZW5kZXIgKXsgKi9cbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgLyogLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApLmRlbGF5KDE1MClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgLyoub24oJ2VuZCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGkgPT09IGFycmF5Lmxlbmd0aCAtIDEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkUG9pbnRzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkTGFiZWxzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7Ki8gICBcbiAgICAgICAgICAgICAgIC8qIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdEFsbCh0aGlzLmxpbmVzLm5vZGVzKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZWFjaCgoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpc05hTihkLnZhbHVlc1swXVt0aGlzLmNvbmZpZy52YXJpYWJsZVldKSApeyAvLyB0aGlzIGEgd29ya2Fyb3VuZCBmb3IgaGFuZGxpbmcgTkFzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3b3VsZCBiZSBuaWNlciB0byBoYW5kbGUgdmlhIGV4aXQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYnV0IG1heSBiZSBoYXJkIGJjIG9mIGhvdyBkYXRhIGlzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzdHJ1Y3R1cmVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QoYXJyYXlbaV0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zdHlsZSgnb3BhY2l0eScsMClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vbignZW5kJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2Rpc3BsYXktbm9uZScsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QoYXJyYXlbaV0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkaXNwbGF5LW5vbmUnLCBmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zdHlsZSgnb3BhY2l0eScsMSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCAoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdEFsbCh0aGlzLnBvaW50cy5ub2RlcygpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVhY2goKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggaXNOYU4oZFt0aGlzLmNvbmZpZy52YXJpYWJsZVldKSApeyAvLyB0aGlzIGEgd29ya2Fyb3VuZCBmb3IgaGFuZGxpbmcgTkFzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3b3VsZCBiZSBuaWNlciB0byBoYW5kbGUgdmlhIGV4aXQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYnV0IG1heSBiZSBoYXJkIGJjIG9mIGhvdyBkYXRhIGlzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzdHJ1Y3R1cmVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QoYXJyYXlbaV0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zdHlsZSgnb3BhY2l0eScsMClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vbignZW5kJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2Rpc3BsYXktbm9uZScsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2Rpc3BsYXktbm9uZScsIGZhbHNlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLDEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY3gnLCBkID0+IHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY3knLCBkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy55U2NhbGUoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0QWxsKHRoaXMubGFiZWxHcm91cHMubm9kZXMoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5lYWNoKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbGFiZWxHcm91cCA9IGQzLnNlbGVjdChhcnJheVtpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpc05hTihkLnZhbHVlc1tkLnZhbHVlcy5sZW5ndGggLSAxXVt0aGlzLmNvbmZpZy52YXJpYWJsZVldKSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsR3JvdXBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywwKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdlbmQnLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsR3JvdXBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2Rpc3BsYXktbm9uZScsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsR3JvdXAuc2VsZWN0KCcuaGFzLXRvb2x0aXAnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLCAtMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWxHcm91cFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2Rpc3BsYXktbm9uZScsIGZhbHNlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLDEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKGQpID0+IGB0cmFuc2xhdGUoJHt0aGlzLndpZHRoICsgOH0sICR7dGhpcy55U2NhbGUoZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdGhpcy5jb25maWcudmFyaWFibGVZXSkgKyAzfSlgKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbEdyb3VwLnNlbGVjdCgnLmhhcy10b29sdGlwJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0YWJpbmRleCcsMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3RBbGwodGhpcy5sYWJlbHMubm9kZXMoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdlbmQnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGkgPT09IGFycmF5Lmxlbmd0aCAtIDEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWxheExhYmVscygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3RBbGwodGhpcy55QXhpc0dyb3VwLm5vZGVzKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsKGQzLmF4aXNMZWZ0KHRoaXMueVNjYWxlKS50aWNrU2l6ZUlubmVyKDQpLnRpY2tTaXplT3V0ZXIoMCkudGlja1BhZGRpbmcoMSkudGlja3MoNSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAub24oJ2VuZCcsKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QoYXJyYXlbaV0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCcudGljaycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZWFjaCgoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2xhc3NlZCgnemVybycsICggZCA9PT0gMCAmJiBpICE9PSAwICYmIHRoaXMueU1pbiA8IDAgKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LDUwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0qL1xuICAgICAgICB9LFxuICAgICAgICB1cGRhdGVMaW5lcygpe1xuICAgICAgICAgICAgdmFyIHZhbHVlbGluZSA9IGQzLmxpbmUoKVxuICAgICAgICAgICAgICAgIC54KGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMueFZhbHVlc1VuaXF1ZS5pbmRleE9mKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkgPT09IC0xICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnhWYWx1ZXNVbmlxdWUucHVzaChkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpO1xuICAgICAgICAgICAgICAgIH0pIFxuICAgICAgICAgICAgICAgIC55KChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy55U2NhbGUoZC52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMubGluZXMudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMCkuZGVsYXkoMTUwKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGFkZFhBeGlzKCl7IC8vIGNvdWxkIGJlIGluIENoYXJ0IHByb3RvdHlwZSA/XG4gICAgICAgICAgICB2YXIgeEF4aXNQb3NpdGlvbixcbiAgICAgICAgICAgICAgICB4QXhpc09mZnNldCxcbiAgICAgICAgICAgICAgICBheGlzVHlwZTtcblxuICAgICAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy54QXhpc1Bvc2l0aW9uID09PSAndG9wJyApe1xuICAgICAgICAgICAgICAgIHhBeGlzUG9zaXRpb24gPSB0aGlzLnlNYXg7XG4gICAgICAgICAgICAgICAgeEF4aXNPZmZzZXQgPSAtdGhpcy5tYXJnaW5Ub3A7XG4gICAgICAgICAgICAgICAgYXhpc1R5cGUgPSBkMy5heGlzVG9wO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB4QXhpc1Bvc2l0aW9uID0gdGhpcy55TWluO1xuICAgICAgICAgICAgICAgIHhBeGlzT2Zmc2V0ID0gdGhpcy5tYXJnaW5Cb3R0b20gLSAxNTtcbiAgICAgICAgICAgICAgICBheGlzVHlwZSA9IGQzLmF4aXNCb3R0b207XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgYXhpcyA9IGF4aXNUeXBlKHRoaXMueFNjYWxlKS50aWNrU2l6ZUlubmVyKDQpLnRpY2tTaXplT3V0ZXIoMCkudGlja1BhZGRpbmcoMSk7XG4gICAgICAgICAgICBpZiAoIHRoaXMueFNjYWxlVHlwZSA9PT0gJ3RpbWUnICl7XG4gICAgICAgICAgICAgICAgYXhpcy50aWNrVmFsdWVzKHRoaXMueFZhbHVlc1VuaXF1ZS5tYXAoZWFjaCA9PiBkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGVhY2gpKSk7IC8vIFRPIERPOiBhbGxvdyBmb3Igb3RoZXIgeEF4aXMgQWRqdXN0bWVudHNcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMueEF4aXNHcm91cFxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKDAsJyArICggdGhpcy55U2NhbGUoeEF4aXNQb3NpdGlvbikgKyB4QXhpc09mZnNldCApICsgJyknKSAvLyBub3QgcHJvZ3JhbWF0aWMgcGxhY2VtZW50IG9mIHgtYXhpc1xuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzIHgtYXhpcycpXG4gICAgICAgICAgICAgICAgLmNhbGwoYXhpcyk7XG4gICAgICAgIH0sXG4gICAgICAgIGFkanVzdFlBeGlzKCl7XG4gICAgICAgICAgICB0aGlzLnlBeGlzR3JvdXBcbiAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzTGVmdCh0aGlzLnlTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDUpKVxuICAgICAgICAgICAgICAgIC5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1hcmtaZXJvKCk7XG4gICAgICAgICAgICAgICAgfSk7IFxuICAgICAgICAgICAgICAgIC8vIHRvIGRvIG1ha2UgdGhpcyBEUlllciAocmVwZWF0ZWQgYmVsb3cpIGFuZCBwcm9ncmFtbWF0aWNcblxuICAgICAgICAgICAgLy90aGlzLm1hcmtaZXJvKCk7XG5cbiAgICAgICAgfSxcbiAgICAgICAgbWFya1plcm8oKXsgLy8gaWYgemVybyBpcyBub3QgdGhlIGZpcnN0IHRpY2sgbWFyaywgbWFyayBpdCB3aXRoIGJvbGQgdHlwZVxuICAgICAgICAgICAgdGhpcy55QXhpc0dyb3VwXG4gICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnLnRpY2snKVxuICAgICAgICAgICAgICAgIC5lYWNoKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ3plcm8nLCBkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLGksdGhpcy55TWluKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKCBkID09PSAwICYmIGkgIT09IDAgJiYgdGhpcy55TWluIDwgMCApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGFkZFlBeGlzKCl7XG4gICAgICAgICAgICAvKiBheGlzICovXG4gICAgICAgICAgICB0aGlzLnlBeGlzR3JvdXBcbiAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2F4aXMgeS1heGlzJylcbiAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQodGhpcy55U2NhbGUpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrcyg1KSk7XG5cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5tYXJrWmVybygpO1xuXG5cbiAgICAgICAgICAgIC8qIGxhYmVscyAqL1xuXG4gICAgICAgICAgICB2YXIgdW5pdHNMYWJlbHMgPSB0aGlzLmFsbFNlcmllcy5zZWxlY3QoJy5lYWNoLXNlcmllcycpXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgnYScpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3hsaW5rOmhyZWYnLCAnIycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywgLTEpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2ZvY3VzYWJsZScsIGZhbHNlKVxuICAgICAgICAgICAgICAgIC5vbignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGQzLmV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAndW5pdHMnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoKSA9PiBgdHJhbnNsYXRlKC0ke3RoaXMubWFyZ2luTGVmdCAtNSB9LC0ke3RoaXMubWFyZ2luVG9wIC0gMTR9KWApXG4gICAgICAgICAgICAgICAgLmh0bWwoKGQsaSkgPT4gaSA9PT0gMCA/IHRoaXMucGFyZW50LnVuaXRzKGQudmFsdWVzWzBdLnNlcmllcykgOiBudWxsKTtcblxuICAgICAgICAgICAgdmFyIGxhYmVsVG9vbHRpcCA9IGQzLnRpcCgpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcImQzLXRpcCBsYWJlbC10aXBcIilcbiAgICAgICAgICAgICAgICAuZGlyZWN0aW9uKCdlJylcbiAgICAgICAgICAgICAgICAub2Zmc2V0KFstMiwgNF0pO1xuICAgICAgICAgICAgICAgIFxuXG4gICAgICAgICAgICBmdW5jdGlvbiBtb3VzZW92ZXIoZCl7XG4gICAgICAgICAgICAgICAgaWYgKCB3aW5kb3cub3BlblRvb2x0aXAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcC5oaWRlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxhYmVsVG9vbHRpcC5odG1sKHRoaXMucGFyZW50LnVuaXRzRGVzY3JpcHRpb24oZC52YWx1ZXNbMF0uc2VyaWVzKSk7XG4gICAgICAgICAgICAgICAgbGFiZWxUb29sdGlwLnNob3coKTtcbiAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAgPSBsYWJlbFRvb2x0aXA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHVuaXRzTGFiZWxzLmVhY2goKGQsIGksIGFycmF5KSA9PiB7IC8vIFRPIERPIHRoaXMgaXMgcmVwZXRpdGl2ZSBvZiBhZGRMYWJlbHMoKVxuICAgICAgICAgICAgICAgIGlmICggdGhpcy5wYXJlbnQudW5pdHNEZXNjcmlwdGlvbihkLnZhbHVlc1swXS5zZXJpZXMpICE9PSB1bmRlZmluZWQgJiYgZDMuc2VsZWN0KGFycmF5W2ldKS5odG1sKCkgIT09ICcnKXtcbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldLnBhcmVudE5vZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZm9jdXNhYmxlJyx0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2hhcy10b29sdGlwJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5W2ldLmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsIGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vdXNlb3Zlci5jYWxsKHRoaXMsZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5ibHVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdibHVyJywgbGFiZWxUb29sdGlwLmhpZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChsYWJlbFRvb2x0aXApOyAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLmh0bWwoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZDMuc2VsZWN0KHRoaXMpLmh0bWwoKSArICc8dHNwYW4gZHk9XCItMC40ZW1cIiBkeD1cIjAuMmVtXCIgY2xhc3M9XCJpbmZvLW1hcmtcIj4/PC90c3Bhbj4nOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgXG4gICAgICAgIH0sXG4gICAgICAgIGFkanVzdExhYmVscygpe1xuICAgICAgICAgICAgdGhpcy5hbGxTZXJpZXMuc2VsZWN0QWxsKCd0ZXh0LnNlcmllcy1sYWJlbCcpXG4gICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbigyMDApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3knLDApXG4gICAgICAgICAgICAgICAgLm9uKCdlbmQnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggaSA9PT0gYXJyYXkubGVuZ3RoIC0gMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRMYWJlbHMoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBhZGRMYWJlbHMoKXtcblxuICAgICAgICAgICAgdmFyIGxhYmVsVG9vbHRpcCA9IGQzLnRpcCgpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcImQzLXRpcCBsYWJlbC10aXBcIilcbiAgICAgICAgICAgICAgICAuZGlyZWN0aW9uKCduJylcbiAgICAgICAgICAgICAgICAub2Zmc2V0KFstNCwgMTJdKTtcbiAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgZnVuY3Rpb24gbW91c2VvdmVyKGQpe1xuICAgICAgICAgICAgICAgIGlmICggd2luZG93Lm9wZW5Ub29sdGlwICkge1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAuaGlkZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsYWJlbFRvb2x0aXAuaHRtbCh0aGlzLnBhcmVudC5kZXNjcmlwdGlvbihkLnZhbHVlc1swXS5zZXJpZXMpKTtcbiAgICAgICAgICAgICAgICBsYWJlbFRvb2x0aXAuc2hvdygpO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcCA9IGxhYmVsVG9vbHRpcDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAvKiB0aGlzLmxhYmVsR3JvdXBzID0gdGhpcy5lYWNoU2VyaWVzXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgnZycpOyAqL1xuXG4gICAgICAgICAgICB2YXIgbGFiZWxzID0gdGhpcy5lYWNoU2VyaWVzLnNlbGVjdEFsbCgnYS5sYWJlbC1hbmNob3InKVxuICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtkXTtcbiAgICAgICAgICAgICAgICB9LCBkID0+IGQudmFsdWVzWzBdLnNlcmllcyArICctbGFiZWwnKTtcblxuXG5cbiAgICAgICAgICAgIHRoaXMuYWxsU2VyaWVzLnNlbGVjdEFsbCgnYS5sYWJlbC1hbmNob3InKVxuICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGB0cmFuc2xhdGUoJHt0aGlzLndpZHRoICsgOH0sICR7dGhpcy55U2NhbGUoZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV0udmFsdWUpICsgM30pYDtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5vbignZW5kJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIGkgPT09IGFycmF5Lmxlbmd0aCAtIDEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVsYXhMYWJlbHMoKTsgLy8gZG8gaSBuZWVkIGFkZGl0aW9uYWwgdGltZSBmb3IgdGhlIGVudGVyaW5nIG9uZXMgdG8gZmluaXNoPyBnYXRlP1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZhciBuZXdMYWJlbHMgPSBsYWJlbHMuZW50ZXIoKS5hcHBlbmQoJ2EnKVxuICAgICAgICAgICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBgdHJhbnNsYXRlKCR7dGhpcy53aWR0aCArIDh9LCAke3RoaXMueVNjYWxlKGQudmFsdWVzW2QudmFsdWVzLmxlbmd0aCAtIDFdLnZhbHVlKSArIDN9KWA7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCdsYWJlbC1hbmNob3InKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0aXRsZScsJ2NsaWNrIHRvIGJyaW5nIHRvIGZyb250JylcbiAgICAgICAgICAgICAgICAuYXR0cigneGxpbms6aHJlZicsJyMnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0YWJpbmRleCcsLTEpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2ZvY3VzYWJsZScsZmFsc2UpXG4gICAgICAgICAgICAgICAgLm9uKCdjbGljaycsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZDMuZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5icmluZ1RvVG9wLmNhbGwoYXJyYXlbaV0ucGFyZW50Tm9kZSk7IFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIG5ld0xhYmVscy5hcHBlbmQoJ3RleHQnKSBcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnc2VyaWVzLWxhYmVsJylcbiAgICAgICAgICAgICAgICAuaHRtbCgoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICc8dHNwYW4geD1cIjBcIj4nICsgdGhpcy5wYXJlbnQubGFiZWwoZC52YWx1ZXNbMF0uc2VyaWVzKS5yZXBsYWNlKC9cXFxcbi9nLCc8L3RzcGFuPjx0c3BhbiB4PVwiMC41ZW1cIiBkeT1cIjEuMmVtXCI+JykgKyAnPC90c3Bhbj4nO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmVhY2goKGQsIGksIGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50LmRlc2NyaXB0aW9uKGQudmFsdWVzWzBdLnNlcmllcykgIT09IHVuZGVmaW5lZCAmJiB0aGlzLnBhcmVudC5kZXNjcmlwdGlvbihkLnZhbHVlc1swXS5zZXJpZXMpICE9PSAnJyl7XG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QoYXJyYXlbaV0ucGFyZW50Tm9kZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2ZvY3VzYWJsZScsdHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2xhc3NlZCgnaGFzLXRvb2x0aXAnLCB0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5mb2N1cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsIGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb3VzZW92ZXIuY2FsbCh0aGlzLGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXlbaV0uYmx1cigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdibHVyJywgbGFiZWxUb29sdGlwLmhpZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGwobGFiZWxUb29sdGlwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuaHRtbChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZDMuc2VsZWN0KHRoaXMpLmh0bWwoKSArICc8dHNwYW4gZHk9XCItMC40ZW1cIiBkeD1cIjAuMmVtXCIgY2xhc3M9XCJpbmZvLW1hcmtcIj4/PC90c3Bhbj4nOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBuZXdMYWJlbHMudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLDEpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLmxhYmVscyA9IG5ld0xhYmVscy5tZXJnZShsYWJlbHMpLnNlbGVjdEFsbCgndGV4dC5zZXJpZXMtbGFiZWwnKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgXG4gICAgICAgICAvKiAgIG5ld0xhYmVscy5lYWNoKChkLCBpLCBhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQpO1xuICAgICAgICAgICAgICAgIGlmICggdGhpcy5wYXJlbnQuZGVzY3JpcHRpb24oZC52YWx1ZXNbMF0uc2VyaWVzKSAhPT0gdW5kZWZpbmVkICYmIHRoaXMucGFyZW50LmRlc2NyaXB0aW9uKGQudmFsdWVzWzBdLnNlcmllcykgIT09ICcnKXtcbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldLnBhcmVudE5vZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZm9jdXNhYmxlJyx0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2hhcy10b29sdGlwJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5W2ldLmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsIGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vdXNlb3Zlci5jYWxsKHRoaXMsZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdtb3VzZW91dCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5ibHVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdibHVyJywgbGFiZWxUb29sdGlwLmhpZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChsYWJlbFRvb2x0aXApO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5odG1sKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQzLnNlbGVjdCh0aGlzKS5odG1sKCkgKyAnPHRzcGFuIGR5PVwiLTAuNGVtXCIgZHg9XCIwLjJlbVwiIGNsYXNzPVwiaW5mby1tYXJrXCI+PzwvdHNwYW4+JzsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTsqL1xuICAgICAgICAgICAvLyB0aGlzLmlzRmlyc3RSZW5kZXIgPSBmYWxzZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCBsYWJlbHMubm9kZXMoKS5sZW5ndGggPT09IDAgKXsgLy8gaWUgdGhlcmUgYXJlIG5vIGV4aXRpbmcgbGFiZWxzIChmaXJzdCByZW5kZXIgb3IgYWxsIGhhdmVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGV4aXRlZCkuIGlmIHRoZXJlIGFyZSBleGlzdGluZyBsYWJlbHMsIHJlbGF4TGFiZWxzIGlzIGNhbGxlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gb24gJ2VuZCcgb2YgdGhlaXIgdHJhbnNpdGlvbiBhYm92ZS5cbiAgICAgICAgICAgICAgICB0aGlzLnJlbGF4TGFiZWxzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgIFxuICAgICAgICAgICBcbiAgICAgICAgfSxcbiAgICAgICAgcmVsYXhMYWJlbHMoKXsgLy8gSFQgaHR0cDovL2pzZmlkZGxlLm5ldC90aHVkZmFjdG9yL0IyV0JVLyBhZGFwdGVkIHRlY2huaXF1ZVxuICAgICAgICAgICAgdmFyIGFscGhhID0gMSxcbiAgICAgICAgICAgICAgICBzcGFjaW5nID0gMCxcbiAgICAgICAgICAgICAgICBhZ2FpbiA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLmxhYmVscy5lYWNoKChkLGksYXJyYXkxKSA9PiB7XG5cbiAgICAgICAgICAgICAgICB2YXIgYSA9IGFycmF5MVtpXSxcbiAgICAgICAgICAgICAgICAgICAgJGEgPSBkMy5zZWxlY3QoYSksXG4gICAgICAgICAgICAgICAgICAgIHlBID0gJGEuYXR0cigneScpLFxuICAgICAgICAgICAgICAgICAgICBhUmFuZ2UgPSBkMy5yYW5nZShNYXRoLnJvdW5kKGEuZ2V0Q1RNKCkuZikgLSBzcGFjaW5nICsgcGFyc2VJbnQoeUEpLCBNYXRoLnJvdW5kKGEuZ2V0Q1RNKCkuZikgKyBNYXRoLnJvdW5kKGEuZ2V0QkJveCgpLmhlaWdodCkgKyAxICsgc3BhY2luZyArIHBhcnNlSW50KHlBKSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxhYmVscy5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBiID0gdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgJGIgPSBkMy5zZWxlY3QoYiksXG4gICAgICAgICAgICAgICAgICAgIHlCID0gJGIuYXR0cigneScpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIGEgPT09IGIgKSB7cmV0dXJuO31cbiAgICAgICAgICAgICAgICAgICAgdmFyIGJMaW1pdHMgPSBbTWF0aC5yb3VuZChiLmdldENUTSgpLmYpIC0gc3BhY2luZyArIHBhcnNlSW50KHlCKSwgTWF0aC5yb3VuZChiLmdldENUTSgpLmYpICsgYi5nZXRCQm94KCkuaGVpZ2h0ICsgc3BhY2luZyArIHBhcnNlSW50KHlCKV07XG4gICAgICAgICAgICAgICAgICAgIGlmICggKGFSYW5nZVswXSA8IGJMaW1pdHNbMF0gJiYgYVJhbmdlW2FSYW5nZS5sZW5ndGggLSAxXSA8IGJMaW1pdHNbMF0pIHx8IChhUmFuZ2VbMF0gPiBiTGltaXRzWzFdICYmIGFSYW5nZVthUmFuZ2UubGVuZ3RoIC0gMV0gPiBiTGltaXRzWzFdKSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZygnbm8gY29sbGlzaW9uJywgYSwgYik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH0gLy8gbm8gY29sbGlzb25cbiAgICAgICAgICAgICAgICAgICAgdmFyIHNpZ24gPSBiTGltaXRzWzBdIC0gYVJhbmdlW2FSYW5nZS5sZW5ndGggLSAxXSA8PSBhUmFuZ2VbMF0gLSBiTGltaXRzWzFdID8gMSA6IC0xLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWRqdXN0ID0gc2lnbiAqIGFscGhhO1xuICAgICAgICAgICAgICAgICAgICAkYi5hdHRyKCd5JywgKCt5QiAtIGFkanVzdCkgKTtcbiAgICAgICAgICAgICAgICAgICAgJGEuYXR0cigneScsICgreUEgKyBhZGp1c3QpICk7XG4gICAgICAgICAgICAgICAgICAgIGFnYWluID0gdHJ1ZTsgXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCBpID09PSBhcnJheTEubGVuZ3RoIC0gMSAmJiBhZ2FpbiA9PT0gdHJ1ZSApIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbGF4TGFiZWxzKCk7XG4gICAgICAgICAgICAgICAgICAgIH0sMjApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBhZGRQb2ludHMoKXtcbiAgICAgICAgICAgIC8vIGV4aXN0aW5nXG4gICAgICAgICAgICB2YXIgcG9pbnRzID0gdGhpcy5lYWNoU2VyaWVzLnNlbGVjdEFsbCgnY2lyY2xlLmRhdGEtcG9pbnQnKVxuICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZC52YWx1ZXM7XG4gICAgICAgICAgICAgICAgfSwgZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQuc2VyaWVzICsgJy0nICsgZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQuc2VyaWVzICsgJy0nICsgZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgZXhpc3RpbmdcbiAgICAgICAgICAgIHBvaW50c1xuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdlbnRlcicsIGZhbHNlKVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCd1cGRhdGUnLCB0cnVlKVxuICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKS5kZWxheSgxNTApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2N4JywgZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjeScsIGQgPT4gdGhpcy55U2NhbGUoZC52YWx1ZSkpO1xuXG4gICAgICAgICAgICBwb2ludHMuZXhpdCgpLnJlbW92ZSgpO1xuXG4gICAgICAgICAgICB2YXIgZW50ZXIgPSBwb2ludHMuZW50ZXIoKTtcblxuXG4gICAgICAgICAgICBlbnRlci5hcHBlbmQoJ2NpcmNsZScpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywwKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdmb2N1c2FibGUnLCB0cnVlKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdvcGFjaXR5JywgMClcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnZGF0YS1wb2ludCBlbnRlcicpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3InLCAnNCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2N4JywgZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjeScsIGQgPT4gdGhpcy55U2NhbGUoZC52YWx1ZSkpXG4gICAgICAgICAgICAgICAgLm9uKCdtb3VzZW92ZXInLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIG1vdXNlb3Zlci5jYWxsKHRoaXMsZCxpLGFycmF5KTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5vbignZm9jdXMnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIG1vdXNlb3Zlci5jYWxsKHRoaXMsZCxpLGFycmF5KTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5vbignbW91c2VvdXQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIG1vdXNlb3V0LmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub24oJ2JsdXInLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIG1vdXNlb3V0LmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub24oJ2NsaWNrJywgdGhpcy5icmluZ1RvVG9wKVxuICAgICAgICAgICAgICAgIC5vbigna2V5dXAnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoZDMuZXZlbnQua2V5Q29kZSA9PT0gMTMgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5icmluZ1RvVG9wLmNhbGwoYXJyYXlbaV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2FsbCh0aGlzLnRvb2x0aXApXG4gICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApLmRlbGF5KDY1MClcbiAgICAgICAgICAgICAgICAuYXR0cignb3BhY2l0eScsIDEpO1xuXG4gICAgICAgICAgICB0aGlzLnBvaW50cyA9IGVudGVyLm1lcmdlKHBvaW50cyk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHRoaXMucG9pbnRzKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIGZ1bmN0aW9uIG1vdXNlb3ZlcihkLGksYXJyYXkpe1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB3aW5kb3cub3BlblRvb2x0aXAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAuaGlkZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHZhciBrbGFzcyA9IGQzLnNlbGVjdChhcnJheVtpXS5wYXJlbnROb2RlLnBhcmVudE5vZGUpLmF0dHIoJ2NsYXNzJykubWF0Y2goL2NvbG9yLVxcZC8pWzBdOyAvLyBnZXQgdGhlIGNvbG9yIGNsYXNzIG9mIHRoZSBwYXJlbnQgZ1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJywgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJykgKyAnICcgKyBrbGFzcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJlZml4ID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3VmZml4ID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50LnVuaXRzKGQuc2VyaWVzKSAmJiB0aGlzLnBhcmVudC51bml0cyhkLnNlcmllcylbMF0gPT09ICckJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZWZpeCA9ICckJzsgLy8gVE8gRE86ICBoYW5kbGUgb3RoZXIgcHJlZml4ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBodG1sID0gJzxzdHJvbmc+JyArIHRoaXMucGFyZW50LnRpcFRleHQoZC5zZXJpZXMpICsgJzwvc3Ryb25nPiAoJyArIGQueWVhciArICcpPGJyIC8+JyArIHByZWZpeCArIGQzLmZvcm1hdCgnLCcpKGQudmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnBhcmVudC51bml0cyhkLnNlcmllcykgJiYgdGhpcy5wYXJlbnQudW5pdHMoZC5zZXJpZXMpICE9PSAnJyl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VmZml4ID0gdGhpcy5wYXJlbnQudW5pdHMoZC5zZXJpZXMpLnJlcGxhY2UoJyQnLCcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBodG1sICs9ICcgJyArIHN1ZmZpeDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPIERPOiBIQU5ETEUgVEhFIENVTVVMQVRWRSBWQUxVRVMgXG4gICAgICAgICAgICAgICAgICAgICAgLyogIHZhciBjdW0gPSB0aGlzLmNvbmZpZy52YXJpYWJsZVkucmVwbGFjZSgnX3ZhbHVlJywnX2N1bScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBkW2N1bV0gIT09ICcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaHRtbCArPSAnPGJyIC8+KCcgKyBwcmVmaXggKyBkMy5mb3JtYXQoJywnKShkW2N1bV0pICsgc3VmZml4ICsgJyBjdW11bGF0aXZlKSc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9Ki9cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5odG1sKGh0bWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLnNob3coKTtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwID0gdGhpcy50b29sdGlwO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZnVuY3Rpb24gbW91c2VvdXQoKXtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuYXR0cignY2xhc3MnLCB0aGlzLnRvb2x0aXAuYXR0cignY2xhc3MnKS5yZXBsYWNlKC8gY29sb3ItXFxkL2csICcnKSk7XG4gICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmh0bWwoJycpO1xuICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5oaWRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcblxuICAgICAgICB9LFxuICAgICAgICBicmluZ1RvVG9wKCl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICggdGhpcy5wYXJlbnROb2RlICE9PSB0aGlzLnBhcmVudE5vZGUucGFyZW50Tm9kZS5sYXN0Q2hpbGQgKXtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcy5wYXJlbnROb2RlKS5tb3ZlVG9Gcm9udCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZm9jdXMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgc2V0VG9vbHRpcHMoKXtcblxuICAgICAgICAgICAgdGhpcy50b29sdGlwID0gZDMudGlwKClcbiAgICAgICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwiZDMtdGlwXCIpXG4gICAgICAgICAgICAgICAgLmRpcmVjdGlvbignbicpXG4gICAgICAgICAgICAgICAgLm9mZnNldChbLTgsIDBdKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgfVxuICAgIH07XG5cblxuICAgIHJldHVybiB7XG4gICAgICAgIENoYXJ0RGl2XG4gICAgfTtcblxufSkoKTtcbiIsImV4cG9ydCBjb25zdCBIZWxwZXJzID0gKGZ1bmN0aW9uKCl7XG4gICAgLyogZ2xvYmFscyBET01TdHJpbmdNYXAsIGQzICovXG4gICAgU3RyaW5nLnByb3RvdHlwZS5jbGVhblN0cmluZyA9IGZ1bmN0aW9uKCkgeyAvLyBsb3dlcmNhc2UgYW5kIHJlbW92ZSBwdW5jdHVhdGlvbiBhbmQgcmVwbGFjZSBzcGFjZXMgd2l0aCBoeXBoZW5zOyBkZWxldGUgcHVuY3R1YXRpb25cbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvWyBcXFxcXFwvXS9nLCctJykucmVwbGFjZSgvWydcIuKAneKAmeKAnOKAmCxcXC4hXFw/O1xcKFxcKSZdL2csJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgfTtcblxuICAgIFN0cmluZy5wcm90b3R5cGUucmVtb3ZlVW5kZXJzY29yZXMgPSBmdW5jdGlvbigpIHsgXG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL18vZywnICcpO1xuICAgIH07XG5cbiAgICBET01TdHJpbmdNYXAucHJvdG90eXBlLmNvbnZlcnQgPSBmdW5jdGlvbigpIHsgLy8gd2lsbCBmYWlsIGx0ZSBJRTEwXG4gICAgICAgIHZhciBuZXdPYmogPSB7fTtcbiAgICAgICAgZm9yICggdmFyIGtleSBpbiB0aGlzICl7XG4gICAgICAgICAgICBpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eShrZXkpKXtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBuZXdPYmpba2V5XSA9IEpTT04ucGFyc2UodGhpc1trZXldKTsgLy8gaWYgdGhlIHZhbHVlIGNhbiBiZSBpbnRlcnByZXR0ZWQgYXMgSlNPTiwgaXQgaXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIGl0IGNhbid0IGl0IGlzbid0ICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgICAgICBuZXdPYmpba2V5XSA9IHRoaXNba2V5XTsgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld09iajtcbiAgICB9O1xuXG4gICAgZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5tb3ZlVG9Gcm9udCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHRoaXMucGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0aGlzKTtcbiAgICAgICAgICB9KTtcbiAgICB9O1xuICAgIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUubW92ZVRvQmFjayA9IGZ1bmN0aW9uKCl7IFxuICAgICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICB2YXIgZmlyc3RDaGlsZCA9IHRoaXMucGFyZW50Tm9kZS5maXJzdENoaWxkO1xuICAgICAgICAgICAgaWYgKCBmaXJzdENoaWxkICkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUodGhpcywgZmlyc3RDaGlsZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBpZiAod2luZG93Lk5vZGVMaXN0ICYmICFOb2RlTGlzdC5wcm90b3R5cGUuZm9yRWFjaCkge1xuICAgICAgICBOb2RlTGlzdC5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgICAgICAgICAgdGhpc0FyZyA9IHRoaXNBcmcgfHwgd2luZG93O1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB0aGlzW2ldLCBpLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoIU9iamVjdC5oYXNPd25Qcm9wZXJ0eSgnZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycycpKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoXG4gICAgICAgIE9iamVjdCxcbiAgICAgICAgJ2dldE93blByb3BlcnR5RGVzY3JpcHRvcnMnLFxuICAgICAgICB7XG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKG9iamVjdCkge1xuICAgICAgICAgICAgcmV0dXJuIFJlZmxlY3Qub3duS2V5cyhvYmplY3QpLnJlZHVjZSgoZGVzY3JpcHRvcnMsIGtleSkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0b3JzLFxuICAgICAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICB2YWx1ZTogT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmplY3QsIGtleSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9LCB7fSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cbn0pKCk7XG4iLCIvLyBkMy50aXBcbi8vIENvcHlyaWdodCAoYykgMjAxMyBKdXN0aW4gUGFsbWVyXG4vLyBFUzYgLyBEMyB2NCBBZGFwdGlvbiBDb3B5cmlnaHQgKGMpIDIwMTYgQ29uc3RhbnRpbiBHYXZyaWxldGVcbi8vIFJlbW92YWwgb2YgRVM2IGZvciBEMyB2NCBBZGFwdGlvbiBDb3B5cmlnaHQgKGMpIDIwMTYgRGF2aWQgR290elxuLy9cbi8vIFRvb2x0aXBzIGZvciBkMy5qcyBTVkcgdmlzdWFsaXphdGlvbnNcblxuZXhwb3J0IGNvbnN0IGQzVGlwID0gKGZ1bmN0aW9uKCl7XG4gIGQzLmZ1bmN0b3IgPSBmdW5jdGlvbiBmdW5jdG9yKHYpIHtcbiAgICByZXR1cm4gdHlwZW9mIHYgPT09IFwiZnVuY3Rpb25cIiA/IHYgOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB2O1xuICAgIH07XG4gIH07XG5cbiAgZDMudGlwID0gZnVuY3Rpb24oKSB7XG5cbiAgICB2YXIgZGlyZWN0aW9uID0gZDNfdGlwX2RpcmVjdGlvbixcbiAgICAgICAgb2Zmc2V0ICAgID0gZDNfdGlwX29mZnNldCxcbiAgICAgICAgaHRtbCAgICAgID0gZDNfdGlwX2h0bWwsXG4gICAgICAgIG5vZGUgICAgICA9IGluaXROb2RlKCksXG4gICAgICAgIHN2ZyAgICAgICA9IG51bGwsXG4gICAgICAgIHBvaW50ICAgICA9IG51bGwsXG4gICAgICAgIHRhcmdldCAgICA9IG51bGxcblxuICAgIGZ1bmN0aW9uIHRpcCh2aXMpIHtcbiAgICAgIHN2ZyA9IGdldFNWR05vZGUodmlzKVxuICAgICAgaWYgKCFzdmcpeyAvLyBIVCBodHRwczovL2dpdGh1Yi5jb20vQ2FnZWQvZDMtdGlwL3B1bGwvOTYvZmlsZXNcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcG9pbnQgPSBzdmcuY3JlYXRlU1ZHUG9pbnQoKVxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKVxuICAgIH1cblxuICAgIC8vIFB1YmxpYyAtIHNob3cgdGhlIHRvb2x0aXAgb24gdGhlIHNjcmVlblxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5zaG93ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgIGlmKGFyZ3NbYXJncy5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIFNWR0VsZW1lbnQpIHRhcmdldCA9IGFyZ3MucG9wKClcblxuICAgICAgdmFyIGNvbnRlbnQgPSBodG1sLmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIHBvZmZzZXQgPSBvZmZzZXQuYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgZGlyICAgICA9IGRpcmVjdGlvbi5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBub2RlbCAgID0gZ2V0Tm9kZUVsKCksXG4gICAgICAgICAgaSAgICAgICA9IGRpcmVjdGlvbnMubGVuZ3RoLFxuICAgICAgICAgIGNvb3JkcyxcbiAgICAgICAgICBzY3JvbGxUb3AgID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcCB8fCBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCxcbiAgICAgICAgICBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQgfHwgZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0XG5cbiAgICAgIG5vZGVsLmh0bWwoY29udGVudClcbiAgICAgICAgLnN0eWxlKCdwb3NpdGlvbicsICdhYnNvbHV0ZScpXG4gICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDEpXG4gICAgICAgIC5zdHlsZSgncG9pbnRlci1ldmVudHMnLCAnYWxsJylcblxuICAgICAgd2hpbGUoaS0tKSBub2RlbC5jbGFzc2VkKGRpcmVjdGlvbnNbaV0sIGZhbHNlKVxuICAgICAgY29vcmRzID0gZGlyZWN0aW9uX2NhbGxiYWNrc1tkaXJdLmFwcGx5KHRoaXMpXG4gICAgICBub2RlbC5jbGFzc2VkKGRpciwgdHJ1ZSlcbiAgICAgICAgLnN0eWxlKCd0b3AnLCAoY29vcmRzLnRvcCArICBwb2Zmc2V0WzBdKSArIHNjcm9sbFRvcCArICdweCcpXG4gICAgICAgIC5zdHlsZSgnbGVmdCcsIChjb29yZHMubGVmdCArIHBvZmZzZXRbMV0pICsgc2Nyb2xsTGVmdCArICdweCcpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWMgLSBoaWRlIHRoZSB0b29sdGlwXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGEgdGlwXG4gICAgdGlwLmhpZGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBub2RlbCA9IGdldE5vZGVFbCgpXG4gICAgICBub2RlbFxuICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAwKVxuICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKVxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogUHJveHkgYXR0ciBjYWxscyB0byB0aGUgZDMgdGlwIGNvbnRhaW5lci4gIFNldHMgb3IgZ2V0cyBhdHRyaWJ1dGUgdmFsdWUuXG4gICAgLy9cbiAgICAvLyBuIC0gbmFtZSBvZiB0aGUgYXR0cmlidXRlXG4gICAgLy8gdiAtIHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIGF0dHJpYnV0ZSB2YWx1ZVxuICAgIHRpcC5hdHRyID0gZnVuY3Rpb24obiwgdikge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyICYmIHR5cGVvZiBuID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZ2V0Tm9kZUVsKCkuYXR0cihuKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGFyZ3MgPSAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxuICAgICAgICBkMy5zZWxlY3Rpb24ucHJvdG90eXBlLmF0dHIuYXBwbHkoZ2V0Tm9kZUVsKCksIGFyZ3MpXG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFByb3h5IHN0eWxlIGNhbGxzIHRvIHRoZSBkMyB0aXAgY29udGFpbmVyLiAgU2V0cyBvciBnZXRzIGEgc3R5bGUgdmFsdWUuXG4gICAgLy9cbiAgICAvLyBuIC0gbmFtZSBvZiB0aGUgcHJvcGVydHlcbiAgICAvLyB2IC0gdmFsdWUgb2YgdGhlIHByb3BlcnR5XG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIHRpcCBvciBzdHlsZSBwcm9wZXJ0eSB2YWx1ZVxuICAgIHRpcC5zdHlsZSA9IGZ1bmN0aW9uKG4sIHYpIHtcbiAgICAgIC8vIGRlYnVnZ2VyO1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyICYmIHR5cGVvZiBuID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZ2V0Tm9kZUVsKCkuc3R5bGUobilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgdmFyIHN0eWxlcyA9IGFyZ3NbMF07XG4gICAgICAgICAgT2JqZWN0LmtleXMoc3R5bGVzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUuc3R5bGUuYXBwbHkoZ2V0Tm9kZUVsKCksIFtrZXksIHN0eWxlc1trZXldXSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogU2V0IG9yIGdldCB0aGUgZGlyZWN0aW9uIG9mIHRoZSB0b29sdGlwXG4gICAgLy9cbiAgICAvLyB2IC0gT25lIG9mIG4obm9ydGgpLCBzKHNvdXRoKSwgZShlYXN0KSwgb3Igdyh3ZXN0KSwgbncobm9ydGh3ZXN0KSxcbiAgICAvLyAgICAgc3coc291dGh3ZXN0KSwgbmUobm9ydGhlYXN0KSBvciBzZShzb3V0aGVhc3QpXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIHRpcCBvciBkaXJlY3Rpb25cbiAgICB0aXAuZGlyZWN0aW9uID0gZnVuY3Rpb24odikge1xuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gZGlyZWN0aW9uXG4gICAgICBkaXJlY3Rpb24gPSB2ID09IG51bGwgPyB2IDogZDMuZnVuY3Rvcih2KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBTZXRzIG9yIGdldHMgdGhlIG9mZnNldCBvZiB0aGUgdGlwXG4gICAgLy9cbiAgICAvLyB2IC0gQXJyYXkgb2YgW3gsIHldIG9mZnNldFxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBvZmZzZXQgb3JcbiAgICB0aXAub2Zmc2V0ID0gZnVuY3Rpb24odikge1xuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gb2Zmc2V0XG4gICAgICBvZmZzZXQgPSB2ID09IG51bGwgPyB2IDogZDMuZnVuY3Rvcih2KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBzZXRzIG9yIGdldHMgdGhlIGh0bWwgdmFsdWUgb2YgdGhlIHRvb2x0aXBcbiAgICAvL1xuICAgIC8vIHYgLSBTdHJpbmcgdmFsdWUgb2YgdGhlIHRpcFxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBodG1sIHZhbHVlIG9yIHRpcFxuICAgIHRpcC5odG1sID0gZnVuY3Rpb24odikge1xuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gaHRtbFxuICAgICAgaHRtbCA9IHYgPT0gbnVsbCA/IHYgOiBkMy5mdW5jdG9yKHYpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IGRlc3Ryb3lzIHRoZSB0b29sdGlwIGFuZCByZW1vdmVzIGl0IGZyb20gdGhlIERPTVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZihub2RlKSB7XG4gICAgICAgIGdldE5vZGVFbCgpLnJlbW92ZSgpO1xuICAgICAgICBub2RlID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aXA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZDNfdGlwX2RpcmVjdGlvbigpIHsgcmV0dXJuICduJyB9XG4gICAgZnVuY3Rpb24gZDNfdGlwX29mZnNldCgpIHsgcmV0dXJuIFswLCAwXSB9XG4gICAgZnVuY3Rpb24gZDNfdGlwX2h0bWwoKSB7IHJldHVybiAnICcgfVxuXG4gICAgdmFyIGRpcmVjdGlvbl9jYWxsYmFja3MgPSB7XG4gICAgICBuOiAgZGlyZWN0aW9uX24sXG4gICAgICBzOiAgZGlyZWN0aW9uX3MsXG4gICAgICBlOiAgZGlyZWN0aW9uX2UsXG4gICAgICB3OiAgZGlyZWN0aW9uX3csXG4gICAgICBudzogZGlyZWN0aW9uX253LFxuICAgICAgbmU6IGRpcmVjdGlvbl9uZSxcbiAgICAgIHN3OiBkaXJlY3Rpb25fc3csXG4gICAgICBzZTogZGlyZWN0aW9uX3NlXG4gICAgfTtcblxuICAgIHZhciBkaXJlY3Rpb25zID0gT2JqZWN0LmtleXMoZGlyZWN0aW9uX2NhbGxiYWNrcyk7XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fbigpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm4ueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm4ueCAtIG5vZGUub2Zmc2V0V2lkdGggLyAyXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3MoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zLnksXG4gICAgICAgIGxlZnQ6IGJib3gucy54IC0gbm9kZS5vZmZzZXRXaWR0aCAvIDJcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LmUueSAtIG5vZGUub2Zmc2V0SGVpZ2h0IC8gMixcbiAgICAgICAgbGVmdDogYmJveC5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fdygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LncueSAtIG5vZGUub2Zmc2V0SGVpZ2h0IC8gMixcbiAgICAgICAgbGVmdDogYmJveC53LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX253KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubncueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm53LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX25lKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubmUueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fc3coKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zdy55LFxuICAgICAgICBsZWZ0OiBiYm94LnN3LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3NlKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guc2UueSxcbiAgICAgICAgbGVmdDogYmJveC5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0Tm9kZSgpIHtcbiAgICAgIHZhciBub2RlID0gZDMuc2VsZWN0KGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKVxuICAgICAgbm9kZVxuICAgICAgICAuc3R5bGUoJ3Bvc2l0aW9uJywgJ2Fic29sdXRlJylcbiAgICAgICAgLnN0eWxlKCd0b3AnLCAwKVxuICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAwKVxuICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKVxuICAgICAgICAuc3R5bGUoJ2JveC1zaXppbmcnLCAnYm9yZGVyLWJveCcpXG5cbiAgICAgIHJldHVybiBub2RlLm5vZGUoKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNWR05vZGUoZWwpIHtcbiAgICAgIGNvbnNvbGUubG9nKGVsKTtcbiAgICAgIGVsID0gZWwubm9kZSgpXG4gICAgICBpZiAoIWVsKSB7IC8vIEhUIGh0dHBzOi8vZ2l0aHViLmNvbS9DYWdlZC9kMy10aXAvcHVsbC85Ni9maWxlc1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZihlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdzdmcnKVxuICAgICAgICByZXR1cm4gZWxcblxuICAgICAgcmV0dXJuIGVsLm93bmVyU1ZHRWxlbWVudFxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldE5vZGVFbCgpIHtcbiAgICAgIGlmKG5vZGUgPT09IG51bGwpIHtcbiAgICAgICAgbm9kZSA9IGluaXROb2RlKCk7XG4gICAgICAgIC8vIHJlLWFkZCBub2RlIHRvIERPTVxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG5vZGUpO1xuICAgICAgfTtcbiAgICAgIHJldHVybiBkMy5zZWxlY3Qobm9kZSk7XG4gICAgfVxuXG4gICAgLy8gUHJpdmF0ZSAtIGdldHMgdGhlIHNjcmVlbiBjb29yZGluYXRlcyBvZiBhIHNoYXBlXG4gICAgLy9cbiAgICAvLyBHaXZlbiBhIHNoYXBlIG9uIHRoZSBzY3JlZW4sIHdpbGwgcmV0dXJuIGFuIFNWR1BvaW50IGZvciB0aGUgZGlyZWN0aW9uc1xuICAgIC8vIG4obm9ydGgpLCBzKHNvdXRoKSwgZShlYXN0KSwgdyh3ZXN0KSwgbmUobm9ydGhlYXN0KSwgc2Uoc291dGhlYXN0KSwgbncobm9ydGh3ZXN0KSxcbiAgICAvLyBzdyhzb3V0aHdlc3QpLlxuICAgIC8vXG4gICAgLy8gICAgKy0rLStcbiAgICAvLyAgICB8ICAgfFxuICAgIC8vICAgICsgICArXG4gICAgLy8gICAgfCAgIHxcbiAgICAvLyAgICArLSstK1xuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhbiBPYmplY3Qge24sIHMsIGUsIHcsIG53LCBzdywgbmUsIHNlfVxuICAgIGZ1bmN0aW9uIGdldFNjcmVlbkJCb3goKSB7XG4gICAgICB2YXIgdGFyZ2V0ZWwgICA9IHRhcmdldCB8fCBkMy5ldmVudC50YXJnZXQ7XG5cbiAgICAgIHdoaWxlICgndW5kZWZpbmVkJyA9PT0gdHlwZW9mIHRhcmdldGVsLmdldFNjcmVlbkNUTSAmJiAndW5kZWZpbmVkJyA9PT0gdGFyZ2V0ZWwucGFyZW50Tm9kZSkge1xuICAgICAgICAgIHRhcmdldGVsID0gdGFyZ2V0ZWwucGFyZW50Tm9kZTtcbiAgICAgIH1cblxuICAgICAgdmFyIGJib3ggICAgICAgPSB7fSxcbiAgICAgICAgICBtYXRyaXggICAgID0gdGFyZ2V0ZWwuZ2V0U2NyZWVuQ1RNKCksXG4gICAgICAgICAgdGJib3ggICAgICA9IHRhcmdldGVsLmdldEJCb3goKSxcbiAgICAgICAgICB3aWR0aCAgICAgID0gdGJib3gud2lkdGgsXG4gICAgICAgICAgaGVpZ2h0ICAgICA9IHRiYm94LmhlaWdodCxcbiAgICAgICAgICB4ICAgICAgICAgID0gdGJib3gueCxcbiAgICAgICAgICB5ICAgICAgICAgID0gdGJib3gueVxuXG4gICAgICBwb2ludC54ID0geFxuICAgICAgcG9pbnQueSA9IHlcbiAgICAgIGJib3gubncgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCArPSB3aWR0aFxuICAgICAgYmJveC5uZSA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55ICs9IGhlaWdodFxuICAgICAgYmJveC5zZSA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54IC09IHdpZHRoXG4gICAgICBiYm94LnN3ID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnkgLT0gaGVpZ2h0IC8gMlxuICAgICAgYmJveC53ICA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54ICs9IHdpZHRoXG4gICAgICBiYm94LmUgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCAtPSB3aWR0aCAvIDJcbiAgICAgIHBvaW50LnkgLT0gaGVpZ2h0IC8gMlxuICAgICAgYmJveC5uID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnkgKz0gaGVpZ2h0XG4gICAgICBiYm94LnMgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuXG4gICAgICByZXR1cm4gYmJveFxuICAgIH1cblxuICAgIHJldHVybiB0aXBcbiAgfTtcbn0pKCk7IiwiLyoqXG4gKiBTVkcgZm9jdXMgXG4gKiBDb3B5cmlnaHQoYykgMjAxNywgSm9obiBPc3Rlcm1hblxuICpcbiAqIE1JVCBMaWNlbnNlXG4gKlxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBcbiAqIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyBcbiAqIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBcbiAqIGZvbGxvd2luZyBjb25kaXRpb25zOlxuXG4gKiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIFxuICogTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIFxuICogRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIFxuICogSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgXG4gKiBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuICovXG5cbiAvLyBJRS9FZGdlIChwZXJoYXBzIG90aGVycykgZG9lcyBub3QgYWxsb3cgcHJvZ3JhbW1hdGljIGZvY3VzaW5nIG9mIFNWRyBFbGVtZW50cyAodmlhIGBmb2N1cygpYCkuIFNhbWUgZm9yIGBibHVyKClgLlxuXG4gZXhwb3J0IGNvbnN0IFNWR0ZvY3VzID0gKGZ1bmN0aW9uKCl7XG4gICAgaWYgKCAnZm9jdXMnIGluIFNWR0VsZW1lbnQucHJvdG90eXBlID09PSBmYWxzZSApIHtcbiAgICAgIFNWR0VsZW1lbnQucHJvdG90eXBlLmZvY3VzID0gSFRNTEVsZW1lbnQucHJvdG90eXBlLmZvY3VzO1xuICAgIH1cbiAgICBpZiAoICdibHVyJyBpbiBTVkdFbGVtZW50LnByb3RvdHlwZSA9PT0gZmFsc2UgKSB7XG4gICAgICBTVkdFbGVtZW50LnByb3RvdHlwZS5ibHVyID0gSFRNTEVsZW1lbnQucHJvdG90eXBlLmJsdXI7XG4gICAgfVxuIH0pKCk7XG5cblxuXG5cbi8qKlxuICogaW5uZXJIVE1MIHByb3BlcnR5IGZvciBTVkdFbGVtZW50XG4gKiBDb3B5cmlnaHQoYykgMjAxMCwgSmVmZiBTY2hpbGxlclxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyXG4gKlxuICogV29ya3MgaW4gYSBTVkcgZG9jdW1lbnQgaW4gQ2hyb21lIDYrLCBTYWZhcmkgNSssIEZpcmVmb3ggNCsgYW5kIElFOSsuXG4gKiBXb3JrcyBpbiBhIEhUTUw1IGRvY3VtZW50IGluIENocm9tZSA3KywgRmlyZWZveCA0KyBhbmQgSUU5Ky5cbiAqIERvZXMgbm90IHdvcmsgaW4gT3BlcmEgc2luY2UgaXQgZG9lc24ndCBzdXBwb3J0IHRoZSBTVkdFbGVtZW50IGludGVyZmFjZSB5ZXQuXG4gKlxuICogSSBoYXZlbid0IGRlY2lkZWQgb24gdGhlIGJlc3QgbmFtZSBmb3IgdGhpcyBwcm9wZXJ0eSAtIHRodXMgdGhlIGR1cGxpY2F0aW9uLlxuICovXG4vLyBlZGl0ZWQgYnkgSm9obiBPc3Rlcm1hbiB0byBkZWNsYXJlIHRoZSB2YXJpYWJsZSBgc1hNTGAsIHdoaWNoIHdhcyByZWZlcmVuY2VkIHdpdGhvdXQgYmVpbmcgZGVjbGFyZWRcbi8vIHdoaWNoIGZhaWxlZCBzaWxlbnRseSBpbiBpbXBsaWNpdCBzdHJpY3QgbW9kZSBvZiBhbiBleHBvcnRcblxuLy8gbW9zdCBicm93c2VycyBhbGxvdyBzZXR0aW5nIGlubmVySFRNTCBvZiBzdmcgZWxlbWVudHMgYnV0IElFIGRvZXMgbm90IChub3QgYW4gSFRNTCBlbGVtZW50KVxuLy8gdGhpcyBwb2x5ZmlsbCBwcm92aWRlcyB0aGF0LiBuZWNlc3NhcnkgZm9yIGQzIG1ldGhvZCBgLmh0bWwoKWAgb24gc3ZnIGVsZW1lbnRzXG5cbmV4cG9ydCBjb25zdCBTVkdJbm5lckhUTUwgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBzZXJpYWxpemVYTUwgPSBmdW5jdGlvbihub2RlLCBvdXRwdXQpIHtcbiAgICB2YXIgbm9kZVR5cGUgPSBub2RlLm5vZGVUeXBlO1xuICAgIGlmIChub2RlVHlwZSA9PSAzKSB7IC8vIFRFWFQgbm9kZXMuXG4gICAgICAvLyBSZXBsYWNlIHNwZWNpYWwgWE1MIGNoYXJhY3RlcnMgd2l0aCB0aGVpciBlbnRpdGllcy5cbiAgICAgIG91dHB1dC5wdXNoKG5vZGUudGV4dENvbnRlbnQucmVwbGFjZSgvJi8sICcmYW1wOycpLnJlcGxhY2UoLzwvLCAnJmx0OycpLnJlcGxhY2UoJz4nLCAnJmd0OycpKTtcbiAgICB9IGVsc2UgaWYgKG5vZGVUeXBlID09IDEpIHsgLy8gRUxFTUVOVCBub2Rlcy5cbiAgICAgIC8vIFNlcmlhbGl6ZSBFbGVtZW50IG5vZGVzLlxuICAgICAgb3V0cHV0LnB1c2goJzwnLCBub2RlLnRhZ05hbWUpO1xuICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlcygpKSB7XG4gICAgICAgIHZhciBhdHRyTWFwID0gbm9kZS5hdHRyaWJ1dGVzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXR0ck1hcC5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgIHZhciBhdHRyTm9kZSA9IGF0dHJNYXAuaXRlbShpKTtcbiAgICAgICAgICBvdXRwdXQucHVzaCgnICcsIGF0dHJOb2RlLm5hbWUsICc9XFwnJywgYXR0ck5vZGUudmFsdWUsICdcXCcnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKG5vZGUuaGFzQ2hpbGROb2RlcygpKSB7XG4gICAgICAgIG91dHB1dC5wdXNoKCc+Jyk7XG4gICAgICAgIHZhciBjaGlsZE5vZGVzID0gbm9kZS5jaGlsZE5vZGVzO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gY2hpbGROb2Rlcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgIHNlcmlhbGl6ZVhNTChjaGlsZE5vZGVzLml0ZW0oaSksIG91dHB1dCk7XG4gICAgICAgIH1cbiAgICAgICAgb3V0cHV0LnB1c2goJzwvJywgbm9kZS50YWdOYW1lLCAnPicpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0LnB1c2goJy8+Jyk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChub2RlVHlwZSA9PSA4KSB7XG4gICAgICAvLyBUT0RPKGNvZGVkcmVhZCk6IFJlcGxhY2Ugc3BlY2lhbCBjaGFyYWN0ZXJzIHdpdGggWE1MIGVudGl0aWVzP1xuICAgICAgb3V0cHV0LnB1c2goJzwhLS0nLCBub2RlLm5vZGVWYWx1ZSwgJy0tPicpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUT0RPOiBIYW5kbGUgQ0RBVEEgbm9kZXMuXG4gICAgICAvLyBUT0RPOiBIYW5kbGUgRU5USVRZIG5vZGVzLlxuICAgICAgLy8gVE9ETzogSGFuZGxlIERPQ1VNRU5UIG5vZGVzLlxuICAgICAgdGhyb3cgJ0Vycm9yIHNlcmlhbGl6aW5nIFhNTC4gVW5oYW5kbGVkIG5vZGUgb2YgdHlwZTogJyArIG5vZGVUeXBlO1xuICAgIH1cbiAgfVxuICAvLyBUaGUgaW5uZXJIVE1MIERPTSBwcm9wZXJ0eSBmb3IgU1ZHRWxlbWVudC5cbiAgaWYgKCAnaW5uZXJIVE1MJyBpbiBTVkdFbGVtZW50LnByb3RvdHlwZSA9PT0gZmFsc2UgKXtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU1ZHRWxlbWVudC5wcm90b3R5cGUsICdpbm5lckhUTUwnLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgb3V0cHV0ID0gW107XG4gICAgICAgIHZhciBjaGlsZE5vZGUgPSB0aGlzLmZpcnN0Q2hpbGQ7XG4gICAgICAgIHdoaWxlIChjaGlsZE5vZGUpIHtcbiAgICAgICAgICBzZXJpYWxpemVYTUwoY2hpbGROb2RlLCBvdXRwdXQpO1xuICAgICAgICAgIGNoaWxkTm9kZSA9IGNoaWxkTm9kZS5uZXh0U2libGluZztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0cHV0LmpvaW4oJycpO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24obWFya3VwVGV4dCkge1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzKTtcbiAgICAgICAgLy8gV2lwZSBvdXQgdGhlIGN1cnJlbnQgY29udGVudHMgb2YgdGhlIGVsZW1lbnQuXG4gICAgICAgIHdoaWxlICh0aGlzLmZpcnN0Q2hpbGQpIHtcbiAgICAgICAgICB0aGlzLnJlbW92ZUNoaWxkKHRoaXMuZmlyc3RDaGlsZCk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIFBhcnNlIHRoZSBtYXJrdXAgaW50byB2YWxpZCBub2Rlcy5cbiAgICAgICAgICB2YXIgZFhNTCA9IG5ldyBET01QYXJzZXIoKTtcbiAgICAgICAgICBkWE1MLmFzeW5jID0gZmFsc2U7XG4gICAgICAgICAgLy8gV3JhcCB0aGUgbWFya3VwIGludG8gYSBTVkcgbm9kZSB0byBlbnN1cmUgcGFyc2luZyB3b3Jrcy5cbiAgICAgICAgICBjb25zb2xlLmxvZyhtYXJrdXBUZXh0KTtcbiAgICAgICAgICB2YXIgc1hNTCA9ICc8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj4nICsgbWFya3VwVGV4dCArICc8L3N2Zz4nO1xuICAgICAgICAgIGNvbnNvbGUubG9nKHNYTUwpO1xuICAgICAgICAgIHZhciBzdmdEb2NFbGVtZW50ID0gZFhNTC5wYXJzZUZyb21TdHJpbmcoc1hNTCwgJ3RleHQveG1sJykuZG9jdW1lbnRFbGVtZW50O1xuXG4gICAgICAgICAgLy8gTm93IHRha2UgZWFjaCBub2RlLCBpbXBvcnQgaXQgYW5kIGFwcGVuZCB0byB0aGlzIGVsZW1lbnQuXG4gICAgICAgICAgdmFyIGNoaWxkTm9kZSA9IHN2Z0RvY0VsZW1lbnQuZmlyc3RDaGlsZDtcbiAgICAgICAgICB3aGlsZShjaGlsZE5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuYXBwZW5kQ2hpbGQodGhpcy5vd25lckRvY3VtZW50LmltcG9ydE5vZGUoY2hpbGROb2RlLCB0cnVlKSk7XG4gICAgICAgICAgICBjaGlsZE5vZGUgPSBjaGlsZE5vZGUubmV4dFNpYmxpbmc7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Vycm9yIHBhcnNpbmcgWE1MIHN0cmluZycpO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gVGhlIGlubmVyU1ZHIERPTSBwcm9wZXJ0eSBmb3IgU1ZHRWxlbWVudC5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU1ZHRWxlbWVudC5wcm90b3R5cGUsICdpbm5lclNWRycsIHtcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlubmVySFRNTDtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKG1hcmt1cFRleHQpIHtcbiAgICAgICAgdGhpcy5pbm5lckhUTUwgPSBtYXJrdXBUZXh0O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KSgpO1xuXG5cbi8vIGh0dHBzOi8vdGMzOS5naXRodWIuaW8vZWNtYTI2Mi8jc2VjLWFycmF5LnByb3RvdHlwZS5maW5kXG5leHBvcnQgY29uc3QgYXJyYXlGaW5kID0gKGZ1bmN0aW9uKCl7XG4gIGlmICghQXJyYXkucHJvdG90eXBlLmZpbmQpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQXJyYXkucHJvdG90eXBlLCAnZmluZCcsIHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbihwcmVkaWNhdGUpIHtcbiAgICAgICAvLyAxLiBMZXQgTyBiZSA/IFRvT2JqZWN0KHRoaXMgdmFsdWUpLlxuICAgICAgICBpZiAodGhpcyA9PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJ0aGlzXCIgaXMgbnVsbCBvciBub3QgZGVmaW5lZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG8gPSBPYmplY3QodGhpcyk7XG5cbiAgICAgICAgLy8gMi4gTGV0IGxlbiBiZSA/IFRvTGVuZ3RoKD8gR2V0KE8sIFwibGVuZ3RoXCIpKS5cbiAgICAgICAgdmFyIGxlbiA9IG8ubGVuZ3RoID4+PiAwO1xuXG4gICAgICAgIC8vIDMuIElmIElzQ2FsbGFibGUocHJlZGljYXRlKSBpcyBmYWxzZSwgdGhyb3cgYSBUeXBlRXJyb3IgZXhjZXB0aW9uLlxuICAgICAgICBpZiAodHlwZW9mIHByZWRpY2F0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ByZWRpY2F0ZSBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIDQuIElmIHRoaXNBcmcgd2FzIHN1cHBsaWVkLCBsZXQgVCBiZSB0aGlzQXJnOyBlbHNlIGxldCBUIGJlIHVuZGVmaW5lZC5cbiAgICAgICAgdmFyIHRoaXNBcmcgPSBhcmd1bWVudHNbMV07XG5cbiAgICAgICAgLy8gNS4gTGV0IGsgYmUgMC5cbiAgICAgICAgdmFyIGsgPSAwO1xuXG4gICAgICAgIC8vIDYuIFJlcGVhdCwgd2hpbGUgayA8IGxlblxuICAgICAgICB3aGlsZSAoayA8IGxlbikge1xuICAgICAgICAgIC8vIGEuIExldCBQayBiZSAhIFRvU3RyaW5nKGspLlxuICAgICAgICAgIC8vIGIuIExldCBrVmFsdWUgYmUgPyBHZXQoTywgUGspLlxuICAgICAgICAgIC8vIGMuIExldCB0ZXN0UmVzdWx0IGJlIFRvQm9vbGVhbig/IENhbGwocHJlZGljYXRlLCBULCDCqyBrVmFsdWUsIGssIE8gwrspKS5cbiAgICAgICAgICAvLyBkLiBJZiB0ZXN0UmVzdWx0IGlzIHRydWUsIHJldHVybiBrVmFsdWUuXG4gICAgICAgICAgdmFyIGtWYWx1ZSA9IG9ba107XG4gICAgICAgICAgaWYgKHByZWRpY2F0ZS5jYWxsKHRoaXNBcmcsIGtWYWx1ZSwgaywgbykpIHtcbiAgICAgICAgICAgIHJldHVybiBrVmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGUuIEluY3JlYXNlIGsgYnkgMS5cbiAgICAgICAgICBrKys7XG4gICAgICAgIH1cblxuICAgICAgICAvLyA3LiBSZXR1cm4gdW5kZWZpbmVkLlxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KSgpOyBcblxuLy8gQ29weXJpZ2h0IChDKSAyMDExLTIwMTIgU29mdHdhcmUgTGFuZ3VhZ2VzIExhYiwgVnJpamUgVW5pdmVyc2l0ZWl0IEJydXNzZWxcbi8vIFRoaXMgY29kZSBpcyBkdWFsLWxpY2Vuc2VkIHVuZGVyIGJvdGggdGhlIEFwYWNoZSBMaWNlbnNlIGFuZCB0aGUgTVBMXG5cbi8vIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4vLyB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4vLyBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbi8vXG4vLyBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbi8vXG4vLyBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4vLyBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4vLyBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbi8vIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbi8vIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuXG4vKiBWZXJzaW9uOiBNUEwgMS4xXG4gKlxuICogVGhlIGNvbnRlbnRzIG9mIHRoaXMgZmlsZSBhcmUgc3ViamVjdCB0byB0aGUgTW96aWxsYSBQdWJsaWMgTGljZW5zZSBWZXJzaW9uXG4gKiAxLjEgKHRoZSBcIkxpY2Vuc2VcIik7IHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aFxuICogdGhlIExpY2Vuc2UuIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICogaHR0cDovL3d3dy5tb3ppbGxhLm9yZy9NUEwvXG4gKlxuICogU29mdHdhcmUgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIGJhc2lzLFxuICogV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC4gU2VlIHRoZSBMaWNlbnNlXG4gKiBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyByaWdodHMgYW5kIGxpbWl0YXRpb25zIHVuZGVyIHRoZVxuICogTGljZW5zZS5cbiAqXG4gKiBUaGUgT3JpZ2luYWwgQ29kZSBpcyBhIHNoaW0gZm9yIHRoZSBFUy1IYXJtb255IHJlZmxlY3Rpb24gbW9kdWxlXG4gKlxuICogVGhlIEluaXRpYWwgRGV2ZWxvcGVyIG9mIHRoZSBPcmlnaW5hbCBDb2RlIGlzXG4gKiBUb20gVmFuIEN1dHNlbSwgVnJpamUgVW5pdmVyc2l0ZWl0IEJydXNzZWwuXG4gKiBQb3J0aW9ucyBjcmVhdGVkIGJ5IHRoZSBJbml0aWFsIERldmVsb3BlciBhcmUgQ29weXJpZ2h0IChDKSAyMDExLTIwMTJcbiAqIHRoZSBJbml0aWFsIERldmVsb3Blci4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBDb250cmlidXRvcihzKTpcbiAqXG4gKi9cblxuIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuIC8vIFRoaXMgZmlsZSBpcyBhIHBvbHlmaWxsIGZvciB0aGUgdXBjb21pbmcgRUNNQVNjcmlwdCBSZWZsZWN0IEFQSSxcbiAvLyBpbmNsdWRpbmcgc3VwcG9ydCBmb3IgUHJveGllcy4gU2VlIHRoZSBkcmFmdCBzcGVjaWZpY2F0aW9uIGF0OlxuIC8vIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6cmVmbGVjdF9hcGlcbiAvLyBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OmRpcmVjdF9wcm94aWVzXG5cbiAvLyBGb3IgYW4gaW1wbGVtZW50YXRpb24gb2YgdGhlIEhhbmRsZXIgQVBJLCBzZWUgaGFuZGxlcnMuanMsIHdoaWNoIGltcGxlbWVudHM6XG4gLy8gaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTp2aXJ0dWFsX29iamVjdF9hcGlcblxuIC8vIFRoaXMgaW1wbGVtZW50YXRpb24gc3VwZXJzZWRlcyB0aGUgZWFybGllciBwb2x5ZmlsbCBhdDpcbiAvLyBjb2RlLmdvb2dsZS5jb20vcC9lcy1sYWIvc291cmNlL2Jyb3dzZS90cnVuay9zcmMvcHJveGllcy9EaXJlY3RQcm94aWVzLmpzXG5cbiAvLyBUaGlzIGNvZGUgd2FzIHRlc3RlZCBvbiB0cmFjZW1vbmtleSAvIEZpcmVmb3ggMTJcbi8vICAoYW5kIHNob3VsZCBydW4gZmluZSBvbiBvbGRlciBGaXJlZm94IHZlcnNpb25zIHN0YXJ0aW5nIHdpdGggRkY0KVxuIC8vIFRoZSBjb2RlIGFsc28gd29ya3MgY29ycmVjdGx5IG9uXG4gLy8gICB2OCAtLWhhcm1vbnlfcHJveGllcyAtLWhhcm1vbnlfd2Vha21hcHMgKHYzLjYuNS4xKVxuXG4gLy8gTGFuZ3VhZ2UgRGVwZW5kZW5jaWVzOlxuIC8vICAtIEVDTUFTY3JpcHQgNS9zdHJpY3RcbiAvLyAgLSBcIm9sZFwiIChpLmUuIG5vbi1kaXJlY3QpIEhhcm1vbnkgUHJveGllc1xuIC8vICAtIEhhcm1vbnkgV2Vha01hcHNcbiAvLyBQYXRjaGVzOlxuIC8vICAtIE9iamVjdC57ZnJlZXplLHNlYWwscHJldmVudEV4dGVuc2lvbnN9XG4gLy8gIC0gT2JqZWN0Lntpc0Zyb3plbixpc1NlYWxlZCxpc0V4dGVuc2libGV9XG4gLy8gIC0gT2JqZWN0LmdldFByb3RvdHlwZU9mXG4gLy8gIC0gT2JqZWN0LmtleXNcbiAvLyAgLSBPYmplY3QucHJvdG90eXBlLnZhbHVlT2ZcbiAvLyAgLSBPYmplY3QucHJvdG90eXBlLmlzUHJvdG90eXBlT2ZcbiAvLyAgLSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG4gLy8gIC0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eVxuIC8vICAtIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JcbiAvLyAgLSBPYmplY3QuZGVmaW5lUHJvcGVydHlcbiAvLyAgLSBPYmplY3QuZGVmaW5lUHJvcGVydGllc1xuIC8vICAtIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzXG4gLy8gIC0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9sc1xuIC8vICAtIE9iamVjdC5nZXRQcm90b3R5cGVPZlxuIC8vICAtIE9iamVjdC5zZXRQcm90b3R5cGVPZlxuIC8vICAtIE9iamVjdC5hc3NpZ25cbiAvLyAgLSBGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmdcbiAvLyAgLSBEYXRlLnByb3RvdHlwZS50b1N0cmluZ1xuIC8vICAtIEFycmF5LmlzQXJyYXlcbiAvLyAgLSBBcnJheS5wcm90b3R5cGUuY29uY2F0XG4gLy8gIC0gUHJveHlcbiAvLyBBZGRzIG5ldyBnbG9iYWxzOlxuIC8vICAtIFJlZmxlY3RcblxuIC8vIERpcmVjdCBwcm94aWVzIGNhbiBiZSBjcmVhdGVkIHZpYSBQcm94eSh0YXJnZXQsIGhhbmRsZXIpXG5cbiAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBjb25zdCByZWZsZWN0ID0gKGZ1bmN0aW9uKGdsb2JhbCl7IC8vIGZ1bmN0aW9uLWFzLW1vZHVsZSBwYXR0ZXJuXG5cInVzZSBzdHJpY3RcIjtcbiBcbi8vID09PSBEaXJlY3QgUHJveGllczogSW52YXJpYW50IEVuZm9yY2VtZW50ID09PVxuXG4vLyBEaXJlY3QgcHJveGllcyBidWlsZCBvbiBub24tZGlyZWN0IHByb3hpZXMgYnkgYXV0b21hdGljYWxseSB3cmFwcGluZ1xuLy8gYWxsIHVzZXItZGVmaW5lZCBwcm94eSBoYW5kbGVycyBpbiBhIFZhbGlkYXRvciBoYW5kbGVyIHRoYXQgY2hlY2tzIGFuZFxuLy8gZW5mb3JjZXMgRVM1IGludmFyaWFudHMuXG5cbi8vIEEgZGlyZWN0IHByb3h5IGlzIGEgcHJveHkgZm9yIGFuIGV4aXN0aW5nIG9iamVjdCBjYWxsZWQgdGhlIHRhcmdldCBvYmplY3QuXG5cbi8vIEEgVmFsaWRhdG9yIGhhbmRsZXIgaXMgYSB3cmFwcGVyIGZvciBhIHRhcmdldCBwcm94eSBoYW5kbGVyIEguXG4vLyBUaGUgVmFsaWRhdG9yIGZvcndhcmRzIGFsbCBvcGVyYXRpb25zIHRvIEgsIGJ1dCBhZGRpdGlvbmFsbHlcbi8vIHBlcmZvcm1zIGEgbnVtYmVyIG9mIGludGVncml0eSBjaGVja3Mgb24gdGhlIHJlc3VsdHMgb2Ygc29tZSB0cmFwcyxcbi8vIHRvIG1ha2Ugc3VyZSBIIGRvZXMgbm90IHZpb2xhdGUgdGhlIEVTNSBpbnZhcmlhbnRzIHcuci50LiBub24tY29uZmlndXJhYmxlXG4vLyBwcm9wZXJ0aWVzIGFuZCBub24tZXh0ZW5zaWJsZSwgc2VhbGVkIG9yIGZyb3plbiBvYmplY3RzLlxuXG4vLyBGb3IgZWFjaCBwcm9wZXJ0eSB0aGF0IEggZXhwb3NlcyBhcyBvd24sIG5vbi1jb25maWd1cmFibGVcbi8vIChlLmcuIGJ5IHJldHVybmluZyBhIGRlc2NyaXB0b3IgZnJvbSBhIGNhbGwgdG8gZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKVxuLy8gdGhlIFZhbGlkYXRvciBoYW5kbGVyIGRlZmluZXMgdGhvc2UgcHJvcGVydGllcyBvbiB0aGUgdGFyZ2V0IG9iamVjdC5cbi8vIFdoZW4gdGhlIHByb3h5IGJlY29tZXMgbm9uLWV4dGVuc2libGUsIGFsc28gY29uZmlndXJhYmxlIG93biBwcm9wZXJ0aWVzXG4vLyBhcmUgY2hlY2tlZCBhZ2FpbnN0IHRoZSB0YXJnZXQuXG4vLyBXZSB3aWxsIGNhbGwgcHJvcGVydGllcyB0aGF0IGFyZSBkZWZpbmVkIG9uIHRoZSB0YXJnZXQgb2JqZWN0XG4vLyBcImZpeGVkIHByb3BlcnRpZXNcIi5cblxuLy8gV2Ugd2lsbCBuYW1lIGZpeGVkIG5vbi1jb25maWd1cmFibGUgcHJvcGVydGllcyBcInNlYWxlZCBwcm9wZXJ0aWVzXCIuXG4vLyBXZSB3aWxsIG5hbWUgZml4ZWQgbm9uLWNvbmZpZ3VyYWJsZSBub24td3JpdGFibGUgcHJvcGVydGllcyBcImZyb3plblxuLy8gcHJvcGVydGllc1wiLlxuXG4vLyBUaGUgVmFsaWRhdG9yIGhhbmRsZXIgdXBob2xkcyB0aGUgZm9sbG93aW5nIGludmFyaWFudHMgdy5yLnQuIG5vbi1jb25maWd1cmFiaWxpdHk6XG4vLyAtIGdldE93blByb3BlcnR5RGVzY3JpcHRvciBjYW5ub3QgcmVwb3J0IHNlYWxlZCBwcm9wZXJ0aWVzIGFzIG5vbi1leGlzdGVudFxuLy8gLSBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgY2Fubm90IHJlcG9ydCBpbmNvbXBhdGlibGUgY2hhbmdlcyB0byB0aGVcbi8vICAgYXR0cmlidXRlcyBvZiBhIHNlYWxlZCBwcm9wZXJ0eSAoZS5nLiByZXBvcnRpbmcgYSBub24tY29uZmlndXJhYmxlXG4vLyAgIHByb3BlcnR5IGFzIGNvbmZpZ3VyYWJsZSwgb3IgcmVwb3J0aW5nIGEgbm9uLWNvbmZpZ3VyYWJsZSwgbm9uLXdyaXRhYmxlXG4vLyAgIHByb3BlcnR5IGFzIHdyaXRhYmxlKVxuLy8gLSBnZXRQcm9wZXJ0eURlc2NyaXB0b3IgY2Fubm90IHJlcG9ydCBzZWFsZWQgcHJvcGVydGllcyBhcyBub24tZXhpc3RlbnRcbi8vIC0gZ2V0UHJvcGVydHlEZXNjcmlwdG9yIGNhbm5vdCByZXBvcnQgaW5jb21wYXRpYmxlIGNoYW5nZXMgdG8gdGhlXG4vLyAgIGF0dHJpYnV0ZXMgb2YgYSBzZWFsZWQgcHJvcGVydHkuIEl0IF9jYW5fIHJlcG9ydCBpbmNvbXBhdGlibGUgY2hhbmdlc1xuLy8gICB0byB0aGUgYXR0cmlidXRlcyBvZiBub24tb3duLCBpbmhlcml0ZWQgcHJvcGVydGllcy5cbi8vIC0gZGVmaW5lUHJvcGVydHkgY2Fubm90IG1ha2UgaW5jb21wYXRpYmxlIGNoYW5nZXMgdG8gdGhlIGF0dHJpYnV0ZXMgb2Zcbi8vICAgc2VhbGVkIHByb3BlcnRpZXNcbi8vIC0gZGVsZXRlUHJvcGVydHkgY2Fubm90IHJlcG9ydCBhIHN1Y2Nlc3NmdWwgZGVsZXRpb24gb2YgYSBzZWFsZWQgcHJvcGVydHlcbi8vIC0gaGFzT3duIGNhbm5vdCByZXBvcnQgYSBzZWFsZWQgcHJvcGVydHkgYXMgbm9uLWV4aXN0ZW50XG4vLyAtIGhhcyBjYW5ub3QgcmVwb3J0IGEgc2VhbGVkIHByb3BlcnR5IGFzIG5vbi1leGlzdGVudFxuLy8gLSBnZXQgY2Fubm90IHJlcG9ydCBpbmNvbnNpc3RlbnQgdmFsdWVzIGZvciBmcm96ZW4gZGF0YVxuLy8gICBwcm9wZXJ0aWVzLCBhbmQgbXVzdCByZXBvcnQgdW5kZWZpbmVkIGZvciBzZWFsZWQgYWNjZXNzb3JzIHdpdGggYW5cbi8vICAgdW5kZWZpbmVkIGdldHRlclxuLy8gLSBzZXQgY2Fubm90IHJlcG9ydCBhIHN1Y2Nlc3NmdWwgYXNzaWdubWVudCBmb3IgZnJvemVuIGRhdGFcbi8vICAgcHJvcGVydGllcyBvciBzZWFsZWQgYWNjZXNzb3JzIHdpdGggYW4gdW5kZWZpbmVkIHNldHRlci5cbi8vIC0gZ2V0e093bn1Qcm9wZXJ0eU5hbWVzIGxpc3RzIGFsbCBzZWFsZWQgcHJvcGVydGllcyBvZiB0aGUgdGFyZ2V0LlxuLy8gLSBrZXlzIGxpc3RzIGFsbCBlbnVtZXJhYmxlIHNlYWxlZCBwcm9wZXJ0aWVzIG9mIHRoZSB0YXJnZXQuXG4vLyAtIGVudW1lcmF0ZSBsaXN0cyBhbGwgZW51bWVyYWJsZSBzZWFsZWQgcHJvcGVydGllcyBvZiB0aGUgdGFyZ2V0LlxuLy8gLSBpZiBhIHByb3BlcnR5IG9mIGEgbm9uLWV4dGVuc2libGUgcHJveHkgaXMgcmVwb3J0ZWQgYXMgbm9uLWV4aXN0ZW50LFxuLy8gICB0aGVuIGl0IG11c3QgZm9yZXZlciBiZSByZXBvcnRlZCBhcyBub24tZXhpc3RlbnQuIFRoaXMgYXBwbGllcyB0b1xuLy8gICBvd24gYW5kIGluaGVyaXRlZCBwcm9wZXJ0aWVzIGFuZCBpcyBlbmZvcmNlZCBpbiB0aGVcbi8vICAgZGVsZXRlUHJvcGVydHksIGdldHtPd259UHJvcGVydHlEZXNjcmlwdG9yLCBoYXN7T3dufSxcbi8vICAgZ2V0e093bn1Qcm9wZXJ0eU5hbWVzLCBrZXlzIGFuZCBlbnVtZXJhdGUgdHJhcHNcblxuLy8gVmlvbGF0aW9uIG9mIGFueSBvZiB0aGVzZSBpbnZhcmlhbnRzIGJ5IEggd2lsbCByZXN1bHQgaW4gVHlwZUVycm9yIGJlaW5nXG4vLyB0aHJvd24uXG5cbi8vIEFkZGl0aW9uYWxseSwgb25jZSBPYmplY3QucHJldmVudEV4dGVuc2lvbnMsIE9iamVjdC5zZWFsIG9yIE9iamVjdC5mcmVlemVcbi8vIGlzIGludm9rZWQgb24gdGhlIHByb3h5LCB0aGUgc2V0IG9mIG93biBwcm9wZXJ0eSBuYW1lcyBmb3IgdGhlIHByb3h5IGlzXG4vLyBmaXhlZC4gQW55IHByb3BlcnR5IG5hbWUgdGhhdCBpcyBub3QgZml4ZWQgaXMgY2FsbGVkIGEgJ25ldycgcHJvcGVydHkuXG5cbi8vIFRoZSBWYWxpZGF0b3IgdXBob2xkcyB0aGUgZm9sbG93aW5nIGludmFyaWFudHMgcmVnYXJkaW5nIGV4dGVuc2liaWxpdHk6XG4vLyAtIGdldE93blByb3BlcnR5RGVzY3JpcHRvciBjYW5ub3QgcmVwb3J0IG5ldyBwcm9wZXJ0aWVzIGFzIGV4aXN0ZW50XG4vLyAgIChpdCBtdXN0IHJlcG9ydCB0aGVtIGFzIG5vbi1leGlzdGVudCBieSByZXR1cm5pbmcgdW5kZWZpbmVkKVxuLy8gLSBkZWZpbmVQcm9wZXJ0eSBjYW5ub3Qgc3VjY2Vzc2Z1bGx5IGFkZCBhIG5ldyBwcm9wZXJ0eSAoaXQgbXVzdCByZWplY3QpXG4vLyAtIGdldE93blByb3BlcnR5TmFtZXMgY2Fubm90IGxpc3QgbmV3IHByb3BlcnRpZXNcbi8vIC0gaGFzT3duIGNhbm5vdCByZXBvcnQgdHJ1ZSBmb3IgbmV3IHByb3BlcnRpZXMgKGl0IG11c3QgcmVwb3J0IGZhbHNlKVxuLy8gLSBrZXlzIGNhbm5vdCBsaXN0IG5ldyBwcm9wZXJ0aWVzXG5cbi8vIEludmFyaWFudHMgY3VycmVudGx5IG5vdCBlbmZvcmNlZDpcbi8vIC0gZ2V0T3duUHJvcGVydHlOYW1lcyBsaXN0cyBvbmx5IG93biBwcm9wZXJ0eSBuYW1lc1xuLy8gLSBrZXlzIGxpc3RzIG9ubHkgZW51bWVyYWJsZSBvd24gcHJvcGVydHkgbmFtZXNcbi8vIEJvdGggdHJhcHMgbWF5IGxpc3QgbW9yZSBwcm9wZXJ0eSBuYW1lcyB0aGFuIGFyZSBhY3R1YWxseSBkZWZpbmVkIG9uIHRoZVxuLy8gdGFyZ2V0LlxuXG4vLyBJbnZhcmlhbnRzIHdpdGggcmVnYXJkIHRvIGluaGVyaXRhbmNlIGFyZSBjdXJyZW50bHkgbm90IGVuZm9yY2VkLlxuLy8gLSBhIG5vbi1jb25maWd1cmFibGUgcG90ZW50aWFsbHkgaW5oZXJpdGVkIHByb3BlcnR5IG9uIGEgcHJveHkgd2l0aFxuLy8gICBub24tbXV0YWJsZSBhbmNlc3RyeSBjYW5ub3QgYmUgcmVwb3J0ZWQgYXMgbm9uLWV4aXN0ZW50XG4vLyAoQW4gb2JqZWN0IHdpdGggbm9uLW11dGFibGUgYW5jZXN0cnkgaXMgYSBub24tZXh0ZW5zaWJsZSBvYmplY3Qgd2hvc2Vcbi8vIFtbUHJvdG90eXBlXV0gaXMgZWl0aGVyIG51bGwgb3IgYW4gb2JqZWN0IHdpdGggbm9uLW11dGFibGUgYW5jZXN0cnkuKVxuXG4vLyBDaGFuZ2VzIGluIEhhbmRsZXIgQVBJIGNvbXBhcmVkIHRvIHByZXZpb3VzIGhhcm1vbnk6cHJveGllcywgc2VlOlxuLy8gaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9c3RyYXdtYW46ZGlyZWN0X3Byb3hpZXNcbi8vIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6ZGlyZWN0X3Byb3hpZXNcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vLyAtLS0tIFdlYWtNYXAgcG9seWZpbGwgLS0tLVxuXG4vLyBUT0RPOiBmaW5kIGEgcHJvcGVyIFdlYWtNYXAgcG9seWZpbGxcblxuLy8gZGVmaW5lIGFuIGVtcHR5IFdlYWtNYXAgc28gdGhhdCBhdCBsZWFzdCB0aGUgUmVmbGVjdCBtb2R1bGUgY29kZVxuLy8gd2lsbCB3b3JrIGluIHRoZSBhYnNlbmNlIG9mIFdlYWtNYXBzLiBQcm94eSBlbXVsYXRpb24gZGVwZW5kcyBvblxuLy8gYWN0dWFsIFdlYWtNYXBzLCBzbyB3aWxsIG5vdCB3b3JrIHdpdGggdGhpcyBsaXR0bGUgc2hpbS5cbmlmICh0eXBlb2YgV2Vha01hcCA9PT0gXCJ1bmRlZmluZWRcIikge1xuICBnbG9iYWwuV2Vha01hcCA9IGZ1bmN0aW9uKCl7fTtcbiAgZ2xvYmFsLldlYWtNYXAucHJvdG90eXBlID0ge1xuICAgIGdldDogZnVuY3Rpb24oaykgeyByZXR1cm4gdW5kZWZpbmVkOyB9LFxuICAgIHNldDogZnVuY3Rpb24oayx2KSB7IHRocm93IG5ldyBFcnJvcihcIldlYWtNYXAgbm90IHN1cHBvcnRlZFwiKTsgfVxuICB9O1xufVxuXG4vLyAtLS0tIE5vcm1hbGl6YXRpb24gZnVuY3Rpb25zIGZvciBwcm9wZXJ0eSBkZXNjcmlwdG9ycyAtLS0tXG5cbmZ1bmN0aW9uIGlzU3RhbmRhcmRBdHRyaWJ1dGUobmFtZSkge1xuICByZXR1cm4gL14oZ2V0fHNldHx2YWx1ZXx3cml0YWJsZXxlbnVtZXJhYmxlfGNvbmZpZ3VyYWJsZSkkLy50ZXN0KG5hbWUpO1xufVxuXG4vLyBBZGFwdGVkIGZyb20gRVM1IHNlY3Rpb24gOC4xMC41XG5mdW5jdGlvbiB0b1Byb3BlcnR5RGVzY3JpcHRvcihvYmopIHtcbiAgaWYgKE9iamVjdChvYmopICE9PSBvYmopIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicHJvcGVydHkgZGVzY3JpcHRvciBzaG91bGQgYmUgYW4gT2JqZWN0LCBnaXZlbjogXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmopO1xuICB9XG4gIHZhciBkZXNjID0ge307XG4gIGlmICgnZW51bWVyYWJsZScgaW4gb2JqKSB7IGRlc2MuZW51bWVyYWJsZSA9ICEhb2JqLmVudW1lcmFibGU7IH1cbiAgaWYgKCdjb25maWd1cmFibGUnIGluIG9iaikgeyBkZXNjLmNvbmZpZ3VyYWJsZSA9ICEhb2JqLmNvbmZpZ3VyYWJsZTsgfVxuICBpZiAoJ3ZhbHVlJyBpbiBvYmopIHsgZGVzYy52YWx1ZSA9IG9iai52YWx1ZTsgfVxuICBpZiAoJ3dyaXRhYmxlJyBpbiBvYmopIHsgZGVzYy53cml0YWJsZSA9ICEhb2JqLndyaXRhYmxlOyB9XG4gIGlmICgnZ2V0JyBpbiBvYmopIHtcbiAgICB2YXIgZ2V0dGVyID0gb2JqLmdldDtcbiAgICBpZiAoZ2V0dGVyICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGdldHRlciAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicHJvcGVydHkgZGVzY3JpcHRvciAnZ2V0JyBhdHRyaWJ1dGUgbXVzdCBiZSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCJjYWxsYWJsZSBvciB1bmRlZmluZWQsIGdpdmVuOiBcIitnZXR0ZXIpO1xuICAgIH1cbiAgICBkZXNjLmdldCA9IGdldHRlcjtcbiAgfVxuICBpZiAoJ3NldCcgaW4gb2JqKSB7XG4gICAgdmFyIHNldHRlciA9IG9iai5zZXQ7XG4gICAgaWYgKHNldHRlciAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBzZXR0ZXIgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInByb3BlcnR5IGRlc2NyaXB0b3IgJ3NldCcgYXR0cmlidXRlIG11c3QgYmUgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiY2FsbGFibGUgb3IgdW5kZWZpbmVkLCBnaXZlbjogXCIrc2V0dGVyKTtcbiAgICB9XG4gICAgZGVzYy5zZXQgPSBzZXR0ZXI7XG4gIH1cbiAgaWYgKCdnZXQnIGluIGRlc2MgfHwgJ3NldCcgaW4gZGVzYykge1xuICAgIGlmICgndmFsdWUnIGluIGRlc2MgfHwgJ3dyaXRhYmxlJyBpbiBkZXNjKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicHJvcGVydHkgZGVzY3JpcHRvciBjYW5ub3QgYmUgYm90aCBhIGRhdGEgYW5kIGFuIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcImFjY2Vzc29yIGRlc2NyaXB0b3I6IFwiK29iaik7XG4gICAgfVxuICB9XG4gIHJldHVybiBkZXNjO1xufVxuXG5mdW5jdGlvbiBpc0FjY2Vzc29yRGVzY3JpcHRvcihkZXNjKSB7XG4gIGlmIChkZXNjID09PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICgnZ2V0JyBpbiBkZXNjIHx8ICdzZXQnIGluIGRlc2MpO1xufVxuZnVuY3Rpb24gaXNEYXRhRGVzY3JpcHRvcihkZXNjKSB7XG4gIGlmIChkZXNjID09PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuICgndmFsdWUnIGluIGRlc2MgfHwgJ3dyaXRhYmxlJyBpbiBkZXNjKTtcbn1cbmZ1bmN0aW9uIGlzR2VuZXJpY0Rlc2NyaXB0b3IoZGVzYykge1xuICBpZiAoZGVzYyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiAhaXNBY2Nlc3NvckRlc2NyaXB0b3IoZGVzYykgJiYgIWlzRGF0YURlc2NyaXB0b3IoZGVzYyk7XG59XG5cbmZ1bmN0aW9uIHRvQ29tcGxldGVQcm9wZXJ0eURlc2NyaXB0b3IoZGVzYykge1xuICB2YXIgaW50ZXJuYWxEZXNjID0gdG9Qcm9wZXJ0eURlc2NyaXB0b3IoZGVzYyk7XG4gIGlmIChpc0dlbmVyaWNEZXNjcmlwdG9yKGludGVybmFsRGVzYykgfHwgaXNEYXRhRGVzY3JpcHRvcihpbnRlcm5hbERlc2MpKSB7XG4gICAgaWYgKCEoJ3ZhbHVlJyBpbiBpbnRlcm5hbERlc2MpKSB7IGludGVybmFsRGVzYy52YWx1ZSA9IHVuZGVmaW5lZDsgfVxuICAgIGlmICghKCd3cml0YWJsZScgaW4gaW50ZXJuYWxEZXNjKSkgeyBpbnRlcm5hbERlc2Mud3JpdGFibGUgPSBmYWxzZTsgfVxuICB9IGVsc2Uge1xuICAgIGlmICghKCdnZXQnIGluIGludGVybmFsRGVzYykpIHsgaW50ZXJuYWxEZXNjLmdldCA9IHVuZGVmaW5lZDsgfVxuICAgIGlmICghKCdzZXQnIGluIGludGVybmFsRGVzYykpIHsgaW50ZXJuYWxEZXNjLnNldCA9IHVuZGVmaW5lZDsgfVxuICB9XG4gIGlmICghKCdlbnVtZXJhYmxlJyBpbiBpbnRlcm5hbERlc2MpKSB7IGludGVybmFsRGVzYy5lbnVtZXJhYmxlID0gZmFsc2U7IH1cbiAgaWYgKCEoJ2NvbmZpZ3VyYWJsZScgaW4gaW50ZXJuYWxEZXNjKSkgeyBpbnRlcm5hbERlc2MuY29uZmlndXJhYmxlID0gZmFsc2U7IH1cbiAgcmV0dXJuIGludGVybmFsRGVzYztcbn1cblxuZnVuY3Rpb24gaXNFbXB0eURlc2NyaXB0b3IoZGVzYykge1xuICByZXR1cm4gISgnZ2V0JyBpbiBkZXNjKSAmJlxuICAgICAgICAgISgnc2V0JyBpbiBkZXNjKSAmJlxuICAgICAgICAgISgndmFsdWUnIGluIGRlc2MpICYmXG4gICAgICAgICAhKCd3cml0YWJsZScgaW4gZGVzYykgJiZcbiAgICAgICAgICEoJ2VudW1lcmFibGUnIGluIGRlc2MpICYmXG4gICAgICAgICAhKCdjb25maWd1cmFibGUnIGluIGRlc2MpO1xufVxuXG5mdW5jdGlvbiBpc0VxdWl2YWxlbnREZXNjcmlwdG9yKGRlc2MxLCBkZXNjMikge1xuICByZXR1cm4gc2FtZVZhbHVlKGRlc2MxLmdldCwgZGVzYzIuZ2V0KSAmJlxuICAgICAgICAgc2FtZVZhbHVlKGRlc2MxLnNldCwgZGVzYzIuc2V0KSAmJlxuICAgICAgICAgc2FtZVZhbHVlKGRlc2MxLnZhbHVlLCBkZXNjMi52YWx1ZSkgJiZcbiAgICAgICAgIHNhbWVWYWx1ZShkZXNjMS53cml0YWJsZSwgZGVzYzIud3JpdGFibGUpICYmXG4gICAgICAgICBzYW1lVmFsdWUoZGVzYzEuZW51bWVyYWJsZSwgZGVzYzIuZW51bWVyYWJsZSkgJiZcbiAgICAgICAgIHNhbWVWYWx1ZShkZXNjMS5jb25maWd1cmFibGUsIGRlc2MyLmNvbmZpZ3VyYWJsZSk7XG59XG5cbi8vIGNvcGllZCBmcm9tIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6ZWdhbFxuZnVuY3Rpb24gc2FtZVZhbHVlKHgsIHkpIHtcbiAgaWYgKHggPT09IHkpIHtcbiAgICAvLyAwID09PSAtMCwgYnV0IHRoZXkgYXJlIG5vdCBpZGVudGljYWxcbiAgICByZXR1cm4geCAhPT0gMCB8fCAxIC8geCA9PT0gMSAvIHk7XG4gIH1cblxuICAvLyBOYU4gIT09IE5hTiwgYnV0IHRoZXkgYXJlIGlkZW50aWNhbC5cbiAgLy8gTmFOcyBhcmUgdGhlIG9ubHkgbm9uLXJlZmxleGl2ZSB2YWx1ZSwgaS5lLiwgaWYgeCAhPT0geCxcbiAgLy8gdGhlbiB4IGlzIGEgTmFOLlxuICAvLyBpc05hTiBpcyBicm9rZW46IGl0IGNvbnZlcnRzIGl0cyBhcmd1bWVudCB0byBudW1iZXIsIHNvXG4gIC8vIGlzTmFOKFwiZm9vXCIpID0+IHRydWVcbiAgcmV0dXJuIHggIT09IHggJiYgeSAhPT0geTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgZnJlc2ggcHJvcGVydHkgZGVzY3JpcHRvciB0aGF0IGlzIGd1YXJhbnRlZWRcbiAqIHRvIGJlIGNvbXBsZXRlIChpLmUuIGNvbnRhaW4gYWxsIHRoZSBzdGFuZGFyZCBhdHRyaWJ1dGVzKS5cbiAqIEFkZGl0aW9uYWxseSwgYW55IG5vbi1zdGFuZGFyZCBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2ZcbiAqIGF0dHJpYnV0ZXMgYXJlIGNvcGllZCBvdmVyIHRvIHRoZSBmcmVzaCBkZXNjcmlwdG9yLlxuICpcbiAqIElmIGF0dHJpYnV0ZXMgaXMgdW5kZWZpbmVkLCByZXR1cm5zIHVuZGVmaW5lZC5cbiAqXG4gKiBTZWUgYWxzbzogaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTpwcm94aWVzX3NlbWFudGljc1xuICovXG5mdW5jdGlvbiBub3JtYWxpemVBbmRDb21wbGV0ZVByb3BlcnR5RGVzY3JpcHRvcihhdHRyaWJ1dGVzKSB7XG4gIGlmIChhdHRyaWJ1dGVzID09PSB1bmRlZmluZWQpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuICB2YXIgZGVzYyA9IHRvQ29tcGxldGVQcm9wZXJ0eURlc2NyaXB0b3IoYXR0cmlidXRlcyk7XG4gIC8vIE5vdGU6IG5vIG5lZWQgdG8gY2FsbCBGcm9tUHJvcGVydHlEZXNjcmlwdG9yKGRlc2MpLCBhcyB3ZSByZXByZXNlbnRcbiAgLy8gXCJpbnRlcm5hbFwiIHByb3BlcnR5IGRlc2NyaXB0b3JzIGFzIHByb3BlciBPYmplY3RzIGZyb20gdGhlIHN0YXJ0XG4gIGZvciAodmFyIG5hbWUgaW4gYXR0cmlidXRlcykge1xuICAgIGlmICghaXNTdGFuZGFyZEF0dHJpYnV0ZShuYW1lKSkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGRlc2MsIG5hbWUsXG4gICAgICAgIHsgdmFsdWU6IGF0dHJpYnV0ZXNbbmFtZV0sXG4gICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUgfSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBkZXNjO1xufVxuXG4vKipcbiAqIFJldHVybnMgYSBmcmVzaCBwcm9wZXJ0eSBkZXNjcmlwdG9yIHdob3NlIHN0YW5kYXJkXG4gKiBhdHRyaWJ1dGVzIGFyZSBndWFyYW50ZWVkIHRvIGJlIGRhdGEgcHJvcGVydGllcyBvZiB0aGUgcmlnaHQgdHlwZS5cbiAqIEFkZGl0aW9uYWxseSwgYW55IG5vbi1zdGFuZGFyZCBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2ZcbiAqIGF0dHJpYnV0ZXMgYXJlIGNvcGllZCBvdmVyIHRvIHRoZSBmcmVzaCBkZXNjcmlwdG9yLlxuICpcbiAqIElmIGF0dHJpYnV0ZXMgaXMgdW5kZWZpbmVkLCB3aWxsIHRocm93IGEgVHlwZUVycm9yLlxuICpcbiAqIFNlZSBhbHNvOiBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OnByb3hpZXNfc2VtYW50aWNzXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZVByb3BlcnR5RGVzY3JpcHRvcihhdHRyaWJ1dGVzKSB7XG4gIHZhciBkZXNjID0gdG9Qcm9wZXJ0eURlc2NyaXB0b3IoYXR0cmlidXRlcyk7XG4gIC8vIE5vdGU6IG5vIG5lZWQgdG8gY2FsbCBGcm9tR2VuZXJpY1Byb3BlcnR5RGVzY3JpcHRvcihkZXNjKSwgYXMgd2UgcmVwcmVzZW50XG4gIC8vIFwiaW50ZXJuYWxcIiBwcm9wZXJ0eSBkZXNjcmlwdG9ycyBhcyBwcm9wZXIgT2JqZWN0cyBmcm9tIHRoZSBzdGFydFxuICBmb3IgKHZhciBuYW1lIGluIGF0dHJpYnV0ZXMpIHtcbiAgICBpZiAoIWlzU3RhbmRhcmRBdHRyaWJ1dGUobmFtZSkpIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShkZXNjLCBuYW1lLFxuICAgICAgICB7IHZhbHVlOiBhdHRyaWJ1dGVzW25hbWVdLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlIH0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGVzYztcbn1cblxuLy8gc3RvcmUgYSByZWZlcmVuY2UgdG8gdGhlIHJlYWwgRVM1IHByaW1pdGl2ZXMgYmVmb3JlIHBhdGNoaW5nIHRoZW0gbGF0ZXJcbnZhciBwcmltX3ByZXZlbnRFeHRlbnNpb25zID0gICAgICAgIE9iamVjdC5wcmV2ZW50RXh0ZW5zaW9ucyxcbiAgICBwcmltX3NlYWwgPSAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5zZWFsLFxuICAgIHByaW1fZnJlZXplID0gICAgICAgICAgICAgICAgICAgT2JqZWN0LmZyZWV6ZSxcbiAgICBwcmltX2lzRXh0ZW5zaWJsZSA9ICAgICAgICAgICAgIE9iamVjdC5pc0V4dGVuc2libGUsXG4gICAgcHJpbV9pc1NlYWxlZCA9ICAgICAgICAgICAgICAgICBPYmplY3QuaXNTZWFsZWQsXG4gICAgcHJpbV9pc0Zyb3plbiA9ICAgICAgICAgICAgICAgICBPYmplY3QuaXNGcm96ZW4sXG4gICAgcHJpbV9nZXRQcm90b3R5cGVPZiA9ICAgICAgICAgICBPYmplY3QuZ2V0UHJvdG90eXBlT2YsXG4gICAgcHJpbV9nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yLFxuICAgIHByaW1fZGVmaW5lUHJvcGVydHkgPSAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5LFxuICAgIHByaW1fZGVmaW5lUHJvcGVydGllcyA9ICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMsXG4gICAgcHJpbV9rZXlzID0gICAgICAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyxcbiAgICBwcmltX2dldE93blByb3BlcnR5TmFtZXMgPSAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzLFxuICAgIHByaW1fZ2V0T3duUHJvcGVydHlTeW1ib2xzID0gICAgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyxcbiAgICBwcmltX2Fzc2lnbiA9ICAgICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24sXG4gICAgcHJpbV9pc0FycmF5ID0gICAgICAgICAgICAgICAgICBBcnJheS5pc0FycmF5LFxuICAgIHByaW1fY29uY2F0ID0gICAgICAgICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLmNvbmNhdCxcbiAgICBwcmltX2lzUHJvdG90eXBlT2YgPSAgICAgICAgICAgIE9iamVjdC5wcm90b3R5cGUuaXNQcm90b3R5cGVPZixcbiAgICBwcmltX2hhc093blByb3BlcnR5ID0gICAgICAgICAgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8vIHRoZXNlIHdpbGwgcG9pbnQgdG8gdGhlIHBhdGNoZWQgdmVyc2lvbnMgb2YgdGhlIHJlc3BlY3RpdmUgbWV0aG9kcyBvblxuLy8gT2JqZWN0LiBUaGV5IGFyZSB1c2VkIHdpdGhpbiB0aGlzIG1vZHVsZSBhcyB0aGUgXCJpbnRyaW5zaWNcIiBiaW5kaW5nc1xuLy8gb2YgdGhlc2UgbWV0aG9kcyAoaS5lLiB0aGUgXCJvcmlnaW5hbFwiIGJpbmRpbmdzIGFzIGRlZmluZWQgaW4gdGhlIHNwZWMpXG52YXIgT2JqZWN0X2lzRnJvemVuLFxuICAgIE9iamVjdF9pc1NlYWxlZCxcbiAgICBPYmplY3RfaXNFeHRlbnNpYmxlLFxuICAgIE9iamVjdF9nZXRQcm90b3R5cGVPZixcbiAgICBPYmplY3RfZ2V0T3duUHJvcGVydHlOYW1lcztcblxuLyoqXG4gKiBBIHByb3BlcnR5ICduYW1lJyBpcyBmaXhlZCBpZiBpdCBpcyBhbiBvd24gcHJvcGVydHkgb2YgdGhlIHRhcmdldC5cbiAqL1xuZnVuY3Rpb24gaXNGaXhlZChuYW1lLCB0YXJnZXQpIHtcbiAgcmV0dXJuICh7fSkuaGFzT3duUHJvcGVydHkuY2FsbCh0YXJnZXQsIG5hbWUpO1xufVxuZnVuY3Rpb24gaXNTZWFsZWQobmFtZSwgdGFyZ2V0KSB7XG4gIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIG5hbWUpO1xuICBpZiAoZGVzYyA9PT0gdW5kZWZpbmVkKSB7IHJldHVybiBmYWxzZTsgfVxuICByZXR1cm4gZGVzYy5jb25maWd1cmFibGUgPT09IGZhbHNlO1xufVxuZnVuY3Rpb24gaXNTZWFsZWREZXNjKGRlc2MpIHtcbiAgcmV0dXJuIGRlc2MgIT09IHVuZGVmaW5lZCAmJiBkZXNjLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2U7XG59XG5cbi8qKlxuICogUGVyZm9ybXMgYWxsIHZhbGlkYXRpb24gdGhhdCBPYmplY3QuZGVmaW5lUHJvcGVydHkgcGVyZm9ybXMsXG4gKiB3aXRob3V0IGFjdHVhbGx5IGRlZmluaW5nIHRoZSBwcm9wZXJ0eS4gUmV0dXJucyBhIGJvb2xlYW5cbiAqIGluZGljYXRpbmcgd2hldGhlciB2YWxpZGF0aW9uIHN1Y2NlZWRlZC5cbiAqXG4gKiBJbXBsZW1lbnRhdGlvbiB0cmFuc2xpdGVyYXRlZCBmcm9tIEVTNS4xIHNlY3Rpb24gOC4xMi45XG4gKi9cbmZ1bmN0aW9uIGlzQ29tcGF0aWJsZURlc2NyaXB0b3IoZXh0ZW5zaWJsZSwgY3VycmVudCwgZGVzYykge1xuICBpZiAoY3VycmVudCA9PT0gdW5kZWZpbmVkICYmIGV4dGVuc2libGUgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChjdXJyZW50ID09PSB1bmRlZmluZWQgJiYgZXh0ZW5zaWJsZSA9PT0gdHJ1ZSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGlmIChpc0VtcHR5RGVzY3JpcHRvcihkZXNjKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGlmIChpc0VxdWl2YWxlbnREZXNjcmlwdG9yKGN1cnJlbnQsIGRlc2MpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKGN1cnJlbnQuY29uZmlndXJhYmxlID09PSBmYWxzZSkge1xuICAgIGlmIChkZXNjLmNvbmZpZ3VyYWJsZSA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoJ2VudW1lcmFibGUnIGluIGRlc2MgJiYgZGVzYy5lbnVtZXJhYmxlICE9PSBjdXJyZW50LmVudW1lcmFibGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgaWYgKGlzR2VuZXJpY0Rlc2NyaXB0b3IoZGVzYykpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBpZiAoaXNEYXRhRGVzY3JpcHRvcihjdXJyZW50KSAhPT0gaXNEYXRhRGVzY3JpcHRvcihkZXNjKSkge1xuICAgIGlmIChjdXJyZW50LmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKGlzRGF0YURlc2NyaXB0b3IoY3VycmVudCkgJiYgaXNEYXRhRGVzY3JpcHRvcihkZXNjKSkge1xuICAgIGlmIChjdXJyZW50LmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgIGlmIChjdXJyZW50LndyaXRhYmxlID09PSBmYWxzZSAmJiBkZXNjLndyaXRhYmxlID09PSB0cnVlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChjdXJyZW50LndyaXRhYmxlID09PSBmYWxzZSkge1xuICAgICAgICBpZiAoJ3ZhbHVlJyBpbiBkZXNjICYmICFzYW1lVmFsdWUoZGVzYy52YWx1ZSwgY3VycmVudC52YWx1ZSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKGlzQWNjZXNzb3JEZXNjcmlwdG9yKGN1cnJlbnQpICYmIGlzQWNjZXNzb3JEZXNjcmlwdG9yKGRlc2MpKSB7XG4gICAgaWYgKGN1cnJlbnQuY29uZmlndXJhYmxlID09PSBmYWxzZSkge1xuICAgICAgaWYgKCdzZXQnIGluIGRlc2MgJiYgIXNhbWVWYWx1ZShkZXNjLnNldCwgY3VycmVudC5zZXQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmICgnZ2V0JyBpbiBkZXNjICYmICFzYW1lVmFsdWUoZGVzYy5nZXQsIGN1cnJlbnQuZ2V0KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vLyBFUzYgNy4zLjExIFNldEludGVncml0eUxldmVsXG4vLyBsZXZlbCBpcyBvbmUgb2YgXCJzZWFsZWRcIiBvciBcImZyb3plblwiXG5mdW5jdGlvbiBzZXRJbnRlZ3JpdHlMZXZlbCh0YXJnZXQsIGxldmVsKSB7XG4gIHZhciBvd25Qcm9wcyA9IE9iamVjdF9nZXRPd25Qcm9wZXJ0eU5hbWVzKHRhcmdldCk7XG4gIHZhciBwZW5kaW5nRXhjZXB0aW9uID0gdW5kZWZpbmVkO1xuICBpZiAobGV2ZWwgPT09IFwic2VhbGVkXCIpIHtcbiAgICB2YXIgbCA9ICtvd25Qcm9wcy5sZW5ndGg7XG4gICAgdmFyIGs7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgIGsgPSBTdHJpbmcob3duUHJvcHNbaV0pO1xuICAgICAgdHJ5IHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgaywgeyBjb25maWd1cmFibGU6IGZhbHNlIH0pO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAocGVuZGluZ0V4Y2VwdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcGVuZGluZ0V4Y2VwdGlvbiA9IGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gbGV2ZWwgPT09IFwiZnJvemVuXCJcbiAgICB2YXIgbCA9ICtvd25Qcm9wcy5sZW5ndGg7XG4gICAgdmFyIGs7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgIGsgPSBTdHJpbmcob3duUHJvcHNbaV0pO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdmFyIGN1cnJlbnREZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGspO1xuICAgICAgICBpZiAoY3VycmVudERlc2MgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHZhciBkZXNjO1xuICAgICAgICAgIGlmIChpc0FjY2Vzc29yRGVzY3JpcHRvcihjdXJyZW50RGVzYykpIHtcbiAgICAgICAgICAgIGRlc2MgPSB7IGNvbmZpZ3VyYWJsZTogZmFsc2UgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZXNjID0geyBjb25maWd1cmFibGU6IGZhbHNlLCB3cml0YWJsZTogZmFsc2UgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrLCBkZXNjKTtcbiAgICAgICAgfSAgICAgICAgXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChwZW5kaW5nRXhjZXB0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBwZW5kaW5nRXhjZXB0aW9uID0gZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAocGVuZGluZ0V4Y2VwdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgcGVuZGluZ0V4Y2VwdGlvbjtcbiAgfVxuICByZXR1cm4gUmVmbGVjdC5wcmV2ZW50RXh0ZW5zaW9ucyh0YXJnZXQpO1xufVxuXG4vLyBFUzYgNy4zLjEyIFRlc3RJbnRlZ3JpdHlMZXZlbFxuLy8gbGV2ZWwgaXMgb25lIG9mIFwic2VhbGVkXCIgb3IgXCJmcm96ZW5cIlxuZnVuY3Rpb24gdGVzdEludGVncml0eUxldmVsKHRhcmdldCwgbGV2ZWwpIHtcbiAgdmFyIGlzRXh0ZW5zaWJsZSA9IE9iamVjdF9pc0V4dGVuc2libGUodGFyZ2V0KTtcbiAgaWYgKGlzRXh0ZW5zaWJsZSkgcmV0dXJuIGZhbHNlO1xuICBcbiAgdmFyIG93blByb3BzID0gT2JqZWN0X2dldE93blByb3BlcnR5TmFtZXModGFyZ2V0KTtcbiAgdmFyIHBlbmRpbmdFeGNlcHRpb24gPSB1bmRlZmluZWQ7XG4gIHZhciBjb25maWd1cmFibGUgPSBmYWxzZTtcbiAgdmFyIHdyaXRhYmxlID0gZmFsc2U7XG4gIFxuICB2YXIgbCA9ICtvd25Qcm9wcy5sZW5ndGg7XG4gIHZhciBrO1xuICB2YXIgY3VycmVudERlc2M7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgayA9IFN0cmluZyhvd25Qcm9wc1tpXSk7XG4gICAgdHJ5IHtcbiAgICAgIGN1cnJlbnREZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGspO1xuICAgICAgY29uZmlndXJhYmxlID0gY29uZmlndXJhYmxlIHx8IGN1cnJlbnREZXNjLmNvbmZpZ3VyYWJsZTtcbiAgICAgIGlmIChpc0RhdGFEZXNjcmlwdG9yKGN1cnJlbnREZXNjKSkge1xuICAgICAgICB3cml0YWJsZSA9IHdyaXRhYmxlIHx8IGN1cnJlbnREZXNjLndyaXRhYmxlO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChwZW5kaW5nRXhjZXB0aW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcGVuZGluZ0V4Y2VwdGlvbiA9IGU7XG4gICAgICAgIGNvbmZpZ3VyYWJsZSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChwZW5kaW5nRXhjZXB0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBwZW5kaW5nRXhjZXB0aW9uO1xuICB9XG4gIGlmIChsZXZlbCA9PT0gXCJmcm96ZW5cIiAmJiB3cml0YWJsZSA9PT0gdHJ1ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoY29uZmlndXJhYmxlID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vLyAtLS0tIFRoZSBWYWxpZGF0b3IgaGFuZGxlciB3cmFwcGVyIGFyb3VuZCB1c2VyIGhhbmRsZXJzIC0tLS1cblxuLyoqXG4gKiBAcGFyYW0gdGFyZ2V0IHRoZSBvYmplY3Qgd3JhcHBlZCBieSB0aGlzIHByb3h5LlxuICogQXMgbG9uZyBhcyB0aGUgcHJveHkgaXMgZXh0ZW5zaWJsZSwgb25seSBub24tY29uZmlndXJhYmxlIHByb3BlcnRpZXNcbiAqIGFyZSBjaGVja2VkIGFnYWluc3QgdGhlIHRhcmdldC4gT25jZSB0aGUgcHJveHkgYmVjb21lcyBub24tZXh0ZW5zaWJsZSxcbiAqIGludmFyaWFudHMgdy5yLnQuIG5vbi1leHRlbnNpYmlsaXR5IGFyZSBhbHNvIGVuZm9yY2VkLlxuICpcbiAqIEBwYXJhbSBoYW5kbGVyIHRoZSBoYW5kbGVyIG9mIHRoZSBkaXJlY3QgcHJveHkuIFRoZSBvYmplY3QgZW11bGF0ZWQgYnlcbiAqIHRoaXMgaGFuZGxlciBpcyB2YWxpZGF0ZWQgYWdhaW5zdCB0aGUgdGFyZ2V0IG9iamVjdCBvZiB0aGUgZGlyZWN0IHByb3h5LlxuICogQW55IHZpb2xhdGlvbnMgdGhhdCB0aGUgaGFuZGxlciBtYWtlcyBhZ2FpbnN0IHRoZSBpbnZhcmlhbnRzXG4gKiBvZiB0aGUgdGFyZ2V0IHdpbGwgY2F1c2UgYSBUeXBlRXJyb3IgdG8gYmUgdGhyb3duLlxuICpcbiAqIEJvdGggdGFyZ2V0IGFuZCBoYW5kbGVyIG11c3QgYmUgcHJvcGVyIE9iamVjdHMgYXQgaW5pdGlhbGl6YXRpb24gdGltZS5cbiAqL1xuZnVuY3Rpb24gVmFsaWRhdG9yKHRhcmdldCwgaGFuZGxlcikge1xuICAvLyBmb3Igbm9uLXJldm9rYWJsZSBwcm94aWVzLCB0aGVzZSBhcmUgY29uc3QgcmVmZXJlbmNlc1xuICAvLyBmb3IgcmV2b2thYmxlIHByb3hpZXMsIG9uIHJldm9jYXRpb246XG4gIC8vIC0gdGhpcy50YXJnZXQgaXMgc2V0IHRvIG51bGxcbiAgLy8gLSB0aGlzLmhhbmRsZXIgaXMgc2V0IHRvIGEgaGFuZGxlciB0aGF0IHRocm93cyBvbiBhbGwgdHJhcHNcbiAgdGhpcy50YXJnZXQgID0gdGFyZ2V0O1xuICB0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xufVxuXG5WYWxpZGF0b3IucHJvdG90eXBlID0ge1xuXG4gIC8qKlxuICAgKiBJZiBnZXRUcmFwIHJldHVybnMgdW5kZWZpbmVkLCB0aGUgY2FsbGVyIHNob3VsZCBwZXJmb3JtIHRoZVxuICAgKiBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3IuXG4gICAqIElmIGdldFRyYXAgcmV0dXJucyBub3JtYWxseSBvdGhlcndpc2UsIHRoZSByZXR1cm4gdmFsdWVcbiAgICogd2lsbCBiZSBhIGNhbGxhYmxlIHRyYXAgZnVuY3Rpb24uIFdoZW4gY2FsbGluZyB0aGUgdHJhcCBmdW5jdGlvbixcbiAgICogdGhlIGNhbGxlciBpcyByZXNwb25zaWJsZSBmb3IgYmluZGluZyBpdHMgfHRoaXN8IHRvIHx0aGlzLmhhbmRsZXJ8LlxuICAgKi9cbiAgZ2V0VHJhcDogZnVuY3Rpb24odHJhcE5hbWUpIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuaGFuZGxlclt0cmFwTmFtZV07XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gdGhlIHRyYXAgd2FzIG5vdCBkZWZpbmVkLFxuICAgICAgLy8gcGVyZm9ybSB0aGUgZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdHJhcCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHRyYXBOYW1lICsgXCIgdHJhcCBpcyBub3QgY2FsbGFibGU6IFwiK3RyYXApO1xuICAgIH1cblxuICAgIHJldHVybiB0cmFwO1xuICB9LFxuXG4gIC8vID09PSBmdW5kYW1lbnRhbCB0cmFwcyA9PT1cblxuICAvKipcbiAgICogSWYgbmFtZSBkZW5vdGVzIGEgZml4ZWQgcHJvcGVydHksIGNoZWNrOlxuICAgKiAgIC0gd2hldGhlciB0YXJnZXRIYW5kbGVyIHJlcG9ydHMgaXQgYXMgZXhpc3RlbnRcbiAgICogICAtIHdoZXRoZXIgdGhlIHJldHVybmVkIGRlc2NyaXB0b3IgaXMgY29tcGF0aWJsZSB3aXRoIHRoZSBmaXhlZCBwcm9wZXJ0eVxuICAgKiBJZiB0aGUgcHJveHkgaXMgbm9uLWV4dGVuc2libGUsIGNoZWNrOlxuICAgKiAgIC0gd2hldGhlciBuYW1lIGlzIG5vdCBhIG5ldyBwcm9wZXJ0eVxuICAgKiBBZGRpdGlvbmFsbHksIHRoZSByZXR1cm5lZCBkZXNjcmlwdG9yIGlzIG5vcm1hbGl6ZWQgYW5kIGNvbXBsZXRlZC5cbiAgICovXG4gIGdldE93blByb3BlcnR5RGVzY3JpcHRvcjogZnVuY3Rpb24obmFtZSkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIFJlZmxlY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRoaXMudGFyZ2V0LCBuYW1lKTtcbiAgICB9XG5cbiAgICBuYW1lID0gU3RyaW5nKG5hbWUpO1xuICAgIHZhciBkZXNjID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQsIG5hbWUpO1xuICAgIGRlc2MgPSBub3JtYWxpemVBbmRDb21wbGV0ZVByb3BlcnR5RGVzY3JpcHRvcihkZXNjKTtcblxuICAgIHZhciB0YXJnZXREZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0aGlzLnRhcmdldCwgbmFtZSk7XG4gICAgdmFyIGV4dGVuc2libGUgPSBPYmplY3QuaXNFeHRlbnNpYmxlKHRoaXMudGFyZ2V0KTtcblxuICAgIGlmIChkZXNjID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChpc1NlYWxlZERlc2ModGFyZ2V0RGVzYykpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCByZXBvcnQgbm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0eSAnXCIrbmFtZStcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIicgYXMgbm9uLWV4aXN0ZW50XCIpO1xuICAgICAgfVxuICAgICAgaWYgKCFleHRlbnNpYmxlICYmIHRhcmdldERlc2MgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIGlmIGhhbmRsZXIgaXMgYWxsb3dlZCB0byByZXR1cm4gdW5kZWZpbmVkLCB3ZSBjYW5ub3QgZ3VhcmFudGVlXG4gICAgICAgICAgLy8gdGhhdCBpdCB3aWxsIG5vdCByZXR1cm4gYSBkZXNjcmlwdG9yIGZvciB0aGlzIHByb3BlcnR5IGxhdGVyLlxuICAgICAgICAgIC8vIE9uY2UgYSBwcm9wZXJ0eSBoYXMgYmVlbiByZXBvcnRlZCBhcyBub24tZXhpc3RlbnQgb24gYSBub24tZXh0ZW5zaWJsZVxuICAgICAgICAgIC8vIG9iamVjdCwgaXQgc2hvdWxkIGZvcmV2ZXIgYmUgcmVwb3J0ZWQgYXMgbm9uLWV4aXN0ZW50XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCByZXBvcnQgZXhpc3Rpbmcgb3duIHByb3BlcnR5ICdcIituYW1lK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCInIGFzIG5vbi1leGlzdGVudCBvbiBhIG5vbi1leHRlbnNpYmxlIG9iamVjdFwiKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLy8gYXQgdGhpcyBwb2ludCwgd2Uga25vdyAoZGVzYyAhPT0gdW5kZWZpbmVkKSwgaS5lLlxuICAgIC8vIHRhcmdldEhhbmRsZXIgcmVwb3J0cyAnbmFtZScgYXMgYW4gZXhpc3RpbmcgcHJvcGVydHlcblxuICAgIC8vIE5vdGU6IHdlIGNvdWxkIGNvbGxhcHNlIHRoZSBmb2xsb3dpbmcgdHdvIGlmLXRlc3RzIGludG8gYSBzaW5nbGVcbiAgICAvLyB0ZXN0LiBTZXBhcmF0aW5nIG91dCB0aGUgY2FzZXMgdG8gaW1wcm92ZSBlcnJvciByZXBvcnRpbmcuXG5cbiAgICBpZiAoIWV4dGVuc2libGUpIHtcbiAgICAgIGlmICh0YXJnZXREZXNjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCByZXBvcnQgYSBuZXcgb3duIHByb3BlcnR5ICdcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lICsgXCInIG9uIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0XCIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChuYW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICghaXNDb21wYXRpYmxlRGVzY3JpcHRvcihleHRlbnNpYmxlLCB0YXJnZXREZXNjLCBkZXNjKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHJlcG9ydCBpbmNvbXBhdGlibGUgcHJvcGVydHkgZGVzY3JpcHRvciBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImZvciBwcm9wZXJ0eSAnXCIrbmFtZStcIidcIik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmIChkZXNjLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgIGlmICh0YXJnZXREZXNjID09PSB1bmRlZmluZWQgfHwgdGFyZ2V0RGVzYy5jb25maWd1cmFibGUgPT09IHRydWUpIHtcbiAgICAgICAgLy8gaWYgdGhlIHByb3BlcnR5IGlzIGNvbmZpZ3VyYWJsZSBvciBub24tZXhpc3RlbnQgb24gdGhlIHRhcmdldCxcbiAgICAgICAgLy8gYnV0IGlzIHJlcG9ydGVkIGFzIGEgbm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0eSwgaXQgbWF5IGxhdGVyIGJlXG4gICAgICAgIC8vIHJlcG9ydGVkIGFzIGNvbmZpZ3VyYWJsZSBvciBub24tZXhpc3RlbnQsIHdoaWNoIHZpb2xhdGVzIHRoZVxuICAgICAgICAvLyBpbnZhcmlhbnQgdGhhdCBpZiB0aGUgcHJvcGVydHkgbWlnaHQgY2hhbmdlIG9yIGRpc2FwcGVhciwgdGhlXG4gICAgICAgIC8vIGNvbmZpZ3VyYWJsZSBhdHRyaWJ1dGUgbXVzdCBiZSB0cnVlLlxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIFwiY2Fubm90IHJlcG9ydCBhIG5vbi1jb25maWd1cmFibGUgZGVzY3JpcHRvciBcIiArXG4gICAgICAgICAgXCJmb3IgY29uZmlndXJhYmxlIG9yIG5vbi1leGlzdGVudCBwcm9wZXJ0eSAnXCIgKyBuYW1lICsgXCInXCIpO1xuICAgICAgfVxuICAgICAgaWYgKCd3cml0YWJsZScgaW4gZGVzYyAmJiBkZXNjLndyaXRhYmxlID09PSBmYWxzZSkge1xuICAgICAgICBpZiAodGFyZ2V0RGVzYy53cml0YWJsZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgIC8vIGlmIHRoZSBwcm9wZXJ0eSBpcyBub24tY29uZmlndXJhYmxlLCB3cml0YWJsZSBvbiB0aGUgdGFyZ2V0LFxuICAgICAgICAgIC8vIGJ1dCBpcyByZXBvcnRlZCBhcyBub24tY29uZmlndXJhYmxlLCBub24td3JpdGFibGUsIGl0IG1heSBsYXRlclxuICAgICAgICAgIC8vIGJlIHJlcG9ydGVkIGFzIG5vbi1jb25maWd1cmFibGUsIHdyaXRhYmxlIGFnYWluLCB3aGljaCB2aW9sYXRlc1xuICAgICAgICAgIC8vIHRoZSBpbnZhcmlhbnQgdGhhdCBhIG5vbi1jb25maWd1cmFibGUsIG5vbi13cml0YWJsZSBwcm9wZXJ0eVxuICAgICAgICAgIC8vIG1heSBub3QgY2hhbmdlIHN0YXRlLlxuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICBcImNhbm5vdCByZXBvcnQgbm9uLWNvbmZpZ3VyYWJsZSwgd3JpdGFibGUgcHJvcGVydHkgJ1wiICsgbmFtZSArXG4gICAgICAgICAgICBcIicgYXMgbm9uLWNvbmZpZ3VyYWJsZSwgbm9uLXdyaXRhYmxlXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlc2M7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEluIHRoZSBkaXJlY3QgcHJveGllcyBkZXNpZ24gd2l0aCByZWZhY3RvcmVkIHByb3RvdHlwZSBjbGltYmluZyxcbiAgICogdGhpcyB0cmFwIGlzIGRlcHJlY2F0ZWQuIEZvciBwcm94aWVzLWFzLXByb3RvdHlwZXMsIGluc3RlYWRcbiAgICogb2YgY2FsbGluZyB0aGlzIHRyYXAsIHRoZSBnZXQsIHNldCwgaGFzIG9yIGVudW1lcmF0ZSB0cmFwcyBhcmVcbiAgICogY2FsbGVkIGluc3RlYWQuXG4gICAqXG4gICAqIEluIHRoaXMgaW1wbGVtZW50YXRpb24sIHdlIFwiYWJ1c2VcIiBnZXRQcm9wZXJ0eURlc2NyaXB0b3IgdG9cbiAgICogc3VwcG9ydCB0cmFwcGluZyB0aGUgZ2V0IG9yIHNldCB0cmFwcyBmb3IgcHJveGllcy1hcy1wcm90b3R5cGVzLlxuICAgKiBXZSBkbyB0aGlzIGJ5IHJldHVybmluZyBhIGdldHRlci9zZXR0ZXIgcGFpciB0aGF0IGludm9rZXNcbiAgICogdGhlIGNvcnJlc3BvbmRpbmcgdHJhcHMuXG4gICAqXG4gICAqIFdoaWxlIHRoaXMgaGFjayB3b3JrcyBmb3IgaW5oZXJpdGVkIHByb3BlcnR5IGFjY2VzcywgaXQgaGFzIHNvbWVcbiAgICogcXVpcmtzOlxuICAgKlxuICAgKiBJbiBGaXJlZm94LCB0aGlzIHRyYXAgaXMgb25seSBjYWxsZWQgYWZ0ZXIgYSBwcmlvciBpbnZvY2F0aW9uXG4gICAqIG9mIHRoZSAnaGFzJyB0cmFwIGhhcyByZXR1cm5lZCB0cnVlLiBIZW5jZSwgZXhwZWN0IHRoZSBmb2xsb3dpbmdcbiAgICogYmVoYXZpb3I6XG4gICAqIDxjb2RlPlxuICAgKiB2YXIgY2hpbGQgPSBPYmplY3QuY3JlYXRlKFByb3h5KHRhcmdldCwgaGFuZGxlcikpO1xuICAgKiBjaGlsZFtuYW1lXSAvLyB0cmlnZ2VycyBoYW5kbGVyLmhhcyh0YXJnZXQsIG5hbWUpXG4gICAqIC8vIGlmIHRoYXQgcmV0dXJucyB0cnVlLCB0cmlnZ2VycyBoYW5kbGVyLmdldCh0YXJnZXQsIG5hbWUsIGNoaWxkKVxuICAgKiA8L2NvZGU+XG4gICAqXG4gICAqIE9uIHY4LCB0aGUgJ2luJyBvcGVyYXRvciwgd2hlbiBhcHBsaWVkIHRvIGFuIG9iamVjdCB0aGF0IGluaGVyaXRzXG4gICAqIGZyb20gYSBwcm94eSwgd2lsbCBjYWxsIGdldFByb3BlcnR5RGVzY3JpcHRvciBhbmQgd2FsayB0aGUgcHJvdG8tY2hhaW4uXG4gICAqIFRoYXQgY2FsbHMgdGhlIGJlbG93IGdldFByb3BlcnR5RGVzY3JpcHRvciB0cmFwIG9uIHRoZSBwcm94eS4gVGhlXG4gICAqIHJlc3VsdCBvZiB0aGUgJ2luJy1vcGVyYXRvciBpcyB0aGVuIGRldGVybWluZWQgYnkgd2hldGhlciB0aGlzIHRyYXBcbiAgICogcmV0dXJucyB1bmRlZmluZWQgb3IgYSBwcm9wZXJ0eSBkZXNjcmlwdG9yIG9iamVjdC4gVGhhdCBpcyB3aHlcbiAgICogd2UgZmlyc3QgZXhwbGljaXRseSB0cmlnZ2VyIHRoZSAnaGFzJyB0cmFwIHRvIGRldGVybWluZSB3aGV0aGVyXG4gICAqIHRoZSBwcm9wZXJ0eSBleGlzdHMuXG4gICAqXG4gICAqIFRoaXMgaGFzIHRoZSBzaWRlLWVmZmVjdCB0aGF0IHdoZW4gZW51bWVyYXRpbmcgcHJvcGVydGllcyBvblxuICAgKiBhbiBvYmplY3QgdGhhdCBpbmhlcml0cyBmcm9tIGEgcHJveHkgaW4gdjgsIG9ubHkgcHJvcGVydGllc1xuICAgKiBmb3Igd2hpY2ggJ2hhcycgcmV0dXJucyB0cnVlIGFyZSByZXR1cm5lZDpcbiAgICpcbiAgICogPGNvZGU+XG4gICAqIHZhciBjaGlsZCA9IE9iamVjdC5jcmVhdGUoUHJveHkodGFyZ2V0LCBoYW5kbGVyKSk7XG4gICAqIGZvciAodmFyIHByb3AgaW4gY2hpbGQpIHtcbiAgICogICAvLyBvbmx5IGVudW1lcmF0ZXMgcHJvcCBpZiAocHJvcCBpbiBjaGlsZCkgcmV0dXJucyB0cnVlXG4gICAqIH1cbiAgICogPC9jb2RlPlxuICAgKi9cbiAgZ2V0UHJvcGVydHlEZXNjcmlwdG9yOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIGhhbmRsZXIgPSB0aGlzO1xuXG4gICAgaWYgKCFoYW5kbGVyLmhhcyhuYW1lKSkgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgIHJldHVybiB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gaGFuZGxlci5nZXQodGhpcywgbmFtZSk7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgaWYgKGhhbmRsZXIuc2V0KHRoaXMsIG5hbWUsIHZhbCkpIHtcbiAgICAgICAgICByZXR1cm4gdmFsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJmYWlsZWQgYXNzaWdubWVudCB0byBcIituYW1lKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9O1xuICB9LFxuXG4gIC8qKlxuICAgKiBJZiBuYW1lIGRlbm90ZXMgYSBmaXhlZCBwcm9wZXJ0eSwgY2hlY2sgZm9yIGluY29tcGF0aWJsZSBjaGFuZ2VzLlxuICAgKiBJZiB0aGUgcHJveHkgaXMgbm9uLWV4dGVuc2libGUsIGNoZWNrIHRoYXQgbmV3IHByb3BlcnRpZXMgYXJlIHJlamVjdGVkLlxuICAgKi9cbiAgZGVmaW5lUHJvcGVydHk6IGZ1bmN0aW9uKG5hbWUsIGRlc2MpIHtcbiAgICAvLyBUT0RPKHR2Y3V0c2VtKTogdGhlIGN1cnJlbnQgdHJhY2Vtb25rZXkgaW1wbGVtZW50YXRpb24gb2YgcHJveGllc1xuICAgIC8vIGF1dG8tY29tcGxldGVzICdkZXNjJywgd2hpY2ggaXMgbm90IGNvcnJlY3QuICdkZXNjJyBzaG91bGQgYmVcbiAgICAvLyBub3JtYWxpemVkLCBidXQgbm90IGNvbXBsZXRlZC4gQ29uc2lkZXI6XG4gICAgLy8gT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3h5LCAnZm9vJywge2VudW1lcmFibGU6ZmFsc2V9KVxuICAgIC8vIFRoaXMgdHJhcCB3aWxsIHJlY2VpdmUgZGVzYyA9XG4gICAgLy8gIHt2YWx1ZTp1bmRlZmluZWQsd3JpdGFibGU6ZmFsc2UsZW51bWVyYWJsZTpmYWxzZSxjb25maWd1cmFibGU6ZmFsc2V9XG4gICAgLy8gVGhpcyB3aWxsIGFsc28gc2V0IGFsbCBvdGhlciBhdHRyaWJ1dGVzIHRvIHRoZWlyIGRlZmF1bHQgdmFsdWUsXG4gICAgLy8gd2hpY2ggaXMgdW5leHBlY3RlZCBhbmQgZGlmZmVyZW50IGZyb20gW1tEZWZpbmVPd25Qcm9wZXJ0eV1dLlxuICAgIC8vIEJ1ZyBmaWxlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9NjAxMzI5XG5cbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcImRlZmluZVByb3BlcnR5XCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIFJlZmxlY3QuZGVmaW5lUHJvcGVydHkodGhpcy50YXJnZXQsIG5hbWUsIGRlc2MpO1xuICAgIH1cblxuICAgIG5hbWUgPSBTdHJpbmcobmFtZSk7XG4gICAgdmFyIGRlc2NPYmogPSBub3JtYWxpemVQcm9wZXJ0eURlc2NyaXB0b3IoZGVzYyk7XG4gICAgdmFyIHN1Y2Nlc3MgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCwgbmFtZSwgZGVzY09iaik7XG4gICAgc3VjY2VzcyA9ICEhc3VjY2VzczsgLy8gY29lcmNlIHRvIEJvb2xlYW5cblxuICAgIGlmIChzdWNjZXNzID09PSB0cnVlKSB7XG5cbiAgICAgIHZhciB0YXJnZXREZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0aGlzLnRhcmdldCwgbmFtZSk7XG4gICAgICB2YXIgZXh0ZW5zaWJsZSA9IE9iamVjdC5pc0V4dGVuc2libGUodGhpcy50YXJnZXQpO1xuXG4gICAgICAvLyBOb3RlOiB3ZSBjb3VsZCBjb2xsYXBzZSB0aGUgZm9sbG93aW5nIHR3byBpZi10ZXN0cyBpbnRvIGEgc2luZ2xlXG4gICAgICAvLyB0ZXN0LiBTZXBhcmF0aW5nIG91dCB0aGUgY2FzZXMgdG8gaW1wcm92ZSBlcnJvciByZXBvcnRpbmcuXG5cbiAgICAgIGlmICghZXh0ZW5zaWJsZSkge1xuICAgICAgICBpZiAodGFyZ2V0RGVzYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCBzdWNjZXNzZnVsbHkgYWRkIGEgbmV3IHByb3BlcnR5ICdcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgKyBcIicgdG8gYSBub24tZXh0ZW5zaWJsZSBvYmplY3RcIik7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHRhcmdldERlc2MgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoIWlzQ29tcGF0aWJsZURlc2NyaXB0b3IoZXh0ZW5zaWJsZSwgdGFyZ2V0RGVzYywgZGVzYykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IGRlZmluZSBpbmNvbXBhdGlibGUgcHJvcGVydHkgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImRlc2NyaXB0b3IgZm9yIHByb3BlcnR5ICdcIituYW1lK1wiJ1wiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNEYXRhRGVzY3JpcHRvcih0YXJnZXREZXNjKSAmJlxuICAgICAgICAgICAgdGFyZ2V0RGVzYy5jb25maWd1cmFibGUgPT09IGZhbHNlICYmXG4gICAgICAgICAgICB0YXJnZXREZXNjLndyaXRhYmxlID09PSB0cnVlKSB7XG4gICAgICAgICAgICBpZiAoZGVzYy5jb25maWd1cmFibGUgPT09IGZhbHNlICYmIGRlc2Mud3JpdGFibGUgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgIC8vIGlmIHRoZSBwcm9wZXJ0eSBpcyBub24tY29uZmlndXJhYmxlLCB3cml0YWJsZSBvbiB0aGUgdGFyZ2V0XG4gICAgICAgICAgICAgIC8vIGJ1dCB3YXMgc3VjY2Vzc2Z1bGx5IHJlcG9ydGVkIHRvIGJlIHVwZGF0ZWQgdG9cbiAgICAgICAgICAgICAgLy8gbm9uLWNvbmZpZ3VyYWJsZSwgbm9uLXdyaXRhYmxlLCBpdCBjYW4gbGF0ZXIgYmUgcmVwb3J0ZWRcbiAgICAgICAgICAgICAgLy8gYWdhaW4gYXMgbm9uLWNvbmZpZ3VyYWJsZSwgd3JpdGFibGUsIHdoaWNoIHZpb2xhdGVzXG4gICAgICAgICAgICAgIC8vIHRoZSBpbnZhcmlhbnQgdGhhdCBub24tY29uZmlndXJhYmxlLCBub24td3JpdGFibGUgcHJvcGVydGllc1xuICAgICAgICAgICAgICAvLyBjYW5ub3QgY2hhbmdlIHN0YXRlXG4gICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICAgICAgXCJjYW5ub3Qgc3VjY2Vzc2Z1bGx5IGRlZmluZSBub24tY29uZmlndXJhYmxlLCB3cml0YWJsZSBcIiArXG4gICAgICAgICAgICAgICAgXCIgcHJvcGVydHkgJ1wiICsgbmFtZSArIFwiJyBhcyBub24tY29uZmlndXJhYmxlLCBub24td3JpdGFibGVcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZGVzYy5jb25maWd1cmFibGUgPT09IGZhbHNlICYmICFpc1NlYWxlZERlc2ModGFyZ2V0RGVzYykpIHtcbiAgICAgICAgLy8gaWYgdGhlIHByb3BlcnR5IGlzIGNvbmZpZ3VyYWJsZSBvciBub24tZXhpc3RlbnQgb24gdGhlIHRhcmdldCxcbiAgICAgICAgLy8gYnV0IGlzIHN1Y2Nlc3NmdWxseSBiZWluZyByZWRlZmluZWQgYXMgYSBub24tY29uZmlndXJhYmxlIHByb3BlcnR5LFxuICAgICAgICAvLyBpdCBtYXkgbGF0ZXIgYmUgcmVwb3J0ZWQgYXMgY29uZmlndXJhYmxlIG9yIG5vbi1leGlzdGVudCwgd2hpY2ggdmlvbGF0ZXNcbiAgICAgICAgLy8gdGhlIGludmFyaWFudCB0aGF0IGlmIHRoZSBwcm9wZXJ0eSBtaWdodCBjaGFuZ2Ugb3IgZGlzYXBwZWFyLCB0aGVcbiAgICAgICAgLy8gY29uZmlndXJhYmxlIGF0dHJpYnV0ZSBtdXN0IGJlIHRydWUuXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgXCJjYW5ub3Qgc3VjY2Vzc2Z1bGx5IGRlZmluZSBhIG5vbi1jb25maWd1cmFibGUgXCIgK1xuICAgICAgICAgIFwiZGVzY3JpcHRvciBmb3IgY29uZmlndXJhYmxlIG9yIG5vbi1leGlzdGVudCBwcm9wZXJ0eSAnXCIgK1xuICAgICAgICAgIG5hbWUgKyBcIidcIik7XG4gICAgICB9XG5cbiAgICB9XG5cbiAgICByZXR1cm4gc3VjY2VzcztcbiAgfSxcblxuICAvKipcbiAgICogT24gc3VjY2VzcywgY2hlY2sgd2hldGhlciB0aGUgdGFyZ2V0IG9iamVjdCBpcyBpbmRlZWQgbm9uLWV4dGVuc2libGUuXG4gICAqL1xuICBwcmV2ZW50RXh0ZW5zaW9uczogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJwcmV2ZW50RXh0ZW5zaW9uc1wiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiBSZWZsZWN0LnByZXZlbnRFeHRlbnNpb25zKHRoaXMudGFyZ2V0KTtcbiAgICB9XG5cbiAgICB2YXIgc3VjY2VzcyA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0KTtcbiAgICBzdWNjZXNzID0gISFzdWNjZXNzOyAvLyBjb2VyY2UgdG8gQm9vbGVhblxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICBpZiAoT2JqZWN0X2lzRXh0ZW5zaWJsZSh0aGlzLnRhcmdldCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbid0IHJlcG9ydCBleHRlbnNpYmxlIG9iamVjdCBhcyBub24tZXh0ZW5zaWJsZTogXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50YXJnZXQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3VjY2VzcztcbiAgfSxcblxuICAvKipcbiAgICogSWYgbmFtZSBkZW5vdGVzIGEgc2VhbGVkIHByb3BlcnR5LCBjaGVjayB3aGV0aGVyIGhhbmRsZXIgcmVqZWN0cy5cbiAgICovXG4gIGRlbGV0ZTogZnVuY3Rpb24obmFtZSkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwiZGVsZXRlUHJvcGVydHlcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gUmVmbGVjdC5kZWxldGVQcm9wZXJ0eSh0aGlzLnRhcmdldCwgbmFtZSk7XG4gICAgfVxuXG4gICAgbmFtZSA9IFN0cmluZyhuYW1lKTtcbiAgICB2YXIgcmVzID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQsIG5hbWUpO1xuICAgIHJlcyA9ICEhcmVzOyAvLyBjb2VyY2UgdG8gQm9vbGVhblxuXG4gICAgdmFyIHRhcmdldERlc2M7XG4gICAgaWYgKHJlcyA9PT0gdHJ1ZSkge1xuICAgICAgdGFyZ2V0RGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGhpcy50YXJnZXQsIG5hbWUpO1xuICAgICAgaWYgKHRhcmdldERlc2MgIT09IHVuZGVmaW5lZCAmJiB0YXJnZXREZXNjLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInByb3BlcnR5ICdcIiArIG5hbWUgKyBcIicgaXMgbm9uLWNvbmZpZ3VyYWJsZSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImFuZCBjYW4ndCBiZSBkZWxldGVkXCIpO1xuICAgICAgfVxuICAgICAgaWYgKHRhcmdldERlc2MgIT09IHVuZGVmaW5lZCAmJiAhT2JqZWN0X2lzRXh0ZW5zaWJsZSh0aGlzLnRhcmdldCkpIHtcbiAgICAgICAgLy8gaWYgdGhlIHByb3BlcnR5IHN0aWxsIGV4aXN0cyBvbiBhIG5vbi1leHRlbnNpYmxlIHRhcmdldCBidXRcbiAgICAgICAgLy8gaXMgcmVwb3J0ZWQgYXMgc3VjY2Vzc2Z1bGx5IGRlbGV0ZWQsIGl0IG1heSBsYXRlciBiZSByZXBvcnRlZFxuICAgICAgICAvLyBhcyBwcmVzZW50LCB3aGljaCB2aW9sYXRlcyB0aGUgaW52YXJpYW50IHRoYXQgYW4gb3duIHByb3BlcnR5LFxuICAgICAgICAvLyBkZWxldGVkIGZyb20gYSBub24tZXh0ZW5zaWJsZSBvYmplY3QgY2Fubm90IHJlYXBwZWFyLlxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIFwiY2Fubm90IHN1Y2Nlc3NmdWxseSBkZWxldGUgZXhpc3RpbmcgcHJvcGVydHkgJ1wiICsgbmFtZSArXG4gICAgICAgICAgXCInIG9uIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0XCIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFRoZSBnZXRPd25Qcm9wZXJ0eU5hbWVzIHRyYXAgd2FzIHJlcGxhY2VkIGJ5IHRoZSBvd25LZXlzIHRyYXAsXG4gICAqIHdoaWNoIG5vdyBhbHNvIHJldHVybnMgYW4gYXJyYXkgKG9mIHN0cmluZ3Mgb3Igc3ltYm9scykgYW5kXG4gICAqIHdoaWNoIHBlcmZvcm1zIHRoZSBzYW1lIHJpZ29yb3VzIGludmFyaWFudCBjaGVja3MgYXMgZ2V0T3duUHJvcGVydHlOYW1lc1xuICAgKlxuICAgKiBTZWUgaXNzdWUgIzQ4IG9uIGhvdyB0aGlzIHRyYXAgY2FuIHN0aWxsIGdldCBpbnZva2VkIGJ5IGV4dGVybmFsIGxpYnNcbiAgICogdGhhdCBkb24ndCB1c2UgdGhlIHBhdGNoZWQgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgZnVuY3Rpb24uXG4gICAqL1xuICBnZXRPd25Qcm9wZXJ0eU5hbWVzOiBmdW5jdGlvbigpIHtcbiAgICAvLyBOb3RlOiByZW1vdmVkIGRlcHJlY2F0aW9uIHdhcm5pbmcgdG8gYXZvaWQgZGVwZW5kZW5jeSBvbiAnY29uc29sZSdcbiAgICAvLyAoYW5kIG9uIG5vZGUsIHNob3VsZCBhbnl3YXkgdXNlIHV0aWwuZGVwcmVjYXRlKS4gRGVwcmVjYXRpb24gd2FybmluZ3NcbiAgICAvLyBjYW4gYWxzbyBiZSBhbm5veWluZyB3aGVuIHRoZXkgYXJlIG91dHNpZGUgb2YgdGhlIHVzZXIncyBjb250cm9sLCBlLmcuXG4gICAgLy8gd2hlbiBhbiBleHRlcm5hbCBsaWJyYXJ5IGNhbGxzIHVucGF0Y2hlZCBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcy5cbiAgICAvLyBTaW5jZSB0aGVyZSBpcyBhIGNsZWFuIGZhbGxiYWNrIHRvIGBvd25LZXlzYCwgdGhlIGZhY3QgdGhhdCB0aGVcbiAgICAvLyBkZXByZWNhdGVkIG1ldGhvZCBpcyBzdGlsbCBjYWxsZWQgaXMgbW9zdGx5IGhhcm1sZXNzIGFueXdheS5cbiAgICAvLyBTZWUgYWxzbyBpc3N1ZXMgIzY1IGFuZCAjNjYuXG4gICAgLy8gY29uc29sZS53YXJuKFwiZ2V0T3duUHJvcGVydHlOYW1lcyB0cmFwIGlzIGRlcHJlY2F0ZWQuIFVzZSBvd25LZXlzIGluc3RlYWRcIik7XG4gICAgcmV0dXJuIHRoaXMub3duS2V5cygpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBDaGVja3Mgd2hldGhlciB0aGUgdHJhcCByZXN1bHQgZG9lcyBub3QgY29udGFpbiBhbnkgbmV3IHByb3BlcnRpZXNcbiAgICogaWYgdGhlIHByb3h5IGlzIG5vbi1leHRlbnNpYmxlLlxuICAgKlxuICAgKiBBbnkgb3duIG5vbi1jb25maWd1cmFibGUgcHJvcGVydGllcyBvZiB0aGUgdGFyZ2V0IHRoYXQgYXJlIG5vdCBpbmNsdWRlZFxuICAgKiBpbiB0aGUgdHJhcCByZXN1bHQgZ2l2ZSByaXNlIHRvIGEgVHlwZUVycm9yLiBBcyBzdWNoLCB3ZSBjaGVjayB3aGV0aGVyIHRoZVxuICAgKiByZXR1cm5lZCByZXN1bHQgY29udGFpbnMgYXQgbGVhc3QgYWxsIHNlYWxlZCBwcm9wZXJ0aWVzIG9mIHRoZSB0YXJnZXRcbiAgICogb2JqZWN0LlxuICAgKlxuICAgKiBBZGRpdGlvbmFsbHksIHRoZSB0cmFwIHJlc3VsdCBpcyBub3JtYWxpemVkLlxuICAgKiBJbnN0ZWFkIG9mIHJldHVybmluZyB0aGUgdHJhcCByZXN1bHQgZGlyZWN0bHk6XG4gICAqICAtIGNyZWF0ZSBhbmQgcmV0dXJuIGEgZnJlc2ggQXJyYXksXG4gICAqICAtIG9mIHdoaWNoIGVhY2ggZWxlbWVudCBpcyBjb2VyY2VkIHRvIGEgU3RyaW5nXG4gICAqXG4gICAqIFRoaXMgdHJhcCBpcyBjYWxsZWQgYS5vLiBieSBSZWZsZWN0Lm93bktleXMsIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzXG4gICAqIGFuZCBPYmplY3Qua2V5cyAodGhlIGxhdHRlciBmaWx0ZXJzIG91dCBvbmx5IHRoZSBlbnVtZXJhYmxlIG93biBwcm9wZXJ0aWVzKS5cbiAgICovXG4gIG93bktleXM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwib3duS2V5c1wiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiBSZWZsZWN0Lm93bktleXModGhpcy50YXJnZXQpO1xuICAgIH1cblxuICAgIHZhciB0cmFwUmVzdWx0ID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQpO1xuXG4gICAgLy8gcHJvcE5hbWVzIGlzIHVzZWQgYXMgYSBzZXQgb2Ygc3RyaW5nc1xuICAgIHZhciBwcm9wTmFtZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIHZhciBudW1Qcm9wcyA9ICt0cmFwUmVzdWx0Lmxlbmd0aDtcbiAgICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KG51bVByb3BzKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbnVtUHJvcHM7IGkrKykge1xuICAgICAgdmFyIHMgPSBTdHJpbmcodHJhcFJlc3VsdFtpXSk7XG4gICAgICBpZiAoIU9iamVjdC5pc0V4dGVuc2libGUodGhpcy50YXJnZXQpICYmICFpc0ZpeGVkKHMsIHRoaXMudGFyZ2V0KSkge1xuICAgICAgICAvLyBub24tZXh0ZW5zaWJsZSBwcm94aWVzIGRvbid0IHRvbGVyYXRlIG5ldyBvd24gcHJvcGVydHkgbmFtZXNcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm93bktleXMgdHJhcCBjYW5ub3QgbGlzdCBhIG5ldyBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInByb3BlcnR5ICdcIitzK1wiJyBvbiBhIG5vbi1leHRlbnNpYmxlIG9iamVjdFwiKTtcbiAgICAgIH1cblxuICAgICAgcHJvcE5hbWVzW3NdID0gdHJ1ZTtcbiAgICAgIHJlc3VsdFtpXSA9IHM7XG4gICAgfVxuXG4gICAgdmFyIG93blByb3BzID0gT2JqZWN0X2dldE93blByb3BlcnR5TmFtZXModGhpcy50YXJnZXQpO1xuICAgIHZhciB0YXJnZXQgPSB0aGlzLnRhcmdldDtcbiAgICBvd25Qcm9wcy5mb3JFYWNoKGZ1bmN0aW9uIChvd25Qcm9wKSB7XG4gICAgICBpZiAoIXByb3BOYW1lc1tvd25Qcm9wXSkge1xuICAgICAgICBpZiAoaXNTZWFsZWQob3duUHJvcCwgdGFyZ2V0KSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJvd25LZXlzIHRyYXAgZmFpbGVkIHRvIGluY2x1ZGUgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm5vbi1jb25maWd1cmFibGUgcHJvcGVydHkgJ1wiK293blByb3ArXCInXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghT2JqZWN0LmlzRXh0ZW5zaWJsZSh0YXJnZXQpICYmXG4gICAgICAgICAgICBpc0ZpeGVkKG93blByb3AsIHRhcmdldCkpIHtcbiAgICAgICAgICAgIC8vIGlmIGhhbmRsZXIgaXMgYWxsb3dlZCB0byByZXBvcnQgb3duUHJvcCBhcyBub24tZXhpc3RlbnQsXG4gICAgICAgICAgICAvLyB3ZSBjYW5ub3QgZ3VhcmFudGVlIHRoYXQgaXQgd2lsbCBuZXZlciBsYXRlciByZXBvcnQgaXQgYXNcbiAgICAgICAgICAgIC8vIGV4aXN0ZW50LiBPbmNlIGEgcHJvcGVydHkgaGFzIGJlZW4gcmVwb3J0ZWQgYXMgbm9uLWV4aXN0ZW50XG4gICAgICAgICAgICAvLyBvbiBhIG5vbi1leHRlbnNpYmxlIG9iamVjdCwgaXQgc2hvdWxkIGZvcmV2ZXIgYmUgcmVwb3J0ZWQgYXNcbiAgICAgICAgICAgIC8vIG5vbi1leGlzdGVudFxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm93bktleXMgdHJhcCBjYW5ub3QgcmVwb3J0IGV4aXN0aW5nIG93biBwcm9wZXJ0eSAnXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG93blByb3ArXCInIGFzIG5vbi1leGlzdGVudCBvbiBhIG5vbi1leHRlbnNpYmxlIG9iamVjdFwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcblxuICAvKipcbiAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIHRyYXAgcmVzdWx0IGlzIGNvbnNpc3RlbnQgd2l0aCB0aGUgc3RhdGUgb2YgdGhlXG4gICAqIHdyYXBwZWQgdGFyZ2V0LlxuICAgKi9cbiAgaXNFeHRlbnNpYmxlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcImlzRXh0ZW5zaWJsZVwiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiBSZWZsZWN0LmlzRXh0ZW5zaWJsZSh0aGlzLnRhcmdldCk7XG4gICAgfVxuXG4gICAgdmFyIHJlc3VsdCA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0KTtcbiAgICByZXN1bHQgPSAhIXJlc3VsdDsgLy8gY29lcmNlIHRvIEJvb2xlYW5cbiAgICB2YXIgc3RhdGUgPSBPYmplY3RfaXNFeHRlbnNpYmxlKHRoaXMudGFyZ2V0KTtcbiAgICBpZiAocmVzdWx0ICE9PSBzdGF0ZSkge1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHJlcG9ydCBub24tZXh0ZW5zaWJsZSBvYmplY3QgYXMgZXh0ZW5zaWJsZTogXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudGFyZ2V0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgcmVwb3J0IGV4dGVuc2libGUgb2JqZWN0IGFzIG5vbi1leHRlbnNpYmxlOiBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50YXJnZXQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3RhdGU7XG4gIH0sXG5cbiAgLyoqXG4gICAqIENoZWNrIHdoZXRoZXIgdGhlIHRyYXAgcmVzdWx0IGNvcnJlc3BvbmRzIHRvIHRoZSB0YXJnZXQncyBbW1Byb3RvdHlwZV1dXG4gICAqL1xuICBnZXRQcm90b3R5cGVPZjogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJnZXRQcm90b3R5cGVPZlwiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiBSZWZsZWN0LmdldFByb3RvdHlwZU9mKHRoaXMudGFyZ2V0KTtcbiAgICB9XG5cbiAgICB2YXIgYWxsZWdlZFByb3RvID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQpO1xuXG4gICAgaWYgKCFPYmplY3RfaXNFeHRlbnNpYmxlKHRoaXMudGFyZ2V0KSkge1xuICAgICAgdmFyIGFjdHVhbFByb3RvID0gT2JqZWN0X2dldFByb3RvdHlwZU9mKHRoaXMudGFyZ2V0KTtcbiAgICAgIGlmICghc2FtZVZhbHVlKGFsbGVnZWRQcm90bywgYWN0dWFsUHJvdG8pKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJwcm90b3R5cGUgdmFsdWUgZG9lcyBub3QgbWF0Y2g6IFwiICsgdGhpcy50YXJnZXQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBhbGxlZ2VkUHJvdG87XG4gIH0sXG5cbiAgLyoqXG4gICAqIElmIHRhcmdldCBpcyBub24tZXh0ZW5zaWJsZSBhbmQgc2V0UHJvdG90eXBlT2YgdHJhcCByZXR1cm5zIHRydWUsXG4gICAqIGNoZWNrIHdoZXRoZXIgdGhlIHRyYXAgcmVzdWx0IGNvcnJlc3BvbmRzIHRvIHRoZSB0YXJnZXQncyBbW1Byb3RvdHlwZV1dXG4gICAqL1xuICBzZXRQcm90b3R5cGVPZjogZnVuY3Rpb24obmV3UHJvdG8pIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcInNldFByb3RvdHlwZU9mXCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIFJlZmxlY3Quc2V0UHJvdG90eXBlT2YodGhpcy50YXJnZXQsIG5ld1Byb3RvKTtcbiAgICB9XG5cbiAgICB2YXIgc3VjY2VzcyA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0LCBuZXdQcm90byk7XG5cbiAgICBzdWNjZXNzID0gISFzdWNjZXNzO1xuICAgIGlmIChzdWNjZXNzICYmICFPYmplY3RfaXNFeHRlbnNpYmxlKHRoaXMudGFyZ2V0KSkge1xuICAgICAgdmFyIGFjdHVhbFByb3RvID0gT2JqZWN0X2dldFByb3RvdHlwZU9mKHRoaXMudGFyZ2V0KTtcbiAgICAgIGlmICghc2FtZVZhbHVlKG5ld1Byb3RvLCBhY3R1YWxQcm90bykpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInByb3RvdHlwZSB2YWx1ZSBkb2VzIG5vdCBtYXRjaDogXCIgKyB0aGlzLnRhcmdldCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1Y2Nlc3M7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEluIHRoZSBkaXJlY3QgcHJveGllcyBkZXNpZ24gd2l0aCByZWZhY3RvcmVkIHByb3RvdHlwZSBjbGltYmluZyxcbiAgICogdGhpcyB0cmFwIGlzIGRlcHJlY2F0ZWQuIEZvciBwcm94aWVzLWFzLXByb3RvdHlwZXMsIGZvci1pbiB3aWxsXG4gICAqIGNhbGwgdGhlIGVudW1lcmF0ZSgpIHRyYXAuIElmIHRoYXQgdHJhcCBpcyBub3QgZGVmaW5lZCwgdGhlXG4gICAqIG9wZXJhdGlvbiBpcyBmb3J3YXJkZWQgdG8gdGhlIHRhcmdldCwgbm8gbW9yZSBmYWxsYmFjayBvbiB0aGlzXG4gICAqIGZ1bmRhbWVudGFsIHRyYXAuXG4gICAqL1xuICBnZXRQcm9wZXJ0eU5hbWVzOiBmdW5jdGlvbigpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZ2V0UHJvcGVydHlOYW1lcyB0cmFwIGlzIGRlcHJlY2F0ZWRcIik7XG4gIH0sXG5cbiAgLy8gPT09IGRlcml2ZWQgdHJhcHMgPT09XG5cbiAgLyoqXG4gICAqIElmIG5hbWUgZGVub3RlcyBhIGZpeGVkIHByb3BlcnR5LCBjaGVjayB3aGV0aGVyIHRoZSB0cmFwIHJldHVybnMgdHJ1ZS5cbiAgICovXG4gIGhhczogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwiaGFzXCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIFJlZmxlY3QuaGFzKHRoaXMudGFyZ2V0LCBuYW1lKTtcbiAgICB9XG5cbiAgICBuYW1lID0gU3RyaW5nKG5hbWUpO1xuICAgIHZhciByZXMgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCwgbmFtZSk7XG4gICAgcmVzID0gISFyZXM7IC8vIGNvZXJjZSB0byBCb29sZWFuXG5cbiAgICBpZiAocmVzID09PSBmYWxzZSkge1xuICAgICAgaWYgKGlzU2VhbGVkKG5hbWUsIHRoaXMudGFyZ2V0KSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHJlcG9ydCBleGlzdGluZyBub24tY29uZmlndXJhYmxlIG93biBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInByb3BlcnR5ICdcIisgbmFtZSArIFwiJyBhcyBhIG5vbi1leGlzdGVudCBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInByb3BlcnR5XCIpO1xuICAgICAgfVxuICAgICAgaWYgKCFPYmplY3QuaXNFeHRlbnNpYmxlKHRoaXMudGFyZ2V0KSAmJlxuICAgICAgICAgIGlzRml4ZWQobmFtZSwgdGhpcy50YXJnZXQpKSB7XG4gICAgICAgICAgLy8gaWYgaGFuZGxlciBpcyBhbGxvd2VkIHRvIHJldHVybiBmYWxzZSwgd2UgY2Fubm90IGd1YXJhbnRlZVxuICAgICAgICAgIC8vIHRoYXQgaXQgd2lsbCBub3QgcmV0dXJuIHRydWUgZm9yIHRoaXMgcHJvcGVydHkgbGF0ZXIuXG4gICAgICAgICAgLy8gT25jZSBhIHByb3BlcnR5IGhhcyBiZWVuIHJlcG9ydGVkIGFzIG5vbi1leGlzdGVudCBvbiBhIG5vbi1leHRlbnNpYmxlXG4gICAgICAgICAgLy8gb2JqZWN0LCBpdCBzaG91bGQgZm9yZXZlciBiZSByZXBvcnRlZCBhcyBub24tZXhpc3RlbnRcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHJlcG9ydCBleGlzdGluZyBvd24gcHJvcGVydHkgJ1wiK25hbWUrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIicgYXMgbm9uLWV4aXN0ZW50IG9uIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0XCIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGlmIHJlcyA9PT0gdHJ1ZSwgd2UgZG9uJ3QgbmVlZCB0byBjaGVjayBmb3IgZXh0ZW5zaWJpbGl0eVxuICAgIC8vIGV2ZW4gZm9yIGEgbm9uLWV4dGVuc2libGUgcHJveHkgdGhhdCBoYXMgbm8gb3duIG5hbWUgcHJvcGVydHksXG4gICAgLy8gdGhlIHByb3BlcnR5IG1heSBoYXZlIGJlZW4gaW5oZXJpdGVkXG5cbiAgICByZXR1cm4gcmVzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBJZiBuYW1lIGRlbm90ZXMgYSBmaXhlZCBub24tY29uZmlndXJhYmxlLCBub24td3JpdGFibGUgZGF0YSBwcm9wZXJ0eSxcbiAgICogY2hlY2sgaXRzIHJldHVybiB2YWx1ZSBhZ2FpbnN0IHRoZSBwcmV2aW91c2x5IGFzc2VydGVkIHZhbHVlIG9mIHRoZVxuICAgKiBmaXhlZCBwcm9wZXJ0eS5cbiAgICovXG4gIGdldDogZnVuY3Rpb24ocmVjZWl2ZXIsIG5hbWUpIHtcblxuICAgIC8vIGV4cGVyaW1lbnRhbCBzdXBwb3J0IGZvciBpbnZva2UoKSB0cmFwIG9uIHBsYXRmb3JtcyB0aGF0XG4gICAgLy8gc3VwcG9ydCBfX25vU3VjaE1ldGhvZF9fXG4gICAgLypcbiAgICBpZiAobmFtZSA9PT0gJ19fbm9TdWNoTWV0aG9kX18nKSB7XG4gICAgICB2YXIgaGFuZGxlciA9IHRoaXM7XG4gICAgICByZXR1cm4gZnVuY3Rpb24obmFtZSwgYXJncykge1xuICAgICAgICByZXR1cm4gaGFuZGxlci5pbnZva2UocmVjZWl2ZXIsIG5hbWUsIGFyZ3MpO1xuICAgICAgfVxuICAgIH1cbiAgICAqL1xuXG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJnZXRcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gUmVmbGVjdC5nZXQodGhpcy50YXJnZXQsIG5hbWUsIHJlY2VpdmVyKTtcbiAgICB9XG5cbiAgICBuYW1lID0gU3RyaW5nKG5hbWUpO1xuICAgIHZhciByZXMgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCwgbmFtZSwgcmVjZWl2ZXIpO1xuXG4gICAgdmFyIGZpeGVkRGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGhpcy50YXJnZXQsIG5hbWUpO1xuICAgIC8vIGNoZWNrIGNvbnNpc3RlbmN5IG9mIHRoZSByZXR1cm5lZCB2YWx1ZVxuICAgIGlmIChmaXhlZERlc2MgIT09IHVuZGVmaW5lZCkgeyAvLyBnZXR0aW5nIGFuIGV4aXN0aW5nIHByb3BlcnR5XG4gICAgICBpZiAoaXNEYXRhRGVzY3JpcHRvcihmaXhlZERlc2MpICYmXG4gICAgICAgICAgZml4ZWREZXNjLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UgJiZcbiAgICAgICAgICBmaXhlZERlc2Mud3JpdGFibGUgPT09IGZhbHNlKSB7IC8vIG93biBmcm96ZW4gZGF0YSBwcm9wZXJ0eVxuICAgICAgICBpZiAoIXNhbWVWYWx1ZShyZXMsIGZpeGVkRGVzYy52YWx1ZSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHJlcG9ydCBpbmNvbnNpc3RlbnQgdmFsdWUgZm9yIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJub24td3JpdGFibGUsIG5vbi1jb25maWd1cmFibGUgcHJvcGVydHkgJ1wiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZStcIidcIik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7IC8vIGl0J3MgYW4gYWNjZXNzb3IgcHJvcGVydHlcbiAgICAgICAgaWYgKGlzQWNjZXNzb3JEZXNjcmlwdG9yKGZpeGVkRGVzYykgJiZcbiAgICAgICAgICAgIGZpeGVkRGVzYy5jb25maWd1cmFibGUgPT09IGZhbHNlICYmXG4gICAgICAgICAgICBmaXhlZERlc2MuZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAocmVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJtdXN0IHJlcG9ydCB1bmRlZmluZWQgZm9yIG5vbi1jb25maWd1cmFibGUgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiYWNjZXNzb3IgcHJvcGVydHkgJ1wiK25hbWUrXCInIHdpdGhvdXQgZ2V0dGVyXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIElmIG5hbWUgZGVub3RlcyBhIGZpeGVkIG5vbi1jb25maWd1cmFibGUsIG5vbi13cml0YWJsZSBkYXRhIHByb3BlcnR5LFxuICAgKiBjaGVjayB0aGF0IHRoZSB0cmFwIHJlamVjdHMgdGhlIGFzc2lnbm1lbnQuXG4gICAqL1xuICBzZXQ6IGZ1bmN0aW9uKHJlY2VpdmVyLCBuYW1lLCB2YWwpIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcInNldFwiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiBSZWZsZWN0LnNldCh0aGlzLnRhcmdldCwgbmFtZSwgdmFsLCByZWNlaXZlcik7XG4gICAgfVxuXG4gICAgbmFtZSA9IFN0cmluZyhuYW1lKTtcbiAgICB2YXIgcmVzID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQsIG5hbWUsIHZhbCwgcmVjZWl2ZXIpO1xuICAgIHJlcyA9ICEhcmVzOyAvLyBjb2VyY2UgdG8gQm9vbGVhblxuXG4gICAgLy8gaWYgc3VjY2VzcyBpcyByZXBvcnRlZCwgY2hlY2sgd2hldGhlciBwcm9wZXJ0eSBpcyB0cnVseSBhc3NpZ25hYmxlXG4gICAgaWYgKHJlcyA9PT0gdHJ1ZSkge1xuICAgICAgdmFyIGZpeGVkRGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGhpcy50YXJnZXQsIG5hbWUpO1xuICAgICAgaWYgKGZpeGVkRGVzYyAhPT0gdW5kZWZpbmVkKSB7IC8vIHNldHRpbmcgYW4gZXhpc3RpbmcgcHJvcGVydHlcbiAgICAgICAgaWYgKGlzRGF0YURlc2NyaXB0b3IoZml4ZWREZXNjKSAmJlxuICAgICAgICAgICAgZml4ZWREZXNjLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UgJiZcbiAgICAgICAgICAgIGZpeGVkRGVzYy53cml0YWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICBpZiAoIXNhbWVWYWx1ZSh2YWwsIGZpeGVkRGVzYy52YWx1ZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3Qgc3VjY2Vzc2Z1bGx5IGFzc2lnbiB0byBhIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm5vbi13cml0YWJsZSwgbm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0eSAnXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUrXCInXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoaXNBY2Nlc3NvckRlc2NyaXB0b3IoZml4ZWREZXNjKSAmJlxuICAgICAgICAgICAgICBmaXhlZERlc2MuY29uZmlndXJhYmxlID09PSBmYWxzZSAmJiAvLyBub24tY29uZmlndXJhYmxlXG4gICAgICAgICAgICAgIGZpeGVkRGVzYy5zZXQgPT09IHVuZGVmaW5lZCkgeyAgICAgIC8vIGFjY2Vzc29yIHdpdGggdW5kZWZpbmVkIHNldHRlclxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInNldHRpbmcgYSBwcm9wZXJ0eSAnXCIrbmFtZStcIicgdGhhdCBoYXMgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiIG9ubHkgYSBnZXR0ZXJcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbiAgfSxcblxuICAvKipcbiAgICogQW55IG93biBlbnVtZXJhYmxlIG5vbi1jb25maWd1cmFibGUgcHJvcGVydGllcyBvZiB0aGUgdGFyZ2V0IHRoYXQgYXJlIG5vdFxuICAgKiBpbmNsdWRlZCBpbiB0aGUgdHJhcCByZXN1bHQgZ2l2ZSByaXNlIHRvIGEgVHlwZUVycm9yLiBBcyBzdWNoLCB3ZSBjaGVja1xuICAgKiB3aGV0aGVyIHRoZSByZXR1cm5lZCByZXN1bHQgY29udGFpbnMgYXQgbGVhc3QgYWxsIHNlYWxlZCBlbnVtZXJhYmxlIHByb3BlcnRpZXNcbiAgICogb2YgdGhlIHRhcmdldCBvYmplY3QuXG4gICAqXG4gICAqIFRoZSB0cmFwIHNob3VsZCByZXR1cm4gYW4gaXRlcmF0b3IuXG4gICAqXG4gICAqIEhvd2V2ZXIsIGFzIGltcGxlbWVudGF0aW9ucyBvZiBwcmUtZGlyZWN0IHByb3hpZXMgc3RpbGwgZXhwZWN0IGVudW1lcmF0ZVxuICAgKiB0byByZXR1cm4gYW4gYXJyYXkgb2Ygc3RyaW5ncywgd2UgY29udmVydCB0aGUgaXRlcmF0b3IgaW50byBhbiBhcnJheS5cbiAgICovXG4gIGVudW1lcmF0ZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJlbnVtZXJhdGVcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICB2YXIgdHJhcFJlc3VsdCA9IFJlZmxlY3QuZW51bWVyYXRlKHRoaXMudGFyZ2V0KTtcbiAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgIHZhciBueHQgPSB0cmFwUmVzdWx0Lm5leHQoKTtcbiAgICAgIHdoaWxlICghbnh0LmRvbmUpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goU3RyaW5nKG54dC52YWx1ZSkpO1xuICAgICAgICBueHQgPSB0cmFwUmVzdWx0Lm5leHQoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgdmFyIHRyYXBSZXN1bHQgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCk7XG4gICAgXG4gICAgaWYgKHRyYXBSZXN1bHQgPT09IG51bGwgfHxcbiAgICAgICAgdHJhcFJlc3VsdCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgIHRyYXBSZXN1bHQubmV4dCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZW51bWVyYXRlIHRyYXAgc2hvdWxkIHJldHVybiBhbiBpdGVyYXRvciwgZ290OiBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhcFJlc3VsdCk7ICAgIFxuICAgIH1cbiAgICBcbiAgICAvLyBwcm9wTmFtZXMgaXMgdXNlZCBhcyBhIHNldCBvZiBzdHJpbmdzXG4gICAgdmFyIHByb3BOYW1lcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgXG4gICAgLy8gdmFyIG51bVByb3BzID0gK3RyYXBSZXN1bHQubGVuZ3RoO1xuICAgIHZhciByZXN1bHQgPSBbXTsgLy8gbmV3IEFycmF5KG51bVByb3BzKTtcbiAgICBcbiAgICAvLyB0cmFwUmVzdWx0IGlzIHN1cHBvc2VkIHRvIGJlIGFuIGl0ZXJhdG9yXG4gICAgLy8gZHJhaW4gaXRlcmF0b3IgdG8gYXJyYXkgYXMgY3VycmVudCBpbXBsZW1lbnRhdGlvbnMgc3RpbGwgZXhwZWN0XG4gICAgLy8gZW51bWVyYXRlIHRvIHJldHVybiBhbiBhcnJheSBvZiBzdHJpbmdzXG4gICAgdmFyIG54dCA9IHRyYXBSZXN1bHQubmV4dCgpO1xuICAgIFxuICAgIHdoaWxlICghbnh0LmRvbmUpIHtcbiAgICAgIHZhciBzID0gU3RyaW5nKG54dC52YWx1ZSk7XG4gICAgICBpZiAocHJvcE5hbWVzW3NdKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJlbnVtZXJhdGUgdHJhcCBjYW5ub3QgbGlzdCBhIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZHVwbGljYXRlIHByb3BlcnR5ICdcIitzK1wiJ1wiKTtcbiAgICAgIH1cbiAgICAgIHByb3BOYW1lc1tzXSA9IHRydWU7XG4gICAgICByZXN1bHQucHVzaChzKTtcbiAgICAgIG54dCA9IHRyYXBSZXN1bHQubmV4dCgpO1xuICAgIH1cbiAgICBcbiAgICAvKmZvciAodmFyIGkgPSAwOyBpIDwgbnVtUHJvcHM7IGkrKykge1xuICAgICAgdmFyIHMgPSBTdHJpbmcodHJhcFJlc3VsdFtpXSk7XG4gICAgICBpZiAocHJvcE5hbWVzW3NdKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJlbnVtZXJhdGUgdHJhcCBjYW5ub3QgbGlzdCBhIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZHVwbGljYXRlIHByb3BlcnR5ICdcIitzK1wiJ1wiKTtcbiAgICAgIH1cblxuICAgICAgcHJvcE5hbWVzW3NdID0gdHJ1ZTtcbiAgICAgIHJlc3VsdFtpXSA9IHM7XG4gICAgfSAqL1xuXG4gICAgdmFyIG93bkVudW1lcmFibGVQcm9wcyA9IE9iamVjdC5rZXlzKHRoaXMudGFyZ2V0KTtcbiAgICB2YXIgdGFyZ2V0ID0gdGhpcy50YXJnZXQ7XG4gICAgb3duRW51bWVyYWJsZVByb3BzLmZvckVhY2goZnVuY3Rpb24gKG93bkVudW1lcmFibGVQcm9wKSB7XG4gICAgICBpZiAoIXByb3BOYW1lc1tvd25FbnVtZXJhYmxlUHJvcF0pIHtcbiAgICAgICAgaWYgKGlzU2VhbGVkKG93bkVudW1lcmFibGVQcm9wLCB0YXJnZXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImVudW1lcmF0ZSB0cmFwIGZhaWxlZCB0byBpbmNsdWRlIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJub24tY29uZmlndXJhYmxlIGVudW1lcmFibGUgcHJvcGVydHkgJ1wiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3duRW51bWVyYWJsZVByb3ArXCInXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghT2JqZWN0LmlzRXh0ZW5zaWJsZSh0YXJnZXQpICYmXG4gICAgICAgICAgICBpc0ZpeGVkKG93bkVudW1lcmFibGVQcm9wLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAvLyBpZiBoYW5kbGVyIGlzIGFsbG93ZWQgbm90IHRvIHJlcG9ydCBvd25FbnVtZXJhYmxlUHJvcCBhcyBhbiBvd25cbiAgICAgICAgICAgIC8vIHByb3BlcnR5LCB3ZSBjYW5ub3QgZ3VhcmFudGVlIHRoYXQgaXQgd2lsbCBuZXZlciByZXBvcnQgaXQgYXNcbiAgICAgICAgICAgIC8vIGFuIG93biBwcm9wZXJ0eSBsYXRlci4gT25jZSBhIHByb3BlcnR5IGhhcyBiZWVuIHJlcG9ydGVkIGFzXG4gICAgICAgICAgICAvLyBub24tZXhpc3RlbnQgb24gYSBub24tZXh0ZW5zaWJsZSBvYmplY3QsIGl0IHNob3VsZCBmb3JldmVyIGJlXG4gICAgICAgICAgICAvLyByZXBvcnRlZCBhcyBub24tZXhpc3RlbnRcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgcmVwb3J0IGV4aXN0aW5nIG93biBwcm9wZXJ0eSAnXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG93bkVudW1lcmFibGVQcm9wK1wiJyBhcyBub24tZXhpc3RlbnQgb24gYSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJub24tZXh0ZW5zaWJsZSBvYmplY3RcIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFRoZSBpdGVyYXRlIHRyYXAgaXMgZGVwcmVjYXRlZCBieSB0aGUgZW51bWVyYXRlIHRyYXAuXG4gICAqL1xuICBpdGVyYXRlOiBWYWxpZGF0b3IucHJvdG90eXBlLmVudW1lcmF0ZSxcblxuICAvKipcbiAgICogQW55IG93biBub24tY29uZmlndXJhYmxlIHByb3BlcnRpZXMgb2YgdGhlIHRhcmdldCB0aGF0IGFyZSBub3QgaW5jbHVkZWRcbiAgICogaW4gdGhlIHRyYXAgcmVzdWx0IGdpdmUgcmlzZSB0byBhIFR5cGVFcnJvci4gQXMgc3VjaCwgd2UgY2hlY2sgd2hldGhlciB0aGVcbiAgICogcmV0dXJuZWQgcmVzdWx0IGNvbnRhaW5zIGF0IGxlYXN0IGFsbCBzZWFsZWQgcHJvcGVydGllcyBvZiB0aGUgdGFyZ2V0XG4gICAqIG9iamVjdC5cbiAgICpcbiAgICogVGhlIHRyYXAgcmVzdWx0IGlzIG5vcm1hbGl6ZWQuXG4gICAqIFRoZSB0cmFwIHJlc3VsdCBpcyBub3QgcmV0dXJuZWQgZGlyZWN0bHkuIEluc3RlYWQ6XG4gICAqICAtIGNyZWF0ZSBhbmQgcmV0dXJuIGEgZnJlc2ggQXJyYXksXG4gICAqICAtIG9mIHdoaWNoIGVhY2ggZWxlbWVudCBpcyBjb2VyY2VkIHRvIFN0cmluZyxcbiAgICogIC0gd2hpY2ggZG9lcyBub3QgY29udGFpbiBkdXBsaWNhdGVzXG4gICAqXG4gICAqIEZJWE1FOiBrZXlzIHRyYXAgaXMgZGVwcmVjYXRlZFxuICAgKi9cbiAgLypcbiAga2V5czogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJrZXlzXCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIFJlZmxlY3Qua2V5cyh0aGlzLnRhcmdldCk7XG4gICAgfVxuXG4gICAgdmFyIHRyYXBSZXN1bHQgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCk7XG5cbiAgICAvLyBwcm9wTmFtZXMgaXMgdXNlZCBhcyBhIHNldCBvZiBzdHJpbmdzXG4gICAgdmFyIHByb3BOYW1lcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgdmFyIG51bVByb3BzID0gK3RyYXBSZXN1bHQubGVuZ3RoO1xuICAgIHZhciByZXN1bHQgPSBuZXcgQXJyYXkobnVtUHJvcHMpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBudW1Qcm9wczsgaSsrKSB7XG4gICAgIHZhciBzID0gU3RyaW5nKHRyYXBSZXN1bHRbaV0pO1xuICAgICBpZiAocHJvcE5hbWVzW3NdKSB7XG4gICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImtleXMgdHJhcCBjYW5ub3QgbGlzdCBhIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkdXBsaWNhdGUgcHJvcGVydHkgJ1wiK3MrXCInXCIpO1xuICAgICB9XG4gICAgIGlmICghT2JqZWN0LmlzRXh0ZW5zaWJsZSh0aGlzLnRhcmdldCkgJiYgIWlzRml4ZWQocywgdGhpcy50YXJnZXQpKSB7XG4gICAgICAgLy8gbm9uLWV4dGVuc2libGUgcHJveGllcyBkb24ndCB0b2xlcmF0ZSBuZXcgb3duIHByb3BlcnR5IG5hbWVzXG4gICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImtleXMgdHJhcCBjYW5ub3QgbGlzdCBhIG5ldyBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicHJvcGVydHkgJ1wiK3MrXCInIG9uIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0XCIpO1xuICAgICB9XG5cbiAgICAgcHJvcE5hbWVzW3NdID0gdHJ1ZTtcbiAgICAgcmVzdWx0W2ldID0gcztcbiAgICB9XG5cbiAgICB2YXIgb3duRW51bWVyYWJsZVByb3BzID0gT2JqZWN0LmtleXModGhpcy50YXJnZXQpO1xuICAgIHZhciB0YXJnZXQgPSB0aGlzLnRhcmdldDtcbiAgICBvd25FbnVtZXJhYmxlUHJvcHMuZm9yRWFjaChmdW5jdGlvbiAob3duRW51bWVyYWJsZVByb3ApIHtcbiAgICAgIGlmICghcHJvcE5hbWVzW293bkVudW1lcmFibGVQcm9wXSkge1xuICAgICAgICBpZiAoaXNTZWFsZWQob3duRW51bWVyYWJsZVByb3AsIHRhcmdldCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwia2V5cyB0cmFwIGZhaWxlZCB0byBpbmNsdWRlIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJub24tY29uZmlndXJhYmxlIGVudW1lcmFibGUgcHJvcGVydHkgJ1wiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3duRW51bWVyYWJsZVByb3ArXCInXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghT2JqZWN0LmlzRXh0ZW5zaWJsZSh0YXJnZXQpICYmXG4gICAgICAgICAgICBpc0ZpeGVkKG93bkVudW1lcmFibGVQcm9wLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAvLyBpZiBoYW5kbGVyIGlzIGFsbG93ZWQgbm90IHRvIHJlcG9ydCBvd25FbnVtZXJhYmxlUHJvcCBhcyBhbiBvd25cbiAgICAgICAgICAgIC8vIHByb3BlcnR5LCB3ZSBjYW5ub3QgZ3VhcmFudGVlIHRoYXQgaXQgd2lsbCBuZXZlciByZXBvcnQgaXQgYXNcbiAgICAgICAgICAgIC8vIGFuIG93biBwcm9wZXJ0eSBsYXRlci4gT25jZSBhIHByb3BlcnR5IGhhcyBiZWVuIHJlcG9ydGVkIGFzXG4gICAgICAgICAgICAvLyBub24tZXhpc3RlbnQgb24gYSBub24tZXh0ZW5zaWJsZSBvYmplY3QsIGl0IHNob3VsZCBmb3JldmVyIGJlXG4gICAgICAgICAgICAvLyByZXBvcnRlZCBhcyBub24tZXhpc3RlbnRcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgcmVwb3J0IGV4aXN0aW5nIG93biBwcm9wZXJ0eSAnXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG93bkVudW1lcmFibGVQcm9wK1wiJyBhcyBub24tZXhpc3RlbnQgb24gYSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJub24tZXh0ZW5zaWJsZSBvYmplY3RcIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG4gICovXG4gIFxuICAvKipcbiAgICogTmV3IHRyYXAgdGhhdCByZWlmaWVzIFtbQ2FsbF1dLlxuICAgKiBJZiB0aGUgdGFyZ2V0IGlzIGEgZnVuY3Rpb24sIHRoZW4gYSBjYWxsIHRvXG4gICAqICAgcHJveHkoLi4uYXJncylcbiAgICogVHJpZ2dlcnMgdGhpcyB0cmFwXG4gICAqL1xuICBhcHBseTogZnVuY3Rpb24odGFyZ2V0LCB0aGlzQmluZGluZywgYXJncykge1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwiYXBwbHlcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIFJlZmxlY3QuYXBwbHkodGFyZ2V0LCB0aGlzQmluZGluZywgYXJncyk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB0aGlzLnRhcmdldCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICByZXR1cm4gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGFyZ2V0LCB0aGlzQmluZGluZywgYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhcHBseTogXCIrIHRhcmdldCArIFwiIGlzIG5vdCBhIGZ1bmN0aW9uXCIpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogTmV3IHRyYXAgdGhhdCByZWlmaWVzIFtbQ29uc3RydWN0XV0uXG4gICAqIElmIHRoZSB0YXJnZXQgaXMgYSBmdW5jdGlvbiwgdGhlbiBhIGNhbGwgdG9cbiAgICogICBuZXcgcHJveHkoLi4uYXJncylcbiAgICogVHJpZ2dlcnMgdGhpcyB0cmFwXG4gICAqL1xuICBjb25zdHJ1Y3Q6IGZ1bmN0aW9uKHRhcmdldCwgYXJncywgbmV3VGFyZ2V0KSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJjb25zdHJ1Y3RcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIFJlZmxlY3QuY29uc3RydWN0KHRhcmdldCwgYXJncywgbmV3VGFyZ2V0KTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRhcmdldCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwibmV3OiBcIisgdGFyZ2V0ICsgXCIgaXMgbm90IGEgZnVuY3Rpb25cIik7XG4gICAgfVxuXG4gICAgaWYgKG5ld1RhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBuZXdUYXJnZXQgPSB0YXJnZXQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0eXBlb2YgbmV3VGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm5ldzogXCIrIG5ld1RhcmdldCArIFwiIGlzIG5vdCBhIGZ1bmN0aW9uXCIpO1xuICAgICAgfSAgICAgIFxuICAgIH1cbiAgICByZXR1cm4gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGFyZ2V0LCBhcmdzLCBuZXdUYXJnZXQpO1xuICB9XG59O1xuXG4vLyAtLS0tIGVuZCBvZiB0aGUgVmFsaWRhdG9yIGhhbmRsZXIgd3JhcHBlciBoYW5kbGVyIC0tLS1cblxuLy8gSW4gd2hhdCBmb2xsb3dzLCBhICdkaXJlY3QgcHJveHknIGlzIGEgcHJveHlcbi8vIHdob3NlIGhhbmRsZXIgaXMgYSBWYWxpZGF0b3IuIFN1Y2ggcHJveGllcyBjYW4gYmUgbWFkZSBub24tZXh0ZW5zaWJsZSxcbi8vIHNlYWxlZCBvciBmcm96ZW4gd2l0aG91dCBsb3NpbmcgdGhlIGFiaWxpdHkgdG8gdHJhcC5cblxuLy8gbWFwcyBkaXJlY3QgcHJveGllcyB0byB0aGVpciBWYWxpZGF0b3IgaGFuZGxlcnNcbnZhciBkaXJlY3RQcm94aWVzID0gbmV3IFdlYWtNYXAoKTtcblxuLy8gcGF0Y2ggT2JqZWN0LntwcmV2ZW50RXh0ZW5zaW9ucyxzZWFsLGZyZWV6ZX0gc28gdGhhdFxuLy8gdGhleSByZWNvZ25pemUgZml4YWJsZSBwcm94aWVzIGFuZCBhY3QgYWNjb3JkaW5nbHlcbk9iamVjdC5wcmV2ZW50RXh0ZW5zaW9ucyA9IGZ1bmN0aW9uKHN1YmplY3QpIHtcbiAgdmFyIHZoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQoc3ViamVjdCk7XG4gIGlmICh2aGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHZoYW5kbGVyLnByZXZlbnRFeHRlbnNpb25zKCkpIHtcbiAgICAgIHJldHVybiBzdWJqZWN0O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicHJldmVudEV4dGVuc2lvbnMgb24gXCIrc3ViamVjdCtcIiByZWplY3RlZFwiKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHByaW1fcHJldmVudEV4dGVuc2lvbnMoc3ViamVjdCk7XG4gIH1cbn07XG5PYmplY3Quc2VhbCA9IGZ1bmN0aW9uKHN1YmplY3QpIHtcbiAgc2V0SW50ZWdyaXR5TGV2ZWwoc3ViamVjdCwgXCJzZWFsZWRcIik7XG4gIHJldHVybiBzdWJqZWN0O1xufTtcbk9iamVjdC5mcmVlemUgPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gIHNldEludGVncml0eUxldmVsKHN1YmplY3QsIFwiZnJvemVuXCIpO1xuICByZXR1cm4gc3ViamVjdDtcbn07XG5PYmplY3QuaXNFeHRlbnNpYmxlID0gT2JqZWN0X2lzRXh0ZW5zaWJsZSA9IGZ1bmN0aW9uKHN1YmplY3QpIHtcbiAgdmFyIHZIYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQoc3ViamVjdCk7XG4gIGlmICh2SGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHZIYW5kbGVyLmlzRXh0ZW5zaWJsZSgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwcmltX2lzRXh0ZW5zaWJsZShzdWJqZWN0KTtcbiAgfVxufTtcbk9iamVjdC5pc1NlYWxlZCA9IE9iamVjdF9pc1NlYWxlZCA9IGZ1bmN0aW9uKHN1YmplY3QpIHtcbiAgcmV0dXJuIHRlc3RJbnRlZ3JpdHlMZXZlbChzdWJqZWN0LCBcInNlYWxlZFwiKTtcbn07XG5PYmplY3QuaXNGcm96ZW4gPSBPYmplY3RfaXNGcm96ZW4gPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gIHJldHVybiB0ZXN0SW50ZWdyaXR5TGV2ZWwoc3ViamVjdCwgXCJmcm96ZW5cIik7XG59O1xuT2JqZWN0LmdldFByb3RvdHlwZU9mID0gT2JqZWN0X2dldFByb3RvdHlwZU9mID0gZnVuY3Rpb24oc3ViamVjdCkge1xuICB2YXIgdkhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldChzdWJqZWN0KTtcbiAgaWYgKHZIYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gdkhhbmRsZXIuZ2V0UHJvdG90eXBlT2YoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJpbV9nZXRQcm90b3R5cGVPZihzdWJqZWN0KTtcbiAgfVxufTtcblxuLy8gcGF0Y2ggT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvciB0byBkaXJlY3RseSBjYWxsXG4vLyB0aGUgVmFsaWRhdG9yLnByb3RvdHlwZS5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgdHJhcFxuLy8gVGhpcyBpcyB0byBjaXJjdW12ZW50IGFuIGFzc2VydGlvbiBpbiB0aGUgYnVpbHQtaW4gUHJveHlcbi8vIHRyYXBwaW5nIG1lY2hhbmlzbSBvZiB2OCwgd2hpY2ggZGlzYWxsb3dzIHRoYXQgdHJhcCB0b1xuLy8gcmV0dXJuIG5vbi1jb25maWd1cmFibGUgcHJvcGVydHkgZGVzY3JpcHRvcnMgKGFzIHBlciB0aGVcbi8vIG9sZCBQcm94eSBkZXNpZ24pXG5PYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yID0gZnVuY3Rpb24oc3ViamVjdCwgbmFtZSkge1xuICB2YXIgdmhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldChzdWJqZWN0KTtcbiAgaWYgKHZoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gdmhhbmRsZXIuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG5hbWUpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwcmltX2dldE93blByb3BlcnR5RGVzY3JpcHRvcihzdWJqZWN0LCBuYW1lKTtcbiAgfVxufTtcblxuLy8gcGF0Y2ggT2JqZWN0LmRlZmluZVByb3BlcnR5IHRvIGRpcmVjdGx5IGNhbGxcbi8vIHRoZSBWYWxpZGF0b3IucHJvdG90eXBlLmRlZmluZVByb3BlcnR5IHRyYXBcbi8vIFRoaXMgaXMgdG8gY2lyY3VtdmVudCB0d28gaXNzdWVzIHdpdGggdGhlIGJ1aWx0LWluXG4vLyB0cmFwIG1lY2hhbmlzbTpcbi8vIDEpIHRoZSBjdXJyZW50IHRyYWNlbW9ua2V5IGltcGxlbWVudGF0aW9uIG9mIHByb3hpZXNcbi8vIGF1dG8tY29tcGxldGVzICdkZXNjJywgd2hpY2ggaXMgbm90IGNvcnJlY3QuICdkZXNjJyBzaG91bGQgYmVcbi8vIG5vcm1hbGl6ZWQsIGJ1dCBub3QgY29tcGxldGVkLiBDb25zaWRlcjpcbi8vIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm94eSwgJ2ZvbycsIHtlbnVtZXJhYmxlOmZhbHNlfSlcbi8vIFRoaXMgdHJhcCB3aWxsIHJlY2VpdmUgZGVzYyA9XG4vLyAge3ZhbHVlOnVuZGVmaW5lZCx3cml0YWJsZTpmYWxzZSxlbnVtZXJhYmxlOmZhbHNlLGNvbmZpZ3VyYWJsZTpmYWxzZX1cbi8vIFRoaXMgd2lsbCBhbHNvIHNldCBhbGwgb3RoZXIgYXR0cmlidXRlcyB0byB0aGVpciBkZWZhdWx0IHZhbHVlLFxuLy8gd2hpY2ggaXMgdW5leHBlY3RlZCBhbmQgZGlmZmVyZW50IGZyb20gW1tEZWZpbmVPd25Qcm9wZXJ0eV1dLlxuLy8gQnVnIGZpbGVkOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02MDEzMjlcbi8vIDIpIHRoZSBjdXJyZW50IHNwaWRlcm1vbmtleSBpbXBsZW1lbnRhdGlvbiBkb2VzIG5vdFxuLy8gdGhyb3cgYW4gZXhjZXB0aW9uIHdoZW4gdGhpcyB0cmFwIHJldHVybnMgJ2ZhbHNlJywgYnV0IGluc3RlYWQgc2lsZW50bHlcbi8vIGlnbm9yZXMgdGhlIG9wZXJhdGlvbiAodGhpcyBpcyByZWdhcmRsZXNzIG9mIHN0cmljdC1tb2RlKVxuLy8gMmEpIHY4IGRvZXMgdGhyb3cgYW4gZXhjZXB0aW9uIGZvciB0aGlzIGNhc2UsIGJ1dCBpbmNsdWRlcyB0aGUgcmF0aGVyXG4vLyAgICAgdW5oZWxwZnVsIGVycm9yIG1lc3NhZ2U6XG4vLyAnUHJveHkgaGFuZGxlciAjPE9iamVjdD4gcmV0dXJuZWQgZmFsc2UgZnJvbSAnZGVmaW5lUHJvcGVydHknIHRyYXAnXG5PYmplY3QuZGVmaW5lUHJvcGVydHkgPSBmdW5jdGlvbihzdWJqZWN0LCBuYW1lLCBkZXNjKSB7XG4gIHZhciB2aGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHN1YmplY3QpO1xuICBpZiAodmhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIHZhciBub3JtYWxpemVkRGVzYyA9IG5vcm1hbGl6ZVByb3BlcnR5RGVzY3JpcHRvcihkZXNjKTtcbiAgICB2YXIgc3VjY2VzcyA9IHZoYW5kbGVyLmRlZmluZVByb3BlcnR5KG5hbWUsIG5vcm1hbGl6ZWREZXNjKTtcbiAgICBpZiAoc3VjY2VzcyA9PT0gZmFsc2UpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW4ndCByZWRlZmluZSBwcm9wZXJ0eSAnXCIrbmFtZStcIidcIik7XG4gICAgfVxuICAgIHJldHVybiBzdWJqZWN0O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwcmltX2RlZmluZVByb3BlcnR5KHN1YmplY3QsIG5hbWUsIGRlc2MpO1xuICB9XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyA9IGZ1bmN0aW9uKHN1YmplY3QsIGRlc2NzKSB7XG4gIHZhciB2aGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHN1YmplY3QpO1xuICBpZiAodmhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIHZhciBuYW1lcyA9IE9iamVjdC5rZXlzKGRlc2NzKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgbmFtZSA9IG5hbWVzW2ldO1xuICAgICAgdmFyIG5vcm1hbGl6ZWREZXNjID0gbm9ybWFsaXplUHJvcGVydHlEZXNjcmlwdG9yKGRlc2NzW25hbWVdKTtcbiAgICAgIHZhciBzdWNjZXNzID0gdmhhbmRsZXIuZGVmaW5lUHJvcGVydHkobmFtZSwgbm9ybWFsaXplZERlc2MpO1xuICAgICAgaWYgKHN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW4ndCByZWRlZmluZSBwcm9wZXJ0eSAnXCIrbmFtZStcIidcIik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdWJqZWN0O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwcmltX2RlZmluZVByb3BlcnRpZXMoc3ViamVjdCwgZGVzY3MpO1xuICB9XG59O1xuXG5PYmplY3Qua2V5cyA9IGZ1bmN0aW9uKHN1YmplY3QpIHtcbiAgdmFyIHZIYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQoc3ViamVjdCk7XG4gIGlmICh2SGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIG93bktleXMgPSB2SGFuZGxlci5vd25LZXlzKCk7XG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3duS2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGsgPSBTdHJpbmcob3duS2V5c1tpXSk7XG4gICAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Ioc3ViamVjdCwgayk7XG4gICAgICBpZiAoZGVzYyAhPT0gdW5kZWZpbmVkICYmIGRlc2MuZW51bWVyYWJsZSA9PT0gdHJ1ZSkge1xuICAgICAgICByZXN1bHQucHVzaChrKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJpbV9rZXlzKHN1YmplY3QpO1xuICB9XG59XG5cbk9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzID0gT2JqZWN0X2dldE93blByb3BlcnR5TmFtZXMgPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gIHZhciB2SGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHN1YmplY3QpO1xuICBpZiAodkhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB2SGFuZGxlci5vd25LZXlzKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHByaW1fZ2V0T3duUHJvcGVydHlOYW1lcyhzdWJqZWN0KTtcbiAgfVxufVxuXG4vLyBmaXhlcyBpc3N1ZSAjNzEgKENhbGxpbmcgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scygpIG9uIGEgUHJveHlcbi8vIHRocm93cyBhbiBlcnJvcilcbmlmIChwcmltX2dldE93blByb3BlcnR5U3ltYm9scyAhPT0gdW5kZWZpbmVkKSB7XG4gIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gICAgdmFyIHZIYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQoc3ViamVjdCk7XG4gICAgaWYgKHZIYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGFzIHRoaXMgc2hpbSBkb2VzIG5vdCBzdXBwb3J0IHN5bWJvbHMsIGEgUHJveHkgbmV2ZXIgYWR2ZXJ0aXNlc1xuICAgICAgLy8gYW55IHN5bWJvbC12YWx1ZWQgb3duIHByb3BlcnRpZXNcbiAgICAgIHJldHVybiBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHByaW1fZ2V0T3duUHJvcGVydHlTeW1ib2xzKHN1YmplY3QpO1xuICAgIH1cbiAgfTtcbn1cblxuLy8gZml4ZXMgaXNzdWUgIzcyICgnSWxsZWdhbCBhY2Nlc3MnIGVycm9yIHdoZW4gdXNpbmcgT2JqZWN0LmFzc2lnbilcbi8vIE9iamVjdC5hc3NpZ24gcG9seWZpbGwgYmFzZWQgb24gYSBwb2x5ZmlsbCBwb3N0ZWQgb24gTUROOiBcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL1xcXG4vLyAgR2xvYmFsX09iamVjdHMvT2JqZWN0L2Fzc2lnblxuLy8gTm90ZSB0aGF0IHRoaXMgcG9seWZpbGwgZG9lcyBub3Qgc3VwcG9ydCBTeW1ib2xzLCBidXQgdGhpcyBQcm94eSBTaGltXG4vLyBkb2VzIG5vdCBzdXBwb3J0IFN5bWJvbHMgYW55d2F5LlxuaWYgKHByaW1fYXNzaWduICE9PSB1bmRlZmluZWQpIHtcbiAgT2JqZWN0LmFzc2lnbiA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgICBcbiAgICAvLyBjaGVjayBpZiBhbnkgYXJndW1lbnQgaXMgYSBwcm94eSBvYmplY3RcbiAgICB2YXIgbm9Qcm94aWVzID0gdHJ1ZTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHZIYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQoYXJndW1lbnRzW2ldKTtcbiAgICAgIGlmICh2SGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG5vUHJveGllcyA9IGZhbHNlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG5vUHJveGllcykge1xuICAgICAgLy8gbm90IGEgc2luZ2xlIGFyZ3VtZW50IGlzIGEgcHJveHksIHBlcmZvcm0gYnVpbHQtaW4gYWxnb3JpdGhtXG4gICAgICByZXR1cm4gcHJpbV9hc3NpZ24uYXBwbHkoT2JqZWN0LCBhcmd1bWVudHMpO1xuICAgIH1cbiAgICBcbiAgICAvLyB0aGVyZSBpcyBhdCBsZWFzdCBvbmUgcHJveHkgYXJndW1lbnQsIHVzZSB0aGUgcG9seWZpbGxcbiAgICBcbiAgICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQgfHwgdGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY29udmVydCB1bmRlZmluZWQgb3IgbnVsbCB0byBvYmplY3QnKTtcbiAgICB9XG5cbiAgICB2YXIgb3V0cHV0ID0gT2JqZWN0KHRhcmdldCk7XG4gICAgZm9yICh2YXIgaW5kZXggPSAxOyBpbmRleCA8IGFyZ3VtZW50cy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaW5kZXhdO1xuICAgICAgaWYgKHNvdXJjZSAhPT0gdW5kZWZpbmVkICYmIHNvdXJjZSAhPT0gbnVsbCkge1xuICAgICAgICBmb3IgKHZhciBuZXh0S2V5IGluIHNvdXJjZSkge1xuICAgICAgICAgIGlmIChzb3VyY2UuaGFzT3duUHJvcGVydHkobmV4dEtleSkpIHtcbiAgICAgICAgICAgIG91dHB1dFtuZXh0S2V5XSA9IHNvdXJjZVtuZXh0S2V5XTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfTtcbn1cblxuLy8gcmV0dXJucyB3aGV0aGVyIGFuIGFyZ3VtZW50IGlzIGEgcmVmZXJlbmNlIHRvIGFuIG9iamVjdCxcbi8vIHdoaWNoIGlzIGxlZ2FsIGFzIGEgV2Vha01hcCBrZXkuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgYXJnO1xuICByZXR1cm4gKHR5cGUgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbCkgfHwgKHR5cGUgPT09ICdmdW5jdGlvbicpO1xufTtcblxuLy8gYSB3cmFwcGVyIGZvciBXZWFrTWFwLmdldCB3aGljaCByZXR1cm5zIHRoZSB1bmRlZmluZWQgdmFsdWVcbi8vIGZvciBrZXlzIHRoYXQgYXJlIG5vdCBvYmplY3RzIChpbiB3aGljaCBjYXNlIHRoZSB1bmRlcmx5aW5nXG4vLyBXZWFrTWFwIHdvdWxkIGhhdmUgdGhyb3duIGEgVHlwZUVycm9yKS5cbmZ1bmN0aW9uIHNhZmVXZWFrTWFwR2V0KG1hcCwga2V5KSB7XG4gIHJldHVybiBpc09iamVjdChrZXkpID8gbWFwLmdldChrZXkpIDogdW5kZWZpbmVkO1xufTtcblxuLy8gcmV0dXJucyBhIG5ldyBmdW5jdGlvbiBvZiB6ZXJvIGFyZ3VtZW50cyB0aGF0IHJlY3Vyc2l2ZWx5XG4vLyB1bndyYXBzIGFueSBwcm94aWVzIHNwZWNpZmllZCBhcyB0aGUgfHRoaXN8LXZhbHVlLlxuLy8gVGhlIHByaW1pdGl2ZSBpcyBhc3N1bWVkIHRvIGJlIGEgemVyby1hcmd1bWVudCBtZXRob2Rcbi8vIHRoYXQgdXNlcyBpdHMgfHRoaXN8LWJpbmRpbmcuXG5mdW5jdGlvbiBtYWtlVW53cmFwcGluZzBBcmdNZXRob2QocHJpbWl0aXZlKSB7XG4gIHJldHVybiBmdW5jdGlvbiBidWlsdGluKCkge1xuICAgIHZhciB2SGFuZGxlciA9IHNhZmVXZWFrTWFwR2V0KGRpcmVjdFByb3hpZXMsIHRoaXMpO1xuICAgIGlmICh2SGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gYnVpbHRpbi5jYWxsKHZIYW5kbGVyLnRhcmdldCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwcmltaXRpdmUuY2FsbCh0aGlzKTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIHJldHVybnMgYSBuZXcgZnVuY3Rpb24gb2YgMSBhcmd1bWVudHMgdGhhdCByZWN1cnNpdmVseVxuLy8gdW53cmFwcyBhbnkgcHJveGllcyBzcGVjaWZpZWQgYXMgdGhlIHx0aGlzfC12YWx1ZS5cbi8vIFRoZSBwcmltaXRpdmUgaXMgYXNzdW1lZCB0byBiZSBhIDEtYXJndW1lbnQgbWV0aG9kXG4vLyB0aGF0IHVzZXMgaXRzIHx0aGlzfC1iaW5kaW5nLlxuZnVuY3Rpb24gbWFrZVVud3JhcHBpbmcxQXJnTWV0aG9kKHByaW1pdGl2ZSkge1xuICByZXR1cm4gZnVuY3Rpb24gYnVpbHRpbihhcmcpIHtcbiAgICB2YXIgdkhhbmRsZXIgPSBzYWZlV2Vha01hcEdldChkaXJlY3RQcm94aWVzLCB0aGlzKTtcbiAgICBpZiAodkhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGJ1aWx0aW4uY2FsbCh2SGFuZGxlci50YXJnZXQsIGFyZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwcmltaXRpdmUuY2FsbCh0aGlzLCBhcmcpO1xuICAgIH1cbiAgfVxufTtcblxuT2JqZWN0LnByb3RvdHlwZS52YWx1ZU9mID1cbiAgbWFrZVVud3JhcHBpbmcwQXJnTWV0aG9kKE9iamVjdC5wcm90b3R5cGUudmFsdWVPZik7XG5PYmplY3QucHJvdG90eXBlLnRvU3RyaW5nID1cbiAgbWFrZVVud3JhcHBpbmcwQXJnTWV0aG9kKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcpO1xuRnVuY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nID1cbiAgbWFrZVVud3JhcHBpbmcwQXJnTWV0aG9kKEZ1bmN0aW9uLnByb3RvdHlwZS50b1N0cmluZyk7XG5EYXRlLnByb3RvdHlwZS50b1N0cmluZyA9XG4gIG1ha2VVbndyYXBwaW5nMEFyZ01ldGhvZChEYXRlLnByb3RvdHlwZS50b1N0cmluZyk7XG5cbk9iamVjdC5wcm90b3R5cGUuaXNQcm90b3R5cGVPZiA9IGZ1bmN0aW9uIGJ1aWx0aW4oYXJnKSB7XG4gIC8vIGJ1Z2ZpeCB0aGFua3MgdG8gQmlsbCBNYXJrOlxuICAvLyBidWlsdC1pbiBpc1Byb3RvdHlwZU9mIGRvZXMgbm90IHVud3JhcCBwcm94aWVzIHVzZWRcbiAgLy8gYXMgYXJndW1lbnRzLiBTbywgd2UgaW1wbGVtZW50IHRoZSBidWlsdGluIG91cnNlbHZlcyxcbiAgLy8gYmFzZWQgb24gdGhlIEVDTUFTY3JpcHQgNiBzcGVjLiBPdXIgZW5jb2Rpbmcgd2lsbFxuICAvLyBtYWtlIHN1cmUgdGhhdCBpZiBhIHByb3h5IGlzIHVzZWQgYXMgYW4gYXJndW1lbnQsXG4gIC8vIGl0cyBnZXRQcm90b3R5cGVPZiB0cmFwIHdpbGwgYmUgY2FsbGVkLlxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHZhciB2SGFuZGxlcjIgPSBzYWZlV2Vha01hcEdldChkaXJlY3RQcm94aWVzLCBhcmcpO1xuICAgIGlmICh2SGFuZGxlcjIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgYXJnID0gdkhhbmRsZXIyLmdldFByb3RvdHlwZU9mKCk7XG4gICAgICBpZiAoYXJnID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZhbHVlKGFyZywgdGhpcykpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwcmltX2lzUHJvdG90eXBlT2YuY2FsbCh0aGlzLCBhcmcpO1xuICAgIH1cbiAgfVxufTtcblxuQXJyYXkuaXNBcnJheSA9IGZ1bmN0aW9uKHN1YmplY3QpIHtcbiAgdmFyIHZIYW5kbGVyID0gc2FmZVdlYWtNYXBHZXQoZGlyZWN0UHJveGllcywgc3ViamVjdCk7XG4gIGlmICh2SGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkodkhhbmRsZXIudGFyZ2V0KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJpbV9pc0FycmF5KHN1YmplY3QpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBpc1Byb3h5QXJyYXkoYXJnKSB7XG4gIHZhciB2SGFuZGxlciA9IHNhZmVXZWFrTWFwR2V0KGRpcmVjdFByb3hpZXMsIGFyZyk7XG4gIGlmICh2SGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkodkhhbmRsZXIudGFyZ2V0KTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIEFycmF5LnByb3RvdHlwZS5jb25jYXQgaW50ZXJuYWxseSB0ZXN0cyB3aGV0aGVyIG9uZSBvZiBpdHNcbi8vIGFyZ3VtZW50cyBpcyBhbiBBcnJheSwgYnkgY2hlY2tpbmcgd2hldGhlciBbW0NsYXNzXV0gPT0gXCJBcnJheVwiXG4vLyBBcyBzdWNoLCBpdCB3aWxsIGZhaWwgdG8gcmVjb2duaXplIHByb3hpZXMtZm9yLWFycmF5cyBhcyBhcnJheXMuXG4vLyBXZSBwYXRjaCBBcnJheS5wcm90b3R5cGUuY29uY2F0IHNvIHRoYXQgaXQgXCJ1bndyYXBzXCIgcHJveGllcy1mb3ItYXJyYXlzXG4vLyBieSBtYWtpbmcgYSBjb3B5LiBUaGlzIHdpbGwgdHJpZ2dlciB0aGUgZXhhY3Qgc2FtZSBzZXF1ZW5jZSBvZlxuLy8gdHJhcHMgb24gdGhlIHByb3h5LWZvci1hcnJheSBhcyBpZiB3ZSB3b3VsZCBub3QgaGF2ZSB1bndyYXBwZWQgaXQuXG4vLyBTZWUgPGh0dHBzOi8vZ2l0aHViLmNvbS90dmN1dHNlbS9oYXJtb255LXJlZmxlY3QvaXNzdWVzLzE5PiBmb3IgbW9yZS5cbkFycmF5LnByb3RvdHlwZS5jb25jYXQgPSBmdW5jdGlvbigvKi4uLmFyZ3MqLykge1xuICB2YXIgbGVuZ3RoO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgIGlmIChpc1Byb3h5QXJyYXkoYXJndW1lbnRzW2ldKSkge1xuICAgICAgbGVuZ3RoID0gYXJndW1lbnRzW2ldLmxlbmd0aDtcbiAgICAgIGFyZ3VtZW50c1tpXSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50c1tpXSwgMCwgbGVuZ3RoKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHByaW1fY29uY2F0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG4vLyBzZXRQcm90b3R5cGVPZiBzdXBwb3J0IG9uIHBsYXRmb3JtcyB0aGF0IHN1cHBvcnQgX19wcm90b19fXG5cbnZhciBwcmltX3NldFByb3RvdHlwZU9mID0gT2JqZWN0LnNldFByb3RvdHlwZU9mO1xuXG4vLyBwYXRjaCBhbmQgZXh0cmFjdCBvcmlnaW5hbCBfX3Byb3RvX18gc2V0dGVyXG52YXIgX19wcm90b19fc2V0dGVyID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgcHJvdG9EZXNjID0gcHJpbV9nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoT2JqZWN0LnByb3RvdHlwZSwnX19wcm90b19fJyk7XG4gIGlmIChwcm90b0Rlc2MgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgdHlwZW9mIHByb3RvRGVzYy5zZXQgIT09IFwiZnVuY3Rpb25cIikge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJzZXRQcm90b3R5cGVPZiBub3Qgc3VwcG9ydGVkIG9uIHRoaXMgcGxhdGZvcm1cIik7XG4gICAgfVxuICB9XG5cbiAgLy8gc2VlIGlmIHdlIGNhbiBhY3R1YWxseSBtdXRhdGUgYSBwcm90b3R5cGUgd2l0aCB0aGUgZ2VuZXJpYyBzZXR0ZXJcbiAgLy8gKGUuZy4gQ2hyb21lIHYyOCBkb2Vzbid0IGFsbG93IHNldHRpbmcgX19wcm90b19fIHZpYSB0aGUgZ2VuZXJpYyBzZXR0ZXIpXG4gIHRyeSB7XG4gICAgcHJvdG9EZXNjLnNldC5jYWxsKHt9LHt9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJzZXRQcm90b3R5cGVPZiBub3Qgc3VwcG9ydGVkIG9uIHRoaXMgcGxhdGZvcm1cIik7XG4gICAgfVxuICB9XG5cbiAgcHJpbV9kZWZpbmVQcm9wZXJ0eShPYmplY3QucHJvdG90eXBlLCAnX19wcm90b19fJywge1xuICAgIHNldDogZnVuY3Rpb24obmV3UHJvdG8pIHtcbiAgICAgIHJldHVybiBPYmplY3Quc2V0UHJvdG90eXBlT2YodGhpcywgT2JqZWN0KG5ld1Byb3RvKSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcHJvdG9EZXNjLnNldDtcbn0oKSk7XG5cbk9iamVjdC5zZXRQcm90b3R5cGVPZiA9IGZ1bmN0aW9uKHRhcmdldCwgbmV3UHJvdG8pIHtcbiAgdmFyIGhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldCh0YXJnZXQpO1xuICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKGhhbmRsZXIuc2V0UHJvdG90eXBlT2YobmV3UHJvdG8pKSB7XG4gICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicHJveHkgcmVqZWN0ZWQgcHJvdG90eXBlIG11dGF0aW9uXCIpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoIU9iamVjdF9pc0V4dGVuc2libGUodGFyZ2V0KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbid0IHNldCBwcm90b3R5cGUgb24gbm9uLWV4dGVuc2libGUgb2JqZWN0OiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldCk7XG4gICAgfVxuICAgIGlmIChwcmltX3NldFByb3RvdHlwZU9mKVxuICAgICAgcmV0dXJuIHByaW1fc2V0UHJvdG90eXBlT2YodGFyZ2V0LCBuZXdQcm90byk7XG5cbiAgICBpZiAoT2JqZWN0KG5ld1Byb3RvKSAhPT0gbmV3UHJvdG8gfHwgbmV3UHJvdG8gPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgcHJvdG90eXBlIG1heSBvbmx5IGJlIGFuIE9iamVjdCBvciBudWxsOiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgbmV3UHJvdG8pO1xuICAgICAgLy8gdGhyb3cgbmV3IFR5cGVFcnJvcihcInByb3RvdHlwZSBtdXN0IGJlIGFuIG9iamVjdCBvciBudWxsXCIpXG4gICAgfVxuICAgIF9fcHJvdG9fX3NldHRlci5jYWxsKHRhcmdldCwgbmV3UHJvdG8pO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cbn1cblxuT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgdmFyIGhhbmRsZXIgPSBzYWZlV2Vha01hcEdldChkaXJlY3RQcm94aWVzLCB0aGlzKTtcbiAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIHZhciBkZXNjID0gaGFuZGxlci5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobmFtZSk7XG4gICAgcmV0dXJuIGRlc2MgIT09IHVuZGVmaW5lZDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJpbV9oYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMsIG5hbWUpO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT0gUmVmbGVjdGlvbiBtb2R1bGUgPT09PT09PT09PT09PVxuLy8gc2VlIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6cmVmbGVjdF9hcGlcblxudmFyIFJlZmxlY3QgPSBnbG9iYWwuUmVmbGVjdCA9IHtcbiAgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yOiBmdW5jdGlvbih0YXJnZXQsIG5hbWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIG5hbWUpO1xuICB9LFxuICBkZWZpbmVQcm9wZXJ0eTogZnVuY3Rpb24odGFyZ2V0LCBuYW1lLCBkZXNjKSB7XG5cbiAgICAvLyBpZiB0YXJnZXQgaXMgYSBwcm94eSwgaW52b2tlIGl0cyBcImRlZmluZVByb3BlcnR5XCIgdHJhcFxuICAgIHZhciBoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQodGFyZ2V0KTtcbiAgICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gaGFuZGxlci5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIG5hbWUsIGRlc2MpO1xuICAgIH1cblxuICAgIC8vIEltcGxlbWVudGF0aW9uIHRyYW5zbGl0ZXJhdGVkIGZyb20gW1tEZWZpbmVPd25Qcm9wZXJ0eV1dXG4gICAgLy8gc2VlIEVTNS4xIHNlY3Rpb24gOC4xMi45XG4gICAgLy8gdGhpcyBpcyB0aGUgX2V4YWN0IHNhbWUgYWxnb3JpdGhtXyBhcyB0aGUgaXNDb21wYXRpYmxlRGVzY3JpcHRvclxuICAgIC8vIGFsZ29yaXRobSBkZWZpbmVkIGFib3ZlLCBleGNlcHQgdGhhdCBhdCBldmVyeSBwbGFjZSBpdFxuICAgIC8vIHJldHVybnMgdHJ1ZSwgdGhpcyBhbGdvcml0aG0gYWN0dWFsbHkgZG9lcyBkZWZpbmUgdGhlIHByb3BlcnR5LlxuICAgIHZhciBjdXJyZW50ID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIG5hbWUpO1xuICAgIHZhciBleHRlbnNpYmxlID0gT2JqZWN0LmlzRXh0ZW5zaWJsZSh0YXJnZXQpO1xuICAgIGlmIChjdXJyZW50ID09PSB1bmRlZmluZWQgJiYgZXh0ZW5zaWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGN1cnJlbnQgPT09IHVuZGVmaW5lZCAmJiBleHRlbnNpYmxlID09PSB0cnVlKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBuYW1lLCBkZXNjKTsgLy8gc2hvdWxkIG5ldmVyIGZhaWxcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoaXNFbXB0eURlc2NyaXB0b3IoZGVzYykpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoaXNFcXVpdmFsZW50RGVzY3JpcHRvcihjdXJyZW50LCBkZXNjKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChjdXJyZW50LmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgIGlmIChkZXNjLmNvbmZpZ3VyYWJsZSA9PT0gdHJ1ZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoJ2VudW1lcmFibGUnIGluIGRlc2MgJiYgZGVzYy5lbnVtZXJhYmxlICE9PSBjdXJyZW50LmVudW1lcmFibGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoaXNHZW5lcmljRGVzY3JpcHRvcihkZXNjKSkge1xuICAgICAgLy8gbm8gZnVydGhlciB2YWxpZGF0aW9uIG5lY2Vzc2FyeVxuICAgIH0gZWxzZSBpZiAoaXNEYXRhRGVzY3JpcHRvcihjdXJyZW50KSAhPT0gaXNEYXRhRGVzY3JpcHRvcihkZXNjKSkge1xuICAgICAgaWYgKGN1cnJlbnQuY29uZmlndXJhYmxlID09PSBmYWxzZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpc0RhdGFEZXNjcmlwdG9yKGN1cnJlbnQpICYmIGlzRGF0YURlc2NyaXB0b3IoZGVzYykpIHtcbiAgICAgIGlmIChjdXJyZW50LmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgaWYgKGN1cnJlbnQud3JpdGFibGUgPT09IGZhbHNlICYmIGRlc2Mud3JpdGFibGUgPT09IHRydWUpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN1cnJlbnQud3JpdGFibGUgPT09IGZhbHNlKSB7XG4gICAgICAgICAgaWYgKCd2YWx1ZScgaW4gZGVzYyAmJiAhc2FtZVZhbHVlKGRlc2MudmFsdWUsIGN1cnJlbnQudmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpc0FjY2Vzc29yRGVzY3JpcHRvcihjdXJyZW50KSAmJiBpc0FjY2Vzc29yRGVzY3JpcHRvcihkZXNjKSkge1xuICAgICAgaWYgKGN1cnJlbnQuY29uZmlndXJhYmxlID09PSBmYWxzZSkge1xuICAgICAgICBpZiAoJ3NldCcgaW4gZGVzYyAmJiAhc2FtZVZhbHVlKGRlc2Muc2V0LCBjdXJyZW50LnNldCkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCdnZXQnIGluIGRlc2MgJiYgIXNhbWVWYWx1ZShkZXNjLmdldCwgY3VycmVudC5nZXQpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIG5hbWUsIGRlc2MpOyAvLyBzaG91bGQgbmV2ZXIgZmFpbFxuICAgIHJldHVybiB0cnVlO1xuICB9LFxuICBkZWxldGVQcm9wZXJ0eTogZnVuY3Rpb24odGFyZ2V0LCBuYW1lKSB7XG4gICAgdmFyIGhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldCh0YXJnZXQpO1xuICAgIGlmIChoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBoYW5kbGVyLmRlbGV0ZShuYW1lKTtcbiAgICB9XG4gICAgXG4gICAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgbmFtZSk7XG4gICAgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChkZXNjLmNvbmZpZ3VyYWJsZSA9PT0gdHJ1ZSkge1xuICAgICAgZGVsZXRlIHRhcmdldFtuYW1lXTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7ICAgIFxuICB9LFxuICBnZXRQcm90b3R5cGVPZjogZnVuY3Rpb24odGFyZ2V0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZih0YXJnZXQpO1xuICB9LFxuICBzZXRQcm90b3R5cGVPZjogZnVuY3Rpb24odGFyZ2V0LCBuZXdQcm90bykge1xuICAgIFxuICAgIHZhciBoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQodGFyZ2V0KTtcbiAgICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gaGFuZGxlci5zZXRQcm90b3R5cGVPZihuZXdQcm90byk7XG4gICAgfVxuICAgIFxuICAgIGlmIChPYmplY3QobmV3UHJvdG8pICE9PSBuZXdQcm90byB8fCBuZXdQcm90byA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBwcm90b3R5cGUgbWF5IG9ubHkgYmUgYW4gT2JqZWN0IG9yIG51bGw6IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICBuZXdQcm90byk7XG4gICAgfVxuICAgIFxuICAgIGlmICghT2JqZWN0X2lzRXh0ZW5zaWJsZSh0YXJnZXQpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIFxuICAgIHZhciBjdXJyZW50ID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHRhcmdldCk7XG4gICAgaWYgKHNhbWVWYWx1ZShjdXJyZW50LCBuZXdQcm90bykpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBcbiAgICBpZiAocHJpbV9zZXRQcm90b3R5cGVPZikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcHJpbV9zZXRQcm90b3R5cGVPZih0YXJnZXQsIG5ld1Byb3RvKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBfX3Byb3RvX19zZXR0ZXIuY2FsbCh0YXJnZXQsIG5ld1Byb3RvKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcbiAgcHJldmVudEV4dGVuc2lvbnM6IGZ1bmN0aW9uKHRhcmdldCkge1xuICAgIHZhciBoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQodGFyZ2V0KTtcbiAgICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gaGFuZGxlci5wcmV2ZW50RXh0ZW5zaW9ucygpO1xuICAgIH1cbiAgICBwcmltX3ByZXZlbnRFeHRlbnNpb25zKHRhcmdldCk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG4gIGlzRXh0ZW5zaWJsZTogZnVuY3Rpb24odGFyZ2V0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5pc0V4dGVuc2libGUodGFyZ2V0KTtcbiAgfSxcbiAgaGFzOiBmdW5jdGlvbih0YXJnZXQsIG5hbWUpIHtcbiAgICByZXR1cm4gbmFtZSBpbiB0YXJnZXQ7XG4gIH0sXG4gIGdldDogZnVuY3Rpb24odGFyZ2V0LCBuYW1lLCByZWNlaXZlcikge1xuICAgIHJlY2VpdmVyID0gcmVjZWl2ZXIgfHwgdGFyZ2V0O1xuXG4gICAgLy8gaWYgdGFyZ2V0IGlzIGEgcHJveHksIGludm9rZSBpdHMgXCJnZXRcIiB0cmFwXG4gICAgdmFyIGhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldCh0YXJnZXQpO1xuICAgIGlmIChoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBoYW5kbGVyLmdldChyZWNlaXZlciwgbmFtZSk7XG4gICAgfVxuXG4gICAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgbmFtZSk7XG4gICAgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHRhcmdldCk7XG4gICAgICBpZiAocHJvdG8gPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBSZWZsZWN0LmdldChwcm90bywgbmFtZSwgcmVjZWl2ZXIpO1xuICAgIH1cbiAgICBpZiAoaXNEYXRhRGVzY3JpcHRvcihkZXNjKSkge1xuICAgICAgcmV0dXJuIGRlc2MudmFsdWU7XG4gICAgfVxuICAgIHZhciBnZXR0ZXIgPSBkZXNjLmdldDtcbiAgICBpZiAoZ2V0dGVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiBkZXNjLmdldC5jYWxsKHJlY2VpdmVyKTtcbiAgfSxcbiAgLy8gUmVmbGVjdC5zZXQgaW1wbGVtZW50YXRpb24gYmFzZWQgb24gbGF0ZXN0IHZlcnNpb24gb2YgW1tTZXRQXV0gYXRcbiAgLy8gaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTpwcm90b19jbGltYmluZ19yZWZhY3RvcmluZ1xuICBzZXQ6IGZ1bmN0aW9uKHRhcmdldCwgbmFtZSwgdmFsdWUsIHJlY2VpdmVyKSB7XG4gICAgcmVjZWl2ZXIgPSByZWNlaXZlciB8fCB0YXJnZXQ7XG5cbiAgICAvLyBpZiB0YXJnZXQgaXMgYSBwcm94eSwgaW52b2tlIGl0cyBcInNldFwiIHRyYXBcbiAgICB2YXIgaGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHRhcmdldCk7XG4gICAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGhhbmRsZXIuc2V0KHJlY2VpdmVyLCBuYW1lLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgLy8gZmlyc3QsIGNoZWNrIHdoZXRoZXIgdGFyZ2V0IGhhcyBhIG5vbi13cml0YWJsZSBwcm9wZXJ0eVxuICAgIC8vIHNoYWRvd2luZyBuYW1lIG9uIHJlY2VpdmVyXG4gICAgdmFyIG93bkRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgbmFtZSk7XG5cbiAgICBpZiAob3duRGVzYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBuYW1lIGlzIG5vdCBkZWZpbmVkIGluIHRhcmdldCwgc2VhcmNoIHRhcmdldCdzIHByb3RvdHlwZVxuICAgICAgdmFyIHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHRhcmdldCk7XG5cbiAgICAgIGlmIChwcm90byAhPT0gbnVsbCkge1xuICAgICAgICAvLyBjb250aW51ZSB0aGUgc2VhcmNoIGluIHRhcmdldCdzIHByb3RvdHlwZVxuICAgICAgICByZXR1cm4gUmVmbGVjdC5zZXQocHJvdG8sIG5hbWUsIHZhbHVlLCByZWNlaXZlcik7XG4gICAgICB9XG5cbiAgICAgIC8vIFJldjE2IGNoYW5nZS4gQ2YuIGh0dHBzOi8vYnVncy5lY21hc2NyaXB0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTU0OVxuICAgICAgLy8gdGFyZ2V0IHdhcyB0aGUgbGFzdCBwcm90b3R5cGUsIG5vdyB3ZSBrbm93IHRoYXQgJ25hbWUnIGlzIG5vdCBzaGFkb3dlZFxuICAgICAgLy8gYnkgYW4gZXhpc3RpbmcgKGFjY2Vzc29yIG9yIGRhdGEpIHByb3BlcnR5LCBzbyB3ZSBjYW4gYWRkIHRoZSBwcm9wZXJ0eVxuICAgICAgLy8gdG8gdGhlIGluaXRpYWwgcmVjZWl2ZXIgb2JqZWN0XG4gICAgICAvLyAodGhpcyBicmFuY2ggd2lsbCBpbnRlbnRpb25hbGx5IGZhbGwgdGhyb3VnaCB0byB0aGUgY29kZSBiZWxvdylcbiAgICAgIG93bkRlc2MgPVxuICAgICAgICB7IHZhbHVlOiB1bmRlZmluZWQsXG4gICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUgfTtcbiAgICB9XG5cbiAgICAvLyB3ZSBub3cga25vdyB0aGF0IG93bkRlc2MgIT09IHVuZGVmaW5lZFxuICAgIGlmIChpc0FjY2Vzc29yRGVzY3JpcHRvcihvd25EZXNjKSkge1xuICAgICAgdmFyIHNldHRlciA9IG93bkRlc2Muc2V0O1xuICAgICAgaWYgKHNldHRlciA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG4gICAgICBzZXR0ZXIuY2FsbChyZWNlaXZlciwgdmFsdWUpOyAvLyBhc3N1bWVzIEZ1bmN0aW9uLnByb3RvdHlwZS5jYWxsXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgLy8gb3RoZXJ3aXNlLCBpc0RhdGFEZXNjcmlwdG9yKG93bkRlc2MpIG11c3QgYmUgdHJ1ZVxuICAgIGlmIChvd25EZXNjLndyaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vIHdlIGZvdW5kIGFuIGV4aXN0aW5nIHdyaXRhYmxlIGRhdGEgcHJvcGVydHkgb24gdGhlIHByb3RvdHlwZSBjaGFpbi5cbiAgICAvLyBOb3cgdXBkYXRlIG9yIGFkZCB0aGUgZGF0YSBwcm9wZXJ0eSBvbiB0aGUgcmVjZWl2ZXIsIGRlcGVuZGluZyBvblxuICAgIC8vIHdoZXRoZXIgdGhlIHJlY2VpdmVyIGFscmVhZHkgZGVmaW5lcyB0aGUgcHJvcGVydHkgb3Igbm90LlxuICAgIHZhciBleGlzdGluZ0Rlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHJlY2VpdmVyLCBuYW1lKTtcbiAgICBpZiAoZXhpc3RpbmdEZXNjICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciB1cGRhdGVEZXNjID1cbiAgICAgICAgeyB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgLy8gRklYTUU6IGl0IHNob3VsZCBub3QgYmUgbmVjZXNzYXJ5IHRvIGRlc2NyaWJlIHRoZSBmb2xsb3dpbmdcbiAgICAgICAgICAvLyBhdHRyaWJ1dGVzLiBBZGRlZCB0byBjaXJjdW12ZW50IGEgYnVnIGluIHRyYWNlbW9ua2V5OlxuICAgICAgICAgIC8vIGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTYwMTMyOVxuICAgICAgICAgIHdyaXRhYmxlOiAgICAgZXhpc3RpbmdEZXNjLndyaXRhYmxlLFxuICAgICAgICAgIGVudW1lcmFibGU6ICAgZXhpc3RpbmdEZXNjLmVudW1lcmFibGUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiBleGlzdGluZ0Rlc2MuY29uZmlndXJhYmxlIH07XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVjZWl2ZXIsIG5hbWUsIHVwZGF0ZURlc2MpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghT2JqZWN0LmlzRXh0ZW5zaWJsZShyZWNlaXZlcikpIHJldHVybiBmYWxzZTtcbiAgICAgIHZhciBuZXdEZXNjID1cbiAgICAgICAgeyB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUgfTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShyZWNlaXZlciwgbmFtZSwgbmV3RGVzYyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH0sXG4gIC8qaW52b2tlOiBmdW5jdGlvbih0YXJnZXQsIG5hbWUsIGFyZ3MsIHJlY2VpdmVyKSB7XG4gICAgcmVjZWl2ZXIgPSByZWNlaXZlciB8fCB0YXJnZXQ7XG5cbiAgICB2YXIgaGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHRhcmdldCk7XG4gICAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGhhbmRsZXIuaW52b2tlKHJlY2VpdmVyLCBuYW1lLCBhcmdzKTtcbiAgICB9XG5cbiAgICB2YXIgZnVuID0gUmVmbGVjdC5nZXQodGFyZ2V0LCBuYW1lLCByZWNlaXZlcik7XG4gICAgcmV0dXJuIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKGZ1biwgcmVjZWl2ZXIsIGFyZ3MpO1xuICB9LCovXG4gIGVudW1lcmF0ZTogZnVuY3Rpb24odGFyZ2V0KSB7XG4gICAgdmFyIGhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldCh0YXJnZXQpO1xuICAgIHZhciByZXN1bHQ7XG4gICAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gaGFuZGxlci5lbnVtZXJhdGUgc2hvdWxkIHJldHVybiBhbiBpdGVyYXRvciBkaXJlY3RseSwgYnV0IHRoZVxuICAgICAgLy8gaXRlcmF0b3IgZ2V0cyBjb252ZXJ0ZWQgdG8gYW4gYXJyYXkgZm9yIGJhY2t3YXJkLWNvbXBhdCByZWFzb25zLFxuICAgICAgLy8gc28gd2UgbXVzdCByZS1pdGVyYXRlIG92ZXIgdGhlIGFycmF5XG4gICAgICByZXN1bHQgPSBoYW5kbGVyLmVudW1lcmF0ZShoYW5kbGVyLnRhcmdldCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IFtdO1xuICAgICAgZm9yICh2YXIgbmFtZSBpbiB0YXJnZXQpIHsgcmVzdWx0LnB1c2gobmFtZSk7IH07ICAgICAgXG4gICAgfVxuICAgIHZhciBsID0gK3Jlc3VsdC5sZW5ndGg7XG4gICAgdmFyIGlkeCA9IDA7XG4gICAgcmV0dXJuIHtcbiAgICAgIG5leHQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoaWR4ID09PSBsKSByZXR1cm4geyBkb25lOiB0cnVlIH07XG4gICAgICAgIHJldHVybiB7IGRvbmU6IGZhbHNlLCB2YWx1ZTogcmVzdWx0W2lkeCsrXSB9O1xuICAgICAgfVxuICAgIH07XG4gIH0sXG4gIC8vIGltcGVyZmVjdCBvd25LZXlzIGltcGxlbWVudGF0aW9uOiBpbiBFUzYsIHNob3VsZCBhbHNvIGluY2x1ZGVcbiAgLy8gc3ltYm9sLWtleWVkIHByb3BlcnRpZXMuXG4gIG93bktleXM6IGZ1bmN0aW9uKHRhcmdldCkge1xuICAgIHJldHVybiBPYmplY3RfZ2V0T3duUHJvcGVydHlOYW1lcyh0YXJnZXQpO1xuICB9LFxuICBhcHBseTogZnVuY3Rpb24odGFyZ2V0LCByZWNlaXZlciwgYXJncykge1xuICAgIC8vIHRhcmdldC5hcHBseShyZWNlaXZlciwgYXJncylcbiAgICByZXR1cm4gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwodGFyZ2V0LCByZWNlaXZlciwgYXJncyk7XG4gIH0sXG4gIGNvbnN0cnVjdDogZnVuY3Rpb24odGFyZ2V0LCBhcmdzLCBuZXdUYXJnZXQpIHtcbiAgICAvLyByZXR1cm4gbmV3IHRhcmdldCguLi5hcmdzKTtcblxuICAgIC8vIGlmIHRhcmdldCBpcyBhIHByb3h5LCBpbnZva2UgaXRzIFwiY29uc3RydWN0XCIgdHJhcFxuICAgIHZhciBoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQodGFyZ2V0KTtcbiAgICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gaGFuZGxlci5jb25zdHJ1Y3QoaGFuZGxlci50YXJnZXQsIGFyZ3MsIG5ld1RhcmdldCk7XG4gICAgfVxuICAgIFxuICAgIGlmICh0eXBlb2YgdGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJ0YXJnZXQgaXMgbm90IGEgZnVuY3Rpb246IFwiICsgdGFyZ2V0KTtcbiAgICB9XG4gICAgaWYgKG5ld1RhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBuZXdUYXJnZXQgPSB0YXJnZXQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0eXBlb2YgbmV3VGFyZ2V0ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm5ld1RhcmdldCBpcyBub3QgYSBmdW5jdGlvbjogXCIgKyB0YXJnZXQpO1xuICAgICAgfSAgICAgIFxuICAgIH1cblxuICAgIHJldHVybiBuZXcgKEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kLmFwcGx5KG5ld1RhcmdldCwgW251bGxdLmNvbmNhdChhcmdzKSkpO1xuICB9XG59O1xuXG4vLyBmZWF0dXJlLXRlc3Qgd2hldGhlciB0aGUgUHJveHkgZ2xvYmFsIGV4aXN0cywgd2l0aFxuLy8gdGhlIGhhcm1vbnktZXJhIFByb3h5LmNyZWF0ZSBBUElcbmlmICh0eXBlb2YgUHJveHkgIT09IFwidW5kZWZpbmVkXCIgJiZcbiAgICB0eXBlb2YgUHJveHkuY3JlYXRlICE9PSBcInVuZGVmaW5lZFwiKSB7XG5cbiAgdmFyIHByaW1DcmVhdGUgPSBQcm94eS5jcmVhdGUsXG4gICAgICBwcmltQ3JlYXRlRnVuY3Rpb24gPSBQcm94eS5jcmVhdGVGdW5jdGlvbjtcblxuICB2YXIgcmV2b2tlZEhhbmRsZXIgPSBwcmltQ3JlYXRlKHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwicHJveHkgaXMgcmV2b2tlZFwiKTsgfVxuICB9KTtcblxuICBnbG9iYWwuUHJveHkgPSBmdW5jdGlvbih0YXJnZXQsIGhhbmRsZXIpIHtcbiAgICAvLyBjaGVjayB0aGF0IHRhcmdldCBpcyBhbiBPYmplY3RcbiAgICBpZiAoT2JqZWN0KHRhcmdldCkgIT09IHRhcmdldCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByb3h5IHRhcmdldCBtdXN0IGJlIGFuIE9iamVjdCwgZ2l2ZW4gXCIrdGFyZ2V0KTtcbiAgICB9XG4gICAgLy8gY2hlY2sgdGhhdCBoYW5kbGVyIGlzIGFuIE9iamVjdFxuICAgIGlmIChPYmplY3QoaGFuZGxlcikgIT09IGhhbmRsZXIpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcm94eSBoYW5kbGVyIG11c3QgYmUgYW4gT2JqZWN0LCBnaXZlbiBcIitoYW5kbGVyKTtcbiAgICB9XG5cbiAgICB2YXIgdkhhbmRsZXIgPSBuZXcgVmFsaWRhdG9yKHRhcmdldCwgaGFuZGxlcik7XG4gICAgdmFyIHByb3h5O1xuICAgIGlmICh0eXBlb2YgdGFyZ2V0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHByb3h5ID0gcHJpbUNyZWF0ZUZ1bmN0aW9uKHZIYW5kbGVyLFxuICAgICAgICAvLyBjYWxsIHRyYXBcbiAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgIHJldHVybiB2SGFuZGxlci5hcHBseSh0YXJnZXQsIHRoaXMsIGFyZ3MpO1xuICAgICAgICB9LFxuICAgICAgICAvLyBjb25zdHJ1Y3QgdHJhcFxuICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgcmV0dXJuIHZIYW5kbGVyLmNvbnN0cnVjdCh0YXJnZXQsIGFyZ3MpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJveHkgPSBwcmltQ3JlYXRlKHZIYW5kbGVyLCBPYmplY3QuZ2V0UHJvdG90eXBlT2YodGFyZ2V0KSk7XG4gICAgfVxuICAgIGRpcmVjdFByb3hpZXMuc2V0KHByb3h5LCB2SGFuZGxlcik7XG4gICAgcmV0dXJuIHByb3h5O1xuICB9O1xuXG4gIGdsb2JhbC5Qcm94eS5yZXZvY2FibGUgPSBmdW5jdGlvbih0YXJnZXQsIGhhbmRsZXIpIHtcbiAgICB2YXIgcHJveHkgPSBuZXcgUHJveHkodGFyZ2V0LCBoYW5kbGVyKTtcbiAgICB2YXIgcmV2b2tlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgdkhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldChwcm94eSk7XG4gICAgICBpZiAodkhhbmRsZXIgIT09IG51bGwpIHtcbiAgICAgICAgdkhhbmRsZXIudGFyZ2V0ICA9IG51bGw7XG4gICAgICAgIHZIYW5kbGVyLmhhbmRsZXIgPSByZXZva2VkSGFuZGxlcjtcbiAgICAgIH1cbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfTtcbiAgICByZXR1cm4ge3Byb3h5OiBwcm94eSwgcmV2b2tlOiByZXZva2V9O1xuICB9XG4gIFxuICAvLyBhZGQgdGhlIG9sZCBQcm94eS5jcmVhdGUgYW5kIFByb3h5LmNyZWF0ZUZ1bmN0aW9uIG1ldGhvZHNcbiAgLy8gc28gb2xkIGNvZGUgdGhhdCBzdGlsbCBkZXBlbmRzIG9uIHRoZSBoYXJtb255LWVyYSBQcm94eSBvYmplY3RcbiAgLy8gaXMgbm90IGJyb2tlbi4gQWxzbyBlbnN1cmVzIHRoYXQgbXVsdGlwbGUgdmVyc2lvbnMgb2YgdGhpc1xuICAvLyBsaWJyYXJ5IHNob3VsZCBsb2FkIGZpbmVcbiAgZ2xvYmFsLlByb3h5LmNyZWF0ZSA9IHByaW1DcmVhdGU7XG4gIGdsb2JhbC5Qcm94eS5jcmVhdGVGdW5jdGlvbiA9IHByaW1DcmVhdGVGdW5jdGlvbjtcblxufSBlbHNlIHtcbiAgLy8gUHJveHkgZ2xvYmFsIG5vdCBkZWZpbmVkLCBvciBvbGQgQVBJIG5vdCBhdmFpbGFibGVcbiAgaWYgKHR5cGVvZiBQcm94eSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIC8vIFByb3h5IGdsb2JhbCBub3QgZGVmaW5lZCwgYWRkIGEgUHJveHkgZnVuY3Rpb24gc3R1YlxuICAgIGdsb2JhbC5Qcm94eSA9IGZ1bmN0aW9uKF90YXJnZXQsIF9oYW5kbGVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJwcm94aWVzIG5vdCBzdXBwb3J0ZWQgb24gdGhpcyBwbGF0Zm9ybS4gT24gdjgvbm9kZS9pb2pzLCBtYWtlIHN1cmUgdG8gcGFzcyB0aGUgLS1oYXJtb255X3Byb3hpZXMgZmxhZ1wiKTtcbiAgICB9O1xuICB9XG4gIC8vIFByb3h5IGdsb2JhbCBkZWZpbmVkIGJ1dCBvbGQgQVBJIG5vdCBhdmFpbGFibGVcbiAgLy8gcHJlc3VtYWJseSBQcm94eSBnbG9iYWwgYWxyZWFkeSBzdXBwb3J0cyBuZXcgQVBJLCBsZWF2ZSB1bnRvdWNoZWRcbn1cblxuLy8gZm9yIG5vZGUuanMgbW9kdWxlcywgZXhwb3J0IGV2ZXJ5IHByb3BlcnR5IGluIHRoZSBSZWZsZWN0IG9iamVjdFxuLy8gYXMgcGFydCBvZiB0aGUgbW9kdWxlIGludGVyZmFjZVxuaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICBPYmplY3Qua2V5cyhSZWZsZWN0KS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBleHBvcnRzW2tleV0gPSBSZWZsZWN0W2tleV07XG4gIH0pO1xufVxuXG4vLyBmdW5jdGlvbi1hcy1tb2R1bGUgcGF0dGVyblxufSh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOiB0aGlzKSk7Il19
