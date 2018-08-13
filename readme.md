#Energy Subsidies

This is the code behind the graphs for the blog post [Projecting Impacts of DOE’s “Grid Resiliency Pricing” Proposal](http://www.rff.org/blog/2018/projecting-impacts-doe-s-grid-resiliency-pricing-proposal).

The code is meant to be a reusable framework where all options and configurations for a suite of graphs are set in data attributes of `<div>`s in the HTML of the content. Content editors would have no need to edit any JavaScript.  The data comes from Google Sheets documents via the Google Sheet API.

**It is an early work in progress; only line charts are supported.**

## Specifying the data and shared options

```html
<div class="d3-group" data-sheet-id="1_G9HsJbxRBd7fWTF51Xr8lpxGxxImVcc-rTIaQbEeyA" data-nest-by="['category','series']" data-data-tab="Sheet1" data-dictionary-tab="dictionary" data-variable-y="pb25l_value" data-variable-x="year" data-type="line" data-svg-width="320" data-direct-label="true"></div>
```

* classname "d3-group" identifies the div as the data-fetching element
* -sheet-id is the ID of the Google Sheet doc
* -nest-by specifies the field by which the data should be nested (via D3's .nest() method)
* -data-tab specifies the tab of the sheet where the data is
* -dictionary-tab specifies the tab (if any) where definitions of the field name and other terms exist
* -variable-y specifies the initial field that is to be plotted on the y-axis
* -variable-x specifies the initial field that is to be plotted on the x-axis
* -type specifies chart type
* -svg-width specifies the width of the D3 appended SVG
* -direct-label boolean whether to directly labels the lines or not. only TRUE supported at this time

## Specifying a single chart and its options

```html
<div class="d3-chart group-0" data-category="emissions" data-series="all" data-series-group="[['carbon'],['sulfur','nitrogen']]" data-reset-scale="['carbon', 'sulfur']">
```

* classname "d3-chart" identifies the div as a chart-initializing element 
* classname group-X identifies the index of the d3-group to which it belongs
* -category specifies which nested category this chart belongs to
* -series specifies which series in that category should be displayed. Options are all or a JSON array of series
* -series-group specifies how to group the series. Grouped series are plotted together in one pane of the graphed. Ungrouped are plotted separately. Options are all, none, or a JSON array of arrays.
* -reset-scale specifies which if any series to rescale the y-axis for. By default all series will be plotted based on the min and max data across all series. Specifying reset scale will recalculate the scale used for the named series (those that come after it will be on that scale)

## Requirements

* All data must be in one sheet of the workbook
* Data must be normalized, i.e., each column is a field and each row is an observation
* It follows that all rows must have the same fields

## To edit

1. [Install npm](https://www.npmjs.com/get-npm)
1. Clone the repository.
1. Run `npm install` in the directory of your repository to install Grunt and other dev dependencies
1. Start a dev server such as python -m SimpleHTTPServer
1. Run `grunt watch` to convert the SCSS into CSS, lint the HTML and JavaScript files when they are edited, transpile the ES6 index.js file into pre-ES6 compatible code, and minimize the scripts.

**Note that editable dev files are in /dev-css and /dev-js folders, respectively.** Files in /css and /js folders are emitted by the build process and should not be edited directly.

## To deploy

1. Run `grunt postcss` to automatically add any necesary vendor prefixes to the css and emit a build file to the /css folder. Run `grunt cssmin` to minify the .css file to .min.css.
1. The live code exists inline in the body of a page on RFF's site
1. To edit the live page, cut and paste css/styles.min.css, js/index.js and the relevant bits of index.html into the right places in the content body. Existing page content is commented to make this clear.