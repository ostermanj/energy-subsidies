export const Charts = (function(){
    
    var ChartDiv = function(container, parent){
        this.container = container;
        this.parent = parent;
        this.children = [];
        this.config = Object.create( parent.config, Object.getOwnPropertyDescriptors( container.dataset.convert() ) );
            // line above creates a config object from the HTML dataset for the chartDiv container
            // that inherits from the parents config object. any configs not specified for the chartDiv (an own property)
            // will come from up the inheritance chain
        this.datum = parent.data.find(each => each.key === this.config.category);
        this.seriesGroups = this.groupSeries();
        this.dictionary = this.parent.dictionary;
        this.addHeading();
        this.createCharts();

    };
    
    ChartDiv.prototype = {
        chartTypes: {
            line:   'LineChart',
            column: 'ColumnChart',
            bar:    'BarChart' // so on . . .
        },
        createCharts(){
            this.seriesGroups.forEach(() => {
                this.children.push(new LineChart(this));
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
                throw `Invalid data-group-series instruction from html. 
                       Must be valid JSON: "None" or "All" or an array
                       of arrays containing the series to be grouped
                       together. All strings must be double-quoted.`;
            }
            return seriesGroups;
        }, // end groupSeries()
        addHeading(){
            d3.select(this.container)
                .append('p')
                .html('<strong>' + this.label(this.config.category) + '</strong>');
        },
        label(key){
            return this.dictionary.find(each => each.key === key).label;
        }

    }; // end LineChart.prototype

    var LineChart = function(parent){
        this.parent = parent;
        this.config = parent.config;
        this.marginTop = +this.config.marginTop || this.defaultMargins.top;
        this.marginRight = +this.config.marginRight || this.defaultMargins.right;
        this.marginBottom = +this.config.marginBottom || this.defaultMargins.bottom;
        this.marginLeft = +this.config.marginLeft || this.defaultMargins.left;
        this.width = this.config.svgWidth ? +this.config.svgWidth - this.marginRight - this.marginLeft : 320 - this.marginRight - this.marginLeft;
        this.height = this.config.svgHeight ? +this.config.svgHeight - this.marginTop - this.marginBottom : ( this.width + this.marginRight + this.marginLeft ) / 2 - this.marginTop - this.marginBottom;
        console.log(this);
        this.container = this.init(parent.container);

        // TO DO set max,min, etc from summaries; set scales, etc. all that can be Chart prototype.
        
    };

    LineChart.prototype = {
        init(chartDiv){
            var svg =  d3.select(chartDiv)
                .append('svg')
                .attr('width', this.width + this.marginRight + this.marginLeft )
                .attr('height', this.height  + this.marginTop + this.marginBottom );

            svg.append('g')
                .attr('transform',`translate(${this.marginLeft}, ${this.marginRight})`);

            return svg.node();
        },
        defaultMargins: {
            top:20,
            right:45,
            bottom:15,
            left:35
        }        
    };


    return {
        ChartDiv
    };

})();
