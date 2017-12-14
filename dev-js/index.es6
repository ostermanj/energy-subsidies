 /* exported D3Charts, Helpers */ // let's jshint know that D3Charts can be "defined but not used" in this file
 /* polyfills needed: Promise, Array.isArray, Array.find, Array.filter

 */
import { Helpers } from '../js-exports/Helpers';

var D3Charts = (function(){  
"use strict"; 
    var model,
        view,
        controller; // can these be in this scope without collision bt instances of D3ChartGroup?
                    // alternative: pass them in as parameters
    
    var D3ChartGroup = function(container){
        model = this.model;
        view = this.view;
        controller = this.controller;
        controller.initController(container);
    };
    //prototype begins here
    D3ChartGroup.prototype = {
        model: {
            init(container){ // SHOULD THIS STUFF BE IN CONTROLLER? yes, probably
                var groupConfig = container.dataset;
                this.dataPromises = [];
                this.nestBy = JSON.parse(groupConfig.nestBy);
                var sheetID = groupConfig.sheetId, 
                    tabs = [groupConfig.dataTab,groupConfig.dictionaryTab]; // this should come from HTML
                                                    // is there a case for more than one sheet of data?

                tabs.forEach((each, i) => {
                    var promise = new Promise((resolve,reject) => {
                        d3.json('https://sheets.googleapis.com/v4/spreadsheets/' + sheetID + '/values/' + each + '?key=AIzaSyDD3W5wJeJF2esffZMQxNtEl9tt-OfgSq4', (error,data) => { // columns A through I
                            if (error) {
                                reject(error);
                                throw error;
                            }
                            var values = data.values;
                            var nestType = each === 'dictionary' ? 'object' : 'series'; // nestType for data should come from HTML
                            resolve(this.returnKeyValues(values, model.nestBy, true, nestType, i)); 
                        });
                    });
                    this.dataPromises.push(promise);
                });
                return Promise.all(this.dataPromises);
            },
            summarizeData(){ // this fn creates an array of objects summarizing the data in model.data. model.data is nested
                             // and nesting and rolling up cannot be done easily at the same time, so they're done separately.
                             // the summaries provide average, max, min of all fields in the data at all levels of nesting. 
                             // the first (index 0) is one layer nested, the second is two, and so on.
                this.summaries = [];
                var variables = Object.keys(this.unnested[0]); // all need to have the same fields
                var nestByArray = Array.isArray(this.nestBy) ? this.nestBy : [this.nestBy];
                function reduceVariables(d){
                    return variables.reduce(function(acc, cur){
                        acc[cur] = {
                            max:       d3.max(d, d => d[cur]),
                            min:       d3.min(d, d => d[cur]),
                            mean:      d3.mean(d, d => d[cur]),
                            sum:       d3.sum(d, d => d[cur]),
                            median:    d3.median(d, d => d[cur]),
                            variance:  d3.variance(d, d => d[cur]),
                            deviation: d3.deviation(d, d => d[cur])
                        };
                        return acc;
                    },{});
                }
                while ( nestByArray.length > 0){
                    let summarized = this.nestPrelim(nestByArray)
                        .rollup(reduceVariables)
                        .object(this.unnested);
                    this.summaries.unshift(summarized);      
                    nestByArray.pop();
                }
            }, 
            nestPrelim(nestByArray){
                // recursive  nesting function used by summarizeData and returnKeyValues
                return nestByArray.reduce(function(acc, cur){
                    if (typeof cur !== 'string' && typeof cur !== 'function' ) { throw 'each nestBy item must be a string or function'; }
                    var rtn;
                    if ( typeof cur === 'string' ){
                        rtn = acc.key(function(d){
                            return d[cur];
                        });    
                    }
                    if ( typeof cur === 'function' ){
                        rtn = acc.key(function(d){
                            return cur(d);
                        });
                    }
                    return rtn;
                }, d3.nest());
            },       
            returnKeyValues(values, nestBy, coerce = false, nestType = 'series', tabIndex = 0){
            // this fn takes normalized data fetched as an array of rows and uses the values in the first row as keys for values in
            // subsequent rows
            // nestBy = string or array of field(s) to nest by, or a custom function, or an array of strings or functions;
            // coerce = BOOL coerce to num or not; nestType = object or series nest (d3)
                
                var prelim; 
                var unnested = values.slice(1).map(row => row.reduce(function(acc, cur, i) { 
                // 1. params: total, currentValue, currentIndex[, arr]
                // 3. // acc is an object , key is corresponding value from row 0, value is current value of array
                  acc[values[0][i]] = coerce === true ? isNaN(+cur) || cur === '' ? cur : +cur : cur; 
                    return acc;                                        // test for empty strings before coercing bc +'' => 0
                }, {}));
                if ( tabIndex === 0 ) {
                    model.unnested = unnested;
                }           
                if ( !nestBy ){
                    return unnested;
                } else {
                    if ( typeof nestBy === 'string' || typeof nestBy === 'function' ) { // ie only one nestBy field or funciton
                        prelim = model.nestPrelim([nestBy]);
                    } else {
                        if (!Array.isArray(nestBy)) { throw 'nestBy variable must be a string, function, or array of strings or functions'; }
                        prelim = model.nestPrelim(nestBy);
                    }
                }
                if ( nestType === 'object' ){
                    return prelim
                        .object(unnested);
                } else {
                    return prelim
                        .entries(unnested);
                }
            }
        },

        view: {
            init(container){
                this.margins = { // default values ; can be set be each SVGs DOM dataset (html data attributes).
                                 // ALSO default should be able to come from HTML
                    top:20,
                    right:45,
                    bottom:15,
                    left:35
                };
                this.activeField = 'pb25l'; // this should come from HTML
                this.setupCharts(container);
            },
            label(key){ // if you can get the summary values to be keyed all the way down, you wouldn't need Array.find
               return model.dictionary.find(each => each.key === key).label;
            },
            setupCharts(container){ 
                var chartDivs = d3.select(container).selectAll('.d3-chart'); 
                console.log(chartDivs);

                chartDivs.each(function() { // TO DO differentiate chart types from html dataset
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
                        datum = model.data.find(each => each.key === config.category),
                        minX = 2015, // !!! NOT PROGRAMATIC
                        maxX = 2045, // !!! NOT PROGRAMATIC
                        // BELOW needs input from HTML--default maxes and mins in case natural min > 0, max < 0, or simply want to override
                        minY = model.summaries[0][datum.key][view.activeField + '_value'].min < 0 ? model.summaries[0][datum.key][view.activeField + '_value'].min : 0,
                        maxY = model.summaries[0][datum.key][view.activeField + '_value'].max > Math.abs(minY / 2) ? model.summaries[0][datum.key][view.activeField + '_value'].max : Math.abs(minY / 2),
                        parseTime = d3.timeParse('%Y'), // !!! NOT PROGRAMATIC
                        x = d3.scaleTime().range([0, width]).domain([parseTime(minX),parseTime(maxX)]), // !!! NOT PROGRAMATIC
                        y = d3.scaleLinear().range([height, 0]).domain([minY,maxY]),  // !!! NOT PROGRAMATIC
                        chartDiv = d3.select(this)
                            .datum(datum),
                        headings = chartDiv.append('p'),
                        SVGs = chartDiv.append('div')
                            .attr('class','flex')
                            .selectAll('SVGs')
                            .data(d => groupSeries(d.values) )
                            .enter().append('svg')
                            .attr('width', config.eachWidth)
                            .attr('height', height + marginTop + marginBottom)
                            .append('g')
                            .attr('transform', `translate(${marginLeft},${marginTop})`),
                        valueline = d3.line()
                            .x(d => x(parseTime(d.year)) ) // !! not programmatic
                            .y(d => y(d[view.activeField + '_value']) ); // !! not programmatic

                    function groupSeries(data){
                        var seriesGroups,
                            groupsInstruct = config.seriesGroup ? JSON.parse(config.seriesGroup) : 'none';
                        if ( Array.isArray( groupsInstruct ) ) {
                            seriesGroups = [];
                            JSON.parse(config.seriesGroup).forEach(group => {
                                seriesGroups.push(data.filter(series => group.indexOf(series.key) !== -1));
                            });
                        } else if ( groupsInstruct === 'none' ) {
                            seriesGroups = data.map(each => [each]);
                        } else if ( groupsInstruct === 'all' ) {
                            seriesGroups = [data.map(each => each)];
                        } else {
                            throw `Invalid data-group-series instruction from html. 
                                   Must be valid JSON: "None" or "All" or an array
                                   of arrays containing the series to be grouped
                                   together. All strings must be double-quoted.`;
                        }
                        return seriesGroups;
                    } // end groupSeries()

                    
                    /* HEADINGS */
                        headings.html(d => '<strong>' + view.label(d.key) + '</strong>');

                    /* SVGS */
                    
                    SVGs.each(function(d,i){
                        var SVG = d3.select(this),
                            data = SVG.data(),
                            units,
                            seriesGroups = SVG
                                .selectAll('series-groups')
                                .data(data)
                                .enter().append('g');

                        function addYAxis(repeated = '', showUnits = false){  // !! NOT PROGRAMMATIC
                            /* jshint validthis: true */ /* <- comment keeps jshint from falsely warning that
                                                               `this` will be undefined. the .call() method
                                                               defines `this` */
                            d3.select(this).append('g')
                              .attr('class', () => 'axis y-axis ' + repeated)
                              .call(d3.axisLeft(y).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5));

                            if ( showUnits ) {
                            
                            d3.select(this).append('text')
                              .attr('class', 'units')
                              .attr('transform', () => `translate(-${marginLeft},-${marginTop - 10})`)
                              .text(() => units.removeUnderscores());
                            }
                        }

                        /* PATHS */

                        if ( config.type === 'line' ){
                            seriesGroups // !! NOT PROGRAMMATIC , IE, TYPE NEEDS TO BE SPECIFIED BY config.type
                                .selectAll('series')
                                .data(d => {
                                    return d;
                                })
                                .enter().append('path')
                                .attr('class', () => {
                                    return 'line line-' + lineIndex++;

                                })
                                .attr('d', (d,j) => {
                                    units = d.values[1].units;
                                    if ( scaleInstruct.indexOf(d.key) !== -1 ){ // TODO: resetting scale make the series min,max from the
                                                                                // series' own data, not the one it's grouped with 
                                        /* NOT PROGRAMMATIC */ minY = model.summaries[1][datum.key][d.key][view.activeField + '_value'].min < 0 ? model.summaries[1][datum.key][d.key][view.activeField + '_value'].min : 0;
                                        /* NOT PROGRAMMATIC */ maxY = model.summaries[1][datum.key][d.key][view.activeField + '_value'].max > Math.abs(minY / 2) ? model.summaries[1][datum.key][d.key][view.activeField + '_value'].max : Math.abs(minY / 2);
                                        x = d3.scaleTime().range([0, width]).domain([parseTime(minX),parseTime(maxX)]);
                                        y = d3.scaleLinear().range([height, 0]).domain([minY,maxY]);
                                        if ( i !== 0 && j === 0 ) {
                                            addYAxis.call(this,'', true);
                                        } 
                                    } else if ( i !== 0 && j === 0 ) {
                                         addYAxis.call(this,'repeated');
                                    }
                                    d.values.unshift({year:2015,[view.activeField + '_value']:0}); //TO DO: put in data
                                    return valueline(d.values);
                                })
                                .each(d => {
                                   // var data = d3.select(this).data();
                                    if (config.directLabel){
                                        SVG.append('text')
                                            .attr('class', () => 'series-label series-' + seriesIndex++)
                                            .html(() => '<tspan x="0">' + view.label(d.key).replace(/\\n/g,'</tspan><tspan x="0" dy="1.2em">') + '</tspan>')
                                            .attr('transform', () => `translate(${width + 3},${y(d.values[d.values.length - 1][view.activeField + '_value']) + 3})`);
                                    }
                                });

                            /* X AXIS */

                            SVG.append('g')
                                .attr('transform', 'translate(0,' + y(0) + ')')
                                .attr('class', 'axis x-axis')
                                .call(d3.axisBottom(x).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).tickValues([parseTime(2025),parseTime(2035),parseTime(2045)]));
                            
                            /* Y AXIS */    
                            if ( i === 0 ) { // i here is from the SVG.each loop. append yAxis to all first SVGs of chartDiv
                                addYAxis.call(this, '', true);
                            }
                        } // end if type === 'line'
                    }); // end SVGs.each()
                }); // end chartDivs.each()
            } // end view.setupCharts()
        }, // end view

        controller: {
            initController: function(container){
                console.log(this); // `this` is controller
                console.log(model);
                console.log(view);
                model.init(container).then(values => {
                    model.data = values[0];
                    model.dictionary = values[1].undefined.undefined; // !! NOT PROGRAMMATIC / CONSISTENT
                    model.summarizeData();
                    view.init(container);
                });
            }
        }
    }; // D3ChartGroup prototype ends here
    
    window.D3Charts = { // need to specify window bc after transpiling all this will be wrapped in IIFEs
                        // and `return`ing won't get the export into window's global scope
        Init(){
            document.querySelectorAll('.d3-group').forEach(each => {
                new D3ChartGroup(each);
            });
            // call new constructor for each wrapper div
        }
    };
}()); // end var D3Charts IIFE