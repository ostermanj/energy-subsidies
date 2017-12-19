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
        this.addPoints();
        this.addXAxis();
        this.addYAxis();
        if (this.config.directLabel === true) {
            this.addLabels();
        } else {
            // this.addLegends();
        }
        this.setTooltips();
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

            this.lines = this.eachSeries.append('path').attr('class', 'line').attr('d', function (d) {
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
                return 'translate(' + (_this10.width + 5) + ', ' + (_this10.yScale(d.values[d.values.length - 1][_this10.config.variableY]) + 3) + ')';
            });
        },
        addPoints: function addPoints() {
            var _this11 = this;

            this.points = this.eachSeries.selectAll('points').data(function (d) {
                return d.values;
            }).enter().append('circle').attr('class', 'data-point').attr('r', '4').attr('cx', function (d) {
                return _this11.xScale(d3.timeParse(_this11.xTimeType)(d[_this11.config.variableX]));
            }).attr('cy', function (d) {
                return _this11.yScale(d[_this11.config.variableY]);
            });
        },
        setTooltips: function setTooltips() {
            this.tooltip = d3.tip().attr("class", "d3-tip").direction('n').offset([-8, 0]).html(function () {
                return 'hello';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9DaGFydHMuanMiLCJqcy1leHBvcnRzL0hlbHBlcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0lBOztBQUNBOztBQUxDLGdDLENBQWlDO0FBQ2pDOztBQU1ELElBQUksV0FBWSxZQUFVOztBQUUxQjs7QUFFSSxRQUFJLGtCQUFrQixFQUF0QjtBQUNBLFFBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxTQUFULEVBQW9CLEtBQXBCLEVBQTBCO0FBQUE7O0FBQ3pDLGdCQUFRLEdBQVIsQ0FBWSxLQUFaO0FBQ0EsYUFBSyxTQUFMLEdBQWlCLFNBQWpCO0FBQ0EsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssTUFBTCxHQUFjLFVBQVUsT0FBVixDQUFrQixPQUFsQixFQUFkO0FBQ0EsZ0JBQVEsR0FBUixDQUFZLEtBQUssTUFBTCxDQUFZLE1BQVosQ0FBbUIsUUFBbkIsRUFBWjtBQUNBLGFBQUssWUFBTCxHQUFvQixLQUFLLGtCQUFMLENBQXdCLFNBQXhCLENBQXBCO0FBQ0EsYUFBSyxRQUFMLEdBQWdCLEVBQWhCO0FBQ0EsZ0JBQVEsR0FBUixDQUFZLEtBQUssWUFBakI7QUFDQTtBQUNBLGFBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixZQUFNO0FBQ3pCLGtCQUFLLGdCQUFMLENBQXNCLFNBQXRCO0FBQ0gsU0FGRDtBQUdILEtBYkQ7QUFjQTtBQUNBLGlCQUFhLFNBQWIsR0FBeUI7QUFFakIsMEJBRmlCLGdDQUVHO0FBQUE7O0FBQ2hCLGdCQUFJLGVBQWUsRUFBbkI7QUFDQSxnQkFBSSxVQUFVLEtBQUssTUFBTCxDQUFZLE9BQTFCO0FBQUEsZ0JBQ0ksT0FBTyxDQUFDLEtBQUssTUFBTCxDQUFZLE9BQWIsRUFBcUIsS0FBSyxNQUFMLENBQVksYUFBakMsQ0FEWCxDQUZnQixDQUc0QztBQUN4QjtBQUNwQyxp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YyxLQUFLLEtBQUwsQ0FBVyxLQUFLLEdBQUwsQ0FBWCxDQUFkO0FBQ0gsaUJBRkQsQ0FHQSxPQUFNLEdBQU4sRUFBVztBQUNQLDJCQUFPLEdBQVAsSUFBYyxLQUFLLEdBQUwsQ0FBZDtBQUNIO0FBQ0o7QUFDSjtBQUNELGVBQU8sTUFBUDtBQUNILEtBYkQ7QUFjSCxDQXhCc0IsRUFBaEIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiIC8qIGV4cG9ydGVkIEQzQ2hhcnRzLCBIZWxwZXJzICovIC8vIGxldCdzIGpzaGludCBrbm93IHRoYXQgRDNDaGFydHMgY2FuIGJlIFwiZGVmaW5lZCBidXQgbm90IHVzZWRcIiBpbiB0aGlzIGZpbGVcbiAvKiBwb2x5ZmlsbHMgbmVlZGVkOiBQcm9taXNlLCBBcnJheS5pc0FycmF5LCBBcnJheS5maW5kLCBBcnJheS5maWx0ZXJcblxuICovXG5pbXBvcnQgeyBIZWxwZXJzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9IZWxwZXJzJztcbmltcG9ydCB7IENoYXJ0cyB9IGZyb20gJy4uL2pzLWV4cG9ydHMvQ2hhcnRzJztcblxudmFyIEQzQ2hhcnRzID0gKGZ1bmN0aW9uKCl7XG5cblwidXNlIHN0cmljdFwiOyBcbiAgICBcbiAgICB2YXIgZ3JvdXBDb2xsZWN0aW9uID0gW107XG4gICAgdmFyIEQzQ2hhcnRHcm91cCA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgaW5kZXgpe1xuICAgICAgICBjb25zb2xlLmxvZyhpbmRleCk7XG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgICAgICB0aGlzLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIHRoaXMuY29uZmlnID0gY29udGFpbmVyLmRhdGFzZXQuY29udmVydCgpO1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmNvbmZpZy5uZXN0QnkudG9TdHJpbmcoKSk7XG4gICAgICAgIHRoaXMuZGF0YVByb21pc2VzID0gdGhpcy5yZXR1cm5EYXRhUHJvbWlzZXMoY29udGFpbmVyKTtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmRhdGFQcm9taXNlcyk7XG4gICAgICAgIC8vdGhpcy5jb250cm9sbGVyLmluaXRDb250cm9sbGVyKGNvbnRhaW5lciwgdGhpcy5tb2RlbCwgdGhpcy52aWV3KTtcbiAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMudGhlbigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmluaXRpYWxpemVDaGFydHMoY29udGFpbmVyKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICAvL3Byb3RvdHlwZSBiZWdpbnMgaGVyZVxuICAgIEQzQ2hhcnRHcm91cC5wcm90b3R5cGUgPSB7XG4gICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuRGF0YVByb21pc2VzKCl7IFxuICAgICAgICAgICAgICAgIHZhciBkYXRhUHJvbWlzZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgc2hlZXRJRCA9IHRoaXMuY29uZmlnLnNoZWV0SWQsIFxuICAgICAgICAgICAgICAgICAgICB0YWJzID0gW3RoaXMuY29uZmlnLmRhdGFUYWIsdGhpcy5jb25maWcuZGljdGlvbmFyeVRhYl07IC8vIHRoaXMgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaXMgdGhlcmUgYSBjYXNlIGZvciBtb3JlIHRoYW4gb25lIHNoZWV0IG9mIGRhdGE/XG4gICAgICAgICAgICAgICAgdGFicy5mb3JFYWNoKChlYWNoLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5qc29uKCdodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJyArIHNoZWV0SUQgKyAnL3ZhbHVlcy8nICsgZWFjaCArICc/a2V5PUFJemFTeUREM1c1d0plSkYyZXNmZlpNUXhOdEVsOXR0LU9mZ1NxNCcsIChlcnJvcixkYXRhKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlcyA9IGRhdGEudmFsdWVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXN0VHlwZSA9IGVhY2ggPT09ICdkaWN0aW9uYXJ5JyA/ICdvYmplY3QnIDogJ3Nlcmllcyc7IC8vIG5lc3RUeXBlIGZvciBkYXRhIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXN0QnkgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyBmYWxzZSA6IHRoaXMuY29uZmlnLm5lc3RCeTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMucmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbmVzdEJ5LCB0cnVlLCBuZXN0VHlwZSwgaSkpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgUHJvbWlzZS5hbGwoZGF0YVByb21pc2VzKS50aGVuKHZhbHVlcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YSA9IHZhbHVlc1swXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kaWN0aW9uYXJ5ID0gdmFsdWVzWzFdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN1bW1hcmllcyA9IHRoaXMuc3VtbWFyaXplRGF0YSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChkYXRhUHJvbWlzZXMpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN1bW1hcml6ZURhdGEoKXsgLy8gdGhpcyBmbiBjcmVhdGVzIGFuIGFycmF5IG9mIG9iamVjdHMgc3VtbWFyaXppbmcgdGhlIGRhdGEgaW4gbW9kZWwuZGF0YS4gbW9kZWwuZGF0YSBpcyBuZXN0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIG5lc3RpbmcgYW5kIHJvbGxpbmcgdXAgY2Fubm90IGJlIGRvbmUgZWFzaWx5IGF0IHRoZSBzYW1lIHRpbWUsIHNvIHRoZXkncmUgZG9uZSBzZXBhcmF0ZWx5LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgc3VtbWFyaWVzIHByb3ZpZGUgYXZlcmFnZSwgbWF4LCBtaW4gb2YgYWxsIGZpZWxkcyBpbiB0aGUgZGF0YSBhdCBhbGwgbGV2ZWxzIG9mIG5lc3RpbmcuIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgZmlyc3QgKGluZGV4IDApIGlzIG9uZSBsYXllciBuZXN0ZWQsIHRoZSBzZWNvbmQgaXMgdHdvLCBhbmQgc28gb24uXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHN1bW1hcmllcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciB2YXJpYWJsZXMgPSBPYmplY3Qua2V5cyh0aGlzLnVubmVzdGVkWzBdKTsgLy8gYWxsIG5lZWQgdG8gaGF2ZSB0aGUgc2FtZSBmaWVsZHNcbiAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5ID0gdGhpcy5jb25maWcubmVzdEJ5ID8gdGhpcy5jb25maWcubmVzdEJ5Lm1hcChlYWNoID0+IGVhY2gpIDogZmFsc2U7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVzZXMgbWFwIHRvIGNyZWF0ZSBuZXcgYXJyYXkgcmF0aGVyIHRoYW4gYXNzaWduaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYnkgcmVmZXJlbmNlLiB0aGUgYHBvcCgpYCBiZWxvdyB3b3VsZCBhZmZlY3Qgb3JpZ2luYWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhcnJheSBpZiBkb25lIGJ5IHJlZmVyZW5jZVxuICAgICAgICAgICAgICAgIHZhciBuZXN0QnlBcnJheSA9IEFycmF5LmlzQXJyYXkobmVzdEJ5KSA/IG5lc3RCeSA6IFtuZXN0QnldO1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHJlZHVjZVZhcmlhYmxlcyhkKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhcmlhYmxlcy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjW2N1cl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4OiAgICAgICBkMy5tYXgoZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbjogICAgICAgZDMubWluKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZWFuOiAgICAgIGQzLm1lYW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1bTogICAgICAgZDMuc3VtKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZWRpYW46ICAgIGQzLm1lZGlhbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFuY2U6ICBkMy52YXJpYW5jZShkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWF0aW9uOiBkMy5kZXZpYXRpb24oZCwgZCA9PiBkW2N1cl0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgICAgICAgICAgICAgfSx7fSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHdoaWxlICggbmVzdEJ5QXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgc3VtbWFyaXplZCA9IHRoaXMubmVzdFByZWxpbShuZXN0QnlBcnJheSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yb2xsdXAocmVkdWNlVmFyaWFibGVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh0aGlzLnVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICAgICAgc3VtbWFyaWVzLnVuc2hpZnQoc3VtbWFyaXplZCk7ICAgICAgXG4gICAgICAgICAgICAgICAgICAgIG5lc3RCeUFycmF5LnBvcCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gc3VtbWFyaWVzO1xuICAgICAgICAgICAgfSwgXG4gICAgICAgICAgICBuZXN0UHJlbGltKG5lc3RCeUFycmF5KXtcbiAgICAgICAgICAgICAgICAvLyByZWN1cnNpdmUgIG5lc3RpbmcgZnVuY3Rpb24gdXNlZCBieSBzdW1tYXJpemVEYXRhIGFuZCByZXR1cm5LZXlWYWx1ZXNcbiAgICAgICAgICAgICAgICByZXR1cm4gbmVzdEJ5QXJyYXkucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXIgIT09ICdzdHJpbmcnICYmIHR5cGVvZiBjdXIgIT09ICdmdW5jdGlvbicgKSB7IHRocm93ICdlYWNoIG5lc3RCeSBpdGVtIG11c3QgYmUgYSBzdHJpbmcgb3IgZnVuY3Rpb24nOyB9XG4gICAgICAgICAgICAgICAgICAgIHZhciBydG47XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ3N0cmluZycgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ0biA9IGFjYy5rZXkoZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRbY3VyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pOyAgICBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdmdW5jdGlvbicgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ0biA9IGFjYy5rZXkoZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN1cihkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBydG47XG4gICAgICAgICAgICAgICAgfSwgZDMubmVzdCgpKTtcbiAgICAgICAgICAgIH0sICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbmVzdEJ5LCBjb2VyY2UgPSBmYWxzZSwgbmVzdFR5cGUgPSAnc2VyaWVzJywgdGFiSW5kZXggPSAwKXtcbiAgICAgICAgICAgIC8vIHRoaXMgZm4gdGFrZXMgbm9ybWFsaXplZCBkYXRhIGZldGNoZWQgYXMgYW4gYXJyYXkgb2Ygcm93cyBhbmQgdXNlcyB0aGUgdmFsdWVzIGluIHRoZSBmaXJzdCByb3cgYXMga2V5cyBmb3IgdmFsdWVzIGluXG4gICAgICAgICAgICAvLyBzdWJzZXF1ZW50IHJvd3NcbiAgICAgICAgICAgIC8vIG5lc3RCeSA9IHN0cmluZyBvciBhcnJheSBvZiBmaWVsZChzKSB0byBuZXN0IGJ5LCBvciBhIGN1c3RvbSBmdW5jdGlvbiwgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnM7XG4gICAgICAgICAgICAvLyBjb2VyY2UgPSBCT09MIGNvZXJjZSB0byBudW0gb3Igbm90OyBuZXN0VHlwZSA9IG9iamVjdCBvciBzZXJpZXMgbmVzdCAoZDMpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHByZWxpbTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgdW5uZXN0ZWQgPSB2YWx1ZXMuc2xpY2UoMSkubWFwKHJvdyA9PiByb3cucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyLCBpKSB7IFxuICAgICAgICAgICAgICAgIC8vIDEuIHBhcmFtczogdG90YWwsIGN1cnJlbnRWYWx1ZSwgY3VycmVudEluZGV4WywgYXJyXVxuICAgICAgICAgICAgICAgIC8vIDMuIC8vIGFjYyBpcyBhbiBvYmplY3QgLCBrZXkgaXMgY29ycmVzcG9uZGluZyB2YWx1ZSBmcm9tIHJvdyAwLCB2YWx1ZSBpcyBjdXJyZW50IHZhbHVlIG9mIGFycmF5XG4gICAgICAgICAgICAgICAgICBhY2NbdmFsdWVzWzBdW2ldXSA9IGNvZXJjZSA9PT0gdHJ1ZSA/IGlzTmFOKCtjdXIpIHx8IGN1ciA9PT0gJycgPyBjdXIgOiArY3VyIDogY3VyOyBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGVzdCBmb3IgZW1wdHkgc3RyaW5ncyBiZWZvcmUgY29lcmNpbmcgYmMgKycnID0+IDBcbiAgICAgICAgICAgICAgICB9LCB7fSkpO1xuICAgICAgICAgICAgICAgIGlmICggdGFiSW5kZXggPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudW5uZXN0ZWQgPSB1bm5lc3RlZDtcbiAgICAgICAgICAgICAgICB9ICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoICFuZXN0QnkgKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVubmVzdGVkO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIG5lc3RCeSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG5lc3RCeSA9PT0gJ2Z1bmN0aW9uJyApIHsgLy8gaWUgb25seSBvbmUgbmVzdEJ5IGZpZWxkIG9yIGZ1bmNpdG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSB0aGlzLm5lc3RQcmVsaW0oW25lc3RCeV0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG5lc3RCeSkpIHsgdGhyb3cgJ25lc3RCeSB2YXJpYWJsZSBtdXN0IGJlIGEgc3RyaW5nLCBmdW5jdGlvbiwgb3IgYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnMnOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSB0aGlzLm5lc3RQcmVsaW0obmVzdEJ5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIG5lc3RUeXBlID09PSAnb2JqZWN0JyApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJlbGltXG4gICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJlbGltXG4gICAgICAgICAgICAgICAgICAgICAgICAuZW50cmllcyh1bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGluaXRpYWxpemVDaGFydHMoY29udGFpbmVyKXtcbiAgICAgICAgICAgICAgICB2YXIgZ3JvdXAgPSB0aGlzO1xuICAgICAgICAgICAgICAgIGQzLnNlbGVjdChjb250YWluZXIpLnNlbGVjdEFsbCgnLmQzLWNoYXJ0JylcbiAgICAgICAgICAgICAgICAgICAgLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyb3VwLmNoaWxkcmVuLnB1c2gobmV3IENoYXJ0cy5DaGFydERpdih0aGlzLCBncm91cCkpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gICAgICAgIFxuICAgIH07IC8vIEQzQ2hhcnRHcm91cCBwcm90b3R5cGUgZW5kcyBoZXJlXG4gICAgXG4gICAgd2luZG93LkQzQ2hhcnRzID0geyAvLyBuZWVkIHRvIHNwZWNpZnkgd2luZG93IGJjIGFmdGVyIHRyYW5zcGlsaW5nIGFsbCB0aGlzIHdpbGwgYmUgd3JhcHBlZCBpbiBJSUZFc1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGByZXR1cm5gaW5nIHdvbid0IGdldCB0aGUgZXhwb3J0IGludG8gd2luZG93J3MgZ2xvYmFsIHNjb3BlXG4gICAgICAgIEluaXQoKXtcbiAgICAgICAgICAgIHZhciBncm91cERpdnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZDMtZ3JvdXAnKTtcbiAgICAgICAgICAgIGZvciAoIGxldCBpID0gMDsgaSA8IGdyb3VwRGl2cy5sZW5ndGg7IGkrKyApe1xuICAgICAgICAgICAgICAgIGdyb3VwQ29sbGVjdGlvbi5wdXNoKG5ldyBEM0NoYXJ0R3JvdXAoZ3JvdXBEaXZzW2ldLCBpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhncm91cENvbGxlY3Rpb24pO1xuICAgICAgICB9XG4gICAgfTtcbn0oKSk7IC8vIGVuZCB2YXIgRDNDaGFydHMgSUlGRSIsImV4cG9ydCBjb25zdCBDaGFydHMgPSAoZnVuY3Rpb24oKXtcblxuICAgIHZhciBDaGFydERpdiA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgcGFyZW50KXtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gW107XG4gICAgICAgIHRoaXMuc2VyaWVzQ291bnQgPSAwO1xuICAgICAgICB0aGlzLmNvbmZpZyA9IE9iamVjdC5jcmVhdGUoIHBhcmVudC5jb25maWcsIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKCBjb250YWluZXIuZGF0YXNldC5jb252ZXJ0KCkgKSApO1xuICAgICAgICAgICAgLy8gbGluZSBhYm92ZSBjcmVhdGVzIGEgY29uZmlnIG9iamVjdCBmcm9tIHRoZSBIVE1MIGRhdGFzZXQgZm9yIHRoZSBjaGFydERpdiBjb250YWluZXJcbiAgICAgICAgICAgIC8vIHRoYXQgaW5oZXJpdHMgZnJvbSB0aGUgcGFyZW50cyBjb25maWcgb2JqZWN0LiBhbnkgY29uZmlncyBub3Qgc3BlY2lmaWVkIGZvciB0aGUgY2hhcnREaXYgKGFuIG93biBwcm9wZXJ0eSlcbiAgICAgICAgICAgIC8vIHdpbGwgY29tZSBmcm9tIHVwIHRoZSBpbmhlcml0YW5jZSBjaGFpblxuICAgICAgICB0aGlzLmRhdHVtID0gcGFyZW50LmRhdGEuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSB0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgIHZhciBzZXJpZXNJbnN0cnVjdCA9IHRoaXMuY29uZmlnLnNlcmllcyB8fCAnYWxsJztcbiAgICAgICAgY29uc29sZS5sb2coc2VyaWVzSW5zdHJ1Y3QpO1xuICAgICAgICBpZiAoIEFycmF5LmlzQXJyYXkoc2VyaWVzSW5zdHJ1Y3QpICl7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnaXMgYXJyYXknLCB0aGlzLmRhdHVtLnZhbHVlcyk7XG4gICAgICAgICAgICB0aGlzLmRhdHVtLnZhbHVlcyA9IHRoaXMuZGF0dW0udmFsdWVzLmZpbHRlcihlYWNoID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlYWNoLmtleSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlcmllc0luc3RydWN0LmluZGV4T2YoZWFjaC5rZXkpICE9PSAtMTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKCBzZXJpZXNJbnN0cnVjdCAhPT0gJ2FsbCcgKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBJbnZhbGlkIGluc3RydWN0aW9uIGZyb20gSFRNTCBmb3Igd2hpY2ggY2F0ZWdvcmllcyB0byBpbmNsdWRlIFxuICAgICAgICAgICAgICAgICAgICAodmFyIHNlcmllc0luc3RydWN0KS4gRmFsbGJhY2sgdG8gYWxsLmApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2VyaWVzR3JvdXBzID0gdGhpcy5ncm91cFNlcmllcygpO1xuICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB0aGlzLnBhcmVudC5kaWN0aW9uYXJ5O1xuICAgICAgICBpZiAoIHRoaXMuY29uZmlnLmhlYWRpbmcgIT09IGZhbHNlICl7XG4gICAgICAgICAgICB0aGlzLmFkZEhlYWRpbmcodGhpcy5jb25maWcuaGVhZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jcmVhdGVDaGFydHMoKTtcblxuICAgIH07XG4gICAgXG4gICAgQ2hhcnREaXYucHJvdG90eXBlID0ge1xuICAgICAgICBjaGFydFR5cGVzOiB7XG4gICAgICAgICAgICBsaW5lOiAgICdMaW5lQ2hhcnQnLFxuICAgICAgICAgICAgY29sdW1uOiAnQ29sdW1uQ2hhcnQnLFxuICAgICAgICAgICAgYmFyOiAgICAnQmFyQ2hhcnQnIC8vIHNvIG9uIC4gLiAuXG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZUNoYXJ0cygpe1xuICAgICAgICAgICAgdGhpcy5zZXJpZXNHcm91cHMuZm9yRWFjaCgoZWFjaCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChuZXcgTGluZUNoYXJ0KHRoaXMsIGVhY2gpKTsgLy8gVE8gRE8gZGlzdGluZ3Vpc2ggY2hhcnQgdHlwZXMgaGVyZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGdyb3VwU2VyaWVzKCl7XG4gICAgICAgICAgICB2YXIgc2VyaWVzR3JvdXBzLFxuICAgICAgICAgICAgICAgIGdyb3Vwc0luc3RydWN0ID0gdGhpcy5jb25maWcuc2VyaWVzR3JvdXAgfHwgJ25vbmUnO1xuICAgICAgICAgICAgaWYgKCBBcnJheS5pc0FycmF5KCBncm91cHNJbnN0cnVjdCApICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFtdO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlnLnNlcmllc0dyb3VwLmZvckVhY2goZ3JvdXAgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMucHVzaCh0aGlzLmRhdHVtLnZhbHVlcy5maWx0ZXIoc2VyaWVzID0+IGdyb3VwLmluZGV4T2Yoc2VyaWVzLmtleSkgIT09IC0xKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBncm91cHNJbnN0cnVjdCA9PT0gJ25vbmUnICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IHRoaXMuZGF0dW0udmFsdWVzLm1hcChlYWNoID0+IFtlYWNoXSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBncm91cHNJbnN0cnVjdCA9PT0gJ2FsbCcgKSB7XG4gICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW3RoaXMuZGF0dW0udmFsdWVzLm1hcChlYWNoID0+IGVhY2gpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEludmFsaWQgZGF0YS1ncm91cC1zZXJpZXMgaW5zdHJ1Y3Rpb24gZnJvbSBodG1sLiBcbiAgICAgICAgICAgICAgICAgICAgICAgTXVzdCBiZSB2YWxpZCBKU09OOiBcIk5vbmVcIiBvciBcIkFsbFwiIG9yIGFuIGFycmF5XG4gICAgICAgICAgICAgICAgICAgICAgIG9mIGFycmF5cyBjb250YWluaW5nIHRoZSBzZXJpZXMgdG8gYmUgZ3JvdXBlZFxuICAgICAgICAgICAgICAgICAgICAgICB0b2dldGhlci4gQWxsIHN0cmluZ3MgbXVzdCBiZSBkb3VibGUtcXVvdGVkLmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNlcmllc0dyb3VwcztcbiAgICAgICAgfSwgLy8gZW5kIGdyb3VwU2VyaWVzKClcbiAgICAgICAgYWRkSGVhZGluZyhpbnB1dCl7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhpbnB1dCk7XG4gICAgICAgICAgICBkMy5zZWxlY3QodGhpcy5jb250YWluZXIpXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgncCcpXG4gICAgICAgICAgICAgICAgLmh0bWwoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaGVhZGluZyA9IHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycgPyBpbnB1dCA6IHRoaXMubGFiZWwodGhpcy5jb25maWcuY2F0ZWdvcnkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJzxzdHJvbmc+JyArIGhlYWRpbmcgKyAnPC9zdHJvbmc+JztcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgbGFiZWwoa2V5KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLmxhYmVsO1xuICAgICAgICB9LFxuICAgICAgICB1bml0cyhrZXkpe1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkudW5pdHM7ICBcbiAgICAgICAgfVxuXG4gICAgfTsgLy8gZW5kIExpbmVDaGFydC5wcm90b3R5cGVcblxuICAgIHZhciBMaW5lQ2hhcnQgPSBmdW5jdGlvbihwYXJlbnQsIHNlcmllc0dyb3VwKXtcbiAgICAgICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgIHRoaXMuY29uZmlnID0gcGFyZW50LmNvbmZpZztcbiAgICAgICAgdGhpcy5tYXJnaW5Ub3AgPSArdGhpcy5jb25maWcubWFyZ2luVG9wIHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMudG9wO1xuICAgICAgICB0aGlzLm1hcmdpblJpZ2h0ID0gK3RoaXMuY29uZmlnLm1hcmdpblJpZ2h0IHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMucmlnaHQ7XG4gICAgICAgIHRoaXMubWFyZ2luQm90dG9tID0gK3RoaXMuY29uZmlnLm1hcmdpbkJvdHRvbSB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLmJvdHRvbTtcbiAgICAgICAgdGhpcy5tYXJnaW5MZWZ0ID0gK3RoaXMuY29uZmlnLm1hcmdpbkxlZnQgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5sZWZ0O1xuICAgICAgICB0aGlzLndpZHRoID0gdGhpcy5jb25maWcuc3ZnV2lkdGggPyArdGhpcy5jb25maWcuc3ZnV2lkdGggLSB0aGlzLm1hcmdpblJpZ2h0IC0gdGhpcy5tYXJnaW5MZWZ0IDogMzIwIC0gdGhpcy5tYXJnaW5SaWdodCAtIHRoaXMubWFyZ2luTGVmdDtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSB0aGlzLmNvbmZpZy5zdmdIZWlnaHQgPyArdGhpcy5jb25maWcuc3ZnSGVpZ2h0IC0gdGhpcy5tYXJnaW5Ub3AgLSB0aGlzLm1hcmdpbkJvdHRvbSA6ICggdGhpcy53aWR0aCArIHRoaXMubWFyZ2luUmlnaHQgKyB0aGlzLm1hcmdpbkxlZnQgKSAvIDIgLSB0aGlzLm1hcmdpblRvcCAtIHRoaXMubWFyZ2luQm90dG9tO1xuICAgICAgICB0aGlzLmRhdGEgPSBzZXJpZXNHcm91cDtcbiAgICAgICAgY29uc29sZS5sb2codGhpcyk7XG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gdGhpcy5pbml0KHBhcmVudC5jb250YWluZXIpO1xuICAgICAgICB0aGlzLnhTY2FsZVR5cGUgPSB0aGlzLmNvbmZpZy54U2NhbGVUeXBlIHx8ICd0aW1lJztcbiAgICAgICAgdGhpcy55U2NhbGVUeXBlID0gdGhpcy5jb25maWcueVNjYWxlVHlwZSB8fCAnbGluZWFyJztcbiAgICAgICAgdGhpcy54VGltZVR5cGUgPSB0aGlzLmNvbmZpZy54VGltZVR5cGUgfHwgJyVZJztcbiAgICAgICAgdGhpcy5zY2FsZUJ5ID0gdGhpcy5jb25maWcuc2NhbGVCeSB8fCAnc2VyaWVzLWdyb3VwJztcbiAgICAgICAgdGhpcy5zZXRTY2FsZXMoKTsgLy8gLy9TSE9VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFIFxuICAgICAgICB0aGlzLmFkZExpbmVzKCk7XG4gICAgICAgIHRoaXMuYWRkUG9pbnRzKCk7XG4gICAgICAgIHRoaXMuYWRkWEF4aXMoKTtcbiAgICAgICAgdGhpcy5hZGRZQXhpcygpO1xuICAgICAgICBpZiAoIHRoaXMuY29uZmlnLmRpcmVjdExhYmVsID09PSB0cnVlICl7XG4gICAgICAgICAgICB0aGlzLmFkZExhYmVscygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdGhpcy5hZGRMZWdlbmRzKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zZXRUb29sdGlwcygpO1xuICAgICAgICAgICAgICAgXG4gICAgfTtcblxuICAgIExpbmVDaGFydC5wcm90b3R5cGUgPSB7IC8vIGVhY2ggTGluZUNoYXJ0IGlzIGFuIHN2ZyB0aGF0IGhvbGQgZ3JvdXBlZCBzZXJpZXNcbiAgICAgICAgZGVmYXVsdE1hcmdpbnM6IHtcbiAgICAgICAgICAgIHRvcDoyMCxcbiAgICAgICAgICAgIHJpZ2h0OjQ1LFxuICAgICAgICAgICAgYm90dG9tOjE1LFxuICAgICAgICAgICAgbGVmdDozNVxuICAgICAgICB9LFxuICAgICAgICAgICAgICBcbiAgICAgICAgaW5pdChjaGFydERpdil7IC8vIC8vU0hPVUxEIEJFIElOIENIQVJUIFBST1RPVFlQRSB0aGlzIGlzIGNhbGxlZCBvbmNlIGZvciBlYWNoIHNlcmllc0dyb3VwIG9mIGVhY2ggY2F0ZWdvcnkuIFxuICAgICAgICAgICAgdmFyIGNvbnRhaW5lciA9ICBkMy5zZWxlY3QoY2hhcnREaXYpXG4gICAgICAgICAgICAgICAgLmFwcGVuZCgnc3ZnJylcbiAgICAgICAgICAgICAgICAuYXR0cignd2lkdGgnLCB0aGlzLndpZHRoICsgdGhpcy5tYXJnaW5SaWdodCArIHRoaXMubWFyZ2luTGVmdCApXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2hlaWdodCcsIHRoaXMuaGVpZ2h0ICArIHRoaXMubWFyZ2luVG9wICsgdGhpcy5tYXJnaW5Cb3R0b20gKTtcblxuICAgICAgICAgICAgdGhpcy5zdmcgPSBjb250YWluZXIuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJyxgdHJhbnNsYXRlKCR7dGhpcy5tYXJnaW5MZWZ0fSwgJHt0aGlzLm1hcmdpblRvcH0pYCk7XG5cbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcyA9IHRoaXMuc3ZnLnNlbGVjdEFsbCgnZWFjaC1zZXJpZXMnKVxuICAgICAgICAgICAgICAgIC5kYXRhKHRoaXMuZGF0YSlcbiAgICAgICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdlYWNoLXNlcmllcyBzZXJpZXMtJyArIHRoaXMucGFyZW50LnNlcmllc0NvdW50ICsgJyBjb2xvci0nICsgdGhpcy5wYXJlbnQuc2VyaWVzQ291bnQrKyAlIDM7XG4gICAgICAgICAgICAgICAgfSk7XG4vKlxuICAgICAgICAgICAgdGhpcy5lYWNoU2VyaWVzLmVhY2goKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50LnNlcmllc0FycmF5LnB1c2goYXJyYXlbaV0pO1xuICAgICAgICAgICAgfSk7Ki9cblxuXG5cbiAgICAgICAgICAgIHJldHVybiBjb250YWluZXIubm9kZSgpO1xuICAgICAgICB9LFxuICAgICAgICBzZXRTY2FsZXMoKXsgLy9TSE9VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFIC8vIFRPIERPOiBTRVQgU0NBTEVTIEZPUiBPVEhFUiBHUk9VUCBUWVBFU1xuICAgICAgICAgICAgdmFyIGQzU2NhbGUgPSB7XG4gICAgICAgICAgICAgICAgdGltZTogZDMuc2NhbGVUaW1lKCksXG4gICAgICAgICAgICAgICAgbGluZWFyOiBkMy5zY2FsZUxpbmVhcigpXG4gICAgICAgICAgICAgICAgLy8gVE8gRE86IGFkZCBhbGwgc2NhbGUgdHlwZXMuXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIHhNYXhlcyA9IFtdLCB4TWlucyA9IFtdLCB5TWF4ZXMgPSBbXSwgeU1pbnMgPSBbXTtcbiAgICAgICAgICAgIGlmICggdGhpcy5zY2FsZUJ5ID09PSAnc2VyaWVzLWdyb3VwJyApe1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5mb3JFYWNoKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlYWNoLCB0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgeE1heGVzLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0ubWF4KTtcbiAgICAgICAgICAgICAgICAgICAgeE1pbnMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1bdGhpcy5jb25maWcudmFyaWFibGVYXS5taW4pO1xuICAgICAgICAgICAgICAgICAgICB5TWF4ZXMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1bdGhpcy5jb25maWcudmFyaWFibGVZXS5tYXgpO1xuICAgICAgICAgICAgICAgICAgICB5TWlucy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt0aGlzLmNvbmZpZy52YXJpYWJsZVldLm1pbik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnhNYXggPSBkMy5tYXgoeE1heGVzKTtcbiAgICAgICAgICAgIHRoaXMueE1pbiA9IGQzLm1pbih4TWlucyk7XG4gICAgICAgICAgICB0aGlzLnlNYXggPSBkMy5tYXgoeU1heGVzKTtcbiAgICAgICAgICAgIHRoaXMueU1pbiA9IGQzLm1pbih5TWlucyk7XG4gICAgICAgICAgICB0aGlzLnhWYWx1ZXNVbmlxdWUgPSBbXTtcblxuICAgICAgICAgICAgdmFyIHhSYW5nZSA9IFswLCB0aGlzLndpZHRoXSxcbiAgICAgICAgICAgICAgICB5UmFuZ2UgPSBbdGhpcy5oZWlnaHQsIDBdLFxuICAgICAgICAgICAgICAgIHhEb21haW4sXG4gICAgICAgICAgICAgICAgeURvbWFpbjtcbiAgICAgICAgICAgIGlmICggdGhpcy54U2NhbGVUeXBlID09PSAndGltZScpIHtcbiAgICAgICAgICAgICAgICB4RG9tYWluID0gW2QzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkodGhpcy54TWluKSwgZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKSh0aGlzLnhNYXgpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIFRPIERPOiBPVEhFUiBkYXRhIHR5cGVzID9cbiAgICAgICAgICAgICAgICB4RG9tYWluID0gW3RoaXMueE1pbiwgdGhpcy54TWF4XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICggdGhpcy55U2NhbGVUeXBlID09PSAndGltZScpIHtcbiAgICAgICAgICAgICAgICB5RG9tYWluID0gW2QzLnRpbWVQYXJzZSh0aGlzLnlUaW1lVHlwZSkodGhpcy55TWluKSwgZDMudGltZVBhcnNlKHRoaXMueVRpbWVUeXBlKSh0aGlzLnlNYXgpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIFRPIERPOiBPVEhFUiBkYXRhIHR5cGVzID9cbiAgICAgICAgICAgICAgICB5RG9tYWluID0gW3RoaXMueU1pbiwgdGhpcy55TWF4XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy54U2NhbGUgPSBkM1NjYWxlW3RoaXMueFNjYWxlVHlwZV0uZG9tYWluKHhEb21haW4pLnJhbmdlKHhSYW5nZSk7XG4gICAgICAgICAgICB0aGlzLnlTY2FsZSA9IGQzU2NhbGVbdGhpcy55U2NhbGVUeXBlXS5kb21haW4oeURvbWFpbikucmFuZ2UoeVJhbmdlKTtcblxuICAgICAgICB9LFxuICAgICAgICBhZGRMaW5lcygpe1xuICAgICAgICAgICAgdmFyIHZhbHVlbGluZSA9IGQzLmxpbmUoKVxuICAgICAgICAgICAgICAgIC54KGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHRoaXMueFZhbHVlc1VuaXF1ZS5pbmRleE9mKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkgPT09IC0xICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnhWYWx1ZXNVbmlxdWUucHVzaChkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpO1xuICAgICAgICAgICAgICAgIH0pIFxuICAgICAgICAgICAgICAgIC55KGQgPT4gdGhpcy55U2NhbGUoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVldKSk7IC8vICEhIG5vdCBwcm9ncmFtbWF0aWNcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5saW5lcyA9IHRoaXMuZWFjaFNlcmllcy5hcHBlbmQoJ3BhdGgnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ2xpbmUnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGFkZFhBeGlzKCl7IC8vIGNvdWxkIGJlIGluIENoYXJ0IHByb3RvdHlwZSA/XG4gICAgICAgICAgICB2YXIgeUF4aXNQb3NpdGlvbixcbiAgICAgICAgICAgICAgICB5QXhpc09mZnNldCxcbiAgICAgICAgICAgICAgICBheGlzVHlwZTtcblxuICAgICAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy55QXhpc1Bvc2l0aW9uID09PSAnemVybycgKXtcbiAgICAgICAgICAgICAgICB5QXhpc1Bvc2l0aW9uID0gMDtcbiAgICAgICAgICAgICAgICB5QXhpc09mZnNldCA9IDA7XG4gICAgICAgICAgICAgICAgYXhpc1R5cGUgPSBkMy5heGlzQm90dG9tO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoIHRoaXMuY29uZmlnLnlBeGlzUG9zaXRpb24gPT09ICd0b3AnICl7XG4gICAgICAgICAgICAgICAgeUF4aXNQb3NpdGlvbiA9IHRoaXMueU1heDtcbiAgICAgICAgICAgICAgICB5QXhpc09mZnNldCA9IC10aGlzLm1hcmdpblRvcDtcbiAgICAgICAgICAgICAgICBheGlzVHlwZSA9IGQzLmF4aXNUb3A7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHlBeGlzUG9zaXRpb24gPSB0aGlzLnlNaW47XG4gICAgICAgICAgICAgICAgeUF4aXNPZmZzZXQgPSAwO1xuICAgICAgICAgICAgICAgIGF4aXNUeXBlID0gZDMuYXhpc0JvdHRvbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciBheGlzID0gYXhpc1R5cGUodGhpcy54U2NhbGUpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKTtcbiAgICAgICAgICAgIGlmICggdGhpcy54U2NhbGVUeXBlID09PSAndGltZScgKXtcbiAgICAgICAgICAgICAgICBheGlzLnRpY2tWYWx1ZXModGhpcy54VmFsdWVzVW5pcXVlLm1hcChlYWNoID0+IGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZWFjaCkpKTsgLy8gVE8gRE86IGFsbG93IGZvciBvdGhlciB4QXhpcyBBZGp1c3RtZW50c1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zdmcuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLCcgKyAoIHRoaXMueVNjYWxlKHlBeGlzUG9zaXRpb24pICsgeUF4aXNPZmZzZXQgKSArICcpJykgLy8gbm90IHByb2dyYW1hdGljIHBsYWNlbWVudCBvZiB4LWF4aXNcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgIC5jYWxsKGF4aXMpO1xuICAgICAgICB9LFxuICAgICAgICBhZGRZQXhpcygpe1xuICAgICAgICAgICAgLyogYXhpcyAqL1xuICAgICAgICAgICAgdGhpcy5zdmcuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4gJ2F4aXMgeS1heGlzICcpXG4gICAgICAgICAgICAgIC5jYWxsKGQzLmF4aXNMZWZ0KHRoaXMueVNjYWxlKS50aWNrU2l6ZUlubmVyKDQpLnRpY2tTaXplT3V0ZXIoMCkudGlja1BhZGRpbmcoMSkudGlja3MoNSkpO1xuXG4gICAgICAgICAgICAvKiBsYWJlbHMgKi9cbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcy5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAndW5pdHMnKVxuICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKCkgPT4gYHRyYW5zbGF0ZSgtJHt0aGlzLm1hcmdpbkxlZnR9LC0ke3RoaXMubWFyZ2luVG9wIC0gMTB9KWApXG4gICAgICAgICAgICAgIC50ZXh0KChkLGkpID0+IGkgPT09IDAgPyB0aGlzLnBhcmVudC51bml0cyhkLmtleSkgOiBudWxsKTtcbiAgICAgICAgICAgIFxuICAgICAgICB9LFxuICAgICAgICBhZGRMYWJlbHMoKXtcbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcy5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdzZXJpZXMtbGFiZWwnKVxuICAgICAgICAgICAgICAgIC5odG1sKChkKSA9PiAnPHRzcGFuIHg9XCIwXCI+JyArIHRoaXMucGFyZW50LmxhYmVsKGQua2V5KS5yZXBsYWNlKC9cXFxcbi9nLCc8L3RzcGFuPjx0c3BhbiB4PVwiMFwiIGR5PVwiMS4yZW1cIj4nKSArICc8L3RzcGFuPicpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIChkKSA9PiBgdHJhbnNsYXRlKCR7dGhpcy53aWR0aCArIDV9LCAke3RoaXMueVNjYWxlKGQudmFsdWVzW2QudmFsdWVzLmxlbmd0aCAtIDFdW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pICsgM30pYCk7XG4gICAgICAgIH0sXG4gICAgICAgIGFkZFBvaW50cygpe1xuICAgICAgICAgICAgdGhpcy5wb2ludHMgPSB0aGlzLmVhY2hTZXJpZXMuc2VsZWN0QWxsKCdwb2ludHMnKVxuICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4gZC52YWx1ZXMpXG4gICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdjaXJjbGUnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdkYXRhLXBvaW50JylcbiAgICAgICAgICAgICAgICAuYXR0cigncicsICc0JylcbiAgICAgICAgICAgICAgICAuYXR0cignY3gnLCBkID0+IHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSkpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2N5JywgZCA9PiB0aGlzLnlTY2FsZShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0VG9vbHRpcHMoKXtcbiAgICAgICAgICAgIHRoaXMudG9vbHRpcCA9IGQzLnRpcCgpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcImQzLXRpcFwiKVxuICAgICAgICAgICAgICAgIC5kaXJlY3Rpb24oJ24nKVxuICAgICAgICAgICAgICAgIC5vZmZzZXQoWy04LCAwXSlcbiAgICAgICAgICAgICAgICAuaHRtbCgoKSA9PiAnaGVsbG8nKTtcbiAgICAgICAgfVxuICAgIH07XG5cblxuICAgIHJldHVybiB7XG4gICAgICAgIENoYXJ0RGl2XG4gICAgfTtcblxufSkoKTtcbiIsImV4cG9ydCBjb25zdCBIZWxwZXJzID0gKGZ1bmN0aW9uKCl7XG4gICAgLyogZ2xvYmFscyBET01TdHJpbmdNYXAgKi9cbiAgICBTdHJpbmcucHJvdG90eXBlLmNsZWFuU3RyaW5nID0gZnVuY3Rpb24oKSB7IC8vIGxvd2VyY2FzZSBhbmQgcmVtb3ZlIHB1bmN0dWF0aW9uIGFuZCByZXBsYWNlIHNwYWNlcyB3aXRoIGh5cGhlbnM7IGRlbGV0ZSBwdW5jdHVhdGlvblxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9bIFxcXFxcXC9dL2csJy0nKS5yZXBsYWNlKC9bJ1wi4oCd4oCZ4oCc4oCYLFxcLiFcXD87XFwoXFwpJl0vZywnJykudG9Mb3dlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgU3RyaW5nLnByb3RvdHlwZS5yZW1vdmVVbmRlcnNjb3JlcyA9IGZ1bmN0aW9uKCkgeyBcbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvXy9nLCcgJyk7XG4gICAgfTtcblxuICAgIERPTVN0cmluZ01hcC5wcm90b3R5cGUuY29udmVydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbmV3T2JqID0ge307XG4gICAgICAgIGZvciAoIHZhciBrZXkgaW4gdGhpcyApe1xuICAgICAgICAgICAgaWYgKHRoaXMuaGFzT3duUHJvcGVydHkoa2V5KSl7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbmV3T2JqW2tleV0gPSBKU09OLnBhcnNlKHRoaXNba2V5XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAgICAgICBuZXdPYmpba2V5XSA9IHRoaXNba2V5XTsgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld09iajtcbiAgICB9O1xufSkoKTtcbiJdfQ==
