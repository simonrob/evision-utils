// ==UserScript==
// @name         eVision fixer
// @namespace    https://github.com/simonrob/evision-utils
// @version      0.2
// @description  Make e:Vision a little less difficult to use
// @author       Simon Robinson
// @match        https://evision.swan.ac.uk/*
// @match        https://evision.swansea.ac.uk/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=swansea.ac.uk
// @grant        none
// ==/UserScript==
/* global $ */
(function() {
    'use strict';
    window.setTimeout(function(){
        // get all tables by: $.fn.dataTable.tables()
        // the default (in the page source) for the list of students is var datatableOptions = { "pageLength": 5, [...] }; // wtf
        $('#myrs_list').dataTable().api().page.len(-1).draw(); // show all rows in the list of students ("My Research Students")
        $('#myrs_list').dataTable().fnSort([[2,'asc']]); // sort the students alphabetically by name

        $('#supTab').dataTable().api().page.len(-1).draw(); // show all rows in the list of meetings ("Meetings and Events")
        $('#supTab').dataTable().fnSort([[1,'asc']]); // sort the meetings by student name (date sorting is useless because it is not date-aware)

        $('#DataTables_Table_0').dataTable().api().page.len(-1).draw() // show all rows in the list of meetings (individual student details)
    }, 250);
})();
