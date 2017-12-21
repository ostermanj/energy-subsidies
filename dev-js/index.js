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
/* exported D3Charts, Helpers, d3Tip */ // let's jshint know that D3Charts can be "defined but not used" in this file
/* polyfills needed: Promise, Array.isArray, Array.find, Array.filter
 */

},{"../js-exports/Charts":2,"../js-exports/Helpers":3,"../js-vendor/d3-tip":4}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

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
        console.log(this);
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
            bottom: 15,
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
                return 'each-series series-' + _this5.parent.seriesCount + ' color-' + _this5.parent.seriesCount++ % 3;
            });
            /*
                        this.eachSeries.each((d,i,array) => {
                            this.parent.seriesArray.push(array[i]);
                        });*/
            if (this.config.stackSeries && this.config.stackSeries === true) {
                var forStacking = this.data.reduce(function (acc, cur, i) {

                    if (i === 0) {
                        cur.values.forEach(function (each) {
                            var _acc$push;

                            acc.push((_acc$push = {}, _defineProperty(_acc$push, _this5.config.variableX, each[_this5.config.variableX]), _defineProperty(_acc$push, cur.key, each[_this5.config.variableY]), _acc$push));
                        });
                    } else {
                        cur.values.forEach(function (each) {
                            acc.find(function (obj) {
                                return obj[_this5.config.variableX] === each[_this5.config.variableX];
                            })[cur.key] = each[_this5.config.variableY];
                        });
                    }
                    return acc;
                }, []);

                console.log(this.data.map(function (each) {
                    return each.key;
                }));
                this.stack = d3.stack().keys(this.data.map(function (each) {
                    return each.key;
                })).order(d3.stackOrderNone).offset(d3.stackOffsetNone);

                console.log(this, forStacking, this.data.map(function (each) {
                    return each.key;
                }), this.stack(forStacking));
                this.areaData = this.stack(forStacking);
            }

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

            var zeroValueline = d3.line().x(function (d) {
                if (_this7.xValuesUnique.indexOf(d[_this7.config.variableX]) === -1) {
                    _this7.xValuesUnique.push(d[_this7.config.variableX]);
                }
                return _this7.xScale(d3.timeParse(_this7.xTimeType)(d[_this7.config.variableX]));
            }).y(function () {
                return _this7.yScale(0);
            });

            var valueline = d3.line().x(function (d) {
                if (_this7.xValuesUnique.indexOf(d[_this7.config.variableX]) === -1) {
                    _this7.xValuesUnique.push(d[_this7.config.variableX]);
                }
                return _this7.xScale(d3.timeParse(_this7.xTimeType)(d[_this7.config.variableX]));
            }).y(function (d, i, array) {
                console.log(_this7, d, i, array);
                return _this7.yScale(d[_this7.config.variableY]);
            });

            if (this.config.stackSeries && this.config.stackSeries === true) {

                var area = d3.area().x(function (d) {
                    return _this7.xScale(d3.timeParse(_this7.xTimeType)(d.data[_this7.config.variableX]));
                }).y0(function (d) {
                    return _this7.yScale(d[0]);
                }).y1(function (d) {
                    return _this7.yScale(d[1]);
                });

                var line = d3.line().x(function (d) {
                    return _this7.xScale(d3.timeParse(_this7.xTimeType)(d.data[_this7.config.variableX]));
                }).y(function (d) {
                    return _this7.yScale(d[1]);
                });

                var stackGroup = this.svg.append('g').attr('class', 'stacked-area');

                stackGroup.selectAll('stacked-area').data(this.areaData).enter().append('path').attr('class', function (d, i) {
                    return 'area-line color-' + i;
                }) // TO DO not quite right that color shold be `i`
                // if you have more than one group of series, will repeat
                .attr('d', function (d) {
                    return area(d);
                });

                stackGroup.selectAll('stacked-line').data(this.areaData).enter().append('path').attr('class', function (d, i) {
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
                        console.log(_this7, d, i, array);
                        _this7.addPoints();
                        _this7.addLabels();
                    }
                });
            }
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
            this.xAxisGroup.attr('transform', 'translate(0,' + (this.yScale(yAxisPosition) + yAxisOffset) + ')') // not programatic placement of x-axis
            .attr('class', 'axis x-axis').call(axis);
        },
        addYAxis: function addYAxis() {
            var _this9 = this;

            /* axis */
            this.yAxisGroup.attr('class', function () {
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
                return 'translate(' + (_this10.width + 5) + ', ' + (_this10.yScale(d.values[d.values.length - 1][_this10.config.variableY]) + 3) + ')';
            });
        },
        addPoints: function addPoints() {
            var _this11 = this;

            this.points = this.eachSeries.selectAll('points').data(function (d) {
                return d.values;
            }).enter().append('circle').attr('opacity', 0).attr('class', 'data-point').attr('r', '4').attr('cx', function (d) {
                return _this11.xScale(d3.timeParse(_this11.xTimeType)(d[_this11.config.variableX]));
            }).attr('cy', function (d) {
                return _this11.yScale(d[_this11.config.variableY]);
            }).on('mouseover', function (d, i, array) {
                console.log(d);
                var klass = array[i].parentNode.classList.value.match(/color-\d/)[0]; // get the color class of the parent g
                _this11.tooltip.attr('class', _this11.tooltip.attr('class') + ' ' + klass);
                _this11.tooltip.html('<strong>' + _this11.parent.tipText(d.series) + '</strong> (' + d.year + ')<br />' + d[_this11.config.variableY] + ' ' + _this11.parent.units(d.series));
                _this11.tooltip.show();
            }).on('mouseout', function () {
                _this11.tooltip.attr('class', _this11.tooltip.attr('class').replace(/ color-\d/g, ''));
                _this11.tooltip.html('');
                _this11.tooltip.hide();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9DaGFydHMuanMiLCJqcy1leHBvcnRzL0hlbHBlcnMuanMiLCJqcy12ZW5kb3IvZDMtdGlwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNJQTs7QUFDQTs7QUFDQTs7QUFFQSxJQUFJLFdBQVksWUFBVTs7QUFFMUI7O0FBRUksUUFBSSxrQkFBa0IsRUFBdEI7QUFDQSxRQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEwQjtBQUFBOztBQUN6QyxnQkFBUSxHQUFSLENBQVksS0FBWjtBQUNBLGFBQUssU0FBTCxHQUFpQixTQUFqQjtBQUNBLGFBQUssS0FBTCxHQUFhLEtBQWI7QUFDQSxhQUFLLE1BQUwsR0FBYyxVQUFVLE9BQVYsQ0FBa0IsT0FBbEIsRUFBZDtBQUNBLGdCQUFRLEdBQVIsQ0FBWSxLQUFLLE1BQUwsQ0FBWSxNQUFaLENBQW1CLFFBQW5CLEVBQVo7QUFDQSxhQUFLLFlBQUwsR0FBb0IsS0FBSyxrQkFBTCxDQUF3QixTQUF4QixDQUFwQjtBQUNBLGFBQUssUUFBTCxHQUFnQixFQUFoQjtBQUNBLGdCQUFRLEdBQVIsQ0FBWSxLQUFLLFlBQWpCO0FBQ0E7QUFDQSxhQUFLLFlBQUwsQ0FBa0IsSUFBbEIsQ0FBdUIsWUFBTTtBQUN6QixrQkFBSyxnQkFBTCxDQUFzQixTQUF0QjtBQUNILFNBRkQ7QUFHSCxLQWJEO0FBY0E7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBRWpCLDBCQUZpQixnQ0FFRztBQUFBOztBQUNoQixnQkFBSSxlQUFlLEVBQW5CO0FBQ0EsZ0JBQUksVUFBVSxLQUFLLE1BQUwsQ0FBWSxPQUExQjtBQUFBLGdCQUNJLE9BQU8sQ0FBQyxLQUFLLE1BQUwsQ0FBWSxPQUFiLEVBQXFCLEtBQUssTUFBTCxDQUFZLGFBQWpDLENBRFgsQ0FGZ0IsQ0FHNEM7QUFDeEI7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O0FBQ0EsWUFBTSxDQUFOLElBQVcsU0FBUyxDQUFwQjtBQUNBLFdBQUssQ0FBTCxHQUFTLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFUO0FBQ0EsWUFBTSxDQUFOLElBQVcsTUFBWDtBQUNBLFdBQUssQ0FBTCxHQUFTLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFUOztBQUVBLGFBQU8sSUFBUDtBQUNEOztBQUVELFdBQU8sR0FBUDtBQUNELEdBbFREO0FBbVRELENBMVRvQixFQUFkIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIiAvKiBleHBvcnRlZCBEM0NoYXJ0cywgSGVscGVycywgZDNUaXAgKi8gLy8gbGV0J3MganNoaW50IGtub3cgdGhhdCBEM0NoYXJ0cyBjYW4gYmUgXCJkZWZpbmVkIGJ1dCBub3QgdXNlZFwiIGluIHRoaXMgZmlsZVxuIC8qIHBvbHlmaWxscyBuZWVkZWQ6IFByb21pc2UsIEFycmF5LmlzQXJyYXksIEFycmF5LmZpbmQsIEFycmF5LmZpbHRlclxuXG4gKi9cbmltcG9ydCB7IEhlbHBlcnMgfSBmcm9tICcuLi9qcy1leHBvcnRzL0hlbHBlcnMnO1xuaW1wb3J0IHsgQ2hhcnRzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9DaGFydHMnO1xuaW1wb3J0IHsgZDNUaXAgfSBmcm9tICcuLi9qcy12ZW5kb3IvZDMtdGlwJztcblxudmFyIEQzQ2hhcnRzID0gKGZ1bmN0aW9uKCl7XG5cblwidXNlIHN0cmljdFwiOyBcbiAgICAgXG4gICAgdmFyIGdyb3VwQ29sbGVjdGlvbiA9IFtdO1xuICAgIHZhciBEM0NoYXJ0R3JvdXAgPSBmdW5jdGlvbihjb250YWluZXIsIGluZGV4KXtcbiAgICAgICAgY29uc29sZS5sb2coaW5kZXgpO1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICAgICAgdGhpcy5pbmRleCA9IGluZGV4O1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbnRhaW5lci5kYXRhc2V0LmNvbnZlcnQoKTtcbiAgICAgICAgY29uc29sZS5sb2codGhpcy5jb25maWcubmVzdEJ5LnRvU3RyaW5nKCkpO1xuICAgICAgICB0aGlzLmRhdGFQcm9taXNlcyA9IHRoaXMucmV0dXJuRGF0YVByb21pc2VzKGNvbnRhaW5lcik7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcbiAgICAgICAgY29uc29sZS5sb2codGhpcy5kYXRhUHJvbWlzZXMpO1xuICAgICAgICAvL3RoaXMuY29udHJvbGxlci5pbml0Q29udHJvbGxlcihjb250YWluZXIsIHRoaXMubW9kZWwsIHRoaXMudmlldyk7XG4gICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplQ2hhcnRzKGNvbnRhaW5lcik7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgLy9wcm90b3R5cGUgYmVnaW5zIGhlcmVcbiAgICBEM0NoYXJ0R3JvdXAucHJvdG90eXBlID0ge1xuICAgICAgICBcbiAgICAgICAgICAgIHJldHVybkRhdGFQcm9taXNlcygpeyBcbiAgICAgICAgICAgICAgICB2YXIgZGF0YVByb21pc2VzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHNoZWV0SUQgPSB0aGlzLmNvbmZpZy5zaGVldElkLCBcbiAgICAgICAgICAgICAgICAgICAgdGFicyA9IFt0aGlzLmNvbmZpZy5kYXRhVGFiLHRoaXMuY29uZmlnLmRpY3Rpb25hcnlUYWJdOyAvLyB0aGlzIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlzIHRoZXJlIGEgY2FzZSBmb3IgbW9yZSB0aGFuIG9uZSBzaGVldCBvZiBkYXRhP1xuICAgICAgICAgICAgICAgIHRhYnMuZm9yRWFjaCgoZWFjaCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZDMuanNvbignaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLycgKyBzaGVldElEICsgJy92YWx1ZXMvJyArIGVhY2ggKyAnP2tleT1BSXphU3lERDNXNXdKZUpGMmVzZmZaTVF4TnRFbDl0dC1PZmdTcTQnLCAoZXJyb3IsZGF0YSkgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZXMgPSBkYXRhLnZhbHVlcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdFR5cGUgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyAnb2JqZWN0JyA6ICdzZXJpZXMnOyAvLyBuZXN0VHlwZSBmb3IgZGF0YSBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5ID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gZmFsc2UgOiB0aGlzLmNvbmZpZy5uZXN0Qnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgdHJ1ZSwgbmVzdFR5cGUsIGkpKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFQcm9taXNlcy5wdXNoKHByb21pc2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFByb21pc2UuYWxsKGRhdGFQcm9taXNlcykudGhlbih2YWx1ZXMgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGEgPSB2YWx1ZXNbMF07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGljdGlvbmFyeSA9IHZhbHVlc1sxXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSB0aGlzLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoZGF0YVByb21pc2VzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdW1tYXJpemVEYXRhKCl7IC8vIHRoaXMgZm4gY3JlYXRlcyBhbiBhcnJheSBvZiBvYmplY3RzIHN1bW1hcml6aW5nIHRoZSBkYXRhIGluIG1vZGVsLmRhdGEuIG1vZGVsLmRhdGEgaXMgbmVzdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBuZXN0aW5nIGFuZCByb2xsaW5nIHVwIGNhbm5vdCBiZSBkb25lIGVhc2lseSBhdCB0aGUgc2FtZSB0aW1lLCBzbyB0aGV5J3JlIGRvbmUgc2VwYXJhdGVseS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHN1bW1hcmllcyBwcm92aWRlIGF2ZXJhZ2UsIG1heCwgbWluIG9mIGFsbCBmaWVsZHMgaW4gdGhlIGRhdGEgYXQgYWxsIGxldmVscyBvZiBuZXN0aW5nLiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLCB0aGUgc2Vjb25kIGlzIHR3bywgYW5kIHNvIG9uLlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBzdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgdmFyaWFibGVzID0gT2JqZWN0LmtleXModGhpcy51bm5lc3RlZFswXSk7IC8vIGFsbCBuZWVkIHRvIGhhdmUgdGhlIHNhbWUgZmllbGRzXG4gICAgICAgICAgICAgICAgdmFyIG5lc3RCeSA9IHRoaXMuY29uZmlnLm5lc3RCeSA/IHRoaXMuY29uZmlnLm5lc3RCeS5tYXAoZWFjaCA9PiBlYWNoKSA6IGZhbHNlOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB1c2VzIG1hcCB0byBjcmVhdGUgbmV3IGFycmF5IHJhdGhlciB0aGFuIGFzc2lnbmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ5IHJlZmVyZW5jZS4gdGhlIGBwb3AoKWAgYmVsb3cgd291bGQgYWZmZWN0IG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJyYXkgaWYgZG9uZSBieSByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5QXJyYXkgPSBBcnJheS5pc0FycmF5KG5lc3RCeSkgPyBuZXN0QnkgOiBbbmVzdEJ5XTtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiByZWR1Y2VWYXJpYWJsZXMoZCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY1tjdXJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heDogICAgICAgZDMubWF4KGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW46ICAgICAgIGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVhbjogICAgICBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW06ICAgICAgIGQzLnN1bShkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFuOiAgICBkMy5tZWRpYW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbmNlOiAgZDMudmFyaWFuY2UoZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmlhdGlvbjogZDMuZGV2aWF0aW9uKGQsIGQgPT4gZFtjdXJdKVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgICAgIH0se30pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3aGlsZSAoIG5lc3RCeUFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHN1bW1hcml6ZWQgPSB0aGlzLm5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICAucm9sbHVwKHJlZHVjZVZhcmlhYmxlcylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodGhpcy51bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgICAgIHN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAgICAgIFxuICAgICAgICAgICAgICAgICAgICBuZXN0QnlBcnJheS5wb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1bW1hcmllcztcbiAgICAgICAgICAgIH0sIFxuICAgICAgICAgICAgbmVzdFByZWxpbShuZXN0QnlBcnJheSl7XG4gICAgICAgICAgICAgICAgLy8gcmVjdXJzaXZlICBuZXN0aW5nIGZ1bmN0aW9uIHVzZWQgYnkgc3VtbWFyaXplRGF0YSBhbmQgcmV0dXJuS2V5VmFsdWVzXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5lc3RCeUFycmF5LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1cil7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyICE9PSAnc3RyaW5nJyAmJiB0eXBlb2YgY3VyICE9PSAnZnVuY3Rpb24nICkgeyB0aHJvdyAnZWFjaCBuZXN0QnkgaXRlbSBtdXN0IGJlIGEgc3RyaW5nIG9yIGZ1bmN0aW9uJzsgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgcnRuO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdzdHJpbmcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkW2N1cl07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTsgICAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjdXIoZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcnRuO1xuICAgICAgICAgICAgICAgIH0sIGQzLm5lc3QoKSk7XG4gICAgICAgICAgICB9LCAgICAgICBcbiAgICAgICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycsIHRhYkluZGV4ID0gMCl7XG4gICAgICAgICAgICAvLyB0aGlzIGZuIHRha2VzIG5vcm1hbGl6ZWQgZGF0YSBmZXRjaGVkIGFzIGFuIGFycmF5IG9mIHJvd3MgYW5kIHVzZXMgdGhlIHZhbHVlcyBpbiB0aGUgZmlyc3Qgcm93IGFzIGtleXMgZm9yIHZhbHVlcyBpblxuICAgICAgICAgICAgLy8gc3Vic2VxdWVudCByb3dzXG4gICAgICAgICAgICAvLyBuZXN0QnkgPSBzdHJpbmcgb3IgYXJyYXkgb2YgZmllbGQocykgdG8gbmVzdCBieSwgb3IgYSBjdXN0b20gZnVuY3Rpb24sIG9yIGFuIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zO1xuICAgICAgICAgICAgLy8gY29lcmNlID0gQk9PTCBjb2VyY2UgdG8gbnVtIG9yIG5vdDsgbmVzdFR5cGUgPSBvYmplY3Qgb3Igc2VyaWVzIG5lc3QgKGQzKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBwcmVsaW07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHVubmVzdGVkID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1ciwgaSkgeyBcbiAgICAgICAgICAgICAgICAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgICAvLyAzLiAvLyBhY2MgaXMgYW4gb2JqZWN0ICwga2V5IGlzIGNvcnJlc3BvbmRpbmcgdmFsdWUgZnJvbSByb3cgMCwgdmFsdWUgaXMgY3VycmVudCB2YWx1ZSBvZiBhcnJheVxuICAgICAgICAgICAgICAgICAgYWNjW3ZhbHVlc1swXVtpXV0gPSBjb2VyY2UgPT09IHRydWUgPyBpc05hTigrY3VyKSB8fCBjdXIgPT09ICcnID8gY3VyIDogK2N1ciA6IGN1cjsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRlc3QgZm9yIGVtcHR5IHN0cmluZ3MgYmVmb3JlIGNvZXJjaW5nIGJjICsnJyA9PiAwXG4gICAgICAgICAgICAgICAgfSwge30pKTtcbiAgICAgICAgICAgICAgICBpZiAoIHRhYkluZGV4ID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVubmVzdGVkID0gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCAhbmVzdEJ5ICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bm5lc3RlZDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBuZXN0QnkgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBuZXN0QnkgPT09ICdmdW5jdGlvbicgKSB7IC8vIGllIG9ubHkgb25lIG5lc3RCeSBmaWVsZCBvciBmdW5jaXRvblxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gdGhpcy5uZXN0UHJlbGltKFtuZXN0QnldKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCBuZXN0VHlwZSA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh1bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudHJpZXModW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbml0aWFsaXplQ2hhcnRzKGNvbnRhaW5lcil7XG4gICAgICAgICAgICAgICAgdmFyIGdyb3VwID0gdGhpcztcbiAgICAgICAgICAgICAgICBkMy5zZWxlY3QoY29udGFpbmVyKS5zZWxlY3RBbGwoJy5kMy1jaGFydCcpXG4gICAgICAgICAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICBncm91cC5jaGlsZHJlbi5wdXNoKG5ldyBDaGFydHMuQ2hhcnREaXYodGhpcywgZ3JvdXApKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9ICAgICAgICBcbiAgICB9OyAvLyBEM0NoYXJ0R3JvdXAgcHJvdG90eXBlIGVuZHMgaGVyZVxuICAgIFxuICAgIHdpbmRvdy5EM0NoYXJ0cyA9IHsgLy8gbmVlZCB0byBzcGVjaWZ5IHdpbmRvdyBiYyBhZnRlciB0cmFuc3BpbGluZyBhbGwgdGhpcyB3aWxsIGJlIHdyYXBwZWQgaW4gSUlGRXNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBgcmV0dXJuYGluZyB3b24ndCBnZXQgdGhlIGV4cG9ydCBpbnRvIHdpbmRvdydzIGdsb2JhbCBzY29wZVxuICAgICAgICBJbml0KCl7XG4gICAgICAgICAgICB2YXIgZ3JvdXBEaXZzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmQzLWdyb3VwJyk7XG4gICAgICAgICAgICBmb3IgKCBsZXQgaSA9IDA7IGkgPCBncm91cERpdnMubGVuZ3RoOyBpKysgKXtcbiAgICAgICAgICAgICAgICBncm91cENvbGxlY3Rpb24ucHVzaChuZXcgRDNDaGFydEdyb3VwKGdyb3VwRGl2c1tpXSwgaSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc29sZS5sb2coZ3JvdXBDb2xsZWN0aW9uKTtcbiAgICAgICAgfVxuICAgIH07XG59KCkpOyAvLyBlbmQgdmFyIEQzQ2hhcnRzIElJRkUiLCJleHBvcnQgY29uc3QgQ2hhcnRzID0gKGZ1bmN0aW9uKCl7XG5cbiAgICB2YXIgQ2hhcnREaXYgPSBmdW5jdGlvbihjb250YWluZXIsIHBhcmVudCl7XG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgICAgICB0aGlzLnNlcmllc0NvdW50ID0gMDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBPYmplY3QuY3JlYXRlKCBwYXJlbnQuY29uZmlnLCBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyggY29udGFpbmVyLmRhdGFzZXQuY29udmVydCgpICkgKTtcbiAgICAgICAgICAgIC8vIGxpbmUgYWJvdmUgY3JlYXRlcyBhIGNvbmZpZyBvYmplY3QgZnJvbSB0aGUgSFRNTCBkYXRhc2V0IGZvciB0aGUgY2hhcnREaXYgY29udGFpbmVyXG4gICAgICAgICAgICAvLyB0aGF0IGluaGVyaXRzIGZyb20gdGhlIHBhcmVudHMgY29uZmlnIG9iamVjdC4gYW55IGNvbmZpZ3Mgbm90IHNwZWNpZmllZCBmb3IgdGhlIGNoYXJ0RGl2IChhbiBvd24gcHJvcGVydHkpXG4gICAgICAgICAgICAvLyB3aWxsIGNvbWUgZnJvbSB1cCB0aGUgaW5oZXJpdGFuY2UgY2hhaW5cbiAgICAgICAgdGhpcy5kYXR1bSA9IHBhcmVudC5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gdGhpcy5jb25maWcuY2F0ZWdvcnkpO1xuICAgICAgICB2YXIgc2VyaWVzSW5zdHJ1Y3QgPSB0aGlzLmNvbmZpZy5zZXJpZXMgfHwgJ2FsbCc7XG4gICAgICAgIGNvbnNvbGUubG9nKHNlcmllc0luc3RydWN0KTtcbiAgICAgICAgaWYgKCBBcnJheS5pc0FycmF5KHNlcmllc0luc3RydWN0KSApe1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2lzIGFycmF5JywgdGhpcy5kYXR1bS52YWx1ZXMpO1xuICAgICAgICAgICAgdGhpcy5kYXR1bS52YWx1ZXMgPSB0aGlzLmRhdHVtLnZhbHVlcy5maWx0ZXIoZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZWFjaC5rZXkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzZXJpZXNJbnN0cnVjdC5pbmRleE9mKGVhY2gua2V5KSAhPT0gLTE7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmICggc2VyaWVzSW5zdHJ1Y3QgIT09ICdhbGwnICl7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgSW52YWxpZCBpbnN0cnVjdGlvbiBmcm9tIEhUTUwgZm9yIHdoaWNoIGNhdGVnb3JpZXMgdG8gaW5jbHVkZSBcbiAgICAgICAgICAgICAgICAgICAgKHZhciBzZXJpZXNJbnN0cnVjdCkuIEZhbGxiYWNrIHRvIGFsbC5gKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNlcmllc0dyb3VwcyA9IHRoaXMuZ3JvdXBTZXJpZXMoKTtcbiAgICAgICAgdGhpcy5kaWN0aW9uYXJ5ID0gdGhpcy5wYXJlbnQuZGljdGlvbmFyeTtcbiAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy5oZWFkaW5nICE9PSBmYWxzZSApe1xuICAgICAgICAgICAgdGhpcy5hZGRIZWFkaW5nKHRoaXMuY29uZmlnLmhlYWRpbmcpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY3JlYXRlQ2hhcnRzKCk7XG5cbiAgICB9O1xuICAgIFxuICAgIENoYXJ0RGl2LnByb3RvdHlwZSA9IHtcbiAgICAgICAgY2hhcnRUeXBlczoge1xuICAgICAgICAgICAgbGluZTogICAnTGluZUNoYXJ0JyxcbiAgICAgICAgICAgIGNvbHVtbjogJ0NvbHVtbkNoYXJ0JyxcbiAgICAgICAgICAgIGJhcjogICAgJ0JhckNoYXJ0JyAvLyBzbyBvbiAuIC4gLlxuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVDaGFydHMoKXtcbiAgICAgICAgICAgIHRoaXMuc2VyaWVzR3JvdXBzLmZvckVhY2goKGVhY2gpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuLnB1c2gobmV3IExpbmVDaGFydCh0aGlzLCBlYWNoKSk7IC8vIFRPIERPIGRpc3Rpbmd1aXNoIGNoYXJ0IHR5cGVzIGhlcmVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBncm91cFNlcmllcygpe1xuICAgICAgICAgICAgdmFyIHNlcmllc0dyb3VwcyxcbiAgICAgICAgICAgICAgICBncm91cHNJbnN0cnVjdCA9IHRoaXMuY29uZmlnLnNlcmllc0dyb3VwIHx8ICdub25lJztcbiAgICAgICAgICAgIGlmICggQXJyYXkuaXNBcnJheSggZ3JvdXBzSW5zdHJ1Y3QgKSApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5zZXJpZXNHcm91cC5mb3JFYWNoKGdyb3VwID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzLnB1c2godGhpcy5kYXR1bS52YWx1ZXMuZmlsdGVyKHNlcmllcyA9PiBncm91cC5pbmRleE9mKHNlcmllcy5rZXkpICE9PSAtMSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdub25lJyApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSB0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBbZWFjaF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdhbGwnICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFt0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBlYWNoKV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBJbnZhbGlkIGRhdGEtZ3JvdXAtc2VyaWVzIGluc3RydWN0aW9uIGZyb20gaHRtbC4gXG4gICAgICAgICAgICAgICAgICAgICAgIE11c3QgYmUgdmFsaWQgSlNPTjogXCJOb25lXCIgb3IgXCJBbGxcIiBvciBhbiBhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICBvZiBhcnJheXMgY29udGFpbmluZyB0aGUgc2VyaWVzIHRvIGJlIGdyb3VwZWRcbiAgICAgICAgICAgICAgICAgICAgICAgdG9nZXRoZXIuIEFsbCBzdHJpbmdzIG11c3QgYmUgZG91YmxlLXF1b3RlZC5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzZXJpZXNHcm91cHM7XG4gICAgICAgIH0sIC8vIGVuZCBncm91cFNlcmllcygpXG4gICAgICAgIGFkZEhlYWRpbmcoaW5wdXQpe1xuICAgICAgICAgICAgY29uc29sZS5sb2coaW5wdXQpO1xuICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMuY29udGFpbmVyKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3AnKVxuICAgICAgICAgICAgICAgIC5odG1sKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGhlYWRpbmcgPSB0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnID8gaW5wdXQgOiB0aGlzLmxhYmVsKHRoaXMuY29uZmlnLmNhdGVnb3J5KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICc8c3Ryb25nPicgKyBoZWFkaW5nICsgJzwvc3Ryb25nPic7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGxhYmVsKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbDtcbiAgICAgICAgfSxcbiAgICAgICAgdW5pdHMoa2V5KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLnVuaXRzOyAgXG4gICAgICAgIH0sXG4gICAgICAgIHRpcFRleHQoa2V5KXtcbiAgICAgICAgICAgIHZhciBzdHIgPSB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLmxhYmVsLnJlcGxhY2UoL1xcXFxuL2csJyAnKTtcbiAgICAgICAgICAgIHJldHVybiBzdHIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHIuc2xpY2UoMSk7XG4gICAgICAgIH1cblxuICAgIH07IC8vIGVuZCBMaW5lQ2hhcnQucHJvdG90eXBlXG5cbiAgICB2YXIgTGluZUNoYXJ0ID0gZnVuY3Rpb24ocGFyZW50LCBzZXJpZXNHcm91cCl7XG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgICAgICB0aGlzLmNvbmZpZyA9IHBhcmVudC5jb25maWc7XG4gICAgICAgIHRoaXMubWFyZ2luVG9wID0gK3RoaXMuY29uZmlnLm1hcmdpblRvcCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLnRvcDtcbiAgICAgICAgdGhpcy5tYXJnaW5SaWdodCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5SaWdodCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLnJpZ2h0O1xuICAgICAgICB0aGlzLm1hcmdpbkJvdHRvbSA9ICt0aGlzLmNvbmZpZy5tYXJnaW5Cb3R0b20gfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5ib3R0b207XG4gICAgICAgIHRoaXMubWFyZ2luTGVmdCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5MZWZ0IHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMubGVmdDtcbiAgICAgICAgdGhpcy53aWR0aCA9IHRoaXMuY29uZmlnLnN2Z1dpZHRoID8gK3RoaXMuY29uZmlnLnN2Z1dpZHRoIC0gdGhpcy5tYXJnaW5SaWdodCAtIHRoaXMubWFyZ2luTGVmdCA6IDMyMCAtIHRoaXMubWFyZ2luUmlnaHQgLSB0aGlzLm1hcmdpbkxlZnQ7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5jb25maWcuc3ZnSGVpZ2h0ID8gK3RoaXMuY29uZmlnLnN2Z0hlaWdodCAtIHRoaXMubWFyZ2luVG9wIC0gdGhpcy5tYXJnaW5Cb3R0b20gOiAoIHRoaXMud2lkdGggKyB0aGlzLm1hcmdpblJpZ2h0ICsgdGhpcy5tYXJnaW5MZWZ0ICkgLyAyIC0gdGhpcy5tYXJnaW5Ub3AgLSB0aGlzLm1hcmdpbkJvdHRvbTtcbiAgICAgICAgdGhpcy5kYXRhID0gc2VyaWVzR3JvdXA7XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMpO1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IHRoaXMuaW5pdChwYXJlbnQuY29udGFpbmVyKTsgLy8gVE8gRE8gIHRoaXMgaXMga2luZGEgd2VpcmRcbiAgICAgICAgdGhpcy54U2NhbGVUeXBlID0gdGhpcy5jb25maWcueFNjYWxlVHlwZSB8fCAndGltZSc7XG4gICAgICAgIHRoaXMueVNjYWxlVHlwZSA9IHRoaXMuY29uZmlnLnlTY2FsZVR5cGUgfHwgJ2xpbmVhcic7XG4gICAgICAgIHRoaXMueFRpbWVUeXBlID0gdGhpcy5jb25maWcueFRpbWVUeXBlIHx8ICclWSc7XG4gICAgICAgIHRoaXMuc2NhbGVCeSA9IHRoaXMuY29uZmlnLnNjYWxlQnkgfHwgJ3Nlcmllcy1ncm91cCc7XG4gICAgICAgIHRoaXMuc2V0U2NhbGVzKCk7IC8vIC8vU0hPVUxEIEJFIElOIENIQVJUIFBST1RPVFlQRSBcbiAgICAgICAgdGhpcy5zZXRUb29sdGlwcygpO1xuICAgICAgICB0aGlzLmFkZExpbmVzKCk7XG4gICAgICAvLyAgdGhpcy5hZGRQb2ludHMoKTtcbiAgICAgICAgdGhpcy5hZGRYQXhpcygpO1xuICAgICAgICB0aGlzLmFkZFlBeGlzKCk7XG4gICAgICAgIGlmICggdGhpcy5jb25maWcuZGlyZWN0TGFiZWwgPT09IHRydWUgKXtcbiAgICAgICAgLy8gICAgdGhpcy5hZGRMYWJlbHMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHRoaXMuYWRkTGVnZW5kcygpO1xuICAgICAgICB9XG4gICAgICAgICAgICAgICBcbiAgICB9O1xuXG4gICAgTGluZUNoYXJ0LnByb3RvdHlwZSA9IHsgLy8gZWFjaCBMaW5lQ2hhcnQgaXMgYW4gc3ZnIHRoYXQgaG9sZCBncm91cGVkIHNlcmllc1xuICAgICAgICBkZWZhdWx0TWFyZ2luczoge1xuICAgICAgICAgICAgdG9wOjIwLFxuICAgICAgICAgICAgcmlnaHQ6NDUsXG4gICAgICAgICAgICBib3R0b206MTUsXG4gICAgICAgICAgICBsZWZ0OjM1XG4gICAgICAgIH0sXG4gICAgICAgICAgICAgIFxuICAgICAgICBpbml0KGNoYXJ0RGl2KXsgLy8gLy9TSE9VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFIHRoaXMgaXMgY2FsbGVkIG9uY2UgZm9yIGVhY2ggc2VyaWVzR3JvdXAgb2YgZWFjaCBjYXRlZ29yeS4gXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gIGQzLnNlbGVjdChjaGFydERpdilcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdzdmcnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIHRoaXMud2lkdGggKyB0aGlzLm1hcmdpblJpZ2h0ICsgdGhpcy5tYXJnaW5MZWZ0IClcbiAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgdGhpcy5oZWlnaHQgICsgdGhpcy5tYXJnaW5Ub3AgKyB0aGlzLm1hcmdpbkJvdHRvbSApO1xuXG4gICAgICAgICAgICB0aGlzLnN2ZyA9IGNvbnRhaW5lci5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLGB0cmFuc2xhdGUoJHt0aGlzLm1hcmdpbkxlZnR9LCAke3RoaXMubWFyZ2luVG9wfSlgKTtcblxuICAgICAgICAgICAgdGhpcy54QXhpc0dyb3VwID0gdGhpcy5zdmcuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgIHRoaXMueUF4aXNHcm91cCA9IHRoaXMuc3ZnLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICB0aGlzLmVhY2hTZXJpZXMgPSB0aGlzLnN2Zy5zZWxlY3RBbGwoJ2VhY2gtc2VyaWVzJylcbiAgICAgICAgICAgICAgICAuZGF0YSh0aGlzLmRhdGEpXG4gICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnZWFjaC1zZXJpZXMgc2VyaWVzLScgKyB0aGlzLnBhcmVudC5zZXJpZXNDb3VudCArICcgY29sb3ItJyArIHRoaXMucGFyZW50LnNlcmllc0NvdW50KysgJSAzO1xuICAgICAgICAgICAgICAgIH0pO1xuLypcbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcy5lYWNoKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudC5zZXJpZXNBcnJheS5wdXNoKGFycmF5W2ldKTtcbiAgICAgICAgICAgIH0pOyovXG4gICAgICAgICAgICBpZiAoIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzICYmIHRoaXMuY29uZmlnLnN0YWNrU2VyaWVzID09PSB0cnVlICl7XG4gICAgICAgICAgICAgICAgdmFyIGZvclN0YWNraW5nID0gdGhpcy5kYXRhLnJlZHVjZSgoYWNjLGN1cixpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoIGkgPT09IDAgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1ci52YWx1ZXMuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY2MucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdOiBlYWNoW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtjdXIua2V5XTogZWFjaFt0aGlzLmNvbmZpZy52YXJpYWJsZVldXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1ci52YWx1ZXMuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY2MuZmluZChvYmogPT4gb2JqW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0gPT09IGVhY2hbdGhpcy5jb25maWcudmFyaWFibGVYXSlbY3VyLmtleV0gPSBlYWNoW3RoaXMuY29uZmlnLnZhcmlhYmxlWV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgIH0sW10pO1xuXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5kYXRhLm1hcChlYWNoID0+IGVhY2gua2V5KSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGFjayA9IGQzLnN0YWNrKClcbiAgICAgICAgICAgICAgICAgICAgLmtleXModGhpcy5kYXRhLm1hcChlYWNoID0+IGVhY2gua2V5KSlcbiAgICAgICAgICAgICAgICAgICAgLm9yZGVyKGQzLnN0YWNrT3JkZXJOb25lKVxuICAgICAgICAgICAgICAgICAgICAub2Zmc2V0KGQzLnN0YWNrT2Zmc2V0Tm9uZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2codGhpcywgZm9yU3RhY2tpbmcsIHRoaXMuZGF0YS5tYXAoZWFjaCA9PiBlYWNoLmtleSksIHRoaXMuc3RhY2soZm9yU3RhY2tpbmcpKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFyZWFEYXRhID0gdGhpcy5zdGFjayhmb3JTdGFja2luZyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb250YWluZXIubm9kZSgpO1xuICAgICAgICB9LFxuICAgICAgICBzZXRTY2FsZXMoKXsgLy9TSE9VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFIC8vIFRPIERPOiBTRVQgU0NBTEVTIEZPUiBPVEhFUiBHUk9VUCBUWVBFU1xuICAgICAgICAgICAgdmFyIGQzU2NhbGUgPSB7XG4gICAgICAgICAgICAgICAgdGltZTogZDMuc2NhbGVUaW1lKCksXG4gICAgICAgICAgICAgICAgbGluZWFyOiBkMy5zY2FsZUxpbmVhcigpXG4gICAgICAgICAgICAgICAgLy8gVE8gRE86IGFkZCBhbGwgc2NhbGUgdHlwZXMuXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIHhNYXhlcyA9IFtdLCB4TWlucyA9IFtdLCB5TWF4ZXMgPSBbXSwgeU1pbnMgPSBbXTtcbiAgICAgICAgICAgIGlmICggdGhpcy5zY2FsZUJ5ID09PSAnc2VyaWVzLWdyb3VwJyApe1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlYWNoLCB0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgeE1heGVzLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0ubWF4KTtcbiAgICAgICAgICAgICAgICAgICAgeE1pbnMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1bdGhpcy5jb25maWcudmFyaWFibGVYXS5taW4pO1xuICAgICAgICAgICAgICAgICAgICB5TWF4ZXMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1bdGhpcy5jb25maWcudmFyaWFibGVZXS5tYXgpO1xuICAgICAgICAgICAgICAgICAgICB5TWlucy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt0aGlzLmNvbmZpZy52YXJpYWJsZVldLm1pbik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnhNYXggPSBkMy5tYXgoeE1heGVzKTtcbiAgICAgICAgICAgIHRoaXMueE1pbiA9IGQzLm1pbih4TWlucyk7XG4gICAgICAgICAgICB0aGlzLnlNYXggPSBkMy5tYXgoeU1heGVzKTtcbiAgICAgICAgICAgIHRoaXMueU1pbiA9IGQzLm1pbih5TWlucyk7XG4gICAgICAgICAgICB0aGlzLnhWYWx1ZXNVbmlxdWUgPSBbXTtcblxuICAgICAgICAgICAgdmFyIHhSYW5nZSA9IFswLCB0aGlzLndpZHRoXSxcbiAgICAgICAgICAgICAgICB5UmFuZ2UgPSBbdGhpcy5oZWlnaHQsIDBdLFxuICAgICAgICAgICAgICAgIHhEb21haW4sXG4gICAgICAgICAgICAgICAgeURvbWFpbjtcbiAgICAgICAgICAgIGlmICggdGhpcy54U2NhbGVUeXBlID09PSAndGltZScpIHtcbiAgICAgICAgICAgICAgICB4RG9tYWluID0gW2QzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkodGhpcy54TWluKSwgZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKSh0aGlzLnhNYXgpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIFRPIERPOiBPVEhFUiBkYXRhIHR5cGVzID9cbiAgICAgICAgICAgICAgICB4RG9tYWluID0gW3RoaXMueE1pbiwgdGhpcy54TWF4XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICggdGhpcy55U2NhbGVUeXBlID09PSAndGltZScpIHtcbiAgICAgICAgICAgICAgICB5RG9tYWluID0gW2QzLnRpbWVQYXJzZSh0aGlzLnlUaW1lVHlwZSkodGhpcy55TWluKSwgZDMudGltZVBhcnNlKHRoaXMueVRpbWVUeXBlKSh0aGlzLnlNYXgpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIFRPIERPOiBPVEhFUiBkYXRhIHR5cGVzID9cbiAgICAgICAgICAgICAgICB5RG9tYWluID0gW3RoaXMueU1pbiwgdGhpcy55TWF4XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy54U2NhbGUgPSBkM1NjYWxlW3RoaXMueFNjYWxlVHlwZV0uZG9tYWluKHhEb21haW4pLnJhbmdlKHhSYW5nZSk7XG4gICAgICAgICAgICB0aGlzLnlTY2FsZSA9IGQzU2NhbGVbdGhpcy55U2NhbGVUeXBlXS5kb21haW4oeURvbWFpbikucmFuZ2UoeVJhbmdlKTtcblxuICAgICAgICB9LFxuICAgICAgICBhZGRMaW5lcygpe1xuICAgICAgICAgICAgdmFyIHplcm9WYWx1ZWxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAueChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnhWYWx1ZXNVbmlxdWUuaW5kZXhPZihkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pID09PSAtMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlLnB1c2goZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKTtcbiAgICAgICAgICAgICAgICB9KSBcbiAgICAgICAgICAgICAgICAueSgoKSA9PiB0aGlzLnlTY2FsZSgwKSk7XG5cbiAgICAgICAgICAgIHZhciB2YWx1ZWxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAueChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnhWYWx1ZXNVbmlxdWUuaW5kZXhPZihkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pID09PSAtMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlLnB1c2goZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKTtcbiAgICAgICAgICAgICAgICB9KSBcbiAgICAgICAgICAgICAgICAueSgoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHRoaXMsZCxpLGFycmF5KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueVNjYWxlKGRbdGhpcy5jb25maWcudmFyaWFibGVZXSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICggdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgJiYgdGhpcy5jb25maWcuc3RhY2tTZXJpZXMgPT09IHRydWUgKXtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgYXJlYSA9IGQzLmFyZWEoKVxuICAgICAgICAgICAgICAgICAgICAueChkID0+IHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZC5kYXRhW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKSlcbiAgICAgICAgICAgICAgICAgICAgLnkwKGQgPT4gdGhpcy55U2NhbGUoZFswXSkpXG4gICAgICAgICAgICAgICAgICAgIC55MShkID0+IHRoaXMueVNjYWxlKGRbMV0pKTtcblxuICAgICAgICAgICAgICAgIHZhciBsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgICAgIC54KGQgPT4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkLmRhdGFbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgICAgICAueShkID0+IHRoaXMueVNjYWxlKGRbMV0pKTtcblxuICAgICAgICAgICAgICAgIHZhciBzdGFja0dyb3VwID0gdGhpcy5zdmcuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3N0YWNrZWQtYXJlYScpO1xuICAgICAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgICAgIHN0YWNrR3JvdXAgICAgXG4gICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3N0YWNrZWQtYXJlYScpXG4gICAgICAgICAgICAgICAgICAgIC5kYXRhKHRoaXMuYXJlYURhdGEpXG4gICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsIChkLGkpID0+ICdhcmVhLWxpbmUgY29sb3ItJyArIGkpIC8vIFRPIERPIG5vdCBxdWl0ZSByaWdodCB0aGF0IGNvbG9yIHNob2xkIGJlIGBpYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHlvdSBoYXZlIG1vcmUgdGhhbiBvbmUgZ3JvdXAgb2Ygc2VyaWVzLCB3aWxsIHJlcGVhdFxuICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGQgPT4gYXJlYShkKSk7XG5cbiAgICAgICAgICAgICAgICBzdGFja0dyb3VwXG4gICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3N0YWNrZWQtbGluZScpXG4gICAgICAgICAgICAgICAgICAgIC5kYXRhKHRoaXMuYXJlYURhdGEpXG4gICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsIChkLGkpID0+ICdsaW5lIGNvbG9yLScgKyBpKSBcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCBkID0+IGxpbmUoZCkpO1xuXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubGluZXMgPSB0aGlzLmVhY2hTZXJpZXMuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywnbGluZScpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB6ZXJvVmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLnRyYW5zaXRpb24oKS5kdXJhdGlvbig1MDApLmRlbGF5KDE1MClcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCAoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5vbignZW5kJywgKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpID09PSBhcnJheS5sZW5ndGggLSAxICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2codGhpcyxkLGksYXJyYXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkUG9pbnRzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRMYWJlbHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGFkZFhBeGlzKCl7IC8vIGNvdWxkIGJlIGluIENoYXJ0IHByb3RvdHlwZSA/XG4gICAgICAgICAgICB2YXIgeUF4aXNQb3NpdGlvbixcbiAgICAgICAgICAgICAgICB5QXhpc09mZnNldCxcbiAgICAgICAgICAgICAgICBheGlzVHlwZTtcblxuICAgICAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy55QXhpc1Bvc2l0aW9uID09PSAnemVybycgKXtcbiAgICAgICAgICAgICAgICB5QXhpc1Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgICAgICB5QXhpc09mZnNldCA9IDA7XG4gICAgICAgICAgICAgICAgYXhpc1R5cGUgPSBkMy5heGlzQm90dG9tO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoIHRoaXMuY29uZmlnLnlBeGlzUG9zaXRpb24gPT09ICd0b3AnICl7XG4gICAgICAgICAgICAgICAgeUF4aXNQb3NpdGlvbiA9IHRoaXMueU1heDtcbiAgICAgICAgICAgICAgICB5QXhpc09mZnNldCA9IC10aGlzLm1hcmdpblRvcDtcbiAgICAgICAgICAgICAgICBheGlzVHlwZSA9IGQzLmF4aXNUb3A7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHlBeGlzUG9zaXRpb24gPSB0aGlzLnlNaW47XG4gICAgICAgICAgICAgICAgeUF4aXNPZmZzZXQgPSAwO1xuICAgICAgICAgICAgICAgIGF4aXNUeXBlID0gZDMuYXhpc0JvdHRvbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBheGlzID0gYXhpc1R5cGUodGhpcy54U2NhbGUpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKTtcbiAgICAgICAgICAgIGlmICggdGhpcy54U2NhbGVUeXBlID09PSAndGltZScgKXtcbiAgICAgICAgICAgICAgICBheGlzLnRpY2tWYWx1ZXModGhpcy54VmFsdWVzVW5pcXVlLm1hcChlYWNoID0+IGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZWFjaCkpKTsgLy8gVE8gRE86IGFsbG93IGZvciBvdGhlciB4QXhpcyBBZGp1c3RtZW50c1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy54QXhpc0dyb3VwXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoMCwnICsgKCB0aGlzLnlTY2FsZSh5QXhpc1Bvc2l0aW9uKSArIHlBeGlzT2Zmc2V0ICkgKyAnKScpIC8vIG5vdCBwcm9ncmFtYXRpYyBwbGFjZW1lbnQgb2YgeC1heGlzXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2F4aXMgeC1heGlzJylcbiAgICAgICAgICAgICAgICAuY2FsbChheGlzKTtcbiAgICAgICAgfSxcbiAgICAgICAgYWRkWUF4aXMoKXtcbiAgICAgICAgICAgIC8qIGF4aXMgKi9cbiAgICAgICAgICAgIHRoaXMueUF4aXNHcm91cFxuICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiAnYXhpcyB5LWF4aXMgJylcbiAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQodGhpcy55U2NhbGUpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrcyg1KSk7XG5cbiAgICAgICAgICAgIC8qIGxhYmVscyAqL1xuICAgICAgICAgICAgdGhpcy5lYWNoU2VyaWVzLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICd1bml0cycpXG4gICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoKSA9PiBgdHJhbnNsYXRlKC0ke3RoaXMubWFyZ2luTGVmdH0sLSR7dGhpcy5tYXJnaW5Ub3AgLSAxMH0pYClcbiAgICAgICAgICAgICAgLnRleHQoKGQsaSkgPT4gaSA9PT0gMCA/IHRoaXMucGFyZW50LnVuaXRzKGQua2V5KSA6IG51bGwpO1xuICAgICAgICAgICAgXG4gICAgICAgIH0sXG4gICAgICAgIGFkZExhYmVscygpe1xuICAgICAgICAgICAgdGhpcy5lYWNoU2VyaWVzLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3Nlcmllcy1sYWJlbCcpXG4gICAgICAgICAgICAgICAgLmh0bWwoKGQpID0+ICc8dHNwYW4geD1cIjBcIj4nICsgdGhpcy5wYXJlbnQubGFiZWwoZC5rZXkpLnJlcGxhY2UoL1xcXFxuL2csJzwvdHNwYW4+PHRzcGFuIHg9XCIwXCIgZHk9XCIxLjJlbVwiPicpICsgJzwvdHNwYW4+JylcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKGQpID0+IGB0cmFuc2xhdGUoJHt0aGlzLndpZHRoICsgNX0sICR7dGhpcy55U2NhbGUoZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdGhpcy5jb25maWcudmFyaWFibGVZXSkgKyAzfSlgKTtcbiAgICAgICAgfSxcbiAgICAgICAgYWRkUG9pbnRzKCl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMucG9pbnRzID0gdGhpcy5lYWNoU2VyaWVzLnNlbGVjdEFsbCgncG9pbnRzJylcbiAgICAgICAgICAgICAgICAuZGF0YShkID0+IGQudmFsdWVzKVxuICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnY2lyY2xlJylcbiAgICAgICAgICAgICAgICAuYXR0cignb3BhY2l0eScsIDApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2RhdGEtcG9pbnQnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdyJywgJzQnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjeCcsIGQgPT4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKSlcbiAgICAgICAgICAgICAgICAuYXR0cignY3knLCBkID0+IHRoaXMueVNjYWxlKGRbdGhpcy5jb25maWcudmFyaWFibGVZXSkpXG4gICAgICAgICAgICAgICAgLm9uKCdtb3VzZW92ZXInLCAoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQpO1xuICAgICAgICAgICAgICAgICAgICB2YXIga2xhc3MgPSBhcnJheVtpXS5wYXJlbnROb2RlLmNsYXNzTGlzdC52YWx1ZS5tYXRjaCgvY29sb3ItXFxkLylbMF07IC8vIGdldCB0aGUgY29sb3IgY2xhc3Mgb2YgdGhlIHBhcmVudCBnXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycsIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycpICsgJyAnICsga2xhc3MpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuaHRtbCgnPHN0cm9uZz4nICsgdGhpcy5wYXJlbnQudGlwVGV4dChkLnNlcmllcykgKyAnPC9zdHJvbmc+ICgnICsgZC55ZWFyICsgJyk8YnIgLz4nICsgZFt0aGlzLmNvbmZpZy52YXJpYWJsZVldICsgJyAnICsgdGhpcy5wYXJlbnQudW5pdHMoZC5zZXJpZXMpICk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5zaG93KCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAub24oJ21vdXNlb3V0JywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuYXR0cignY2xhc3MnLCB0aGlzLnRvb2x0aXAuYXR0cignY2xhc3MnKS5yZXBsYWNlKC8gY29sb3ItXFxkL2csICcnKSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5odG1sKCcnKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmhpZGUoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5jYWxsKHRoaXMudG9vbHRpcClcbiAgICAgICAgICAgICAgICAudHJhbnNpdGlvbigpLmR1cmF0aW9uKDUwMClcbiAgICAgICAgICAgICAgICAuYXR0cignb3BhY2l0eScsIDEpO1xuXG4gICAgICAgICAgICBcbiAgICAgICAgfSxcbiAgICAgICAgc2V0VG9vbHRpcHMoKXtcblxuICAgICAgICAgICAgdGhpcy50b29sdGlwID0gZDMudGlwKClcbiAgICAgICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwiZDMtdGlwXCIpXG4gICAgICAgICAgICAgICAgLmRpcmVjdGlvbignbicpXG4gICAgICAgICAgICAgICAgLm9mZnNldChbLTgsIDBdKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgfVxuICAgIH07XG5cblxuICAgIHJldHVybiB7XG4gICAgICAgIENoYXJ0RGl2XG4gICAgfTtcblxufSkoKTtcbiIsImV4cG9ydCBjb25zdCBIZWxwZXJzID0gKGZ1bmN0aW9uKCl7XG4gICAgLyogZ2xvYmFscyBET01TdHJpbmdNYXAgKi9cbiAgICBTdHJpbmcucHJvdG90eXBlLmNsZWFuU3RyaW5nID0gZnVuY3Rpb24oKSB7IC8vIGxvd2VyY2FzZSBhbmQgcmVtb3ZlIHB1bmN0dWF0aW9uIGFuZCByZXBsYWNlIHNwYWNlcyB3aXRoIGh5cGhlbnM7IGRlbGV0ZSBwdW5jdHVhdGlvblxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9bIFxcXFxcXC9dL2csJy0nKS5yZXBsYWNlKC9bJ1wi4oCd4oCZ4oCc4oCYLFxcLiFcXD87XFwoXFwpJl0vZywnJykudG9Mb3dlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgU3RyaW5nLnByb3RvdHlwZS5yZW1vdmVVbmRlcnNjb3JlcyA9IGZ1bmN0aW9uKCkgeyBcbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvXy9nLCcgJyk7XG4gICAgfTtcblxuICAgIERPTVN0cmluZ01hcC5wcm90b3R5cGUuY29udmVydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbmV3T2JqID0ge307XG4gICAgICAgIGZvciAoIHZhciBrZXkgaW4gdGhpcyApe1xuICAgICAgICAgICAgaWYgKHRoaXMuaGFzT3duUHJvcGVydHkoa2V5KSl7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbmV3T2JqW2tleV0gPSBKU09OLnBhcnNlKHRoaXNba2V5XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgICAgICBuZXdPYmpba2V5XSA9IHRoaXNba2V5XTsgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld09iajtcbiAgICB9O1xufSkoKTtcbiIsIi8vIGQzLnRpcFxuLy8gQ29weXJpZ2h0IChjKSAyMDEzIEp1c3RpbiBQYWxtZXJcbi8vIEVTNiAvIEQzIHY0IEFkYXB0aW9uIENvcHlyaWdodCAoYykgMjAxNiBDb25zdGFudGluIEdhdnJpbGV0ZVxuLy8gUmVtb3ZhbCBvZiBFUzYgZm9yIEQzIHY0IEFkYXB0aW9uIENvcHlyaWdodCAoYykgMjAxNiBEYXZpZCBHb3R6XG4vL1xuLy8gVG9vbHRpcHMgZm9yIGQzLmpzIFNWRyB2aXN1YWxpemF0aW9uc1xuXG5leHBvcnQgY29uc3QgZDNUaXAgPSAoZnVuY3Rpb24oKXtcbiAgZDMuZnVuY3RvciA9IGZ1bmN0aW9uIGZ1bmN0b3Iodikge1xuICAgIHJldHVybiB0eXBlb2YgdiA9PT0gXCJmdW5jdGlvblwiID8gdiA6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHY7XG4gICAgfTtcbiAgfTtcblxuICBkMy50aXAgPSBmdW5jdGlvbigpIHtcblxuICAgIHZhciBkaXJlY3Rpb24gPSBkM190aXBfZGlyZWN0aW9uLFxuICAgICAgICBvZmZzZXQgICAgPSBkM190aXBfb2Zmc2V0LFxuICAgICAgICBodG1sICAgICAgPSBkM190aXBfaHRtbCxcbiAgICAgICAgbm9kZSAgICAgID0gaW5pdE5vZGUoKSxcbiAgICAgICAgc3ZnICAgICAgID0gbnVsbCxcbiAgICAgICAgcG9pbnQgICAgID0gbnVsbCxcbiAgICAgICAgdGFyZ2V0ICAgID0gbnVsbFxuXG4gICAgZnVuY3Rpb24gdGlwKHZpcykge1xuICAgICAgc3ZnID0gZ2V0U1ZHTm9kZSh2aXMpXG4gICAgICBwb2ludCA9IHN2Zy5jcmVhdGVTVkdQb2ludCgpXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG5vZGUpXG4gICAgfVxuXG4gICAgLy8gUHVibGljIC0gc2hvdyB0aGUgdG9vbHRpcCBvbiB0aGUgc2NyZWVuXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGEgdGlwXG4gICAgdGlwLnNob3cgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxuICAgICAgaWYoYXJnc1thcmdzLmxlbmd0aCAtIDFdIGluc3RhbmNlb2YgU1ZHRWxlbWVudCkgdGFyZ2V0ID0gYXJncy5wb3AoKVxuXG4gICAgICB2YXIgY29udGVudCA9IGh0bWwuYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgcG9mZnNldCA9IG9mZnNldC5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBkaXIgICAgID0gZGlyZWN0aW9uLmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIG5vZGVsICAgPSBnZXROb2RlRWwoKSxcbiAgICAgICAgICBpICAgICAgID0gZGlyZWN0aW9ucy5sZW5ndGgsXG4gICAgICAgICAgY29vcmRzLFxuICAgICAgICAgIHNjcm9sbFRvcCAgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wIHx8IGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wLFxuICAgICAgICAgIHNjcm9sbExlZnQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdCB8fCBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnRcblxuICAgICAgbm9kZWwuaHRtbChjb250ZW50KVxuICAgICAgICAuc3R5bGUoJ3Bvc2l0aW9uJywgJ2Fic29sdXRlJylcbiAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywgMSlcbiAgICAgICAgLnN0eWxlKCdwb2ludGVyLWV2ZW50cycsICdhbGwnKVxuXG4gICAgICB3aGlsZShpLS0pIG5vZGVsLmNsYXNzZWQoZGlyZWN0aW9uc1tpXSwgZmFsc2UpXG4gICAgICBjb29yZHMgPSBkaXJlY3Rpb25fY2FsbGJhY2tzW2Rpcl0uYXBwbHkodGhpcylcbiAgICAgIG5vZGVsLmNsYXNzZWQoZGlyLCB0cnVlKVxuICAgICAgICAuc3R5bGUoJ3RvcCcsIChjb29yZHMudG9wICsgIHBvZmZzZXRbMF0pICsgc2Nyb2xsVG9wICsgJ3B4JylcbiAgICAgICAgLnN0eWxlKCdsZWZ0JywgKGNvb3Jkcy5sZWZ0ICsgcG9mZnNldFsxXSkgKyBzY3JvbGxMZWZ0ICsgJ3B4JylcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYyAtIGhpZGUgdGhlIHRvb2x0aXBcbiAgICAvL1xuICAgIC8vIFJldHVybnMgYSB0aXBcbiAgICB0aXAuaGlkZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG5vZGVsID0gZ2V0Tm9kZUVsKClcbiAgICAgIG5vZGVsXG4gICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDApXG4gICAgICAgIC5zdHlsZSgncG9pbnRlci1ldmVudHMnLCAnbm9uZScpXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBQcm94eSBhdHRyIGNhbGxzIHRvIHRoZSBkMyB0aXAgY29udGFpbmVyLiAgU2V0cyBvciBnZXRzIGF0dHJpYnV0ZSB2YWx1ZS5cbiAgICAvL1xuICAgIC8vIG4gLSBuYW1lIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAvLyB2IC0gdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3IgYXR0cmlidXRlIHZhbHVlXG4gICAgdGlwLmF0dHIgPSBmdW5jdGlvbihuLCB2KSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIgJiYgdHlwZW9mIG4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBnZXROb2RlRWwoKS5hdHRyKG4pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgYXJncyA9ICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgICAgIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUuYXR0ci5hcHBseShnZXROb2RlRWwoKSwgYXJncylcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogUHJveHkgc3R5bGUgY2FsbHMgdG8gdGhlIGQzIHRpcCBjb250YWluZXIuICBTZXRzIG9yIGdldHMgYSBzdHlsZSB2YWx1ZS5cbiAgICAvL1xuICAgIC8vIG4gLSBuYW1lIG9mIHRoZSBwcm9wZXJ0eVxuICAgIC8vIHYgLSB2YWx1ZSBvZiB0aGUgcHJvcGVydHlcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIHN0eWxlIHByb3BlcnR5IHZhbHVlXG4gICAgdGlwLnN0eWxlID0gZnVuY3Rpb24obiwgdikge1xuICAgICAgLy8gZGVidWdnZXI7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIgJiYgdHlwZW9mIG4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBnZXROb2RlRWwoKS5zdHlsZShuKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICBpZiAoYXJncy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICB2YXIgc3R5bGVzID0gYXJnc1swXTtcbiAgICAgICAgICBPYmplY3Qua2V5cyhzdHlsZXMpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5zdHlsZS5hcHBseShnZXROb2RlRWwoKSwgW2tleSwgc3R5bGVzW2tleV1dKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBTZXQgb3IgZ2V0IHRoZSBkaXJlY3Rpb24gb2YgdGhlIHRvb2x0aXBcbiAgICAvL1xuICAgIC8vIHYgLSBPbmUgb2Ygbihub3J0aCksIHMoc291dGgpLCBlKGVhc3QpLCBvciB3KHdlc3QpLCBudyhub3J0aHdlc3QpLFxuICAgIC8vICAgICBzdyhzb3V0aHdlc3QpLCBuZShub3J0aGVhc3QpIG9yIHNlKHNvdXRoZWFzdClcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIGRpcmVjdGlvblxuICAgIHRpcC5kaXJlY3Rpb24gPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkaXJlY3Rpb25cbiAgICAgIGRpcmVjdGlvbiA9IHYgPT0gbnVsbCA/IHYgOiBkMy5mdW5jdG9yKHYpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFNldHMgb3IgZ2V0cyB0aGUgb2Zmc2V0IG9mIHRoZSB0aXBcbiAgICAvL1xuICAgIC8vIHYgLSBBcnJheSBvZiBbeCwgeV0gb2Zmc2V0XG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIG9mZnNldCBvclxuICAgIHRpcC5vZmZzZXQgPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBvZmZzZXRcbiAgICAgIG9mZnNldCA9IHYgPT0gbnVsbCA/IHYgOiBkMy5mdW5jdG9yKHYpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IHNldHMgb3IgZ2V0cyB0aGUgaHRtbCB2YWx1ZSBvZiB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIFN0cmluZyB2YWx1ZSBvZiB0aGUgdGlwXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGh0bWwgdmFsdWUgb3IgdGlwXG4gICAgdGlwLmh0bWwgPSBmdW5jdGlvbih2KSB7XG4gICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBodG1sXG4gICAgICBodG1sID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogZGVzdHJveXMgdGhlIHRvb2x0aXAgYW5kIHJlbW92ZXMgaXQgZnJvbSB0aGUgRE9NXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGEgdGlwXG4gICAgdGlwLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmKG5vZGUpIHtcbiAgICAgICAgZ2V0Tm9kZUVsKCkucmVtb3ZlKCk7XG4gICAgICAgIG5vZGUgPSBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRpcDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkM190aXBfZGlyZWN0aW9uKCkgeyByZXR1cm4gJ24nIH1cbiAgICBmdW5jdGlvbiBkM190aXBfb2Zmc2V0KCkgeyByZXR1cm4gWzAsIDBdIH1cbiAgICBmdW5jdGlvbiBkM190aXBfaHRtbCgpIHsgcmV0dXJuICcgJyB9XG5cbiAgICB2YXIgZGlyZWN0aW9uX2NhbGxiYWNrcyA9IHtcbiAgICAgIG46ICBkaXJlY3Rpb25fbixcbiAgICAgIHM6ICBkaXJlY3Rpb25fcyxcbiAgICAgIGU6ICBkaXJlY3Rpb25fZSxcbiAgICAgIHc6ICBkaXJlY3Rpb25fdyxcbiAgICAgIG53OiBkaXJlY3Rpb25fbncsXG4gICAgICBuZTogZGlyZWN0aW9uX25lLFxuICAgICAgc3c6IGRpcmVjdGlvbl9zdyxcbiAgICAgIHNlOiBkaXJlY3Rpb25fc2VcbiAgICB9O1xuXG4gICAgdmFyIGRpcmVjdGlvbnMgPSBPYmplY3Qua2V5cyhkaXJlY3Rpb25fY2FsbGJhY2tzKTtcblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9uKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubi55IC0gbm9kZS5vZmZzZXRIZWlnaHQsXG4gICAgICAgIGxlZnQ6IGJib3gubi54IC0gbm9kZS5vZmZzZXRXaWR0aCAvIDJcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fcygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LnMueSxcbiAgICAgICAgbGVmdDogYmJveC5zLnggLSBub2RlLm9mZnNldFdpZHRoIC8gMlxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9lKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guZS55IC0gbm9kZS5vZmZzZXRIZWlnaHQgLyAyLFxuICAgICAgICBsZWZ0OiBiYm94LmUueFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl93KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gudy55IC0gbm9kZS5vZmZzZXRIZWlnaHQgLyAyLFxuICAgICAgICBsZWZ0OiBiYm94LncueCAtIG5vZGUub2Zmc2V0V2lkdGhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fbncoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5udy55IC0gbm9kZS5vZmZzZXRIZWlnaHQsXG4gICAgICAgIGxlZnQ6IGJib3gubncueCAtIG5vZGUub2Zmc2V0V2lkdGhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fbmUoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5uZS55IC0gbm9kZS5vZmZzZXRIZWlnaHQsXG4gICAgICAgIGxlZnQ6IGJib3gubmUueFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9zdygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LnN3LnksXG4gICAgICAgIGxlZnQ6IGJib3guc3cueCAtIG5vZGUub2Zmc2V0V2lkdGhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fc2UoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zZS55LFxuICAgICAgICBsZWZ0OiBiYm94LmUueFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGluaXROb2RlKCkge1xuICAgICAgdmFyIG5vZGUgPSBkMy5zZWxlY3QoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpXG4gICAgICBub2RlXG4gICAgICAgIC5zdHlsZSgncG9zaXRpb24nLCAnYWJzb2x1dGUnKVxuICAgICAgICAuc3R5bGUoJ3RvcCcsIDApXG4gICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDApXG4gICAgICAgIC5zdHlsZSgncG9pbnRlci1ldmVudHMnLCAnbm9uZScpXG4gICAgICAgIC5zdHlsZSgnYm94LXNpemluZycsICdib3JkZXItYm94JylcblxuICAgICAgcmV0dXJuIG5vZGUubm9kZSgpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0U1ZHTm9kZShlbCkge1xuICAgICAgZWwgPSBlbC5ub2RlKClcbiAgICAgIGlmKGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ3N2ZycpXG4gICAgICAgIHJldHVybiBlbFxuXG4gICAgICByZXR1cm4gZWwub3duZXJTVkdFbGVtZW50XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0Tm9kZUVsKCkge1xuICAgICAgaWYobm9kZSA9PT0gbnVsbCkge1xuICAgICAgICBub2RlID0gaW5pdE5vZGUoKTtcbiAgICAgICAgLy8gcmUtYWRkIG5vZGUgdG8gRE9NXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm9kZSk7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIGQzLnNlbGVjdChub2RlKTtcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlIC0gZ2V0cyB0aGUgc2NyZWVuIGNvb3JkaW5hdGVzIG9mIGEgc2hhcGVcbiAgICAvL1xuICAgIC8vIEdpdmVuIGEgc2hhcGUgb24gdGhlIHNjcmVlbiwgd2lsbCByZXR1cm4gYW4gU1ZHUG9pbnQgZm9yIHRoZSBkaXJlY3Rpb25zXG4gICAgLy8gbihub3J0aCksIHMoc291dGgpLCBlKGVhc3QpLCB3KHdlc3QpLCBuZShub3J0aGVhc3QpLCBzZShzb3V0aGVhc3QpLCBudyhub3J0aHdlc3QpLFxuICAgIC8vIHN3KHNvdXRod2VzdCkuXG4gICAgLy9cbiAgICAvLyAgICArLSstK1xuICAgIC8vICAgIHwgICB8XG4gICAgLy8gICAgKyAgICtcbiAgICAvLyAgICB8ICAgfFxuICAgIC8vICAgICstKy0rXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGFuIE9iamVjdCB7biwgcywgZSwgdywgbncsIHN3LCBuZSwgc2V9XG4gICAgZnVuY3Rpb24gZ2V0U2NyZWVuQkJveCgpIHtcbiAgICAgIHZhciB0YXJnZXRlbCAgID0gdGFyZ2V0IHx8IGQzLmV2ZW50LnRhcmdldDtcblxuICAgICAgd2hpbGUgKCd1bmRlZmluZWQnID09PSB0eXBlb2YgdGFyZ2V0ZWwuZ2V0U2NyZWVuQ1RNICYmICd1bmRlZmluZWQnID09PSB0YXJnZXRlbC5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgdGFyZ2V0ZWwgPSB0YXJnZXRlbC5wYXJlbnROb2RlO1xuICAgICAgfVxuXG4gICAgICB2YXIgYmJveCAgICAgICA9IHt9LFxuICAgICAgICAgIG1hdHJpeCAgICAgPSB0YXJnZXRlbC5nZXRTY3JlZW5DVE0oKSxcbiAgICAgICAgICB0YmJveCAgICAgID0gdGFyZ2V0ZWwuZ2V0QkJveCgpLFxuICAgICAgICAgIHdpZHRoICAgICAgPSB0YmJveC53aWR0aCxcbiAgICAgICAgICBoZWlnaHQgICAgID0gdGJib3guaGVpZ2h0LFxuICAgICAgICAgIHggICAgICAgICAgPSB0YmJveC54LFxuICAgICAgICAgIHkgICAgICAgICAgPSB0YmJveC55XG5cbiAgICAgIHBvaW50LnggPSB4XG4gICAgICBwb2ludC55ID0geVxuICAgICAgYmJveC5udyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54ICs9IHdpZHRoXG4gICAgICBiYm94Lm5lID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnkgKz0gaGVpZ2h0XG4gICAgICBiYm94LnNlID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggLT0gd2lkdGhcbiAgICAgIGJib3guc3cgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSAtPSBoZWlnaHQgLyAyXG4gICAgICBiYm94LncgID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggKz0gd2lkdGhcbiAgICAgIGJib3guZSA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54IC09IHdpZHRoIC8gMlxuICAgICAgcG9pbnQueSAtPSBoZWlnaHQgLyAyXG4gICAgICBiYm94Lm4gPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSArPSBoZWlnaHRcbiAgICAgIGJib3gucyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG5cbiAgICAgIHJldHVybiBiYm94XG4gICAgfVxuXG4gICAgcmV0dXJuIHRpcFxuICB9O1xufSkoKTsiXX0=
