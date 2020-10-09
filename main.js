function getEvents() {
    return new Promise((resolve, reject) => {
        $.getJSON("events.json", function(data) {
            resolve(data);
        });
    });
}

db = new PouchDB("main");
subjects = {};

function setUpForm() {
    for(let vert in subjects) {
        $('#verts').append(`
         <h4>${vert}</h4>
        `);
        for(let sub of subjects[vert].keys()) {

            $('#verts').append(`
            <label for="${sub}">${sub}</label>
            <input class="subj" type="checkbox" id="${sub}" name="${sub}" value="${sub}">
            <br>
            `);
        }
        $('#verts').append(`<hr>`);
    }

    $('#settings').on('click', '*', e => {
        renderTable();
    });
}

async function renderTable() {
    tbl = $('#table');
    checked_subj = new Set();
    for(let subj of $('.subj'))
        if($(subj).prop('checked'))
            checked_subj.add(subj.value);

    types = $('#type').val();
    week  = $('#week').val();

    allsub = [];


    for(let time of Array.from({length: 7}, (x, i) => i + 1)) {
        allsub.push(db.find({
            sort: ["day"],
            selector:
            {name: {$in:Array.from(checked_subj)},day: {$exists: true}, time: time, week: {$in:[week, 'both']}, type: {$in: types}}}));

    }

    subs = await Promise.all(allsub);

    let content = `<table><tr><th>DS</th>`;
    for(let day of ["Mo", "Di", "Mi", "Do", "Fr"])
        content += `<th>${day}</th>`;
    content += `</tr>`;

    for(let time in subs) {
        content += `<tr><td>${parseInt(time) + 1}`;
        last_day = 0;
        weekday_subs = Array.from({length: 5}, (x, i) => []);
        for(let sub of subs[time].docs) {
            console.log( sub, sub.day );

            weekday_subs[sub.day].push(sub);
        }
        console.log(weekday_subs);

        for (let day of weekday_subs) {
            content += `<td class="${day.length > 1 ? "red" : ""}">`;
            for(let sub of day) {
                content += sub.name;
                if(sub.type === "tut")
                    content += "(U)";
                content += ",<br>";
            }
            content += `</td>`;
        }
        content += `</tr>`;
    }

    tbl.html(content);
}

$(document).ready(() => {
    getEvents().then(events => {
        allput=[];
        for(let event of events) {
            if(!subjects[event.vert_name])
                subjects[event.vert_name] = new Set();
            subjects[event.vert_name].add(event.name);
            allput.push(db.put({_id: event.name + event.time.toString() + event.day.toString() + event.week,
                                  ...event}).catch(() => true));
        }

        return Promise.all(allput);

    }).then(() => {
        return db.createIndex({
            index: {fields: ['day']}
        });
    }).then(() =>{
        setUpForm();
    });
});
