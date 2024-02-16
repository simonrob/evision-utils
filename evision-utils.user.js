// ==UserScript==
// @name         e:Vision Utilities
// @namespace    https://github.com/simonrob/evision-utils
// @version      2024-02-16
// @updateURL    https://github.com/simonrob/evision-utils/raw/main/evision-utils.user.js
// @downloadURL  https://github.com/simonrob/evision-utils/raw/main/evision-utils.user.js
// @description  Make e:Vision a little less difficult to use
// @author       Simon Robinson
// @match        https://evision.swan.ac.uk/*
// @match        https://evision.swansea.ac.uk/*
// @match        https://evision-swanseauniversity.msappproxy.net/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment.min.js
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.min.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=swansea.ac.uk
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==
/* global $, moment, GM_addStyle, GM_config */

(function () {
    'use strict';

    console.log('eVision fixer - setting up modifications');

    // redirect from the pointless "Home" page with no actual content to the actual homepage (this element's click handler doesn't work directly)
    if ($('h2:contains("Welcome Message")').length > 0) {
        window.location = $('a[aria-label="Research Management"]').eq(0).attr('href');
        return;
    }

    // same with the extenuating circumstances start page (this element's click handler doesn't work directly)
    if ($('h2:contains("Faculty Academic Staff")').length > 0) {
        window.location = $('a:contains("View Assessment Outcomes")').eq(0).attr('href');
        return;
    }

    // don't show a page about being logged out; just redirect to login
    const logoutMessage = $('.sv-message-box:contains("logged out of the system")');
    if (logoutMessage.length > 0) {
        window.location.href = logoutMessage.find('a').eq(0).attr('href');
        return;
    }

    // don't allow javascript alert popups - push to the console
    const alertScope = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
    alertScope.alert = function (message) {
        console.log('eVision fixer intercepted alert:', message);
    };

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
        img[src$="working.gif"] {
            /* hide the loading image that moves fields just when you're about to click them */
            display: none !important;
        }
        .sv-btn {
            /* make buttons normal case */
            text-transform: inherit !important;
        }
        .sticky {
            position: fixed;
            top: 65px;
            background: #fff;
            z-index: 1;
        }
    `);

    const filteredStudents = []; // an array of student numbers to remove from display (managed via GM_config)
    let profileLinkPrefix = ''; // basic for now, but could be extended if needed
    let defaultSupervisionComment = '';
    const gmc = new GM_config({
        'id': 'evision-fixer',
        'title': 'eVision Fixer Settings',
        'css': 'textarea { width: 100%; height: 15em; margin-bottom: 2em; } input { width: 100%; }',
        'fields': {
            'ignoredStudents': {
                'label': 'Ignored student numbers – suggested one per line (comments allowed)',
                'type': 'textarea',
                'default': '123456 // example ignored student number'
            },
            'profileLinkPrefix': {
                'label': 'The URL to use when linking to student profiles. Student numbers will be appended to this value',
                'type': 'text',
                'default': 'https://intranet.swan.ac.uk/students/fra_stu_detail.asp?id='
            },
            'defaultSupervisionComment': {
                'label': 'Text to insert at the start of the additional meeting box for monthly engagement checks',
                'type': 'text',
                'default': ''
            }
        },
        'events': {
            'init': function () {
                // note: ideally this would link in with the modifications to ensure,
                // load has completed but eVision is so slow that this is not needed
                this.get('ignoredStudents').replace(/(\d+)/g, function (string, match) {
                    filteredStudents.push(match);
                });
                profileLinkPrefix = this.get('profileLinkPrefix');
                defaultSupervisionComment = this.get('defaultSupervisionComment');
            },
            'open': function (document, window, frame) {
                let changed = false;
                const saveWarning = $('<span class="field_label" style="color:red; display:none">' +
                    'Values edited – save or cancel changes?</span>');
                const settingsPopup = $(document);
                settingsPopup.on('keydown', function (e) {
                    if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        gmc.write(null, null, () => void 0);
                        changed = false;
                        return false;
                    } else if (e.key.toLowerCase() === 'escape') {
                        if (!changed) {
                            gmc.close();
                        } else {
                            saveWarning.show().get(0).scrollIntoView();
                        }
                    }
                });

                settingsPopup.find('input, textarea').on('change keyup paste', function (e) {
                    if (e.type === 'keyup') {
                        if (!['escape', 'meta', 'control'].includes(e.key.toLowerCase())) {
                            changed = true;
                        }
                    } else {
                        changed = true;
                    }
                });

                const buttonsHolder = settingsPopup.find('div[id$="_buttons_holder"]');
                buttonsHolder.prepend(saveWarning);
                buttonsHolder.find('button[id$="_closeBtn"]').text('Cancel changes');
                buttonsHolder.find('a[id$="_resetLink"]').on('click', function () {
                    changed = true;
                });

                $(frame).trigger('focus'); // so escape key is captured
            },
            'save': function () {
                gmc.close();
            }
        }
    });

    // add our own settings button
    $('<button id="sv-header-fixer-settings" type="button" class="sv-navbar-options" ' +
        'title="eVision fixer settings" aria-label="eVision fixer settings"><span ' +
        'class="glyphicon glyphicon-cog"></span></button>').insertBefore('#sv-header-profile');
    $('#sv-header-fixer-settings').on('click', function () {
        gmc.open();
    });

    // make dates sortable - see guide at https://datatables.net/blog/2014-12-18
    $.fn.dataTable.moment = function (format, locale, reverseEmpties) {
        // add type detection
        const types = $.fn.dataTable.ext.type;
        types.detect.unshift(function (d) {
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

    // hide the sidebar by default
    const visibleSidebar = $('#sv-sidebar').not('.sv-collapsed');
    if (visibleSidebar.length >= 1) {
        $('#sv-sidebar-collapse').trigger('click');
    }

    // show the hidden "return to home" menu button (and rename it)
    $('li[role="menuitem"]').addClass('sv-active').children('a').text('Home');

    // hide the slow and pointless "Meetings and Events" option and the personnel details table, and the viva dates
    // and "important notifications" panels (they are never important)
    $('div.sv-tiled-col:contains("Meetings and Events")').hide();
    $('.sv-list-group-item').has('th:contains("Personnel Code")').hide();
    $('div.sv-list-group:contains("Important Notifications")').hide();

    // move the back button to a consistent position, and make the top header sticky
    const backStyle = {
        position: 'fixed',
        right: 0,
        top: 0,
        marginRight: '215px',
        marginTop: '14px',
        width: '70px',
        zIndex: 1000
    };
    $('input[name^="NEXT.DUMMY.MENSYS."]').filter(function () {
        if (this.value.toLowerCase() === 'back') {
            $(this).parent().css(backStyle);
            $(this).css(backStyle);
        }
    });
    $('.sv-header-main').css({position: 'fixed', width: '100%', zIndex: 1000});
    $('.sv-page-wrapper > *').css({marginTop: 65}); // 65 = navbar height
    $('.sv-page-wrapper > *:not(.sv-page-content:has(>.sv-page-header))').css({paddingTop: 16});
    $('body > .sv-page-content > *').css({marginTop: 65});

    // add sticky headers for large tables
    const originalHeader = $('table[id^="DataTables_"] thead tr');
    if (originalHeader.length === 1) {
        const stickyHeader = originalHeader.clone().attr('id', 'stickyheader');
        const stickyOffset = originalHeader.offset().top;
        stickyHeader.addClass('sticky').insertAfter(originalHeader).hide();
        $(window).on('scroll', function () {
            if ($(window).scrollTop() + 65 > stickyOffset) {
                stickyHeader.show();
            } else {
                stickyHeader.hide();
            }
        });
    }

    // hide loading dialogs - they seem to do nothing
    $('.ui-widget-overlay').hide();
    $('.ui-dialog').hide();

    // hide the broken/empty first export button
    const exportButtons = $('.buttons-excel').parent().find('button');
    if (exportButtons.length > 1) {
        exportButtons.first().hide();
    }

    // make the extenuating circumstances form a little less painful by replacing select dropdowns with buttons and skipping busywork where possible
    if ($('h1:contains("Select Year and Module .."),h1:contains("Select Assessment ..")').length > 0) {
        const ecSelectors = $('select[name^="ANSWER.TTQ.MENSYS."]');
        ecSelectors.each(function (i) {
            const currentSelector = $(this);
            const selectReplacement = $('<input type="hidden" name="' + currentSelector.attr('name') + '" />');
            const availableOptions = currentSelector.find('option');
            availableOptions.filter(':selected').attr('canvas-utils-selected', true); // work around all elements being selected
            availableOptions.unwrap().each(function () {
                const currentOption = $(this);
                let replacementButtonText = currentOption.text();
                if (replacementButtonText.indexOf('-') > 0) {
                    // tidy up the component descriptions
                    const splitText = replacementButtonText.split(' - ', 3);
                    if (splitText.length === 3) {
                        splitText[0] = 'Component ' + splitText[0];
                        if (splitText[1]) {
                            splitText[1] = ' (Due ' + splitText[1] + '): ';
                        } else {
                            splitText[0] = splitText[0].trim() + ': ';
                        }
                        replacementButtonText = '<span style="font-weight: normal">' + splitText[0] +
                            splitText[1] + '</span>' + splitText[2];
                    }
                }
                const replacementButton = $('<div class="canvas-utils-button sv-btn">' + replacementButtonText + '</div>');
                replacementButton.addClass('sv-btn-default').css({display: 'block'});
                replacementButton.on('click', function () {
                    selectReplacement.val(currentOption.text()); //.closest('form').submit(); // - doesn't work
                    if (i === ecSelectors.length - 1) {
                        $('input[name^="NEXT.DUMMY.MENSYS."]').trigger('click');
                    }
                });
                if (currentOption.attr('canvas-utils-selected')) {
                    if (availableOptions.length === 1) {
                        replacementButton.addClass('sv-btn-primary');
                    }
                    selectReplacement.val(currentOption.text());
                }
                currentOption.replaceWith(replacementButton);
                if (i === ecSelectors.length - 1 && availableOptions.length === 1) {
                    // this is a pointless form with just one option - proceed
                    $('input[name^="NEXT.DUMMY.MENSYS."]').trigger('click');
                }
            });
            selectReplacement.insertAfter($('.canvas-utils-button:last'));
        });
        $('.sv-panel-footer input[value="Next"]').hide(); // make it more obvious that our new elements are the buttons
        return;
    }

    // make the extenuating circumstances decisions page a little cleaner
    if ($('h1:contains("Assessment Outcomes ..")').length > 0) {
        // add the outcome to an earlier column as it is for some reason the first to be hidden if too narrow
        const outcomesTable = $('table');
        const emptyColumns = new Array(outcomesTable.find('thead th').length).fill(true);
        outcomesTable.find('tbody tr').each(function () {
            const currentElement = $(this);
            currentElement.find('td').each(function (index) {
                // hide any empty columns (easier to find via standard jQuery than the table API)
                const currentColumn = $(this);
                if (currentColumn.text() !== '') {
                    emptyColumns[index] = false;
                }
            });
            const statusColumn = currentElement.find('td:nth-child(1)');
            statusColumn.text(statusColumn.text() + ' (' + currentElement.find('td:nth-child(8)').text() + ')').addClass('emphasise');
            const decisionColumn = currentElement.find('td:nth-child(4)');
            decisionColumn.text(decisionColumn.text() + ' – ' + currentElement.find('td:last-child').text()).addClass('emphasise');
        });

        // hide the empty columns
        const outcomesTableAPI = outcomesTable.dataTable().api();
        for (const [i, value] of emptyColumns.entries()) {
            if (value) {
                outcomesTableAPI.columns([i]).visible(false);
            }
        }
    }

    // get all tables by: $.fn.dataTable.tables()
    // the student list default (i.e., page source) is datatableOptions = { "pageLength": 5, [...] }; // wtf
    const studentTable = $('#myrs_list');
    if (studentTable.length > 0) {
        console.log('eVision fixer: modifying student table');
        const studentTableAPI = studentTable.dataTable().api();
        studentTableAPI.page.len(-1).draw(); // show all rows in the list of students ("My Research Students")
        $('td[data-ttip="Name"]').each(function () { // trim names
            const newName = $(this).text().trim().split(' ');
            $(this).text(newName[0] + ' ' + newName[newName.length - 1]);
        });
        $('td[data-ttip="Student Details"]').each(function () { // more obvious link text
            $(this).find('a').text('Profile');
        });
        $('td[data-ttip="Student Forms"]').each(function () { // more obvious link text
            $(this).find('a').text('Edit / Submit Forms');
        });

        // filter out ignored students; add intranet links
        const removed = studentTableAPI.rows().eq(0).filter(function (rowIdx) {
            const cellValue = studentTableAPI.cell(rowIdx, 1).data();
            const studentNumber = cellValue.trim().split('/')[0];
            const studentLink = profileLinkPrefix + encodeURIComponent(cellValue);
            studentTableAPI.cell(rowIdx, 1).data('<a href="' + studentLink + '" target="_blank">' +
                studentNumber + '</a>');

            const valueFiltered = filteredStudents.includes(studentNumber);
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
        studentTable.dataTable().fnSort([[5, 'asc']]);
        studentTable.dataTable().fnSort([[3, 'desc']]);
        studentTable.dataTable().fnSort([[0, 'asc']]);
    }

    const generalMeetingsTable = $('#supTab');
    if (generalMeetingsTable.length > 0) {
        console.log('eVision fixer: modifying generic meetings table');
        generalMeetingsTable.dataTable().api().page.len(-1).draw(); // show all rows in "Meetings and Events"
        generalMeetingsTable.dataTable().fnSort([[0, 'asc'], [3, 'asc']]); // sort by supervision type then date

        setTimeout(function () {
            $('a.sv-btn').each(function () {
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

        meetingsTable.find('td:nth-child(2)').each(function () {
            const newName = $(this).text().trim().split(' ');
            $(this).text(newName[0] + ' ' + newName[newName.length - 1]);
        });

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

        setTimeout(function () {
            $('a.sv-btn').each(function () {
                // open tasks in new window so the "letters" page doesn't need reloading all the time
                // TODO: be aware that eVision is only capable of editing one form at once...
                $(this).attr('target', '_blank');
            });
        }, 250); // the target (default: _top) is added after initial page load, so change after a brief timeout
    }

    // make date selectors a little more usable
    const dateSelector = $('label:contains("Date of engagement?"):not(:has(span))').parent();
    if (dateSelector.length > 0) {
        dateSelector.find('.sv-col-md-4').addClass('sv-col-md-3').removeClass('sv-col-md-4');
        const daySelector = dateSelector.find('select[name^="SPLITDATE_D.TTQ.MENSYS."]');
        const monthSelector = dateSelector.find('select[name^="SPLITDATE_M.TTQ.MENSYS."]');
        const yearSelector = dateSelector.find('select[name^="SPLITDATE_Y.TTQ.MENSYS."]');

        // show the month name as well as its number
        for (let i = 0; i < 12; i++) {
            const date = new Date(2000, i, 1);
            const month = date.toLocaleString('default', {month: 'long'});
            const zeroPadded = ('0' + (i + 1)).slice(-2);
            monthSelector.find('option[value="' + zeroPadded + '"]').text((i + 1) + ' – ' + month);
        }

        // convert day name to day of week (updating on month/year change)
        const setDayName = function () {
            const currentDate = new Date(); // default to today
            currentDate.setMonth(monthSelector.val() ? monthSelector.val() - 1 : currentDate.getMonth());
            currentDate.setYear(yearSelector.val() ? yearSelector.val() : currentDate.getFullYear());
            const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            let i;
            for (i = 1; i <= daysInMonth; i++) {
                const date = new Date(currentDate);
                date.setDate(i);
                const day = date.toLocaleString('default', {weekday: 'long'});
                const zeroPadded = ('0' + i).slice(-2);
                daySelector.find('option[value="' + zeroPadded + '"]').text(i + ' – ' + day);
            }
            for (; i <= 31; i++) { // the selector always shows all days (which is probably a good thing)
                daySelector.find('option[value="' + i + '"]').text(i + ' – N/A');
            }
        };

        // offer to auto-fix invalid dates (snap to nearest date in the valid range)
        const observer = new MutationObserver(function () {
            const dateError = dateSelector.find('span.sv-error-block');
            if (dateError.length > 0 && !dateError.hasClass('evision-utils-edited') && dateError.text().indexOf('Invalid date specified') >= 0) {
                dateError.addClass('evision-utils-edited');
                const dateErrors = dateError.text().split(' and ');
                const firstDate = dateErrors[0].split('between ')[1].split('/');
                const secondDate = dateErrors[1].split('.')[0].split('/');
                const abbreviationToMonth = function (abbr) {
                    return new Date(Date.parse(abbr + ' 1, 2000')).getMonth();
                };
                const boundaryDates = [new Date(firstDate[2], abbreviationToMonth(firstDate[1]), firstDate[0]),
                    new Date(secondDate[2], abbreviationToMonth(secondDate[1]), secondDate[0])];
                const invalidDate = new Date(yearSelector.val(), monthSelector.val() - 1, daySelector.val());
                boundaryDates.sort(function (a, b) {
                    return Math.abs(invalidDate - a) - Math.abs(invalidDate - b);
                });

                dateError.on('click', function () {
                    dateError.removeClass('evision-utils-edited');
                    const validDate = boundaryDates[0];
                    yearSelector.val(validDate.getFullYear());
                    monthSelector.val(('0' + (validDate.getMonth() + 1)).slice(-2));
                    daySelector.val(('0' + validDate.getDate()).slice(-2)).change();
                }).css({cursor: 'pointer'});
                dateError.text(dateError.text() + ' Click here to change to the nearest valid date.');
            }
        });
        observer.observe(dateSelector.find('span.sv-error-block').get(0), {childList: true});
        monthSelector.on('change', setDayName);
        yearSelector.on('change', setDayName);
        setDayName();

        $('<div class="sv-col-md-3"><button id="addDateTodayButton" class="sv-btn" style="margin-top:22px">' +
            'Auto: today, in-person, UK</button></div>').appendTo(dateSelector.find('.sv-row'));
        $('#addDateTodayButton').on('click', function (ev) {
            ev.preventDefault();
            $('.sv-control-label:contains("Type of engagement?")').parent().find('select[name^="ANSWER.TTQ.MENSYS."]').val('1').change(); // face-to-face
            $('.sv-control-label:contains("Where is the student’s current location of study?")').parent().find('input[id^="ANSWER.TTQ.MENSYS."][id$="2"]').prop('checked', true).change(); // off-campus, UK

            let dateToday = new Date();
            dateSelector.find('select[name^="SPLITDATE_Y.TTQ.MENSYS."]').val(dateToday.getUTCFullYear());
            dateSelector.find('select[name^="SPLITDATE_M.TTQ.MENSYS."]').val(('0' + (dateToday.getUTCMonth() + 1)).slice(-2));
            dateSelector.find('select[name^="SPLITDATE_D.TTQ.MENSYS."]').val(('0' + dateToday.getUTCDate()).slice(-2)).change(); // validation

            const meetingText = $('.sv-control-label:contains("Additional information")').parent().find('textarea[id^="ANSWER.TTQ.MENSYS."]');
            if (!meetingText.val()) {
                meetingText.val(defaultSupervisionComment);
            }
        });
    }

    // show meeting records by default
    $('div[data-altid="rdeDetails_1"]').show();
    $('div[data-altid="rdeDetails_2"]').show();

    // be more clear about what "New" actually means
    $('.sv-label-success:contains(" New")').html('<span class="glyphicon glyphicon-arrow-right"></span> Not started');
    $('.sv-label-warning:contains(" Pending")').html('<span class="glyphicon glyphicon-pencil"></span> In progress');

    // expand forms to the full page width
    $('div.sv-col-sm-4').removeClass('sv-col-sm-4').addClass('sv-col-sm-9');
})();
