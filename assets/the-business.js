    var responseId;
    var eventId;
    var searchTimeout;

/*
 *
 *
 * ----------------------------------------------------------------------------
 * Entry point for the page.
 * ----------------------------------------------------------------------------
 * 
 * 
 */

    window.onload = function whatsUp() {

        const docPath=document.location.pathname.substring(1);



        // If the path is entirely numeric, we're reviewing a session:
        //---------------------------------------------------------------------
        if (isFinite(docPath) && docPath!='') {
            var xhr = new XMLHttpRequest();

            xhr.onload = function() {
                if (xhr.status == 200) {
                    try {
                        const blob=JSON.parse(xhr.response);
                        responseId = blob.responseId;
                        eventId = blob.eventId;
                        renderHeader(blob);
                        renderQuestions(blob.questions);
                        renderFooter();
                        renderFineprint();
                    } catch(err) {
                        showStatus('An unknown issue occurred. Sorry about that.', 'bad');
                    }
                } else {
                    showStatus('That link is invalid or has expired.', 'bad');
                }
            }

            xhr.open('GET', '/api/create-response/'+docPath);
            xhr.send();
        }



        // If we're listing sessions to review,
        // or listing sessions for one speaker:
        //---------------------------------------------------------------------
        if (docPath=='sessions' || docPath=='speaker' || docPath.substring(0, 6)=='event/') {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/sessions');
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

            xhr.onload = function() {
                if (xhr.status==200) {
                    const blob=JSON.parse(xhr.response);

                    if (docPath=='sessions') {
                        renderSessionHeader(blob[0].css);
                        renderSessionList(blob);
                        renderFineprint();
                    }

                    if (docPath.substring(0, 6)=='event/') {
                        renderSessionHeader(blob[0].css);
                        renderSessionList(blob);
                        renderFineprint();
                    }

                    if (docPath=='speaker') {
                        renderSpeakerPage(blob);
                        renderFineprint();
                    }
                }
            }

            if (document.location.pathname.substring(0, 7)=='/event/') {
                // /event/000000
                xhr.send('eventId='+encodeURIComponent(document.location.pathname.split('/')[2]));
            } else {
                // /sessions?responseId=0000000000
                xhr.send(document.location.search.substring(1));
            }
        }





        // If we're on the admin page, show the search field:
        //---------------------------------------------------------------------
        if (docPath=='admin') {
            renderAdminHeader();
        }


        // If we're on the admin page, show the search field:
        //---------------------------------------------------------------------
        if (docPath.split('/')[0]=='presenter-report') {
            renderPresenterReport();
        }


    }





/*
 *
 *
 * ----------------------------------------------------------------------------
 * Speaker page.
 * ----------------------------------------------------------------------------
 * 
 * 
 */

