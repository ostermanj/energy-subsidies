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

        // TO DO: SEPARATE KEY VALUES AND NESTING INTO SEPARATE FUNCTIONS     
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
            }) !== undefined ? this.dictionary.find(function (each) {
                return each.key === key;
            }).label : '';
        },
        description: function description(key) {
            console.log(this.dictionary, key);
            return this.dictionary.find(function (each) {
                return each.key === key;
            }) !== undefined ? this.dictionary.find(function (each) {
                return each.key === key;
            }).description : '';
        },
        unitsDescription: function unitsDescription(key) {
            return this.dictionary.find(function (each) {
                return each.key === key;
            }) !== undefined ? this.dictionary.find(function (each) {
                return each.key === key;
            }).units_description : '';
        },
        units: function units(key) {
            return this.dictionary.find(function (each) {
                return each.key === key;
            }) !== undefined ? this.dictionary.find(function (each) {
                return each.key === key;
            }).units : '';
        },
        tipText: function tipText(key) {
            var str = this.dictionary.find(function (each) {
                return each.key === key;
            }).label.replace(/\\n/g, ' ');
            return str !== undefined ? str.charAt(0).toUpperCase() + str.slice(1) : '';
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
            var eachSeries = this.potentialSeries.selectAll('g.each-series.' + this.config.variableY).data(function (d) {
                console.log(d);
                var rtn = d.values.find(function (each) {
                    return each.key === _this6.config.variableY;
                });
                return rtn !== undefined ? [rtn] : []; // need to acct for possibility
                // that the series is absent given the 
                // config.variableY. if find() returns
                // undefined, data should be empty array
            } /*, d => {
                 console.log(d.values[0].series); 
                 return d.values[0].series; 
              }*/);

            // update existing
            eachSeries.classed('enter', false).classed('update', true);

            // clear exiting
            eachSeries.exit().transition().duration(500).style('opacity', 0).remove();

            var entering = eachSeries.enter().append('g').attr('class', function (d) {
                return d.values[0].series + ' each-series ' + _this6.config.variableY;
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
                console.log(each, _this8);
                xMaxes.push(_this8.parent.parent.summaries[_this8.parent.parent.summaries.length - 2][_this8.config.category][each.key].x.max);
                xMins.push(_this8.parent.parent.summaries[_this8.parent.parent.summaries.length - 2][_this8.config.category][each.key].x.min);
                if (_this8.parent.parent.properties.length > 0) {
                    yVariables.forEach(function (yVar) {
                        if (_this8.parent.parent.summaries[0][_this8.config.category][each.key][yVar] !== undefined) {
                            // need to acct for poss
                            // that the yVar does not exist in 
                            // the specified series
                            yMaxes.push(_this8.parent.parent.summaries[0][_this8.config.category][each.key][yVar].y.max);
                            yMins.push(_this8.parent.parent.summaries[0][_this8.config.category][each.key][yVar].y.min);
                        }
                    });
                } else {
                    yMaxes.push(_this8.parent.parent.summaries[0][_this8.config.category][each.key].y.max);
                    yMins.push(_this8.parent.parent.summaries[0][_this8.config.category][each.key].y.min);
                }
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
            console.log(xAxisPosition, xAxisOffset);
            var axis = axisType(this.xScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1);
            if (this.xScaleType === 'time') {
                axis.tickValues(this.xValuesUnique.map(function (each) {
                    return d3.timeParse(_this11.xTimeType)(each);
                })); // TO DO: allow for other xAxis Adjustments
            }
            this.xAxisGroup.attr('transform', 'translate(0,' + (this.yScale(xAxisPosition) + xAxisOffset) + ')') // not programatic placement of x-axis
            .attr('class', 'axis x-axis').call(axis);

            d3.select(this.xAxisGroup.selectAll('g.tick').nodes()[0]).classed('first-tick', true);
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

/* NodeList.prototype.forEach
https://developer.mozilla.org/en-US/docs/Web/API/NodeList/forEach
*/

var NodeListForEach = exports.NodeListForEach = function () {
  if (window.NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = function (callback, thisArg) {
      thisArg = thisArg || window;
      for (var i = 0; i < this.length; i++) {
        callback.call(thisArg, this[i], i, this);
      }
    };
  }
}();

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvc2NyaXB0cy5lczYiLCJqcy1leHBvcnRzL0NoYXJ0cy5qcyIsImpzLWV4cG9ydHMvSGVscGVycy5qcyIsImpzLXZlbmRvci9kMy10aXAuanMiLCJqcy12ZW5kb3IvcG9seWZpbGxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNZQTs7QUFDQTs7QUFDQTs7QUFDQTs7b01BZkMsbUYsQ0FBb0Y7QUFDcEY7OztBQUdEOzs7Ozs7Ozs7O0FBYUEsSUFBSSxXQUFZLFlBQVU7O0FBRTFCOztBQUVJLFFBQUksa0JBQWtCLEVBQXRCO0FBQ0EsUUFBSSxlQUFlLFNBQWYsWUFBZSxDQUFTLFNBQVQsRUFBb0IsS0FBcEIsRUFBMEI7QUFBQTs7QUFDekMsYUFBSyxTQUFMLEdBQWlCLFNBQWpCO0FBQ0EsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssTUFBTCxHQUFjLFVBQVUsT0FBVixDQUFrQixPQUFsQixFQUFkLENBSHlDLENBR0U7O0FBRTNDLGFBQUssWUFBTCxHQUFvQixLQUFLLGtCQUFMLEVBQXBCO0FBQ0EsYUFBSyxRQUFMLEdBQWdCLEVBQWhCO0FBQ0EsYUFBSyxVQUFMLEdBQWtCLEVBQWxCO0FBQ0EsYUFBSyxVQUFMLEdBQWtCLEVBQWxCO0FBQ0EsYUFBSyxZQUFMLENBQWtCLElBQWxCLENBQXVCLFlBQU07QUFBRTtBQUMzQixrQkFBSyxnQkFBTCxDQUFzQixTQUF0QixFQUFpQyxLQUFqQztBQUNILFNBRkQ7QUFHSCxLQVpEO0FBYUE7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBRWpCLDBCQUZpQixnQ0FFRztBQUFBOztBQUFFO0FBQ0E7QUFDQTtBQUNsQixnQkFBSSxlQUFlLEVBQW5CO0FBQ0EsZ0JBQUksVUFBVSxLQUFLLE1BQUwsQ0FBWSxPQUExQjtBQUFBLGdCQUNJLE9BQU8sQ0FBQyxLQUFLLE1BQUwsQ0FBWSxPQUFiLEVBQXFCLEtBQUssTUFB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QixRQUFsQixFQUE0QjtBQUN6QyxjQUFNLElBQUksS0FBSixDQUFVLHVHQUFWLENBQU47QUFDRCxPQUZEO0FBR0Q7QUFDRDtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBLE1BQUksT0FBTyxPQUFQLEtBQW1CLFdBQXZCLEVBQW9DO0FBQ2xDLFdBQU8sSUFBUCxDQUFZLE9BQVosRUFBcUIsT0FBckIsQ0FBNkIsVUFBVSxHQUFWLEVBQWU7QUFDMUMsY0FBUSxHQUFSLElBQWUsUUFBUSxHQUFSLENBQWY7QUFDRCxLQUZEO0FBR0Q7O0FBRUQ7QUFDQyxDQXBpRXVCLENBb2lFdEIsT0FBTyxPQUFQLEtBQW1CLFdBQW5CLEdBQWlDLE1BQWpDLFlBcGlFc0IsQ0FBakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiIC8qIGV4cG9ydGVkIEQzQ2hhcnRzLCBIZWxwZXJzLCBkM1RpcCwgcmVmbGVjdCwgYXJyYXlGaW5kLCBTVkdJbm5lckhUTUwsIFNWR0ZvY3VzICovIC8vIGxldCdzIGpzaGludCBrbm93IHRoYXQgRDNDaGFydHMgY2FuIGJlIFwiZGVmaW5lZCBidXQgbm90IHVzZWRcIiBpbiB0aGlzIGZpbGVcbiAvKiBwb2x5ZmlsbHMgbmVlZGVkOiBQcm9taXNlLCBBcnJheS5pc0FycmF5LCBBcnJheS5maW5kLCBBcnJheS5maWx0ZXIsIFJlZmxlY3QsIE9iamVjdC5vd25Qcm9wZXJ0eURlc2NyaXB0b3JzXG4gKi9cblxuLypcbmluaXRpYWxpemVkIGJ5IHdpbmRvd3MuRDNDaGFydHMuSW5pdCgpIHdoaWNoIGNyZWF0ZXMgYSBuZXcgRDNDaGFydEdyb3VwIGZvciBlYWNoIGRpdi5kMy1ncm91cCBpbiB0aGUgRE9NLlxuZWFjaCBkaXYncyBkYXRhIGF0dHJpYnV0ZXMgc3VwcGx5IHRoZSBjb25maWd1cmF0aW9uIG5lZWRlZC4gaW5kaXZpZHVhbCBjaGFydHMgaW5oZXJpdCBmcm9tIHRoZSBncm91cCdzIG9uZmlndXJhdGlvblxuZGF0YSBidXQgY2FuIGFsc28gc3BlY2lmeSB0aGVpciBvd24uXG5cbmdyb3VwcyBhcmUgY29sbGVjdGVkIGluIGdyb3VwQ29sbGVjdGlvbiBhcnJheSBcblxuKi8gXG5pbXBvcnQgeyByZWZsZWN0LCBhcnJheUZpbmQsIFNWR0lubmVySFRNTCwgU1ZHRm9jdXMgfSBmcm9tICcuLi9qcy12ZW5kb3IvcG9seWZpbGxzJztcbmltcG9ydCB7IEhlbHBlcnMgfSBmcm9tICcuLi9qcy1leHBvcnRzL0hlbHBlcnMnO1xuaW1wb3J0IHsgQ2hhcnRzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9DaGFydHMnO1xuaW1wb3J0IHsgZDNUaXAgfSBmcm9tICcuLi9qcy12ZW5kb3IvZDMtdGlwJztcblxudmFyIEQzQ2hhcnRzID0gKGZ1bmN0aW9uKCl7IFxuIFxuXCJ1c2Ugc3RyaWN0XCI7ICBcbiAgICAgXG4gICAgdmFyIGdyb3VwQ29sbGVjdGlvbiA9IFtdO1xuICAgIHZhciBEM0NoYXJ0R3JvdXAgPSBmdW5jdGlvbihjb250YWluZXIsIGluZGV4KXsgXG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgICAgICB0aGlzLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIHRoaXMuY29uZmlnID0gY29udGFpbmVyLmRhdGFzZXQuY29udmVydCgpOyAvLyBtZXRob2QgcHJvdmlkZWQgaW4gSGVscGVyc1xuICAgICAgICBcbiAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMgPSB0aGlzLnJldHVybkRhdGFQcm9taXNlcygpO1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gW107IFxuICAgICAgICB0aGlzLmNvbGxlY3RBbGwgPSBbXTtcbiAgICAgICAgdGhpcy5wcm9wZXJ0aWVzID0gW107XG4gICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnRoZW4oKCkgPT4geyAvLyB3aGVuIHRoZSBkYXRhIHByb21pc2VzIHJlc29sdmUsIGNoYXJ0cyBhcmUgaW5pdGlhbGl6ZWRcbiAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNoYXJ0cyhjb250YWluZXIsIGluZGV4KTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICAvL3Byb3RvdHlwZSBiZWdpbnMgaGVyZVxuICAgIEQzQ2hhcnRHcm91cC5wcm90b3R5cGUgPSB7XG4gICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuRGF0YVByb21pc2VzKCl7IC8vIGdldHMgZGF0YSBmcm9tIEdvb2dsZSBTaGVldCwgY29udmVyc3Qgcm93cyB0byBrZXktdmFsdWUgcGFpcnMsIG5lc3RzIHRoZSBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXMgc3BlY2lmaWVkIGJ5IHRoZSBjb25maWcgb2JqZWN0LCBhbmQgY3JlYXRlcyBhcnJheSBvZiBzdW1tYXJpemVkIGRhdGEgYXQgZGlmZmVyZW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbmVzdGluZyBsZXZlbHMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBkYXRhUHJvbWlzZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgc2hlZXRJRCA9IHRoaXMuY29uZmlnLnNoZWV0SWQsIFxuICAgICAgICAgICAgICAgICAgICB0YWJzID0gW3RoaXMuY29uZmlnLmRhdGFUYWIsdGhpcy5jb25maWcuZGljdGlvbmFyeVRhYl07IC8vIHRoaXMgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaXMgdGhlcmUgYSBjYXNlIGZvciBtb3JlIHRoYW4gb25lIHNoZWV0IG9mIGRhdGE/XG4gICAgICAgICAgICAgICAgdGFicy5mb3JFYWNoKChlYWNoLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5qc29uKCdodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJyArIHNoZWV0SUQgKyAnL3ZhbHVlcy8nICsgZWFjaCArICc/a2V5PUFJemFTeUREM1c1d0plSkYyZXNmZlpNUXhOdEVsOXR0LU9mZ1NxNCcsIChlcnJvcixkYXRhKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlcyA9IGRhdGEudmFsdWVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXN0VHlwZSA9IGVhY2ggPT09ICdkaWN0aW9uYXJ5JyA/ICdvYmplY3QnIDogJ3Nlcmllcyc7IC8vIG5lc3RUeXBlIGZvciBkYXRhIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXN0QnkgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyBmYWxzZSA6IHRoaXMuY29uZmlnLm5lc3RCeTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMucmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbmVzdEJ5LCB0cnVlLCBuZXN0VHlwZSwgaSwgdGhpcy5jb25maWcubm9ybWFsaXplQ29sdW1uc1N0YXJ0KSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBkYXRhUHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBQcm9taXNlLmFsbChkYXRhUHJvbWlzZXMpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhID0gdmFsdWVzWzBdO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB2YWx1ZXNbMV07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3VtbWFyaWVzID0gdGhpcy5zdW1tYXJpemVEYXRhKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKGRhdGFQcm9taXNlcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3VtbWFyaXplRGF0YSgpeyAvLyB0aGlzIGZuIGNyZWF0ZXMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBzdW1tYXJpemluZyB0aGUgZGF0YSBpbiBtb2RlbC5kYXRhLiBtb2RlbC5kYXRhIGlzIG5lc3RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgbmVzdGluZyBhbmQgcm9sbGluZyB1cCBjYW5ub3QgYmUgZG9uZSBlYXNpbHkgYXQgdGhlIHNhbWUgdGltZSwgc28gdGhleSdyZSBkb25lIHNlcGFyYXRlbHkuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzdW1tYXJpZXMgcHJvdmlkZSBhdmVyYWdlLCBtYXgsIG1pbiBvZiBhbGwgZmllbGRzIGluIHRoZSBkYXRhIGF0IGFsbCBsZXZlbHMgb2YgbmVzdGluZy4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBmaXJzdCAoaW5kZXggMCkgaXMgb25lIGxheWVyIG5lc3RlZCwgdGhlIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgIFxuXG4gICAgICAgICAgICAgICB2YXIgc3VtbWFyaWVzID0gW107XG4gICAgICAgICAgICAgICB2YXIgbmVzdEJ5QXJyYXkgPSB0aGlzLm5lc3RCeUFycmF5Lm1hcChhID0+IGEpO1xuICAgICAgICAgICAgICAgdmFyIHZhcmlhYmxlWCA9IHRoaXMuY29uZmlnLnZhcmlhYmxlWDtcblxuICAgICAgICAgICAgICAgZnVuY3Rpb24gcmVkdWNlVmFyaWFibGVzKGQpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgeToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heDogICAgICAgZDMubWF4KGQsIGQgPT4gZC52YWx1ZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluOiAgICAgICBkMy5taW4oZCwgZCA9PiBkLnZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZWFuOiAgICAgIGQzLm1lYW4oZCwgZCA9PiBkLnZhbHVlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW06ICAgICAgIGQzLnN1bShkLCBkID0+IGQudmFsdWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lZGlhbjogICAgZDMubWVkaWFuKGQsIGQgPT4gZC52YWx1ZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFuY2U6ICBkMy52YXJpYW5jZShkLCBkID0+IGQudmFsdWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmlhdGlvbjogZDMuZGV2aWF0aW9uKGQsIGQgPT4gZC52YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB4OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4OiAgICAgICBkMy5tYXgoZCwgZCA9PiBkW3ZhcmlhYmxlWF0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbjogICAgICAgZDMubWluKGQsIGQgPT4gZFt2YXJpYWJsZVhdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZWFuOiAgICAgIGQzLm1lYW4oZCwgZCA9PiBkW3ZhcmlhYmxlWF0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1bTogICAgICAgZDMuc3VtKGQsIGQgPT4gZFt2YXJpYWJsZVhdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZWRpYW46ICAgIGQzLm1lZGlhbihkLCBkID0+IGRbdmFyaWFibGVYXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFuY2U6ICBkMy52YXJpYW5jZShkLCBkID0+IGRbdmFyaWFibGVYXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWF0aW9uOiBkMy5kZXZpYXRpb24oZCwgZCA9PiBkW3ZhcmlhYmxlWF0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgIHdoaWxlICggbmVzdEJ5QXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgc3VtbWFyaXplZCA9IHRoaXMubmVzdFByZWxpbShuZXN0QnlBcnJheSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yb2xsdXAocmVkdWNlVmFyaWFibGVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh0aGlzLnVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICAgICAgc3VtbWFyaWVzLnB1c2goc3VtbWFyaXplZCk7ICAgICAgXG4gICAgICAgICAgICAgICAgICAgIG5lc3RCeUFycmF5LnBvcCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VtbWFyaWVzO1xuICAgICAgICAgICAgfSwgXG4gICAgICAgICAgICBuZXN0UHJlbGltKG5lc3RCeUFycmF5KXtcbiAgICAgICAgICAgICAgICAvLyByZWN1cnNpdmUgIG5lc3RpbmcgZnVuY3Rpb24gdXNlZCBieSBzdW1tYXJpemVEYXRhIGFuZCByZXR1cm5LZXlWYWx1ZXNcbiAgICAgICAgICAgICAgICByZXR1cm4gbmVzdEJ5QXJyYXkucmVkdWNlKChhY2MsIGN1cikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ciAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGN1ciAhPT0gJ2Z1bmN0aW9uJyApIHsgdGhyb3cgJ2VhY2ggbmVzdEJ5IGl0ZW0gbXVzdCBiZSBhIHN0cmluZyBvciBmdW5jdGlvbic7IH1cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJ0bjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnc3RyaW5nJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZFtjdXJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7ICAgIFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ2Z1bmN0aW9uJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VyKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBydG47XG4gICAgICAgICAgICAgICAgfSwgZDMubmVzdCgpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXR1cm5Ob3JtYWxpemVkVmFsdWVzKHZhbHVlcywgc3RhcnQpe1xuXG4gICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICB2YXIgbmV3Um93c0FycmF5ID0gW1suLi52YWx1ZXNbMF0uc2xpY2UoMCxzdGFydCksICdwcm9wZXJ0eScsJ3ZhbHVlJ11dO1xuICAgICAgICAgICAgICAgIHZhbHVlcy5zbGljZSgxKS5mb3JFYWNoKHJvdyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXBlYXQgPSByb3cuc2xpY2UoMCxzdGFydCk7XG4gICAgICAgICAgICAgICAgICAgIHJvdy5zbGljZShzdGFydCkuZm9yRWFjaCgodmFsdWUsIGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXdSb3cgPSBbLi4ucmVwZWF0LCB2YWx1ZXNbMF1baSArIHN0YXJ0XSwgdmFsdWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCB2YWx1ZSAhPT0gXCJcIiApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1Jvd3NBcnJheS5wdXNoKG5ld1Jvdyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pOyAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3Um93c0FycmF5O1xuICAgICAgICAgICAgfSwgIFxuICAgICAgICAgICAgLy8gVE8gRE86IFNFUEFSQVRFIEtFWSBWQUxVRVMgQU5EIE5FU1RJTkcgSU5UTyBTRVBBUkFURSBGVU5DVElPTlMgICAgIFxuICAgICAgICAgICAgcmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbmVzdEJ5LCBjb2VyY2UgPSBmYWxzZSwgbmVzdFR5cGUgPSAnc2VyaWVzJywgdGFiSW5kZXggPSAwLCBub3JtYWxpemVDb2x1bW5zU3RhcnQgPSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgLy8gdGhpcyBmbiB0YWtlcyBub3JtYWxpemVkIGRhdGEgZmV0Y2hlZCBhcyBhbiBhcnJheSBvZiByb3dzIGFuZCB1c2VzIHRoZSB2YWx1ZXMgaW4gdGhlIGZpcnN0IHJvdyBhcyBrZXlzIGZvciB2YWx1ZXMgaW5cbiAgICAgICAgICAgIC8vIHN1YnNlcXVlbnQgcm93c1xuICAgICAgICAgICAgLy8gbmVzdEJ5ID0gc3RyaW5nIG9yIGFycmF5IG9mIGZpZWxkKHMpIHRvIG5lc3QgYnksIG9yIGEgY3VzdG9tIGZ1bmN0aW9uLCBvciBhbiBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucztcbiAgICAgICAgICAgIC8vIGNvZXJjZSA9IEJPT0wgY29lcmNlIHRvIG51bSBvciBub3Q7IG5lc3RUeXBlID0gb2JqZWN0IG9yIHNlcmllcyBuZXN0IChkMylcbiAgICAgICAgICAgICAgICB2YXIgcHJlbGltO1xuICAgICAgICAgICAgICAgIGlmICggbm9ybWFsaXplQ29sdW1uc1N0YXJ0ICE9PSB1bmRlZmluZWQgJiYgdGFiSW5kZXggPT09IDAgKSAge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZXMgPSB0aGlzLnJldHVybk5vcm1hbGl6ZWRWYWx1ZXModmFsdWVzLCBub3JtYWxpemVDb2x1bW5zU3RhcnQpO1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgdmFyIHVubmVzdGVkID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZSgoYWNjLCBjdXIsIGkpID0+IHsgXG4gICAgICAgICAgICAgICAgaWYgKCB2YWx1ZXNbMF1baV0gPT09ICdwcm9wZXJ0eScgJiYgdGhpcy5wcm9wZXJ0aWVzLmluZGV4T2YoY3VyKSA9PT0gLTEgKXtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9wZXJ0aWVzLnB1c2goY3VyKTsgLy8gdXNlIHRoaXMgYXJyYXkgaW4gdGhlIHNldFNjYWxlcyBmbiBvZiBjaGFydC5qc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgICAvLyAzLiAvLyBhY2MgaXMgYW4gb2JqZWN0ICwga2V5IGlzIGNvcnJlc3BvbmRpbmcgdmFsdWUgZnJvbSByb3cgMCwgdmFsdWUgaXMgY3VycmVudCB2YWx1ZSBvZiBhcnJheVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGFjY1t2YWx1ZXNbMF1baV1dID0gY29lcmNlID09PSB0cnVlID8gaXNOYU4oK2N1cikgfHwgY3VyID09PSAnJyA/IGN1ciA6ICtjdXIgOiBjdXI7IFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0IGZvciBlbXB0eSBzdHJpbmdzIGJlZm9yZSBjb2VyY2luZyBiYyArJycgPT4gMFxuICAgICAgICAgICAgICAgIH0sIHt9KSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCB0YWJJbmRleCA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51bm5lc3RlZCA9IHVubmVzdGVkO1xuICAgICAgICAgICAgICAgIH0gICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICggIW5lc3RCeSApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgbmVzdEJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbmVzdEJ5ID09PSAnZnVuY3Rpb24nICkgeyAvLyBpZSBvbmx5IG9uZSBuZXN0QnkgZmllbGQgb3IgZnVuY2l0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubmVzdEJ5QXJyYXkgPSBbbmVzdEJ5XTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5uZXN0QnlBcnJheSA9IG5lc3RCeTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSB0aGlzLm5lc3RQcmVsaW0odGhpcy5uZXN0QnlBcnJheSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICggbmVzdFR5cGUgPT09ICdvYmplY3QnICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRyaWVzKHVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5pdGlhbGl6ZUNoYXJ0cyhjb250YWluZXIsIGluZGV4KXtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgZ3JvdXAgPSB0aGlzO1xuICAgICAgICAgICAgICAgIGQzLnNlbGVjdEFsbCgnLmQzLWNoYXJ0Lmdyb3VwLScgKyBpbmRleCkgLy8gc2VsZWN0IGFsbCBgZGl2LmQzLWNoYXJ0YHMgdGhhdCBhcmUgYXNzb2NpYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2l0aCB0aGUgZ3JvdXAgYnkgY2xhc3NuYW1lIFwiZ3JvdXAtXCIgKyBpbmRleCBcbiAgICAgICAgICAgICAgICAgICAgLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyb3VwLmNoaWxkcmVuLnB1c2gobmV3IENoYXJ0cy5DaGFydERpdih0aGlzLCBncm91cCkpOyAvLyBjb25zdHJ1Y3RvciBwcm92aWRlZCBpbiBDaGFydHNcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9ICAgICAgICBcbiAgICB9OyAvLyBEM0NoYXJ0R3JvdXAgcHJvdG90eXBlIGVuZHMgaGVyZVxuICAgIFxuICAgIC8qIFBVQkxJQyBBUEkgKi9cbiAgICB3aW5kb3cuRDNDaGFydHMgPSB7IC8vIG5lZWQgdG8gc3BlY2lmeSB3aW5kb3cgYmMgYWZ0ZXIgdHJhbnNwaWxpbmcgYWxsIHRoaXMgd2lsbCBiZSB3cmFwcGVkIGluIElJRkVzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgYHJldHVybmBpbmcgd29uJ3QgZ2V0IHRoZSBleHBvcnQgaW50byB3aW5kb3cncyBnbG9iYWwgc2NvcGVcbiAgICAgICAgSW5pdCgpe1xuICAgICAgICAgICAgdmFyIGdyb3VwRGl2cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5kMy1ncm91cCcpO1xuICAgICAgICAgICAgZm9yICggbGV0IGkgPSAwOyBpIDwgZ3JvdXBEaXZzLmxlbmd0aDsgaSsrICl7XG4gICAgICAgICAgICAgICAgZ3JvdXBDb2xsZWN0aW9uLnB1c2gobmV3IEQzQ2hhcnRHcm91cChncm91cERpdnNbaV0sIGkpKTtcbiAgICAgICAgICAgIH0gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb250YWluZXIsIGluZGV4IFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBcbiAgICAgICAgfSxcbiAgICAgICAgY29sbGVjdEFsbDpbXSxcbiAgICAgICAgVXBkYXRlQWxsKHZhcmlhYmxlWSl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdEFsbC5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgIGVhY2gudXBkYXRlKHZhcmlhYmxlWSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgVXBkYXRlR3JvdXAoaW5kZXgsdmFyaWFibGVZKXtcbiAgICAgICAgICAgIGdyb3VwQ29sbGVjdGlvbltpbmRleF0uY29sbGVjdEFsbC5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgIGVhY2gudXBkYXRlKHZhcmlhYmxlWSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59KCkpOyAvLyBlbmQgdmFyIEQzQ2hhcnRzIElJRkUiLCJleHBvcnQgY29uc3QgQ2hhcnRzID0gKGZ1bmN0aW9uKCl7ICAgIFxuICAgIC8qIGdsb2JhbHMgRDNDaGFydHMgKi9cblxuICAgIHZhciBDaGFydERpdiA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgcGFyZW50KXsgLy8gY29uc3RydWN0b3IgY2FsbGVkIGZyb20gc2NyaXB0cyBvbmNlIGZvciBlYWNoIGRpdi5kMy1jaGFydFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW4gdGhlIERPTS4gY29udGFpbmVyIGlzIHRoZSBET00gZWxlbWVudDsgcGFyZW50IGlzIHRoZSBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEQzQ2hhcnRHcm91cCB0byB3aGljaCBpdCBiZWxvbmdzXG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgICAgICB0aGlzLnNlcmllc0NvdW50ID0gMDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBPYmplY3QuY3JlYXRlKCBwYXJlbnQuY29uZmlnLCBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyggY29udGFpbmVyLmRhdGFzZXQuY29udmVydCgpICkgKTtcbiAgICAgICAgICAgIC8vIGxpbmUgYWJvdmUgY3JlYXRlcyBhIGNvbmZpZyBvYmplY3QgZnJvbSB0aGUgSFRNTCBkYXRhc2V0IGZvciB0aGUgY2hhcnREaXYgY29udGFpbmVyXG4gICAgICAgICAgICAvLyB0aGF0IGluaGVyaXRzIGZyb20gdGhlIHBhcmVudHMgY29uZmlnIG9iamVjdC4gYW55IGNvbmZpZ3Mgbm90IHNwZWNpZmllZCBmb3IgdGhlIGNoYXJ0RGl2IChhbiBvd24gcHJvcGVydHkpXG4gICAgICAgICAgICAvLyB3aWxsIGNvbWUgZnJvbSB1cCB0aGUgaW5oZXJpdGFuY2UgY2hhaW5cbiAgICAgICAgdGhpcy5kYXR1bSA9IHBhcmVudC5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gdGhpcy5jb25maWcuY2F0ZWdvcnkpOyBcbiAgICAgICAgICAgIC8vIHBhcmVudC5kYXRhIGlzIHRoZSBlbnRpcmUgZGF0YXNldCBmcm9tIHRoZSBHb29nbGUgU2hlZXQuIGxpbmUgYWJvdmUgc2VsZWN0cyBmcm9tIHRoYXQgZGF0YXNldCB0aGUgb2JqZWN0XG4gICAgICAgICAgICAvLyBtYXRjaGluZyB0aGUgY2F0ZWdvcnkgc3BlY2lmaWVkIGZvciB0aGUgY3VycmVudCBDaGFydERpdi4gaGVyZSBpcyB3aHkgdGhlIGRhdGEgaGFzIHRvIGJlIG5lc3RlZCBmaXJzdCBieSBcbiAgICAgICAgICAgIC8vIHRoZSBjYXRlZ29yeVxuXG4gICAgICAgICAgICAvKiByZW1vdmUgc2VyaWVzSW5zdHJ1Y3QgYmMgZ3JvdXBTZXJpZXMgY2FuIGhhbmRsZSBpdCAqL1xuXG5cbiAgICAgICAgdGhpcy5ncm91cGVkU2VyaWVzRGF0YSA9IHRoaXMuZ3JvdXBTZXJpZXMoKTsgLy8gb3JnYW5pemVzIGRhdGEgYWNjIHRvIGluc3RydWN0aW9uIHJlIGdyb3VwaW5nIHNlcmllcyAgXG4gICAgICAgIFxuICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB0aGlzLnBhcmVudC5kaWN0aW9uYXJ5O1xuICAgICAgICBpZiAoIHRoaXMuY29uZmlnLmhlYWRpbmcgIT09IGZhbHNlICl7XG4gICAgICAgICAgICB0aGlzLmFkZEhlYWRpbmcodGhpcy5jb25maWcuaGVhZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgZDMuc2VsZWN0KHRoaXMuY29udGFpbmVyKS5hcHBlbmQoJ2RpdicpO1xuICAgICAgICB0aGlzLmNyZWF0ZUNoYXJ0cygpOyAvLyBhIG5ldyBDaGFydCBmb3IgZWFjaCBncm91cGVkIHNlcmllc1xuICAgICAgfTtcblxuICAgIENoYXJ0RGl2LnByb3RvdHlwZSA9IHtcblxuICAgICAgICBjaGFydFR5cGVzOiB7IFxuICAgICAgICAgICAgbGluZTogICAnTGluZUNoYXJ0JyxcbiAgICAgICAgICAgIGNvbHVtbjogJ0NvbHVtbkNoYXJ0JyxcbiAgICAgICAgICAgIGJhcjogICAgJ0JhckNoYXJ0JyAvLyBzbyBvbiAuIC4gLlxuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVDaGFydHMoKXtcbiAgICAgICAgICAgIHRoaXMuZ3JvdXBlZFNlcmllc0RhdGEuZm9yRWFjaCgoZWFjaCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChuZXcgTGluZUNoYXJ0KHRoaXMsIGVhY2gpKTsgLy8gVE8gRE8gZGlzdGluZ3Vpc2ggY2hhcnQgdHlwZXMgaGVyZVxuICAgICAgICAgICAgfSk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBhcmVudCwgZGF0YSAgIFxuICAgICAgICB9LFxuICAgICAgICBncm91cFNlcmllcygpeyAvLyB0YWtlcyB0aGUgZGF0dW0gZm9yIHRoZSBjaGFydERpdiAodGhlIGRhdGEgbWF0Y2hpbmcgdGhlIHNwZWNpZmllZCBjYXRlZ29yeSlcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIG9yZ2FuaXplcyB0aGUgc2VyaWVzIGFjY29yZGluZyB0aGUgc2VyaWVzR3JvdXAgaW5zdHJ1Y3Rpb25zIGZyb20gdGhlIGRhdGEgYXR0cmlidXRlcyBcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gJ2FsbCcgcHV0cyBhbGwgc2VyaWVzIHRvZ2V0aGVyIGluIG9uZSBhcnJheSB3aXRoIGNvbnNlcXVlbmNlIG9mIGFsbCBzZXJpZXMgYmVpbmcgcmVuZGVyZWRcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gaW4gdGhlIHNhbWUgU1ZHLiAgJ25vbmUnIHB1dHMgZWFjaCBzZXJpZXMgaW4gaXRzIG93biBhcnJheTsgZWFjaCBpcyByZW5kZXJlZCBpbiBpdHMgb3duIFNWRztcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgYW4gYXJyYXkgb2YgYXJyYXlzIGlzIHNwZWNpZmllZCBpbiB0aGUgY29uZmlndXJhdGlvbiBmb3IgdGhlIENoYXJ0RGl2LCB0aGUgZ3JvdXBlZCBzZXJpZXNcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJlIHJlbmRlcmVkIHRvZ2V0aGVyLlxuICAgICAgICAgICAgdmFyIHNlcmllc0dyb3VwcyxcbiAgICAgICAgICAgICAgICBncm91cHNJbnN0cnVjdCA9IHRoaXMuY29uZmlnLnNlcmllc0dyb3VwIHx8ICdub25lJztcbiAgICAgICAgICAgIGlmICggQXJyYXkuaXNBcnJheSggZ3JvdXBzSW5zdHJ1Y3QgKSApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5zZXJpZXNHcm91cC5mb3JFYWNoKGdyb3VwID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzLnB1c2godGhpcy5kYXR1bS52YWx1ZXMuZmlsdGVyKHNlcmllcyA9PiBncm91cC5pbmRleE9mKHNlcmllcy5rZXkpICE9PSAtMSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdub25lJyApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSB0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBbZWFjaF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdhbGwnICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFt0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBlYWNoKV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBJbnZhbGlkIGRhdGEtZ3JvdXAtc2VyaWVzIGluc3RydWN0aW9uIGZyb20gaHRtbC4gXG4gICAgICAgICAgICAgICAgICAgICAgIE11c3QgYmUgdmFsaWQgSlNPTjogXCJOb25lXCIgb3IgXCJBbGxcIiBvciBhbiBhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICBvZiBhcnJheXMgY29udGFpbmluZyB0aGUgc2VyaWVzIHRvIGJlIGdyb3VwZWRcbiAgICAgICAgICAgICAgICAgICAgICAgdG9nZXRoZXIuIEFsbCBzdHJpbmdzIG11c3QgYmUgZG91YmxlLXF1b3RlZC5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHNlcmllc0dyb3VwcztcbiAgICAgICAgfSwgLy8gZW5kIGdyb3VwU2VyaWVzKClcbiAgICAgICAgYWRkSGVhZGluZyhpbnB1dCl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBoZWFkaW5nID0gZDMuc2VsZWN0KHRoaXMuY29udGFpbmVyKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3AnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ3JlbGF0aXZlJylcbiAgICAgICAgICAgICAgICAuaHRtbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBoZWFkaW5nID0gdHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJyA/IGlucHV0IDogdGhpcy5sYWJlbCh0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nICsgaGVhZGluZyArICc8L3N0cm9uZz4nO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgdmFyIGxhYmVsVG9vbHRpcCA9IGQzLnRpcCgpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcImQzLXRpcCBsYWJlbC10aXBcIilcbiAgICAgICAgICAgICAgICAuZGlyZWN0aW9uKCdzJylcbiAgICAgICAgICAgICAgICAub2Zmc2V0KFs0LCAwXSlcbiAgICAgICAgICAgICAgICAuaHRtbCh0aGlzLmRlc2NyaXB0aW9uKHRoaXMuY29uZmlnLmNhdGVnb3J5KSk7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG1vdXNlb3Zlcigpe1xuICAgICAgICAgICAgICAgIGlmICggd2luZG93Lm9wZW5Ub29sdGlwICkge1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAuaGlkZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsYWJlbFRvb2x0aXAuc2hvdygpO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcCA9IGxhYmVsVG9vbHRpcDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCB0aGlzLmRlc2NyaXB0aW9uKHRoaXMuY29uZmlnLmNhdGVnb3J5KSAhPT0gdW5kZWZpbmVkICYmIHRoaXMuZGVzY3JpcHRpb24odGhpcy5jb25maWcuY2F0ZWdvcnkpICE9PSAnJyApe1xuICAgICAgICAgICAgICAgIGhlYWRpbmcuaHRtbChoZWFkaW5nLmh0bWwoKSArICc8c3ZnIGZvY3VzYWJsZT1cImZhbHNlXCIgY2xhc3M9XCJpbmxpbmUgaGVhZGluZy1pbmZvXCI+PGEgZm9jdXNhYmxlPVwidHJ1ZVwiIHRhYmluZGV4PVwiMFwiIHhsaW5rOmhyZWY9XCIjXCI+PHRleHQgeD1cIjRcIiB5PVwiMTJcIiBjbGFzcz1cImluZm8tbWFya1wiPj88L3RleHQ+PC9hPjwvc3ZnPicpO1xuXG4gICAgICAgICAgICAgICAgaGVhZGluZy5zZWxlY3QoJy5oZWFkaW5nLWluZm8gYScpXG4gICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdoYXMtdG9vbHRpcCcsIHRydWUpXG4gICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9jdXMoKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLm9uKCdmb2N1cycsICgpID0+IHsgIFxuICAgICAgICAgICAgICAgICAgICAgICAgbW91c2VvdmVyLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdXQnLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5ibHVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL3RoaXMuc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsJ3RydWUnKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLm9uKCdibHVyJywgbGFiZWxUb29sdGlwLmhpZGUpXG4gICAgICAgICAgICAgICAgICAgIC5vbignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5ldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2FsbChsYWJlbFRvb2x0aXApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBsYWJlbChrZXkpeyAvLyBUTyBETzogY29tYmluZSB0aGVzZSBpbnRvIG9uZSBtZXRob2QgdGhhdCByZXR1cm5zIG9iamVjdFxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KSAhPT0gdW5kZWZpbmVkID8gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbCA6ICcnO1xuICAgICAgICB9LFxuICAgICAgICBkZXNjcmlwdGlvbihrZXkpe1xuICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5kaWN0aW9uYXJ5LCBrZXkpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkgIT09IHVuZGVmaW5lZCA/IHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkuZGVzY3JpcHRpb24gOiAnJztcbiAgICAgICAgfSxcbiAgICAgICAgdW5pdHNEZXNjcmlwdGlvbihrZXkpe1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkgIT09IHVuZGVmaW5lZCA/IHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkudW5pdHNfZGVzY3JpcHRpb24gOiAnJztcbiAgICAgICAgfSwgICBcbiAgICAgICAgdW5pdHMoa2V5KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpICE9PSB1bmRlZmluZWQgPyB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLnVuaXRzIDogJyc7ICBcbiAgICAgICAgfSxcbiAgICAgICAgdGlwVGV4dChrZXkpe1xuICAgICAgICAgICAgdmFyIHN0ciA9IHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkubGFiZWwucmVwbGFjZSgvXFxcXG4vZywnICcpO1xuICAgICAgICAgICAgcmV0dXJuIHN0ciAhPT0gdW5kZWZpbmVkID8gc3RyLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgc3RyLnNsaWNlKDEpIDogJyc7XG4gICAgICAgIH1cblxuICAgIH07IC8vIGVuZCBMaW5lQ2hhcnQucHJvdG90eXBlXG5cbiAgICB2YXIgTGluZUNoYXJ0ID0gZnVuY3Rpb24ocGFyZW50LCBkYXRhKXsgLy8gb25lIGNoYXJ0IGlzIGNyZWF0ZWQgZm9yIGVhY2ggZ3JvdXAgb2Ygc2VyaWVzIHRvIGJlIHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvZ2V0aGVyLiBjaGFydHMgd2l0aCB0aGUgc2FtZSBwYXJlbnQgYXJlIHJlbmRlcmVkIGluIHRoZSBzYW1lIGNoYXJ0RGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBkYXRhIGZvciBlYWNoIGNoYXJ0IGlzIGFscmVhZHkgZmlsdGVyZWQgdG8gYmUgb25seSB0aGUgc2VyaWVzIGludGVuZGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZvciB0aGF0IGNoYXJ0XG4gICAgICAgIFxuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBwYXJlbnQuY29uZmlnO1xuICAgICAgICB0aGlzLm1hcmdpblRvcCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5Ub3AgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy50b3A7XG4gICAgICAgIHRoaXMubWFyZ2luUmlnaHQgPSArdGhpcy5jb25maWcubWFyZ2luUmlnaHQgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5yaWdodDtcbiAgICAgICAgdGhpcy5tYXJnaW5Cb3R0b20gPSArdGhpcy5jb25maWcubWFyZ2luQm90dG9tIHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMuYm90dG9tO1xuICAgICAgICB0aGlzLm1hcmdpbkxlZnQgPSArdGhpcy5jb25maWcubWFyZ2luTGVmdCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLmxlZnQ7XG4gICAgICAgIHRoaXMud2lkdGggPSB0aGlzLmNvbmZpZy5zdmdXaWR0aCA/ICt0aGlzLmNvbmZpZy5zdmdXaWR0aCAtIHRoaXMubWFyZ2luUmlnaHQgLSB0aGlzLm1hcmdpbkxlZnQgOiAzMjAgLSB0aGlzLm1hcmdpblJpZ2h0IC0gdGhpcy5tYXJnaW5MZWZ0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IHRoaXMuY29uZmlnLnN2Z0hlaWdodCA/ICt0aGlzLmNvbmZpZy5zdmdIZWlnaHQgLSB0aGlzLm1hcmdpblRvcCAtIHRoaXMubWFyZ2luQm90dG9tIDogKCB0aGlzLndpZHRoICsgdGhpcy5tYXJnaW5SaWdodCArIHRoaXMubWFyZ2luTGVmdCApIC8gMiAtIHRoaXMubWFyZ2luVG9wIC0gdGhpcy5tYXJnaW5Cb3R0b207XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgICAgIHRoaXMucmVzZXRDb2xvcnMgPSB0aGlzLmNvbmZpZy5yZXNldENvbG9ycyB8fCBmYWxzZTtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSB0aGlzLmluaXQocGFyZW50LmNvbnRhaW5lcik7IC8vIFRPIERPICB0aGlzIGlzIGtpbmRhIHdlaXJkXG4gICAgICAgIHRoaXMueFNjYWxlVHlwZSA9IHRoaXMuY29uZmlnLnhTY2FsZVR5cGUgfHwgJ3RpbWUnO1xuICAgICAgICB0aGlzLnlTY2FsZVR5cGUgPSB0aGlzLmNvbmZpZy55U2NhbGVUeXBlIHx8ICdsaW5lYXInO1xuICAgICAgICB0aGlzLnhUaW1lVHlwZSA9IHRoaXMuY29uZmlnLnhUaW1lVHlwZSB8fCAnJVknO1xuICAgICAgICB0aGlzLnNjYWxlQnkgPSB0aGlzLmNvbmZpZy5zY2FsZUJ5IHx8IHRoaXMuY29uZmlnLnZhcmlhYmxlWTtcbiAgICAgIC8vICB0aGlzLmlzRmlyc3RSZW5kZXIgPSB0cnVlO1xuICAgICAgICB0aGlzLnNldFNjYWxlcygpOyAvLyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgXG4gICAgICAgIHRoaXMuc2V0VG9vbHRpcHMoKTtcbiAgICAgICAgdGhpcy5hZGRMaW5lcygpO1xuICAgICAgICB0aGlzLmFkZExhYmVscygpO1xuICAgICAgICB0aGlzLmFkZFBvaW50cygpO1xuICAgICAgICB0aGlzLmFkZFhBeGlzKCk7XG4gICAgICAgIHRoaXMuYWRkWUF4aXMoKTtcbiAgICAgICAgXG5cbiAgICAgICAgICAgICAgIFxuICAgIH07XG5cbiAgICBMaW5lQ2hhcnQucHJvdG90eXBlID0geyAvLyBlYWNoIExpbmVDaGFydCBpcyBhbiBzdmcgdGhhdCBob2xkIGdyb3VwZWQgc2VyaWVzXG4gICAgICAgIGRlZmF1bHRNYXJnaW5zOiB7XG4gICAgICAgICAgICB0b3A6MjcsXG4gICAgICAgICAgICByaWdodDo2NSxcbiAgICAgICAgICAgIGJvdHRvbToyNSxcbiAgICAgICAgICAgIGxlZnQ6MzVcbiAgICAgICAgfSxcbiAgICAgICAgICAgICAgXG4gICAgICAgIGluaXQoY2hhcnREaXYpeyAvLyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgdGhpcyBpcyBjYWxsZWQgb25jZSBmb3IgZWFjaCBzZXJpZXNHcm91cCBvZiBlYWNoIGNhdGVnb3J5LiBcbiAgICAgICAgICAgIEQzQ2hhcnRzLmNvbGxlY3RBbGwucHVzaCh0aGlzKTsgLy8gcHVzaGVzIGFsbCBjaGFydHMgb24gdGhlIHBhZ2UgdG8gb25lIGNvbGxlY3Rpb25cbiAgICAgICAgICAgIHRoaXMucGFyZW50LnBhcmVudC5jb2xsZWN0QWxsLnB1c2godGhpcyk7ICAvLyBwdXNoZXMgYWxsIGNoYXJ0cyBmcm9tIG9uZSBDaGFydEdyb3VwIHRvIHRoZSBDaGFydEdyb3VwJ3MgY29sbGVjdGlvblxuXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gIGQzLnNlbGVjdChjaGFydERpdikuc2VsZWN0KCdkaXYnKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3N2ZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2ZvY3VzYWJsZScsIGZhbHNlKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIHRoaXMud2lkdGggKyB0aGlzLm1hcmdpblJpZ2h0ICsgdGhpcy5tYXJnaW5MZWZ0IClcbiAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgdGhpcy5oZWlnaHQgICsgdGhpcy5tYXJnaW5Ub3AgKyB0aGlzLm1hcmdpbkJvdHRvbSApO1xuXG4gICAgICAgICAgICB0aGlzLnN2ZyA9IGNvbnRhaW5lci5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLGB0cmFuc2xhdGUoJHt0aGlzLm1hcmdpbkxlZnR9LCAke3RoaXMubWFyZ2luVG9wfSlgKTtcblxuICAgICAgICAgICAgdGhpcy54QXhpc0dyb3VwID0gdGhpcy5zdmcuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgIHRoaXMueUF4aXNHcm91cCA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICB0aGlzLmFsbFNlcmllcyA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpIC8vIGllIHRoZSBncm91cCB0aGF0IHdpbGwgaG9sZCBhbGwgdGhlIHNlcmllcyBncm91cHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3BlY2lmaWVkIHRvIGJlIHJlbmRlcmVkIGluIHRoaXMgY2hhcnRcbiAgICAgICAgICAgICAgICAuY2xhc3NlZCgnYWxsLXNlcmllcycsdHJ1ZSk7XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5yZXNldENvbG9ycyApeyAgICAvLyBpZiB0aGUgZGl2J3MgZGF0YS1yZXNldC1jb2xvcnMgYXR0cmlidXRlIGlzIHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2hhcnQgd2lsbCByZW5kZXIgc2VyaWVzIGFzIGlmIGZyb20gdGhlIGJlZ2lubmluZ1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50LnNlcmllc0NvdW50ID0gMDsgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBUTyBETyA6IFRISVMgSFNPVUxEIEJFIElOIENIQVJUIFBST1RPVFlQRVxuICAgICAgICAgICAgdGhpcy5wb3RlbnRpYWxTZXJpZXMgPSB0aGlzLmFsbFNlcmllcy5zZWxlY3RBbGwoJ3BvdGVudGlhbC1zZXJpZXMnKSAvLyBwb3RlbnRpYWwgc2VyaWVzIGJjIHRoZSBzZXJpZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbWF5IG5vdCBoYXZlIGRhdGEgZm9yIHRoZSBjdXJyZW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHkgdmFyaWFibGVcbiAgICAgICAgICAgICAgICAuZGF0YSgoKSA9PiB7IC8vIGFwcGVuZCBhIGcgZm9yIHBvdGVudGlhbCBzZXJpZXMgaW4gdGhlIENoYXJ0cyBkYXRhIChzZXJpZXNHcm91cClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhFUkUgSVMgV0hFUkUgTkVTVElORyBCWSBZIFZBUklBQkxFIFdPVUxEIENPTUUgSU5UTyBQTEFZICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAvLyByZXR1cm4gdGhpcy5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gdGhpcy5jb25maWcudmFyaWFibGVZKS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kYXRhO1xuICAgICAgICAgICAgICAgIH0sIGQgPT4gZC5rZXkpXG4gICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCBkID0+ICdwb3RlbnRpYWwtc2VyaWVzICcgKyBkLmtleSArICcgc2VyaWVzLScgKyB0aGlzLnBhcmVudC5zZXJpZXNDb3VudCArICcgY29sb3ItJyArIHRoaXMucGFyZW50LnNlcmllc0NvdW50KysgJSA0KTtcblxuICAgICAgICAgICAgdGhpcy5iaW5kRGF0YSgpO1xuXG4gICAgICAgICAgICBpZiAoIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzICYmIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzID09PSB0cnVlICl7XG4gICAgICAgICAgICAgICAgdGhpcy5wcmVwYXJlU3RhY2tpbmcoKTsgLy8gVE8gRE8uIFNFUEFSQVRFIFNUQUNLSU5HIEZST00gQVJFQS4gU1RBQ0tJTkcgQ09VTEQgQVBQTFkgVE8gTUFOWSBDSEFSVCBUWVBFU1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29udGFpbmVyLm5vZGUoKTtcbiAgICAgICAgfSxcbiAgICAgICAgYmluZERhdGEoKXtcbiAgICAgICAgICAgIC8vIFRPIERPIDogVEhJUyBIU09VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFXG4gICAgICAgICAgICB2YXIgZWFjaFNlcmllcyA9IHRoaXMucG90ZW50aWFsU2VyaWVzLnNlbGVjdEFsbCgnZy5lYWNoLXNlcmllcy4nICsgdGhpcy5jb25maWcudmFyaWFibGVZKVxuICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJ0biA9IGQudmFsdWVzLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gdGhpcy5jb25maWcudmFyaWFibGVZKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJ0biAhPT0gdW5kZWZpbmVkID8gW3J0bl0gOiBbXTsgLy8gbmVlZCB0byBhY2N0IGZvciBwb3NzaWJpbGl0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGF0IHRoZSBzZXJpZXMgaXMgYWJzZW50IGdpdmVuIHRoZSBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29uZmlnLnZhcmlhYmxlWS4gaWYgZmluZCgpIHJldHVybnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdW5kZWZpbmVkLCBkYXRhIHNob3VsZCBiZSBlbXB0eSBhcnJheVxuICAgICAgICAgICAgICAgICAgICB9LyosIGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZC52YWx1ZXNbMF0uc2VyaWVzKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZC52YWx1ZXNbMF0uc2VyaWVzOyBcbiAgICAgICAgICAgICAgICAgICAgfSovKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gdXBkYXRlIGV4aXN0aW5nXG4gICAgICAgICAgICBlYWNoU2VyaWVzXG4gICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2VudGVyJywgZmFsc2UpXG4gICAgICAgICAgICAgICAgLmNsYXNzZWQoJ3VwZGF0ZScsIHRydWUpO1xuXG4gICAgICAgICAgICAvLyBjbGVhciBleGl0aW5nXG4gICAgICAgICAgICBlYWNoU2VyaWVzLmV4aXQoKVxuICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDApXG4gICAgICAgICAgICAgICAgLnJlbW92ZSgpO1xuXG4gICAgICAgICAgICB2YXIgZW50ZXJpbmcgPSBlYWNoU2VyaWVzLmVudGVyKCkuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCBkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQudmFsdWVzWzBdLnNlcmllcyArICcgZWFjaC1zZXJpZXMgJyArIHRoaXMuY29uZmlnLnZhcmlhYmxlWTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdlbnRlcicsIHRydWUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5lYWNoU2VyaWVzID0gZW50ZXJpbmcubWVyZ2UoZWFjaFNlcmllcyk7XG4gICAgICAgIH0sXG4gICAgICAgIHVwZGF0ZSh2YXJpYWJsZVkgPSB0aGlzLmNvbmZpZy52YXJpYWJsZVkpe1xuICAgICAgICAgICAgdGhpcy5jb25maWcudmFyaWFibGVZID0gdmFyaWFibGVZO1xuICAgICAgICAgICAgdGhpcy5zZXRTY2FsZXMoKTtcbiAgICAgICAgICAgIHRoaXMuYmluZERhdGEoKTtcbiAgICAgICAgICAgIHRoaXMuYWRkTGluZXMoKTtcbiAgICAgICAgICAgIHRoaXMuYWRqdXN0WUF4aXMoKTtcbiAgICAgICAgICAgIHRoaXMuYWRkUG9pbnRzKCk7XG4gICAgICAgICAgICB0aGlzLmFkanVzdExhYmVscygpO1xuXG4gICAgICAgIH0sXG4gICAgICAgIHByZXBhcmVTdGFja2luZygpeyAvLyBUTyBETy4gU0VQQVJBVEUgU1RBQ0tJTkcgRlJPTSBBUkVBLiBTVEFDS0lORyBDT1VMRCBBUFBMWSBUTyBNQU5ZIENIQVJUIFRZUEVTXG4gICAgICAgICAgICB2YXIgZm9yU3RhY2tpbmcgPSB0aGlzLmRhdGEucmVkdWNlKChhY2MsY3VyLGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmICggaSA9PT0gMCApe1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VyLnZhbHVlcy5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjYy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW3RoaXMuY29uZmlnLnZhcmlhYmxlWF06IGVhY2hbdGhpcy5jb25maWcudmFyaWFibGVYXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW2N1ci5rZXldOiBlYWNoW3RoaXMuY29uZmlnLnZhcmlhYmxlWV1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VyLnZhbHVlcy5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjYy5maW5kKG9iaiA9PiBvYmpbdGhpcy5jb25maWcudmFyaWFibGVYXSA9PT0gZWFjaFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKVtjdXIua2V5XSA9IGVhY2hbdGhpcy5jb25maWcudmFyaWFibGVZXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgfSxbXSk7XG5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLnN0YWNrID0gZDMuc3RhY2soKVxuICAgICAgICAgICAgICAgICAgICAua2V5cyh0aGlzLmRhdGEubWFwKGVhY2ggPT4gZWFjaC5rZXkpKVxuICAgICAgICAgICAgICAgICAgICAub3JkZXIoZDMuc3RhY2tPcmRlck5vbmUpXG4gICAgICAgICAgICAgICAgICAgIC5vZmZzZXQoZDMuc3RhY2tPZmZzZXROb25lKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLnN0YWNrRGF0YSA9IHRoaXMuc3RhY2soZm9yU3RhY2tpbmcpO1xuICAgICAgICB9LFxuICAgICAgICBzZXRTY2FsZXMoKXsgLy9TSE9VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFIC8vIFRPIERPOiBTRVQgU0NBTEVTIEZPUiBPVEhFUiBHUk9VUCBUWVBFU1xuICAgICAgICAgICAgXG5cblxuICAgICAgICAgICAgdmFyIGQzU2NhbGUgPSB7XG4gICAgICAgICAgICAgICAgdGltZTogZDMuc2NhbGVUaW1lKCksXG4gICAgICAgICAgICAgICAgbGluZWFyOiBkMy5zY2FsZUxpbmVhcigpXG4gICAgICAgICAgICAgICAgLy8gVE8gRE86IGFkZCBhbGwgc2NhbGUgdHlwZXMuXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIHhNYXhlcyA9IFtdLCB4TWlucyA9IFtdLCB5TWF4ZXMgPSBbXSwgeU1pbnMgPSBbXSwgeVZhcmlhYmxlcztcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHRoaXMuc2NhbGVCeSx0aGlzLnNjYWxlQnkgIT09IHVuZGVmaW5lZCx0aGlzLnNjYWxlQnkgIT09ICdhbGwnLEFycmF5LmlzQXJyYXkodGhpcy5zY2FsZUJ5KSAhPT0gdHJ1ZSApO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnNjYWxlQnkgIT09IHVuZGVmaW5lZCAmJiB0aGlzLnNjYWxlQnkgIT09ICdhbGwnICYmIEFycmF5LmlzQXJyYXkodGhpcy5zY2FsZUJ5KSAhPT0gdHJ1ZSAmJiB0eXBlb2YgdGhpcy5zY2FsZUJ5ICE9PSAnc3RyaW5nJyApIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW52YWxpZCBkYXRhLXNjYWxlLWJ5IGNvbmZpZ3VyYXRpb24uIE11c3QgYmUgc3RyaW5nIG9yIGFycmF5IG9mIHkgdmFyaWFibGUocykuJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5zY2FsZUJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCB0aGlzLnNjYWxlQnkgPT09ICdhbGwnKSB7XG4gICAgICAgICAgICAgICAgeVZhcmlhYmxlcyA9IHRoaXMucGFyZW50LnBhcmVudC5wcm9wZXJ0aWVzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB5VmFyaWFibGVzID0gQXJyYXkuaXNBcnJheSh0aGlzLnNjYWxlQnkpID8gdGhpcy5zY2FsZUJ5IDogQXJyYXkuaXNBcnJheSh0aGlzLmNvbmZpZy52YXJpYWJsZVkpID8gdGhpcy5jb25maWcudmFyaWFibGVZIDogW3RoaXMuY29uZmlnLnZhcmlhYmxlWV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHlWYXJpYWJsZXMsIHRoaXMucGFyZW50LnBhcmVudC5wcm9wZXJ0aWVzKTtcblxuICAgICAgICAgICAgdGhpcy5kYXRhLmZvckVhY2goZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZWFjaCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgeE1heGVzLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1t0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzLmxlbmd0aCAtIDJdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV0ueC5tYXgpO1xuICAgICAgICAgICAgICAgIHhNaW5zLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1t0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzLmxlbmd0aCAtIDJdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV0ueC5taW4pO1xuICAgICAgICAgICAgICAgIGlmICggdGhpcy5wYXJlbnQucGFyZW50LnByb3BlcnRpZXMubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgICAgICB5VmFyaWFibGVzLmZvckVhY2goeVZhciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMF1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt5VmFyXSAhPT0gdW5kZWZpbmVkICl7ICAvLyBuZWVkIHRvIGFjY3QgZm9yIHBvc3NcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoYXQgdGhlIHlWYXIgZG9lcyBub3QgZXhpc3QgaW4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgc3BlY2lmaWVkIHNlcmllc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHlNYXhlcy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMF1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt5VmFyXS55Lm1heCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeU1pbnMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzBdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1beVZhcl0ueS5taW4pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgIHtcbiAgICAgICAgICAgICAgICAgICAgeU1heGVzLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1swXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldLnkubWF4KTtcbiAgICAgICAgICAgICAgICAgICAgeU1pbnMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzBdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV0ueS5taW4pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLnhNYXggPSBkMy5tYXgoeE1heGVzKTtcbiAgICAgICAgICAgIHRoaXMueE1pbiA9IGQzLm1heCh4TWlucyk7XG4gICAgICAgICAgICB0aGlzLnlNYXggPSBkMy5tYXgoeU1heGVzKTtcbiAgICAgICAgICAgIHRoaXMueU1pbiA9IGQzLm1pbih5TWlucyk7XG4gICAgICAgICAgICB0aGlzLnhWYWx1ZXNVbmlxdWUgPSBbXTtcblxuICAgICAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy5zdGFja1NlcmllcyAmJiB0aGlzLmNvbmZpZy5zdGFja1NlcmllcyA9PT0gdHJ1ZSApe1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciB5VmFsdWVzID0gdGhpcy5zdGFja0RhdGEucmVkdWNlKChhY2MsIGN1cikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgYWNjLnB1c2goLi4uY3VyLnJlZHVjZSgoYWNjMSwgY3VyMSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjMS5wdXNoKGN1cjFbMF0sIGN1cjFbMV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYzE7XG4gICAgICAgICAgICAgICAgICAgIH0sW10pKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgICAgICAgICB9LFtdKTtcbiAgICAgICAgICAgICAgICB0aGlzLnlNYXggPSBkMy5tYXgoeVZhbHVlcyk7XG4gICAgICAgICAgICAgICAgdGhpcy55TWluID0gZDMubWluKHlWYWx1ZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHhSYW5nZSA9IFswLCB0aGlzLndpZHRoXSxcbiAgICAgICAgICAgICAgICB5UmFuZ2UgPSBbdGhpcy5oZWlnaHQsIDBdLFxuICAgICAgICAgICAgICAgIHhEb21haW4sXG4gICAgICAgICAgICAgICAgeURvbWFpbjtcbiAgICAgICAgICAgIGlmICggdGhpcy54U2NhbGVUeXBlID09PSAndGltZScpIHtcbiAgICAgICAgICAgICAgICB4RG9tYWluID0gW2QzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkodGhpcy54TWluKSwgZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKSh0aGlzLnhNYXgpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIFRPIERPOiBPVEhFUiBkYXRhIHR5cGVzID9cbiAgICAgICAgICAgICAgICB4RG9tYWluID0gW3RoaXMueE1pbiwgdGhpcy54TWF4XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICggdGhpcy55U2NhbGVUeXBlID09PSAndGltZScpIHtcbiAgICAgICAgICAgICAgICB5RG9tYWluID0gW2QzLnRpbWVQYXJzZSh0aGlzLnlUaW1lVHlwZSkodGhpcy55TWluKSwgZDMudGltZVBhcnNlKHRoaXMueVRpbWVUeXBlKSh0aGlzLnlNYXgpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIFRPIERPOiBPVEhFUiBkYXRhIHR5cGVzID9cbiAgICAgICAgICAgICAgICB5RG9tYWluID0gW3RoaXMueU1pbiwgdGhpcy55TWF4XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy54U2NhbGUgPSBkM1NjYWxlW3RoaXMueFNjYWxlVHlwZV0uZG9tYWluKHhEb21haW4pLnJhbmdlKHhSYW5nZSk7XG4gICAgICAgICAgICB0aGlzLnlTY2FsZSA9IGQzU2NhbGVbdGhpcy55U2NhbGVUeXBlXS5kb21haW4oeURvbWFpbikucmFuZ2UoeVJhbmdlKTtcblxuXG4gICAgICAgIH0sXG4gICAgICAgIGFkZExpbmVzKCl7XG4gICAgICAgICAgICB2YXIgemVyb1ZhbHVlbGluZSA9IGQzLmxpbmUoKVxuICAgICAgICAgICAgICAgIC54KGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMueFZhbHVlc1VuaXF1ZS5pbmRleE9mKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkgPT09IC0xICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnhWYWx1ZXNVbmlxdWUucHVzaChkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpO1xuICAgICAgICAgICAgICAgIH0pIFxuICAgICAgICAgICAgICAgIC55KCgpID0+IHRoaXMueVNjYWxlKDApKTtcbiAgICAgICAgICAgIHZhciBsaW5lcyA9IHRoaXMuZWFjaFNlcmllcy5zZWxlY3RBbGwoJ3BhdGgnKVxuICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4gW2RdKTtcbiAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLmxpbmVzID0gbGluZXMuZW50ZXIoKS5hcHBlbmQoJ3BhdGgnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ2xpbmUnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHplcm9WYWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm1lcmdlKGxpbmVzKTtcblxuICAgICAgICAgICAgdGhpcy51cGRhdGVMaW5lcygpO1xuICAgICAgICAgIC8qICB2YXIgdmFsdWVsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgLngoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdGhpcy54VmFsdWVzVW5pcXVlLmluZGV4T2YoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSA9PT0gLTEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMueFZhbHVlc1VuaXF1ZS5wdXNoKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSk7XG4gICAgICAgICAgICAgICAgfSkgXG4gICAgICAgICAgICAgICAgLnkoKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnlTY2FsZShkLnZhbHVlKTtcbiAgICAgICAgICAgICAgICB9KTsqL1xuICAgICAgICAgIC8vIFRPIERPIDogQUREIEJBQ0sgSU4gU1RBQ0tFRCBTRVJJRVMgIFxuICAgICAgICAgICAvKiBpZiAoIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzICYmIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzID09PSB0cnVlICl7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIGFyZWEgPSBkMy5hcmVhKClcbiAgICAgICAgICAgICAgICAgICAgLngoZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGQuZGF0YVt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSkpXG4gICAgICAgICAgICAgICAgICAgIC55MChkID0+IHRoaXMueVNjYWxlKGRbMF0pKVxuICAgICAgICAgICAgICAgICAgICAueTEoZCA9PiB0aGlzLnlTY2FsZShkWzFdKSk7XG5cbiAgICAgICAgICAgICAgICB2YXIgbGluZSA9IGQzLmxpbmUoKVxuICAgICAgICAgICAgICAgICAgICAueChkID0+IHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZC5kYXRhW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKSlcbiAgICAgICAgICAgICAgICAgICAgLnkoZCA9PiB0aGlzLnlTY2FsZShkWzFdKSk7XG5cbiAgICAgICAgICAgICAgICB2YXIgc3RhY2tHcm91cCA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdzdGFja2VkLWFyZWEnKTtcbiAgICAgICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICBzdGFja0dyb3VwICAgIFxuICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzdGFja2VkLWFyZWEnKVxuICAgICAgICAgICAgICAgICAgICAuZGF0YSh0aGlzLnN0YWNrRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJykgLy8gVE8gRE86IGFkZCB6ZXJvLWxpbmUgZXF1aXZhbGVudCBhbmQgbG9naWMgZm9yIHRyYW5zaXRpb24gb24gdXBkYXRlXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsIChkLGkpID0+ICdhcmVhLWxpbmUgY29sb3ItJyArIGkpIC8vIFRPIERPIG5vdCBxdWl0ZSByaWdodCB0aGF0IGNvbG9yIHNob2xkIGJlIGBpYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHlvdSBoYXZlIG1vcmUgdGhhbiBvbmUgZ3JvdXAgb2Ygc2VyaWVzLCB3aWxsIHJlcGVhdFxuICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGQgPT4gYXJlYShkKSk7XG5cbiAgICAgICAgICAgICAgICBzdGFja0dyb3VwXG4gICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3N0YWNrZWQtbGluZScpIC8vIFRPIERPOiBhZGQgemVyby1saW5lIGVxdWl2YWxlbnQgYW5kIGxvZ2ljIGZvciB0cmFuc2l0aW9uIG9uIHVwZGF0ZVxuICAgICAgICAgICAgICAgICAgICAuZGF0YSh0aGlzLnN0YWNrRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKGQsaSkgPT4gJ2xpbmUgY29sb3ItJyArIGkpIFxuICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGQgPT4gbGluZShkKSk7XG5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0gZWxzZSB7IFxuICAgICAgICAgICAgICAgIGlmICggdGhpcy5pc0ZpcnN0UmVuZGVyICl7ICovXG4gICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgIC8qIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKS5kZWxheSgxNTApXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qLm9uKCdlbmQnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpID09PSBhcnJheS5sZW5ndGggLSAxICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZFBvaW50cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZExhYmVscygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pOyovICAgXG4gICAgICAgICAgICAgICAvKiB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3RBbGwodGhpcy5saW5lcy5ub2RlcygpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVhY2goKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggaXNOYU4oZC52YWx1ZXNbMF1bdGhpcy5jb25maWcudmFyaWFibGVZXSkgKXsgLy8gdGhpcyBhIHdvcmthcm91bmQgZm9yIGhhbmRsaW5nIE5Bc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd291bGQgYmUgbmljZXIgdG8gaGFuZGxlIHZpYSBleGl0KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ1dCBtYXkgYmUgaGFyZCBiYyBvZiBob3cgZGF0YSBpc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RydWN0dXJlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAub24oJ2VuZCcsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkaXNwbGF5LW5vbmUnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2xhc3NlZCgnZGlzcGxheS1ub25lJywgZmFsc2UpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLDEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3RBbGwodGhpcy5wb2ludHMubm9kZXMoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5lYWNoKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGlzTmFOKGRbdGhpcy5jb25maWcudmFyaWFibGVZXSkgKXsgLy8gdGhpcyBhIHdvcmthcm91bmQgZm9yIGhhbmRsaW5nIE5Bc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd291bGQgYmUgbmljZXIgdG8gaGFuZGxlIHZpYSBleGl0KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ1dCBtYXkgYmUgaGFyZCBiYyBvZiBob3cgZGF0YSBpc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RydWN0dXJlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAub24oJ2VuZCcsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkaXNwbGF5LW5vbmUnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkaXNwbGF5LW5vbmUnLCBmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywxKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2N4JywgZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2N5JywgZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueVNjYWxlKGRbdGhpcy5jb25maWcudmFyaWFibGVZXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdEFsbCh0aGlzLmxhYmVsR3JvdXBzLm5vZGVzKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZWFjaCgoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxhYmVsR3JvdXAgPSBkMy5zZWxlY3QoYXJyYXlbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggaXNOYU4oZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdGhpcy5jb25maWcudmFyaWFibGVZXSkgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbEdyb3VwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zdHlsZSgnb3BhY2l0eScsMClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vbignZW5kJywgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbEdyb3VwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkaXNwbGF5LW5vbmUnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbEdyb3VwLnNlbGVjdCgnLmhhcy10b29sdGlwJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywgLTEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsR3JvdXBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdkaXNwbGF5LW5vbmUnLCBmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywxKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIChkKSA9PiBgdHJhbnNsYXRlKCR7dGhpcy53aWR0aCArIDh9LCAke3RoaXMueVNjYWxlKGQudmFsdWVzW2QudmFsdWVzLmxlbmd0aCAtIDFdW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pICsgM30pYCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWxHcm91cC5zZWxlY3QoJy5oYXMtdG9vbHRpcCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0QWxsKHRoaXMubGFiZWxzLm5vZGVzKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd5JywgMClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignZW5kJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpID09PSBhcnJheS5sZW5ndGggLSAxICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVsYXhMYWJlbHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0QWxsKHRoaXMueUF4aXNHcm91cC5ub2RlcygpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzTGVmdCh0aGlzLnlTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDUpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdlbmQnLChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnLnRpY2snKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVhY2goKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ3plcm8nLCAoIGQgPT09IDAgJiYgaSAhPT0gMCAmJiB0aGlzLnlNaW4gPCAwICkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSw1MCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9Ki9cbiAgICAgICAgfSxcbiAgICAgICAgdXBkYXRlTGluZXMoKXtcbiAgICAgICAgICAgIHZhciB2YWx1ZWxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAueChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnhWYWx1ZXNVbmlxdWUuaW5kZXhPZihkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pID09PSAtMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlLnB1c2goZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKTtcbiAgICAgICAgICAgICAgICB9KSBcbiAgICAgICAgICAgICAgICAueSgoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueVNjYWxlKGQudmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmxpbmVzLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApLmRlbGF5KDE1MClcbiAgICAgICAgICAgICAgICAuYXR0cignZCcsIChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBhZGRYQXhpcygpeyAvLyBjb3VsZCBiZSBpbiBDaGFydCBwcm90b3R5cGUgP1xuICAgICAgICAgICAgdmFyIHhBeGlzUG9zaXRpb24sXG4gICAgICAgICAgICAgICAgeEF4aXNPZmZzZXQsXG4gICAgICAgICAgICAgICAgYXhpc1R5cGU7XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5jb25maWcueEF4aXNQb3NpdGlvbiA9PT0gJ3RvcCcgKXtcbiAgICAgICAgICAgICAgICB4QXhpc1Bvc2l0aW9uID0gdGhpcy55TWF4O1xuICAgICAgICAgICAgICAgIHhBeGlzT2Zmc2V0ID0gLXRoaXMubWFyZ2luVG9wO1xuICAgICAgICAgICAgICAgIGF4aXNUeXBlID0gZDMuYXhpc1RvcDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgeEF4aXNQb3NpdGlvbiA9IHRoaXMueU1pbjtcbiAgICAgICAgICAgICAgICB4QXhpc09mZnNldCA9IHRoaXMubWFyZ2luQm90dG9tIC0gMTU7XG4gICAgICAgICAgICAgICAgYXhpc1R5cGUgPSBkMy5heGlzQm90dG9tO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc29sZS5sb2coeEF4aXNQb3NpdGlvbiwgeEF4aXNPZmZzZXQpO1xuICAgICAgICAgICAgdmFyIGF4aXMgPSBheGlzVHlwZSh0aGlzLnhTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnhTY2FsZVR5cGUgPT09ICd0aW1lJyApe1xuICAgICAgICAgICAgICAgIGF4aXMudGlja1ZhbHVlcyh0aGlzLnhWYWx1ZXNVbmlxdWUubWFwKGVhY2ggPT4gZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShlYWNoKSkpOyAvLyBUTyBETzogYWxsb3cgZm9yIG90aGVyIHhBeGlzIEFkanVzdG1lbnRzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnhBeGlzR3JvdXBcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLCcgKyAoIHRoaXMueVNjYWxlKHhBeGlzUG9zaXRpb24pICsgeEF4aXNPZmZzZXQgKSArICcpJykgLy8gbm90IHByb2dyYW1hdGljIHBsYWNlbWVudCBvZiB4LWF4aXNcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgIC5jYWxsKGF4aXMpO1xuXG4gICAgICAgICAgICBkMy5zZWxlY3QodGhpcy54QXhpc0dyb3VwLnNlbGVjdEFsbCgnZy50aWNrJykubm9kZXMoKVswXSkuY2xhc3NlZCgnZmlyc3QtdGljaycsIHRydWUpO1xuICAgICAgICB9LFxuICAgICAgICBhZGp1c3RZQXhpcygpe1xuICAgICAgICAgICAgdGhpcy55QXhpc0dyb3VwXG4gICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQodGhpcy55U2NhbGUpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrcyg1KSlcbiAgICAgICAgICAgICAgICAub24oJ2VuZCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXJrWmVybygpO1xuICAgICAgICAgICAgICAgIH0pOyBcbiAgICAgICAgICAgICAgICAvLyB0byBkbyBtYWtlIHRoaXMgRFJZZXIgKHJlcGVhdGVkIGJlbG93KSBhbmQgcHJvZ3JhbW1hdGljXG5cbiAgICAgICAgICAgIC8vdGhpcy5tYXJrWmVybygpO1xuXG4gICAgICAgIH0sXG4gICAgICAgIG1hcmtaZXJvKCl7IC8vIGlmIHplcm8gaXMgbm90IHRoZSBmaXJzdCB0aWNrIG1hcmssIG1hcmsgaXQgd2l0aCBib2xkIHR5cGVcbiAgICAgICAgICAgIHRoaXMueUF4aXNHcm91cFxuICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJy50aWNrJylcbiAgICAgICAgICAgICAgICAuZWFjaCgoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCd6ZXJvJywgZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCxpLHRoaXMueU1pbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICggZCA9PT0gMCAmJiBpICE9PSAwICYmIHRoaXMueU1pbiA8IDAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBhZGRZQXhpcygpe1xuICAgICAgICAgICAgLyogYXhpcyAqL1xuICAgICAgICAgICAgdGhpcy55QXhpc0dyb3VwXG4gICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzIHktYXhpcycpXG4gICAgICAgICAgICAgIC5jYWxsKGQzLmF4aXNMZWZ0KHRoaXMueVNjYWxlKS50aWNrU2l6ZUlubmVyKDQpLnRpY2tTaXplT3V0ZXIoMCkudGlja1BhZGRpbmcoMSkudGlja3MoNSkpO1xuXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMubWFya1plcm8oKTtcblxuXG4gICAgICAgICAgICAvKiBsYWJlbHMgKi9cblxuICAgICAgICAgICAgdmFyIHVuaXRzTGFiZWxzID0gdGhpcy5hbGxTZXJpZXMuc2VsZWN0KCcuZWFjaC1zZXJpZXMnKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ2EnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd4bGluazpocmVmJywgJyMnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0YWJpbmRleCcsIC0xKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdmb2N1c2FibGUnLCBmYWxzZSlcbiAgICAgICAgICAgICAgICAub24oJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBkMy5ldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3VuaXRzJylcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKCkgPT4gYHRyYW5zbGF0ZSgtJHt0aGlzLm1hcmdpbkxlZnQgLTUgfSwtJHt0aGlzLm1hcmdpblRvcCAtIDE0fSlgKVxuICAgICAgICAgICAgICAgIC5odG1sKChkLGkpID0+IGkgPT09IDAgPyB0aGlzLnBhcmVudC51bml0cyhkLnZhbHVlc1swXS5zZXJpZXMpIDogbnVsbCk7XG5cbiAgICAgICAgICAgIHZhciBsYWJlbFRvb2x0aXAgPSBkMy50aXAoKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJkMy10aXAgbGFiZWwtdGlwXCIpXG4gICAgICAgICAgICAgICAgLmRpcmVjdGlvbignZScpXG4gICAgICAgICAgICAgICAgLm9mZnNldChbLTIsIDRdKTtcbiAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgZnVuY3Rpb24gbW91c2VvdmVyKGQpe1xuICAgICAgICAgICAgICAgIGlmICggd2luZG93Lm9wZW5Ub29sdGlwICkge1xuICAgICAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAuaGlkZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsYWJlbFRvb2x0aXAuaHRtbCh0aGlzLnBhcmVudC51bml0c0Rlc2NyaXB0aW9uKGQudmFsdWVzWzBdLnNlcmllcykpO1xuICAgICAgICAgICAgICAgIGxhYmVsVG9vbHRpcC5zaG93KCk7XG4gICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwID0gbGFiZWxUb29sdGlwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB1bml0c0xhYmVscy5lYWNoKChkLCBpLCBhcnJheSkgPT4geyAvLyBUTyBETyB0aGlzIGlzIHJlcGV0aXRpdmUgb2YgYWRkTGFiZWxzKClcbiAgICAgICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50LnVuaXRzRGVzY3JpcHRpb24oZC52YWx1ZXNbMF0uc2VyaWVzKSAhPT0gdW5kZWZpbmVkICYmIGQzLnNlbGVjdChhcnJheVtpXSkuaHRtbCgpICE9PSAnJyl7XG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXS5wYXJlbnROb2RlKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2ZvY3VzYWJsZScsdHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdoYXMtdG9vbHRpcCcsIHRydWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAub24oJ21vdXNlb3ZlcicsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5mb2N1cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignZm9jdXMnLCBkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb3VzZW92ZXIuY2FsbCh0aGlzLGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdXQnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXlbaV0uYmx1cigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignYmx1cicsIGxhYmVsVG9vbHRpcC5oaWRlKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGwobGFiZWxUb29sdGlwKTsgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QoYXJyYXlbaV0pXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC5odG1sKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQzLnNlbGVjdCh0aGlzKS5odG1sKCkgKyAnPHRzcGFuIGR5PVwiLTAuNGVtXCIgZHg9XCIwLjJlbVwiIGNsYXNzPVwiaW5mby1tYXJrXCI+PzwvdHNwYW4+JzsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIFxuICAgICAgICB9LFxuICAgICAgICBhZGp1c3RMYWJlbHMoKXtcbiAgICAgICAgICAgIHRoaXMuYWxsU2VyaWVzLnNlbGVjdEFsbCgndGV4dC5zZXJpZXMtbGFiZWwnKVxuICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oMjAwKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd5JywwKVxuICAgICAgICAgICAgICAgIC5vbignZW5kJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIGkgPT09IGFycmF5Lmxlbmd0aCAtIDEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkTGFiZWxzKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgYWRkTGFiZWxzKCl7XG5cbiAgICAgICAgICAgIHZhciBsYWJlbFRvb2x0aXAgPSBkMy50aXAoKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJkMy10aXAgbGFiZWwtdGlwXCIpXG4gICAgICAgICAgICAgICAgLmRpcmVjdGlvbignbicpXG4gICAgICAgICAgICAgICAgLm9mZnNldChbLTQsIDEyXSk7XG4gICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG1vdXNlb3ZlcihkKXtcbiAgICAgICAgICAgICAgICBpZiAoIHdpbmRvdy5vcGVuVG9vbHRpcCApIHtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwLmhpZGUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGFiZWxUb29sdGlwLmh0bWwodGhpcy5wYXJlbnQuZGVzY3JpcHRpb24oZC52YWx1ZXNbMF0uc2VyaWVzKSk7XG4gICAgICAgICAgICAgICAgbGFiZWxUb29sdGlwLnNob3coKTtcbiAgICAgICAgICAgICAgICB3aW5kb3cub3BlblRvb2x0aXAgPSBsYWJlbFRvb2x0aXA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgLyogdGhpcy5sYWJlbEdyb3VwcyA9IHRoaXMuZWFjaFNlcmllc1xuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ2cnKTsgKi9cblxuICAgICAgICAgICAgdmFyIGxhYmVscyA9IHRoaXMuZWFjaFNlcmllcy5zZWxlY3RBbGwoJ2EubGFiZWwtYW5jaG9yJylcbiAgICAgICAgICAgICAgICAuZGF0YShkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbZF07XG4gICAgICAgICAgICAgICAgfSwgZCA9PiBkLnZhbHVlc1swXS5zZXJpZXMgKyAnLWxhYmVsJyk7XG5cblxuXG4gICAgICAgICAgICB0aGlzLmFsbFNlcmllcy5zZWxlY3RBbGwoJ2EubGFiZWwtYW5jaG9yJylcbiAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBgdHJhbnNsYXRlKCR7dGhpcy53aWR0aCArIDh9LCAke3RoaXMueVNjYWxlKGQudmFsdWVzW2QudmFsdWVzLmxlbmd0aCAtIDFdLnZhbHVlKSArIDN9KWA7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub24oJ2VuZCcsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBpID09PSBhcnJheS5sZW5ndGggLSAxICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbGF4TGFiZWxzKCk7IC8vIGRvIGkgbmVlZCBhZGRpdGlvbmFsIHRpbWUgZm9yIHRoZSBlbnRlcmluZyBvbmVzIHRvIGZpbmlzaD8gZ2F0ZT9cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB2YXIgbmV3TGFiZWxzID0gbGFiZWxzLmVudGVyKCkuYXBwZW5kKCdhJylcbiAgICAgICAgICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAwKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYHRyYW5zbGF0ZSgke3RoaXMud2lkdGggKyA4fSwgJHt0aGlzLnlTY2FsZShkLnZhbHVlc1tkLnZhbHVlcy5sZW5ndGggLSAxXS52YWx1ZSkgKyAzfSlgO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywnbGFiZWwtYW5jaG9yJylcbiAgICAgICAgICAgICAgICAuYXR0cigndGl0bGUnLCdjbGljayB0byBicmluZyB0byBmcm9udCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3hsaW5rOmhyZWYnLCcjJylcbiAgICAgICAgICAgICAgICAuYXR0cigndGFiaW5kZXgnLC0xKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdmb2N1c2FibGUnLGZhbHNlKVxuICAgICAgICAgICAgICAgIC5vbignY2xpY2snLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGQzLmV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYnJpbmdUb1RvcC5jYWxsKGFycmF5W2ldLnBhcmVudE5vZGUpOyBcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuXG4gICAgICAgICAgICBuZXdMYWJlbHMuYXBwZW5kKCd0ZXh0JykgXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3Nlcmllcy1sYWJlbCcpXG4gICAgICAgICAgICAgICAgLmh0bWwoKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnPHRzcGFuIHg9XCIwXCI+JyArIHRoaXMucGFyZW50LmxhYmVsKGQudmFsdWVzWzBdLnNlcmllcykucmVwbGFjZSgvXFxcXG4vZywnPC90c3Bhbj48dHNwYW4geD1cIjAuNWVtXCIgZHk9XCIxLjJlbVwiPicpICsgJzwvdHNwYW4+JztcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5lYWNoKChkLCBpLCBhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnBhcmVudC5kZXNjcmlwdGlvbihkLnZhbHVlc1swXS5zZXJpZXMpICE9PSB1bmRlZmluZWQgJiYgdGhpcy5wYXJlbnQuZGVzY3JpcHRpb24oZC52YWx1ZXNbMF0uc2VyaWVzKSAhPT0gJycpe1xuICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KGFycmF5W2ldLnBhcmVudE5vZGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywwKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdmb2N1c2FibGUnLHRydWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNsYXNzZWQoJ2hhcy10b29sdGlwJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAub24oJ21vdXNlb3ZlcicsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXlbaV0uZm9jdXMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vbignZm9jdXMnLCBkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbW91c2VvdmVyLmNhbGwodGhpcyxkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdXQnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5W2ldLmJsdXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vbignYmx1cicsIGxhYmVsVG9vbHRpcC5oaWRlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsKGxhYmVsVG9vbHRpcCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QoYXJyYXlbaV0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmh0bWwoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQzLnNlbGVjdCh0aGlzKS5odG1sKCkgKyAnPHRzcGFuIGR5PVwiLTAuNGVtXCIgZHg9XCIwLjJlbVwiIGNsYXNzPVwiaW5mby1tYXJrXCI+PzwvdHNwYW4+JzsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbmV3TGFiZWxzLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApXG4gICAgICAgICAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywxKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5sYWJlbHMgPSBuZXdMYWJlbHMubWVyZ2UobGFiZWxzKS5zZWxlY3RBbGwoJ3RleHQuc2VyaWVzLWxhYmVsJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIFxuICAgICAgICAgLyogICBuZXdMYWJlbHMuZWFjaCgoZCwgaSwgYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkKTtcbiAgICAgICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50LmRlc2NyaXB0aW9uKGQudmFsdWVzWzBdLnNlcmllcykgIT09IHVuZGVmaW5lZCAmJiB0aGlzLnBhcmVudC5kZXNjcmlwdGlvbihkLnZhbHVlc1swXS5zZXJpZXMpICE9PSAnJyl7XG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdChhcnJheVtpXS5wYXJlbnROb2RlKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RhYmluZGV4JywwKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2ZvY3VzYWJsZScsdHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKCdoYXMtdG9vbHRpcCcsIHRydWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAub24oJ21vdXNlb3ZlcicsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheVtpXS5mb2N1cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignZm9jdXMnLCBkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb3VzZW92ZXIuY2FsbCh0aGlzLGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignbW91c2VvdXQnLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJyYXlbaV0uYmx1cigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbignYmx1cicsIGxhYmVsVG9vbHRpcC5oaWRlKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGwobGFiZWxUb29sdGlwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QoYXJyYXlbaV0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuaHRtbChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkMy5zZWxlY3QodGhpcykuaHRtbCgpICsgJzx0c3BhbiBkeT1cIi0wLjRlbVwiIGR4PVwiMC4yZW1cIiBjbGFzcz1cImluZm8tbWFya1wiPj88L3RzcGFuPic7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7Ki9cbiAgICAgICAgICAgLy8gdGhpcy5pc0ZpcnN0UmVuZGVyID0gZmFsc2U7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICggbGFiZWxzLm5vZGVzKCkubGVuZ3RoID09PSAwICl7IC8vIGllIHRoZXJlIGFyZSBubyBleGl0aW5nIGxhYmVscyAoZmlyc3QgcmVuZGVyIG9yIGFsbCBoYXZlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBleGl0ZWQpLiBpZiB0aGVyZSBhcmUgZXhpc3RpbmcgbGFiZWxzLCByZWxheExhYmVscyBpcyBjYWxsZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9uICdlbmQnIG9mIHRoZWlyIHRyYW5zaXRpb24gYWJvdmUuXG4gICAgICAgICAgICAgICAgdGhpcy5yZWxheExhYmVscygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICBcbiAgICAgICAgICAgXG4gICAgICAgIH0sXG4gICAgICAgIHJlbGF4TGFiZWxzKCl7IC8vIEhUIGh0dHA6Ly9qc2ZpZGRsZS5uZXQvdGh1ZGZhY3Rvci9CMldCVS8gYWRhcHRlZCB0ZWNobmlxdWVcbiAgICAgICAgICAgIHZhciBhbHBoYSA9IDEsXG4gICAgICAgICAgICAgICAgc3BhY2luZyA9IDAsXG4gICAgICAgICAgICAgICAgYWdhaW4gPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5sYWJlbHMuZWFjaCgoZCxpLGFycmF5MSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgdmFyIGEgPSBhcnJheTFbaV0sXG4gICAgICAgICAgICAgICAgICAgICRhID0gZDMuc2VsZWN0KGEpLFxuICAgICAgICAgICAgICAgICAgICB5QSA9ICRhLmF0dHIoJ3knKSxcbiAgICAgICAgICAgICAgICAgICAgYVJhbmdlID0gZDMucmFuZ2UoTWF0aC5yb3VuZChhLmdldENUTSgpLmYpIC0gc3BhY2luZyArIHBhcnNlSW50KHlBKSwgTWF0aC5yb3VuZChhLmdldENUTSgpLmYpICsgTWF0aC5yb3VuZChhLmdldEJCb3goKS5oZWlnaHQpICsgMSArIHNwYWNpbmcgKyBwYXJzZUludCh5QSkpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5sYWJlbHMuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgYiA9IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgICRiID0gZDMuc2VsZWN0KGIpLFxuICAgICAgICAgICAgICAgICAgICB5QiA9ICRiLmF0dHIoJ3knKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBhID09PSBiICkge3JldHVybjt9XG4gICAgICAgICAgICAgICAgICAgIHZhciBiTGltaXRzID0gW01hdGgucm91bmQoYi5nZXRDVE0oKS5mKSAtIHNwYWNpbmcgKyBwYXJzZUludCh5QiksIE1hdGgucm91bmQoYi5nZXRDVE0oKS5mKSArIGIuZ2V0QkJveCgpLmhlaWdodCArIHNwYWNpbmcgKyBwYXJzZUludCh5QildO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIChhUmFuZ2VbMF0gPCBiTGltaXRzWzBdICYmIGFSYW5nZVthUmFuZ2UubGVuZ3RoIC0gMV0gPCBiTGltaXRzWzBdKSB8fCAoYVJhbmdlWzBdID4gYkxpbWl0c1sxXSAmJiBhUmFuZ2VbYVJhbmdlLmxlbmd0aCAtIDFdID4gYkxpbWl0c1sxXSkgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coJ25vIGNvbGxpc2lvbicsIGEsIGIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9IC8vIG5vIGNvbGxpc29uXG4gICAgICAgICAgICAgICAgICAgIHZhciBzaWduID0gYkxpbWl0c1swXSAtIGFSYW5nZVthUmFuZ2UubGVuZ3RoIC0gMV0gPD0gYVJhbmdlWzBdIC0gYkxpbWl0c1sxXSA/IDEgOiAtMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFkanVzdCA9IHNpZ24gKiBhbHBoYTtcbiAgICAgICAgICAgICAgICAgICAgJGIuYXR0cigneScsICgreUIgLSBhZGp1c3QpICk7XG4gICAgICAgICAgICAgICAgICAgICRhLmF0dHIoJ3knLCAoK3lBICsgYWRqdXN0KSApO1xuICAgICAgICAgICAgICAgICAgICBhZ2FpbiA9IHRydWU7IFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmICggaSA9PT0gYXJyYXkxLmxlbmd0aCAtIDEgJiYgYWdhaW4gPT09IHRydWUgKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWxheExhYmVscygpO1xuICAgICAgICAgICAgICAgICAgICB9LDIwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgYWRkUG9pbnRzKCl7XG4gICAgICAgICAgICAvLyBleGlzdGluZ1xuICAgICAgICAgICAgdmFyIHBvaW50cyA9IHRoaXMuZWFjaFNlcmllcy5zZWxlY3RBbGwoJ2NpcmNsZS5kYXRhLXBvaW50JylcbiAgICAgICAgICAgICAgICAuZGF0YShkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhkKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQudmFsdWVzO1xuICAgICAgICAgICAgICAgIH0sIGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLnNlcmllcyArICctJyArIGRbdGhpcy5jb25maWcudmFyaWFibGVYXSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkLnNlcmllcyArICctJyArIGRbdGhpcy5jb25maWcudmFyaWFibGVYXTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIGV4aXN0aW5nXG4gICAgICAgICAgICBwb2ludHNcbiAgICAgICAgICAgICAgICAuY2xhc3NlZCgnZW50ZXInLCBmYWxzZSlcbiAgICAgICAgICAgICAgICAuY2xhc3NlZCgndXBkYXRlJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMCkuZGVsYXkoMTUwKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjeCcsIGQgPT4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKSlcbiAgICAgICAgICAgICAgICAuYXR0cignY3knLCBkID0+IHRoaXMueVNjYWxlKGQudmFsdWUpKTtcblxuICAgICAgICAgICAgcG9pbnRzLmV4aXQoKS5yZW1vdmUoKTtcblxuICAgICAgICAgICAgdmFyIGVudGVyID0gcG9pbnRzLmVudGVyKCk7XG5cblxuICAgICAgICAgICAgZW50ZXIuYXBwZW5kKCdjaXJjbGUnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0YWJpbmRleCcsMClcbiAgICAgICAgICAgICAgICAuYXR0cignZm9jdXNhYmxlJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICAuYXR0cignb3BhY2l0eScsIDApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2RhdGEtcG9pbnQgZW50ZXInKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdyJywgJzQnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjeCcsIGQgPT4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKSlcbiAgICAgICAgICAgICAgICAuYXR0cignY3knLCBkID0+IHRoaXMueVNjYWxlKGQudmFsdWUpKVxuICAgICAgICAgICAgICAgIC5vbignbW91c2VvdmVyJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtb3VzZW92ZXIuY2FsbCh0aGlzLGQsaSxhcnJheSk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub24oJ2ZvY3VzJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtb3VzZW92ZXIuY2FsbCh0aGlzLGQsaSxhcnJheSk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub24oJ21vdXNlb3V0JywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtb3VzZW91dC5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdibHVyJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtb3VzZW91dC5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdjbGljaycsIHRoaXMuYnJpbmdUb1RvcClcbiAgICAgICAgICAgICAgICAub24oJ2tleXVwJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGQzLmV2ZW50LmtleUNvZGUgPT09IDEzICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYnJpbmdUb1RvcC5jYWxsKGFycmF5W2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhbGwodGhpcy50b29sdGlwKVxuICAgICAgICAgICAgICAgIC50cmFuc2l0aW9uKCkuZHVyYXRpb24oNTAwKS5kZWxheSg2NTApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ29wYWNpdHknLCAxKTtcblxuICAgICAgICAgICAgdGhpcy5wb2ludHMgPSBlbnRlci5tZXJnZShwb2ludHMpO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzLnBvaW50cyk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICBmdW5jdGlvbiBtb3VzZW92ZXIoZCxpLGFycmF5KXtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICggd2luZG93Lm9wZW5Ub29sdGlwICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93Lm9wZW5Ub29sdGlwLmhpZGUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB2YXIga2xhc3MgPSBkMy5zZWxlY3QoYXJyYXlbaV0ucGFyZW50Tm9kZS5wYXJlbnROb2RlKS5hdHRyKCdjbGFzcycpLm1hdGNoKC9jb2xvci1cXGQvKVswXTsgLy8gZ2V0IHRoZSBjb2xvciBjbGFzcyBvZiB0aGUgcGFyZW50IGdcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycsIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycpICsgJyAnICsga2xhc3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHByZWZpeCA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN1ZmZpeCA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnBhcmVudC51bml0cyhkLnNlcmllcykgJiYgdGhpcy5wYXJlbnQudW5pdHMoZC5zZXJpZXMpWzBdID09PSAnJCcgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVmaXggPSAnJCc7IC8vIFRPIERPOiAgaGFuZGxlIG90aGVyIHByZWZpeGVzXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaHRtbCA9ICc8c3Ryb25nPicgKyB0aGlzLnBhcmVudC50aXBUZXh0KGQuc2VyaWVzKSArICc8L3N0cm9uZz4gKCcgKyBkLnllYXIgKyAnKTxiciAvPicgKyBwcmVmaXggKyBkMy5mb3JtYXQoJywnKShkLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggdGhpcy5wYXJlbnQudW5pdHMoZC5zZXJpZXMpICYmIHRoaXMucGFyZW50LnVuaXRzKGQuc2VyaWVzKSAhPT0gJycpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1ZmZpeCA9IHRoaXMucGFyZW50LnVuaXRzKGQuc2VyaWVzKS5yZXBsYWNlKCckJywnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaHRtbCArPSAnICcgKyBzdWZmaXg7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUTyBETzogSEFORExFIFRIRSBDVU1VTEFUVkUgVkFMVUVTIFxuICAgICAgICAgICAgICAgICAgICAgIC8qICB2YXIgY3VtID0gdGhpcy5jb25maWcudmFyaWFibGVZLnJlcGxhY2UoJ192YWx1ZScsJ19jdW0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggZFtjdW1dICE9PSAnJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGh0bWwgKz0gJzxiciAvPignICsgcHJlZml4ICsgZDMuZm9ybWF0KCcsJykoZFtjdW1dKSArIHN1ZmZpeCArICcgY3VtdWxhdGl2ZSknO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSovXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuaHRtbChodG1sKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5zaG93KCk7XG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5vcGVuVG9vbHRpcCA9IHRoaXMudG9vbHRpcDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZ1bmN0aW9uIG1vdXNlb3V0KCl7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJywgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJykucmVwbGFjZSgvIGNvbG9yLVxcZC9nLCAnJykpO1xuICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5odG1sKCcnKTtcbiAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuaGlkZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG5cbiAgICAgICAgfSxcbiAgICAgICAgYnJpbmdUb1RvcCgpe1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIHRoaXMucGFyZW50Tm9kZSAhPT0gdGhpcy5wYXJlbnROb2RlLnBhcmVudE5vZGUubGFzdENoaWxkICl7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMucGFyZW50Tm9kZSkubW92ZVRvRnJvbnQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZvY3VzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHNldFRvb2x0aXBzKCl7XG5cbiAgICAgICAgICAgIHRoaXMudG9vbHRpcCA9IGQzLnRpcCgpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcImQzLXRpcFwiKVxuICAgICAgICAgICAgICAgIC5kaXJlY3Rpb24oJ24nKVxuICAgICAgICAgICAgICAgIC5vZmZzZXQoWy04LCAwXSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICB9O1xuXG5cbiAgICByZXR1cm4ge1xuICAgICAgICBDaGFydERpdlxuICAgIH07XG5cbn0pKCk7XG4iLCJleHBvcnQgY29uc3QgSGVscGVycyA9IChmdW5jdGlvbigpe1xuICAgIC8qIGdsb2JhbHMgRE9NU3RyaW5nTWFwLCBkMyAqL1xuICAgIFN0cmluZy5wcm90b3R5cGUuY2xlYW5TdHJpbmcgPSBmdW5jdGlvbigpIHsgLy8gbG93ZXJjYXNlIGFuZCByZW1vdmUgcHVuY3R1YXRpb24gYW5kIHJlcGxhY2Ugc3BhY2VzIHdpdGggaHlwaGVuczsgZGVsZXRlIHB1bmN0dWF0aW9uXG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL1sgXFxcXFxcL10vZywnLScpLnJlcGxhY2UoL1snXCLigJ3igJnigJzigJgsXFwuIVxcPztcXChcXCkmXS9nLCcnKS50b0xvd2VyQ2FzZSgpO1xuICAgIH07XG5cbiAgICBTdHJpbmcucHJvdG90eXBlLnJlbW92ZVVuZGVyc2NvcmVzID0gZnVuY3Rpb24oKSB7IFxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9fL2csJyAnKTtcbiAgICB9O1xuXG4gICAgRE9NU3RyaW5nTWFwLnByb3RvdHlwZS5jb252ZXJ0ID0gZnVuY3Rpb24oKSB7IC8vIHdpbGwgZmFpbCBsdGUgSUUxMFxuICAgICAgICB2YXIgbmV3T2JqID0ge307XG4gICAgICAgIGZvciAoIHZhciBrZXkgaW4gdGhpcyApe1xuICAgICAgICAgICAgaWYgKHRoaXMuaGFzT3duUHJvcGVydHkoa2V5KSl7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbmV3T2JqW2tleV0gPSBKU09OLnBhcnNlKHRoaXNba2V5XSk7IC8vIGlmIHRoZSB2YWx1ZSBjYW4gYmUgaW50ZXJwcmV0dGVkIGFzIEpTT04sIGl0IGlzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiBpdCBjYW4ndCBpdCBpc24ndCAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3T2JqW2tleV0gPSB0aGlzW2tleV07ICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdPYmo7XG4gICAgfTtcblxuICAgIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUubW92ZVRvRnJvbnQgPSBmdW5jdGlvbigpe1xuICAgICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICB0aGlzLnBhcmVudE5vZGUuYXBwZW5kQ2hpbGQodGhpcyk7XG4gICAgICAgICAgfSk7XG4gICAgfTtcbiAgICBkMy5zZWxlY3Rpb24ucHJvdG90eXBlLm1vdmVUb0JhY2sgPSBmdW5jdGlvbigpeyBcbiAgICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgdmFyIGZpcnN0Q2hpbGQgPSB0aGlzLnBhcmVudE5vZGUuZmlyc3RDaGlsZDtcbiAgICAgICAgICAgIGlmICggZmlyc3RDaGlsZCApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHRoaXMsIGZpcnN0Q2hpbGQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgaWYgKHdpbmRvdy5Ob2RlTGlzdCAmJiAhTm9kZUxpc3QucHJvdG90eXBlLmZvckVhY2gpIHtcbiAgICAgICAgTm9kZUxpc3QucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbiAoY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgICAgICAgIHRoaXNBcmcgPSB0aGlzQXJnIHx8IHdpbmRvdztcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdGhpc1tpXSwgaSwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKCFPYmplY3QuaGFzT3duUHJvcGVydHkoJ2dldE93blByb3BlcnR5RGVzY3JpcHRvcnMnKSkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFxuICAgICAgICBPYmplY3QsXG4gICAgICAgICdnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzJyxcbiAgICAgICAge1xuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyhvYmplY3QpIHtcbiAgICAgICAgICAgIHJldHVybiBSZWZsZWN0Lm93bktleXMob2JqZWN0KS5yZWR1Y2UoKGRlc2NyaXB0b3JzLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShcbiAgICAgICAgICAgICAgICBkZXNjcmlwdG9ycyxcbiAgICAgICAgICAgICAgICBrZXksXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgdmFsdWU6IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqZWN0LCBrZXkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSwge30pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG59KSgpO1xuIiwiLy8gZDMudGlwXG4vLyBDb3B5cmlnaHQgKGMpIDIwMTMgSnVzdGluIFBhbG1lclxuLy8gRVM2IC8gRDMgdjQgQWRhcHRpb24gQ29weXJpZ2h0IChjKSAyMDE2IENvbnN0YW50aW4gR2F2cmlsZXRlXG4vLyBSZW1vdmFsIG9mIEVTNiBmb3IgRDMgdjQgQWRhcHRpb24gQ29weXJpZ2h0IChjKSAyMDE2IERhdmlkIEdvdHpcbi8vXG4vLyBUb29sdGlwcyBmb3IgZDMuanMgU1ZHIHZpc3VhbGl6YXRpb25zXG5cbmV4cG9ydCBjb25zdCBkM1RpcCA9IChmdW5jdGlvbigpe1xuICBkMy5mdW5jdG9yID0gZnVuY3Rpb24gZnVuY3Rvcih2KSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2ID09PSBcImZ1bmN0aW9uXCIgPyB2IDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdjtcbiAgICB9O1xuICB9O1xuXG4gIGQzLnRpcCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIGRpcmVjdGlvbiA9IGQzX3RpcF9kaXJlY3Rpb24sXG4gICAgICAgIG9mZnNldCAgICA9IGQzX3RpcF9vZmZzZXQsXG4gICAgICAgIGh0bWwgICAgICA9IGQzX3RpcF9odG1sLFxuICAgICAgICBub2RlICAgICAgPSBpbml0Tm9kZSgpLFxuICAgICAgICBzdmcgICAgICAgPSBudWxsLFxuICAgICAgICBwb2ludCAgICAgPSBudWxsLFxuICAgICAgICB0YXJnZXQgICAgPSBudWxsXG5cbiAgICBmdW5jdGlvbiB0aXAodmlzKSB7XG4gICAgICBzdmcgPSBnZXRTVkdOb2RlKHZpcylcbiAgICAgIGlmICghc3ZnKXsgLy8gSFQgaHR0cHM6Ly9naXRodWIuY29tL0NhZ2VkL2QzLXRpcC9wdWxsLzk2L2ZpbGVzXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHBvaW50ID0gc3ZnLmNyZWF0ZVNWR1BvaW50KClcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm9kZSlcbiAgICB9XG5cbiAgICAvLyBQdWJsaWMgLSBzaG93IHRoZSB0b29sdGlwIG9uIHRoZSBzY3JlZW5cbiAgICAvL1xuICAgIC8vIFJldHVybnMgYSB0aXBcbiAgICB0aXAuc2hvdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgICBpZihhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gaW5zdGFuY2VvZiBTVkdFbGVtZW50KSB0YXJnZXQgPSBhcmdzLnBvcCgpXG5cbiAgICAgIHZhciBjb250ZW50ID0gaHRtbC5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBwb2Zmc2V0ID0gb2Zmc2V0LmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIGRpciAgICAgPSBkaXJlY3Rpb24uYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgbm9kZWwgICA9IGdldE5vZGVFbCgpLFxuICAgICAgICAgIGkgICAgICAgPSBkaXJlY3Rpb25zLmxlbmd0aCxcbiAgICAgICAgICBjb29yZHMsXG4gICAgICAgICAgc2Nyb2xsVG9wICA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AsXG4gICAgICAgICAgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdFxuXG4gICAgICBub2RlbC5odG1sKGNvbnRlbnQpXG4gICAgICAgIC5zdHlsZSgncG9zaXRpb24nLCAnYWJzb2x1dGUnKVxuICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAxKVxuICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ2FsbCcpXG5cbiAgICAgIHdoaWxlKGktLSkgbm9kZWwuY2xhc3NlZChkaXJlY3Rpb25zW2ldLCBmYWxzZSlcbiAgICAgIGNvb3JkcyA9IGRpcmVjdGlvbl9jYWxsYmFja3NbZGlyXS5hcHBseSh0aGlzKVxuICAgICAgbm9kZWwuY2xhc3NlZChkaXIsIHRydWUpXG4gICAgICAgIC5zdHlsZSgndG9wJywgKGNvb3Jkcy50b3AgKyAgcG9mZnNldFswXSkgKyBzY3JvbGxUb3AgKyAncHgnKVxuICAgICAgICAuc3R5bGUoJ2xlZnQnLCAoY29vcmRzLmxlZnQgKyBwb2Zmc2V0WzFdKSArIHNjcm9sbExlZnQgKyAncHgnKVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljIC0gaGlkZSB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5oaWRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbm9kZWwgPSBnZXROb2RlRWwoKVxuICAgICAgbm9kZWxcbiAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywgMClcbiAgICAgICAgLnN0eWxlKCdwb2ludGVyLWV2ZW50cycsICdub25lJylcbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFByb3h5IGF0dHIgY2FsbHMgdG8gdGhlIGQzIHRpcCBjb250YWluZXIuICBTZXRzIG9yIGdldHMgYXR0cmlidXRlIHZhbHVlLlxuICAgIC8vXG4gICAgLy8gbiAtIG5hbWUgb2YgdGhlIGF0dHJpYnV0ZVxuICAgIC8vIHYgLSB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIHRpcCBvciBhdHRyaWJ1dGUgdmFsdWVcbiAgICB0aXAuYXR0ciA9IGZ1bmN0aW9uKG4sIHYpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMiAmJiB0eXBlb2YgbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGdldE5vZGVFbCgpLmF0dHIobilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBhcmdzID0gIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgICAgZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5hdHRyLmFwcGx5KGdldE5vZGVFbCgpLCBhcmdzKVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBQcm94eSBzdHlsZSBjYWxscyB0byB0aGUgZDMgdGlwIGNvbnRhaW5lci4gIFNldHMgb3IgZ2V0cyBhIHN0eWxlIHZhbHVlLlxuICAgIC8vXG4gICAgLy8gbiAtIG5hbWUgb2YgdGhlIHByb3BlcnR5XG4gICAgLy8gdiAtIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3Igc3R5bGUgcHJvcGVydHkgdmFsdWVcbiAgICB0aXAuc3R5bGUgPSBmdW5jdGlvbihuLCB2KSB7XG4gICAgICAvLyBkZWJ1Z2dlcjtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMiAmJiB0eXBlb2YgbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGdldE5vZGVFbCgpLnN0eWxlKG4pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIHZhciBzdHlsZXMgPSBhcmdzWzBdO1xuICAgICAgICAgIE9iamVjdC5rZXlzKHN0eWxlcykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBkMy5zZWxlY3Rpb24ucHJvdG90eXBlLnN0eWxlLmFwcGx5KGdldE5vZGVFbCgpLCBba2V5LCBzdHlsZXNba2V5XV0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFNldCBvciBnZXQgdGhlIGRpcmVjdGlvbiBvZiB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIE9uZSBvZiBuKG5vcnRoKSwgcyhzb3V0aCksIGUoZWFzdCksIG9yIHcod2VzdCksIG53KG5vcnRod2VzdCksXG4gICAgLy8gICAgIHN3KHNvdXRod2VzdCksIG5lKG5vcnRoZWFzdCkgb3Igc2Uoc291dGhlYXN0KVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3IgZGlyZWN0aW9uXG4gICAgdGlwLmRpcmVjdGlvbiA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGRpcmVjdGlvblxuICAgICAgZGlyZWN0aW9uID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogU2V0cyBvciBnZXRzIHRoZSBvZmZzZXQgb2YgdGhlIHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIEFycmF5IG9mIFt4LCB5XSBvZmZzZXRcbiAgICAvL1xuICAgIC8vIFJldHVybnMgb2Zmc2V0IG9yXG4gICAgdGlwLm9mZnNldCA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIG9mZnNldFxuICAgICAgb2Zmc2V0ID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogc2V0cyBvciBnZXRzIHRoZSBodG1sIHZhbHVlIG9mIHRoZSB0b29sdGlwXG4gICAgLy9cbiAgICAvLyB2IC0gU3RyaW5nIHZhbHVlIG9mIHRoZSB0aXBcbiAgICAvL1xuICAgIC8vIFJldHVybnMgaHRtbCB2YWx1ZSBvciB0aXBcbiAgICB0aXAuaHRtbCA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGh0bWxcbiAgICAgIGh0bWwgPSB2ID09IG51bGwgPyB2IDogZDMuZnVuY3Rvcih2KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBkZXN0cm95cyB0aGUgdG9vbHRpcCBhbmQgcmVtb3ZlcyBpdCBmcm9tIHRoZSBET01cbiAgICAvL1xuICAgIC8vIFJldHVybnMgYSB0aXBcbiAgICB0aXAuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYobm9kZSkge1xuICAgICAgICBnZXROb2RlRWwoKS5yZW1vdmUoKTtcbiAgICAgICAgbm9kZSA9IG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGlwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGQzX3RpcF9kaXJlY3Rpb24oKSB7IHJldHVybiAnbicgfVxuICAgIGZ1bmN0aW9uIGQzX3RpcF9vZmZzZXQoKSB7IHJldHVybiBbMCwgMF0gfVxuICAgIGZ1bmN0aW9uIGQzX3RpcF9odG1sKCkgeyByZXR1cm4gJyAnIH1cblxuICAgIHZhciBkaXJlY3Rpb25fY2FsbGJhY2tzID0ge1xuICAgICAgbjogIGRpcmVjdGlvbl9uLFxuICAgICAgczogIGRpcmVjdGlvbl9zLFxuICAgICAgZTogIGRpcmVjdGlvbl9lLFxuICAgICAgdzogIGRpcmVjdGlvbl93LFxuICAgICAgbnc6IGRpcmVjdGlvbl9udyxcbiAgICAgIG5lOiBkaXJlY3Rpb25fbmUsXG4gICAgICBzdzogZGlyZWN0aW9uX3N3LFxuICAgICAgc2U6IGRpcmVjdGlvbl9zZVxuICAgIH07XG5cbiAgICB2YXIgZGlyZWN0aW9ucyA9IE9iamVjdC5rZXlzKGRpcmVjdGlvbl9jYWxsYmFja3MpO1xuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX24oKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5uLnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5uLnggLSBub2RlLm9mZnNldFdpZHRoIC8gMlxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9zKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gucy55LFxuICAgICAgICBsZWZ0OiBiYm94LnMueCAtIG5vZGUub2Zmc2V0V2lkdGggLyAyXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX2UoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5lLnkgLSBub2RlLm9mZnNldEhlaWdodCAvIDIsXG4gICAgICAgIGxlZnQ6IGJib3guZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3coKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC53LnkgLSBub2RlLm9mZnNldEhlaWdodCAvIDIsXG4gICAgICAgIGxlZnQ6IGJib3gudy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9udygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm53LnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5udy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9uZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm5lLnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5uZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3N3KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guc3cueSxcbiAgICAgICAgbGVmdDogYmJveC5zdy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9zZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LnNlLnksXG4gICAgICAgIGxlZnQ6IGJib3guZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5pdE5vZGUoKSB7XG4gICAgICB2YXIgbm9kZSA9IGQzLnNlbGVjdChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSlcbiAgICAgIG5vZGVcbiAgICAgICAgLnN0eWxlKCdwb3NpdGlvbicsICdhYnNvbHV0ZScpXG4gICAgICAgIC5zdHlsZSgndG9wJywgMClcbiAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywgMClcbiAgICAgICAgLnN0eWxlKCdwb2ludGVyLWV2ZW50cycsICdub25lJylcbiAgICAgICAgLnN0eWxlKCdib3gtc2l6aW5nJywgJ2JvcmRlci1ib3gnKVxuXG4gICAgICByZXR1cm4gbm9kZS5ub2RlKClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRTVkdOb2RlKGVsKSB7XG4gICAgICBjb25zb2xlLmxvZyhlbCk7XG4gICAgICBlbCA9IGVsLm5vZGUoKVxuICAgICAgaWYgKCFlbCkgeyAvLyBIVCBodHRwczovL2dpdGh1Yi5jb20vQ2FnZWQvZDMtdGlwL3B1bGwvOTYvZmlsZXNcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnc3ZnJylcbiAgICAgICAgcmV0dXJuIGVsXG5cbiAgICAgIHJldHVybiBlbC5vd25lclNWR0VsZW1lbnRcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXROb2RlRWwoKSB7XG4gICAgICBpZihub2RlID09PSBudWxsKSB7XG4gICAgICAgIG5vZGUgPSBpbml0Tm9kZSgpO1xuICAgICAgICAvLyByZS1hZGQgbm9kZSB0byBET01cbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKTtcbiAgICAgIH07XG4gICAgICByZXR1cm4gZDMuc2VsZWN0KG5vZGUpO1xuICAgIH1cblxuICAgIC8vIFByaXZhdGUgLSBnZXRzIHRoZSBzY3JlZW4gY29vcmRpbmF0ZXMgb2YgYSBzaGFwZVxuICAgIC8vXG4gICAgLy8gR2l2ZW4gYSBzaGFwZSBvbiB0aGUgc2NyZWVuLCB3aWxsIHJldHVybiBhbiBTVkdQb2ludCBmb3IgdGhlIGRpcmVjdGlvbnNcbiAgICAvLyBuKG5vcnRoKSwgcyhzb3V0aCksIGUoZWFzdCksIHcod2VzdCksIG5lKG5vcnRoZWFzdCksIHNlKHNvdXRoZWFzdCksIG53KG5vcnRod2VzdCksXG4gICAgLy8gc3coc291dGh3ZXN0KS5cbiAgICAvL1xuICAgIC8vICAgICstKy0rXG4gICAgLy8gICAgfCAgIHxcbiAgICAvLyAgICArICAgK1xuICAgIC8vICAgIHwgICB8XG4gICAgLy8gICAgKy0rLStcbiAgICAvL1xuICAgIC8vIFJldHVybnMgYW4gT2JqZWN0IHtuLCBzLCBlLCB3LCBudywgc3csIG5lLCBzZX1cbiAgICBmdW5jdGlvbiBnZXRTY3JlZW5CQm94KCkge1xuICAgICAgdmFyIHRhcmdldGVsICAgPSB0YXJnZXQgfHwgZDMuZXZlbnQudGFyZ2V0O1xuXG4gICAgICB3aGlsZSAoJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiB0YXJnZXRlbC5nZXRTY3JlZW5DVE0gJiYgJ3VuZGVmaW5lZCcgPT09IHRhcmdldGVsLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICB0YXJnZXRlbCA9IHRhcmdldGVsLnBhcmVudE5vZGU7XG4gICAgICB9XG5cbiAgICAgIHZhciBiYm94ICAgICAgID0ge30sXG4gICAgICAgICAgbWF0cml4ICAgICA9IHRhcmdldGVsLmdldFNjcmVlbkNUTSgpLFxuICAgICAgICAgIHRiYm94ICAgICAgPSB0YXJnZXRlbC5nZXRCQm94KCksXG4gICAgICAgICAgd2lkdGggICAgICA9IHRiYm94LndpZHRoLFxuICAgICAgICAgIGhlaWdodCAgICAgPSB0YmJveC5oZWlnaHQsXG4gICAgICAgICAgeCAgICAgICAgICA9IHRiYm94LngsXG4gICAgICAgICAgeSAgICAgICAgICA9IHRiYm94LnlcblxuICAgICAgcG9pbnQueCA9IHhcbiAgICAgIHBvaW50LnkgPSB5XG4gICAgICBiYm94Lm53ID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggKz0gd2lkdGhcbiAgICAgIGJib3gubmUgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSArPSBoZWlnaHRcbiAgICAgIGJib3guc2UgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCAtPSB3aWR0aFxuICAgICAgYmJveC5zdyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55IC09IGhlaWdodCAvIDJcbiAgICAgIGJib3gudyAgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCArPSB3aWR0aFxuICAgICAgYmJveC5lID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggLT0gd2lkdGggLyAyXG4gICAgICBwb2ludC55IC09IGhlaWdodCAvIDJcbiAgICAgIGJib3gubiA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55ICs9IGhlaWdodFxuICAgICAgYmJveC5zID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcblxuICAgICAgcmV0dXJuIGJib3hcbiAgICB9XG5cbiAgICByZXR1cm4gdGlwXG4gIH07XG59KSgpOyIsIi8qIE5vZGVMaXN0LnByb3RvdHlwZS5mb3JFYWNoXG5odHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvTm9kZUxpc3QvZm9yRWFjaFxuKi9cblxuZXhwb3J0IGNvbnN0IE5vZGVMaXN0Rm9yRWFjaCA9IChmdW5jdGlvbigpe1xuICBpZiAod2luZG93Lk5vZGVMaXN0ICYmICFOb2RlTGlzdC5wcm90b3R5cGUuZm9yRWFjaCkge1xuICAgICAgTm9kZUxpc3QucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbiAoY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICAgICAgICB0aGlzQXJnID0gdGhpc0FyZyB8fCB3aW5kb3c7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdGhpc1tpXSwgaSwgdGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgfTtcbiAgfVxufSkoKTtcblxuXG5cbi8qKlxuICogU1ZHIGZvY3VzIFxuICogQ29weXJpZ2h0KGMpIDIwMTcsIEpvaG4gT3N0ZXJtYW5cbiAqXG4gKiBNSVQgTGljZW5zZVxuICpcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgXG4gKiBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgXG4gKiB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIFxuICogY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgXG4gKiBmb2xsb3dpbmcgY29uZGl0aW9uczpcblxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBcbiAqIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBcbiAqIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBcbiAqIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFxuICogVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cbiAqL1xuXG4gLy8gSUUvRWRnZSAocGVyaGFwcyBvdGhlcnMpIGRvZXMgbm90IGFsbG93IHByb2dyYW1tYXRpYyBmb2N1c2luZyBvZiBTVkcgRWxlbWVudHMgKHZpYSBgZm9jdXMoKWApLiBTYW1lIGZvciBgYmx1cigpYC5cblxuIGV4cG9ydCBjb25zdCBTVkdGb2N1cyA9IChmdW5jdGlvbigpe1xuICAgIGlmICggJ2ZvY3VzJyBpbiBTVkdFbGVtZW50LnByb3RvdHlwZSA9PT0gZmFsc2UgKSB7XG4gICAgICBTVkdFbGVtZW50LnByb3RvdHlwZS5mb2N1cyA9IEhUTUxFbGVtZW50LnByb3RvdHlwZS5mb2N1cztcbiAgICB9XG4gICAgaWYgKCAnYmx1cicgaW4gU1ZHRWxlbWVudC5wcm90b3R5cGUgPT09IGZhbHNlICkge1xuICAgICAgU1ZHRWxlbWVudC5wcm90b3R5cGUuYmx1ciA9IEhUTUxFbGVtZW50LnByb3RvdHlwZS5ibHVyO1xuICAgIH1cbiB9KSgpO1xuXG5cblxuXG4vKipcbiAqIGlubmVySFRNTCBwcm9wZXJ0eSBmb3IgU1ZHRWxlbWVudFxuICogQ29weXJpZ2h0KGMpIDIwMTAsIEplZmYgU2NoaWxsZXJcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMlxuICpcbiAqIFdvcmtzIGluIGEgU1ZHIGRvY3VtZW50IGluIENocm9tZSA2KywgU2FmYXJpIDUrLCBGaXJlZm94IDQrIGFuZCBJRTkrLlxuICogV29ya3MgaW4gYSBIVE1MNSBkb2N1bWVudCBpbiBDaHJvbWUgNyssIEZpcmVmb3ggNCsgYW5kIElFOSsuXG4gKiBEb2VzIG5vdCB3b3JrIGluIE9wZXJhIHNpbmNlIGl0IGRvZXNuJ3Qgc3VwcG9ydCB0aGUgU1ZHRWxlbWVudCBpbnRlcmZhY2UgeWV0LlxuICpcbiAqIEkgaGF2ZW4ndCBkZWNpZGVkIG9uIHRoZSBiZXN0IG5hbWUgZm9yIHRoaXMgcHJvcGVydHkgLSB0aHVzIHRoZSBkdXBsaWNhdGlvbi5cbiAqL1xuLy8gZWRpdGVkIGJ5IEpvaG4gT3N0ZXJtYW4gdG8gZGVjbGFyZSB0aGUgdmFyaWFibGUgYHNYTUxgLCB3aGljaCB3YXMgcmVmZXJlbmNlZCB3aXRob3V0IGJlaW5nIGRlY2xhcmVkXG4vLyB3aGljaCBmYWlsZWQgc2lsZW50bHkgaW4gaW1wbGljaXQgc3RyaWN0IG1vZGUgb2YgYW4gZXhwb3J0XG5cbi8vIG1vc3QgYnJvd3NlcnMgYWxsb3cgc2V0dGluZyBpbm5lckhUTUwgb2Ygc3ZnIGVsZW1lbnRzIGJ1dCBJRSBkb2VzIG5vdCAobm90IGFuIEhUTUwgZWxlbWVudClcbi8vIHRoaXMgcG9seWZpbGwgcHJvdmlkZXMgdGhhdC4gbmVjZXNzYXJ5IGZvciBkMyBtZXRob2QgYC5odG1sKClgIG9uIHN2ZyBlbGVtZW50c1xuXG5leHBvcnQgY29uc3QgU1ZHSW5uZXJIVE1MID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgc2VyaWFsaXplWE1MID0gZnVuY3Rpb24obm9kZSwgb3V0cHV0KSB7XG4gICAgdmFyIG5vZGVUeXBlID0gbm9kZS5ub2RlVHlwZTtcbiAgICBpZiAobm9kZVR5cGUgPT0gMykgeyAvLyBURVhUIG5vZGVzLlxuICAgICAgLy8gUmVwbGFjZSBzcGVjaWFsIFhNTCBjaGFyYWN0ZXJzIHdpdGggdGhlaXIgZW50aXRpZXMuXG4gICAgICBvdXRwdXQucHVzaChub2RlLnRleHRDb250ZW50LnJlcGxhY2UoLyYvLCAnJmFtcDsnKS5yZXBsYWNlKC88LywgJyZsdDsnKS5yZXBsYWNlKCc+JywgJyZndDsnKSk7XG4gICAgfSBlbHNlIGlmIChub2RlVHlwZSA9PSAxKSB7IC8vIEVMRU1FTlQgbm9kZXMuXG4gICAgICAvLyBTZXJpYWxpemUgRWxlbWVudCBub2Rlcy5cbiAgICAgIG91dHB1dC5wdXNoKCc8Jywgbm9kZS50YWdOYW1lKTtcbiAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZXMoKSkge1xuICAgICAgICB2YXIgYXR0ck1hcCA9IG5vZGUuYXR0cmlidXRlcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGF0dHJNYXAubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICB2YXIgYXR0ck5vZGUgPSBhdHRyTWFwLml0ZW0oaSk7XG4gICAgICAgICAgb3V0cHV0LnB1c2goJyAnLCBhdHRyTm9kZS5uYW1lLCAnPVxcJycsIGF0dHJOb2RlLnZhbHVlLCAnXFwnJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChub2RlLmhhc0NoaWxkTm9kZXMoKSkge1xuICAgICAgICBvdXRwdXQucHVzaCgnPicpO1xuICAgICAgICB2YXIgY2hpbGROb2RlcyA9IG5vZGUuY2hpbGROb2RlcztcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNoaWxkTm9kZXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICBzZXJpYWxpemVYTUwoY2hpbGROb2Rlcy5pdGVtKGkpLCBvdXRwdXQpO1xuICAgICAgICB9XG4gICAgICAgIG91dHB1dC5wdXNoKCc8LycsIG5vZGUudGFnTmFtZSwgJz4nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dC5wdXNoKCcvPicpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobm9kZVR5cGUgPT0gOCkge1xuICAgICAgLy8gVE9ETyhjb2RlZHJlYWQpOiBSZXBsYWNlIHNwZWNpYWwgY2hhcmFjdGVycyB3aXRoIFhNTCBlbnRpdGllcz9cbiAgICAgIG91dHB1dC5wdXNoKCc8IS0tJywgbm9kZS5ub2RlVmFsdWUsICctLT4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVE9ETzogSGFuZGxlIENEQVRBIG5vZGVzLlxuICAgICAgLy8gVE9ETzogSGFuZGxlIEVOVElUWSBub2Rlcy5cbiAgICAgIC8vIFRPRE86IEhhbmRsZSBET0NVTUVOVCBub2Rlcy5cbiAgICAgIHRocm93ICdFcnJvciBzZXJpYWxpemluZyBYTUwuIFVuaGFuZGxlZCBub2RlIG9mIHR5cGU6ICcgKyBub2RlVHlwZTtcbiAgICB9XG4gIH1cbiAgLy8gVGhlIGlubmVySFRNTCBET00gcHJvcGVydHkgZm9yIFNWR0VsZW1lbnQuXG4gIGlmICggJ2lubmVySFRNTCcgaW4gU1ZHRWxlbWVudC5wcm90b3R5cGUgPT09IGZhbHNlICl7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNWR0VsZW1lbnQucHJvdG90eXBlLCAnaW5uZXJIVE1MJywge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG91dHB1dCA9IFtdO1xuICAgICAgICB2YXIgY2hpbGROb2RlID0gdGhpcy5maXJzdENoaWxkO1xuICAgICAgICB3aGlsZSAoY2hpbGROb2RlKSB7XG4gICAgICAgICAgc2VyaWFsaXplWE1MKGNoaWxkTm9kZSwgb3V0cHV0KTtcbiAgICAgICAgICBjaGlsZE5vZGUgPSBjaGlsZE5vZGUubmV4dFNpYmxpbmc7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dHB1dC5qb2luKCcnKTtcbiAgICAgIH0sXG4gICAgICBzZXQ6IGZ1bmN0aW9uKG1hcmt1cFRleHQpIHtcbiAgICAgICAgY29uc29sZS5sb2codGhpcyk7XG4gICAgICAgIC8vIFdpcGUgb3V0IHRoZSBjdXJyZW50IGNvbnRlbnRzIG9mIHRoZSBlbGVtZW50LlxuICAgICAgICB3aGlsZSAodGhpcy5maXJzdENoaWxkKSB7XG4gICAgICAgICAgdGhpcy5yZW1vdmVDaGlsZCh0aGlzLmZpcnN0Q2hpbGQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBQYXJzZSB0aGUgbWFya3VwIGludG8gdmFsaWQgbm9kZXMuXG4gICAgICAgICAgdmFyIGRYTUwgPSBuZXcgRE9NUGFyc2VyKCk7XG4gICAgICAgICAgZFhNTC5hc3luYyA9IGZhbHNlO1xuICAgICAgICAgIC8vIFdyYXAgdGhlIG1hcmt1cCBpbnRvIGEgU1ZHIG5vZGUgdG8gZW5zdXJlIHBhcnNpbmcgd29ya3MuXG4gICAgICAgICAgY29uc29sZS5sb2cobWFya3VwVGV4dCk7XG4gICAgICAgICAgdmFyIHNYTUwgPSAnPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+JyArIG1hcmt1cFRleHQgKyAnPC9zdmc+JztcbiAgICAgICAgICBjb25zb2xlLmxvZyhzWE1MKTtcbiAgICAgICAgICB2YXIgc3ZnRG9jRWxlbWVudCA9IGRYTUwucGFyc2VGcm9tU3RyaW5nKHNYTUwsICd0ZXh0L3htbCcpLmRvY3VtZW50RWxlbWVudDtcblxuICAgICAgICAgIC8vIE5vdyB0YWtlIGVhY2ggbm9kZSwgaW1wb3J0IGl0IGFuZCBhcHBlbmQgdG8gdGhpcyBlbGVtZW50LlxuICAgICAgICAgIHZhciBjaGlsZE5vZGUgPSBzdmdEb2NFbGVtZW50LmZpcnN0Q2hpbGQ7XG4gICAgICAgICAgd2hpbGUoY2hpbGROb2RlKSB7XG4gICAgICAgICAgICB0aGlzLmFwcGVuZENoaWxkKHRoaXMub3duZXJEb2N1bWVudC5pbXBvcnROb2RlKGNoaWxkTm9kZSwgdHJ1ZSkpO1xuICAgICAgICAgICAgY2hpbGROb2RlID0gY2hpbGROb2RlLm5leHRTaWJsaW5nO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFcnJvciBwYXJzaW5nIFhNTCBzdHJpbmcnKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFRoZSBpbm5lclNWRyBET00gcHJvcGVydHkgZm9yIFNWR0VsZW1lbnQuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNWR0VsZW1lbnQucHJvdG90eXBlLCAnaW5uZXJTVkcnLCB7XG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pbm5lckhUTUw7XG4gICAgICB9LFxuICAgICAgc2V0OiBmdW5jdGlvbihtYXJrdXBUZXh0KSB7XG4gICAgICAgIHRoaXMuaW5uZXJIVE1MID0gbWFya3VwVGV4dDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSkoKTtcblxuXG4vLyBodHRwczovL3RjMzkuZ2l0aHViLmlvL2VjbWEyNjIvI3NlYy1hcnJheS5wcm90b3R5cGUuZmluZFxuZXhwb3J0IGNvbnN0IGFycmF5RmluZCA9IChmdW5jdGlvbigpe1xuICBpZiAoIUFycmF5LnByb3RvdHlwZS5maW5kKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEFycmF5LnByb3RvdHlwZSwgJ2ZpbmQnLCB7XG4gICAgICB2YWx1ZTogZnVuY3Rpb24ocHJlZGljYXRlKSB7XG4gICAgICAgLy8gMS4gTGV0IE8gYmUgPyBUb09iamVjdCh0aGlzIHZhbHVlKS5cbiAgICAgICAgaWYgKHRoaXMgPT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1widGhpc1wiIGlzIG51bGwgb3Igbm90IGRlZmluZWQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBvID0gT2JqZWN0KHRoaXMpO1xuXG4gICAgICAgIC8vIDIuIExldCBsZW4gYmUgPyBUb0xlbmd0aCg/IEdldChPLCBcImxlbmd0aFwiKSkuXG4gICAgICAgIHZhciBsZW4gPSBvLmxlbmd0aCA+Pj4gMDtcblxuICAgICAgICAvLyAzLiBJZiBJc0NhbGxhYmxlKHByZWRpY2F0ZSkgaXMgZmFsc2UsIHRocm93IGEgVHlwZUVycm9yIGV4Y2VwdGlvbi5cbiAgICAgICAgaWYgKHR5cGVvZiBwcmVkaWNhdGUgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdwcmVkaWNhdGUgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyA0LiBJZiB0aGlzQXJnIHdhcyBzdXBwbGllZCwgbGV0IFQgYmUgdGhpc0FyZzsgZWxzZSBsZXQgVCBiZSB1bmRlZmluZWQuXG4gICAgICAgIHZhciB0aGlzQXJnID0gYXJndW1lbnRzWzFdO1xuXG4gICAgICAgIC8vIDUuIExldCBrIGJlIDAuXG4gICAgICAgIHZhciBrID0gMDtcblxuICAgICAgICAvLyA2LiBSZXBlYXQsIHdoaWxlIGsgPCBsZW5cbiAgICAgICAgd2hpbGUgKGsgPCBsZW4pIHtcbiAgICAgICAgICAvLyBhLiBMZXQgUGsgYmUgISBUb1N0cmluZyhrKS5cbiAgICAgICAgICAvLyBiLiBMZXQga1ZhbHVlIGJlID8gR2V0KE8sIFBrKS5cbiAgICAgICAgICAvLyBjLiBMZXQgdGVzdFJlc3VsdCBiZSBUb0Jvb2xlYW4oPyBDYWxsKHByZWRpY2F0ZSwgVCwgwqsga1ZhbHVlLCBrLCBPIMK7KSkuXG4gICAgICAgICAgLy8gZC4gSWYgdGVzdFJlc3VsdCBpcyB0cnVlLCByZXR1cm4ga1ZhbHVlLlxuICAgICAgICAgIHZhciBrVmFsdWUgPSBvW2tdO1xuICAgICAgICAgIGlmIChwcmVkaWNhdGUuY2FsbCh0aGlzQXJnLCBrVmFsdWUsIGssIG8pKSB7XG4gICAgICAgICAgICByZXR1cm4ga1ZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBlLiBJbmNyZWFzZSBrIGJ5IDEuXG4gICAgICAgICAgaysrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gNy4gUmV0dXJuIHVuZGVmaW5lZC5cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSkoKTsgXG5cbi8vIENvcHlyaWdodCAoQykgMjAxMS0yMDEyIFNvZnR3YXJlIExhbmd1YWdlcyBMYWIsIFZyaWplIFVuaXZlcnNpdGVpdCBCcnVzc2VsXG4vLyBUaGlzIGNvZGUgaXMgZHVhbC1saWNlbnNlZCB1bmRlciBib3RoIHRoZSBBcGFjaGUgTGljZW5zZSBhbmQgdGhlIE1QTFxuXG4vLyBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuLy8geW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuLy8gWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4vL1xuLy8gaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4vL1xuLy8gVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuLy8gZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuLy8gV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4vLyBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4vLyBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cblxuLyogVmVyc2lvbjogTVBMIDEuMVxuICpcbiAqIFRoZSBjb250ZW50cyBvZiB0aGlzIGZpbGUgYXJlIHN1YmplY3QgdG8gdGhlIE1vemlsbGEgUHVibGljIExpY2Vuc2UgVmVyc2lvblxuICogMS4xICh0aGUgXCJMaWNlbnNlXCIpOyB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGhcbiAqIHRoZSBMaWNlbnNlLiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqIGh0dHA6Ly93d3cubW96aWxsYS5vcmcvTVBML1xuICpcbiAqIFNvZnR3YXJlIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBiYXNpcyxcbiAqIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuIFNlZSB0aGUgTGljZW5zZVxuICogZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcmlnaHRzIGFuZCBsaW1pdGF0aW9ucyB1bmRlciB0aGVcbiAqIExpY2Vuc2UuXG4gKlxuICogVGhlIE9yaWdpbmFsIENvZGUgaXMgYSBzaGltIGZvciB0aGUgRVMtSGFybW9ueSByZWZsZWN0aW9uIG1vZHVsZVxuICpcbiAqIFRoZSBJbml0aWFsIERldmVsb3BlciBvZiB0aGUgT3JpZ2luYWwgQ29kZSBpc1xuICogVG9tIFZhbiBDdXRzZW0sIFZyaWplIFVuaXZlcnNpdGVpdCBCcnVzc2VsLlxuICogUG9ydGlvbnMgY3JlYXRlZCBieSB0aGUgSW5pdGlhbCBEZXZlbG9wZXIgYXJlIENvcHlyaWdodCAoQykgMjAxMS0yMDEyXG4gKiB0aGUgSW5pdGlhbCBEZXZlbG9wZXIuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogQ29udHJpYnV0b3Iocyk6XG4gKlxuICovXG5cbiAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAvLyBUaGlzIGZpbGUgaXMgYSBwb2x5ZmlsbCBmb3IgdGhlIHVwY29taW5nIEVDTUFTY3JpcHQgUmVmbGVjdCBBUEksXG4gLy8gaW5jbHVkaW5nIHN1cHBvcnQgZm9yIFByb3hpZXMuIFNlZSB0aGUgZHJhZnQgc3BlY2lmaWNhdGlvbiBhdDpcbiAvLyBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OnJlZmxlY3RfYXBpXG4gLy8gaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTpkaXJlY3RfcHJveGllc1xuXG4gLy8gRm9yIGFuIGltcGxlbWVudGF0aW9uIG9mIHRoZSBIYW5kbGVyIEFQSSwgc2VlIGhhbmRsZXJzLmpzLCB3aGljaCBpbXBsZW1lbnRzOlxuIC8vIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6dmlydHVhbF9vYmplY3RfYXBpXG5cbiAvLyBUaGlzIGltcGxlbWVudGF0aW9uIHN1cGVyc2VkZXMgdGhlIGVhcmxpZXIgcG9seWZpbGwgYXQ6XG4gLy8gY29kZS5nb29nbGUuY29tL3AvZXMtbGFiL3NvdXJjZS9icm93c2UvdHJ1bmsvc3JjL3Byb3hpZXMvRGlyZWN0UHJveGllcy5qc1xuXG4gLy8gVGhpcyBjb2RlIHdhcyB0ZXN0ZWQgb24gdHJhY2Vtb25rZXkgLyBGaXJlZm94IDEyXG4vLyAgKGFuZCBzaG91bGQgcnVuIGZpbmUgb24gb2xkZXIgRmlyZWZveCB2ZXJzaW9ucyBzdGFydGluZyB3aXRoIEZGNClcbiAvLyBUaGUgY29kZSBhbHNvIHdvcmtzIGNvcnJlY3RseSBvblxuIC8vICAgdjggLS1oYXJtb255X3Byb3hpZXMgLS1oYXJtb255X3dlYWttYXBzICh2My42LjUuMSlcblxuIC8vIExhbmd1YWdlIERlcGVuZGVuY2llczpcbiAvLyAgLSBFQ01BU2NyaXB0IDUvc3RyaWN0XG4gLy8gIC0gXCJvbGRcIiAoaS5lLiBub24tZGlyZWN0KSBIYXJtb255IFByb3hpZXNcbiAvLyAgLSBIYXJtb255IFdlYWtNYXBzXG4gLy8gUGF0Y2hlczpcbiAvLyAgLSBPYmplY3Que2ZyZWV6ZSxzZWFsLHByZXZlbnRFeHRlbnNpb25zfVxuIC8vICAtIE9iamVjdC57aXNGcm96ZW4saXNTZWFsZWQsaXNFeHRlbnNpYmxlfVxuIC8vICAtIE9iamVjdC5nZXRQcm90b3R5cGVPZlxuIC8vICAtIE9iamVjdC5rZXlzXG4gLy8gIC0gT2JqZWN0LnByb3RvdHlwZS52YWx1ZU9mXG4gLy8gIC0gT2JqZWN0LnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mXG4gLy8gIC0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ1xuIC8vICAtIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHlcbiAvLyAgLSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yXG4gLy8gIC0gT2JqZWN0LmRlZmluZVByb3BlcnR5XG4gLy8gIC0gT2JqZWN0LmRlZmluZVByb3BlcnRpZXNcbiAvLyAgLSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lc1xuIC8vICAtIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHNcbiAvLyAgLSBPYmplY3QuZ2V0UHJvdG90eXBlT2ZcbiAvLyAgLSBPYmplY3Quc2V0UHJvdG90eXBlT2ZcbiAvLyAgLSBPYmplY3QuYXNzaWduXG4gLy8gIC0gRnVuY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nXG4gLy8gIC0gRGF0ZS5wcm90b3R5cGUudG9TdHJpbmdcbiAvLyAgLSBBcnJheS5pc0FycmF5XG4gLy8gIC0gQXJyYXkucHJvdG90eXBlLmNvbmNhdFxuIC8vICAtIFByb3h5XG4gLy8gQWRkcyBuZXcgZ2xvYmFsczpcbiAvLyAgLSBSZWZsZWN0XG5cbiAvLyBEaXJlY3QgcHJveGllcyBjYW4gYmUgY3JlYXRlZCB2aWEgUHJveHkodGFyZ2V0LCBoYW5kbGVyKVxuXG4gLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgY29uc3QgcmVmbGVjdCA9IChmdW5jdGlvbihnbG9iYWwpeyAvLyBmdW5jdGlvbi1hcy1tb2R1bGUgcGF0dGVyblxuXCJ1c2Ugc3RyaWN0XCI7XG4gXG4vLyA9PT0gRGlyZWN0IFByb3hpZXM6IEludmFyaWFudCBFbmZvcmNlbWVudCA9PT1cblxuLy8gRGlyZWN0IHByb3hpZXMgYnVpbGQgb24gbm9uLWRpcmVjdCBwcm94aWVzIGJ5IGF1dG9tYXRpY2FsbHkgd3JhcHBpbmdcbi8vIGFsbCB1c2VyLWRlZmluZWQgcHJveHkgaGFuZGxlcnMgaW4gYSBWYWxpZGF0b3IgaGFuZGxlciB0aGF0IGNoZWNrcyBhbmRcbi8vIGVuZm9yY2VzIEVTNSBpbnZhcmlhbnRzLlxuXG4vLyBBIGRpcmVjdCBwcm94eSBpcyBhIHByb3h5IGZvciBhbiBleGlzdGluZyBvYmplY3QgY2FsbGVkIHRoZSB0YXJnZXQgb2JqZWN0LlxuXG4vLyBBIFZhbGlkYXRvciBoYW5kbGVyIGlzIGEgd3JhcHBlciBmb3IgYSB0YXJnZXQgcHJveHkgaGFuZGxlciBILlxuLy8gVGhlIFZhbGlkYXRvciBmb3J3YXJkcyBhbGwgb3BlcmF0aW9ucyB0byBILCBidXQgYWRkaXRpb25hbGx5XG4vLyBwZXJmb3JtcyBhIG51bWJlciBvZiBpbnRlZ3JpdHkgY2hlY2tzIG9uIHRoZSByZXN1bHRzIG9mIHNvbWUgdHJhcHMsXG4vLyB0byBtYWtlIHN1cmUgSCBkb2VzIG5vdCB2aW9sYXRlIHRoZSBFUzUgaW52YXJpYW50cyB3LnIudC4gbm9uLWNvbmZpZ3VyYWJsZVxuLy8gcHJvcGVydGllcyBhbmQgbm9uLWV4dGVuc2libGUsIHNlYWxlZCBvciBmcm96ZW4gb2JqZWN0cy5cblxuLy8gRm9yIGVhY2ggcHJvcGVydHkgdGhhdCBIIGV4cG9zZXMgYXMgb3duLCBub24tY29uZmlndXJhYmxlXG4vLyAoZS5nLiBieSByZXR1cm5pbmcgYSBkZXNjcmlwdG9yIGZyb20gYSBjYWxsIHRvIGdldE93blByb3BlcnR5RGVzY3JpcHRvcilcbi8vIHRoZSBWYWxpZGF0b3IgaGFuZGxlciBkZWZpbmVzIHRob3NlIHByb3BlcnRpZXMgb24gdGhlIHRhcmdldCBvYmplY3QuXG4vLyBXaGVuIHRoZSBwcm94eSBiZWNvbWVzIG5vbi1leHRlbnNpYmxlLCBhbHNvIGNvbmZpZ3VyYWJsZSBvd24gcHJvcGVydGllc1xuLy8gYXJlIGNoZWNrZWQgYWdhaW5zdCB0aGUgdGFyZ2V0LlxuLy8gV2Ugd2lsbCBjYWxsIHByb3BlcnRpZXMgdGhhdCBhcmUgZGVmaW5lZCBvbiB0aGUgdGFyZ2V0IG9iamVjdFxuLy8gXCJmaXhlZCBwcm9wZXJ0aWVzXCIuXG5cbi8vIFdlIHdpbGwgbmFtZSBmaXhlZCBub24tY29uZmlndXJhYmxlIHByb3BlcnRpZXMgXCJzZWFsZWQgcHJvcGVydGllc1wiLlxuLy8gV2Ugd2lsbCBuYW1lIGZpeGVkIG5vbi1jb25maWd1cmFibGUgbm9uLXdyaXRhYmxlIHByb3BlcnRpZXMgXCJmcm96ZW5cbi8vIHByb3BlcnRpZXNcIi5cblxuLy8gVGhlIFZhbGlkYXRvciBoYW5kbGVyIHVwaG9sZHMgdGhlIGZvbGxvd2luZyBpbnZhcmlhbnRzIHcuci50LiBub24tY29uZmlndXJhYmlsaXR5OlxuLy8gLSBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgY2Fubm90IHJlcG9ydCBzZWFsZWQgcHJvcGVydGllcyBhcyBub24tZXhpc3RlbnRcbi8vIC0gZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIGNhbm5vdCByZXBvcnQgaW5jb21wYXRpYmxlIGNoYW5nZXMgdG8gdGhlXG4vLyAgIGF0dHJpYnV0ZXMgb2YgYSBzZWFsZWQgcHJvcGVydHkgKGUuZy4gcmVwb3J0aW5nIGEgbm9uLWNvbmZpZ3VyYWJsZVxuLy8gICBwcm9wZXJ0eSBhcyBjb25maWd1cmFibGUsIG9yIHJlcG9ydGluZyBhIG5vbi1jb25maWd1cmFibGUsIG5vbi13cml0YWJsZVxuLy8gICBwcm9wZXJ0eSBhcyB3cml0YWJsZSlcbi8vIC0gZ2V0UHJvcGVydHlEZXNjcmlwdG9yIGNhbm5vdCByZXBvcnQgc2VhbGVkIHByb3BlcnRpZXMgYXMgbm9uLWV4aXN0ZW50XG4vLyAtIGdldFByb3BlcnR5RGVzY3JpcHRvciBjYW5ub3QgcmVwb3J0IGluY29tcGF0aWJsZSBjaGFuZ2VzIHRvIHRoZVxuLy8gICBhdHRyaWJ1dGVzIG9mIGEgc2VhbGVkIHByb3BlcnR5LiBJdCBfY2FuXyByZXBvcnQgaW5jb21wYXRpYmxlIGNoYW5nZXNcbi8vICAgdG8gdGhlIGF0dHJpYnV0ZXMgb2Ygbm9uLW93biwgaW5oZXJpdGVkIHByb3BlcnRpZXMuXG4vLyAtIGRlZmluZVByb3BlcnR5IGNhbm5vdCBtYWtlIGluY29tcGF0aWJsZSBjaGFuZ2VzIHRvIHRoZSBhdHRyaWJ1dGVzIG9mXG4vLyAgIHNlYWxlZCBwcm9wZXJ0aWVzXG4vLyAtIGRlbGV0ZVByb3BlcnR5IGNhbm5vdCByZXBvcnQgYSBzdWNjZXNzZnVsIGRlbGV0aW9uIG9mIGEgc2VhbGVkIHByb3BlcnR5XG4vLyAtIGhhc093biBjYW5ub3QgcmVwb3J0IGEgc2VhbGVkIHByb3BlcnR5IGFzIG5vbi1leGlzdGVudFxuLy8gLSBoYXMgY2Fubm90IHJlcG9ydCBhIHNlYWxlZCBwcm9wZXJ0eSBhcyBub24tZXhpc3RlbnRcbi8vIC0gZ2V0IGNhbm5vdCByZXBvcnQgaW5jb25zaXN0ZW50IHZhbHVlcyBmb3IgZnJvemVuIGRhdGFcbi8vICAgcHJvcGVydGllcywgYW5kIG11c3QgcmVwb3J0IHVuZGVmaW5lZCBmb3Igc2VhbGVkIGFjY2Vzc29ycyB3aXRoIGFuXG4vLyAgIHVuZGVmaW5lZCBnZXR0ZXJcbi8vIC0gc2V0IGNhbm5vdCByZXBvcnQgYSBzdWNjZXNzZnVsIGFzc2lnbm1lbnQgZm9yIGZyb3plbiBkYXRhXG4vLyAgIHByb3BlcnRpZXMgb3Igc2VhbGVkIGFjY2Vzc29ycyB3aXRoIGFuIHVuZGVmaW5lZCBzZXR0ZXIuXG4vLyAtIGdldHtPd259UHJvcGVydHlOYW1lcyBsaXN0cyBhbGwgc2VhbGVkIHByb3BlcnRpZXMgb2YgdGhlIHRhcmdldC5cbi8vIC0ga2V5cyBsaXN0cyBhbGwgZW51bWVyYWJsZSBzZWFsZWQgcHJvcGVydGllcyBvZiB0aGUgdGFyZ2V0LlxuLy8gLSBlbnVtZXJhdGUgbGlzdHMgYWxsIGVudW1lcmFibGUgc2VhbGVkIHByb3BlcnRpZXMgb2YgdGhlIHRhcmdldC5cbi8vIC0gaWYgYSBwcm9wZXJ0eSBvZiBhIG5vbi1leHRlbnNpYmxlIHByb3h5IGlzIHJlcG9ydGVkIGFzIG5vbi1leGlzdGVudCxcbi8vICAgdGhlbiBpdCBtdXN0IGZvcmV2ZXIgYmUgcmVwb3J0ZWQgYXMgbm9uLWV4aXN0ZW50LiBUaGlzIGFwcGxpZXMgdG9cbi8vICAgb3duIGFuZCBpbmhlcml0ZWQgcHJvcGVydGllcyBhbmQgaXMgZW5mb3JjZWQgaW4gdGhlXG4vLyAgIGRlbGV0ZVByb3BlcnR5LCBnZXR7T3dufVByb3BlcnR5RGVzY3JpcHRvciwgaGFze093bn0sXG4vLyAgIGdldHtPd259UHJvcGVydHlOYW1lcywga2V5cyBhbmQgZW51bWVyYXRlIHRyYXBzXG5cbi8vIFZpb2xhdGlvbiBvZiBhbnkgb2YgdGhlc2UgaW52YXJpYW50cyBieSBIIHdpbGwgcmVzdWx0IGluIFR5cGVFcnJvciBiZWluZ1xuLy8gdGhyb3duLlxuXG4vLyBBZGRpdGlvbmFsbHksIG9uY2UgT2JqZWN0LnByZXZlbnRFeHRlbnNpb25zLCBPYmplY3Quc2VhbCBvciBPYmplY3QuZnJlZXplXG4vLyBpcyBpbnZva2VkIG9uIHRoZSBwcm94eSwgdGhlIHNldCBvZiBvd24gcHJvcGVydHkgbmFtZXMgZm9yIHRoZSBwcm94eSBpc1xuLy8gZml4ZWQuIEFueSBwcm9wZXJ0eSBuYW1lIHRoYXQgaXMgbm90IGZpeGVkIGlzIGNhbGxlZCBhICduZXcnIHByb3BlcnR5LlxuXG4vLyBUaGUgVmFsaWRhdG9yIHVwaG9sZHMgdGhlIGZvbGxvd2luZyBpbnZhcmlhbnRzIHJlZ2FyZGluZyBleHRlbnNpYmlsaXR5OlxuLy8gLSBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgY2Fubm90IHJlcG9ydCBuZXcgcHJvcGVydGllcyBhcyBleGlzdGVudFxuLy8gICAoaXQgbXVzdCByZXBvcnQgdGhlbSBhcyBub24tZXhpc3RlbnQgYnkgcmV0dXJuaW5nIHVuZGVmaW5lZClcbi8vIC0gZGVmaW5lUHJvcGVydHkgY2Fubm90IHN1Y2Nlc3NmdWxseSBhZGQgYSBuZXcgcHJvcGVydHkgKGl0IG11c3QgcmVqZWN0KVxuLy8gLSBnZXRPd25Qcm9wZXJ0eU5hbWVzIGNhbm5vdCBsaXN0IG5ldyBwcm9wZXJ0aWVzXG4vLyAtIGhhc093biBjYW5ub3QgcmVwb3J0IHRydWUgZm9yIG5ldyBwcm9wZXJ0aWVzIChpdCBtdXN0IHJlcG9ydCBmYWxzZSlcbi8vIC0ga2V5cyBjYW5ub3QgbGlzdCBuZXcgcHJvcGVydGllc1xuXG4vLyBJbnZhcmlhbnRzIGN1cnJlbnRseSBub3QgZW5mb3JjZWQ6XG4vLyAtIGdldE93blByb3BlcnR5TmFtZXMgbGlzdHMgb25seSBvd24gcHJvcGVydHkgbmFtZXNcbi8vIC0ga2V5cyBsaXN0cyBvbmx5IGVudW1lcmFibGUgb3duIHByb3BlcnR5IG5hbWVzXG4vLyBCb3RoIHRyYXBzIG1heSBsaXN0IG1vcmUgcHJvcGVydHkgbmFtZXMgdGhhbiBhcmUgYWN0dWFsbHkgZGVmaW5lZCBvbiB0aGVcbi8vIHRhcmdldC5cblxuLy8gSW52YXJpYW50cyB3aXRoIHJlZ2FyZCB0byBpbmhlcml0YW5jZSBhcmUgY3VycmVudGx5IG5vdCBlbmZvcmNlZC5cbi8vIC0gYSBub24tY29uZmlndXJhYmxlIHBvdGVudGlhbGx5IGluaGVyaXRlZCBwcm9wZXJ0eSBvbiBhIHByb3h5IHdpdGhcbi8vICAgbm9uLW11dGFibGUgYW5jZXN0cnkgY2Fubm90IGJlIHJlcG9ydGVkIGFzIG5vbi1leGlzdGVudFxuLy8gKEFuIG9iamVjdCB3aXRoIG5vbi1tdXRhYmxlIGFuY2VzdHJ5IGlzIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0IHdob3NlXG4vLyBbW1Byb3RvdHlwZV1dIGlzIGVpdGhlciBudWxsIG9yIGFuIG9iamVjdCB3aXRoIG5vbi1tdXRhYmxlIGFuY2VzdHJ5LilcblxuLy8gQ2hhbmdlcyBpbiBIYW5kbGVyIEFQSSBjb21wYXJlZCB0byBwcmV2aW91cyBoYXJtb255OnByb3hpZXMsIHNlZTpcbi8vIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPXN0cmF3bWFuOmRpcmVjdF9wcm94aWVzXG4vLyBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OmRpcmVjdF9wcm94aWVzXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLy8gLS0tLSBXZWFrTWFwIHBvbHlmaWxsIC0tLS1cblxuLy8gVE9ETzogZmluZCBhIHByb3BlciBXZWFrTWFwIHBvbHlmaWxsXG5cbi8vIGRlZmluZSBhbiBlbXB0eSBXZWFrTWFwIHNvIHRoYXQgYXQgbGVhc3QgdGhlIFJlZmxlY3QgbW9kdWxlIGNvZGVcbi8vIHdpbGwgd29yayBpbiB0aGUgYWJzZW5jZSBvZiBXZWFrTWFwcy4gUHJveHkgZW11bGF0aW9uIGRlcGVuZHMgb25cbi8vIGFjdHVhbCBXZWFrTWFwcywgc28gd2lsbCBub3Qgd29yayB3aXRoIHRoaXMgbGl0dGxlIHNoaW0uXG5pZiAodHlwZW9mIFdlYWtNYXAgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgZ2xvYmFsLldlYWtNYXAgPSBmdW5jdGlvbigpe307XG4gIGdsb2JhbC5XZWFrTWFwLnByb3RvdHlwZSA9IHtcbiAgICBnZXQ6IGZ1bmN0aW9uKGspIHsgcmV0dXJuIHVuZGVmaW5lZDsgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKGssdikgeyB0aHJvdyBuZXcgRXJyb3IoXCJXZWFrTWFwIG5vdCBzdXBwb3J0ZWRcIik7IH1cbiAgfTtcbn1cblxuLy8gLS0tLSBOb3JtYWxpemF0aW9uIGZ1bmN0aW9ucyBmb3IgcHJvcGVydHkgZGVzY3JpcHRvcnMgLS0tLVxuXG5mdW5jdGlvbiBpc1N0YW5kYXJkQXR0cmlidXRlKG5hbWUpIHtcbiAgcmV0dXJuIC9eKGdldHxzZXR8dmFsdWV8d3JpdGFibGV8ZW51bWVyYWJsZXxjb25maWd1cmFibGUpJC8udGVzdChuYW1lKTtcbn1cblxuLy8gQWRhcHRlZCBmcm9tIEVTNSBzZWN0aW9uIDguMTAuNVxuZnVuY3Rpb24gdG9Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqKSB7XG4gIGlmIChPYmplY3Qob2JqKSAhPT0gb2JqKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInByb3BlcnR5IGRlc2NyaXB0b3Igc2hvdWxkIGJlIGFuIE9iamVjdCwgZ2l2ZW46IFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgb2JqKTtcbiAgfVxuICB2YXIgZGVzYyA9IHt9O1xuICBpZiAoJ2VudW1lcmFibGUnIGluIG9iaikgeyBkZXNjLmVudW1lcmFibGUgPSAhIW9iai5lbnVtZXJhYmxlOyB9XG4gIGlmICgnY29uZmlndXJhYmxlJyBpbiBvYmopIHsgZGVzYy5jb25maWd1cmFibGUgPSAhIW9iai5jb25maWd1cmFibGU7IH1cbiAgaWYgKCd2YWx1ZScgaW4gb2JqKSB7IGRlc2MudmFsdWUgPSBvYmoudmFsdWU7IH1cbiAgaWYgKCd3cml0YWJsZScgaW4gb2JqKSB7IGRlc2Mud3JpdGFibGUgPSAhIW9iai53cml0YWJsZTsgfVxuICBpZiAoJ2dldCcgaW4gb2JqKSB7XG4gICAgdmFyIGdldHRlciA9IG9iai5nZXQ7XG4gICAgaWYgKGdldHRlciAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBnZXR0ZXIgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInByb3BlcnR5IGRlc2NyaXB0b3IgJ2dldCcgYXR0cmlidXRlIG11c3QgYmUgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiY2FsbGFibGUgb3IgdW5kZWZpbmVkLCBnaXZlbjogXCIrZ2V0dGVyKTtcbiAgICB9XG4gICAgZGVzYy5nZXQgPSBnZXR0ZXI7XG4gIH1cbiAgaWYgKCdzZXQnIGluIG9iaikge1xuICAgIHZhciBzZXR0ZXIgPSBvYmouc2V0O1xuICAgIGlmIChzZXR0ZXIgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygc2V0dGVyICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJwcm9wZXJ0eSBkZXNjcmlwdG9yICdzZXQnIGF0dHJpYnV0ZSBtdXN0IGJlIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcImNhbGxhYmxlIG9yIHVuZGVmaW5lZCwgZ2l2ZW46IFwiK3NldHRlcik7XG4gICAgfVxuICAgIGRlc2Muc2V0ID0gc2V0dGVyO1xuICB9XG4gIGlmICgnZ2V0JyBpbiBkZXNjIHx8ICdzZXQnIGluIGRlc2MpIHtcbiAgICBpZiAoJ3ZhbHVlJyBpbiBkZXNjIHx8ICd3cml0YWJsZScgaW4gZGVzYykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInByb3BlcnR5IGRlc2NyaXB0b3IgY2Fubm90IGJlIGJvdGggYSBkYXRhIGFuZCBhbiBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCJhY2Nlc3NvciBkZXNjcmlwdG9yOiBcIitvYmopO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGVzYztcbn1cblxuZnVuY3Rpb24gaXNBY2Nlc3NvckRlc2NyaXB0b3IoZGVzYykge1xuICBpZiAoZGVzYyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiAoJ2dldCcgaW4gZGVzYyB8fCAnc2V0JyBpbiBkZXNjKTtcbn1cbmZ1bmN0aW9uIGlzRGF0YURlc2NyaXB0b3IoZGVzYykge1xuICBpZiAoZGVzYyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiAoJ3ZhbHVlJyBpbiBkZXNjIHx8ICd3cml0YWJsZScgaW4gZGVzYyk7XG59XG5mdW5jdGlvbiBpc0dlbmVyaWNEZXNjcmlwdG9yKGRlc2MpIHtcbiAgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gIWlzQWNjZXNzb3JEZXNjcmlwdG9yKGRlc2MpICYmICFpc0RhdGFEZXNjcmlwdG9yKGRlc2MpO1xufVxuXG5mdW5jdGlvbiB0b0NvbXBsZXRlUHJvcGVydHlEZXNjcmlwdG9yKGRlc2MpIHtcbiAgdmFyIGludGVybmFsRGVzYyA9IHRvUHJvcGVydHlEZXNjcmlwdG9yKGRlc2MpO1xuICBpZiAoaXNHZW5lcmljRGVzY3JpcHRvcihpbnRlcm5hbERlc2MpIHx8IGlzRGF0YURlc2NyaXB0b3IoaW50ZXJuYWxEZXNjKSkge1xuICAgIGlmICghKCd2YWx1ZScgaW4gaW50ZXJuYWxEZXNjKSkgeyBpbnRlcm5hbERlc2MudmFsdWUgPSB1bmRlZmluZWQ7IH1cbiAgICBpZiAoISgnd3JpdGFibGUnIGluIGludGVybmFsRGVzYykpIHsgaW50ZXJuYWxEZXNjLndyaXRhYmxlID0gZmFsc2U7IH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoISgnZ2V0JyBpbiBpbnRlcm5hbERlc2MpKSB7IGludGVybmFsRGVzYy5nZXQgPSB1bmRlZmluZWQ7IH1cbiAgICBpZiAoISgnc2V0JyBpbiBpbnRlcm5hbERlc2MpKSB7IGludGVybmFsRGVzYy5zZXQgPSB1bmRlZmluZWQ7IH1cbiAgfVxuICBpZiAoISgnZW51bWVyYWJsZScgaW4gaW50ZXJuYWxEZXNjKSkgeyBpbnRlcm5hbERlc2MuZW51bWVyYWJsZSA9IGZhbHNlOyB9XG4gIGlmICghKCdjb25maWd1cmFibGUnIGluIGludGVybmFsRGVzYykpIHsgaW50ZXJuYWxEZXNjLmNvbmZpZ3VyYWJsZSA9IGZhbHNlOyB9XG4gIHJldHVybiBpbnRlcm5hbERlc2M7XG59XG5cbmZ1bmN0aW9uIGlzRW1wdHlEZXNjcmlwdG9yKGRlc2MpIHtcbiAgcmV0dXJuICEoJ2dldCcgaW4gZGVzYykgJiZcbiAgICAgICAgICEoJ3NldCcgaW4gZGVzYykgJiZcbiAgICAgICAgICEoJ3ZhbHVlJyBpbiBkZXNjKSAmJlxuICAgICAgICAgISgnd3JpdGFibGUnIGluIGRlc2MpICYmXG4gICAgICAgICAhKCdlbnVtZXJhYmxlJyBpbiBkZXNjKSAmJlxuICAgICAgICAgISgnY29uZmlndXJhYmxlJyBpbiBkZXNjKTtcbn1cblxuZnVuY3Rpb24gaXNFcXVpdmFsZW50RGVzY3JpcHRvcihkZXNjMSwgZGVzYzIpIHtcbiAgcmV0dXJuIHNhbWVWYWx1ZShkZXNjMS5nZXQsIGRlc2MyLmdldCkgJiZcbiAgICAgICAgIHNhbWVWYWx1ZShkZXNjMS5zZXQsIGRlc2MyLnNldCkgJiZcbiAgICAgICAgIHNhbWVWYWx1ZShkZXNjMS52YWx1ZSwgZGVzYzIudmFsdWUpICYmXG4gICAgICAgICBzYW1lVmFsdWUoZGVzYzEud3JpdGFibGUsIGRlc2MyLndyaXRhYmxlKSAmJlxuICAgICAgICAgc2FtZVZhbHVlKGRlc2MxLmVudW1lcmFibGUsIGRlc2MyLmVudW1lcmFibGUpICYmXG4gICAgICAgICBzYW1lVmFsdWUoZGVzYzEuY29uZmlndXJhYmxlLCBkZXNjMi5jb25maWd1cmFibGUpO1xufVxuXG4vLyBjb3BpZWQgZnJvbSBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OmVnYWxcbmZ1bmN0aW9uIHNhbWVWYWx1ZSh4LCB5KSB7XG4gIGlmICh4ID09PSB5KSB7XG4gICAgLy8gMCA9PT0gLTAsIGJ1dCB0aGV5IGFyZSBub3QgaWRlbnRpY2FsXG4gICAgcmV0dXJuIHggIT09IDAgfHwgMSAvIHggPT09IDEgLyB5O1xuICB9XG5cbiAgLy8gTmFOICE9PSBOYU4sIGJ1dCB0aGV5IGFyZSBpZGVudGljYWwuXG4gIC8vIE5hTnMgYXJlIHRoZSBvbmx5IG5vbi1yZWZsZXhpdmUgdmFsdWUsIGkuZS4sIGlmIHggIT09IHgsXG4gIC8vIHRoZW4geCBpcyBhIE5hTi5cbiAgLy8gaXNOYU4gaXMgYnJva2VuOiBpdCBjb252ZXJ0cyBpdHMgYXJndW1lbnQgdG8gbnVtYmVyLCBzb1xuICAvLyBpc05hTihcImZvb1wiKSA9PiB0cnVlXG4gIHJldHVybiB4ICE9PSB4ICYmIHkgIT09IHk7XG59XG5cbi8qKlxuICogUmV0dXJucyBhIGZyZXNoIHByb3BlcnR5IGRlc2NyaXB0b3IgdGhhdCBpcyBndWFyYW50ZWVkXG4gKiB0byBiZSBjb21wbGV0ZSAoaS5lLiBjb250YWluIGFsbCB0aGUgc3RhbmRhcmQgYXR0cmlidXRlcykuXG4gKiBBZGRpdGlvbmFsbHksIGFueSBub24tc3RhbmRhcmQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzIG9mXG4gKiBhdHRyaWJ1dGVzIGFyZSBjb3BpZWQgb3ZlciB0byB0aGUgZnJlc2ggZGVzY3JpcHRvci5cbiAqXG4gKiBJZiBhdHRyaWJ1dGVzIGlzIHVuZGVmaW5lZCwgcmV0dXJucyB1bmRlZmluZWQuXG4gKlxuICogU2VlIGFsc286IGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6cHJveGllc19zZW1hbnRpY3NcbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplQW5kQ29tcGxldGVQcm9wZXJ0eURlc2NyaXB0b3IoYXR0cmlidXRlcykge1xuICBpZiAoYXR0cmlidXRlcyA9PT0gdW5kZWZpbmVkKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cbiAgdmFyIGRlc2MgPSB0b0NvbXBsZXRlUHJvcGVydHlEZXNjcmlwdG9yKGF0dHJpYnV0ZXMpO1xuICAvLyBOb3RlOiBubyBuZWVkIHRvIGNhbGwgRnJvbVByb3BlcnR5RGVzY3JpcHRvcihkZXNjKSwgYXMgd2UgcmVwcmVzZW50XG4gIC8vIFwiaW50ZXJuYWxcIiBwcm9wZXJ0eSBkZXNjcmlwdG9ycyBhcyBwcm9wZXIgT2JqZWN0cyBmcm9tIHRoZSBzdGFydFxuICBmb3IgKHZhciBuYW1lIGluIGF0dHJpYnV0ZXMpIHtcbiAgICBpZiAoIWlzU3RhbmRhcmRBdHRyaWJ1dGUobmFtZSkpIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShkZXNjLCBuYW1lLFxuICAgICAgICB7IHZhbHVlOiBhdHRyaWJ1dGVzW25hbWVdLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlIH0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGVzYztcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgZnJlc2ggcHJvcGVydHkgZGVzY3JpcHRvciB3aG9zZSBzdGFuZGFyZFxuICogYXR0cmlidXRlcyBhcmUgZ3VhcmFudGVlZCB0byBiZSBkYXRhIHByb3BlcnRpZXMgb2YgdGhlIHJpZ2h0IHR5cGUuXG4gKiBBZGRpdGlvbmFsbHksIGFueSBub24tc3RhbmRhcmQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzIG9mXG4gKiBhdHRyaWJ1dGVzIGFyZSBjb3BpZWQgb3ZlciB0byB0aGUgZnJlc2ggZGVzY3JpcHRvci5cbiAqXG4gKiBJZiBhdHRyaWJ1dGVzIGlzIHVuZGVmaW5lZCwgd2lsbCB0aHJvdyBhIFR5cGVFcnJvci5cbiAqXG4gKiBTZWUgYWxzbzogaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTpwcm94aWVzX3NlbWFudGljc1xuICovXG5mdW5jdGlvbiBub3JtYWxpemVQcm9wZXJ0eURlc2NyaXB0b3IoYXR0cmlidXRlcykge1xuICB2YXIgZGVzYyA9IHRvUHJvcGVydHlEZXNjcmlwdG9yKGF0dHJpYnV0ZXMpO1xuICAvLyBOb3RlOiBubyBuZWVkIHRvIGNhbGwgRnJvbUdlbmVyaWNQcm9wZXJ0eURlc2NyaXB0b3IoZGVzYyksIGFzIHdlIHJlcHJlc2VudFxuICAvLyBcImludGVybmFsXCIgcHJvcGVydHkgZGVzY3JpcHRvcnMgYXMgcHJvcGVyIE9iamVjdHMgZnJvbSB0aGUgc3RhcnRcbiAgZm9yICh2YXIgbmFtZSBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgaWYgKCFpc1N0YW5kYXJkQXR0cmlidXRlKG5hbWUpKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZGVzYywgbmFtZSxcbiAgICAgICAgeyB2YWx1ZTogYXR0cmlidXRlc1tuYW1lXSxcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlc2M7XG59XG5cbi8vIHN0b3JlIGEgcmVmZXJlbmNlIHRvIHRoZSByZWFsIEVTNSBwcmltaXRpdmVzIGJlZm9yZSBwYXRjaGluZyB0aGVtIGxhdGVyXG52YXIgcHJpbV9wcmV2ZW50RXh0ZW5zaW9ucyA9ICAgICAgICBPYmplY3QucHJldmVudEV4dGVuc2lvbnMsXG4gICAgcHJpbV9zZWFsID0gICAgICAgICAgICAgICAgICAgICBPYmplY3Quc2VhbCxcbiAgICBwcmltX2ZyZWV6ZSA9ICAgICAgICAgICAgICAgICAgIE9iamVjdC5mcmVlemUsXG4gICAgcHJpbV9pc0V4dGVuc2libGUgPSAgICAgICAgICAgICBPYmplY3QuaXNFeHRlbnNpYmxlLFxuICAgIHByaW1faXNTZWFsZWQgPSAgICAgICAgICAgICAgICAgT2JqZWN0LmlzU2VhbGVkLFxuICAgIHByaW1faXNGcm96ZW4gPSAgICAgICAgICAgICAgICAgT2JqZWN0LmlzRnJvemVuLFxuICAgIHByaW1fZ2V0UHJvdG90eXBlT2YgPSAgICAgICAgICAgT2JqZWN0LmdldFByb3RvdHlwZU9mLFxuICAgIHByaW1fZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcixcbiAgICBwcmltX2RlZmluZVByb3BlcnR5ID0gICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSxcbiAgICBwcmltX2RlZmluZVByb3BlcnRpZXMgPSAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzLFxuICAgIHByaW1fa2V5cyA9ICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmtleXMsXG4gICAgcHJpbV9nZXRPd25Qcm9wZXJ0eU5hbWVzID0gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyxcbiAgICBwcmltX2dldE93blByb3BlcnR5U3ltYm9scyA9ICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMsXG4gICAgcHJpbV9hc3NpZ24gPSAgICAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduLFxuICAgIHByaW1faXNBcnJheSA9ICAgICAgICAgICAgICAgICAgQXJyYXkuaXNBcnJheSxcbiAgICBwcmltX2NvbmNhdCA9ICAgICAgICAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5jb25jYXQsXG4gICAgcHJpbV9pc1Byb3RvdHlwZU9mID0gICAgICAgICAgICBPYmplY3QucHJvdG90eXBlLmlzUHJvdG90eXBlT2YsXG4gICAgcHJpbV9oYXNPd25Qcm9wZXJ0eSA9ICAgICAgICAgICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG4vLyB0aGVzZSB3aWxsIHBvaW50IHRvIHRoZSBwYXRjaGVkIHZlcnNpb25zIG9mIHRoZSByZXNwZWN0aXZlIG1ldGhvZHMgb25cbi8vIE9iamVjdC4gVGhleSBhcmUgdXNlZCB3aXRoaW4gdGhpcyBtb2R1bGUgYXMgdGhlIFwiaW50cmluc2ljXCIgYmluZGluZ3Ncbi8vIG9mIHRoZXNlIG1ldGhvZHMgKGkuZS4gdGhlIFwib3JpZ2luYWxcIiBiaW5kaW5ncyBhcyBkZWZpbmVkIGluIHRoZSBzcGVjKVxudmFyIE9iamVjdF9pc0Zyb3plbixcbiAgICBPYmplY3RfaXNTZWFsZWQsXG4gICAgT2JqZWN0X2lzRXh0ZW5zaWJsZSxcbiAgICBPYmplY3RfZ2V0UHJvdG90eXBlT2YsXG4gICAgT2JqZWN0X2dldE93blByb3BlcnR5TmFtZXM7XG5cbi8qKlxuICogQSBwcm9wZXJ0eSAnbmFtZScgaXMgZml4ZWQgaWYgaXQgaXMgYW4gb3duIHByb3BlcnR5IG9mIHRoZSB0YXJnZXQuXG4gKi9cbmZ1bmN0aW9uIGlzRml4ZWQobmFtZSwgdGFyZ2V0KSB7XG4gIHJldHVybiAoe30pLmhhc093blByb3BlcnR5LmNhbGwodGFyZ2V0LCBuYW1lKTtcbn1cbmZ1bmN0aW9uIGlzU2VhbGVkKG5hbWUsIHRhcmdldCkge1xuICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBuYW1lKTtcbiAgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgcmV0dXJuIGRlc2MuY29uZmlndXJhYmxlID09PSBmYWxzZTtcbn1cbmZ1bmN0aW9uIGlzU2VhbGVkRGVzYyhkZXNjKSB7XG4gIHJldHVybiBkZXNjICE9PSB1bmRlZmluZWQgJiYgZGVzYy5jb25maWd1cmFibGUgPT09IGZhbHNlO1xufVxuXG4vKipcbiAqIFBlcmZvcm1zIGFsbCB2YWxpZGF0aW9uIHRoYXQgT2JqZWN0LmRlZmluZVByb3BlcnR5IHBlcmZvcm1zLFxuICogd2l0aG91dCBhY3R1YWxseSBkZWZpbmluZyB0aGUgcHJvcGVydHkuIFJldHVybnMgYSBib29sZWFuXG4gKiBpbmRpY2F0aW5nIHdoZXRoZXIgdmFsaWRhdGlvbiBzdWNjZWVkZWQuXG4gKlxuICogSW1wbGVtZW50YXRpb24gdHJhbnNsaXRlcmF0ZWQgZnJvbSBFUzUuMSBzZWN0aW9uIDguMTIuOVxuICovXG5mdW5jdGlvbiBpc0NvbXBhdGlibGVEZXNjcmlwdG9yKGV4dGVuc2libGUsIGN1cnJlbnQsIGRlc2MpIHtcbiAgaWYgKGN1cnJlbnQgPT09IHVuZGVmaW5lZCAmJiBleHRlbnNpYmxlID09PSBmYWxzZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoY3VycmVudCA9PT0gdW5kZWZpbmVkICYmIGV4dGVuc2libGUgPT09IHRydWUpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBpZiAoaXNFbXB0eURlc2NyaXB0b3IoZGVzYykpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBpZiAoaXNFcXVpdmFsZW50RGVzY3JpcHRvcihjdXJyZW50LCBkZXNjKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGlmIChjdXJyZW50LmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIHtcbiAgICBpZiAoZGVzYy5jb25maWd1cmFibGUgPT09IHRydWUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKCdlbnVtZXJhYmxlJyBpbiBkZXNjICYmIGRlc2MuZW51bWVyYWJsZSAhPT0gY3VycmVudC5lbnVtZXJhYmxlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGlmIChpc0dlbmVyaWNEZXNjcmlwdG9yKGRlc2MpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYgKGlzRGF0YURlc2NyaXB0b3IoY3VycmVudCkgIT09IGlzRGF0YURlc2NyaXB0b3IoZGVzYykpIHtcbiAgICBpZiAoY3VycmVudC5jb25maWd1cmFibGUgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGlmIChpc0RhdGFEZXNjcmlwdG9yKGN1cnJlbnQpICYmIGlzRGF0YURlc2NyaXB0b3IoZGVzYykpIHtcbiAgICBpZiAoY3VycmVudC5jb25maWd1cmFibGUgPT09IGZhbHNlKSB7XG4gICAgICBpZiAoY3VycmVudC53cml0YWJsZSA9PT0gZmFsc2UgJiYgZGVzYy53cml0YWJsZSA9PT0gdHJ1ZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoY3VycmVudC53cml0YWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgaWYgKCd2YWx1ZScgaW4gZGVzYyAmJiAhc2FtZVZhbHVlKGRlc2MudmFsdWUsIGN1cnJlbnQudmFsdWUpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGlmIChpc0FjY2Vzc29yRGVzY3JpcHRvcihjdXJyZW50KSAmJiBpc0FjY2Vzc29yRGVzY3JpcHRvcihkZXNjKSkge1xuICAgIGlmIChjdXJyZW50LmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgIGlmICgnc2V0JyBpbiBkZXNjICYmICFzYW1lVmFsdWUoZGVzYy5zZXQsIGN1cnJlbnQuc2V0KSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoJ2dldCcgaW4gZGVzYyAmJiAhc2FtZVZhbHVlKGRlc2MuZ2V0LCBjdXJyZW50LmdldCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLy8gRVM2IDcuMy4xMSBTZXRJbnRlZ3JpdHlMZXZlbFxuLy8gbGV2ZWwgaXMgb25lIG9mIFwic2VhbGVkXCIgb3IgXCJmcm96ZW5cIlxuZnVuY3Rpb24gc2V0SW50ZWdyaXR5TGV2ZWwodGFyZ2V0LCBsZXZlbCkge1xuICB2YXIgb3duUHJvcHMgPSBPYmplY3RfZ2V0T3duUHJvcGVydHlOYW1lcyh0YXJnZXQpO1xuICB2YXIgcGVuZGluZ0V4Y2VwdGlvbiA9IHVuZGVmaW5lZDtcbiAgaWYgKGxldmVsID09PSBcInNlYWxlZFwiKSB7XG4gICAgdmFyIGwgPSArb3duUHJvcHMubGVuZ3RoO1xuICAgIHZhciBrO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICBrID0gU3RyaW5nKG93blByb3BzW2ldKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGssIHsgY29uZmlndXJhYmxlOiBmYWxzZSB9KTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKHBlbmRpbmdFeGNlcHRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHBlbmRpbmdFeGNlcHRpb24gPSBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIGxldmVsID09PSBcImZyb3plblwiXG4gICAgdmFyIGwgPSArb3duUHJvcHMubGVuZ3RoO1xuICAgIHZhciBrO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICBrID0gU3RyaW5nKG93blByb3BzW2ldKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciBjdXJyZW50RGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrKTtcbiAgICAgICAgaWYgKGN1cnJlbnREZXNjICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB2YXIgZGVzYztcbiAgICAgICAgICBpZiAoaXNBY2Nlc3NvckRlc2NyaXB0b3IoY3VycmVudERlc2MpKSB7XG4gICAgICAgICAgICBkZXNjID0geyBjb25maWd1cmFibGU6IGZhbHNlIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVzYyA9IHsgY29uZmlndXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IGZhbHNlIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgaywgZGVzYyk7XG4gICAgICAgIH0gICAgICAgIFxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAocGVuZGluZ0V4Y2VwdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcGVuZGluZ0V4Y2VwdGlvbiA9IGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKHBlbmRpbmdFeGNlcHRpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IHBlbmRpbmdFeGNlcHRpb247XG4gIH1cbiAgcmV0dXJuIFJlZmxlY3QucHJldmVudEV4dGVuc2lvbnModGFyZ2V0KTtcbn1cblxuLy8gRVM2IDcuMy4xMiBUZXN0SW50ZWdyaXR5TGV2ZWxcbi8vIGxldmVsIGlzIG9uZSBvZiBcInNlYWxlZFwiIG9yIFwiZnJvemVuXCJcbmZ1bmN0aW9uIHRlc3RJbnRlZ3JpdHlMZXZlbCh0YXJnZXQsIGxldmVsKSB7XG4gIHZhciBpc0V4dGVuc2libGUgPSBPYmplY3RfaXNFeHRlbnNpYmxlKHRhcmdldCk7XG4gIGlmIChpc0V4dGVuc2libGUpIHJldHVybiBmYWxzZTtcbiAgXG4gIHZhciBvd25Qcm9wcyA9IE9iamVjdF9nZXRPd25Qcm9wZXJ0eU5hbWVzKHRhcmdldCk7XG4gIHZhciBwZW5kaW5nRXhjZXB0aW9uID0gdW5kZWZpbmVkO1xuICB2YXIgY29uZmlndXJhYmxlID0gZmFsc2U7XG4gIHZhciB3cml0YWJsZSA9IGZhbHNlO1xuICBcbiAgdmFyIGwgPSArb3duUHJvcHMubGVuZ3RoO1xuICB2YXIgaztcbiAgdmFyIGN1cnJlbnREZXNjO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgIGsgPSBTdHJpbmcob3duUHJvcHNbaV0pO1xuICAgIHRyeSB7XG4gICAgICBjdXJyZW50RGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrKTtcbiAgICAgIGNvbmZpZ3VyYWJsZSA9IGNvbmZpZ3VyYWJsZSB8fCBjdXJyZW50RGVzYy5jb25maWd1cmFibGU7XG4gICAgICBpZiAoaXNEYXRhRGVzY3JpcHRvcihjdXJyZW50RGVzYykpIHtcbiAgICAgICAgd3JpdGFibGUgPSB3cml0YWJsZSB8fCBjdXJyZW50RGVzYy53cml0YWJsZTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAocGVuZGluZ0V4Y2VwdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHBlbmRpbmdFeGNlcHRpb24gPSBlO1xuICAgICAgICBjb25maWd1cmFibGUgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAocGVuZGluZ0V4Y2VwdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgcGVuZGluZ0V4Y2VwdGlvbjtcbiAgfVxuICBpZiAobGV2ZWwgPT09IFwiZnJvemVuXCIgJiYgd3JpdGFibGUgPT09IHRydWUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGNvbmZpZ3VyYWJsZSA9PT0gdHJ1ZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLy8gLS0tLSBUaGUgVmFsaWRhdG9yIGhhbmRsZXIgd3JhcHBlciBhcm91bmQgdXNlciBoYW5kbGVycyAtLS0tXG5cbi8qKlxuICogQHBhcmFtIHRhcmdldCB0aGUgb2JqZWN0IHdyYXBwZWQgYnkgdGhpcyBwcm94eS5cbiAqIEFzIGxvbmcgYXMgdGhlIHByb3h5IGlzIGV4dGVuc2libGUsIG9ubHkgbm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0aWVzXG4gKiBhcmUgY2hlY2tlZCBhZ2FpbnN0IHRoZSB0YXJnZXQuIE9uY2UgdGhlIHByb3h5IGJlY29tZXMgbm9uLWV4dGVuc2libGUsXG4gKiBpbnZhcmlhbnRzIHcuci50LiBub24tZXh0ZW5zaWJpbGl0eSBhcmUgYWxzbyBlbmZvcmNlZC5cbiAqXG4gKiBAcGFyYW0gaGFuZGxlciB0aGUgaGFuZGxlciBvZiB0aGUgZGlyZWN0IHByb3h5LiBUaGUgb2JqZWN0IGVtdWxhdGVkIGJ5XG4gKiB0aGlzIGhhbmRsZXIgaXMgdmFsaWRhdGVkIGFnYWluc3QgdGhlIHRhcmdldCBvYmplY3Qgb2YgdGhlIGRpcmVjdCBwcm94eS5cbiAqIEFueSB2aW9sYXRpb25zIHRoYXQgdGhlIGhhbmRsZXIgbWFrZXMgYWdhaW5zdCB0aGUgaW52YXJpYW50c1xuICogb2YgdGhlIHRhcmdldCB3aWxsIGNhdXNlIGEgVHlwZUVycm9yIHRvIGJlIHRocm93bi5cbiAqXG4gKiBCb3RoIHRhcmdldCBhbmQgaGFuZGxlciBtdXN0IGJlIHByb3BlciBPYmplY3RzIGF0IGluaXRpYWxpemF0aW9uIHRpbWUuXG4gKi9cbmZ1bmN0aW9uIFZhbGlkYXRvcih0YXJnZXQsIGhhbmRsZXIpIHtcbiAgLy8gZm9yIG5vbi1yZXZva2FibGUgcHJveGllcywgdGhlc2UgYXJlIGNvbnN0IHJlZmVyZW5jZXNcbiAgLy8gZm9yIHJldm9rYWJsZSBwcm94aWVzLCBvbiByZXZvY2F0aW9uOlxuICAvLyAtIHRoaXMudGFyZ2V0IGlzIHNldCB0byBudWxsXG4gIC8vIC0gdGhpcy5oYW5kbGVyIGlzIHNldCB0byBhIGhhbmRsZXIgdGhhdCB0aHJvd3Mgb24gYWxsIHRyYXBzXG4gIHRoaXMudGFyZ2V0ICA9IHRhcmdldDtcbiAgdGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcbn1cblxuVmFsaWRhdG9yLnByb3RvdHlwZSA9IHtcblxuICAvKipcbiAgICogSWYgZ2V0VHJhcCByZXR1cm5zIHVuZGVmaW5lZCwgdGhlIGNhbGxlciBzaG91bGQgcGVyZm9ybSB0aGVcbiAgICogZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yLlxuICAgKiBJZiBnZXRUcmFwIHJldHVybnMgbm9ybWFsbHkgb3RoZXJ3aXNlLCB0aGUgcmV0dXJuIHZhbHVlXG4gICAqIHdpbGwgYmUgYSBjYWxsYWJsZSB0cmFwIGZ1bmN0aW9uLiBXaGVuIGNhbGxpbmcgdGhlIHRyYXAgZnVuY3Rpb24sXG4gICAqIHRoZSBjYWxsZXIgaXMgcmVzcG9uc2libGUgZm9yIGJpbmRpbmcgaXRzIHx0aGlzfCB0byB8dGhpcy5oYW5kbGVyfC5cbiAgICovXG4gIGdldFRyYXA6IGZ1bmN0aW9uKHRyYXBOYW1lKSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmhhbmRsZXJbdHJhcE5hbWVdO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIHRoZSB0cmFwIHdhcyBub3QgZGVmaW5lZCxcbiAgICAgIC8vIHBlcmZvcm0gdGhlIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRyYXAgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcih0cmFwTmFtZSArIFwiIHRyYXAgaXMgbm90IGNhbGxhYmxlOiBcIit0cmFwKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJhcDtcbiAgfSxcblxuICAvLyA9PT0gZnVuZGFtZW50YWwgdHJhcHMgPT09XG5cbiAgLyoqXG4gICAqIElmIG5hbWUgZGVub3RlcyBhIGZpeGVkIHByb3BlcnR5LCBjaGVjazpcbiAgICogICAtIHdoZXRoZXIgdGFyZ2V0SGFuZGxlciByZXBvcnRzIGl0IGFzIGV4aXN0ZW50XG4gICAqICAgLSB3aGV0aGVyIHRoZSByZXR1cm5lZCBkZXNjcmlwdG9yIGlzIGNvbXBhdGlibGUgd2l0aCB0aGUgZml4ZWQgcHJvcGVydHlcbiAgICogSWYgdGhlIHByb3h5IGlzIG5vbi1leHRlbnNpYmxlLCBjaGVjazpcbiAgICogICAtIHdoZXRoZXIgbmFtZSBpcyBub3QgYSBuZXcgcHJvcGVydHlcbiAgICogQWRkaXRpb25hbGx5LCB0aGUgcmV0dXJuZWQgZGVzY3JpcHRvciBpcyBub3JtYWxpemVkIGFuZCBjb21wbGV0ZWQuXG4gICAqL1xuICBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3I6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yXCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBSZWZsZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0aGlzLnRhcmdldCwgbmFtZSk7XG4gICAgfVxuXG4gICAgbmFtZSA9IFN0cmluZyhuYW1lKTtcbiAgICB2YXIgZGVzYyA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0LCBuYW1lKTtcbiAgICBkZXNjID0gbm9ybWFsaXplQW5kQ29tcGxldGVQcm9wZXJ0eURlc2NyaXB0b3IoZGVzYyk7XG5cbiAgICB2YXIgdGFyZ2V0RGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGhpcy50YXJnZXQsIG5hbWUpO1xuICAgIHZhciBleHRlbnNpYmxlID0gT2JqZWN0LmlzRXh0ZW5zaWJsZSh0aGlzLnRhcmdldCk7XG5cbiAgICBpZiAoZGVzYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoaXNTZWFsZWREZXNjKHRhcmdldERlc2MpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgcmVwb3J0IG5vbi1jb25maWd1cmFibGUgcHJvcGVydHkgJ1wiK25hbWUrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCInIGFzIG5vbi1leGlzdGVudFwiKTtcbiAgICAgIH1cbiAgICAgIGlmICghZXh0ZW5zaWJsZSAmJiB0YXJnZXREZXNjICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBpZiBoYW5kbGVyIGlzIGFsbG93ZWQgdG8gcmV0dXJuIHVuZGVmaW5lZCwgd2UgY2Fubm90IGd1YXJhbnRlZVxuICAgICAgICAgIC8vIHRoYXQgaXQgd2lsbCBub3QgcmV0dXJuIGEgZGVzY3JpcHRvciBmb3IgdGhpcyBwcm9wZXJ0eSBsYXRlci5cbiAgICAgICAgICAvLyBPbmNlIGEgcHJvcGVydHkgaGFzIGJlZW4gcmVwb3J0ZWQgYXMgbm9uLWV4aXN0ZW50IG9uIGEgbm9uLWV4dGVuc2libGVcbiAgICAgICAgICAvLyBvYmplY3QsIGl0IHNob3VsZCBmb3JldmVyIGJlIHJlcG9ydGVkIGFzIG5vbi1leGlzdGVudFxuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgcmVwb3J0IGV4aXN0aW5nIG93biBwcm9wZXJ0eSAnXCIrbmFtZStcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiJyBhcyBub24tZXhpc3RlbnQgb24gYSBub24tZXh0ZW5zaWJsZSBvYmplY3RcIik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8vIGF0IHRoaXMgcG9pbnQsIHdlIGtub3cgKGRlc2MgIT09IHVuZGVmaW5lZCksIGkuZS5cbiAgICAvLyB0YXJnZXRIYW5kbGVyIHJlcG9ydHMgJ25hbWUnIGFzIGFuIGV4aXN0aW5nIHByb3BlcnR5XG5cbiAgICAvLyBOb3RlOiB3ZSBjb3VsZCBjb2xsYXBzZSB0aGUgZm9sbG93aW5nIHR3byBpZi10ZXN0cyBpbnRvIGEgc2luZ2xlXG4gICAgLy8gdGVzdC4gU2VwYXJhdGluZyBvdXQgdGhlIGNhc2VzIHRvIGltcHJvdmUgZXJyb3IgcmVwb3J0aW5nLlxuXG4gICAgaWYgKCFleHRlbnNpYmxlKSB7XG4gICAgICBpZiAodGFyZ2V0RGVzYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3QgcmVwb3J0IGEgbmV3IG93biBwcm9wZXJ0eSAnXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSArIFwiJyBvbiBhIG5vbi1leHRlbnNpYmxlIG9iamVjdFwiKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoIWlzQ29tcGF0aWJsZURlc2NyaXB0b3IoZXh0ZW5zaWJsZSwgdGFyZ2V0RGVzYywgZGVzYykpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCByZXBvcnQgaW5jb21wYXRpYmxlIHByb3BlcnR5IGRlc2NyaXB0b3IgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJmb3IgcHJvcGVydHkgJ1wiK25hbWUrXCInXCIpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAoZGVzYy5jb25maWd1cmFibGUgPT09IGZhbHNlKSB7XG4gICAgICBpZiAodGFyZ2V0RGVzYyA9PT0gdW5kZWZpbmVkIHx8IHRhcmdldERlc2MuY29uZmlndXJhYmxlID09PSB0cnVlKSB7XG4gICAgICAgIC8vIGlmIHRoZSBwcm9wZXJ0eSBpcyBjb25maWd1cmFibGUgb3Igbm9uLWV4aXN0ZW50IG9uIHRoZSB0YXJnZXQsXG4gICAgICAgIC8vIGJ1dCBpcyByZXBvcnRlZCBhcyBhIG5vbi1jb25maWd1cmFibGUgcHJvcGVydHksIGl0IG1heSBsYXRlciBiZVxuICAgICAgICAvLyByZXBvcnRlZCBhcyBjb25maWd1cmFibGUgb3Igbm9uLWV4aXN0ZW50LCB3aGljaCB2aW9sYXRlcyB0aGVcbiAgICAgICAgLy8gaW52YXJpYW50IHRoYXQgaWYgdGhlIHByb3BlcnR5IG1pZ2h0IGNoYW5nZSBvciBkaXNhcHBlYXIsIHRoZVxuICAgICAgICAvLyBjb25maWd1cmFibGUgYXR0cmlidXRlIG11c3QgYmUgdHJ1ZS5cbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBcImNhbm5vdCByZXBvcnQgYSBub24tY29uZmlndXJhYmxlIGRlc2NyaXB0b3IgXCIgK1xuICAgICAgICAgIFwiZm9yIGNvbmZpZ3VyYWJsZSBvciBub24tZXhpc3RlbnQgcHJvcGVydHkgJ1wiICsgbmFtZSArIFwiJ1wiKTtcbiAgICAgIH1cbiAgICAgIGlmICgnd3JpdGFibGUnIGluIGRlc2MgJiYgZGVzYy53cml0YWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgaWYgKHRhcmdldERlc2Mud3JpdGFibGUgPT09IHRydWUpIHtcbiAgICAgICAgICAvLyBpZiB0aGUgcHJvcGVydHkgaXMgbm9uLWNvbmZpZ3VyYWJsZSwgd3JpdGFibGUgb24gdGhlIHRhcmdldCxcbiAgICAgICAgICAvLyBidXQgaXMgcmVwb3J0ZWQgYXMgbm9uLWNvbmZpZ3VyYWJsZSwgbm9uLXdyaXRhYmxlLCBpdCBtYXkgbGF0ZXJcbiAgICAgICAgICAvLyBiZSByZXBvcnRlZCBhcyBub24tY29uZmlndXJhYmxlLCB3cml0YWJsZSBhZ2Fpbiwgd2hpY2ggdmlvbGF0ZXNcbiAgICAgICAgICAvLyB0aGUgaW52YXJpYW50IHRoYXQgYSBub24tY29uZmlndXJhYmxlLCBub24td3JpdGFibGUgcHJvcGVydHlcbiAgICAgICAgICAvLyBtYXkgbm90IGNoYW5nZSBzdGF0ZS5cbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICAgXCJjYW5ub3QgcmVwb3J0IG5vbi1jb25maWd1cmFibGUsIHdyaXRhYmxlIHByb3BlcnR5ICdcIiArIG5hbWUgK1xuICAgICAgICAgICAgXCInIGFzIG5vbi1jb25maWd1cmFibGUsIG5vbi13cml0YWJsZVwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkZXNjO1xuICB9LFxuXG4gIC8qKlxuICAgKiBJbiB0aGUgZGlyZWN0IHByb3hpZXMgZGVzaWduIHdpdGggcmVmYWN0b3JlZCBwcm90b3R5cGUgY2xpbWJpbmcsXG4gICAqIHRoaXMgdHJhcCBpcyBkZXByZWNhdGVkLiBGb3IgcHJveGllcy1hcy1wcm90b3R5cGVzLCBpbnN0ZWFkXG4gICAqIG9mIGNhbGxpbmcgdGhpcyB0cmFwLCB0aGUgZ2V0LCBzZXQsIGhhcyBvciBlbnVtZXJhdGUgdHJhcHMgYXJlXG4gICAqIGNhbGxlZCBpbnN0ZWFkLlxuICAgKlxuICAgKiBJbiB0aGlzIGltcGxlbWVudGF0aW9uLCB3ZSBcImFidXNlXCIgZ2V0UHJvcGVydHlEZXNjcmlwdG9yIHRvXG4gICAqIHN1cHBvcnQgdHJhcHBpbmcgdGhlIGdldCBvciBzZXQgdHJhcHMgZm9yIHByb3hpZXMtYXMtcHJvdG90eXBlcy5cbiAgICogV2UgZG8gdGhpcyBieSByZXR1cm5pbmcgYSBnZXR0ZXIvc2V0dGVyIHBhaXIgdGhhdCBpbnZva2VzXG4gICAqIHRoZSBjb3JyZXNwb25kaW5nIHRyYXBzLlxuICAgKlxuICAgKiBXaGlsZSB0aGlzIGhhY2sgd29ya3MgZm9yIGluaGVyaXRlZCBwcm9wZXJ0eSBhY2Nlc3MsIGl0IGhhcyBzb21lXG4gICAqIHF1aXJrczpcbiAgICpcbiAgICogSW4gRmlyZWZveCwgdGhpcyB0cmFwIGlzIG9ubHkgY2FsbGVkIGFmdGVyIGEgcHJpb3IgaW52b2NhdGlvblxuICAgKiBvZiB0aGUgJ2hhcycgdHJhcCBoYXMgcmV0dXJuZWQgdHJ1ZS4gSGVuY2UsIGV4cGVjdCB0aGUgZm9sbG93aW5nXG4gICAqIGJlaGF2aW9yOlxuICAgKiA8Y29kZT5cbiAgICogdmFyIGNoaWxkID0gT2JqZWN0LmNyZWF0ZShQcm94eSh0YXJnZXQsIGhhbmRsZXIpKTtcbiAgICogY2hpbGRbbmFtZV0gLy8gdHJpZ2dlcnMgaGFuZGxlci5oYXModGFyZ2V0LCBuYW1lKVxuICAgKiAvLyBpZiB0aGF0IHJldHVybnMgdHJ1ZSwgdHJpZ2dlcnMgaGFuZGxlci5nZXQodGFyZ2V0LCBuYW1lLCBjaGlsZClcbiAgICogPC9jb2RlPlxuICAgKlxuICAgKiBPbiB2OCwgdGhlICdpbicgb3BlcmF0b3IsIHdoZW4gYXBwbGllZCB0byBhbiBvYmplY3QgdGhhdCBpbmhlcml0c1xuICAgKiBmcm9tIGEgcHJveHksIHdpbGwgY2FsbCBnZXRQcm9wZXJ0eURlc2NyaXB0b3IgYW5kIHdhbGsgdGhlIHByb3RvLWNoYWluLlxuICAgKiBUaGF0IGNhbGxzIHRoZSBiZWxvdyBnZXRQcm9wZXJ0eURlc2NyaXB0b3IgdHJhcCBvbiB0aGUgcHJveHkuIFRoZVxuICAgKiByZXN1bHQgb2YgdGhlICdpbictb3BlcmF0b3IgaXMgdGhlbiBkZXRlcm1pbmVkIGJ5IHdoZXRoZXIgdGhpcyB0cmFwXG4gICAqIHJldHVybnMgdW5kZWZpbmVkIG9yIGEgcHJvcGVydHkgZGVzY3JpcHRvciBvYmplY3QuIFRoYXQgaXMgd2h5XG4gICAqIHdlIGZpcnN0IGV4cGxpY2l0bHkgdHJpZ2dlciB0aGUgJ2hhcycgdHJhcCB0byBkZXRlcm1pbmUgd2hldGhlclxuICAgKiB0aGUgcHJvcGVydHkgZXhpc3RzLlxuICAgKlxuICAgKiBUaGlzIGhhcyB0aGUgc2lkZS1lZmZlY3QgdGhhdCB3aGVuIGVudW1lcmF0aW5nIHByb3BlcnRpZXMgb25cbiAgICogYW4gb2JqZWN0IHRoYXQgaW5oZXJpdHMgZnJvbSBhIHByb3h5IGluIHY4LCBvbmx5IHByb3BlcnRpZXNcbiAgICogZm9yIHdoaWNoICdoYXMnIHJldHVybnMgdHJ1ZSBhcmUgcmV0dXJuZWQ6XG4gICAqXG4gICAqIDxjb2RlPlxuICAgKiB2YXIgY2hpbGQgPSBPYmplY3QuY3JlYXRlKFByb3h5KHRhcmdldCwgaGFuZGxlcikpO1xuICAgKiBmb3IgKHZhciBwcm9wIGluIGNoaWxkKSB7XG4gICAqICAgLy8gb25seSBlbnVtZXJhdGVzIHByb3AgaWYgKHByb3AgaW4gY2hpbGQpIHJldHVybnMgdHJ1ZVxuICAgKiB9XG4gICAqIDwvY29kZT5cbiAgICovXG4gIGdldFByb3BlcnR5RGVzY3JpcHRvcjogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBoYW5kbGVyID0gdGhpcztcblxuICAgIGlmICghaGFuZGxlci5oYXMobmFtZSkpIHJldHVybiB1bmRlZmluZWQ7XG5cbiAgICByZXR1cm4ge1xuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGhhbmRsZXIuZ2V0KHRoaXMsIG5hbWUpO1xuICAgICAgfSxcbiAgICAgIHNldDogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgIGlmIChoYW5kbGVyLnNldCh0aGlzLCBuYW1lLCB2YWwpKSB7XG4gICAgICAgICAgcmV0dXJuIHZhbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZmFpbGVkIGFzc2lnbm1lbnQgdG8gXCIrbmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfTtcbiAgfSxcblxuICAvKipcbiAgICogSWYgbmFtZSBkZW5vdGVzIGEgZml4ZWQgcHJvcGVydHksIGNoZWNrIGZvciBpbmNvbXBhdGlibGUgY2hhbmdlcy5cbiAgICogSWYgdGhlIHByb3h5IGlzIG5vbi1leHRlbnNpYmxlLCBjaGVjayB0aGF0IG5ldyBwcm9wZXJ0aWVzIGFyZSByZWplY3RlZC5cbiAgICovXG4gIGRlZmluZVByb3BlcnR5OiBmdW5jdGlvbihuYW1lLCBkZXNjKSB7XG4gICAgLy8gVE9ETyh0dmN1dHNlbSk6IHRoZSBjdXJyZW50IHRyYWNlbW9ua2V5IGltcGxlbWVudGF0aW9uIG9mIHByb3hpZXNcbiAgICAvLyBhdXRvLWNvbXBsZXRlcyAnZGVzYycsIHdoaWNoIGlzIG5vdCBjb3JyZWN0LiAnZGVzYycgc2hvdWxkIGJlXG4gICAgLy8gbm9ybWFsaXplZCwgYnV0IG5vdCBjb21wbGV0ZWQuIENvbnNpZGVyOlxuICAgIC8vIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm94eSwgJ2ZvbycsIHtlbnVtZXJhYmxlOmZhbHNlfSlcbiAgICAvLyBUaGlzIHRyYXAgd2lsbCByZWNlaXZlIGRlc2MgPVxuICAgIC8vICB7dmFsdWU6dW5kZWZpbmVkLHdyaXRhYmxlOmZhbHNlLGVudW1lcmFibGU6ZmFsc2UsY29uZmlndXJhYmxlOmZhbHNlfVxuICAgIC8vIFRoaXMgd2lsbCBhbHNvIHNldCBhbGwgb3RoZXIgYXR0cmlidXRlcyB0byB0aGVpciBkZWZhdWx0IHZhbHVlLFxuICAgIC8vIHdoaWNoIGlzIHVuZXhwZWN0ZWQgYW5kIGRpZmZlcmVudCBmcm9tIFtbRGVmaW5lT3duUHJvcGVydHldXS5cbiAgICAvLyBCdWcgZmlsZWQ6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTYwMTMyOVxuXG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJkZWZpbmVQcm9wZXJ0eVwiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiBSZWZsZWN0LmRlZmluZVByb3BlcnR5KHRoaXMudGFyZ2V0LCBuYW1lLCBkZXNjKTtcbiAgICB9XG5cbiAgICBuYW1lID0gU3RyaW5nKG5hbWUpO1xuICAgIHZhciBkZXNjT2JqID0gbm9ybWFsaXplUHJvcGVydHlEZXNjcmlwdG9yKGRlc2MpO1xuICAgIHZhciBzdWNjZXNzID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQsIG5hbWUsIGRlc2NPYmopO1xuICAgIHN1Y2Nlc3MgPSAhIXN1Y2Nlc3M7IC8vIGNvZXJjZSB0byBCb29sZWFuXG5cbiAgICBpZiAoc3VjY2VzcyA9PT0gdHJ1ZSkge1xuXG4gICAgICB2YXIgdGFyZ2V0RGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGhpcy50YXJnZXQsIG5hbWUpO1xuICAgICAgdmFyIGV4dGVuc2libGUgPSBPYmplY3QuaXNFeHRlbnNpYmxlKHRoaXMudGFyZ2V0KTtcblxuICAgICAgLy8gTm90ZTogd2UgY291bGQgY29sbGFwc2UgdGhlIGZvbGxvd2luZyB0d28gaWYtdGVzdHMgaW50byBhIHNpbmdsZVxuICAgICAgLy8gdGVzdC4gU2VwYXJhdGluZyBvdXQgdGhlIGNhc2VzIHRvIGltcHJvdmUgZXJyb3IgcmVwb3J0aW5nLlxuXG4gICAgICBpZiAoIWV4dGVuc2libGUpIHtcbiAgICAgICAgaWYgKHRhcmdldERlc2MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW5ub3Qgc3VjY2Vzc2Z1bGx5IGFkZCBhIG5ldyBwcm9wZXJ0eSAnXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lICsgXCInIHRvIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0XCIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0YXJnZXREZXNjICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKCFpc0NvbXBhdGlibGVEZXNjcmlwdG9yKGV4dGVuc2libGUsIHRhcmdldERlc2MsIGRlc2MpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCBkZWZpbmUgaW5jb21wYXRpYmxlIHByb3BlcnR5IFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJkZXNjcmlwdG9yIGZvciBwcm9wZXJ0eSAnXCIrbmFtZStcIidcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzRGF0YURlc2NyaXB0b3IodGFyZ2V0RGVzYykgJiZcbiAgICAgICAgICAgIHRhcmdldERlc2MuY29uZmlndXJhYmxlID09PSBmYWxzZSAmJlxuICAgICAgICAgICAgdGFyZ2V0RGVzYy53cml0YWJsZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgaWYgKGRlc2MuY29uZmlndXJhYmxlID09PSBmYWxzZSAmJiBkZXNjLndyaXRhYmxlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAvLyBpZiB0aGUgcHJvcGVydHkgaXMgbm9uLWNvbmZpZ3VyYWJsZSwgd3JpdGFibGUgb24gdGhlIHRhcmdldFxuICAgICAgICAgICAgICAvLyBidXQgd2FzIHN1Y2Nlc3NmdWxseSByZXBvcnRlZCB0byBiZSB1cGRhdGVkIHRvXG4gICAgICAgICAgICAgIC8vIG5vbi1jb25maWd1cmFibGUsIG5vbi13cml0YWJsZSwgaXQgY2FuIGxhdGVyIGJlIHJlcG9ydGVkXG4gICAgICAgICAgICAgIC8vIGFnYWluIGFzIG5vbi1jb25maWd1cmFibGUsIHdyaXRhYmxlLCB3aGljaCB2aW9sYXRlc1xuICAgICAgICAgICAgICAvLyB0aGUgaW52YXJpYW50IHRoYXQgbm9uLWNvbmZpZ3VyYWJsZSwgbm9uLXdyaXRhYmxlIHByb3BlcnRpZXNcbiAgICAgICAgICAgICAgLy8gY2Fubm90IGNoYW5nZSBzdGF0ZVxuICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICAgICAgIFwiY2Fubm90IHN1Y2Nlc3NmdWxseSBkZWZpbmUgbm9uLWNvbmZpZ3VyYWJsZSwgd3JpdGFibGUgXCIgK1xuICAgICAgICAgICAgICAgIFwiIHByb3BlcnR5ICdcIiArIG5hbWUgKyBcIicgYXMgbm9uLWNvbmZpZ3VyYWJsZSwgbm9uLXdyaXRhYmxlXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGRlc2MuY29uZmlndXJhYmxlID09PSBmYWxzZSAmJiAhaXNTZWFsZWREZXNjKHRhcmdldERlc2MpKSB7XG4gICAgICAgIC8vIGlmIHRoZSBwcm9wZXJ0eSBpcyBjb25maWd1cmFibGUgb3Igbm9uLWV4aXN0ZW50IG9uIHRoZSB0YXJnZXQsXG4gICAgICAgIC8vIGJ1dCBpcyBzdWNjZXNzZnVsbHkgYmVpbmcgcmVkZWZpbmVkIGFzIGEgbm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0eSxcbiAgICAgICAgLy8gaXQgbWF5IGxhdGVyIGJlIHJlcG9ydGVkIGFzIGNvbmZpZ3VyYWJsZSBvciBub24tZXhpc3RlbnQsIHdoaWNoIHZpb2xhdGVzXG4gICAgICAgIC8vIHRoZSBpbnZhcmlhbnQgdGhhdCBpZiB0aGUgcHJvcGVydHkgbWlnaHQgY2hhbmdlIG9yIGRpc2FwcGVhciwgdGhlXG4gICAgICAgIC8vIGNvbmZpZ3VyYWJsZSBhdHRyaWJ1dGUgbXVzdCBiZSB0cnVlLlxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIFwiY2Fubm90IHN1Y2Nlc3NmdWxseSBkZWZpbmUgYSBub24tY29uZmlndXJhYmxlIFwiICtcbiAgICAgICAgICBcImRlc2NyaXB0b3IgZm9yIGNvbmZpZ3VyYWJsZSBvciBub24tZXhpc3RlbnQgcHJvcGVydHkgJ1wiICtcbiAgICAgICAgICBuYW1lICsgXCInXCIpO1xuICAgICAgfVxuXG4gICAgfVxuXG4gICAgcmV0dXJuIHN1Y2Nlc3M7XG4gIH0sXG5cbiAgLyoqXG4gICAqIE9uIHN1Y2Nlc3MsIGNoZWNrIHdoZXRoZXIgdGhlIHRhcmdldCBvYmplY3QgaXMgaW5kZWVkIG5vbi1leHRlbnNpYmxlLlxuICAgKi9cbiAgcHJldmVudEV4dGVuc2lvbnM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwicHJldmVudEV4dGVuc2lvbnNcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gUmVmbGVjdC5wcmV2ZW50RXh0ZW5zaW9ucyh0aGlzLnRhcmdldCk7XG4gICAgfVxuXG4gICAgdmFyIHN1Y2Nlc3MgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCk7XG4gICAgc3VjY2VzcyA9ICEhc3VjY2VzczsgLy8gY29lcmNlIHRvIEJvb2xlYW5cbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgaWYgKE9iamVjdF9pc0V4dGVuc2libGUodGhpcy50YXJnZXQpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW4ndCByZXBvcnQgZXh0ZW5zaWJsZSBvYmplY3QgYXMgbm9uLWV4dGVuc2libGU6IFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudGFyZ2V0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHN1Y2Nlc3M7XG4gIH0sXG5cbiAgLyoqXG4gICAqIElmIG5hbWUgZGVub3RlcyBhIHNlYWxlZCBwcm9wZXJ0eSwgY2hlY2sgd2hldGhlciBoYW5kbGVyIHJlamVjdHMuXG4gICAqL1xuICBkZWxldGU6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcImRlbGV0ZVByb3BlcnR5XCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIFJlZmxlY3QuZGVsZXRlUHJvcGVydHkodGhpcy50YXJnZXQsIG5hbWUpO1xuICAgIH1cblxuICAgIG5hbWUgPSBTdHJpbmcobmFtZSk7XG4gICAgdmFyIHJlcyA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0LCBuYW1lKTtcbiAgICByZXMgPSAhIXJlczsgLy8gY29lcmNlIHRvIEJvb2xlYW5cblxuICAgIHZhciB0YXJnZXREZXNjO1xuICAgIGlmIChyZXMgPT09IHRydWUpIHtcbiAgICAgIHRhcmdldERlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRoaXMudGFyZ2V0LCBuYW1lKTtcbiAgICAgIGlmICh0YXJnZXREZXNjICE9PSB1bmRlZmluZWQgJiYgdGFyZ2V0RGVzYy5jb25maWd1cmFibGUgPT09IGZhbHNlKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJwcm9wZXJ0eSAnXCIgKyBuYW1lICsgXCInIGlzIG5vbi1jb25maWd1cmFibGUgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJhbmQgY2FuJ3QgYmUgZGVsZXRlZFwiKTtcbiAgICAgIH1cbiAgICAgIGlmICh0YXJnZXREZXNjICE9PSB1bmRlZmluZWQgJiYgIU9iamVjdF9pc0V4dGVuc2libGUodGhpcy50YXJnZXQpKSB7XG4gICAgICAgIC8vIGlmIHRoZSBwcm9wZXJ0eSBzdGlsbCBleGlzdHMgb24gYSBub24tZXh0ZW5zaWJsZSB0YXJnZXQgYnV0XG4gICAgICAgIC8vIGlzIHJlcG9ydGVkIGFzIHN1Y2Nlc3NmdWxseSBkZWxldGVkLCBpdCBtYXkgbGF0ZXIgYmUgcmVwb3J0ZWRcbiAgICAgICAgLy8gYXMgcHJlc2VudCwgd2hpY2ggdmlvbGF0ZXMgdGhlIGludmFyaWFudCB0aGF0IGFuIG93biBwcm9wZXJ0eSxcbiAgICAgICAgLy8gZGVsZXRlZCBmcm9tIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0IGNhbm5vdCByZWFwcGVhci5cbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBcImNhbm5vdCBzdWNjZXNzZnVsbHkgZGVsZXRlIGV4aXN0aW5nIHByb3BlcnR5ICdcIiArIG5hbWUgK1xuICAgICAgICAgIFwiJyBvbiBhIG5vbi1leHRlbnNpYmxlIG9iamVjdFwiKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUaGUgZ2V0T3duUHJvcGVydHlOYW1lcyB0cmFwIHdhcyByZXBsYWNlZCBieSB0aGUgb3duS2V5cyB0cmFwLFxuICAgKiB3aGljaCBub3cgYWxzbyByZXR1cm5zIGFuIGFycmF5IChvZiBzdHJpbmdzIG9yIHN5bWJvbHMpIGFuZFxuICAgKiB3aGljaCBwZXJmb3JtcyB0aGUgc2FtZSByaWdvcm91cyBpbnZhcmlhbnQgY2hlY2tzIGFzIGdldE93blByb3BlcnR5TmFtZXNcbiAgICpcbiAgICogU2VlIGlzc3VlICM0OCBvbiBob3cgdGhpcyB0cmFwIGNhbiBzdGlsbCBnZXQgaW52b2tlZCBieSBleHRlcm5hbCBsaWJzXG4gICAqIHRoYXQgZG9uJ3QgdXNlIHRoZSBwYXRjaGVkIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIGZ1bmN0aW9uLlxuICAgKi9cbiAgZ2V0T3duUHJvcGVydHlOYW1lczogZnVuY3Rpb24oKSB7XG4gICAgLy8gTm90ZTogcmVtb3ZlZCBkZXByZWNhdGlvbiB3YXJuaW5nIHRvIGF2b2lkIGRlcGVuZGVuY3kgb24gJ2NvbnNvbGUnXG4gICAgLy8gKGFuZCBvbiBub2RlLCBzaG91bGQgYW55d2F5IHVzZSB1dGlsLmRlcHJlY2F0ZSkuIERlcHJlY2F0aW9uIHdhcm5pbmdzXG4gICAgLy8gY2FuIGFsc28gYmUgYW5ub3lpbmcgd2hlbiB0aGV5IGFyZSBvdXRzaWRlIG9mIHRoZSB1c2VyJ3MgY29udHJvbCwgZS5nLlxuICAgIC8vIHdoZW4gYW4gZXh0ZXJuYWwgbGlicmFyeSBjYWxscyB1bnBhdGNoZWQgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMuXG4gICAgLy8gU2luY2UgdGhlcmUgaXMgYSBjbGVhbiBmYWxsYmFjayB0byBgb3duS2V5c2AsIHRoZSBmYWN0IHRoYXQgdGhlXG4gICAgLy8gZGVwcmVjYXRlZCBtZXRob2QgaXMgc3RpbGwgY2FsbGVkIGlzIG1vc3RseSBoYXJtbGVzcyBhbnl3YXkuXG4gICAgLy8gU2VlIGFsc28gaXNzdWVzICM2NSBhbmQgIzY2LlxuICAgIC8vIGNvbnNvbGUud2FybihcImdldE93blByb3BlcnR5TmFtZXMgdHJhcCBpcyBkZXByZWNhdGVkLiBVc2Ugb3duS2V5cyBpbnN0ZWFkXCIpO1xuICAgIHJldHVybiB0aGlzLm93bktleXMoKTtcbiAgfSxcblxuICAvKipcbiAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIHRyYXAgcmVzdWx0IGRvZXMgbm90IGNvbnRhaW4gYW55IG5ldyBwcm9wZXJ0aWVzXG4gICAqIGlmIHRoZSBwcm94eSBpcyBub24tZXh0ZW5zaWJsZS5cbiAgICpcbiAgICogQW55IG93biBub24tY29uZmlndXJhYmxlIHByb3BlcnRpZXMgb2YgdGhlIHRhcmdldCB0aGF0IGFyZSBub3QgaW5jbHVkZWRcbiAgICogaW4gdGhlIHRyYXAgcmVzdWx0IGdpdmUgcmlzZSB0byBhIFR5cGVFcnJvci4gQXMgc3VjaCwgd2UgY2hlY2sgd2hldGhlciB0aGVcbiAgICogcmV0dXJuZWQgcmVzdWx0IGNvbnRhaW5zIGF0IGxlYXN0IGFsbCBzZWFsZWQgcHJvcGVydGllcyBvZiB0aGUgdGFyZ2V0XG4gICAqIG9iamVjdC5cbiAgICpcbiAgICogQWRkaXRpb25hbGx5LCB0aGUgdHJhcCByZXN1bHQgaXMgbm9ybWFsaXplZC5cbiAgICogSW5zdGVhZCBvZiByZXR1cm5pbmcgdGhlIHRyYXAgcmVzdWx0IGRpcmVjdGx5OlxuICAgKiAgLSBjcmVhdGUgYW5kIHJldHVybiBhIGZyZXNoIEFycmF5LFxuICAgKiAgLSBvZiB3aGljaCBlYWNoIGVsZW1lbnQgaXMgY29lcmNlZCB0byBhIFN0cmluZ1xuICAgKlxuICAgKiBUaGlzIHRyYXAgaXMgY2FsbGVkIGEuby4gYnkgUmVmbGVjdC5vd25LZXlzLCBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lc1xuICAgKiBhbmQgT2JqZWN0LmtleXMgKHRoZSBsYXR0ZXIgZmlsdGVycyBvdXQgb25seSB0aGUgZW51bWVyYWJsZSBvd24gcHJvcGVydGllcykuXG4gICAqL1xuICBvd25LZXlzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcIm93bktleXNcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gUmVmbGVjdC5vd25LZXlzKHRoaXMudGFyZ2V0KTtcbiAgICB9XG5cbiAgICB2YXIgdHJhcFJlc3VsdCA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0KTtcblxuICAgIC8vIHByb3BOYW1lcyBpcyB1c2VkIGFzIGEgc2V0IG9mIHN0cmluZ3NcbiAgICB2YXIgcHJvcE5hbWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICB2YXIgbnVtUHJvcHMgPSArdHJhcFJlc3VsdC5sZW5ndGg7XG4gICAgdmFyIHJlc3VsdCA9IG5ldyBBcnJheShudW1Qcm9wcyk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG51bVByb3BzOyBpKyspIHtcbiAgICAgIHZhciBzID0gU3RyaW5nKHRyYXBSZXN1bHRbaV0pO1xuICAgICAgaWYgKCFPYmplY3QuaXNFeHRlbnNpYmxlKHRoaXMudGFyZ2V0KSAmJiAhaXNGaXhlZChzLCB0aGlzLnRhcmdldCkpIHtcbiAgICAgICAgLy8gbm9uLWV4dGVuc2libGUgcHJveGllcyBkb24ndCB0b2xlcmF0ZSBuZXcgb3duIHByb3BlcnR5IG5hbWVzXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJvd25LZXlzIHRyYXAgY2Fubm90IGxpc3QgYSBuZXcgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJwcm9wZXJ0eSAnXCIrcytcIicgb24gYSBub24tZXh0ZW5zaWJsZSBvYmplY3RcIik7XG4gICAgICB9XG5cbiAgICAgIHByb3BOYW1lc1tzXSA9IHRydWU7XG4gICAgICByZXN1bHRbaV0gPSBzO1xuICAgIH1cblxuICAgIHZhciBvd25Qcm9wcyA9IE9iamVjdF9nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMudGFyZ2V0KTtcbiAgICB2YXIgdGFyZ2V0ID0gdGhpcy50YXJnZXQ7XG4gICAgb3duUHJvcHMuZm9yRWFjaChmdW5jdGlvbiAob3duUHJvcCkge1xuICAgICAgaWYgKCFwcm9wTmFtZXNbb3duUHJvcF0pIHtcbiAgICAgICAgaWYgKGlzU2VhbGVkKG93blByb3AsIHRhcmdldCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwib3duS2V5cyB0cmFwIGZhaWxlZCB0byBpbmNsdWRlIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJub24tY29uZmlndXJhYmxlIHByb3BlcnR5ICdcIitvd25Qcm9wK1wiJ1wiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIU9iamVjdC5pc0V4dGVuc2libGUodGFyZ2V0KSAmJlxuICAgICAgICAgICAgaXNGaXhlZChvd25Qcm9wLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAvLyBpZiBoYW5kbGVyIGlzIGFsbG93ZWQgdG8gcmVwb3J0IG93blByb3AgYXMgbm9uLWV4aXN0ZW50LFxuICAgICAgICAgICAgLy8gd2UgY2Fubm90IGd1YXJhbnRlZSB0aGF0IGl0IHdpbGwgbmV2ZXIgbGF0ZXIgcmVwb3J0IGl0IGFzXG4gICAgICAgICAgICAvLyBleGlzdGVudC4gT25jZSBhIHByb3BlcnR5IGhhcyBiZWVuIHJlcG9ydGVkIGFzIG5vbi1leGlzdGVudFxuICAgICAgICAgICAgLy8gb24gYSBub24tZXh0ZW5zaWJsZSBvYmplY3QsIGl0IHNob3VsZCBmb3JldmVyIGJlIHJlcG9ydGVkIGFzXG4gICAgICAgICAgICAvLyBub24tZXhpc3RlbnRcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJvd25LZXlzIHRyYXAgY2Fubm90IHJlcG9ydCBleGlzdGluZyBvd24gcHJvcGVydHkgJ1wiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvd25Qcm9wK1wiJyBhcyBub24tZXhpc3RlbnQgb24gYSBub24tZXh0ZW5zaWJsZSBvYmplY3RcIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqIENoZWNrcyB3aGV0aGVyIHRoZSB0cmFwIHJlc3VsdCBpcyBjb25zaXN0ZW50IHdpdGggdGhlIHN0YXRlIG9mIHRoZVxuICAgKiB3cmFwcGVkIHRhcmdldC5cbiAgICovXG4gIGlzRXh0ZW5zaWJsZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJpc0V4dGVuc2libGVcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gUmVmbGVjdC5pc0V4dGVuc2libGUodGhpcy50YXJnZXQpO1xuICAgIH1cblxuICAgIHZhciByZXN1bHQgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCk7XG4gICAgcmVzdWx0ID0gISFyZXN1bHQ7IC8vIGNvZXJjZSB0byBCb29sZWFuXG4gICAgdmFyIHN0YXRlID0gT2JqZWN0X2lzRXh0ZW5zaWJsZSh0aGlzLnRhcmdldCk7XG4gICAgaWYgKHJlc3VsdCAhPT0gc3RhdGUpIHtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCByZXBvcnQgbm9uLWV4dGVuc2libGUgb2JqZWN0IGFzIGV4dGVuc2libGU6IFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRhcmdldCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHJlcG9ydCBleHRlbnNpYmxlIG9iamVjdCBhcyBub24tZXh0ZW5zaWJsZTogXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudGFyZ2V0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHN0YXRlO1xuICB9LFxuXG4gIC8qKlxuICAgKiBDaGVjayB3aGV0aGVyIHRoZSB0cmFwIHJlc3VsdCBjb3JyZXNwb25kcyB0byB0aGUgdGFyZ2V0J3MgW1tQcm90b3R5cGVdXVxuICAgKi9cbiAgZ2V0UHJvdG90eXBlT2Y6IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwiZ2V0UHJvdG90eXBlT2ZcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gUmVmbGVjdC5nZXRQcm90b3R5cGVPZih0aGlzLnRhcmdldCk7XG4gICAgfVxuXG4gICAgdmFyIGFsbGVnZWRQcm90byA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0KTtcblxuICAgIGlmICghT2JqZWN0X2lzRXh0ZW5zaWJsZSh0aGlzLnRhcmdldCkpIHtcbiAgICAgIHZhciBhY3R1YWxQcm90byA9IE9iamVjdF9nZXRQcm90b3R5cGVPZih0aGlzLnRhcmdldCk7XG4gICAgICBpZiAoIXNhbWVWYWx1ZShhbGxlZ2VkUHJvdG8sIGFjdHVhbFByb3RvKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicHJvdG90eXBlIHZhbHVlIGRvZXMgbm90IG1hdGNoOiBcIiArIHRoaXMudGFyZ2V0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYWxsZWdlZFByb3RvO1xuICB9LFxuXG4gIC8qKlxuICAgKiBJZiB0YXJnZXQgaXMgbm9uLWV4dGVuc2libGUgYW5kIHNldFByb3RvdHlwZU9mIHRyYXAgcmV0dXJucyB0cnVlLFxuICAgKiBjaGVjayB3aGV0aGVyIHRoZSB0cmFwIHJlc3VsdCBjb3JyZXNwb25kcyB0byB0aGUgdGFyZ2V0J3MgW1tQcm90b3R5cGVdXVxuICAgKi9cbiAgc2V0UHJvdG90eXBlT2Y6IGZ1bmN0aW9uKG5ld1Byb3RvKSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJzZXRQcm90b3R5cGVPZlwiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiBSZWZsZWN0LnNldFByb3RvdHlwZU9mKHRoaXMudGFyZ2V0LCBuZXdQcm90byk7XG4gICAgfVxuXG4gICAgdmFyIHN1Y2Nlc3MgPSB0cmFwLmNhbGwodGhpcy5oYW5kbGVyLCB0aGlzLnRhcmdldCwgbmV3UHJvdG8pO1xuXG4gICAgc3VjY2VzcyA9ICEhc3VjY2VzcztcbiAgICBpZiAoc3VjY2VzcyAmJiAhT2JqZWN0X2lzRXh0ZW5zaWJsZSh0aGlzLnRhcmdldCkpIHtcbiAgICAgIHZhciBhY3R1YWxQcm90byA9IE9iamVjdF9nZXRQcm90b3R5cGVPZih0aGlzLnRhcmdldCk7XG4gICAgICBpZiAoIXNhbWVWYWx1ZShuZXdQcm90bywgYWN0dWFsUHJvdG8pKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJwcm90b3R5cGUgdmFsdWUgZG9lcyBub3QgbWF0Y2g6IFwiICsgdGhpcy50YXJnZXQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdWNjZXNzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBJbiB0aGUgZGlyZWN0IHByb3hpZXMgZGVzaWduIHdpdGggcmVmYWN0b3JlZCBwcm90b3R5cGUgY2xpbWJpbmcsXG4gICAqIHRoaXMgdHJhcCBpcyBkZXByZWNhdGVkLiBGb3IgcHJveGllcy1hcy1wcm90b3R5cGVzLCBmb3ItaW4gd2lsbFxuICAgKiBjYWxsIHRoZSBlbnVtZXJhdGUoKSB0cmFwLiBJZiB0aGF0IHRyYXAgaXMgbm90IGRlZmluZWQsIHRoZVxuICAgKiBvcGVyYXRpb24gaXMgZm9yd2FyZGVkIHRvIHRoZSB0YXJnZXQsIG5vIG1vcmUgZmFsbGJhY2sgb24gdGhpc1xuICAgKiBmdW5kYW1lbnRhbCB0cmFwLlxuICAgKi9cbiAgZ2V0UHJvcGVydHlOYW1lczogZnVuY3Rpb24oKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImdldFByb3BlcnR5TmFtZXMgdHJhcCBpcyBkZXByZWNhdGVkXCIpO1xuICB9LFxuXG4gIC8vID09PSBkZXJpdmVkIHRyYXBzID09PVxuXG4gIC8qKlxuICAgKiBJZiBuYW1lIGRlbm90ZXMgYSBmaXhlZCBwcm9wZXJ0eSwgY2hlY2sgd2hldGhlciB0aGUgdHJhcCByZXR1cm5zIHRydWUuXG4gICAqL1xuICBoYXM6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcImhhc1wiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiBSZWZsZWN0Lmhhcyh0aGlzLnRhcmdldCwgbmFtZSk7XG4gICAgfVxuXG4gICAgbmFtZSA9IFN0cmluZyhuYW1lKTtcbiAgICB2YXIgcmVzID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQsIG5hbWUpO1xuICAgIHJlcyA9ICEhcmVzOyAvLyBjb2VyY2UgdG8gQm9vbGVhblxuXG4gICAgaWYgKHJlcyA9PT0gZmFsc2UpIHtcbiAgICAgIGlmIChpc1NlYWxlZChuYW1lLCB0aGlzLnRhcmdldCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCByZXBvcnQgZXhpc3Rpbmcgbm9uLWNvbmZpZ3VyYWJsZSBvd24gXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJwcm9wZXJ0eSAnXCIrIG5hbWUgKyBcIicgYXMgYSBub24tZXhpc3RlbnQgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJwcm9wZXJ0eVwiKTtcbiAgICAgIH1cbiAgICAgIGlmICghT2JqZWN0LmlzRXh0ZW5zaWJsZSh0aGlzLnRhcmdldCkgJiZcbiAgICAgICAgICBpc0ZpeGVkKG5hbWUsIHRoaXMudGFyZ2V0KSkge1xuICAgICAgICAgIC8vIGlmIGhhbmRsZXIgaXMgYWxsb3dlZCB0byByZXR1cm4gZmFsc2UsIHdlIGNhbm5vdCBndWFyYW50ZWVcbiAgICAgICAgICAvLyB0aGF0IGl0IHdpbGwgbm90IHJldHVybiB0cnVlIGZvciB0aGlzIHByb3BlcnR5IGxhdGVyLlxuICAgICAgICAgIC8vIE9uY2UgYSBwcm9wZXJ0eSBoYXMgYmVlbiByZXBvcnRlZCBhcyBub24tZXhpc3RlbnQgb24gYSBub24tZXh0ZW5zaWJsZVxuICAgICAgICAgIC8vIG9iamVjdCwgaXQgc2hvdWxkIGZvcmV2ZXIgYmUgcmVwb3J0ZWQgYXMgbm9uLWV4aXN0ZW50XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCByZXBvcnQgZXhpc3Rpbmcgb3duIHByb3BlcnR5ICdcIituYW1lK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCInIGFzIG5vbi1leGlzdGVudCBvbiBhIG5vbi1leHRlbnNpYmxlIG9iamVjdFwiKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpZiByZXMgPT09IHRydWUsIHdlIGRvbid0IG5lZWQgdG8gY2hlY2sgZm9yIGV4dGVuc2liaWxpdHlcbiAgICAvLyBldmVuIGZvciBhIG5vbi1leHRlbnNpYmxlIHByb3h5IHRoYXQgaGFzIG5vIG93biBuYW1lIHByb3BlcnR5LFxuICAgIC8vIHRoZSBwcm9wZXJ0eSBtYXkgaGF2ZSBiZWVuIGluaGVyaXRlZFxuXG4gICAgcmV0dXJuIHJlcztcbiAgfSxcblxuICAvKipcbiAgICogSWYgbmFtZSBkZW5vdGVzIGEgZml4ZWQgbm9uLWNvbmZpZ3VyYWJsZSwgbm9uLXdyaXRhYmxlIGRhdGEgcHJvcGVydHksXG4gICAqIGNoZWNrIGl0cyByZXR1cm4gdmFsdWUgYWdhaW5zdCB0aGUgcHJldmlvdXNseSBhc3NlcnRlZCB2YWx1ZSBvZiB0aGVcbiAgICogZml4ZWQgcHJvcGVydHkuXG4gICAqL1xuICBnZXQ6IGZ1bmN0aW9uKHJlY2VpdmVyLCBuYW1lKSB7XG5cbiAgICAvLyBleHBlcmltZW50YWwgc3VwcG9ydCBmb3IgaW52b2tlKCkgdHJhcCBvbiBwbGF0Zm9ybXMgdGhhdFxuICAgIC8vIHN1cHBvcnQgX19ub1N1Y2hNZXRob2RfX1xuICAgIC8qXG4gICAgaWYgKG5hbWUgPT09ICdfX25vU3VjaE1ldGhvZF9fJykge1xuICAgICAgdmFyIGhhbmRsZXIgPSB0aGlzO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKG5hbWUsIGFyZ3MpIHtcbiAgICAgICAgcmV0dXJuIGhhbmRsZXIuaW52b2tlKHJlY2VpdmVyLCBuYW1lLCBhcmdzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgKi9cblxuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwiZ2V0XCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgcmV0dXJuIFJlZmxlY3QuZ2V0KHRoaXMudGFyZ2V0LCBuYW1lLCByZWNlaXZlcik7XG4gICAgfVxuXG4gICAgbmFtZSA9IFN0cmluZyhuYW1lKTtcbiAgICB2YXIgcmVzID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQsIG5hbWUsIHJlY2VpdmVyKTtcblxuICAgIHZhciBmaXhlZERlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRoaXMudGFyZ2V0LCBuYW1lKTtcbiAgICAvLyBjaGVjayBjb25zaXN0ZW5jeSBvZiB0aGUgcmV0dXJuZWQgdmFsdWVcbiAgICBpZiAoZml4ZWREZXNjICE9PSB1bmRlZmluZWQpIHsgLy8gZ2V0dGluZyBhbiBleGlzdGluZyBwcm9wZXJ0eVxuICAgICAgaWYgKGlzRGF0YURlc2NyaXB0b3IoZml4ZWREZXNjKSAmJlxuICAgICAgICAgIGZpeGVkRGVzYy5jb25maWd1cmFibGUgPT09IGZhbHNlICYmXG4gICAgICAgICAgZml4ZWREZXNjLndyaXRhYmxlID09PSBmYWxzZSkgeyAvLyBvd24gZnJvemVuIGRhdGEgcHJvcGVydHlcbiAgICAgICAgaWYgKCFzYW1lVmFsdWUocmVzLCBmaXhlZERlc2MudmFsdWUpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImNhbm5vdCByZXBvcnQgaW5jb25zaXN0ZW50IHZhbHVlIGZvciBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibm9uLXdyaXRhYmxlLCBub24tY29uZmlndXJhYmxlIHByb3BlcnR5ICdcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUrXCInXCIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgeyAvLyBpdCdzIGFuIGFjY2Vzc29yIHByb3BlcnR5XG4gICAgICAgIGlmIChpc0FjY2Vzc29yRGVzY3JpcHRvcihmaXhlZERlc2MpICYmXG4gICAgICAgICAgICBmaXhlZERlc2MuY29uZmlndXJhYmxlID09PSBmYWxzZSAmJlxuICAgICAgICAgICAgZml4ZWREZXNjLmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgaWYgKHJlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwibXVzdCByZXBvcnQgdW5kZWZpbmVkIGZvciBub24tY29uZmlndXJhYmxlIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImFjY2Vzc29yIHByb3BlcnR5ICdcIituYW1lK1wiJyB3aXRob3V0IGdldHRlclwiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBJZiBuYW1lIGRlbm90ZXMgYSBmaXhlZCBub24tY29uZmlndXJhYmxlLCBub24td3JpdGFibGUgZGF0YSBwcm9wZXJ0eSxcbiAgICogY2hlY2sgdGhhdCB0aGUgdHJhcCByZWplY3RzIHRoZSBhc3NpZ25tZW50LlxuICAgKi9cbiAgc2V0OiBmdW5jdGlvbihyZWNlaXZlciwgbmFtZSwgdmFsKSB7XG4gICAgdmFyIHRyYXAgPSB0aGlzLmdldFRyYXAoXCJzZXRcIik7XG4gICAgaWYgKHRyYXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZGVmYXVsdCBmb3J3YXJkaW5nIGJlaGF2aW9yXG4gICAgICByZXR1cm4gUmVmbGVjdC5zZXQodGhpcy50YXJnZXQsIG5hbWUsIHZhbCwgcmVjZWl2ZXIpO1xuICAgIH1cblxuICAgIG5hbWUgPSBTdHJpbmcobmFtZSk7XG4gICAgdmFyIHJlcyA9IHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRoaXMudGFyZ2V0LCBuYW1lLCB2YWwsIHJlY2VpdmVyKTtcbiAgICByZXMgPSAhIXJlczsgLy8gY29lcmNlIHRvIEJvb2xlYW5cblxuICAgIC8vIGlmIHN1Y2Nlc3MgaXMgcmVwb3J0ZWQsIGNoZWNrIHdoZXRoZXIgcHJvcGVydHkgaXMgdHJ1bHkgYXNzaWduYWJsZVxuICAgIGlmIChyZXMgPT09IHRydWUpIHtcbiAgICAgIHZhciBmaXhlZERlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRoaXMudGFyZ2V0LCBuYW1lKTtcbiAgICAgIGlmIChmaXhlZERlc2MgIT09IHVuZGVmaW5lZCkgeyAvLyBzZXR0aW5nIGFuIGV4aXN0aW5nIHByb3BlcnR5XG4gICAgICAgIGlmIChpc0RhdGFEZXNjcmlwdG9yKGZpeGVkRGVzYykgJiZcbiAgICAgICAgICAgIGZpeGVkRGVzYy5jb25maWd1cmFibGUgPT09IGZhbHNlICYmXG4gICAgICAgICAgICBmaXhlZERlc2Mud3JpdGFibGUgPT09IGZhbHNlKSB7XG4gICAgICAgICAgaWYgKCFzYW1lVmFsdWUodmFsLCBmaXhlZERlc2MudmFsdWUpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHN1Y2Nlc3NmdWxseSBhc3NpZ24gdG8gYSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJub24td3JpdGFibGUsIG5vbi1jb25maWd1cmFibGUgcHJvcGVydHkgJ1wiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lK1wiJ1wiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGlzQWNjZXNzb3JEZXNjcmlwdG9yKGZpeGVkRGVzYykgJiZcbiAgICAgICAgICAgICAgZml4ZWREZXNjLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UgJiYgLy8gbm9uLWNvbmZpZ3VyYWJsZVxuICAgICAgICAgICAgICBmaXhlZERlc2Muc2V0ID09PSB1bmRlZmluZWQpIHsgICAgICAvLyBhY2Nlc3NvciB3aXRoIHVuZGVmaW5lZCBzZXR0ZXJcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJzZXR0aW5nIGEgcHJvcGVydHkgJ1wiK25hbWUrXCInIHRoYXQgaGFzIFwiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIiBvbmx5IGEgZ2V0dGVyXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXM7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEFueSBvd24gZW51bWVyYWJsZSBub24tY29uZmlndXJhYmxlIHByb3BlcnRpZXMgb2YgdGhlIHRhcmdldCB0aGF0IGFyZSBub3RcbiAgICogaW5jbHVkZWQgaW4gdGhlIHRyYXAgcmVzdWx0IGdpdmUgcmlzZSB0byBhIFR5cGVFcnJvci4gQXMgc3VjaCwgd2UgY2hlY2tcbiAgICogd2hldGhlciB0aGUgcmV0dXJuZWQgcmVzdWx0IGNvbnRhaW5zIGF0IGxlYXN0IGFsbCBzZWFsZWQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzXG4gICAqIG9mIHRoZSB0YXJnZXQgb2JqZWN0LlxuICAgKlxuICAgKiBUaGUgdHJhcCBzaG91bGQgcmV0dXJuIGFuIGl0ZXJhdG9yLlxuICAgKlxuICAgKiBIb3dldmVyLCBhcyBpbXBsZW1lbnRhdGlvbnMgb2YgcHJlLWRpcmVjdCBwcm94aWVzIHN0aWxsIGV4cGVjdCBlbnVtZXJhdGVcbiAgICogdG8gcmV0dXJuIGFuIGFycmF5IG9mIHN0cmluZ3MsIHdlIGNvbnZlcnQgdGhlIGl0ZXJhdG9yIGludG8gYW4gYXJyYXkuXG4gICAqL1xuICBlbnVtZXJhdGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwiZW51bWVyYXRlXCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZm9yd2FyZGluZyBiZWhhdmlvclxuICAgICAgdmFyIHRyYXBSZXN1bHQgPSBSZWZsZWN0LmVudW1lcmF0ZSh0aGlzLnRhcmdldCk7XG4gICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICB2YXIgbnh0ID0gdHJhcFJlc3VsdC5uZXh0KCk7XG4gICAgICB3aGlsZSAoIW54dC5kb25lKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKFN0cmluZyhueHQudmFsdWUpKTtcbiAgICAgICAgbnh0ID0gdHJhcFJlc3VsdC5uZXh0KCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHZhciB0cmFwUmVzdWx0ID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQpO1xuICAgIFxuICAgIGlmICh0cmFwUmVzdWx0ID09PSBudWxsIHx8XG4gICAgICAgIHRyYXBSZXN1bHQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICB0cmFwUmVzdWx0Lm5leHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImVudW1lcmF0ZSB0cmFwIHNob3VsZCByZXR1cm4gYW4gaXRlcmF0b3IsIGdvdDogXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRyYXBSZXN1bHQpOyAgICBcbiAgICB9XG4gICAgXG4gICAgLy8gcHJvcE5hbWVzIGlzIHVzZWQgYXMgYSBzZXQgb2Ygc3RyaW5nc1xuICAgIHZhciBwcm9wTmFtZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIFxuICAgIC8vIHZhciBudW1Qcm9wcyA9ICt0cmFwUmVzdWx0Lmxlbmd0aDtcbiAgICB2YXIgcmVzdWx0ID0gW107IC8vIG5ldyBBcnJheShudW1Qcm9wcyk7XG4gICAgXG4gICAgLy8gdHJhcFJlc3VsdCBpcyBzdXBwb3NlZCB0byBiZSBhbiBpdGVyYXRvclxuICAgIC8vIGRyYWluIGl0ZXJhdG9yIHRvIGFycmF5IGFzIGN1cnJlbnQgaW1wbGVtZW50YXRpb25zIHN0aWxsIGV4cGVjdFxuICAgIC8vIGVudW1lcmF0ZSB0byByZXR1cm4gYW4gYXJyYXkgb2Ygc3RyaW5nc1xuICAgIHZhciBueHQgPSB0cmFwUmVzdWx0Lm5leHQoKTtcbiAgICBcbiAgICB3aGlsZSAoIW54dC5kb25lKSB7XG4gICAgICB2YXIgcyA9IFN0cmluZyhueHQudmFsdWUpO1xuICAgICAgaWYgKHByb3BOYW1lc1tzXSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZW51bWVyYXRlIHRyYXAgY2Fubm90IGxpc3QgYSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImR1cGxpY2F0ZSBwcm9wZXJ0eSAnXCIrcytcIidcIik7XG4gICAgICB9XG4gICAgICBwcm9wTmFtZXNbc10gPSB0cnVlO1xuICAgICAgcmVzdWx0LnB1c2gocyk7XG4gICAgICBueHQgPSB0cmFwUmVzdWx0Lm5leHQoKTtcbiAgICB9XG4gICAgXG4gICAgLypmb3IgKHZhciBpID0gMDsgaSA8IG51bVByb3BzOyBpKyspIHtcbiAgICAgIHZhciBzID0gU3RyaW5nKHRyYXBSZXN1bHRbaV0pO1xuICAgICAgaWYgKHByb3BOYW1lc1tzXSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZW51bWVyYXRlIHRyYXAgY2Fubm90IGxpc3QgYSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImR1cGxpY2F0ZSBwcm9wZXJ0eSAnXCIrcytcIidcIik7XG4gICAgICB9XG5cbiAgICAgIHByb3BOYW1lc1tzXSA9IHRydWU7XG4gICAgICByZXN1bHRbaV0gPSBzO1xuICAgIH0gKi9cblxuICAgIHZhciBvd25FbnVtZXJhYmxlUHJvcHMgPSBPYmplY3Qua2V5cyh0aGlzLnRhcmdldCk7XG4gICAgdmFyIHRhcmdldCA9IHRoaXMudGFyZ2V0O1xuICAgIG93bkVudW1lcmFibGVQcm9wcy5mb3JFYWNoKGZ1bmN0aW9uIChvd25FbnVtZXJhYmxlUHJvcCkge1xuICAgICAgaWYgKCFwcm9wTmFtZXNbb3duRW51bWVyYWJsZVByb3BdKSB7XG4gICAgICAgIGlmIChpc1NlYWxlZChvd25FbnVtZXJhYmxlUHJvcCwgdGFyZ2V0KSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJlbnVtZXJhdGUgdHJhcCBmYWlsZWQgdG8gaW5jbHVkZSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibm9uLWNvbmZpZ3VyYWJsZSBlbnVtZXJhYmxlIHByb3BlcnR5ICdcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG93bkVudW1lcmFibGVQcm9wK1wiJ1wiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIU9iamVjdC5pc0V4dGVuc2libGUodGFyZ2V0KSAmJlxuICAgICAgICAgICAgaXNGaXhlZChvd25FbnVtZXJhYmxlUHJvcCwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgLy8gaWYgaGFuZGxlciBpcyBhbGxvd2VkIG5vdCB0byByZXBvcnQgb3duRW51bWVyYWJsZVByb3AgYXMgYW4gb3duXG4gICAgICAgICAgICAvLyBwcm9wZXJ0eSwgd2UgY2Fubm90IGd1YXJhbnRlZSB0aGF0IGl0IHdpbGwgbmV2ZXIgcmVwb3J0IGl0IGFzXG4gICAgICAgICAgICAvLyBhbiBvd24gcHJvcGVydHkgbGF0ZXIuIE9uY2UgYSBwcm9wZXJ0eSBoYXMgYmVlbiByZXBvcnRlZCBhc1xuICAgICAgICAgICAgLy8gbm9uLWV4aXN0ZW50IG9uIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0LCBpdCBzaG91bGQgZm9yZXZlciBiZVxuICAgICAgICAgICAgLy8gcmVwb3J0ZWQgYXMgbm9uLWV4aXN0ZW50XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHJlcG9ydCBleGlzdGluZyBvd24gcHJvcGVydHkgJ1wiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvd25FbnVtZXJhYmxlUHJvcCtcIicgYXMgbm9uLWV4aXN0ZW50IG9uIGEgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibm9uLWV4dGVuc2libGUgb2JqZWN0XCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LFxuXG4gIC8qKlxuICAgKiBUaGUgaXRlcmF0ZSB0cmFwIGlzIGRlcHJlY2F0ZWQgYnkgdGhlIGVudW1lcmF0ZSB0cmFwLlxuICAgKi9cbiAgaXRlcmF0ZTogVmFsaWRhdG9yLnByb3RvdHlwZS5lbnVtZXJhdGUsXG5cbiAgLyoqXG4gICAqIEFueSBvd24gbm9uLWNvbmZpZ3VyYWJsZSBwcm9wZXJ0aWVzIG9mIHRoZSB0YXJnZXQgdGhhdCBhcmUgbm90IGluY2x1ZGVkXG4gICAqIGluIHRoZSB0cmFwIHJlc3VsdCBnaXZlIHJpc2UgdG8gYSBUeXBlRXJyb3IuIEFzIHN1Y2gsIHdlIGNoZWNrIHdoZXRoZXIgdGhlXG4gICAqIHJldHVybmVkIHJlc3VsdCBjb250YWlucyBhdCBsZWFzdCBhbGwgc2VhbGVkIHByb3BlcnRpZXMgb2YgdGhlIHRhcmdldFxuICAgKiBvYmplY3QuXG4gICAqXG4gICAqIFRoZSB0cmFwIHJlc3VsdCBpcyBub3JtYWxpemVkLlxuICAgKiBUaGUgdHJhcCByZXN1bHQgaXMgbm90IHJldHVybmVkIGRpcmVjdGx5LiBJbnN0ZWFkOlxuICAgKiAgLSBjcmVhdGUgYW5kIHJldHVybiBhIGZyZXNoIEFycmF5LFxuICAgKiAgLSBvZiB3aGljaCBlYWNoIGVsZW1lbnQgaXMgY29lcmNlZCB0byBTdHJpbmcsXG4gICAqICAtIHdoaWNoIGRvZXMgbm90IGNvbnRhaW4gZHVwbGljYXRlc1xuICAgKlxuICAgKiBGSVhNRToga2V5cyB0cmFwIGlzIGRlcHJlY2F0ZWRcbiAgICovXG4gIC8qXG4gIGtleXM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwia2V5c1wiKTtcbiAgICBpZiAodHJhcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBkZWZhdWx0IGZvcndhcmRpbmcgYmVoYXZpb3JcbiAgICAgIHJldHVybiBSZWZsZWN0LmtleXModGhpcy50YXJnZXQpO1xuICAgIH1cblxuICAgIHZhciB0cmFwUmVzdWx0ID0gdHJhcC5jYWxsKHRoaXMuaGFuZGxlciwgdGhpcy50YXJnZXQpO1xuXG4gICAgLy8gcHJvcE5hbWVzIGlzIHVzZWQgYXMgYSBzZXQgb2Ygc3RyaW5nc1xuICAgIHZhciBwcm9wTmFtZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIHZhciBudW1Qcm9wcyA9ICt0cmFwUmVzdWx0Lmxlbmd0aDtcbiAgICB2YXIgcmVzdWx0ID0gbmV3IEFycmF5KG51bVByb3BzKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbnVtUHJvcHM7IGkrKykge1xuICAgICB2YXIgcyA9IFN0cmluZyh0cmFwUmVzdWx0W2ldKTtcbiAgICAgaWYgKHByb3BOYW1lc1tzXSkge1xuICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJrZXlzIHRyYXAgY2Fubm90IGxpc3QgYSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZHVwbGljYXRlIHByb3BlcnR5ICdcIitzK1wiJ1wiKTtcbiAgICAgfVxuICAgICBpZiAoIU9iamVjdC5pc0V4dGVuc2libGUodGhpcy50YXJnZXQpICYmICFpc0ZpeGVkKHMsIHRoaXMudGFyZ2V0KSkge1xuICAgICAgIC8vIG5vbi1leHRlbnNpYmxlIHByb3hpZXMgZG9uJ3QgdG9sZXJhdGUgbmV3IG93biBwcm9wZXJ0eSBuYW1lc1xuICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJrZXlzIHRyYXAgY2Fubm90IGxpc3QgYSBuZXcgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBcInByb3BlcnR5ICdcIitzK1wiJyBvbiBhIG5vbi1leHRlbnNpYmxlIG9iamVjdFwiKTtcbiAgICAgfVxuXG4gICAgIHByb3BOYW1lc1tzXSA9IHRydWU7XG4gICAgIHJlc3VsdFtpXSA9IHM7XG4gICAgfVxuXG4gICAgdmFyIG93bkVudW1lcmFibGVQcm9wcyA9IE9iamVjdC5rZXlzKHRoaXMudGFyZ2V0KTtcbiAgICB2YXIgdGFyZ2V0ID0gdGhpcy50YXJnZXQ7XG4gICAgb3duRW51bWVyYWJsZVByb3BzLmZvckVhY2goZnVuY3Rpb24gKG93bkVudW1lcmFibGVQcm9wKSB7XG4gICAgICBpZiAoIXByb3BOYW1lc1tvd25FbnVtZXJhYmxlUHJvcF0pIHtcbiAgICAgICAgaWYgKGlzU2VhbGVkKG93bkVudW1lcmFibGVQcm9wLCB0YXJnZXQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImtleXMgdHJhcCBmYWlsZWQgdG8gaW5jbHVkZSBcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibm9uLWNvbmZpZ3VyYWJsZSBlbnVtZXJhYmxlIHByb3BlcnR5ICdcIitcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG93bkVudW1lcmFibGVQcm9wK1wiJ1wiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIU9iamVjdC5pc0V4dGVuc2libGUodGFyZ2V0KSAmJlxuICAgICAgICAgICAgaXNGaXhlZChvd25FbnVtZXJhYmxlUHJvcCwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgLy8gaWYgaGFuZGxlciBpcyBhbGxvd2VkIG5vdCB0byByZXBvcnQgb3duRW51bWVyYWJsZVByb3AgYXMgYW4gb3duXG4gICAgICAgICAgICAvLyBwcm9wZXJ0eSwgd2UgY2Fubm90IGd1YXJhbnRlZSB0aGF0IGl0IHdpbGwgbmV2ZXIgcmVwb3J0IGl0IGFzXG4gICAgICAgICAgICAvLyBhbiBvd24gcHJvcGVydHkgbGF0ZXIuIE9uY2UgYSBwcm9wZXJ0eSBoYXMgYmVlbiByZXBvcnRlZCBhc1xuICAgICAgICAgICAgLy8gbm9uLWV4aXN0ZW50IG9uIGEgbm9uLWV4dGVuc2libGUgb2JqZWN0LCBpdCBzaG91bGQgZm9yZXZlciBiZVxuICAgICAgICAgICAgLy8gcmVwb3J0ZWQgYXMgbm9uLWV4aXN0ZW50XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2Fubm90IHJlcG9ydCBleGlzdGluZyBvd24gcHJvcGVydHkgJ1wiK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvd25FbnVtZXJhYmxlUHJvcCtcIicgYXMgbm9uLWV4aXN0ZW50IG9uIGEgXCIrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibm9uLWV4dGVuc2libGUgb2JqZWN0XCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LFxuICAqL1xuICBcbiAgLyoqXG4gICAqIE5ldyB0cmFwIHRoYXQgcmVpZmllcyBbW0NhbGxdXS5cbiAgICogSWYgdGhlIHRhcmdldCBpcyBhIGZ1bmN0aW9uLCB0aGVuIGEgY2FsbCB0b1xuICAgKiAgIHByb3h5KC4uLmFyZ3MpXG4gICAqIFRyaWdnZXJzIHRoaXMgdHJhcFxuICAgKi9cbiAgYXBwbHk6IGZ1bmN0aW9uKHRhcmdldCwgdGhpc0JpbmRpbmcsIGFyZ3MpIHtcbiAgICB2YXIgdHJhcCA9IHRoaXMuZ2V0VHJhcChcImFwcGx5XCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBSZWZsZWN0LmFwcGx5KHRhcmdldCwgdGhpc0JpbmRpbmcsIGFyZ3MpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGhpcy50YXJnZXQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgcmV0dXJuIHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRhcmdldCwgdGhpc0JpbmRpbmcsIGFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXBwbHk6IFwiKyB0YXJnZXQgKyBcIiBpcyBub3QgYSBmdW5jdGlvblwiKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIE5ldyB0cmFwIHRoYXQgcmVpZmllcyBbW0NvbnN0cnVjdF1dLlxuICAgKiBJZiB0aGUgdGFyZ2V0IGlzIGEgZnVuY3Rpb24sIHRoZW4gYSBjYWxsIHRvXG4gICAqICAgbmV3IHByb3h5KC4uLmFyZ3MpXG4gICAqIFRyaWdnZXJzIHRoaXMgdHJhcFxuICAgKi9cbiAgY29uc3RydWN0OiBmdW5jdGlvbih0YXJnZXQsIGFyZ3MsIG5ld1RhcmdldCkge1xuICAgIHZhciB0cmFwID0gdGhpcy5nZXRUcmFwKFwiY29uc3RydWN0XCIpO1xuICAgIGlmICh0cmFwID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBSZWZsZWN0LmNvbnN0cnVjdCh0YXJnZXQsIGFyZ3MsIG5ld1RhcmdldCk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm5ldzogXCIrIHRhcmdldCArIFwiIGlzIG5vdCBhIGZ1bmN0aW9uXCIpO1xuICAgIH1cblxuICAgIGlmIChuZXdUYXJnZXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgbmV3VGFyZ2V0ID0gdGFyZ2V0O1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodHlwZW9mIG5ld1RhcmdldCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJuZXc6IFwiKyBuZXdUYXJnZXQgKyBcIiBpcyBub3QgYSBmdW5jdGlvblwiKTtcbiAgICAgIH0gICAgICBcbiAgICB9XG4gICAgcmV0dXJuIHRyYXAuY2FsbCh0aGlzLmhhbmRsZXIsIHRhcmdldCwgYXJncywgbmV3VGFyZ2V0KTtcbiAgfVxufTtcblxuLy8gLS0tLSBlbmQgb2YgdGhlIFZhbGlkYXRvciBoYW5kbGVyIHdyYXBwZXIgaGFuZGxlciAtLS0tXG5cbi8vIEluIHdoYXQgZm9sbG93cywgYSAnZGlyZWN0IHByb3h5JyBpcyBhIHByb3h5XG4vLyB3aG9zZSBoYW5kbGVyIGlzIGEgVmFsaWRhdG9yLiBTdWNoIHByb3hpZXMgY2FuIGJlIG1hZGUgbm9uLWV4dGVuc2libGUsXG4vLyBzZWFsZWQgb3IgZnJvemVuIHdpdGhvdXQgbG9zaW5nIHRoZSBhYmlsaXR5IHRvIHRyYXAuXG5cbi8vIG1hcHMgZGlyZWN0IHByb3hpZXMgdG8gdGhlaXIgVmFsaWRhdG9yIGhhbmRsZXJzXG52YXIgZGlyZWN0UHJveGllcyA9IG5ldyBXZWFrTWFwKCk7XG5cbi8vIHBhdGNoIE9iamVjdC57cHJldmVudEV4dGVuc2lvbnMsc2VhbCxmcmVlemV9IHNvIHRoYXRcbi8vIHRoZXkgcmVjb2duaXplIGZpeGFibGUgcHJveGllcyBhbmQgYWN0IGFjY29yZGluZ2x5XG5PYmplY3QucHJldmVudEV4dGVuc2lvbnMgPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gIHZhciB2aGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHN1YmplY3QpO1xuICBpZiAodmhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmICh2aGFuZGxlci5wcmV2ZW50RXh0ZW5zaW9ucygpKSB7XG4gICAgICByZXR1cm4gc3ViamVjdDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInByZXZlbnRFeHRlbnNpb25zIG9uIFwiK3N1YmplY3QrXCIgcmVqZWN0ZWRcIik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBwcmltX3ByZXZlbnRFeHRlbnNpb25zKHN1YmplY3QpO1xuICB9XG59O1xuT2JqZWN0LnNlYWwgPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gIHNldEludGVncml0eUxldmVsKHN1YmplY3QsIFwic2VhbGVkXCIpO1xuICByZXR1cm4gc3ViamVjdDtcbn07XG5PYmplY3QuZnJlZXplID0gZnVuY3Rpb24oc3ViamVjdCkge1xuICBzZXRJbnRlZ3JpdHlMZXZlbChzdWJqZWN0LCBcImZyb3plblwiKTtcbiAgcmV0dXJuIHN1YmplY3Q7XG59O1xuT2JqZWN0LmlzRXh0ZW5zaWJsZSA9IE9iamVjdF9pc0V4dGVuc2libGUgPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gIHZhciB2SGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHN1YmplY3QpO1xuICBpZiAodkhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB2SGFuZGxlci5pc0V4dGVuc2libGUoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJpbV9pc0V4dGVuc2libGUoc3ViamVjdCk7XG4gIH1cbn07XG5PYmplY3QuaXNTZWFsZWQgPSBPYmplY3RfaXNTZWFsZWQgPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gIHJldHVybiB0ZXN0SW50ZWdyaXR5TGV2ZWwoc3ViamVjdCwgXCJzZWFsZWRcIik7XG59O1xuT2JqZWN0LmlzRnJvemVuID0gT2JqZWN0X2lzRnJvemVuID0gZnVuY3Rpb24oc3ViamVjdCkge1xuICByZXR1cm4gdGVzdEludGVncml0eUxldmVsKHN1YmplY3QsIFwiZnJvemVuXCIpO1xufTtcbk9iamVjdC5nZXRQcm90b3R5cGVPZiA9IE9iamVjdF9nZXRQcm90b3R5cGVPZiA9IGZ1bmN0aW9uKHN1YmplY3QpIHtcbiAgdmFyIHZIYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQoc3ViamVjdCk7XG4gIGlmICh2SGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHZIYW5kbGVyLmdldFByb3RvdHlwZU9mKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHByaW1fZ2V0UHJvdG90eXBlT2Yoc3ViamVjdCk7XG4gIH1cbn07XG5cbi8vIHBhdGNoIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgdG8gZGlyZWN0bHkgY2FsbFxuLy8gdGhlIFZhbGlkYXRvci5wcm90b3R5cGUuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIHRyYXBcbi8vIFRoaXMgaXMgdG8gY2lyY3VtdmVudCBhbiBhc3NlcnRpb24gaW4gdGhlIGJ1aWx0LWluIFByb3h5XG4vLyB0cmFwcGluZyBtZWNoYW5pc20gb2YgdjgsIHdoaWNoIGRpc2FsbG93cyB0aGF0IHRyYXAgdG9cbi8vIHJldHVybiBub24tY29uZmlndXJhYmxlIHByb3BlcnR5IGRlc2NyaXB0b3JzIChhcyBwZXIgdGhlXG4vLyBvbGQgUHJveHkgZGVzaWduKVxuT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvciA9IGZ1bmN0aW9uKHN1YmplY3QsIG5hbWUpIHtcbiAgdmFyIHZoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQoc3ViamVjdCk7XG4gIGlmICh2aGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHZoYW5kbGVyLmdldE93blByb3BlcnR5RGVzY3JpcHRvcihuYW1lKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJpbV9nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Ioc3ViamVjdCwgbmFtZSk7XG4gIH1cbn07XG5cbi8vIHBhdGNoIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSB0byBkaXJlY3RseSBjYWxsXG4vLyB0aGUgVmFsaWRhdG9yLnByb3RvdHlwZS5kZWZpbmVQcm9wZXJ0eSB0cmFwXG4vLyBUaGlzIGlzIHRvIGNpcmN1bXZlbnQgdHdvIGlzc3VlcyB3aXRoIHRoZSBidWlsdC1pblxuLy8gdHJhcCBtZWNoYW5pc206XG4vLyAxKSB0aGUgY3VycmVudCB0cmFjZW1vbmtleSBpbXBsZW1lbnRhdGlvbiBvZiBwcm94aWVzXG4vLyBhdXRvLWNvbXBsZXRlcyAnZGVzYycsIHdoaWNoIGlzIG5vdCBjb3JyZWN0LiAnZGVzYycgc2hvdWxkIGJlXG4vLyBub3JtYWxpemVkLCBidXQgbm90IGNvbXBsZXRlZC4gQ29uc2lkZXI6XG4vLyBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJveHksICdmb28nLCB7ZW51bWVyYWJsZTpmYWxzZX0pXG4vLyBUaGlzIHRyYXAgd2lsbCByZWNlaXZlIGRlc2MgPVxuLy8gIHt2YWx1ZTp1bmRlZmluZWQsd3JpdGFibGU6ZmFsc2UsZW51bWVyYWJsZTpmYWxzZSxjb25maWd1cmFibGU6ZmFsc2V9XG4vLyBUaGlzIHdpbGwgYWxzbyBzZXQgYWxsIG90aGVyIGF0dHJpYnV0ZXMgdG8gdGhlaXIgZGVmYXVsdCB2YWx1ZSxcbi8vIHdoaWNoIGlzIHVuZXhwZWN0ZWQgYW5kIGRpZmZlcmVudCBmcm9tIFtbRGVmaW5lT3duUHJvcGVydHldXS5cbi8vIEJ1ZyBmaWxlZDogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9NjAxMzI5XG4vLyAyKSB0aGUgY3VycmVudCBzcGlkZXJtb25rZXkgaW1wbGVtZW50YXRpb24gZG9lcyBub3Rcbi8vIHRocm93IGFuIGV4Y2VwdGlvbiB3aGVuIHRoaXMgdHJhcCByZXR1cm5zICdmYWxzZScsIGJ1dCBpbnN0ZWFkIHNpbGVudGx5XG4vLyBpZ25vcmVzIHRoZSBvcGVyYXRpb24gKHRoaXMgaXMgcmVnYXJkbGVzcyBvZiBzdHJpY3QtbW9kZSlcbi8vIDJhKSB2OCBkb2VzIHRocm93IGFuIGV4Y2VwdGlvbiBmb3IgdGhpcyBjYXNlLCBidXQgaW5jbHVkZXMgdGhlIHJhdGhlclxuLy8gICAgIHVuaGVscGZ1bCBlcnJvciBtZXNzYWdlOlxuLy8gJ1Byb3h5IGhhbmRsZXIgIzxPYmplY3Q+IHJldHVybmVkIGZhbHNlIGZyb20gJ2RlZmluZVByb3BlcnR5JyB0cmFwJ1xuT2JqZWN0LmRlZmluZVByb3BlcnR5ID0gZnVuY3Rpb24oc3ViamVjdCwgbmFtZSwgZGVzYykge1xuICB2YXIgdmhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldChzdWJqZWN0KTtcbiAgaWYgKHZoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgbm9ybWFsaXplZERlc2MgPSBub3JtYWxpemVQcm9wZXJ0eURlc2NyaXB0b3IoZGVzYyk7XG4gICAgdmFyIHN1Y2Nlc3MgPSB2aGFuZGxlci5kZWZpbmVQcm9wZXJ0eShuYW1lLCBub3JtYWxpemVkRGVzYyk7XG4gICAgaWYgKHN1Y2Nlc3MgPT09IGZhbHNlKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2FuJ3QgcmVkZWZpbmUgcHJvcGVydHkgJ1wiK25hbWUrXCInXCIpO1xuICAgIH1cbiAgICByZXR1cm4gc3ViamVjdDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJpbV9kZWZpbmVQcm9wZXJ0eShzdWJqZWN0LCBuYW1lLCBkZXNjKTtcbiAgfVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgPSBmdW5jdGlvbihzdWJqZWN0LCBkZXNjcykge1xuICB2YXIgdmhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldChzdWJqZWN0KTtcbiAgaWYgKHZoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgbmFtZXMgPSBPYmplY3Qua2V5cyhkZXNjcyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG5hbWUgPSBuYW1lc1tpXTtcbiAgICAgIHZhciBub3JtYWxpemVkRGVzYyA9IG5vcm1hbGl6ZVByb3BlcnR5RGVzY3JpcHRvcihkZXNjc1tuYW1lXSk7XG4gICAgICB2YXIgc3VjY2VzcyA9IHZoYW5kbGVyLmRlZmluZVByb3BlcnR5KG5hbWUsIG5vcm1hbGl6ZWREZXNjKTtcbiAgICAgIGlmIChzdWNjZXNzID09PSBmYWxzZSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiY2FuJ3QgcmVkZWZpbmUgcHJvcGVydHkgJ1wiK25hbWUrXCInXCIpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3ViamVjdDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJpbV9kZWZpbmVQcm9wZXJ0aWVzKHN1YmplY3QsIGRlc2NzKTtcbiAgfVxufTtcblxuT2JqZWN0LmtleXMgPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gIHZhciB2SGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHN1YmplY3QpO1xuICBpZiAodkhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIHZhciBvd25LZXlzID0gdkhhbmRsZXIub3duS2V5cygpO1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG93bktleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBrID0gU3RyaW5nKG93bktleXNbaV0pO1xuICAgICAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHN1YmplY3QsIGspO1xuICAgICAgaWYgKGRlc2MgIT09IHVuZGVmaW5lZCAmJiBkZXNjLmVudW1lcmFibGUgPT09IHRydWUpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goayk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHByaW1fa2V5cyhzdWJqZWN0KTtcbiAgfVxufVxuXG5PYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyA9IE9iamVjdF9nZXRPd25Qcm9wZXJ0eU5hbWVzID0gZnVuY3Rpb24oc3ViamVjdCkge1xuICB2YXIgdkhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldChzdWJqZWN0KTtcbiAgaWYgKHZIYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gdkhhbmRsZXIub3duS2V5cygpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBwcmltX2dldE93blByb3BlcnR5TmFtZXMoc3ViamVjdCk7XG4gIH1cbn1cblxuLy8gZml4ZXMgaXNzdWUgIzcxIChDYWxsaW5nIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMoKSBvbiBhIFByb3h5XG4vLyB0aHJvd3MgYW4gZXJyb3IpXG5pZiAocHJpbV9nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgIT09IHVuZGVmaW5lZCkge1xuICBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID0gZnVuY3Rpb24oc3ViamVjdCkge1xuICAgIHZhciB2SGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHN1YmplY3QpO1xuICAgIGlmICh2SGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBhcyB0aGlzIHNoaW0gZG9lcyBub3Qgc3VwcG9ydCBzeW1ib2xzLCBhIFByb3h5IG5ldmVyIGFkdmVydGlzZXNcbiAgICAgIC8vIGFueSBzeW1ib2wtdmFsdWVkIG93biBwcm9wZXJ0aWVzXG4gICAgICByZXR1cm4gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwcmltX2dldE93blByb3BlcnR5U3ltYm9scyhzdWJqZWN0KTtcbiAgICB9XG4gIH07XG59XG5cbi8vIGZpeGVzIGlzc3VlICM3MiAoJ0lsbGVnYWwgYWNjZXNzJyBlcnJvciB3aGVuIHVzaW5nIE9iamVjdC5hc3NpZ24pXG4vLyBPYmplY3QuYXNzaWduIHBvbHlmaWxsIGJhc2VkIG9uIGEgcG9seWZpbGwgcG9zdGVkIG9uIE1ETjogXG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9cXFxuLy8gIEdsb2JhbF9PYmplY3RzL09iamVjdC9hc3NpZ25cbi8vIE5vdGUgdGhhdCB0aGlzIHBvbHlmaWxsIGRvZXMgbm90IHN1cHBvcnQgU3ltYm9scywgYnV0IHRoaXMgUHJveHkgU2hpbVxuLy8gZG9lcyBub3Qgc3VwcG9ydCBTeW1ib2xzIGFueXdheS5cbmlmIChwcmltX2Fzc2lnbiAhPT0gdW5kZWZpbmVkKSB7XG4gIE9iamVjdC5hc3NpZ24gPSBmdW5jdGlvbiAodGFyZ2V0KSB7XG4gICAgXG4gICAgLy8gY2hlY2sgaWYgYW55IGFyZ3VtZW50IGlzIGEgcHJveHkgb2JqZWN0XG4gICAgdmFyIG5vUHJveGllcyA9IHRydWU7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB2SGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KGFyZ3VtZW50c1tpXSk7XG4gICAgICBpZiAodkhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBub1Byb3hpZXMgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChub1Byb3hpZXMpIHtcbiAgICAgIC8vIG5vdCBhIHNpbmdsZSBhcmd1bWVudCBpcyBhIHByb3h5LCBwZXJmb3JtIGJ1aWx0LWluIGFsZ29yaXRobVxuICAgICAgcmV0dXJuIHByaW1fYXNzaWduLmFwcGx5KE9iamVjdCwgYXJndW1lbnRzKTtcbiAgICB9XG4gICAgXG4gICAgLy8gdGhlcmUgaXMgYXQgbGVhc3Qgb25lIHByb3h5IGFyZ3VtZW50LCB1c2UgdGhlIHBvbHlmaWxsXG4gICAgXG4gICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkIHx8IHRhcmdldCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNvbnZlcnQgdW5kZWZpbmVkIG9yIG51bGwgdG8gb2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgdmFyIG91dHB1dCA9IE9iamVjdCh0YXJnZXQpO1xuICAgIGZvciAodmFyIGluZGV4ID0gMTsgaW5kZXggPCBhcmd1bWVudHMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICB2YXIgc291cmNlID0gYXJndW1lbnRzW2luZGV4XTtcbiAgICAgIGlmIChzb3VyY2UgIT09IHVuZGVmaW5lZCAmJiBzb3VyY2UgIT09IG51bGwpIHtcbiAgICAgICAgZm9yICh2YXIgbmV4dEtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KG5leHRLZXkpKSB7XG4gICAgICAgICAgICBvdXRwdXRbbmV4dEtleV0gPSBzb3VyY2VbbmV4dEtleV07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH07XG59XG5cbi8vIHJldHVybnMgd2hldGhlciBhbiBhcmd1bWVudCBpcyBhIHJlZmVyZW5jZSB0byBhbiBvYmplY3QsXG4vLyB3aGljaCBpcyBsZWdhbCBhcyBhIFdlYWtNYXAga2V5LlxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIGFyZztcbiAgcmV0dXJuICh0eXBlID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGwpIHx8ICh0eXBlID09PSAnZnVuY3Rpb24nKTtcbn07XG5cbi8vIGEgd3JhcHBlciBmb3IgV2Vha01hcC5nZXQgd2hpY2ggcmV0dXJucyB0aGUgdW5kZWZpbmVkIHZhbHVlXG4vLyBmb3Iga2V5cyB0aGF0IGFyZSBub3Qgb2JqZWN0cyAoaW4gd2hpY2ggY2FzZSB0aGUgdW5kZXJseWluZ1xuLy8gV2Vha01hcCB3b3VsZCBoYXZlIHRocm93biBhIFR5cGVFcnJvcikuXG5mdW5jdGlvbiBzYWZlV2Vha01hcEdldChtYXAsIGtleSkge1xuICByZXR1cm4gaXNPYmplY3Qoa2V5KSA/IG1hcC5nZXQoa2V5KSA6IHVuZGVmaW5lZDtcbn07XG5cbi8vIHJldHVybnMgYSBuZXcgZnVuY3Rpb24gb2YgemVybyBhcmd1bWVudHMgdGhhdCByZWN1cnNpdmVseVxuLy8gdW53cmFwcyBhbnkgcHJveGllcyBzcGVjaWZpZWQgYXMgdGhlIHx0aGlzfC12YWx1ZS5cbi8vIFRoZSBwcmltaXRpdmUgaXMgYXNzdW1lZCB0byBiZSBhIHplcm8tYXJndW1lbnQgbWV0aG9kXG4vLyB0aGF0IHVzZXMgaXRzIHx0aGlzfC1iaW5kaW5nLlxuZnVuY3Rpb24gbWFrZVVud3JhcHBpbmcwQXJnTWV0aG9kKHByaW1pdGl2ZSkge1xuICByZXR1cm4gZnVuY3Rpb24gYnVpbHRpbigpIHtcbiAgICB2YXIgdkhhbmRsZXIgPSBzYWZlV2Vha01hcEdldChkaXJlY3RQcm94aWVzLCB0aGlzKTtcbiAgICBpZiAodkhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGJ1aWx0aW4uY2FsbCh2SGFuZGxlci50YXJnZXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcHJpbWl0aXZlLmNhbGwodGhpcyk7XG4gICAgfVxuICB9XG59O1xuXG4vLyByZXR1cm5zIGEgbmV3IGZ1bmN0aW9uIG9mIDEgYXJndW1lbnRzIHRoYXQgcmVjdXJzaXZlbHlcbi8vIHVud3JhcHMgYW55IHByb3hpZXMgc3BlY2lmaWVkIGFzIHRoZSB8dGhpc3wtdmFsdWUuXG4vLyBUaGUgcHJpbWl0aXZlIGlzIGFzc3VtZWQgdG8gYmUgYSAxLWFyZ3VtZW50IG1ldGhvZFxuLy8gdGhhdCB1c2VzIGl0cyB8dGhpc3wtYmluZGluZy5cbmZ1bmN0aW9uIG1ha2VVbndyYXBwaW5nMUFyZ01ldGhvZChwcmltaXRpdmUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGJ1aWx0aW4oYXJnKSB7XG4gICAgdmFyIHZIYW5kbGVyID0gc2FmZVdlYWtNYXBHZXQoZGlyZWN0UHJveGllcywgdGhpcyk7XG4gICAgaWYgKHZIYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBidWlsdGluLmNhbGwodkhhbmRsZXIudGFyZ2V0LCBhcmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcHJpbWl0aXZlLmNhbGwodGhpcywgYXJnKTtcbiAgICB9XG4gIH1cbn07XG5cbk9iamVjdC5wcm90b3R5cGUudmFsdWVPZiA9XG4gIG1ha2VVbndyYXBwaW5nMEFyZ01ldGhvZChPYmplY3QucHJvdG90eXBlLnZhbHVlT2YpO1xuT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZyA9XG4gIG1ha2VVbndyYXBwaW5nMEFyZ01ldGhvZChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nKTtcbkZ1bmN0aW9uLnByb3RvdHlwZS50b1N0cmluZyA9XG4gIG1ha2VVbndyYXBwaW5nMEFyZ01ldGhvZChGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmcpO1xuRGF0ZS5wcm90b3R5cGUudG9TdHJpbmcgPVxuICBtYWtlVW53cmFwcGluZzBBcmdNZXRob2QoRGF0ZS5wcm90b3R5cGUudG9TdHJpbmcpO1xuXG5PYmplY3QucHJvdG90eXBlLmlzUHJvdG90eXBlT2YgPSBmdW5jdGlvbiBidWlsdGluKGFyZykge1xuICAvLyBidWdmaXggdGhhbmtzIHRvIEJpbGwgTWFyazpcbiAgLy8gYnVpbHQtaW4gaXNQcm90b3R5cGVPZiBkb2VzIG5vdCB1bndyYXAgcHJveGllcyB1c2VkXG4gIC8vIGFzIGFyZ3VtZW50cy4gU28sIHdlIGltcGxlbWVudCB0aGUgYnVpbHRpbiBvdXJzZWx2ZXMsXG4gIC8vIGJhc2VkIG9uIHRoZSBFQ01BU2NyaXB0IDYgc3BlYy4gT3VyIGVuY29kaW5nIHdpbGxcbiAgLy8gbWFrZSBzdXJlIHRoYXQgaWYgYSBwcm94eSBpcyB1c2VkIGFzIGFuIGFyZ3VtZW50LFxuICAvLyBpdHMgZ2V0UHJvdG90eXBlT2YgdHJhcCB3aWxsIGJlIGNhbGxlZC5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICB2YXIgdkhhbmRsZXIyID0gc2FmZVdlYWtNYXBHZXQoZGlyZWN0UHJveGllcywgYXJnKTtcbiAgICBpZiAodkhhbmRsZXIyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGFyZyA9IHZIYW5kbGVyMi5nZXRQcm90b3R5cGVPZigpO1xuICAgICAgaWYgKGFyZyA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKHNhbWVWYWx1ZShhcmcsIHRoaXMpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcHJpbV9pc1Byb3RvdHlwZU9mLmNhbGwodGhpcywgYXJnKTtcbiAgICB9XG4gIH1cbn07XG5cbkFycmF5LmlzQXJyYXkgPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gIHZhciB2SGFuZGxlciA9IHNhZmVXZWFrTWFwR2V0KGRpcmVjdFByb3hpZXMsIHN1YmplY3QpO1xuICBpZiAodkhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KHZIYW5kbGVyLnRhcmdldCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHByaW1faXNBcnJheShzdWJqZWN0KTtcbiAgfVxufTtcblxuZnVuY3Rpb24gaXNQcm94eUFycmF5KGFyZykge1xuICB2YXIgdkhhbmRsZXIgPSBzYWZlV2Vha01hcEdldChkaXJlY3RQcm94aWVzLCBhcmcpO1xuICBpZiAodkhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KHZIYW5kbGVyLnRhcmdldCk7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBBcnJheS5wcm90b3R5cGUuY29uY2F0IGludGVybmFsbHkgdGVzdHMgd2hldGhlciBvbmUgb2YgaXRzXG4vLyBhcmd1bWVudHMgaXMgYW4gQXJyYXksIGJ5IGNoZWNraW5nIHdoZXRoZXIgW1tDbGFzc11dID09IFwiQXJyYXlcIlxuLy8gQXMgc3VjaCwgaXQgd2lsbCBmYWlsIHRvIHJlY29nbml6ZSBwcm94aWVzLWZvci1hcnJheXMgYXMgYXJyYXlzLlxuLy8gV2UgcGF0Y2ggQXJyYXkucHJvdG90eXBlLmNvbmNhdCBzbyB0aGF0IGl0IFwidW53cmFwc1wiIHByb3hpZXMtZm9yLWFycmF5c1xuLy8gYnkgbWFraW5nIGEgY29weS4gVGhpcyB3aWxsIHRyaWdnZXIgdGhlIGV4YWN0IHNhbWUgc2VxdWVuY2Ugb2Zcbi8vIHRyYXBzIG9uIHRoZSBwcm94eS1mb3ItYXJyYXkgYXMgaWYgd2Ugd291bGQgbm90IGhhdmUgdW53cmFwcGVkIGl0LlxuLy8gU2VlIDxodHRwczovL2dpdGh1Yi5jb20vdHZjdXRzZW0vaGFybW9ueS1yZWZsZWN0L2lzc3Vlcy8xOT4gZm9yIG1vcmUuXG5BcnJheS5wcm90b3R5cGUuY29uY2F0ID0gZnVuY3Rpb24oLyouLi5hcmdzKi8pIHtcbiAgdmFyIGxlbmd0aDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoaXNQcm94eUFycmF5KGFyZ3VtZW50c1tpXSkpIHtcbiAgICAgIGxlbmd0aCA9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XG4gICAgICBhcmd1bWVudHNbaV0gPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHNbaV0sIDAsIGxlbmd0aCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBwcmltX2NvbmNhdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuLy8gc2V0UHJvdG90eXBlT2Ygc3VwcG9ydCBvbiBwbGF0Zm9ybXMgdGhhdCBzdXBwb3J0IF9fcHJvdG9fX1xuXG52YXIgcHJpbV9zZXRQcm90b3R5cGVPZiA9IE9iamVjdC5zZXRQcm90b3R5cGVPZjtcblxuLy8gcGF0Y2ggYW5kIGV4dHJhY3Qgb3JpZ2luYWwgX19wcm90b19fIHNldHRlclxudmFyIF9fcHJvdG9fX3NldHRlciA9IChmdW5jdGlvbigpIHtcbiAgdmFyIHByb3RvRGVzYyA9IHByaW1fZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKE9iamVjdC5wcm90b3R5cGUsJ19fcHJvdG9fXycpO1xuICBpZiAocHJvdG9EZXNjID09PSB1bmRlZmluZWQgfHxcbiAgICAgIHR5cGVvZiBwcm90b0Rlc2Muc2V0ICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwic2V0UHJvdG90eXBlT2Ygbm90IHN1cHBvcnRlZCBvbiB0aGlzIHBsYXRmb3JtXCIpO1xuICAgIH1cbiAgfVxuXG4gIC8vIHNlZSBpZiB3ZSBjYW4gYWN0dWFsbHkgbXV0YXRlIGEgcHJvdG90eXBlIHdpdGggdGhlIGdlbmVyaWMgc2V0dGVyXG4gIC8vIChlLmcuIENocm9tZSB2MjggZG9lc24ndCBhbGxvdyBzZXR0aW5nIF9fcHJvdG9fXyB2aWEgdGhlIGdlbmVyaWMgc2V0dGVyKVxuICB0cnkge1xuICAgIHByb3RvRGVzYy5zZXQuY2FsbCh7fSx7fSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwic2V0UHJvdG90eXBlT2Ygbm90IHN1cHBvcnRlZCBvbiB0aGlzIHBsYXRmb3JtXCIpO1xuICAgIH1cbiAgfVxuXG4gIHByaW1fZGVmaW5lUHJvcGVydHkoT2JqZWN0LnByb3RvdHlwZSwgJ19fcHJvdG9fXycsIHtcbiAgICBzZXQ6IGZ1bmN0aW9uKG5ld1Byb3RvKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LnNldFByb3RvdHlwZU9mKHRoaXMsIE9iamVjdChuZXdQcm90bykpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHByb3RvRGVzYy5zZXQ7XG59KCkpO1xuXG5PYmplY3Quc2V0UHJvdG90eXBlT2YgPSBmdW5jdGlvbih0YXJnZXQsIG5ld1Byb3RvKSB7XG4gIHZhciBoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQodGFyZ2V0KTtcbiAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmIChoYW5kbGVyLnNldFByb3RvdHlwZU9mKG5ld1Byb3RvKSkge1xuICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcInByb3h5IHJlamVjdGVkIHByb3RvdHlwZSBtdXRhdGlvblwiKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKCFPYmplY3RfaXNFeHRlbnNpYmxlKHRhcmdldCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjYW4ndCBzZXQgcHJvdG90eXBlIG9uIG5vbi1leHRlbnNpYmxlIG9iamVjdDogXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQpO1xuICAgIH1cbiAgICBpZiAocHJpbV9zZXRQcm90b3R5cGVPZilcbiAgICAgIHJldHVybiBwcmltX3NldFByb3RvdHlwZU9mKHRhcmdldCwgbmV3UHJvdG8pO1xuXG4gICAgaWYgKE9iamVjdChuZXdQcm90bykgIT09IG5ld1Byb3RvIHx8IG5ld1Byb3RvID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IHByb3RvdHlwZSBtYXkgb25seSBiZSBhbiBPYmplY3Qgb3IgbnVsbDogXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1Byb3RvKTtcbiAgICAgIC8vIHRocm93IG5ldyBUeXBlRXJyb3IoXCJwcm90b3R5cGUgbXVzdCBiZSBhbiBvYmplY3Qgb3IgbnVsbFwiKVxuICAgIH1cbiAgICBfX3Byb3RvX19zZXR0ZXIuY2FsbCh0YXJnZXQsIG5ld1Byb3RvKTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG59XG5cbk9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHZhciBoYW5kbGVyID0gc2FmZVdlYWtNYXBHZXQoZGlyZWN0UHJveGllcywgdGhpcyk7XG4gIGlmIChoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICB2YXIgZGVzYyA9IGhhbmRsZXIuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG5hbWUpO1xuICAgIHJldHVybiBkZXNjICE9PSB1bmRlZmluZWQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHByaW1faGFzT3duUHJvcGVydHkuY2FsbCh0aGlzLCBuYW1lKTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09IFJlZmxlY3Rpb24gbW9kdWxlID09PT09PT09PT09PT1cbi8vIHNlZSBodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OnJlZmxlY3RfYXBpXG5cbnZhciBSZWZsZWN0ID0gZ2xvYmFsLlJlZmxlY3QgPSB7XG4gIGdldE93blByb3BlcnR5RGVzY3JpcHRvcjogZnVuY3Rpb24odGFyZ2V0LCBuYW1lKSB7XG4gICAgcmV0dXJuIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBuYW1lKTtcbiAgfSxcbiAgZGVmaW5lUHJvcGVydHk6IGZ1bmN0aW9uKHRhcmdldCwgbmFtZSwgZGVzYykge1xuXG4gICAgLy8gaWYgdGFyZ2V0IGlzIGEgcHJveHksIGludm9rZSBpdHMgXCJkZWZpbmVQcm9wZXJ0eVwiIHRyYXBcbiAgICB2YXIgaGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHRhcmdldCk7XG4gICAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGhhbmRsZXIuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBuYW1lLCBkZXNjKTtcbiAgICB9XG5cbiAgICAvLyBJbXBsZW1lbnRhdGlvbiB0cmFuc2xpdGVyYXRlZCBmcm9tIFtbRGVmaW5lT3duUHJvcGVydHldXVxuICAgIC8vIHNlZSBFUzUuMSBzZWN0aW9uIDguMTIuOVxuICAgIC8vIHRoaXMgaXMgdGhlIF9leGFjdCBzYW1lIGFsZ29yaXRobV8gYXMgdGhlIGlzQ29tcGF0aWJsZURlc2NyaXB0b3JcbiAgICAvLyBhbGdvcml0aG0gZGVmaW5lZCBhYm92ZSwgZXhjZXB0IHRoYXQgYXQgZXZlcnkgcGxhY2UgaXRcbiAgICAvLyByZXR1cm5zIHRydWUsIHRoaXMgYWxnb3JpdGhtIGFjdHVhbGx5IGRvZXMgZGVmaW5lIHRoZSBwcm9wZXJ0eS5cbiAgICB2YXIgY3VycmVudCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBuYW1lKTtcbiAgICB2YXIgZXh0ZW5zaWJsZSA9IE9iamVjdC5pc0V4dGVuc2libGUodGFyZ2V0KTtcbiAgICBpZiAoY3VycmVudCA9PT0gdW5kZWZpbmVkICYmIGV4dGVuc2libGUgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChjdXJyZW50ID09PSB1bmRlZmluZWQgJiYgZXh0ZW5zaWJsZSA9PT0gdHJ1ZSkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgbmFtZSwgZGVzYyk7IC8vIHNob3VsZCBuZXZlciBmYWlsXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGlzRW1wdHlEZXNjcmlwdG9yKGRlc2MpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGlzRXF1aXZhbGVudERlc2NyaXB0b3IoY3VycmVudCwgZGVzYykpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoY3VycmVudC5jb25maWd1cmFibGUgPT09IGZhbHNlKSB7XG4gICAgICBpZiAoZGVzYy5jb25maWd1cmFibGUgPT09IHRydWUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKCdlbnVtZXJhYmxlJyBpbiBkZXNjICYmIGRlc2MuZW51bWVyYWJsZSAhPT0gY3VycmVudC5lbnVtZXJhYmxlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGlzR2VuZXJpY0Rlc2NyaXB0b3IoZGVzYykpIHtcbiAgICAgIC8vIG5vIGZ1cnRoZXIgdmFsaWRhdGlvbiBuZWNlc3NhcnlcbiAgICB9IGVsc2UgaWYgKGlzRGF0YURlc2NyaXB0b3IoY3VycmVudCkgIT09IGlzRGF0YURlc2NyaXB0b3IoZGVzYykpIHtcbiAgICAgIGlmIChjdXJyZW50LmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNEYXRhRGVzY3JpcHRvcihjdXJyZW50KSAmJiBpc0RhdGFEZXNjcmlwdG9yKGRlc2MpKSB7XG4gICAgICBpZiAoY3VycmVudC5jb25maWd1cmFibGUgPT09IGZhbHNlKSB7XG4gICAgICAgIGlmIChjdXJyZW50LndyaXRhYmxlID09PSBmYWxzZSAmJiBkZXNjLndyaXRhYmxlID09PSB0cnVlKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjdXJyZW50LndyaXRhYmxlID09PSBmYWxzZSkge1xuICAgICAgICAgIGlmICgndmFsdWUnIGluIGRlc2MgJiYgIXNhbWVWYWx1ZShkZXNjLnZhbHVlLCBjdXJyZW50LnZhbHVlKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNBY2Nlc3NvckRlc2NyaXB0b3IoY3VycmVudCkgJiYgaXNBY2Nlc3NvckRlc2NyaXB0b3IoZGVzYykpIHtcbiAgICAgIGlmIChjdXJyZW50LmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgaWYgKCdzZXQnIGluIGRlc2MgJiYgIXNhbWVWYWx1ZShkZXNjLnNldCwgY3VycmVudC5zZXQpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICgnZ2V0JyBpbiBkZXNjICYmICFzYW1lVmFsdWUoZGVzYy5nZXQsIGN1cnJlbnQuZ2V0KSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBuYW1lLCBkZXNjKTsgLy8gc2hvdWxkIG5ldmVyIGZhaWxcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcbiAgZGVsZXRlUHJvcGVydHk6IGZ1bmN0aW9uKHRhcmdldCwgbmFtZSkge1xuICAgIHZhciBoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQodGFyZ2V0KTtcbiAgICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gaGFuZGxlci5kZWxldGUobmFtZSk7XG4gICAgfVxuICAgIFxuICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIG5hbWUpO1xuICAgIGlmIChkZXNjID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoZGVzYy5jb25maWd1cmFibGUgPT09IHRydWUpIHtcbiAgICAgIGRlbGV0ZSB0YXJnZXRbbmFtZV07XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlOyAgICBcbiAgfSxcbiAgZ2V0UHJvdG90eXBlT2Y6IGZ1bmN0aW9uKHRhcmdldCkge1xuICAgIHJldHVybiBPYmplY3QuZ2V0UHJvdG90eXBlT2YodGFyZ2V0KTtcbiAgfSxcbiAgc2V0UHJvdG90eXBlT2Y6IGZ1bmN0aW9uKHRhcmdldCwgbmV3UHJvdG8pIHtcbiAgICBcbiAgICB2YXIgaGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHRhcmdldCk7XG4gICAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGhhbmRsZXIuc2V0UHJvdG90eXBlT2YobmV3UHJvdG8pO1xuICAgIH1cbiAgICBcbiAgICBpZiAoT2JqZWN0KG5ld1Byb3RvKSAhPT0gbmV3UHJvdG8gfHwgbmV3UHJvdG8gPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgcHJvdG90eXBlIG1heSBvbmx5IGJlIGFuIE9iamVjdCBvciBudWxsOiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgbmV3UHJvdG8pO1xuICAgIH1cbiAgICBcbiAgICBpZiAoIU9iamVjdF9pc0V4dGVuc2libGUodGFyZ2V0KSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICB2YXIgY3VycmVudCA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih0YXJnZXQpO1xuICAgIGlmIChzYW1lVmFsdWUoY3VycmVudCwgbmV3UHJvdG8pKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgaWYgKHByaW1fc2V0UHJvdG90eXBlT2YpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHByaW1fc2V0UHJvdG90eXBlT2YodGFyZ2V0LCBuZXdQcm90byk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgX19wcm90b19fc2V0dGVyLmNhbGwodGFyZ2V0LCBuZXdQcm90byk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG4gIHByZXZlbnRFeHRlbnNpb25zOiBmdW5jdGlvbih0YXJnZXQpIHtcbiAgICB2YXIgaGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHRhcmdldCk7XG4gICAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGhhbmRsZXIucHJldmVudEV4dGVuc2lvbnMoKTtcbiAgICB9XG4gICAgcHJpbV9wcmV2ZW50RXh0ZW5zaW9ucyh0YXJnZXQpO1xuICAgIHJldHVybiB0cnVlO1xuICB9LFxuICBpc0V4dGVuc2libGU6IGZ1bmN0aW9uKHRhcmdldCkge1xuICAgIHJldHVybiBPYmplY3QuaXNFeHRlbnNpYmxlKHRhcmdldCk7XG4gIH0sXG4gIGhhczogZnVuY3Rpb24odGFyZ2V0LCBuYW1lKSB7XG4gICAgcmV0dXJuIG5hbWUgaW4gdGFyZ2V0O1xuICB9LFxuICBnZXQ6IGZ1bmN0aW9uKHRhcmdldCwgbmFtZSwgcmVjZWl2ZXIpIHtcbiAgICByZWNlaXZlciA9IHJlY2VpdmVyIHx8IHRhcmdldDtcblxuICAgIC8vIGlmIHRhcmdldCBpcyBhIHByb3h5LCBpbnZva2UgaXRzIFwiZ2V0XCIgdHJhcFxuICAgIHZhciBoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQodGFyZ2V0KTtcbiAgICBpZiAoaGFuZGxlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gaGFuZGxlci5nZXQocmVjZWl2ZXIsIG5hbWUpO1xuICAgIH1cblxuICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIG5hbWUpO1xuICAgIGlmIChkZXNjID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih0YXJnZXQpO1xuICAgICAgaWYgKHByb3RvID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gUmVmbGVjdC5nZXQocHJvdG8sIG5hbWUsIHJlY2VpdmVyKTtcbiAgICB9XG4gICAgaWYgKGlzRGF0YURlc2NyaXB0b3IoZGVzYykpIHtcbiAgICAgIHJldHVybiBkZXNjLnZhbHVlO1xuICAgIH1cbiAgICB2YXIgZ2V0dGVyID0gZGVzYy5nZXQ7XG4gICAgaWYgKGdldHRlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gZGVzYy5nZXQuY2FsbChyZWNlaXZlcik7XG4gIH0sXG4gIC8vIFJlZmxlY3Quc2V0IGltcGxlbWVudGF0aW9uIGJhc2VkIG9uIGxhdGVzdCB2ZXJzaW9uIG9mIFtbU2V0UF1dIGF0XG4gIC8vIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6cHJvdG9fY2xpbWJpbmdfcmVmYWN0b3JpbmdcbiAgc2V0OiBmdW5jdGlvbih0YXJnZXQsIG5hbWUsIHZhbHVlLCByZWNlaXZlcikge1xuICAgIHJlY2VpdmVyID0gcmVjZWl2ZXIgfHwgdGFyZ2V0O1xuXG4gICAgLy8gaWYgdGFyZ2V0IGlzIGEgcHJveHksIGludm9rZSBpdHMgXCJzZXRcIiB0cmFwXG4gICAgdmFyIGhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldCh0YXJnZXQpO1xuICAgIGlmIChoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBoYW5kbGVyLnNldChyZWNlaXZlciwgbmFtZSwgdmFsdWUpO1xuICAgIH1cblxuICAgIC8vIGZpcnN0LCBjaGVjayB3aGV0aGVyIHRhcmdldCBoYXMgYSBub24td3JpdGFibGUgcHJvcGVydHlcbiAgICAvLyBzaGFkb3dpbmcgbmFtZSBvbiByZWNlaXZlclxuICAgIHZhciBvd25EZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIG5hbWUpO1xuXG4gICAgaWYgKG93bkRlc2MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gbmFtZSBpcyBub3QgZGVmaW5lZCBpbiB0YXJnZXQsIHNlYXJjaCB0YXJnZXQncyBwcm90b3R5cGVcbiAgICAgIHZhciBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih0YXJnZXQpO1xuXG4gICAgICBpZiAocHJvdG8gIT09IG51bGwpIHtcbiAgICAgICAgLy8gY29udGludWUgdGhlIHNlYXJjaCBpbiB0YXJnZXQncyBwcm90b3R5cGVcbiAgICAgICAgcmV0dXJuIFJlZmxlY3Quc2V0KHByb3RvLCBuYW1lLCB2YWx1ZSwgcmVjZWl2ZXIpO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXYxNiBjaGFuZ2UuIENmLiBodHRwczovL2J1Z3MuZWNtYXNjcmlwdC5vcmcvc2hvd19idWcuY2dpP2lkPTE1NDlcbiAgICAgIC8vIHRhcmdldCB3YXMgdGhlIGxhc3QgcHJvdG90eXBlLCBub3cgd2Uga25vdyB0aGF0ICduYW1lJyBpcyBub3Qgc2hhZG93ZWRcbiAgICAgIC8vIGJ5IGFuIGV4aXN0aW5nIChhY2Nlc3NvciBvciBkYXRhKSBwcm9wZXJ0eSwgc28gd2UgY2FuIGFkZCB0aGUgcHJvcGVydHlcbiAgICAgIC8vIHRvIHRoZSBpbml0aWFsIHJlY2VpdmVyIG9iamVjdFxuICAgICAgLy8gKHRoaXMgYnJhbmNoIHdpbGwgaW50ZW50aW9uYWxseSBmYWxsIHRocm91Z2ggdG8gdGhlIGNvZGUgYmVsb3cpXG4gICAgICBvd25EZXNjID1cbiAgICAgICAgeyB2YWx1ZTogdW5kZWZpbmVkLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlIH07XG4gICAgfVxuXG4gICAgLy8gd2Ugbm93IGtub3cgdGhhdCBvd25EZXNjICE9PSB1bmRlZmluZWRcbiAgICBpZiAoaXNBY2Nlc3NvckRlc2NyaXB0b3Iob3duRGVzYykpIHtcbiAgICAgIHZhciBzZXR0ZXIgPSBvd25EZXNjLnNldDtcbiAgICAgIGlmIChzZXR0ZXIgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgc2V0dGVyLmNhbGwocmVjZWl2ZXIsIHZhbHVlKTsgLy8gYXNzdW1lcyBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbFxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIC8vIG90aGVyd2lzZSwgaXNEYXRhRGVzY3JpcHRvcihvd25EZXNjKSBtdXN0IGJlIHRydWVcbiAgICBpZiAob3duRGVzYy53cml0YWJsZSA9PT0gZmFsc2UpIHJldHVybiBmYWxzZTtcbiAgICAvLyB3ZSBmb3VuZCBhbiBleGlzdGluZyB3cml0YWJsZSBkYXRhIHByb3BlcnR5IG9uIHRoZSBwcm90b3R5cGUgY2hhaW4uXG4gICAgLy8gTm93IHVwZGF0ZSBvciBhZGQgdGhlIGRhdGEgcHJvcGVydHkgb24gdGhlIHJlY2VpdmVyLCBkZXBlbmRpbmcgb25cbiAgICAvLyB3aGV0aGVyIHRoZSByZWNlaXZlciBhbHJlYWR5IGRlZmluZXMgdGhlIHByb3BlcnR5IG9yIG5vdC5cbiAgICB2YXIgZXhpc3RpbmdEZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihyZWNlaXZlciwgbmFtZSk7XG4gICAgaWYgKGV4aXN0aW5nRGVzYyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgdXBkYXRlRGVzYyA9XG4gICAgICAgIHsgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgIC8vIEZJWE1FOiBpdCBzaG91bGQgbm90IGJlIG5lY2Vzc2FyeSB0byBkZXNjcmliZSB0aGUgZm9sbG93aW5nXG4gICAgICAgICAgLy8gYXR0cmlidXRlcy4gQWRkZWQgdG8gY2lyY3VtdmVudCBhIGJ1ZyBpbiB0cmFjZW1vbmtleTpcbiAgICAgICAgICAvLyBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02MDEzMjlcbiAgICAgICAgICB3cml0YWJsZTogICAgIGV4aXN0aW5nRGVzYy53cml0YWJsZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiAgIGV4aXN0aW5nRGVzYy5lbnVtZXJhYmxlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogZXhpc3RpbmdEZXNjLmNvbmZpZ3VyYWJsZSB9O1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHJlY2VpdmVyLCBuYW1lLCB1cGRhdGVEZXNjKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIU9iamVjdC5pc0V4dGVuc2libGUocmVjZWl2ZXIpKSByZXR1cm4gZmFsc2U7XG4gICAgICB2YXIgbmV3RGVzYyA9XG4gICAgICAgIHsgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlIH07XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocmVjZWl2ZXIsIG5hbWUsIG5ld0Rlc2MpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9LFxuICAvKmludm9rZTogZnVuY3Rpb24odGFyZ2V0LCBuYW1lLCBhcmdzLCByZWNlaXZlcikge1xuICAgIHJlY2VpdmVyID0gcmVjZWl2ZXIgfHwgdGFyZ2V0O1xuXG4gICAgdmFyIGhhbmRsZXIgPSBkaXJlY3RQcm94aWVzLmdldCh0YXJnZXQpO1xuICAgIGlmIChoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBoYW5kbGVyLmludm9rZShyZWNlaXZlciwgbmFtZSwgYXJncyk7XG4gICAgfVxuXG4gICAgdmFyIGZ1biA9IFJlZmxlY3QuZ2V0KHRhcmdldCwgbmFtZSwgcmVjZWl2ZXIpO1xuICAgIHJldHVybiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChmdW4sIHJlY2VpdmVyLCBhcmdzKTtcbiAgfSwqL1xuICBlbnVtZXJhdGU6IGZ1bmN0aW9uKHRhcmdldCkge1xuICAgIHZhciBoYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQodGFyZ2V0KTtcbiAgICB2YXIgcmVzdWx0O1xuICAgIGlmIChoYW5kbGVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGhhbmRsZXIuZW51bWVyYXRlIHNob3VsZCByZXR1cm4gYW4gaXRlcmF0b3IgZGlyZWN0bHksIGJ1dCB0aGVcbiAgICAgIC8vIGl0ZXJhdG9yIGdldHMgY29udmVydGVkIHRvIGFuIGFycmF5IGZvciBiYWNrd2FyZC1jb21wYXQgcmVhc29ucyxcbiAgICAgIC8vIHNvIHdlIG11c3QgcmUtaXRlcmF0ZSBvdmVyIHRoZSBhcnJheVxuICAgICAgcmVzdWx0ID0gaGFuZGxlci5lbnVtZXJhdGUoaGFuZGxlci50YXJnZXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBbXTtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gdGFyZ2V0KSB7IHJlc3VsdC5wdXNoKG5hbWUpOyB9OyAgICAgIFxuICAgIH1cbiAgICB2YXIgbCA9ICtyZXN1bHQubGVuZ3RoO1xuICAgIHZhciBpZHggPSAwO1xuICAgIHJldHVybiB7XG4gICAgICBuZXh0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKGlkeCA9PT0gbCkgcmV0dXJuIHsgZG9uZTogdHJ1ZSB9O1xuICAgICAgICByZXR1cm4geyBkb25lOiBmYWxzZSwgdmFsdWU6IHJlc3VsdFtpZHgrK10gfTtcbiAgICAgIH1cbiAgICB9O1xuICB9LFxuICAvLyBpbXBlcmZlY3Qgb3duS2V5cyBpbXBsZW1lbnRhdGlvbjogaW4gRVM2LCBzaG91bGQgYWxzbyBpbmNsdWRlXG4gIC8vIHN5bWJvbC1rZXllZCBwcm9wZXJ0aWVzLlxuICBvd25LZXlzOiBmdW5jdGlvbih0YXJnZXQpIHtcbiAgICByZXR1cm4gT2JqZWN0X2dldE93blByb3BlcnR5TmFtZXModGFyZ2V0KTtcbiAgfSxcbiAgYXBwbHk6IGZ1bmN0aW9uKHRhcmdldCwgcmVjZWl2ZXIsIGFyZ3MpIHtcbiAgICAvLyB0YXJnZXQuYXBwbHkocmVjZWl2ZXIsIGFyZ3MpXG4gICAgcmV0dXJuIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKHRhcmdldCwgcmVjZWl2ZXIsIGFyZ3MpO1xuICB9LFxuICBjb25zdHJ1Y3Q6IGZ1bmN0aW9uKHRhcmdldCwgYXJncywgbmV3VGFyZ2V0KSB7XG4gICAgLy8gcmV0dXJuIG5ldyB0YXJnZXQoLi4uYXJncyk7XG5cbiAgICAvLyBpZiB0YXJnZXQgaXMgYSBwcm94eSwgaW52b2tlIGl0cyBcImNvbnN0cnVjdFwiIHRyYXBcbiAgICB2YXIgaGFuZGxlciA9IGRpcmVjdFByb3hpZXMuZ2V0KHRhcmdldCk7XG4gICAgaWYgKGhhbmRsZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGhhbmRsZXIuY29uc3RydWN0KGhhbmRsZXIudGFyZ2V0LCBhcmdzLCBuZXdUYXJnZXQpO1xuICAgIH1cbiAgICBcbiAgICBpZiAodHlwZW9mIHRhcmdldCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwidGFyZ2V0IGlzIG5vdCBhIGZ1bmN0aW9uOiBcIiArIHRhcmdldCk7XG4gICAgfVxuICAgIGlmIChuZXdUYXJnZXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgbmV3VGFyZ2V0ID0gdGFyZ2V0O1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodHlwZW9mIG5ld1RhcmdldCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJuZXdUYXJnZXQgaXMgbm90IGEgZnVuY3Rpb246IFwiICsgdGFyZ2V0KTtcbiAgICAgIH0gICAgICBcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IChGdW5jdGlvbi5wcm90b3R5cGUuYmluZC5hcHBseShuZXdUYXJnZXQsIFtudWxsXS5jb25jYXQoYXJncykpKTtcbiAgfVxufTtcblxuLy8gZmVhdHVyZS10ZXN0IHdoZXRoZXIgdGhlIFByb3h5IGdsb2JhbCBleGlzdHMsIHdpdGhcbi8vIHRoZSBoYXJtb255LWVyYSBQcm94eS5jcmVhdGUgQVBJXG5pZiAodHlwZW9mIFByb3h5ICE9PSBcInVuZGVmaW5lZFwiICYmXG4gICAgdHlwZW9mIFByb3h5LmNyZWF0ZSAhPT0gXCJ1bmRlZmluZWRcIikge1xuXG4gIHZhciBwcmltQ3JlYXRlID0gUHJveHkuY3JlYXRlLFxuICAgICAgcHJpbUNyZWF0ZUZ1bmN0aW9uID0gUHJveHkuY3JlYXRlRnVuY3Rpb247XG5cbiAgdmFyIHJldm9rZWRIYW5kbGVyID0gcHJpbUNyZWF0ZSh7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcihcInByb3h5IGlzIHJldm9rZWRcIik7IH1cbiAgfSk7XG5cbiAgZ2xvYmFsLlByb3h5ID0gZnVuY3Rpb24odGFyZ2V0LCBoYW5kbGVyKSB7XG4gICAgLy8gY2hlY2sgdGhhdCB0YXJnZXQgaXMgYW4gT2JqZWN0XG4gICAgaWYgKE9iamVjdCh0YXJnZXQpICE9PSB0YXJnZXQpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcm94eSB0YXJnZXQgbXVzdCBiZSBhbiBPYmplY3QsIGdpdmVuIFwiK3RhcmdldCk7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgaGFuZGxlciBpcyBhbiBPYmplY3RcbiAgICBpZiAoT2JqZWN0KGhhbmRsZXIpICE9PSBoYW5kbGVyKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJveHkgaGFuZGxlciBtdXN0IGJlIGFuIE9iamVjdCwgZ2l2ZW4gXCIraGFuZGxlcik7XG4gICAgfVxuXG4gICAgdmFyIHZIYW5kbGVyID0gbmV3IFZhbGlkYXRvcih0YXJnZXQsIGhhbmRsZXIpO1xuICAgIHZhciBwcm94eTtcbiAgICBpZiAodHlwZW9mIHRhcmdldCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBwcm94eSA9IHByaW1DcmVhdGVGdW5jdGlvbih2SGFuZGxlcixcbiAgICAgICAgLy8gY2FsbCB0cmFwXG4gICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICByZXR1cm4gdkhhbmRsZXIuYXBwbHkodGFyZ2V0LCB0aGlzLCBhcmdzKTtcbiAgICAgICAgfSxcbiAgICAgICAgLy8gY29uc3RydWN0IHRyYXBcbiAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgIHJldHVybiB2SGFuZGxlci5jb25zdHJ1Y3QodGFyZ2V0LCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByb3h5ID0gcHJpbUNyZWF0ZSh2SGFuZGxlciwgT2JqZWN0LmdldFByb3RvdHlwZU9mKHRhcmdldCkpO1xuICAgIH1cbiAgICBkaXJlY3RQcm94aWVzLnNldChwcm94eSwgdkhhbmRsZXIpO1xuICAgIHJldHVybiBwcm94eTtcbiAgfTtcblxuICBnbG9iYWwuUHJveHkucmV2b2NhYmxlID0gZnVuY3Rpb24odGFyZ2V0LCBoYW5kbGVyKSB7XG4gICAgdmFyIHByb3h5ID0gbmV3IFByb3h5KHRhcmdldCwgaGFuZGxlcik7XG4gICAgdmFyIHJldm9rZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHZIYW5kbGVyID0gZGlyZWN0UHJveGllcy5nZXQocHJveHkpO1xuICAgICAgaWYgKHZIYW5kbGVyICE9PSBudWxsKSB7XG4gICAgICAgIHZIYW5kbGVyLnRhcmdldCAgPSBudWxsO1xuICAgICAgICB2SGFuZGxlci5oYW5kbGVyID0gcmV2b2tlZEhhbmRsZXI7XG4gICAgICB9XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH07XG4gICAgcmV0dXJuIHtwcm94eTogcHJveHksIHJldm9rZTogcmV2b2tlfTtcbiAgfVxuICBcbiAgLy8gYWRkIHRoZSBvbGQgUHJveHkuY3JlYXRlIGFuZCBQcm94eS5jcmVhdGVGdW5jdGlvbiBtZXRob2RzXG4gIC8vIHNvIG9sZCBjb2RlIHRoYXQgc3RpbGwgZGVwZW5kcyBvbiB0aGUgaGFybW9ueS1lcmEgUHJveHkgb2JqZWN0XG4gIC8vIGlzIG5vdCBicm9rZW4uIEFsc28gZW5zdXJlcyB0aGF0IG11bHRpcGxlIHZlcnNpb25zIG9mIHRoaXNcbiAgLy8gbGlicmFyeSBzaG91bGQgbG9hZCBmaW5lXG4gIGdsb2JhbC5Qcm94eS5jcmVhdGUgPSBwcmltQ3JlYXRlO1xuICBnbG9iYWwuUHJveHkuY3JlYXRlRnVuY3Rpb24gPSBwcmltQ3JlYXRlRnVuY3Rpb247XG5cbn0gZWxzZSB7XG4gIC8vIFByb3h5IGdsb2JhbCBub3QgZGVmaW5lZCwgb3Igb2xkIEFQSSBub3QgYXZhaWxhYmxlXG4gIGlmICh0eXBlb2YgUHJveHkgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAvLyBQcm94eSBnbG9iYWwgbm90IGRlZmluZWQsIGFkZCBhIFByb3h5IGZ1bmN0aW9uIHN0dWJcbiAgICBnbG9iYWwuUHJveHkgPSBmdW5jdGlvbihfdGFyZ2V0LCBfaGFuZGxlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwicHJveGllcyBub3Qgc3VwcG9ydGVkIG9uIHRoaXMgcGxhdGZvcm0uIE9uIHY4L25vZGUvaW9qcywgbWFrZSBzdXJlIHRvIHBhc3MgdGhlIC0taGFybW9ueV9wcm94aWVzIGZsYWdcIik7XG4gICAgfTtcbiAgfVxuICAvLyBQcm94eSBnbG9iYWwgZGVmaW5lZCBidXQgb2xkIEFQSSBub3QgYXZhaWxhYmxlXG4gIC8vIHByZXN1bWFibHkgUHJveHkgZ2xvYmFsIGFscmVhZHkgc3VwcG9ydHMgbmV3IEFQSSwgbGVhdmUgdW50b3VjaGVkXG59XG5cbi8vIGZvciBub2RlLmpzIG1vZHVsZXMsIGV4cG9ydCBldmVyeSBwcm9wZXJ0eSBpbiB0aGUgUmVmbGVjdCBvYmplY3Rcbi8vIGFzIHBhcnQgb2YgdGhlIG1vZHVsZSBpbnRlcmZhY2VcbmlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgT2JqZWN0LmtleXMoUmVmbGVjdCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgZXhwb3J0c1trZXldID0gUmVmbGVjdFtrZXldO1xuICB9KTtcbn1cblxuLy8gZnVuY3Rpb24tYXMtbW9kdWxlIHBhdHRlcm5cbn0odHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDogdGhpcykpOyJdfQ==
