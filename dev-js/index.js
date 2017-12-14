(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _Helpers = require('../js-exports/Helpers');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; } /* exported D3Charts, Helpers */ // let's jshint know that D3Charts can be "defined but not used" in this file
/* polyfills needed: Promise, Array.isArray, Array.find, Array.filter
 */


var D3Charts = function () {
    "use strict";

    var model = {
        init: function init() {
            var _this = this;

            // SHOULD THIS STUFF BE IN CONTROLLER? yes, probably
            this.dataPromises = [];
            this.nestBy = ['category', 'series']; // this should come from HTML
            var sheetID = '1_G9HsJbxRBd7fWTF51Xr8lpxGxxImVcc-rTIaQbEeyA',
                // this should come from HTML
            tabs = ['Sheet1', 'dictionary']; // this should come from HTML
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
    };

    var view = {
        init: function init() {
            this.margins = { // default values ; can be set be each SVGs DOM dataset (html data attributes).
                // ALSO default should be able to come from HTML
                top: 20,
                right: 45,
                bottom: 15,
                left: 35
            };
            this.activeField = 'pb25l'; // this should come from HTML
            this.setupCharts();
        },
        label: function label(key) {
            // if you can get the summary values to be keyed all the way down, you wouldn't need Array.find
            return model.dictionary.find(function (each) {
                return each.key === key;
            }).label;
        },
        setupCharts: function setupCharts() {
            var chartDivs = d3.selectAll('.d3-chart'); // selector will be different when wrapped in data wrapper

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
                        throw 'Invalid data-group-series instruction from html. \n                               Must be valid JSON: "None" or "All" or an array\n                               of arrays containing the series to be grouped\n                               together. All strings must be double-quoted.';
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
            }); // end chartDics.each()
        } // end view.setupCharts()

    }; // end view

    var controller = {
        init: function init() {
            model.init().then(function (values) {
                model.data = values[0];
                model.dictionary = values[1].undefined.undefined; // !! NOT PROGRAMMATIC / CONSISTENT
                model.summarizeData();
                view.init();
            });
        }
    };
    window.D3Charts = { // need to specify window bc after transpiling all this will be wrapped in IIFEs
        // and `return`ing won't get the export into window's global scope
        Init: controller.init
    };
}();

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9IZWxwZXJzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNJQTs7a05BSkMsZ0MsQ0FBaUM7QUFDakM7Ozs7QUFJRCxJQUFJLFdBQVksWUFBVTtBQUMxQjs7QUFDSSxRQUFNLFFBQVE7QUFDVixZQURVLGtCQUNKO0FBQUE7O0FBQUU7QUFDSixpQkFBSyxZQUFMLEdBQW9CLEVBQXBCO0FBQ0EsaUJBQUssTUFBTCxHQUFjLENBQUMsVUFBRCxFQUFZLFFBQVosQ0FBZCxDQUZFLENBRW1DO0FBQ3JDLGdCQUFJLFVBQVUsOENBQWQ7QUFBQSxnQkFBOEQ7QUFDMUQsbUJBQU8sQ0FBQyxRQUFELEVBQVUsWUFBVixDQURYLENBSEUsQ0FJa0M7QUFDQTs7QUFFcEMsaUJBQUssT0FBTCxDQUFhLFVBQUMsSUFBRCxFQUFPLENBQVAsRUFBYTtBQUN0QixvQkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsdUJBQUcsSUFBSCxDQUFRLG1EQUFtRCxPQUFuRCxHQUE2RCxVQUE3RCxHQUEwRSxJQUExRSxHQUFpRiw4Q0FBekYsRUFBeUksVUFBQyxLQUFELEVBQU8sSUFBUCxFQUFnQjtBQUFFO0FBQ3ZKLDRCQUFJLEtBQUosRUFBVztBQUNQLG1DQUFPLEtBQVA7QUFDQSxrQ0FBTSxLQUFOO0FBQ0g7QUFDRCw0QkFBSSxTQUFTLEtBQUssTUFBbEI7QUFDQSw0QkFBSSxXQUFXLFNBQVMsWUFBVCxHQUF3QixRQUF4QixHQUFtQyxRQUFsRCxDQU5xSixDQU16RjtBQUM1RCxnQ0FBUSxNQUFLLGVBQUwsQ0FBcUIsTUFBckIsRUFBNkIsTUFBTSxNQUFuQyxFQUEyQyxJQUEzQyxFQUFpRCxRQUFqRCxFQUEyRCxDQUEzRCxDQUFSO0FBQ0gscUJBUkQ7QUFTSCxpQkFWYSxDQUFkO0FBV0Esc0JB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QUFPLFNBQVAsQ0FBaUIsaUJBQWpCLEdBQXFDLFlBQVc7QUFDNUMsZUFBTyxLQUFLLE9BQUwsQ0FBYSxJQUFiLEVBQWtCLEdBQWxCLENBQVA7QUFDSCxLQUZEO0FBSUgsQ0FWc0IsRUFBaEIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiIC8qIGV4cG9ydGVkIEQzQ2hhcnRzLCBIZWxwZXJzICovIC8vIGxldCdzIGpzaGludCBrbm93IHRoYXQgRDNDaGFydHMgY2FuIGJlIFwiZGVmaW5lZCBidXQgbm90IHVzZWRcIiBpbiB0aGlzIGZpbGVcbiAvKiBwb2x5ZmlsbHMgbmVlZGVkOiBQcm9taXNlLCBBcnJheS5pc0FycmF5LCBBcnJheS5maW5kLCBBcnJheS5maWx0ZXJcblxuICovXG5pbXBvcnQgeyBIZWxwZXJzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9IZWxwZXJzJztcbnZhciBEM0NoYXJ0cyA9IChmdW5jdGlvbigpeyAgXG5cInVzZSBzdHJpY3RcIjsgXG4gICAgY29uc3QgbW9kZWwgPSB7XG4gICAgICAgIGluaXQoKXsgLy8gU0hPVUxEIFRISVMgU1RVRkYgQkUgSU4gQ09OVFJPTExFUj8geWVzLCBwcm9iYWJseVxuICAgICAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMubmVzdEJ5ID0gWydjYXRlZ29yeScsJ3NlcmllcyddOyAvLyB0aGlzIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgdmFyIHNoZWV0SUQgPSAnMV9HOUhzSmJ4UkJkN2ZXVEY1MVhyOGxweEd4eEltVmNjLXJUSWFRYkVleUEnLCAvLyB0aGlzIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgIHRhYnMgPSBbJ1NoZWV0MScsJ2RpY3Rpb25hcnknXTsgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlzIHRoZXJlIGEgY2FzZSBmb3IgbW9yZSB0aGFuIG9uZSBzaGVldCBvZiBkYXRhP1xuXG4gICAgICAgICAgICB0YWJzLmZvckVhY2goKGVhY2gsIGkpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBkMy5qc29uKCdodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJyArIHNoZWV0SUQgKyAnL3ZhbHVlcy8nICsgZWFjaCArICc/a2V5PUFJemFTeUREM1c1d0plSkYyZXNmZlpNUXhOdEVsOXR0LU9mZ1NxNCcsIChlcnJvcixkYXRhKSA9PiB7IC8vIGNvbHVtbnMgQSB0aHJvdWdoIElcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWVzID0gZGF0YS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdFR5cGUgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyAnb2JqZWN0JyA6ICdzZXJpZXMnOyAvLyBuZXN0VHlwZSBmb3IgZGF0YSBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBtb2RlbC5uZXN0QnksIHRydWUsIG5lc3RUeXBlLCBpKSk7IFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFQcm9taXNlcy5wdXNoKHByb21pc2UpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwodGhpcy5kYXRhUHJvbWlzZXMpO1xuICAgICAgICB9LFxuICAgICAgICBzdW1tYXJpemVEYXRhKCl7IC8vIHRoaXMgZm4gY3JlYXRlcyBhbiBhcnJheSBvZiBvYmplY3RzIHN1bW1hcml6aW5nIHRoZSBkYXRhIGluIG1vZGVsLmRhdGEuIG1vZGVsLmRhdGEgaXMgbmVzdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIG5lc3RpbmcgYW5kIHJvbGxpbmcgdXAgY2Fubm90IGJlIGRvbmUgZWFzaWx5IGF0IHRoZSBzYW1lIHRpbWUsIHNvIHRoZXkncmUgZG9uZSBzZXBhcmF0ZWx5LlxuICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzdW1tYXJpZXMgcHJvdmlkZSBhdmVyYWdlLCBtYXgsIG1pbiBvZiBhbGwgZmllbGRzIGluIHRoZSBkYXRhIGF0IGFsbCBsZXZlbHMgb2YgbmVzdGluZy4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLCB0aGUgc2Vjb25kIGlzIHR3bywgYW5kIHNvIG9uLlxuICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgIHZhciB2YXJpYWJsZXMgPSBPYmplY3Qua2V5cyh0aGlzLnVubmVzdGVkWzBdKTsgLy8gYWxsIG5lZWQgdG8gaGF2ZSB0aGUgc2FtZSBmaWVsZHNcbiAgICAgICAgICAgIHZhciBuZXN0QnlBcnJheSA9IEFycmF5LmlzQXJyYXkodGhpcy5uZXN0QnkpID8gdGhpcy5uZXN0QnkgOiBbdGhpcy5uZXN0QnldO1xuICAgICAgICAgICAgZnVuY3Rpb24gcmVkdWNlVmFyaWFibGVzKGQpe1xuICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgYWNjW2N1cl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXg6ICAgICAgIGQzLm1heChkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW46ICAgICAgIGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtZWFuOiAgICAgIGQzLm1lYW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VtOiAgICAgICBkMy5zdW0oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFuOiAgICBkMy5tZWRpYW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFuY2U6ICBkMy52YXJpYW5jZShkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpYXRpb246IGQzLmRldmlhdGlvbihkLCBkID0+IGRbY3VyXSlcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgICAgICAgICB9LHt9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdoaWxlICggbmVzdEJ5QXJyYXkubGVuZ3RoID4gMCl7XG4gICAgICAgICAgICAgICAgbGV0IHN1bW1hcml6ZWQgPSB0aGlzLm5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpXG4gICAgICAgICAgICAgICAgICAgIC5yb2xsdXAocmVkdWNlVmFyaWFibGVzKVxuICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHRoaXMudW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3VtbWFyaWVzLnVuc2hpZnQoc3VtbWFyaXplZCk7ICAgICAgXG4gICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIFxuICAgICAgICBuZXN0UHJlbGltKG5lc3RCeUFycmF5KXtcbiAgICAgICAgICAgIC8vIHJlY3Vyc2l2ZSAgbmVzdGluZyBmdW5jdGlvbiB1c2VkIGJ5IHN1bW1hcml6ZURhdGEgYW5kIHJldHVybktleVZhbHVlc1xuICAgICAgICAgICAgcmV0dXJuIG5lc3RCeUFycmF5LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1cil7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXIgIT09ICdzdHJpbmcnICYmIHR5cGVvZiBjdXIgIT09ICdmdW5jdGlvbicgKSB7IHRocm93ICdlYWNoIG5lc3RCeSBpdGVtIG11c3QgYmUgYSBzdHJpbmcgb3IgZnVuY3Rpb24nOyB9XG4gICAgICAgICAgICAgICAgdmFyIHJ0bjtcbiAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdzdHJpbmcnICl7XG4gICAgICAgICAgICAgICAgICAgIHJ0biA9IGFjYy5rZXkoZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZFtjdXJdO1xuICAgICAgICAgICAgICAgICAgICB9KTsgICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ2Z1bmN0aW9uJyApe1xuICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGN1cihkKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBydG47XG4gICAgICAgICAgICB9LCBkMy5uZXN0KCkpO1xuICAgICAgICB9LCAgICAgICBcbiAgICAgICAgcmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbmVzdEJ5LCBjb2VyY2UgPSBmYWxzZSwgbmVzdFR5cGUgPSAnc2VyaWVzJywgdGFiSW5kZXggPSAwKXtcbiAgICAgICAgLy8gdGhpcyBmbiB0YWtlcyBub3JtYWxpemVkIGRhdGEgZmV0Y2hlZCBhcyBhbiBhcnJheSBvZiByb3dzIGFuZCB1c2VzIHRoZSB2YWx1ZXMgaW4gdGhlIGZpcnN0IHJvdyBhcyBrZXlzIGZvciB2YWx1ZXMgaW5cbiAgICAgICAgLy8gc3Vic2VxdWVudCByb3dzXG4gICAgICAgIC8vIG5lc3RCeSA9IHN0cmluZyBvciBhcnJheSBvZiBmaWVsZChzKSB0byBuZXN0IGJ5LCBvciBhIGN1c3RvbSBmdW5jdGlvbiwgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnM7XG4gICAgICAgIC8vIGNvZXJjZSA9IEJPT0wgY29lcmNlIHRvIG51bSBvciBub3Q7IG5lc3RUeXBlID0gb2JqZWN0IG9yIHNlcmllcyBuZXN0IChkMylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIHByZWxpbTsgXG4gICAgICAgICAgICB2YXIgdW5uZXN0ZWQgPSB2YWx1ZXMuc2xpY2UoMSkubWFwKHJvdyA9PiByb3cucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyLCBpKSB7IFxuICAgICAgICAgICAgLy8gMS4gcGFyYW1zOiB0b3RhbCwgY3VycmVudFZhbHVlLCBjdXJyZW50SW5kZXhbLCBhcnJdXG4gICAgICAgICAgICAvLyAzLiAvLyBhY2MgaXMgYW4gb2JqZWN0ICwga2V5IGlzIGNvcnJlc3BvbmRpbmcgdmFsdWUgZnJvbSByb3cgMCwgdmFsdWUgaXMgY3VycmVudCB2YWx1ZSBvZiBhcnJheVxuICAgICAgICAgICAgICBhY2NbdmFsdWVzWzBdW2ldXSA9IGNvZXJjZSA9PT0gdHJ1ZSA/IGlzTmFOKCtjdXIpIHx8IGN1ciA9PT0gJycgPyBjdXIgOiArY3VyIDogY3VyOyBcbiAgICAgICAgICAgICAgICByZXR1cm4gYWNjOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0IGZvciBlbXB0eSBzdHJpbmdzIGJlZm9yZSBjb2VyY2luZyBiYyArJycgPT4gMFxuICAgICAgICAgICAgfSwge30pKTtcbiAgICAgICAgICAgIGlmICggdGFiSW5kZXggPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgbW9kZWwudW5uZXN0ZWQgPSB1bm5lc3RlZDtcbiAgICAgICAgICAgIH0gICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCAhbmVzdEJ5ICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVubmVzdGVkO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBuZXN0QnkgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBuZXN0QnkgPT09ICdmdW5jdGlvbicgKSB7IC8vIGllIG9ubHkgb25lIG5lc3RCeSBmaWVsZCBvciBmdW5jaXRvblxuICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSBtb2RlbC5uZXN0UHJlbGltKFtuZXN0QnldKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkobmVzdEJ5KSkgeyB0aHJvdyAnbmVzdEJ5IHZhcmlhYmxlIG11c3QgYmUgYSBzdHJpbmcsIGZ1bmN0aW9uLCBvciBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucyc7IH1cbiAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gbW9kZWwubmVzdFByZWxpbShuZXN0QnkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICggbmVzdFR5cGUgPT09ICdvYmplY3QnICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHVubmVzdGVkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAuZW50cmllcyh1bm5lc3RlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgdmlldyA9IHtcbiAgICAgICAgaW5pdCgpe1xuICAgICAgICAgICAgdGhpcy5tYXJnaW5zID0geyAvLyBkZWZhdWx0IHZhbHVlcyA7IGNhbiBiZSBzZXQgYmUgZWFjaCBTVkdzIERPTSBkYXRhc2V0IChodG1sIGRhdGEgYXR0cmlidXRlcykuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFMU08gZGVmYXVsdCBzaG91bGQgYmUgYWJsZSB0byBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgIHRvcDoyMCxcbiAgICAgICAgICAgICAgICByaWdodDo0NSxcbiAgICAgICAgICAgICAgICBib3R0b206MTUsXG4gICAgICAgICAgICAgICAgbGVmdDozNVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlRmllbGQgPSAncGIyNWwnOyAvLyB0aGlzIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgdGhpcy5zZXR1cENoYXJ0cygpO1xuICAgICAgICB9LFxuICAgICAgICBsYWJlbChrZXkpeyAvLyBpZiB5b3UgY2FuIGdldCB0aGUgc3VtbWFyeSB2YWx1ZXMgdG8gYmUga2V5ZWQgYWxsIHRoZSB3YXkgZG93biwgeW91IHdvdWxkbid0IG5lZWQgQXJyYXkuZmluZFxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLmxhYmVsO1xuICAgICAgICB9LFxuICAgICAgICBzZXR1cENoYXJ0cygpeyBcbiAgICAgICAgICAgIHZhciBjaGFydERpdnMgPSBkMy5zZWxlY3RBbGwoJy5kMy1jaGFydCcpOyAvLyBzZWxlY3RvciB3aWxsIGJlIGRpZmZlcmVudCB3aGVuIHdyYXBwZWQgaW4gZGF0YSB3cmFwcGVyXG5cbiAgICAgICAgICAgIGNoYXJ0RGl2cy5lYWNoKGZ1bmN0aW9uKCkgeyAvLyBUTyBETyBkaWZmZXJlbnRpYXRlIGNoYXJ0IHR5cGVzIGZyb20gaHRtbCBkYXRhc2V0XG4gICAgICAgICAgICAgICAgLyogY2hhcnREaXZzLmVhY2ggc2NvcGVkIGdsb2JhbHMgKi9cbi8vICoqIFRPIERPICoqIGFsbG93IGRhdGEgYXR0ciBzdHJpbmdzIHRvIGJlIHF1b3RlZCBvbmx5IG9uY2UuIGllIEpTT04ucGFyc2Ugb25seSBpZiBzdHJpbmcgaW5jbHVkZXMgLyBzdGFydHMgd2l0aCBbXVxuXG4gICAgICAgICAgICAgICAgdmFyIGNvbmZpZyA9IHRoaXMuZGF0YXNldCxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGVJbnN0cnVjdCA9IGNvbmZpZy5yZXNldFNjYWxlID8gSlNPTi5wYXJzZShjb25maWcucmVzZXRTY2FsZSkgOiAnbm9uZScsXG4gICAgICAgICAgICAgICAgICAgIGxpbmVJbmRleCA9IDAsXG4gICAgICAgICAgICAgICAgICAgIHNlcmllc0luZGV4ID0gMCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luVG9wID0gK2NvbmZpZy5tYXJnaW5Ub3AgfHwgdmlldy5tYXJnaW5zLnRvcCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luUmlnaHQgPSArY29uZmlnLm1hcmdpblJpZ2h0IHx8IHZpZXcubWFyZ2lucy5yaWdodCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luQm90dG9tID0gK2NvbmZpZy5tYXJnaW5Cb3R0b20gfHwgdmlldy5tYXJnaW5zLmJvdHRvbSxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luTGVmdCA9ICtjb25maWcubWFyZ2luTGVmdCB8fCB2aWV3Lm1hcmdpbnMubGVmdCxcbiAgICAgICAgICAgICAgICAgICAgd2lkdGggPSBjb25maWcuZWFjaFdpZHRoIC0gbWFyZ2luTGVmdCAtIG1hcmdpblJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQgPSBjb25maWcuZWFjaEhlaWdodCA/IGNvbmZpZy5lYWNoSGVpZ2h0IC0gbWFyZ2luVG9wIC0gbWFyZ2luQm90dG9tIDogY29uZmlnLmVhY2hXaWR0aCAvIDIgLSBtYXJnaW5Ub3AgLSBtYXJnaW5Cb3R0b20sXG4gICAgICAgICAgICAgICAgICAgIGRhdHVtID0gbW9kZWwuZGF0YS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGNvbmZpZy5jYXRlZ29yeSksXG4gICAgICAgICAgICAgICAgICAgIG1pblggPSAyMDE1LCAvLyAhISEgTk9UIFBST0dSQU1BVElDXG4gICAgICAgICAgICAgICAgICAgIG1heFggPSAyMDQ1LCAvLyAhISEgTk9UIFBST0dSQU1BVElDXG4gICAgICAgICAgICAgICAgICAgIC8vIEJFTE9XIG5lZWRzIGlucHV0IGZyb20gSFRNTC0tZGVmYXVsdCBtYXhlcyBhbmQgbWlucyBpbiBjYXNlIG5hdHVyYWwgbWluID4gMCwgbWF4IDwgMCwgb3Igc2ltcGx5IHdhbnQgdG8gb3ZlcnJpZGVcbiAgICAgICAgICAgICAgICAgICAgbWluWSA9IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDwgMCA/IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDogMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4WSA9IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWF4ID4gTWF0aC5hYnMobWluWSAvIDIpID8gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggOiBNYXRoLmFicyhtaW5ZIC8gMiksXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlVGltZSA9IGQzLnRpbWVQYXJzZSgnJVknKSwgLy8gISEhIE5PVCBQUk9HUkFNQVRJQ1xuICAgICAgICAgICAgICAgICAgICB4ID0gZDMuc2NhbGVUaW1lKCkucmFuZ2UoWzAsIHdpZHRoXSkuZG9tYWluKFtwYXJzZVRpbWUobWluWCkscGFyc2VUaW1lKG1heFgpXSksIC8vICEhISBOT1QgUFJPR1JBTUFUSUNcbiAgICAgICAgICAgICAgICAgICAgeSA9IGQzLnNjYWxlTGluZWFyKCkucmFuZ2UoW2hlaWdodCwgMF0pLmRvbWFpbihbbWluWSxtYXhZXSksICAvLyAhISEgTk9UIFBST0dSQU1BVElDXG4gICAgICAgICAgICAgICAgICAgIGNoYXJ0RGl2ID0gZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZGF0dW0oZGF0dW0pLFxuICAgICAgICAgICAgICAgICAgICBoZWFkaW5ncyA9IGNoYXJ0RGl2LmFwcGVuZCgncCcpLFxuICAgICAgICAgICAgICAgICAgICBTVkdzID0gY2hhcnREaXYuYXBwZW5kKCdkaXYnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywnZmxleCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdTVkdzJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4gZ3JvdXBTZXJpZXMoZC52YWx1ZXMpIClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnc3ZnJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIGNvbmZpZy5lYWNoV2lkdGgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgaGVpZ2h0ICsgbWFyZ2luVG9wICsgbWFyZ2luQm90dG9tKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgYHRyYW5zbGF0ZSgke21hcmdpbkxlZnR9LCR7bWFyZ2luVG9wfSlgKSxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAueChkID0+IHgocGFyc2VUaW1lKGQueWVhcikpICkgLy8gISEgbm90IHByb2dyYW1tYXRpY1xuICAgICAgICAgICAgICAgICAgICAgICAgLnkoZCA9PiB5KGRbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXSkgKTsgLy8gISEgbm90IHByb2dyYW1tYXRpY1xuXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gZ3JvdXBTZXJpZXMoZGF0YSl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBncm91cHNJbnN0cnVjdCA9IGNvbmZpZy5zZXJpZXNHcm91cCA/IEpTT04ucGFyc2UoY29uZmlnLnNlcmllc0dyb3VwKSA6ICdub25lJztcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBBcnJheS5pc0FycmF5KCBncm91cHNJbnN0cnVjdCApICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBKU09OLnBhcnNlKGNvbmZpZy5zZXJpZXNHcm91cCkuZm9yRWFjaChncm91cCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzLnB1c2goZGF0YS5maWx0ZXIoc2VyaWVzID0+IGdyb3VwLmluZGV4T2Yoc2VyaWVzLmtleSkgIT09IC0xKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdub25lJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IGRhdGEubWFwKGVhY2ggPT4gW2VhY2hdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdhbGwnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW2RhdGEubWFwKGVhY2ggPT4gZWFjaCldO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgYEludmFsaWQgZGF0YS1ncm91cC1zZXJpZXMgaW5zdHJ1Y3Rpb24gZnJvbSBodG1sLiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNdXN0IGJlIHZhbGlkIEpTT046IFwiTm9uZVwiIG9yIFwiQWxsXCIgb3IgYW4gYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZiBhcnJheXMgY29udGFpbmluZyB0aGUgc2VyaWVzIHRvIGJlIGdyb3VwZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2dldGhlci4gQWxsIHN0cmluZ3MgbXVzdCBiZSBkb3VibGUtcXVvdGVkLmA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlcmllc0dyb3VwcztcbiAgICAgICAgICAgICAgICB9IC8vIGVuZCBncm91cFNlcmllcygpXG5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvKiBIRUFESU5HUyAqL1xuICAgICAgICAgICAgICAgICAgICBoZWFkaW5ncy5odG1sKGQgPT4gJzxzdHJvbmc+JyArIHZpZXcubGFiZWwoZC5rZXkpICsgJzwvc3Ryb25nPicpO1xuXG4gICAgICAgICAgICAgICAgLyogU1ZHUyAqL1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIFNWR3MuZWFjaChmdW5jdGlvbihkLGkpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgU1ZHID0gZDMuc2VsZWN0KHRoaXMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IFNWRy5kYXRhKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB1bml0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFNWR1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3Nlcmllcy1ncm91cHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGRhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gYWRkWUF4aXMocmVwZWF0ZWQgPSAnJywgc2hvd1VuaXRzID0gZmFsc2UpeyAgLy8gISEgTk9UIFBST0dSQU1NQVRJQ1xuICAgICAgICAgICAgICAgICAgICAgICAgLyoganNoaW50IHZhbGlkdGhpczogdHJ1ZSAqLyAvKiA8LSBjb21tZW50IGtlZXBzIGpzaGludCBmcm9tIGZhbHNlbHkgd2FybmluZyB0aGF0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGB0aGlzYCB3aWxsIGJlIHVuZGVmaW5lZC4gdGhlIC5jYWxsKCkgbWV0aG9kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmluZXMgYHRoaXNgICovXG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4gJ2F4aXMgeS1heGlzICcgKyByZXBlYXRlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQoeSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDUpKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBzaG93VW5pdHMgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAndW5pdHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKCkgPT4gYHRyYW5zbGF0ZSgtJHttYXJnaW5MZWZ0fSwtJHttYXJnaW5Ub3AgLSAxMH0pYClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnRleHQoKCkgPT4gdW5pdHMucmVtb3ZlVW5kZXJzY29yZXMoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvKiBQQVRIUyAqL1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICggY29uZmlnLnR5cGUgPT09ICdsaW5lJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzIC8vICEhIE5PVCBQUk9HUkFNTUFUSUMgLCBJRSwgVFlQRSBORUVEUyBUTyBCRSBTUEVDSUZJRUQgQlkgY29uZmlnLnR5cGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzZXJpZXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2xpbmUgbGluZS0nICsgbGluZUluZGV4Kys7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQsaikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bml0cyA9IGQudmFsdWVzWzFdLnVuaXRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHNjYWxlSW5zdHJ1Y3QuaW5kZXhPZihkLmtleSkgIT09IC0xICl7IC8vIFRPRE86IHJlc2V0dGluZyBzY2FsZSBtYWtlIHRoZSBzZXJpZXMgbWluLG1heCBmcm9tIHRoZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlcmllcycgb3duIGRhdGEsIG5vdCB0aGUgb25lIGl0J3MgZ3JvdXBlZCB3aXRoIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogTk9UIFBST0dSQU1NQVRJQyAqLyBtaW5ZID0gbW9kZWwuc3VtbWFyaWVzWzFdW2RhdHVtLmtleV1bZC5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDwgMCA/IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1pbiA6IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBOT1QgUFJPR1JBTU1BVElDICovIG1heFkgPSBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggPiBNYXRoLmFicyhtaW5ZIC8gMikgPyBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggOiBNYXRoLmFicyhtaW5ZIC8gMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB4ID0gZDMuc2NhbGVUaW1lKCkucmFuZ2UoWzAsIHdpZHRoXSkuZG9tYWluKFtwYXJzZVRpbWUobWluWCkscGFyc2VUaW1lKG1heFgpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB5ID0gZDMuc2NhbGVMaW5lYXIoKS5yYW5nZShbaGVpZ2h0LCAwXSkuZG9tYWluKFttaW5ZLG1heFldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggaSAhPT0gMCAmJiBqID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZFlBeGlzLmNhbGwodGhpcywnJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCBpICE9PSAwICYmIGogPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkWUF4aXMuY2FsbCh0aGlzLCdyZXBlYXRlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQudmFsdWVzLnVuc2hpZnQoe3llYXI6MjAxNSxbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXTowfSk7IC8vVE8gRE86IHB1dCBpbiBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVhY2goZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmFyIGRhdGEgPSBkMy5zZWxlY3QodGhpcykuZGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uZmlnLmRpcmVjdExhYmVsKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNWRy5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+ICdzZXJpZXMtbGFiZWwgc2VyaWVzLScgKyBzZXJpZXNJbmRleCsrKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5odG1sKCgpID0+ICc8dHNwYW4geD1cIjBcIj4nICsgdmlldy5sYWJlbChkLmtleSkucmVwbGFjZSgvXFxcXG4vZywnPC90c3Bhbj48dHNwYW4geD1cIjBcIiBkeT1cIjEuMmVtXCI+JykgKyAnPC90c3Bhbj4nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoKSA9PiBgdHJhbnNsYXRlKCR7d2lkdGggKyAzfSwke3koZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXSkgKyAzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvKiBYIEFYSVMgKi9cblxuICAgICAgICAgICAgICAgICAgICAgICAgU1ZHLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoMCwnICsgeSgwKSArICcpJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsKGQzLmF4aXNCb3R0b20oeCkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tWYWx1ZXMoW3BhcnNlVGltZSgyMDI1KSxwYXJzZVRpbWUoMjAzNSkscGFyc2VUaW1lKDIwNDUpXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvKiBZIEFYSVMgKi8gICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGkgPT09IDAgKSB7IC8vIGkgaGVyZSBpcyBmcm9tIHRoZSBTVkcuZWFjaCBsb29wLiBhcHBlbmQgeUF4aXMgdG8gYWxsIGZpcnN0IFNWR3Mgb2YgY2hhcnREaXZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRZQXhpcy5jYWxsKHRoaXMsICcnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSAvLyBlbmQgaWYgdHlwZSA9PT0gJ2xpbmUnXG4gICAgICAgICAgICAgICAgfSk7IC8vIGVuZCBTVkdzLmVhY2goKVxuICAgICAgICAgICAgfSk7IC8vIGVuZCBjaGFydERpY3MuZWFjaCgpXG4gICAgICAgIH0gLy8gZW5kIHZpZXcuc2V0dXBDaGFydHMoKVxuICAgIH07IC8vIGVuZCB2aWV3XG5cbiAgICBjb25zdCBjb250cm9sbGVyID0ge1xuICAgICAgICBpbml0KCl7XG4gICAgICAgICAgICBtb2RlbC5pbml0KCkudGhlbih2YWx1ZXMgPT4ge1xuICAgICAgICAgICAgICAgIG1vZGVsLmRhdGEgPSB2YWx1ZXNbMF07XG4gICAgICAgICAgICAgICAgbW9kZWwuZGljdGlvbmFyeSA9IHZhbHVlc1sxXS51bmRlZmluZWQudW5kZWZpbmVkOyAvLyAhISBOT1QgUFJPR1JBTU1BVElDIC8gQ09OU0lTVEVOVFxuICAgICAgICAgICAgICAgIG1vZGVsLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB2aWV3LmluaXQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICB9O1xuICAgIHdpbmRvdy5EM0NoYXJ0cyA9IHsgLy8gbmVlZCB0byBzcGVjaWZ5IHdpbmRvdyBiYyBhZnRlciB0cmFuc3BpbGluZyBhbGwgdGhpcyB3aWxsIGJlIHdyYXBwZWQgaW4gSUlGRXNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBgcmV0dXJuYGluZyB3b24ndCBnZXQgdGhlIGV4cG9ydCBpbnRvIHdpbmRvdydzIGdsb2JhbCBzY29wZVxuICAgICAgICBJbml0OiBjb250cm9sbGVyLmluaXRcbiAgICB9O1xufSgpKTsiLCJleHBvcnQgY29uc3QgSGVscGVycyA9IChmdW5jdGlvbigpe1xuICAgIFxuICAgIFN0cmluZy5wcm90b3R5cGUuY2xlYW5TdHJpbmcgPSBmdW5jdGlvbigpIHsgLy8gbG93ZXJjYXNlIGFuZCByZW1vdmUgcHVuY3R1YXRpb24gYW5kIHJlcGxhY2Ugc3BhY2VzIHdpdGggaHlwaGVuczsgZGVsZXRlIHB1bmN0dWF0aW9uXG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL1sgXFxcXFxcL10vZywnLScpLnJlcGxhY2UoL1snXCLigJ3igJnigJzigJgsXFwuIVxcPztcXChcXCkmXS9nLCcnKS50b0xvd2VyQ2FzZSgpO1xuICAgIH07XG5cbiAgICBTdHJpbmcucHJvdG90eXBlLnJlbW92ZVVuZGVyc2NvcmVzID0gZnVuY3Rpb24oKSB7IFxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9fL2csJyAnKTtcbiAgICB9O1xuXG59KSgpO1xuIl19
