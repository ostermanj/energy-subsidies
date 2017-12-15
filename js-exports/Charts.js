export const Charts = (function(){
    
    var LineChart = function(container, index, parent){
        this.container = container;
        this.index = index;
        this.parent = parent;
        console.log(this);
    };
    
    LineChart.prototype = {
        isLineChart: true

    }; // end LineChart.prototype

    return {
        LineChart
    };

})();
