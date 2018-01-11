export const Helpers = (function(){
    /* globals DOMStringMap, d3 */
    String.prototype.cleanString = function() { // lowercase and remove punctuation and replace spaces with hyphens; delete punctuation
        return this.replace(/[ \\\/]/g,'-').replace(/['"”’“‘,\.!\?;\(\)&]/g,'').toLowerCase();
    };

    String.prototype.removeUnderscores = function() { 
        return this.replace(/_/g,' ');
    };

    DOMStringMap.prototype.convert = function() { // will fail lte IE10
        var newObj = {};
        for ( var key in this ){
            if (this.hasOwnProperty(key)){
                try {
                    newObj[key] = JSON.parse(this[key]); // if the value can be interpretted as JSON, it is
                                                         // if it can't it isn't   
                }
                catch(err) {
                    newObj[key] = this[key];   
                }
            }
        }
        return newObj;
    };

    d3.selection.prototype.moveToFront = function(){
        return this.each(function(){
            this.parentNode.appendChild(this);
          });
    };
    d3.selection.prototype.moveToBack = function(){ 
        return this.each(function(){
            var firstChild = this.parentNode.firstChild;
            if ( firstChild ) {
                this.parentNode.insertBefore(this, firstChild);
            }
        });
    };

    if (window.NodeList && !NodeList.prototype.forEach) {
        NodeList.prototype.forEach = function (callback, thisArg) {
            thisArg = thisArg || window;
            for (var i = 0; i < this.length; i++) {
                callback.call(thisArg, this[i], i, this);
            }
        };
    }

    if (!Object.hasOwnProperty('getOwnPropertyDescriptors')) {
      Object.defineProperty(
        Object,
        'getOwnPropertyDescriptors',
        {
          configurable: true,
          writable: true,
          value: function getOwnPropertyDescriptors(object) {
            return Reflect.ownKeys(object).reduce((descriptors, key) => {
              return Object.defineProperty(
                descriptors,
                key,
                {
                  configurable: true,
                  enumerable: true,
                  writable: true,
                  value: Object.getOwnPropertyDescriptor(object, key)
                }
              );
            }, {});
          }
        }
      );
    }
})();
