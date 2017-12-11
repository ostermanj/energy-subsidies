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
                left: 25
            };
            this.activeField = 'pb25l';
            this.setupCharts();
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
                    console.log(data);
                    var seriesGroups = SVG.selectAll('series-groups').data(data).enter().append('g');

                    /* PATHS */

                    seriesGroups.selectAll('series').data(function (d) {
                        console.log(d);
                        return d;
                    }).enter().append('path').attr('class', function () {
                        return 'line line-' + lineIndex++;
                    }).attr('d', function (d) {
                        console.log(d, d.key, datum.key);
                        console.log(scaleInstruct);
                        if (scaleInstruct.indexOf(d.key) !== -1) {
                            console.log(model.summaries);
                            minY = model.summaries[1][datum.key][d.key][view.activeField + '_value'].min < 0 ? model.summaries[1][datum.key][d.key][view.activeField + '_value'].min : 0;
                            maxY = model.summaries[1][datum.key][d.key][view.activeField + '_value'].max;
                            x = d3.scaleTime().range([0, width]).domain([parseTime(minX), parseTime(maxX)]);
                            y = d3.scaleLinear().range([height, 0]).domain([minY, maxY]);
                        }
                        d.values.unshift(_defineProperty({ year: 2015 }, view.activeField + '_value', 0));
                        return valueline(d.values);
                    });

                    /* X AXIS */

                    SVG.append('g').attr('transform', 'translate(0,' + y(0) + ')').attr('class', 'axis x-axis').call(d3.axisBottom(x).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).tickValues([parseTime(2025), parseTime(2035), parseTime(2045)]));

                    SVG.append('g').attr('class', 'axis y-axis').call(d3.axisLeft(y).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(4));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7OztBQ0FDLGFBQVU7QUFDWDs7QUFFSSxRQUFNLFFBQVE7QUFDVixZQURVLGtCQUNKO0FBQUE7O0FBQUU7QUFDSixpQkFBSyxZQUFMLEdBQW9CLEVBQXBCO0FBQ0EsaUJBQUssTUFBTCxHQUFjLENBQUMsVUFBRCxFQUFZLFFBQVosQ0FBZDtBQUNBLGdCQUFJLFVBQVUsOENBQWQ7QUFBQSxnQkFDSSxPQUFPLENBQUMsUUFBRCxDQURYOztBQUdBLGlCQUFLLE9BQUwsQ0FBYSxnQkFBUTtBQUNqQixvQkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsdUJBQUcsSUFBSCxDQUFRLG1EQUFtRCxPQUFuRCxHQUE2RCxVQUE3RCxHQUEwRSxJQUExRSxHQUFpRiw4Q0FBekYsRUFBeUksVUFBQyxLQUFELEVBQU8sSUFBUCxFQUFnQjtBQUFFO0FBQ3ZKLDRCQUFJLEtBQUosRUFBVztBQUNQLG1DQUFPLEtBQVA7QUFDQSxrQ0FBTSxLQUFOO0FBQ0g7QUFDRCw0QkFBSSxTQUFTLEtBQUssTUFBbEI7QUFDQSxnQ0FBUSxHQUFSLENBQVksTUFBWjtBQUNBLGdDQUFRLE1BQUssZUFBTCxDQUFxQixNQUFyQixFQUE2QixNQUFNLE1BQW5DLEVBQTJDLElBQTNDLENBQVI7QUFDSCxxQkFSRDtBQVNILGlCQVZhLENBQWQ7QUFXQSxzQkFBSyxZQUFMLENBQWtCLElBQWxCLENBQXVCLE9BQXZCO0FBQ0gsYUFiRDs7QUFlQSxtQkFBTyxRQUFRLEdBQVIsQ0FBWSxLQUFLLFlBQWpCLENBQVA7QUFDSCxTQXZCUztBQXdCVixxQkF4QlUsMkJBd0JLO0FBQ1gsaUJBQUssU0FBTCxHQUFpQixFQUFqQjtBQUNBLGdCQUFJLFlBQVksT0FBTyxJQUFQLENBQVksS0FBSyxRQUFMLENBQWMs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aUIsVUFBVSxJQUFWLENBQWpCLEVBQWlDLFVBQVUsSUFBVixDQUFqQyxDQUE3RSxDQUhaOztBQUtELHdCQUFJLE1BQUosQ0FBVyxHQUFYLEVBQ0ksSUFESixDQUNTLE9BRFQsRUFDa0IsYUFEbEIsRUFFSSxJQUZKLENBRVMsR0FBRyxRQUFILENBQVksQ0FBWixFQUFlLGFBQWYsQ0FBNkIsQ0FBN0IsRUFBZ0MsYUFBaEMsQ0FBOEMsQ0FBOUMsRUFBaUQsV0FBakQsQ0FBNkQsQ0FBN0QsRUFBZ0UsS0FBaEUsQ0FBc0UsQ0FBdEUsQ0FGVDtBQUlGLGlCQS9DRDs7QUFpREc7OztBQUdDOztBQUVOOzs7Ozs7Ozs7QUFVRCxhQTVJRDtBQTZJSDtBQTNKUSxLQUFiOztBQStKQSxRQUFNLGFBQWE7QUFDZixZQURlLGtCQUNUO0FBQ0Ysb0JBQVEsR0FBUixDQUFZLGlCQUFaO0FBQ0Esa0JBQU0sSUFBTixHQUFhLElBQWIsQ0FBa0Isa0JBQVU7QUFDeEIsc0JBQU0sSUFBTixHQUFhLE9BQU8sQ0FBUCxDQUFiO0FBQ0Esd0JBQVEsR0FBUixDQUFZLE1BQU0sSUFBbEI7QUFDQSxzQkFBTSxhQUFOO0FBQ0EscUJBQUssSUFBTDtBQUNBLHdCQUFRLEdBQVIsQ0FBWSxNQUFNLFNBQWxCO0FBQ0gsYUFORDtBQU9IO0FBVmMsS0FBbkI7O0FBY0EsZUFBVyxJQUFYO0FBQ0gsQ0F6UkEsR0FBRCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24oKXsgIFxuXCJ1c2Ugc3RyaWN0XCI7IFxuICAgIFxuICAgIGNvbnN0IG1vZGVsID0ge1xuICAgICAgICBpbml0KCl7IC8vIFNIT1VMRCBUSElTIFNUVUZGIEJFIElOIENPTlRST0xMRVI/XG4gICAgICAgICAgICB0aGlzLmRhdGFQcm9taXNlcyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5uZXN0QnkgPSBbJ2NhdGVnb3J5Jywnc2VyaWVzJ107XG4gICAgICAgICAgICB2YXIgc2hlZXRJRCA9ICcxX0c5SHNKYnhSQmQ3ZldURjUxWHI4bHB4R3h4SW1WY2MtclRJYVFiRWV5QScsXG4gICAgICAgICAgICAgICAgdGFicyA9IFsnU2hlZXQxJ107XG5cbiAgICAgICAgICAgIHRhYnMuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBkMy5qc29uKCdodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJyArIHNoZWV0SUQgKyAnL3ZhbHVlcy8nICsgZWFjaCArICc/a2V5PUFJemFTeUREM1c1d0plSkYyZXNmZlpNUXhOdEVsOXR0LU9mZ1NxNCcsIChlcnJvcixkYXRhKSA9PiB7IC8vIGNvbHVtbnMgQSB0aHJvdWdoIElcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWVzID0gZGF0YS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh2YWx1ZXMpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBtb2RlbC5uZXN0QnksIHRydWUpKTsgXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHRoaXMuZGF0YVByb21pc2VzKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3VtbWFyaXplRGF0YSgpe1xuICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgIHZhciB2YXJpYWJsZXMgPSBPYmplY3Qua2V5cyh0aGlzLnVubmVzdGVkWzBdKTsgLy8gYWxsIG5lZWQgdG8gaGF2ZSB0aGUgc2FtZSBmaWVsZHNcbiAgICAgICAgICAgIHZhciBuZXN0QnlBcnJheSA9IEFycmF5LmlzQXJyYXkodGhpcy5uZXN0QnkpID8gdGhpcy5uZXN0QnkgOiBbdGhpcy5uZXN0QnldO1xuICAgICAgICAgICAgZnVuY3Rpb24gcmVkdWNlVmFyaWFibGVzKGQpe1xuICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgYWNjW2N1cl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXg6IGQzLm1heChkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW46IGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtZWFuOiBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgIH0se30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKCBuZXN0QnlBcnJheS5sZW5ndGggPiAwKXtcblxuICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAucm9sbHVwKHJlZHVjZVZhcmlhYmxlcylcbiAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh0aGlzLnVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAvLyBjcmVhdGVzIGFuIGFycmF5IG9mIGtleWVkIHN1bW1hcmllc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi4gICAgXG4gICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIFxuXG4gICAgICAgIG5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpe1xuICAgICAgICAgICAgLy8gcmVjdXJzaXZlICBuZXN0aW5nIGZ1bmN0aW9uXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhuZXN0QnlBcnJheSk7XG4gICAgICAgICAgICByZXR1cm4gbmVzdEJ5QXJyYXkucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ciAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGN1ciAhPT0gJ2Z1bmN0aW9uJyApIHsgdGhyb3cgJ2VhY2ggbmVzdEJ5IGl0ZW0gbXVzdCBiZSBhIHN0cmluZyBvciBmdW5jdGlvbic7IH1cbiAgICAgICAgICAgICAgICB2YXIgcnRuO1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ3N0cmluZycgKXtcbiAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkW2N1cl07XG4gICAgICAgICAgICAgICAgICAgIH0pOyAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICAgICAgICAgIHJ0biA9IGFjYy5rZXkoZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VyKGQpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcnRuO1xuICAgICAgICAgICAgfSwgZDMubmVzdCgpKTtcbiAgICAgICAgfSwgICAgICAgXG4gICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycpeyAvLyBuZXN0QnkgPSBzdHJpbmcgb3IgYXJyYXkgb2YgZmllbGQocykgdG8gbmVzdCBieSwgb3IgYSBjdXN0b20gZnVuY3Rpb24sIG9yIGFuIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29lcmNlID0gQk9PTCBjb2VyY2UgdG8gbnVtIG9yIG5vdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbmVzdFR5cGUgPSBvYmplY3Qgb3Igc2VyaWVzIG5lc3QgKGQzKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgcHJlbGltOyBcbiAgICAgICAgICAgIHZhciB1bm5lc3RlZCA9IHZhbHVlcy5zbGljZSgxKS5tYXAocm93ID0+IHJvdy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIsIGkpIHsgLy8gMS4gcGFyYW1zOiB0b3RhbCwgY3VycmVudFZhbHVlLCBjdXJyZW50SW5kZXhbLCBhcnJdXG4gICAgICAgICAgICAgIGFjY1t2YWx1ZXNbMF1baV1dID0gY29lcmNlID09PSB0cnVlID8gaXNOYU4oK2N1cikgfHwgY3VyID09PSAnJyA/IGN1ciA6ICtjdXIgOiBjdXI7IC8vIDMuIC8vIGFjYyBpcyBhbiBvYmplY3QgLCBrZXkgaXMgY29ycmVzcG9uZGluZyB2YWx1ZSBmcm9tIHJvdyAwLCB2YWx1ZSBpcyBjdXJyZW50IHZhbHVlIG9mIGFycmF5XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFjYzsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGVzdCBmb3IgZW1wdHkgc3RyaW5ncyBiZWZvcmUgY29lcmNpbmcgYmMgKycnID0+IDBcbiAgICAgICAgICAgIH0sIHt9KSk7XG4gICAgICAgICAgICBtb2RlbC51bm5lc3RlZCA9IHVubmVzdGVkO1xuICAgICAgICAgICAgd2luZG93LnVubmVzdGVkID0gdW5uZXN0ZWQ7IC8vIFJFTU9WRVxuICAgICAgICAgICAgaWYgKCAhbmVzdEJ5ICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVubmVzdGVkO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhuZXN0QnkpO1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIG5lc3RCeSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG5lc3RCeSA9PT0gJ2Z1bmN0aW9uJyApIHsgLy8gaWUgb25seSBvbmUgbmVzdEJ5IGZpZWxkIG9yIGZ1bmNpdG9uXG4gICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IG1vZGVsLm5lc3RQcmVsaW0oW25lc3RCeV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICBwcmVsaW0gPSBtb2RlbC5uZXN0UHJlbGltKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCBuZXN0VHlwZSA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnb2JqZWN0Jyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHVubmVzdGVkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3NlcmllcycpO1xuICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgLmVudHJpZXModW5uZXN0ZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IHZpZXcgPSB7XG4gICAgICAgIGluaXQoKXtcbiAgICAgICAgICAgIHRoaXMubWFyZ2lucyA9IHsgLy8gZGVmYXVsdCB2YWx1ZXMgOyBjYW4gYmUgc2V0IGJlIGVhY2ggU1ZHcyBET00gZGF0YXNldCAoaHRtbCBkYXRhIGF0dHJpYnV0ZXMpXG4gICAgICAgICAgICAgICAgdG9wOjUsXG4gICAgICAgICAgICAgICAgcmlnaHQ6MTUsXG4gICAgICAgICAgICAgICAgYm90dG9tOjE1LFxuICAgICAgICAgICAgICAgIGxlZnQ6MjVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLmFjdGl2ZUZpZWxkID0gJ3BiMjVsJztcbiAgICAgICAgICAgIHRoaXMuc2V0dXBDaGFydHMoKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0dXBDaGFydHMoKXsgXG4gICAgICAgICAgICB2YXIgY2hhcnREaXZzID0gZDMuc2VsZWN0QWxsKCcuZDMtY2hhcnQnKTtcblxuICAgICAgICAgICAgY2hhcnREaXZzLmVhY2goZnVuY3Rpb24oKSB7IC8vIFRPIERPIGRpZmZlcmVudGlhdGUgY2hhcnQgdHlwZXMgZnJvbSBodG1sIGRhdGFzZXRcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiBncm91cFNlcmllcyhkYXRhKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlcmllc0dyb3VwcztcbiAgICAgICAgICAgICAgICAgICAgdmFyIGdyb3Vwc0luc3RydWN0ID0gY29uZmlnLnNlcmllc0dyb3VwID8gSlNPTi5wYXJzZShjb25maWcuc2VyaWVzR3JvdXApIDogJ25vbmUnO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIEFycmF5LmlzQXJyYXkoIGdyb3Vwc0luc3RydWN0ICkgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIEpTT04ucGFyc2UoY29uZmlnLnNlcmllc0dyb3VwKS5mb3JFYWNoKGdyb3VwID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhncm91cCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzLnB1c2goZGF0YS5maWx0ZXIoc2VyaWVzID0+IGdyb3VwLmluZGV4T2Yoc2VyaWVzLmtleSkgIT09IC0xKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdub25lJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IGRhdGEubWFwKGVhY2ggPT4gW2VhY2hdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdhbGwnICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW2RhdGEubWFwKGVhY2ggPT4gZWFjaCldO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgJ0ludmFsaWQgZGF0YS1ncm91cC1zZXJpZXMgdW5zdHJ1Y3Rpb24gZnJvbSBodG1sJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhzZXJpZXNHcm91cHMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VyaWVzR3JvdXBzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgY29uZmlnID0gdGhpcy5kYXRhc2V0LFxuICAgICAgICAgICAgICAgICAgICBzY2FsZUluc3RydWN0ID0gY29uZmlnLnJlc2V0U2NhbGUgPyBKU09OLnBhcnNlKGNvbmZpZy5yZXNldFNjYWxlKSA6ICdub25lJyxcbiAgICAgICAgICAgICAgICAgICAgbGluZUluZGV4ID0gMCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luVG9wID0gY29uZmlnLm1hcmdpblRvcCB8fCB2aWV3Lm1hcmdpbnMudG9wLFxuICAgICAgICAgICAgICAgICAgICBtYXJnaW5SaWdodCA9IGNvbmZpZy5tYXJnaW5SaWdodCB8fCB2aWV3Lm1hcmdpbnMucmlnaHQsXG4gICAgICAgICAgICAgICAgICAgIG1hcmdpbkJvdHRvbSA9IGNvbmZpZy5tYXJnaW5Cb3R0b20gfHwgdmlldy5tYXJnaW5zLmJvdHRvbSxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luTGVmdCA9IGNvbmZpZy5tYXJnaW5MZWZ0IHx8IHZpZXcubWFyZ2lucy5sZWZ0LFxuICAgICAgICAgICAgICAgICAgICB3aWR0aCA9IGNvbmZpZy5lYWNoV2lkdGggLSBtYXJnaW5MZWZ0IC0gbWFyZ2luUmlnaHQsXG4gICAgICAgICAgICAgICAgICAgIGhlaWdodCA9IGNvbmZpZy5lYWNoSGVpZ2h0ID8gY29uZmlnLmVhY2hIZWlnaHQgLSBtYXJnaW5Ub3AgLSBtYXJnaW5Cb3R0b20gOiBjb25maWcuZWFjaFdpZHRoIC8gMiAtIG1hcmdpblRvcCAtIG1hcmdpbkJvdHRvbTtcblxuICAgICAgICAgICAgICAgIHZhciBkYXR1bSA9IG1vZGVsLmRhdGEuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBjb25maWcuY2F0ZWdvcnkpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdHVtKTtcbiAgICAgICAgICAgICAgICB2YXIgY2hhcnREaXYgPSBkMy5zZWxlY3QodGhpcylcbiAgICAgICAgICAgICAgICAgICAgLmRhdHVtKGRhdHVtKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZGF0dW0pO1xuXG5jb25zb2xlLmxvZyhtb2RlbC5zdW1tYXJpZXMpO1xuICAgICAgICAgICAgICAgIHZhciBtaW5YID0gMjAxNSxcbiAgICAgICAgICAgICAgICAgICAgbWF4WCA9IDIwNDUsXG4gICAgICAgICAgICAgICAgICAgIG1pblkgPSBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1pbiA8IDAgPyBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1pbiA6IDAsXG4gICAgICAgICAgICAgICAgICAgIG1heFkgPSBtb2RlbC5zdW1tYXJpZXNbMF1bZGF0dW0ua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heCxcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VUaW1lID0gZDMudGltZVBhcnNlKCclWScpLFxuICAgICAgICAgICAgICAgICAgICB4ID0gZDMuc2NhbGVUaW1lKCkucmFuZ2UoWzAsIHdpZHRoXSkuZG9tYWluKFtwYXJzZVRpbWUobWluWCkscGFyc2VUaW1lKG1heFgpXSksXG4gICAgICAgICAgICAgICAgICAgIHkgPSBkMy5zY2FsZUxpbmVhcigpLnJhbmdlKFtoZWlnaHQsIDBdKS5kb21haW4oW21pblksbWF4WV0pO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobWluWCxtaW5ZLG1heFgsbWF4WSk7XG5cblxuICAgICAgICAgICAgLyogSEVBRElOR1MgKi9cbiAgICAgICAgICAgICAgICBjaGFydERpdi5hcHBlbmQoJ3AnKVxuICAgICAgICAgICAgICAgICAgICAuaHRtbChkID0+ICc8c3Ryb25nPicgKyBkLmtleSArICc8L3N0cm9uZz4nKTtcblxuICAgICAgICAgICAgICAgIC8qIFNWR1MgKi9cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgU1ZHczsgICAgXG4gICAgICAgICAgICAgICAgdmFyIHN2Z0NvbnRhaW5lciA9IGNoYXJ0RGl2LmFwcGVuZCgnZGl2JylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsJ2ZsZXgnKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBTVkdzID0gc3ZnQ29udGFpbmVyLnNlbGVjdEFsbCgnU1ZHcycpXG4gICAgICAgICAgICAgICAgICAgIC5kYXRhKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLGksYXJyYXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBncm91cFNlcmllcyhkLnZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdzdmcnKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignd2lkdGgnLCBjb25maWcuZWFjaFdpZHRoKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgaGVpZ2h0ICsgbWFyZ2luVG9wICsgbWFyZ2luQm90dG9tKVxuICAgICAgICAgICAgICAgICAgICAuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCBgdHJhbnNsYXRlKCR7bWFyZ2luTGVmdH0sJHttYXJnaW5Ub3B9KWApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciB2YWx1ZWxpbmUgPSAgZDMubGluZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAueChkID0+IHtjb25zb2xlLmxvZyhkKTsgcmV0dXJuIHgocGFyc2VUaW1lKGQueWVhcikpOyB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnkoZCA9PiB5KGRbdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXSkgKTtcblxuICAgICAgICAgICAgICAgIFNWR3MuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgU1ZHID0gZDMuc2VsZWN0KHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IFNWRy5kYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2VyaWVzR3JvdXBzID0gU1ZHXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzZXJpZXMtZ3JvdXBzJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGRhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ2cnKTtcblxuICAgICAgICAgICAgICAgICAgICAvKiBQQVRIUyAqL1xuXG4gICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3Vwc1xuICAgICAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnc2VyaWVzJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5kYXRhKGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdsaW5lIGxpbmUtJyArIGxpbmVJbmRleCsrO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCBmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLCBkLmtleSwgZGF0dW0ua2V5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhzY2FsZUluc3RydWN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIHNjYWxlSW5zdHJ1Y3QuaW5kZXhPZihkLmtleSkgIT09IC0xICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZGVsLnN1bW1hcmllcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pblkgPSBtb2RlbC5zdW1tYXJpZXNbMV1bZGF0dW0ua2V5XVtkLmtleV1bdmlldy5hY3RpdmVGaWVsZCArICdfdmFsdWUnXS5taW4gPCAwID8gbW9kZWwuc3VtbWFyaWVzWzFdW2RhdHVtLmtleV1bZC5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDogMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4WSA9IG1vZGVsLnN1bW1hcmllc1sxXVtkYXR1bS5rZXldW2Qua2V5XVt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddLm1heDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeCA9IGQzLnNjYWxlVGltZSgpLnJhbmdlKFswLCB3aWR0aF0pLmRvbWFpbihbcGFyc2VUaW1lKG1pblgpLHBhcnNlVGltZShtYXhYKV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB5ID0gZDMuc2NhbGVMaW5lYXIoKS5yYW5nZShbaGVpZ2h0LCAwXSkuZG9tYWluKFttaW5ZLG1heFldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZC52YWx1ZXMudW5zaGlmdCh7eWVhcjoyMDE1LFt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddOjB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8qIFggQVhJUyAqL1xuXG4gICAgICAgICAgICAgICAgICAgIFNWRy5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLCcgKyB5KDApICsgJyknKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcyB4LWF4aXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuY2FsbChkMy5heGlzQm90dG9tKHgpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrVmFsdWVzKFtwYXJzZVRpbWUoMjAyNSkscGFyc2VUaW1lKDIwMzUpLHBhcnNlVGltZSgyMDQ1KV0pKTtcblxuICAgICAgICAgICAgICAgICAgIFNWRy5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzIHktYXhpcycpXG4gICAgICAgICAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQoeSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDQpKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgLy8gc2V0IGRhdGEgdG8gZFswXSBhbmQgdGhlbiBhcHBlbmQgbGluZXNcbiAgICAgICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICAgICAgLyogYXBwZW5kIGxpbmUgKi9cblxuICAgICAgICAgICAgICAvKiAgICAgIGQzLnNlbGVjdCh0aGlzKS5hcHBlbmQoJ3BhdGgnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2xpbmUnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCBmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAqL1xuXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICB9O1xuXG4gICAgY29uc3QgY29udHJvbGxlciA9IHtcbiAgICAgICAgaW5pdCgpe1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2NvbnRyb2xsZXIgaW5pdCcpO1xuICAgICAgICAgICAgbW9kZWwuaW5pdCgpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICBtb2RlbC5kYXRhID0gdmFsdWVzWzBdO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZGVsLmRhdGEpO1xuICAgICAgICAgICAgICAgIG1vZGVsLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB2aWV3LmluaXQoKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhtb2RlbC5zdW1tYXJpZXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBjb250cm9sbGVyLmluaXQoKTtcbn0oKSk7Il19
