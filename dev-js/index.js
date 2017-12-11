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
                right: 10,
                bottom: 10,
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

                    console.log(data);
                    if (Array.isArray(JSON.parse(config.seriesGroup))) {
                        groups = [];
                        JSON.parse(config.seriesGroup).forEach(function (group) {
                            console.log(group);
                            groups.push(data.filter(function (series) {
                                return group.indexOf(series.key) !== -1;
                            }));
                        });
                    } else {
                        groups = data.map(function (each) {
                            return [each];
                        });
                    }
                    console.log(groups);
                    return groups;
                }
                console.log(d, i, array);
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

                SVGs = svgContainer.selectAll('SVGs').data(function (d) {

                    return groupSeries(d.values);
                }).enter().append('svg').attr('width', config.eachWidth).attr('height', height + marginTop + marginBottom).append('g').attr('transform', 'translate(' + marginLeft + ',' + marginTop + ')');

                var valueline = d3.line().x(function (d) {
                    console.log(d);return x(parseTime(d.year));
                }).y(function (d) {
                    return y(d[view.activeField + '_value']);
                });

                SVGs.each(function () {
                    var data = d3.select(this).data();
                    console.log(this, data);
                    var seriesGroups = d3.select(this).selectAll('series-groups').data(data).enter().append('g');

                    seriesGroups.selectAll('series').data(function (d) {
                        console.log(d);
                        return d;
                    }).enter().append('path').attr('class', 'line').attr('d', function (d) {
                        console.log(d);
                        d.values.unshift(_defineProperty({ year: 2015 }, view.activeField + '_value', 0));
                        return valueline(d.values);
                    });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7OztBQ0FDLGFBQVU7QUFDWDs7QUFFSSxRQUFNLFFBQVE7QUFDVixZQURVLGtCQUNKO0FBQUE7O0FBQUU7QUFDSixpQkFBSyxZQUFMLEdBQW9CLEVBQXBCO0FBQ0EsaUJBQUssTUFBTCxHQUFjLENBQUMsVUFBRCxFQUFZLFFBQVosQ0FBZDtBQUNBLGdCQUFJLFVBQVUsOENBQWQ7QUFBQSxnQkFDSSxPQUFPLENBQUMsUUFBRCxDQURYOztBQUdBLGlCQUFLLE9BQUwsQ0FBYSxnQkFBUTtBQUNqQixvQkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsdUJBQUcsSUFBSCxDQUFRLG1EQUFtRCxPQUFuRCxHQUE2RCxVQUE3RCxHQUEwRSxJQUExRSxHQUFpRiw4Q0FBekYsRUFBeUksVUFBQyxLQUFELEVBQU8sSUFBUCxFQUFnQjtBQUFFO0FBQ3ZKLDRCQUFJLEtBQUosRUFBVztBQUNQLG1DQUFPLEtBQVA7QUFDQSxrQ0FBTSxLQUFOO0FBQ0g7QUFDRCw0QkFBSSxTQUFTLEtBQUssTUFBbEI7QUFDQSxnQ0FBUSxHQUFSLENBQVksTUFBWjtBQUNBLGdDQUFRLE1BQUssZUFBTCxDQUFxQixNQUFyQixFQUE2QixNQUFNLE1BQW5DLEVBQTJDLElBQTNDLENBQVI7QUFDSCxxQkFSRDtBQVNILGlCQVZhLENBQWQ7QUFXQSxzQkFBSyxZQUFMLENBQWtCLElBQWxCLENBQXVCLE9BQXZCO0FBQ0gsYUFiRDs7QUFlQSxtQkFBTyxRQUFRLEdBQVIsQ0FBWSxLQUFLLFlBQWpCLENBQVA7QUFDSCxTQXZCUztBQXdCVixxQkF4QlUsMkJBd0JLO0FBQ1gsaUJBQUssU0FBTCxHQUFpQixFQUFqQjtBQUNBLGdCQUFJLFlBQVksT0FBTyxJQUFQLENBQVksS0FBSyxRQUFMLENBQWMs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c0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24oKXsgIFxuXCJ1c2Ugc3RyaWN0XCI7IFxuICAgIFxuICAgIGNvbnN0IG1vZGVsID0ge1xuICAgICAgICBpbml0KCl7IC8vIFNIT1VMRCBUSElTIFNUVUZGIEJFIElOIENPTlRST0xMRVI/XG4gICAgICAgICAgICB0aGlzLmRhdGFQcm9taXNlcyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5uZXN0QnkgPSBbJ2NhdGVnb3J5Jywnc2VyaWVzJ107XG4gICAgICAgICAgICB2YXIgc2hlZXRJRCA9ICcxX0c5SHNKYnhSQmQ3ZldURjUxWHI4bHB4R3h4SW1WY2MtclRJYVFiRWV5QScsXG4gICAgICAgICAgICAgICAgdGFicyA9IFsnU2hlZXQxJ107XG5cbiAgICAgICAgICAgIHRhYnMuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBkMy5qc29uKCdodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJyArIHNoZWV0SUQgKyAnL3ZhbHVlcy8nICsgZWFjaCArICc/a2V5PUFJemFTeUREM1c1d0plSkYyZXNmZlpNUXhOdEVsOXR0LU9mZ1NxNCcsIChlcnJvcixkYXRhKSA9PiB7IC8vIGNvbHVtbnMgQSB0aHJvdWdoIElcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWVzID0gZGF0YS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh2YWx1ZXMpOyBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBtb2RlbC5uZXN0QnksIHRydWUpKTsgXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHRoaXMuZGF0YVByb21pc2VzKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3VtbWFyaXplRGF0YSgpe1xuICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgIHZhciB2YXJpYWJsZXMgPSBPYmplY3Qua2V5cyh0aGlzLnVubmVzdGVkWzBdKTsgLy8gYWxsIG5lZWQgdG8gaGF2ZSB0aGUgc2FtZSBmaWVsZHNcbiAgICAgICAgICAgIHZhciBuZXN0QnlBcnJheSA9IEFycmF5LmlzQXJyYXkodGhpcy5uZXN0QnkpID8gdGhpcy5uZXN0QnkgOiBbdGhpcy5uZXN0QnldO1xuICAgICAgICAgICAgZnVuY3Rpb24gcmVkdWNlVmFyaWFibGVzKGQpe1xuICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgYWNjW2N1cl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXg6IGQzLm1heChkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtaW46IGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICBtZWFuOiBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgIH0se30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKCBuZXN0QnlBcnJheS5sZW5ndGggPiAwKXtcblxuICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAucm9sbHVwKHJlZHVjZVZhcmlhYmxlcylcbiAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh0aGlzLnVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAvLyBjcmVhdGVzIGFuIGFycmF5IG9mIGtleWVkIHN1bW1hcmllc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi4gICAgXG4gICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIFxuICAgICAgICBcbiAgICAgICAgbmVzdFByZWxpbShuZXN0QnlBcnJheSl7XG4gICAgICAgICAgICAvLyByZWN1cnNpdmUgIG5lc3RpbmcgZnVuY3Rpb25cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKG5lc3RCeUFycmF5KTtcbiAgICAgICAgICAgIHJldHVybiBuZXN0QnlBcnJheS5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyICE9PSAnc3RyaW5nJyAmJiB0eXBlb2YgY3VyICE9PSAnZnVuY3Rpb24nICkgeyB0aHJvdyAnZWFjaCBuZXN0QnkgaXRlbSBtdXN0IGJlIGEgc3RyaW5nIG9yIGZ1bmN0aW9uJzsgfVxuICAgICAgICAgICAgICAgIHZhciBydG47XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnc3RyaW5nJyApe1xuICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRbY3VyXTtcbiAgICAgICAgICAgICAgICAgICAgfSk7ICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdmdW5jdGlvbicgKXtcbiAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjdXIoZCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBydG47XG4gICAgICAgICAgICB9LCBkMy5uZXN0KCkpO1xuICAgICAgICB9LCAgICAgICBcbiAgICAgICAgcmV0dXJuS2V5VmFsdWVzKHZhbHVlcywgbmVzdEJ5LCBjb2VyY2UgPSBmYWxzZSwgbmVzdFR5cGUgPSAnc2VyaWVzJyl7IC8vIG5lc3RCeSA9IHN0cmluZyBvciBhcnJheSBvZiBmaWVsZChzKSB0byBuZXN0IGJ5LCBvciBhIGN1c3RvbSBmdW5jdGlvbiwgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb2VyY2UgPSBCT09MIGNvZXJjZSB0byBudW0gb3Igbm90XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBuZXN0VHlwZSA9IG9iamVjdCBvciBzZXJpZXMgbmVzdCAoZDMpXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBwcmVsaW07IFxuICAgICAgICAgICAgdmFyIHVubmVzdGVkID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1ciwgaSkgeyAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgYWNjW3ZhbHVlc1swXVtpXV0gPSBjb2VyY2UgPT09IHRydWUgPyBpc05hTigrY3VyKSB8fCBjdXIgPT09ICcnID8gY3VyIDogK2N1ciA6IGN1cjsgLy8gMy4gLy8gYWNjIGlzIGFuIG9iamVjdCAsIGtleSBpcyBjb3JyZXNwb25kaW5nIHZhbHVlIGZyb20gcm93IDAsIHZhbHVlIGlzIGN1cnJlbnQgdmFsdWUgb2YgYXJyYXlcbiAgICAgICAgICAgICAgICByZXR1cm4gYWNjOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0IGZvciBlbXB0eSBzdHJpbmdzIGJlZm9yZSBjb2VyY2luZyBiYyArJycgPT4gMFxuICAgICAgICAgICAgfSwge30pKTtcbiAgICAgICAgICAgIG1vZGVsLnVubmVzdGVkID0gdW5uZXN0ZWQ7XG4gICAgICAgICAgICB3aW5kb3cudW5uZXN0ZWQgPSB1bm5lc3RlZDsgLy8gUkVNT1ZFXG4gICAgICAgICAgICBpZiAoICFuZXN0QnkgKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5uZXN0ZWQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgbmVzdEJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbmVzdEJ5ID09PSAnZnVuY3Rpb24nICkgeyAvLyBpZSBvbmx5IG9uZSBuZXN0QnkgZmllbGQgb3IgZnVuY2l0b25cbiAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gbW9kZWwubmVzdFByZWxpbShbbmVzdEJ5XSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG5lc3RCeSkpIHsgdGhyb3cgJ25lc3RCeSB2YXJpYWJsZSBtdXN0IGJlIGEgc3RyaW5nLCBmdW5jdGlvbiwgb3IgYXJyYXkgb2Ygc3RyaW5ncyBvciBmdW5jdGlvbnMnOyB9XG4gICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IG1vZGVsLm5lc3RQcmVsaW0obmVzdEJ5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIG5lc3RUeXBlID09PSAnb2JqZWN0JyApe1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdvYmplY3QnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJlbGltXG4gICAgICAgICAgICAgICAgICAgIC5vYmplY3QodW5uZXN0ZWQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnc2VyaWVzJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAuZW50cmllcyh1bm5lc3RlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgdmlldyA9IHtcbiAgICAgICAgaW5pdCgpe1xuICAgICAgICAgICAgdGhpcy5tYXJnaW5zID0geyAvLyBkZWZhdWx0IHZhbHVlcyA7IGNhbiBiZSBzZXQgYmUgZWFjaCBTVkdzIERPTSBkYXRhc2V0IChodG1sIGRhdGEgYXR0cmlidXRlcylcbiAgICAgICAgICAgICAgICB0b3A6NSxcbiAgICAgICAgICAgICAgICByaWdodDoxMCxcbiAgICAgICAgICAgICAgICBib3R0b206MTAsXG4gICAgICAgICAgICAgICAgbGVmdDoxMFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlRmllbGQgPSAncGIyNWwnO1xuICAgICAgICAgICAgdGhpcy5zZXR1cENoYXJ0cygpO1xuICAgICAgICB9LFxuICAgICAgICBzZXR1cENoYXJ0cygpeyBcbiAgICAgICAgICAgIHZhciBjaGFydERpdnMgPSBkMy5zZWxlY3RBbGwoJy5kMy1jaGFydCcpO1xuXG4gICAgICAgICAgICBjaGFydERpdnMuZWFjaChmdW5jdGlvbihkLGksYXJyYXkpIHsgLy8gVE8gRE8gZGlmZmVyZW50aWF0ZSBjaGFydCB0eXBlcyBmcm9tIGh0bWwgZGF0YXNldFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGdyb3VwU2VyaWVzKGRhdGEpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgZ3JvdXBzO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIEFycmF5LmlzQXJyYXkoIEpTT04ucGFyc2UoY29uZmlnLnNlcmllc0dyb3VwKSApICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBncm91cHMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIEpTT04ucGFyc2UoY29uZmlnLnNlcmllc0dyb3VwKS5mb3JFYWNoKGdyb3VwID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhncm91cCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JvdXBzLnB1c2goZGF0YS5maWx0ZXIoc2VyaWVzID0+IGdyb3VwLmluZGV4T2Yoc2VyaWVzLmtleSkgIT09IC0xKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyb3VwcyA9IGRhdGEubWFwKGVhY2ggPT4gW2VhY2hdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhncm91cHMpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ3JvdXBzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkLGksYXJyYXkpO1xuICAgICAgICAgICAgICAgIHZhciBjb25maWcgPSB0aGlzLmRhdGFzZXQsXG4gICAgICAgICAgICAgICAgICAgIG1hcmdpblRvcCA9IGNvbmZpZy5tYXJnaW5Ub3AgfHwgdmlldy5tYXJnaW5zLnRvcCxcbiAgICAgICAgICAgICAgICAgICAgbWFyZ2luUmlnaHQgPSBjb25maWcubWFyZ2luUmlnaHQgfHwgdmlldy5tYXJnaW5zLnJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBtYXJnaW5Cb3R0b20gPSBjb25maWcubWFyZ2luQm90dG9tIHx8IHZpZXcubWFyZ2lucy5ib3R0b20sXG4gICAgICAgICAgICAgICAgICAgIG1hcmdpbkxlZnQgPSBjb25maWcubWFyZ2luTGVmdCB8fCB2aWV3Lm1hcmdpbnMubGVmdCxcbiAgICAgICAgICAgICAgICAgICAgd2lkdGggPSBjb25maWcuZWFjaFdpZHRoIC0gbWFyZ2luTGVmdCAtIG1hcmdpblJpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQgPSBjb25maWcuZWFjaEhlaWdodCA/IGNvbmZpZy5lYWNoSGVpZ2h0IC0gbWFyZ2luVG9wIC0gbWFyZ2luQm90dG9tIDogY29uZmlnLmVhY2hXaWR0aCAvIDIgLSBtYXJnaW5Ub3AgLSBtYXJnaW5Cb3R0b207XG5cbiAgICAgICAgICAgICAgICB2YXIgZGF0dW0gPSBtb2RlbC5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gY29uZmlnLmNhdGVnb3J5KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXR1bSk7XG4gICAgICAgICAgICAgICAgdmFyIGNoYXJ0RGl2ID0gZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgIC5kYXR1bShkYXR1bSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdHVtKTtcblxuXG4gICAgICAgICAgICAgICAgdmFyIG1pblggPSAyMDE1LFxuICAgICAgICAgICAgICAgICAgICBtYXhYID0gMjA0NSxcbiAgICAgICAgICAgICAgICAgICAgbWluWSA9IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDwgMCA/IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWluIDogMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4WSA9IG1vZGVsLnN1bW1hcmllc1swXVtkYXR1bS5rZXldW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10ubWF4LFxuICAgICAgICAgICAgICAgICAgICBwYXJzZVRpbWUgPSBkMy50aW1lUGFyc2UoJyVZJyksXG4gICAgICAgICAgICAgICAgICAgIHggPSBkMy5zY2FsZVRpbWUoKS5yYW5nZShbMCwgd2lkdGhdKS5kb21haW4oW3BhcnNlVGltZShtaW5YKSxwYXJzZVRpbWUobWF4WCldKSxcbiAgICAgICAgICAgICAgICAgICAgeSA9IGQzLnNjYWxlTGluZWFyKCkucmFuZ2UoW2hlaWdodCwgMF0pLmRvbWFpbihbbWluWSxtYXhZXSk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhtaW5YLG1pblksbWF4WCxtYXhZKTtcblxuXG4gICAgICAgICAgICAvKiBIRUFESU5HUyAqL1xuICAgICAgICAgICAgICAgIGNoYXJ0RGl2LmFwcGVuZCgncCcpXG4gICAgICAgICAgICAgICAgICAgIC5odG1sKGQgPT4gJzxzdHJvbmc+JyArIGQua2V5ICsgJzwvc3Ryb25nPicpO1xuXG4gICAgICAgICAgICAvKiBTVkdTICovXG4gICAgICAgICAgICB2YXIgZGF0ID0gY29uZmlnLnNlcmllc0dyb3VwOyBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhKU09OLnBhcnNlKGRhdCkpO1xuICAgICAgICAgICAgdmFyIFNWR3M7ICAgIFxuICAgICAgICAgICAgdmFyIHN2Z0NvbnRhaW5lciA9IGNoYXJ0RGl2LmFwcGVuZCgnZGl2JylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywnZmxleCcpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIFNWR3MgPSBzdmdDb250YWluZXIuc2VsZWN0QWxsKCdTVkdzJylcbiAgICAgICAgICAgICAgICAgICAgLmRhdGEoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ3JvdXBTZXJpZXMoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnc3ZnJylcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3dpZHRoJywgY29uZmlnLmVhY2hXaWR0aClcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2hlaWdodCcsIGhlaWdodCArIG1hcmdpblRvcCArIG1hcmdpbkJvdHRvbSlcbiAgICAgICAgICAgICAgICAgICAgLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgYHRyYW5zbGF0ZSgke21hcmdpbkxlZnR9LCR7bWFyZ2luVG9wfSlgKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgdmFsdWVsaW5lID0gIGQzLmxpbmUoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLngoZCA9PiB7Y29uc29sZS5sb2coZCk7IHJldHVybiB4KHBhcnNlVGltZShkLnllYXIpKTsgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC55KGQgPT4geShkW3ZpZXcuYWN0aXZlRmllbGQgKyAnX3ZhbHVlJ10pICk7XG5cbiAgICAgICAgICAgICAgICBTVkdzLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGEgPSBkMy5zZWxlY3QodGhpcykuZGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzLCBkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlcmllc0dyb3VwcyA9IGQzLnNlbGVjdCh0aGlzKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnNlbGVjdEFsbCgnc2VyaWVzLWdyb3VwcycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZGF0YShkYXRhKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0QWxsKCdzZXJpZXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRhdGEoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdsaW5lJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdkJywgZnVuY3Rpb24oZCl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZC52YWx1ZXMudW5zaGlmdCh7eWVhcjoyMDE1LFt2aWV3LmFjdGl2ZUZpZWxkICsgJ192YWx1ZSddOjB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgLy8gc2V0IGRhdGEgdG8gZFswXSBhbmQgdGhlbiBhcHBlbmQgbGluZXNcbiAgICAgICAgICAgICAgICAgICAgXG5cbiAgICAgICAgICAgICAgICAgICAgLyogYXBwZW5kIGxpbmUgKi9cblxuICAgICAgICAgICAgICAvKiAgICAgIGQzLnNlbGVjdCh0aGlzKS5hcHBlbmQoJ3BhdGgnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2xpbmUnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCBmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAqL1xuXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICB9O1xuXG4gICAgY29uc3QgY29udHJvbGxlciA9IHtcbiAgICAgICAgaW5pdCgpe1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2NvbnRyb2xsZXIgaW5pdCcpO1xuICAgICAgICAgICAgbW9kZWwuaW5pdCgpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICBtb2RlbC5kYXRhID0gdmFsdWVzWzBdO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZGVsLmRhdGEpO1xuICAgICAgICAgICAgICAgIG1vZGVsLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB2aWV3LmluaXQoKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhtb2RlbC5zdW1tYXJpZXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBjb250cm9sbGVyLmluaXQoKTtcbn0oKSk7Il19
