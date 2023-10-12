// ==UserScript==
// @name         e:Vision Utilities
// @namespace    https://github.com/simonrob/evision-utils
// @version      2023-10-12
// @updateURL    https://github.com/simonrob/evision-utils/raw/main/evision-utils.user.js
// @downloadURL  https://github.com/simonrob/evision-utils/raw/main/evision-utils.user.js
// @description  Make e:Vision a little less difficult to use
// @author       Simon Robinson
// @match        evision.swan.ac.uk/*
// @match        evision.swansea.ac.uk/*
// @match        evision-swanseauniversity.msappproxy.net/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment.min.js
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.min.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=swansea.ac.uk
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==
/* global $, moment, GM_config */

(function() {
    'use strict';

    GM_addStyle(`
        .emphasise {
            font-weight: bold;
        }
        .deemphasise {
            color: #ccc;
        }
        .deemphasise a {
            color: rgb(0, 119, 196, 0.3);
        }
        .deemphasise span.sv-label {
            background-color: rgb(119, 119, 119, 0.1);
        }
    `);

    const alertScope = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
    alertScope.alert = function(message) {
        console.log('eVision fixer intercepted alert:', message);
    };

    const filteredStudents = []; // an array of student numbers to remove from display (managed via GM_config)
    let profileLinkPrefix = ''; // basic for now, but could be extended if needed
    const gmc = new GM_config({
        'id': 'evision-fixer',
        'title': 'eVision Fixer Settings',
        'css': 'textarea { width: 100%; height: 15em; margin-bottom: 2em; } input { width: 100%; }',
        'fields': {
            'ignoredStudents': {
                'label': 'Ignored student numbers – suggested one per line (comments allowed)',
                'type': 'textarea',
                'default': '123456/1 // example ignored student number'
            },
            'profileLinkPrefix': {
                'label': 'The URL to use when linking to student profiles. Student numbers will be appended to this value',
                'type': 'text',
                'default': 'https://intranet.swan.ac.uk/students/fra_stu_detail.asp?id='
            }
        },
        'events': {
            'init': function() {
                // note: ideally this would link in with the modifications to ensure,
                // load has completed but eVision is so slow that this is not needed
                this.get('ignoredStudents').replace(/(\d+\/\d{1})/g, function (string, match) {
                    filteredStudents.push(match);
                });
                profileLinkPrefix = this.get('profileLinkPrefix');
            }
        }
    });

    addEventListener('DOMContentLoaded', function(){
        console.log('eVision fixer - setting up modifications');

        // add our own settings button
        $('<button id="sv-header-fixer-settings" type="button" class="sv-navbar-options" ' +
          'title="eVision fixer settings" aria-label="eVision fixer settings"><span ' +
          'class="glyphicon glyphicon-cog"></span></button>').insertBefore('#sv-header-profile');
        $('#sv-header-fixer-settings').click(function() { gmc.open(); });

        // see guide at https://datatables.net/blog/2014-12-18
        $.fn.dataTable.moment = function (format, locale, reverseEmpties) {
            // add type detection
            const types = $.fn.dataTable.ext.type;
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
                    (reverseEmpties ? -Infinity : Infinity) : parseInt(moment(d, format, locale, true).format('x'), 10);
            };
        };
        $.fn.dataTable.moment('DD/MM/YYYY');

        // show the hidden "return to home" menu button (and rename it)
        $('li[role="menuitem"]').addClass('sv-active').children('a').text('Home');

        // show the hidden meetings and events panel (note: hidden later for now)
        $(function() {
            $('*').contents().filter(function() {
                return this.nodeType == 8; // get all comments
            }).each(function(i, e){
                if (e.nodeValue.includes('Next Meeting or Event')) {
                    $(e).replaceWith(e.nodeValue.replace('///-','').replace('-///',''));
                }
            });
        });

        // hide the slow and pointless "Meetings and Events" option and the personnel details table
        $('div.sv-tiled-col:contains("Meetings and Events")').hide();
        $('.sv-list-group-item').has('th:contains("Personnel Code")').hide();

        // move the back button to a consistent position
        const backStyle = {position:'absolute', right:0, top:0, marginRight:'105px', marginTop: '8px', width: '70px'};
        $('input[name="NEXT.DUMMY.MENSYS.1"]').filter(function() {
            if (this.value.toLowerCase() === 'back') {
                $(this).parent().css(backStyle);
                $(this).css(backStyle);
            }
        });

        // hide the sidebar by default
        const visibleSidebar = $('#sv-sidebar').not('.sv-collapsed');
        if (visibleSidebar.length >= 1) {
            $('#sv-sidebar-collapse').click();
        }

        window.setTimeout(function(){
            // redirect from the pointless "Home" page with no actual content to the actual homepage
            if ($('h2:contains("Welcome Message")').length > 0) {
                $('a[aria-label="Research Management"]')[0].click();
            }

            // hide the viva dates and "important notifications" panels
            $('div.sv-list-group:contains("Viva Examination Date")').hide();

            // hide loading dialogs - they seem to do nothing
            $('.ui-widget-overlay').hide();
            $('.ui-dialog').hide();

            // hide the broken/empty first export button
            $('.buttons-excel').parent().find('button').first().hide();

            // get all tables by: $.fn.dataTable.tables()
            // the student list default (i.e., page source) is datatableOptions = { "pageLength": 5, [...] }; // wtf
            const studentTable = $('#myrs_list');
            if (studentTable.length > 0){
                console.log('eVision fixer: modifying student table');
                const studentTableAPI = studentTable.dataTable().api();
                studentTableAPI.page.len(-1).draw(); // show all rows in the list of students ("My Research Students")
                $('td[data-ttip="Name"]').each(function() { // trim names
                    const newName = $(this).text().split(' ');
                    $(this).text(newName[0] + ' ' + newName[newName.length - 1]);
                });

                // filter out ignored students; add intranet links
                const removed = studentTableAPI.rows().eq(0).filter(function (rowIdx) {
                    const cellValue = studentTableAPI.cell(rowIdx, 1).data();
                    const studentLink = profileLinkPrefix + encodeURIComponent(cellValue);
                    studentTableAPI.cell(rowIdx, 1).data('<a href="' + studentLink + '" target="_blank">' +
                                                         cellValue + '</a>');

                    const valueFiltered = filteredStudents.includes(cellValue);
                    if (valueFiltered) {
                        console.log('eVision fixer: filtering student ' + cellValue + ': '
                                    + studentTableAPI.cell(rowIdx, 2).data());
                    }
                    return valueFiltered;
                });
                studentTableAPI.rows(removed).remove().draw();

                // de-emphasise secondary-supervised students
                const deemphasised = studentTableAPI.rows().eq(0).filter(function (rowIdx) {
                    const cellValue = studentTableAPI.cell(rowIdx, 0).data();
                    const valueFiltered = cellValue.toLowerCase().includes('secondary');
                    if (valueFiltered) {
                        console.log('eVision fixer: de-emphasising secondary-supervised student: ' +
                                    studentTableAPI.cell(rowIdx, 2).data());
                    }
                    return valueFiltered;
                });
                studentTableAPI.rows(deemphasised).nodes().to$().addClass('deemphasise');

                // highlight PhD students
                const isPhD = studentTableAPI.rows().eq(0).filter(function (rowIdx) {
                    const startCellDate = moment(studentTableAPI.cell(rowIdx, 4).data(), 'DD/MM/YYYY');
                    const endCellDate = moment(studentTableAPI.cell(rowIdx, 5).data(), 'DD/MM/YYYY');
                    const valueFiltered = endCellDate.diff(startCellDate, 'months') >= 24;
                    if (valueFiltered) {
                        const statusCell = studentTableAPI.cell(rowIdx, 3);
                        statusCell.data(statusCell.data() + ' (PhD)');
                        console.log('eVision fixer: emphasising PhD student: ' +
                                    studentTableAPI.cell(rowIdx, 2).data());
                    }
                    return valueFiltered && !studentTableAPI.cell(rowIdx, 0).data().toLowerCase().includes('secondary');
                });
                studentTableAPI.rows(isPhD).nodes().to$().addClass('emphasise');

                // sort the students by status, supervision type, then end date
                // (separately because combined sorting gives a different result)
                $('#myrs_list').dataTable().fnSort([[5,'asc']]);
                $('#myrs_list').dataTable().fnSort([[3,'desc']]);
                $('#myrs_list').dataTable().fnSort([[0,'asc']]);
            }

            const generalMeetingsTable = $('#supTab');
            if (generalMeetingsTable.length > 0) {
                console.log('eVision fixer: modifying generic meetings table');
                generalMeetingsTable.dataTable().api().page.len(-1).draw(); // show all rows in "Meetings and Events"
                generalMeetingsTable.dataTable().fnSort([[0,'asc'],[3,'asc']]); // sort by supervision type then date

                setTimeout(function() {
                    $('a.sv-btn').each(function() {
                        // open tasks in new window so the "letters" page doesn't need reloading all the time
                        // TODO: be aware that eVision is only capable of editing one form at once...
                        $(this).attr('target', '_blank');
                    });
                }, 250); // the target (default: _top) is added after initial page load, so change after a brief timeout
            }

            const meetingsTable = $('#DataTables_Table_0');
            if (meetingsTable.length > 0) {
                console.log('eVision fixer: modifying individual meetings table');
                const meetingsTableAPI = meetingsTable.dataTable().api();
                meetingsTableAPI.page.len(-1).draw(); // show all meeting list rows (an individual student's details)

                // de-emphasise past meetings
                const deemphasised = meetingsTableAPI.rows().eq(0).filter(function (rowIdx) {
                    const cellValue = meetingsTableAPI.cell(rowIdx, 6).data();
                    const valueFiltered = cellValue.toLowerCase().includes('complete');
                    if (valueFiltered) {
                        console.log('eVision fixer: de-emphasising past meeting: ' +
                                    meetingsTableAPI.cell(rowIdx, 2).data());
                    }
                    return valueFiltered;
                });
                meetingsTableAPI.rows(deemphasised).nodes().to$().addClass('deemphasise');
                const lastFinishedMeeting = $('.deemphasise:last');
                if (lastFinishedMeeting.length >= 0) {
                    lastFinishedMeeting[0].scrollIntoView({
                        behavior: 'smooth',
                        inline: 'center',
                        block: 'center'
                    });
                }

                setTimeout(function() {
                    $('a.sv-btn').each(function() {
                        // open tasks in new window so the "letters" page doesn't need reloading all the time
                        // TODO: be aware that eVision is only capable of editing one form at once...
                        $(this).attr('target', '_blank');
                    });
                }, 250); // the target (default: _top) is added after initial page load, so change after a brief timeout
            }

            // show meeting records by default
            $('div[data-altid="rdeDetails_1"]').show();
            $('div[data-altid="rdeDetails_2"]').show();

            // expand the form to the full page width
            $('div.sv-col-sm-4').removeClass('sv-col-sm-4').addClass('sv-col-sm-9');
        }, 250);
    });
})();
