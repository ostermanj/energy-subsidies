 /* exported D3Charts, Helpers, d3Tip, reflect, arrayFind, SVGInnerHTML, SVGFocus */ // let's jshint know that D3Charts can be "defined but not used" in this file
 /* polyfills needed: Promise, Array.isArray, Array.find, Array.filter, Reflect, Object.ownPropertyDescriptors
 */

/*
initialized by windows.D3Charts.Init() which creates a new D3ChartGroup for each div.d3-group in the DOM.
each div's data attributes supply the configuration needed. individual charts inherit from the group's onfiguration
data but can also specify their own.

groups are collected in groupCollection array 

*/ 
import { reflect, arrayFind, SVGInnerHTML, SVGFocus } from '../js-vendor/polyfills';
import { Helpers } from '../js-exports/Helpers';
import { Charts } from '../js-exports/Charts';
import { d3Tip } from '../js-vendor/d3-tip';

var D3Charts = (function(){ 

"use strict";  
     
    var groupCollection = [];
    var D3ChartGroup = function(container, index){
        this.container = container;
        this.index = index;
        this.config = container.dataset.convert(); // method provided in Helpers
        
        this.dataPromises = this.returnDataPromises();
        this.children = []; 
        this.collectAll = [];
        this.properties = [];
        this.dataPromises.then(() => { // when the data promises resolve, charts are initialized
            this.initializeCharts(container, index);
        });
    };
    //prototype begins here
    D3ChartGroup.prototype = {
        
            returnDataPromises(){ // gets data from Google Sheet, converst rows to key-value pairs, nests the data
                                  // as specified by the config object, and creates array of summarized data at different
                                  // nesting levels                                
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
                            resolve(this.returnKeyValues(values, nestBy, true, nestType, i, this.config.normalizeColumnsStart)); 
                        });
                    });
                    dataPromises.push(promise);
                });
                Promise.all(dataPromises).then(values => {
                    this.data = values[0];
                    console.log(this.data);
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
               var nestByArray = this.nestByArray.map(a => a);
               var variableX = this.config.variableX;

               function reduceVariables(d){
                    return {
                        y: {
                            max:       d3.max(d, d => d.value),
                            min:       d3.min(d, d => d.value),
                            mean:      d3.mean(d, d => d.value),
                            sum:       d3.sum(d, d => d.value),
                            median:    d3.median(d, d => d.value),
                            variance:  d3.variance(d, d => d.value),
                            deviation: d3.deviation(d, d => d.value)
                        },
                        x: {
                            max:       d3.max(d, d => d[variableX]),
                            min:       d3.min(d, d => d[variableX]),
                            mean:      d3.mean(d, d => d[variableX]),
                            sum:       d3.sum(d, d => d[variableX]),
                            median:    d3.median(d, d => d[variableX]),
                            variance:  d3.variance(d, d => d[variableX]),
                            deviation: d3.deviation(d, d => d[variableX])
                        }
                    };
               }

               while ( nestByArray.length > 0) {
                    let summarized = this.nestPrelim(nestByArray)
                        .rollup(reduceVariables)
                        .object(this.unnested);
                    summaries.push(summarized);      
                    nestByArray.pop();
                }
                
                return summaries;
            }, 
            nestPrelim(nestByArray){
                // recursive  nesting function used by summarizeData and returnKeyValues
                return nestByArray.reduce((acc, cur) => {
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
            returnNormalizedValues(values, start){

                

                var newRowsArray = [[...values[0].slice(0,start), 'property','value']];
                values.slice(1).forEach(row => {
                    var repeat = row.slice(0,start);
                    row.slice(start).forEach((value, i) => {
                        var newRow = [...repeat, values[0][i + start], value];
                        if ( value !== "" ){
                            newRowsArray.push(newRow);
                        }
                    });
                });  
                              
                return newRowsArray;
            },       
            returnKeyValues(values, nestBy, coerce = false, nestType = 'series', tabIndex = 0, normalizeColumnsStart = undefined){
            // this fn takes normalized data fetched as an array of rows and uses the values in the first row as keys for values in
            // subsequent rows
            // nestBy = string or array of field(s) to nest by, or a custom function, or an array of strings or functions;
            // coerce = BOOL coerce to num or not; nestType = object or series nest (d3)
                var prelim;
                if ( normalizeColumnsStart !== undefined && tabIndex === 0 )  {
                    values = this.returnNormalizedValues(values, normalizeColumnsStart);
                } 
                var unnested = values.slice(1).map(row => row.reduce((acc, cur, i) => { 
                if ( values[0][i] === 'property' && this.properties.indexOf(cur) === -1 ){
                    this.properties.push(cur); // use this array in the setScales fn of chart.js
                }
                // 1. params: total, currentValue, currentIndex[, arr]
                // 3. // acc is an object , key is corresponding value from row 0, value is current value of array
            
                    acc[values[0][i]] = coerce === true ? isNaN(+cur) || cur === '' ? cur : +cur : cur; 
                    return acc;
            
                                                      // test for empty strings before coercing bc +'' => 0
                }, {}));
                
                if ( tabIndex === 0 ) {
                    this.unnested = unnested;
                }           
                if ( !nestBy ){
                    return unnested;
                } else {
                    if ( typeof nestBy === 'string' || typeof nestBy === 'function' ) { // ie only one nestBy field or funciton
                        this.nestByArray = [nestBy];
                    } else {
                        if (!Array.isArray(nestBy)) { throw 'nestBy variable must be a string, function, or array of strings or functions'; }
                        this.nestByArray = nestBy;
                    }
                    prelim = this.nestPrelim(this.nestByArray);
                }
                if ( nestType === 'object' ){
                    return prelim
                        .object(unnested);
                } else {
                    return prelim
                        .entries(unnested);
                }
            },
            initializeCharts(container, index){
                
                var group = this;
                d3.selectAll('.d3-chart.group-' + index) // select all `div.d3-chart`s that are associated
                                                         // with the group by classname "group-" + index 
                    .each(function(){
                        group.children.push(new Charts.ChartDiv(this, group)); // constructor provided in Charts
                    });
            }        
    }; // D3ChartGroup prototype ends here
    
    /* PUBLIC API */
    window.D3Charts = { // need to specify window bc after transpiling all this will be wrapped in IIFEs
                        // and `return`ing won't get the export into window's global scope
        Init(){
            var groupDivs = document.querySelectorAll('.d3-group');
            for ( let i = 0; i < groupDivs.length; i++ ){
                groupCollection.push(new D3ChartGroup(groupDivs[i], i));
            }                                          // container, index 
            
            
        },
        collectAll:[],
        UpdateAll(variableY){
            
            this.collectAll.forEach(each => {
                each.update(variableY);
            });
        },
        UpdateGroup(index,variableY){
            groupCollection[index].collectAll.forEach(each => {
                each.update(variableY);
            });
        }
    };
}()); // end var D3Charts IIFE