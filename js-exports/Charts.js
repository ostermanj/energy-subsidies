export const Charts = (function(){

    var ChartDiv = function(container, parent){
        this.container = container;
        this.parent = parent;
        this.children = [];
        this.seriesCount = 0;
        this.config = Object.create( parent.config, Object.getOwnPropertyDescriptors( container.dataset.convert() ) );
            // line above creates a config object from the HTML dataset for the chartDiv container
            // that inherits from the parents config object. any configs not specified for the chartDiv (an own property)
            // will come from up the inheritance chain
        this.datum = parent.data.find(each => each.key === this.config.category);
        var seriesInstruct = this.config.series || 'all';
        
        if ( Array.isArray(seriesInstruct) ){
            
            this.datum.values = this.datum.values.filter(each => {
                
                return seriesInstruct.indexOf(each.key) !== -1;
            });
        } else if ( seriesInstruct !== 'all' ){
            console.log(`Invalid instruction from HTML for which categories to include 
                    (var seriesInstruct). Fallback to all.`);
        }
        this.seriesGroups = this.groupSeries();
        this.dictionary = this.parent.dictionary;
        if ( this.config.heading !== false ){
            this.addHeading(this.config.heading);
        }
        this.createCharts();

    };
    
    ChartDiv.prototype = {
        chartTypes: {
            line:   'LineChart',
            column: 'ColumnChart',
            bar:    'BarChart' // so on . . .
        },
        createCharts(){
            this.seriesGroups.forEach((each) => {
                this.children.push(new LineChart(this, each)); // TO DO distinguish chart types here
            });
        },
        groupSeries(){
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
            
            d3.select(this.container)
                .append('p')
                .html(() => {
                    var heading = typeof input === 'string' ? input : this.label(this.config.category);
                    return '<strong>' + heading + '</strong>';
                });
        },
        label(key){
            return this.dictionary.find(each => each.key === key).label;
        },
        units(key){
            return this.dictionary.find(each => each.key === key).units;  
        },
        tipText(key){
            var str = this.dictionary.find(each => each.key === key).label.replace(/\\n/g,' ');
            return str.charAt(0).toUpperCase() + str.slice(1);
        }

    }; // end LineChart.prototype

    var LineChart = function(parent, seriesGroup){
        this.parent = parent;
        this.config = parent.config;
        this.marginTop = +this.config.marginTop || this.defaultMargins.top;
        this.marginRight = +this.config.marginRight || this.defaultMargins.right;
        this.marginBottom = +this.config.marginBottom || this.defaultMargins.bottom;
        this.marginLeft = +this.config.marginLeft || this.defaultMargins.left;
        this.width = this.config.svgWidth ? +this.config.svgWidth - this.marginRight - this.marginLeft : 320 - this.marginRight - this.marginLeft;
        this.height = this.config.svgHeight ? +this.config.svgHeight - this.marginTop - this.marginBottom : ( this.width + this.marginRight + this.marginLeft ) / 2 - this.marginTop - this.marginBottom;
        this.data = seriesGroup;
        
        this.container = this.init(parent.container); // TO DO  this is kinda weird
        this.xScaleType = this.config.xScaleType || 'time';
        this.yScaleType = this.config.yScaleType || 'linear';
        this.xTimeType = this.config.xTimeType || '%Y';
        this.scaleBy = this.config.scaleBy || 'series-group';
        this.setScales(); // //SHOULD BE IN CHART PROTOTYPE 
        this.setTooltips();
        this.addLines();
      //  this.addPoints();
        this.addXAxis();
        this.addYAxis();
        if ( this.config.directLabel === true ){
        //    this.addLabels();
        } else {
            // this.addLegends();
        }
               
    };

    LineChart.prototype = { // each LineChart is an svg that hold grouped series
        defaultMargins: {
            top:20,
            right:45,
            bottom:25,
            left:35
        },
              
        init(chartDiv){ // //SHOULD BE IN CHART PROTOTYPE this is called once for each seriesGroup of each category. 
            var container =  d3.select(chartDiv)
                .append('svg')
                .attr('width', this.width + this.marginRight + this.marginLeft )
                .attr('height', this.height  + this.marginTop + this.marginBottom );

            this.svg = container.append('g')
                .attr('transform',`translate(${this.marginLeft}, ${this.marginTop})`);

            this.xAxisGroup = this.svg.append('g');

            this.yAxisGroup = this.svg.append('g');

            this.eachSeries = this.svg.selectAll('each-series')
                .data(this.data)
                .enter().append('g')
                .attr('class', () => {
                    return 'each-series series-' + this.parent.seriesCount + ' color-' + this.parent.seriesCount++ % 3;
                });
/*
            this.eachSeries.each((d,i,array) => {
                this.parent.seriesArray.push(array[i]);
            });*/
            if ( this.config.stackSeries && this.config.stackSeries === true ){
                this.prepareStacking();
            }

            return container.node();
        },
        prepareStacking(){
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
            var xMaxes = [], xMins = [], yMaxes = [], yMins = [];
            if ( this.scaleBy === 'series-group' ){
                this.data.forEach(each => {
                    
                    xMaxes.push(this.parent.parent.summaries[1][this.config.category][each.key][this.config.variableX].max);
                    xMins.push(this.parent.parent.summaries[1][this.config.category][each.key][this.config.variableX].min);
                    yMaxes.push(this.parent.parent.summaries[1][this.config.category][each.key][this.config.variableY].max);
                    yMins.push(this.parent.parent.summaries[1][this.config.category][each.key][this.config.variableY].min);
                });
            }
            this.xMax = d3.max(xMaxes);
            this.xMin = d3.min(xMins);
            this.yMax = d3.max(yMaxes);
            this.yMin = d3.min(yMins);
            this.xValuesUnique = [];

            if ( this.config.stackSeries && this.config.stackSeries === true ){
                console.log(this.stackData);
                var yValues = this.stackData.reduce((acc, cur) => {
                    console.log(cur);
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

            var valueline = d3.line()
                .x(d => {
                    if ( this.xValuesUnique.indexOf(d[this.config.variableX]) === -1 ){
                        this.xValuesUnique.push(d[this.config.variableX]);
                    }
                    return this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX]));
                }) 
                .y((d) => {
                    
                    return this.yScale(d[this.config.variableY]);
                });
            
            if ( this.config.stackSeries && this.config.stackSeries === true ){
                
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
                    .enter().append('path')
                    .attr('class', (d,i) => 'area-line color-' + i) // TO DO not quite right that color shold be `i`
                                                                         // if you have more than one group of series, will repeat
                    .attr('d', d => area(d));

                stackGroup
                    .selectAll('stacked-line')
                    .data(this.stackData)
                    .enter().append('path')
                    .attr('class', (d,i) => 'line color-' + i) 
                    .attr('d', d => line(d));

                
            } else {
                this.lines = this.eachSeries.append('path')
                    .attr('class','line')
                    .attr('d', (d) => {
                        return zeroValueline(d.values);
                    })
                    .transition().duration(500).delay(150)
                    .attr('d', (d) => {
                        return valueline(d.values);
                    })
                    .on('end', (d,i,array) => {
                        if ( i === array.length - 1 ){
                            
                            this.addPoints();
                            this.addLabels();
                        }
                    });
            }
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
        addYAxis(){
            /* axis */
            this.yAxisGroup
              .attr('class', () => 'axis y-axis ')
              .call(d3.axisLeft(this.yScale).tickSizeInner(4).tickSizeOuter(0).tickPadding(1).ticks(5));

            if ( this.yMin < 0 ) {
                this.yAxisGroup
                    .selectAll('.tick')
                    .each(function(d,i,array) {
                        console.log(d,i,array);
                        d3.select(this)
                            .classed('zero', d === 0 && i !== 0);
                    });
            }


            /* labels */
            this.eachSeries.append('text')
              .attr('class', 'units')
              .attr('transform', () => `translate(-${this.marginLeft},-${this.marginTop - 10})`)
              .text((d,i) => i === 0 ? this.parent.units(d.key) : null);
            
        },
        addLabels(){
            this.eachSeries.append('text')
                .attr('class', 'series-label')
                .html((d) => '<tspan x="0">' + this.parent.label(d.key).replace(/\\n/g,'</tspan><tspan x="0" dy="1.2em">') + '</tspan>')
                .attr('transform', (d) => `translate(${this.width + 5}, ${this.yScale(d.values[d.values.length - 1][this.config.variableY]) + 3})`);
        },
        addPoints(){
            
            this.points = this.eachSeries.selectAll('points')
                .data(d => d.values)
                .enter().append('circle')
                .attr('opacity', 0)
                .attr('class', 'data-point')
                .attr('r', '4')
                .attr('cx', d => this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX])))
                .attr('cy', d => this.yScale(d[this.config.variableY]))
                .on('mouseover', (d,i,array) => {
                    
                    var klass = array[i].parentNode.classList.value.match(/color-\d/)[0]; // get the color class of the parent g
                    this.tooltip.attr('class', this.tooltip.attr('class') + ' ' + klass);
                    this.tooltip.html('<strong>' + this.parent.tipText(d.series) + '</strong> (' + d.year + ')<br />' + d[this.config.variableY] + ' ' + this.parent.units(d.series) );
                    this.tooltip.show();
                })
                .on('mouseout', () => {
                    this.tooltip.attr('class', this.tooltip.attr('class').replace(/ color-\d/g, ''));
                    this.tooltip.html('');
                    this.tooltip.hide();
                })
                .call(this.tooltip)
                .transition().duration(500)
                .attr('opacity', 1);

            
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
