export const Helpers = (function(){
    
    String.prototype.cleanString = function() { // lowercase and remove punctuation and replace spaces with hyphens; delete punctuation
        return this.replace(/[ \\\/]/g,'-').replace(/['"”’“‘,\.!\?;\(\)&]/g,'').toLowerCase();
    };

    String.prototype.removeUnderscores = function() { 
        return this.replace(/_/g,' ');
    };

})();
