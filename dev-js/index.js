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
        this.controller.initController(container, this.model, this.view);
    };
    //prototype begins here
    D3ChartGroup.prototype = {
        model: {
            init: function init(container) {
                var _this = this;

                // SHOULD THIS STUFF BE IN CONTROLLER? yes, probably
                var model = this;
                var groupConfig = container.dataset;
                this.dataPromises = [];
                this.nestBy = JSON.parse(groupConfig.nestBy);
                console.log('nest by', this.nestBy);
                var sheetID = groupConfig.sheetId,
                    tabs = [groupConfig.dataTab, groupConfig.dictionaryTab]; // this should come from HTML
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
                var model = this;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9IZWxwZXJzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNJQTs7a05BSkMsZ0MsQ0FBaUM7QUFDakM7Ozs7QUFLRCxJQUFJLFdBQVksWUFBVTtBQUMxQjs7QUFFSSxRQUFJLGtCQUFrQixFQUF0QjtBQUNBLFFBQUksZUFBZSxTQUFmLFlBQWUsQ0FBUyxTQUFULEVBQW9CLEtBQXBCLEVBQTBCO0FBQ3pDLGdCQUFRLEdBQVIsQ0FBWSxLQUFaO0FBQ0EsYUFBSyxTQUFMLEdBQWlCLFNBQWpCO0FBQ0EsYUFBSyxLQUFMLEdBQWEsS0FBYjtBQUNBLGFBQUssVUFBTCxDQUFnQixjQUFoQixDQUErQixTQUEvQixFQUEwQyxLQUFLLEtBQS9DLEVBQXNELEtBQUssSUFBM0Q7QUFDSCxLQUxEO0FBTUE7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBQ3JCLGVBQU87QUFDSCxnQkFERyxnQkFDRSxTQURGLEVBQ1k7QUFBQTs7QUFBRTtBQUNiLG9CQUFJLFFBQVEsSUFBWjtBQUNBLG9CQUFJLGNBQWMsVUFBVSxPQUE1QjtBQUNBLHFCQUFLLFlBQUwsR0FBb0IsRUFBcEI7QUFDQSxxQkFBSyxNQUFMLEdBQWMsS0FBSyxLQUFMLENBQVcsWUFBWSxNQUF2QixDQUFkO0FBQ0Esd0JBQVEsR0FBUixDQUFZLFNBQVosRUFBdUIsS0FBSyxNQUE1QjtBQUNBLG9CQUFJLFVBQVUsWUFBWSxPQUExQjtBQUFBLG9CQUNJLE9BQU8sQ0FBQyxZQUFZLE9BQWIsRUFBcUIsWUFBWSxhQUFqQyxDQURYLENBTlcsQ0FPaUQ7QUFDeEI7QUFDcEMscUJBQUssT0FBTCxDQUFhLFVBQUMsSUFBRCxFQUFPLENBQVAsRUFBYTtBQUN0Qix3QkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsMkJBQUcsSUFBSCxD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Q29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIiAvKiBleHBvcnRlZCBEM0NoYXJ0cywgSGVscGVycyAqLyAvLyBsZXQncyBqc2hpbnQga25vdyB0aGF0IEQzQ2hhcnRzIGNhbiBiZSBcImRlZmluZWQgYnV0IG5vdCB1c2VkXCIgaW4gdGhpcyBmaWxlXG4gLyogcG9seWZpbGxzIG5lZWRlZDogUHJvbWlzZSwgQXJyYXkuaXNBcnJheSwgQXJyYXkuZmluZCwgQXJyYXkuZmlsdGVyXG5cbiAqL1xuaW1wb3J0IHsgSGVscGVycyB9IGZyb20gJy4uL2pzLWV4cG9ydHMvSGVscGVycyc7XG5cbnZhciBEM0NoYXJ0cyA9IChmdW5jdGlvbigpeyAgXG5cInVzZSBzdHJpY3RcIjsgXG4gICAgXG4gICAgdmFyIGNoYXJ0Q29sbGVjdGlvbiA9IFtdO1xuICAgIHZhciBEM0NoYXJ0R3JvdXAgPSBmdW5jdGlvbihjb250YWluZXIsIGluZGV4KXtcbiAgICAgICAgY29uc29sZS5sb2coaW5kZXgpO1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICAgICAgdGhpcy5pbmRleCA9IGluZGV4O1xuICAgICAgICB0aGlzLmNvbnRyb2xsZXIuaW5pdENvbnRyb2xsZXIoY29udGFpbmVyLCB0aGlzLm1vZGVsLCB0aGlzLnZpZXcpO1xuICAgIH07XG4gICAgLy9wcm90b3R5cGUgYmVnaW5zIGhlcmVcbiAgICBEM0NoYXJ0R3JvdXAucHJvdG90eXBlID0ge1xuICAgICAgICBtb2RlbDoge1xuICAgICAgICAgICAgaW5pdChjb250YWluZXIpeyAvLyBTSE9VTEQgVEhJUyBTVFVGRiBCRSBJTiBDT05UUk9MTEVSPyB5ZXMsIHByb2JhYmx5XG4gICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcztcbiAgICAgICAgICAgICAgICB2YXIgZ3JvdXBDb25maWcgPSBjb250YWluZXIuZGF0YXNldDtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFQcm9taXNlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHRoaXMubmVzdEJ5ID0gSlNPTi5wYXJzZShncm91cENvbmZpZy5uZXN0QnkpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCduZXN0IGJ5JywgdGhpcy5uZXN0QnkpO1xuICAgICAgICAgICAgICAgIHZhciBzaGVldElEID0gZ3JvdXBDb25maWcuc2hlZXRJZCwgXG4gICAgICAgICAgICAgICAgICAgIHRhYnMgPSBbZ3JvdXBDb25maWcuZGF0YVRhYixncm91cENvbmZpZy5kaWN0aW9uYXJ5VGFiXTsgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpcyB0aGVyZSBhIGNhc2UgZm9yIG1vcmUgdGhhbiBvbmUgc2hlZXQgb2YgZGF0YT9cbiAgICAgICAgICAgICAgICB0YWJzLmZvckVhY2goKGVhY2gsIGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSxyZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLmpzb24oJ2h0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8nICsgc2hlZXRJRCArICcvdmFsdWVzLycgKyBlYWNoICsgJz9rZXk9QUl6YVN5REQzVzV3SmVKRjJlc2ZmWk1ReE50RWw5dHQtT2ZnU3E0JywgKGVycm9yLGRhdGEpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWVzID0gZGF0YS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RUeXBlID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gJ29iamVjdCcgOiAnc2VyaWVzJzsgLy8gbmVzdFR5cGUgZm9yIGRhdGEgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJldHVybktleVZhbHVlcyh2YWx1ZXMsIG1vZGVsLm5lc3RCeSwgdHJ1ZSwgbmVzdFR5cGUsIGkpKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHRoaXMuZGF0YVByb21pc2VzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdW1tYXJpemVEYXRhKCl7IC8vIHRoaXMgZm4gY3JlYXRlcyBhbiBhcnJheSBvZiBvYmplY3RzIHN1bW1hcml6aW5nIHRoZSBkYXRhIGluIG1vZGVsLmRhdGEuIG1vZGVsLmRhdGEgaXMgbmVzdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBuZXN0aW5nIGFuZCByb2xsaW5nIHVwIGNhbm5vdCBiZSBkb25lIGVhc2lseSBhdCB0aGUgc2FtZSB0aW1lLCBzbyB0aGV5J3JlIGRvbmUgc2VwYXJhdGVseS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHN1bW1hcmllcyBwcm92aWRlIGF2ZXJhZ2UsIG1heCwgbWluIG9mIGFsbCBmaWVsZHMgaW4gdGhlIGRhdGEgYXQgYWxsIGxldmVscyBvZiBuZXN0aW5nLiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLCB0aGUgc2Vjb25kIGlzIHR3bywgYW5kIHNvIG9uLlxuICAgICAgICAgICAgICAgIHRoaXMuc3VtbWFyaWVzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHZhcmlhYmxlcyA9IE9iamVjdC5rZXlzKHRoaXMudW5uZXN0ZWRbMF0pOyAvLyBhbGwgbmVlZCB0byBoYXZlIHRoZSBzYW1lIGZpZWxkc1xuICAgICAgICAgICAgICAgIHZhciBuZXN0QnlBcnJheSA9IEFycmF5LmlzQXJyYXkodGhpcy5uZXN0QnkpID8gdGhpcy5uZXN0QnkgOiBbdGhpcy5uZXN0QnldO1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHJlZHVjZVZhcmlhYmxlcyhkKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhcmlhYmxlcy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjW2N1cl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4OiAgICAgICBkMy5tYXgoZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbjogICAgICAgZDMubWluKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZWFuOiAgICAgIGQzLm1lYW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1bTogICAgICAgZDMuc3VtKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZWRpYW46ICAgIGQzLm1lZGlhbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFuY2U6ICBkMy52YXJpYW5jZShkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWF0aW9uOiBkMy5kZXZpYXRpb24oZCwgZCA9PiBkW2N1cl0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgICAgICAgICAgICAgfSx7fSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHdoaWxlICggbmVzdEJ5QXJyYXkubGVuZ3RoID4gMCl7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnJvbGx1cChyZWR1Y2VWYXJpYWJsZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHRoaXMudW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAgICAgIFxuICAgICAgICAgICAgICAgICAgICBuZXN0QnlBcnJheS5wb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBcbiAgICAgICAgICAgIG5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpe1xuICAgICAgICAgICAgICAgIC8vIHJlY3Vyc2l2ZSAgbmVzdGluZyBmdW5jdGlvbiB1c2VkIGJ5IHN1bW1hcml6ZURhdGEgYW5kIHJldHVybktleVZhbHVlc1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXN0QnlBcnJheS5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ciAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGN1ciAhPT0gJ2Z1bmN0aW9uJyApIHsgdGhyb3cgJ2VhY2ggbmVzdEJ5IGl0ZW0gbXVzdCBiZSBhIHN0cmluZyBvciBmdW5jdGlvbic7IH1cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJ0bjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnc3RyaW5nJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZFtjdXJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7ICAgIFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ2Z1bmN0aW9uJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VyKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJ0bjtcbiAgICAgICAgICAgICAgICB9LCBkMy5uZXN0KCkpO1xuICAgICAgICAgICAgfSwgICAgICAgXG4gICAgICAgICAgICByZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBuZXN0QnksIGNvZXJjZSA9IGZhbHNlLCBuZXN0VHlwZSA9ICdzZXJpZXMnLCB0YWJJbmRleCA9IDApe1xuICAgICAgICAgICAgLy8gdGhpcyBmbiB0YWtlcyBub3JtYWxpemVkIGRhdGEgZmV0Y2hlZCBhcyBhbiBhcnJheSBvZiByb3dzIGFuZCB1c2VzIHRoZSB2YWx1ZXMgaW4gdGhlIGZpcnN0IHJvdyBhcyBrZXlzIGZvciB2YWx1ZXMgaW5cbiAgICAgICAgICAgIC8vIHN1YnNlcXVlbnQgcm93c1xuICAgICAgICAgICAgLy8gbmVzdEJ5ID0gc3RyaW5nIG9yIGFycmF5IG9mIGZpZWxkKHMpIHRvIG5lc3QgYnksIG9yIGEgY3VzdG9tIGZ1bmN0aW9uLCBvciBhbiBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucztcbiAgICAgICAgICAgIC8vIGNvZXJjZSA9IEJPT0wgY29lcmNlIHRvIG51bSBvciBub3Q7IG5lc3RUeXBlID0gb2JqZWN0IG9yIHNlcmllcyBuZXN0IChkMylcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgcHJlbGltO1xuICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXM7IFxuICAgICAgICAgICAgICAgIHZhciB1bm5lc3RlZCA9IHZhbHVlcy5zbGljZSgxKS5tYXAocm93ID0+IHJvdy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIsIGkpIHsgXG4gICAgICAgICAgICAgICAgLy8gMS4gcGFyYW1zOiB0b3RhbCwgY3VycmVudFZhbHVlLCBjdXJyZW50SW5kZXhbLCBhcnJdXG4gICAgICAgICAgICAgICAgLy8gMy4gLy8gYWNjIGlzIGFuIG9iamVjdCAsIGtleSBpcyBjb3JyZXNwb25kaW5nIHZhbHVlIGZyb20gcm93IDAsIHZhbHVlIGlzIGN1cnJlbnQgdmFsdWUgb2YgYXJyYXlcbiAgICAgICAgICAgICAgICAgIGFjY1t2YWx1ZXNbMF1baV1dID0gY29lcmNlID09PSB0cnVlID8gaXNOYU4oK2N1cikgfHwgY3VyID09PSAnJyA/IGN1ciA6ICtjdXIgOiBjdXI7IFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0IGZvciBlbXB0eSBzdHJpbmdzIGJlZm9yZSBjb2VyY2luZyBiYyArJycgPT4gMFxuICAgICAgICAgICAgICAgIH0sIHt9KSk7XG4gICAgICAgICAgICAgICAgaWYgKCB0YWJJbmRleCA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWwudW5uZXN0ZWQgPSB1bm5lc3RlZDtcbiAgICAgICAgICAgICAgICB9ICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoICFuZXN0QnkgKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVubmVzdGVkO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIG5lc3RCeSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG5lc3RCeSA9PT0gJ2Z1bmN0aW9uJyApIHsgLy8gaWUgb25seSBvbmUgbmVzdEJ5IGZpZWxkIG9yIGZ1bmNpdG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSBtb2RlbC5uZXN0UHJlbGltKFtuZXN0QnldKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gbW9kZWwubmVzdFByZWxpbShuZXN0QnkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICggbmVzdFR5cGUgPT09ICdvYmplY3QnICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRyaWVzKHVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgdmlldzoge1xuICAgICAgICAgICAgaW5pdChjb250YWluZXIsIG1vZGVsKXtcbiAgICAgICAgICAgICAgICB0aGlzLm1hcmdpbnMgPSB7IC8vIGRlZmF1bHQgdmFsdWVzIDsgY2FuIGJlIHNldCBiZSBlYWNoIFNWR3MgRE9NIGRhdGFzZXQgKGh0bWwgZGF0YSBhdHRyaWJ1dGVzKS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFMU08gZGVmYXVsdCBzaG91bGQgYmUgYWJsZSB0byBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgICAgICB0b3A6MjAsXG4gICAgICAgICAgICAgICAgICAgIHJpZ2h0OjQ1LFxuICAgICAgICAgICAgICAgICAgICBib3R0b206MTUsXG4gICAgICAgICAgICAgICAgICAgIGxlZnQ6MzVcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHRoaXMuYWN0aXZlRmllbGQgPSAncGIyNWwnOyAvLyB0aGlzIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgIHRoaXMuc2V0dXBDaGFydHMoY29udGFpbmVyLCBtb2RlbCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGFiZWwobW9kZWwsIGtleSl7IC8vIGlmIHlvdSBjYW4gZ2V0IHRoZSBzdW1tYXJ5IHZhbHVlcyB0byBiZSBrZXllZCBhbGwgdGhlIHdheSBkb3duLCB5b3Ugd291bGRuJ3QgbmVlZCBBcnJheS5maW5kXG4gICAgICAgICAgICAgICByZXR1cm4gbW9kZWwuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkubGFiZWw7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0dXBDaGFydHMoY29udGFpbmVyLCBtb2RlbCl7IFxuICAgICAgICAgICAgICAgIHZhciB2aWV3ID0gdGhpcztcbiAgICAgICAgICAgICAgICB2YXIgY2hhcnREaXZzID0gZDMuc2VsZWN0KGNvbnRhaW5lcikuc2VsZWN0QWxsKCcuZDMtY2hhcnQnKTsgXG5cbiAgICAgICAgICAgICAgICBjaGFydERpdnMuZWFjaChmdW5jdGlvbigpIHsgLy8gVE8gRE8gZGlmZmVyZW50aWF0ZSBjaGFydCB0eXBlcyBmcm9tIGh0bWwgZGF0YXNldFxuICAgICAgICAgICAgICAgICAgICAvKiBjaGFydERpdnMuZWFjaCBzY29wZWQgZ2xvYmFscyAqL1xuICAgICAgICAgICAgICAgICAgICAvLyAqKiBUTyBETyAqKiBhbGxvdyBkYXRhIGF0dHIgc3RyaW5ncyB0byBiZSBxdW90ZWQgb25seSBvbmNlLiBpZSBKU09OLnBhcnNlIG9ubHkgaWYgc3RyaW5nIGluY2x1ZGVzIC8gc3RhcnRzIHdpdGggW11cblxuICAgICAgICAgICAgICAgICAgICB2YXIgY29uZmlnID0gdGhpcy5kYXRhc2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGVJbnN0cnVjdCA9IGNvbmZpZy5yZXNldFNjYWxlID8gSlNPTi5wYXJzZShjb25maWcucmVzZXRTY2FsZSkgOiAnbm9uZScsXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lSW5kZXggPSAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzSW5kZXggPSAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luVG9wID0gK2NvbmZpZy5tYXJnaW5Ub3AgfHwgdmlldy5tYXJnaW5zLnRvcCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcmdpblJpZ2h0ID0gK2NvbmZpZy5tYXJnaW5SaWdodCB8fCB2aWV3Lm1hcmdpbnMucmlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXJnaW5Cb3R0b20gPSArY29uZmlnLm1hcmdpbkJvdHRvbSB8fCB2aWV3Lm1hcmdpbnMuYm90dG9tLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFyZ2luTGVmdCA9ICtjb25maWcubWFyZ2luTGVmdCB8fCB2aWV3Lm1hcmdpbnMubGVmdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoID0gY29uZmlnLmVhY2hXaWR0aCAtIG1hcmdpbkxlZnQgLSBtYXJnaW5SaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodCA9IGNvbmZpZy5lYWNoSGVpZ2h0ID8gY29uZmlnLmVhY2hIZWlnaHQgLSBtYXJnaW5Ub3AgLSBtYXJnaW5Cb3R0b20gOiBjb25maWcuZWFjaFdpZHRoIC8gMiAtIG1hcmdpblRvcCAtIG1hcmdpbkJvdHRvbSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdHVtID0gbW9kZWwuZGF0YS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGNvbmZpZy5jYXRlZ29yeSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW5YID0gMjAxNSwgLy8gISEhIE5PVCBQUk9HUkFNQVRJQ1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF4WCA9IDIwNDUsIC8vICEhISBOT1QgUFJPR1JBTUFUSUNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEJFTE9XIG5lZWRzIGlucHV0IGZyb20gSFRNTC0tZGVmYXVsdCBtYXhlcyBhbmQgbWlucyBpbiBjYXNlIG5hdHVyYWwgbWluID4gMCwgbWF4IDwgMCwgb3Igc2ltcGx5IHdhbnQgdG8gb3ZlcnJpZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pblkgPSBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1pbiA8IDAgPyBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1pbiA6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhZID0gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggPiBNYXRoLmFicyhtaW5ZIC8gMikgPyBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCA6IE1hdGguYWJzKG1pblkgLyAyKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlVGltZSA9IGQzLnRpbWVQYXJzZSgnJVknKSwgLy8gISEhIE5PVCBQUk9HUkFNQVRJQ1xuICAgICAgICAgICAgICAgICAgICAgICAgeCA9IGQzLnNjYWxlVGltZSgpLnJhbmdlKFswLCB3aWR0aF0pLmRvbWFpbihbcGFyc2VUaW1lKG1pblgpLHBhcnNlVGltZShtYXhYKV0pLCAvLyAhISEgTk9UIFBST0dSQU1BVElDXG4gICAgICAgICAgICAgICAgICAgICAgICB5ID0gZDMuc2NhbGVMaW5lYXIoKS5yYW5nZShbaGVpZ2h0LCAwXSkuZG9tYWluKFttaW5ZLG1heFldKSwgIC8vICEhISBOT1QgUFJPR1JBTUFUSUNcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYXJ0RGl2ID0gZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmRhdHVtKGRhdHVtKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRpbmdzID0gY2hhcnREaXYuYXBwZW5kKCdwJyksXG4gICAgICAgICAgICAgICAgICAgICAgICBTVkdzID0gY2hhcnREaXYuYXBwZW5kKCdkaXYnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ2ZsZXgnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ1NWR3MnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4gZ3JvdXBTZXJpZXMoZC52YWx1ZXMpIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ3N2ZycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3dpZHRoJywgY29uZmlnLmVhY2hXaWR0aClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgaGVpZ2h0ICsgbWFyZ2luVG9wICsgbWFyZ2luQm90dG9tKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCBgdHJhbnNsYXRlKCR7bWFyZ2luTGVmdH0sJHttYXJnaW5Ub3B9KWApLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLngoZCA9PiB4KHBhcnNlVGltZShkLnllYXIpKSApIC8vICEhIG5vdCBwcm9ncmFtbWF0aWNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAueShkID0+IHkoZFt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddKSApOyAvLyAhISBub3QgcHJvZ3JhbW1hdGljXG5cbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gZ3JvdXBTZXJpZXMoZGF0YSl7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgc2VyaWVzR3JvdXBzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyb3Vwc0luc3RydWN0ID0gY29uZmlnLnNlcmllc0dyb3VwID8gSlNPTi5wYXJzZShjb25maWcuc2VyaWVzR3JvdXApIDogJ25vbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBBcnJheS5pc0FycmF5KCBncm91cHNJbnN0cnVjdCApICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEpTT04ucGFyc2UoY29uZmlnLnNlcmllc0dyb3VwKS5mb3JFYWNoKGdyb3VwID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzLnB1c2goZGF0YS5maWx0ZXIoc2VyaWVzID0+IGdyb3VwLmluZGV4T2Yoc2VyaWVzLmtleSkgIT09IC0xKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCBncm91cHNJbnN0cnVjdCA9PT0gJ25vbmUnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IGRhdGEubWFwKGVhY2ggPT4gW2VhY2hdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnYWxsJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbZGF0YS5tYXAoZWFjaCA9PiBlYWNoKV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGBJbnZhbGlkIGRhdGEtZ3JvdXAtc2VyaWVzIGluc3RydWN0aW9uIGZyb20gaHRtbC4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE11c3QgYmUgdmFsaWQgSlNPTjogXCJOb25lXCIgb3IgXCJBbGxcIiBvciBhbiBhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZiBhcnJheXMgY29udGFpbmluZyB0aGUgc2VyaWVzIHRvIGJlIGdyb3VwZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9nZXRoZXIuIEFsbCBzdHJpbmdzIG11c3QgYmUgZG91YmxlLXF1b3RlZC5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlcmllc0dyb3VwcztcbiAgICAgICAgICAgICAgICAgICAgfSAvLyBlbmQgZ3JvdXBTZXJpZXMoKVxuXG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvKiBIRUFESU5HUyAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGluZ3MuaHRtbChkID0+ICc8c3Ryb25nPicgKyB2aWV3LmxhYmVsKG1vZGVsLCBkLmtleSkgKyAnPC9zdHJvbmc+Jyk7XG5cbiAgICAgICAgICAgICAgICAgICAgLyogU1ZHUyAqL1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgU1ZHcy5lYWNoKGZ1bmN0aW9uKGQsaSl7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgU1ZHID0gZDMuc2VsZWN0KHRoaXMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEgPSBTVkcuZGF0YSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuaXRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFNWR1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzZXJpZXMtZ3JvdXBzJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmRhdGEoZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGFkZFlBeGlzKHJlcGVhdGVkID0gJycsIHNob3dVbml0cyA9IGZhbHNlKXsgIC8vICEhIE5PVCBQUk9HUkFNTUFUSUNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBqc2hpbnQgdmFsaWR0aGlzOiB0cnVlICovIC8qIDwtIGNvbW1lbnQga2VlcHMganNoaW50IGZyb20gZmFsc2VseSB3YXJuaW5nIHRoYXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGB0aGlzYCB3aWxsIGJlIHVuZGVmaW5lZC4gdGhlIC5jYWxsKCkgbWV0aG9kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZpbmVzIGB0aGlzYCAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4gJ2F4aXMgeS1heGlzICcgKyByZXBlYXRlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsKGQzLmF4aXNMZWZ0KHkpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrcyg1KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHNob3dVbml0cyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICd1bml0cycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKCkgPT4gYHRyYW5zbGF0ZSgtJHttYXJnaW5MZWZ0fSwtJHttYXJnaW5Ub3AgLSAxMH0pYClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50ZXh0KCgpID0+IHVuaXRzLnJlbW92ZVVuZGVyc2NvcmVzKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLyogUEFUSFMgKi9cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBjb25maWcudHlwZSA9PT0gJ2xpbmUnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzIC8vICEhIE5PVCBQUk9HUkFNTUFUSUMgLCBJRSwgVFlQRSBORUVEUyBUTyBCRSBTUEVDSUZJRUQgQlkgY29uZmlnLnR5cGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnc2VyaWVzJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmRhdGEoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdsaW5lIGxpbmUtJyArIGxpbmVJbmRleCsrO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQsaikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5pdHMgPSBkLnZhbHVlc1sxXS51bml0cztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggc2NhbGVJbnN0cnVjdC5pbmRleE9mKGQua2V5KSAhPT0gLTEgKXsgLy8gVE9ETzogcmVzZXR0aW5nIHNjYWxlIG1ha2UgdGhlIHNlcmllcyBtaW4sbWF4IGZyb20gdGhlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlcmllcycgb3duIGRhdGEsIG5vdCB0aGUgb25lIGl0J3MgZ3JvdXBlZCB3aXRoIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIE5PVCBQUk9HUkFNTUFUSUMgKi8gbWluWSA9IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1pbiA8IDAgPyBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gOiAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIE5PVCBQUk9HUkFNTUFUSUMgKi8gbWF4WSA9IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCA+IE1hdGguYWJzKG1pblkgLyAyKSA/IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCA6IE1hdGguYWJzKG1pblkgLyAyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB4ID0gZDMuc2NhbGVUaW1lKCkucmFuZ2UoWzAsIHdpZHRoXSkuZG9tYWluKFtwYXJzZVRpbWUobWluWCkscGFyc2VUaW1lKG1heFgpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeSA9IGQzLnNjYWxlTGluZWFyKCkucmFuZ2UoW2hlaWdodCwgMF0pLmRvbWFpbihbbWluWSxtYXhZXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpICE9PSAwICYmIGogPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZFlBeGlzLmNhbGwodGhpcywnJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGkgIT09IDAgJiYgaiA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkWUF4aXMuY2FsbCh0aGlzLCdyZXBlYXRlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZC52YWx1ZXMudW5zaGlmdCh7eWVhcjoyMDE1LFt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddOjB9KTsgLy9UTyBETzogcHV0IGluIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZWFjaChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmFyIGRhdGEgPSBkMy5zZWxlY3QodGhpcykuZGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5kaXJlY3RMYWJlbCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU1ZHLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+ICdzZXJpZXMtbGFiZWwgc2VyaWVzLScgKyBzZXJpZXNJbmRleCsrKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuaHRtbCgoKSA9PiAnPHRzcGFuIHg9XCIwXCI+JyArIHZpZXcubGFiZWwoZC5rZXkpLnJlcGxhY2UoL1xcXFxuL2csJzwvdHNwYW4+PHRzcGFuIHg9XCIwXCIgZHk9XCIxLjJlbVwiPicpICsgJzwvdHNwYW4+JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICgpID0+IGB0cmFuc2xhdGUoJHt3aWR0aCArIDN9LCR7eShkLnZhbHVlc1tkLnZhbHVlcy5sZW5ndGggLSAxXVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddKSArIDN9KWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIFggQVhJUyAqL1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgU1ZHLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKDAsJyArIHkoMCkgKyAnKScpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzIHgtYXhpcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsKGQzLmF4aXNCb3R0b20oeCkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tWYWx1ZXMoW3BhcnNlVGltZSgyMDI1KSxwYXJzZVRpbWUoMjAzNSkscGFyc2VUaW1lKDIwNDUpXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIFkgQVhJUyAqLyAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGkgPT09IDAgKSB7IC8vIGkgaGVyZSBpcyBmcm9tIHRoZSBTVkcuZWFjaCBsb29wLiBhcHBlbmQgeUF4aXMgdG8gYWxsIGZpcnN0IFNWR3Mgb2YgY2hhcnREaXZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkWUF4aXMuY2FsbCh0aGlzLCAnJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSAvLyBlbmQgaWYgdHlwZSA9PT0gJ2xpbmUnXG4gICAgICAgICAgICAgICAgICAgIH0pOyAvLyBlbmQgU1ZHcy5lYWNoKClcbiAgICAgICAgICAgICAgICB9KTsgLy8gZW5kIGNoYXJ0RGl2cy5lYWNoKClcbiAgICAgICAgICAgIH0gLy8gZW5kIHZpZXcuc2V0dXBDaGFydHMoKVxuICAgICAgICB9LCAvLyBlbmQgdmlld1xuXG4gICAgICAgIGNvbnRyb2xsZXI6IHtcbiAgICAgICAgICAgIGluaXRDb250cm9sbGVyOiBmdW5jdGlvbihjb250YWluZXIsIG1vZGVsKXsvLywgdmlldyl7XG4gICAgICAgICAgICAgICAgbW9kZWwuaW5pdChjb250YWluZXIpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2codmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWwuZGF0YSA9IHZhbHVlc1swXTtcbiAgICAgICAgICAgICAgICAgIC8vICBtb2RlbC5kaWN0aW9uYXJ5ID0gdmFsdWVzWzFdLnVuZGVmaW5lZC51bmRlZmluZWQ7IC8vICEhIE5PVCBQUk9HUkFNTUFUSUMgLyBDT05TSVNURU5UXG4gICAgICAgICAgICAgICAgICAvLyAgbW9kZWwuc3VtbWFyaXplRGF0YSgpO1xuICAgICAgICAgICAgICAgICAvLyAgIHZpZXcuaW5pdChjb250YWluZXIsIG1vZGVsKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07IC8vIEQzQ2hhcnRHcm91cCBwcm90b3R5cGUgZW5kcyBoZXJlXG4gICAgXG4gICAgd2luZG93LkQzQ2hhcnRzID0geyAvLyBuZWVkIHRvIHNwZWNpZnkgd2luZG93IGJjIGFmdGVyIHRyYW5zcGlsaW5nIGFsbCB0aGlzIHdpbGwgYmUgd3JhcHBlZCBpbiBJSUZFc1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGByZXR1cm5gaW5nIHdvbid0IGdldCB0aGUgZXhwb3J0IGludG8gd2luZG93J3MgZ2xvYmFsIHNjb3BlXG4gICAgICAgIEluaXQoKXtcbiAgICAgICAgICAgIHZhciBncm91cERpdnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZDMtZ3JvdXAnKTtcbiAgICAgICAgICAgIGZvciAoIGxldCBpID0gMDsgaSA8IGdyb3VwRGl2cy5sZW5ndGg7IGkrKyApe1xuICAgICAgICAgICAgICAgIGNoYXJ0Q29sbGVjdGlvbi5wdXNoKG5ldyBEM0NoYXJ0R3JvdXAoZ3JvdXBEaXZzW2ldLCBpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFydENvbGxlY3Rpb24pO1xuICAgICAgICB9XG4gICAgfTtcbn0oKSk7IC8vIGVuZCB2YXIgRDNDaGFydHMgSUlGRSIsImV4cG9ydCBjb25zdCBIZWxwZXJzID0gKGZ1bmN0aW9uKCl7XG4gICAgXG4gICAgU3RyaW5nLnByb3RvdHlwZS5jbGVhblN0cmluZyA9IGZ1bmN0aW9uKCkgeyAvLyBsb3dlcmNhc2UgYW5kIHJlbW92ZSBwdW5jdHVhdGlvbiBhbmQgcmVwbGFjZSBzcGFjZXMgd2l0aCBoeXBoZW5zOyBkZWxldGUgcHVuY3R1YXRpb25cbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvWyBcXFxcXFwvXS9nLCctJykucmVwbGFjZSgvWydcIuKAneKAmeKAnOKAmCxcXC4hXFw/O1xcKFxcKSZdL2csJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgfTtcblxuICAgIFN0cmluZy5wcm90b3R5cGUucmVtb3ZlVW5kZXJzY29yZXMgPSBmdW5jdGlvbigpIHsgXG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL18vZywnICcpO1xuICAgIH07XG5cbn0pKCk7XG4iXX0=
