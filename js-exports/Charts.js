export const Charts = (function(){    
    /* globals D3Charts */

    var ChartDiv = function(container, parent){ // constructor called from scripts once for each div.d3-chart
                                                // in the DOM. container is the DOM element; parent is the 
                                                // D3ChartGroup to which it belongs
        this.container = container;
        this.parent = parent;
        this.children = [];
        this.seriesCount = 0;
        this.config = Object.create( parent.config, Object.getOwnPropertyDescriptors( container.dataset.convert() ) );
            // line above creates a config object from the HTML dataset for the chartDiv container
            // that inherits from the parents config object. any configs not specified for the chartDiv (an own property)
            // will come from up the inheritance chain
        this.datum = parent.data.find(each => each.key === this.config.category); 
            // parent.data is the entire dataset from the Google Sheet. line above selects from that dataset the object
            // matching the category specified for the current ChartDiv. here is why the data has to be nested first by 
            // the category

            /* remove seriesInstruct bc groupSeries can handle it */


        this.groupedSeriesData = this.groupSeries(); // organizes data acc to instruction re grouping series  
        
        this.dictionary = this.parent.dictionary;
        if ( this.config.heading !== false ){
            this.addHeading(this.config.heading);
        }
        d3.select(this.container).append('div');
        this.createCharts(); // a new Chart for each grouped series
      };

    ChartDiv.prototype = {

        chartTypes: { 
            line:   'LineChart',
            column: 'ColumnChart',
            bar:    'BarChart' // so on . . .
        },
        createCharts(){
            this.groupedSeriesData.forEach((each) => {
                this.children.push(new LineChart(this, each)); // TO DO distinguish chart types here
            });                               // parent, data   
        },
        groupSeries(){ // takes the datum for the chartDiv (the data matching the specified category)
                       // and organizes the series according the seriesGroup instructions from the data attributes 
                       // 'all' puts all series together in one array with consequence of all series being rendered
                       // in the same SVG.  'none' puts each series in its own array; each is rendered in its own SVG;
                       // if an array of arrays is specified in the configuration for the ChartDiv, the grouped series
                       // are rendered together.
            var seriesGroups,
                groupsInstruct = this.config.seriesGroup || 'none';
            if ( Array.isArray( groupsInstruct ) ) {
                seriesGroups = [];
                this.config.seriesGroup.forEach(group => {
                    seriesGroups.push(this.datum.values.filter(series => group.indexOf(series.key) !== -1));
                });
            } else if ( groupsInstruct === 'none' ) {
                seriesGroups = this.datum.values.map(each => [each]);
            } else if ( groupsInstruct === 'all' ) {
                seriesGroups = [this.datum.values.map(each => each)];
            } else {
                console.log(`Invalid data-group-series instruction from html. 
                       Must be valid JSON: "None" or "All" or an array
                       of arrays containing the series to be grouped
                       together. All strings must be double-quoted.`);
            }
            
            return seriesGroups;
        }, // end groupSeries()
        addHeading(input){
            
            var heading = d3.select(this.container)
                .append('p')
                .attr('class','relative')
                .html(() => {
                    var heading = typeof input === 'string' ? input : this.label(this.config.category);
                    return '<strong>' + heading + '</strong>';
                });

             var labelTooltip = d3.tip()
                .attr("class", "d3-tip label-tip")
                .direction('s')
                .offset([4, 0])
                .html(this.description(this.config.category));

            function mouseover(){
                if ( window.openTooltip ) {
                    window.openTooltip.hide();
                }
                labelTooltip.show();
                window.openTooltip = labelTooltip;
            }

            if ( this.description(this.config.category) !== undefined && this.description(this.config.category) !== '' ){
                heading.html(heading.html() + '<svg focusable="false" class="inline heading-info"><a focusable="true" tabindex="0" xlink:href="#"><text x="4" y="12" class="info-mark">?</text></a></svg>');

                heading.select('.heading-info a')
                    .classed('has-tooltip', true)
                    .on('mouseover', function(){
                        this.focus();
                    })
                    .on('focus', () => {  
                        mouseover.call(this);
                    })
                    .on('mouseout', function(){
                        this.blur();
                        //this.setAttribute('disabled','true');
                    })
                    .on('blur', labelTooltip.hide)
                    .on('click', () => {
                        d3.event.preventDefault();
                    })
                    .call(labelTooltip);
            }
        },
        label(key){ // TO DO: combine these into one method that returns object
            
            return this.dictionary.find(each => each.key === key).label;
        },
        description(key){
            console.log(this.dictionary, key);
            return this.dictionary.find(each => each.key === key).description;
        },
        unitsDescription(key){
            return this.dictionary.find(each => each.key === key).units_description;
        },   
        units(key){
            return this.dictionary.find(each => each.key === key).units;  
        },
        tipText(key){
            var str = this.dictionary.find(each => each.key === key).label.replace(/\\n/g,' ');
            return str.charAt(0).toUpperCase() + str.slice(1);
        }

    }; // end LineChart.prototype

    var LineChart = function(parent, data){ // one chart is created for each group of series to be rendered
                                            // together. charts with the same parent are rendered in the same chartDiv
                                            // the data for each chart is already filtered to be only the series intended
                                            // for that chart
        
        this.parent = parent;
        this.config = parent.config;
        this.marginTop = +this.config.marginTop || this.defaultMargins.top;
        this.marginRight = +this.config.marginRight || this.defaultMargins.right;
        this.marginBottom = +this.config.marginBottom || this.defaultMargins.bottom;
        this.marginLeft = +this.config.marginLeft || this.defaultMargins.left;
        this.width = this.config.svgWidth ? +this.config.svgWidth - this.marginRight - this.marginLeft : 320 - this.marginRight - this.marginLeft;
        this.height = this.config.svgHeight ? +this.config.svgHeight - this.marginTop - this.marginBottom : ( this.width + this.marginRight + this.marginLeft ) / 2 - this.marginTop - this.marginBottom;
        this.data = data;
        this.resetColors = this.config.resetColors || false;
        this.container = this.init(parent.container); // TO DO  this is kinda weird
        this.xScaleType = this.config.xScaleType || 'time';
        this.yScaleType = this.config.yScaleType || 'linear';
        this.xTimeType = this.config.xTimeType || '%Y';
        this.scaleBy = this.config.scaleBy || this.config.variableY;
      //  this.isFirstRender = true;
        this.setScales(); // //SHOULD BE IN CHART PROTOTYPE 
        this.setTooltips();
        this.addLines();
        this.addLabels();
        //this.addPoints();
        this.addXAxis();
        this.addYAxis();
        

               
    };

    LineChart.prototype = { // each LineChart is an svg that hold grouped series
        defaultMargins: {
            top:27,
            right:65,
            bottom:25,
            left:35
        },
              
        init(chartDiv){ // //SHOULD BE IN CHART PROTOTYPE this is called once for each seriesGroup of each category. 
            D3Charts.collectAll.push(this); // pushes all charts on the page to one collection
            this.parent.parent.collectAll.push(this);  // pushes all charts from one ChartGroup to the ChartGroup's collection

            var container =  d3.select(chartDiv).select('div')
                .append('svg')
                .attr('focusable', false)
                .attr('width', this.width + this.marginRight + this.marginLeft )
                .attr('height', this.height  + this.marginTop + this.marginBottom );

            this.svg = container.append('g')
                .attr('transform',`translate(${this.marginLeft}, ${this.marginTop})`);

            this.xAxisGroup = this.svg.append('g');

            this.yAxisGroup = this.svg.append('g');

            this.allSeries = this.svg.append('g') // ie the group that will hold all the series groups
                                                  // specified to be rendered in this chart
                .classed('all-series',true);

            if ( this.resetColors ){    // if the div's data-reset-colors attribute is true,
                                        // chart will render series as if from the beginning
                this.parent.seriesCount = 0; 
            }
            // TO DO : THIS HSOULD BE IN CHART PROTOTYPE
            this.potentialSeries = this.allSeries.selectAll('potential-series') // potential series bc the series
                                                                                // may not have data for the current
                                                                                // y variable
                .data(() => { // append a g for potential series in the Charts data (seriesGroup)
                              // HERE IS WHERE NESTING BY Y VARIABLE WOULD COME INTO PLAY       
                    
                   // return this.data.find(each => each.key === this.config.variableY).values;
                   return this.data;
                }, d => d.key)
                .enter().append('g')
                .attr('class','potential-series');

            this.bindData();

            if ( this.config.stackSeries && this.config.stackSeries === true ){
                this.prepareStacking(); // TO DO. SEPARATE STACKING FROM AREA. STACKING COULD APPLY TO MANY CHART TYPES
            }

            return container.node();
        },
        bindData(){
            // TO DO : THIS HSOULD BE IN CHART PROTOTYPE
            var eachSeries = this.potentialSeries.selectAll('g.each-series')
                .data(d => {
                    var rtn = d.values.find(each => each.key === this.config.variableY);
                    return rtn !== undefined ? [rtn] : []; // need to acct for possibility
                                                           // that the series is absent given the 
                                                           // config.variableY. if find() returns
                                                           // undefined, data should be empty array
                    }, d => {
                        console.log(d.values[0].series); 
                        return d.values[0].series; 
                    });
            
            // update existing
            eachSeries
                .classed('enter', false)
                .classed('update', true);

            // clear exiting
            eachSeries.exit()
                .transition().duration(500)
                .style('opacity', 0)
                .remove();

            var entering = eachSeries.enter().append('g')
                .attr('class', d => {
                    return d.values[0].series + ' each-series series-' + this.parent.seriesCount + ' color-' + this.parent.seriesCount++ % 4;
                })
                .classed('enter', true);
                
            this.eachSeries = entering.merge(eachSeries);
        },
        update(variableY = this.config.variableY){
            this.config.variableY = variableY;
            this.setScales();
            this.bindData();
            this.addLines();
            this.adjustYAxis();
            //this.addPoints();
            this.adjustLabels();

        },
        prepareStacking(){ // TO DO. SEPARATE STACKING FROM AREA. STACKING COULD APPLY TO MANY CHART TYPES
            var forStacking = this.data.reduce((acc,cur,i) => {
                    
                    if ( i === 0 ){
                        cur.values.forEach(each => {
                            acc.push({
                                [this.config.variableX]: each[this.config.variableX],
                                [cur.key]: each[this.config.variableY]
                            });
                        });
                    } else {
                        cur.values.forEach(each => {
                            acc.find(obj => obj[this.config.variableX] === each[this.config.variableX])[cur.key] = each[this.config.variableY];
                        });
                    }
                    return acc;
                },[]);

                
                this.stack = d3.stack()
                    .keys(this.data.map(each => each.key))
                    .order(d3.stackOrderNone)
                    .offset(d3.stackOffsetNone);
                
                
                this.stackData = this.stack(forStacking);
        },
        setScales(){ //SHOULD BE IN CHART PROTOTYPE // TO DO: SET SCALES FOR OTHER GROUP TYPES
            


            var d3Scale = {
                time: d3.scaleTime(),
                linear: d3.scaleLinear()
                // TO DO: add all scale types.
            };
            var xMaxes = [], xMins = [], yMaxes = [], yMins = [], yVariables;
            console.log(this.scaleBy,this.scaleBy !== undefined,this.scaleBy !== 'all',Array.isArray(this.scaleBy) !== true );
            if ( this.scaleBy !== undefined && this.scaleBy !== 'all' && Array.isArray(this.scaleBy) !== true && typeof this.scaleBy !== 'string' ) {
                console.log('Invalid data-scale-by configuration. Must be string or array of y variable(s).');
                this.scaleBy = undefined;
            }
            if ( this.scaleBy === 'all') {
                yVariables = this.parent.parent.properties;
            } else {
                yVariables = Array.isArray(this.scaleBy) ? this.scaleBy : Array.isArray(this.config.variableY) ? this.config.variableY : [this.config.variableY];
            }

            console.log(yVariables, this.parent.parent.properties);

            this.data.forEach(each => {
                xMaxes.push(this.parent.parent.summaries[1][this.config.category][each.key].x.max);
                xMins.push(this.parent.parent.summaries[1][this.config.category][each.key].x.min);
                yVariables.forEach(yVar => {
                    if ( this.parent.parent.summaries[0][this.config.category][each.key][yVar] !== undefined ){  // need to acct for poss
                                                                                                                 // that the yVar does not exist in 
                                                                                                                 // the specified series
                        yMaxes.push(this.parent.parent.summaries[0][this.config.category][each.key][yVar].y.max);
                        yMins.push(this.parent.parent.summaries[0][this.config.category][each.key][yVar].y.min);
                    }
                });
            });

            this.xMax = d3.max(xMaxes);
            this.xMin = d3.max(xMins);
            this.yMax = d3.max(yMaxes);
            this.yMin = d3.min(yMins);
            this.xValuesUnique = [];

            if ( this.config.stackSeries && this.config.stackSeries === true ){
                
                var yValues = this.stackData.reduce((acc, cur) => {
                    
                    acc.push(...cur.reduce((acc1, cur1) => {
                        acc1.push(cur1[0], cur1[1]);
                        return acc1;
                    },[]));
                    return acc;
                },[]);
                this.yMax = d3.max(yValues);
                this.yMin = d3.min(yValues);
            }
            var xRange = [0, this.width],
                yRange = [this.height, 0],
                xDomain,
                yDomain;
            if ( this.xScaleType === 'time') {
                xDomain = [d3.timeParse(this.xTimeType)(this.xMin), d3.timeParse(this.xTimeType)(this.xMax)];
            } else { // TO DO: OTHER data types ?
                xDomain = [this.xMin, this.xMax];
            }
            if ( this.yScaleType === 'time') {
                yDomain = [d3.timeParse(this.yTimeType)(this.yMin), d3.timeParse(this.yTimeType)(this.yMax)];
            } else { // TO DO: OTHER data types ?
                yDomain = [this.yMin, this.yMax];
            }

            this.xScale = d3Scale[this.xScaleType].domain(xDomain).range(xRange);
            this.yScale = d3Scale[this.yScaleType].domain(yDomain).range(yRange);


        },
        addLines(){
            var zeroValueline = d3.line()
                .x(d => {
                    if ( this.xValuesUnique.indexOf(d[this.config.variableX]) === -1 ){
                        this.xValuesUnique.push(d[this.config.variableX]);
                    }
                    return this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX]));
                }) 
                .y(() => this.yScale(0));
            var lines = this.eachSeries.selectAll('path')
                .data(d => [d]);
                

            
            this.lines = lines.enter().append('path')
                .attr('class','line')
                .attr('d', (d) => {
                    return zeroValueline(d.values);
                })
                .merge(lines);

            this.updateLines();
          /*  var valueline = d3.line()
                .x(d => {
                    if ( this.xValuesUnique.indexOf(d[this.config.variableX]) === -1 ){
                        this.xValuesUnique.push(d[this.config.variableX]);
                    }
                    return this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX]));
                }) 
                .y((d) => {
                    
                    return this.yScale(d.value);
                });*/
          // TO DO : ADD BACK IN STACKED SERIES  
           /* if ( this.config.stackSeries && this.config.stackSeries === true ){
                
                var area = d3.area()
                    .x(d => this.xScale(d3.timeParse(this.xTimeType)(d.data[this.config.variableX])))
                    .y0(d => this.yScale(d[0]))
                    .y1(d => this.yScale(d[1]));

                var line = d3.line()
                    .x(d => this.xScale(d3.timeParse(this.xTimeType)(d.data[this.config.variableX])))
                    .y(d => this.yScale(d[1]));

                var stackGroup = this.svg.append('g')
                    .attr('class', 'stacked-area');
                    

                stackGroup    
                    .selectAll('stacked-area')
                    .data(this.stackData)
                    .enter().append('path') // TO DO: add zero-line equivalent and logic for transition on update
                    .attr('class', (d,i) => 'area-line color-' + i) // TO DO not quite right that color shold be `i`
                                                                         // if you have more than one group of series, will repeat
                    .attr('d', d => area(d));

                stackGroup
                    .selectAll('stacked-line') // TO DO: add zero-line equivalent and logic for transition on update
                    .data(this.stackData)
                    .enter().append('path')
                    .attr('class', (d,i) => 'line color-' + i) 
                    .attr('d', d => line(d));

                
            } else { 
                if ( this.isFirstRender ){ */
                   
                       /* .transition().duration(500).delay(150)
                        .attr('d', (d) => {
                            return valueline(d.values);
                        });
                        /*.on('end', (d,i,array) => {
                            
                            if ( i === array.length - 1 ){
                                
                                this.addPoints();
                                this.addLabels();
                            }
                        });*/   
               /* } else {
                    d3.selectAll(this.lines.nodes())
                        .each((d,i,array) => {
                            if ( isNaN(d.values[0][this.config.variableY]) ){ // this a workaround for handling NAs
                                                                              // would be nicer to handle via exit()
                                                                              // but may be hard bc of how data is
                                                                              // structured
                                 d3.select(array[i])
                                    .transition().duration(500)
                                    .style('opacity',0)
                                    .on('end', function(){
                                        d3.select(this)
                                            .classed('display-none', true);
                                    });
                            } else {
                            d3.select(array[i])
                                .classed('display-none', false)
                                .transition().duration(500)
                                .style('opacity',1)
                                .attr('d', (d) => {
                                    return valueline(d.values);
                                });
                            }
                        });

                    d3.selectAll(this.points.nodes())
                        .each((d,i,array) => {
                            if ( isNaN(d[this.config.variableY]) ){ // this a workaround for handling NAs
                                                                              // would be nicer to handle via exit()
                                                                              // but may be hard bc of how data is
                                                                              // structured
                                 d3.select(array[i])
                                    .transition().duration(500)
                                    .style('opacity',0)
                                    .on('end', function(){
                                        d3.select(this)
                                            .classed('display-none', true);
                                    });
                            } else {
                                d3.select(array[i])
                                    .classed('display-none', false)
                                    .transition().duration(500)
                                    .style('opacity',1)
                                    .attr('cx', d => this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX])))
                                    .attr('cy', d => {
                                        return this.yScale(d[this.config.variableY]);
                                    });
                            }
                        });


                    d3.selectAll(this.labelGroups.nodes())
                        .each((d,i,array) => {
                            var labelGroup = d3.select(array[i]);
                            if ( isNaN(d.values[d.values.length - 1][this.config.variableY]) ){
                                
                                 labelGroup
                                    .transition().duration(500)
                                    .style('opacity',0)
                                    .on('end', function(){
                                        labelGroup
                                            .classed('display-none', true);
                                        labelGroup.select('.has-tooltip')
                                            .attr('tabindex', -1);
                                    });
                            } else {
                                
                                labelGroup
                                    .classed('display-none', false)
                                    .transition().duration(500)
                                    .style('opacity',1)
                                    .attr('transform', (d) => `translate(${this.width + 8}, ${this.yScale(d.values[d.values.length - 1][this.config.variableY]) + 3})`);

                                labelGroup.select('.has-tooltip')
                                    .attr('tabindex',0);
                            }
                        });
                            
                    
                    

                    d3.selectAll(this.labels.nodes())
                        .transition().duration(500)
                        .attr('y', 0)
                        .on('end', (d,i,array) => {
                            if (i === array.length - 1 ){
                                this.relaxLabels();
                            }
                        });
                   
                    d3.selectAll(this.yAxisGroup.nodes())
                        .transition().duration(500)
                        .call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5))
                        .on('end',(d,i,array) => {
                            setTimeout(() => {
                                d3.select(array[i])
                                    .selectAll('.tick')
                                    .each((d,i,array) => {
                                        d3.select(array[i])
                                            .classed('zero', ( d === 0 && i !== 0 && this.yMin < 0 ));
                                    });
                            },50);
                        });
                }
            }*/
        },
        updateLines(){
            var valueline = d3.line()
                .x(d => {
                    if ( this.xValuesUnique.indexOf(d[this.config.variableX]) === -1 ){
                        this.xValuesUnique.push(d[this.config.variableX]);
                    }
                    return this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX]));
                }) 
                .y((d) => {
                    
                    return this.yScale(d.value);
                });

            this.lines.transition().duration(500).delay(150)
                .attr('d', (d) => {
                    return valueline(d.values);
                });
        },
        addXAxis(){ // could be in Chart prototype ?
            var xAxisPosition,
                xAxisOffset,
                axisType;

            if ( this.config.xAxisPosition === 'top' ){
                xAxisPosition = this.yMax;
                xAxisOffset = -this.marginTop;
                axisType = d3.axisTop;
            } else {
                xAxisPosition = this.yMin;
                xAxisOffset = this.marginBottom - 15;
                axisType = d3.axisBottom;
            }
            var axis = axisType(this.xScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1);
            if ( this.xScaleType === 'time' ){
                axis.tickValues(this.xValuesUnique.map(each => d3.timeParse(this.xTimeType)(each))); // TO DO: allow for other xAxis Adjustments
            }
            this.xAxisGroup
                .attr('transform', 'translate(0,' + ( this.yScale(xAxisPosition) + xAxisOffset ) + ')') // not programatic placement of x-axis
                .attr('class', 'axis x-axis')
                .call(axis);
        },
        adjustYAxis(){
            this.yAxisGroup
                .transition().duration(500)
                .call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5))
                .on('end', () => {
                    this.markZero();
                }); 
                // to do make this DRYer (repeated below) and programmatic

            //this.markZero();

        },
        markZero(){ // if zero is not the first tick mark, mark it with bold type
            this.yAxisGroup
                .selectAll('.tick')
                .each((d,i,array) => {
                    d3.select(array[i])
                        .classed('zero', d => {
                            console.log(d,i,this.yMin);
                            return ( d === 0 && i !== 0 && this.yMin < 0 );
                        });
                });
        },
        addYAxis(){
            /* axis */
            this.yAxisGroup
              .attr('class', 'axis y-axis')
              .call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5));

            
            this.markZero();


            /* labels */

            var unitsLabels = this.allSeries.select('.each-series')
                .append('a')
                .attr('xlink:href', '#')
                .attr('tabindex', -1)
                .attr('focusable', false)
                .on('click', () => {
                    d3.event.preventDefault();
                })
                .append('text')
                .attr('class', 'units')
                .attr('transform', () => `translate(-${this.marginLeft -5 },-${this.marginTop - 14})`)
                .html((d,i) => i === 0 ? this.parent.units(d.values[0].series) : null);

            var labelTooltip = d3.tip()
                .attr("class", "d3-tip label-tip")
                .direction('e')
                .offset([-2, 4]);
                

            function mouseover(d){
                if ( window.openTooltip ) {
                    window.openTooltip.hide();
                }
                labelTooltip.html(this.parent.unitsDescription(d.values[0].series));
                labelTooltip.show();
                window.openTooltip = labelTooltip;
            }

            unitsLabels.each((d, i, array) => { // TO DO this is repetitive of addLabels()
                if ( this.parent.unitsDescription(d.values[0].series) !== undefined && d3.select(array[i]).html() !== ''){
                    d3.select(array[i].parentNode)
                        .attr('tabindex',0)
                        .attr('focusable',true)
                        .classed('has-tooltip', true)
                        .on('mouseover', (d,i,array) => {
                            array[i].focus();
                        })
                        .on('focus', d => {
                            mouseover.call(this,d);
                        })
                        .on('mouseout', (d,i,array) => {
                            array[i].blur();
                        })
                        .on('blur', labelTooltip.hide)
                        .call(labelTooltip);   
                        
                    d3.select(array[i])
                        
                        .html(function(){
                            return d3.select(this).html() + '<tspan dy="-0.4em" dx="0.2em" class="info-mark">?</tspan>'; 
                        });
                        
                }
            });


            
        },
        adjustLabels(){
            this.allSeries.selectAll('text.series-label')
                .transition().duration(200)
                .attr('y',0)
                .on('end', (d,i,array) => {
                    if ( i === array.length - 1 ){
                        this.addLabels();
                    }
                });
        },
        addLabels(){

            var labelTooltip = d3.tip()
                .attr("class", "d3-tip label-tip")
                .direction('n')
                .offset([-4, 12]);
                

            function mouseover(d){
                if ( window.openTooltip ) {
                    window.openTooltip.hide();
                }
                labelTooltip.html(this.parent.description(d.values[0].series));
                labelTooltip.show();
                window.openTooltip = labelTooltip;
            }

           /* this.labelGroups = this.eachSeries
                .append('g'); */

            var labels = this.eachSeries.selectAll('a.label-anchor')
                .data(d => {
                    
                    return [d];
                }, d => d.values[0].series + '-label');



            this.allSeries.selectAll('a.label-anchor')
                .transition().duration(500)
                .attr('transform', (d) => {
                    
                    return `translate(${this.width + 8}, ${this.yScale(d.values[d.values.length - 1].value) + 3})`;
                })
                .on('end', (d,i,array) => {
                    if ( i === array.length - 1 ){
                        this.relaxLabels(); // do i need additional time for the entering ones to finish? gate?
                    }
                });

            var newLabels = labels.enter().append('a')
                .style('opacity', 0)
                .attr('transform', (d) => {
                    return `translate(${this.width + 8}, ${this.yScale(d.values[d.values.length - 1].value) + 3})`;
                })
                .attr('class','label-anchor')
                .attr('title','click to bring to front')
                .attr('xlink:href','#')
                .attr('tabindex',-1)
                .attr('focusable',false)
                .on('click', (d,i,array) => {
                    d3.event.preventDefault();
                    this.bringToTop.call(array[i].parentNode); 
                });
            

            newLabels.append('text') 
                .attr('class', 'series-label')
                .html((d) => {
                    
                    return '<tspan x="0">' + this.parent.label(d.values[0].series).replace(/\\n/g,'</tspan><tspan x="0.5em" dy="1.2em">') + '</tspan>';
                })
                .each((d, i, array) => {
                    console.log(d);
                    if ( this.parent.description(d.values[0].series) !== undefined && this.parent.description(d.values[0].series) !== ''){
                        d3.select(array[i].parentNode)
                            .attr('tabindex',0)
                            .attr('focusable',true)
                            .classed('has-tooltip', true)
                            .on('mouseover', (d,i,array) => {
                                array[i].focus();
                            })
                            .on('focus', d => {
                                mouseover.call(this,d);
                            })
                            .on('mouseout', (d,i,array) => {
                                array[i].blur();
                            })
                            .on('blur', labelTooltip.hide)
                            .call(labelTooltip);
                            
                        d3.select(array[i])
                            .html(function(){
                                return d3.select(this).html() + '<tspan dy="-0.4em" dx="0.2em" class="info-mark">?</tspan>'; 
                            });
                    }
                });

            newLabels.transition().duration(500)
                .style('opacity',1);
            
            this.labels = newLabels.merge(labels).selectAll('text.series-label');
            
            
         /*   newLabels.each((d, i, array) => {
                console.log(d);
                if ( this.parent.description(d.values[0].series) !== undefined && this.parent.description(d.values[0].series) !== ''){
                    d3.select(array[i].parentNode)
                        .attr('tabindex',0)
                        .attr('focusable',true)
                        .classed('has-tooltip', true)
                        .on('mouseover', (d,i,array) => {
                            array[i].focus();
                        })
                        .on('focus', d => {
                            mouseover.call(this,d);
                        })
                        .on('mouseout', (d,i,array) => {
                            array[i].blur();
                        })
                        .on('blur', labelTooltip.hide)
                        .call(labelTooltip);
                        
                    d3.select(array[i])
                        .html(function(){
                            return d3.select(this).html() + '<tspan dy="-0.4em" dx="0.2em" class="info-mark">?</tspan>'; 
                        });
                }
            });*/
           // this.isFirstRender = false;
            
            if ( labels.nodes().length === 0 ){ // ie there are no exiting labels (first render or all have
                                                // exited). if there are existing labels, relaxLabels is called
                                                // on 'end' of their transition above.
                this.relaxLabels();
            }
           
           
        },
        relaxLabels(){ // HT http://jsfiddle.net/thudfactor/B2WBU/ adapted technique
            var alpha = 1,
                spacing = 0,
                again = false;

            this.labels.each((d,i,array1) => {

                var a = array1[i],
                    $a = d3.select(a),
                    yA = $a.attr('y'),
                    aRange = d3.range(Math.round(a.getCTM().f) - spacing + parseInt(yA), Math.round(a.getCTM().f) + Math.round(a.getBBox().height) + 1 + spacing + parseInt(yA));

                this.labels.each(function(){
                    var b = this,
                    $b = d3.select(b),
                    yB = $b.attr('y');
                    if ( a === b ) {return;}
                    var bLimits = [Math.round(b.getCTM().f) - spacing + parseInt(yB), Math.round(b.getCTM().f) + b.getBBox().height + spacing + parseInt(yB)];
                    if ( (aRange[0] < bLimits[0] && aRange[aRange.length - 1] < bLimits[0]) || (aRange[0] > bLimits[1] && aRange[aRange.length - 1] > bLimits[1]) ){
                        //console.log('no collision', a, b);
                        return;
                    } // no collison
                    var sign = bLimits[0] - aRange[aRange.length - 1] <= aRange[0] - bLimits[1] ? 1 : -1,
                        adjust = sign * alpha;
                    $b.attr('y', (+yB - adjust) );
                    $a.attr('y', (+yA + adjust) );
                    again = true; 
                });
                if ( i === array1.length - 1 && again === true ) {
                    setTimeout(() => {
                        this.relaxLabels();
                    },20);
                }
            });
        },
        addPoints(){
            // existing
            var points = this.eachSeries.selectAll('circle.data-point')
                .data(d => {
                    //console.log(d);
                    return d.values;
                }, d => {
                    console.log(d.series + '-' + d[this.config.variableX]);
                    return d.series + '-' + d[this.config.variableX];
                });

            // update existing
            points.transition().duration(500).delay(150)
                .attr('cx', d => this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX])))
                .attr('cy', d => this.yScale(d.value));

            points.exit().remove();

            var enter = points.enter();

            enter.append('circle')
                .attr('tabindex',0)
                .attr('focusable', true)
                .attr('opacity', 0)
                .attr('class', 'data-point')
                .attr('r', '4')
                .attr('cx', d => this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX])))
                .attr('cy', d => this.yScale(d.value))
                .on('mouseover', (d,i,array) => {
                    mouseover.call(this,d,i,array);
                })
                .on('focus', (d,i,array) => {
                    mouseover.call(this,d,i,array);
                })
                .on('mouseout', () => {
                    mouseout.call(this);
                })
                .on('blur', () => {
                    mouseout.call(this);
                })
                .on('click', this.bringToTop)
                .on('keyup', (d,i,array) => {
                    
                    if (d3.event.keyCode === 13 ){
                        
                        this.bringToTop.call(array[i]);
                    }
                })
                .call(this.tooltip)
                .transition().duration(500).delay(650)
                .attr('opacity', 1);

            this.points = enter.merge(points);
                

                

            function mouseover(d,i,array){
                    console.log(d);
                    if ( window.openTooltip ) {
                        window.openTooltip.hide();
                    }
                   
                    var klass = d3.select(array[i].parentNode).attr('class').match(/color-\d/)[0]; // get the color class of the parent g
                        this.tooltip.attr('class', this.tooltip.attr('class') + ' ' + klass);
                        var prefix = '';
                        var suffix = '';
                        if ( this.parent.units(d.series) && this.parent.units(d.series)[0] === '$' ){
                            prefix = '$'; // TO DO:  handle other prefixes
                        }
                        var html = '<strong>' + this.parent.tipText(d.series) + '</strong> (' + d.year + ')<br />' + prefix + d3.format(',')(d.value);
                        if ( this.parent.units(d.series) && this.parent.units(d.series) !== ''){
                            suffix = this.parent.units(d.series).replace('$','');
                            html += ' ' + suffix;
                        }
                        // TO DO: HANDLE THE CUMULATVE VALUES 
                      /*  var cum = this.config.variableY.replace('_value','_cum');
                        if ( d[cum] !== '' ){
                            html += '<br />(' + prefix + d3.format(',')(d[cum]) + suffix + ' cumulative)';
                        }*/
                        this.tooltip.html(html);
                        this.tooltip.show();
                    window.openTooltip = this.tooltip;
                
            }
            function mouseout(){
                
                this.tooltip.attr('class', this.tooltip.attr('class').replace(/ color-\d/g, ''));
                this.tooltip.html('');
                this.tooltip.hide();
            }
            

        },
        bringToTop(){
            
            if ( this.parentNode !== this.parentNode.parentNode.lastChild ){
                
                d3.select(this.parentNode).moveToFront();
                this.focus();
            }
        },
        setTooltips(){

            this.tooltip = d3.tip()
                .attr("class", "d3-tip")
                .direction('n')
                .offset([-8, 0]);
                
        }
    };


    return {
        ChartDiv
    };

})();