function renderPresenterReport() {
    document.body.classList.add('presenter-report');


    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/presenter-report');
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.onload = function() {
        if (xhr.status==200) {
            const blob=JSON.parse(xhr.response);

            if (blob.css) {
                var l=document.createElement('link');
                l.rel='stylesheet';
                l.href=blob.css;
                document.head.appendChild(l);
            }

            document.title='Your session feedback for '+blob.name;

            // The header for this session:
            var legend=document.createElement('div');
            legend.classList.add('header');
            legend.classList.add('report-legend');

            var legendText=document.createElement('div');
            legendText.innerText='Report legend';
            legendText.classList.add('title');
            legend.appendChild(legendText);

            var legendImg=document.createElement('img');
            legendImg.src='/report-legend.png';
            legend.appendChild(legendImg);

            document.body.appendChild(legend);

            for (const session of blob.sessions) {

                // The header for this session:
                var header=document.createElement('div');
                header.classList.add('header');

                var title=document.createElement('span');
                title.classList.add('title');
                title.innerText=session.title;
                header.appendChild(title);

                document.body.appendChild(header);
                var hasResponses=false;

                // Loop through all of the questions
                for (const question of blob.questions) {
                    var div=document.createElement('div');
                    div.classList.add('report');

                    // These are all the responses (radio/checkbox/text) to this question
                    const responseCollection=session.questions.filter(q => q.questionId==question.questionId)[0];

                    // This is the number of responses
                    if (responseCollection.sessionResponses>0 || responseCollection.textAnswers) {
                        var qtitle=document.createElement('div');
                        qtitle.classList.add('title');
                        qtitle.innerText=question.text;
                        div.appendChild(qtitle);
                    }

                    if (responseCollection.sessionResponses>0 && ['radio', 'checkbox'].indexOf(question.type)>=0) {

                        hasResponses=true;

                        var span=document.createElement('span');
                        span.classList.add('response-count');
                        span.innerText=responseCollection.sessionResponses+' response'+(responseCollection.sessionResponses>1 ? 's' : '');
                        if (responseCollection.sessionAveragePercent!==undefined) {
                            span.innerText+=', this session: '+responseCollection.sessionAveragePercent.toFixed(0)+'%';
                            if (responseCollection.eventAveragePercent!==undefined) {
                                span.innerText+=', event average: '+responseCollection.eventAveragePercent.toFixed(0)+'%';
                            }
                        }
                        div.appendChild(span);

                        const graphDefinition={
                            horizontalSpacing: 0.75,
                            xAxis: false,
                            bars: []
                        };

                        var maxSessionResponses=responseCollection.answers.reduce((agg, curr) => (curr.sessionResponses>agg ? curr.sessionResponses : agg), 0);
                        var maxEventResponses=responseCollection.answers.reduce((agg, curr) => (curr.eventResponses>agg ? curr.eventResponses : agg), 0);
                        
                        var annotations=document.createElement('div');
                        annotations.classList.add('annotations');

                        // Loop through all the response options for this question:
                        for (option of question.options) {
                            const response=responseCollection.answers.filter(o => o.optionId==option.optionId)[0];

                            graphDefinition.bars.push({
                                x: option.ordinal,
                                y: response.eventResponses*maxSessionResponses/(maxEventResponses || 1)*0.75,
                                class: (option.css || '') + ' event-average',
                                shift: '2%'
                            });

                            graphDefinition.bars.push({
                                x: option.ordinal,
                                y: response.sessionResponses,
                                class: option.css,
                                tooltip: option.annotation
                            });

                            if (option.annotation) {
                                var annotation=document.createElement('span');
                                annotation.classList.add('annotation');
                                annotation.innerText=option.annotation;
                                annotations.appendChild(annotation);
                            }

                        }
                        div.appendChild(graphObject(graphDefinition));
                        if (annotations.childNodes.length>0) {
                            div.appendChild(annotations);
                        }

                    }

                    if (responseCollection.textAnswers) {
                        hasResponses=true;

                        for (textAnswer of responseCollection.textAnswers) {
                            var textResponse=document.createElement('div');
                            textResponse.classList.add('text-response');
                            textResponse.innerText=textAnswer.text;
                            div.appendChild(textResponse);
                        }
                    }

                    if (div.childNodes.length>0) {
                        document.body.appendChild(div);
                    }
                }

                if (!hasResponses) {
                    var div=document.createElement('div');
                    div.classList.add('report');
                    div.innerText='No responses';
                    document.body.appendChild(div);
                }
            }

        }
    }

    xhr.send('eventId='+encodeURIComponent(document.location.pathname.split('/')[2])+'&'+
             'presenterSecret='+encodeURIComponent(document.location.pathname.split('/')[3]));

}




