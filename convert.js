const inputElement = document.getElementById("fileInput");
const outputArea = document.getElementById("output");
const fileNameArea = document.getElementById("fileName");
let noteHandlingOption = "";
let lookupArray = [];

function getFile() {
  document.getElementById("fileInput").click();
}

function mergeEventsIntoChart(chartJson, eventsJson) {
  if (!chartJson?.song?.notes || !eventsJson?.song?.events) return chartJson;

  const bpm = chartJson.song.bpm;
  let beginsection_timing = 0;
  const sectionStarts = [];

  for (let i = 0; i < chartJson.song.notes.length; i++) {
    const section = chartJson.song.notes[i];
    sectionStarts.push(beginsection_timing);
    beginsection_timing += ((60 / bpm) * 4) / 16 * section.lengthInSteps * 1000;
  }

  function findSectionIndex(time) {
    for (let i = 0; i < sectionStarts.length - 1; i++) {
      if (time >= sectionStarts[i] && time < sectionStarts[i + 1]) {
        return i;
      }
    }
    return sectionStarts.length - 1;
  }

  for (const eventEntry of eventsJson.song.events) {
    if (!Array.isArray(eventEntry) || eventEntry.length < 2) continue;

    const time = eventEntry[0];
    const eventList = eventEntry[1];
    const sectionIndex = findSectionIndex(time);
    const section = chartJson.song.notes[sectionIndex];

    for (const ev of eventList) {
      const name = ev[0] ?? "";
      const v1 = ev[1] ?? "";
      const v2 = ev[2] ?? "";
      section.sectionNotes.push([time, -1, name, v1, v2]);
    }
  }

  for (const section of chartJson.song.notes) {
    section.sectionNotes.sort((a, b) => a[0] - b[0]);
  }

  return chartJson;
}

function dragOverHandler(ev) {
  ev.preventDefault();
}

function dropHandler(ev) {
  ev.preventDefault();

  const files = [];
  if (ev.dataTransfer.items) {
    for (let i = 0; i < ev.dataTransfer.items.length; i++) {
      if (ev.dataTransfer.items[i].kind === "file") {
        files.push(ev.dataTransfer.items[i].getAsFile());
      }
    }
  } else {
    for (let i = 0; i < ev.dataTransfer.files.length; i++) {
      files.push(ev.dataTransfer.files[i]);
    }
  }

  if (files.length > 0) {
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    inputElement.files = dataTransfer.files;
    inputElement.onchange();
  }
}

function download() {
  const link = document.createElement("a");
  link.href = "https://github.com/cabalex/fnf-song-converter/wiki/Making-and-Importing-New-Songs#step-3--importing-your-song-map";
  link.text = "Not sure where to go next? Click here!";
  outputArea.appendChild(link);
}

inputElement.onchange = async () => {
  const files = [...inputElement.files];
  if (!files.length) return;

  const jsonFiles = files.filter(f => f.name.endsWith(".json"));
  if (!jsonFiles.length) {
    alert("Enter JSON file(s), silly!");
    return;
  }

  const parsedFiles = [];
  for (const file of jsonFiles) {
    const text = await file.text();
    const json = JSON.parse(text.replace(/^\0+/, "").replace(/\0+$/, ""));
    parsedFiles.push({ file, json });
  }

  let chartFile = parsedFiles.find(
    f => Array.isArray(f.json?.song?.notes) && f.json.song.notes.length > 0
  );

  let eventsFile = parsedFiles.find(
    f => Array.isArray(f.json?.song?.events) && f.json.song.events.length > 0
  );

  if (!chartFile) {
    alert("Couldn't find the chart JSON.");
    return;
  }

  let json = structuredClone(chartFile.json);

  // Merge events already inside chart.json
  if (Array.isArray(json?.song?.events) && json.song.events.length > 0) {
    json = mergeEventsIntoChart(json, json);
    json.song.events = [];
  }

  // Merge separate events.json if uploaded
  if (eventsFile && eventsFile !== chartFile) {
    json = mergeEventsIntoChart(json, eventsFile.json);
  }

  convertLoadedChart(json, chartFile.file.name);
};

