(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _Helpers = require('../js-exports/Helpers');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /* exported D3Charts */ // let's jshint know that D3Charts can be defined but not used in this file


console.log(_Helpers.Helpers);
var D3Charts = function () {
    "use strict";

    var model = {
        init: function init() {
            var _this = this;

            // SHOULD THIS STUFF BE IN CONTROLLER?
            this.dataPromises = [];
            this.nestBy = ['category', 'series'];
            var sheetID = '1_G9HsJbxRBd7fWTF51Xr8lpxGxxImVcc-rTIaQbEeyA',
                tabs = ['Sheet1', 'dictionary'];

            tabs.forEach(function (each, i) {
                var promise = new Promise(function (resolve, reject) {
                    d3.json('https://sheets.googleapis.com/v4/spreadsheets/' + sheetID + '/values/' + each + '?key=AIzaSyDD3W5wJeJF2esffZMQxNtEl9tt-OfgSq4', function (error, data) {
                        // columns A through I
                        if (error) {
                            reject(error);
                            throw error;
                        }
                        var values = data.values;
                        console.log(values);
                        var nestType = each === 'dictionary' ? 'object' : 'series';
                        resolve(_this.returnKeyValues(values, model.nestBy, true, nestType, i));
                    });
                });
                _this.dataPromises.push(promise);
            });
            console.log(this.dataPromises);
            return Promise.all([].concat(_toConsumableArray(this.dataPromises)));
        },
        summarizeData: function summarizeData() {
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
                        })
                    };
                    return acc;
                }, {});
            }
            while (nestByArray.length > 0) {

                var summarized = this.nestPrelim(nestByArray).rollup(reduceVariables).object(this.unnested);
                this.summaries.unshift(summarized); // creates an array of keyed summaries
                // first (index 0) is one layer nested,
                // second is two, and so on.    
                nestByArray.pop();
            }
        },
        nestPrelim: function nestPrelim(nestByArray) {
            // recursive  nesting function
            console.log(nestByArray);
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
            // nestBy = string or array of field(s) to nest by, or a custom function, or an array of strings or functions;
            // coerce = BOOL coerce to num or not
            // nestType = object or series nest (d3)

            var prelim;
            var unnested = values.slice(1).map(function (row) {
                return row.reduce(function (acc, cur, i) {
                    // 1. params: total, currentValue, currentIndex[, arr]
                    acc[values[0][i]] = coerce === true ? isNaN(+cur) || cur === '' ? cur : +cur : cur; // 3. // acc is an object , key is corresponding value from row 0, value is current value of array
                    return acc; // test for empty strings before coercing bc +'' => 0
                }, {});
            });
            if (tabIndex === 0) {
                model.unnested = unnested;
            }
            if (!nestBy) {
                return unnested;
            } else {
                console.log(nestBy);
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
                console.log('object');
                return prelim.object(unnested);
            } else {
                console.log('series');
                return prelim.entries(unnested);
            }
        }
    };

    var view = {
        init: function init() {
            this.margins = { // default values ; can be set be each SVGs DOM dataset (html data attributes)
                top: 20,
                right: 15,
                bottom: 15,
                left: 35
            };
            this.activeField = 'pb25l';
            this.setupCharts();
        },
        label: function label(key) {
            return model.dictionary.find(function (each) {
                return each.key === key;
            }).label;
        },
        setupCharts: function setupCharts() {
            var chartDivs = d3.selectAll('.d3-chart');

            chartDivs.each(function () {
                // TO DO differentiate chart types from html dataset
                function groupSeries(data) {
                    var seriesGroups;
                    var groupsInstruct = config.seriesGroup ? JSON.parse(config.seriesGroup) : 'none';

                    console.log(data);
                    if (Array.isArray(groupsInstruct)) {
                        seriesGroups = [];
                        JSON.parse(config.seriesGroup).forEach(function (group) {
                            console.log(group);
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
                        throw 'Invalid data-group-series unstruction from html';
                    }
                    console.log(seriesGroups);
                    return seriesGroups;
                }
                var thisChartDiv = this;
                var config = this.dataset;
                var scaleInstruct = config.resetScale ? JSON.parse(config.resetScale) : 'none',
                    lineIndex = 0,
                    seriesIndex = 0,
                    marginTop = +config.marginTop || view.margins.top,
                    marginRight = +config.marginRight || view.margins.right,
                    marginBottom = +config.marginBottom || view.margins.bottom,
                    marginLeft = +config.marginLeft || view.margins.left;
                if (!config.marginRight && config.directLabel) {
                    marginRight = 45;
                }
                var width = config.eachWidth - marginLeft - marginRight,
                    height = config.eachHeight ? config.eachHeight - marginTop - marginBottom : config.eachWidth / 2 - marginTop - marginBottom;
                var datum = model.data.find(function (each) {
                    return each.key === config.category;
                });
                console.log(datum);
                var chartDiv = d3.select(this).datum(datum);
                console.log(datum);

                console.log(model.summaries);
                var minX = 2015,
                    maxX = 2045,
                    minY = model.summaries[0][datum.key][view.activeField + '_value'].min < 0 ? model.summaries[0][datum.key][view.activeField + '_value'].min : 0,
                    maxY = model.summaries[0][datum.key][view.activeField + '_value'].max > Math.abs(minY / 2) ? model.summaries[0][datum.key][view.activeField + '_value'].max : Math.abs(minY / 2),
                    parseTime = d3.timeParse('%Y'),
                    x = d3.scaleTime().range([0, width]).domain([parseTime(minX), parseTime(maxX)]),
                    y = d3.scaleLinear().range([height, 0]).domain([minY, maxY]);

                console.log(minX, minY, maxX, maxY);

                /* HEADINGS */
                chartDiv.append('p').html(function (d) {
                    return '<strong>' + view.label(d.key) + '</strong>';
                });

                /* SVGS */

                var SVGs;
                var svgContainer = chartDiv.append('div').attr('class', 'flex');

                SVGs = svgContainer.selectAll('SVGs').data(function (d, i, array) {
                    console.log(d, i, array);
                    return groupSeries(d.values);
                }).enter().append('svg').attr('width', config.eachWidth).attr('height', height + marginTop + marginBottom).append('g').attr('transform', 'translate(' + marginLeft + ',' + marginTop + ')');

                var valueline = d3.line().x(function (d) {
                    console.log(d);return x(parseTime(d.year));
                }).y(function (d) {
                    return y(d[view.activeField + '_value']);
                });

                SVGs.each(function (d, i, array) {
                    var _this2 = this;

                    var SVG = d3.select(this);
                    var data = SVG.data();
                    var units;
                    console.log(data);
                    var seriesGroups = SVG.selectAll('series-groups').data(data).enter().append('g');

                    /* PATHS */

                    seriesGroups.selectAll('series').data(function (d) {
                        console.log(d);
                        return d;
                    }).enter().append('path').attr('class', function () {
                        return 'line line-' + lineIndex++;
                    }).attr('d', function (d, j) {
                        units = d.values[1].units;
                        console.log(i, _this2, j);
                        console.log(d, d.key, datum.key);
                        console.log(scaleInstruct);
                        if (scaleInstruct.indexOf(d.key) !== -1) {
                            console.log(model.summaries);
                            minY = model.summaries[1][datum.key][d.key][view.activeField + '_value'].min < 0 ? model.summaries[1][datum.key][d.key][view.activeField + '_value'].min : 0;
                            maxY = model.summaries[1][datum.key][d.key][view.activeField + '_value'].max > Math.abs(minY / 2) ? model.summaries[1][datum.key][d.key][view.activeField + '_value'].max : Math.abs(minY / 2);
                            x = d3.scaleTime().range([0, width]).domain([parseTime(minX), parseTime(maxX)]);
                            y = d3.scaleLinear().range([height, 0]).domain([minY, maxY]);
                            if (i !== 0 && j === 0) {
                                addYAxis.call(_this2, '', true);
                            }
                        } else if (i !== 0 && j === 0) {
                            addYAxis.call(_this2, 'repeated');
                        }
                        d.values.unshift(_defineProperty({ year: 2015 }, view.activeField + '_value', 0));
                        return valueline(d.values);
                    }).each(function (d) {
                        // var data = d3.select(this).data();
                        console.log(thisChartDiv);
                        if (config.directLabel) {
                            console.log('directlabel');
                            SVG.append('text').attr('class', function () {
                                return 'series-label series-' + seriesIndex++;
                            }).html(function () {
                                return '<tspan x="0">' + view.label(d.key).replace(/\\n/g, '</tspan><tspan x="0" dy="1.2em">') + '</tspan>';
                            }).attr('transform', function () {
                                return 'translate(' + (width + 3) + ',' + (y(d.values[d.values.length - 1][view.activeField + '_value']) + 3) + ')';
                            });
                        }
                    });

                    /* series labels */

                    /* seriesGroups.append('text')
                         .attr('class', () => 'series-label')
                         .attr('transform', () => `translate(0,${height + marginBottom})`)
                         .html(d => {
                             console.log(d);
                             return d.reduce((acc,cur) => {
                                 return acc + '<tspan class="series-' + lineIndex++ + '">' + view.label(cur.key) + '</tspan>';
                             },'');
                             
                             //return view.label(d[0].key); // if grouped series, will need to iterate over all indexes
                         }); */

                    /* X AXIS */

                    SVG.append('g').attr('transform', 'translate(0,' + y(0) + ')').attr('class', 'axis x-axis').call(d3.axisBottom(x).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).tickValues([parseTime(2025), parseTime(2035), parseTime(2045)]));
                    console.log(d, i, array, this);
                    if (i === 0) {
                        // i here is from the SVG.each loop. append yAxis to all first SVGs of chartDiv
                        addYAxis.call(this, '', true);
                    }
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
                });

                // set data to d[0] and then append lines


                /* append line */

                /*      d3.select(this).append('path')
                          .attr('class', 'line')
                          .attr('d', function(d){
                              console.log(d);
                              
                              return valueline(d.values);
                          });
                  });
                      */
            });
        }
    };

    var controller = {
        init: function init() {
            console.log('controller init');
            model.init().then(function (values) {
                model.data = values[0];
                model.dictionary = values[1].undefined.undefined;
                console.log(model.dictionary);
                console.log(model.data);
                model.summarizeData();
                view.init();
            });
        }
    };
    return {
        Init: controller.init()
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9IZWxwZXJzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNDQTs7OztvTUFEQyx1QixDQUF3Qjs7O0FBRXpCLFFBQVEsR0FBUjtBQUNBLElBQUksV0FBWSxZQUFVO0FBQzFCOztBQUNJLFFBQU0sUUFBUTtBQUNWLFlBRFUsa0JBQ0o7QUFBQTs7QUFBRTtBQUNKLGlCQUFLLFlBQUwsR0FBb0IsRUFBcEI7QUFDQSxpQkFBSyxNQUFMLEdBQWMsQ0FBQyxVQUFELEVBQVksUUFBWixDQUFkO0FBQ0EsZ0JBQUksVUFBVSw4Q0FBZDtBQUFBLGdCQUNJLE9BQU8sQ0FBQyxRQUFELEVBQVUsWUFBVixDQURYOztBQUdBLGlCQUFLLE9BQUwsQ0FBYSxVQUFDLElBQUQsRUFBTyxDQUFQLEVBQWE7QUFDdEIsb0JBQUksVUFBVSxJQUFJLE9BQUosQ0FBWSxVQUFDLE9BQUQsRUFBUyxNQUFULEVBQW9CO0FBQzFDLHVCQUFHLElBQUgsQ0FBUSxtREFBbUQsT0FBbkQsR0FBNkQsVUFBN0QsR0FBMEUsSUFBMUUsR0FBaUYsOENBQXpGLEVBQXlJLFVBQUMsS0FBRCxFQUFPLElBQVAsRUFBZ0I7QUFBRTtBQUN2Siw0QkFBSSxLQUFKLEVBQVc7QUFDUCxtQ0FBTyxLQUFQO0FBQ0Esa0NBQU0sS0FBTjtBQUNIO0FBQ0QsNEJBQUksU0FBUyxLQUFLLE1BQWxCO0FBQ0EsZ0NBQVEsR0FBUixDQUFZLE1BQVo7QUFDQSw0QkFBSSxXQUFXLFNBQVMsWUFBVCxHQUF3QixRQUF4QixHQUFtQyxRQUFsRDtBQUNBLGdDQUFRLE1BQUssZUFBTCxDQUFxQixNQUFyQixFQUE2QixNQUFNLE1BQW5DLEVBQTJDLElBQTNDLEVBQWlELFFBQWpELEVBQTJELENBQTNELENBQVI7QUFDSCxxQkFURDtBQVVILGlCQVhhLENBQWQ7QUFZQSxzQkFBSyxZQUFMLENBQWtC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QU4sR0FBbUIsT0FBTyxDQUFQLEVBQVUsU0FBVixDQUFvQixTQUF2QztBQUNBLHdCQUFRLEdBQVIsQ0FBWSxNQUFNLFVBQWxCO0FBQ0Esd0JBQVEsR0FBUixDQUFZLE1BQU0sSUFBbEI7QUFDQSxzQkFBTSxhQUFOO0FBQ0EscUJBQUssSUFBTDtBQUNILGFBUEQ7QUFRSDtBQVhjLEtBQW5CO0FBY0EsV0FBTztBQUNILGNBQU0sV0FBVyxJQUFYO0FBREgsS0FBUDtBQUdILENBeFZlLEVBQWhCOzs7Ozs7OztBQ0hPLElBQU0sNEJBQVcsWUFBVTs7QUFFOUIsV0FBTyxTQUFQLENBQWlCLFdBQWpCLEdBQStCLFlBQVc7QUFBRTtBQUN4QyxlQUFPLEtBQUssT0FBTCxDQUFhLFVBQWIsRUFBd0IsR0FBeEIsRUFBNkIsT0FBN0IsQ0FBcUMsdUJBQXJDLEVBQTZELEVBQTdELEVBQWlFLFdBQWpFLEVBQVA7QUFDSCxLQUZEOztBQUlBLFdBQU8sU0FBUCxDQUFpQixpQkFBakIsR0FBcUMsWUFBVztBQUM1QyxlQUFPLEtBQUssT0FBTCxDQUFhLElBQWIsRUFBa0IsR0FBbEIsQ0FBUDtBQUNILEtBRkQ7QUFJSCxDQVZzQixFQUFoQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIgLyogZXhwb3J0ZWQgRDNDaGFydHMgKi8gLy8gbGV0J3MganNoaW50IGtub3cgdGhhdCBEM0NoYXJ0cyBjYW4gYmUgZGVmaW5lZCBidXQgbm90IHVzZWQgaW4gdGhpcyBmaWxlXG5pbXBvcnQgeyBIZWxwZXJzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9IZWxwZXJzJztcbmNvbnNvbGUubG9nKEhlbHBlcnMpO1xudmFyIEQzQ2hhcnRzID0gKGZ1bmN0aW9uKCl7ICBcblwidXNlIHN0cmljdFwiOyBcbiAgICBjb25zdCBtb2RlbCA9IHtcbiAgICAgICAgaW5pdCgpeyAvLyBTSE9VTEQgVEhJUyBTVFVGRiBCRSBJTiBDT05UUk9MTEVSP1xuICAgICAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMubmVzdEJ5ID0gWydjYXRlZ29yeScsJ3NlcmllcyddO1xuICAgICAgICAgICAgdmFyIHNoZWV0SUQgPSAnMV9HOUhzSmJ4UkJkN2ZXVEY1MVhyOGxweEd4eEltVmNjLXJUSWFRYkVleUEnLFxuICAgICAgICAgICAgICAgIHRhYnMgPSBbJ1NoZWV0MScsJ2RpY3Rpb25hcnknXTtcblxuICAgICAgICAgICAgdGFicy5mb3JFYWNoKChlYWNoLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSxyZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZDMuanNvbignaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLycgKyBzaGVldElEICsgJy92YWx1ZXMvJyArIGVhY2ggKyAnP2tleT1BSXphU3lERDNXNXdKZUpGMmVzZmZaTVF4TnRFbDl0dC1PZmdTcTQnLCAoZXJyb3IsZGF0YSkgPT4geyAvLyBjb2x1bW5zIEEgdGhyb3VnaCBJXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlcyA9IGRhdGEudmFsdWVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2codmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuZXN0VHlwZSA9IGVhY2ggPT09ICdkaWN0aW9uYXJ5JyA/ICdvYmplY3QnIDogJ3Nlcmllcyc7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMucmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbW9kZWwubmVzdEJ5LCB0cnVlLCBuZXN0VHlwZSwgaSkpOyBcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgICAgICAgIH0pO1xuY29uc29sZS5sb2codGhpcy5kYXRhUHJvbWlzZXMpO1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKFsuLi50aGlzLmRhdGFQcm9taXNlc10pO1xuICAgICAgICB9LFxuICAgICAgICBzdW1tYXJpemVEYXRhKCl7XG4gICAgICAgICAgICB0aGlzLnN1bW1hcmllcyA9IFtdO1xuICAgICAgICAgICAgdmFyIHZhcmlhYmxlcyA9IE9iamVjdC5rZXlzKHRoaXMudW5uZXN0ZWRbMF0pOyAvLyBhbGwgbmVlZCB0byBoYXZlIHRoZSBzYW1lIGZpZWxkc1xuICAgICAgICAgICAgdmFyIG5lc3RCeUFycmF5ID0gQXJyYXkuaXNBcnJheSh0aGlzLm5lc3RCeSkgPyB0aGlzLm5lc3RCeSA6IFt0aGlzLm5lc3RCeV07XG4gICAgICAgICAgICBmdW5jdGlvbiByZWR1Y2VWYXJpYWJsZXMoZCl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhcmlhYmxlcy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgICAgICBhY2NbY3VyXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heDogZDMubWF4KGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbjogZDMubWluKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lYW46IGQzLm1lYW4oZCwgZCA9PiBkW2N1cl0pXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgfSx7fSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAoIG5lc3RCeUFycmF5Lmxlbmd0aCA+IDApe1xuXG4gICAgICAgICAgICAgICAgbGV0IHN1bW1hcml6ZWQgPSB0aGlzLm5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpXG4gICAgICAgICAgICAgICAgICAgIC5yb2xsdXAocmVkdWNlVmFyaWFibGVzKVxuICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHRoaXMudW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3VtbWFyaWVzLnVuc2hpZnQoc3VtbWFyaXplZCk7IC8vIGNyZWF0ZXMgYW4gYXJyYXkgb2Yga2V5ZWQgc3VtbWFyaWVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmlyc3QgKGluZGV4IDApIGlzIG9uZSBsYXllciBuZXN0ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2Vjb25kIGlzIHR3bywgYW5kIHNvIG9uLiAgICBcbiAgICAgICAgICAgICAgICBuZXN0QnlBcnJheS5wb3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgXG5cbiAgICAgICAgbmVzdFByZWxpbShuZXN0QnlBcnJheSl7XG4gICAgICAgICAgICAvLyByZWN1cnNpdmUgIG5lc3RpbmcgZnVuY3Rpb25cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKG5lc3RCeUFycmF5KTtcbiAgICAgICAgICAgIHJldHVybiBuZXN0QnlBcnJheS5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyICE9PSAnc3RyaW5nJyAmJiB0eXBlb2YgY3VyICE9PSAnZnVuY3Rpb24nICkgeyB0aHJvdyAnZWFjaCBuZXN0QnkgaXRlbSBtdXN0IGJlIGEgc3RyaW5nIG9yIGZ1bmN0aW9uJzsgfVxuICAgICAgICAgICAgICAgIHZhciBydG47XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnc3RyaW5nJyApe1xuICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRbY3VyXTtcbiAgICAgICAgICAgICAgICAgICAgfSk7ICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdmdW5jdGlvbicgKXtcbiAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjdXIoZCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBydG47XG4gICAgICAgICAgICB9LCBkMy5uZXN0KCkpO1xuICAgICAgICB9LCAgICAgICBcbiAgICAgICAgcmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbmVzdEJ5LCBjb2VyY2UgPSBmYWxzZSwgbmVzdFR5cGUgPSAnc2VyaWVzJywgdGFiSW5kZXggPSAwKXsgLy8gbmVzdEJ5ID0gc3RyaW5nIG9yIGFycmF5IG9mIGZpZWxkKHMpIHRvIG5lc3QgYnksIG9yIGEgY3VzdG9tIGZ1bmN0aW9uLCBvciBhbiBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvZXJjZSA9IEJPT0wgY29lcmNlIHRvIG51bSBvciBub3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5lc3RUeXBlID0gb2JqZWN0IG9yIHNlcmllcyBuZXN0IChkMylcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIHByZWxpbTsgXG4gICAgICAgICAgICB2YXIgdW5uZXN0ZWQgPSB2YWx1ZXMuc2xpY2UoMSkubWFwKHJvdyA9PiByb3cucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyLCBpKSB7IC8vIDEuIHBhcmFtczogdG90YWwsIGN1cnJlbnRWYWx1ZSwgY3VycmVudEluZGV4WywgYXJyXVxuICAgICAgICAgICAgICBhY2NbdmFsdWVzWzBdW2ldXSA9IGNvZXJjZSA9PT0gdHJ1ZSA/IGlzTmFOKCtjdXIpIHx8IGN1ciA9PT0gJycgPyBjdXIgOiArY3VyIDogY3VyOyAvLyAzLiAvLyBhY2MgaXMgYW4gb2JqZWN0ICwga2V5IGlzIGNvcnJlc3BvbmRpbmcgdmFsdWUgZnJvbSByb3cgMCwgdmFsdWUgaXMgY3VycmVudCB2YWx1ZSBvZiBhcnJheVxuICAgICAgICAgICAgICAgIHJldHVybiBhY2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRlc3QgZm9yIGVtcHR5IHN0cmluZ3MgYmVmb3JlIGNvZXJjaW5nIGJjICsnJyA9PiAwXG4gICAgICAgICAgICB9LCB7fSkpO1xuICAgICAgICAgICAgaWYgKCB0YWJJbmRleCA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICBtb2RlbC51bm5lc3RlZCA9IHVubmVzdGVkO1xuICAgICAgICAgICAgfSAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoICFuZXN0QnkgKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5uZXN0ZWQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgbmVzdEJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbmVzdEJ5ID09PSAnZnVuY3Rpb24nICkgeyAvLyBpZSBvbmx5IG9uZSBuZXN0QnkgZmllbGQgb3IgZnVuY2l0b25cbiAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gbW9kZWwubmVzdFByZWxpbShbbmVzdEJ5XSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG5lc3RCeSkpIHsgdGhyb3cgJ25lc3RCeSB2YXJpYWJsZSBtdXN0IGJlIGEgc3RyaW5nLCBmdW5jdGlvbiwgb3IgYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnMnOyB9XG4gICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IG1vZGVsLm5lc3RQcmVsaW0obmVzdEJ5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIG5lc3RUeXBlID09PSAnb2JqZWN0JyApe1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdvYmplY3QnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJlbGltXG4gICAgICAgICAgICAgICAgICAgIC5vYmplY3QodW5uZXN0ZWQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnc2VyaWVzJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAuZW50cmllcyh1bm5lc3RlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgdmlldyA9IHtcbiAgICAgICAgaW5pdCgpe1xuICAgICAgICAgICAgdGhpcy5tYXJnaW5zID0geyAvLyBkZWZhdWx0IHZhbHVlcyA7IGNhbiBiZSBzZXQgYmUgZWFjaCBTVkdzIERPTSBkYXRhc2V0IChodG1sIGRhdGEgYXR0cmlidXRlcylcbiAgICAgICAgICAgICAgICB0b3A6MjAsXG4gICAgICAgICAgICAgICAgcmlnaHQ6MTUsXG4gICAgICAgICAgICAgICAgYm90dG9tOjE1LFxuICAgICAgICAgICAgICAgIGxlZnQ6MzVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLmFjdGl2ZUZpZWxkID0gJ3BiMjVsJztcbiAgICAgICAgICAgIHRoaXMuc2V0dXBDaGFydHMoKTtcbiAgICAgICAgfSxcbiAgICAgICAgbGFiZWwoa2V5KXtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbC5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0dXBDaGFydHMoKXsgXG4gICAgICAgICAgICB2YXIgY2hhcnREaXZzID0gZDMuc2VsZWN0QWxsKCcuZDMtY2hhcnQnKTtcblxuICAgICAgICAgICAgY2hhcnREaXZzLmVhY2goZnVuY3Rpb24oKSB7IC8vIFRPIERPIGRpZmZlcmVudGlhdGUgY2hhcnQgdHlwZXMgZnJvbSBodG1sIGRhdGFzZXRcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBncm91cFNlcmllcyhkYXRhKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlcmllc0dyb3VwcztcbiAgICAgICAgICAgICAgICAgICAgdmFyIGdyb3Vwc0luc3RydWN0ID0gY29uZmlnLnNlcmllc0dyb3VwID8gSlNPTi5wYXJzZShjb25maWcuc2VyaWVzR3JvdXApIDogJ25vbmUnO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIEFycmF5LmlzQXJyYXkoIGdyb3Vwc0luc3RydWN0ICkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIEpTT04ucGFyc2UoY29uZmlnLnNlcmllc0dyb3VwKS5mb3JFYWNoKGdyb3VwID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhncm91cCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzLnB1c2goZGF0YS5maWx0ZXIoc2VyaWVzID0+IGdyb3VwLmluZGV4T2Yoc2VyaWVzLmtleSkgIT09IC0xKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdub25lJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IGRhdGEubWFwKGVhY2ggPT4gW2VhY2hdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdhbGwnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW2RhdGEubWFwKGVhY2ggPT4gZWFjaCldO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgJ0ludmFsaWQgZGF0YS1ncm91cC1zZXJpZXMgdW5zdHJ1Y3Rpb24gZnJvbSBodG1sJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhzZXJpZXNHcm91cHMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VyaWVzR3JvdXBzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgdGhpc0NoYXJ0RGl2ID0gdGhpcztcbiAgICAgICAgICAgICAgICB2YXIgY29uZmlnID0gdGhpcy5kYXRhc2V0O1xuICAgICAgICAgICAgICAgIHZhciBzY2FsZUluc3RydWN0ID0gY29uZmlnLnJlc2V0U2NhbGUgPyBKU09OLnBhcnNlKGNvbmZpZy5yZXNldFNjYWxlKSA6ICdub25lJyxcbiAgICAgICAgICAgICAgICAgICAgbGluZUluZGV4ID0gMCxcbiAgICAgICAgICAgICAgICAgICAgc2VyaWVzSW5kZXggPSAwLFxuICAgICAgICAgICAgICAgICAgICBtYXJnaW5Ub3AgPSArY29uZmlnLm1hcmdpblRvcCB8fCB2aWV3Lm1hcmdpbnMudG9wLFxuICAgICAgICAgICAgICAgICAgICBtYXJnaW5SaWdodCA9ICtjb25maWcubWFyZ2luUmlnaHQgfHwgdmlldy5tYXJnaW5zLnJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBtYXJnaW5Cb3R0b20gPSArY29uZmlnLm1hcmdpbkJvdHRvbSB8fCB2aWV3Lm1hcmdpbnMuYm90dG9tLFxuICAgICAgICAgICAgICAgICAgICBtYXJnaW5MZWZ0ID0gK2NvbmZpZy5tYXJnaW5MZWZ0IHx8IHZpZXcubWFyZ2lucy5sZWZ0O1xuICAgICAgICAgICAgICAgIGlmICggIWNvbmZpZy5tYXJnaW5SaWdodCAmJiBjb25maWcuZGlyZWN0TGFiZWwgKXtcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luUmlnaHQgPSA0NTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIHdpZHRoID0gY29uZmlnLmVhY2hXaWR0aCAtIG1hcmdpbkxlZnQgLSBtYXJnaW5SaWdodCxcbiAgICAgICAgICAgICAgICAgICAgaGVpZ2h0ID0gY29uZmlnLmVhY2hIZWlnaHQgPyBjb25maWcuZWFjaEhlaWdodCAtIG1hcmdpblRvcCAtIG1hcmdpbkJvdHRvbSA6IGNvbmZpZy5lYWNoV2lkdGggLyAyIC0gbWFyZ2luVG9wIC0gbWFyZ2luQm90dG9tO1xuICAgICAgICAgICAgICAgIHZhciBkYXR1bSA9IG1vZGVsLmRhdGEuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBjb25maWcuY2F0ZWdvcnkpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdHVtKTtcbiAgICAgICAgICAgICAgICB2YXIgY2hhcnREaXYgPSBkMy5zZWxlY3QodGhpcylcbiAgICAgICAgICAgICAgICAgICAgLmRhdHVtKGRhdHVtKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZGF0dW0pO1xuXG5jb25zb2xlLmxvZyhtb2RlbC5zdW1tYXJpZXMpO1xuICAgICAgICAgICAgICAgIHZhciBtaW5YID0gMjAxNSxcbiAgICAgICAgICAgICAgICAgICAgbWF4WCA9IDIwNDUsXG4gICAgICAgICAgICAgICAgICAgIG1pblkgPSBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1pbiA8IDAgPyBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1pbiA6IDAsXG4gICAgICAgICAgICAgICAgICAgIG1heFkgPSBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCA+IE1hdGguYWJzKG1pblkgLyAyKSA/IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWF4IDogTWF0aC5hYnMobWluWSAvIDIpLFxuICAgICAgICAgICAgICAgICAgICBwYXJzZVRpbWUgPSBkMy50aW1lUGFyc2UoJyVZJyksXG4gICAgICAgICAgICAgICAgICAgIHggPSBkMy5zY2FsZVRpbWUoKS5yYW5nZShbMCwgd2lkdGhdKS5kb21haW4oW3BhcnNlVGltZShtaW5YKSxwYXJzZVRpbWUobWF4WCldKSxcbiAgICAgICAgICAgICAgICAgICAgeSA9IGQzLnNjYWxlTGluZWFyKCkucmFuZ2UoW2hlaWdodCwgMF0pLmRvbWFpbihbbWluWSxtYXhZXSk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhtaW5YLG1pblksbWF4WCxtYXhZKTtcblxuXG4gICAgICAgICAgICAvKiBIRUFESU5HUyAqL1xuICAgICAgICAgICAgICAgIGNoYXJ0RGl2LmFwcGVuZCgncCcpXG4gICAgICAgICAgICAgICAgICAgIC5odG1sKGQgPT4gJzxzdHJvbmc+JyArIHZpZXcubGFiZWwoZC5rZXkpICsgJzwvc3Ryb25nPicpO1xuXG4gICAgICAgICAgICAgICAgLyogU1ZHUyAqL1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBTVkdzOyAgICBcbiAgICAgICAgICAgICAgICB2YXIgc3ZnQ29udGFpbmVyID0gY2hhcnREaXYuYXBwZW5kKCdkaXYnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywnZmxleCcpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIFNWR3MgPSBzdmdDb250YWluZXIuc2VsZWN0QWxsKCdTVkdzJylcbiAgICAgICAgICAgICAgICAgICAgLmRhdGEoKGQsaSxhcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQsaSxhcnJheSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGdyb3VwU2VyaWVzKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ3N2ZycpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIGNvbmZpZy5lYWNoV2lkdGgpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdoZWlnaHQnLCBoZWlnaHQgKyBtYXJnaW5Ub3AgKyBtYXJnaW5Cb3R0b20pXG4gICAgICAgICAgICAgICAgICAgIC5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgYHRyYW5zbGF0ZSgke21hcmdpbkxlZnR9LCR7bWFyZ2luVG9wfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlbGluZSA9ICBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC54KGQgPT4ge2NvbnNvbGUubG9nKGQpOyByZXR1cm4geChwYXJzZVRpbWUoZC55ZWFyKSk7IH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAueShkID0+IHkoZFt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddKSApO1xuXG4gICAgICAgICAgICAgICAgU1ZHcy5lYWNoKGZ1bmN0aW9uKGQsaSxhcnJheSl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBTVkcgPSBkMy5zZWxlY3QodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkYXRhID0gU1ZHLmRhdGEoKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHVuaXRzO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlcmllc0dyb3VwcyA9IFNWR1xuICAgICAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnc2VyaWVzLWdyb3VwcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZGF0YShkYXRhKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgLyogUEFUSFMgKi9cblxuICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHNcbiAgICAgICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3NlcmllcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZGF0YShkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ3BhdGgnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnbGluZSBsaW5lLScgKyBsaW5lSW5kZXgrKztcblxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgKGQsaikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuaXRzID0gZC52YWx1ZXNbMV0udW5pdHM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coaSwgdGhpcywgaik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCwgZC5rZXksIGRhdHVtLmtleSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coc2NhbGVJbnN0cnVjdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBzY2FsZUluc3RydWN0LmluZGV4T2YoZC5rZXkpICE9PSAtMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhtb2RlbC5zdW1tYXJpZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5ZID0gbW9kZWwuc3VtbWFyaWVzWzFdW2RhdHVtLmtleV1bZC5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDwgMCA/IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1pbiA6IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heFkgPSBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggPiBNYXRoLmFicyhtaW5ZIC8gMikgPyBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggOiBNYXRoLmFicyhtaW5ZIC8gMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHggPSBkMy5zY2FsZVRpbWUoKS5yYW5nZShbMCwgd2lkdGhdKS5kb21haW4oW3BhcnNlVGltZShtaW5YKSxwYXJzZVRpbWUobWF4WCldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeSA9IGQzLnNjYWxlTGluZWFyKCkucmFuZ2UoW2hlaWdodCwgMF0pLmRvbWFpbihbbWluWSxtYXhZXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggaSAhPT0gMCAmJiBqID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkWUF4aXMuY2FsbCh0aGlzLCcnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCBpICE9PSAwICYmIGogPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRZQXhpcy5jYWxsKHRoaXMsJ3JlcGVhdGVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQudmFsdWVzLnVuc2hpZnQoe3llYXI6MjAxNSxbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXTowfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVhY2goZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB2YXIgZGF0YSA9IGQzLnNlbGVjdCh0aGlzKS5kYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2codGhpc0NoYXJ0RGl2KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uZmlnLmRpcmVjdExhYmVsKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2RpcmVjdGxhYmVsJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNWRy5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4gJ3Nlcmllcy1sYWJlbCBzZXJpZXMtJyArIHNlcmllc0luZGV4KyspXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuaHRtbCgoKSA9PiAnPHRzcGFuIHg9XCIwXCI+JyArIHZpZXcubGFiZWwoZC5rZXkpLnJlcGxhY2UoL1xcXFxuL2csJzwvdHNwYW4+PHRzcGFuIHg9XCIwXCIgZHk9XCIxLjJlbVwiPicpICsgJzwvdHNwYW4+JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoKSA9PiBgdHJhbnNsYXRlKCR7d2lkdGggKyAzfSwke3koZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXSkgKyAzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG5cblxuICAgICAgICAgICAgICAgICAgICAvKiBzZXJpZXMgbGFiZWxzICovXG5cbiAgICAgICAgICAgICAgICAgICAvKiBzZXJpZXNHcm91cHMuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+ICdzZXJpZXMtbGFiZWwnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICgpID0+IGB0cmFuc2xhdGUoMCwke2hlaWdodCArIG1hcmdpbkJvdHRvbX0pYClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5odG1sKGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkLnJlZHVjZSgoYWNjLGN1cikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjICsgJzx0c3BhbiBjbGFzcz1cInNlcmllcy0nICsgbGluZUluZGV4KysgKyAnXCI+JyArIHZpZXcubGFiZWwoY3VyLmtleSkgKyAnPC90c3Bhbj4nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vcmV0dXJuIHZpZXcubGFiZWwoZFswXS5rZXkpOyAvLyBpZiBncm91cGVkIHNlcmllcywgd2lsbCBuZWVkIHRvIGl0ZXJhdGUgb3ZlciBhbGwgaW5kZXhlc1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7ICovXG5cbiAgICAgICAgICAgICAgICAgICAgLyogWCBBWElTICovXG5cbiAgICAgICAgICAgICAgICAgICAgU1ZHLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKDAsJyArIHkoMCkgKyAnKScpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzIHgtYXhpcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsKGQzLmF4aXNCb3R0b20oeCkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tWYWx1ZXMoW3BhcnNlVGltZSgyMDI1KSxwYXJzZVRpbWUoMjAzNSkscGFyc2VUaW1lKDIwNDUpXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLGksYXJyYXksdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgaWYgKCBpID09PSAwICkgeyAvLyBpIGhlcmUgaXMgZnJvbSB0aGUgU1ZHLmVhY2ggbG9vcC4gYXBwZW5kIHlBeGlzIHRvIGFsbCBmaXJzdCBTVkdzIG9mIGNoYXJ0RGl2XG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRZQXhpcy5jYWxsKHRoaXMsICcnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBhZGRZQXhpcyhyZXBlYXRlZCA9ICcnLCBzaG93VW5pdHMgPSBmYWxzZSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAvKiBqc2hpbnQgdmFsaWR0aGlzOiB0cnVlICovIC8qIDwtIGNvbW1lbnQga2VlcHMganNoaW50IGZyb20gZmFsc2VseSB3YXJuaW5nIHRoYXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYHRoaXNgIHdpbGwgYmUgdW5kZWZpbmVkLiB0aGUgLmNhbGwoKSBtZXRob2RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmaW5lcyBgdGhpc2AgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiAnYXhpcyB5LWF4aXMgJyArIHJlcGVhdGVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzTGVmdCh5KS50aWNrU2l6ZUlubmVyKDQpLnRpY2tTaXplT3V0ZXIoMCkudGlja1BhZGRpbmcoMSkudGlja3MoNSkpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHNob3dVbml0cyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICd1bml0cycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoKSA9PiBgdHJhbnNsYXRlKC0ke21hcmdpbkxlZnR9LC0ke21hcmdpblRvcCAtIDEwfSlgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAudGV4dCgoKSA9PiB1bml0cy5yZW1vdmVVbmRlcnNjb3JlcygpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAvLyBzZXQgZGF0YSB0byBkWzBdIGFuZCB0aGVuIGFwcGVuZCBsaW5lc1xuICAgICAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgICAgICAgICAvKiBhcHBlbmQgbGluZSAqL1xuXG4gICAgICAgICAgICAgIC8qICAgICAgZDMuc2VsZWN0KHRoaXMpLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnbGluZScpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICovXG5cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgIH07XG5cbiAgICBjb25zdCBjb250cm9sbGVyID0ge1xuICAgICAgICBpbml0KCl7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY29udHJvbGxlciBpbml0Jyk7XG4gICAgICAgICAgICBtb2RlbC5pbml0KCkudGhlbih2YWx1ZXMgPT4ge1xuICAgICAgICAgICAgICAgIG1vZGVsLmRhdGEgPSB2YWx1ZXNbMF07XG4gICAgICAgICAgICAgICAgbW9kZWwuZGljdGlvbmFyeSA9IHZhbHVlc1sxXS51bmRlZmluZWQudW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZGVsLmRpY3Rpb25hcnkpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZGVsLmRhdGEpO1xuICAgICAgICAgICAgICAgIG1vZGVsLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB2aWV3LmluaXQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICB9O1xuICAgIHJldHVybiB7XG4gICAgICAgIEluaXQ6IGNvbnRyb2xsZXIuaW5pdCgpXG4gICAgfTtcbn0oKSk7IiwiZXhwb3J0IGNvbnN0IEhlbHBlcnMgPSAoZnVuY3Rpb24oKXtcbiAgICBcbiAgICBTdHJpbmcucHJvdG90eXBlLmNsZWFuU3RyaW5nID0gZnVuY3Rpb24oKSB7IC8vIGxvd2VyY2FzZSBhbmQgcmVtb3ZlIHB1bmN0dWF0aW9uIGFuZCByZXBsYWNlIHNwYWNlcyB3aXRoIGh5cGhlbnM7IGRlbGV0ZSBwdW5jdHVhdGlvblxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9bIFxcXFxcXC9dL2csJy0nKS5yZXBsYWNlKC9bJ1wi4oCd4oCZ4oCc4oCYLFxcLiFcXD87XFwoXFwpJl0vZywnJykudG9Mb3dlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgU3RyaW5nLnByb3RvdHlwZS5yZW1vdmVVbmRlcnNjb3JlcyA9IGZ1bmN0aW9uKCkgeyBcbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvXy9nLCcgJyk7XG4gICAgfTtcblxufSkoKTtcbiJdfQ==
