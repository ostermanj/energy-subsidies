 /* exported D3Charts, Helpers, d3Tip */ // let's jshint know that D3Charts can be "defined but not used" in this file
 /* polyfills needed: Promise, Array.isArray, Array.find, Array.filter

 */
import { Helpers } from '../js-exports/Helpers';
import { Charts } from '../js-exports/Charts';
import { d3Tip } from '../js-vendor/d3-tip';

var D3Charts = (function(){

"use strict"; 
     
    var groupCollection = [];
    var D3ChartGroup = function(container, index){
        
        this.container = container;
        this.index = index;
        this.config = container.dataset.convert();
        
        this.dataPromises = this.returnDataPromises(container);
        this.children = [];
        
        //this.controller.initController(container, this.model, this.view);
        this.dataPromises.then(() => {
            this.initializeCharts(container);
        });
    };
    //prototype begins here
    D3ChartGroup.prototype = {
        
            returnDataPromises(){ 
                var dataPromises = [];
                var sheetID = this.config.sheetId, 
                    tabs = [this.config.dataTab,this.config.dictionaryTab]; // this should come from HTML
                                                    // is there a case for more than one sheet of data?
                tabs.forEach((each, i) => {
                    var promise = new Promise((resolve,reject) => {
                        d3.json('https://sheets.googleapis.com/v4/spreadsheets/' + sheetID + '/values/' + each + '?key=AIzaSyDD3W5wJeJF2esffZMQxNtEl9tt-OfgSq4', (error,data) => { 
                            if (error) {
                                reject(error);
                                throw error;
                            }
                            var values = data.values;
                            var nestType = each === 'dictionary' ? 'object' : 'series'; // nestType for data should come from HTML
                            var nestBy = each === 'dictionary' ? false : this.config.nestBy;
                            resolve(this.returnKeyValues(values, nestBy, true, nestType, i)); 
                        });
                    });
                    dataPromises.push(promise);
                });
                Promise.all(dataPromises).then(values => {
                    this.data = values[0];
                    this.dictionary = values[1];
                    this.summaries = this.summarizeData();
                });
                return Promise.all(dataPromises);
            },
            summarizeData(){ // this fn creates an array of objects summarizing the data in model.data. model.data is nested
                             // and nesting and rolling up cannot be done easily at the same time, so they're done separately.
                             // the summaries provide average, max, min of all fields in the data at all levels of nesting. 
                             // the first (index 0) is one layer nested, the second is two, and so on.
                
                var summaries = [];
                var variables = Object.keys(this.unnested[0]); // all need to have the same fields
                var nestBy = this.config.nestBy ? this.config.nestBy.map(each => each) : false; 
                                                                // uses map to create new array rather than assigning
                                                                // by reference. the `pop()` below would affect original
                                                                // array if done by reference
                var nestByArray = Array.isArray(nestBy) ? nestBy : [nestBy];
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
                while ( nestByArray.length > 0) {
                    let summarized = this.nestPrelim(nestByArray)
                        .rollup(reduceVariables)
                        .object(this.unnested);
                    summaries.unshift(summarized);      
                    nestByArray.pop();
                }
                return summaries;
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
                    this.unnested = unnested;
                }           
                if ( !nestBy ){
                    return unnested;
                } else {
                    if ( typeof nestBy === 'string' || typeof nestBy === 'function' ) { // ie only one nestBy field or funciton
                        prelim = this.nestPrelim([nestBy]);
                    } else {
                        if (!Array.isArray(nestBy)) { throw 'nestBy variable must be a string, function, or array of strings or functions'; }
                        prelim = this.nestPrelim(nestBy);
                    }
                }
                if ( nestType === 'object' ){
                    return prelim
                        .object(unnested);
                } else {
                    return prelim
                        .entries(unnested);
                }
            },
            initializeCharts(container){
                var group = this;
                d3.select(container).selectAll('.d3-chart')
                    .each(function(){
                        group.children.push(new Charts.ChartDiv(this, group));
                    });
            }        
    }; // D3ChartGroup prototype ends here
    
    window.D3Charts = { // need to specify window bc after transpiling all this will be wrapped in IIFEs
                        // and `return`ing won't get the export into window's global scope
        Init(){
            var groupDivs = document.querySelectorAll('.d3-group');
            for ( let i = 0; i < groupDivs.length; i++ ){
                groupCollection.push(new D3ChartGroup(groupDivs[i], i));
            }
            
        },
        CollectAll:[],
        UpdateAll(variableY){
            console.log(this.CollectAll);
            this.CollectAll.forEach(each => {
                each.update(variableY);
            });
        }
    };
}()); // end var D3Charts IIFE