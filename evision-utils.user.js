// ==UserScript==
// @name         e:Vision Utilities
// @namespace    https://github.com/simonrob/evision-utils
// @version      2025-09-01
// @updateURL    https://github.com/simonrob/evision-utils/raw/main/evision-utils.user.js
// @downloadURL  https://github.com/simonrob/evision-utils/raw/main/evision-utils.user.js
// @require      https://gist.githubusercontent.com/raw/51e2fe655d4d602744ca37fa124869bf/GM_addStyle.js
// @require      https://gist.githubusercontent.com/raw/86cbf1fa9f24f7d821632e9c1ca96571/waitForKeyElements.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment.min.js
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.min.js
// @description  Make e:Vision a little less difficult to use
// @author       Simon Robinson
// @match        https://evision.swan.ac.uk/*
// @match        https://evision.swansea.ac.uk/*
// @match        https://evision-swanseauniversity.msappproxy.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tribalgroup.com
// @run-at       document-idle
// @grant        none
// ==/UserScript==
/* global unsafeWindow, $, GM_addStyle, waitForKeyElements, GM_config, moment */

(function () {
    'use strict';

    console.log('eVision fixer - setting up modifications');

    // redirect from the pointless "Home" page with no actual content to the actual homepage (this element's click handler doesn't work directly)
    const redirectToStudentsPage = '#redirect-to-students-page=true';
    if ($('h2:contains("Welcome Message")').length > 0) {
        const researchManagementUrl = $('a[aria-label="Research Management"]').eq(0);
        window.location = researchManagementUrl.attr('href') + redirectToStudentsPage;
        return;
    }

    if ($('#sitsportalpagetitle:contains("Research Staff")').length > 0) {
        if (window.location.hash === redirectToStudentsPage) {
            window.location = $('a:contains("My Research Students")').eq(0).attr('href');
            return;
        }
    }

    // same with the extenuating circumstances start page (this element's click handler doesn't work directly)
    if ($('h2:contains("Faculty Academic Staff")').length > 0) {
        window.location = $('a:contains("View Assessment Outcomes")').eq(0).attr('href');
        return;
    }

    // don't show a page about being logged out; just redirect to login page
    const logoutMessage = $('.sv-message-box:contains("logged out of the system"),.sv-message-box:contains("log in and try again"),.sv-message-box:contains("request did not complete successfully")');
    if (logoutMessage.length > 0) {
        window.location.href = '/'; // logoutMessage.find('a').eq(0).attr('href'); // sometimes this is an email address
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
        .overdue {
            color: #ccc;
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

        .sv-sidebar-menubar {
            /* make the side menu visible even when scrolled */
            position:fixed;
        }
    `);

    const filteredStudents = []; // an array of student numbers to remove from display (managed via GM_config)
    let profileLinkPrefix = ''; // basic for now, but could be extended if needed
    let defaultSupervisionComment = '';
    let defaultAdhocMeetingName = '';
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
                'label': 'The URL to use when linking to student profiles. Student/occurrence numbers will be appended to this value',
                'type': 'text',
                'default': 'https://intranet.swan.ac.uk/students/fra_stu_detail.asp?id='
            },
            'defaultSupervisionComment': {
                'label': 'Text to insert at the start of the additional meeting box for monthly engagement checks',
                'type': 'text',
                'default': ''
            },
            'defaultAdhocMeetingName': {
                'label': 'Meeting name to auto-fill when scheduling ad-hoc meetings',
                'type': 'text',
                'default': ''
            }
        },
        'events': {
            'init': function () {
                this.get('ignoredStudents').replace(/(\d+)/g, function (string, match) {
                    filteredStudents.push(match);
                });
                profileLinkPrefix = this.get('profileLinkPrefix');
                defaultSupervisionComment = this.get('defaultSupervisionComment');
                defaultAdhocMeetingName = this.get('defaultAdhocMeetingName');
                updateStudentDisplay();
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
    // and https://cdn.datatables.net/plug-ins/2.2.2/sorting/datetime-moment.js
    function stripMoment(d) {
        if (typeof d === 'string') {
            d = d.replace(/(<.*?>)|(\r?\n|\r)/g, '').trim(); // remove HTML tags, newlines and whitespace
        }
        return d;
    }

    $.fn.dataTable.moment = function (format, locale, reverseEmpties) {
        // add type detection
        const types = $.fn.dataTable.ext.type;
        types.detect.unshift(function (d) {
            d = stripMoment(d);
            if (d === '' || d === null) {
                return 'moment-' + format; // null and empty values are acceptable
            }
            return moment(d, format, locale, true).isValid() ?
                'moment-' + format : null;
        });

        // add sorting method
        types.order['moment-' + format + '-pre'] = function (d) {
            d = stripMoment(d);
            return !moment(d, format, locale, true).isValid() ?
                (reverseEmpties ? -Infinity : Infinity) : parseInt(moment(d, format, locale, true).format('x'), 10);
        };
    };
    $.fn.dataTable.moment('DD/MM/YYYY'); // most dates are in this format
    $.fn.dataTable.moment('DD/MMM/YYYY'); // ...except for except for individual meetings

    // hide the sidebar by default
    const visibleSidebar = $('#sv-sidebar').not('.sv-collapsed');
    if (visibleSidebar.length >= 1) {
        $('#sv-sidebar-collapse').trigger('click');
    }
    $('#STAFF_HOME').find('span:first').removeClass('glyphicon-chevron-right').addClass('glyphicon-home');
    $('#ECR-HOME').find('span:first').removeClass('glyphicon-chevron-right').addClass('glyphicon-hourglass');
    $('#RSH_TMP2').find('span:first').removeClass('glyphicon-chevron-right').addClass('glyphicon-education');

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
    waitForKeyElements('.ui-widget-overlay,.ui-dialog', function (e) {
        e.style.display = 'none';
    }, {waitOnce: false, allElements: true});

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
    // once our settings are loaded, refine the student list display
    function updateStudentDisplay() {
        const studentTable = $('#myrs_list');
        const meetingStudentLabel = $('label:contains("Student Course Join Number:")').parent().next();
        if (studentTable.length > 0) {
            console.log('eVision fixer: modifying student table', meetingStudentLabel);
            const studentTableAPI = studentTable.dataTable().api();
            studentTableAPI.page.len(-1).draw(); // show all rows in the list of students ("My Research Students")
            $('td[data-ttip="Name"]').each(function () { // trim names
                const currentPerson = $(this);
                const newName = currentPerson.text().trim().split(' ').filter(n => n.trim() && n !== '.');
                currentPerson.text(newName[0] + (newName.length > 1 ? ' ' + newName[newName.length - 1] : ''));
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

            // our updates break (and make obsolete) the page/previous/next buttons - hide them
            $('#myrs_list_length,#myrs_list_previous,#myrs_list_next').hide();
        }

        // link student numbers on meeting record pages
        const studentNumber = meetingStudentLabel.text().trim().split('/')[0];
        const studentLink = profileLinkPrefix + encodeURIComponent(meetingStudentLabel.text().trim());
        meetingStudentLabel.html('<a href="' + studentLink + '" target="_blank">' + studentNumber + '</a>');
    }

    const generalMeetingsTable = $('#supTab');
    if (generalMeetingsTable.length > 0) {
        console.log('eVision fixer: modifying generic meetings table');
        generalMeetingsTable.dataTable().api().page.len(-1).draw(); // show all rows in "Meetings and Events"
        generalMeetingsTable.dataTable().fnSort([[0, 'asc'], [3, 'asc']]); // sort by supervision type then date

        setTimeout(function () {
            $('a.sv-btn').each(function () {
                // open tasks in new window so the "letters" page doesn't need reloading all the time
                // TODO: be aware that eVision is only capable of editing one form at once... disabled as it often causes logout
                // $(this).attr('target', '_blank');
            });
        }, 250); // the target (default: _top) is added after initial page load, so change after a brief timeout
    }

    // individual meetings with a single student
    const meetingsTable = $('#DataTables_Table_0');
    if (meetingsTable.length > 0) {
        console.log('eVision fixer: modifying individual meetings table');
        const meetingsTableAPI = meetingsTable.dataTable().api();
        meetingsTableAPI.page.len(-1).draw(); // show all meeting list rows (an individual student's details)
        meetingsTable.dataTable().fnSort([[4, 'asc']]); // sort by meeting end date
        meetingsTable.dataTable().fnSort([[3, 'asc']]); // then by meeting start date

        // fix unusual role configuration display bug
        meetingsTable.find('td:nth-child(1)').each(function () {
            const currentRole = $(this);
            if (currentRole.text().indexOf('PrimarySecondaryPrimary and Secondary') >= 0) {
                currentRole.text('Primary and Secondary');
            }
        });

        // normalise name display
        meetingsTable.find('td:nth-child(2)').each(function () {
            const currentPerson = $(this);
            const newName = currentPerson.text().trim().split(' ').filter(n => n.trim() && n !== '.');
            currentPerson.text(newName[0] + (newName.length > 1 ? ' ' + newName[newName.length - 1] : ''));
        });

        // change the display of past or overdue meetings
        const deemphasised = meetingsTableAPI.rows().eq(0).filter(function (rowIdx) {
            const outcomeCellValue = meetingsTableAPI.cell(rowIdx, 6).data();
            const meetingComplete = outcomeCellValue.toLowerCase().includes('complete');
            if (meetingComplete) {
                console.log('eVision fixer: de-emphasising completed meeting: ' +
                    meetingsTableAPI.cell(rowIdx, 2).data());
            }
            return meetingComplete;
        });
        const overdue = meetingsTableAPI.rows().eq(0).filter(function (rowIdx) {
            const outcomeCell = meetingsTableAPI.cell(rowIdx, 6);
            const outcomeCellValue = outcomeCell.data().toLowerCase();
            const meetingComplete = outcomeCellValue.includes('complete');
            if (!meetingComplete) {
                const rowDueDate = moment(meetingsTableAPI.cell(rowIdx, 3).data(), 'DD/MMM/YYYY').toDate();
                const today = new Date();
                if (rowDueDate < today) {
                    console.log(rowDueDate, 'is expired');
                    if (outcomeCellValue.includes('pending')) {
                        outcomeCell.data('<span class="sv-label sv-label-danger"><span ' +
                            'class="glyphicon glyphicon-exclamation-sign"></span> Incomplete</span>');
                    } else {
                        outcomeCell.data('<span class="sv-label sv-label-danger"><span ' +
                            'class="glyphicon glyphicon-exclamation-sign"></span> Overdue</span>');
                    }
                    return true;
                }
            }
            return false;
        });
        meetingsTableAPI.rows(deemphasised).nodes().to$().addClass('deemphasise');
        meetingsTableAPI.rows(overdue).nodes().to$().addClass('overdue');
        const lastFinishedMeeting = $('.deemphasise,.overdue').filter(':last');
        if (lastFinishedMeeting.length >= 0) {
            lastFinishedMeeting[0].scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'center'
            });
        }

        // make the ad-hoc meeting button always show regardless of scroll
        $('a.sv-btn:contains("Create Adhoc Meeting")').css(backStyle).css({width: 'auto', marginRight: '300px'});

        // force re-rendering the table to fix an issue with date sorting not working
        meetingsTable.DataTable().rows().invalidate('data').draw(false);

        setTimeout(function () {
            $('a.sv-btn').each(function () {
                // open tasks in new window so the "letters" page doesn't need reloading all the time
                // TODO: be aware that eVision is only capable of editing one form at once... disabled as it often causes logout
                // $(this).attr('target', '_blank');
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
            $('.sv-control-label,.sv-checkbox-text').filter(':contains("Where is the student")').parent().find('input[id^="ANSWER.TTQ.MENSYS."][id$="2"]').prop('checked', true).change(); // off-campus, UK

            let dateToday = new Date();
            dateSelector.find('select[name^="SPLITDATE_Y.TTQ.MENSYS."]').val(dateToday.getUTCFullYear());
            dateSelector.find('select[name^="SPLITDATE_M.TTQ.MENSYS."]').val(('0' + (dateToday.getUTCMonth() + 1)).slice(-2));
            dateSelector.find('select[name^="SPLITDATE_D.TTQ.MENSYS."]').val(('0' + dateToday.getUTCDate()).slice(-2)).change(); // validation

            const meetingText = $('.sv-control-label:contains("Additional information")').parent().find('textarea[id^="ANSWER.TTQ.MENSYS."]');
            if (!meetingText.val()) {
                meetingText.val(defaultSupervisionComment);
            }
        });

        // add naive (but very useful) exit confirmation to avoid losing information when entering meeting notes
        $(window).on('beforeunload', function () {
            return true;
        });
        $('input[id^="ANSWER.TTQ.MENSYS."]').on('click', function () {
            $(window).off('beforeunload');
        });
    }

    // make ad hoc meeting scheduling a little more usable
    const adHocPanel = $('div.sv-panel-heading:contains("Schedule a Meeting for")').parent();
    if (adHocPanel.length > 0) {
        const daySelectors = adHocPanel.find('select[name^="SPLITDATE_D.TTQ.MENSYS."]');
        const monthSelectors = adHocPanel.find('select[name^="SPLITDATE_M.TTQ.MENSYS."]');
        const yearSelectors = adHocPanel.find('select[name^="SPLITDATE_Y.TTQ.MENSYS."]');

        // convert day name to day of week (updating on month/year change)
        const setDayName = function (daySelector, monthSelector, yearSelector) {
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

        // link start and end days
        daySelectors.each(function (index, daySelector) {
            const currentDaySelector = $(daySelector);
            currentDaySelector.on('change', function () {
                if (index !== 1) { // link end data - hacky, but fine as there are only two date fields
                    $(daySelectors[1]).val(currentDaySelector.val()).trigger('change');
                }
            });
        });

        // show the month name as well as its number
        monthSelectors.each(function (index, monthSelector) {
            const currentMonthSelector = $(monthSelector);
            for (let i = 0; i < 12; i++) {
                const date = new Date(2000, i, 1);
                const month = date.toLocaleString('default', {month: 'long'});
                const zeroPadded = ('0' + (i + 1)).slice(-2);
                currentMonthSelector.find('option[value="' + zeroPadded + '"]').text((i + 1) + ' – ' + month);
            }
            currentMonthSelector.on('change', function () {
                setDayName($(daySelectors[index]), currentMonthSelector, $(yearSelectors[index]));
                if (index !== 1) { // link end data - hacky, but fine as there are only two date fields
                    $(monthSelectors[1]).val(currentMonthSelector.val()).trigger('change');
                }
            });
        });

        // set up year selector change events
        const today = new Date();
        yearSelectors.each(function (index, yearSelector) {
            const currentDaySelector = $(daySelectors[index]);
            const currentMonthSelector = $(monthSelectors[index]);
            const currentYearSelector = $(yearSelector);
            currentYearSelector.on('change', function () {
                setDayName(currentDaySelector, currentMonthSelector, currentYearSelector);
                if (index !== 1) { // link end data - hacky, but fine as there are only two date fields
                    $(yearSelectors[1]).val(currentYearSelector.val()).trigger('change');
                }
            });
            currentDaySelector.val(('0' + today.getDate()).slice(-2));
            currentMonthSelector.val(('0' + (today.getMonth() + 1)).slice(-2));
            currentYearSelector.val(today.getFullYear()).trigger('change');
        });

        // hide the unnecessary end date view (we link both fields to show the same date) and initialise the title
        $(yearSelectors.slice(-1)[0]).closest('.sv-form-group').hide();
        $(yearSelectors[0]).closest('.sv-form-group').find('p.sv-checkbox-text').text('Meeting Date');
        setTimeout(function () {
            const meetingText = adHocPanel.find('input.sv-form-control[id^="ANSWER.TTQ.MENSYS."]');
            if (!meetingText.val()) {
                meetingText.val(defaultAdhocMeetingName);
            }
        }, 250); // hacky fix just to wait for the variable to be initialised

        // fix the scheduled meeting deletion button - just override the inbuilt function that for some reason is broken
        window.deleteRDE = function (rdekeys) {
            if (confirm('Delete this ad hoc meeting?')) {
                $('[data-ttqseqn=4]').val(rdekeys);
                $('[data-ttqseqn=2]').click();
            }
        };
    }

    // show meeting records by default
    $('div[data-altid="rdeDetails_1"]').show();
    $('div[data-altid="rdeDetails_2"]').show();

    // be more clear about what "New" actually means
    $('.sv-label-success:contains(" New")').html('<span class="glyphicon glyphicon-arrow-right"></span> Not started');
    $('.sv-label-warning:contains(" Pending")').html('<span class="glyphicon glyphicon-pencil"></span> In progress');

    // expand forms to the full page width
    $('div.sv-col-sm-4').removeClass('sv-col-sm-4').addClass('sv-col-sm-9');

    // for any remaining pages, always show all table rows by default
    $.fn.dataTable.tables().forEach((t) => {
        const dataTableAPI = $(t).dataTable().api();
        if (dataTableAPI) {
            dataTableAPI.page.len(-1).draw();
        }
    });
})();
