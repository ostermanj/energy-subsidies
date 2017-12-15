export const Helpers = (function(){
    /* globals DOMStringMap */
    String.prototype.cleanString = function() { // lowercase and remove punctuation and replace spaces with hyphens; delete punctuation
        return this.replace(/[ \\\/]/g,'-').replace(/['"”’“‘,\.!\?;\(\)&]/g,'').toLowerCase();
    };

    String.prototype.removeUnderscores = function() { 
        return this.replace(/_/g,' ');
    };

    DOMStringMap.prototype.convert = function() {
        var newObj = {};
        for ( var key in this ){
            if (this.hasOwnProperty(key)){
                try {
                    newObj[key] = JSON.parse(this[key]);
                }
                catch(err) {
                    newObj[key] = this[key];   
                }
            }
        }
        return newObj;
    };
})();