/*
 *
 *
 * ----------------------------------------------------------------------------
 * Speaker page.
 * ----------------------------------------------------------------------------
 * 
 * 
 */

    function renderSpeakerPage(blob) {
        document.body.classList.add('speaker-page');

        if (blob[0].css) {
            var l=document.createElement('link');
            l.rel='stylesheet';
            l.href=blob[0].css;
            document.head.appendChild(l);
        }

        blob.forEach(async session => {

            var div=document.createElement('div');
            div.classList.add('session');

            // Add the QR code image,
            var img=document.createElement('img');
            img.src=document.location.protocol.replace(':', '')+'://'+document.location.host+'/qr/'+session.sessionId;
            img.addEventListener('click', copyItemToClipboard);
            div.appendChild(img);

            // ... the speaker name(s),
            var span=document.createElement('span');
            span.innerText=session.presenters.map(presenter => { return(presenter.name); }).join(', ');;
            div.appendChild(span);

            // ... the session title,
            var span=document.createElement('span');
            span.classList.add('title');
            span.innerText=session.title;
            div.appendChild(span);

            // ... and the URL
            var a=document.createElement('a');
            a.innerText=document.location.protocol.replace(':', '')+'://'+document.location.host+'/'+session.sessionId;
            a.href=document.location.protocol.replace(':', '')+'://'+document.location.host+'/'+session.sessionId;
            a.addEventListener('click', copyItemToClipboard);
            div.appendChild(a);

            document.body.appendChild(div);
        });
    }

/*
 *
 *
 * ----------------------------------------------------------------------------
 * Admin page.
 * ----------------------------------------------------------------------------
 * 
 * 
 */

    function renderAdminHeader() {
        document.body.classList.add('admin-page');
        document.title='Admin';

        var input=document.createElement('input');
        input.classList.add('secret-key');
        input.type='password';
        input.placeholder='Please authenticate using your event secret key.';
        input.addEventListener("keyup", (e) => {
            //e.preventDefault();
            if (e.code=='Enter' && e.target.value) {
                loadAdminInfo(e.target.value);
            };
        });
        document.body.appendChild(input);

        var header=document.createElement('div');
        header.classList.add('header');
        header.style.display='none';

        var title=document.createElement('span');
        title.classList.add('title');
        title.innerText='Click on a QR code or link to copy.';
        header.appendChild(title);

        document.body.appendChild(header);
    }


    function loadAdminInfo(eventSecret) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/get-admin-sessions');
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

        xhr.onload = function() {
            if (xhr.status==200) {
                var blob;
                try {
                    blob=JSON.parse(xhr.response);
                    showStatus('Authenticated.', 'good');
                } catch(e) {
                    showStatus('That doesn\'t look right.', 'bad');
                    return;
                }

                var oldDivs=document.getElementsByClassName('session');
                for (n=oldDivs.length-1; n>=0; n--) {
                    oldDivs[n].remove();
                }

                document.querySelector('link#dynamiccss').href=blob.css || '/blank.css';
                document.getElementsByClassName('header')[0].style.display='';



                var div=document.createElement('div');
                div.classList.add('header');

                // Add the QR code image,
                var img=document.createElement('img');
                img.classList.add('qr');
                img.src=document.location.protocol.replace(':', '')+'://'+document.location.host+'/qr/event/'+blob.eventId;
                img.addEventListener('click', copyItemToClipboard);
                div.appendChild(img);

                // ... the name of the event,
                var span=document.createElement('span');
                span.classList.add('title');
                span.innerText=blob.name;
                div.appendChild(span);

                // ... and the URL
                var a=document.createElement('a');
                a.innerText=document.location.protocol.replace(':', '')+'://'+document.location.host+'/event/'+blob.eventId;
                a.href=document.location.protocol.replace(':', '')+'://'+document.location.host+'/event/'+blob.eventId;
                a.target='_new';
                a.addEventListener('click', copyItemToClipboard);
                div.appendChild(a);

                document.body.appendChild(div);







                if (!blob.sessions) {
                    showStatus('This event does not have any sessions.', 'bad');
                    return;
                }

                blob.sessions.forEach(async session => {

                    var div=document.createElement('div');
                    div.classList.add('session');

                    // Add the QR code image,
                    var img=document.createElement('img');
                    img.classList.add('qr');
                    img.src=document.location.protocol.replace(':', '')+'://'+document.location.host+'/qr/'+session.sessionId;
                    img.addEventListener('click', copyItemToClipboard);
                    div.appendChild(img);

                    // ... the speaker name(s),
                    var span=document.createElement('span');
                    span.innerText=session.presenters.map(presenter => { return(presenter.name); }).join(', ');;
                    div.appendChild(span);

                    // ... the session title,
                    var span=document.createElement('span');
                    span.classList.add('title');
                    span.innerText=session.title;
                    div.appendChild(span);

                    // ... and the URL
                    var a=document.createElement('a');
                    a.innerText=document.location.protocol.replace(':', '')+'://'+document.location.host+'/'+session.sessionId;
                    a.href=document.location.protocol.replace(':', '')+'://'+document.location.host+'/'+session.sessionId;
                    a.target='_new';
                    a.addEventListener('click', copyItemToClipboard);
                    div.appendChild(a);

                    document.body.appendChild(div);
                });

                loadAdminSpeakers(eventSecret);

            } else {
                showStatus('But there was a problem.', 'bad');
            }
        }

        xhr.send('eventSecret='+encodeURIComponent(eventSecret));
    }


    function loadAdminSpeakers(eventSecret) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/get-admin-presenters');
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

        xhr.onload = function() {
            if (xhr.status==200) {
                var blob;
                try {
                    blob=JSON.parse(xhr.response);
                    showStatus('Authenticated.', 'good');
                } catch(e) {
                    showStatus('That doesn\'t look right.', 'bad');
                    return;
                }

                var div=document.createElement('div');
                div.classList.add('header');

                // Header
                var span=document.createElement('span');
                span.classList.add('title');
                span.innerText='Speaker report URLs';
                div.appendChild(span);

                for (speaker of blob) {
                    // And one item for each speaker
                    var p=document.createElement('p');

                    var span=document.createElement('span');
                    span.innerText=speaker.name+': ';
                    p.appendChild(span);

                    var a=document.createElement('a');
                    a.innerText=document.location.protocol.replace(':', '')+'://'+document.location.host+'/presenter-report/'+speaker.eventId+'/'+speaker.presenterSecret;
                    a.href=document.location.protocol.replace(':', '')+'://'+document.location.host+'/presenter-report/'+speaker.eventId+'/'+speaker.presenterSecret;
                    a.target='_new';
                    a.addEventListener('click', copyItemToClipboard);
                    p.appendChild(a);

                    div.appendChild(p);
                }

                document.body.appendChild(div);







            } else {
                showStatus('But there was a problem.', 'bad');
            }
        }

        xhr.send('eventSecret='+encodeURIComponent(eventSecret));
    }


