(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

(function () {
    "use strict";

    function cleanString(str) {
        return str.replace(/_/g, ' ');
    }
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
                var config = this.dataset,
                    scaleInstruct = config.resetScale ? JSON.parse(config.resetScale) : 'none',
                    lineIndex = 0,
                    marginTop = config.marginTop || view.margins.top,
                    marginRight = config.marginRight || view.margins.right,
                    marginBottom = config.marginBottom || view.margins.bottom,
                    marginLeft = config.marginLeft || view.margins.left,
                    width = config.eachWidth - marginLeft - marginRight,
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
                        return 'line line-' + lineIndex;
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
                    });

                    /* series labels */

                    seriesGroups.append('text').attr('class', function () {
                        return 'series-label series-' + lineIndex++;
                    }).attr('transform', function () {
                        return 'translate(' + width + ',-5)';
                    }).attr('text-anchor', 'end').html(function (d) {
                        console.log(d);
                        return view.label(d[0].key); // if grouped series, will need to iterate over all indexes
                    });

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
                                return cleanString(units);
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

    controller.init();
})();

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7O0FDQUMsYUFBVTtBQUNYOztBQUNJLGFBQVMsV0FBVCxDQUFxQixHQUFyQixFQUF5QjtBQUNyQixlQUFPLElBQUksT0FBSixDQUFZLElBQVosRUFBaUIsR0FBakIsQ0FBUDtBQUNIO0FBQ0QsUUFBTSxRQUFRO0FBQ1YsWUFEVSxrQkFDSjtBQUFBOztBQUFFO0FBQ0osaUJBQUssWUFBTCxHQUFvQixFQUFwQjtBQUNBLGlCQUFLLE1BQUwsR0FBYyxDQUFDLFVBQUQsRUFBWSxRQUFaLENBQWQ7QUFDQSxnQkFBSSxVQUFVLDhDQUFkO0FBQUEsZ0JBQ0ksT0FBTyxDQUFDLFFBQUQsRUFBVSxZQUFWLENBRFg7O0FBR0EsaUJBQUssT0FBTCxDQUFhLFVBQUMsSUFBRCxFQUFPLENBQVAsRUFBYTtBQUN0QixvQkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsdUJBQUcsSUFBSCxDQUFRLG1EQUFtRCxPQUFuRCxHQUE2RCxVQUE3RCxHQUEwRSxJQUExRSxHQUFpRiw4Q0FBekYsRUFBeUksVUFBQyxLQUFELEVBQU8sSUFBUCxFQUFnQjtBQUFFO0FBQ3ZKLDRCQUFJLEtBQUosRUFBVztBQUNQLG1DQUFPLEtBQVA7QUFDQSxrQ0FBTSxLQUFOO0FBQ0g7QUFDRCw0QkFBSSxTQUFTLEtBQUssTUFBbEI7QUFDQSxnQ0FBUSxHQUFSLENBQVksTUFBWjtBQUNBLDRCQUFJLFdBQVcsU0FBUyxZQUFULEdBQXdCLFFBQXhCLEdBQW1DLFFBQWxEO0FBQ0EsZ0NBQVEsTUFBSyxlQUFMLENBQXFCLE1BQXJCLEVBQTZCLE1BQU0sTUFBbkMsRUFBMkMsSUFBM0MsRUFBaUQsUUFBakQsRUFBMkQsQ0FBM0QsQ0FBUjtBQUNILHFCQVREO0FBVUgsaUJBWGEsQ0FBZDtBQVlBLHNC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Q0FBWixFQUFlLGFBQWYsQ0FBNkIsQ0FBN0IsRUFBZ0MsYUFBaEMsQ0FBOEMsQ0FBOUMsRUFBaUQsV0FBakQsQ0FBNkQsQ0FBN0QsRUFBZ0UsS0FBaEUsQ0FBc0UsQ0FBdEUsQ0FGUjs7QUFJQSw0QkFBSyxTQUFMLEVBQWlCOztBQUVqQiwrQkFBRyxNQUFILENBQVUsSUFBVixFQUFnQixNQUFoQixDQUF1QixNQUF2QixFQUNHLElBREgsQ0FDUSxPQURSLEVBQ2lCLE9BRGpCLEVBRUcsSUFGSCxDQUVRLFdBRlIsRUFFcUI7QUFBQSx1REFBb0IsVUFBcEIsV0FBbUMsWUFBWSxFQUEvQztBQUFBLDZCQUZyQixFQUdHLElBSEgsQ0FHUTtBQUFBLHVDQUFNLFlBQVksS0FBWixDQUFOO0FBQUEsNkJBSFI7QUFJQztBQUNKO0FBRUosaUJBbEZEOztBQW9GRzs7O0FBR0M7O0FBRU47Ozs7Ozs7OztBQVVELGFBaExEO0FBaUxIO0FBbE1RLEtBQWI7O0FBc01BLFFBQU0sYUFBYTtBQUNmLFlBRGUsa0JBQ1Q7QUFDRixvQkFBUSxHQUFSLENBQVksaUJBQVo7QUFDQSxrQkFBTSxJQUFOLEdBQWEsSUFBYixDQUFrQixrQkFBVTtBQUN4QixzQkFBTSxJQUFOLEdBQWEsT0FBTyxDQUFQLENBQWI7QUFDQSxzQkFBTSxVQUFOLEdBQW1CLE9BQU8sQ0FBUCxFQUFVLFNBQVYsQ0FBb0IsU0FBdkM7QUFDQSx3QkFBUSxHQUFSLENBQVksTUFBTSxVQUFsQjtBQUNBLHdCQUFRLEdBQVIsQ0FBWSxNQUFNLElBQWxCO0FBQ0Esc0JBQU0sYUFBTjtBQUNBLHFCQUFLLElBQUw7QUFDSCxhQVBEO0FBUUg7QUFYYyxLQUFuQjs7QUFlQSxlQUFXLElBQVg7QUFDSCxDQXJVQSxHQUFEIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbigpeyAgXG5cInVzZSBzdHJpY3RcIjsgXG4gICAgZnVuY3Rpb24gY2xlYW5TdHJpbmcoc3RyKXtcbiAgICAgICAgcmV0dXJuIHN0ci5yZXBsYWNlKC9fL2csJyAnKTtcbiAgICB9XG4gICAgY29uc3QgbW9kZWwgPSB7XG4gICAgICAgIGluaXQoKXsgLy8gU0hPVUxEIFRISVMgU1RVRkYgQkUgSU4gQ09OVFJPTExFUj9cbiAgICAgICAgICAgIHRoaXMuZGF0YVByb21pc2VzID0gW107XG4gICAgICAgICAgICB0aGlzLm5lc3RCeSA9IFsnY2F0ZWdvcnknLCdzZXJpZXMnXTtcbiAgICAgICAgICAgIHZhciBzaGVldElEID0gJzFfRzlIc0pieFJCZDdmV1RGNTFYcjhscHhHeHhJbVZjYy1yVElhUWJFZXlBJyxcbiAgICAgICAgICAgICAgICB0YWJzID0gWydTaGVldDEnLCdkaWN0aW9uYXJ5J107XG5cbiAgICAgICAgICAgIHRhYnMuZm9yRWFjaCgoZWFjaCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGQzLmpzb24oJ2h0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8nICsgc2hlZXRJRCArICcvdmFsdWVzLycgKyBlYWNoICsgJz9rZXk9QUl6YVN5REQzVzV3SmVKRjJlc2ZmWk1ReE50RWw5dHQtT2ZnU3E0JywgKGVycm9yLGRhdGEpID0+IHsgLy8gY29sdW1ucyBBIHRocm91Z2ggSVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZXMgPSBkYXRhLnZhbHVlcztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdFR5cGUgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyAnb2JqZWN0JyA6ICdzZXJpZXMnO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJldHVybktleVZhbHVlcyh2YWx1ZXMsIG1vZGVsLm5lc3RCeSwgdHJ1ZSwgbmVzdFR5cGUsIGkpKTsgXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgICAgICB9KTtcbmNvbnNvbGUubG9nKHRoaXMuZGF0YVByb21pc2VzKTtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChbLi4udGhpcy5kYXRhUHJvbWlzZXNdKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3VtbWFyaXplRGF0YSgpe1xuICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgIHZhciB2YXJpYWJsZXMgPSBPYmplY3Qua2V5cyh0aGlzLnVubmVzdGVkWzBdKTsgLy8gYWxsIG5lZWQgdG8gaGF2ZSB0aGUgc2FtZSBmaWVsZHNcbiAgICAgICAgICAgIHZhciBuZXN0QnlBcnJheSA9IEFycmF5LmlzQXJyYXkodGhpcy5uZXN0QnkpID8gdGhpcy5uZXN0QnkgOiBbdGhpcy5uZXN0QnldO1xuICAgICAgICAgICAgZnVuY3Rpb24gcmVkdWNlVmFyaWFibGVzKGQpe1xuICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgYWNjW2N1cl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXg6IGQzLm1heChkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW46IGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtZWFuOiBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgIH0se30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKCBuZXN0QnlBcnJheS5sZW5ndGggPiAwKXtcblxuICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAucm9sbHVwKHJlZHVjZVZhcmlhYmxlcylcbiAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh0aGlzLnVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAvLyBjcmVhdGVzIGFuIGFycmF5IG9mIGtleWVkIHN1bW1hcmllc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi4gICAgXG4gICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIFxuXG4gICAgICAgIG5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpe1xuICAgICAgICAgICAgLy8gcmVjdXJzaXZlICBuZXN0aW5nIGZ1bmN0aW9uXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhuZXN0QnlBcnJheSk7XG4gICAgICAgICAgICByZXR1cm4gbmVzdEJ5QXJyYXkucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ciAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGN1ciAhPT0gJ2Z1bmN0aW9uJyApIHsgdGhyb3cgJ2VhY2ggbmVzdEJ5IGl0ZW0gbXVzdCBiZSBhIHN0cmluZyBvciBmdW5jdGlvbic7IH1cbiAgICAgICAgICAgICAgICB2YXIgcnRuO1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ3N0cmluZycgKXtcbiAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkW2N1cl07XG4gICAgICAgICAgICAgICAgICAgIH0pOyAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICAgICAgICAgIHJ0biA9IGFjYy5rZXkoZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VyKGQpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcnRuO1xuICAgICAgICAgICAgfSwgZDMubmVzdCgpKTtcbiAgICAgICAgfSwgICAgICAgXG4gICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycsIHRhYkluZGV4ID0gMCl7IC8vIG5lc3RCeSA9IHN0cmluZyBvciBhcnJheSBvZiBmaWVsZChzKSB0byBuZXN0IGJ5LCBvciBhIGN1c3RvbSBmdW5jdGlvbiwgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb2VyY2UgPSBCT09MIGNvZXJjZSB0byBudW0gb3Igbm90XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBuZXN0VHlwZSA9IG9iamVjdCBvciBzZXJpZXMgbmVzdCAoZDMpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBwcmVsaW07IFxuICAgICAgICAgICAgdmFyIHVubmVzdGVkID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1ciwgaSkgeyAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgYWNjW3ZhbHVlc1swXVtpXV0gPSBjb2VyY2UgPT09IHRydWUgPyBpc05hTigrY3VyKSB8fCBjdXIgPT09ICcnID8gY3VyIDogK2N1ciA6IGN1cjsgLy8gMy4gLy8gYWNjIGlzIGFuIG9iamVjdCAsIGtleSBpcyBjb3JyZXNwb25kaW5nIHZhbHVlIGZyb20gcm93IDAsIHZhbHVlIGlzIGN1cnJlbnQgdmFsdWUgb2YgYXJyYXlcbiAgICAgICAgICAgICAgICByZXR1cm4gYWNjOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0IGZvciBlbXB0eSBzdHJpbmdzIGJlZm9yZSBjb2VyY2luZyBiYyArJycgPT4gMFxuICAgICAgICAgICAgfSwge30pKTtcbiAgICAgICAgICAgIGlmICggdGFiSW5kZXggPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgbW9kZWwudW5uZXN0ZWQgPSB1bm5lc3RlZDtcbiAgICAgICAgICAgIH0gICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCAhbmVzdEJ5ICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVubmVzdGVkO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhuZXN0QnkpO1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIG5lc3RCeSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG5lc3RCeSA9PT0gJ2Z1bmN0aW9uJyApIHsgLy8gaWUgb25seSBvbmUgbmVzdEJ5IGZpZWxkIG9yIGZ1bmNpdG9uXG4gICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IG1vZGVsLm5lc3RQcmVsaW0oW25lc3RCeV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSBtb2RlbC5uZXN0UHJlbGltKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCBuZXN0VHlwZSA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnb2JqZWN0Jyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHVubmVzdGVkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3NlcmllcycpO1xuICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgLmVudHJpZXModW5uZXN0ZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IHZpZXcgPSB7XG4gICAgICAgIGluaXQoKXtcbiAgICAgICAgICAgIHRoaXMubWFyZ2lucyA9IHsgLy8gZGVmYXVsdCB2YWx1ZXMgOyBjYW4gYmUgc2V0IGJlIGVhY2ggU1ZHcyBET00gZGF0YXNldCAoaHRtbCBkYXRhIGF0dHJpYnV0ZXMpXG4gICAgICAgICAgICAgICAgdG9wOjIwLFxuICAgICAgICAgICAgICAgIHJpZ2h0OjE1LFxuICAgICAgICAgICAgICAgIGJvdHRvbToxNSxcbiAgICAgICAgICAgICAgICBsZWZ0OjM1XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVGaWVsZCA9ICdwYjI1bCc7XG4gICAgICAgICAgICB0aGlzLnNldHVwQ2hhcnRzKCk7XG4gICAgICAgIH0sXG4gICAgICAgIGxhYmVsKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWwuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkubGFiZWw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldHVwQ2hhcnRzKCl7IFxuICAgICAgICAgICAgdmFyIGNoYXJ0RGl2cyA9IGQzLnNlbGVjdEFsbCgnLmQzLWNoYXJ0Jyk7XG5cbiAgICAgICAgICAgIGNoYXJ0RGl2cy5lYWNoKGZ1bmN0aW9uKCkgeyAvLyBUTyBETyBkaWZmZXJlbnRpYXRlIGNoYXJ0IHR5cGVzIGZyb20gaHRtbCBkYXRhc2V0XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gZ3JvdXBTZXJpZXMoZGF0YSl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHM7XG4gICAgICAgICAgICAgICAgICAgIHZhciBncm91cHNJbnN0cnVjdCA9IGNvbmZpZy5zZXJpZXNHcm91cCA/IEpTT04ucGFyc2UoY29uZmlnLnNlcmllc0dyb3VwKSA6ICdub25lJztcblxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBBcnJheS5pc0FycmF5KCBncm91cHNJbnN0cnVjdCApICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBKU09OLnBhcnNlKGNvbmZpZy5zZXJpZXNHcm91cCkuZm9yRWFjaChncm91cCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZ3JvdXApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3Vwcy5wdXNoKGRhdGEuZmlsdGVyKHNlcmllcyA9PiBncm91cC5pbmRleE9mKHNlcmllcy5rZXkpICE9PSAtMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnbm9uZScgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBkYXRhLm1hcChlYWNoID0+IFtlYWNoXSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnYWxsJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFtkYXRhLm1hcChlYWNoID0+IGVhY2gpXTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93ICdJbnZhbGlkIGRhdGEtZ3JvdXAtc2VyaWVzIHVuc3RydWN0aW9uIGZyb20gaHRtbCc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coc2VyaWVzR3JvdXBzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlcmllc0dyb3VwcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIGNvbmZpZyA9IHRoaXMuZGF0YXNldCxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGVJbnN0cnVjdCA9IGNvbmZpZy5yZXNldFNjYWxlID8gSlNPTi5wYXJzZShjb25maWcucmVzZXRTY2FsZSkgOiAnbm9uZScsXG4gICAgICAgICAgICAgICAgICAgIGxpbmVJbmRleCA9IDAsXG4gICAgICAgICAgICAgICAgICAgIG1hcmdpblRvcCA9IGNvbmZpZy5tYXJnaW5Ub3AgfHwgdmlldy5tYXJnaW5zLnRvcCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luUmlnaHQgPSBjb25maWcubWFyZ2luUmlnaHQgfHwgdmlldy5tYXJnaW5zLnJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBtYXJnaW5Cb3R0b20gPSBjb25maWcubWFyZ2luQm90dG9tIHx8IHZpZXcubWFyZ2lucy5ib3R0b20sXG4gICAgICAgICAgICAgICAgICAgIG1hcmdpbkxlZnQgPSBjb25maWcubWFyZ2luTGVmdCB8fCB2aWV3Lm1hcmdpbnMubGVmdCxcbiAgICAgICAgICAgICAgICAgICAgd2lkdGggPSBjb25maWcuZWFjaFdpZHRoIC0gbWFyZ2luTGVmdCAtIG1hcmdpblJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQgPSBjb25maWcuZWFjaEhlaWdodCA/IGNvbmZpZy5lYWNoSGVpZ2h0IC0gbWFyZ2luVG9wIC0gbWFyZ2luQm90dG9tIDogY29uZmlnLmVhY2hXaWR0aCAvIDIgLSBtYXJnaW5Ub3AgLSBtYXJnaW5Cb3R0b207XG5cbiAgICAgICAgICAgICAgICB2YXIgZGF0dW0gPSBtb2RlbC5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gY29uZmlnLmNhdGVnb3J5KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXR1bSk7XG4gICAgICAgICAgICAgICAgdmFyIGNoYXJ0RGl2ID0gZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgIC5kYXR1bShkYXR1bSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdHVtKTtcblxuY29uc29sZS5sb2cobW9kZWwuc3VtbWFyaWVzKTtcbiAgICAgICAgICAgICAgICB2YXIgbWluWCA9IDIwMTUsXG4gICAgICAgICAgICAgICAgICAgIG1heFggPSAyMDQ1LFxuICAgICAgICAgICAgICAgICAgICBtaW5ZID0gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gPCAwID8gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gOiAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhZID0gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggPiBNYXRoLmFicyhtaW5ZIC8gMikgPyBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCA6IE1hdGguYWJzKG1pblkgLyAyKSxcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VUaW1lID0gZDMudGltZVBhcnNlKCclWScpLFxuICAgICAgICAgICAgICAgICAgICB4ID0gZDMuc2NhbGVUaW1lKCkucmFuZ2UoWzAsIHdpZHRoXSkuZG9tYWluKFtwYXJzZVRpbWUobWluWCkscGFyc2VUaW1lKG1heFgpXSksXG4gICAgICAgICAgICAgICAgICAgIHkgPSBkMy5zY2FsZUxpbmVhcigpLnJhbmdlKFtoZWlnaHQsIDBdKS5kb21haW4oW21pblksbWF4WV0pO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobWluWCxtaW5ZLG1heFgsbWF4WSk7XG5cblxuICAgICAgICAgICAgLyogSEVBRElOR1MgKi9cbiAgICAgICAgICAgICAgICBjaGFydERpdi5hcHBlbmQoJ3AnKVxuICAgICAgICAgICAgICAgICAgICAuaHRtbChkID0+ICc8c3Ryb25nPicgKyB2aWV3LmxhYmVsKGQua2V5KSArICc8L3N0cm9uZz4nKTtcblxuICAgICAgICAgICAgICAgIC8qIFNWR1MgKi9cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgU1ZHczsgICAgXG4gICAgICAgICAgICAgICAgdmFyIHN2Z0NvbnRhaW5lciA9IGNoYXJ0RGl2LmFwcGVuZCgnZGl2JylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ2ZsZXgnKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBTVkdzID0gc3ZnQ29udGFpbmVyLnNlbGVjdEFsbCgnU1ZHcycpXG4gICAgICAgICAgICAgICAgICAgIC5kYXRhKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLGksYXJyYXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBncm91cFNlcmllcyhkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdzdmcnKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignd2lkdGgnLCBjb25maWcuZWFjaFdpZHRoKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgaGVpZ2h0ICsgbWFyZ2luVG9wICsgbWFyZ2luQm90dG9tKVxuICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIGB0cmFuc2xhdGUoJHttYXJnaW5MZWZ0fSwke21hcmdpblRvcH0pYCk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciB2YWx1ZWxpbmUgPSAgZDMubGluZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAueChkID0+IHtjb25zb2xlLmxvZyhkKTsgcmV0dXJuIHgocGFyc2VUaW1lKGQueWVhcikpOyB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnkoZCA9PiB5KGRbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXSkgKTtcblxuICAgICAgICAgICAgICAgIFNWR3MuZWFjaChmdW5jdGlvbihkLGksYXJyYXkpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgU1ZHID0gZDMuc2VsZWN0KHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IFNWRy5kYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciB1bml0cztcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHMgPSBTVkdcbiAgICAgICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3Nlcmllcy1ncm91cHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRhdGEoZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8qIFBBVEhTICovXG5cbiAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzZXJpZXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRhdGEoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2xpbmUgbGluZS0nICsgbGluZUluZGV4O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCAoZCxqKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5pdHMgPSBkLnZhbHVlc1sxXS51bml0cztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhpLCB0aGlzLCBqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLCBkLmtleSwgZGF0dW0ua2V5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhzY2FsZUluc3RydWN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHNjYWxlSW5zdHJ1Y3QuaW5kZXhPZihkLmtleSkgIT09IC0xICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZGVsLnN1bW1hcmllcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pblkgPSBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gPCAwID8gbW9kZWwuc3VtbWFyaWVzWzFdW2RhdHVtLmtleV1bZC5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDogMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4WSA9IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCA+IE1hdGguYWJzKG1pblkgLyAyKSA/IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCA6IE1hdGguYWJzKG1pblkgLyAyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeCA9IGQzLnNjYWxlVGltZSgpLnJhbmdlKFswLCB3aWR0aF0pLmRvbWFpbihbcGFyc2VUaW1lKG1pblgpLHBhcnNlVGltZShtYXhYKV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB5ID0gZDMuc2NhbGVMaW5lYXIoKS5yYW5nZShbaGVpZ2h0LCAwXSkuZG9tYWluKFttaW5ZLG1heFldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBpICE9PSAwICYmIGogPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRZQXhpcy5jYWxsKHRoaXMsJycsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGkgIT09IDAgJiYgaiA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZFlBeGlzLmNhbGwodGhpcywncmVwZWF0ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZC52YWx1ZXMudW5zaGlmdCh7eWVhcjoyMDE1LFt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddOjB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8qIHNlcmllcyBsYWJlbHMgKi9cblxuICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+ICdzZXJpZXMtbGFiZWwgc2VyaWVzLScgKyBsaW5lSW5kZXgrKylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoKSA9PiBgdHJhbnNsYXRlKCR7d2lkdGh9LC01KWApXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndGV4dC1hbmNob3InLCAnZW5kJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5odG1sKGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2aWV3LmxhYmVsKGRbMF0ua2V5KTsgLy8gaWYgZ3JvdXBlZCBzZXJpZXMsIHdpbGwgbmVlZCB0byBpdGVyYXRlIG92ZXIgYWxsIGluZGV4ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8qIFggQVhJUyAqL1xuXG4gICAgICAgICAgICAgICAgICAgIFNWRy5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLCcgKyB5KDApICsgJyknKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzQm90dG9tKHgpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrVmFsdWVzKFtwYXJzZVRpbWUoMjAyNSkscGFyc2VUaW1lKDIwMzUpLHBhcnNlVGltZSgyMDQ1KV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCxpLGFycmF5LHRoaXMpO1xuICAgICAgICAgICAgICAgICAgIGlmICggaSA9PT0gMCApIHsgLy8gaSBoZXJlIGlzIGZyb20gdGhlIFNWRy5lYWNoIGxvb3AuIGFwcGVuZCB5QXhpcyB0byBhbGwgZmlyc3QgU1ZHcyBvZiBjaGFydERpdlxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkWUF4aXMuY2FsbCh0aGlzLCAnJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gYWRkWUF4aXMocmVwZWF0ZWQgPSAnJywgc2hvd1VuaXRzID0gZmFsc2Upe1xuICAgICAgICAgICAgICAgICAgICAgICAgLyoganNoaW50IHZhbGlkdGhpczogdHJ1ZSAqLyAvKiA8LSBjb21tZW50IGtlZXBzIGpzaGludCBmcm9tIGZhbHNlbHkgd2FybmluZyB0aGF0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGB0aGlzYCB3aWxsIGJlIHVuZGVmaW5lZC4gdGhlIC5jYWxsKCkgbWV0aG9kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmluZXMgYHRoaXNgICovXG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4gJ2F4aXMgeS1heGlzICcgKyByZXBlYXRlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQoeSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDUpKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBzaG93VW5pdHMgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAndW5pdHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKCkgPT4gYHRyYW5zbGF0ZSgtJHttYXJnaW5MZWZ0fSwtJHttYXJnaW5Ub3AgLSAxMH0pYClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnRleHQoKCkgPT4gY2xlYW5TdHJpbmcodW5pdHMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAvLyBzZXQgZGF0YSB0byBkWzBdIGFuZCB0aGVuIGFwcGVuZCBsaW5lc1xuICAgICAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgICAgICAgICAvKiBhcHBlbmQgbGluZSAqL1xuXG4gICAgICAgICAgICAgIC8qICAgICAgZDMuc2VsZWN0KHRoaXMpLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnbGluZScpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICovXG5cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgIH07XG5cbiAgICBjb25zdCBjb250cm9sbGVyID0ge1xuICAgICAgICBpbml0KCl7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY29udHJvbGxlciBpbml0Jyk7XG4gICAgICAgICAgICBtb2RlbC5pbml0KCkudGhlbih2YWx1ZXMgPT4ge1xuICAgICAgICAgICAgICAgIG1vZGVsLmRhdGEgPSB2YWx1ZXNbMF07XG4gICAgICAgICAgICAgICAgbW9kZWwuZGljdGlvbmFyeSA9IHZhbHVlc1sxXS51bmRlZmluZWQudW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZGVsLmRpY3Rpb25hcnkpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZGVsLmRhdGEpO1xuICAgICAgICAgICAgICAgIG1vZGVsLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB2aWV3LmluaXQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgY29udHJvbGxlci5pbml0KCk7XG59KCkpOyJdfQ==
