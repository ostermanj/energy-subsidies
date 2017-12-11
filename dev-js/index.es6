(function(){  
"use strict"; 
    
    const model = {
        init(){ // SHOULD THIS STUFF BE IN CONTROLLER?
            this.dataPromises = [];
            this.nestBy = ['category','series'];
            var sheetID = '1_G9HsJbxRBd7fWTF51Xr8lpxGxxImVcc-rTIaQbEeyA',
                tabs = ['Sheet1'];

            tabs.forEach(each => {
                var promise = new Promise((resolve,reject) => {
                    d3.json('https://sheets.googleapis.com/v4/spreadsheets/' + sheetID + '/values/' + each + '?key=AIzaSyDD3W5wJeJF2esffZMQxNtEl9tt-OfgSq4', (error,data) => { // columns A through I
                        if (error) {
                            reject(error);
                            throw error;
                        }
                        var values = data.values;
                        console.log(values); 
                        resolve(this.returnKeyValues(values, model.nestBy, true)); 
                    });
                });
                this.dataPromises.push(promise);
            });

            return Promise.all(this.dataPromises);
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
        returnKeyValues(values, nestBy, coerce = false, nestType = 'series'){ // nestBy = string or array of field(s) to nest by, or a custom function, or an array of strings or functions;
                                                                              // coerce = BOOL coerce to num or not
                                                                              // nestType = object or series nest (d3)
            
            var prelim; 
            var unnested = values.slice(1).map(row => row.reduce(function(acc, cur, i) { // 1. params: total, currentValue, currentIndex[, arr]
              acc[values[0][i]] = coerce === true ? isNaN(+cur) || cur === '' ? cur : +cur : cur; // 3. // acc is an object , key is corresponding value from row 0, value is current value of array
                return acc;                                        // test for empty strings before coercing bc +'' => 0
            }, {}));
            model.unnested = unnested;
            window.unnested = unnested; // REMOVE
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
                top:5,
                right:15,
                bottom:15,
                left:10
            };
            this.activeField = 'pb25l';
            this.setupCharts();
        },
        setupCharts(){ 
            var chartDivs = d3.selectAll('.d3-chart');

            chartDivs.each(function(d,i,array) { // TO DO differentiate chart types from html dataset
                function groupSeries(data){
                    var groups;
                    var instruct = JSON.parse(config.seriesGroup);
                    console.log(data);
                    if ( Array.isArray( instruct ) ) {
                        groups = [];
                        JSON.parse(config.seriesGroup).forEach(group => {
                            console.log(group);
                            groups.push(data.filter(series => group.indexOf(series.key) !== -1));
                        });
                    } else if ( instruct === 'none' ) {
                        groups = data.map(each => [each]);
                    } else if ( instruct === 'all' ) {
                        groups = [data.map(each => each)];
                    }
                    console.log(groups);
                    return groups;
                }
                console.log(d,i,array);
                var lineIndex = 0;
                var config = this.dataset,
                    marginTop = config.marginTop || view.margins.top,
                    marginRight = config.marginRight || view.margins.right,
                    marginBottom = config.marginBottom || view.margins.bottom,
                    marginLeft = config.marginLeft || view.margins.left,
                    width = config.eachWidth - marginLeft - marginRight,
                    height = config.eachHeight ? config.eachHeight - marginTop - marginBottom : config.eachWidth / 2 - marginTop - marginBottom;

                var datum = model.data.find(each => each.key === config.category);
                console.log(datum);
                var chartDiv = d3.select(this)
                    .datum(datum);
                    console.log(datum);


                var minX = 2015,
                    maxX = 2045,
                    minY = model.summaries[0][datum.key][view.activeField + '_value'].min < 0 ? model.summaries[0][datum.key][view.activeField + '_value'].min : 0,
                    maxY = model.summaries[0][datum.key][view.activeField + '_value'].max,
                    parseTime = d3.timeParse('%Y'),
                    x = d3.scaleTime().range([0, width]).domain([parseTime(minX),parseTime(maxX)]),
                    y = d3.scaleLinear().range([height, 0]).domain([minY,maxY]);
                    
                    console.log(minX,minY,maxX,maxY);


            /* HEADINGS */
                chartDiv.append('p')
                    .html(d => '<strong>' + d.key + '</strong>');

                /* SVGS */
                var dat = config.seriesGroup; 
                console.log(dat);
                console.log(JSON.parse(dat));
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

                SVGs.each(function(){
                    var SVG = d3.select(this);
                    var data = SVG.data();
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
                        .attr('d', function(d){
                            console.log(d);
                            d.values.unshift({year:2015,[view.activeField + '_value']:0});
                            return valueline(d.values);
                        });

                    /* X AXIS */

                    SVG.append('g')
                          .attr('transform', 'translate(0,' + y(0) + ')')
                          .attr('class', 'axis x-axis')
                          .call(d3.axisBottom(x).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).tickValues([parseTime(2025),parseTime(2035),parseTime(2045)]));

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
                console.log(model.data);
                model.summarizeData();
                view.init();
                console.log(model.summaries);
            });
        }

    };

    controller.init();
}());