/*
 *
 *
 * ----------------------------------------------------------------------------
 * Feedback page.
 * ----------------------------------------------------------------------------
 * 
 * 
 */

    function renderHeader(blob) {
        document.body.classList.add('review-page');
        document.title='Feedback: '+blob.title;

        var header=document.createElement('div');
        header.classList.add('header');

        var title=document.createElement('span');
        title.classList.add('title');
        title.innerText=blob.title;
        header.appendChild(title);

        if (blob.css) {
            var l=document.createElement('link');
            l.rel='stylesheet';
            l.href=blob.css;
            document.head.appendChild(l);
        }

        var speakers=document.createElement('ul');
        speakers.classList.add('speakers');
        for (var speaker of blob.speakers) {
            var li=document.createElement('li');
            li.innerText=speaker.name;
            speakers.appendChild(li);
        }
        header.appendChild(speakers);
        document.body.appendChild(header);
    }

    function renderFooter() {
        var footer=document.createElement('div');
        footer.classList='footer';

        var button=document.createElement('button');
        button.classList='done';
        button.innerText='Done';
        button.addEventListener('click', () => {
            //location.href='/sessions?responseId='+encodeURIComponent(responseId);
            location.href='/event/'+encodeURIComponent(eventId);
        });
        footer.appendChild(button);

        document.body.appendChild(footer);
    }

    function renderQuestions(questions) {

        questions.forEach(q => {

            // The question DIV
            var qdiv=document.createElement('div');
            qdiv.classList.add('question');
            if (q.isRequired) { qdiv.classList.add('required'); }
            if (q.hasPercentages) { qdiv.classList.add('has-percentages'); }
            if (q.display==false) { qdiv.classList.add('hidden'); }
            qdiv.id='question'+q.questionId;

            // Indent this question DIV?
            if (q.indent) {
                qdiv.classList.add('indented');
                qdiv.style.top=-0.25*q.indent+'em';
                qdiv.style.left=0.5*q.indent+'em';
            }

            // Create the title of the question
            var span=document.createElement('span');
            span.innerText=q.question;
            span.classList.add('question-text');
            qdiv.appendChild(span);

            // If the question has a description text
            // (except if it's purely a text field)
            if (q.type!='text' && q.description) {
                var span2=document.createElement('span');
                span2.innerText=q.description;
                span2.classList.add('question-description');
                qdiv.appendChild(span2);
            }

            // If there are answer options, render those
            if (q.options) {
                var adiv=document.createElement('div');
                adiv.classList.add('answers');
                q.options.forEach(a => {
                    var div=document.createElement('label');
                    div.classList.add('answer');

                    var opt=document.createElement('input');
                    opt.name='opt'+q.questionId;
                    opt.value=a.answer_ordinal;
                    if (q.type=='checkbox') {
                        adiv.classList.add('checkboxes');

                        var lbl=document.createElement('label');
                        var span=document.createElement('span');
                        opt.type='checkbox';
                        span.innerText=a.annotation;
                        lbl.appendChild(opt);
                        lbl.appendChild(span);
                        div.appendChild(lbl);        
                    } else {
                        opt.type=(q.type || 'radio');
                        div.appendChild(opt);
                    }

                    opt.addEventListener('change', () => {
                        var ordinal=opt.value;
                        if (opt.type=='checkbox' && !opt.checked) { ordinal=-parseInt(opt.value); }
                        saveInput(q.questionId, ordinal, null);
                    });
                    adiv.appendChild(div);

                    // If the answer option has an associated question
                    // associated with it, add an onclick event to display
                    // that question when the option is clicked.
                    if (a.followUpQuestionId) {
                        opt.addEventListener('click', () => {
                            var followUp=document.querySelector('div#question'+a.followUpQuestionId);
                            followUp.classList.remove('hidden');
                        });
                    }

                    // If the answer option has a CSS class associated with it,
                    // add an onclick event to apply that class, but also
                    // remember to clear out any class we've previously set.
                    if (a.classList) {
                        opt.addEventListener('click', () => {

                            for (var className of qdiv.classList) {
                                if (className.substring(0, 1)=='-') {
                                    qdiv.classList.remove(className);
                                    qdiv.classList.remove(className.substring(1));
                                }
                            }

                            for (var className of a.classList.split(' ')) {
                                qdiv.classList.add(className);
                                qdiv.classList.add('-'+className);
                            }
                        });
                    }

                });
                qdiv.appendChild(adiv);

                if (q.type=='radio') {
                    var tdiv=document.createElement('div');
                    tdiv.classList.add('annotations');
                    q.options.filter(o => o.annotation).forEach(a => {
                        var div=document.createElement('div');
                        div.classList.add('annotation');
                        div.innerText=a.annotation;
                        tdiv.appendChild(div);
                    });
                    qdiv.appendChild(tdiv);
                }
            }

            // Is there a text area for the user to give comments?
            if (q.allowPlaintext) {
                var txtArea=document.createElement('textarea');
                if (q.description) {
                    txtArea.placeholder=q.description;
                } else if (q.type!='text') {
                    txtArea.placeholder='Use this field to elaborate.';
                }
                qdiv.appendChild(txtArea);
                txtArea.addEventListener('change', () => {
                    saveInput(q.questionId, null, txtArea.value);
                });
            }

            document.body.appendChild(qdiv);
        });
    }

    function saveInput(questionId, answerOrdinal, plaintext) {
        var postBody=
            'responseId='+encodeURIComponent(responseId)+'&'+
            'questionId='+encodeURIComponent(questionId)+'&'+
            'answerOrdinal='+encodeURIComponent(answerOrdinal)+'&'+
            'plaintext='+encodeURIComponent(plaintext);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/save');
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

        xhr.onload = function() {
            if (xhr.status==200) {
                showStatus('Saved', 'good');
            } else {
                showStatus('There was a problem saving your data', 'bad');
            }
        }

        xhr.send(postBody);
    }


