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
            }).on('mouseover', this.tooltip.show).on('mouseout', this.tooltip.hide).call(this.tooltip);
        },
        setTooltips: function setTooltips() {
            this.tooltip = d3.tip().attr("class", "d3-tip").direction('n').offset([-8, 0]).html(function () {
                return 'hello';
            });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZXYtanMvaW5kZXguZXM2IiwianMtZXhwb3J0cy9DaGFydHMuanMiLCJqcy1leHBvcnRzL0hlbHBlcnMuanMiLCJqcy12ZW5kb3IvZDMtdGlwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNJQTs7QUFDQTs7QUFDQTs7QUFFQSxJQUFJLFdBQVksWUFBVTs7QUFFMUI7O0FBRUksUUFBSSxrQkFBa0IsRUFBdEI7QUFDQSxRQUFJLGVBQWUsU0FBZixZQUFlLENBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEwQjtBQUFBOztBQUN6QyxnQkFBUSxHQUFSLENBQVksS0FBWjtBQUNBLGFBQUssU0FBTCxHQUFpQixTQUFqQjtBQUNBLGFBQUssS0FBTCxHQUFhLEtBQWI7QUFDQSxhQUFLLE1BQUwsR0FBYyxVQUFVLE9BQVYsQ0FBa0IsT0FBbEIsRUFBZDtBQUNBLGdCQUFRLEdBQVIsQ0FBWSxLQUFLLE1BQUwsQ0FBWSxNQUFaLENBQW1CLFFBQW5CLEVBQVo7QUFDQSxhQUFLLFlBQUwsR0FBb0IsS0FBSyxrQkFBTCxDQUF3QixTQUF4QixDQUFwQjtBQUNBLGFBQUssUUFBTCxHQUFnQixFQUFoQjtBQUNBLGdCQUFRLEdBQVIsQ0FBWSxLQUFLLFlBQWpCO0FBQ0E7QUFDQSxhQUFLLFlBQUwsQ0FBa0IsSUFBbEIsQ0FBdUIsWUFBTTtBQUN6QixrQkFBSyxnQkFBTCxDQUFzQixTQUF0QjtBQUNILFNBRkQ7QUFHSCxLQWJEO0FBY0E7QUFDQSxpQkFBYSxTQUFiLEdBQXlCO0FBRWpCLDBCQUZpQixnQ0FFRztBQUFBOztBQUNoQixnQkFBSSxlQUFlLEVBQW5CO0FBQ0EsZ0JBQUksVUFBVSxLQUFLLE1BQUwsQ0FBWSxPQUExQjtBQUFBLGdCQUNJLE9BQU8sQ0FBQyxLQUFLLE1BQUwsQ0FBWSxPQUFiLEVBQXFCLEtBQUssTUFBTCxDQUFZLGFBQWpDLENBRFgsQ0FGZ0IsQ0FHNEM7QUFDeEI7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SUFBVyxNQUFYO0FBQ0EsV0FBSyxFQUFMLEdBQVUsTUFBTSxlQUFOLENBQXNCLE1BQXRCLENBQVY7QUFDQSxZQUFNLENBQU4sSUFBVyxLQUFYO0FBQ0EsV0FBSyxFQUFMLEdBQVUsTUFBTSxlQUFOLENBQXNCLE1BQXRCLENBQVY7QUFDQSxZQUFNLENBQU4sSUFBVyxTQUFTLENBQXBCO0FBQ0EsV0FBSyxDQUFMLEdBQVUsTUFBTSxlQUFOLENBQXNCLE1BQXRCLENBQVY7QUFDQSxZQUFNLENBQU4sSUFBVyxLQUFYO0FBQ0EsV0FBSyxDQUFMLEdBQVMsTUFBTSxlQUFOLENBQXNCLE1BQXRCLENBQVQ7QUFDQSxZQUFNLENBQU4sSUFBVyxRQUFRLENBQW5CO0FBQ0EsWUFBTSxDQUFOLElBQVcsU0FBUyxDQUFwQjtBQUNBLFdBQUssQ0FBTCxHQUFTLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFUO0FBQ0EsWUFBTSxDQUFOLElBQVcsTUFBWDtBQUNBLFdBQUssQ0FBTCxHQUFTLE1BQU0sZUFBTixDQUFzQixNQUF0QixDQUFUOztBQUVBLGFBQU8sSUFBUDtBQUNEOztBQUVELFdBQU8sR0FBUDtBQUNELEdBbFREO0FBbVRELENBMVRvQixFQUFkIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIiAvKiBleHBvcnRlZCBEM0NoYXJ0cywgSGVscGVycywgZDNUaXAgKi8gLy8gbGV0J3MganNoaW50IGtub3cgdGhhdCBEM0NoYXJ0cyBjYW4gYmUgXCJkZWZpbmVkIGJ1dCBub3QgdXNlZFwiIGluIHRoaXMgZmlsZVxuIC8qIHBvbHlmaWxscyBuZWVkZWQ6IFByb21pc2UsIEFycmF5LmlzQXJyYXksIEFycmF5LmZpbmQsIEFycmF5LmZpbHRlclxuXG4gKi9cbmltcG9ydCB7IEhlbHBlcnMgfSBmcm9tICcuLi9qcy1leHBvcnRzL0hlbHBlcnMnO1xuaW1wb3J0IHsgQ2hhcnRzIH0gZnJvbSAnLi4vanMtZXhwb3J0cy9DaGFydHMnO1xuaW1wb3J0IHsgZDNUaXAgfSBmcm9tICcuLi9qcy12ZW5kb3IvZDMtdGlwJztcblxudmFyIEQzQ2hhcnRzID0gKGZ1bmN0aW9uKCl7XG5cblwidXNlIHN0cmljdFwiOyBcbiAgICAgXG4gICAgdmFyIGdyb3VwQ29sbGVjdGlvbiA9IFtdO1xuICAgIHZhciBEM0NoYXJ0R3JvdXAgPSBmdW5jdGlvbihjb250YWluZXIsIGluZGV4KXtcbiAgICAgICAgY29uc29sZS5sb2coaW5kZXgpO1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICAgICAgdGhpcy5pbmRleCA9IGluZGV4O1xuICAgICAgICB0aGlzLmNvbmZpZyA9IGNvbnRhaW5lci5kYXRhc2V0LmNvbnZlcnQoKTtcbiAgICAgICAgY29uc29sZS5sb2codGhpcy5jb25maWcubmVzdEJ5LnRvU3RyaW5nKCkpO1xuICAgICAgICB0aGlzLmRhdGFQcm9taXNlcyA9IHRoaXMucmV0dXJuRGF0YVByb21pc2VzKGNvbnRhaW5lcik7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcbiAgICAgICAgY29uc29sZS5sb2codGhpcy5kYXRhUHJvbWlzZXMpO1xuICAgICAgICAvL3RoaXMuY29udHJvbGxlci5pbml0Q29udHJvbGxlcihjb250YWluZXIsIHRoaXMubW9kZWwsIHRoaXMudmlldyk7XG4gICAgICAgIHRoaXMuZGF0YVByb21pc2VzLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplQ2hhcnRzKGNvbnRhaW5lcik7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgLy9wcm90b3R5cGUgYmVnaW5zIGhlcmVcbiAgICBEM0NoYXJ0R3JvdXAucHJvdG90eXBlID0ge1xuICAgICAgICBcbiAgICAgICAgICAgIHJldHVybkRhdGFQcm9taXNlcygpeyBcbiAgICAgICAgICAgICAgICB2YXIgZGF0YVByb21pc2VzID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHNoZWV0SUQgPSB0aGlzLmNvbmZpZy5zaGVldElkLCBcbiAgICAgICAgICAgICAgICAgICAgdGFicyA9IFt0aGlzLmNvbmZpZy5kYXRhVGFiLHRoaXMuY29uZmlnLmRpY3Rpb25hcnlUYWJdOyAvLyB0aGlzIHNob3VsZCBjb21lIGZyb20gSFRNTFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlzIHRoZXJlIGEgY2FzZSBmb3IgbW9yZSB0aGFuIG9uZSBzaGVldCBvZiBkYXRhP1xuICAgICAgICAgICAgICAgIHRhYnMuZm9yRWFjaCgoZWFjaCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZDMuanNvbignaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLycgKyBzaGVldElEICsgJy92YWx1ZXMvJyArIGVhY2ggKyAnP2tleT1BSXphU3lERDNXNXdKZUpGMmVzZmZaTVF4TnRFbDl0dC1PZmdTcTQnLCAoZXJyb3IsZGF0YSkgPT4geyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZXMgPSBkYXRhLnZhbHVlcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdFR5cGUgPSBlYWNoID09PSAnZGljdGlvbmFyeScgPyAnb2JqZWN0JyA6ICdzZXJpZXMnOyAvLyBuZXN0VHlwZSBmb3IgZGF0YSBzaG91bGQgY29tZSBmcm9tIEhUTUxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5ID0gZWFjaCA9PT0gJ2RpY3Rpb25hcnknID8gZmFsc2UgOiB0aGlzLmNvbmZpZy5uZXN0Qnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgdHJ1ZSwgbmVzdFR5cGUsIGkpKTsgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFQcm9taXNlcy5wdXNoKHByb21pc2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFByb21pc2UuYWxsKGRhdGFQcm9taXNlcykudGhlbih2YWx1ZXMgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGEgPSB2YWx1ZXNbMF07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGljdGlvbmFyeSA9IHZhbHVlc1sxXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdW1tYXJpZXMgPSB0aGlzLnN1bW1hcml6ZURhdGEoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoZGF0YVByb21pc2VzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdW1tYXJpemVEYXRhKCl7IC8vIHRoaXMgZm4gY3JlYXRlcyBhbiBhcnJheSBvZiBvYmplY3RzIHN1bW1hcml6aW5nIHRoZSBkYXRhIGluIG1vZGVsLmRhdGEuIG1vZGVsLmRhdGEgaXMgbmVzdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBuZXN0aW5nIGFuZCByb2xsaW5nIHVwIGNhbm5vdCBiZSBkb25lIGVhc2lseSBhdCB0aGUgc2FtZSB0aW1lLCBzbyB0aGV5J3JlIGRvbmUgc2VwYXJhdGVseS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHN1bW1hcmllcyBwcm92aWRlIGF2ZXJhZ2UsIG1heCwgbWluIG9mIGFsbCBmaWVsZHMgaW4gdGhlIGRhdGEgYXQgYWxsIGxldmVscyBvZiBuZXN0aW5nLiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGZpcnN0IChpbmRleCAwKSBpcyBvbmUgbGF5ZXIgbmVzdGVkLCB0aGUgc2Vjb25kIGlzIHR3bywgYW5kIHNvIG9uLlxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBzdW1tYXJpZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgdmFyaWFibGVzID0gT2JqZWN0LmtleXModGhpcy51bm5lc3RlZFswXSk7IC8vIGFsbCBuZWVkIHRvIGhhdmUgdGhlIHNhbWUgZmllbGRzXG4gICAgICAgICAgICAgICAgdmFyIG5lc3RCeSA9IHRoaXMuY29uZmlnLm5lc3RCeSA/IHRoaXMuY29uZmlnLm5lc3RCeS5tYXAoZWFjaCA9PiBlYWNoKSA6IGZhbHNlOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB1c2VzIG1hcCB0byBjcmVhdGUgbmV3IGFycmF5IHJhdGhlciB0aGFuIGFzc2lnbmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJ5IHJlZmVyZW5jZS4gdGhlIGBwb3AoKWAgYmVsb3cgd291bGQgYWZmZWN0IG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXJyYXkgaWYgZG9uZSBieSByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICB2YXIgbmVzdEJ5QXJyYXkgPSBBcnJheS5pc0FycmF5KG5lc3RCeSkgPyBuZXN0QnkgOiBbbmVzdEJ5XTtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiByZWR1Y2VWYXJpYWJsZXMoZCl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZXMucmVkdWNlKGZ1bmN0aW9uKGFjYywgY3VyKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY1tjdXJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heDogICAgICAgZDMubWF4KGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW46ICAgICAgIGQzLm1pbihkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVhbjogICAgICBkMy5tZWFuKGQsIGQgPT4gZFtjdXJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW06ICAgICAgIGQzLnN1bShkLCBkID0+IGRbY3VyXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFuOiAgICBkMy5tZWRpYW4oZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbmNlOiAgZDMudmFyaWFuY2UoZCwgZCA9PiBkW2N1cl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldmlhdGlvbjogZDMuZGV2aWF0aW9uKGQsIGQgPT4gZFtjdXJdKVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgICAgICAgICAgICAgIH0se30pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3aGlsZSAoIG5lc3RCeUFycmF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHN1bW1hcml6ZWQgPSB0aGlzLm5lc3RQcmVsaW0obmVzdEJ5QXJyYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICAucm9sbHVwKHJlZHVjZVZhcmlhYmxlcylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3QodGhpcy51bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgICAgIHN1bW1hcmllcy51bnNoaWZ0KHN1bW1hcml6ZWQpOyAgICAgIFxuICAgICAgICAgICAgICAgICAgICBuZXN0QnlBcnJheS5wb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1bW1hcmllcztcbiAgICAgICAgICAgIH0sIFxuICAgICAgICAgICAgbmVzdFByZWxpbShuZXN0QnlBcnJheSl7XG4gICAgICAgICAgICAgICAgLy8gcmVjdXJzaXZlICBuZXN0aW5nIGZ1bmN0aW9uIHVzZWQgYnkgc3VtbWFyaXplRGF0YSBhbmQgcmV0dXJuS2V5VmFsdWVzXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5lc3RCeUFycmF5LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1cil7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyICE9PSAnc3RyaW5nJyAmJiB0eXBlb2YgY3VyICE9PSAnZnVuY3Rpb24nICkgeyB0aHJvdyAnZWFjaCBuZXN0QnkgaXRlbSBtdXN0IGJlIGEgc3RyaW5nIG9yIGZ1bmN0aW9uJzsgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgcnRuO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXIgPT09ICdzdHJpbmcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkW2N1cl07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTsgICAgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyID09PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICAgICAgICAgICAgICBydG4gPSBhY2Mua2V5KGZ1bmN0aW9uKGQpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjdXIoZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcnRuO1xuICAgICAgICAgICAgICAgIH0sIGQzLm5lc3QoKSk7XG4gICAgICAgICAgICB9LCAgICAgICBcbiAgICAgICAgICAgIHJldHVybktleVZhbHVlcyh2YWx1ZXMsIG5lc3RCeSwgY29lcmNlID0gZmFsc2UsIG5lc3RUeXBlID0gJ3NlcmllcycsIHRhYkluZGV4ID0gMCl7XG4gICAgICAgICAgICAvLyB0aGlzIGZuIHRha2VzIG5vcm1hbGl6ZWQgZGF0YSBmZXRjaGVkIGFzIGFuIGFycmF5IG9mIHJvd3MgYW5kIHVzZXMgdGhlIHZhbHVlcyBpbiB0aGUgZmlyc3Qgcm93IGFzIGtleXMgZm9yIHZhbHVlcyBpblxuICAgICAgICAgICAgLy8gc3Vic2VxdWVudCByb3dzXG4gICAgICAgICAgICAvLyBuZXN0QnkgPSBzdHJpbmcgb3IgYXJyYXkgb2YgZmllbGQocykgdG8gbmVzdCBieSwgb3IgYSBjdXN0b20gZnVuY3Rpb24sIG9yIGFuIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zO1xuICAgICAgICAgICAgLy8gY29lcmNlID0gQk9PTCBjb2VyY2UgdG8gbnVtIG9yIG5vdDsgbmVzdFR5cGUgPSBvYmplY3Qgb3Igc2VyaWVzIG5lc3QgKGQzKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHZhciBwcmVsaW07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIHVubmVzdGVkID0gdmFsdWVzLnNsaWNlKDEpLm1hcChyb3cgPT4gcm93LnJlZHVjZShmdW5jdGlvbihhY2MsIGN1ciwgaSkgeyBcbiAgICAgICAgICAgICAgICAvLyAxLiBwYXJhbXM6IHRvdGFsLCBjdXJyZW50VmFsdWUsIGN1cnJlbnRJbmRleFssIGFycl1cbiAgICAgICAgICAgICAgICAvLyAzLiAvLyBhY2MgaXMgYW4gb2JqZWN0ICwga2V5IGlzIGNvcnJlc3BvbmRpbmcgdmFsdWUgZnJvbSByb3cgMCwgdmFsdWUgaXMgY3VycmVudCB2YWx1ZSBvZiBhcnJheVxuICAgICAgICAgICAgICAgICAgYWNjW3ZhbHVlc1swXVtpXV0gPSBjb2VyY2UgPT09IHRydWUgPyBpc05hTigrY3VyKSB8fCBjdXIgPT09ICcnID8gY3VyIDogK2N1ciA6IGN1cjsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhY2M7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRlc3QgZm9yIGVtcHR5IHN0cmluZ3MgYmVmb3JlIGNvZXJjaW5nIGJjICsnJyA9PiAwXG4gICAgICAgICAgICAgICAgfSwge30pKTtcbiAgICAgICAgICAgICAgICBpZiAoIHRhYkluZGV4ID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVubmVzdGVkID0gdW5uZXN0ZWQ7XG4gICAgICAgICAgICAgICAgfSAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKCAhbmVzdEJ5ICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bm5lc3RlZDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBuZXN0QnkgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBuZXN0QnkgPT09ICdmdW5jdGlvbicgKSB7IC8vIGllIG9ubHkgb25lIG5lc3RCeSBmaWVsZCBvciBmdW5jaXRvblxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gdGhpcy5uZXN0UHJlbGltKFtuZXN0QnldKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShuZXN0QnkpKSB7IHRocm93ICduZXN0QnkgdmFyaWFibGUgbXVzdCBiZSBhIHN0cmluZywgZnVuY3Rpb24sIG9yIGFycmF5IG9mIHN0cmluZ3Mgb3IgZnVuY3Rpb25zJzsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlbGltID0gdGhpcy5uZXN0UHJlbGltKG5lc3RCeSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCBuZXN0VHlwZSA9PT0gJ29iamVjdCcgKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdCh1bm5lc3RlZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWxpbVxuICAgICAgICAgICAgICAgICAgICAgICAgLmVudHJpZXModW5uZXN0ZWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbml0aWFsaXplQ2hhcnRzKGNvbnRhaW5lcil7XG4gICAgICAgICAgICAgICAgdmFyIGdyb3VwID0gdGhpcztcbiAgICAgICAgICAgICAgICBkMy5zZWxlY3QoY29udGFpbmVyKS5zZWxlY3RBbGwoJy5kMy1jaGFydCcpXG4gICAgICAgICAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICAgICBncm91cC5jaGlsZHJlbi5wdXNoKG5ldyBDaGFydHMuQ2hhcnREaXYodGhpcywgZ3JvdXApKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9ICAgICAgICBcbiAgICB9OyAvLyBEM0NoYXJ0R3JvdXAgcHJvdG90eXBlIGVuZHMgaGVyZVxuICAgIFxuICAgIHdpbmRvdy5EM0NoYXJ0cyA9IHsgLy8gbmVlZCB0byBzcGVjaWZ5IHdpbmRvdyBiYyBhZnRlciB0cmFuc3BpbGluZyBhbGwgdGhpcyB3aWxsIGJlIHdyYXBwZWQgaW4gSUlGRXNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBgcmV0dXJuYGluZyB3b24ndCBnZXQgdGhlIGV4cG9ydCBpbnRvIHdpbmRvdydzIGdsb2JhbCBzY29wZVxuICAgICAgICBJbml0KCl7XG4gICAgICAgICAgICB2YXIgZ3JvdXBEaXZzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmQzLWdyb3VwJyk7XG4gICAgICAgICAgICBmb3IgKCBsZXQgaSA9IDA7IGkgPCBncm91cERpdnMubGVuZ3RoOyBpKysgKXtcbiAgICAgICAgICAgICAgICBncm91cENvbGxlY3Rpb24ucHVzaChuZXcgRDNDaGFydEdyb3VwKGdyb3VwRGl2c1tpXSwgaSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc29sZS5sb2coZ3JvdXBDb2xsZWN0aW9uKTtcbiAgICAgICAgfVxuICAgIH07XG59KCkpOyAvLyBlbmQgdmFyIEQzQ2hhcnRzIElJRkUiLCJleHBvcnQgY29uc3QgQ2hhcnRzID0gKGZ1bmN0aW9uKCl7XG5cbiAgICB2YXIgQ2hhcnREaXYgPSBmdW5jdGlvbihjb250YWluZXIsIHBhcmVudCl7XG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgICAgICB0aGlzLnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuICAgICAgICB0aGlzLnNlcmllc0NvdW50ID0gMDtcbiAgICAgICAgdGhpcy5jb25maWcgPSBPYmplY3QuY3JlYXRlKCBwYXJlbnQuY29uZmlnLCBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyggY29udGFpbmVyLmRhdGFzZXQuY29udmVydCgpICkgKTtcbiAgICAgICAgICAgIC8vIGxpbmUgYWJvdmUgY3JlYXRlcyBhIGNvbmZpZyBvYmplY3QgZnJvbSB0aGUgSFRNTCBkYXRhc2V0IGZvciB0aGUgY2hhcnREaXYgY29udGFpbmVyXG4gICAgICAgICAgICAvLyB0aGF0IGluaGVyaXRzIGZyb20gdGhlIHBhcmVudHMgY29uZmlnIG9iamVjdC4gYW55IGNvbmZpZ3Mgbm90IHNwZWNpZmllZCBmb3IgdGhlIGNoYXJ0RGl2IChhbiBvd24gcHJvcGVydHkpXG4gICAgICAgICAgICAvLyB3aWxsIGNvbWUgZnJvbSB1cCB0aGUgaW5oZXJpdGFuY2UgY2hhaW5cbiAgICAgICAgdGhpcy5kYXR1bSA9IHBhcmVudC5kYXRhLmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0gdGhpcy5jb25maWcuY2F0ZWdvcnkpO1xuICAgICAgICB2YXIgc2VyaWVzSW5zdHJ1Y3QgPSB0aGlzLmNvbmZpZy5zZXJpZXMgfHwgJ2FsbCc7XG4gICAgICAgIGNvbnNvbGUubG9nKHNlcmllc0luc3RydWN0KTtcbiAgICAgICAgaWYgKCBBcnJheS5pc0FycmF5KHNlcmllc0luc3RydWN0KSApe1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2lzIGFycmF5JywgdGhpcy5kYXR1bS52YWx1ZXMpO1xuICAgICAgICAgICAgdGhpcy5kYXR1bS52YWx1ZXMgPSB0aGlzLmRhdHVtLnZhbHVlcy5maWx0ZXIoZWFjaCA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZWFjaC5rZXkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzZXJpZXNJbnN0cnVjdC5pbmRleE9mKGVhY2gua2V5KSAhPT0gLTE7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmICggc2VyaWVzSW5zdHJ1Y3QgIT09ICdhbGwnICl7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgSW52YWxpZCBpbnN0cnVjdGlvbiBmcm9tIEhUTUwgZm9yIHdoaWNoIGNhdGVnb3JpZXMgdG8gaW5jbHVkZSBcbiAgICAgICAgICAgICAgICAgICAgKHZhciBzZXJpZXNJbnN0cnVjdCkuIEZhbGxiYWNrIHRvIGFsbC5gKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNlcmllc0dyb3VwcyA9IHRoaXMuZ3JvdXBTZXJpZXMoKTtcbiAgICAgICAgdGhpcy5kaWN0aW9uYXJ5ID0gdGhpcy5wYXJlbnQuZGljdGlvbmFyeTtcbiAgICAgICAgaWYgKCB0aGlzLmNvbmZpZy5oZWFkaW5nICE9PSBmYWxzZSApe1xuICAgICAgICAgICAgdGhpcy5hZGRIZWFkaW5nKHRoaXMuY29uZmlnLmhlYWRpbmcpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY3JlYXRlQ2hhcnRzKCk7XG5cbiAgICB9O1xuICAgIFxuICAgIENoYXJ0RGl2LnByb3RvdHlwZSA9IHtcbiAgICAgICAgY2hhcnRUeXBlczoge1xuICAgICAgICAgICAgbGluZTogICAnTGluZUNoYXJ0JyxcbiAgICAgICAgICAgIGNvbHVtbjogJ0NvbHVtbkNoYXJ0JyxcbiAgICAgICAgICAgIGJhcjogICAgJ0JhckNoYXJ0JyAvLyBzbyBvbiAuIC4gLlxuICAgICAgICB9LFxuICAgICAgICBjcmVhdGVDaGFydHMoKXtcbiAgICAgICAgICAgIHRoaXMuc2VyaWVzR3JvdXBzLmZvckVhY2goKGVhY2gpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuLnB1c2gobmV3IExpbmVDaGFydCh0aGlzLCBlYWNoKSk7IC8vIFRPIERPIGRpc3Rpbmd1aXNoIGNoYXJ0IHR5cGVzIGhlcmVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBncm91cFNlcmllcygpe1xuICAgICAgICAgICAgdmFyIHNlcmllc0dyb3VwcyxcbiAgICAgICAgICAgICAgICBncm91cHNJbnN0cnVjdCA9IHRoaXMuY29uZmlnLnNlcmllc0dyb3VwIHx8ICdub25lJztcbiAgICAgICAgICAgIGlmICggQXJyYXkuaXNBcnJheSggZ3JvdXBzSW5zdHJ1Y3QgKSApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmZpZy5zZXJpZXNHcm91cC5mb3JFYWNoKGdyb3VwID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2VyaWVzR3JvdXBzLnB1c2godGhpcy5kYXR1bS52YWx1ZXMuZmlsdGVyKHNlcmllcyA9PiBncm91cC5pbmRleE9mKHNlcmllcy5rZXkpICE9PSAtMSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdub25lJyApIHtcbiAgICAgICAgICAgICAgICBzZXJpZXNHcm91cHMgPSB0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBbZWFjaF0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggZ3JvdXBzSW5zdHJ1Y3QgPT09ICdhbGwnICkge1xuICAgICAgICAgICAgICAgIHNlcmllc0dyb3VwcyA9IFt0aGlzLmRhdHVtLnZhbHVlcy5tYXAoZWFjaCA9PiBlYWNoKV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBJbnZhbGlkIGRhdGEtZ3JvdXAtc2VyaWVzIGluc3RydWN0aW9uIGZyb20gaHRtbC4gXG4gICAgICAgICAgICAgICAgICAgICAgIE11c3QgYmUgdmFsaWQgSlNPTjogXCJOb25lXCIgb3IgXCJBbGxcIiBvciBhbiBhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICBvZiBhcnJheXMgY29udGFpbmluZyB0aGUgc2VyaWVzIHRvIGJlIGdyb3VwZWRcbiAgICAgICAgICAgICAgICAgICAgICAgdG9nZXRoZXIuIEFsbCBzdHJpbmdzIG11c3QgYmUgZG91YmxlLXF1b3RlZC5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzZXJpZXNHcm91cHM7XG4gICAgICAgIH0sIC8vIGVuZCBncm91cFNlcmllcygpXG4gICAgICAgIGFkZEhlYWRpbmcoaW5wdXQpe1xuICAgICAgICAgICAgY29uc29sZS5sb2coaW5wdXQpO1xuICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMuY29udGFpbmVyKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3AnKVxuICAgICAgICAgICAgICAgIC5odG1sKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGhlYWRpbmcgPSB0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnID8gaW5wdXQgOiB0aGlzLmxhYmVsKHRoaXMuY29uZmlnLmNhdGVnb3J5KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICc8c3Ryb25nPicgKyBoZWFkaW5nICsgJzwvc3Ryb25nPic7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGxhYmVsKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kaWN0aW9uYXJ5LmZpbmQoZWFjaCA9PiBlYWNoLmtleSA9PT0ga2V5KS5sYWJlbDtcbiAgICAgICAgfSxcbiAgICAgICAgdW5pdHMoa2V5KXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRpY3Rpb25hcnkuZmluZChlYWNoID0+IGVhY2gua2V5ID09PSBrZXkpLnVuaXRzOyAgXG4gICAgICAgIH1cblxuICAgIH07IC8vIGVuZCBMaW5lQ2hhcnQucHJvdG90eXBlXG5cbiAgICB2YXIgTGluZUNoYXJ0ID0gZnVuY3Rpb24ocGFyZW50LCBzZXJpZXNHcm91cCl7XG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgICAgICB0aGlzLmNvbmZpZyA9IHBhcmVudC5jb25maWc7XG4gICAgICAgIHRoaXMubWFyZ2luVG9wID0gK3RoaXMuY29uZmlnLm1hcmdpblRvcCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLnRvcDtcbiAgICAgICAgdGhpcy5tYXJnaW5SaWdodCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5SaWdodCB8fCB0aGlzLmRlZmF1bHRNYXJnaW5zLnJpZ2h0O1xuICAgICAgICB0aGlzLm1hcmdpbkJvdHRvbSA9ICt0aGlzLmNvbmZpZy5tYXJnaW5Cb3R0b20gfHwgdGhpcy5kZWZhdWx0TWFyZ2lucy5ib3R0b207XG4gICAgICAgIHRoaXMubWFyZ2luTGVmdCA9ICt0aGlzLmNvbmZpZy5tYXJnaW5MZWZ0IHx8IHRoaXMuZGVmYXVsdE1hcmdpbnMubGVmdDtcbiAgICAgICAgdGhpcy53aWR0aCA9IHRoaXMuY29uZmlnLnN2Z1dpZHRoID8gK3RoaXMuY29uZmlnLnN2Z1dpZHRoIC0gdGhpcy5tYXJnaW5SaWdodCAtIHRoaXMubWFyZ2luTGVmdCA6IDMyMCAtIHRoaXMubWFyZ2luUmlnaHQgLSB0aGlzLm1hcmdpbkxlZnQ7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5jb25maWcuc3ZnSGVpZ2h0ID8gK3RoaXMuY29uZmlnLnN2Z0hlaWdodCAtIHRoaXMubWFyZ2luVG9wIC0gdGhpcy5tYXJnaW5Cb3R0b20gOiAoIHRoaXMud2lkdGggKyB0aGlzLm1hcmdpblJpZ2h0ICsgdGhpcy5tYXJnaW5MZWZ0ICkgLyAyIC0gdGhpcy5tYXJnaW5Ub3AgLSB0aGlzLm1hcmdpbkJvdHRvbTtcbiAgICAgICAgdGhpcy5kYXRhID0gc2VyaWVzR3JvdXA7XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMpO1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IHRoaXMuaW5pdChwYXJlbnQuY29udGFpbmVyKTtcbiAgICAgICAgdGhpcy54U2NhbGVUeXBlID0gdGhpcy5jb25maWcueFNjYWxlVHlwZSB8fCAndGltZSc7XG4gICAgICAgIHRoaXMueVNjYWxlVHlwZSA9IHRoaXMuY29uZmlnLnlTY2FsZVR5cGUgfHwgJ2xpbmVhcic7XG4gICAgICAgIHRoaXMueFRpbWVUeXBlID0gdGhpcy5jb25maWcueFRpbWVUeXBlIHx8ICclWSc7XG4gICAgICAgIHRoaXMuc2NhbGVCeSA9IHRoaXMuY29uZmlnLnNjYWxlQnkgfHwgJ3Nlcmllcy1ncm91cCc7XG4gICAgICAgIHRoaXMuc2V0U2NhbGVzKCk7IC8vIC8vU0hPVUxEIEJFIElOIENIQVJUIFBST1RPVFlQRSBcbiAgICAgICAgdGhpcy5zZXRUb29sdGlwcygpO1xuICAgICAgICB0aGlzLmFkZExpbmVzKCk7XG4gICAgICAgIHRoaXMuYWRkUG9pbnRzKCk7XG4gICAgICAgIHRoaXMuYWRkWEF4aXMoKTtcbiAgICAgICAgdGhpcy5hZGRZQXhpcygpO1xuICAgICAgICBpZiAoIHRoaXMuY29uZmlnLmRpcmVjdExhYmVsID09PSB0cnVlICl7XG4gICAgICAgICAgICB0aGlzLmFkZExhYmVscygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdGhpcy5hZGRMZWdlbmRzKCk7XG4gICAgICAgIH1cbiAgICAgICAgICAgICAgIFxuICAgIH07XG5cbiAgICBMaW5lQ2hhcnQucHJvdG90eXBlID0geyAvLyBlYWNoIExpbmVDaGFydCBpcyBhbiBzdmcgdGhhdCBob2xkIGdyb3VwZWQgc2VyaWVzXG4gICAgICAgIGRlZmF1bHRNYXJnaW5zOiB7XG4gICAgICAgICAgICB0b3A6MjAsXG4gICAgICAgICAgICByaWdodDo0NSxcbiAgICAgICAgICAgIGJvdHRvbToxNSxcbiAgICAgICAgICAgIGxlZnQ6MzVcbiAgICAgICAgfSxcbiAgICAgICAgICAgICAgXG4gICAgICAgIGluaXQoY2hhcnREaXYpeyAvLyAvL1NIT1VMRCBCRSBJTiBDSEFSVCBQUk9UT1RZUEUgdGhpcyBpcyBjYWxsZWQgb25jZSBmb3IgZWFjaCBzZXJpZXNHcm91cCBvZiBlYWNoIGNhdGVnb3J5LiBcbiAgICAgICAgICAgIHZhciBjb250YWluZXIgPSAgZDMuc2VsZWN0KGNoYXJ0RGl2KVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoJ3N2ZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3dpZHRoJywgdGhpcy53aWR0aCArIHRoaXMubWFyZ2luUmlnaHQgKyB0aGlzLm1hcmdpbkxlZnQgKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdoZWlnaHQnLCB0aGlzLmhlaWdodCAgKyB0aGlzLm1hcmdpblRvcCArIHRoaXMubWFyZ2luQm90dG9tICk7XG5cbiAgICAgICAgICAgIHRoaXMuc3ZnID0gY29udGFpbmVyLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsYHRyYW5zbGF0ZSgke3RoaXMubWFyZ2luTGVmdH0sICR7dGhpcy5tYXJnaW5Ub3B9KWApO1xuXG4gICAgICAgICAgICB0aGlzLmVhY2hTZXJpZXMgPSB0aGlzLnN2Zy5zZWxlY3RBbGwoJ2VhY2gtc2VyaWVzJylcbiAgICAgICAgICAgICAgICAuZGF0YSh0aGlzLmRhdGEpXG4gICAgICAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnZWFjaC1zZXJpZXMgc2VyaWVzLScgKyB0aGlzLnBhcmVudC5zZXJpZXNDb3VudCArICcgY29sb3ItJyArIHRoaXMucGFyZW50LnNlcmllc0NvdW50KysgJSAzO1xuICAgICAgICAgICAgICAgIH0pO1xuLypcbiAgICAgICAgICAgIHRoaXMuZWFjaFNlcmllcy5lYWNoKChkLGksYXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudC5zZXJpZXNBcnJheS5wdXNoKGFycmF5W2ldKTtcbiAgICAgICAgICAgIH0pOyovXG5cblxuXG4gICAgICAgICAgICByZXR1cm4gY29udGFpbmVyLm5vZGUoKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0U2NhbGVzKCl7IC8vU0hPVUxEIEJFIElOIENIQVJUIFBST1RPVFlQRSAvLyBUTyBETzogU0VUIFNDQUxFUyBGT1IgT1RIRVIgR1JPVVAgVFlQRVNcbiAgICAgICAgICAgIHZhciBkM1NjYWxlID0ge1xuICAgICAgICAgICAgICAgIHRpbWU6IGQzLnNjYWxlVGltZSgpLFxuICAgICAgICAgICAgICAgIGxpbmVhcjogZDMuc2NhbGVMaW5lYXIoKVxuICAgICAgICAgICAgICAgIC8vIFRPIERPOiBhZGQgYWxsIHNjYWxlIHR5cGVzLlxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHZhciB4TWF4ZXMgPSBbXSwgeE1pbnMgPSBbXSwgeU1heGVzID0gW10sIHlNaW5zID0gW107XG4gICAgICAgICAgICBpZiAoIHRoaXMuc2NhbGVCeSA9PT0gJ3Nlcmllcy1ncm91cCcgKXtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEuZm9yRWFjaChlYWNoID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZWFjaCwgdGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXSk7XG4gICAgICAgICAgICAgICAgICAgIHhNYXhlcy5wdXNoKHRoaXMucGFyZW50LnBhcmVudC5zdW1tYXJpZXNbMV1bdGhpcy5jb25maWcuY2F0ZWdvcnldW2VhY2gua2V5XVt0aGlzLmNvbmZpZy52YXJpYWJsZVhdLm1heCk7XG4gICAgICAgICAgICAgICAgICAgIHhNaW5zLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0ubWluKTtcbiAgICAgICAgICAgICAgICAgICAgeU1heGVzLnB1c2godGhpcy5wYXJlbnQucGFyZW50LnN1bW1hcmllc1sxXVt0aGlzLmNvbmZpZy5jYXRlZ29yeV1bZWFjaC5rZXldW3RoaXMuY29uZmlnLnZhcmlhYmxlWV0ubWF4KTtcbiAgICAgICAgICAgICAgICAgICAgeU1pbnMucHVzaCh0aGlzLnBhcmVudC5wYXJlbnQuc3VtbWFyaWVzWzFdW3RoaXMuY29uZmlnLmNhdGVnb3J5XVtlYWNoLmtleV1bdGhpcy5jb25maWcudmFyaWFibGVZXS5taW4pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy54TWF4ID0gZDMubWF4KHhNYXhlcyk7XG4gICAgICAgICAgICB0aGlzLnhNaW4gPSBkMy5taW4oeE1pbnMpO1xuICAgICAgICAgICAgdGhpcy55TWF4ID0gZDMubWF4KHlNYXhlcyk7XG4gICAgICAgICAgICB0aGlzLnlNaW4gPSBkMy5taW4oeU1pbnMpO1xuICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlID0gW107XG5cbiAgICAgICAgICAgIHZhciB4UmFuZ2UgPSBbMCwgdGhpcy53aWR0aF0sXG4gICAgICAgICAgICAgICAgeVJhbmdlID0gW3RoaXMuaGVpZ2h0LCAwXSxcbiAgICAgICAgICAgICAgICB4RG9tYWluLFxuICAgICAgICAgICAgICAgIHlEb21haW47XG4gICAgICAgICAgICBpZiAoIHRoaXMueFNjYWxlVHlwZSA9PT0gJ3RpbWUnKSB7XG4gICAgICAgICAgICAgICAgeERvbWFpbiA9IFtkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKHRoaXMueE1pbiksIGQzLnRpbWVQYXJzZSh0aGlzLnhUaW1lVHlwZSkodGhpcy54TWF4KV07XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBUTyBETzogT1RIRVIgZGF0YSB0eXBlcyA/XG4gICAgICAgICAgICAgICAgeERvbWFpbiA9IFt0aGlzLnhNaW4sIHRoaXMueE1heF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIHRoaXMueVNjYWxlVHlwZSA9PT0gJ3RpbWUnKSB7XG4gICAgICAgICAgICAgICAgeURvbWFpbiA9IFtkMy50aW1lUGFyc2UodGhpcy55VGltZVR5cGUpKHRoaXMueU1pbiksIGQzLnRpbWVQYXJzZSh0aGlzLnlUaW1lVHlwZSkodGhpcy55TWF4KV07XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBUTyBETzogT1RIRVIgZGF0YSB0eXBlcyA/XG4gICAgICAgICAgICAgICAgeURvbWFpbiA9IFt0aGlzLnlNaW4sIHRoaXMueU1heF07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMueFNjYWxlID0gZDNTY2FsZVt0aGlzLnhTY2FsZVR5cGVdLmRvbWFpbih4RG9tYWluKS5yYW5nZSh4UmFuZ2UpO1xuICAgICAgICAgICAgdGhpcy55U2NhbGUgPSBkM1NjYWxlW3RoaXMueVNjYWxlVHlwZV0uZG9tYWluKHlEb21haW4pLnJhbmdlKHlSYW5nZSk7XG5cbiAgICAgICAgfSxcbiAgICAgICAgYWRkTGluZXMoKXtcbiAgICAgICAgICAgIHZhciB2YWx1ZWxpbmUgPSBkMy5saW5lKClcbiAgICAgICAgICAgICAgICAueChkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aGlzLnhWYWx1ZXNVbmlxdWUuaW5kZXhPZihkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pID09PSAtMSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy54VmFsdWVzVW5pcXVlLnB1c2goZFt0aGlzLmNvbmZpZy52YXJpYWJsZVhdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy54U2NhbGUoZDMudGltZVBhcnNlKHRoaXMueFRpbWVUeXBlKShkW3RoaXMuY29uZmlnLnZhcmlhYmxlWF0pKTtcbiAgICAgICAgICAgICAgICB9KSBcbiAgICAgICAgICAgICAgICAueShkID0+IHRoaXMueVNjYWxlKGRbdGhpcy5jb25maWcudmFyaWFibGVZXSkpOyAvLyAhISBub3QgcHJvZ3JhbW1hdGljXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMubGluZXMgPSB0aGlzLmVhY2hTZXJpZXMuYXBwZW5kKCdwYXRoJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCdsaW5lJylcbiAgICAgICAgICAgICAgICAuYXR0cignZCcsIChkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZWxpbmUoZC52YWx1ZXMpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBhZGRYQXhpcygpeyAvLyBjb3VsZCBiZSBpbiBDaGFydCBwcm90b3R5cGUgP1xuICAgICAgICAgICAgdmFyIHlBeGlzUG9zaXRpb24sXG4gICAgICAgICAgICAgICAgeUF4aXNPZmZzZXQsXG4gICAgICAgICAgICAgICAgYXhpc1R5cGU7XG5cbiAgICAgICAgICAgIGlmICggdGhpcy5jb25maWcueUF4aXNQb3NpdGlvbiA9PT0gJ3plcm8nICl7XG4gICAgICAgICAgICAgICAgeUF4aXNQb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICAgICAgeUF4aXNPZmZzZXQgPSAwO1xuICAgICAgICAgICAgICAgIGF4aXNUeXBlID0gZDMuYXhpc0JvdHRvbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKCB0aGlzLmNvbmZpZy55QXhpc1Bvc2l0aW9uID09PSAndG9wJyApe1xuICAgICAgICAgICAgICAgIHlBeGlzUG9zaXRpb24gPSB0aGlzLnlNYXg7XG4gICAgICAgICAgICAgICAgeUF4aXNPZmZzZXQgPSAtdGhpcy5tYXJnaW5Ub3A7XG4gICAgICAgICAgICAgICAgYXhpc1R5cGUgPSBkMy5heGlzVG9wO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB5QXhpc1Bvc2l0aW9uID0gdGhpcy55TWluO1xuICAgICAgICAgICAgICAgIHlBeGlzT2Zmc2V0ID0gMDtcbiAgICAgICAgICAgICAgICBheGlzVHlwZSA9IGQzLmF4aXNCb3R0b207XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgYXhpcyA9IGF4aXNUeXBlKHRoaXMueFNjYWxlKS50aWNrU2l6ZUlubmVyKDQpLnRpY2tTaXplT3V0ZXIoMCkudGlja1BhZGRpbmcoMSk7XG4gICAgICAgICAgICBpZiAoIHRoaXMueFNjYWxlVHlwZSA9PT0gJ3RpbWUnICl7XG4gICAgICAgICAgICAgICAgYXhpcy50aWNrVmFsdWVzKHRoaXMueFZhbHVlc1VuaXF1ZS5tYXAoZWFjaCA9PiBkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGVhY2gpKSk7IC8vIFRPIERPOiBhbGxvdyBmb3Igb3RoZXIgeEF4aXMgQWRqdXN0bWVudHNcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3ZnLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoMCwnICsgKCB0aGlzLnlTY2FsZSh5QXhpc1Bvc2l0aW9uKSArIHlBeGlzT2Zmc2V0ICkgKyAnKScpIC8vIG5vdCBwcm9ncmFtYXRpYyBwbGFjZW1lbnQgb2YgeC1heGlzXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2F4aXMgeC1heGlzJylcbiAgICAgICAgICAgICAgICAuY2FsbChheGlzKTtcbiAgICAgICAgfSxcbiAgICAgICAgYWRkWUF4aXMoKXtcbiAgICAgICAgICAgIC8qIGF4aXMgKi9cbiAgICAgICAgICAgIHRoaXMuc3ZnLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICgpID0+ICdheGlzIHktYXhpcyAnKVxuICAgICAgICAgICAgICAuY2FsbChkMy5heGlzTGVmdCh0aGlzLnlTY2FsZSkudGlja1NpemVJbm5lcig0KS50aWNrU2l6ZU91dGVyKDApLnRpY2tQYWRkaW5nKDEpLnRpY2tzKDUpKTtcblxuICAgICAgICAgICAgLyogbGFiZWxzICovXG4gICAgICAgICAgICB0aGlzLmVhY2hTZXJpZXMuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3VuaXRzJylcbiAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICgpID0+IGB0cmFuc2xhdGUoLSR7dGhpcy5tYXJnaW5MZWZ0fSwtJHt0aGlzLm1hcmdpblRvcCAtIDEwfSlgKVxuICAgICAgICAgICAgICAudGV4dCgoZCxpKSA9PiBpID09PSAwID8gdGhpcy5wYXJlbnQudW5pdHMoZC5rZXkpIDogbnVsbCk7XG4gICAgICAgICAgICBcbiAgICAgICAgfSxcbiAgICAgICAgYWRkTGFiZWxzKCl7XG4gICAgICAgICAgICB0aGlzLmVhY2hTZXJpZXMuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnc2VyaWVzLWxhYmVsJylcbiAgICAgICAgICAgICAgICAuaHRtbCgoZCkgPT4gJzx0c3BhbiB4PVwiMFwiPicgKyB0aGlzLnBhcmVudC5sYWJlbChkLmtleSkucmVwbGFjZSgvXFxcXG4vZywnPC90c3Bhbj48dHNwYW4geD1cIjBcIiBkeT1cIjEuMmVtXCI+JykgKyAnPC90c3Bhbj4nKVxuICAgICAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAoZCkgPT4gYHRyYW5zbGF0ZSgke3RoaXMud2lkdGggKyA1fSwgJHt0aGlzLnlTY2FsZShkLnZhbHVlc1tkLnZhbHVlcy5sZW5ndGggLSAxXVt0aGlzLmNvbmZpZy52YXJpYWJsZVldKSArIDN9KWApO1xuICAgICAgICB9LFxuICAgICAgICBhZGRQb2ludHMoKXtcbiAgICAgICAgICAgIHRoaXMucG9pbnRzID0gdGhpcy5lYWNoU2VyaWVzLnNlbGVjdEFsbCgncG9pbnRzJylcbiAgICAgICAgICAgICAgICAuZGF0YShkID0+IGQudmFsdWVzKVxuICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnY2lyY2xlJylcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnZGF0YS1wb2ludCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ3InLCAnNCcpXG4gICAgICAgICAgICAgICAgLmF0dHIoJ2N4JywgZCA9PiB0aGlzLnhTY2FsZShkMy50aW1lUGFyc2UodGhpcy54VGltZVR5cGUpKGRbdGhpcy5jb25maWcudmFyaWFibGVYXSkpKVxuICAgICAgICAgICAgICAgIC5hdHRyKCdjeScsIGQgPT4gdGhpcy55U2NhbGUoZFt0aGlzLmNvbmZpZy52YXJpYWJsZVldKSlcbiAgICAgICAgICAgICAgICAub24oJ21vdXNlb3ZlcicsIHRoaXMudG9vbHRpcC5zaG93KVxuICAgICAgICAgICAgICAgIC5vbignbW91c2VvdXQnLCB0aGlzLnRvb2x0aXAuaGlkZSlcbiAgICAgICAgICAgICAgICAuY2FsbCh0aGlzLnRvb2x0aXApO1xuICAgICAgICB9LFxuICAgICAgICBzZXRUb29sdGlwcygpe1xuICAgICAgICAgICAgdGhpcy50b29sdGlwID0gZDMudGlwKClcbiAgICAgICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwiZDMtdGlwXCIpXG4gICAgICAgICAgICAgICAgLmRpcmVjdGlvbignbicpXG4gICAgICAgICAgICAgICAgLm9mZnNldChbLTgsIDBdKVxuICAgICAgICAgICAgICAgIC5odG1sKCgpID0+ICdoZWxsbycpO1xuICAgICAgICB9XG4gICAgfTtcblxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgQ2hhcnREaXZcbiAgICB9O1xuXG59KSgpO1xuIiwiZXhwb3J0IGNvbnN0IEhlbHBlcnMgPSAoZnVuY3Rpb24oKXtcbiAgICAvKiBnbG9iYWxzIERPTVN0cmluZ01hcCAqL1xuICAgIFN0cmluZy5wcm90b3R5cGUuY2xlYW5TdHJpbmcgPSBmdW5jdGlvbigpIHsgLy8gbG93ZXJjYXNlIGFuZCByZW1vdmUgcHVuY3R1YXRpb24gYW5kIHJlcGxhY2Ugc3BhY2VzIHdpdGggaHlwaGVuczsgZGVsZXRlIHB1bmN0dWF0aW9uXG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2UoL1sgXFxcXFxcL10vZywnLScpLnJlcGxhY2UoL1snXCLigJ3igJnigJzigJgsXFwuIVxcPztcXChcXCkmXS9nLCcnKS50b0xvd2VyQ2FzZSgpO1xuICAgIH07XG5cbiAgICBTdHJpbmcucHJvdG90eXBlLnJlbW92ZVVuZGVyc2NvcmVzID0gZnVuY3Rpb24oKSB7IFxuICAgICAgICByZXR1cm4gdGhpcy5yZXBsYWNlKC9fL2csJyAnKTtcbiAgICB9O1xuXG4gICAgRE9NU3RyaW5nTWFwLnByb3RvdHlwZS5jb252ZXJ0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBuZXdPYmogPSB7fTtcbiAgICAgICAgZm9yICggdmFyIGtleSBpbiB0aGlzICl7XG4gICAgICAgICAgICBpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eShrZXkpKXtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBuZXdPYmpba2V5XSA9IEpTT04ucGFyc2UodGhpc1trZXldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld09ialtrZXldID0gdGhpc1trZXldOyAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3T2JqO1xuICAgIH07XG59KSgpO1xuIiwiLy8gZDMudGlwXG4vLyBDb3B5cmlnaHQgKGMpIDIwMTMgSnVzdGluIFBhbG1lclxuLy8gRVM2IC8gRDMgdjQgQWRhcHRpb24gQ29weXJpZ2h0IChjKSAyMDE2IENvbnN0YW50aW4gR2F2cmlsZXRlXG4vLyBSZW1vdmFsIG9mIEVTNiBmb3IgRDMgdjQgQWRhcHRpb24gQ29weXJpZ2h0IChjKSAyMDE2IERhdmlkIEdvdHpcbi8vXG4vLyBUb29sdGlwcyBmb3IgZDMuanMgU1ZHIHZpc3VhbGl6YXRpb25zXG5cbmV4cG9ydCBjb25zdCBkM1RpcCA9IChmdW5jdGlvbigpe1xuICBkMy5mdW5jdG9yID0gZnVuY3Rpb24gZnVuY3Rvcih2KSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2ID09PSBcImZ1bmN0aW9uXCIgPyB2IDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdjtcbiAgICB9O1xuICB9O1xuXG4gIGQzLnRpcCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIGRpcmVjdGlvbiA9IGQzX3RpcF9kaXJlY3Rpb24sXG4gICAgICAgIG9mZnNldCAgICA9IGQzX3RpcF9vZmZzZXQsXG4gICAgICAgIGh0bWwgICAgICA9IGQzX3RpcF9odG1sLFxuICAgICAgICBub2RlICAgICAgPSBpbml0Tm9kZSgpLFxuICAgICAgICBzdmcgICAgICAgPSBudWxsLFxuICAgICAgICBwb2ludCAgICAgPSBudWxsLFxuICAgICAgICB0YXJnZXQgICAgPSBudWxsXG5cbiAgICBmdW5jdGlvbiB0aXAodmlzKSB7XG4gICAgICBzdmcgPSBnZXRTVkdOb2RlKHZpcylcbiAgICAgIHBvaW50ID0gc3ZnLmNyZWF0ZVNWR1BvaW50KClcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm9kZSlcbiAgICB9XG5cbiAgICAvLyBQdWJsaWMgLSBzaG93IHRoZSB0b29sdGlwIG9uIHRoZSBzY3JlZW5cbiAgICAvL1xuICAgIC8vIFJldHVybnMgYSB0aXBcbiAgICB0aXAuc2hvdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgICBpZihhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gaW5zdGFuY2VvZiBTVkdFbGVtZW50KSB0YXJnZXQgPSBhcmdzLnBvcCgpXG5cbiAgICAgIHZhciBjb250ZW50ID0gaHRtbC5hcHBseSh0aGlzLCBhcmdzKSxcbiAgICAgICAgICBwb2Zmc2V0ID0gb2Zmc2V0LmFwcGx5KHRoaXMsIGFyZ3MpLFxuICAgICAgICAgIGRpciAgICAgPSBkaXJlY3Rpb24uYXBwbHkodGhpcywgYXJncyksXG4gICAgICAgICAgbm9kZWwgICA9IGdldE5vZGVFbCgpLFxuICAgICAgICAgIGkgICAgICAgPSBkaXJlY3Rpb25zLmxlbmd0aCxcbiAgICAgICAgICBjb29yZHMsXG4gICAgICAgICAgc2Nyb2xsVG9wICA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AsXG4gICAgICAgICAgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdFxuXG4gICAgICBub2RlbC5odG1sKGNvbnRlbnQpXG4gICAgICAgIC5zdHlsZSgncG9zaXRpb24nLCAnYWJzb2x1dGUnKVxuICAgICAgICAuc3R5bGUoJ29wYWNpdHknLCAxKVxuICAgICAgICAuc3R5bGUoJ3BvaW50ZXItZXZlbnRzJywgJ2FsbCcpXG5cbiAgICAgIHdoaWxlKGktLSkgbm9kZWwuY2xhc3NlZChkaXJlY3Rpb25zW2ldLCBmYWxzZSlcbiAgICAgIGNvb3JkcyA9IGRpcmVjdGlvbl9jYWxsYmFja3NbZGlyXS5hcHBseSh0aGlzKVxuICAgICAgbm9kZWwuY2xhc3NlZChkaXIsIHRydWUpXG4gICAgICAgIC5zdHlsZSgndG9wJywgKGNvb3Jkcy50b3AgKyAgcG9mZnNldFswXSkgKyBzY3JvbGxUb3AgKyAncHgnKVxuICAgICAgICAuc3R5bGUoJ2xlZnQnLCAoY29vcmRzLmxlZnQgKyBwb2Zmc2V0WzFdKSArIHNjcm9sbExlZnQgKyAncHgnKVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljIC0gaGlkZSB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gUmV0dXJucyBhIHRpcFxuICAgIHRpcC5oaWRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbm9kZWwgPSBnZXROb2RlRWwoKVxuICAgICAgbm9kZWxcbiAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywgMClcbiAgICAgICAgLnN0eWxlKCdwb2ludGVyLWV2ZW50cycsICdub25lJylcbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFByb3h5IGF0dHIgY2FsbHMgdG8gdGhlIGQzIHRpcCBjb250YWluZXIuICBTZXRzIG9yIGdldHMgYXR0cmlidXRlIHZhbHVlLlxuICAgIC8vXG4gICAgLy8gbiAtIG5hbWUgb2YgdGhlIGF0dHJpYnV0ZVxuICAgIC8vIHYgLSB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlXG4gICAgLy9cbiAgICAvLyBSZXR1cm5zIHRpcCBvciBhdHRyaWJ1dGUgdmFsdWVcbiAgICB0aXAuYXR0ciA9IGZ1bmN0aW9uKG4sIHYpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMiAmJiB0eXBlb2YgbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGdldE5vZGVFbCgpLmF0dHIobilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBhcmdzID0gIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICAgICAgZDMuc2VsZWN0aW9uLnByb3RvdHlwZS5hdHRyLmFwcGx5KGdldE5vZGVFbCgpLCBhcmdzKVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBQcm94eSBzdHlsZSBjYWxscyB0byB0aGUgZDMgdGlwIGNvbnRhaW5lci4gIFNldHMgb3IgZ2V0cyBhIHN0eWxlIHZhbHVlLlxuICAgIC8vXG4gICAgLy8gbiAtIG5hbWUgb2YgdGhlIHByb3BlcnR5XG4gICAgLy8gdiAtIHZhbHVlIG9mIHRoZSBwcm9wZXJ0eVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3Igc3R5bGUgcHJvcGVydHkgdmFsdWVcbiAgICB0aXAuc3R5bGUgPSBmdW5jdGlvbihuLCB2KSB7XG4gICAgICAvLyBkZWJ1Z2dlcjtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMiAmJiB0eXBlb2YgbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGdldE5vZGVFbCgpLnN0eWxlKG4pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIHZhciBzdHlsZXMgPSBhcmdzWzBdO1xuICAgICAgICAgIE9iamVjdC5rZXlzKHN0eWxlcykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBkMy5zZWxlY3Rpb24ucHJvdG90eXBlLnN0eWxlLmFwcGx5KGdldE5vZGVFbCgpLCBba2V5LCBzdHlsZXNba2V5XV0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aXBcbiAgICB9XG5cbiAgICAvLyBQdWJsaWM6IFNldCBvciBnZXQgdGhlIGRpcmVjdGlvbiBvZiB0aGUgdG9vbHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIE9uZSBvZiBuKG5vcnRoKSwgcyhzb3V0aCksIGUoZWFzdCksIG9yIHcod2VzdCksIG53KG5vcnRod2VzdCksXG4gICAgLy8gICAgIHN3KHNvdXRod2VzdCksIG5lKG5vcnRoZWFzdCkgb3Igc2Uoc291dGhlYXN0KVxuICAgIC8vXG4gICAgLy8gUmV0dXJucyB0aXAgb3IgZGlyZWN0aW9uXG4gICAgdGlwLmRpcmVjdGlvbiA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGRpcmVjdGlvblxuICAgICAgZGlyZWN0aW9uID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogU2V0cyBvciBnZXRzIHRoZSBvZmZzZXQgb2YgdGhlIHRpcFxuICAgIC8vXG4gICAgLy8gdiAtIEFycmF5IG9mIFt4LCB5XSBvZmZzZXRcbiAgICAvL1xuICAgIC8vIFJldHVybnMgb2Zmc2V0IG9yXG4gICAgdGlwLm9mZnNldCA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIG9mZnNldFxuICAgICAgb2Zmc2V0ID0gdiA9PSBudWxsID8gdiA6IGQzLmZ1bmN0b3IodilcblxuICAgICAgcmV0dXJuIHRpcFxuICAgIH1cblxuICAgIC8vIFB1YmxpYzogc2V0cyBvciBnZXRzIHRoZSBodG1sIHZhbHVlIG9mIHRoZSB0b29sdGlwXG4gICAgLy9cbiAgICAvLyB2IC0gU3RyaW5nIHZhbHVlIG9mIHRoZSB0aXBcbiAgICAvL1xuICAgIC8vIFJldHVybnMgaHRtbCB2YWx1ZSBvciB0aXBcbiAgICB0aXAuaHRtbCA9IGZ1bmN0aW9uKHYpIHtcbiAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGh0bWxcbiAgICAgIGh0bWwgPSB2ID09IG51bGwgPyB2IDogZDMuZnVuY3Rvcih2KVxuXG4gICAgICByZXR1cm4gdGlwXG4gICAgfVxuXG4gICAgLy8gUHVibGljOiBkZXN0cm95cyB0aGUgdG9vbHRpcCBhbmQgcmVtb3ZlcyBpdCBmcm9tIHRoZSBET01cbiAgICAvL1xuICAgIC8vIFJldHVybnMgYSB0aXBcbiAgICB0aXAuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYobm9kZSkge1xuICAgICAgICBnZXROb2RlRWwoKS5yZW1vdmUoKTtcbiAgICAgICAgbm9kZSA9IG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGlwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGQzX3RpcF9kaXJlY3Rpb24oKSB7IHJldHVybiAnbicgfVxuICAgIGZ1bmN0aW9uIGQzX3RpcF9vZmZzZXQoKSB7IHJldHVybiBbMCwgMF0gfVxuICAgIGZ1bmN0aW9uIGQzX3RpcF9odG1sKCkgeyByZXR1cm4gJyAnIH1cblxuICAgIHZhciBkaXJlY3Rpb25fY2FsbGJhY2tzID0ge1xuICAgICAgbjogIGRpcmVjdGlvbl9uLFxuICAgICAgczogIGRpcmVjdGlvbl9zLFxuICAgICAgZTogIGRpcmVjdGlvbl9lLFxuICAgICAgdzogIGRpcmVjdGlvbl93LFxuICAgICAgbnc6IGRpcmVjdGlvbl9udyxcbiAgICAgIG5lOiBkaXJlY3Rpb25fbmUsXG4gICAgICBzdzogZGlyZWN0aW9uX3N3LFxuICAgICAgc2U6IGRpcmVjdGlvbl9zZVxuICAgIH07XG5cbiAgICB2YXIgZGlyZWN0aW9ucyA9IE9iamVjdC5rZXlzKGRpcmVjdGlvbl9jYWxsYmFja3MpO1xuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX24oKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5uLnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5uLnggLSBub2RlLm9mZnNldFdpZHRoIC8gMlxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9zKCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3gucy55LFxuICAgICAgICBsZWZ0OiBiYm94LnMueCAtIG5vZGUub2Zmc2V0V2lkdGggLyAyXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX2UoKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC5lLnkgLSBub2RlLm9mZnNldEhlaWdodCAvIDIsXG4gICAgICAgIGxlZnQ6IGJib3guZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3coKSB7XG4gICAgICB2YXIgYmJveCA9IGdldFNjcmVlbkJCb3goKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiAgYmJveC53LnkgLSBub2RlLm9mZnNldEhlaWdodCAvIDIsXG4gICAgICAgIGxlZnQ6IGJib3gudy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9udygpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm53LnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5udy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9uZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94Lm5lLnkgLSBub2RlLm9mZnNldEhlaWdodCxcbiAgICAgICAgbGVmdDogYmJveC5uZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZGlyZWN0aW9uX3N3KCkge1xuICAgICAgdmFyIGJib3ggPSBnZXRTY3JlZW5CQm94KClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvcDogIGJib3guc3cueSxcbiAgICAgICAgbGVmdDogYmJveC5zdy54IC0gbm9kZS5vZmZzZXRXaWR0aFxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRpcmVjdGlvbl9zZSgpIHtcbiAgICAgIHZhciBiYm94ID0gZ2V0U2NyZWVuQkJveCgpXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6ICBiYm94LnNlLnksXG4gICAgICAgIGxlZnQ6IGJib3guZS54XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5pdE5vZGUoKSB7XG4gICAgICB2YXIgbm9kZSA9IGQzLnNlbGVjdChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSlcbiAgICAgIG5vZGVcbiAgICAgICAgLnN0eWxlKCdwb3NpdGlvbicsICdhYnNvbHV0ZScpXG4gICAgICAgIC5zdHlsZSgndG9wJywgMClcbiAgICAgICAgLnN0eWxlKCdvcGFjaXR5JywgMClcbiAgICAgICAgLnN0eWxlKCdwb2ludGVyLWV2ZW50cycsICdub25lJylcbiAgICAgICAgLnN0eWxlKCdib3gtc2l6aW5nJywgJ2JvcmRlci1ib3gnKVxuXG4gICAgICByZXR1cm4gbm9kZS5ub2RlKClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRTVkdOb2RlKGVsKSB7XG4gICAgICBlbCA9IGVsLm5vZGUoKVxuICAgICAgaWYoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnc3ZnJylcbiAgICAgICAgcmV0dXJuIGVsXG5cbiAgICAgIHJldHVybiBlbC5vd25lclNWR0VsZW1lbnRcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXROb2RlRWwoKSB7XG4gICAgICBpZihub2RlID09PSBudWxsKSB7XG4gICAgICAgIG5vZGUgPSBpbml0Tm9kZSgpO1xuICAgICAgICAvLyByZS1hZGQgbm9kZSB0byBET01cbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKTtcbiAgICAgIH07XG4gICAgICByZXR1cm4gZDMuc2VsZWN0KG5vZGUpO1xuICAgIH1cblxuICAgIC8vIFByaXZhdGUgLSBnZXRzIHRoZSBzY3JlZW4gY29vcmRpbmF0ZXMgb2YgYSBzaGFwZVxuICAgIC8vXG4gICAgLy8gR2l2ZW4gYSBzaGFwZSBvbiB0aGUgc2NyZWVuLCB3aWxsIHJldHVybiBhbiBTVkdQb2ludCBmb3IgdGhlIGRpcmVjdGlvbnNcbiAgICAvLyBuKG5vcnRoKSwgcyhzb3V0aCksIGUoZWFzdCksIHcod2VzdCksIG5lKG5vcnRoZWFzdCksIHNlKHNvdXRoZWFzdCksIG53KG5vcnRod2VzdCksXG4gICAgLy8gc3coc291dGh3ZXN0KS5cbiAgICAvL1xuICAgIC8vICAgICstKy0rXG4gICAgLy8gICAgfCAgIHxcbiAgICAvLyAgICArICAgK1xuICAgIC8vICAgIHwgICB8XG4gICAgLy8gICAgKy0rLStcbiAgICAvL1xuICAgIC8vIFJldHVybnMgYW4gT2JqZWN0IHtuLCBzLCBlLCB3LCBudywgc3csIG5lLCBzZX1cbiAgICBmdW5jdGlvbiBnZXRTY3JlZW5CQm94KCkge1xuICAgICAgdmFyIHRhcmdldGVsICAgPSB0YXJnZXQgfHwgZDMuZXZlbnQudGFyZ2V0O1xuXG4gICAgICB3aGlsZSAoJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiB0YXJnZXRlbC5nZXRTY3JlZW5DVE0gJiYgJ3VuZGVmaW5lZCcgPT09IHRhcmdldGVsLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICB0YXJnZXRlbCA9IHRhcmdldGVsLnBhcmVudE5vZGU7XG4gICAgICB9XG5cbiAgICAgIHZhciBiYm94ICAgICAgID0ge30sXG4gICAgICAgICAgbWF0cml4ICAgICA9IHRhcmdldGVsLmdldFNjcmVlbkNUTSgpLFxuICAgICAgICAgIHRiYm94ICAgICAgPSB0YXJnZXRlbC5nZXRCQm94KCksXG4gICAgICAgICAgd2lkdGggICAgICA9IHRiYm94LndpZHRoLFxuICAgICAgICAgIGhlaWdodCAgICAgPSB0YmJveC5oZWlnaHQsXG4gICAgICAgICAgeCAgICAgICAgICA9IHRiYm94LngsXG4gICAgICAgICAgeSAgICAgICAgICA9IHRiYm94LnlcblxuICAgICAgcG9pbnQueCA9IHhcbiAgICAgIHBvaW50LnkgPSB5XG4gICAgICBiYm94Lm53ID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggKz0gd2lkdGhcbiAgICAgIGJib3gubmUgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueSArPSBoZWlnaHRcbiAgICAgIGJib3guc2UgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCAtPSB3aWR0aFxuICAgICAgYmJveC5zdyA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55IC09IGhlaWdodCAvIDJcbiAgICAgIGJib3gudyAgPSBwb2ludC5tYXRyaXhUcmFuc2Zvcm0obWF0cml4KVxuICAgICAgcG9pbnQueCArPSB3aWR0aFxuICAgICAgYmJveC5lID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcbiAgICAgIHBvaW50LnggLT0gd2lkdGggLyAyXG4gICAgICBwb2ludC55IC09IGhlaWdodCAvIDJcbiAgICAgIGJib3gubiA9IHBvaW50Lm1hdHJpeFRyYW5zZm9ybShtYXRyaXgpXG4gICAgICBwb2ludC55ICs9IGhlaWdodFxuICAgICAgYmJveC5zID0gcG9pbnQubWF0cml4VHJhbnNmb3JtKG1hdHJpeClcblxuICAgICAgcmV0dXJuIGJib3hcbiAgICB9XG5cbiAgICByZXR1cm4gdGlwXG4gIH07XG59KSgpOyJdfQ==
