(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _Helpers = require('../js-exports/Helpers');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; } /* exported D3Charts, Helpers */ // let's jshint know that D3Charts can be "defined but not used" in this file
/* polyfills needed: Promise, Array.isArray, Array.find, Array.filter
 */


var D3Charts = function () {
    "use strict";

    var chartCollection = [];
    var D3ChartGroup = function D3ChartGroup(container, index) {
        console.log(index);
        this.container = container;
        this.index = index;
        this.config = container.dataset;
        this.dataPromises = this.returnDataPromises(container);
        console.log(this.dataPromises);
        //this.controller.initController(container, this.model, this.view);
    };
    //prototype begins here
    D3ChartGroup.prototype = {
        returnDataPromises: function returnDataPromises() {
            var _this = this;

            // SHOULD THIS STUFF BE IN CONTROLLER? yes, probably
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
                        var nestBy = each === 'dictionary' ? false : _this.nestBy;
                        resolve(_this.returnKeyValues(values, nestBy, true, nestType, i));
                    });
                });
                dataPromises.push(promise);
            });
            Promise.all(dataPromises).then(function (values) {
                _this.data = values[0];
                _this.dictionary = values[1];
                _this.summaries = _this.summarizeData();
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
            var nestBy = this.config.nestBy ? JSON.parse(this.config.nestBy) : false;
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


        view: {
            init: function init(container, model) {
                this.margins = { // default values ; can be set be each SVGs DOM dataset (html data attributes).
                    // ALSO default should be able to come from HTML
                    top: 20,
                    right: 45,
                    bottom: 15,
                    left: 35
                };
                this.activeField = 'pb25l'; // this should come from HTML
                this.setupCharts(container, model);
            },
            label: function label(model, key) {
                // if you can get the summary values to be keyed all the way down, you wouldn't need Array.find
                return model.dictionary.find(function (each) {
                    return each.key === key;
                }).label;
            },
            setupCharts: function setupCharts(container, model) {
                var view = this;
                var chartDivs = d3.select(container).selectAll('.d3-chart');

                chartDivs.each(function () {
                    // TO DO differentiate chart types from html dataset
                    /* chartDivs.each scoped globals */
                    // ** TO DO ** allow data attr strings to be quoted only once. ie JSON.parse only if string includes / starts with []

                    var config = this.dataset,
                        scaleInstruct = config.resetScale ? JSON.parse(config.resetScale) : 'none',
                        lineIndex = 0,
                        seriesIndex = 0,
                        marginTop = +config.marginTop || view.margins.top,
                        marginRight = +config.marginRight || view.margins.right,
                        marginBottom = +config.marginBottom || view.margins.bottom,
                        marginLeft = +config.marginLeft || view.margins.left,
                        width = config.eachWidth - marginLeft - marginRight,
                        height = config.eachHeight ? config.eachHeight - marginTop - marginBottom : config.eachWidth / 2 - marginTop - marginBottom,
                        datum = model.data.find(function (each) {
                        return each.key === config.category;
                    }),
                        minX = 2015,
                        // !!! NOT PROGRAMATIC
                    maxX = 2045,
                        // !!! NOT PROGRAMATIC
                    // BELOW needs input from HTML--default maxes and mins in case natural min > 0, max < 0, or simply want to override
                    minY = model.summaries[0][datum.key][view.activeField + '_value'].min < 0 ? model.summaries[0][datum.key][view.activeField + '_value'].min : 0,
                        maxY = model.summaries[0][datum.key][view.activeField + '_value'].max > Math.abs(minY / 2) ? model.summaries[0][datum.key][view.activeField + '_value'].max : Math.abs(minY / 2),
                        parseTime = d3.timeParse('%Y'),
                        // !!! NOT PROGRAMATIC
                    x = d3.scaleTime().range([0, width]).domain([parseTime(minX), parseTime(maxX)]),
                        // !!! NOT PROGRAMATIC
                    y = d3.scaleLinear().range([height, 0]).domain([minY, maxY]),
                        // !!! NOT PROGRAMATIC
                    chartDiv = d3.select(this).datum(datum),
                        headings = chartDiv.append('p'),
                        SVGs = chartDiv.append('div').attr('class', 'flex').selectAll('SVGs').data(function (d) {
                        return groupSeries(d.values);
                    }).enter().append('svg').attr('width', config.eachWidth).attr('height', height + marginTop + marginBottom).append('g').attr('transform', 'translate(' + marginLeft + ',' + marginTop + ')'),
                        valueline = d3.line().x(function (d) {
                        return x(parseTime(d.year));
                    }) // !! not programmatic
                    .y(function (d) {
                        return y(d[view.activeField + '_value']);
                    }); // !! not programmatic

                    function groupSeries(data) {
                        var seriesGroups,
                            groupsInstruct = config.seriesGroup ? JSON.parse(config.seriesGroup) : 'none';
                        if (Array.isArray(groupsInstruct)) {
                            seriesGroups = [];
                            JSON.parse(config.seriesGroup).forEach(function (group) {
                                seriesGroups.push(data.filter(function (series) {
                                    return group.indexOf(series.key) !== -1;
                                }));
                            });
                        } else if (groupsInstruct === 'none') {
                            seriesGroups = data.map(function (each) {
                                return [each];
                            });
                        } else if (groupsInstruct === 'all') {
                            seriesGroups = [data.map(function (each) {
                                return each;
                            })];
                        } else {
                            throw 'Invalid data-group-series instruction from html. \n                                   Must be valid JSON: "None" or "All" or an array\n                                   of arrays containing the series to be grouped\n                                   together. All strings must be double-quoted.';
                        }
                        return seriesGroups;
                    } // end groupSeries()


                    /* HEADINGS */
                    headings.html(function (d) {
                        return '<strong>' + view.label(model, d.key) + '</strong>';
                    });

                    /* SVGS */

                    SVGs.each(function (d, i) {
                        var _this2 = this;

                        var SVG = d3.select(this),
                            data = SVG.data(),
                            units,
                            seriesGroups = SVG.selectAll('series-groups').data(data).enter().append('g');

                        function addYAxis() {
                            var repeated = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
                            var showUnits = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
                            // !! NOT PROGRAMMATIC
                            /* jshint validthis: true */ /* <- comment keeps jshint from falsely warning that
                                                               `this` will be undefined. the .call() method
                                                               defines `this` */
                            d3.select(this).append('g').attr('class', function () {
                                return 'axis y-axis ' + repeated;
                            }).call(d3.axisLeft(y).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5));

                            if (showUnits) {

                                d3.select(this).append('text').attr('class', 'units').attr('transform', function () {
                                    return 'translate(-' + marginLeft + ',-' + (marginTop - 10) + ')';
                                }).text(function () {
                                    return units.removeUnderscores();
                                });
                            }
                        }

                        /* PATHS */

                        if (config.type === 'line') {
                            seriesGroups // !! NOT PROGRAMMATIC , IE, TYPE NEEDS TO BE SPECIFIED BY config.type
                            .selectAll('series').data(function (d) {
                                return d;
                            }).enter().append('path').attr('class', function () {
                                return 'line line-' + lineIndex++;
                            }).attr('d', function (d, j) {
                                units = d.values[1].units;
                                if (scaleInstruct.indexOf(d.key) !== -1) {
                                    // TODO: resetting scale make the series min,max from the
                                    // series' own data, not the one it's grouped with 
                                    /* NOT PROGRAMMATIC */minY = model.summaries[1][datum.key][d.key][view.activeField + '_value'].min < 0 ? model.summaries[1][datum.key][d.key][view.activeField + '_value'].min : 0;
                                    /* NOT PROGRAMMATIC */maxY = model.summaries[1][datum.key][d.key][view.activeField + '_value'].max > Math.abs(minY / 2) ? model.summaries[1][datum.key][d.key][view.activeField + '_value'].max : Math.abs(minY / 2);
                                    x = d3.scaleTime().range([0, width]).domain([parseTime(minX), parseTime(maxX)]);
                                    y = d3.scaleLinear().range([height, 0]).domain([minY, maxY]);
                                    if (i !== 0 && j === 0) {
                                        addYAxis.call(_this2, '', true);
                                    }
                                } else if (i !== 0 && j === 0) {
                                    addYAxis.call(_this2, 'repeated');
                                }
                                d.values.unshift(_defineProperty({ year: 2015 }, view.activeField + '_value', 0)); //TO DO: put in data
                                return valueline(d.values);
                            }).each(function (d) {
                                // var data = d3.select(this).data();
                                if (config.directLabel) {
                                    SVG.append('text').attr('class', function () {
                                        return 'series-label series-' + seriesIndex++;
                                    }).html(function () {
                                        return '<tspan x="0">' + view.label(d.key).replace(/\\n/g, '</tspan><tspan x="0" dy="1.2em">') + '</tspan>';
                                    }).attr('transform', function () {
                                        return 'translate(' + (width + 3) + ',' + (y(d.values[d.values.length - 1][view.activeField + '_value']) + 3) + ')';
                                    });
                                }
                            });

                            /* X AXIS */

                            SVG.append('g').attr('transform', 'translate(0,' + y(0) + ')').attr('class', 'axis x-axis').call(d3.axisBottom(x).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).tickValues([parseTime(2025), parseTime(2035), parseTime(2045)]));

                            /* Y AXIS */
                            if (i === 0) {
                                // i here is from the SVG.each loop. append yAxis to all first SVGs of chartDiv
                                addYAxis.call(this, '', true);
                            }
                        } // end if type === 'line'
                    }); // end SVGs.each()
                }); // end chartDivs.each()
            } // end view.setupCharts()

        }, // end view

        controller: {
            initController: function initController(container, model) {
                //, view){
                model.init(container).then(function (values) {
                    console.log(values);
                    model.data = values[0];
                    //  model.dictionary = values[1].undefined.undefined; // !! NOT PROGRAMMATIC / CONSISTENT
                    //  model.summarizeData();
                    //   view.init(container, model);
                });
            }
        }
    }; // D3ChartGroup prototype ends here

    window.D3Charts = {
        // need to specify window bc after transpiling all this will be wrapped in IIFEs
        // and `return`ing won't get the export into window's global scope
        Init: function Init() {
            var groupDivs = document.querySelectorAll('.d3-group');
            for (var i = 0; i < groupDivs.length; i++) {
                chartCollection.push(new D3ChartGroup(groupDivs[i], i));
            }
            console.log(chartCollection);
        }
    };
}(); // end var D3Charts IIFE

},{"../js-exports/Helpers":2}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var Helpers = exports.Helpers = function () {

    String.prototype.cleanString = function () {
        // lowercase and remove punctuation and replace spaces with hyphens; delete punctuation
        return this.replace(/[ \\\/]/g, '-').replace(/['"”’“‘,\.!\?;\(\)&]/g, '').toLowerCase();
    };

    String.prototype.removeUnderscores = function () {
        return this.replace(/_/g, ' ');
    };
}();

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9IZWxwZXJzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNJQTs7a05BSkMsZ0MsQ0FBaUM7QUFDakM7Ozs7QUFLRCxJQUFJLFdBQVksWUFBVTtBQUMxQjs7QUFFSSxRQUFJLGtCQUFrQixFQUF0QjtBQUNBLFFBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxTQUFULEVBQW9CLEtBQXBCLEVBQTBCO0FBQ3pDLGdCQUFRLEdBQVIsQ0FBWSxLQUFaO0FBQ0EsYUFBSyxTQUFMLEdBQWlCLFNBQWpCO0FBQ0EsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssTUFBTCxHQUFjLFVBQVUsT0FBeEI7QUFDQSxhQUFLLFlBQUwsR0FBb0IsS0FBSyxrQkFBTCxDQUF3QixTQUF4QixDQUFwQjtBQUNBLGdCQUFRLEdBQVIsQ0FBWSxLQUFLLFlBQWpCO0FBQ0E7QUFDSCxLQVJEO0FBU0E7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBRWpCLDBCQUZpQixnQ0FFRztBQUFBOztBQUFFO0FBQ2xCLGdCQUFJLGVBQWUsRUFBbkI7QUFDQSxnQkFBSSxVQUFVLEtBQUssTUFBTCxDQUFZLE9BQTFCO0FBQUEsZ0JBQ0ksT0FBTyxDQUFDLEtBQUssTUFBTCxDQUFZLE9BQWIsRUFBcUIsS0FBSyxNQUFMLENBQVksYUFBakMsQ0FEWCxDQUZnQixDQUc0QztBQUN4QjtBQUNwQyxpQkFBSyxPQUFMLENBQWEsVUFBQyxJQUFELEVBQU8sQ0FBUCxFQUFhO0FBQ3RCLG9CQUFJLFVBQVUsSUFBSSxPQUFKLENBQVksVUFBQyxPQUFELEVBQVMsTUFBVCxFQUFvQjtBQUMxQyx1QkFBRyxJQUFILENBQVEsbURBQW1ELE9BQW5ELEdBQTZELFVBQTdELEdBQTBFLElBQTFFLEdBQWlGLDhDQUF6RixFQUF5SSxVQUFDLEtBQUQsRUFBTyxJQUFQLEVBQWdCO0FBQ3JK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QUFDSCxLQUZEOztBQUlBLFdBQU8sU0FBUCxDQUFpQixpQkFBakIsR0FBcUMsWUFBVztBQUM1QyxlQUFPLEtBQUssT0FBTCxDQUFhLElBQWIsRUFBa0IsR0FBbEIsQ0FBUDtBQUNILEtBRkQ7QUFJSCxDQVZzQixFQUFoQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIgLyogZXhwb3J0ZWQgRDNDaGFydHMsIEhlbHBlcnMgKi8gLy8gbGV0J3MganNoaW50IGtub3cgdGhhdCBEM0NoYXJ0cyBjYW4gYmUgXCJkZWZpbmVkIGJ1dCBub3QgdXNlZFwiIGluIHRoaXMgZmlsZVxuIC8qIHBvbHlmaWxscyBuZWVkZWQ6IFByb21pc2UsIEFycmF5LmlzQXJyYXksIEFycmF5LmZpbmQsIEFycmF5LmZpbHRlclxuXG4gKi9cbmltcG9ydCB7IEhlbHBlcnMgfSBmcm9tICcuLi9qcy1leHBvcnRzL0hlbHBlcnMnO1xuXG52YXIgRDNDaGFydHMgPSAoZnVuY3Rpb24oKXsgIFxuXCJ1c2Ugc3RyaWN0XCI7IFxuICAgIFxuICAgIHZhciBjaGFydENvbGxlY3Rpb24gPSBbXTtcbiAgICB2YXIgRDNDaGFydEdyb3VwID0gZnVuY3Rpb24oY29udGFpbmVyLCBpbmRleCl7XG4gICAgICAgIGNvbnNvbGUubG9nKGluZGV4KTtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgICAgIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb250YWluZXIuZGF0YXNldDtcbiAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMgPSB0aGlzLnJldHVybkRhdGFQcm9taXNlcyhjb250YWluZXIpO1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmRhdGFQcm9taXNlcyk7XG4gICAgICAgIC8vdGhpcy5jb250cm9sbGVyLmluaXRDb250cm9sbGVyKGNvbnRhaW5lciwgdGhpcy5tb2RlbCwgdGhpcy52aWV3KTtcbiAgICB9O1xuICAgIC8vcHJvdG90eXBlIGJlZ2lucyBoZXJlXG4gICAgRDNDaGFydEdyb3VwLnByb3RvdHlwZSA9IHtcbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm5EYXRhUHJvbWlzZXMoKXsgLy8gU0hPVUxEIFRISVMgU1RVRkYgQkUgSU4gQ09OVFJPTExFUj8geWVzLCBwcm9iYWJseVxuICAgICAgICAgICAgICAgIHZhciBkYXRhUHJvbWlzZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgc2hlZXRJRCA9IHRoaXMuY29uZmlnLnNoZWV0SWQsIFxuICAgICAgICAgICAgICAgICAgICB0YWJzID0gW3RoaXMuY29uZmlnLmRhdGFUYWIsdGhpcy5jb25maWcuZGljdGlvbmFyeVRhYl07IC8vIHRoaXMgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaXMgdGhlcmUgYSBjYXNlIGZvciBtb3JlIHRoYW4gb25lIHNoZWV0IG9mIGRhdGE/XG4gICAgICAgICAgICAgICAgdGFicy5mb3JFYWNoKChlYWNoLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5qc29uKCdodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJyArIHNoZWV0SUQgKyAnL3ZhbHVlcy8nICsgZWFjaCArICc/a2V5PUFJemFTeUREM1c1d0plSkYyZXNmZlpNUXhOdEVsOXR0LU9mZ1NxNCcsIChlcnJvcixkYXRhKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlcyA9IGRhdGEudmFsdWVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXN0VHlwZSA9IGVhY2ggPT09ICdkaWN0aW9uYXJ5JyA/ICdvYmplY3QnIDogJ3Nlcmllcyc7IC8vIG5lc3RUeXBlIGZvciBkYXRhIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXN0QnkgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyBmYWxzZSA6IHRoaXMubmVzdEJ5O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBuZXN0QnksIHRydWUsIG5lc3RUeXBlLCBpKSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBkYXRhUHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBQcm9taXNlLmFsbChkYXRhUHJvbWlzZXMpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhID0gdmFsdWVzWzBdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB2YWx1ZXNbMV07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3VtbWFyaWVzID0gdGhpcy5zdW1tYXJpemVEYXRhKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKGRhdGFQcm9taXNlcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3VtbWFyaXplRGF0YSgpeyAvLyB0aGlzIGZuIGNyZWF0ZXMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBzdW1tYXJpemluZyB0aGUgZGF0YSBpbiBtb2RlbC5kYXRhLiBtb2RlbC5kYXRhIGlzIG5lc3RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgbmVzdGluZyBhbmQgcm9sbGluZyB1cCBjYW5ub3QgYmUgZG9uZSBlYXNpbHkgYXQgdGhlIHNhbWUgdGltZSwgc28gdGhleSdyZSBkb25lIHNlcGFyYXRlbHkuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzdW1tYXJpZXMgcHJvdmlkZSBhdmVyYWdlLCBtYXgsIG1pbiBvZiBhbGwgZmllbGRzIGluIHRoZSBkYXRhIGF0IGFsbCBsZXZlbHMgb2YgbmVzdGluZy4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBmaXJzdCAoaW5kZXggMCkgaXMgb25lIGxheWVyIG5lc3RlZCwgdGhlIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi5cbiAgICAgICAgICAgICAgICB2YXIgc3VtbWFyaWVzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHZhcmlhYmxlcyA9IE9iamVjdC5rZXlzKHRoaXMudW5uZXN0ZWRbMF0pOyAvLyBhbGwgbmVlZCB0byBoYXZlIHRoZSBzYW1lIGZpZWxkc1xuICAgICAgICAgICAgICAgIHZhciBuZXN0QnkgPSB0aGlzLmNvbmZpZy5uZXN0QnkgPyBKU09OLnBhcnNlKHRoaXMuY29uZmlnLm5lc3RCeSkgOiBmYWxzZTtcbiAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5QXJyYXkgPSBBcnJheS5pc0FycmF5KG5lc3RCeSkgPyBuZXN0QnkgOiBbbmVzdEJ5XTtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiByZWR1Y2VWYXJpYWJsZXMoZCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY1tjdXJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heDogICAgICAgZDMubWF4KGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW46ICAgICAgIGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVhbjogICAgICBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW06ICAgICAgIGQzLnN1bShkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFuOiAgICBkMy5tZWRpYW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbmNlOiAgZDMudmFyaWFuY2UoZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmlhdGlvbjogZDMuZGV2aWF0aW9uKGQsIGQgPT4gZFtjdXJdKVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgICAgIH0se30pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3aGlsZSAoIG5lc3RCeUFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHN1bW1hcml6ZWQgPSB0aGlzLm5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICAucm9sbHVwKHJlZHVjZVZhcmlhYmxlcylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodGhpcy51bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgICAgIHN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAgICAgIFxuICAgICAgICAgICAgICAgICAgICBuZXN0QnlBcnJheS5wb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1bW1hcmllcztcbiAgICAgICAgICAgIH0sIFxuICAgICAgICAgICAgbmVzdFByZWxpbShuZXN0QnlBcnJheSl7XG4gICAgICAgICAgICAgICAgLy8gcmVjdXJzaXZlICBuZXN0aW5nIGZ1bmN0aW9uIHVzZWQgYnkgc3VtbWFyaXplRGF0YSBhbmQgcmV0dXJuS2V5VmFsdWVzXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5lc3RCeUFycmF5LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1cil7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyICE9PSAnc3RyaW5nJyAmJiB0eXBlb2YgY3VyICE9PSAnZnVuY3Rpb24nICkgeyB0aHJvdyAnZWFjaCBuZXN0QnkgaXRlbSBtdXN0IGJlIGEgc3RyaW5nIG9yIGZ1bmN0aW9uJzsgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgcnRuO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdzdHJpbmcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkW2N1cl07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTsgICAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjdXIoZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcnRuO1xuICAgICAgICAgICAgICAgIH0sIGQzLm5lc3QoKSk7XG4gICAgICAgICAgICB9LCAgICAgICBcbiAgICAgICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycsIHRhYkluZGV4ID0gMCl7XG4gICAgICAgICAgICAvLyB0aGlzIGZuIHRha2VzIG5vcm1hbGl6ZWQgZGF0YSBmZXRjaGVkIGFzIGFuIGFycmF5IG9mIHJvd3MgYW5kIHVzZXMgdGhlIHZhbHVlcyBpbiB0aGUgZmlyc3Qgcm93IGFzIGtleXMgZm9yIHZhbHVlcyBpblxuICAgICAgICAgICAgLy8gc3Vic2VxdWVudCByb3dzXG4gICAgICAgICAgICAvLyBuZXN0QnkgPSBzdHJpbmcgb3IgYXJyYXkgb2YgZmllbGQocykgdG8gbmVzdCBieSwgb3IgYSBjdXN0b20gZnVuY3Rpb24sIG9yIGFuIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zO1xuICAgICAgICAgICAgLy8gY29lcmNlID0gQk9PTCBjb2VyY2UgdG8gbnVtIG9yIG5vdDsgbmVzdFR5cGUgPSBvYmplY3Qgb3Igc2VyaWVzIG5lc3QgKGQzKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBwcmVsaW07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHVubmVzdGVkID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1ciwgaSkgeyBcbiAgICAgICAgICAgICAgICAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgICAvLyAzLiAvLyBhY2MgaXMgYW4gb2JqZWN0ICwga2V5IGlzIGNvcnJlc3BvbmRpbmcgdmFsdWUgZnJvbSByb3cgMCwgdmFsdWUgaXMgY3VycmVudCB2YWx1ZSBvZiBhcnJheVxuICAgICAgICAgICAgICAgICAgYWNjW3ZhbHVlc1swXVtpXV0gPSBjb2VyY2UgPT09IHRydWUgPyBpc05hTigrY3VyKSB8fCBjdXIgPT09ICcnID8gY3VyIDogK2N1ciA6IGN1cjsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRlc3QgZm9yIGVtcHR5IHN0cmluZ3MgYmVmb3JlIGNvZXJjaW5nIGJjICsnJyA9PiAwXG4gICAgICAgICAgICAgICAgfSwge30pKTtcbiAgICAgICAgICAgICAgICBpZiAoIHRhYkluZGV4ID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVubmVzdGVkID0gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCAhbmVzdEJ5ICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bm5lc3RlZDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBuZXN0QnkgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBuZXN0QnkgPT09ICdmdW5jdGlvbicgKSB7IC8vIGllIG9ubHkgb25lIG5lc3RCeSBmaWVsZCBvciBmdW5jaXRvblxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gdGhpcy5uZXN0UHJlbGltKFtuZXN0QnldKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCBuZXN0VHlwZSA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh1bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudHJpZXModW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgIFxuXG4gICAgICAgIHZpZXc6IHtcbiAgICAgICAgICAgIGluaXQoY29udGFpbmVyLCBtb2RlbCl7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXJnaW5zID0geyAvLyBkZWZhdWx0IHZhbHVlcyA7IGNhbiBiZSBzZXQgYmUgZWFjaCBTVkdzIERPTSBkYXRhc2V0IChodG1sIGRhdGEgYXR0cmlidXRlcykuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBTFNPIGRlZmF1bHQgc2hvdWxkIGJlIGFibGUgdG8gY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgdG9wOjIwLFxuICAgICAgICAgICAgICAgICAgICByaWdodDo0NSxcbiAgICAgICAgICAgICAgICAgICAgYm90dG9tOjE1LFxuICAgICAgICAgICAgICAgICAgICBsZWZ0OjM1XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZUZpZWxkID0gJ3BiMjVsJzsgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICB0aGlzLnNldHVwQ2hhcnRzKGNvbnRhaW5lciwgbW9kZWwpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGxhYmVsKG1vZGVsLCBrZXkpeyAvLyBpZiB5b3UgY2FuIGdldCB0aGUgc3VtbWFyeSB2YWx1ZXMgdG8gYmUga2V5ZWQgYWxsIHRoZSB3YXkgZG93biwgeW91IHdvdWxkbid0IG5lZWQgQXJyYXkuZmluZFxuICAgICAgICAgICAgICAgcmV0dXJuIG1vZGVsLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLmxhYmVsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldHVwQ2hhcnRzKGNvbnRhaW5lciwgbW9kZWwpeyBcbiAgICAgICAgICAgICAgICB2YXIgdmlldyA9IHRoaXM7XG4gICAgICAgICAgICAgICAgdmFyIGNoYXJ0RGl2cyA9IGQzLnNlbGVjdChjb250YWluZXIpLnNlbGVjdEFsbCgnLmQzLWNoYXJ0Jyk7IFxuXG4gICAgICAgICAgICAgICAgY2hhcnREaXZzLmVhY2goZnVuY3Rpb24oKSB7IC8vIFRPIERPIGRpZmZlcmVudGlhdGUgY2hhcnQgdHlwZXMgZnJvbSBodG1sIGRhdGFzZXRcbiAgICAgICAgICAgICAgICAgICAgLyogY2hhcnREaXZzLmVhY2ggc2NvcGVkIGdsb2JhbHMgKi9cbiAgICAgICAgICAgICAgICAgICAgLy8gKiogVE8gRE8gKiogYWxsb3cgZGF0YSBhdHRyIHN0cmluZ3MgdG8gYmUgcXVvdGVkIG9ubHkgb25jZS4gaWUgSlNPTi5wYXJzZSBvbmx5IGlmIHN0cmluZyBpbmNsdWRlcyAvIHN0YXJ0cyB3aXRoIFtdXG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvbmZpZyA9IHRoaXMuZGF0YXNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlSW5zdHJ1Y3QgPSBjb25maWcucmVzZXRTY2FsZSA/IEpTT04ucGFyc2UoY29uZmlnLnJlc2V0U2NhbGUpIDogJ25vbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZUluZGV4ID0gMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0luZGV4ID0gMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpblRvcCA9ICtjb25maWcubWFyZ2luVG9wIHx8IHZpZXcubWFyZ2lucy50b3AsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5SaWdodCA9ICtjb25maWcubWFyZ2luUmlnaHQgfHwgdmlldy5tYXJnaW5zLnJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luQm90dG9tID0gK2NvbmZpZy5tYXJnaW5Cb3R0b20gfHwgdmlldy5tYXJnaW5zLmJvdHRvbSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbkxlZnQgPSArY29uZmlnLm1hcmdpbkxlZnQgfHwgdmlldy5tYXJnaW5zLmxlZnQsXG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aCA9IGNvbmZpZy5lYWNoV2lkdGggLSBtYXJnaW5MZWZ0IC0gbWFyZ2luUmlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQgPSBjb25maWcuZWFjaEhlaWdodCA/IGNvbmZpZy5lYWNoSGVpZ2h0IC0gbWFyZ2luVG9wIC0gbWFyZ2luQm90dG9tIDogY29uZmlnLmVhY2hXaWR0aCAvIDIgLSBtYXJnaW5Ub3AgLSBtYXJnaW5Cb3R0b20sXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXR1bSA9IG1vZGVsLmRhdGEuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBjb25maWcuY2F0ZWdvcnkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWluWCA9IDIwMTUsIC8vICEhISBOT1QgUFJPR1JBTUFUSUNcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heFggPSAyMDQ1LCAvLyAhISEgTk9UIFBST0dSQU1BVElDXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBCRUxPVyBuZWVkcyBpbnB1dCBmcm9tIEhUTUwtLWRlZmF1bHQgbWF4ZXMgYW5kIG1pbnMgaW4gY2FzZSBuYXR1cmFsIG1pbiA+IDAsIG1heCA8IDAsIG9yIHNpbXBseSB3YW50IHRvIG92ZXJyaWRlXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5ZID0gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gPCAwID8gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF4WSA9IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWF4ID4gTWF0aC5hYnMobWluWSAvIDIpID8gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggOiBNYXRoLmFicyhtaW5ZIC8gMiksXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJzZVRpbWUgPSBkMy50aW1lUGFyc2UoJyVZJyksIC8vICEhISBOT1QgUFJPR1JBTUFUSUNcbiAgICAgICAgICAgICAgICAgICAgICAgIHggPSBkMy5zY2FsZVRpbWUoKS5yYW5nZShbMCwgd2lkdGhdKS5kb21haW4oW3BhcnNlVGltZShtaW5YKSxwYXJzZVRpbWUobWF4WCldKSwgLy8gISEhIE5PVCBQUk9HUkFNQVRJQ1xuICAgICAgICAgICAgICAgICAgICAgICAgeSA9IGQzLnNjYWxlTGluZWFyKCkucmFuZ2UoW2hlaWdodCwgMF0pLmRvbWFpbihbbWluWSxtYXhZXSksICAvLyAhISEgTk9UIFBST0dSQU1BVElDXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFydERpdiA9IGQzLnNlbGVjdCh0aGlzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5kYXR1bShkYXR1bSksXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkaW5ncyA9IGNoYXJ0RGl2LmFwcGVuZCgncCcpLFxuICAgICAgICAgICAgICAgICAgICAgICAgU1ZHcyA9IGNoYXJ0RGl2LmFwcGVuZCgnZGl2JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCdmbGV4JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdTVkdzJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZGF0YShkID0+IGdyb3VwU2VyaWVzKGQudmFsdWVzKSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdzdmcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIGNvbmZpZy5lYWNoV2lkdGgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2hlaWdodCcsIGhlaWdodCArIG1hcmdpblRvcCArIG1hcmdpbkJvdHRvbSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgYHRyYW5zbGF0ZSgke21hcmdpbkxlZnR9LCR7bWFyZ2luVG9wfSlgKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlbGluZSA9IGQzLmxpbmUoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC54KGQgPT4geChwYXJzZVRpbWUoZC55ZWFyKSkgKSAvLyAhISBub3QgcHJvZ3JhbW1hdGljXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnkoZCA9PiB5KGRbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXSkgKTsgLy8gISEgbm90IHByb2dyYW1tYXRpY1xuXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGdyb3VwU2VyaWVzKGRhdGEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNlcmllc0dyb3VwcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBncm91cHNJbnN0cnVjdCA9IGNvbmZpZy5zZXJpZXNHcm91cCA/IEpTT04ucGFyc2UoY29uZmlnLnNlcmllc0dyb3VwKSA6ICdub25lJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggQXJyYXkuaXNBcnJheSggZ3JvdXBzSW5zdHJ1Y3QgKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBKU09OLnBhcnNlKGNvbmZpZy5zZXJpZXNHcm91cCkuZm9yRWFjaChncm91cCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3Vwcy5wdXNoKGRhdGEuZmlsdGVyKHNlcmllcyA9PiBncm91cC5pbmRleE9mKHNlcmllcy5rZXkpICE9PSAtMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdub25lJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBkYXRhLm1hcChlYWNoID0+IFtlYWNoXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCBncm91cHNJbnN0cnVjdCA9PT0gJ2FsbCcgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW2RhdGEubWFwKGVhY2ggPT4gZWFjaCldO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBgSW52YWxpZCBkYXRhLWdyb3VwLXNlcmllcyBpbnN0cnVjdGlvbiBmcm9tIGh0bWwuIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNdXN0IGJlIHZhbGlkIEpTT046IFwiTm9uZVwiIG9yIFwiQWxsXCIgb3IgYW4gYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2YgYXJyYXlzIGNvbnRhaW5pbmcgdGhlIHNlcmllcyB0byBiZSBncm91cGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvZ2V0aGVyLiBBbGwgc3RyaW5ncyBtdXN0IGJlIGRvdWJsZS1xdW90ZWQuYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZXJpZXNHcm91cHM7XG4gICAgICAgICAgICAgICAgICAgIH0gLy8gZW5kIGdyb3VwU2VyaWVzKClcblxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLyogSEVBRElOR1MgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRpbmdzLmh0bWwoZCA9PiAnPHN0cm9uZz4nICsgdmlldy5sYWJlbChtb2RlbCwgZC5rZXkpICsgJzwvc3Ryb25nPicpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8qIFNWR1MgKi9cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIFNWR3MuZWFjaChmdW5jdGlvbihkLGkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIFNWRyA9IGQzLnNlbGVjdCh0aGlzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhID0gU1ZHLmRhdGEoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bml0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBTVkdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnc2VyaWVzLWdyb3VwcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGRhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBhZGRZQXhpcyhyZXBlYXRlZCA9ICcnLCBzaG93VW5pdHMgPSBmYWxzZSl7ICAvLyAhISBOT1QgUFJPR1JBTU1BVElDXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLyoganNoaW50IHZhbGlkdGhpczogdHJ1ZSAqLyAvKiA8LSBjb21tZW50IGtlZXBzIGpzaGludCBmcm9tIGZhbHNlbHkgd2FybmluZyB0aGF0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgdGhpc2Agd2lsbCBiZSB1bmRlZmluZWQuIHRoZSAuY2FsbCgpIG1ldGhvZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmaW5lcyBgdGhpc2AgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+ICdheGlzIHktYXhpcyAnICsgcmVwZWF0ZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzTGVmdCh5KS50aWNrU2l6ZUlubmVyKDQpLnRpY2tTaXplT3V0ZXIoMCkudGlja1BhZGRpbmcoMSkudGlja3MoNSkpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBzaG93VW5pdHMgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAndW5pdHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICgpID0+IGB0cmFuc2xhdGUoLSR7bWFyZ2luTGVmdH0sLSR7bWFyZ2luVG9wIC0gMTB9KWApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudGV4dCgoKSA9PiB1bml0cy5yZW1vdmVVbmRlcnNjb3JlcygpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIFBBVEhTICovXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggY29uZmlnLnR5cGUgPT09ICdsaW5lJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyAvLyAhISBOT1QgUFJPR1JBTU1BVElDICwgSUUsIFRZUEUgTkVFRFMgVE8gQkUgU1BFQ0lGSUVEIEJZIGNvbmZpZy50eXBlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3NlcmllcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnbGluZSBsaW5lLScgKyBsaW5lSW5kZXgrKztcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIChkLGopID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuaXRzID0gZC52YWx1ZXNbMV0udW5pdHM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHNjYWxlSW5zdHJ1Y3QuaW5kZXhPZihkLmtleSkgIT09IC0xICl7IC8vIFRPRE86IHJlc2V0dGluZyBzY2FsZSBtYWtlIHRoZSBzZXJpZXMgbWluLG1heCBmcm9tIHRoZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXJpZXMnIG93biBkYXRhLCBub3QgdGhlIG9uZSBpdCdzIGdyb3VwZWQgd2l0aCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBOT1QgUFJPR1JBTU1BVElDICovIG1pblkgPSBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gPCAwID8gbW9kZWwuc3VtbWFyaWVzWzFdW2RhdHVtLmtleV1bZC5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDogMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBOT1QgUFJPR1JBTU1BVElDICovIG1heFkgPSBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggPiBNYXRoLmFicyhtaW5ZIC8gMikgPyBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggOiBNYXRoLmFicyhtaW5ZIC8gMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeCA9IGQzLnNjYWxlVGltZSgpLnJhbmdlKFswLCB3aWR0aF0pLmRvbWFpbihbcGFyc2VUaW1lKG1pblgpLHBhcnNlVGltZShtYXhYKV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHkgPSBkMy5zY2FsZUxpbmVhcigpLnJhbmdlKFtoZWlnaHQsIDBdKS5kb21haW4oW21pblksbWF4WV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggaSAhPT0gMCAmJiBqID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRZQXhpcy5jYWxsKHRoaXMsJycsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCBpICE9PSAwICYmIGogPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZFlBeGlzLmNhbGwodGhpcywncmVwZWF0ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQudmFsdWVzLnVuc2hpZnQoe3llYXI6MjAxNSxbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXTowfSk7IC8vVE8gRE86IHB1dCBpbiBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVhY2goZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhciBkYXRhID0gZDMuc2VsZWN0KHRoaXMpLmRhdGEoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25maWcuZGlyZWN0TGFiZWwpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNWRy5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiAnc2VyaWVzLWxhYmVsIHNlcmllcy0nICsgc2VyaWVzSW5kZXgrKylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmh0bWwoKCkgPT4gJzx0c3BhbiB4PVwiMFwiPicgKyB2aWV3LmxhYmVsKGQua2V5KS5yZXBsYWNlKC9cXFxcbi9nLCc8L3RzcGFuPjx0c3BhbiB4PVwiMFwiIGR5PVwiMS4yZW1cIj4nKSArICc8L3RzcGFuPicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoKSA9PiBgdHJhbnNsYXRlKCR7d2lkdGggKyAzfSwke3koZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXSkgKyAzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBYIEFYSVMgKi9cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNWRy5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLCcgKyB5KDApICsgJyknKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzQm90dG9tKHgpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrVmFsdWVzKFtwYXJzZVRpbWUoMjAyNSkscGFyc2VUaW1lKDIwMzUpLHBhcnNlVGltZSgyMDQ1KV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBZIEFYSVMgKi8gICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpID09PSAwICkgeyAvLyBpIGhlcmUgaXMgZnJvbSB0aGUgU1ZHLmVhY2ggbG9vcC4gYXBwZW5kIHlBeGlzIHRvIGFsbCBmaXJzdCBTVkdzIG9mIGNoYXJ0RGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZFlBeGlzLmNhbGwodGhpcywgJycsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gLy8gZW5kIGlmIHR5cGUgPT09ICdsaW5lJ1xuICAgICAgICAgICAgICAgICAgICB9KTsgLy8gZW5kIFNWR3MuZWFjaCgpXG4gICAgICAgICAgICAgICAgfSk7IC8vIGVuZCBjaGFydERpdnMuZWFjaCgpXG4gICAgICAgICAgICB9IC8vIGVuZCB2aWV3LnNldHVwQ2hhcnRzKClcbiAgICAgICAgfSwgLy8gZW5kIHZpZXdcblxuICAgICAgICBjb250cm9sbGVyOiB7XG4gICAgICAgICAgICBpbml0Q29udHJvbGxlcjogZnVuY3Rpb24oY29udGFpbmVyLCBtb2RlbCl7Ly8sIHZpZXcpe1xuICAgICAgICAgICAgICAgIG1vZGVsLmluaXQoY29udGFpbmVyKS50aGVuKHZhbHVlcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsLmRhdGEgPSB2YWx1ZXNbMF07XG4gICAgICAgICAgICAgICAgICAvLyAgbW9kZWwuZGljdGlvbmFyeSA9IHZhbHVlc1sxXS51bmRlZmluZWQudW5kZWZpbmVkOyAvLyAhISBOT1QgUFJPR1JBTU1BVElDIC8gQ09OU0lTVEVOVFxuICAgICAgICAgICAgICAgICAgLy8gIG1vZGVsLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICAgLy8gICB2aWV3LmluaXQoY29udGFpbmVyLCBtb2RlbCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9OyAvLyBEM0NoYXJ0R3JvdXAgcHJvdG90eXBlIGVuZHMgaGVyZVxuICAgIFxuICAgIHdpbmRvdy5EM0NoYXJ0cyA9IHsgLy8gbmVlZCB0byBzcGVjaWZ5IHdpbmRvdyBiYyBhZnRlciB0cmFuc3BpbGluZyBhbGwgdGhpcyB3aWxsIGJlIHdyYXBwZWQgaW4gSUlGRXNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBgcmV0dXJuYGluZyB3b24ndCBnZXQgdGhlIGV4cG9ydCBpbnRvIHdpbmRvdydzIGdsb2JhbCBzY29wZVxuICAgICAgICBJbml0KCl7XG4gICAgICAgICAgICB2YXIgZ3JvdXBEaXZzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmQzLWdyb3VwJyk7XG4gICAgICAgICAgICBmb3IgKCBsZXQgaSA9IDA7IGkgPCBncm91cERpdnMubGVuZ3RoOyBpKysgKXtcbiAgICAgICAgICAgICAgICBjaGFydENvbGxlY3Rpb24ucHVzaChuZXcgRDNDaGFydEdyb3VwKGdyb3VwRGl2c1tpXSwgaSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc29sZS5sb2coY2hhcnRDb2xsZWN0aW9uKTtcbiAgICAgICAgfVxuICAgIH07XG59KCkpOyAvLyBlbmQgdmFyIEQzQ2hhcnRzIElJRkUiLCJleHBvcnQgY29uc3QgSGVscGVycyA9IChmdW5jdGlvbigpe1xuICAgIFxuICAgIFN0cmluZy5wcm90b3R5cGUuY2xlYW5TdHJpbmcgPSBmdW5jdGlvbigpIHsgLy8gbG93ZXJjYXNlIGFuZCByZW1vdmUgcHVuY3R1YXRpb24gYW5kIHJlcGxhY2Ugc3BhY2VzIHdpdGggaHlwaGVuczsgZGVsZXRlIHB1bmN0dWF0aW9uXG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL1sgXFxcXFxcL10vZywnLScpLnJlcGxhY2UoL1snXCLigJ3igJnigJzigJgsXFwuIVxcPztcXChcXCkmXS9nLCcnKS50b0xvd2VyQ2FzZSgpO1xuICAgIH07XG5cbiAgICBTdHJpbmcucHJvdG90eXBlLnJlbW92ZVVuZGVyc2NvcmVzID0gZnVuY3Rpb24oKSB7IFxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9fL2csJyAnKTtcbiAgICB9O1xuXG59KSgpO1xuIl19
