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
        this.config = Object.create(parent.config, Object.getOwnPropertyDescriptors(container.dataset.convert()));
        // line above creates a config object from the HTML dataset for the chartDiv container
        // that inherits from the parents config object. any configs not specified for the chartDiv (an own property)
        // will come from up the inheritance chain
        this.datum = parent.data.find(function (each) {
            return each.key === _this.config.category;
        });
        this.seriesGroups = this.groupSeries();
        this.dictionary = this.parent.dictionary;
        this.addHeading();
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

            this.seriesGroups.forEach(function () {
                _this2.children.push(new LineChart(_this2));
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
                throw 'Invalid data-group-series instruction from html. \n                       Must be valid JSON: "None" or "All" or an array\n                       of arrays containing the series to be grouped\n                       together. All strings must be double-quoted.';
            }
            return seriesGroups;
        },
        // end groupSeries()
        addHeading: function addHeading() {
            d3.select(this.container).append('p').html('<strong>' + this.label(this.config.category) + '</strong>');
        },
        label: function label(key) {
            return this.dictionary.find(function (each) {
                return each.key === key;
            }).label;
        }
    }; // end LineChart.prototype

    var LineChart = function LineChart(parent) {
        this.parent = parent;
        this.config = parent.config;
        this.marginTop = +this.config.marginTop || this.defaultMargins.top;
        this.marginRight = +this.config.marginRight || this.defaultMargins.right;
        this.marginBottom = +this.config.marginBottom || this.defaultMargins.bottom;
        this.marginLeft = +this.config.marginLeft || this.defaultMargins.left;
        this.width = this.config.svgWidth ? +this.config.svgWidth - this.marginRight - this.marginLeft : 320 - this.marginRight - this.marginLeft;
        this.height = this.config.svgHeight ? +this.config.svgHeight - this.marginTop - this.marginBottom : (this.width + this.marginRight + this.marginLeft) / 2 - this.marginTop - this.marginBottom;
        console.log(this);
        this.container = this.init(parent.container);

        // TO DO set max,min, etc from summaries; set scales, etc. all that can be Chart prototype.
    };

    LineChart.prototype = {
        init: function init(chartDiv) {
            var svg = d3.select(chartDiv).append('svg').attr('width', this.width + this.marginRight + this.marginLeft).attr('height', this.height + this.marginTop + this.marginBottom);

            svg.append('g').attr('transform', 'translate(' + this.marginLeft + ', ' + this.marginRight + ')');

            return svg.node();
        },

        defaultMargins: {
            top: 20,
            right: 45,
            bottom: 15,
            left: 35
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9DaGFydHMuanMiLCJqcy1leHBvcnRzL0hlbHBlcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0lBOztBQUNBOztBQUxDLGdDLENBQWlDO0FBQ2pDOztBQU1ELElBQUksV0FBWSxZQUFVOztBQUUxQjs7QUFFSSxRQUFJLGtCQUFrQixFQUF0QjtBQUNBLFFBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxTQUFULEVBQW9CLEtBQXBCLEVBQTBCO0FBQUE7O0FBQ3pDLGdCQUFRLEdBQVIsQ0FBWSxLQUFaO0FBQ0EsYUFBSyxTQUFMLEdBQWlCLFNBQWpCO0FBQ0EsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssTUFBTCxHQUFjLFVBQVUsT0FBVixDQUFrQixPQUFsQixFQUFkO0FBQ0EsZ0JBQVEsR0FBUixDQUFZLEtBQUssTUFBTCxDQUFZLE1BQVosQ0FBbUIsUUFBbkIsRUFBWjtBQUNBLGFBQUssWUFBTCxHQUFvQixLQUFLLGtCQUFMLENBQXdCLFNBQXhCLENBQXBCO0FBQ0EsYUFBSyxRQUFMLEdBQWdCLEVBQWhCO0FBQ0EsZ0JBQVEsR0FBUixDQUFZLEtBQUssWUFBakI7QUFDQTtBQUNBLGFBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixZQUFNO0FBQ3pCLGtCQUFLLGdCQUFMLENBQXNCLFNBQXRCO0FBQ0gsU0FGRDtBQUdILEtBYkQ7QUFjQTtBQUNBLGlCQUFhLFNBQWIsR0FBeUI7QUFFakIsMEJBRmlCLGdDQUVHO0FBQUE7O0FBQ2hCLGdCQUFJLGVBQWUsRUFBbkI7QUFDQSxnQkFBSSxVQUFVLEtBQUssTUFBTCxDQUFZLE9BQTFCO0FBQUEsZ0JBQ0ksT0FBTyxDQUFDLEtBQUssTUFBTCxDQUFZLE9BQWIsRUFBcUIsS0FBSyxNQUFMLENBQVksYUFBakMsQ0FEWCxDQUZnQixDQUc0QztBQUN4QjtBQUNwQyxp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LENBckdxQixFQUFmOzs7Ozs7OztBQ0FBLElBQU0sNEJBQVcsWUFBVTtBQUM5QjtBQUNBLFdBQU8sU0FBUCxDQUFpQixXQUFqQixHQUErQixZQUFXO0FBQUU7QUFDeEMsZUFBTyxLQUFLLE9BQUwsQ0FBYSxVQUFiLEVBQXdCLEdBQXhCLEVBQTZCLE9BQTdCLENBQXFDLHVCQUFyQyxFQUE2RCxFQUE3RCxFQUFpRSxXQUFqRSxFQUFQO0FBQ0gsS0FGRDs7QUFJQSxXQUFPLFNBQVAsQ0FBaUIsaUJBQWpCLEdBQXFDLFlBQVc7QUFDNUMsZUFBTyxLQUFLLE9BQUwsQ0FBYSxJQUFiLEVBQWtCLEdBQWxCLENBQVA7QUFDSCxLQUZEOztBQUlBLGlCQUFhLFNBQWIsQ0FBdUIsT0FBdkIsR0FBaUMsWUFBVztBQUN4QyxZQUFJLFNBQVMsRUFBYjtBQUNBLGFBQU0sSUFBSSxHQUFWLElBQWlCLElBQWpCLEVBQXVCO0FBQ25CLGdCQUFJLEtBQUssY0FBTCxDQUFvQixHQUFwQixDQUFKLEVBQTZCO0FBQ3pCLG9CQUFJO0FBQ0EsMkJBQU8sR0FBUCxJQUFjLEtBQUssS0FBTCxDQUFXLEtBQUssR0FBTCxDQUFYLENBQWQ7QUFDSCxpQkFGRCxDQUdBLE9BQU0sR0FBTixFQUFXO0FBQ1AsMkJBQU8sR0FBUCxJQUFjLEtBQUssR0FBTCxDQUFkO0FBQ0g7QUFDSjtBQUNKO0FBQ0QsZUFBTyxNQUFQO0FBQ0gsS0FiRDtBQWNILENBeEJzQixFQUFoQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIgLyogZXhwb3J0ZWQgRDNDaGFydHMsIEhlbHBlcnMgKi8gLy8gbGV0J3MganNoaW50IGtub3cgdGhhdCBEM0NoYXJ0cyBjYW4gYmUgXCJkZWZpbmVkIGJ1dCBub3QgdXNlZFwiIGluIHRoaXMgZmlsZVxuIC8qIHBvbHlmaWxscyBuZWVkZWQ6IFByb21pc2UsIEFycmF5LmlzQXJyYXksIEFycmF5LmZpbmQsIEFycmF5LmZpbHRlclxuXG4gKi9cbmltcG9ydCB7IEhlbHBlcnMgfSBmcm9tICcuLi9qcy1leHBvcnRzL0hlbHBlcnMnO1xuaW1wb3J0IHsgQ2hhcnRzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9DaGFydHMnO1xuXG52YXIgRDNDaGFydHMgPSAoZnVuY3Rpb24oKXtcblxuXCJ1c2Ugc3RyaWN0XCI7IFxuICAgIFxuICAgIHZhciBncm91cENvbGxlY3Rpb24gPSBbXTtcbiAgICB2YXIgRDNDaGFydEdyb3VwID0gZnVuY3Rpb24oY29udGFpbmVyLCBpbmRleCl7XG4gICAgICAgIGNvbnNvbGUubG9nKGluZGV4KTtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgICAgIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb250YWluZXIuZGF0YXNldC5jb252ZXJ0KCk7XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMuY29uZmlnLm5lc3RCeS50b1N0cmluZygpKTtcbiAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMgPSB0aGlzLnJldHVybkRhdGFQcm9taXNlcyhjb250YWluZXIpO1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gW107XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMuZGF0YVByb21pc2VzKTtcbiAgICAgICAgLy90aGlzLmNvbnRyb2xsZXIuaW5pdENvbnRyb2xsZXIoY29udGFpbmVyLCB0aGlzLm1vZGVsLCB0aGlzLnZpZXcpO1xuICAgICAgICB0aGlzLmRhdGFQcm9taXNlcy50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNoYXJ0cyhjb250YWluZXIpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8vcHJvdG90eXBlIGJlZ2lucyBoZXJlXG4gICAgRDNDaGFydEdyb3VwLnByb3RvdHlwZSA9IHtcbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm5EYXRhUHJvbWlzZXMoKXsgXG4gICAgICAgICAgICAgICAgdmFyIGRhdGFQcm9taXNlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBzaGVldElEID0gdGhpcy5jb25maWcuc2hlZXRJZCwgXG4gICAgICAgICAgICAgICAgICAgIHRhYnMgPSBbdGhpcy5jb25maWcuZGF0YVRhYix0aGlzLmNvbmZpZy5kaWN0aW9uYXJ5VGFiXTsgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpcyB0aGVyZSBhIGNhc2UgZm9yIG1vcmUgdGhhbiBvbmUgc2hlZXQgb2YgZGF0YT9cbiAgICAgICAgICAgICAgICB0YWJzLmZvckVhY2goKGVhY2gsIGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSxyZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLmpzb24oJ2h0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8nICsgc2hlZXRJRCArICcvdmFsdWVzLycgKyBlYWNoICsgJz9rZXk9QUl6YVN5REQzVzV3SmVKRjJlc2ZmWk1ReE50RWw5dHQtT2ZnU3E0JywgKGVycm9yLGRhdGEpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWVzID0gZGF0YS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RUeXBlID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gJ29iamVjdCcgOiAnc2VyaWVzJzsgLy8gbmVzdFR5cGUgZm9yIGRhdGEgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RCeSA9IGVhY2ggPT09ICdkaWN0aW9uYXJ5JyA/IGZhbHNlIDogdGhpcy5jb25maWcubmVzdEJ5O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBuZXN0QnksIHRydWUsIG5lc3RUeXBlLCBpKSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBkYXRhUHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBQcm9taXNlLmFsbChkYXRhUHJvbWlzZXMpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhID0gdmFsdWVzWzBdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB2YWx1ZXNbMV07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3VtbWFyaWVzID0gdGhpcy5zdW1tYXJpemVEYXRhKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKGRhdGFQcm9taXNlcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3VtbWFyaXplRGF0YSgpeyAvLyB0aGlzIGZuIGNyZWF0ZXMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBzdW1tYXJpemluZyB0aGUgZGF0YSBpbiBtb2RlbC5kYXRhLiBtb2RlbC5kYXRhIGlzIG5lc3RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgbmVzdGluZyBhbmQgcm9sbGluZyB1cCBjYW5ub3QgYmUgZG9uZSBlYXNpbHkgYXQgdGhlIHNhbWUgdGltZSwgc28gdGhleSdyZSBkb25lIHNlcGFyYXRlbHkuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzdW1tYXJpZXMgcHJvdmlkZSBhdmVyYWdlLCBtYXgsIG1pbiBvZiBhbGwgZmllbGRzIGluIHRoZSBkYXRhIGF0IGFsbCBsZXZlbHMgb2YgbmVzdGluZy4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBmaXJzdCAoaW5kZXggMCkgaXMgb25lIGxheWVyIG5lc3RlZCwgdGhlIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi5cbiAgICAgICAgICAgICAgICB2YXIgc3VtbWFyaWVzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHZhcmlhYmxlcyA9IE9iamVjdC5rZXlzKHRoaXMudW5uZXN0ZWRbMF0pOyAvLyBhbGwgbmVlZCB0byBoYXZlIHRoZSBzYW1lIGZpZWxkc1xuICAgICAgICAgICAgICAgIHZhciBuZXN0QnkgPSB0aGlzLmNvbmZpZy5uZXN0QnkgPyB0aGlzLmNvbmZpZy5uZXN0QnkubWFwKGVhY2ggPT4gZWFjaCkgOiBmYWxzZTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlcyBtYXAgdG8gY3JlYXRlIG5ldyBhcnJheSByYXRoZXIgdGhhbiBhc3NpZ25pbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBieSByZWZlcmVuY2UuIHRoZSBgcG9wKClgIGJlbG93IHdvdWxkIGFmZmVjdCBvcmlnaW5hbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFycmF5IGlmIGRvbmUgYnkgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgdmFyIG5lc3RCeUFycmF5ID0gQXJyYXkuaXNBcnJheShuZXN0QnkpID8gbmVzdEJ5IDogW25lc3RCeV07XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gcmVkdWNlVmFyaWFibGVzKGQpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFyaWFibGVzLnJlZHVjZShmdW5jdGlvbihhY2MsIGN1cil7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NbY3VyXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXg6ICAgICAgIGQzLm1heChkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluOiAgICAgICBkMy5taW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lYW46ICAgICAgZDMubWVhbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VtOiAgICAgICBkMy5zdW0oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lZGlhbjogICAgZDMubWVkaWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW5jZTogIGQzLnZhcmlhbmNlKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpYXRpb246IGQzLmRldmlhdGlvbihkLCBkID0+IGRbY3VyXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgICAgICB9LHt9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgd2hpbGUgKCBuZXN0QnlBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnJvbGx1cChyZWR1Y2VWYXJpYWJsZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHRoaXMudW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgICAgICBzdW1tYXJpZXMudW5zaGlmdChzdW1tYXJpemVkKTsgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBzdW1tYXJpZXM7XG4gICAgICAgICAgICB9LCBcbiAgICAgICAgICAgIG5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpe1xuICAgICAgICAgICAgICAgIC8vIHJlY3Vyc2l2ZSAgbmVzdGluZyBmdW5jdGlvbiB1c2VkIGJ5IHN1bW1hcml6ZURhdGEgYW5kIHJldHVybktleVZhbHVlc1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXN0QnlBcnJheS5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ciAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGN1ciAhPT0gJ2Z1bmN0aW9uJyApIHsgdGhyb3cgJ2VhY2ggbmVzdEJ5IGl0ZW0gbXVzdCBiZSBhIHN0cmluZyBvciBmdW5jdGlvbic7IH1cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJ0bjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnc3RyaW5nJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZFtjdXJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7ICAgIFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ2Z1bmN0aW9uJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VyKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJ0bjtcbiAgICAgICAgICAgICAgICB9LCBkMy5uZXN0KCkpO1xuICAgICAgICAgICAgfSwgICAgICAgXG4gICAgICAgICAgICByZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBuZXN0QnksIGNvZXJjZSA9IGZhbHNlLCBuZXN0VHlwZSA9ICdzZXJpZXMnLCB0YWJJbmRleCA9IDApe1xuICAgICAgICAgICAgLy8gdGhpcyBmbiB0YWtlcyBub3JtYWxpemVkIGRhdGEgZmV0Y2hlZCBhcyBhbiBhcnJheSBvZiByb3dzIGFuZCB1c2VzIHRoZSB2YWx1ZXMgaW4gdGhlIGZpcnN0IHJvdyBhcyBrZXlzIGZvciB2YWx1ZXMgaW5cbiAgICAgICAgICAgIC8vIHN1YnNlcXVlbnQgcm93c1xuICAgICAgICAgICAgLy8gbmVzdEJ5ID0gc3RyaW5nIG9yIGFycmF5IG9mIGZpZWxkKHMpIHRvIG5lc3QgYnksIG9yIGEgY3VzdG9tIGZ1bmN0aW9uLCBvciBhbiBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucztcbiAgICAgICAgICAgIC8vIGNvZXJjZSA9IEJPT0wgY29lcmNlIHRvIG51bSBvciBub3Q7IG5lc3RUeXBlID0gb2JqZWN0IG9yIHNlcmllcyBuZXN0IChkMylcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgcHJlbGltO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciB1bm5lc3RlZCA9IHZhbHVlcy5zbGljZSgxKS5tYXAocm93ID0+IHJvdy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIsIGkpIHsgXG4gICAgICAgICAgICAgICAgLy8gMS4gcGFyYW1zOiB0b3RhbCwgY3VycmVudFZhbHVlLCBjdXJyZW50SW5kZXhbLCBhcnJdXG4gICAgICAgICAgICAgICAgLy8gMy4gLy8gYWNjIGlzIGFuIG9iamVjdCAsIGtleSBpcyBjb3JyZXNwb25kaW5nIHZhbHVlIGZyb20gcm93IDAsIHZhbHVlIGlzIGN1cnJlbnQgdmFsdWUgb2YgYXJyYXlcbiAgICAgICAgICAgICAgICAgIGFjY1t2YWx1ZXNbMF1baV1dID0gY29lcmNlID09PSB0cnVlID8gaXNOYU4oK2N1cikgfHwgY3VyID09PSAnJyA/IGN1ciA6ICtjdXIgOiBjdXI7IFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0IGZvciBlbXB0eSBzdHJpbmdzIGJlZm9yZSBjb2VyY2luZyBiYyArJycgPT4gMFxuICAgICAgICAgICAgICAgIH0sIHt9KSk7XG4gICAgICAgICAgICAgICAgaWYgKCB0YWJJbmRleCA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51bm5lc3RlZCA9IHVubmVzdGVkO1xuICAgICAgICAgICAgICAgIH0gICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICggIW5lc3RCeSApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgbmVzdEJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbmVzdEJ5ID09PSAnZnVuY3Rpb24nICkgeyAvLyBpZSBvbmx5IG9uZSBuZXN0QnkgZmllbGQgb3IgZnVuY2l0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IHRoaXMubmVzdFByZWxpbShbbmVzdEJ5XSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkobmVzdEJ5KSkgeyB0aHJvdyAnbmVzdEJ5IHZhcmlhYmxlIG11c3QgYmUgYSBzdHJpbmcsIGZ1bmN0aW9uLCBvciBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucyc7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IHRoaXMubmVzdFByZWxpbShuZXN0QnkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICggbmVzdFR5cGUgPT09ICdvYmplY3QnICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRyaWVzKHVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5pdGlhbGl6ZUNoYXJ0cyhjb250YWluZXIpe1xuICAgICAgICAgICAgICAgIHZhciBncm91cCA9IHRoaXM7XG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KGNvbnRhaW5lcikuc2VsZWN0QWxsKCcuZDMtY2hhcnQnKVxuICAgICAgICAgICAgICAgICAgICAuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgZ3JvdXAuY2hpbGRyZW4ucHVzaChuZXcgQ2hhcnRzLkNoYXJ0RGl2KHRoaXMsIGdyb3VwKSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSAgICAgICAgXG4gICAgfTsgLy8gRDNDaGFydEdyb3VwIHByb3RvdHlwZSBlbmRzIGhlcmVcbiAgICBcbiAgICB3aW5kb3cuRDNDaGFydHMgPSB7IC8vIG5lZWQgdG8gc3BlY2lmeSB3aW5kb3cgYmMgYWZ0ZXIgdHJhbnNwaWxpbmcgYWxsIHRoaXMgd2lsbCBiZSB3cmFwcGVkIGluIElJRkVzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgYHJldHVybmBpbmcgd29uJ3QgZ2V0IHRoZSBleHBvcnQgaW50byB3aW5kb3cncyBnbG9iYWwgc2NvcGVcbiAgICAgICAgSW5pdCgpe1xuICAgICAgICAgICAgdmFyIGdyb3VwRGl2cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5kMy1ncm91cCcpO1xuICAgICAgICAgICAgZm9yICggbGV0IGkgPSAwOyBpIDwgZ3JvdXBEaXZzLmxlbmd0aDsgaSsrICl7XG4gICAgICAgICAgICAgICAgZ3JvdXBDb2xsZWN0aW9uLnB1c2gobmV3IEQzQ2hhcnRHcm91cChncm91cERpdnNbaV0sIGkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGdyb3VwQ29sbGVjdGlvbik7XG4gICAgICAgIH1cbiAgICB9O1xufSgpKTsgLy8gZW5kIHZhciBEM0NoYXJ0cyBJSUZFIiwiZXhwb3J0IGNvbnN0IENoYXJ0cyA9IChmdW5jdGlvbigpe1xuICAgIFxuICAgIHZhciBDaGFydERpdiA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgcGFyZW50KXtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gW107XG4gICAgICAgIHRoaXMuY29uZmlnID0gT2JqZWN0LmNyZWF0ZSggcGFyZW50LmNvbmZpZywgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcnMoIGNvbnRhaW5lci5kYXRhc2V0LmNvbnZlcnQoKSApICk7XG4gICAgICAgICAgICAvLyBsaW5lIGFib3ZlIGNyZWF0ZXMgYSBjb25maWcgb2JqZWN0IGZyb20gdGhlIEhUTUwgZGF0YXNldCBmb3IgdGhlIGNoYXJ0RGl2IGNvbnRhaW5lclxuICAgICAgICAgICAgLy8gdGhhdCBpbmhlcml0cyBmcm9tIHRoZSBwYXJlbnRzIGNvbmZpZyBvYmplY3QuIGFueSBjb25maWdzIG5vdCBzcGVjaWZpZWQgZm9yIHRoZSBjaGFydERpdiAoYW4gb3duIHByb3BlcnR5KVxuICAgICAgICAgICAgLy8gd2lsbCBjb21lIGZyb20gdXAgdGhlIGluaGVyaXRhbmNlIGNoYWluXG4gICAgICAgIHRoaXMuZGF0dW0gPSBwYXJlbnQuZGF0YS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IHRoaXMuY29uZmlnLmNhdGVnb3J5KTtcbiAgICAgICAgdGhpcy5zZXJpZXNHcm91cHMgPSB0aGlzLmdyb3VwU2VyaWVzKCk7XG4gICAgICAgIHRoaXMuZGljdGlvbmFyeSA9IHRoaXMucGFyZW50LmRpY3Rpb25hcnk7XG4gICAgICAgIHRoaXMuYWRkSGVhZGluZygpO1xuICAgICAgICB0aGlzLmNyZWF0ZUNoYXJ0cygpO1xuXG4gICAgfTtcbiAgICBcbiAgICBDaGFydERpdi5wcm90b3R5cGUgPSB7XG4gICAgICAgIGNoYXJ0VHlwZXM6IHtcbiAgICAgICAgICAgIGxpbmU6ICAgJ0xpbmVDaGFydCcsXG4gICAgICAgICAgICBjb2x1bW46ICdDb2x1bW5DaGFydCcsXG4gICAgICAgICAgICBiYXI6ICAgICdCYXJDaGFydCcgLy8gc28gb24gLiAuIC5cbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlQ2hhcnRzKCl7XG4gICAgICAgICAgICB0aGlzLnNlcmllc0dyb3Vwcy5mb3JFYWNoKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuLnB1c2gobmV3IExpbmVDaGFydCh0aGlzKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgZ3JvdXBTZXJpZXMoKXtcbiAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHMsXG4gICAgICAgICAgICAgICAgZ3JvdXBzSW5zdHJ1Y3QgPSB0aGlzLmNvbmZpZy5zZXJpZXNHcm91cCB8fCAnbm9uZSc7XG4gICAgICAgICAgICBpZiAoIEFycmF5LmlzQXJyYXkoIGdyb3Vwc0luc3RydWN0ICkgKSB7XG4gICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuc2VyaWVzR3JvdXAuZm9yRWFjaChncm91cCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3Vwcy5wdXNoKHRoaXMuZGF0dW0udmFsdWVzLmZpbHRlcihzZXJpZXMgPT4gZ3JvdXAuaW5kZXhPZihzZXJpZXMua2V5KSAhPT0gLTEpKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnbm9uZScgKSB7XG4gICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gdGhpcy5kYXR1bS52YWx1ZXMubWFwKGVhY2ggPT4gW2VhY2hdKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnYWxsJyApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbdGhpcy5kYXR1bS52YWx1ZXMubWFwKGVhY2ggPT4gZWFjaCldO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBgSW52YWxpZCBkYXRhLWdyb3VwLXNlcmllcyBpbnN0cnVjdGlvbiBmcm9tIGh0bWwuIFxuICAgICAgICAgICAgICAgICAgICAgICBNdXN0IGJlIHZhbGlkIEpTT046IFwiTm9uZVwiIG9yIFwiQWxsXCIgb3IgYW4gYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgICAgb2YgYXJyYXlzIGNvbnRhaW5pbmcgdGhlIHNlcmllcyB0byBiZSBncm91cGVkXG4gICAgICAgICAgICAgICAgICAgICAgIHRvZ2V0aGVyLiBBbGwgc3RyaW5ncyBtdXN0IGJlIGRvdWJsZS1xdW90ZWQuYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzZXJpZXNHcm91cHM7XG4gICAgICAgIH0sIC8vIGVuZCBncm91cFNlcmllcygpXG4gICAgICAgIGFkZEhlYWRpbmcoKXtcbiAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzLmNvbnRhaW5lcilcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdwJylcbiAgICAgICAgICAgICAgICAuaHRtbCgnPHN0cm9uZz4nICsgdGhpcy5sYWJlbCh0aGlzLmNvbmZpZy5jYXRlZ29yeSkgKyAnPC9zdHJvbmc+Jyk7XG4gICAgICAgIH0sXG4gICAgICAgIGxhYmVsKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbDtcbiAgICAgICAgfVxuXG4gICAgfTsgLy8gZW5kIExpbmVDaGFydC5wcm90b3R5cGVcblxuICAgIHZhciBMaW5lQ2hhcnQgPSBmdW5jdGlvbihwYXJlbnQpe1xuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBwYXJlbnQuY29uZmlnO1xuICAgICAgICB0aGlzLm1hcmdpblRvcCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5Ub3AgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy50b3A7XG4gICAgICAgIHRoaXMubWFyZ2luUmlnaHQgPSArdGhpcy5jb25maWcubWFyZ2luUmlnaHQgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5yaWdodDtcbiAgICAgICAgdGhpcy5tYXJnaW5Cb3R0b20gPSArdGhpcy5jb25maWcubWFyZ2luQm90dG9tIHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMuYm90dG9tO1xuICAgICAgICB0aGlzLm1hcmdpbkxlZnQgPSArdGhpcy5jb25maWcubWFyZ2luTGVmdCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLmxlZnQ7XG4gICAgICAgIHRoaXMud2lkdGggPSB0aGlzLmNvbmZpZy5zdmdXaWR0aCA/ICt0aGlzLmNvbmZpZy5zdmdXaWR0aCAtIHRoaXMubWFyZ2luUmlnaHQgLSB0aGlzLm1hcmdpbkxlZnQgOiAzMjAgLSB0aGlzLm1hcmdpblJpZ2h0IC0gdGhpcy5tYXJnaW5MZWZ0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IHRoaXMuY29uZmlnLnN2Z0hlaWdodCA/ICt0aGlzLmNvbmZpZy5zdmdIZWlnaHQgLSB0aGlzLm1hcmdpblRvcCAtIHRoaXMubWFyZ2luQm90dG9tIDogKCB0aGlzLndpZHRoICsgdGhpcy5tYXJnaW5SaWdodCArIHRoaXMubWFyZ2luTGVmdCApIC8gMiAtIHRoaXMubWFyZ2luVG9wIC0gdGhpcy5tYXJnaW5Cb3R0b207XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMpO1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IHRoaXMuaW5pdChwYXJlbnQuY29udGFpbmVyKTtcblxuICAgICAgICAvLyBUTyBETyBzZXQgbWF4LG1pbiwgZXRjIGZyb20gc3VtbWFyaWVzOyBzZXQgc2NhbGVzLCBldGMuIGFsbCB0aGF0IGNhbiBiZSBDaGFydCBwcm90b3R5cGUuXG4gICAgICAgIFxuICAgIH07XG5cbiAgICBMaW5lQ2hhcnQucHJvdG90eXBlID0ge1xuICAgICAgICBpbml0KGNoYXJ0RGl2KXtcbiAgICAgICAgICAgIHZhciBzdmcgPSAgZDMuc2VsZWN0KGNoYXJ0RGl2KVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3N2ZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3dpZHRoJywgdGhpcy53aWR0aCArIHRoaXMubWFyZ2luUmlnaHQgKyB0aGlzLm1hcmdpbkxlZnQgKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdoZWlnaHQnLCB0aGlzLmhlaWdodCAgKyB0aGlzLm1hcmdpblRvcCArIHRoaXMubWFyZ2luQm90dG9tICk7XG5cbiAgICAgICAgICAgIHN2Zy5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLGB0cmFuc2xhdGUoJHt0aGlzLm1hcmdpbkxlZnR9LCAke3RoaXMubWFyZ2luUmlnaHR9KWApO1xuXG4gICAgICAgICAgICByZXR1cm4gc3ZnLm5vZGUoKTtcbiAgICAgICAgfSxcbiAgICAgICAgZGVmYXVsdE1hcmdpbnM6IHtcbiAgICAgICAgICAgIHRvcDoyMCxcbiAgICAgICAgICAgIHJpZ2h0OjQ1LFxuICAgICAgICAgICAgYm90dG9tOjE1LFxuICAgICAgICAgICAgbGVmdDozNVxuICAgICAgICB9ICAgICAgICBcbiAgICB9O1xuXG5cbiAgICByZXR1cm4ge1xuICAgICAgICBDaGFydERpdlxuICAgIH07XG5cbn0pKCk7XG4iLCJleHBvcnQgY29uc3QgSGVscGVycyA9IChmdW5jdGlvbigpe1xuICAgIC8qIGdsb2JhbHMgRE9NU3RyaW5nTWFwICovXG4gICAgU3RyaW5nLnByb3RvdHlwZS5jbGVhblN0cmluZyA9IGZ1bmN0aW9uKCkgeyAvLyBsb3dlcmNhc2UgYW5kIHJlbW92ZSBwdW5jdHVhdGlvbiBhbmQgcmVwbGFjZSBzcGFjZXMgd2l0aCBoeXBoZW5zOyBkZWxldGUgcHVuY3R1YXRpb25cbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvWyBcXFxcXFwvXS9nLCctJykucmVwbGFjZSgvWydcIuKAneKAmeKAnOKAmCxcXC4hXFw/O1xcKFxcKSZdL2csJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgfTtcblxuICAgIFN0cmluZy5wcm90b3R5cGUucmVtb3ZlVW5kZXJzY29yZXMgPSBmdW5jdGlvbigpIHsgXG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL18vZywnICcpO1xuICAgIH07XG5cbiAgICBET01TdHJpbmdNYXAucHJvdG90eXBlLmNvbnZlcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG5ld09iaiA9IHt9O1xuICAgICAgICBmb3IgKCB2YXIga2V5IGluIHRoaXMgKXtcbiAgICAgICAgICAgIGlmICh0aGlzLmhhc093blByb3BlcnR5KGtleSkpe1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld09ialtrZXldID0gSlNPTi5wYXJzZSh0aGlzW2tleV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3T2JqW2tleV0gPSB0aGlzW2tleV07ICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdPYmo7XG4gICAgfTtcbn0pKCk7XG4iXX0=
