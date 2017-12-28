export const Charts = (function(){    
    /* globals D3Charts */

    var ChartDiv = function(container, parent){
        this.container = container;
        this.parent = parent;
        this.children = [];
        this.seriesCount = 0;
        var configObj = container.dataset.convert();
        console.log(configObj);
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
                heading.html(heading.html() + '<svg class="inline heading-info"><text x="4" y="12" class="info-mark">?</text></svg>');

                heading.select('.info-mark')
                    .attr('tabindex',0)
                    .classed('has-tooltip', true)
                    .on('mouseover', function(){
                        this.focus();
                    })
                    .on('focus', () => {
                        mouseover.call(this);
                    })
                    .on('mouseout', function(){
                        this.blur();
                    })
                    .on('blur', labelTooltip.hide)
                    .call(labelTooltip);

            }


        },
        label(key){ // TO DO: combine these into one method that returns object
            return this.dictionary.find(each => each.key === key).label;
        },
        description(key){
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
        this.isFirstRender = true;
        this.setScales(); // //SHOULD BE IN CHART PROTOTYPE 
        this.setTooltips();
        this.addLines();
      //  this.addPoints();
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
            D3Charts.CollectAll.push(this);
            var container =  d3.select(chartDiv)
                .append('svg')
                .attr('width', this.width + this.marginRight + this.marginLeft )
                .attr('height', this.height  + this.marginTop + this.marginBottom );

            this.svg = container.append('g')
                .attr('transform',`translate(${this.marginLeft}, ${this.marginTop})`);

            this.xAxisGroup = this.svg.append('g');

            this.yAxisGroup = this.svg.append('g');

            this.allSeries = this.svg.append('g');

            this.eachSeries = this.allSeries.selectAll('each-series')
                .data(this.data, d => d.key)
                .enter().append('g')
                .attr('class', () => {
                    return 'each-series series-' + this.parent.seriesCount + ' color-' + this.parent.seriesCount++ % 4;
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
        update(variableY = this.config.variableY){
            this.config.variableY = variableY;
            this.prepareStacking();
            this.setScales();
            this.addLines();

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
                if ( this.isFirstRender ){
                    
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
                } else {
                    
                    d3.selectAll(this.lines.nodes())
                        .transition().duration(500)
                        .attr('d', (d) => {
                            return valueline(d.values);
                        });

                    d3.selectAll(this.points.nodes())
                        .transition().duration(500)
                        .attr('cx', d => this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX])))
                        .attr('cy', d => {
                            return this.yScale(d[this.config.variableY]);
                        });


                    d3.selectAll(this.labelGroups.nodes())
                        .transition().duration(500)
                        .attr('transform', (d) => `translate(${this.width + 8}, ${this.yScale(d.values[d.values.length - 1][this.config.variableY]) + 3})`);

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

            this.yAxisGroup
                .selectAll('.tick')
                .each((d,i,array) => {
                    d3.select(array[i])
                        .classed('zero', ( d === 0 && i !== 0 && this.yMin < 0 ));
                });
            


            /* labels */
            var unitsLabels = this.eachSeries.append('text')
              .attr('class', 'units')
              .attr('transform', () => `translate(-${this.marginLeft -5 },-${this.marginTop - 14})`)
              .html((d,i) => i === 0 ? this.parent.units(d.key) : null);

            var labelTooltip = d3.tip()
                .attr("class", "d3-tip label-tip")
                .direction('e')
                .offset([-2, 4]);
                

            function mouseover(d){
                if ( window.openTooltip ) {
                    window.openTooltip.hide();
                }
                labelTooltip.html(this.parent.unitsDescription(d.key));
                labelTooltip.show();
                window.openTooltip = labelTooltip;
            }

            unitsLabels.each((d, i, array) => { // TO DO this is repetitive of addLabels()
                if ( this.parent.unitsDescription(d.key) !== undefined && d3.select(array[i]).html() !== ''){
                    d3.select(array[i])
                        
                        .html(function(){
                            return d3.select(this).html() + '<tspan dy="-0.4em" dx="0.2em" class="info-mark">?</tspan>'; 
                        })
                        .attr('tabindex',0)
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
                labelTooltip.html(this.parent.description(d.key));
                labelTooltip.show();
                window.openTooltip = labelTooltip;
            }

            this.labelGroups = this.eachSeries
                .append('g');

            this.labels = this.labelGroups
                .attr('transform', (d) => `translate(${this.width + 8}, ${this.yScale(d.values[d.values.length - 1][this.config.variableY]) + 3})`)
                .append('a')
                .attr('xlink:href','#')
                .attr('y', 0)
                .append('text')
                .attr('class', 'series-label')
                .html((d) => {
                    return '<tspan x="0">' + this.parent.label(d.key).replace(/\\n/g,'</tspan><tspan x="0.5em" dy="1.2em">') + '</tspan>';
                });
            
            this.labels.each((d, i, array) => {
                if ( this.parent.description(d.key) !== undefined && this.parent.description(d.key) !== ''){
                    d3.select(array[i])
                        .html(function(){
                            return d3.select(this).html() + '<tspan dy="-0.4em" dx="0.2em" class="info-mark">?</tspan>'; 
                        })
                        .attr('tabindex',0) 
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
                }
            });
            this.isFirstRender = false;
            

            this.relaxLabels();
           
           
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
            
            function mouseover(d,i,array){
               
                    if ( window.openTooltip ) {
                        window.openTooltip.hide();
                    }
                   
                    var klass = array[i].parentNode.classList.value.match(/color-\d/)[0]; // get the color class of the parent g
                        this.tooltip.attr('class', this.tooltip.attr('class') + ' ' + klass);
                        var prefix = '';
                        var suffix = '';
                        if ( this.parent.units(d.series) && this.parent.units(d.series)[0] === '$' ){
                            prefix = '$'; // TO DO:  handle other prefixes
                        }
                        var html = '<strong>' + this.parent.tipText(d.series) + '</strong> (' + d.year + ')<br />' + prefix + d3.format(',')(d[this.config.variableY]);
                        if ( this.parent.units(d.series) && this.parent.units(d.series) !== ''){
                            suffix = this.parent.units(d.series).replace('$','').replace(/s$/,'');
                            html += ' ' + suffix;
                        }
                        var cum = this.config.variableY.replace('_value','_cum');
                        if ( d[cum] !== '' ){
                            html += '<br />(' + prefix + d3.format(',')(d[cum]) + suffix + ' cumulative)';
                        }
                        this.tooltip.html(html);
                        this.tooltip.show();
                    window.openTooltip = this.tooltip;
                
            }
            function mouseout(){
                console.log('mouseout');
                this.tooltip.attr('class', this.tooltip.attr('class').replace(/ color-\d/g, ''));
                this.tooltip.html('');
                this.tooltip.hide();
            }
            this.points = this.eachSeries.selectAll('points')
                .data(d => d.values, d => d.key)
                .enter().append('circle')
                .attr('tabindex',0)
                .attr('opacity', 0)
                .attr('class', 'data-point')
                .attr('r', '4')
                .attr('cx', d => this.xScale(d3.timeParse(this.xTimeType)(d[this.config.variableX])))
                .attr('cy', d => this.yScale(d[this.config.variableY]))
                .on('mouseover', (d,i,array) => {
                    array[i].focus();
                })
                .on('focus', (d,i,array) => {
                    mouseover.call(this,d,i,array);
                })
                .on('mouseout', (d,i,array) => {
                    array[i].blur();
                })
                .on('blur', () => {
                    mouseout.call(this);
                })
                .on('click', this.bringToTop)
                .on('keyup', (d,i,array) => {
                    console.log(d3.event);
                    if (d3.event.keyCode === 13 ){
                        
                        this.bringToTop.call(array[i]);
                    }
                })
                .call(this.tooltip)
                .transition().duration(500)
                .attr('opacity', 1);
            

        },
        bringToTop(){
            console.log(this.parentNode !== this.parentNode.parentNode.lastChild);
            if ( this.parentNode !== this.parentNode.parentNode.lastChild ){
                console.log('click', this);
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
