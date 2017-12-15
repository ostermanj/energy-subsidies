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
        } // end groupSeries()


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
        this.container = this.init(parent.container);
        console.log(this);
    };

    LineChart.prototype = {
        init: function init(chartDiv) {
            return d3.select(chartDiv).append('svg').attr('width', this.width + this.marginRight + this.marginLeft).attr('height', this.height + this.marginTop + this.marginBottom).node();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9DaGFydHMuanMiLCJqcy1leHBvcnRzL0hlbHBlcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0lBOztBQUNBOztBQUxDLGdDLENBQWlDO0FBQ2pDOztBQU1ELElBQUksV0FBWSxZQUFVOztBQUUxQjs7QUFFSSxRQUFJLGtCQUFrQixFQUF0QjtBQUNBLFFBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxTQUFULEVBQW9CLEtBQXBCLEVBQTBCO0FBQUE7O0FBQ3pDLGdCQUFRLEdBQVIsQ0FBWSxLQUFaO0FBQ0EsYUFBSyxTQUFMLEdBQWlCLFNBQWpCO0FBQ0EsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssTUFBTCxHQUFjLFVBQVUsT0FBVixDQUFrQixPQUFsQixFQUFkO0FBQ0EsZ0JBQVEsR0FBUixDQUFZLEtBQUssTUFBTCxDQUFZLE1BQVosQ0FBbUIsUUFBbkIsRUFBWjtBQUNBLGFBQUssWUFBTCxHQUFvQixLQUFLLGtCQUFMLENBQXdCLFNBQXhCLENBQXBCO0FBQ0EsYUFBSyxRQUFMLEdBQWdCLEVBQWhCO0FBQ0EsZ0JBQVEsR0FBUixDQUFZLEtBQUssWUFBakI7QUFDQTtBQUNBLGFBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixZQUFNO0FBQ3pCLGtCQUFLLGdCQUFMLENBQXNCLFNBQXRCO0FBQ0gsU0FGRDtBQUdILEtBYkQ7QUFjQTtBQUNBLGlCQUFhLFNBQWIsR0FBeUI7QUFFakIsMEJBRmlCLGdDQUVHO0FBQUE7O0FBQ2hCLGdCQUFJLGVBQWUsRUFBbkI7QUFDQSxnQkFBSSxVQUFVLEtBQUssTUFBTCxDQUFZLE9BQTFCO0FBQUEsZ0JBQ0ksT0FBTyxDQUFDLEtBQUssTUFBTCxDQUFZLE9BQWIsRUFBcUIsS0FBSyxNQUFMLENBQVksYUFBakMsQ0FEWCxDQUZnQixDQUc0QztBQUN4QjtBQUNwQyxp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LDJCQUFPLEdBQVAsSUFBYyxLQUFLLEtBQUwsQ0FBVyxLQUFLLEdBQUwsQ0FBWCxDQUFkO0FBQ0gsaUJBRkQsQ0FHQSxPQUFNLEdBQU4sRUFBVztBQUNQLDJCQUFPLEdBQVAsSUFBYyxLQUFLLEdBQUwsQ0FBZDtBQUNIO0FBQ0o7QUFDSjtBQUNELGVBQU8sTUFBUDtBQUNILEtBYkQ7QUFjSCxDQXhCc0IsRUFBaEIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiIC8qIGV4cG9ydGVkIEQzQ2hhcnRzLCBIZWxwZXJzICovIC8vIGxldCdzIGpzaGludCBrbm93IHRoYXQgRDNDaGFydHMgY2FuIGJlIFwiZGVmaW5lZCBidXQgbm90IHVzZWRcIiBpbiB0aGlzIGZpbGVcbiAvKiBwb2x5ZmlsbHMgbmVlZGVkOiBQcm9taXNlLCBBcnJheS5pc0FycmF5LCBBcnJheS5maW5kLCBBcnJheS5maWx0ZXJcblxuICovXG5pbXBvcnQgeyBIZWxwZXJzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9IZWxwZXJzJztcbmltcG9ydCB7IENoYXJ0cyB9IGZyb20gJy4uL2pzLWV4cG9ydHMvQ2hhcnRzJztcblxudmFyIEQzQ2hhcnRzID0gKGZ1bmN0aW9uKCl7XG5cblwidXNlIHN0cmljdFwiOyBcbiAgICBcbiAgICB2YXIgZ3JvdXBDb2xsZWN0aW9uID0gW107XG4gICAgdmFyIEQzQ2hhcnRHcm91cCA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgaW5kZXgpe1xuICAgICAgICBjb25zb2xlLmxvZyhpbmRleCk7XG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgICAgICB0aGlzLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIHRoaXMuY29uZmlnID0gY29udGFpbmVyLmRhdGFzZXQuY29udmVydCgpO1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmNvbmZpZy5uZXN0QnkudG9TdHJpbmcoKSk7XG4gICAgICAgIHRoaXMuZGF0YVByb21pc2VzID0gdGhpcy5yZXR1cm5EYXRhUHJvbWlzZXMoY29udGFpbmVyKTtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmRhdGFQcm9taXNlcyk7XG4gICAgICAgIC8vdGhpcy5jb250cm9sbGVyLmluaXRDb250cm9sbGVyKGNvbnRhaW5lciwgdGhpcy5tb2RlbCwgdGhpcy52aWV3KTtcbiAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMudGhlbigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmluaXRpYWxpemVDaGFydHMoY29udGFpbmVyKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICAvL3Byb3RvdHlwZSBiZWdpbnMgaGVyZVxuICAgIEQzQ2hhcnRHcm91cC5wcm90b3R5cGUgPSB7XG4gICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuRGF0YVByb21pc2VzKCl7IFxuICAgICAgICAgICAgICAgIHZhciBkYXRhUHJvbWlzZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgc2hlZXRJRCA9IHRoaXMuY29uZmlnLnNoZWV0SWQsIFxuICAgICAgICAgICAgICAgICAgICB0YWJzID0gW3RoaXMuY29uZmlnLmRhdGFUYWIsdGhpcy5jb25maWcuZGljdGlvbmFyeVRhYl07IC8vIHRoaXMgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaXMgdGhlcmUgYSBjYXNlIGZvciBtb3JlIHRoYW4gb25lIHNoZWV0IG9mIGRhdGE/XG4gICAgICAgICAgICAgICAgdGFicy5mb3JFYWNoKChlYWNoLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5qc29uKCdodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJyArIHNoZWV0SUQgKyAnL3ZhbHVlcy8nICsgZWFjaCArICc/a2V5PUFJemFTeUREM1c1d0plSkYyZXNmZlpNUXhOdEVsOXR0LU9mZ1NxNCcsIChlcnJvcixkYXRhKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlcyA9IGRhdGEudmFsdWVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXN0VHlwZSA9IGVhY2ggPT09ICdkaWN0aW9uYXJ5JyA/ICdvYmplY3QnIDogJ3Nlcmllcyc7IC8vIG5lc3RUeXBlIGZvciBkYXRhIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXN0QnkgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyBmYWxzZSA6IHRoaXMuY29uZmlnLm5lc3RCeTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMucmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbmVzdEJ5LCB0cnVlLCBuZXN0VHlwZSwgaSkpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgUHJvbWlzZS5hbGwoZGF0YVByb21pc2VzKS50aGVuKHZhbHVlcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YSA9IHZhbHVlc1swXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kaWN0aW9uYXJ5ID0gdmFsdWVzWzFdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN1bW1hcmllcyA9IHRoaXMuc3VtbWFyaXplRGF0YSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChkYXRhUHJvbWlzZXMpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN1bW1hcml6ZURhdGEoKXsgLy8gdGhpcyBmbiBjcmVhdGVzIGFuIGFycmF5IG9mIG9iamVjdHMgc3VtbWFyaXppbmcgdGhlIGRhdGEgaW4gbW9kZWwuZGF0YS4gbW9kZWwuZGF0YSBpcyBuZXN0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIG5lc3RpbmcgYW5kIHJvbGxpbmcgdXAgY2Fubm90IGJlIGRvbmUgZWFzaWx5IGF0IHRoZSBzYW1lIHRpbWUsIHNvIHRoZXkncmUgZG9uZSBzZXBhcmF0ZWx5LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgc3VtbWFyaWVzIHByb3ZpZGUgYXZlcmFnZSwgbWF4LCBtaW4gb2YgYWxsIGZpZWxkcyBpbiB0aGUgZGF0YSBhdCBhbGwgbGV2ZWxzIG9mIG5lc3RpbmcuIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgZmlyc3QgKGluZGV4IDApIGlzIG9uZSBsYXllciBuZXN0ZWQsIHRoZSBzZWNvbmQgaXMgdHdvLCBhbmQgc28gb24uXG4gICAgICAgICAgICAgICAgdmFyIHN1bW1hcmllcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciB2YXJpYWJsZXMgPSBPYmplY3Qua2V5cyh0aGlzLnVubmVzdGVkWzBdKTsgLy8gYWxsIG5lZWQgdG8gaGF2ZSB0aGUgc2FtZSBmaWVsZHNcbiAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5ID0gdGhpcy5jb25maWcubmVzdEJ5ID8gdGhpcy5jb25maWcubmVzdEJ5Lm1hcChlYWNoID0+IGVhY2gpIDogZmFsc2U7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVzZXMgbWFwIHRvIGNyZWF0ZSBuZXcgYXJyYXkgcmF0aGVyIHRoYW4gYXNzaWduaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYnkgcmVmZXJlbmNlLiB0aGUgYHBvcCgpYCBiZWxvdyB3b3VsZCBhZmZlY3Qgb3JpZ2luYWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhcnJheSBpZiBkb25lIGJ5IHJlZmVyZW5jZVxuICAgICAgICAgICAgICAgIHZhciBuZXN0QnlBcnJheSA9IEFycmF5LmlzQXJyYXkobmVzdEJ5KSA/IG5lc3RCeSA6IFtuZXN0QnldO1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHJlZHVjZVZhcmlhYmxlcyhkKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhcmlhYmxlcy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjW2N1cl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4OiAgICAgICBkMy5tYXgoZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbjogICAgICAgZDMubWluKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZWFuOiAgICAgIGQzLm1lYW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1bTogICAgICAgZDMuc3VtKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZWRpYW46ICAgIGQzLm1lZGlhbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFuY2U6ICBkMy52YXJpYW5jZShkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWF0aW9uOiBkMy5kZXZpYXRpb24oZCwgZCA9PiBkW2N1cl0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgICAgICAgICAgICAgfSx7fSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHdoaWxlICggbmVzdEJ5QXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgc3VtbWFyaXplZCA9IHRoaXMubmVzdFByZWxpbShuZXN0QnlBcnJheSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yb2xsdXAocmVkdWNlVmFyaWFibGVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh0aGlzLnVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICAgICAgc3VtbWFyaWVzLnVuc2hpZnQoc3VtbWFyaXplZCk7ICAgICAgXG4gICAgICAgICAgICAgICAgICAgIG5lc3RCeUFycmF5LnBvcCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gc3VtbWFyaWVzO1xuICAgICAgICAgICAgfSwgXG4gICAgICAgICAgICBuZXN0UHJlbGltKG5lc3RCeUFycmF5KXtcbiAgICAgICAgICAgICAgICAvLyByZWN1cnNpdmUgIG5lc3RpbmcgZnVuY3Rpb24gdXNlZCBieSBzdW1tYXJpemVEYXRhIGFuZCByZXR1cm5LZXlWYWx1ZXNcbiAgICAgICAgICAgICAgICByZXR1cm4gbmVzdEJ5QXJyYXkucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXIgIT09ICdzdHJpbmcnICYmIHR5cGVvZiBjdXIgIT09ICdmdW5jdGlvbicgKSB7IHRocm93ICdlYWNoIG5lc3RCeSBpdGVtIG11c3QgYmUgYSBzdHJpbmcgb3IgZnVuY3Rpb24nOyB9XG4gICAgICAgICAgICAgICAgICAgIHZhciBydG47XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ3N0cmluZycgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ0biA9IGFjYy5rZXkoZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRbY3VyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pOyAgICBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdmdW5jdGlvbicgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ0biA9IGFjYy5rZXkoZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN1cihkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBydG47XG4gICAgICAgICAgICAgICAgfSwgZDMubmVzdCgpKTtcbiAgICAgICAgICAgIH0sICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbmVzdEJ5LCBjb2VyY2UgPSBmYWxzZSwgbmVzdFR5cGUgPSAnc2VyaWVzJywgdGFiSW5kZXggPSAwKXtcbiAgICAgICAgICAgIC8vIHRoaXMgZm4gdGFrZXMgbm9ybWFsaXplZCBkYXRhIGZldGNoZWQgYXMgYW4gYXJyYXkgb2Ygcm93cyBhbmQgdXNlcyB0aGUgdmFsdWVzIGluIHRoZSBmaXJzdCByb3cgYXMga2V5cyBmb3IgdmFsdWVzIGluXG4gICAgICAgICAgICAvLyBzdWJzZXF1ZW50IHJvd3NcbiAgICAgICAgICAgIC8vIG5lc3RCeSA9IHN0cmluZyBvciBhcnJheSBvZiBmaWVsZChzKSB0byBuZXN0IGJ5LCBvciBhIGN1c3RvbSBmdW5jdGlvbiwgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnM7XG4gICAgICAgICAgICAvLyBjb2VyY2UgPSBCT09MIGNvZXJjZSB0byBudW0gb3Igbm90OyBuZXN0VHlwZSA9IG9iamVjdCBvciBzZXJpZXMgbmVzdCAoZDMpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHByZWxpbTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgdW5uZXN0ZWQgPSB2YWx1ZXMuc2xpY2UoMSkubWFwKHJvdyA9PiByb3cucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyLCBpKSB7IFxuICAgICAgICAgICAgICAgIC8vIDEuIHBhcmFtczogdG90YWwsIGN1cnJlbnRWYWx1ZSwgY3VycmVudEluZGV4WywgYXJyXVxuICAgICAgICAgICAgICAgIC8vIDMuIC8vIGFjYyBpcyBhbiBvYmplY3QgLCBrZXkgaXMgY29ycmVzcG9uZGluZyB2YWx1ZSBmcm9tIHJvdyAwLCB2YWx1ZSBpcyBjdXJyZW50IHZhbHVlIG9mIGFycmF5XG4gICAgICAgICAgICAgICAgICBhY2NbdmFsdWVzWzBdW2ldXSA9IGNvZXJjZSA9PT0gdHJ1ZSA/IGlzTmFOKCtjdXIpIHx8IGN1ciA9PT0gJycgPyBjdXIgOiArY3VyIDogY3VyOyBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGVzdCBmb3IgZW1wdHkgc3RyaW5ncyBiZWZvcmUgY29lcmNpbmcgYmMgKycnID0+IDBcbiAgICAgICAgICAgICAgICB9LCB7fSkpO1xuICAgICAgICAgICAgICAgIGlmICggdGFiSW5kZXggPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudW5uZXN0ZWQgPSB1bm5lc3RlZDtcbiAgICAgICAgICAgICAgICB9ICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoICFuZXN0QnkgKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVubmVzdGVkO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIG5lc3RCeSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG5lc3RCeSA9PT0gJ2Z1bmN0aW9uJyApIHsgLy8gaWUgb25seSBvbmUgbmVzdEJ5IGZpZWxkIG9yIGZ1bmNpdG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSB0aGlzLm5lc3RQcmVsaW0oW25lc3RCeV0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG5lc3RCeSkpIHsgdGhyb3cgJ25lc3RCeSB2YXJpYWJsZSBtdXN0IGJlIGEgc3RyaW5nLCBmdW5jdGlvbiwgb3IgYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnMnOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSB0aGlzLm5lc3RQcmVsaW0obmVzdEJ5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIG5lc3RUeXBlID09PSAnb2JqZWN0JyApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJlbGltXG4gICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJlbGltXG4gICAgICAgICAgICAgICAgICAgICAgICAuZW50cmllcyh1bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGluaXRpYWxpemVDaGFydHMoY29udGFpbmVyKXtcbiAgICAgICAgICAgICAgICB2YXIgZ3JvdXAgPSB0aGlzO1xuICAgICAgICAgICAgICAgIGQzLnNlbGVjdChjb250YWluZXIpLnNlbGVjdEFsbCgnLmQzLWNoYXJ0JylcbiAgICAgICAgICAgICAgICAgICAgLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyb3VwLmNoaWxkcmVuLnB1c2gobmV3IENoYXJ0cy5DaGFydERpdih0aGlzLCBncm91cCkpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gICAgICAgIFxuICAgIH07IC8vIEQzQ2hhcnRHcm91cCBwcm90b3R5cGUgZW5kcyBoZXJlXG4gICAgXG4gICAgd2luZG93LkQzQ2hhcnRzID0geyAvLyBuZWVkIHRvIHNwZWNpZnkgd2luZG93IGJjIGFmdGVyIHRyYW5zcGlsaW5nIGFsbCB0aGlzIHdpbGwgYmUgd3JhcHBlZCBpbiBJSUZFc1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGByZXR1cm5gaW5nIHdvbid0IGdldCB0aGUgZXhwb3J0IGludG8gd2luZG93J3MgZ2xvYmFsIHNjb3BlXG4gICAgICAgIEluaXQoKXtcbiAgICAgICAgICAgIHZhciBncm91cERpdnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZDMtZ3JvdXAnKTtcbiAgICAgICAgICAgIGZvciAoIGxldCBpID0gMDsgaSA8IGdyb3VwRGl2cy5sZW5ndGg7IGkrKyApe1xuICAgICAgICAgICAgICAgIGdyb3VwQ29sbGVjdGlvbi5wdXNoKG5ldyBEM0NoYXJ0R3JvdXAoZ3JvdXBEaXZzW2ldLCBpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhncm91cENvbGxlY3Rpb24pO1xuICAgICAgICB9XG4gICAgfTtcbn0oKSk7IC8vIGVuZCB2YXIgRDNDaGFydHMgSUlGRSIsImV4cG9ydCBjb25zdCBDaGFydHMgPSAoZnVuY3Rpb24oKXtcbiAgICBcbiAgICB2YXIgQ2hhcnREaXYgPSBmdW5jdGlvbihjb250YWluZXIsIHBhcmVudCl7XG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgICAgICB0aGlzLmNvbmZpZyA9IE9iamVjdC5jcmVhdGUoIHBhcmVudC5jb25maWcsIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKCBjb250YWluZXIuZGF0YXNldC5jb252ZXJ0KCkgKSApO1xuICAgICAgICAgICAgLy8gbGluZSBhYm92ZSBjcmVhdGVzIGEgY29uZmlnIG9iamVjdCBmcm9tIHRoZSBIVE1MIGRhdGFzZXQgZm9yIHRoZSBjaGFydERpdiBjb250YWluZXJcbiAgICAgICAgICAgIC8vIHRoYXQgaW5oZXJpdHMgZnJvbSB0aGUgcGFyZW50cyBjb25maWcgb2JqZWN0LiBhbnkgY29uZmlncyBub3Qgc3BlY2lmaWVkIGZvciB0aGUgY2hhcnREaXYgKGFuIG93biBwcm9wZXJ0eSlcbiAgICAgICAgICAgIC8vIHdpbGwgY29tZSBmcm9tIHVwIHRoZSBpbmhlcml0YW5jZSBjaGFpblxuICAgICAgICB0aGlzLmRhdHVtID0gcGFyZW50LmRhdGEuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSB0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgIHRoaXMuc2VyaWVzR3JvdXBzID0gdGhpcy5ncm91cFNlcmllcygpO1xuICAgICAgICB0aGlzLmNyZWF0ZUNoYXJ0cygpO1xuXG4gICAgfTtcbiAgICBcbiAgICBDaGFydERpdi5wcm90b3R5cGUgPSB7XG4gICAgICAgIGNoYXJ0VHlwZXM6IHtcbiAgICAgICAgICAgIGxpbmU6ICAgJ0xpbmVDaGFydCcsXG4gICAgICAgICAgICBjb2x1bW46ICdDb2x1bW5DaGFydCcsXG4gICAgICAgICAgICBiYXI6ICAgICdCYXJDaGFydCcgLy8gc28gb24gLiAuIC5cbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlQ2hhcnRzKCl7XG4gICAgICAgICAgICB0aGlzLnNlcmllc0dyb3Vwcy5mb3JFYWNoKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuLnB1c2gobmV3IExpbmVDaGFydCh0aGlzKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgZ3JvdXBTZXJpZXMoKXtcbiAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHMsXG4gICAgICAgICAgICAgICAgZ3JvdXBzSW5zdHJ1Y3QgPSB0aGlzLmNvbmZpZy5zZXJpZXNHcm91cCB8fCAnbm9uZSc7XG4gICAgICAgICAgICBpZiAoIEFycmF5LmlzQXJyYXkoIGdyb3Vwc0luc3RydWN0ICkgKSB7XG4gICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuc2VyaWVzR3JvdXAuZm9yRWFjaChncm91cCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3Vwcy5wdXNoKHRoaXMuZGF0dW0udmFsdWVzLmZpbHRlcihzZXJpZXMgPT4gZ3JvdXAuaW5kZXhPZihzZXJpZXMua2V5KSAhPT0gLTEpKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnbm9uZScgKSB7XG4gICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gdGhpcy5kYXR1bS52YWx1ZXMubWFwKGVhY2ggPT4gW2VhY2hdKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnYWxsJyApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbdGhpcy5kYXR1bS52YWx1ZXMubWFwKGVhY2ggPT4gZWFjaCldO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBgSW52YWxpZCBkYXRhLWdyb3VwLXNlcmllcyBpbnN0cnVjdGlvbiBmcm9tIGh0bWwuIFxuICAgICAgICAgICAgICAgICAgICAgICBNdXN0IGJlIHZhbGlkIEpTT046IFwiTm9uZVwiIG9yIFwiQWxsXCIgb3IgYW4gYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgICAgb2YgYXJyYXlzIGNvbnRhaW5pbmcgdGhlIHNlcmllcyB0byBiZSBncm91cGVkXG4gICAgICAgICAgICAgICAgICAgICAgIHRvZ2V0aGVyLiBBbGwgc3RyaW5ncyBtdXN0IGJlIGRvdWJsZS1xdW90ZWQuYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzZXJpZXNHcm91cHM7XG4gICAgICAgIH0gLy8gZW5kIGdyb3VwU2VyaWVzKClcblxuXG4gICAgfTsgLy8gZW5kIExpbmVDaGFydC5wcm90b3R5cGVcblxuICAgIHZhciBMaW5lQ2hhcnQgPSBmdW5jdGlvbihwYXJlbnQpe1xuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBwYXJlbnQuY29uZmlnO1xuICAgICAgICB0aGlzLm1hcmdpblRvcCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5Ub3AgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy50b3A7XG4gICAgICAgIHRoaXMubWFyZ2luUmlnaHQgPSArdGhpcy5jb25maWcubWFyZ2luUmlnaHQgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5yaWdodDtcbiAgICAgICAgdGhpcy5tYXJnaW5Cb3R0b20gPSArdGhpcy5jb25maWcubWFyZ2luQm90dG9tIHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMuYm90dG9tO1xuICAgICAgICB0aGlzLm1hcmdpbkxlZnQgPSArdGhpcy5jb25maWcubWFyZ2luTGVmdCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLmxlZnQ7XG4gICAgICAgIHRoaXMud2lkdGggPSB0aGlzLmNvbmZpZy5zdmdXaWR0aCA/ICt0aGlzLmNvbmZpZy5zdmdXaWR0aCAtIHRoaXMubWFyZ2luUmlnaHQgLSB0aGlzLm1hcmdpbkxlZnQgOiAzMjAgLSB0aGlzLm1hcmdpblJpZ2h0IC0gdGhpcy5tYXJnaW5MZWZ0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IHRoaXMuY29uZmlnLnN2Z0hlaWdodCA/ICt0aGlzLmNvbmZpZy5zdmdIZWlnaHQgLSB0aGlzLm1hcmdpblRvcCAtIHRoaXMubWFyZ2luQm90dG9tIDogKCB0aGlzLndpZHRoICsgdGhpcy5tYXJnaW5SaWdodCArIHRoaXMubWFyZ2luTGVmdCApIC8gMiAtIHRoaXMubWFyZ2luVG9wIC0gdGhpcy5tYXJnaW5Cb3R0b207XG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gdGhpcy5pbml0KHBhcmVudC5jb250YWluZXIpO1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzKTtcbiAgICAgICAgXG4gICAgfTtcblxuICAgIExpbmVDaGFydC5wcm90b3R5cGUgPSB7XG4gICAgICAgIGluaXQoY2hhcnREaXYpe1xuICAgICAgICAgICAgcmV0dXJuIGQzLnNlbGVjdChjaGFydERpdilcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdzdmcnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIHRoaXMud2lkdGggKyB0aGlzLm1hcmdpblJpZ2h0ICsgdGhpcy5tYXJnaW5MZWZ0IClcbiAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgdGhpcy5oZWlnaHQgICsgdGhpcy5tYXJnaW5Ub3AgKyB0aGlzLm1hcmdpbkJvdHRvbSApXG4gICAgICAgICAgICAgICAgLm5vZGUoKTtcbiAgICAgICAgfSxcbiAgICAgICAgZGVmYXVsdE1hcmdpbnM6IHtcbiAgICAgICAgICAgIHRvcDoyMCxcbiAgICAgICAgICAgIHJpZ2h0OjQ1LFxuICAgICAgICAgICAgYm90dG9tOjE1LFxuICAgICAgICAgICAgbGVmdDozNVxuICAgICAgICB9XG4gICAgfTtcblxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgQ2hhcnREaXZcbiAgICB9O1xuXG59KSgpO1xuIiwiZXhwb3J0IGNvbnN0IEhlbHBlcnMgPSAoZnVuY3Rpb24oKXtcbiAgICAvKiBnbG9iYWxzIERPTVN0cmluZ01hcCAqL1xuICAgIFN0cmluZy5wcm90b3R5cGUuY2xlYW5TdHJpbmcgPSBmdW5jdGlvbigpIHsgLy8gbG93ZXJjYXNlIGFuZCByZW1vdmUgcHVuY3R1YXRpb24gYW5kIHJlcGxhY2Ugc3BhY2VzIHdpdGggaHlwaGVuczsgZGVsZXRlIHB1bmN0dWF0aW9uXG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL1sgXFxcXFxcL10vZywnLScpLnJlcGxhY2UoL1snXCLigJ3igJnigJzigJgsXFwuIVxcPztcXChcXCkmXS9nLCcnKS50b0xvd2VyQ2FzZSgpO1xuICAgIH07XG5cbiAgICBTdHJpbmcucHJvdG90eXBlLnJlbW92ZVVuZGVyc2NvcmVzID0gZnVuY3Rpb24oKSB7IFxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9fL2csJyAnKTtcbiAgICB9O1xuXG4gICAgRE9NU3RyaW5nTWFwLnByb3RvdHlwZS5jb252ZXJ0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBuZXdPYmogPSB7fTtcbiAgICAgICAgZm9yICggdmFyIGtleSBpbiB0aGlzICl7XG4gICAgICAgICAgICBpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eShrZXkpKXtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBuZXdPYmpba2V5XSA9IEpTT04ucGFyc2UodGhpc1trZXldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld09ialtrZXldID0gdGhpc1trZXldOyAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3T2JqO1xuICAgIH07XG59KSgpO1xuIl19
