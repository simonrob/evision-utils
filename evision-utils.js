// ==UserScript==
// @name         eVision fixer
// @namespace    https://github.com/simonrob/evision-utils
// @version      0.2
// @description  Make e:Vision a little less difficult to use
// @author       Simon Robinson
// @match        https://evision.swan.ac.uk/*
// @match        https://evision.swansea.ac.uk/*
// @grant        none
// ==/UserScript==
/* global $ */
(function() {
    // the default (in the page source) for the list of students is var datatableOptions = { "pageLength": 5, [...] }; // wtf
    'use strict';
    window.setTimeout(function(){
        // get all tables by: $.fn.dataTable.tables()
        $('#myrs_list').dataTable().api().page.len( -1 ).draw(); // show all rows in the list of students
        $('#myrs_list').dataTable().fnSort([[2,'asc']]); // sort the students alphabetically by name
        $('#DataTables_Table_0').dataTable().api().page.len(-1).draw() // show all rows in the list of meetings
    }, 250);
})();