function convertLoadedChart(json, originalFileName) {
  noteHandlingOption = document.getElementById("noteHandlingSelector").value;

  outputArea.innerHTML = "";

  if (fileNameArea) {
    fileNameArea.innerHTML = originalFileName;
  }

  const outputTextInitial = document.createElement("h3");
  outputTextInitial.style = "text-align: center; display: block;";
  outputTextInitial.innerHTML = `${json.song.song} | ${json.song.bpm} BPM | SPEED ${parseFloat(json.song.speed).toFixed(2)}`;
  outputArea.appendChild(outputTextInitial);

  const bpm = json.song.bpm;
  const scratchList = [];
  const notesList = {};
  const sectionList = {};
  let beginsection_timing = 0;

  function addToNotesList(timing, value) {
    if (!notesList[timing]) {
      notesList[timing] = [value];
    } else {
      notesList[timing].push(value);
    }
  }

  for (let i = 0; i < json.song.notes.length; i++) {
    const section = json.song.notes[i];

    let assignment;
    if (section.mustHitSection == false) {
      assignment = [0, 1, 2, 3, 4, 5, 6, 7];
      sectionList[beginsection_timing.toString()] = "0";
    } else {
      assignment = [4, 5, 6, 7, 0, 1, 2, 3];
      sectionList[beginsection_timing.toString()] = "1";
    }

    beginsection_timing += ((60 / bpm) * 4) / 16 * section.lengthInSteps * 1000;

    for (let x = 0; x < section.sectionNotes.length; x++) {
      const note = section.sectionNotes[x];
      let timing = note[0].toFixed(4).padStart(12, "0");

      if (note[0].toString().split(".").length == 1) {
        timing = note[0].toString().padStart(7, "0");
      }

      // Embedded Psych events:
      // [time, -1, "Event Name", "Value1", "Value2"]
      if (note[1] === -1) {
        addToNotesList(timing, `undefined_${note[2]}_${note[3] ?? ""}_${note[4] ?? ""}`);
        continue;
      }

      switch (noteHandlingOption) {
        case "modulo":
          if (note.length == 3) {
            addToNotesList(timing, `${assignment[note[1] % 8]}_${note[2]}`);
          }
          break;

        case "ignore":
          if (note[1] < 8 && note.length == 3) {
            addToNotesList(timing, `${assignment[note[1]]}_${note[2]}`);
          }
          break;

        case "expanded_truncate":
          addToNotesList(
            timing,
            `${Math.floor(note[1] / 8) * 8 + assignment[note[1] % 8]}_${note[2]}`
          );
          break;

        case "expanded_unmodified_truncate":
          if (note[1] < 8) {
            addToNotesList(timing, `${assignment[note[1]]}_${note[2]}`);
          } else {
            addToNotesList(timing, `${note[1]}_${note[2]}`);
          }
          break;

        case "expanded":
          addToNotesList(
            timing,
            `${Math.floor(note[1] / 8) * 8 + assignment[note[1] % 8]}_${note.slice(2).join("_")}`
          );
          break;

        case "expanded_unmodified":
          if (note[1] < 8) {
            addToNotesList(timing, `${assignment[note[1]]}_${note.slice(2).join("_")}`);
          } else {
            addToNotesList(timing, note.slice(1).join("_"));
          }
          break;
      }
    }
  }

  lookupArray = Object.keys(notesList);
  lookupArray = lookupArray.concat(Object.keys(sectionList));
  lookupArray = [...new Set(lookupArray)];
  lookupArray.sort((a, b) => Number(a) - Number(b));

  for (let i = 0; i < lookupArray.length; i++) {
    if (Object.keys(sectionList).includes(lookupArray[i])) {
      scratchList.push(`#${sectionList[lookupArray[i]]}-${lookupArray[i]}`);
    }

    if (Object.keys(notesList).includes(lookupArray[i])) {
      for (let x = 0; x < notesList[lookupArray[i]].length; x++) {
        scratchList.push(`?${lookupArray[i]}_${notesList[lookupArray[i]][x]}`);
      }
    }
  }

  const blob = new Blob([scratchList.join("\n")], { type: "text/plain" });
  const a = document.createElement("a");
  document.body.appendChild(a);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  if (outputArea.style.display === "none") {
    outputArea.style.display = "block";
  }

  link.href = url;
  link.innerText = "Download";
  link.download = originalFileName.split(".")[0] + ".txt";
  link.id = "download";
  link.addEventListener("click", function () {
    download();
  }, false);
  outputArea.appendChild(link);
}
