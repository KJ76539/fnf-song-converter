const inputElement = document.getElementById("fileInput");
const outputArea = document.getElementById("output");
const fileNameArea = document.getElementById("fileName");

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

function getFile() {
  document.getElementById("fileInput").click();
}

function dragOverHandler(ev) {
  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();
}

function dropHandler(ev) {
    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();
    var files = [];
    if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        for (var i = 0; i < ev.dataTransfer.items.length; i++) {
            // If dropped items aren't files, reject them
            if (ev.dataTransfer.items[i].kind === 'file') {
                files.push(ev.dataTransfer.items[i].getAsFile());
            };
        };
    } else {
        // Use DataTransfer interface to access the file(s)
        for (var i = 0; i < ev.dataTransfer.files.length; i++) {
        files.push(ev.dataTransfer.files[i]);
        };
    };
    if (files.length > 0) {
        loadFile(files[0]);
    };
}

function download() {
    const link = document.createElement('a');
    link.href = "https://github.com/cabalex/fnf-song-converter/wiki/Making-and-Importing-New-Songs#step-3--importing-your-song-map"
    link.text = "Not sure where to go next? Click here!"
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
    const json = JSON.parse(text.replace(/^\0+/, '').replace(/\0+$/, ''));
    parsedFiles.push({ file, json });
  }

  let chartFile = parsedFiles.find(f => Array.isArray(f.json?.song?.notes) && f.json.song.notes.length > 0);
  let eventsFile = parsedFiles.find(f => Array.isArray(f.json?.song?.events) && f.json.song.events.length > 0);

  if (!chartFile) {
    alert("Couldn't find the chart JSON.");
    return;
  }

  let json = structuredClone(chartFile.json);

  if (eventsFile && eventsFile !== chartFile) {
    json = mergeEventsIntoChart(json, eventsFile.json);
  }

  convertLoadedChart(json, chartFile.file.name);
};

