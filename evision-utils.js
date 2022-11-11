// ==UserScript==
// @name         eVision fixer
// @namespace    https://github.com/simonrob/evision-utils
// @version      0.3
// @description  Make e:Vision a little less difficult to use
// @author       Simon Robinson
// @match        https://evision.swan.ac.uk/*
// @match        https://evision.swansea.ac.uk/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=swansea.ac.uk
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==
/* global $, moment */
(function() {
    'use strict';

    GM_xmlhttpRequest({
        method : 'GET',
        url : '//cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment.min.js',
        onload : (ev) => {
            let e = document.createElement('script');
            e.innerText = ev.responseText;
            document.head.appendChild(e);
        }
    });

    addEventListener('DOMContentLoaded', function(){
        // see guide at https://datatables.net/blog/2014-12-18
        $.fn.dataTable.moment = function (format, locale, reverseEmpties) {
            var types = $.fn.dataTable.ext.type;
            // add type detection
            types.detect.unshift( function (d) {
                if (d === '' || d === null) {
                    return 'moment-' + format; // null and empty values are acceptable
                }
                return moment(d, format, locale, true).isValid() ?
                    'moment-' + format : null;
            });

            // add sorting method
            types.order['moment-' + format + '-pre'] = function (d) {
               return !moment(d, format, locale, true).isValid() ?
                   (reverseEmpties ? -Infinity : Infinity) :
                   parseInt(moment(d, format, locale, true).format('x'), 10);
            };
        };

        $.fn.dataTable.moment('DD/MM/YYYY');
        $('li[role="menuitem"]').addClass('sv-active').children('a').text('Home'); // show the hidden "return to home" menu button (and rename it)

        window.setTimeout(function(){
            // get all tables by: $.fn.dataTable.tables()

            // the default (in the page source) for the list of students is var datatableOptions = { "pageLength": 5, [...] }; // wtf
            $('#myrs_list').dataTable().api().page.len(-1).draw(); // show all rows in the list of students ("My Research Students")
            $('#myrs_list').dataTable().fnSort([[2,'asc']]); // sort the students alphabetically by name

            $('#supTab').dataTable().api().page.len(-1).draw(); // show all rows in the list of meetings ("Meetings and Events")
            $('#supTab').dataTable().fnSort([[0,'asc'],[3,'asc']]); // sort the meetings by supervision type then by date (scroll down until the green buttons start to find current meetings)

            $('#DataTables_Table_0').dataTable().api().page.len(-1).draw() // show all rows in the list of meetings (individual student details)
        }, 250);
    });
})();