/*
 *
 *
 * ----------------------------------------------------------------------------
 * Feedback session list.
 * ----------------------------------------------------------------------------
 * 
 * 
 */

    // Create the header and search field for the session list:
    function renderSessionHeader(css) {
        document.body.classList.add('sessions-page');

        if (css) {
            var l=document.createElement('link');
            l.rel='stylesheet';
            l.href=css;
            document.head.appendChild(l);
        }

        var search=document.createElement('input');
        search.classList.add('search');
        search.placeholder='Search sessions...';

        search.addEventListener("change", searchChangedEvent);
        search.addEventListener("keyup", searchChangedEvent);

        document.body.appendChild(search);
    }

    // Render the list of all sessions for this event:
    function renderSessionList(sessions) {
        for (var session of sessions) {
            var div=document.createElement('div');
            div.classList.add('session');

            var title=document.createElement('a');
            title.classList.add('title');
            title.href='/'+session.sessionId;
            title.innerText=session.title;

            var speakers=document.createElement('span');
            speakers.classList.add('speakers');
            speakers.innerText=session.presenters.map(presenter => { return(presenter.name); }).join(', ');

            div.appendChild(title);
            div.appendChild(speakers);

            document.body.appendChild(div);
        }
    }

    // Wait 500 ms after last keypress before we search
    function searchChangedEvent(e) {
        clearTimeout(searchTimeout);
        searchTimeout=setTimeout(filterSessionList, 500);
    }

    function filterSessionList() {
        var filterString=document.getElementsByClassName('search')[0].value.toLowerCase();
        var sessionDivs=Array.from(document.getElementsByClassName('session'));

        sessionDivs.forEach(div => {
            if (div.innerText.toLowerCase().indexOf(filterString)>=0) {
                div.classList.remove('hidden');
            } else {
                div.classList.add('hidden');
            }
        })
    }



