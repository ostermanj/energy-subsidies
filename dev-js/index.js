(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _Helpers = require('../js-exports/Helpers');

var _Charts = require('../js-exports/Charts');

var _d3Tip = require('../js-vendor/d3-tip');

var D3Charts = function () {

    "use strict";

    var groupCollection = [];
    var D3ChartGroup = function D3ChartGroup(container, index) {
        var _this = this;

        console.log(index);
        this.container = container;
        this.index = index;
        this.config = container.dataset.convert();
        console.log(this.config.nestBy.toString());
        this.dataPromises = this.returnDataPromises(container);
        this.children = [];
        console.log(this.dataPromises);
        //this.controller.initController(container, this.model, this.view);
        this.dataPromises.then(function () {
            _this.initializeCharts(container);
        });
    };
    //prototype begins here
    D3ChartGroup.prototype = {
        returnDataPromises: function returnDataPromises() {
            var _this2 = this;

            var dataPromises = [];
            var sheetID = this.config.sheetId,
                tabs = [this.config.dataTab, this.config.dictionaryTab]; // this should come from HTML
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
                        var nestBy = each === 'dictionary' ? false : _this2.config.nestBy;
                        resolve(_this2.returnKeyValues(values, nestBy, true, nestType, i));
                    });
                });
                dataPromises.push(promise);
            });
            Promise.all(dataPromises).then(function (values) {
                _this2.data = values[0];
                _this2.dictionary = values[1];
                _this2.summaries = _this2.summarizeData();
            });
            return Promise.all(dataPromises);
        },
        summarizeData: function summarizeData() {
            // this fn creates an array of objects summarizing the data in model.data. model.data is nested
            // and nesting and rolling up cannot be done easily at the same time, so they're done separately.
            // the summaries provide average, max, min of all fields in the data at all levels of nesting. 
            // the first (index 0) is one layer nested, the second is two, and so on.

            var summaries = [];
            var variables = Object.keys(this.unnested[0]); // all need to have the same fields
            var nestBy = this.config.nestBy ? this.config.nestBy.map(function (each) {
                return each;
            }) : false;
            // uses map to create new array rather than assigning
            // by reference. the `pop()` below would affect original
            // array if done by reference
            var nestByArray = Array.isArray(nestBy) ? nestBy : [nestBy];
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
                summaries.unshift(summarized);
                nestByArray.pop();
            }
            return summaries;
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
                this.unnested = unnested;
            }
            if (!nestBy) {
                return unnested;
            } else {
                if (typeof nestBy === 'string' || typeof nestBy === 'function') {
                    // ie only one nestBy field or funciton
                    prelim = this.nestPrelim([nestBy]);
                } else {
                    if (!Array.isArray(nestBy)) {
                        throw 'nestBy variable must be a string, function, or array of strings or functions';
                    }
                    prelim = this.nestPrelim(nestBy);
                }
            }
            if (nestType === 'object') {
                return prelim.object(unnested);
            } else {
                return prelim.entries(unnested);
            }
        },
        initializeCharts: function initializeCharts(container) {
            var group = this;
            d3.select(container).selectAll('.d3-chart').each(function () {
                group.children.push(new _Charts.Charts.ChartDiv(this, group));
            });
        }
    }; // D3ChartGroup prototype ends here

    window.D3Charts = {
        // need to specify window bc after transpiling all this will be wrapped in IIFEs
        // and `return`ing won't get the export into window's global scope
        Init: function Init() {
            var groupDivs = document.querySelectorAll('.d3-group');
            for (var i = 0; i < groupDivs.length; i++) {
                groupCollection.push(new D3ChartGroup(groupDivs[i], i));
            }
            console.log(groupCollection);
        }
    };
}(); // end var D3Charts IIFE
/* exported D3Charts, Helpers, d3Tip */ // let's jshint know that D3Charts can be "defined but not used" in this file
/* polyfills needed: Promise, Array.isArray, Array.find, Array.filter
 */

},{"../js-exports/Charts":2,"../js-exports/Helpers":3,"../js-vendor/d3-tip":4}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var Charts = exports.Charts = function () {

    var ChartDiv = function ChartDiv(container, parent) {
        var _this = this;

        this.container = container;
        this.parent = parent;
        this.children = [];
        this.seriesCount = 0;
        this.config = Object.create(parent.config, Object.getOwnPropertyDescriptors(container.dataset.convert()));
        // line above creates a config object from the HTML dataset for the chartDiv container
        // that inherits from the parents config object. any configs not specified for the chartDiv (an own property)
        // will come from up the inheritance chain
        this.datum = parent.data.find(function (each) {
            return each.key === _this.config.category;
        });
        var seriesInstruct = this.config.series || 'all';
        console.log(seriesInstruct);
        if (Array.isArray(seriesInstruct)) {
            console.log('is array', this.datum.values);
            this.datum.values = this.datum.values.filter(function (each) {
                console.log(each.key);
                return seriesInstruct.indexOf(each.key) !== -1;
            });
        } else if (seriesInstruct !== 'all') {
            console.log('Invalid instruction from HTML for which categories to include \n                    (var seriesInstruct). Fallback to all.');
        }
        this.seriesGroups = this.groupSeries();
        this.dictionary = this.parent.dictionary;
        if (this.config.heading !== false) {
            this.addHeading(this.config.heading);
        }
        this.createCharts();
    };

    ChartDiv.prototype = {
        chartTypes: {
            line: 'LineChart',
            column: 'ColumnChart',
            bar: 'BarChart' // so on . . .
        },
        createCharts: function createCharts() {
            var _this2 = this;

            this.seriesGroups.forEach(function (each) {
                _this2.children.push(new LineChart(_this2, each)); // TO DO distinguish chart types here
            });
        },
        groupSeries: function groupSeries() {
            var _this3 = this;

            var seriesGroups,
                groupsInstruct = this.config.seriesGroup || 'none';
            if (Array.isArray(groupsInstruct)) {
                seriesGroups = [];
                this.config.seriesGroup.forEach(function (group) {
                    seriesGroups.push(_this3.datum.values.filter(function (series) {
                        return group.indexOf(series.key) !== -1;
                    }));
                });
            } else if (groupsInstruct === 'none') {
                seriesGroups = this.datum.values.map(function (each) {
                    return [each];
                });
            } else if (groupsInstruct === 'all') {
                seriesGroups = [this.datum.values.map(function (each) {
                    return each;
                })];
            } else {
                console.log('Invalid data-group-series instruction from html. \n                       Must be valid JSON: "None" or "All" or an array\n                       of arrays containing the series to be grouped\n                       together. All strings must be double-quoted.');
            }
            return seriesGroups;
        },
        // end groupSeries()
        addHeading: function addHeading(input) {
            var _this4 = this;

            console.log(input);
            d3.select(this.container).append('p').html(function () {
                var heading = typeof input === 'string' ? input : _this4.label(_this4.config.category);
                return '<strong>' + heading + '</strong>';
            });
        },
        label: function label(key) {
            return this.dictionary.find(function (each) {
                return each.key === key;
            }).label;
        },
        units: function units(key) {
            return this.dictionary.find(function (each) {
                return each.key === key;
            }).units;
        },
        tipText: function tipText(key) {
            var str = this.dictionary.find(function (each) {
                return each.key === key;
            }).label.replace(/\\n/g, ' ');
            return str.charAt(0).toUpperCase() + str.slice(1);
        }
    }; // end LineChart.prototype

    var LineChart = function LineChart(parent, seriesGroup) {
        this.parent = parent;
        this.config = parent.config;
        this.marginTop = +this.config.marginTop || this.defaultMargins.top;
        this.marginRight = +this.config.marginRight || this.defaultMargins.right;
        this.marginBottom = +this.config.marginBottom || this.defaultMargins.bottom;
        this.marginLeft = +this.config.marginLeft || this.defaultMargins.left;
        this.width = this.config.svgWidth ? +this.config.svgWidth - this.marginRight - this.marginLeft : 320 - this.marginRight - this.marginLeft;
        this.height = this.config.svgHeight ? +this.config.svgHeight - this.marginTop - this.marginBottom : (this.width + this.marginRight + this.marginLeft) / 2 - this.marginTop - this.marginBottom;
        this.data = seriesGroup;
        console.log(this);
        this.container = this.init(parent.container);
        this.xScaleType = this.config.xScaleType || 'time';
        this.yScaleType = this.config.yScaleType || 'linear';
        this.xTimeType = this.config.xTimeType || '%Y';
        this.scaleBy = this.config.scaleBy || 'series-group';
        this.setScales(); // //SHOULD BE IN CHART PROTOTYPE 
        this.setTooltips();
        this.addLines();
        this.addPoints();
        this.addXAxis();
        this.addYAxis();
        if (this.config.directLabel === true) {
            this.addLabels();
        } else {
            // this.addLegends();
        }
    };

    LineChart.prototype = { // each LineChart is an svg that hold grouped series
        defaultMargins: {
            top: 20,
            right: 45,
            bottom: 15,
            left: 35
        },

        init: function init(chartDiv) {
            var _this5 = this;

            // //SHOULD BE IN CHART PROTOTYPE this is called once for each seriesGroup of each category. 
            var container = d3.select(chartDiv).append('svg').attr('width', this.width + this.marginRight + this.marginLeft).attr('height', this.height + this.marginTop + this.marginBottom);

            this.svg = container.append('g').attr('transform', 'translate(' + this.marginLeft + ', ' + this.marginTop + ')');

            this.eachSeries = this.svg.selectAll('each-series').data(this.data).enter().append('g').attr('class', function () {
                return 'each-series series-' + _this5.parent.seriesCount + ' color-' + _this5.parent.seriesCount++ % 3;
            });
            /*
                        this.eachSeries.each((d,i,array) => {
                            this.parent.seriesArray.push(array[i]);
                        });*/

            return container.node();
        },
        setScales: function setScales() {
            var _this6 = this;

            //SHOULD BE IN CHART PROTOTYPE // TO DO: SET SCALES FOR OTHER GROUP TYPES
            var d3Scale = {
                time: d3.scaleTime(),
                linear: d3.scaleLinear()
                // TO DO: add all scale types.
            };
            var xMaxes = [],
                xMins = [],
                yMaxes = [],
                yMins = [];
            if (this.scaleBy === 'series-group') {
                this.data.forEach(function (each) {
                    console.log(each, _this6.parent.parent.summaries[1]);
                    xMaxes.push(_this6.parent.parent.summaries[1][_this6.config.category][each.key][_this6.config.variableX].max);
                    xMins.push(_this6.parent.parent.summaries[1][_this6.config.category][each.key][_this6.config.variableX].min);
                    yMaxes.push(_this6.parent.parent.summaries[1][_this6.config.category][each.key][_this6.config.variableY].max);
                    yMins.push(_this6.parent.parent.summaries[1][_this6.config.category][each.key][_this6.config.variableY].min);
                });
            }
            this.xMax = d3.max(xMaxes);
            this.xMin = d3.min(xMins);
            this.yMax = d3.max(yMaxes);
            this.yMin = d3.min(yMins);
            this.xValuesUnique = [];

            var xRange = [0, this.width],
                yRange = [this.height, 0],
                xDomain,
                yDomain;
            if (this.xScaleType === 'time') {
                xDomain = [d3.timeParse(this.xTimeType)(this.xMin), d3.timeParse(this.xTimeType)(this.xMax)];
            } else {
                // TO DO: OTHER data types ?
                xDomain = [this.xMin, this.xMax];
            }
            if (this.yScaleType === 'time') {
                yDomain = [d3.timeParse(this.yTimeType)(this.yMin), d3.timeParse(this.yTimeType)(this.yMax)];
            } else {
                // TO DO: OTHER data types ?
                yDomain = [this.yMin, this.yMax];
            }

            this.xScale = d3Scale[this.xScaleType].domain(xDomain).range(xRange);
            this.yScale = d3Scale[this.yScaleType].domain(yDomain).range(yRange);
        },
        addLines: function addLines() {
            var _this7 = this;

            var valueline = d3.line().x(function (d) {
                if (_this7.xValuesUnique.indexOf(d[_this7.config.variableX]) === -1) {
                    _this7.xValuesUnique.push(d[_this7.config.variableX]);
                }
                return _this7.xScale(d3.timeParse(_this7.xTimeType)(d[_this7.config.variableX]));
            }).y(function (d) {
                return _this7.yScale(d[_this7.config.variableY]);
            }); // !! not programmatic

            this.lines = this.eachSeries.append('path').attr('class', 'line').attr('d', function (d) {
                return valueline(d.values);
            });
        },
        addXAxis: function addXAxis() {
            var _this8 = this;

            // could be in Chart prototype ?
            var yAxisPosition, yAxisOffset, axisType;

            if (this.config.yAxisPosition === 'zero') {
                yAxisPosition = 0;
                yAxisOffset = 0;
                axisType = d3.axisBottom;
            } else if (this.config.yAxisPosition === 'top') {
                yAxisPosition = this.yMax;
                yAxisOffset = -this.marginTop;
                axisType = d3.axisTop;
            } else {
                yAxisPosition = this.yMin;
                yAxisOffset = 0;
                axisType = d3.axisBottom;
            }
            var axis = axisType(this.xScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1);
            if (this.xScaleType === 'time') {
                axis.tickValues(this.xValuesUnique.map(function (each) {
                    return d3.timeParse(_this8.xTimeType)(each);
                })); // TO DO: allow for other xAxis Adjustments
            }
            this.svg.append('g').attr('transform', 'translate(0,' + (this.yScale(yAxisPosition) + yAxisOffset) + ')') // not programatic placement of x-axis
            .attr('class', 'axis x-axis').call(axis);
        },
        addYAxis: function addYAxis() {
            var _this9 = this;

            /* axis */
            this.svg.append('g').attr('class', function () {
                return 'axis y-axis ';
            }).call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5));

            /* labels */
            this.eachSeries.append('text').attr('class', 'units').attr('transform', function () {
                return 'translate(-' + _this9.marginLeft + ',-' + (_this9.marginTop - 10) + ')';
            }).text(function (d, i) {
                return i === 0 ? _this9.parent.units(d.key) : null;
            });
        },
        addLabels: function addLabels() {
            var _this10 = this;

            this.eachSeries.append('text').attr('class', 'series-label').html(function (d) {
                return '<tspan x="0">' + _this10.parent.label(d.key).replace(/\\n/g, '</tspan><tspan x="0" dy="1.2em">') + '</tspan>';
            }).attr('transform', function (d) {
                return 'translate(' + (_this10.width + 5) + ', ' + (_this10.yScale(d.values[d.values.length - 1][_this10.config.variableY]) + 3) + ')';
            });
        },
        addPoints: function addPoints() {
            var _this11 = this;

            this.points = this.eachSeries.selectAll('points').data(function (d) {
                return d.values;
            }).enter().append('circle').attr('class', 'data-point').attr('r', '4').attr('cx', function (d) {
                return _this11.xScale(d3.timeParse(_this11.xTimeType)(d[_this11.config.variableX]));
            }).attr('cy', function (d) {
                return _this11.yScale(d[_this11.config.variableY]);
            }).on('mouseover', function (d, i, array) {
                console.log(d);
                var klass = array[i].parentNode.classList.value.match(/color-\d/)[0]; // get the color class of the parent g
                _this11.tooltip.attr('class', _this11.tooltip.attr('class') + ' ' + klass);
                _this11.tooltip.html('<strong>' + _this11.parent.tipText(d.series) + '</strong> (' + d.year + ')<br />' + d[_this11.config.variableY] + ' ' + _this11.parent.units(d.series));
                _this11.tooltip.show();
            }).on('mouseout', function () {
                _this11.tooltip.attr('class', _this11.tooltip.attr('class').replace(/ color-\d/g, ''));
                _this11.tooltip.html('');
                _this11.tooltip.hide();
            }).call(this.tooltip);
        },
        setTooltips: function setTooltips() {

            this.tooltip = d3.tip().attr("class", "d3-tip").direction('n').offset([-8, 0]);
        }
    };

    return {
        ChartDiv: ChartDiv
    };
}();

},{}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var Helpers = exports.Helpers = function () {
    /* globals DOMStringMap */
    String.prototype.cleanString = function () {
        // lowercase and remove punctuation and replace spaces with hyphens; delete punctuation
        return this.replace(/[ \\\/]/g, '-').replace(/['"”’“‘,\.!\?;\(\)&]/g, '').toLowerCase();
    };

    String.prototype.removeUnderscores = function () {
        return this.replace(/_/g, ' ');
    };

    DOMStringMap.prototype.convert = function () {
        var newObj = {};
        for (var key in this) {
            if (this.hasOwnProperty(key)) {
                try {
                    newObj[key] = JSON.parse(this[key]);
                } catch (err) {
                    newObj[key] = this[key];
                }
            }
        }
        return newObj;
    };
}();

},{}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
// d3.tip
// Copyright (c) 2013 Justin Palmer
// ES6 / D3 v4 Adaption Copyright (c) 2016 Constantin Gavrilete
// Removal of ES6 for D3 v4 Adaption Copyright (c) 2016 David Gotz
//
// Tooltips for d3.js SVG visualizations

var d3Tip = exports.d3Tip = function () {
  d3.functor = function functor(v) {
    return typeof v === "function" ? v : function () {
      return v;
    };
  };

  d3.tip = function () {

    var direction = d3_tip_direction,
        offset = d3_tip_offset,
        html = d3_tip_html,
        node = initNode(),
        svg = null,
        point = null,
        target = null;

    function tip(vis) {
      svg = getSVGNode(vis);
      point = svg.createSVGPoint();
      document.body.appendChild(node);
    }

    // Public - show the tooltip on the screen
    //
    // Returns a tip
    tip.show = function () {
      var args = Array.prototype.slice.call(arguments);
      if (args[args.length - 1] instanceof SVGElement) target = args.pop();

      var content = html.apply(this, args),
          poffset = offset.apply(this, args),
          dir = direction.apply(this, args),
          nodel = getNodeEl(),
          i = directions.length,
          coords,
          scrollTop = document.documentElement.scrollTop || document.body.scrollTop,
          scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;

      nodel.html(content).style('position', 'absolute').style('opacity', 1).style('pointer-events', 'all');

      while (i--) {
        nodel.classed(directions[i], false);
      }coords = direction_callbacks[dir].apply(this);
      nodel.classed(dir, true).style('top', coords.top + poffset[0] + scrollTop + 'px').style('left', coords.left + poffset[1] + scrollLeft + 'px');

      return tip;
    };

    // Public - hide the tooltip
    //
    // Returns a tip
    tip.hide = function () {
      var nodel = getNodeEl();
      nodel.style('opacity', 0).style('pointer-events', 'none');
      return tip;
    };

    // Public: Proxy attr calls to the d3 tip container.  Sets or gets attribute value.
    //
    // n - name of the attribute
    // v - value of the attribute
    //
    // Returns tip or attribute value
    tip.attr = function (n, v) {
      if (arguments.length < 2 && typeof n === 'string') {
        return getNodeEl().attr(n);
      } else {
        var args = Array.prototype.slice.call(arguments);
        d3.selection.prototype.attr.apply(getNodeEl(), args);
      }

      return tip;
    };

    // Public: Proxy style calls to the d3 tip container.  Sets or gets a style value.
    //
    // n - name of the property
    // v - value of the property
    //
    // Returns tip or style property value
    tip.style = function (n, v) {
      // debugger;
      if (arguments.length < 2 && typeof n === 'string') {
        return getNodeEl().style(n);
      } else {
        var args = Array.prototype.slice.call(arguments);
        if (args.length === 1) {
          var styles = args[0];
          Object.keys(styles).forEach(function (key) {
            return d3.selection.prototype.style.apply(getNodeEl(), [key, styles[key]]);
          });
        }
      }

      return tip;
    };

    // Public: Set or get the direction of the tooltip
    //
    // v - One of n(north), s(south), e(east), or w(west), nw(northwest),
    //     sw(southwest), ne(northeast) or se(southeast)
    //
    // Returns tip or direction
    tip.direction = function (v) {
      if (!arguments.length) return direction;
      direction = v == null ? v : d3.functor(v);

      return tip;
    };

    // Public: Sets or gets the offset of the tip
    //
    // v - Array of [x, y] offset
    //
    // Returns offset or
    tip.offset = function (v) {
      if (!arguments.length) return offset;
      offset = v == null ? v : d3.functor(v);

      return tip;
    };

    // Public: sets or gets the html value of the tooltip
    //
    // v - String value of the tip
    //
    // Returns html value or tip
    tip.html = function (v) {
      if (!arguments.length) return html;
      html = v == null ? v : d3.functor(v);

      return tip;
    };

    // Public: destroys the tooltip and removes it from the DOM
    //
    // Returns a tip
    tip.destroy = function () {
      if (node) {
        getNodeEl().remove();
        node = null;
      }
      return tip;
    };

    function d3_tip_direction() {
      return 'n';
    }
    function d3_tip_offset() {
      return [0, 0];
    }
    function d3_tip_html() {
      return ' ';
    }

    var direction_callbacks = {
      n: direction_n,
      s: direction_s,
      e: direction_e,
      w: direction_w,
      nw: direction_nw,
      ne: direction_ne,
      sw: direction_sw,
      se: direction_se
    };

    var directions = Object.keys(direction_callbacks);

    function direction_n() {
      var bbox = getScreenBBox();
      return {
        top: bbox.n.y - node.offsetHeight,
        left: bbox.n.x - node.offsetWidth / 2
      };
    }

    function direction_s() {
      var bbox = getScreenBBox();
      return {
        top: bbox.s.y,
        left: bbox.s.x - node.offsetWidth / 2
      };
    }

    function direction_e() {
      var bbox = getScreenBBox();
      return {
        top: bbox.e.y - node.offsetHeight / 2,
        left: bbox.e.x
      };
    }

    function direction_w() {
      var bbox = getScreenBBox();
      return {
        top: bbox.w.y - node.offsetHeight / 2,
        left: bbox.w.x - node.offsetWidth
      };
    }

    function direction_nw() {
      var bbox = getScreenBBox();
      return {
        top: bbox.nw.y - node.offsetHeight,
        left: bbox.nw.x - node.offsetWidth
      };
    }

    function direction_ne() {
      var bbox = getScreenBBox();
      return {
        top: bbox.ne.y - node.offsetHeight,
        left: bbox.ne.x
      };
    }

    function direction_sw() {
      var bbox = getScreenBBox();
      return {
        top: bbox.sw.y,
        left: bbox.sw.x - node.offsetWidth
      };
    }

    function direction_se() {
      var bbox = getScreenBBox();
      return {
        top: bbox.se.y,
        left: bbox.e.x
      };
    }

    function initNode() {
      var node = d3.select(document.createElement('div'));
      node.style('position', 'absolute').style('top', 0).style('opacity', 0).style('pointer-events', 'none').style('box-sizing', 'border-box');

      return node.node();
    }

    function getSVGNode(el) {
      el = el.node();
      if (el.tagName.toLowerCase() === 'svg') return el;

      return el.ownerSVGElement;
    }

    function getNodeEl() {
      if (node === null) {
        node = initNode();
        // re-add node to DOM
        document.body.appendChild(node);
      };
      return d3.select(node);
    }

    // Private - gets the screen coordinates of a shape
    //
    // Given a shape on the screen, will return an SVGPoint for the directions
    // n(north), s(south), e(east), w(west), ne(northeast), se(southeast), nw(northwest),
    // sw(southwest).
    //
    //    +-+-+
    //    |   |
    //    +   +
    //    |   |
    //    +-+-+
    //
    // Returns an Object {n, s, e, w, nw, sw, ne, se}
    function getScreenBBox() {
      var targetel = target || d3.event.target;

      while ('undefined' === typeof targetel.getScreenCTM && 'undefined' === targetel.parentNode) {
        targetel = targetel.parentNode;
      }

      var bbox = {},
          matrix = targetel.getScreenCTM(),
          tbbox = targetel.getBBox(),
          width = tbbox.width,
          height = tbbox.height,
          x = tbbox.x,
          y = tbbox.y;

      point.x = x;
      point.y = y;
      bbox.nw = point.matrixTransform(matrix);
      point.x += width;
      bbox.ne = point.matrixTransform(matrix);
      point.y += height;
      bbox.se = point.matrixTransform(matrix);
      point.x -= width;
      bbox.sw = point.matrixTransform(matrix);
      point.y -= height / 2;
      bbox.w = point.matrixTransform(matrix);
      point.x += width;
      bbox.e = point.matrixTransform(matrix);
      point.x -= width / 2;
      point.y -= height / 2;
      bbox.n = point.matrixTransform(matrix);
      point.y += height;
      bbox.s = point.matrixTransform(matrix);

      return bbox;
    }

    return tip;
  };
}();

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9DaGFydHMuanMiLCJqcy1leHBvcnRzL0hlbHBlcnMuanMiLCJqcy12ZW5kb3IvZDMtdGlwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNJQTs7QUFDQTs7QUFDQTs7QUFFQSxJQUFJLFdBQVksWUFBVTs7QUFFMUI7O0FBRUksUUFBSSxrQkFBa0IsRUFBdEI7QUFDQSxRQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEwQjtBQUFBOztBQUN6QyxnQkFBUSxHQUFSLENBQVksS0FBWjtBQUNBLGFBQUssU0FBTCxHQUFpQixTQUFqQjtBQUNBLGFBQUssS0FBTCxHQUFhLEtBQWI7QUFDQSxhQUFLLE1BQUwsR0FBYyxVQUFVLE9BQVYsQ0FBa0IsT0FBbEIsRUFBZDtBQUNBLGdCQUFRLEdBQVIsQ0FBWSxLQUFLLE1BQUwsQ0FBWSxNQUFaLENBQW1CLFFBQW5CLEVBQVo7QUFDQSxhQUFLLFlBQUwsR0FBb0IsS0FBSyxrQkFBTCxDQUF3QixTQUF4QixDQUFwQjtBQUNBLGFBQUssUUFBTCxHQUFnQixFQUFoQjtBQUNBLGdCQUFRLEdBQVIsQ0FBWSxLQUFLLFlBQWpCO0FBQ0E7QUFDQSxhQUFLLFlBQUwsQ0FBa0IsSUFBbEIsQ0FBdUIsWUFBTTtBQUN6QixrQkFBSyxnQkFBTCxDQUFzQixTQUF0QjtBQUNILFNBRkQ7QUFHSCxLQWJEO0FBY0E7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBRWpCLDBCQUZpQixnQ0FFRztBQUFBOztBQUNoQixnQkFBSSxlQUFlLEVBQW5CO0FBQ0EsZ0JBQUksVUFBVSxLQUFLLE1BQUwsQ0FBWSxPQUExQjtBQUFBLGdCQUNJLE9BQU8sQ0FBQyxLQUFLLE1BQUwsQ0FBWSxPQUFiLEVBQXFCLEtBQUssTUFBTCxDQUFZLGFBQWpDLENBRFgsQ0FGZ0IsQ0FHNEM7QUFDeEI7QUFDcEMsaUJBQUssT0FBTCxDQUFhLFVBQUMsSUFBRCxFQUFPLENBQVAsRUFBYTtBQUN0QixvQkFBSSxVQUFVLElBQUksT0FBSixDQUFZLFVBQUMsT0FBRCxFQUFTLE1BQVQsRUFBb0I7QUFDMUMsdUJBQUcsSUFBSCxDQUFRLG1EQUFtRCxPQUFuRCxHQUE2RCxVQUE3RCxHQUEwRSxJQUExRSxHQUFpRiw4Q0FBekYsRUFBeUksVUFBQyxLQUFELEVBQU8sSUFBUCxFQUFnQjtBQUNySiw0QkFBSSxLQUFKLEVBQVc7QUFDUCxtQ0FBTyxLQUFQO0FBQ0Esa0NBQU0sS0FBTjtBQUNIO0FBQ0QsNEJBQUksU0FBUyxLQUFLLE1BQWxCO0FBQ0EsNEJBQUksV0FBVyxTQUFTLFlBQVQsR0FBd0IsUUFBeEIsR0FBbUMsUUFBbEQsQ0FOcUosQ0FNekY7QUFDNUQsNEJBQUksU0FBUyxTQUFTLFlBQVQsR0FBd0IsS0FBeEIsR0FBZ0MsT0FBSyxNQUFMLENBQVksTUFBekQ7QUFDQSxnQ0FBUSxPQUFLLGVBQUwsQ0FBcUIsTUFBckIsRUFBNkIsTUFBN0IsRUFBcUMsSUFBckMsRUFBMkMsUUFBM0MsRUFBcUQsQ0FBckQsQ0FBUjtBQUNILHFCQVREO0FBVUgsaUJBWGEsQ0FBZDtBQVlBLDZCQUFhLElBQWIsQ0FBa0IsT0FBbEI7QUFDSCxhQWREO0FBZUEsb0JBQVEsR0FBUixDQUFZLFlBQVosRUFBMEIsSUFBMUIsQ0FBK0Isa0JBQVU7QUFDckMsdUJBQUssSUFBTCxHQUFZLE9BQU8sQ0FBUCxDQUFaO0FBQ0EsdUJBQUssVUFBTCxHQUFrQixPQUFPLENBQVAsQ0FBbEI7QUFDQSx1QkFBSyxTQUFMLEdBQWlCLE9BQUssYUFBTCxFQUFqQjtBQUNILGFBSkQ7QUFLQSxtQkFBTyxRQUFRLEdBQVIsQ0FBWSxZQUFaLENBQVA7QUFDSCxTQTVCZ0I7QUE2QmpCLHFCQTdCaUIsMkJBNkJGO0FBQUU7QUFDQTtBQUNBO0FBQ0E7O0FBRWIsZ0JBQUksWUFBWSxFQUFoQjtBQUNBLGdCQUFJLFlBQVksT0FBTyxJQUFQLENBQVksS0FBSyxRQUFMLENBQWMsQ0FBZCxDQUFaLENBQWhCLENBTlcsQ0FNb0M7QUFDL0MsZ0JBQUksU0FBUyxLQUFLLE1BQUwsQ0FBWSxNQUFaLEdBQXFCLEtBQUssTUFBTCxDQUFZLE1BQVosQ0FBbUIsR0FBbkIsQ0FBdUI7QUFBQSx1QkFBUSxJQUFSO0FBQUEsYUFBdkIsQ0FBckIsR0FBNEQsS0FBekU7QUFDZ0Q7QUFDQTtBQUNBO0FBQ2hELGdCQUFJLGNBQWMsTUFBTSxPQUFOLENBQWMsTUFBZCxJQUF3QixNQUF4QixHQUFpQyxDQUFDLE1BQUQsQ0FBbkQ7QUFDQSxxQkFBUyxlQUFULENBQXlCLENBQXpCLEVBQTJCO0FBQ3ZCLHVCQUFPLFVBQVUsTUFBVixDQUFpQixVQUFTLEdBQVQsRUFBYyxHQUFkLEVBQWtCO0FBQ3RDLHdCQUFJLEdBQUosSUFBVztBQUNQLDZCQUFXLEdBQUcsR0FBSCxDQUFPLENBQVAsRUFBVTtBQUFBLG1DQUFLLEVBQUUsR0FBRixDQUFMO0FBQUEseUJBQVYsQ0FESjtBQUVQLDZCQUFXLEdBQUcsR0FBSCxDQUFPLENBQVAsRUFBVTtBQUFBLG1DQUFLLEVBQUUsR0FBRixDQUFMO0FBQUEseUJBQVYsQ0FGSjtBQUdQLDhCQUFXLEdBQUcsSUFBSCxDQUFRLENBQVIsRUFBVztBQUFBLG1DQUFLLEVBQUUsR0FBRixDQUFMO0FBQUEseUJBQVgsQ0FISjtBQUlQLDZCQUFXLEdBQUcsR0FBSCxDQUFPLENBQVAsRUFBVTtBQUFBLG1DQUFLLEVBQUUsR0FBRixDQUFMO0FBQUEseUJBQVYsQ0FKSjtBQUtQLGdDQUFXLEdBQUcsTUFBSCxDQUFVLENBQVYsRUFBYTtBQUFBLG1DQUFLLEVBQUUsR0FBRixDQUFMO0FBQUEseUJBQWIsQ0FMSjtBQU1QLGtDQUFXLEdBQUcsUUFBSCxDQUFZLENBQVosRUFBZTtBQUFBLG1DQUFLLEVBQUUsR0FBRixDQUFMO0FBQUEseUJBQWYsQ0FOSjtBQU9QLG1DQUFXLEdBQUcsU0FBSCxDQUFhLENBQWIsRUFBZ0I7QUFBQSxtQ0FBSyxFQUFFLEdBQUYsQ0FBTDtBQUFBLHlCQUFoQjtBQVBKLHFCQUFYO0FBU0EsMkJBQU8sR0FBUDtBQUNILGlCQVhNLEVBV0wsRUFYSyxDQUFQO0FBWUg7QUFDRCxtQkFBUSxZQUFZLE1BQVosR0FBcUIsQ0FBN0IsRUFBZ0M7QUFDNUIsb0JBQUksYUFBYSxLQUFLLFVBQUwsQ0FBZ0IsV0FBaEIsRUFDWixNQURZLENBQ0wsZUFESyxFQUVaLE1BRlksQ0FFTCxLQUFLLFFBRkEsQ0FBakI7QUFHQSwwQkFBVSxPQUFWLENBQWtCLFVBQWxCO0FBQ0EsNEJBQVksR0FBWjtBQUNIO0FBQ0QsbUJBQU8sU0FBUDtBQUNILFNBL0RnQjtBQWdFakIsa0JBaEVpQixzQkFnRU4sV0FoRU0sRUFnRU07QUFDbkI7QUFDQSxtQkFBTyxZQUFZLE1BQVosQ0FBbUIsVUFBUyxHQUFULEVBQWMsR0FBZCxFQUFrQjtBQUN4QyxvQkFBSSxPQUFPLEdBQVAsS0FBZSxRQUFmLElBQTJCLE9BQU8sR0FBUCxLQUFlLFVBQTlDLEVBQTJEO0FBQUUsMEJBQU0sK0NBQU47QUFBd0Q7QUFDckgsb0JBQUksR0FBSjtBQUNBLG9CQUFLLE9BQU8sR0FBUCxLQUFlLFFBQXBCLEVBQThCO0FBQzFCLDBCQUFNLElBQUksR0FBSixDQUFRLFVBQVMsQ0FBVCxFQUFXO0FBQ3JCLCtCQUFPLEVBQUUsR0FBRixDQUFQO0FBQ0gscUJBRkssQ0FBTjtBQUdIO0FBQ0Qsb0JBQUssT0FBTyxHQUFQLEtBQWUsVUFBcEIsRUFBZ0M7QUFDNUIsMEJBQU0sSUFBSSxHQUFKLENBQVEsVUFBUyxDQUFULEVBQVc7QUFDckIsK0JBQU8sSUFBSSxDQUFKLENBQVA7QUFDSCxxQkFGSyxDQUFOO0FBR0g7QUFDRCx1QkFBTyxHQUFQO0FBQ0gsYUFkTSxFQWNKLEdBQUcsSUFBSCxFQWRJLENBQVA7QUFlSCxTQWpGZ0I7QUFrRmpCLHVCQWxGaUIsMkJBa0ZELE1BbEZDLEVBa0ZPLE1BbEZQLEVBa0ZpRTtBQUFBLGdCQUFsRCxNQUFrRCx1RUFBekMsS0FBeUM7QUFBQSxnQkFBbEMsUUFBa0MsdUVBQXZCLFFBQXVCO0FBQUEsZ0JBQWIsUUFBYSx1RUFBRixDQUFFOztBQUNsRjtBQUNBO0FBQ0E7QUFDQTs7QUFFSSxnQkFBSSxNQUFKOztBQUVBLGdCQUFJLFdBQVcsT0FBTyxLQUFQLENBQWEsQ0FBYixFQUFnQixHQUFoQixDQUFvQjtBQUFBLHVCQUFPLElBQUksTUFBSixDQUFXLFVBQVMsR0FBVCxFQUFjLEdBQWQsRUFBbUIsQ0FBbkIsRUFBc0I7QUFDM0U7QUFDQTtBQUNFLHdCQUFJLE9BQU8sQ0FBUCxFQUFVLENBQVYsQ0FBSixJQUFvQixXQUFXLElBQVgsR0FBa0IsTUFBTSxDQUFDLEdBQVAsS0FBZSxRQUFRLEVBQXZCLEdBQTRCLEdBQTVCLEdBQWtDLENBQUMsR0FBckQsR0FBMkQsR0FBL0U7QUFDRSwyQkFBTyxHQUFQLENBSnVFLENBSXBCO0FBQ3RELGlCQUx5QyxFQUt2QyxFQUx1QyxDQUFQO0FBQUEsYUFBcEIsQ0FBZjtBQU1BLGdCQUFLLGFBQWEsQ0FBbEIsRUFBc0I7QUFDbEIscUJBQUssUUFBTCxHQUFnQixRQUFoQjtBQUNIO0FBQ0QsZ0JBQUssQ0FBQyxNQUFOLEVBQWM7QUFDVix1QkFBTyxRQUFQO0FBQ0gsYUFGRCxNQUVPO0FBQ0gsb0JBQUssT0FBTyxNQUFQLEtBQWtCLFFBQWxCLElBQThCLE9BQU8sTUFBUCxLQUFrQixVQUFyRCxFQUFrRTtBQUFFO0FBQ2hFLDZCQUFTLEtBQUssVUFBTCxDQUFnQixDQUFDLE1BQUQsQ0FBaEIsQ0FBVDtBQUNILGlCQUZELE1BRU87QUFDSCx3QkFBSSxDQUFDLE1BQU0sT0FBTixDQUFjLE1BQWQsQ0FBTCxFQUE0QjtBQUFFLDhCQUFNLDhFQUFOO0FBQXVGO0FBQ3JILDZCQUFTLEtBQUssVUFBTCxDQUFnQixNQUFoQixDQUFUO0FBQ0g7QUFDSjtBQUNELGdCQUFLLGFBQWEsUUFBbEIsRUFBNEI7QUFDeEIsdUJBQU8sT0FDRixNQURFLENBQ0ssUUFETCxDQUFQO0FBRUgsYUFIRCxNQUdPO0FBQ0gsdUJBQU8sT0FDRixPQURFLENBQ00sUUFETixDQUFQO0FBRUg7QUFDSixTQXBIZ0I7QUFxSGpCLHdCQXJIaUIsNEJBcUhBLFNBckhBLEVBcUhVO0FBQ3ZCLGdCQUFJLFFBQVEsSUFBWjtBQUNBLGVBQUcsTUFBSCxDQUFVLFNBQVYsRUFBcUIsU0FBckIsQ0FBK0IsV0FBL0IsRUFDSyxJQURMLENBQ1UsWUFBVTtBQUNaLHNCQUFNLFFBQU4sQ0FBZSxJQUFmLENBQW9CLElBQUksZUFBTyxRQUFYLENBQW9CLElBQXBCLEVBQTBCLEtBQTFCLENBQXBCO0FBQ0gsYUFITDtBQUlIO0FBM0hnQixLQUF6QixDQXBCc0IsQ0FnSm5COztBQUVILFdBQU8sUUFBUCxHQUFrQjtBQUFFO0FBQ0E7QUFDaEIsWUFGYyxrQkFFUjtBQUNGLGdCQUFJLFlBQVksU0FBUyxnQkFBVCxDQUEwQixXQUExQixDQUFoQjtBQUNBLGlCQUFNLElBQUksSUFBSSxDQUFkLEVBQWlCLElBQUksVUFBVSxNQUEvQixFQUF1QyxHQUF2QyxFQUE0QztBQUN4QyxnQ0FBZ0IsSUFBaEIsQ0FBcUIsSUFBSSxZQUFKLENBQWlCLFVBQVUsQ0FBVixDQUFqQixFQUErQixDQUEvQixDQUFyQjtBQUNIO0FBQ0Qsb0JBQVEsR0FBUixDQUFZLGVBQVo7QUFDSDtBQVJhLEtBQWxCO0FBVUgsQ0E1SmUsRUFBaEIsQyxDQTRKTTtBQXBLTCx1QyxDQUF3QztBQUN4Qzs7Ozs7Ozs7O0FDRE0sSUFBTSwwQkFBVSxZQUFVOztBQUU3QixRQUFJLFdBQVcsU0FBWCxRQUFXLENBQVMsU0FBVCxFQUFvQixNQUFwQixFQUEyQjtBQUFBOztBQUN0QyxhQUFLLFNBQUwsR0FBaUIsU0FBakI7QUFDQSxhQUFLLE1BQUwsR0FBYyxNQUFkO0FBQ0EsYUFBSyxRQUFMLEdBQWdCLEVBQWhCO0FBQ0EsYUFBSyxXQUFMLEdBQW1CLENBQW5CO0FBQ0EsYUFBSyxNQUFMLEdBQWMsT0FBTyxNQUFQLENBQWUsT0FBTyxNQUF0QixFQUE4QixPQUFPLHlCQUFQLENBQWtDLFVBQVUsT0FBVixDQUFrQixPQUFsQixFQUFsQyxDQUE5QixDQUFkO0FBQ0k7QUFDQTtBQUNBO0FBQ0osYUFBSyxLQUFMLEdBQWEsT0FBTyxJQUFQLENBQVksSUFBWixDQUFpQjtBQUFBLG1CQUFRLEtBQUssR0FBTCxLQUFhLE1BQUssTUFBTCxDQUFZLFFBQWpDO0FBQUEsU0FBakIsQ0FBYjtBQUNBLFlBQUksaUJBQWlCLEtBQUssTUFBTCxDQUFZLE1BQVosSUFBc0IsS0FBM0M7QUFDQSxnQkFBUSxHQUFSLENBQVksY0FBWjtBQUNBLFlBQUssTUFBTSxPQUFOLENBQWMsY0FBZCxDQUFMLEVBQW9DO0FBQ2hDLG9CQUFRLEdBQVIsQ0FBWSxVQUFaLEVBQXdCLEtBQUssS0FBTCxDQUFXLE1BQW5DO0FBQ0EsaUJBQUssS0FBTCxDQUFXLE1BQVgsR0FBb0IsS0FBSyxLQUFMLENBQVcsTUFBWCxDQUFrQixNQUFsQixDQUF5QixnQkFBUTtBQUNqRCx3QkFBUSxHQUFSLENBQVksS0FBSyxHQUFqQjtBQUNBLHVCQUFPLGVBQWUsT0FBZixDQUF1QixLQUFLLEdBQTVCLE1BQXFDLENBQUMsQ0FBN0M7QUFDSCxhQUhtQixDQUFwQjtBQUlILFNBTkQsTUFNTyxJQUFLLG1CQUFtQixLQUF4QixFQUErQjtBQUNsQyxvQkFBUSxHQUFSO0FBRUg7QUFDRCxhQUFLLFlBQUwsR0FBb0IsS0FBSyxXQUFMLEVBQXBCO0FBQ0EsYUFBSyxVQUFMLEdBQWtCLEtBQUssTUFBTCxDQUFZLFVBQTlCO0FBQ0EsWUFBSyxLQUFLLE1BQUwsQ0FBWSxPQUFaLEtBQXdCLEtBQTdCLEVBQW9DO0FBQ2hDLGlCQUFLLFVBQUwsQ0FBZ0IsS0FBSyxNQUFMLENBQVksT0FBNUI7QUFDSDtBQUNELGFBQUssWUFBTDtBQUVILEtBN0JEOztBQStCQSxhQUFTLFNBQVQsR0FBcUI7QUFDakIsb0JBQVk7QUFDUixrQkFBUSxXQURBO0FBRVIsb0JBQVEsYUFGQTtBQUdSLGlCQUFRLFVBSEEsQ0FHVztBQUhYLFNBREs7QUFNakIsb0JBTmlCLDBCQU1IO0FBQUE7O0FBQ1YsaUJBQUssWUFBTCxDQUFrQixPQUFsQixDQUEwQixVQUFDLElBQUQsRUFBVTtBQUNoQyx1QkFBSyxRQUFMLENBQWMsSUFBZCxDQUFtQixJQUFJLFNBQUosU0FBb0IsSUFBcEIsQ0FBbkIsRUFEZ0MsQ0FDZTtBQUNsRCxhQUZEO0FBR0gsU0FWZ0I7QUFXakIsbUJBWGlCLHlCQVdKO0FBQUE7O0FBQ1QsZ0JBQUksWUFBSjtBQUFBLGdCQUNJLGlCQUFpQixLQUFLLE1BQUwsQ0FBWSxXQUFaLElBQTJCLE1BRGhEO0FBRUEsZ0JBQUssTUFBTSxPQUFOLENBQWUsY0FBZixDQUFMLEVBQXVDO0FBQ25DLCtCQUFlLEVBQWY7QUFDQSxxQkFBSyxNQUFMLENBQVksV0FBWixDQUF3QixPQUF4QixDQUFnQyxpQkFBUztBQUNyQyxpQ0FBYSxJQUFiLENBQWtCLE9BQUssS0FBTCxDQUFXLE1BQVgsQ0FBa0IsTUFBbEIsQ0FBeUI7QUFBQSwrQkFBVSxNQUFNLE9BQU4sQ0FBYyxPQUFPLEdBQXJCLE1BQThCLENBQUMsQ0FBekM7QUFBQSxxQkFBekIsQ0FBbEI7QUFDSCxpQkFGRDtBQUdILGFBTEQsTUFLTyxJQUFLLG1CQUFtQixNQUF4QixFQUFpQztBQUNwQywrQkFBZSxLQUFLLEtBQUwsQ0FBVyxNQUFYLENBQWtCLEdBQWxCLENBQXNCO0FBQUEsMkJBQVEsQ0FBQyxJQUFELENBQVI7QUFBQSxpQkFBdEIsQ0FBZjtBQUNILGFBRk0sTUFFQSxJQUFLLG1CQUFtQixLQUF4QixFQUFnQztBQUNuQywrQkFBZSxDQUFDLEtBQUssS0FBTCxDQUFXLE1BQVgsQ0FBa0IsR0FBbEIsQ0FBc0I7QUFBQSwyQkFBUSxJQUFSO0FBQUEsaUJBQXRCLENBQUQsQ0FBZjtBQUNILGFBRk0sTUFFQTtBQUNILHdCQUFRLEdBQVI7QUFJSDtBQUNELG1CQUFPLFlBQVA7QUFDSCxTQTlCZ0I7QUE4QmQ7QUFDSCxrQkEvQmlCLHNCQStCTixLQS9CTSxFQStCQTtBQUFBOztBQUNiLG9CQUFRLEdBQVIsQ0FBWSxLQUFaO0FBQ0EsZUFBRyxNQUFILENBQVUsS0FBSyxTQUFmLEVBQ0ssTUFETCxDQUNZLEdBRFosRUFFSyxJQUZMLENBRVUsWUFBTTtBQUNSLG9CQUFJLFVBQVUsT0FBTyxLQUFQLEtBQWlCLFFBQWpCLEdBQTRCLEtBQTVCLEdBQW9DLE9BQUssS0FBTCxDQUFXLE9BQUssTUFBTCxDQUFZLFFBQXZCLENBQWxEO0FBQ0EsdUJBQU8sYUFBYSxPQUFiLEdBQXVCLFdBQTlCO0FBQ0gsYUFMTDtBQU1ILFNBdkNnQjtBQXdDakIsYUF4Q2lCLGlCQXdDWCxHQXhDVyxFQXdDUDtBQUNOLG1CQUFPLEtBQUssVUFBTCxDQUFnQixJQUFoQixDQUFxQjtBQUFBLHVCQUFRLEtBQUssR0FBTCxLQUFhLEdBQXJCO0FBQUEsYUFBckIsRUFBK0MsS0FBdEQ7QUFDSCxTQTFDZ0I7QUEyQ2pCLGFBM0NpQixpQkEyQ1gsR0EzQ1csRUEyQ1A7QUFDTixtQkFBTyxLQUFLLFVBQUwsQ0FBZ0IsSUFBaEIsQ0FBcUI7QUFBQSx1QkFBUSxLQUFLLEdBQUwsS0FBYSxHQUFyQjtBQUFBLGFBQXJCLEVBQStDLEtBQXREO0FBQ0gsU0E3Q2dCO0FBOENqQixlQTlDaUIsbUJBOENULEdBOUNTLEVBOENMO0FBQ1IsZ0JBQUksTUFBTSxLQUFLLFVBQUwsQ0FBZ0IsSUFBaEIsQ0FBcUI7QUFBQSx1QkFBUSxLQUFLLEdBQUwsS0FBYSxHQUFyQjtBQUFBLGFBQXJCLEVBQStDLEtBQS9DLENBQXFELE9BQXJELENBQTZELE1BQTdELEVBQW9FLEdBQXBFLENBQVY7QUFDQSxtQkFBTyxJQUFJLE1BQUosQ0FBVyxDQUFYLEVBQWMsV0FBZCxLQUE4QixJQUFJLEtBQUosQ0FBVSxDQUFWLENBQXJDO0FBQ0g7QUFqRGdCLEtBQXJCLENBakM2QixDQW9GMUI7O0FBRUgsUUFBSSxZQUFZLFNBQVosU0FBWSxDQUFTLE1BQVQsRUFBaUIsV0FBakIsRUFBNkI7QUFDekMsYUFBSyxNQUFMLEdBQWMsTUFBZDtBQUNBLGFBQUssTUFBTCxHQUFjLE9BQU8sTUFBckI7QUFDQSxhQUFLLFNBQUwsR0FBaUIsQ0FBQyxLQUFLLE1BQUwsQ0FBWSxTQUFiLElBQTBCLEtBQUssY0FBTCxDQUFvQixHQUEvRDtBQUNBLGFBQUssV0FBTCxHQUFtQixDQUFDLEtBQUssTUFBTCxDQUFZLFdBQWIsSUFBNEIsS0FBSyxjQUFMLENBQW9CLEtBQW5FO0FBQ0EsYUFBSyxZQUFMLEdBQW9CLENBQUMsS0FBSyxNQUFMLENBQVksWUFBYixJQUE2QixLQUFLLGNBQUwsQ0FBb0IsTUFBckU7QUFDQSxhQUFLLFVBQUwsR0FBa0IsQ0FBQyxLQUFLLE1BQUwsQ0FBWSxVQUFiLElBQTJCLEtBQUssY0FBTCxDQUFvQixJQUFqRTtBQUNBLGFBQUssS0FBTCxHQUFhLEtBQUssTUFBTCxDQUFZLFFBQVosR0FBdUIsQ0FBQyxLQUFLLE1BQUwsQ0FBWSxRQUFiLEdBQXdCLEtBQUssV0FBN0IsR0FBMkMsS0FBSyxVQUF2RSxHQUFvRixNQUFNLEtBQUssV0FBWCxHQUF5QixLQUFLLFVBQS9IO0FBQ0EsYUFBSyxNQUFMLEdBQWMsS0FBSyxNQUFMLENBQVksU0FBWixHQUF3QixDQUFDLEtBQUssTUFBTCxDQUFZLFNBQWIsR0FBeUIsS0FBSyxTQUE5QixHQUEwQyxLQUFLLFlBQXZFLEdBQXNGLENBQUUsS0FBSyxLQUFMLEdBQWEsS0FBSyxXQUFsQixHQUFnQyxLQUFLLFVBQXZDLElBQXNELENBQXRELEdBQTBELEtBQUssU0FBL0QsR0FBMkUsS0FBSyxZQUFwTDtBQUNBLGFBQUssSUFBTCxHQUFZLFdBQVo7QUFDQSxnQkFBUSxHQUFSLENBQVksSUFBWjtBQUNBLGFBQUssU0FBTCxHQUFpQixLQUFLLElBQUwsQ0FBVSxPQUFPLFNBQWpCLENBQWpCO0FBQ0EsYUFBSyxVQUFMLEdBQWtCLEtBQUssTUFBTCxDQUFZLFVBQVosSUFBMEIsTUFBNUM7QUFDQSxhQUFLLFVBQUwsR0FBa0IsS0FBSyxNQUFMLENBQVksVUFBWixJQUEwQixRQUE1QztBQUNBLGFBQUssU0FBTCxHQUFpQixLQUFLLE1BQUwsQ0FBWSxTQUFaLElBQXlCLElBQTFDO0FBQ0EsYUFBSyxPQUFMLEdBQWUsS0FBSyxNQUFMLENBQVksT0FBWixJQUF1QixjQUF0QztBQUNBLGFBQUssU0FBTCxHQWhCeUMsQ0FnQnZCO0FBQ2xCLGFBQUssV0FBTDtBQUNBLGFBQUssUUFBTDtBQUNBLGFBQUssU0FBTDtBQUNBLGFBQUssUUFBTDtBQUNBLGFBQUssUUFBTDtBQUNBLFlBQUssS0FBSyxNQUFMLENBQVksV0FBWixLQUE0QixJQUFqQyxFQUF1QztBQUNuQyxpQkFBSyxTQUFMO0FBQ0gsU0FGRCxNQUVPO0FBQ0g7QUFDSDtBQUVKLEtBNUJEOztBQThCQSxjQUFVLFNBQVYsR0FBc0IsRUFBRTtBQUNwQix3QkFBZ0I7QUFDWixpQkFBSSxFQURRO0FBRVosbUJBQU0sRUFGTTtBQUdaLG9CQUFPLEVBSEs7QUFJWixrQkFBSztBQUpPLFNBREU7O0FBUWxCLFlBUmtCLGdCQVFiLFFBUmEsRUFRSjtBQUFBOztBQUFFO0FBQ1osZ0JBQUksWUFBYSxHQUFHLE1BQUgsQ0FBVSxRQUFWLEVBQ1osTUFEWSxDQUNMLEtBREssRUFFWixJQUZZLENBRVAsT0FGTyxFQUVFLEtBQUssS0FBTCxHQUFhLEtBQUssV0FBbEIsR0FBZ0MsS0FBSyxVQUZ2QyxFQUdaLElBSFksQ0FHUCxRQUhPLEVBR0csS0FBSyxNQUFMLEdBQWUsS0FBSyxTQUFwQixHQUFnQyxLQUFLLFlBSHhDLENBQWpCOztBQUtBLGlCQUFLLEdBQUwsR0FBVyxVQUFVLE1BQVYsQ0FBaUIsR0FBakIsRUFDTixJQURNLENBQ0QsV0FEQyxpQkFDd0IsS0FBSyxVQUQ3QixVQUM0QyxLQUFLLFNBRGpELE9BQVg7O0FBR0EsaUJBQUssVUFBTCxHQUFrQixLQUFLLEdBQUwsQ0FBUyxTQUFULENBQW1CLGFBQW5CLEVBQ2IsSUFEYSxDQUNSLEtBQUssSUFERyxFQUViLEtBRmEsR0FFTCxNQUZLLENBRUUsR0FGRixFQUdiLElBSGEsQ0FHUixPQUhRLEVBR0MsWUFBTTtBQUNqQix1QkFBTyx3QkFBd0IsT0FBSyxNQUFMLENBQVksV0FBcEMsR0FBa0QsU0FBbEQsR0FBOEQsT0FBSyxNQUFMLENBQVksV0FBWixLQUE0QixDQUFqRztBQUNILGFBTGEsQ0FBbEI7QUFNWjs7Ozs7QUFPWSxtQkFBTyxVQUFVLElBQVYsRUFBUDtBQUNILFNBL0JpQjtBQWdDbEIsaUJBaENrQix1QkFnQ1A7QUFBQTs7QUFBRTtBQUNULGdCQUFJLFVBQVU7QUFDVixzQkFBTSxHQUFHLFNBQUgsRUFESTtBQUVWLHdCQUFRLEdBQUcsV0FBSDtBQUNSO0FBSFUsYUFBZDtBQUtBLGdCQUFJLFNBQVMsRUFBYjtBQUFBLGdCQUFpQixRQUFRLEVBQXpCO0FBQUEsZ0JBQTZCLFNBQVMsRUFBdEM7QUFBQSxnQkFBMEMsUUFBUSxFQUFsRDtBQUNBLGdCQUFLLEtBQUssT0FBTCxLQUFpQixjQUF0QixFQUFzQztBQUNsQyxxQkFBSyxJQUFMLENBQVUsT0FBVixDQUFrQixnQkFBUTtBQUN0Qiw0QkFBUSxHQUFSLENBQVksSUFBWixFQUFrQixPQUFLLE1BQUwsQ0FBWSxNQUFaLENBQW1CLFNBQW5CLENBQTZCLENBQTdCLENBQWxCO0FBQ0EsMkJBQU8sSUFBUCxDQUFZLE9BQUssTUFBTCxDQUFZLE1BQVosQ0FBbUIsU0FBbkIsQ0FBNkIsQ0FBN0IsRUFBZ0MsT0FBSyxNQUFMLENBQVksUUFBNUMsRUFBc0QsS0FBSyxHQUEzRCxFQUFnRSxPQUFLLE1BQUwsQ0FBWSxTQUE1RSxFQUF1RixHQUFuRztBQUNBLDBCQUFNLElBQU4sQ0FBVyxPQUFLLE1BQUwsQ0FBWSxNQUFaLENBQW1CLFNBQW5CLENBQTZCLENBQTdCLEVBQWdDLE9BQUssTUFBTCxDQUFZLFFBQTVDLEVBQXNELEtBQUssR0FBM0QsRUFBZ0UsT0FBSyxNQUFMLENBQVksU0FBNUUsRUFBdUYsR0FBbEc7QUFDQSwyQkFBTyxJQUFQLENBQVksT0FBSyxNQUFMLENBQVksTUFBWixDQUFtQixTQUFuQixDQUE2QixDQUE3QixFQUFnQyxPQUFLLE1BQUwsQ0FBWSxRQUE1QyxFQUFzRCxLQUFLLEdBQTNELEVBQWdFLE9BQUssTUFBTCxDQUFZLFNBQTVFLEVBQXVGLEdBQW5HO0FBQ0EsMEJBQU0sSUFBTixDQUFXLE9BQUssTUFBTCxDQUFZLE1BQVosQ0FBbUIsU0FBbkIsQ0FBNkIsQ0FBN0IsRUFBZ0MsT0FBSyxNQUFMLENBQVksUUFBNUMsRUFBc0QsS0FBSyxHQUEzRCxFQUFnRSxPQUFLLE1BQUwsQ0FBWSxTQUE1RSxFQUF1RixHQUFsRztBQUNILGlCQU5EO0FBT0g7QUFDRCxpQkFBSyxJQUFMLEdBQVksR0FBRyxHQUFILENBQU8sTUFBUCxDQUFaO0FBQ0EsaUJBQUssSUFBTCxHQUFZLEdBQUcsR0FBSCxDQUFPLEtBQVAsQ0FBWjtBQUNBLGlCQUFLLElBQUwsR0FBWSxHQUFHLEdBQUgsQ0FBTyxNQUFQLENBQVo7QUFDQSxpQkFBSyxJQUFMLEdBQVksR0FBRyxHQUFILENBQU8sS0FBUCxDQUFaO0FBQ0EsaUJBQUssYUFBTCxHQUFxQixFQUFyQjs7QUFFQSxnQkFBSSxTQUFTLENBQUMsQ0FBRCxFQUFJLEtBQUssS0FBVCxDQUFiO0FBQUEsZ0JBQ0ksU0FBUyxDQUFDLEtBQUssTUFBTixFQUFjLENBQWQsQ0FEYjtBQUFBLGdCQUVJLE9BRko7QUFBQSxnQkFHSSxPQUhKO0FBSUEsZ0JBQUssS0FBSyxVQUFMLEtBQW9CLE1BQXpCLEVBQWlDO0FBQzdCLDBCQUFVLENBQUMsR0FBRyxTQUFILENBQWEsS0FBSyxTQUFsQixFQUE2QixLQUFLLElBQWxDLENBQUQsRUFBMEMsR0FBRyxTQUFILENBQWEsS0FBSyxTQUFsQixFQUE2QixLQUFLLElBQWxDLENBQTFDLENBQVY7QUFDSCxhQUZELE1BRU87QUFBRTtBQUNMLDBCQUFVLENBQUMsS0FBSyxJQUFOLEVBQVksS0FBSyxJQUFqQixDQUFWO0FBQ0g7QUFDRCxnQkFBSyxLQUFLLFVBQUwsS0FBb0IsTUFBekIsRUFBaUM7QUFDN0IsMEJBQVUsQ0FBQyxHQUFHLFNBQUgsQ0FBYSxLQUFLLFNBQWxCLEVBQTZCLEtBQUssSUFBbEMsQ0FBRCxFQUEwQyxHQUFHLFNBQUgsQ0FBYSxLQUFLLFNBQWxCLEVBQTZCLEtBQUssSUFBbEMsQ0FBMUMsQ0FBVjtBQUNILGFBRkQsTUFFTztBQUFFO0FBQ0wsMEJBQVUsQ0FBQyxLQUFLLElBQU4sRUFBWSxLQUFLLElBQWpCLENBQVY7QUFDSDs7QUFFRCxpQkFBSyxNQUFMLEdBQWMsUUFBUSxLQUFLLFVBQWIsRUFBeUIsTUFBekIsQ0FBZ0MsT0FBaEMsRUFBeUMsS0FBekMsQ0FBK0MsTUFBL0MsQ0FBZDtBQUNBLGlCQUFLLE1BQUwsR0FBYyxRQUFRLEtBQUssVUFBYixFQUF5QixNQUF6QixDQUFnQyxPQUFoQyxFQUF5QyxLQUF6QyxDQUErQyxNQUEvQyxDQUFkO0FBRUgsU0F4RWlCO0FBeUVsQixnQkF6RWtCLHNCQXlFUjtBQUFBOztBQUNOLGdCQUFJLFlBQVksR0FBRyxJQUFILEdBQ1gsQ0FEVyxDQUNULGFBQUs7QUFDSixvQkFBSyxPQUFLLGFBQUwsQ0FBbUIsT0FBbkIsQ0FBMkIsRUFBRSxPQUFLLE1BQUwsQ0FBWSxTQUFkLENBQTNCLE1BQXlELENBQUMsQ0FBL0QsRUFBa0U7QUFDOUQsMkJBQUssYUFBTCxDQUFtQixJQUFuQixDQUF3QixFQUFFLE9BQUssTUFBTCxDQUFZLFNBQWQsQ0FBeEI7QUFDSDtBQUNELHVCQUFPLE9BQUssTUFBTCxDQUFZLEdBQUcsU0FBSCxDQUFhLE9BQUssU0FBbEIsRUFBNkIsRUFBRSxPQUFLLE1BQUwsQ0FBWSxTQUFkLENBQTdCLENBQVosQ0FBUDtBQUNILGFBTlcsRUFPWCxDQVBXLENBT1Q7QUFBQSx1QkFBSyxPQUFLLE1BQUwsQ0FBWSxFQUFFLE9BQUssTUFBTCxDQUFZLFNBQWQsQ0FBWixDQUFMO0FBQUEsYUFQUyxDQUFoQixDQURNLENBUThDOztBQUVwRCxpQkFBSyxLQUFMLEdBQWEsS0FBSyxVQUFMLENBQWdCLE1BQWhCLENBQXVCLE1BQXZCLEVBQ1IsSUFEUSxDQUNILE9BREcsRUFDSyxNQURMLEVBRVIsSUFGUSxDQUVILEdBRkcsRUFFRSxVQUFDLENBQUQsRUFBTztBQUNkLHVCQUFPLFVBQVUsRUFBRSxNQUFaLENBQVA7QUFDSCxhQUpRLENBQWI7QUFLSCxTQXhGaUI7QUF5RmxCLGdCQXpGa0Isc0JBeUZSO0FBQUE7O0FBQUU7QUFDUixnQkFBSSxhQUFKLEVBQ0ksV0FESixFQUVJLFFBRko7O0FBSUEsZ0JBQUssS0FBSyxNQUFMLENBQVksYUFBWixLQUE4QixNQUFuQyxFQUEyQztBQUN2QyxnQ0FBZ0IsQ0FBaEI7QUFDQSw4QkFBYyxDQUFkO0FBQ0EsMkJBQVcsR0FBRyxVQUFkO0FBQ0gsYUFKRCxNQUtLLElBQUssS0FBSyxNQUFMLENBQVksYUFBWixLQUE4QixLQUFuQyxFQUEwQztBQUMzQyxnQ0FBZ0IsS0FBSyxJQUFyQjtBQUNBLDhCQUFjLENBQUMsS0FBSyxTQUFwQjtBQUNBLDJCQUFXLEdBQUcsT0FBZDtBQUNILGFBSkksTUFJRTtBQUNILGdDQUFnQixLQUFLLElBQXJCO0FBQ0EsOEJBQWMsQ0FBZDtBQUNBLDJCQUFXLEdBQUcsVUFBZDtBQUNIO0FBQ0QsZ0JBQUksT0FBTyxTQUFTLEtBQUssTUFBZCxFQUFzQixhQUF0QixDQUFvQyxDQUFwQyxFQUF1QyxhQUF2QyxDQUFxRCxDQUFyRCxFQUF3RCxXQUF4RCxDQUFvRSxDQUFwRSxDQUFYO0FBQ0EsZ0JBQUssS0FBSyxVQUFMLEtBQW9CLE1BQXpCLEVBQWlDO0FBQzdCLHFCQUFLLFVBQUwsQ0FBZ0IsS0FBSyxhQUFMLENBQW1CLEdBQW5CLENBQXVCO0FBQUEsMkJBQVEsR0FBRyxTQUFILENBQWEsT0FBSyxTQUFsQixFQUE2QixJQUE3QixDQUFSO0FBQUEsaUJBQXZCLENBQWhCLEVBRDZCLENBQ3dEO0FBQ3hGO0FBQ0QsaUJBQUssR0FBTCxDQUFTLE1BQVQsQ0FBZ0IsR0FBaEIsRUFDSyxJQURMLENBQ1UsV0FEVixFQUN1QixrQkFBbUIsS0FBSyxNQUFMLENBQVksYUFBWixJQUE2QixXQUFoRCxJQUFnRSxHQUR2RixFQUM0RjtBQUQ1RixhQUVLLElBRkwsQ0FFVSxPQUZWLEVBRW1CLGFBRm5CLEVBR0ssSUFITCxDQUdVLElBSFY7QUFJSCxTQXBIaUI7QUFxSGxCLGdCQXJIa0Isc0JBcUhSO0FBQUE7O0FBQ047QUFDQSxpQkFBSyxHQUFMLENBQVMsTUFBVCxDQUFnQixHQUFoQixFQUNHLElBREgsQ0FDUSxPQURSLEVBQ2lCO0FBQUEsdUJBQU0sY0FBTjtBQUFBLGFBRGpCLEVBRUcsSUFGSCxDQUVRLEdBQUcsUUFBSCxDQUFZLEtBQUssTUFBakIsRUFBeUIsYUFBekIsQ0FBdUMsQ0FBdkMsRUFBMEMsYUFBMUMsQ0FBd0QsQ0FBeEQsRUFBMkQsV0FBM0QsQ0FBdUUsQ0FBdkUsRUFBMEUsS0FBMUUsQ0FBZ0YsQ0FBaEYsQ0FGUjs7QUFJQTtBQUNBLGlCQUFLLFVBQUwsQ0FBZ0IsTUFBaEIsQ0FBdUIsTUFBdkIsRUFDRyxJQURILENBQ1EsT0FEUixFQUNpQixPQURqQixFQUVHLElBRkgsQ0FFUSxXQUZSLEVBRXFCO0FBQUEsdUNBQW9CLE9BQUssVUFBekIsV0FBd0MsT0FBSyxTQUFMLEdBQWlCLEVBQXpEO0FBQUEsYUFGckIsRUFHRyxJQUhILENBR1EsVUFBQyxDQUFELEVBQUcsQ0FBSDtBQUFBLHVCQUFTLE1BQU0sQ0FBTixHQUFVLE9BQUssTUFBTCxDQUFZLEtBQVosQ0FBa0IsRUFBRSxHQUFwQixDQUFWLEdBQXFDLElBQTlDO0FBQUEsYUFIUjtBQUtILFNBaklpQjtBQWtJbEIsaUJBbElrQix1QkFrSVA7QUFBQTs7QUFDUCxpQkFBSyxVQUFMLENBQWdCLE1BQWhCLENBQXVCLE1BQXZCLEVBQ0ssSUFETCxDQUNVLE9BRFYsRUFDbUIsY0FEbkIsRUFFSyxJQUZMLENBRVUsVUFBQyxDQUFEO0FBQUEsdUJBQU8sa0JBQWtCLFFBQUssTUFBTCxDQUFZLEtBQVosQ0FBa0IsRUFBRSxHQUFwQixFQUF5QixPQUF6QixDQUFpQyxNQUFqQyxFQUF3QyxrQ0FBeEMsQ0FBbEIsR0FBZ0csVUFBdkc7QUFBQSxhQUZWLEVBR0ssSUFITCxDQUdVLFdBSFYsRUFHdUIsVUFBQyxDQUFEO0FBQUEsdUNBQW9CLFFBQUssS0FBTCxHQUFhLENBQWpDLFlBQXVDLFFBQUssTUFBTCxDQUFZLEVBQUUsTUFBRixDQUFTLEVBQUUsTUFBRixDQUFTLE1BQVQsR0FBa0IsQ0FBM0IsRUFBOEIsUUFBSyxNQUFMLENBQVksU0FBMUMsQ0FBWixJQUFvRSxDQUEzRztBQUFBLGFBSHZCO0FBSUgsU0F2SWlCO0FBd0lsQixpQkF4SWtCLHVCQXdJUDtBQUFBOztBQUVQLGlCQUFLLE1BQUwsR0FBYyxLQUFLLFVBQUwsQ0FBZ0IsU0FBaEIsQ0FBMEIsUUFBMUIsRUFDVCxJQURTLENBQ0o7QUFBQSx1QkFBSyxFQUFFLE1BQVA7QUFBQSxhQURJLEVBRVQsS0FGUyxHQUVELE1BRkMsQ0FFTSxRQUZOLEVBR1QsSUFIUyxDQUdKLE9BSEksRUFHSyxZQUhMLEVBSVQsSUFKUyxDQUlKLEdBSkksRUFJQyxHQUpELEVBS1QsSUFMUyxDQUtKLElBTEksRUFLRTtBQUFBLHVCQUFLLFFBQUssTUFBTCxDQUFZLEdBQUcsU0FBSCxDQUFhLFFBQUssU0FBbEIsRUFBNkIsRUFBRSxRQUFLLE1BQUwsQ0FBWSxTQUFkLENBQTdCLENBQVosQ0FBTDtBQUFBLGFBTEYsRUFNVCxJQU5TLENBTUosSUFOSSxFQU1FO0FBQUEsdUJBQUssUUFBSyxNQUFMLENBQVksRUFBRSxRQUFLLE1BQUwsQ0FBWSxTQUFkLENBQVosQ0FBTDtBQUFBLGFBTkYsRUFPVCxFQVBTLENBT04sV0FQTSxFQU9PLFVBQUMsQ0FBRCxFQUFHLENBQUgsRUFBSyxLQUFMLEVBQWU7QUFDNUIsd0JBQVEsR0FBUixDQUFZLENBQVo7QUFDQSxvQkFBSSxRQUFRLE1BQU0sQ0FBTixFQUFTLFVBQVQsQ0FBb0IsU0FBcEIsQ0FBOEIsS0FBOUIsQ0FBb0MsS0FBcEMsQ0FBMEMsVUFBMUMsRUFBc0QsQ0FBdEQsQ0FBWixDQUY0QixDQUUwQztBQUN0RSx3QkFBSyxPQUFMLENBQWEsSUFBYixDQUFrQixPQUFsQixFQUEyQixRQUFLLE9BQUwsQ0FBYSxJQUFiLENBQWtCLE9BQWxCLElBQTZCLEdBQTdCLEdBQW1DLEtBQTlEO0FBQ0Esd0JBQUssT0FBTCxDQUFhLElBQWIsQ0FBa0IsYUFBYSxRQUFLLE1BQUwsQ0FBWSxPQUFaLENBQW9CLEVBQUUsTUFBdEIsQ0FBYixHQUE2QyxhQUE3QyxHQUE2RCxFQUFFLElBQS9ELEdBQXNFLFNBQXRFLEdBQWtGLEVBQUUsUUFBSyxNQUFMLENBQVksU0FBZCxDQUFsRixHQUE2RyxHQUE3RyxHQUFtSCxRQUFLLE1BQUwsQ0FBWSxLQUFaLENBQWtCLEVBQUUsTUFBcEIsQ0FBckk7QUFDQSx3QkFBSyxPQUFMLENBQWEsSUFBYjtBQUNILGFBYlMsRUFjVCxFQWRTLENBY04sVUFkTSxFQWNNLFlBQU07QUFDbEIsd0JBQUssT0FBTCxDQUFhLElBQWIsQ0FBa0IsT0FBbEIsRUFBMkIsUUFBSyxPQUFMLENBQWEsSUFBYixDQUFrQixPQUFsQixFQUEyQixPQUEzQixDQUFtQyxZQUFuQyxFQUFpRCxFQUFqRCxDQUEzQjtBQUNBLHdCQUFLLE9BQUwsQ0FBYSxJQUFiLENBQWtCLEVBQWxCO0FBQ0Esd0JBQUssT0FBTCxDQUFhLElBQWI7QUFDSCxhQWxCUyxFQW1CVCxJQW5CUyxDQW1CSixLQUFLLE9BbkJELENBQWQ7QUFzQkgsU0FoS2lCO0FBaUtsQixtQkFqS2tCLHlCQWlLTDs7QUFFVCxpQkFBSyxPQUFMLEdBQWUsR0FBRyxHQUFILEdBQ1YsSUFEVSxDQUNMLE9BREssRUFDSSxRQURKLEVBRVYsU0FGVSxDQUVBLEdBRkEsRUFHVixNQUhVLENBR0gsQ0FBQyxDQUFDLENBQUYsRUFBSyxDQUFMLENBSEcsQ0FBZjtBQUtIO0FBeEtpQixLQUF0Qjs7QUE0S0EsV0FBTztBQUNIO0FBREcsS0FBUDtBQUlILENBcFNxQixFQUFmOzs7Ozs7OztBQ0FBLElBQU0sNEJBQVcsWUFBVTtBQUM5QjtBQUNBLFdBQU8sU0FBUCxDQUFpQixXQUFqQixHQUErQixZQUFXO0FBQUU7QUFDeEMsZUFBTyxLQUFLLE9BQUwsQ0FBYSxVQUFiLEVBQXdCLEdBQXhCLEVBQTZCLE9BQTdCLENBQXFDLHVCQUFyQyxFQUE2RCxFQUE3RCxFQUFpRSxXQUFqRSxFQUFQO0FBQ0gsS0FGRDs7QUFJQSxXQUFPLFNBQVAsQ0FBaUIsaUJBQWpCLEdBQXFDLFlBQVc7QUFDNUMsZUFBTyxLQUFLLE9BQUwsQ0FBYSxJQUFiLEVBQWtCLEdBQWxCLENBQVA7QUFDSCxLQUZEOztBQUlBLGlCQUFhLFNBQWIsQ0FBdUIsT0FBdkIsR0FBaUMsWUFBVztBQUN4QyxZQUFJLFNBQVMsRUFBYjtBQUNBLGFBQU0sSUFBSSxHQUFWLElBQWlCLElBQWpCLEVBQXVCO0FBQ25CLGdCQUFJLEtBQUssY0FBTCxDQUFvQixHQUFwQixDQUFKLEVBQTZCO0FBQ3pCLG9CQUFJO0FBQ0EsMkJBQU8sR0FBUCxJQUFjLEtBQUssS0FBTCxDQUFXLEtBQUssR0FBTCxDQUFYLENBQWQ7QUFDSCxpQkFGRCxDQUdBLE9BQU0sR0FBTixFQUFXO0FBQ1AsMkJBQU8sR0FBUCxJQUFjLEtBQUssR0FBTCxDQUFkO0FBQ0g7QUFDSjtBQUNKO0FBQ0QsZUFBTyxNQUFQO0FBQ0gsS0FiRDtBQWNILENBeEJzQixFQUFoQjs7Ozs7Ozs7QUNBUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRU8sSUFBTSx3QkFBUyxZQUFVO0FBQzlCLEtBQUcsT0FBSCxHQUFhLFNBQVMsT0FBVCxDQUFpQixDQUFqQixFQUFvQjtBQUMvQixXQUFPLE9BQU8sQ0FBUCxLQUFhLFVBQWIsR0FBMEIsQ0FBMUIsR0FBOEIsWUFBVztBQUM5QyxhQUFPLENBQVA7QUFDRCxLQUZEO0FBR0QsR0FKRDs7QUFNQSxLQUFHLEdBQUgsR0FBUyxZQUFXOztBQUVsQixRQUFJLFlBQVksZ0JBQWhCO0FBQUEsUUFDSSxTQUFZLGFBRGhCO0FBQUEsUUFFSSxPQUFZLFdBRmhCO0FBQUEsUUFHSSxPQUFZLFVBSGhCO0FBQUEsUUFJSSxNQUFZLElBSmhCO0FBQUEsUUFLSSxRQUFZLElBTGhCO0FBQUEsUUFNSSxTQUFZLElBTmhCOztBQVFBLGFBQVMsR0FBVCxDQUFhLEdBQWIsRUFBa0I7QUFDaEIsWUFBTSxXQUFXLEdBQVgsQ0FBTjtBQUNBLGNBQVEsSUFBSSxjQUFKLEVBQVI7QUFDQSxlQUFTLElBQVQsQ0FBYyxXQUFkLENBQTBCLElBQTFCO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBO0FBQ0EsUUFBSSxJQUFKLEdBQVcsWUFBVztBQUNwQixVQUFJLE9BQU8sTUFBTSxTQUFOLENBQWdCLEtBQWhCLENBQXNCLElBQXRCLENBQTJCLFNBQTNCLENBQVg7QUFDQSxVQUFHLEtBQUssS0FBSyxNQUFMLEdBQWMsQ0FBbkIsYUFBaUMsVUFBcEMsRUFBZ0QsU0FBUyxLQUFLLEdBQUwsRUFBVDs7QUFFaEQsVUFBSSxVQUFVLEtBQUssS0FBTCxDQUFXLElBQVgsRUFBaUIsSUFBakIsQ0FBZDtBQUFBLFVBQ0ksVUFBVSxPQUFPLEtBQVAsQ0FBYSxJQUFiLEVBQW1CLElBQW5CLENBRGQ7QUFBQSxVQUVJLE1BQVUsVUFBVSxLQUFWLENBQWdCLElBQWhCLEVBQXNCLElBQXRCLENBRmQ7QUFBQSxVQUdJLFFBQVUsV0FIZDtBQUFBLFVBSUksSUFBVSxXQUFXLE1BSnpCO0FBQUEsVUFLSSxNQUxKO0FBQUEsVUFNSSxZQUFhLFNBQVMsZUFBVCxDQUF5QixTQUF6QixJQUFzQyxTQUFTLElBQVQsQ0FBYyxTQU5yRTtBQUFBLFVBT0ksYUFBYSxTQUFTLGVBQVQsQ0FBeUIsVUFBekIsSUFBdUMsU0FBUyxJQUFULENBQWMsVUFQdEU7O0FBU0EsWUFBTSxJQUFOLENBQVcsT0FBWCxFQUNHLEtBREgsQ0FDUyxVQURULEVBQ3FCLFVBRHJCLEVBRUcsS0FGSCxDQUVTLFNBRlQsRUFFb0IsQ0FGcEIsRUFHRyxLQUhILENBR1MsZ0JBSFQsRUFHMkIsS0FIM0I7O0FBS0EsYUFBTSxHQUFOO0FBQVcsY0FBTSxPQUFOLENBQWMsV0FBVyxDQUFYLENBQWQsRUFBNkIsS0FBN0I7QUFBWCxPQUNBLFNBQVMsb0JBQW9CLEdBQXBCLEVBQXlCLEtBQXpCLENBQStCLElBQS9CLENBQVQ7QUFDQSxZQUFNLE9BQU4sQ0FBYyxHQUFkLEVBQW1CLElBQW5CLEVBQ0csS0FESCxDQUNTLEtBRFQsRUFDaUIsT0FBTyxHQUFQLEdBQWMsUUFBUSxDQUFSLENBQWYsR0FBNkIsU0FBN0IsR0FBeUMsSUFEekQsRUFFRyxLQUZILENBRVMsTUFGVCxFQUVrQixPQUFPLElBQVAsR0FBYyxRQUFRLENBQVIsQ0FBZixHQUE2QixVQUE3QixHQUEwQyxJQUYzRDs7QUFJQSxhQUFPLEdBQVA7QUFDRCxLQXpCRDs7QUEyQkE7QUFDQTtBQUNBO0FBQ0EsUUFBSSxJQUFKLEdBQVcsWUFBVztBQUNwQixVQUFJLFFBQVEsV0FBWjtBQUNBLFlBQ0csS0FESCxDQUNTLFNBRFQsRUFDb0IsQ0FEcEIsRUFFRyxLQUZILENBRVMsZ0JBRlQsRUFFMkIsTUFGM0I7QUFHQSxhQUFPLEdBQVA7QUFDRCxLQU5EOztBQVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQUksSUFBSixHQUFXLFVBQVMsQ0FBVCxFQUFZLENBQVosRUFBZTtBQUN4QixVQUFJLFVBQVUsTUFBVixHQUFtQixDQUFuQixJQUF3QixPQUFPLENBQVAsS0FBYSxRQUF6QyxFQUFtRDtBQUNqRCxlQUFPLFlBQVksSUFBWixDQUFpQixDQUFqQixDQUFQO0FBQ0QsT0FGRCxNQUVPO0FBQ0wsWUFBSSxPQUFRLE1BQU0sU0FBTixDQUFnQixLQUFoQixDQUFzQixJQUF0QixDQUEyQixTQUEzQixDQUFaO0FBQ0EsV0FBRyxTQUFILENBQWEsU0FBYixDQUF1QixJQUF2QixDQUE0QixLQUE1QixDQUFrQyxXQUFsQyxFQUErQyxJQUEvQztBQUNEOztBQUVELGFBQU8sR0FBUDtBQUNELEtBVEQ7O0FBV0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBSSxLQUFKLEdBQVksVUFBUyxDQUFULEVBQVksQ0FBWixFQUFlO0FBQ3pCO0FBQ0EsVUFBSSxVQUFVLE1BQVYsR0FBbUIsQ0FBbkIsSUFBd0IsT0FBTyxDQUFQLEtBQWEsUUFBekMsRUFBbUQ7QUFDakQsZUFBTyxZQUFZLEtBQVosQ0FBa0IsQ0FBbEIsQ0FBUDtBQUNELE9BRkQsTUFFTztBQUNMLFlBQUksT0FBTyxNQUFNLFNBQU4sQ0FBZ0IsS0FBaEIsQ0FBc0IsSUFBdEIsQ0FBMkIsU0FBM0IsQ0FBWDtBQUNBLFlBQUksS0FBSyxNQUFMLEtBQWdCLENBQXBCLEVBQXVCO0FBQ3JCLGNBQUksU0FBUyxLQUFLLENBQUwsQ0FBYjtBQUNBLGlCQUFPLElBQVAsQ0FBWSxNQUFaLEVBQW9CLE9BQXBCLENBQTRCLFVBQVMsR0FBVCxFQUFjO0FBQ3hDLG1CQUFPLEdBQUcsU0FBSCxDQUFhLFNBQWIsQ0FBdUIsS0FBdkIsQ0FBNkIsS0FBN0IsQ0FBbUMsV0FBbkMsRUFBZ0QsQ0FBQyxHQUFELEVBQU0sT0FBTyxHQUFQLENBQU4sQ0FBaEQsQ0FBUDtBQUNELFdBRkQ7QUFHRDtBQUNGOztBQUVELGFBQU8sR0FBUDtBQUNELEtBZkQ7O0FBaUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQUksU0FBSixHQUFnQixVQUFTLENBQVQsRUFBWTtBQUMxQixVQUFJLENBQUMsVUFBVSxNQUFmLEVBQXVCLE9BQU8sU0FBUDtBQUN2QixrQkFBWSxLQUFLLElBQUwsR0FBWSxDQUFaLEdBQWdCLEdBQUcsT0FBSCxDQUFXLENBQVgsQ0FBNUI7O0FBRUEsYUFBTyxHQUFQO0FBQ0QsS0FMRDs7QUFPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBSSxNQUFKLEdBQWEsVUFBUyxDQUFULEVBQVk7QUFDdkIsVUFBSSxDQUFDLFVBQVUsTUFBZixFQUF1QixPQUFPLE1BQVA7QUFDdkIsZUFBUyxLQUFLLElBQUwsR0FBWSxDQUFaLEdBQWdCLEdBQUcsT0FBSCxDQUFXLENBQVgsQ0FBekI7O0FBRUEsYUFBTyxHQUFQO0FBQ0QsS0FMRDs7QUFPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBSSxJQUFKLEdBQVcsVUFBUyxDQUFULEVBQVk7QUFDckIsVUFBSSxDQUFDLFVBQVUsTUFBZixFQUF1QixPQUFPLElBQVA7QUFDdkIsYUFBTyxLQUFLLElBQUwsR0FBWSxDQUFaLEdBQWdCLEdBQUcsT0FBSCxDQUFXLENBQVgsQ0FBdkI7O0FBRUEsYUFBTyxHQUFQO0FBQ0QsS0FMRDs7QUFPQTtBQUNBO0FBQ0E7QUFDQSxRQUFJLE9BQUosR0FBYyxZQUFXO0FBQ3ZCLFVBQUcsSUFBSCxFQUFTO0FBQ1Asb0JBQVksTUFBWjtBQUNBLGVBQU8sSUFBUDtBQUNEO0FBQ0QsYUFBTyxHQUFQO0FBQ0QsS0FORDs7QUFRQSxhQUFTLGdCQUFULEdBQTRCO0FBQUUsYUFBTyxHQUFQO0FBQVk7QUFDMUMsYUFBUyxhQUFULEdBQXlCO0FBQUUsYUFBTyxDQUFDLENBQUQsRUFBSSxDQUFKLENBQVA7QUFBZTtBQUMxQyxhQUFTLFdBQVQsR0FBdUI7QUFBRSxhQUFPLEdBQVA7QUFBWTs7QUFFckMsUUFBSSxzQkFBc0I7QUFDeEIsU0FBSSxXQURvQjtBQUV4QixTQUFJLFdBRm9CO0FBR3hCLFNBQUksV0FIb0I7QUFJeEIsU0FBSSxXQUpvQjtBQUt4QixVQUFJLFlBTG9CO0FBTXhCLFVBQUksWUFOb0I7QUFPeEIsVUFBSSxZQVBvQjtBQVF4QixVQUFJO0FBUm9CLEtBQTFCOztBQVdBLFFBQUksYUFBYSxPQUFPLElBQVAsQ0FBWSxtQkFBWixDQUFqQjs7QUFFQSxhQUFTLFdBQVQsR0FBdUI7QUFDckIsVUFBSSxPQUFPLGVBQVg7QUFDQSxhQUFPO0FBQ0wsYUFBTSxLQUFLLENBQUwsQ0FBTyxDQUFQLEdBQVcsS0FBSyxZQURqQjtBQUVMLGNBQU0sS0FBSyxDQUFMLENBQU8sQ0FBUCxHQUFXLEtBQUssV0FBTCxHQUFtQjtBQUYvQixPQUFQO0FBSUQ7O0FBRUQsYUFBUyxXQUFULEdBQXVCO0FBQ3JCLFVBQUksT0FBTyxlQUFYO0FBQ0EsYUFBTztBQUNMLGFBQU0sS0FBSyxDQUFMLENBQU8sQ0FEUjtBQUVMLGNBQU0sS0FBSyxDQUFMLENBQU8sQ0FBUCxHQUFXLEtBQUssV0FBTCxHQUFtQjtBQUYvQixPQUFQO0FBSUQ7O0FBRUQsYUFBUyxXQUFULEdBQXVCO0FBQ3JCLFVBQUksT0FBTyxlQUFYO0FBQ0EsYUFBTztBQUNMLGFBQU0sS0FBSyxDQUFMLENBQU8sQ0FBUCxHQUFXLEtBQUssWUFBTCxHQUFvQixDQURoQztBQUVMLGNBQU0sS0FBSyxDQUFMLENBQU87QUFGUixPQUFQO0FBSUQ7O0FBRUQsYUFBUyxXQUFULEdBQXVCO0FBQ3JCLFVBQUksT0FBTyxlQUFYO0FBQ0EsYUFBTztBQUNMLGFBQU0sS0FBSyxDQUFMLENBQU8sQ0FBUCxHQUFXLEtBQUssWUFBTCxHQUFvQixDQURoQztBQUVMLGNBQU0sS0FBSyxDQUFMLENBQU8sQ0FBUCxHQUFXLEtBQUs7QUFGakIsT0FBUDtBQUlEOztBQUVELGFBQVMsWUFBVCxHQUF3QjtBQUN0QixVQUFJLE9BQU8sZUFBWDtBQUNBLGFBQU87QUFDTCxhQUFNLEtBQUssRUFBTCxDQUFRLENBQVIsR0FBWSxLQUFLLFlBRGxCO0FBRUwsY0FBTSxLQUFLLEVBQUwsQ0FBUSxDQUFSLEdBQVksS0FBSztBQUZsQixPQUFQO0FBSUQ7O0FBRUQsYUFBUyxZQUFULEdBQXdCO0FBQ3RCLFVBQUksT0FBTyxlQUFYO0FBQ0EsYUFBTztBQUNMLGFBQU0sS0FBSyxFQUFMLENBQVEsQ0FBUixHQUFZLEtBQUssWUFEbEI7QUFFTCxjQUFNLEtBQUssRUFBTCxDQUFRO0FBRlQsT0FBUDtBQUlEOztBQUVELGFBQVMsWUFBVCxHQUF3QjtBQUN0QixVQUFJLE9BQU8sZUFBWDtBQUNBLGFBQU87QUFDTCxhQUFNLEtBQUssRUFBTCxDQUFRLENBRFQ7QUFFTCxjQUFNLEtBQUssRUFBTCxDQUFRLENBQVIsR0FBWSxLQUFLO0FBRmxCLE9BQVA7QUFJRDs7QUFFRCxhQUFTLFlBQVQsR0FBd0I7QUFDdEIsVUFBSSxPQUFPLGVBQVg7QUFDQSxhQUFPO0FBQ0wsYUFBTSxLQUFLLEVBQUwsQ0FBUSxDQURUO0FBRUwsY0FBTSxLQUFLLENBQUwsQ0FBTztBQUZSLE9BQVA7QUFJRDs7QUFFRCxhQUFTLFFBQVQsR0FBb0I7QUFDbEIsVUFBSSxPQUFPLEdBQUcsTUFBSCxDQUFVLFNBQVMsYUFBVCxDQUF1QixLQUF2QixDQUFWLENBQVg7QUFDQSxXQUNHLEtBREgsQ0FDUyxVQURULEVBQ3FCLFVBRHJCLEVBRUcsS0FGSCxDQUVTLEtBRlQsRUFFZ0IsQ0FGaEIsRUFHRyxLQUhILENBR1MsU0FIVCxFQUdvQixDQUhwQixFQUlHLEtBSkgsQ0FJUyxnQkFKVCxFQUkyQixNQUozQixFQUtHLEtBTEgsQ0FLUyxZQUxULEVBS3VCLFlBTHZCOztBQU9BLGFBQU8sS0FBSyxJQUFMLEVBQVA7QUFDRDs7QUFFRCxhQUFTLFVBQVQsQ0FBb0IsRUFBcEIsRUFBd0I7QUFDdEIsV0FBSyxHQUFHLElBQUgsRUFBTDtBQUNBLFVBQUcsR0FBRyxPQUFILENBQVcsV0FBWCxPQUE2QixLQUFoQyxFQUNFLE9BQU8sRUFBUDs7QUFFRixhQUFPLEdBQUcsZUFBVjtBQUNEOztBQUVELGFBQVMsU0FBVCxHQUFxQjtBQUNuQixVQUFHLFNBQVMsSUFBWixFQUFrQjtBQUNoQixlQUFPLFVBQVA7QUFDQTtBQUNBLGlCQUFTLElBQVQsQ0FBYyxXQUFkLENBQTBCLElBQTFCO0FBQ0Q7QUFDRCxhQUFPLEdBQUcsTUFBSCxDQUFVLElBQVYsQ0FBUDtBQUNEOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBUyxhQUFULEdBQXlCO0FBQ3ZCLFVBQUksV0FBYSxVQUFVLEdBQUcsS0FBSCxDQUFTLE1BQXBDOztBQUVBLGFBQU8sZ0JBQWdCLE9BQU8sU0FBUyxZQUFoQyxJQUFnRCxnQkFBZ0IsU0FBUyxVQUFoRixFQUE0RjtBQUN4RixtQkFBVyxTQUFTLFVBQXBCO0FBQ0g7O0FBRUQsVUFBSSxPQUFhLEVBQWpCO0FBQUEsVUFDSSxTQUFhLFNBQVMsWUFBVCxFQURqQjtBQUFBLFVBRUksUUFBYSxTQUFTLE9BQVQsRUFGakI7QUFBQSxVQUdJLFFBQWEsTUFBTSxLQUh2QjtBQUFBLFVBSUksU0FBYSxNQUFNLE1BSnZCO0FBQUEsVUFLSSxJQUFhLE1BQU0sQ0FMdkI7QUFBQSxVQU1JLElBQWEsTUFBTSxDQU52Qjs7QUFRQSxZQUFNLENBQU4sR0FBVSxDQUFWO0FBQ0EsWUFBTSxDQUFOLEdBQVUsQ0FBVjtBQUNBLFdBQUssRUFBTCxHQUFVLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFWO0FBQ0EsWUFBTSxDQUFOLElBQVcsS0FBWDtBQUNBLFdBQUssRUFBTCxHQUFVLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFWO0FBQ0EsWUFBTSxDQUFOLElBQVcsTUFBWDtBQUNBLFdBQUssRUFBTCxHQUFVLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFWO0FBQ0EsWUFBTSxDQUFOLElBQVcsS0FBWDtBQUNBLFdBQUssRUFBTCxHQUFVLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFWO0FBQ0EsWUFBTSxDQUFOLElBQVcsU0FBUyxDQUFwQjtBQUNBLFdBQUssQ0FBTCxHQUFVLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFWO0FBQ0EsWUFBTSxDQUFOLElBQVcsS0FBWDtBQUNBLFdBQUssQ0FBTCxHQUFTLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFUO0FBQ0EsWUFBTSxDQUFOLElBQVcsUUFBUSxDQUFuQjtBQUNBLFlBQU0sQ0FBTixJQUFXLFNBQVMsQ0FBcEI7QUFDQSxXQUFLLENBQUwsR0FBUyxNQUFNLGVBQU4sQ0FBc0IsTUFBdEIsQ0FBVDtBQUNBLFlBQU0sQ0FBTixJQUFXLE1BQVg7QUFDQSxXQUFLLENBQUwsR0FBUyxNQUFNLGVBQU4sQ0FBc0IsTUFBdEIsQ0FBVDs7QUFFQSxhQUFPLElBQVA7QUFDRDs7QUFFRCxXQUFPLEdBQVA7QUFDRCxHQWxURDtBQW1URCxDQTFUb0IsRUFBZCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIgLyogZXhwb3J0ZWQgRDNDaGFydHMsIEhlbHBlcnMsIGQzVGlwICovIC8vIGxldCdzIGpzaGludCBrbm93IHRoYXQgRDNDaGFydHMgY2FuIGJlIFwiZGVmaW5lZCBidXQgbm90IHVzZWRcIiBpbiB0aGlzIGZpbGVcbiAvKiBwb2x5ZmlsbHMgbmVlZGVkOiBQcm9taXNlLCBBcnJheS5pc0FycmF5LCBBcnJheS5maW5kLCBBcnJheS5maWx0ZXJcblxuICovXG5pbXBvcnQgeyBIZWxwZXJzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9IZWxwZXJzJztcbmltcG9ydCB7IENoYXJ0cyB9IGZyb20gJy4uL2pzLWV4cG9ydHMvQ2hhcnRzJztcbmltcG9ydCB7IGQzVGlwIH0gZnJvbSAnLi4vanMtdmVuZG9yL2QzLXRpcCc7XG5cbnZhciBEM0NoYXJ0cyA9IChmdW5jdGlvbigpe1xuXG5cInVzZSBzdHJpY3RcIjsgXG4gICAgIFxuICAgIHZhciBncm91cENvbGxlY3Rpb24gPSBbXTtcbiAgICB2YXIgRDNDaGFydEdyb3VwID0gZnVuY3Rpb24oY29udGFpbmVyLCBpbmRleCl7XG4gICAgICAgIGNvbnNvbGUubG9nKGluZGV4KTtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgICAgIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBjb250YWluZXIuZGF0YXNldC5jb252ZXJ0KCk7XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMuY29uZmlnLm5lc3RCeS50b1N0cmluZygpKTtcbiAgICAgICAgdGhpcy5kYXRhUHJvbWlzZXMgPSB0aGlzLnJldHVybkRhdGFQcm9taXNlcyhjb250YWluZXIpO1xuICAgICAgICB0aGlzLmNoaWxkcmVuID0gW107XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMuZGF0YVByb21pc2VzKTtcbiAgICAgICAgLy90aGlzLmNvbnRyb2xsZXIuaW5pdENvbnRyb2xsZXIoY29udGFpbmVyLCB0aGlzLm1vZGVsLCB0aGlzLnZpZXcpO1xuICAgICAgICB0aGlzLmRhdGFQcm9taXNlcy50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNoYXJ0cyhjb250YWluZXIpO1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8vcHJvdG90eXBlIGJlZ2lucyBoZXJlXG4gICAgRDNDaGFydEdyb3VwLnByb3RvdHlwZSA9IHtcbiAgICAgICAgXG4gICAgICAgICAgICByZXR1cm5EYXRhUHJvbWlzZXMoKXsgXG4gICAgICAgICAgICAgICAgdmFyIGRhdGFQcm9taXNlcyA9IFtdO1xuICAgICAgICAgICAgICAgIHZhciBzaGVldElEID0gdGhpcy5jb25maWcuc2hlZXRJZCwgXG4gICAgICAgICAgICAgICAgICAgIHRhYnMgPSBbdGhpcy5jb25maWcuZGF0YVRhYix0aGlzLmNvbmZpZy5kaWN0aW9uYXJ5VGFiXTsgLy8gdGhpcyBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpcyB0aGVyZSBhIGNhc2UgZm9yIG1vcmUgdGhhbiBvbmUgc2hlZXQgb2YgZGF0YT9cbiAgICAgICAgICAgICAgICB0YWJzLmZvckVhY2goKGVhY2gsIGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSxyZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGQzLmpzb24oJ2h0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8nICsgc2hlZXRJRCArICcvdmFsdWVzLycgKyBlYWNoICsgJz9rZXk9QUl6YVN5REQzVzV3SmVKRjJlc2ZmWk1ReE50RWw5dHQtT2ZnU3E0JywgKGVycm9yLGRhdGEpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWVzID0gZGF0YS52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RUeXBlID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gJ29iamVjdCcgOiAnc2VyaWVzJzsgLy8gbmVzdFR5cGUgZm9yIGRhdGEgc2hvdWxkIGNvbWUgZnJvbSBIVE1MXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5lc3RCeSA9IGVhY2ggPT09ICdkaWN0aW9uYXJ5JyA/IGZhbHNlIDogdGhpcy5jb25maWcubmVzdEJ5O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBuZXN0QnksIHRydWUsIG5lc3RUeXBlLCBpKSk7IFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBkYXRhUHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBQcm9taXNlLmFsbChkYXRhUHJvbWlzZXMpLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhID0gdmFsdWVzWzBdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRpY3Rpb25hcnkgPSB2YWx1ZXNbMV07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3VtbWFyaWVzID0gdGhpcy5zdW1tYXJpemVEYXRhKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKGRhdGFQcm9taXNlcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3VtbWFyaXplRGF0YSgpeyAvLyB0aGlzIGZuIGNyZWF0ZXMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBzdW1tYXJpemluZyB0aGUgZGF0YSBpbiBtb2RlbC5kYXRhLiBtb2RlbC5kYXRhIGlzIG5lc3RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgbmVzdGluZyBhbmQgcm9sbGluZyB1cCBjYW5ub3QgYmUgZG9uZSBlYXNpbHkgYXQgdGhlIHNhbWUgdGltZSwgc28gdGhleSdyZSBkb25lIHNlcGFyYXRlbHkuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzdW1tYXJpZXMgcHJvdmlkZSBhdmVyYWdlLCBtYXgsIG1pbiBvZiBhbGwgZmllbGRzIGluIHRoZSBkYXRhIGF0IGFsbCBsZXZlbHMgb2YgbmVzdGluZy4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBmaXJzdCAoaW5kZXggMCkgaXMgb25lIGxheWVyIG5lc3RlZCwgdGhlIHNlY29uZCBpcyB0d28sIGFuZCBzbyBvbi5cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgc3VtbWFyaWVzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHZhcmlhYmxlcyA9IE9iamVjdC5rZXlzKHRoaXMudW5uZXN0ZWRbMF0pOyAvLyBhbGwgbmVlZCB0byBoYXZlIHRoZSBzYW1lIGZpZWxkc1xuICAgICAgICAgICAgICAgIHZhciBuZXN0QnkgPSB0aGlzLmNvbmZpZy5uZXN0QnkgPyB0aGlzLmNvbmZpZy5uZXN0QnkubWFwKGVhY2ggPT4gZWFjaCkgOiBmYWxzZTsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlcyBtYXAgdG8gY3JlYXRlIG5ldyBhcnJheSByYXRoZXIgdGhhbiBhc3NpZ25pbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBieSByZWZlcmVuY2UuIHRoZSBgcG9wKClgIGJlbG93IHdvdWxkIGFmZmVjdCBvcmlnaW5hbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFycmF5IGlmIGRvbmUgYnkgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgdmFyIG5lc3RCeUFycmF5ID0gQXJyYXkuaXNBcnJheShuZXN0QnkpID8gbmVzdEJ5IDogW25lc3RCeV07XG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gcmVkdWNlVmFyaWFibGVzKGQpe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFyaWFibGVzLnJlZHVjZShmdW5jdGlvbihhY2MsIGN1cil7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2NbY3VyXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXg6ICAgICAgIGQzLm1heChkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluOiAgICAgICBkMy5taW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lYW46ICAgICAgZDMubWVhbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VtOiAgICAgICBkMy5zdW0oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lZGlhbjogICAgZDMubWVkaWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW5jZTogIGQzLnZhcmlhbmNlKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpYXRpb246IGQzLmRldmlhdGlvbihkLCBkID0+IGRbY3VyXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgICAgICAgICB9LHt9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgd2hpbGUgKCBuZXN0QnlBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdW1tYXJpemVkID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeUFycmF5KVxuICAgICAgICAgICAgICAgICAgICAgICAgLnJvbGx1cChyZWR1Y2VWYXJpYWJsZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0KHRoaXMudW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgICAgICBzdW1tYXJpZXMudW5zaGlmdChzdW1tYXJpemVkKTsgICAgICBcbiAgICAgICAgICAgICAgICAgICAgbmVzdEJ5QXJyYXkucG9wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBzdW1tYXJpZXM7XG4gICAgICAgICAgICB9LCBcbiAgICAgICAgICAgIG5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpe1xuICAgICAgICAgICAgICAgIC8vIHJlY3Vyc2l2ZSAgbmVzdGluZyBmdW5jdGlvbiB1c2VkIGJ5IHN1bW1hcml6ZURhdGEgYW5kIHJldHVybktleVZhbHVlc1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXN0QnlBcnJheS5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIpe1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ciAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGN1ciAhPT0gJ2Z1bmN0aW9uJyApIHsgdGhyb3cgJ2VhY2ggbmVzdEJ5IGl0ZW0gbXVzdCBiZSBhIHN0cmluZyBvciBmdW5jdGlvbic7IH1cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJ0bjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnc3RyaW5nJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZFtjdXJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7ICAgIFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ciA9PT0gJ2Z1bmN0aW9uJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgcnRuID0gYWNjLmtleShmdW5jdGlvbihkKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VyKGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJ0bjtcbiAgICAgICAgICAgICAgICB9LCBkMy5uZXN0KCkpO1xuICAgICAgICAgICAgfSwgICAgICAgXG4gICAgICAgICAgICByZXR1cm5LZXlWYWx1ZXModmFsdWVzLCBuZXN0QnksIGNvZXJjZSA9IGZhbHNlLCBuZXN0VHlwZSA9ICdzZXJpZXMnLCB0YWJJbmRleCA9IDApe1xuICAgICAgICAgICAgLy8gdGhpcyBmbiB0YWtlcyBub3JtYWxpemVkIGRhdGEgZmV0Y2hlZCBhcyBhbiBhcnJheSBvZiByb3dzIGFuZCB1c2VzIHRoZSB2YWx1ZXMgaW4gdGhlIGZpcnN0IHJvdyBhcyBrZXlzIGZvciB2YWx1ZXMgaW5cbiAgICAgICAgICAgIC8vIHN1YnNlcXVlbnQgcm93c1xuICAgICAgICAgICAgLy8gbmVzdEJ5ID0gc3RyaW5nIG9yIGFycmF5IG9mIGZpZWxkKHMpIHRvIG5lc3QgYnksIG9yIGEgY3VzdG9tIGZ1bmN0aW9uLCBvciBhbiBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucztcbiAgICAgICAgICAgIC8vIGNvZXJjZSA9IEJPT0wgY29lcmNlIHRvIG51bSBvciBub3Q7IG5lc3RUeXBlID0gb2JqZWN0IG9yIHNlcmllcyBuZXN0IChkMylcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgcHJlbGltO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciB1bm5lc3RlZCA9IHZhbHVlcy5zbGljZSgxKS5tYXAocm93ID0+IHJvdy5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjdXIsIGkpIHsgXG4gICAgICAgICAgICAgICAgLy8gMS4gcGFyYW1zOiB0b3RhbCwgY3VycmVudFZhbHVlLCBjdXJyZW50SW5kZXhbLCBhcnJdXG4gICAgICAgICAgICAgICAgLy8gMy4gLy8gYWNjIGlzIGFuIG9iamVjdCAsIGtleSBpcyBjb3JyZXNwb25kaW5nIHZhbHVlIGZyb20gcm93IDAsIHZhbHVlIGlzIGN1cnJlbnQgdmFsdWUgb2YgYXJyYXlcbiAgICAgICAgICAgICAgICAgIGFjY1t2YWx1ZXNbMF1baV1dID0gY29lcmNlID09PSB0cnVlID8gaXNOYU4oK2N1cikgfHwgY3VyID09PSAnJyA/IGN1ciA6ICtjdXIgOiBjdXI7IFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWNjOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0ZXN0IGZvciBlbXB0eSBzdHJpbmdzIGJlZm9yZSBjb2VyY2luZyBiYyArJycgPT4gMFxuICAgICAgICAgICAgICAgIH0sIHt9KSk7XG4gICAgICAgICAgICAgICAgaWYgKCB0YWJJbmRleCA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51bm5lc3RlZCA9IHVubmVzdGVkO1xuICAgICAgICAgICAgICAgIH0gICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICggIW5lc3RCeSApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgbmVzdEJ5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbmVzdEJ5ID09PSAnZnVuY3Rpb24nICkgeyAvLyBpZSBvbmx5IG9uZSBuZXN0QnkgZmllbGQgb3IgZnVuY2l0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IHRoaXMubmVzdFByZWxpbShbbmVzdEJ5XSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkobmVzdEJ5KSkgeyB0aHJvdyAnbmVzdEJ5IHZhcmlhYmxlIG11c3QgYmUgYSBzdHJpbmcsIGZ1bmN0aW9uLCBvciBhcnJheSBvZiBzdHJpbmdzIG9yIGZ1bmN0aW9ucyc7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWxpbSA9IHRoaXMubmVzdFByZWxpbShuZXN0QnkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICggbmVzdFR5cGUgPT09ICdvYmplY3QnICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVsaW1cbiAgICAgICAgICAgICAgICAgICAgICAgIC5lbnRyaWVzKHVubmVzdGVkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5pdGlhbGl6ZUNoYXJ0cyhjb250YWluZXIpe1xuICAgICAgICAgICAgICAgIHZhciBncm91cCA9IHRoaXM7XG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KGNvbnRhaW5lcikuc2VsZWN0QWxsKCcuZDMtY2hhcnQnKVxuICAgICAgICAgICAgICAgICAgICAuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICAgICAgZ3JvdXAuY2hpbGRyZW4ucHVzaChuZXcgQ2hhcnRzLkNoYXJ0RGl2KHRoaXMsIGdyb3VwKSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSAgICAgICAgXG4gICAgfTsgLy8gRDNDaGFydEdyb3VwIHByb3RvdHlwZSBlbmRzIGhlcmVcbiAgICBcbiAgICB3aW5kb3cuRDNDaGFydHMgPSB7IC8vIG5lZWQgdG8gc3BlY2lmeSB3aW5kb3cgYmMgYWZ0ZXIgdHJhbnNwaWxpbmcgYWxsIHRoaXMgd2lsbCBiZSB3cmFwcGVkIGluIElJRkVzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgYHJldHVybmBpbmcgd29uJ3QgZ2V0IHRoZSBleHBvcnQgaW50byB3aW5kb3cncyBnbG9iYWwgc2NvcGVcbiAgICAgICAgSW5pdCgpe1xuICAgICAgICAgICAgdmFyIGdyb3VwRGl2cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5kMy1ncm91cCcpO1xuICAgICAgICAgICAgZm9yICggbGV0IGkgPSAwOyBpIDwgZ3JvdXBEaXZzLmxlbmd0aDsgaSsrICl7XG4gICAgICAgICAgICAgICAgZ3JvdXBDb2xsZWN0aW9uLnB1c2gobmV3IEQzQ2hhcnRHcm91cChncm91cERpdnNbaV0sIGkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGdyb3VwQ29sbGVjdGlvbik7XG4gICAgICAgIH1cbiAgICB9O1xufSgpKTsgLy8gZW5kIHZhciBEM0NoYXJ0cyBJSUZFIiwiZXhwb3J0IGNvbnN0IENoYXJ0cyA9IChmdW5jdGlvbigpe1xuXG4gICAgdmFyIENoYXJ0RGl2ID0gZnVuY3Rpb24oY29udGFpbmVyLCBwYXJlbnQpe1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICAgICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcbiAgICAgICAgdGhpcy5zZXJpZXNDb3VudCA9IDA7XG4gICAgICAgIHRoaXMuY29uZmlnID0gT2JqZWN0LmNyZWF0ZSggcGFyZW50LmNvbmZpZywgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcnMoIGNvbnRhaW5lci5kYXRhc2V0LmNvbnZlcnQoKSApICk7XG4gICAgICAgICAgICAvLyBsaW5lIGFib3ZlIGNyZWF0ZXMgYSBjb25maWcgb2JqZWN0IGZyb20gdGhlIEhUTUwgZGF0YXNldCBmb3IgdGhlIGNoYXJ0RGl2IGNvbnRhaW5lclxuICAgICAgICAgICAgLy8gdGhhdCBpbmhlcml0cyBmcm9tIHRoZSBwYXJlbnRzIGNvbmZpZyBvYmplY3QuIGFueSBjb25maWdzIG5vdCBzcGVjaWZpZWQgZm9yIHRoZSBjaGFydERpdiAoYW4gb3duIHByb3BlcnR5KVxuICAgICAgICAgICAgLy8gd2lsbCBjb21lIGZyb20gdXAgdGhlIGluaGVyaXRhbmNlIGNoYWluXG4gICAgICAgIHRoaXMuZGF0dW0gPSBwYXJlbnQuZGF0YS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IHRoaXMuY29uZmlnLmNhdGVnb3J5KTtcbiAgICAgICAgdmFyIHNlcmllc0luc3RydWN0ID0gdGhpcy5jb25maWcuc2VyaWVzIHx8ICdhbGwnO1xuICAgICAgICBjb25zb2xlLmxvZyhzZXJpZXNJbnN0cnVjdCk7XG4gICAgICAgIGlmICggQXJyYXkuaXNBcnJheShzZXJpZXNJbnN0cnVjdCkgKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdpcyBhcnJheScsIHRoaXMuZGF0dW0udmFsdWVzKTtcbiAgICAgICAgICAgIHRoaXMuZGF0dW0udmFsdWVzID0gdGhpcy5kYXR1bS52YWx1ZXMuZmlsdGVyKGVhY2ggPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVhY2gua2V5KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VyaWVzSW5zdHJ1Y3QuaW5kZXhPZihlYWNoLmtleSkgIT09IC0xO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIHNlcmllc0luc3RydWN0ICE9PSAnYWxsJyApe1xuICAgICAgICAgICAgY29uc29sZS5sb2coYEludmFsaWQgaW5zdHJ1Y3Rpb24gZnJvbSBIVE1MIGZvciB3aGljaCBjYXRlZ29yaWVzIHRvIGluY2x1ZGUgXG4gICAgICAgICAgICAgICAgICAgICh2YXIgc2VyaWVzSW5zdHJ1Y3QpLiBGYWxsYmFjayB0byBhbGwuYCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zZXJpZXNHcm91cHMgPSB0aGlzLmdyb3VwU2VyaWVzKCk7XG4gICAgICAgIHRoaXMuZGljdGlvbmFyeSA9IHRoaXMucGFyZW50LmRpY3Rpb25hcnk7XG4gICAgICAgIGlmICggdGhpcy5jb25maWcuaGVhZGluZyAhPT0gZmFsc2UgKXtcbiAgICAgICAgICAgIHRoaXMuYWRkSGVhZGluZyh0aGlzLmNvbmZpZy5oZWFkaW5nKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNyZWF0ZUNoYXJ0cygpO1xuXG4gICAgfTtcbiAgICBcbiAgICBDaGFydERpdi5wcm90b3R5cGUgPSB7XG4gICAgICAgIGNoYXJ0VHlwZXM6IHtcbiAgICAgICAgICAgIGxpbmU6ICAgJ0xpbmVDaGFydCcsXG4gICAgICAgICAgICBjb2x1bW46ICdDb2x1bW5DaGFydCcsXG4gICAgICAgICAgICBiYXI6ICAgICdCYXJDaGFydCcgLy8gc28gb24gLiAuIC5cbiAgICAgICAgfSxcbiAgICAgICAgY3JlYXRlQ2hhcnRzKCl7XG4gICAgICAgICAgICB0aGlzLnNlcmllc0dyb3Vwcy5mb3JFYWNoKChlYWNoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKG5ldyBMaW5lQ2hhcnQodGhpcywgZWFjaCkpOyAvLyBUTyBETyBkaXN0aW5ndWlzaCBjaGFydCB0eXBlcyBoZXJlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgZ3JvdXBTZXJpZXMoKXtcbiAgICAgICAgICAgIHZhciBzZXJpZXNHcm91cHMsXG4gICAgICAgICAgICAgICAgZ3JvdXBzSW5zdHJ1Y3QgPSB0aGlzLmNvbmZpZy5zZXJpZXNHcm91cCB8fCAnbm9uZSc7XG4gICAgICAgICAgICBpZiAoIEFycmF5LmlzQXJyYXkoIGdyb3Vwc0luc3RydWN0ICkgKSB7XG4gICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gW107XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWcuc2VyaWVzR3JvdXAuZm9yRWFjaChncm91cCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNlcmllc0dyb3Vwcy5wdXNoKHRoaXMuZGF0dW0udmFsdWVzLmZpbHRlcihzZXJpZXMgPT4gZ3JvdXAuaW5kZXhPZihzZXJpZXMua2V5KSAhPT0gLTEpKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnbm9uZScgKSB7XG4gICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzID0gdGhpcy5kYXR1bS52YWx1ZXMubWFwKGVhY2ggPT4gW2VhY2hdKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIGdyb3Vwc0luc3RydWN0ID09PSAnYWxsJyApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbdGhpcy5kYXR1bS52YWx1ZXMubWFwKGVhY2ggPT4gZWFjaCldO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgSW52YWxpZCBkYXRhLWdyb3VwLXNlcmllcyBpbnN0cnVjdGlvbiBmcm9tIGh0bWwuIFxuICAgICAgICAgICAgICAgICAgICAgICBNdXN0IGJlIHZhbGlkIEpTT046IFwiTm9uZVwiIG9yIFwiQWxsXCIgb3IgYW4gYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgICAgb2YgYXJyYXlzIGNvbnRhaW5pbmcgdGhlIHNlcmllcyB0byBiZSBncm91cGVkXG4gICAgICAgICAgICAgICAgICAgICAgIHRvZ2V0aGVyLiBBbGwgc3RyaW5ncyBtdXN0IGJlIGRvdWJsZS1xdW90ZWQuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc2VyaWVzR3JvdXBzO1xuICAgICAgICB9LCAvLyBlbmQgZ3JvdXBTZXJpZXMoKVxuICAgICAgICBhZGRIZWFkaW5nKGlucHV0KXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGlucHV0KTtcbiAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzLmNvbnRhaW5lcilcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdwJylcbiAgICAgICAgICAgICAgICAuaHRtbCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBoZWFkaW5nID0gdHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJyA/IGlucHV0IDogdGhpcy5sYWJlbCh0aGlzLmNvbmZpZy5jYXRlZ29yeSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnPHN0cm9uZz4nICsgaGVhZGluZyArICc8L3N0cm9uZz4nO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBsYWJlbChrZXkpe1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGljdGlvbmFyeS5maW5kKGVhY2ggPT4gZWFjaC5rZXkgPT09IGtleSkubGFiZWw7XG4gICAgICAgIH0sXG4gICAgICAgIHVuaXRzKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS51bml0czsgIFxuICAgICAgICB9LFxuICAgICAgICB0aXBUZXh0KGtleSl7XG4gICAgICAgICAgICB2YXIgc3RyID0gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbC5yZXBsYWNlKC9cXFxcbi9nLCcgJyk7XG4gICAgICAgICAgICByZXR1cm4gc3RyLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgc3RyLnNsaWNlKDEpO1xuICAgICAgICB9XG5cbiAgICB9OyAvLyBlbmQgTGluZUNoYXJ0LnByb3RvdHlwZVxuXG4gICAgdmFyIExpbmVDaGFydCA9IGZ1bmN0aW9uKHBhcmVudCwgc2VyaWVzR3JvdXApe1xuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBwYXJlbnQuY29uZmlnO1xuICAgICAgICB0aGlzLm1hcmdpblRvcCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5Ub3AgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy50b3A7XG4gICAgICAgIHRoaXMubWFyZ2luUmlnaHQgPSArdGhpcy5jb25maWcubWFyZ2luUmlnaHQgfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5yaWdodDtcbiAgICAgICAgdGhpcy5tYXJnaW5Cb3R0b20gPSArdGhpcy5jb25maWcubWFyZ2luQm90dG9tIHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMuYm90dG9tO1xuICAgICAgICB0aGlzLm1hcmdpbkxlZnQgPSArdGhpcy5jb25maWcubWFyZ2luTGVmdCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLmxlZnQ7XG4gICAgICAgIHRoaXMud2lkdGggPSB0aGlzLmNvbmZpZy5zdmdXaWR0aCA/ICt0aGlzLmNvbmZpZy5zdmdXaWR0aCAtIHRoaXMubWFyZ2luUmlnaHQgLSB0aGlzLm1hcmdpbkxlZnQgOiAzMjAgLSB0aGlzLm1hcmdpblJpZ2h0IC0gdGhpcy5tYXJnaW5MZWZ0O1xuICAgICAgICB0aGlzLmhlaWdodCA9IHRoaXMuY29uZmlnLnN2Z0hlaWdodCA/ICt0aGlzLmNvbmZpZy5zdmdIZWlnaHQgLSB0aGlzLm1hcmdpblRvcCAtIHRoaXMubWFyZ2luQm90dG9tIDogKCB0aGlzLndpZHRoICsgdGhpcy5tYXJnaW5SaWdodCArIHRoaXMubWFyZ2luTGVmdCApIC8gMiAtIHRoaXMubWFyZ2luVG9wIC0gdGhpcy5tYXJnaW5Cb3R0b207XG4gICAgICAgIHRoaXMuZGF0YSA9IHNlcmllc0dyb3VwO1xuICAgICAgICBjb25zb2xlLmxvZyh0aGlzKTtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSB0aGlzLmluaXQocGFyZW50LmNvbnRhaW5lcik7XG4gICAgICAgIHRoaXMueFNjYWxlVHlwZSA9IHRoaXMuY29uZmlnLnhTY2FsZVR5cGUgfHwgJ3RpbWUnO1xuICAgICAgICB0aGlzLnlTY2FsZVR5cGUgPSB0aGlzLmNvbmZpZy55U2NhbGVUeXBlIHx8ICdsaW5lYXInO1xuICAgICAgICB0aGlzLnhUaW1lVHlwZSA9IHRoaXMuY29uZmlnLnhUaW1lVHlwZSB8fCAnJVknO1xuICAgICAgICB0aGlzLnNjYWxlQnkgPSB0aGlzLmNvbmZpZy5zY2FsZUJ5IHx8ICdzZXJpZXMtZ3JvdXAnO1xuICAgICAgICB0aGlzLnNldFNjYWxlcygpOyAvLyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgXG4gICAgICAgIHRoaXMuc2V0VG9vbHRpcHMoKTtcbiAgICAgICAgdGhpcy5hZGRMaW5lcygpO1xuICAgICAgICB0aGlzLmFkZFBvaW50cygpO1xuICAgICAgICB0aGlzLmFkZFhBeGlzKCk7XG4gICAgICAgIHRoaXMuYWRkWUF4aXMoKTtcbiAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy5kaXJlY3RMYWJlbCA9PT0gdHJ1ZSApe1xuICAgICAgICAgICAgdGhpcy5hZGRMYWJlbHMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHRoaXMuYWRkTGVnZW5kcygpO1xuICAgICAgICB9XG4gICAgICAgICAgICAgICBcbiAgICB9O1xuXG4gICAgTGluZUNoYXJ0LnByb3RvdHlwZSA9IHsgLy8gZWFjaCBMaW5lQ2hhcnQgaXMgYW4gc3ZnIHRoYXQgaG9sZCBncm91cGVkIHNlcmllc1xuICAgICAgICBkZWZhdWx0TWFyZ2luczoge1xuICAgICAgICAgICAgdG9wOjIwLFxuICAgICAgICAgICAgcmlnaHQ6NDUsXG4gICAgICAgICAgICBib3R0b206MTUsXG4gICAgICAgICAgICBsZWZ0OjM1XG4gICAgICAgIH0sXG4gICAgICAgICAgICAgIFxuICAgICAgICBpbml0KGNoYXJ0RGl2KXsgLy8gLy9TSE9VTEQgQkUgSU4gQ0hBUlQgUFJPVE9UWVBFIHRoaXMgaXMgY2FsbGVkIG9uY2UgZm9yIGVhY2ggc2VyaWVzR3JvdXAgb2YgZWFjaCBjYXRlZ29yeS4gXG4gICAgICAgICAgICB2YXIgY29udGFpbmVyID0gIGQzLnNlbGVjdChjaGFydERpdilcbiAgICAgICAgICAgICAgICAuYXBwZW5kKCdzdmcnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIHRoaXMud2lkdGggKyB0aGlzLm1hcmdpblJpZ2h0ICsgdGhpcy5tYXJnaW5MZWZ0IClcbiAgICAgICAgICAgICAgICAuYXR0cignaGVpZ2h0JywgdGhpcy5oZWlnaHQgICsgdGhpcy5tYXJnaW5Ub3AgKyB0aGlzLm1hcmdpbkJvdHRvbSApO1xuXG4gICAgICAgICAgICB0aGlzLnN2ZyA9IGNvbnRhaW5lci5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLGB0cmFuc2xhdGUoJHt0aGlzLm1hcmdpbkxlZnR9LCAke3RoaXMubWFyZ2luVG9wfSlgKTtcblxuICAgICAgICAgICAgdGhpcy5lYWNoU2VyaWVzID0gdGhpcy5zdmcuc2VsZWN0QWxsKCdlYWNoLXNlcmllcycpXG4gICAgICAgICAgICAgICAgLmRhdGEodGhpcy5kYXRhKVxuICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2VhY2gtc2VyaWVzIHNlcmllcy0nICsgdGhpcy5wYXJlbnQuc2VyaWVzQ291bnQgKyAnIGNvbG9yLScgKyB0aGlzLnBhcmVudC5zZXJpZXNDb3VudCsrICUgMztcbiAgICAgICAgICAgICAgICB9KTtcbi8qXG4gICAgICAgICAgICB0aGlzLmVhY2hTZXJpZXMuZWFjaCgoZCxpLGFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnQuc2VyaWVzQXJyYXkucHVzaChhcnJheVtpXSk7XG4gICAgICAgICAgICB9KTsqL1xuXG5cblxuICAgICAgICAgICAgcmV0dXJuIGNvbnRhaW5lci5ub2RlKCk7XG4gICAgICAgIH0sXG4gICAgICAgIHNldFNjYWxlcygpeyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgLy8gVE8gRE86IFNFVCBTQ0FMRVMgRk9SIE9USEVSIEdST1VQIFRZUEVTXG4gICAgICAgICAgICB2YXIgZDNTY2FsZSA9IHtcbiAgICAgICAgICAgICAgICB0aW1lOiBkMy5zY2FsZVRpbWUoKSxcbiAgICAgICAgICAgICAgICBsaW5lYXI6IGQzLnNjYWxlTGluZWFyKClcbiAgICAgICAgICAgICAgICAvLyBUTyBETzogYWRkIGFsbCBzY2FsZSB0eXBlcy5cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2YXIgeE1heGVzID0gW10sIHhNaW5zID0gW10sIHlNYXhlcyA9IFtdLCB5TWlucyA9IFtdO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnNjYWxlQnkgPT09ICdzZXJpZXMtZ3JvdXAnICl7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLmZvckVhY2goZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVhY2gsIHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV0pO1xuICAgICAgICAgICAgICAgICAgICB4TWF4ZXMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1bdGhpcy5jb25maWcudmFyaWFibGVYXS5tYXgpO1xuICAgICAgICAgICAgICAgICAgICB4TWlucy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt0aGlzLmNvbmZpZy52YXJpYWJsZVhdLm1pbik7XG4gICAgICAgICAgICAgICAgICAgIHlNYXhlcy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt0aGlzLmNvbmZpZy52YXJpYWJsZVldLm1heCk7XG4gICAgICAgICAgICAgICAgICAgIHlNaW5zLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0ubWluKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMueE1heCA9IGQzLm1heCh4TWF4ZXMpO1xuICAgICAgICAgICAgdGhpcy54TWluID0gZDMubWluKHhNaW5zKTtcbiAgICAgICAgICAgIHRoaXMueU1heCA9IGQzLm1heCh5TWF4ZXMpO1xuICAgICAgICAgICAgdGhpcy55TWluID0gZDMubWluKHlNaW5zKTtcbiAgICAgICAgICAgIHRoaXMueFZhbHVlc1VuaXF1ZSA9IFtdO1xuXG4gICAgICAgICAgICB2YXIgeFJhbmdlID0gWzAsIHRoaXMud2lkdGhdLFxuICAgICAgICAgICAgICAgIHlSYW5nZSA9IFt0aGlzLmhlaWdodCwgMF0sXG4gICAgICAgICAgICAgICAgeERvbWFpbixcbiAgICAgICAgICAgICAgICB5RG9tYWluO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnhTY2FsZVR5cGUgPT09ICd0aW1lJykge1xuICAgICAgICAgICAgICAgIHhEb21haW4gPSBbZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKSh0aGlzLnhNaW4pLCBkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKHRoaXMueE1heCldO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gVE8gRE86IE9USEVSIGRhdGEgdHlwZXMgP1xuICAgICAgICAgICAgICAgIHhEb21haW4gPSBbdGhpcy54TWluLCB0aGlzLnhNYXhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCB0aGlzLnlTY2FsZVR5cGUgPT09ICd0aW1lJykge1xuICAgICAgICAgICAgICAgIHlEb21haW4gPSBbZDMudGltZVBhcnNlKHRoaXMueVRpbWVUeXBlKSh0aGlzLnlNaW4pLCBkMy50aW1lUGFyc2UodGhpcy55VGltZVR5cGUpKHRoaXMueU1heCldO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gVE8gRE86IE9USEVSIGRhdGEgdHlwZXMgP1xuICAgICAgICAgICAgICAgIHlEb21haW4gPSBbdGhpcy55TWluLCB0aGlzLnlNYXhdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnhTY2FsZSA9IGQzU2NhbGVbdGhpcy54U2NhbGVUeXBlXS5kb21haW4oeERvbWFpbikucmFuZ2UoeFJhbmdlKTtcbiAgICAgICAgICAgIHRoaXMueVNjYWxlID0gZDNTY2FsZVt0aGlzLnlTY2FsZVR5cGVdLmRvbWFpbih5RG9tYWluKS5yYW5nZSh5UmFuZ2UpO1xuXG4gICAgICAgIH0sXG4gICAgICAgIGFkZExpbmVzKCl7XG4gICAgICAgICAgICB2YXIgdmFsdWVsaW5lID0gZDMubGluZSgpXG4gICAgICAgICAgICAgICAgLngoZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdGhpcy54VmFsdWVzVW5pcXVlLmluZGV4T2YoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSA9PT0gLTEgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMueFZhbHVlc1VuaXF1ZS5wdXNoKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMueFNjYWxlKGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKSk7XG4gICAgICAgICAgICAgICAgfSkgXG4gICAgICAgICAgICAgICAgLnkoZCA9PiB0aGlzLnlTY2FsZShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0pKTsgLy8gISEgbm90IHByb2dyYW1tYXRpY1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLmxpbmVzID0gdGhpcy5lYWNoU2VyaWVzLmFwcGVuZCgncGF0aCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywnbGluZScpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2QnLCAoZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWVsaW5lKGQudmFsdWVzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgYWRkWEF4aXMoKXsgLy8gY291bGQgYmUgaW4gQ2hhcnQgcHJvdG90eXBlID9cbiAgICAgICAgICAgIHZhciB5QXhpc1Bvc2l0aW9uLFxuICAgICAgICAgICAgICAgIHlBeGlzT2Zmc2V0LFxuICAgICAgICAgICAgICAgIGF4aXNUeXBlO1xuXG4gICAgICAgICAgICBpZiAoIHRoaXMuY29uZmlnLnlBeGlzUG9zaXRpb24gPT09ICd6ZXJvJyApe1xuICAgICAgICAgICAgICAgIHlBeGlzUG9zaXRpb24gPSAwO1xuICAgICAgICAgICAgICAgIHlBeGlzT2Zmc2V0ID0gMDtcbiAgICAgICAgICAgICAgICBheGlzVHlwZSA9IGQzLmF4aXNCb3R0b207XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICggdGhpcy5jb25maWcueUF4aXNQb3NpdGlvbiA9PT0gJ3RvcCcgKXtcbiAgICAgICAgICAgICAgICB5QXhpc1Bvc2l0aW9uID0gdGhpcy55TWF4O1xuICAgICAgICAgICAgICAgIHlBeGlzT2Zmc2V0ID0gLXRoaXMubWFyZ2luVG9wO1xuICAgICAgICAgICAgICAgIGF4aXNUeXBlID0gZDMuYXhpc1RvcDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgeUF4aXNQb3NpdGlvbiA9IHRoaXMueU1pbjtcbiAgICAgICAgICAgICAgICB5QXhpc09mZnNldCA9IDA7XG4gICAgICAgICAgICAgICAgYXhpc1R5cGUgPSBkMy5heGlzQm90dG9tO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIGF4aXMgPSBheGlzVHlwZSh0aGlzLnhTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpO1xuICAgICAgICAgICAgaWYgKCB0aGlzLnhTY2FsZVR5cGUgPT09ICd0aW1lJyApe1xuICAgICAgICAgICAgICAgIGF4aXMudGlja1ZhbHVlcyh0aGlzLnhWYWx1ZXNVbmlxdWUubWFwKGVhY2ggPT4gZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShlYWNoKSkpOyAvLyBUTyBETzogYWxsb3cgZm9yIG90aGVyIHhBeGlzIEFkanVzdG1lbnRzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN2Zy5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKDAsJyArICggdGhpcy55U2NhbGUoeUF4aXNQb3NpdGlvbikgKyB5QXhpc09mZnNldCApICsgJyknKSAvLyBub3QgcHJvZ3JhbWF0aWMgcGxhY2VtZW50IG9mIHgtYXhpc1xuICAgICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzIHgtYXhpcycpXG4gICAgICAgICAgICAgICAgLmNhbGwoYXhpcyk7XG4gICAgICAgIH0sXG4gICAgICAgIGFkZFlBeGlzKCl7XG4gICAgICAgICAgICAvKiBheGlzICovXG4gICAgICAgICAgICB0aGlzLnN2Zy5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiAnYXhpcyB5LWF4aXMgJylcbiAgICAgICAgICAgICAgLmNhbGwoZDMuYXhpc0xlZnQodGhpcy55U2NhbGUpLnRpY2tTaXplSW5uZXIoNCkudGlja1NpemVPdXRlcigwKS50aWNrUGFkZGluZygxKS50aWNrcyg1KSk7XG5cbiAgICAgICAgICAgIC8qIGxhYmVscyAqL1xuICAgICAgICAgICAgdGhpcy5lYWNoU2VyaWVzLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICd1bml0cycpXG4gICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoKSA9PiBgdHJhbnNsYXRlKC0ke3RoaXMubWFyZ2luTGVmdH0sLSR7dGhpcy5tYXJnaW5Ub3AgLSAxMH0pYClcbiAgICAgICAgICAgICAgLnRleHQoKGQsaSkgPT4gaSA9PT0gMCA/IHRoaXMucGFyZW50LnVuaXRzKGQua2V5KSA6IG51bGwpO1xuICAgICAgICAgICAgXG4gICAgICAgIH0sXG4gICAgICAgIGFkZExhYmVscygpe1xuICAgICAgICAgICAgdGhpcy5lYWNoU2VyaWVzLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3Nlcmllcy1sYWJlbCcpXG4gICAgICAgICAgICAgICAgLmh0bWwoKGQpID0+ICc8dHNwYW4geD1cIjBcIj4nICsgdGhpcy5wYXJlbnQubGFiZWwoZC5rZXkpLnJlcGxhY2UoL1xcXFxuL2csJzwvdHNwYW4+PHRzcGFuIHg9XCIwXCIgZHk9XCIxLjJlbVwiPicpICsgJzwvdHNwYW4+JylcbiAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgKGQpID0+IGB0cmFuc2xhdGUoJHt0aGlzLndpZHRoICsgNX0sICR7dGhpcy55U2NhbGUoZC52YWx1ZXNbZC52YWx1ZXMubGVuZ3RoIC0gMV1bdGhpcy5jb25maWcudmFyaWFibGVZXSkgKyAzfSlgKTtcbiAgICAgICAgfSxcbiAgICAgICAgYWRkUG9pbnRzKCl7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMucG9pbnRzID0gdGhpcy5lYWNoU2VyaWVzLnNlbGVjdEFsbCgncG9pbnRzJylcbiAgICAgICAgICAgICAgICAuZGF0YShkID0+IGQudmFsdWVzKVxuICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnY2lyY2xlJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnZGF0YS1wb2ludCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3InLCAnNCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2N4JywgZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjeScsIGQgPT4gdGhpcy55U2NhbGUoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVldKSlcbiAgICAgICAgICAgICAgICAub24oJ21vdXNlb3ZlcicsIChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrbGFzcyA9IGFycmF5W2ldLnBhcmVudE5vZGUuY2xhc3NMaXN0LnZhbHVlLm1hdGNoKC9jb2xvci1cXGQvKVswXTsgLy8gZ2V0IHRoZSBjb2xvciBjbGFzcyBvZiB0aGUgcGFyZW50IGdcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJywgdGhpcy50b29sdGlwLmF0dHIoJ2NsYXNzJykgKyAnICcgKyBrbGFzcyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5odG1sKCc8c3Ryb25nPicgKyB0aGlzLnBhcmVudC50aXBUZXh0KGQuc2VyaWVzKSArICc8L3N0cm9uZz4gKCcgKyBkLnllYXIgKyAnKTxiciAvPicgKyBkW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0gKyAnICcgKyB0aGlzLnBhcmVudC51bml0cyhkLnNlcmllcykgKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLnNob3coKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5vbignbW91c2VvdXQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycsIHRoaXMudG9vbHRpcC5hdHRyKCdjbGFzcycpLnJlcGxhY2UoLyBjb2xvci1cXGQvZywgJycpKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sdGlwLmh0bWwoJycpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRvb2x0aXAuaGlkZSgpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhbGwodGhpcy50b29sdGlwKTtcblxuICAgICAgICAgICAgXG4gICAgICAgIH0sXG4gICAgICAgIHNldFRvb2x0aXBzKCl7XG5cbiAgICAgICAgICAgIHRoaXMudG9vbHRpcCA9IGQzLnRpcCgpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcImQzLXRpcFwiKVxuICAgICAgICAgICAgICAgIC5kaXJlY3Rpb24oJ24nKVxuICAgICAgICAgICAgICAgIC5vZmZzZXQoWy04LCAwXSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICB9O1xuXG5cbiAgICByZXR1cm4ge1xuICAgICAgICBDaGFydERpdlxuICAgIH07XG5cbn0pKCk7XG4iLCJleHBvcnQgY29uc3QgSGVscGVycyA9IChmdW5jdGlvbigpe1xuICAgIC8qIGdsb2JhbHMgRE9NU3RyaW5nTWFwICovXG4gICAgU3RyaW5nLnByb3RvdHlwZS5jbGVhblN0cmluZyA9IGZ1bmN0aW9uKCkgeyAvLyBsb3dlcmNhc2UgYW5kIHJlbW92ZSBwdW5jdHVhdGlvbiBhbmQgcmVwbGFjZSBzcGFjZXMgd2l0aCBoeXBoZW5zOyBkZWxldGUgcHVuY3R1YXRpb25cbiAgICAgICAgcmV0dXJuIHRoaXMucmVwbGFjZSgvWyBcXFxcXFwvXS9nLCctJykucmVwbGFjZSgvWydcIuKAneKAmeKAnOKAmCxcXC4hXFw/O1xcKFxcKSZdL2csJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgfTtcblxuICAgIFN0cmluZy5wcm90b3R5cGUucmVtb3ZlVW5kZXJzY29yZXMgPSBmdW5jdGlvbigpIHsgXG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL18vZywnICcpO1xuICAgIH07XG5cbiAgICBET01TdHJpbmdNYXAucHJvdG90eXBlLmNvbnZlcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG5ld09iaiA9IHt9O1xuICAgICAgICBmb3IgKCB2YXIga2V5IGluIHRoaXMgKXtcbiAgICAgICAgICAgIGlmICh0aGlzLmhhc093blByb3BlcnR5KGtleSkpe1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld09ialtrZXldID0gSlNPTi5wYXJzZSh0aGlzW2tleV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3T2JqW2tleV0gPSB0aGlzW2tleV07ICAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdPYmo7XG4gICAgfTtcbn0pKCk7XG4iLCIvLyBkMy50aXBcbi8vIENvcHlyaWdodCAoYykgMjAxMyBKdXN0aW4gUGFsbWVyXG4vLyBFUzYgLyBEMyB2NCBBZGFwdGlvbiBDb3B5cmlnaHQgKGMpIDIwMTYgQ29uc3RhbnRpbiBHYXZyaWxldGVcbi8vIFJlbW92YWwgb2YgRVM2IGZvciBEMyB2NCBBZGFwdGlvbiBDb3B5cmlnaHQgKGMpIDIwMTYgRGF2aWQgR290elxuLy9cbi8vIFRvb2x0aXBzIGZvciBkMy5qcyBTVkcgdmlzdWFsaXphdGlvbnNcblxuZXhwb3J0IGNvbnN0IGQzVGlwID0gKGZ1bmN0aW9uKCl7XG4gIGQzLmZ1bmN0b3IgPSBmdW5jdGlvbiBmdW5jdG9yKHYpIHtcbiAgICByZXR1cm4gdHlwZW9mIHYgPT09IFwiZnVuY3Rpb25cIiA/IHYgOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB2O1xuICAgIH07XG4gIH07XG5cbiAgZDMudGlwID0gZnVuY3Rpb24oKSB7XG5cbiAgICB2YXIgZGlyZWN0aW9uID0gZDNfdGlwX2RpcmVjdGlvbixcbiAgICAgICAgb2Zmc2V0ICAgID0gZDNfdGlwX29mZnNldCxcbiAgICAgICAgaHRtbCAgICAgID0gZDNfdGlwX2h0bWwsXG4gICAgICAgIG5vZGUgICAgICA9IGluaXROb2RlKCksXG4gICAgICAgIHN2ZyAgICAgICA9IG51bGwsXG4gICAgICAgIHBvaW50ICAgICA9IG51bGwsXG4gICAgICAgIHRhcmdldCAgICA9IG51bGxcblxuICAgIGZ1bmN0aW9uIHRpcCh2aXMpIHtcbiAgICAgIHN2ZyA9IGdldFNWR05vZGUodmlzKVxuICAgICAgcG9pbnQgPSBzdmcuY3JlYXRlU1ZHUG9pbnQoKVxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKVxuICAgIH1cblxuICAgIC8vIFB1YmxpYyAtIHNob3cgdGhlIHRvb2x0aXAgb24gdGhlIHNjcmVlblxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5zaG93ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgIGlmKGFyZ3NbYXJncy5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIFNWR0VsZW1lbnQpIHRhcmdldCA9IGFyZ3MucG9wKClcblxuICAgICAgdmFyIGNvbnRlbnQgPSBodG1sLmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIHBvZmZzZXQgPSBvZmZzZXQuYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgZGlyICAgICA9IGRpcmVjdGlvbi5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBub2RlbCAgID0gZ2V0Tm9kZUVsKCksXG4gICAgICAgICAgaSAgICAgICA9IGRpcmVjdGlvbnMubGVuZ3RoLFxuICAgICAgICAgIGNvb3JkcyxcbiAgICAgICAgICBzY3JvbGxUb3AgID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcCB8fCBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCxcbiAgICAgICAgICBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQgfHwgZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0XG5cbiAgICAgIG5vZGVsLmh0bWwoY29udGVudClcbiAgICAgICAgLnN0eWxlKCdwb3NpdGlvbicsICdhYnNvbHV0ZScpXG4gICAgICAgIC5zdHlsZSgnb3BhY2l0eScsIDEpXG4gICAgICAgIC5zdHlsZSgncG9pbnRlci1ldmVudHMnLCAnYWxsJylcblxuICAgICAgd2hpbGUoaS0tKSBub2RlbC5jbGFzc2VkKGRpcmVjdGlvbnNbaV0sIGZhbHNlKVxuICAgICAgY29vcmRzID0gZGlyZWN0aW9uX2NhbGxiYWNrc1tkaXJdLmFwcGx5KHRoaXMpXG4gICAgICBub2RlbC5jbGFzc2VkKGRpciwgdHJ1ZSlcbiAgICAgICAgLnN0eWxlKCd0b3AnLCAoY29vcmRzLnRvcCArICBwb2Zmc2V0WzBdKSArIHNjcm9sbFRvcCArICdweCcpXG4gICAgICAgIC5zdHlsZSgnbGVmdCcsIChjb29yZHMubGVmdCArIHBvZmZzZXRbMV0pICsgc2Nyb2xsTGVmdCArICdweCcpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWMgLSBoaWRlIHRoZSB0b29sdGlwXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIGEgdGlwXG4gICAgdGlwLmhpZGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBub2RlbCA9IGdldE5vZGVFbCgpXG4gICAgICBub2RlbFxuICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAwKVxuICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKVxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogUHJveHkgYXR0ciBjYWxscyB0byB0aGUgZDMgdGlwIGNvbnRhaW5lci4gIFNldHMgb3IgZ2V0cyBhdHRyaWJ1dGUgdmFsdWUuXG4gICAgLy9cbiAgICAvLyBuIC0gbmFtZSBvZiB0aGUgYXR0cmlidXRlXG4gICAgLy8gdiAtIHZhbHVlIG9mIHRoZSBhdHRyaWJ1dGVcbiAgICAvL1xuICAgIC8vIFJldHVybnMgdGlwIG9yIGF0dHJpYnV0ZSB2YWx1ZVxuICAgIHRpcC5hdHRyID0gZnVuY3Rpb24obiwgdikge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyICYmIHR5cGVvZiBuID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZ2V0Tm9kZUVsKCkuYXR0cihuKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGFyZ3MgPSAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxuICAgICAgICBkMy5zZWxlY3Rpb24ucHJvdG90eXBlLmF0dHIuYXBwbHkoZ2V0Tm9kZUVsKCksIGFyZ3MpXG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFByb3h5IHN0eWxlIGNhbGxzIHRvIHRoZSBkMyB0aXAgY29udGFpbmVyLiAgU2V0cyBvciBnZXRzIGEgc3R5bGUgdmFsdWUuXG4gICAgLy9cbiAgICAvLyBuIC0gbmFtZSBvZiB0aGUgcHJvcGVydHlcbiAgICAvLyB2IC0gdmFsdWUgb2YgdGhlIHByb3BlcnR5XG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIHRpcCBvciBzdHlsZSBwcm9wZXJ0eSB2YWx1ZVxuICAgIHRpcC5zdHlsZSA9IGZ1bmN0aW9uKG4sIHYpIHtcbiAgICAgIC8vIGRlYnVnZ2VyO1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyICYmIHR5cGVvZiBuID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZ2V0Tm9kZUVsKCkuc3R5bGUobilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgdmFyIHN0eWxlcyA9IGFyZ3NbMF07XG4gICAgICAgICAgT2JqZWN0LmtleXMoc3R5bGVzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIGQzLnNlbGVjdGlvbi5wcm90b3R5cGUuc3R5bGUuYXBwbHkoZ2V0Tm9kZUVsKCksIFtrZXksIHN0eWxlc1trZXldXSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogU2V0IG9yIGdldCB0aGUgZGlyZWN0aW9uIG9mIHRoZSB0b29sdGlwXG4gICAgLy9cbiAgICAvLyB2IC0gT25lIG9mIG4obm9ydGgpLCBzKHNvdXRoKSwgZShlYXN0KSwgb3Igdyh3ZXN0KSwgbncobm9ydGh3ZXN0KSxcbiAgICAvLyAgICAgc3coc291dGh3ZXN0KSwgbmUobm9ydGhlYXN0KSBvciBzZShzb3V0aGVhc3QpXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIHRpcCBvciBkaXJlY3Rpb25cbiAgICB0aXAuZGlyZWN0aW9uID0gZnVuY3Rpb24odikge1xuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gZGlyZWN0aW9uXG4gICAgICBkaXJlY3Rpb24gPSB2ID09IG51bGwgPyB2IDogZDMuZnVuY3Rvcih2KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBTZXRzIG9yIGdldHMgdGhlIG9mZnNldCBvZiB0aGUgdGlwXG4gICAgLy9cbiAgICAvLyB2IC0gQXJyYXkgb2YgW3gsIHldIG9mZnNldFxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBvZmZzZXQgb3JcbiAgICB0aXAub2Zmc2V0ID0gZnVuY3Rpb24odikge1xuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gb2Zmc2V0XG4gICAgICBvZmZzZXQgPSB2ID09IG51bGwgPyB2IDogZDMuZnVuY3Rvcih2KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBzZXRzIG9yIGdldHMgdGhlIGh0bWwgdmFsdWUgb2YgdGhlIHRvb2x0aXBcbiAgICAvL1xuICAgIC8vIHYgLSBTdHJpbmcgdmFsdWUgb2YgdGhlIHRpcFxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBodG1sIHZhbHVlIG9yIHRpcFxuICAgIHRpcC5odG1sID0gZnVuY3Rpb24odikge1xuICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gaHRtbFxuICAgICAgaHRtbCA9IHYgPT0gbnVsbCA/IHYgOiBkMy5mdW5jdG9yKHYpXG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IGRlc3Ryb3lzIHRoZSB0b29sdGlwIGFuZCByZW1vdmVzIGl0IGZyb20gdGhlIERPTVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZihub2RlKSB7XG4gICAgICAgIGdldE5vZGVFbCgpLnJlbW92ZSgpO1xuICAgICAgICBub2RlID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aXA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZDNfdGlwX2RpcmVjdGlvbigpIHsgcmV0dXJuICduJyB9XG4gICAgZnVuY3Rpb24gZDNfdGlwX29mZnNldCgpIHsgcmV0dXJuIFswLCAwXSB9XG4gICAgZnVuY3Rpb24gZDNfdGlwX2h0bWwoKSB7IHJldHVybiAnICcgfVxuXG4gICAgdmFyIGRpcmVjdGlvbl9jYWxsYmFja3MgPSB7XG4gICAgICBuOiAgZGlyZWN0aW9uX24sXG4gICAgICBzOiAgZGlyZWN0aW9uX3MsXG4gICAgICBlOiAgZGlyZWN0aW9uX2UsXG4gICAgICB3OiAgZGlyZWN0aW9uX3csXG4gICAgICBudzogZGlyZWN0aW9uX253LFxuICAgICAgbmU6IGRpcmVjdGlvbl9uZSxcbiAgICAgIHN3OiBkaXJlY3Rpb25fc3csXG4gICAgICBzZTogZGlyZWN0aW9uX3NlXG4gICAgfTtcblxuICAgIHZhciBkaXJlY3Rpb25zID0gT2JqZWN0LmtleXMoZGlyZWN0aW9uX2NhbGxiYWNrcyk7XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fbigpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm4ueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm4ueCAtIG5vZGUub2Zmc2V0V2lkdGggLyAyXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3MoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zLnksXG4gICAgICAgIGxlZnQ6IGJib3gucy54IC0gbm9kZS5vZmZzZXRXaWR0aCAvIDJcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LmUueSAtIG5vZGUub2Zmc2V0SGVpZ2h0IC8gMixcbiAgICAgICAgbGVmdDogYmJveC5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fdygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LncueSAtIG5vZGUub2Zmc2V0SGVpZ2h0IC8gMixcbiAgICAgICAgbGVmdDogYmJveC53LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX253KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubncueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm53LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX25lKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gubmUueSAtIG5vZGUub2Zmc2V0SGVpZ2h0LFxuICAgICAgICBsZWZ0OiBiYm94Lm5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkaXJlY3Rpb25fc3coKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5zdy55LFxuICAgICAgICBsZWZ0OiBiYm94LnN3LnggLSBub2RlLm9mZnNldFdpZHRoXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3NlKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guc2UueSxcbiAgICAgICAgbGVmdDogYmJveC5lLnhcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0Tm9kZSgpIHtcbiAgICAgIHZhciBub2RlID0gZDMuc2VsZWN0KGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKVxuICAgICAgbm9kZVxuICAgICAgICAuc3R5bGUoJ3Bvc2l0aW9uJywgJ2Fic29sdXRlJylcbiAgICAgICAgLnN0eWxlKCd0b3AnLCAwKVxuICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAwKVxuICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKVxuICAgICAgICAuc3R5bGUoJ2JveC1zaXppbmcnLCAnYm9yZGVyLWJveCcpXG5cbiAgICAgIHJldHVybiBub2RlLm5vZGUoKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNWR05vZGUoZWwpIHtcbiAgICAgIGVsID0gZWwubm9kZSgpXG4gICAgICBpZihlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdzdmcnKVxuICAgICAgICByZXR1cm4gZWxcblxuICAgICAgcmV0dXJuIGVsLm93bmVyU1ZHRWxlbWVudFxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldE5vZGVFbCgpIHtcbiAgICAgIGlmKG5vZGUgPT09IG51bGwpIHtcbiAgICAgICAgbm9kZSA9IGluaXROb2RlKCk7XG4gICAgICAgIC8vIHJlLWFkZCBub2RlIHRvIERPTVxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG5vZGUpO1xuICAgICAgfTtcbiAgICAgIHJldHVybiBkMy5zZWxlY3Qobm9kZSk7XG4gICAgfVxuXG4gICAgLy8gUHJpdmF0ZSAtIGdldHMgdGhlIHNjcmVlbiBjb29yZGluYXRlcyBvZiBhIHNoYXBlXG4gICAgLy9cbiAgICAvLyBHaXZlbiBhIHNoYXBlIG9uIHRoZSBzY3JlZW4sIHdpbGwgcmV0dXJuIGFuIFNWR1BvaW50IGZvciB0aGUgZGlyZWN0aW9uc1xuICAgIC8vIG4obm9ydGgpLCBzKHNvdXRoKSwgZShlYXN0KSwgdyh3ZXN0KSwgbmUobm9ydGhlYXN0KSwgc2Uoc291dGhlYXN0KSwgbncobm9ydGh3ZXN0KSxcbiAgICAvLyBzdyhzb3V0aHdlc3QpLlxuICAgIC8vXG4gICAgLy8gICAgKy0rLStcbiAgICAvLyAgICB8ICAgfFxuICAgIC8vICAgICsgICArXG4gICAgLy8gICAgfCAgIHxcbiAgICAvLyAgICArLSstK1xuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhbiBPYmplY3Qge24sIHMsIGUsIHcsIG53LCBzdywgbmUsIHNlfVxuICAgIGZ1bmN0aW9uIGdldFNjcmVlbkJCb3goKSB7XG4gICAgICB2YXIgdGFyZ2V0ZWwgICA9IHRhcmdldCB8fCBkMy5ldmVudC50YXJnZXQ7XG5cbiAgICAgIHdoaWxlICgndW5kZWZpbmVkJyA9PT0gdHlwZW9mIHRhcmdldGVsLmdldFNjcmVlbkNUTSAmJiAndW5kZWZpbmVkJyA9PT0gdGFyZ2V0ZWwucGFyZW50Tm9kZSkge1xuICAgICAgICAgIHRhcmdldGVsID0gdGFyZ2V0ZWwucGFyZW50Tm9kZTtcbiAgICAgIH1cblxuICAgICAgdmFyIGJib3ggICAgICAgPSB7fSxcbiAgICAgICAgICBtYXRyaXggICAgID0gdGFyZ2V0ZWwuZ2V0U2NyZWVuQ1RNKCksXG4gICAgICAgICAgdGJib3ggICAgICA9IHRhcmdldGVsLmdldEJCb3goKSxcbiAgICAgICAgICB3aWR0aCAgICAgID0gdGJib3gud2lkdGgsXG4gICAgICAgICAgaGVpZ2h0ICAgICA9IHRiYm94LmhlaWdodCxcbiAgICAgICAgICB4ICAgICAgICAgID0gdGJib3gueCxcbiAgICAgICAgICB5ICAgICAgICAgID0gdGJib3gueVxuXG4gICAgICBwb2ludC54ID0geFxuICAgICAgcG9pbnQueSA9IHlcbiAgICAgIGJib3gubncgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCArPSB3aWR0aFxuICAgICAgYmJveC5uZSA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55ICs9IGhlaWdodFxuICAgICAgYmJveC5zZSA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54IC09IHdpZHRoXG4gICAgICBiYm94LnN3ID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnkgLT0gaGVpZ2h0IC8gMlxuICAgICAgYmJveC53ICA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC54ICs9IHdpZHRoXG4gICAgICBiYm94LmUgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCAtPSB3aWR0aCAvIDJcbiAgICAgIHBvaW50LnkgLT0gaGVpZ2h0IC8gMlxuICAgICAgYmJveC5uID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnkgKz0gaGVpZ2h0XG4gICAgICBiYm94LnMgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuXG4gICAgICByZXR1cm4gYmJveFxuICAgIH1cblxuICAgIHJldHVybiB0aXBcbiAgfTtcbn0pKCk7Il19
