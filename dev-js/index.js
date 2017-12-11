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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7O0FDQUMsYUFBVTtBQUNYOztBQUNJLGFBQVMsV0FBVCxDQUFxQixHQUFyQixFQUF5QjtBQUNyQixlQUFPLElBQUksT0FBSixDQUFZLElBQVosRUFBaUIsR0FBakIsQ0FBUDtBQUNIO0FBQ0QsUUFBTSxRQUFRO0FBQ1YsWUFEVSxrQkFDSjtBQUFBOztBQUFFO0FBQ0osaUJBQUssWUFBTCxHQUFvQixFQUFwQjtBQUNBLGlCQUFLLE1BQUwsR0FBYyxDQUFDLFVBQUQsRUFBWSxRQUFaLENBQWQ7QUFDQSxnQkFBSSxVQUFVLDhDQUFkO0FBQUEsZ0JBQ0ksT0FBTyxDQUFDLFFBQUQsRUFBVSxZQUFWLENBRFg7O0FBR0EsaUJBQUssT0FBTCxDQUFhLFVBQUMsSUFBRCxFQUFPLENBQVAsRUFBYTtBQUN0QixvQkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsdUJBQUcsSUFBSCxDQUFRLG1EQUFtRCxPQUFuRCxHQUE2RCxVQUE3RCxHQUEwRSxJQUExRSxHQUFpRiw4Q0FBekYsRUFBeUksVUFBQyxLQUFELEVBQU8sSUFBUCxFQUFnQjtBQUFFO0FBQ3ZKLDRCQUFJLEtBQUosRUFBVztBQUNQLG1DQUFPLEtBQVA7QUFDQSxrQ0FBTSxLQUFOO0FBQ0g7QUFDRCw0QkFBSSxTQUFTLEtBQUssTUFBbEI7QUFDQSxnQ0FBUSxHQUFSLENBQVksTUFBWjtBQUNBLDRCQUFJLFdBQVcsU0FBUyxZQUFULEdBQXdCLFFBQXhCLEdBQW1DLFFBQWxEO0FBQ0EsZ0NBQVEsTUFBSyxlQUFMLENBQXFCLE1BQXJCLEVBQTZCLE1BQU0sTUFBbkMsRUFBMkMsSUFBM0MsRUFBaUQsUUFBakQsRUFBMkQsQ0FBM0QsQ0FBUjtBQUNILHFCQVREO0FBVUgsaUJBWGEsQ0FBZDtBQVlBLHNC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QUFDQSxzQkFBTSxVQUFOLEdBQW1CLE9BQU8sQ0FBUCxFQUFVLFNBQVYsQ0FBb0IsU0FBdkM7QUFDQSx3QkFBUSxHQUFSLENBQVksTUFBTSxVQUFsQjtBQUNBLHdCQUFRLEdBQVIsQ0FBWSxNQUFNLElBQWxCO0FBQ0Esc0JBQU0sYUFBTjtBQUNBLHFCQUFLLElBQUw7QUFDSCxhQVBEO0FBUUg7QUFYYyxLQUFuQjs7QUFlQSxlQUFXLElBQVg7QUFDSCxDQTFWQSxHQUFEIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbigpeyAgXG5cInVzZSBzdHJpY3RcIjsgXG4gICAgZnVuY3Rpb24gY2xlYW5TdHJpbmcoc3RyKXtcbiAgICAgICAgcmV0dXJuIHN0ci5yZXBsYWNlKC9fL2csJyAnKTtcbiAgICB9XG4gICAgY29uc3QgbW9kZWwgPSB7XG4gICAgICAgIGluaXQoKXsgLy8gU0hPVUxEIFRISVMgU1RVRkYgQkUgSU4gQ09OVFJPTExFUj9cbiAgICAgICAgICAgIHRoaXMuZGF0YVByb21pc2VzID0gW107XG4gICAgICAgICAgICB0aGlzLm5lc3RCeSA9IFsnY2F0ZWdvcnknLCdzZXJpZXMnXTtcbiAgICAgICAgICAgIHZhciBzaGVldElEID0gJzFfRzlIc0pieFJCZDdmV1RGNTFYcjhscHhHeHhJbVZjYy1yVElhUWJFZXlBJyxcbiAgICAgICAgICAgICAgICB0YWJzID0gWydTaGVldDEnLCdkaWN0aW9uYXJ5J107XG5cbiAgICAgICAgICAgIHRhYnMuZm9yRWFjaCgoZWFjaCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGQzLmpzb24oJ2h0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8nICsgc2hlZXRJRCArICcvdmFsdWVzLycgKyBlYWNoICsgJz9rZXk9QUl6YVN5REQzVzV3SmVKRjJlc2ZmWk1ReE50RWw5dHQtT2ZnU3E0JywgKGVycm9yLGRhdGEpID0+IHsgLy8gY29sdW1ucyBBIHRocm91Z2ggSVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZXMgPSBkYXRhLnZhbHVlcztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdFR5cGUgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyAnb2JqZWN0JyA6ICdzZXJpZXMnO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJldHVybktleVZhbHVlcyh2YWx1ZXMsIG1vZGVsLm5lc3RCeSwgdHJ1ZSwgbmVzdFR5cGUsIGkpKTsgXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgICAgICB9KTtcbmNvbnNvbGUubG9nKHRoaXMuZGF0YVByb21pc2VzKTtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChbLi4udGhpcy5kYXRhUHJvbWlzZXNdKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3VtbWFyaXplRGF0YSgpe1xuICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgIHZhciB2YXJpYWJsZXMgPSBPYmplY3Qua2V5cyh0aGlzLnVubmVzdGVkWzBdKTsgLy8gYWxsIG5lZWQgdG8gaGF2ZSB0aGUgc2FtZSBmaWVsZHNcbiAgICAgICAgICAgIHZhciBuZXN0QnlBcnJheSA9IEFycmF5LmlzQXJyYXkodGhpcy5uZXN0QnkpID8gdGhpcy5uZXN0QnkgOiBbdGhpcy5uZXN0QnldO1xuICAgICAgICAgICAgZnVuY3Rpb24gcmVkdWNlVmFyaWFibGVzKGQpe1xuICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgYWNjW2N1cl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXg6IGQzLm1heChkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW46IGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtZWFuOiBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgIH0se30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKCBuZXN0QnlBcnJheS5sZW5ndGggPiAwKXtcblxuICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAucm9sbHVwKHJlZHVjZVZhcmlhYmxlcylcbiAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh0aGlzLnVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAvLyBjcmVhdGVzIGFuIGFycmF5IG9mIGtleWVkIHN1bW1hcmllc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi4gICAgXG4gICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIFxuXG4gICAgICAgIG5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpe1xuICAgICAgICAgICAgLy8gcmVjdXJzaXZlICBuZXN0aW5nIGZ1bmN0aW9uXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhuZXN0QnlBcnJheSk7XG4gICAgICAgICAgICByZXR1cm4gbmVzdEJ5QXJyYXkucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ciAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGN1ciAhPT0gJ2Z1bmN0aW9uJyApIHsgdGhyb3cgJ2VhY2ggbmVzdEJ5IGl0ZW0gbXVzdCBiZSBhIHN0cmluZyBvciBmdW5jdGlvbic7IH1cbiAgICAgICAgICAgICAgICB2YXIgcnRuO1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ3N0cmluZycgKXtcbiAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkW2N1cl07XG4gICAgICAgICAgICAgICAgICAgIH0pOyAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICAgICAgICAgIHJ0biA9IGFjYy5rZXkoZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VyKGQpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcnRuO1xuICAgICAgICAgICAgfSwgZDMubmVzdCgpKTtcbiAgICAgICAgfSwgICAgICAgXG4gICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycsIHRhYkluZGV4ID0gMCl7IC8vIG5lc3RCeSA9IHN0cmluZyBvciBhcnJheSBvZiBmaWVsZChzKSB0byBuZXN0IGJ5LCBvciBhIGN1c3RvbSBmdW5jdGlvbiwgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb2VyY2UgPSBCT09MIGNvZXJjZSB0byBudW0gb3Igbm90XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBuZXN0VHlwZSA9IG9iamVjdCBvciBzZXJpZXMgbmVzdCAoZDMpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBwcmVsaW07IFxuICAgICAgICAgICAgdmFyIHVubmVzdGVkID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1ciwgaSkgeyAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgYWNjW3ZhbHVlc1swXVtpXV0gPSBjb2VyY2UgPT09IHRydWUgPyBpc05hTigrY3VyKSB8fCBjdXIgPT09ICcnID8gY3VyIDogK2N1ciA6IGN1cjsgLy8gMy4gLy8gYWNjIGlzIGFuIG9iamVjdCAsIGtleSBpcyBjb3JyZXNwb25kaW5nIHZhbHVlIGZyb20gcm93IDAsIHZhbHVlIGlzIGN1cnJlbnQgdmFsdWUgb2YgYXJyYXlcbiAgICAgICAgICAgICAgICByZXR1cm4gYWNjOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0IGZvciBlbXB0eSBzdHJpbmdzIGJlZm9yZSBjb2VyY2luZyBiYyArJycgPT4gMFxuICAgICAgICAgICAgfSwge30pKTtcbiAgICAgICAgICAgIGlmICggdGFiSW5kZXggPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgbW9kZWwudW5uZXN0ZWQgPSB1bm5lc3RlZDtcbiAgICAgICAgICAgIH0gICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCAhbmVzdEJ5ICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVubmVzdGVkO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhuZXN0QnkpO1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIG5lc3RCeSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG5lc3RCeSA9PT0gJ2Z1bmN0aW9uJyApIHsgLy8gaWUgb25seSBvbmUgbmVzdEJ5IGZpZWxkIG9yIGZ1bmNpdG9uXG4gICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IG1vZGVsLm5lc3RQcmVsaW0oW25lc3RCeV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSBtb2RlbC5uZXN0UHJlbGltKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCBuZXN0VHlwZSA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnb2JqZWN0Jyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHVubmVzdGVkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3NlcmllcycpO1xuICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgLmVudHJpZXModW5uZXN0ZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IHZpZXcgPSB7XG4gICAgICAgIGluaXQoKXtcbiAgICAgICAgICAgIHRoaXMubWFyZ2lucyA9IHsgLy8gZGVmYXVsdCB2YWx1ZXMgOyBjYW4gYmUgc2V0IGJlIGVhY2ggU1ZHcyBET00gZGF0YXNldCAoaHRtbCBkYXRhIGF0dHJpYnV0ZXMpXG4gICAgICAgICAgICAgICAgdG9wOjIwLFxuICAgICAgICAgICAgICAgIHJpZ2h0OjE1LFxuICAgICAgICAgICAgICAgIGJvdHRvbToxNSxcbiAgICAgICAgICAgICAgICBsZWZ0OjM1XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVGaWVsZCA9ICdwYjI1bCc7XG4gICAgICAgICAgICB0aGlzLnNldHVwQ2hhcnRzKCk7XG4gICAgICAgIH0sXG4gICAgICAgIGxhYmVsKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWwuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkubGFiZWw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldHVwQ2hhcnRzKCl7IFxuICAgICAgICAgICAgdmFyIGNoYXJ0RGl2cyA9IGQzLnNlbGVjdEFsbCgnLmQzLWNoYXJ0Jyk7XG5cbiAgICAgICAgICAgIGNoYXJ0RGl2cy5lYWNoKGZ1bmN0aW9uKCkgeyAvLyBUTyBETyBkaWZmZXJlbnRpYXRlIGNoYXJ0IHR5cGVzIGZyb20gaHRtbCBkYXRhc2V0XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gZ3JvdXBTZXJpZXMoZGF0YSl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHM7XG4gICAgICAgICAgICAgICAgICAgIHZhciBncm91cHNJbnN0cnVjdCA9IGNvbmZpZy5zZXJpZXNHcm91cCA/IEpTT04ucGFyc2UoY29uZmlnLnNlcmllc0dyb3VwKSA6ICdub25lJztcblxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBBcnJheS5pc0FycmF5KCBncm91cHNJbnN0cnVjdCApICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBKU09OLnBhcnNlKGNvbmZpZy5zZXJpZXNHcm91cCkuZm9yRWFjaChncm91cCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZ3JvdXApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3Vwcy5wdXNoKGRhdGEuZmlsdGVyKHNlcmllcyA9PiBncm91cC5pbmRleE9mKHNlcmllcy5rZXkpICE9PSAtMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnbm9uZScgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBkYXRhLm1hcChlYWNoID0+IFtlYWNoXSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnYWxsJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFtkYXRhLm1hcChlYWNoID0+IGVhY2gpXTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93ICdJbnZhbGlkIGRhdGEtZ3JvdXAtc2VyaWVzIHVuc3RydWN0aW9uIGZyb20gaHRtbCc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coc2VyaWVzR3JvdXBzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNlcmllc0dyb3VwcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIHRoaXNDaGFydERpdiA9IHRoaXM7XG4gICAgICAgICAgICAgICAgdmFyIGNvbmZpZyA9IHRoaXMuZGF0YXNldDtcbiAgICAgICAgICAgICAgICB2YXIgc2NhbGVJbnN0cnVjdCA9IGNvbmZpZy5yZXNldFNjYWxlID8gSlNPTi5wYXJzZShjb25maWcucmVzZXRTY2FsZSkgOiAnbm9uZScsXG4gICAgICAgICAgICAgICAgICAgIGxpbmVJbmRleCA9IDAsXG4gICAgICAgICAgICAgICAgICAgIHNlcmllc0luZGV4ID0gMCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luVG9wID0gK2NvbmZpZy5tYXJnaW5Ub3AgfHwgdmlldy5tYXJnaW5zLnRvcCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luUmlnaHQgPSArY29uZmlnLm1hcmdpblJpZ2h0IHx8IHZpZXcubWFyZ2lucy5yaWdodCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luQm90dG9tID0gK2NvbmZpZy5tYXJnaW5Cb3R0b20gfHwgdmlldy5tYXJnaW5zLmJvdHRvbSxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luTGVmdCA9ICtjb25maWcubWFyZ2luTGVmdCB8fCB2aWV3Lm1hcmdpbnMubGVmdDtcbiAgICAgICAgICAgICAgICBpZiAoICFjb25maWcubWFyZ2luUmlnaHQgJiYgY29uZmlnLmRpcmVjdExhYmVsICl7XG4gICAgICAgICAgICAgICAgICAgIG1hcmdpblJpZ2h0ID0gNDU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciB3aWR0aCA9IGNvbmZpZy5lYWNoV2lkdGggLSBtYXJnaW5MZWZ0IC0gbWFyZ2luUmlnaHQsXG4gICAgICAgICAgICAgICAgICAgIGhlaWdodCA9IGNvbmZpZy5lYWNoSGVpZ2h0ID8gY29uZmlnLmVhY2hIZWlnaHQgLSBtYXJnaW5Ub3AgLSBtYXJnaW5Cb3R0b20gOiBjb25maWcuZWFjaFdpZHRoIC8gMiAtIG1hcmdpblRvcCAtIG1hcmdpbkJvdHRvbTtcbiAgICAgICAgICAgICAgICB2YXIgZGF0dW0gPSBtb2RlbC5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gY29uZmlnLmNhdGVnb3J5KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXR1bSk7XG4gICAgICAgICAgICAgICAgdmFyIGNoYXJ0RGl2ID0gZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgIC5kYXR1bShkYXR1bSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdHVtKTtcblxuY29uc29sZS5sb2cobW9kZWwuc3VtbWFyaWVzKTtcbiAgICAgICAgICAgICAgICB2YXIgbWluWCA9IDIwMTUsXG4gICAgICAgICAgICAgICAgICAgIG1heFggPSAyMDQ1LFxuICAgICAgICAgICAgICAgICAgICBtaW5ZID0gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gPCAwID8gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gOiAwLFxuICAgICAgICAgICAgICAgICAgICBtYXhZID0gbW9kZWwuc3VtbWFyaWVzWzBdW2RhdHVtLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5tYXggPiBNYXRoLmFicyhtaW5ZIC8gMikgPyBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCA6IE1hdGguYWJzKG1pblkgLyAyKSxcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VUaW1lID0gZDMudGltZVBhcnNlKCclWScpLFxuICAgICAgICAgICAgICAgICAgICB4ID0gZDMuc2NhbGVUaW1lKCkucmFuZ2UoWzAsIHdpZHRoXSkuZG9tYWluKFtwYXJzZVRpbWUobWluWCkscGFyc2VUaW1lKG1heFgpXSksXG4gICAgICAgICAgICAgICAgICAgIHkgPSBkMy5zY2FsZUxpbmVhcigpLnJhbmdlKFtoZWlnaHQsIDBdKS5kb21haW4oW21pblksbWF4WV0pO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobWluWCxtaW5ZLG1heFgsbWF4WSk7XG5cblxuICAgICAgICAgICAgLyogSEVBRElOR1MgKi9cbiAgICAgICAgICAgICAgICBjaGFydERpdi5hcHBlbmQoJ3AnKVxuICAgICAgICAgICAgICAgICAgICAuaHRtbChkID0+ICc8c3Ryb25nPicgKyB2aWV3LmxhYmVsKGQua2V5KSArICc8L3N0cm9uZz4nKTtcblxuICAgICAgICAgICAgICAgIC8qIFNWR1MgKi9cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgU1ZHczsgICAgXG4gICAgICAgICAgICAgICAgdmFyIHN2Z0NvbnRhaW5lciA9IGNoYXJ0RGl2LmFwcGVuZCgnZGl2JylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ2ZsZXgnKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBTVkdzID0gc3ZnQ29udGFpbmVyLnNlbGVjdEFsbCgnU1ZHcycpXG4gICAgICAgICAgICAgICAgICAgIC5kYXRhKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLGksYXJyYXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBncm91cFNlcmllcyhkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdzdmcnKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignd2lkdGgnLCBjb25maWcuZWFjaFdpZHRoKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgaGVpZ2h0ICsgbWFyZ2luVG9wICsgbWFyZ2luQm90dG9tKVxuICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIGB0cmFuc2xhdGUoJHttYXJnaW5MZWZ0fSwke21hcmdpblRvcH0pYCk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciB2YWx1ZWxpbmUgPSAgZDMubGluZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAueChkID0+IHtjb25zb2xlLmxvZyhkKTsgcmV0dXJuIHgocGFyc2VUaW1lKGQueWVhcikpOyB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnkoZCA9PiB5KGRbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXSkgKTtcblxuICAgICAgICAgICAgICAgIFNWR3MuZWFjaChmdW5jdGlvbihkLGksYXJyYXkpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgU1ZHID0gZDMuc2VsZWN0KHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IFNWRy5kYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciB1bml0cztcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHMgPSBTVkdcbiAgICAgICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3Nlcmllcy1ncm91cHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRhdGEoZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8qIFBBVEhTICovXG5cbiAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzZXJpZXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRhdGEoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2xpbmUgbGluZS0nICsgbGluZUluZGV4Kys7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIChkLGopID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bml0cyA9IGQudmFsdWVzWzFdLnVuaXRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGksIHRoaXMsIGopO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQsIGQua2V5LCBkYXR1bS5rZXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHNjYWxlSW5zdHJ1Y3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggc2NhbGVJbnN0cnVjdC5pbmRleE9mKGQua2V5KSAhPT0gLTEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobW9kZWwuc3VtbWFyaWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluWSA9IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1pbiA8IDAgPyBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gOiAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhZID0gbW9kZWwuc3VtbWFyaWVzWzFdW2RhdHVtLmtleV1bZC5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWF4ID4gTWF0aC5hYnMobWluWSAvIDIpID8gbW9kZWwuc3VtbWFyaWVzWzFdW2RhdHVtLmtleV1bZC5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWF4IDogTWF0aC5hYnMobWluWSAvIDIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB4ID0gZDMuc2NhbGVUaW1lKCkucmFuZ2UoWzAsIHdpZHRoXSkuZG9tYWluKFtwYXJzZVRpbWUobWluWCkscGFyc2VUaW1lKG1heFgpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHkgPSBkMy5zY2FsZUxpbmVhcigpLnJhbmdlKFtoZWlnaHQsIDBdKS5kb21haW4oW21pblksbWF4WV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGkgIT09IDAgJiYgaiA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZFlBeGlzLmNhbGwodGhpcywnJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggaSAhPT0gMCAmJiBqID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkWUF4aXMuY2FsbCh0aGlzLCdyZXBlYXRlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkLnZhbHVlcy51bnNoaWZ0KHt5ZWFyOjIwMTUsW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ106MH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5lYWNoKGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmFyIGRhdGEgPSBkMy5zZWxlY3QodGhpcykuZGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHRoaXNDaGFydERpdik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5kaXJlY3RMYWJlbCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdkaXJlY3RsYWJlbCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTVkcuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+ICdzZXJpZXMtbGFiZWwgc2VyaWVzLScgKyBzZXJpZXNJbmRleCsrKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmh0bWwoKCkgPT4gJzx0c3BhbiB4PVwiMFwiPicgKyB2aWV3LmxhYmVsKGQua2V5KS5yZXBsYWNlKC9cXFxcbi9nLCc8L3RzcGFuPjx0c3BhbiB4PVwiMFwiIGR5PVwiMS4yZW1cIj4nKSArICc8L3RzcGFuPicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKCkgPT4gYHRyYW5zbGF0ZSgke3dpZHRoICsgM30sJHt5KGQudmFsdWVzW2QudmFsdWVzLmxlbmd0aCAtIDFdW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10pICsgM30pYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cblxuXG5cbiAgICAgICAgICAgICAgICAgICAgLyogc2VyaWVzIGxhYmVscyAqL1xuXG4gICAgICAgICAgICAgICAgICAgLyogc2VyaWVzR3JvdXBzLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiAnc2VyaWVzLWxhYmVsJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoKSA9PiBgdHJhbnNsYXRlKDAsJHtoZWlnaHQgKyBtYXJnaW5Cb3R0b219KWApXG4gICAgICAgICAgICAgICAgICAgICAgICAuaHRtbChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZC5yZWR1Y2UoKGFjYyxjdXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYyArICc8dHNwYW4gY2xhc3M9XCJzZXJpZXMtJyArIGxpbmVJbmRleCsrICsgJ1wiPicgKyB2aWV3LmxhYmVsKGN1ci5rZXkpICsgJzwvdHNwYW4+JztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL3JldHVybiB2aWV3LmxhYmVsKGRbMF0ua2V5KTsgLy8gaWYgZ3JvdXBlZCBzZXJpZXMsIHdpbGwgbmVlZCB0byBpdGVyYXRlIG92ZXIgYWxsIGluZGV4ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pOyAqL1xuXG4gICAgICAgICAgICAgICAgICAgIC8qIFggQVhJUyAqL1xuXG4gICAgICAgICAgICAgICAgICAgIFNWRy5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLCcgKyB5KDApICsgJyknKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzQm90dG9tKHgpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrVmFsdWVzKFtwYXJzZVRpbWUoMjAyNSkscGFyc2VUaW1lKDIwMzUpLHBhcnNlVGltZSgyMDQ1KV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCxpLGFycmF5LHRoaXMpO1xuICAgICAgICAgICAgICAgICAgIGlmICggaSA9PT0gMCApIHsgLy8gaSBoZXJlIGlzIGZyb20gdGhlIFNWRy5lYWNoIGxvb3AuIGFwcGVuZCB5QXhpcyB0byBhbGwgZmlyc3QgU1ZHcyBvZiBjaGFydERpdlxuICAgICAgICAgICAgICAgICAgICAgICAgYWRkWUF4aXMuY2FsbCh0aGlzLCAnJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gYWRkWUF4aXMocmVwZWF0ZWQgPSAnJywgc2hvd1VuaXRzID0gZmFsc2Upe1xuICAgICAgICAgICAgICAgICAgICAgICAgLyoganNoaW50IHZhbGlkdGhpczogdHJ1ZSAqLyAvKiA8LSBjb21tZW50IGtlZXBzIGpzaGludCBmcm9tIGZhbHNlbHkgd2FybmluZyB0aGF0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGB0aGlzYCB3aWxsIGJlIHVuZGVmaW5lZC4gdGhlIC5jYWxsKCkgbWV0aG9kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmluZXMgYHRoaXNgICovXG4gICAgICAgICAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4gJ2F4aXMgeS1heGlzICcgKyByZXBlYXRlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQoeSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDUpKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBzaG93VW5pdHMgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAndW5pdHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKCkgPT4gYHRyYW5zbGF0ZSgtJHttYXJnaW5MZWZ0fSwtJHttYXJnaW5Ub3AgLSAxMH0pYClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnRleHQoKCkgPT4gY2xlYW5TdHJpbmcodW5pdHMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAvLyBzZXQgZGF0YSB0byBkWzBdIGFuZCB0aGVuIGFwcGVuZCBsaW5lc1xuICAgICAgICAgICAgICAgICAgICBcblxuICAgICAgICAgICAgICAgICAgICAvKiBhcHBlbmQgbGluZSAqL1xuXG4gICAgICAgICAgICAgIC8qICAgICAgZDMuc2VsZWN0KHRoaXMpLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnbGluZScpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICovXG5cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgIH07XG5cbiAgICBjb25zdCBjb250cm9sbGVyID0ge1xuICAgICAgICBpbml0KCl7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY29udHJvbGxlciBpbml0Jyk7XG4gICAgICAgICAgICBtb2RlbC5pbml0KCkudGhlbih2YWx1ZXMgPT4ge1xuICAgICAgICAgICAgICAgIG1vZGVsLmRhdGEgPSB2YWx1ZXNbMF07XG4gICAgICAgICAgICAgICAgbW9kZWwuZGljdGlvbmFyeSA9IHZhbHVlc1sxXS51bmRlZmluZWQudW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZGVsLmRpY3Rpb25hcnkpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZGVsLmRhdGEpO1xuICAgICAgICAgICAgICAgIG1vZGVsLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB2aWV3LmluaXQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgY29udHJvbGxlci5pbml0KCk7XG59KCkpOyJdfQ==