/*
 *
 *
 * ----------------------------------------------------------------------------
 * Fine print.
 * ----------------------------------------------------------------------------
 * 
 * 
 */

    function renderFineprint() {
        var template=document.querySelector('div.fineprint.template');

        if (template) {
            var div=document.createElement('div');
            div.classList.add('fineprint');
            div.innerHTML=template.innerHTML;
            document.body.appendChild(div);

            template.remove();
        }
}





/*
 *
 *
 * ----------------------------------------------------------------------------
 * Mixed/utility stuff.
 * ----------------------------------------------------------------------------
 * 
 * 
 */

    // https://stackoverflow.com/a/20285053/5471286
    const toDataURL = url => fetch(url)
    .then(response => response.blob())
    .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    }));


    async function copyItemToClipboard(e) {
        e.preventDefault(); // Prevent for instance clicking on a link from following it.

        var rng=new Range();
        rng.selectNode(e.target);
        document.getSelection().empty();
        document.getSelection().addRange(rng);

        if (e.target.tagName.toLowerCase()=='img') {
            const data = await fetch(e.target.src);
            const blob = await data.blob();
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
        } else {
            // https://stackoverflow.com/a/73148322/5471286
            navigator.clipboard.write([new ClipboardItem({
                'text/plain': new Blob([e.target.innerText], {type: 'text/plain'}),
                'text/html': new Blob([e.target.outerHTML], {type: 'text/html'})
              })]);
        }
        showStatus('Copied.', 'good');
    }
