(function(){  
"use strict"; 
    function cleanString(str){
        return str.replace(/_/g,' ');
    }
    const model = {
        init(){ // SHOULD THIS STUFF BE IN CONTROLLER?
            this.dataPromises = [];
            this.nestBy = ['category','series'];
            var sheetID = '1_G9HsJbxRBd7fWTF51Xr8lpxGxxImVcc-rTIaQbEeyA',
                tabs = ['Sheet1','dictionary'];

            tabs.forEach((each, i) => {
                var promise = new Promise((resolve,reject) => {
                    d3.json('https://sheets.googleapis.com/v4/spreadsheets/' + sheetID + '/values/' + each + '?key=AIzaSyDD3W5wJeJF2esffZMQxNtEl9tt-OfgSq4', (error,data) => { // columns A through I
                        if (error) {
                            reject(error);
                            throw error;
                        }
                        var values = data.values;
                        console.log(values);
                        var nestType = each === 'dictionary' ? 'object' : 'series';
                        resolve(this.returnKeyValues(values, model.nestBy, true, nestType, i)); 
                    });
                });
                this.dataPromises.push(promise);
            });
console.log(this.dataPromises);
            return Promise.all([...this.dataPromises]);
        },
        summarizeData(){
            this.summaries = [];
            var variables = Object.keys(this.unnested[0]); // all need to have the same fields
            var nestByArray = Array.isArray(this.nestBy) ? this.nestBy : [this.nestBy];
            function reduceVariables(d){
                return variables.reduce(function(acc, cur){
                    acc[cur] = {
                        max: d3.max(d, d => d[cur]),
                        min: d3.min(d, d => d[cur]),
                        mean: d3.mean(d, d => d[cur])
                    };
                    return acc;
                },{});
            }
            while ( nestByArray.length > 0){

                let summarized = this.nestPrelim(nestByArray)
                    .rollup(reduceVariables)
                    .object(this.unnested);
                this.summaries.unshift(summarized); // creates an array of keyed summaries
                                                    // first (index 0) is one layer nested,
                                                    // second is two, and so on.    
                nestByArray.pop();
            }
        }, 

        nestPrelim(nestByArray){
            // recursive  nesting function
            console.log(nestByArray);
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
        returnKeyValues(values, nestBy, coerce = false, nestType = 'series', tabIndex = 0){ // nestBy = string or array of field(s) to nest by, or a custom function, or an array of strings or functions;
                                                                              // coerce = BOOL coerce to num or not
                                                                              // nestType = object or series nest (d3)
            
            var prelim; 
            var unnested = values.slice(1).map(row => row.reduce(function(acc, cur, i) { // 1. params: total, currentValue, currentIndex[, arr]
              acc[values[0][i]] = coerce === true ? isNaN(+cur) || cur === '' ? cur : +cur : cur; // 3. // acc is an object , key is corresponding value from row 0, value is current value of array
                return acc;                                        // test for empty strings before coercing bc +'' => 0
            }, {}));
            if ( tabIndex === 0 ) {
                model.unnested = unnested;
            }           
            if ( !nestBy ){
                return unnested;
            } else {
                console.log(nestBy);
                if ( typeof nestBy === 'string' || typeof nestBy === 'function' ) { // ie only one nestBy field or funciton
                    prelim = model.nestPrelim([nestBy]);
                } else {
                    if (!Array.isArray(nestBy)) { throw 'nestBy variable must be a string, function, or array of strings or functions'; }
                    prelim = model.nestPrelim(nestBy);
                }
            }
            if ( nestType === 'object' ){
                console.log('object');
                return prelim
                    .object(unnested);
            } else {
                console.log('series');
                return prelim
                    .entries(unnested);
            }
        }
    };

    const view = {
        init(){
            this.margins = { // default values ; can be set be each SVGs DOM dataset (html data attributes)
                top:20,
                right:15,
                bottom:15,
                left:35
            };
            this.activeField = 'pb25l';
            this.setupCharts();
        },
        label(key){
            return model.dictionary.find(each => each.key === key).label;
        },
        setupCharts(){ 
            var chartDivs = d3.selectAll('.d3-chart');

            chartDivs.each(function() { // TO DO differentiate chart types from html dataset
                function groupSeries(data){
                    var seriesGroups;
                    var groupsInstruct = config.seriesGroup ? JSON.parse(config.seriesGroup) : 'none';

                    console.log(data);
                    if ( Array.isArray( groupsInstruct ) ) {
                        seriesGroups = [];
                        JSON.parse(config.seriesGroup).forEach(group => {
                            console.log(group);
                            seriesGroups.push(data.filter(series => group.indexOf(series.key) !== -1));
                        });
                    } else if ( groupsInstruct === 'none' ) {
                        seriesGroups = data.map(each => [each]);
                    } else if ( groupsInstruct === 'all' ) {
                        seriesGroups = [data.map(each => each)];
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
                if ( !config.marginRight && config.directLabel ){
                    marginRight = 45;
                }
                var width = config.eachWidth - marginLeft - marginRight,
                    height = config.eachHeight ? config.eachHeight - marginTop - marginBottom : config.eachWidth / 2 - marginTop - marginBottom;
                var datum = model.data.find(each => each.key === config.category);
                console.log(datum);
                var chartDiv = d3.select(this)
                    .datum(datum);
                    console.log(datum);

console.log(model.summaries);
                var minX = 2015,
                    maxX = 2045,
                    minY = model.summaries[0][datum.key][view.activeField + '_value'].min < 0 ? model.summaries[0][datum.key][view.activeField + '_value'].min : 0,
                    maxY = model.summaries[0][datum.key][view.activeField + '_value'].max > Math.abs(minY / 2) ? model.summaries[0][datum.key][view.activeField + '_value'].max : Math.abs(minY / 2),
                    parseTime = d3.timeParse('%Y'),
                    x = d3.scaleTime().range([0, width]).domain([parseTime(minX),parseTime(maxX)]),
                    y = d3.scaleLinear().range([height, 0]).domain([minY,maxY]);
                    
                    console.log(minX,minY,maxX,maxY);


            /* HEADINGS */
                chartDiv.append('p')
                    .html(d => '<strong>' + view.label(d.key) + '</strong>');

                /* SVGS */
                
                var SVGs;    
                var svgContainer = chartDiv.append('div')
                        .attr('class','flex');
                
                SVGs = svgContainer.selectAll('SVGs')
                    .data((d,i,array) => {
                            console.log(d,i,array);
                            return groupSeries(d.values);
                        
                    })
                    .enter().append('svg')
                    .attr('width', config.eachWidth)
                    .attr('height', height + marginTop + marginBottom)
                    .append('g')
                    .attr('transform', `translate(${marginLeft},${marginTop})`);
                    
                
                var valueline =  d3.line()
                        .x(d => {console.log(d); return x(parseTime(d.year)); })
                        .y(d => y(d[view.activeField + '_value']) );

                SVGs.each(function(d,i,array){
                    var SVG = d3.select(this);
                    var data = SVG.data();
                    var units;
                    console.log(data);
                    var seriesGroups = SVG
                        .selectAll('series-groups')
                        .data(data)
                        .enter().append('g');

                    /* PATHS */

                    seriesGroups
                        .selectAll('series')
                        .data(d => {
                            console.log(d);
                            return d;
                        })
                        .enter().append('path')
                        .attr('class', () => {
                            return 'line line-' + lineIndex++;

                        })
                        .attr('d', (d,j) => {
                            units = d.values[1].units;
                            console.log(i, this, j);
                            console.log(d, d.key, datum.key);
                            console.log(scaleInstruct);
                            if ( scaleInstruct.indexOf(d.key) !== -1 ){
                                console.log(model.summaries);
                                minY = model.summaries[1][datum.key][d.key][view.activeField + '_value'].min < 0 ? model.summaries[1][datum.key][d.key][view.activeField + '_value'].min : 0;
                                maxY = model.summaries[1][datum.key][d.key][view.activeField + '_value'].max > Math.abs(minY / 2) ? model.summaries[1][datum.key][d.key][view.activeField + '_value'].max : Math.abs(minY / 2);
                                x = d3.scaleTime().range([0, width]).domain([parseTime(minX),parseTime(maxX)]);
                                y = d3.scaleLinear().range([height, 0]).domain([minY,maxY]);
                                if ( i !== 0 && j === 0 ) {
                                    addYAxis.call(this,'', true);
                                } 
                            } else if ( i !== 0 && j === 0 ) {
                                 addYAxis.call(this,'repeated');
                            }
                            d.values.unshift({year:2015,[view.activeField + '_value']:0});
                            return valueline(d.values);
                        })
                        .each(d => {
                           // var data = d3.select(this).data();
                            console.log(thisChartDiv);
                            if (config.directLabel){
                                console.log('directlabel');
                                SVG.append('text')
                                    .attr('class', () => 'series-label series-' + seriesIndex++)
                                    .html(() => '<tspan x="0">' + view.label(d.key).replace(/\\n/g,'</tspan><tspan x="0" dy="1.2em">') + '</tspan>')
                                    .attr('transform', () => `translate(${width + 3},${y(d.values[d.values.length - 1][view.activeField + '_value']) + 3})`);
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

                    SVG.append('g')
                          .attr('transform', 'translate(0,' + y(0) + ')')
                          .attr('class', 'axis x-axis')
                          .call(d3.axisBottom(x).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).tickValues([parseTime(2025),parseTime(2035),parseTime(2045)]));
                          console.log(d,i,array,this);
                   if ( i === 0 ) { // i here is from the SVG.each loop. append yAxis to all first SVGs of chartDiv
                        addYAxis.call(this, '', true);
                    }
                    function addYAxis(repeated = '', showUnits = false){
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
                          .text(() => cleanString(units));
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

    const controller = {
        init(){
            console.log('controller init');
            model.init().then(values => {
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
}());