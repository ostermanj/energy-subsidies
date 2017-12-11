(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

(function () {
    "use strict";

    var model = {
        init: function init() {
            var _this = this;

            // SHOULD THIS STUFF BE IN CONTROLLER?
            this.dataPromises = [];
            this.nestBy = ['category', 'series'];
            var sheetID = '1_G9HsJbxRBd7fWTF51Xr8lpxGxxImVcc-rTIaQbEeyA',
                tabs = ['Sheet1'];

            tabs.forEach(function (each) {
                var promise = new Promise(function (resolve, reject) {
                    d3.json('https://sheets.googleapis.com/v4/spreadsheets/' + sheetID + '/values/' + each + '?key=AIzaSyDD3W5wJeJF2esffZMQxNtEl9tt-OfgSq4', function (error, data) {
                        // columns A through I
                        if (error) {
                            reject(error);
                            throw error;
                        }
                        var values = data.values;
                        console.log(values);
                        resolve(_this.returnKeyValues(values, model.nestBy, true));
                    });
                });
                _this.dataPromises.push(promise);
            });

            return Promise.all(this.dataPromises);
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
            model.unnested = unnested;
            window.unnested = unnested; // REMOVE
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
                top: 5,
                right: 15,
                bottom: 15,
                left: 10
            };
            this.activeField = 'pb25l';
            this.setupCharts();
        },
        setupCharts: function setupCharts() {
            var chartDivs = d3.selectAll('.d3-chart');

            chartDivs.each(function (d, i, array) {
                // TO DO differentiate chart types from html dataset
                function groupSeries(data) {
                    var groups;
                    var instruct = JSON.parse(config.seriesGroup);
                    console.log(data);
                    if (Array.isArray(instruct)) {
                        groups = [];
                        JSON.parse(config.seriesGroup).forEach(function (group) {
                            console.log(group);
                            groups.push(data.filter(function (series) {
                                return group.indexOf(series.key) !== -1;
                            }));
                        });
                    } else if (instruct === 'none') {
                        groups = data.map(function (each) {
                            return [each];
                        });
                    } else if (instruct === 'all') {
                        groups = [data.map(function (each) {
                            return each;
                        })];
                    }
                    console.log(groups);
                    return groups;
                }
                console.log(d, i, array);
                var lineIndex = 0;
                var config = this.dataset,
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

                var minX = 2015,
                    maxX = 2045,
                    minY = model.summaries[0][datum.key][view.activeField + '_value'].min < 0 ? model.summaries[0][datum.key][view.activeField + '_value'].min : 0,
                    maxY = model.summaries[0][datum.key][view.activeField + '_value'].max,
                    parseTime = d3.timeParse('%Y'),
                    x = d3.scaleTime().range([0, width]).domain([parseTime(minX), parseTime(maxX)]),
                    y = d3.scaleLinear().range([height, 0]).domain([minY, maxY]);

                console.log(minX, minY, maxX, maxY);

                /* HEADINGS */
                chartDiv.append('p').html(function (d) {
                    return '<strong>' + d.key + '</strong>';
                });

                /* SVGS */
                var dat = config.seriesGroup;
                console.log(dat);
                console.log(JSON.parse(dat));
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

                SVGs.each(function () {
                    var SVG = d3.select(this);
                    var data = SVG.data();
                    var seriesGroups = SVG.selectAll('series-groups').data(data).enter().append('g');

                    /* PATHS */

                    seriesGroups.selectAll('series').data(function (d) {
                        console.log(d);
                        return d;
                    }).enter().append('path').attr('class', function () {
                        return 'line line-' + lineIndex++;
                    }).attr('d', function (d) {
                        console.log(d);
                        d.values.unshift(_defineProperty({ year: 2015 }, view.activeField + '_value', 0));
                        return valueline(d.values);
                    });

                    /* X AXIS */

                    SVG.append('g').attr('transform', 'translate(0,' + y(0) + ')').attr('class', 'axis x-axis').call(d3.axisBottom(x).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).tickValues([parseTime(2025), parseTime(2035), parseTime(2045)]));
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
                console.log(model.data);
                model.summarizeData();
                view.init();
                console.log(model.summaries);
            });
        }
    };

    controller.init();
})();

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7OztBQ0FDLGFBQVU7QUFDWDs7QUFFSSxRQUFNLFFBQVE7QUFDVixZQURVLGtCQUNKO0FBQUE7O0FBQUU7QUFDSixpQkFBSyxZQUFMLEdBQW9CLEVBQXBCO0FBQ0EsaUJBQUssTUFBTCxHQUFjLENBQUMsVUFBRCxFQUFZLFFBQVosQ0FBZDtBQUNBLGdCQUFJLFVBQVUsOENBQWQ7QUFBQSxnQkFDSSxPQUFPLENBQUMsUUFBRCxDQURYOztBQUdBLGlCQUFLLE9BQUwsQ0FBYSxnQkFBUTtBQUNqQixvQkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsdUJBQUcsSUFBSCxDQUFRLG1EQUFtRCxPQUFuRCxHQUE2RCxVQUE3RCxHQUEwRSxJQUExRSxHQUFpRiw4Q0FBekYsRUFBeUksVUFBQyxLQUFELEVBQU8sSUFBUCxFQUFnQjtBQUFFO0FBQ3ZKLDRCQUFJLEtBQUosRUFBVztBQUNQLG1DQUFPLEtBQVA7QUFDQSxrQ0FBTSxLQUFOO0FBQ0g7QUFDRCw0QkFBSSxTQUFTLEtBQUssTUFBbEI7QUFDQSxnQ0FBUSxHQUFSLENBQVksTUFBWjtBQUNBLGdDQUFRLE1BQUssZUFBTCxDQUFxQixNQUFyQixFQUE2QixNQUFNLE1BQW5DLEVBQTJDLElBQTNDLENBQVI7QUFDSCxxQkFSRDtBQVNILGlCQVZhLENBQWQ7QUFXQSxzQkFBSyxZQUFMLENBQWtCLElBQWxCLENBQXVCLE9BQXZCO0FBQ0gsYUFiRDs7QUFlQSxtQkFBTyxRQUFRLEdBQVIsQ0FBWSxLQUFLLFlBQWpCLENBQVA7QUFDSCxTQXZCUztBQXdCVixxQkF4QlUsMkJBd0JLO0FBQ1gsaUJBQUssU0FBTCxHQUFpQixFQUFqQjtBQUNBLGdCQUFJLFlBQVksT0FBTyxJQUFQLENBQVksS0FBSyxRQUFMLENBQWMs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QWMsQ0FBZCxFQUFpQixhQUFqQixDQUErQixDQUEvQixFQUFrQyxhQUFsQyxDQUFnRCxDQUFoRCxFQUFtRCxXQUFuRCxDQUErRCxDQUEvRCxFQUFrRSxVQUFsRSxDQUE2RSxDQUFDLFVBQVUsSUFBVixDQUFELEVBQWlCLFVBQVUsSUFBVixDQUFqQixFQUFpQyxVQUFVLElBQVYsQ0FBakMsQ0FBN0UsQ0FIWjtBQUtILGlCQWxDRDs7QUFvQ0c7OztBQUdDOztBQUVOOzs7Ozs7Ozs7QUFVRCxhQTlIRDtBQStISDtBQTdJUSxLQUFiOztBQWlKQSxRQUFNLGFBQWE7QUFDZixZQURlLGtCQUNUO0FBQ0Ysb0JBQVEsR0FBUixDQUFZLGlCQUFaO0FBQ0Esa0JBQU0sSUFBTixHQUFhLElBQWIsQ0FBa0Isa0JBQVU7QUFDeEIsc0JBQU0sSUFBTixHQUFhLE9BQU8sQ0FBUCxDQUFiO0FBQ0Esd0JBQVEsR0FBUixDQUFZLE1BQU0sSUFBbEI7QUFDQSxzQkFBTSxhQUFOO0FBQ0EscUJBQUssSUFBTDtBQUNBLHdCQUFRLEdBQVIsQ0FBWSxNQUFNLFNBQWxCO0FBQ0gsYUFORDtBQU9IO0FBVmMsS0FBbkI7O0FBY0EsZUFBVyxJQUFYO0FBQ0gsQ0EzUUEsR0FBRCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24oKXsgIFxuXCJ1c2Ugc3RyaWN0XCI7IFxuICAgIFxuICAgIGNvbnN0IG1vZGVsID0ge1xuICAgICAgICBpbml0KCl7IC8vIFNIT1VMRCBUSElTIFNUVUZGIEJFIElOIENPTlRST0xMRVI/XG4gICAgICAgICAgICB0aGlzLmRhdGFQcm9taXNlcyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5uZXN0QnkgPSBbJ2NhdGVnb3J5Jywnc2VyaWVzJ107XG4gICAgICAgICAgICB2YXIgc2hlZXRJRCA9ICcxX0c5SHNKYnhSQmQ3ZldURjUxWHI4bHB4R3h4SW1WY2MtclRJYVFiRWV5QScsXG4gICAgICAgICAgICAgICAgdGFicyA9IFsnU2hlZXQxJ107XG5cbiAgICAgICAgICAgIHRhYnMuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBkMy5qc29uKCdodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJyArIHNoZWV0SUQgKyAnL3ZhbHVlcy8nICsgZWFjaCArICc/a2V5PUFJemFTeUREM1c1d0plSkYyZXNmZlpNUXhOdEVsOXR0LU9mZ1NxNCcsIChlcnJvcixkYXRhKSA9PiB7IC8vIGNvbHVtbnMgQSB0aHJvdWdoIElcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWVzID0gZGF0YS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh2YWx1ZXMpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBtb2RlbC5uZXN0QnksIHRydWUpKTsgXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHRoaXMuZGF0YVByb21pc2VzKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3VtbWFyaXplRGF0YSgpe1xuICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgIHZhciB2YXJpYWJsZXMgPSBPYmplY3Qua2V5cyh0aGlzLnVubmVzdGVkWzBdKTsgLy8gYWxsIG5lZWQgdG8gaGF2ZSB0aGUgc2FtZSBmaWVsZHNcbiAgICAgICAgICAgIHZhciBuZXN0QnlBcnJheSA9IEFycmF5LmlzQXJyYXkodGhpcy5uZXN0QnkpID8gdGhpcy5uZXN0QnkgOiBbdGhpcy5uZXN0QnldO1xuICAgICAgICAgICAgZnVuY3Rpb24gcmVkdWNlVmFyaWFibGVzKGQpe1xuICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgYWNjW2N1cl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXg6IGQzLm1heChkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW46IGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtZWFuOiBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgIH0se30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKCBuZXN0QnlBcnJheS5sZW5ndGggPiAwKXtcblxuICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAucm9sbHVwKHJlZHVjZVZhcmlhYmxlcylcbiAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh0aGlzLnVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAvLyBjcmVhdGVzIGFuIGFycmF5IG9mIGtleWVkIHN1bW1hcmllc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi4gICAgXG4gICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIFxuXG4gICAgICAgIG5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpe1xuICAgICAgICAgICAgLy8gcmVjdXJzaXZlICBuZXN0aW5nIGZ1bmN0aW9uXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhuZXN0QnlBcnJheSk7XG4gICAgICAgICAgICByZXR1cm4gbmVzdEJ5QXJyYXkucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ciAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGN1ciAhPT0gJ2Z1bmN0aW9uJyApIHsgdGhyb3cgJ2VhY2ggbmVzdEJ5IGl0ZW0gbXVzdCBiZSBhIHN0cmluZyBvciBmdW5jdGlvbic7IH1cbiAgICAgICAgICAgICAgICB2YXIgcnRuO1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ3N0cmluZycgKXtcbiAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkW2N1cl07XG4gICAgICAgICAgICAgICAgICAgIH0pOyAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICAgICAgICAgIHJ0biA9IGFjYy5rZXkoZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VyKGQpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcnRuO1xuICAgICAgICAgICAgfSwgZDMubmVzdCgpKTtcbiAgICAgICAgfSwgICAgICAgXG4gICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycpeyAvLyBuZXN0QnkgPSBzdHJpbmcgb3IgYXJyYXkgb2YgZmllbGQocykgdG8gbmVzdCBieSwgb3IgYSBjdXN0b20gZnVuY3Rpb24sIG9yIGFuIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29lcmNlID0gQk9PTCBjb2VyY2UgdG8gbnVtIG9yIG5vdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbmVzdFR5cGUgPSBvYmplY3Qgb3Igc2VyaWVzIG5lc3QgKGQzKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgcHJlbGltOyBcbiAgICAgICAgICAgIHZhciB1bm5lc3RlZCA9IHZhbHVlcy5zbGljZSgxKS5tYXAocm93ID0+IHJvdy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIsIGkpIHsgLy8gMS4gcGFyYW1zOiB0b3RhbCwgY3VycmVudFZhbHVlLCBjdXJyZW50SW5kZXhbLCBhcnJdXG4gICAgICAgICAgICAgIGFjY1t2YWx1ZXNbMF1baV1dID0gY29lcmNlID09PSB0cnVlID8gaXNOYU4oK2N1cikgfHwgY3VyID09PSAnJyA/IGN1ciA6ICtjdXIgOiBjdXI7IC8vIDMuIC8vIGFjYyBpcyBhbiBvYmplY3QgLCBrZXkgaXMgY29ycmVzcG9uZGluZyB2YWx1ZSBmcm9tIHJvdyAwLCB2YWx1ZSBpcyBjdXJyZW50IHZhbHVlIG9mIGFycmF5XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFjYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGVzdCBmb3IgZW1wdHkgc3RyaW5ncyBiZWZvcmUgY29lcmNpbmcgYmMgKycnID0+IDBcbiAgICAgICAgICAgIH0sIHt9KSk7XG4gICAgICAgICAgICBtb2RlbC51bm5lc3RlZCA9IHVubmVzdGVkO1xuICAgICAgICAgICAgd2luZG93LnVubmVzdGVkID0gdW5uZXN0ZWQ7IC8vIFJFTU9WRVxuICAgICAgICAgICAgaWYgKCAhbmVzdEJ5ICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVubmVzdGVkO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhuZXN0QnkpO1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIG5lc3RCeSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG5lc3RCeSA9PT0gJ2Z1bmN0aW9uJyApIHsgLy8gaWUgb25seSBvbmUgbmVzdEJ5IGZpZWxkIG9yIGZ1bmNpdG9uXG4gICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IG1vZGVsLm5lc3RQcmVsaW0oW25lc3RCeV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSBtb2RlbC5uZXN0UHJlbGltKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCBuZXN0VHlwZSA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnb2JqZWN0Jyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHVubmVzdGVkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3NlcmllcycpO1xuICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgLmVudHJpZXModW5uZXN0ZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IHZpZXcgPSB7XG4gICAgICAgIGluaXQoKXtcbiAgICAgICAgICAgIHRoaXMubWFyZ2lucyA9IHsgLy8gZGVmYXVsdCB2YWx1ZXMgOyBjYW4gYmUgc2V0IGJlIGVhY2ggU1ZHcyBET00gZGF0YXNldCAoaHRtbCBkYXRhIGF0dHJpYnV0ZXMpXG4gICAgICAgICAgICAgICAgdG9wOjUsXG4gICAgICAgICAgICAgICAgcmlnaHQ6MTUsXG4gICAgICAgICAgICAgICAgYm90dG9tOjE1LFxuICAgICAgICAgICAgICAgIGxlZnQ6MTBcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLmFjdGl2ZUZpZWxkID0gJ3BiMjVsJztcbiAgICAgICAgICAgIHRoaXMuc2V0dXBDaGFydHMoKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0dXBDaGFydHMoKXsgXG4gICAgICAgICAgICB2YXIgY2hhcnREaXZzID0gZDMuc2VsZWN0QWxsKCcuZDMtY2hhcnQnKTtcblxuICAgICAgICAgICAgY2hhcnREaXZzLmVhY2goZnVuY3Rpb24oZCxpLGFycmF5KSB7IC8vIFRPIERPIGRpZmZlcmVudGlhdGUgY2hhcnQgdHlwZXMgZnJvbSBodG1sIGRhdGFzZXRcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBncm91cFNlcmllcyhkYXRhKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGdyb3VwcztcbiAgICAgICAgICAgICAgICAgICAgdmFyIGluc3RydWN0ID0gSlNPTi5wYXJzZShjb25maWcuc2VyaWVzR3JvdXApO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBBcnJheS5pc0FycmF5KCBpbnN0cnVjdCApICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ3JvdXBzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBKU09OLnBhcnNlKGNvbmZpZy5zZXJpZXNHcm91cCkuZm9yRWFjaChncm91cCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZ3JvdXApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyb3Vwcy5wdXNoKGRhdGEuZmlsdGVyKHNlcmllcyA9PiBncm91cC5pbmRleE9mKHNlcmllcy5rZXkpICE9PSAtMSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGluc3RydWN0ID09PSAnbm9uZScgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBncm91cHMgPSBkYXRhLm1hcChlYWNoID0+IFtlYWNoXSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGluc3RydWN0ID09PSAnYWxsJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyb3VwcyA9IFtkYXRhLm1hcChlYWNoID0+IGVhY2gpXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhncm91cHMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ3JvdXBzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLGksYXJyYXkpO1xuICAgICAgICAgICAgICAgIHZhciBsaW5lSW5kZXggPSAwO1xuICAgICAgICAgICAgICAgIHZhciBjb25maWcgPSB0aGlzLmRhdGFzZXQsXG4gICAgICAgICAgICAgICAgICAgIG1hcmdpblRvcCA9IGNvbmZpZy5tYXJnaW5Ub3AgfHwgdmlldy5tYXJnaW5zLnRvcCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luUmlnaHQgPSBjb25maWcubWFyZ2luUmlnaHQgfHwgdmlldy5tYXJnaW5zLnJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBtYXJnaW5Cb3R0b20gPSBjb25maWcubWFyZ2luQm90dG9tIHx8IHZpZXcubWFyZ2lucy5ib3R0b20sXG4gICAgICAgICAgICAgICAgICAgIG1hcmdpbkxlZnQgPSBjb25maWcubWFyZ2luTGVmdCB8fCB2aWV3Lm1hcmdpbnMubGVmdCxcbiAgICAgICAgICAgICAgICAgICAgd2lkdGggPSBjb25maWcuZWFjaFdpZHRoIC0gbWFyZ2luTGVmdCAtIG1hcmdpblJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQgPSBjb25maWcuZWFjaEhlaWdodCA/IGNvbmZpZy5lYWNoSGVpZ2h0IC0gbWFyZ2luVG9wIC0gbWFyZ2luQm90dG9tIDogY29uZmlnLmVhY2hXaWR0aCAvIDIgLSBtYXJnaW5Ub3AgLSBtYXJnaW5Cb3R0b207XG5cbiAgICAgICAgICAgICAgICB2YXIgZGF0dW0gPSBtb2RlbC5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gY29uZmlnLmNhdGVnb3J5KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXR1bSk7XG4gICAgICAgICAgICAgICAgdmFyIGNoYXJ0RGl2ID0gZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgIC5kYXR1bShkYXR1bSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdHVtKTtcblxuXG4gICAgICAgICAgICAgICAgdmFyIG1pblggPSAyMDE1LFxuICAgICAgICAgICAgICAgICAgICBtYXhYID0gMjA0NSxcbiAgICAgICAgICAgICAgICAgICAgbWluWSA9IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDwgMCA/IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDogMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4WSA9IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWF4LFxuICAgICAgICAgICAgICAgICAgICBwYXJzZVRpbWUgPSBkMy50aW1lUGFyc2UoJyVZJyksXG4gICAgICAgICAgICAgICAgICAgIHggPSBkMy5zY2FsZVRpbWUoKS5yYW5nZShbMCwgd2lkdGhdKS5kb21haW4oW3BhcnNlVGltZShtaW5YKSxwYXJzZVRpbWUobWF4WCldKSxcbiAgICAgICAgICAgICAgICAgICAgeSA9IGQzLnNjYWxlTGluZWFyKCkucmFuZ2UoW2hlaWdodCwgMF0pLmRvbWFpbihbbWluWSxtYXhZXSk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhtaW5YLG1pblksbWF4WCxtYXhZKTtcblxuXG4gICAgICAgICAgICAvKiBIRUFESU5HUyAqL1xuICAgICAgICAgICAgICAgIGNoYXJ0RGl2LmFwcGVuZCgncCcpXG4gICAgICAgICAgICAgICAgICAgIC5odG1sKGQgPT4gJzxzdHJvbmc+JyArIGQua2V5ICsgJzwvc3Ryb25nPicpO1xuXG4gICAgICAgICAgICAgICAgLyogU1ZHUyAqL1xuICAgICAgICAgICAgICAgIHZhciBkYXQgPSBjb25maWcuc2VyaWVzR3JvdXA7IFxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdCk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coSlNPTi5wYXJzZShkYXQpKTtcbiAgICAgICAgICAgICAgICB2YXIgU1ZHczsgICAgXG4gICAgICAgICAgICAgICAgdmFyIHN2Z0NvbnRhaW5lciA9IGNoYXJ0RGl2LmFwcGVuZCgnZGl2JylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ2ZsZXgnKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBTVkdzID0gc3ZnQ29udGFpbmVyLnNlbGVjdEFsbCgnU1ZHcycpXG4gICAgICAgICAgICAgICAgICAgIC5kYXRhKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLGksYXJyYXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBncm91cFNlcmllcyhkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdzdmcnKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignd2lkdGgnLCBjb25maWcuZWFjaFdpZHRoKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgaGVpZ2h0ICsgbWFyZ2luVG9wICsgbWFyZ2luQm90dG9tKVxuICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCBgdHJhbnNsYXRlKCR7bWFyZ2luTGVmdH0sJHttYXJnaW5Ub3B9KWApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciB2YWx1ZWxpbmUgPSAgZDMubGluZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAueChkID0+IHtjb25zb2xlLmxvZyhkKTsgcmV0dXJuIHgocGFyc2VUaW1lKGQueWVhcikpOyB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnkoZCA9PiB5KGRbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXSkgKTtcblxuICAgICAgICAgICAgICAgIFNWR3MuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgU1ZHID0gZDMuc2VsZWN0KHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IFNWRy5kYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHMgPSBTVkdcbiAgICAgICAgICAgICAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3Nlcmllcy1ncm91cHMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRhdGEoZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8qIFBBVEhTICovXG5cbiAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzZXJpZXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRhdGEoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2xpbmUgbGluZS0nICsgbGluZUluZGV4Kys7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZCcsIGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGQudmFsdWVzLnVuc2hpZnQoe3llYXI6MjAxNSxbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXTowfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAvKiBYIEFYSVMgKi9cblxuICAgICAgICAgICAgICAgICAgICBTVkcuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoMCwnICsgeSgwKSArICcpJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2F4aXMgeC1heGlzJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0JvdHRvbSh4KS50aWNrU2l6ZUlubmVyKDQpLnRpY2tTaXplT3V0ZXIoMCkudGlja1BhZGRpbmcoMSkudGlja1ZhbHVlcyhbcGFyc2VUaW1lKDIwMjUpLHBhcnNlVGltZSgyMDM1KSxwYXJzZVRpbWUoMjA0NSldKSk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgIC8vIHNldCBkYXRhIHRvIGRbMF0gYW5kIHRoZW4gYXBwZW5kIGxpbmVzXG4gICAgICAgICAgICAgICAgICAgIFxuXG4gICAgICAgICAgICAgICAgICAgIC8qIGFwcGVuZCBsaW5lICovXG5cbiAgICAgICAgICAgICAgLyogICAgICBkMy5zZWxlY3QodGhpcykuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdsaW5lJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlbGluZShkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgKi9cblxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgfTtcblxuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB7XG4gICAgICAgIGluaXQoKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjb250cm9sbGVyIGluaXQnKTtcbiAgICAgICAgICAgIG1vZGVsLmluaXQoKS50aGVuKHZhbHVlcyA9PiB7XG4gICAgICAgICAgICAgICAgbW9kZWwuZGF0YSA9IHZhbHVlc1swXTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhtb2RlbC5kYXRhKTtcbiAgICAgICAgICAgICAgICBtb2RlbC5zdW1tYXJpemVEYXRhKCk7XG4gICAgICAgICAgICAgICAgdmlldy5pbml0KCk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cobW9kZWwuc3VtbWFyaWVzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgY29udHJvbGxlci5pbml0KCk7XG59KCkpOyJdfQ==
