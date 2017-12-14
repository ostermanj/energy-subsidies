(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _Helpers = require('../js-exports/Helpers');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; } /* exported D3Charts, Helpers */ // let's jshint know that D3Charts can be "defined but not used" in this file
/* polyfills needed: Promise, Array.isArray, Array.find, Array.filter
 */


var D3Charts = function () {
    "use strict";

    var model, view, controller; // can these be in this scope without collision bt instances of D3ChartGroup?
    // alternative: pass them in as parameters

    var D3ChartGroup = function D3ChartGroup(container) {
        model = this.model;
        view = this.view;
        controller = this.controller;
        controller.initController(container);
    };
    //prototype begins here
    D3ChartGroup.prototype = {
        model: {
            init: function init(container) {
                var _this = this;

                // SHOULD THIS STUFF BE IN CONTROLLER? yes, probably
                var groupConfig = container.dataset;
                this.dataPromises = [];
                this.nestBy = JSON.parse(groupConfig.nestBy);
                var sheetID = groupConfig.sheetId,
                    tabs = [groupConfig.dataTab, groupConfig.dictionaryTab]; // this should come from HTML
                // is there a case for more than one sheet of data?

                tabs.forEach(function (each, i) {
                    var promise = new Promise(function (resolve, reject) {
                        d3.json('https://sheets.googleapis.com/v4/spreadsheets/' + sheetID + '/values/' + each + '?key=AIzaSyDD3W5wJeJF2esffZMQxNtEl9tt-OfgSq4', function (error, data) {
                            // columns A through I
                            if (error) {
                                reject(error);
                                throw error;
                            }
                            var values = data.values;
                            var nestType = each === 'dictionary' ? 'object' : 'series'; // nestType for data should come from HTML
                            resolve(_this.returnKeyValues(values, model.nestBy, true, nestType, i));
                        });
                    });
                    _this.dataPromises.push(promise);
                });
                return Promise.all(this.dataPromises);
            },
            summarizeData: function summarizeData() {
                // this fn creates an array of objects summarizing the data in model.data. model.data is nested
                // and nesting and rolling up cannot be done easily at the same time, so they're done separately.
                // the summaries provide average, max, min of all fields in the data at all levels of nesting. 
                // the first (index 0) is one layer nested, the second is two, and so on.
                this.summaries = [];
                var variables = Object.keys(this.unnested[0]); // all need to have the same fields
                var nestByArray = Array.isArray(this.nestBy) ? this.nestBy : [this.nestBy];
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
                    this.summaries.unshift(summarized);
                    nestByArray.pop();
                }
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
                    model.unnested = unnested;
                }
                if (!nestBy) {
                    return unnested;
                } else {
                    if (typeof nestBy === 'string' || typeof nestBy === 'function') {
                        // ie only one nestBy field or funciton
                        prelim = model.nestPrelim([nestBy]);
                    } else {
                        if (!Array.isArray(nestBy)) {
                            throw 'nestBy variable must be a string, function, or array of strings or functions';
                        }
                        prelim = model.nestPrelim(nestBy);
                    }
                }
                if (nestType === 'object') {
                    return prelim.object(unnested);
                } else {
                    return prelim.entries(unnested);
                }
            }
        },

        view: {
            init: function init(container) {
                this.margins = { // default values ; can be set be each SVGs DOM dataset (html data attributes).
                    // ALSO default should be able to come from HTML
                    top: 20,
                    right: 45,
                    bottom: 15,
                    left: 35
                };
                this.activeField = 'pb25l'; // this should come from HTML
                this.setupCharts(container);
            },
            label: function label(key) {
                // if you can get the summary values to be keyed all the way down, you wouldn't need Array.find
                return model.dictionary.find(function (each) {
                    return each.key === key;
                }).label;
            },
            setupCharts: function setupCharts(container) {
                var chartDivs = d3.select(container).selectAll('.d3-chart');
                console.log(chartDivs);

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
                        return '<strong>' + view.label(d.key) + '</strong>';
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
            initController: function initController(container) {
                console.log(this); // `this` is controller
                console.log(model);
                console.log(view);
                model.init(container).then(function (values) {
                    model.data = values[0];
                    model.dictionary = values[1].undefined.undefined; // !! NOT PROGRAMMATIC / CONSISTENT
                    model.summarizeData();
                    view.init(container);
                });
            }
        }
    }; // D3ChartGroup prototype ends here

    window.D3Charts = {
        // need to specify window bc after transpiling all this will be wrapped in IIFEs
        // and `return`ing won't get the export into window's global scope
        Init: function Init() {
            document.querySelectorAll('.d3-group').forEach(function (each) {
                new D3ChartGroup(each);
            });
            // call new constructor for each wrapper div
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9IZWxwZXJzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNJQTs7a05BSkMsZ0MsQ0FBaUM7QUFDakM7Ozs7QUFLRCxJQUFJLFdBQVksWUFBVTtBQUMxQjs7QUFDSSxRQUFJLEtBQUosRUFDSSxJQURKLEVBRUksVUFGSixDQUZzQixDQUlOO0FBQ0E7O0FBRWhCLFFBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxTQUFULEVBQW1CO0FBQ2xDLGdCQUFRLEtBQUssS0FBYjtBQUNBLGVBQU8sS0FBSyxJQUFaO0FBQ0EscUJBQWEsS0FBSyxVQUFsQjtBQUNBLG1CQUFXLGNBQVgsQ0FBMEIsU0FBMUI7QUFDSCxLQUxEO0FBTUE7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBQ3JCLGVBQU87QUFDSCxnQkFERyxnQkFDRSxTQURGLEVBQ1k7QUFBQTs7QUFBRTtBQUNiLG9CQUFJLGNBQWMsVUFBVSxPQUE1QjtBQUNBLHFCQUFLLFlBQUwsR0FBb0IsRUFBcEI7QUFDQSxxQkFBSyxNQUFMLEdBQWMsS0FBSyxLQUFMLENBQVcsWUFBWSxNQUF2QixDQUFkO0FBQ0Esb0JBQUksVUFBVSxZQUFZLE9BQTFCO0FBQUEsb0JBQ0ksT0FBTyxDQUFDLFlBQVksT0FBYixFQUFxQixZQUFZLGFBQWpDLENBRFgsQ0FKVyxDQUtpRDtBQUN4Qjs7QUFFcEMscUJBQUssT0FBTCxDQUFhLFVBQUMsSUFBRCxFQUFPLENBQVAsRUFBYTtBQUN0Qix3QkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsMkJBQUcsSUFBSCxDQUFRLG1EQUFtRCxPQUFuRCxHQUE2RCxVQUE3RCxHQUEwRSxJQUExRSxHQUFpRiw4Q0FBekYsRUFBeUksVUFBQyxLQUFELEVBQU8sSUFBUCxFQUFnQjtBQUFFO0FBQ3ZKLGdDQUFJLEtB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QUFzQixJQUF0QixDQUEyQixrQkFBVTtBQUNqQywwQkFBTSxJQUFOLEdBQWEsT0FBTyxDQUFQLENBQWI7QUFDQSwwQkFBTSxVQUFOLEdBQW1CLE9BQU8sQ0FBUCxFQUFVLFNBQVYsQ0FBb0IsU0FBdkMsQ0FGaUMsQ0FFaUI7QUFDbEQsMEJBQU0sYUFBTjtBQUNBLHlCQUFLLElBQUwsQ0FBVSxTQUFWO0FBQ0gsaUJBTEQ7QUFNSDtBQVhPO0FBclJTLEtBQXpCLENBZHNCLENBZ1RuQjs7QUFFSCxXQUFPLFFBQVAsR0FBa0I7QUFBRTtBQUNBO0FBQ2hCLFlBRmMsa0JBRVI7QUFDRixxQkFBUyxnQkFBVCxDQUEwQixXQUExQixFQUF1QyxPQUF2QyxDQUErQyxnQkFBUTtBQUNuRCxvQkFBSSxZQUFKLENBQWlCLElBQWpCO0FBQ0gsYUFGRDtBQUdBO0FBQ0g7QUFQYSxLQUFsQjtBQVNILENBM1RlLEVBQWhCLEMsQ0EyVE07Ozs7Ozs7O0FDalVDLElBQU0sNEJBQVcsWUFBVTs7QUFFOUIsV0FBTyxTQUFQLENBQWlCLFdBQWpCLEdBQStCLFlBQVc7QUFBRTtBQUN4QyxlQUFPLEtBQUssT0FBTCxDQUFhLFVBQWIsRUFBd0IsR0FBeEIsRUFBNkIsT0FBN0IsQ0FBcUMsdUJBQXJDLEVBQTZELEVBQTdELEVBQWlFLFdBQWpFLEVBQVA7QUFDSCxLQUZEOztBQUlBLFdBQU8sU0FBUCxDQUFpQixpQkFBakIsR0FBcUMsWUFBVztBQUM1QyxlQUFPLEtBQUssT0FBTCxDQUFhLElBQWIsRUFBa0IsR0FBbEIsQ0FBUDtBQUNILEtBRkQ7QUFJSCxDQVZzQixFQUFoQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIgLyogZXhwb3J0ZWQgRDNDaGFydHMsIEhlbHBlcnMgKi8gLy8gbGV0J3MganNoaW50IGtub3cgdGhhdCBEM0NoYXJ0cyBjYW4gYmUgXCJkZWZpbmVkIGJ1dCBub3QgdXNlZFwiIGluIHRoaXMgZmlsZVxuIC8qIHBvbHlmaWxscyBuZWVkZWQ6IFByb21pc2UsIEFycmF5LmlzQXJyYXksIEFycmF5LmZpbmQsIEFycmF5LmZpbHRlclxuXG4gKi9cbmltcG9ydCB7IEhlbHBlcnMgfSBmcm9tICcuLi9qcy1leHBvcnRzL0hlbHBlcnMnO1xuXG52YXIgRDNDaGFydHMgPSAoZnVuY3Rpb24oKXsgIFxuXCJ1c2Ugc3RyaWN0XCI7IFxuICAgIHZhciBtb2RlbCxcbiAgICAgICAgdmlldyxcbiAgICAgICAgY29udHJvbGxlcjsgLy8gY2FuIHRoZXNlIGJlIGluIHRoaXMgc2NvcGUgd2l0aG91dCBjb2xsaXNpb24gYnQgaW5zdGFuY2VzIG9mIEQzQ2hhcnRHcm91cD9cbiAgICAgICAgICAgICAgICAgICAgLy8gYWx0ZXJuYXRpdmU6IHBhc3MgdGhlbSBpbiBhcyBwYXJhbWV0ZXJzXG4gICAgXG4gICAgdmFyIEQzQ2hhcnRHcm91cCA9IGZ1bmN0aW9uKGNvbnRhaW5lcil7XG4gICAgICAgIG1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICAgICAgdmlldyA9IHRoaXMudmlldztcbiAgICAgICAgY29udHJvbGxlciA9IHRoaXMuY29udHJvbGxlcjtcbiAgICAgICAgY29udHJvbGxlci5pbml0Q29udHJvbGxlcihjb250YWluZXIpO1xuICAgIH07XG4gICAgLy9wcm90b3R5cGUgYmVnaW5zIGhlcmVcbiAgICBEM0NoYXJ0R3JvdXAucHJvdG90eXBlID0ge1xuICAgICAgICBtb2RlbDoge1xuICAgICAgICAgICAgaW5pdChjb250YWluZXIpeyAvLyBTSE9VTEQgVEhJUyBTVFVGRiBCRSBJTiBDT05UUk9MTEVSPyB5ZXMsIHByb2JhYmx5XG4gICAgICAgICAgICAgICAgdmFyIGdyb3VwQ29uZmlnID0gY29udGFpbmVyLmRhdGFzZXQ7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLm5lc3RCeSA9IEpTT04ucGFyc2UoZ3JvdXBDb25maWcubmVzdEJ5KTtcbiAgICAgICAgICAgICAgICB2YXIgc2hlZXRJRCA9IGdyb3VwQ29uZmlnLnNoZWV0SWQsIFxuICAgICAgICAgICAgICAgICAgICB0YWJzID0gW2dyb3VwQ29uZmlnLmRhdGFUYWIsZ3JvdXBDb25maWcuZGljdGlvbmFyeVRhYl07IC8vIHRoaXMgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaXMgdGhlcmUgYSBjYXNlIGZvciBtb3JlIHRoYW4gb25lIHNoZWV0IG9mIGRhdGE/XG5cbiAgICAgICAgICAgICAgICB0YWJzLmZvckVhY2goKGVhY2gsIGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSxyZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLmpzb24oJ2h0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8nICsgc2hlZXRJRCArICcvdmFsdWVzLycgKyBlYWNoICsgJz9rZXk9QUl6YVN5REQzVzV3SmVKRjJlc2ZmWk1ReE50RWw5dHQtT2ZnU3E0JywgKGVycm9yLGRhdGEpID0+IHsgLy8gY29sdW1ucyBBIHRocm91Z2ggSVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlcyA9IGRhdGEudmFsdWVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXN0VHlwZSA9IGVhY2ggPT09ICdkaWN0aW9uYXJ5JyA/ICdvYmplY3QnIDogJ3Nlcmllcyc7IC8vIG5lc3RUeXBlIGZvciBkYXRhIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBtb2RlbC5uZXN0QnksIHRydWUsIG5lc3RUeXBlLCBpKSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGFQcm9taXNlcy5wdXNoKHByb21pc2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbCh0aGlzLmRhdGFQcm9taXNlcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3VtbWFyaXplRGF0YSgpeyAvLyB0aGlzIGZuIGNyZWF0ZXMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBzdW1tYXJpemluZyB0aGUgZGF0YSBpbiBtb2RlbC5kYXRhLiBtb2RlbC5kYXRhIGlzIG5lc3RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgbmVzdGluZyBhbmQgcm9sbGluZyB1cCBjYW5ub3QgYmUgZG9uZSBlYXNpbHkgYXQgdGhlIHNhbWUgdGltZSwgc28gdGhleSdyZSBkb25lIHNlcGFyYXRlbHkuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzdW1tYXJpZXMgcHJvdmlkZSBhdmVyYWdlLCBtYXgsIG1pbiBvZiBhbGwgZmllbGRzIGluIHRoZSBkYXRhIGF0IGFsbCBsZXZlbHMgb2YgbmVzdGluZy4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBmaXJzdCAoaW5kZXggMCkgaXMgb25lIGxheWVyIG5lc3RlZCwgdGhlIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi5cbiAgICAgICAgICAgICAgICB0aGlzLnN1bW1hcmllcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciB2YXJpYWJsZXMgPSBPYmplY3Qua2V5cyh0aGlzLnVubmVzdGVkWzBdKTsgLy8gYWxsIG5lZWQgdG8gaGF2ZSB0aGUgc2FtZSBmaWVsZHNcbiAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5QXJyYXkgPSBBcnJheS5pc0FycmF5KHRoaXMubmVzdEJ5KSA/IHRoaXMubmVzdEJ5IDogW3RoaXMubmVzdEJ5XTtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiByZWR1Y2VWYXJpYWJsZXMoZCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY1tjdXJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heDogICAgICAgZDMubWF4KGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW46ICAgICAgIGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVhbjogICAgICBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW06ICAgICAgIGQzLnN1bShkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFuOiAgICBkMy5tZWRpYW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbmNlOiAgZDMudmFyaWFuY2UoZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmlhdGlvbjogZDMuZGV2aWF0aW9uKGQsIGQgPT4gZFtjdXJdKVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgICAgIH0se30pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3aGlsZSAoIG5lc3RCeUFycmF5Lmxlbmd0aCA+IDApe1xuICAgICAgICAgICAgICAgICAgICBsZXQgc3VtbWFyaXplZCA9IHRoaXMubmVzdFByZWxpbShuZXN0QnlBcnJheSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yb2xsdXAocmVkdWNlVmFyaWFibGVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh0aGlzLnVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMudW5zaGlmdChzdW1tYXJpemVkKTsgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgXG4gICAgICAgICAgICBuZXN0UHJlbGltKG5lc3RCeUFycmF5KXtcbiAgICAgICAgICAgICAgICAvLyByZWN1cnNpdmUgIG5lc3RpbmcgZnVuY3Rpb24gdXNlZCBieSBzdW1tYXJpemVEYXRhIGFuZCByZXR1cm5LZXlWYWx1ZXNcbiAgICAgICAgICAgICAgICByZXR1cm4gbmVzdEJ5QXJyYXkucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXIgIT09ICdzdHJpbmcnICYmIHR5cGVvZiBjdXIgIT09ICdmdW5jdGlvbicgKSB7IHRocm93ICdlYWNoIG5lc3RCeSBpdGVtIG11c3QgYmUgYSBzdHJpbmcgb3IgZnVuY3Rpb24nOyB9XG4gICAgICAgICAgICAgICAgICAgIHZhciBydG47XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ3N0cmluZycgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ0biA9IGFjYy5rZXkoZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRbY3VyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pOyAgICBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdmdW5jdGlvbicgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ0biA9IGFjYy5rZXkoZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN1cihkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBydG47XG4gICAgICAgICAgICAgICAgfSwgZDMubmVzdCgpKTtcbiAgICAgICAgICAgIH0sICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbmVzdEJ5LCBjb2VyY2UgPSBmYWxzZSwgbmVzdFR5cGUgPSAnc2VyaWVzJywgdGFiSW5kZXggPSAwKXtcbiAgICAgICAgICAgIC8vIHRoaXMgZm4gdGFrZXMgbm9ybWFsaXplZCBkYXRhIGZldGNoZWQgYXMgYW4gYXJyYXkgb2Ygcm93cyBhbmQgdXNlcyB0aGUgdmFsdWVzIGluIHRoZSBmaXJzdCByb3cgYXMga2V5cyBmb3IgdmFsdWVzIGluXG4gICAgICAgICAgICAvLyBzdWJzZXF1ZW50IHJvd3NcbiAgICAgICAgICAgIC8vIG5lc3RCeSA9IHN0cmluZyBvciBhcnJheSBvZiBmaWVsZChzKSB0byBuZXN0IGJ5LCBvciBhIGN1c3RvbSBmdW5jdGlvbiwgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnM7XG4gICAgICAgICAgICAvLyBjb2VyY2UgPSBCT09MIGNvZXJjZSB0byBudW0gb3Igbm90OyBuZXN0VHlwZSA9IG9iamVjdCBvciBzZXJpZXMgbmVzdCAoZDMpXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHByZWxpbTsgXG4gICAgICAgICAgICAgICAgdmFyIHVubmVzdGVkID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1ciwgaSkgeyBcbiAgICAgICAgICAgICAgICAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgICAvLyAzLiAvLyBhY2MgaXMgYW4gb2JqZWN0ICwga2V5IGlzIGNvcnJlc3BvbmRpbmcgdmFsdWUgZnJvbSByb3cgMCwgdmFsdWUgaXMgY3VycmVudCB2YWx1ZSBvZiBhcnJheVxuICAgICAgICAgICAgICAgICAgYWNjW3ZhbHVlc1swXVtpXV0gPSBjb2VyY2UgPT09IHRydWUgPyBpc05hTigrY3VyKSB8fCBjdXIgPT09ICcnID8gY3VyIDogK2N1ciA6IGN1cjsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRlc3QgZm9yIGVtcHR5IHN0cmluZ3MgYmVmb3JlIGNvZXJjaW5nIGJjICsnJyA9PiAwXG4gICAgICAgICAgICAgICAgfSwge30pKTtcbiAgICAgICAgICAgICAgICBpZiAoIHRhYkluZGV4ID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbC51bm5lc3RlZCA9IHVubmVzdGVkO1xuICAgICAgICAgICAgICAgIH0gICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICggIW5lc3RCeSApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgbmVzdEJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbmVzdEJ5ID09PSAnZnVuY3Rpb24nICkgeyAvLyBpZSBvbmx5IG9uZSBuZXN0QnkgZmllbGQgb3IgZnVuY2l0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IG1vZGVsLm5lc3RQcmVsaW0oW25lc3RCeV0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG5lc3RCeSkpIHsgdGhyb3cgJ25lc3RCeSB2YXJpYWJsZSBtdXN0IGJlIGEgc3RyaW5nLCBmdW5jdGlvbiwgb3IgYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnMnOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSBtb2RlbC5uZXN0UHJlbGltKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCBuZXN0VHlwZSA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh1bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudHJpZXModW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICB2aWV3OiB7XG4gICAgICAgICAgICBpbml0KGNvbnRhaW5lcil7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXJnaW5zID0geyAvLyBkZWZhdWx0IHZhbHVlcyA7IGNhbiBiZSBzZXQgYmUgZWFjaCBTVkdzIERPTSBkYXRhc2V0IChodG1sIGRhdGEgYXR0cmlidXRlcykuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBTFNPIGRlZmF1bHQgc2hvdWxkIGJlIGFibGUgdG8gY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgdG9wOjIwLFxuICAgICAgICAgICAgICAgICAgICByaWdodDo0NSxcbiAgICAgICAgICAgICAgICAgICAgYm90dG9tOjE1LFxuICAgICAgICAgICAgICAgICAgICBsZWZ0OjM1XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZUZpZWxkID0gJ3BiMjVsJzsgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICB0aGlzLnNldHVwQ2hhcnRzKGNvbnRhaW5lcik7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGFiZWwoa2V5KXsgLy8gaWYgeW91IGNhbiBnZXQgdGhlIHN1bW1hcnkgdmFsdWVzIHRvIGJlIGtleWVkIGFsbCB0aGUgd2F5IGRvd24sIHlvdSB3b3VsZG4ndCBuZWVkIEFycmF5LmZpbmRcbiAgICAgICAgICAgICAgIHJldHVybiBtb2RlbC5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXR1cENoYXJ0cyhjb250YWluZXIpeyBcbiAgICAgICAgICAgICAgICB2YXIgY2hhcnREaXZzID0gZDMuc2VsZWN0KGNvbnRhaW5lcikuc2VsZWN0QWxsKCcuZDMtY2hhcnQnKTsgXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhcnREaXZzKTtcblxuICAgICAgICAgICAgICAgIGNoYXJ0RGl2cy5lYWNoKGZ1bmN0aW9uKCkgeyAvLyBUTyBETyBkaWZmZXJlbnRpYXRlIGNoYXJ0IHR5cGVzIGZyb20gaHRtbCBkYXRhc2V0XG4gICAgICAgICAgICAgICAgICAgIC8qIGNoYXJ0RGl2cy5lYWNoIHNjb3BlZCBnbG9iYWxzICovXG4gICAgICAgICAgICAgICAgICAgIC8vICoqIFRPIERPICoqIGFsbG93IGRhdGEgYXR0ciBzdHJpbmdzIHRvIGJlIHF1b3RlZCBvbmx5IG9uY2UuIGllIEpTT04ucGFyc2Ugb25seSBpZiBzdHJpbmcgaW5jbHVkZXMgLyBzdGFydHMgd2l0aCBbXVxuXG4gICAgICAgICAgICAgICAgICAgIHZhciBjb25maWcgPSB0aGlzLmRhdGFzZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICBzY2FsZUluc3RydWN0ID0gY29uZmlnLnJlc2V0U2NhbGUgPyBKU09OLnBhcnNlKGNvbmZpZy5yZXNldFNjYWxlKSA6ICdub25lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVJbmRleCA9IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJpZXNJbmRleCA9IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5Ub3AgPSArY29uZmlnLm1hcmdpblRvcCB8fCB2aWV3Lm1hcmdpbnMudG9wLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luUmlnaHQgPSArY29uZmlnLm1hcmdpblJpZ2h0IHx8IHZpZXcubWFyZ2lucy5yaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpbkJvdHRvbSA9ICtjb25maWcubWFyZ2luQm90dG9tIHx8IHZpZXcubWFyZ2lucy5ib3R0b20sXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5MZWZ0ID0gK2NvbmZpZy5tYXJnaW5MZWZ0IHx8IHZpZXcubWFyZ2lucy5sZWZ0LFxuICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGggPSBjb25maWcuZWFjaFdpZHRoIC0gbWFyZ2luTGVmdCAtIG1hcmdpblJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0ID0gY29uZmlnLmVhY2hIZWlnaHQgPyBjb25maWcuZWFjaEhlaWdodCAtIG1hcmdpblRvcCAtIG1hcmdpbkJvdHRvbSA6IGNvbmZpZy5lYWNoV2lkdGggLyAyIC0gbWFyZ2luVG9wIC0gbWFyZ2luQm90dG9tLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0dW0gPSBtb2RlbC5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gY29uZmlnLmNhdGVnb3J5KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pblggPSAyMDE1LCAvLyAhISEgTk9UIFBST0dSQU1BVElDXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhYID0gMjA0NSwgLy8gISEhIE5PVCBQUk9HUkFNQVRJQ1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQkVMT1cgbmVlZHMgaW5wdXQgZnJvbSBIVE1MLS1kZWZhdWx0IG1heGVzIGFuZCBtaW5zIGluIGNhc2UgbmF0dXJhbCBtaW4gPiAwLCBtYXggPCAwLCBvciBzaW1wbHkgd2FudCB0byBvdmVycmlkZVxuICAgICAgICAgICAgICAgICAgICAgICAgbWluWSA9IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDwgMCA/IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heFkgPSBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCA+IE1hdGguYWJzKG1pblkgLyAyKSA/IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWF4IDogTWF0aC5hYnMobWluWSAvIDIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VUaW1lID0gZDMudGltZVBhcnNlKCclWScpLCAvLyAhISEgTk9UIFBST0dSQU1BVElDXG4gICAgICAgICAgICAgICAgICAgICAgICB4ID0gZDMuc2NhbGVUaW1lKCkucmFuZ2UoWzAsIHdpZHRoXSkuZG9tYWluKFtwYXJzZVRpbWUobWluWCkscGFyc2VUaW1lKG1heFgpXSksIC8vICEhISBOT1QgUFJPR1JBTUFUSUNcbiAgICAgICAgICAgICAgICAgICAgICAgIHkgPSBkMy5zY2FsZUxpbmVhcigpLnJhbmdlKFtoZWlnaHQsIDBdKS5kb21haW4oW21pblksbWF4WV0pLCAgLy8gISEhIE5PVCBQUk9HUkFNQVRJQ1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhcnREaXYgPSBkMy5zZWxlY3QodGhpcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZGF0dW0oZGF0dW0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGluZ3MgPSBjaGFydERpdi5hcHBlbmQoJ3AnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFNWR3MgPSBjaGFydERpdi5hcHBlbmQoJ2RpdicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywnZmxleCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnU1ZHcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmRhdGEoZCA9PiBncm91cFNlcmllcyhkLnZhbHVlcykgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnc3ZnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignd2lkdGgnLCBjb25maWcuZWFjaFdpZHRoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdoZWlnaHQnLCBoZWlnaHQgKyBtYXJnaW5Ub3AgKyBtYXJnaW5Cb3R0b20pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIGB0cmFuc2xhdGUoJHttYXJnaW5MZWZ0fSwke21hcmdpblRvcH0pYCksXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZWxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAueChkID0+IHgocGFyc2VUaW1lKGQueWVhcikpICkgLy8gISEgbm90IHByb2dyYW1tYXRpY1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC55KGQgPT4geShkW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10pICk7IC8vICEhIG5vdCBwcm9ncmFtbWF0aWNcblxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBncm91cFNlcmllcyhkYXRhKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JvdXBzSW5zdHJ1Y3QgPSBjb25maWcuc2VyaWVzR3JvdXAgPyBKU09OLnBhcnNlKGNvbmZpZy5zZXJpZXNHcm91cCkgOiAnbm9uZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIEFycmF5LmlzQXJyYXkoIGdyb3Vwc0luc3RydWN0ICkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgSlNPTi5wYXJzZShjb25maWcuc2VyaWVzR3JvdXApLmZvckVhY2goZ3JvdXAgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMucHVzaChkYXRhLmZpbHRlcihzZXJpZXMgPT4gZ3JvdXAuaW5kZXhPZihzZXJpZXMua2V5KSAhPT0gLTEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnbm9uZScgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gZGF0YS5tYXAoZWFjaCA9PiBbZWFjaF0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdhbGwnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFtkYXRhLm1hcChlYWNoID0+IGVhY2gpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgYEludmFsaWQgZGF0YS1ncm91cC1zZXJpZXMgaW5zdHJ1Y3Rpb24gZnJvbSBodG1sLiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTXVzdCBiZSB2YWxpZCBKU09OOiBcIk5vbmVcIiBvciBcIkFsbFwiIG9yIGFuIGFycmF5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mIGFycmF5cyBjb250YWluaW5nIHRoZSBzZXJpZXMgdG8gYmUgZ3JvdXBlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2dldGhlci4gQWxsIHN0cmluZ3MgbXVzdCBiZSBkb3VibGUtcXVvdGVkLmA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VyaWVzR3JvdXBzO1xuICAgICAgICAgICAgICAgICAgICB9IC8vIGVuZCBncm91cFNlcmllcygpXG5cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8qIEhFQURJTkdTICovXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWFkaW5ncy5odG1sKGQgPT4gJzxzdHJvbmc+JyArIHZpZXcubGFiZWwoZC5rZXkpICsgJzwvc3Ryb25nPicpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8qIFNWR1MgKi9cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIFNWR3MuZWFjaChmdW5jdGlvbihkLGkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIFNWRyA9IGQzLnNlbGVjdCh0aGlzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhID0gU1ZHLmRhdGEoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bml0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBTVkdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnc2VyaWVzLWdyb3VwcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGRhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBhZGRZQXhpcyhyZXBlYXRlZCA9ICcnLCBzaG93VW5pdHMgPSBmYWxzZSl7ICAvLyAhISBOT1QgUFJPR1JBTU1BVElDXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLyoganNoaW50IHZhbGlkdGhpczogdHJ1ZSAqLyAvKiA8LSBjb21tZW50IGtlZXBzIGpzaGludCBmcm9tIGZhbHNlbHkgd2FybmluZyB0aGF0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgdGhpc2Agd2lsbCBiZSB1bmRlZmluZWQuIHRoZSAuY2FsbCgpIG1ldGhvZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmaW5lcyBgdGhpc2AgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+ICdheGlzIHktYXhpcyAnICsgcmVwZWF0ZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzTGVmdCh5KS50aWNrU2l6ZUlubmVyKDQpLnRpY2tTaXplT3V0ZXIoMCkudGlja1BhZGRpbmcoMSkudGlja3MoNSkpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBzaG93VW5pdHMgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAndW5pdHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICgpID0+IGB0cmFuc2xhdGUoLSR7bWFyZ2luTGVmdH0sLSR7bWFyZ2luVG9wIC0gMTB9KWApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudGV4dCgoKSA9PiB1bml0cy5yZW1vdmVVbmRlcnNjb3JlcygpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIFBBVEhTICovXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggY29uZmlnLnR5cGUgPT09ICdsaW5lJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyAvLyAhISBOT1QgUFJPR1JBTU1BVElDICwgSUUsIFRZUEUgTkVFRFMgVE8gQkUgU1BFQ0lGSUVEIEJZIGNvbmZpZy50eXBlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3NlcmllcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnbGluZSBsaW5lLScgKyBsaW5lSW5kZXgrKztcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIChkLGopID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuaXRzID0gZC52YWx1ZXNbMV0udW5pdHM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHNjYWxlSW5zdHJ1Y3QuaW5kZXhPZihkLmtleSkgIT09IC0xICl7IC8vIFRPRE86IHJlc2V0dGluZyBzY2FsZSBtYWtlIHRoZSBzZXJpZXMgbWluLG1heCBmcm9tIHRoZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXJpZXMnIG93biBkYXRhLCBub3QgdGhlIG9uZSBpdCdzIGdyb3VwZWQgd2l0aCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBOT1QgUFJPR1JBTU1BVElDICovIG1pblkgPSBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gPCAwID8gbW9kZWwuc3VtbWFyaWVzWzFdW2RhdHVtLmtleV1bZC5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDogMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBOT1QgUFJPR1JBTU1BVElDICovIG1heFkgPSBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggPiBNYXRoLmFicyhtaW5ZIC8gMikgPyBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggOiBNYXRoLmFicyhtaW5ZIC8gMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeCA9IGQzLnNjYWxlVGltZSgpLnJhbmdlKFswLCB3aWR0aF0pLmRvbWFpbihbcGFyc2VUaW1lKG1pblgpLHBhcnNlVGltZShtYXhYKV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHkgPSBkMy5zY2FsZUxpbmVhcigpLnJhbmdlKFtoZWlnaHQsIDBdKS5kb21haW4oW21pblksbWF4WV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggaSAhPT0gMCAmJiBqID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRZQXhpcy5jYWxsKHRoaXMsJycsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCBpICE9PSAwICYmIGogPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZFlBeGlzLmNhbGwodGhpcywncmVwZWF0ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQudmFsdWVzLnVuc2hpZnQoe3llYXI6MjAxNSxbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXTowfSk7IC8vVE8gRE86IHB1dCBpbiBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVhY2goZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhciBkYXRhID0gZDMuc2VsZWN0KHRoaXMpLmRhdGEoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25maWcuZGlyZWN0TGFiZWwpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNWRy5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiAnc2VyaWVzLWxhYmVsIHNlcmllcy0nICsgc2VyaWVzSW5kZXgrKylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmh0bWwoKCkgPT4gJzx0c3BhbiB4PVwiMFwiPicgKyB2aWV3LmxhYmVsKGQua2V5KS5yZXBsYWNlKC9cXFxcbi9nLCc8L3RzcGFuPjx0c3BhbiB4PVwiMFwiIGR5PVwiMS4yZW1cIj4nKSArICc8L3RzcGFuPicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoKSA9PiBgdHJhbnNsYXRlKCR7d2lkdGggKyAzfSwke3koZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXSkgKyAzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBYIEFYSVMgKi9cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNWRy5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLCcgKyB5KDApICsgJyknKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzQm90dG9tKHgpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrVmFsdWVzKFtwYXJzZVRpbWUoMjAyNSkscGFyc2VUaW1lKDIwMzUpLHBhcnNlVGltZSgyMDQ1KV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBZIEFYSVMgKi8gICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpID09PSAwICkgeyAvLyBpIGhlcmUgaXMgZnJvbSB0aGUgU1ZHLmVhY2ggbG9vcC4gYXBwZW5kIHlBeGlzIHRvIGFsbCBmaXJzdCBTVkdzIG9mIGNoYXJ0RGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZFlBeGlzLmNhbGwodGhpcywgJycsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gLy8gZW5kIGlmIHR5cGUgPT09ICdsaW5lJ1xuICAgICAgICAgICAgICAgICAgICB9KTsgLy8gZW5kIFNWR3MuZWFjaCgpXG4gICAgICAgICAgICAgICAgfSk7IC8vIGVuZCBjaGFydERpdnMuZWFjaCgpXG4gICAgICAgICAgICB9IC8vIGVuZCB2aWV3LnNldHVwQ2hhcnRzKClcbiAgICAgICAgfSwgLy8gZW5kIHZpZXdcblxuICAgICAgICBjb250cm9sbGVyOiB7XG4gICAgICAgICAgICBpbml0Q29udHJvbGxlcjogZnVuY3Rpb24oY29udGFpbmVyKXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzKTsgLy8gYHRoaXNgIGlzIGNvbnRyb2xsZXJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhtb2RlbCk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2codmlldyk7XG4gICAgICAgICAgICAgICAgbW9kZWwuaW5pdChjb250YWluZXIpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWwuZGF0YSA9IHZhbHVlc1swXTtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWwuZGljdGlvbmFyeSA9IHZhbHVlc1sxXS51bmRlZmluZWQudW5kZWZpbmVkOyAvLyAhISBOT1QgUFJPR1JBTU1BVElDIC8gQ09OU0lTVEVOVFxuICAgICAgICAgICAgICAgICAgICBtb2RlbC5zdW1tYXJpemVEYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcuaW5pdChjb250YWluZXIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTsgLy8gRDNDaGFydEdyb3VwIHByb3RvdHlwZSBlbmRzIGhlcmVcbiAgICBcbiAgICB3aW5kb3cuRDNDaGFydHMgPSB7IC8vIG5lZWQgdG8gc3BlY2lmeSB3aW5kb3cgYmMgYWZ0ZXIgdHJhbnNwaWxpbmcgYWxsIHRoaXMgd2lsbCBiZSB3cmFwcGVkIGluIElJRkVzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgYHJldHVybmBpbmcgd29uJ3QgZ2V0IHRoZSBleHBvcnQgaW50byB3aW5kb3cncyBnbG9iYWwgc2NvcGVcbiAgICAgICAgSW5pdCgpe1xuICAgICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmQzLWdyb3VwJykuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICBuZXcgRDNDaGFydEdyb3VwKGVhY2gpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBjYWxsIG5ldyBjb25zdHJ1Y3RvciBmb3IgZWFjaCB3cmFwcGVyIGRpdlxuICAgICAgICB9XG4gICAgfTtcbn0oKSk7IC8vIGVuZCB2YXIgRDNDaGFydHMgSUlGRSIsImV4cG9ydCBjb25zdCBIZWxwZXJzID0gKGZ1bmN0aW9uKCl7XG4gICAgXG4gICAgU3RyaW5nLnByb3RvdHlwZS5jbGVhblN0cmluZyA9IGZ1bmN0aW9uKCkgeyAvLyBsb3dlcmNhc2UgYW5kIHJlbW92ZSBwdW5jdHVhdGlvbiBhbmQgcmVwbGFjZSBzcGFjZXMgd2l0aCBoeXBoZW5zOyBkZWxldGUgcHVuY3R1YXRpb25cbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvWyBcXFxcXFwvXS9nLCctJykucmVwbGFjZSgvWydcIuKAneKAmeKAnOKAmCxcXC4hXFw/O1xcKFxcKSZdL2csJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgfTtcblxuICAgIFN0cmluZy5wcm90b3R5cGUucmVtb3ZlVW5kZXJzY29yZXMgPSBmdW5jdGlvbigpIHsgXG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL18vZywnICcpO1xuICAgIH07XG5cbn0pKCk7XG4iXX0=
