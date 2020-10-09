from bs4 import BeautifulSoup
import requests
from uritools import urijoin
import re
from enum import Enum
import json

base = "https://tu-dresden.de/"
time_regex = re.compile(
    r"(MO|DI|MI|DO|FR)\(([0-9])\)\s*(ugW|gw)*", re.MULTILINE | re.IGNORECASE
)
days = ["MO", "DI", "MI", "DO", "FR"]


class Week(str, Enum):
    GW = "gw"
    UGW = "ugw"
    BOTH = "both"


def parse_dates(text):
    parsed = []
    for day, time, week in time_regex.findall(text):
        day = days.index(day)
        week = (
            (Week.GW if re.match("gw", week, re.IGNORECASE) else Week.UGW)
            if week
            else Week.BOTH
        )

        parsed.append(dict(day=day, week=week, time=int(time)))

    return parsed


def parse_lecture(lect_link, name):
    lect_html = requests.get(urijoin(base, lect_link.get("href"))).text
    lect = BeautifulSoup(lect_html, features="html.parser")
    lect_times = (
        lect.find("div", class_="tudbox")
        .find(lambda tag: tag.name == "td" and "Zeit/Ort:" in tag.text)
        .find_next_sibling("td")
        .text.strip()
    )

    dates = [
        dict(
            name=lect_link.text,
            vert_name=name,
            week=date["week"],
            time=date["time"],
            day=date["day"],
            type="lect",
        )
        for date in parse_dates(lect_times)
    ]

    tuts = None
    tuts_row = lect.find("div", class_="tudbox").find(
        lambda tag: tag.name == "td" and "Übungen:" in tag.text
    )

    if tuts_row:
        dates += [
            dict(
                name=lect_link.text,
                vert_name=name,
                date=date,
                week=date["week"],
                time=date["time"],
                day=date["day"],
                type="tut",
            )
            for date in parse_dates(
                list(tuts_row.find_next_sibling("td").findAll("td"))[-1].text
            )
        ]

    return dates


def get_lectures(vert_table, vert_name):
    return [
        event
        for lect in vert_table.findAll("a")
        for event in parse_lecture(lect, vert_name)
    ]


def get_vert_tables():
    vert_html = requests.get(
        "https://tu-dresden.de/mn/physik/studium/lehrveranstaltungen/vertiefungsgebiete-bachelor-und-master/katalog_wintersemester"
    ).text
    soup = BeautifulSoup(vert_html, features="html.parser")

    vert_tables = soup.findAll("table", class_="BodyTable")

    verts = [
        lecture
        for vert in vert_tables
        for lecture in get_lectures(vert, vert.previous_sibling.text)
    ]
    return verts


def get_lectures_for_time(verts, time, tut=False, week=None):
    lects = [[] for _ in days]
    lnames = [[] for _ in days]
    for _, vert in verts.items():
        for lect in vert["lectures"]:
            times = lect["tutorial_times"] if tut else lect["lecture_times"]
            if times:
                for l_time in times:
                    if l_time["time"] == time:
                        if lect["name"] not in lnames[l_time["day"]]:
                            if week is not None and l_time["week"].value != week.value:
                                continue

                            lects[l_time["day"]].append(lect)
                            lnames[l_time["day"]].append(lect["name"])

    return lects


if __name__ == "__main__":
    all = get_vert_tables()
    print(json.dumps(all))