function convertLoadedChart(json, originalFileName) {
  noteHandlingOption = document.getElementById("noteHandlingSelector").value;

  outputArea.innerHTML = '';

  const outputTextInitial = document.createElement("h3");
  outputTextInitial.style = "text-align: center; display: block;";
  outputTextInitial.innerHTML = `${json.song.song} | ${json.song.bpm} BPM | SPEED ${parseFloat(json.song.speed).toFixed(2)}`;
  outputArea.appendChild(outputTextInitial);

  const bpm = json.song.bpm;
  const scratchList = [];
  const notesList = {};
  const sectionList = {};
  var beginsection_timing = 0;

  function addToNotesList(timing, value) {
    if (!notesList[timing]) {
      notesList[timing] = [value];
    } else {
      notesList[timing].push(value);
    }
  }

  for (i = 0; i < json.song.notes.length; i++) {
    const section = json.song.notes[i];

    if (section.mustHitSection == false) {
      var assignment = [0, 1, 2, 3, 4, 5, 6, 7];
      sectionList[beginsection_timing.toString()] = "0";
    } else {
      var assignment = [4, 5, 6, 7, 0, 1, 2, 3];
      sectionList[beginsection_timing.toString()] = "1";
    }

    beginsection_timing += ((60 / bpm) * 4) / 16 * section.lengthInSteps * 1000;

    for (x = 0; x < section.sectionNotes.length; x++) {
      let note = section.sectionNotes[x];
      let timing = note[0].toFixed(4).padStart(12, '0');

      if (note[0].toString().split(".").length == 1) {
        timing = note[0].toString().padStart(7, '0');
      }

      if (note[1] === -1) {
        addToNotesList(timing, `undefined_${note[2]}_${note[3] ?? ""}_${note[4] ?? ""}`);
        continue;
      }

      switch(noteHandlingOption) {
        case "modulo":
          if (note.length == 3) {
            addToNotesList(timing, `${assignment[note[1]%8]}_${note[2]}`);
          }
          break;
        case "ignore":
          if (note[1] < 8 && note.length == 3) {
            addToNotesList(timing, `${assignment[note[1]]}_${note[2]}`);
          }
          break;
        case "expanded_truncate":
          addToNotesList(timing, `${Math.floor(note[1]/8)*8 + assignment[note[1]%8]}_${note[2]}`);
          break;
        case "expanded_unmodified_truncate":
          if (note[1] < 8) {
            addToNotesList(timing, `${assignment[note[1]]}_${note[2]}`);
          } else {
            addToNotesList(timing, `${note[1]}_${note[2]}`);
          }
          break;
        case "expanded":
          addToNotesList(timing, `${Math.floor(note[1]/8)*8 + assignment[note[1]%8]}_${note.slice(2).join('_')}`);
          break;
        case "expanded_unmodified":
          if (note[1] < 8) {
            addToNotesList(timing, `${assignment[note[1]]}_${note.slice(2).join('_')}`);
          } else {
            addToNotesList(timing, note.slice(1).join('_'));
          }
          break;
      }
    }
  }

  lookupArray = Object.keys(notesList);
  lookupArray = lookupArray.concat(Object.keys(sectionList));
  lookupArray = [...new Set(lookupArray)];
  lookupArray.sort((a,b) => Number(a)-Number(b));

  for (var i = 0; i < lookupArray.length; i++) {
    if (Object.keys(sectionList).includes(lookupArray[i])) {
      scratchList.push(`#${sectionList[lookupArray[i]]}-${lookupArray[i]}`);
    }

    if (Object.keys(notesList).includes(lookupArray[i])) {
      for (var x = 0; x < notesList[lookupArray[i]].length; x++) {
        scratchList.push(`?${lookupArray[i]}_${notesList[lookupArray[i]][x]}`);
      }
    }
  }

  const blob = new Blob([scratchList.join("\n")], {type : 'text/plain'});
  const a = document.createElement('a');
  document.body.appendChild(a);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  if (outputArea.style.display === "none") {
    outputArea.style.display = "block";
  }

  link.href = url;
  link.innerText = 'Download';
  link.download = originalFileName.split(".")[0] + ".txt";
  link.id = "download";
  link.addEventListener('click', function(){download()}, false);
  outputArea.appendChild(link);
}
  
  fileNameArea.innerHTML = file.name;
  let reader = new FileReader();

  reader.onload = (e) => {
    // Handle dropdown - "modulo", "ignore", "expanded"
    noteHandlingOption = document.getElementById("noteHandlingSelector").value

    const json = JSON.parse(
        e.target.result.replace(/^\0+/, '').replace(/\0+$/, '') // sometimes has \x00 at the end
    );

    // display bpm and speed, reset output area
    var outputString = '';
    outputArea.innerHTML = '';
    const outputTextInitial = document.createElement("h3");
    outputTextInitial.style = "text-align: center; display: block;"
    outputTextInitial.innerHTML = `${json.song.song} | ${json.song.bpm} BPM | SPEED ${parseFloat(json.song.speed).toFixed(2)}`
    outputArea.appendChild(outputTextInitial);

    const bpm = json.song.bpm;
    const scratchList = [];
    const notesList = {};
    const sectionList = {};
    var beginsection_timing = 0;

    function addToNotesList(timing, value) {
        if (!notesList[timing]) {
            notesList[timing] = [value];
        } else {
            notesList[timing].push(value);
        }
    }

    for (i = 0; i < json.song.notes.length; i++) {
        // sections
        const section = json.song.notes[i];

        if (section.mustHitSection == false) {
            var assignment = [0, 1, 2, 3, 4, 5, 6, 7];
            sectionList[beginsection_timing.toString()] = "0" 
        } else {
            var assignment = [4, 5, 6, 7, 0, 1, 2, 3];
            sectionList[beginsection_timing.toString()] = "1"
        }

        beginsection_timing += ((60 / bpm) * 4) / 16 * section.lengthInSteps * 1000;

        // notes
        for (x = 0; x < section.sectionNotes.length; x++) {
            let note = section.sectionNotes[x];
            let timing = note[0].toFixed(4).padStart(12, '0')

            if (note[0].toString().split(".").length == 1) {
                timing = note[0].toString().padStart(7, '0')
            }

            switch(noteHandlingOption) {
                case "modulo":
                    // truncates modified notes (e.g. hurt notes)
                    if (note.length == 3) {
                        addToNotesList(timing, `${assignment[note[1]%8]}_${note[2]}`);
                    }
                    break;
                case "ignore":
                    // note modifiers are often index 3 (length 4)
                    if (note[1] < 8 && note.length == 3) {
                        addToNotesList(timing, `${assignment[note[1]]}_${note[2]}`);
                    }
                    break;
                case "expanded_truncate":
                    addToNotesList(timing, `${Math.floor(note[1]/8)*8 + assignment[note[1]%8]}_${note[2]}`);
                    break;
                case "expanded_unmodified_truncate":
                    if (note[1] < 8) {
                        addToNotesList(timing, `${assignment[note[1]]}_${note[2]}`);
                    } else {
                        addToNotesList(timing, `${note[1]}_${note[2]}`);
                    }
                    break;
                case "expanded":
                    addToNotesList(timing, `${Math.floor(note[1]/8)*8 + assignment[note[1]%8]}_${note.slice(2).join('_')}`);
                    break;
                case "expanded_unmodified":
                    if (note[1] < 8) {
                        addToNotesList(timing, `${assignment[note[1]]}_${note.slice(2).join('_')}`);
                    } else {
                        addToNotesList(timing, note.slice(1).join('_'));
                    }
                    break;
            }
        }
    }

    // we need to do these shenanigans due to the way sections can be formatted; sometimes all notes are grouped in one giant section

    lookupArray = Object.keys(notesList); // get note timings

    lookupArray = lookupArray.concat(Object.keys(sectionList)) // concat with section timings

    lookupArray = [...new Set(lookupArray)]; // remove duplicates

    lookupArray.sort((a,b) => Number(a)-Number(b)) // sort

    for (var i = 0; i < lookupArray.length; i++) {
        // if a valid section is at this lookup, add it to the scratch list
        if (Object.keys(sectionList).includes(lookupArray[i])) {
            scratchList.push(`#${sectionList[lookupArray[i]]}-${lookupArray[i]}`)
        }

        // if a valid note is at this lookup, add it to the scratch list
        if (Object.keys(notesList).includes(lookupArray[i])) {
            for (var x = 0; x < notesList[lookupArray[i]].length; x++) {
                scratchList.push(`?${lookupArray[i]}_${notesList[lookupArray[i]][x]}`)
            }
        }
    }

    // Create download link for outputted text file
    const blob = new Blob([scratchList.join("\n")], {type : 'text/plain'});
    const a = document.createElement('a');
    document.body.appendChild(a);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    if (outputArea.style.display === "none") {
        outputArea.style.display = "block"
    }

    link.href = url;
    link.innerText = 'Download';
    link.download = file.name.split(".")[0] + ".txt";
    link.id = "download";
    link.addEventListener('click', function(){download()}, false);
    outputArea.appendChild(link);
  }

  reader.onerror = (e) => {
    const error = e.target.error;
    console.error(`Error occured while reading ${file.name}`, error);
  }

  reader.readAsText(file);
}
