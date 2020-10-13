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
        renderTable('ugw');
        renderTable('gw');
    });
}

async function renderTable(week) {
    let tbl = $(`#table-${week}`);
    let checked_subj = new Set();
    for(let subj of $('.subj'))
        if($(subj).prop('checked'))
            checked_subj.add(subj.value);

    let types = $('#type').val();
    if(types.length === 0)
        types = ['tut', 'lect'];

    let allsub = [];

    for(let time of Array.from({length: 7}, (x, i) => i + 1)) {
        allsub.push(db.find({
            sort: ["day"],
            selector:
            {name: {$in:Array.from(checked_subj)},day: {$exists: true}, time: time, week: {$in:[week, 'both']}, type: {$in: types}}}));

    }

    let subs = await Promise.all(allsub);

    let content = `<table><tr><th>DS</th>`;
    for(let day of ["Mo", "Di", "Mi", "Do", "Fr"])
        content += `<th>${day}</th>`;
    content += `</tr>`;

    for(let time in subs) {
        content += `<tr><td>${parseInt(time) + 1}`;
        let last_day = 0;
        let weekday_subs = Array.from({length: 5}, (x, i) => []);
        for(let sub of subs[time].docs) {
            weekday_subs[sub.day].push(sub);
        }

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
db.allDocs({include_docs: true}).then(({rows}) => {
            return Promise.all(rows.map(row => db.remove(row.doc)));
}).then(() =>
    getEvents()).then(events => {
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
