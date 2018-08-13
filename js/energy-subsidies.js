var form = document.querySelector('#forms');
form.querySelectorAll('input').forEach(function(each){
    each.onchange = function(){
        if ( this.value === 'nuclear' || this.value === 'coal' ){
            document.querySelector('input#twenty-five').setAttribute('disabled', true);
            document.querySelector('input#ten').setAttribute('disabled', true);
        } else if ( this.value === 'both' ){
            document.querySelector('input#twenty-five').removeAttribute('disabled');
            document.querySelector('input#ten').removeAttribute('disabled');
        } else if ( this.value === '25' ){
            document.querySelector('input#nuclear').setAttribute('disabled', true);
            document.querySelector('label[for=nuclear]').className = 'disabled';
            document.querySelector('input#coal').setAttribute('disabled', true);
            document.querySelector('label[for=coal]').className = 'disabled';
        } else if ( this.value === '10' ){
            document.querySelector('input#nuclear').removeAttribute('disabled');
            document.querySelector('label[for=nuclear]').className = '';
            document.querySelector('input#coal').removeAttribute('disabled');
            document.querySelector('label[for=coal]').className = '';
        }
        var forms = document.querySelector('#forms');
        var inputs = forms.querySelectorAll('input');
        var values = [];
        var variableY;
        for (let i = 0; i < inputs.length; i++){
            if ( inputs[i].checked ){
                values.push(inputs[i].value);
            }
        }
        switch (values.join('-')){
            case 'profit-both-25':
                variableY = 'pb25l_value';
                break;
            case 'profit-both-10':
                variableY = 'pb10l_value';
                break;
            case 'profit-coal-10':
                variableY = 'pc10l_value';
                break;
            case 'profit-nuclear-10':
                variableY = 'pn10l_value';
                break;
            case 'cost-both-25':
                variableY = 'cb25l_value';
                break;
            case 'cost-both-10':
                variableY = 'cb10l_value';
                break;
            case 'cost-coal-10':
                variableY = 'cc10l_value';
                break;
            case 'cost-nuclear-10':
                variableY = 'cn10l_value';
                break;
        }
        D3Charts.UpdateGroup(1, variableY);

    }
});