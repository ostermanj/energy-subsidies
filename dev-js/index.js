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
                chartDiv.append('p').html(function (d) {
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
                    if (i === 0) {
                        // i here is from the SVG.each loop. append yAxis to all first SVGs of chartDiv
                        addYAxis.call(this, '', true);
                    }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9IZWxwZXJzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNJQTs7a05BSkMsZ0MsQ0FBaUM7QUFDakM7Ozs7QUFJRCxJQUFJLFdBQVksWUFBVTtBQUMxQjs7QUFDSSxRQUFNLFFBQVE7QUFDVixZQURVLGtCQUNKO0FBQUE7O0FBQUU7QUFDSixpQkFBSyxZQUFMLEdBQW9CLEVBQXBCO0FBQ0EsaUJBQUssTUFBTCxHQUFjLENBQUMsVUFBRCxFQUFZLFFBQVosQ0FBZCxDQUZFLENBRW1DO0FBQ3JDLGdCQUFJLFVBQVUsOENBQWQ7QUFBQSxnQkFBOEQ7QUFDMUQsbUJBQU8sQ0FBQyxRQUFELEVBQVUsWUFBVixDQURYLENBSEUsQ0FJa0M7QUFDQTs7QUFFcEMsaUJBQUssT0FBTCxDQUFhLFVBQUMsSUFBRCxFQUFPLENBQVAsRUFBYTtBQUN0QixvQkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsdUJBQUcsSUFBSCxDQUFRLG1EQUFtRCxPQUFuRCxHQUE2RCxVQUE3RCxHQUEwRSxJQUExRSxHQUFpRiw4Q0FBekYsRUFBeUksVUFBQyxLQUFELEVBQU8sSUFBUCxFQUFnQjtBQUFFO0FBQ3ZKLDRCQUFJLEtBQUosRUFBVztBQUNQLG1DQUFPLEtBQVA7QUFDQSxrQ0FBTSxLQUFOO0FBQ0g7QUFDRCw0QkFBSSxTQUFTLEtBQUssTUFBbEI7QUFDQSw0QkFBSSxXQUFXLFNBQVMsWUFBVCxHQUF3QixRQUF4QixHQUFtQyxRQUFsRCxDQU5xSixDQU16RjtBQUM1RCxnQ0FBUSxNQUFLLGVBQUwsQ0FBcUIsTUFBckIsRUFBNkIsTUFBTSxNQUFuQyxFQUEyQyxJQUEzQyxFQUFpRCxRQUFqRCxFQUEyRCxDQUEzRCxDQUFSO0FBQ0gscUJBUkQ7QUFTSCxpQkFWYSxDQUFkO0FBV0Esc0JB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LEVBQWhCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIiAvKiBleHBvcnRlZCBEM0NoYXJ0cywgSGVscGVycyAqLyAvLyBsZXQncyBqc2hpbnQga25vdyB0aGF0IEQzQ2hhcnRzIGNhbiBiZSBcImRlZmluZWQgYnV0IG5vdCB1c2VkXCIgaW4gdGhpcyBmaWxlXG4gLyogcG9seWZpbGxzIG5lZWRlZDogUHJvbWlzZSwgQXJyYXkuaXNBcnJheSwgQXJyYXkuZmluZCwgQXJyYXkuZmlsdGVyXG5cbiAqL1xuaW1wb3J0IHsgSGVscGVycyB9IGZyb20gJy4uL2pzLWV4cG9ydHMvSGVscGVycyc7XG52YXIgRDNDaGFydHMgPSAoZnVuY3Rpb24oKXsgIFxuXCJ1c2Ugc3RyaWN0XCI7IFxuICAgIGNvbnN0IG1vZGVsID0ge1xuICAgICAgICBpbml0KCl7IC8vIFNIT1VMRCBUSElTIFNUVUZGIEJFIElOIENPTlRST0xMRVI/IHllcywgcHJvYmFibHlcbiAgICAgICAgICAgIHRoaXMuZGF0YVByb21pc2VzID0gW107XG4gICAgICAgICAgICB0aGlzLm5lc3RCeSA9IFsnY2F0ZWdvcnknLCdzZXJpZXMnXTsgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgIHZhciBzaGVldElEID0gJzFfRzlIc0pieFJCZDdmV1RGNTFYcjhscHhHeHhJbVZjYy1yVElhUWJFZXlBJywgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICB0YWJzID0gWydTaGVldDEnLCdkaWN0aW9uYXJ5J107IC8vIHRoaXMgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpcyB0aGVyZSBhIGNhc2UgZm9yIG1vcmUgdGhhbiBvbmUgc2hlZXQgb2YgZGF0YT9cblxuICAgICAgICAgICAgdGFicy5mb3JFYWNoKChlYWNoLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSxyZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZDMuanNvbignaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLycgKyBzaGVldElEICsgJy92YWx1ZXMvJyArIGVhY2ggKyAnP2tleT1BSXphU3lERDNXNXdKZUpGMmVzZmZaTVF4TnRFbDl0dC1PZmdTcTQnLCAoZXJyb3IsZGF0YSkgPT4geyAvLyBjb2x1bW5zIEEgdGhyb3VnaCBJXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlcyA9IGRhdGEudmFsdWVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RUeXBlID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gJ29iamVjdCcgOiAnc2VyaWVzJzsgLy8gbmVzdFR5cGUgZm9yIGRhdGEgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMucmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbW9kZWwubmVzdEJ5LCB0cnVlLCBuZXN0VHlwZSwgaSkpOyBcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHRoaXMuZGF0YVByb21pc2VzKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3VtbWFyaXplRGF0YSgpeyAvLyB0aGlzIGZuIGNyZWF0ZXMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBzdW1tYXJpemluZyB0aGUgZGF0YSBpbiBtb2RlbC5kYXRhLiBtb2RlbC5kYXRhIGlzIG5lc3RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBuZXN0aW5nIGFuZCByb2xsaW5nIHVwIGNhbm5vdCBiZSBkb25lIGVhc2lseSBhdCB0aGUgc2FtZSB0aW1lLCBzbyB0aGV5J3JlIGRvbmUgc2VwYXJhdGVseS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgc3VtbWFyaWVzIHByb3ZpZGUgYXZlcmFnZSwgbWF4LCBtaW4gb2YgYWxsIGZpZWxkcyBpbiB0aGUgZGF0YSBhdCBhbGwgbGV2ZWxzIG9mIG5lc3RpbmcuIFxuICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBmaXJzdCAoaW5kZXggMCkgaXMgb25lIGxheWVyIG5lc3RlZCwgdGhlIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi5cbiAgICAgICAgICAgIHRoaXMuc3VtbWFyaWVzID0gW107XG4gICAgICAgICAgICB2YXIgdmFyaWFibGVzID0gT2JqZWN0LmtleXModGhpcy51bm5lc3RlZFswXSk7IC8vIGFsbCBuZWVkIHRvIGhhdmUgdGhlIHNhbWUgZmllbGRzXG4gICAgICAgICAgICB2YXIgbmVzdEJ5QXJyYXkgPSBBcnJheS5pc0FycmF5KHRoaXMubmVzdEJ5KSA/IHRoaXMubmVzdEJ5IDogW3RoaXMubmVzdEJ5XTtcbiAgICAgICAgICAgIGZ1bmN0aW9uIHJlZHVjZVZhcmlhYmxlcyhkKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFyaWFibGVzLnJlZHVjZShmdW5jdGlvbihhY2MsIGN1cil7XG4gICAgICAgICAgICAgICAgICAgIGFjY1tjdXJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF4OiAgICAgICBkMy5tYXgoZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWluOiAgICAgICBkMy5taW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVhbjogICAgICBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1bTogICAgICAgZDMuc3VtKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lZGlhbjogICAgZDMubWVkaWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbmNlOiAgZDMudmFyaWFuY2UoZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWF0aW9uOiBkMy5kZXZpYXRpb24oZCwgZCA9PiBkW2N1cl0pXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgfSx7fSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAoIG5lc3RCeUFycmF5Lmxlbmd0aCA+IDApe1xuICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAucm9sbHVwKHJlZHVjZVZhcmlhYmxlcylcbiAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh0aGlzLnVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAgICAgIFxuICAgICAgICAgICAgICAgIG5lc3RCeUFycmF5LnBvcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCBcbiAgICAgICAgbmVzdFByZWxpbShuZXN0QnlBcnJheSl7XG4gICAgICAgICAgICAvLyByZWN1cnNpdmUgIG5lc3RpbmcgZnVuY3Rpb24gdXNlZCBieSBzdW1tYXJpemVEYXRhIGFuZCByZXR1cm5LZXlWYWx1ZXNcbiAgICAgICAgICAgIHJldHVybiBuZXN0QnlBcnJheS5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyICE9PSAnc3RyaW5nJyAmJiB0eXBlb2YgY3VyICE9PSAnZnVuY3Rpb24nICkgeyB0aHJvdyAnZWFjaCBuZXN0QnkgaXRlbSBtdXN0IGJlIGEgc3RyaW5nIG9yIGZ1bmN0aW9uJzsgfVxuICAgICAgICAgICAgICAgIHZhciBydG47XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnc3RyaW5nJyApe1xuICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRbY3VyXTtcbiAgICAgICAgICAgICAgICAgICAgfSk7ICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdmdW5jdGlvbicgKXtcbiAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjdXIoZCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcnRuO1xuICAgICAgICAgICAgfSwgZDMubmVzdCgpKTtcbiAgICAgICAgfSwgICAgICAgXG4gICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycsIHRhYkluZGV4ID0gMCl7XG4gICAgICAgIC8vIHRoaXMgZm4gdGFrZXMgbm9ybWFsaXplZCBkYXRhIGZldGNoZWQgYXMgYW4gYXJyYXkgb2Ygcm93cyBhbmQgdXNlcyB0aGUgdmFsdWVzIGluIHRoZSBmaXJzdCByb3cgYXMga2V5cyBmb3IgdmFsdWVzIGluXG4gICAgICAgIC8vIHN1YnNlcXVlbnQgcm93c1xuICAgICAgICAvLyBuZXN0QnkgPSBzdHJpbmcgb3IgYXJyYXkgb2YgZmllbGQocykgdG8gbmVzdCBieSwgb3IgYSBjdXN0b20gZnVuY3Rpb24sIG9yIGFuIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zO1xuICAgICAgICAvLyBjb2VyY2UgPSBCT09MIGNvZXJjZSB0byBudW0gb3Igbm90OyBuZXN0VHlwZSA9IG9iamVjdCBvciBzZXJpZXMgbmVzdCAoZDMpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBwcmVsaW07IFxuICAgICAgICAgICAgdmFyIHVubmVzdGVkID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1ciwgaSkgeyBcbiAgICAgICAgICAgIC8vIDEuIHBhcmFtczogdG90YWwsIGN1cnJlbnRWYWx1ZSwgY3VycmVudEluZGV4WywgYXJyXVxuICAgICAgICAgICAgLy8gMy4gLy8gYWNjIGlzIGFuIG9iamVjdCAsIGtleSBpcyBjb3JyZXNwb25kaW5nIHZhbHVlIGZyb20gcm93IDAsIHZhbHVlIGlzIGN1cnJlbnQgdmFsdWUgb2YgYXJyYXlcbiAgICAgICAgICAgICAgYWNjW3ZhbHVlc1swXVtpXV0gPSBjb2VyY2UgPT09IHRydWUgPyBpc05hTigrY3VyKSB8fCBjdXIgPT09ICcnID8gY3VyIDogK2N1ciA6IGN1cjsgXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFjYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGVzdCBmb3IgZW1wdHkgc3RyaW5ncyBiZWZvcmUgY29lcmNpbmcgYmMgKycnID0+IDBcbiAgICAgICAgICAgIH0sIHt9KSk7XG4gICAgICAgICAgICBpZiAoIHRhYkluZGV4ID09PSAwICkge1xuICAgICAgICAgICAgICAgIG1vZGVsLnVubmVzdGVkID0gdW5uZXN0ZWQ7XG4gICAgICAgICAgICB9ICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICggIW5lc3RCeSApe1xuICAgICAgICAgICAgICAgIHJldHVybiB1bm5lc3RlZDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgbmVzdEJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbmVzdEJ5ID09PSAnZnVuY3Rpb24nICkgeyAvLyBpZSBvbmx5IG9uZSBuZXN0QnkgZmllbGQgb3IgZnVuY2l0b25cbiAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gbW9kZWwubmVzdFByZWxpbShbbmVzdEJ5XSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG5lc3RCeSkpIHsgdGhyb3cgJ25lc3RCeSB2YXJpYWJsZSBtdXN0IGJlIGEgc3RyaW5nLCBmdW5jdGlvbiwgb3IgYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnMnOyB9XG4gICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IG1vZGVsLm5lc3RQcmVsaW0obmVzdEJ5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIG5lc3RUeXBlID09PSAnb2JqZWN0JyApe1xuICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh1bm5lc3RlZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgLmVudHJpZXModW5uZXN0ZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IHZpZXcgPSB7XG4gICAgICAgIGluaXQoKXtcbiAgICAgICAgICAgIHRoaXMubWFyZ2lucyA9IHsgLy8gZGVmYXVsdCB2YWx1ZXMgOyBjYW4gYmUgc2V0IGJlIGVhY2ggU1ZHcyBET00gZGF0YXNldCAoaHRtbCBkYXRhIGF0dHJpYnV0ZXMpLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBTFNPIGRlZmF1bHQgc2hvdWxkIGJlIGFibGUgdG8gY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICB0b3A6MjAsXG4gICAgICAgICAgICAgICAgcmlnaHQ6NDUsXG4gICAgICAgICAgICAgICAgYm90dG9tOjE1LFxuICAgICAgICAgICAgICAgIGxlZnQ6MzVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLmFjdGl2ZUZpZWxkID0gJ3BiMjVsJzsgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgIHRoaXMuc2V0dXBDaGFydHMoKTtcbiAgICAgICAgfSxcbiAgICAgICAgbGFiZWwoa2V5KXsgLy8gaWYgeW91IGNhbiBnZXQgdGhlIHN1bW1hcnkgdmFsdWVzIHRvIGJlIGtleWVkIGFsbCB0aGUgd2F5IGRvd24sIHlvdSB3b3VsZG4ndCBuZWVkIEFycmF5LmZpbmRcbiAgICAgICAgICAgIHJldHVybiBtb2RlbC5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0dXBDaGFydHMoKXsgXG4gICAgICAgICAgICB2YXIgY2hhcnREaXZzID0gZDMuc2VsZWN0QWxsKCcuZDMtY2hhcnQnKTsgLy8gc2VsZWN0b3Igd2lsbCBiZSBkaWZmZXJlbnQgd2hlbiB3cmFwcGVkIGluIGRhdGEgd3JhcHBlclxuXG4gICAgICAgICAgICBjaGFydERpdnMuZWFjaChmdW5jdGlvbigpIHsgLy8gVE8gRE8gZGlmZmVyZW50aWF0ZSBjaGFydCB0eXBlcyBmcm9tIGh0bWwgZGF0YXNldFxuICAgICAgICAgICAgICAgIC8qIGNoYXJ0RGl2cy5lYWNoIHNjb3BlZCBnbG9iYWxzICovXG4gICAgICAgICAgICAgICAgdmFyIGNvbmZpZyA9IHRoaXMuZGF0YXNldCxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGVJbnN0cnVjdCA9IGNvbmZpZy5yZXNldFNjYWxlID8gSlNPTi5wYXJzZShjb25maWcucmVzZXRTY2FsZSkgOiAnbm9uZScsXG4gICAgICAgICAgICAgICAgICAgIGxpbmVJbmRleCA9IDAsXG4gICAgICAgICAgICAgICAgICAgIHNlcmllc0luZGV4ID0gMCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luVG9wID0gK2NvbmZpZy5tYXJnaW5Ub3AgfHwgdmlldy5tYXJnaW5zLnRvcCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luUmlnaHQgPSArY29uZmlnLm1hcmdpblJpZ2h0IHx8IHZpZXcubWFyZ2lucy5yaWdodCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luQm90dG9tID0gK2NvbmZpZy5tYXJnaW5Cb3R0b20gfHwgdmlldy5tYXJnaW5zLmJvdHRvbSxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luTGVmdCA9ICtjb25maWcubWFyZ2luTGVmdCB8fCB2aWV3Lm1hcmdpbnMubGVmdCxcbiAgICAgICAgICAgICAgICAgICAgd2lkdGggPSBjb25maWcuZWFjaFdpZHRoIC0gbWFyZ2luTGVmdCAtIG1hcmdpblJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQgPSBjb25maWcuZWFjaEhlaWdodCA/IGNvbmZpZy5lYWNoSGVpZ2h0IC0gbWFyZ2luVG9wIC0gbWFyZ2luQm90dG9tIDogY29uZmlnLmVhY2hXaWR0aCAvIDIgLSBtYXJnaW5Ub3AgLSBtYXJnaW5Cb3R0b20sXG4gICAgICAgICAgICAgICAgICAgIGRhdHVtID0gbW9kZWwuZGF0YS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGNvbmZpZy5jYXRlZ29yeSksXG4gICAgICAgICAgICAgICAgICAgIG1pblggPSAyMDE1LCAvLyAhISEgTk9UIFBST0dSQU1BVElDXG4gICAgICAgICAgICAgICAgICAgIG1heFggPSAyMDQ1LCAvLyAhISEgTk9UIFBST0dSQU1BVElDXG4gICAgICAgICAgICAgICAgICAgIC8vIEJFTE9XIG5lZWRzIGlucHV0IGZyb20gSFRNTC0tZGVmYXVsdCBtYXhlcyBhbmQgbWlucyBpbiBjYXNlIG5hdHVyYWwgbWluID4gMCwgbWF4IDwgMCwgb3Igc2ltcGx5IHdhbnQgdG8gb3ZlcnJpZGVcbiAgICAgICAgICAgICAgICAgICAgbWluWSA9IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDwgMCA/IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDogMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4WSA9IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWF4ID4gTWF0aC5hYnMobWluWSAvIDIpID8gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggOiBNYXRoLmFicyhtaW5ZIC8gMiksXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlVGltZSA9IGQzLnRpbWVQYXJzZSgnJVknKSwgLy8gISEhIE5PVCBQUk9HUkFNQVRJQ1xuICAgICAgICAgICAgICAgICAgICB4ID0gZDMuc2NhbGVUaW1lKCkucmFuZ2UoWzAsIHdpZHRoXSkuZG9tYWluKFtwYXJzZVRpbWUobWluWCkscGFyc2VUaW1lKG1heFgpXSksIC8vICEhISBOT1QgUFJPR1JBTUFUSUNcbiAgICAgICAgICAgICAgICAgICAgeSA9IGQzLnNjYWxlTGluZWFyKCkucmFuZ2UoW2hlaWdodCwgMF0pLmRvbWFpbihbbWluWSxtYXhZXSksICAvLyAhISEgTk9UIFBST0dSQU1BVElDXG4gICAgICAgICAgICAgICAgICAgIGNoYXJ0RGl2ID0gZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZGF0dW0oZGF0dW0pLFxuICAgICAgICAgICAgICAgICAgICBTVkdzID0gY2hhcnREaXYuYXBwZW5kKCdkaXYnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywnZmxleCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdTVkdzJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4gZ3JvdXBTZXJpZXMoZC52YWx1ZXMpIClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnc3ZnJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIGNvbmZpZy5lYWNoV2lkdGgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgaGVpZ2h0ICsgbWFyZ2luVG9wICsgbWFyZ2luQm90dG9tKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgYHRyYW5zbGF0ZSgke21hcmdpbkxlZnR9LCR7bWFyZ2luVG9wfSlgKSxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAueChkID0+IHgocGFyc2VUaW1lKGQueWVhcikpICkgLy8gISEgbm90IHByb2dyYW1tYXRpY1xuICAgICAgICAgICAgICAgICAgICAgICAgLnkoZCA9PiB5KGRbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXSkgKTsgLy8gISEgbm90IHByb2dyYW1tYXRpY1xuXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gZ3JvdXBTZXJpZXMoZGF0YSl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBncm91cHNJbnN0cnVjdCA9IGNvbmZpZy5zZXJpZXNHcm91cCA/IEpTT04ucGFyc2UoY29uZmlnLnNlcmllc0dyb3VwKSA6ICdub25lJztcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBBcnJheS5pc0FycmF5KCBncm91cHNJbnN0cnVjdCApICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBKU09OLnBhcnNlKGNvbmZpZy5zZXJpZXNHcm91cCkuZm9yRWFjaChncm91cCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzLnB1c2goZGF0YS5maWx0ZXIoc2VyaWVzID0+IGdyb3VwLmluZGV4T2Yoc2VyaWVzLmtleSkgIT09IC0xKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdub25lJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IGRhdGEubWFwKGVhY2ggPT4gW2VhY2hdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdhbGwnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW2RhdGEubWFwKGVhY2ggPT4gZWFjaCldO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgYEludmFsaWQgZGF0YS1ncm91cC1zZXJpZXMgaW5zdHJ1Y3Rpb24gZnJvbSBodG1sLiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNdXN0IGJlIHZhbGlkIEpTT046IFwiTm9uZVwiIG9yIFwiQWxsXCIgb3IgYW4gYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZiBhcnJheXMgY29udGFpbmluZyB0aGUgc2VyaWVzIHRvIGJlIGdyb3VwZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2dldGhlci4gQWxsIHN0cmluZ3MgbXVzdCBiZSBkb3VibGUtcXVvdGVkLmA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlcmllc0dyb3VwcztcbiAgICAgICAgICAgICAgICB9IC8vIGVuZCBncm91cFNlcmllcygpXG5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvKiBIRUFESU5HUyAqL1xuICAgICAgICAgICAgICAgIGNoYXJ0RGl2LmFwcGVuZCgncCcpXG4gICAgICAgICAgICAgICAgICAgIC5odG1sKGQgPT4gJzxzdHJvbmc+JyArIHZpZXcubGFiZWwoZC5rZXkpICsgJzwvc3Ryb25nPicpO1xuXG4gICAgICAgICAgICAgICAgLyogU1ZHUyAqL1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIFNWR3MuZWFjaChmdW5jdGlvbihkLGkpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgU1ZHID0gZDMuc2VsZWN0KHRoaXMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IFNWRy5kYXRhKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB1bml0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFNWR1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3Nlcmllcy1ncm91cHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGRhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gYWRkWUF4aXMocmVwZWF0ZWQgPSAnJywgc2hvd1VuaXRzID0gZmFsc2Upe1xuICAgICAgICAgICAgICAgICAgICAgICAgLyoganNoaW50IHZhbGlkdGhpczogdHJ1ZSAqLyAvKiA8LSBjb21tZW50IGtlZXBzIGpzaGludCBmcm9tIGZhbHNlbHkgd2FybmluZyB0aGF0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGB0aGlzYCB3aWxsIGJlIHVuZGVmaW5lZC4gdGhlIC5jYWxsKCkgbWV0aG9kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmluZXMgYHRoaXNgICovXG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4gJ2F4aXMgeS1heGlzICcgKyByZXBlYXRlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQoeSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDUpKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBzaG93VW5pdHMgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAndW5pdHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKCkgPT4gYHRyYW5zbGF0ZSgtJHttYXJnaW5MZWZ0fSwtJHttYXJnaW5Ub3AgLSAxMH0pYClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnRleHQoKCkgPT4gdW5pdHMucmVtb3ZlVW5kZXJzY29yZXMoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvKiBQQVRIUyAqL1xuXG4gICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyAvLyAhISBOT1QgUFJPR1JBTU1BVElDICwgSUUsIFRZUEUgTkVFRFMgVE8gQkUgU1BFQ0lGSUVEIEJZIGNvbmZpZy50eXBlXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzZXJpZXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRhdGEoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2xpbmUgbGluZS0nICsgbGluZUluZGV4Kys7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIChkLGopID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bml0cyA9IGQudmFsdWVzWzFdLnVuaXRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggc2NhbGVJbnN0cnVjdC5pbmRleE9mKGQua2V5KSAhPT0gLTEgKXsgLy8gVE9ETzogcmVzZXR0aW5nIHNjYWxlIG1ha2UgdGhlIHNlcmllcyBtaW4sbWF4IGZyb20gdGhlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXJpZXMnIG93biBkYXRhLCBub3QgdGhlIG9uZSBpdCdzIGdyb3VwZWQgd2l0aCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogTk9UIFBST0dSQU1NQVRJQyAqLyBtaW5ZID0gbW9kZWwuc3VtbWFyaWVzWzFdW2RhdHVtLmtleV1bZC5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDwgMCA/IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1pbiA6IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIE5PVCBQUk9HUkFNTUFUSUMgKi8gbWF4WSA9IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCA+IE1hdGguYWJzKG1pblkgLyAyKSA/IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCA6IE1hdGguYWJzKG1pblkgLyAyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeCA9IGQzLnNjYWxlVGltZSgpLnJhbmdlKFswLCB3aWR0aF0pLmRvbWFpbihbcGFyc2VUaW1lKG1pblgpLHBhcnNlVGltZShtYXhYKV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB5ID0gZDMuc2NhbGVMaW5lYXIoKS5yYW5nZShbaGVpZ2h0LCAwXSkuZG9tYWluKFttaW5ZLG1heFldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpICE9PSAwICYmIGogPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRZQXhpcy5jYWxsKHRoaXMsJycsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGkgIT09IDAgJiYgaiA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZFlBeGlzLmNhbGwodGhpcywncmVwZWF0ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZC52YWx1ZXMudW5zaGlmdCh7eWVhcjoyMDE1LFt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddOjB9KTsgLy9UTyBETzogcHV0IGluIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuZWFjaChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhciBkYXRhID0gZDMuc2VsZWN0KHRoaXMpLmRhdGEoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uZmlnLmRpcmVjdExhYmVsKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU1ZHLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiAnc2VyaWVzLWxhYmVsIHNlcmllcy0nICsgc2VyaWVzSW5kZXgrKylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5odG1sKCgpID0+ICc8dHNwYW4geD1cIjBcIj4nICsgdmlldy5sYWJlbChkLmtleSkucmVwbGFjZSgvXFxcXG4vZywnPC90c3Bhbj48dHNwYW4geD1cIjBcIiBkeT1cIjEuMmVtXCI+JykgKyAnPC90c3Bhbj4nKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICgpID0+IGB0cmFuc2xhdGUoJHt3aWR0aCArIDN9LCR7eShkLnZhbHVlc1tkLnZhbHVlcy5sZW5ndGggLSAxXVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddKSArIDN9KWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8qIFggQVhJUyAqL1xuXG4gICAgICAgICAgICAgICAgICAgIFNWRy5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoMCwnICsgeSgwKSArICcpJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzIHgtYXhpcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzQm90dG9tKHgpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrVmFsdWVzKFtwYXJzZVRpbWUoMjAyNSkscGFyc2VUaW1lKDIwMzUpLHBhcnNlVGltZSgyMDQ1KV0pKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBpID09PSAwICkgeyAvLyBpIGhlcmUgaXMgZnJvbSB0aGUgU1ZHLmVhY2ggbG9vcC4gYXBwZW5kIHlBeGlzIHRvIGFsbCBmaXJzdCBTVkdzIG9mIGNoYXJ0RGl2XG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRZQXhpcy5jYWxsKHRoaXMsICcnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pOyAvLyBlbmQgU1ZHcy5lYWNoKClcbiAgICAgICAgICAgIH0pOyAvLyBlbmQgY2hhcnREaWNzLmVhY2goKVxuICAgICAgICB9IC8vIGVuZCB2aWV3LnNldHVwQ2hhcnRzKClcbiAgICB9OyAvLyBlbmQgdmlld1xuXG4gICAgY29uc3QgY29udHJvbGxlciA9IHtcbiAgICAgICAgaW5pdCgpe1xuICAgICAgICAgICAgbW9kZWwuaW5pdCgpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICBtb2RlbC5kYXRhID0gdmFsdWVzWzBdO1xuICAgICAgICAgICAgICAgIG1vZGVsLmRpY3Rpb25hcnkgPSB2YWx1ZXNbMV0udW5kZWZpbmVkLnVuZGVmaW5lZDsgLy8gISEgTk9UIFBST0dSQU1NQVRJQyAvIENPTlNJU1RFTlRcbiAgICAgICAgICAgICAgICBtb2RlbC5zdW1tYXJpemVEYXRhKCk7XG4gICAgICAgICAgICAgICAgdmlldy5pbml0KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgfTtcbiAgICB3aW5kb3cuRDNDaGFydHMgPSB7IC8vIG5lZWQgdG8gc3BlY2lmeSB3aW5kb3cgYmMgYWZ0ZXIgdHJhbnNwaWxpbmcgYWxsIHRoaXMgd2lsbCBiZSB3cmFwcGVkIGluIElJRkVzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgYHJldHVybmBpbmcgd29uJ3QgZ2V0IHRoZSBleHBvcnQgaW50byB3aW5kb3cncyBnbG9iYWwgc2NvcGVcbiAgICAgICAgSW5pdDogY29udHJvbGxlci5pbml0XG4gICAgfTtcbn0oKSk7IiwiZXhwb3J0IGNvbnN0IEhlbHBlcnMgPSAoZnVuY3Rpb24oKXtcbiAgICBcbiAgICBTdHJpbmcucHJvdG90eXBlLmNsZWFuU3RyaW5nID0gZnVuY3Rpb24oKSB7IC8vIGxvd2VyY2FzZSBhbmQgcmVtb3ZlIHB1bmN0dWF0aW9uIGFuZCByZXBsYWNlIHNwYWNlcyB3aXRoIGh5cGhlbnM7IGRlbGV0ZSBwdW5jdHVhdGlvblxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9bIFxcXFxcXC9dL2csJy0nKS5yZXBsYWNlKC9bJ1wi4oCd4oCZ4oCc4oCYLFxcLiFcXD87XFwoXFwpJl0vZywnJykudG9Mb3dlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgU3RyaW5nLnByb3RvdHlwZS5yZW1vdmVVbmRlcnNjb3JlcyA9IGZ1bmN0aW9uKCkgeyBcbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvXy9nLCcgJyk7XG4gICAgfTtcblxufSkoKTtcbiJdfQ==
