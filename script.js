const STORAGE = {
  profile: "plantasticProfile",
  measurements: "plantasticMeasurements"
};

const GROUPS = ["Group A - 10ml", "Group B - 30ml", "Group C - 40ml"];
const COLORS = {
  "Group A - 10ml": "#efc96a",
  "Group B - 30ml": "#6f9d5c",
  "Group C - 40ml": "#4d91a8"
};

let measurements = migrateMeasurements(JSON.parse(localStorage.getItem(STORAGE.measurements) || "[]"));
let sizeChart;
let aliveChart;
let totalAliveChart;
let pendingPhoto = "";
const SHARED_DATA_URL = "./data/plantastic-data.json";

// Convert older saved Spanish measurements to English and centimeters to inches.
function migrateMeasurements(savedMeasurements) {
  const migrated = savedMeasurements.map(record => {
    const number = String(record.group || "").match(/[ABC]/)?.[0];
    const oldGroup = record.group || "";
    const amount = oldGroup.includes("40") ? "40ml" : oldGroup.includes("30") ? "30ml" : "10ml";
    const containerNumber = String(record.container || record.cup || "").match(/[123]/)?.[0] || "1";
    return {
      ...record,
      group: number ? `Group ${number} - ${amount}` : record.group,
      container: `Container ${containerNumber}`,
      size: Number(record.size),
      unit: "in"
    };
  });
  if (JSON.stringify(migrated) !== JSON.stringify(savedMeasurements)) {
    localStorage.setItem(STORAGE.measurements, JSON.stringify(migrated));
  }
  return migrated;
}

// Create experiment day options, limited to 30 days.
function initializeDays() {
  const daySelect = document.getElementById("day");
  for (let day = 1; day <= 30; day++) {
    const option = document.createElement("option");
    option.value = String(day);
    option.textContent = `Day ${day}`;
    daySelect.appendChild(option);
  }
}

// Restore the saved profile when the page opens.
function loadProfile() {
  const profile = JSON.parse(localStorage.getItem(STORAGE.profile) || "null");
  if (!profile) return;
  profile.plantName = profile.plantName || "";
  document.getElementById("school").value = profile.school;
  document.getElementById("student").value = profile.student;
  document.getElementById("plantName").value = profile.plantName || "";
  document.getElementById("grade").value = profile.grade;
  if (profile.plantName) updateWelcome(profile);
}

// Save the school, student, and grade.
function saveProfile(event) {
  event.preventDefault();
  const profile = {
    school: document.getElementById("school").value.trim(),
    student: document.getElementById("student").value.trim(),
    plantName: document.getElementById("plantName").value.trim(),
    grade: document.getElementById("grade").value.trim()
  };
  localStorage.setItem(STORAGE.profile, JSON.stringify(profile));
  updateWelcome(profile);
  showToast("Information saved!");
}

// Update the welcome message.
function updateWelcome(profile) {
  document.getElementById("welcomeMessage").textContent =
    `Hello, ${profile.student}! Your ${profile.plantName} plants at ${profile.school} are ready for ${profile.grade} data.`;
}

// Convert the selected photo to Base64 for LocalStorage.
function previewPhoto(event) {
  const file = event.target.files[0];
  const preview = document.getElementById("photoPreview");
  pendingPhoto = "";
  if (!file) {
    preview.style.display = "none";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    pendingPhoto = reader.result;
    preview.src = pendingPhoto;
    preview.style.display = "block";
  };
  reader.readAsDataURL(file);
}

// Add a measurement to the history and save it in the browser.
function saveMeasurement(event) {
  event.preventDefault();
  const leaves = Number(document.getElementById("leaves").value);
  const alive = Number(document.getElementById("alive").value);
  if (leaves > 4 || alive > 4) {
    showToast("Each container can have a maximum of 4 plants.");
    return;
  }

  const record = {
    id: Date.now(),
    day: Number(document.getElementById("day").value),
    group: document.getElementById("group").value,
    container: document.getElementById("container").value,
    size: Number(document.getElementById("size").value),
    leaves,
    alive,
    unit: "in",
    photo: pendingPhoto
  };
  const existingIndex = measurements.findIndex(item =>
    item.day === record.day && item.group === record.group && item.container === record.container
  );
  const previousMeasurements = [...measurements];
  if (existingIndex >= 0) measurements[existingIndex] = { ...record, id: measurements[existingIndex].id };
  else measurements.push(record);

  try {
    localStorage.setItem(STORAGE.measurements, JSON.stringify(measurements));
  } catch (error) {
    measurements = previousMeasurements;
    showToast("The photo is too large. Try another image.");
    return;
  }

  document.getElementById("measurementForm").reset();
  document.getElementById("photoPreview").style.display = "none";
  pendingPhoto = "";
  renderAll();
  showToast("Measurement saved!");
}

// Show saved measurements in the history table.
function renderTable() {
  const table = document.getElementById("recordsTable");
  document.getElementById("recordCount").textContent =
    `${measurements.length} ${measurements.length === 1 ? "record" : "records"}`;

  if (!measurements.length) {
    table.innerHTML = '<tr><td class="empty-row" colspan="8">No measurements yet. Your first plant is waiting!</td></tr>';
    return;
  }

  const rows = [...measurements].sort((a, b) => a.day - b.day || GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
  table.innerHTML = rows.map(record => `
    <tr>
      <td>Day ${record.day}</td>
      <td>${record.group.replace(" - ", ": ")}</td>
      <td>${record.container}</td>
      <td>${record.size}</td>
      <td>${record.leaves}</td>
      <td>${record.alive}</td>
      <td>${record.photo ? `<button class="photo-thumbnail" type="button" data-photo="${photoSource(record.photo)}" aria-label="Enlarge photo for day ${record.day}"><img class="table-photo" src="${photoSource(record.photo)}" alt="Photo for day ${record.day}"></button>` : "—"}</td>
      <td><button class="delete-button" type="button" data-id="${record.id}" aria-label="Delete record">Delete</button></td>
    </tr>
  `).join("");
}

// Delete the selected record.
function deleteMeasurement(event) {
  const photoButton = event.target.closest("[data-photo]");
  if (photoButton) {
    openPhoto(photoButton.dataset.photo);
    return;
  }
  const button = event.target.closest("[data-id]");
  if (!button) return;
  measurements = measurements.filter(record => record.id !== Number(button.dataset.id));
  localStorage.setItem(STORAGE.measurements, JSON.stringify(measurements));
  renderAll();
  showToast("Record deleted.");
}

// Open a measurement photo in a larger dialog.
function openPhoto(photo) {
  const dialog = document.getElementById("photoDialog");
  document.getElementById("largePhoto").src = photo;
  dialog.showModal();
}

// Calculate the average height for each group and day.
function averageByGroup(days, valueField) {
  return GROUPS.map(group => ({
    group,
    values: days.map(day => {
      const matching = measurements.filter(record => record.group === group && record.day === day);
      if (!matching.length) return null;
      const total = matching.reduce((sum, record) => sum + Number(record[valueField]), 0);
      return Number((total / matching.length).toFixed(2));
    })
  }));
}

// Add the plants from all containers to get the group total.
function totalAliveByGroup(days) {
  return GROUPS.map(group => ({
    group,
    values: days.map(day => {
      const matching = measurements.filter(record => record.group === group && record.day === day);
      if (!matching.length) return null;
      return matching.reduce((sum, record) => sum + Number(record.alive), 0);
    })
  }));
}

// Draw or update the charts using the saved data.
function renderCharts() {
  const days = [...new Set(measurements.map(record => record.day))].sort((a, b) => a - b);
  const labels = days.map(day => `Day ${day}`);
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700 },
    plugins: { legend: { labels: { usePointStyle: true, font: { family: "Nunito", size: 12 } } } },
    scales: {
      x: { title: { display: true, text: "Experiment Days" }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Average" } }
    }
  };

  const datasets = averageByGroup(days, "size").map(item => ({
    label: item.group.replace(" - ", ": "),
    data: item.values,
    borderColor: COLORS[item.group],
    backgroundColor: COLORS[item.group] + "55",
    borderWidth: 3,
    pointRadius: 5,
    pointHoverRadius: 7,
    tension: 0.3,
    spanGaps: true
  }));
  const aliveDatasets = totalAliveByGroup(days).map(item => ({
    label: item.group.replace(" - ", ": "),
    data: item.values,
    borderColor: COLORS[item.group],
    backgroundColor: COLORS[item.group] + "55",
    borderWidth: 3,
    pointRadius: 5,
    pointHoverRadius: 7,
    tension: 0.3,
    spanGaps: true
  }));

  if (sizeChart) sizeChart.destroy();
  if (aliveChart) aliveChart.destroy();
  if (totalAliveChart) totalAliveChart.destroy();
  sizeChart = new Chart(document.getElementById("sizeChart"), {
    type: "line", data: { labels, datasets }, options: chartOptions
  });
  aliveChart = new Chart(document.getElementById("aliveChart"), {
    type: "line",
    data: { labels, datasets: aliveDatasets },
    options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, title: { display: true, text: "Living plants" } } } }
  });
  const totalAliveCanvas = document.getElementById("totalAliveChart");
  totalAliveCanvas.style.width = `${Math.max(900, days.length * 105)}px`;
  totalAliveChart = new Chart(totalAliveCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: totalAliveByGroup(days).map(item => ({
        label: item.group.replace(" - ", ": "),
        data: item.values,
        backgroundColor: COLORS[item.group],
        borderColor: COLORS[item.group],
        borderWidth: 1,
        borderRadius: 6
      }))
    },
    options: {
      ...chartOptions,
      datasets: {
        bar: {
          categoryPercentage: 0.82,
          barPercentage: 0.72
        }
      },
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          beginAtZero: true,
          max: 12,
          title: { display: true, text: "Total living plants" }
        }
      }
    }
  });
}

// Refresh everything that uses the saved measurements.
function renderAll() {
  renderTable();
  renderCharts();
}

// Show a brief confirmation message.
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

// Download profile and measurements as a portable JSON backup file.
function exportData() {
  const profile = JSON.parse(localStorage.getItem(STORAGE.profile) || "null");
  const backup = {
    app: "Plantastic Data",
    exportedAt: new Date().toISOString(),
    profile,
    measurements
  };
  const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "plantastic-data.json";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("JSON backup downloaded.");
}

// Restore profile and measurements from a valid JSON backup.
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      if (!Array.isArray(backup.measurements)) throw new Error("Invalid backup");
      measurements = migrateMeasurements(backup.measurements);
      localStorage.setItem(STORAGE.measurements, JSON.stringify(measurements));
      if (backup.profile) {
        localStorage.setItem(STORAGE.profile, JSON.stringify(backup.profile));
        loadProfile();
      }
      renderAll();
      showToast("JSON data restored.");
    } catch (error) {
      showToast("This is not a valid Plantastic Data file.");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

// Load shared records from GitHub Pages and combine them with local changes.
async function loadSharedData() {
  try {
    const response = await fetch(`${SHARED_DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const shared = await response.json();
    const sharedMeasurements = migrateMeasurements(Array.isArray(shared.measurements) ? shared.measurements : []);
    const localMeasurements = migrateMeasurements(
      JSON.parse(localStorage.getItem(STORAGE.measurements) || "[]")
    );
    const combined = new Map();
    [...sharedMeasurements, ...localMeasurements].forEach(record => {
      combined.set(`${record.day}-${record.group}-${record.container}`, record);
    });
    measurements = [...combined.values()];
    localStorage.setItem(STORAGE.measurements, JSON.stringify(measurements));

    if (!localStorage.getItem(STORAGE.profile) && shared.profile) {
      localStorage.setItem(STORAGE.profile, JSON.stringify(shared.profile));
      loadProfile();
    }
    renderAll();
    showToast("Shared data loaded.");
  } catch (error) {
    // The app still works with LocalStorage when the shared file is unavailable.
  }
}

// Photo paths stored in JSON are relative to the website; Base64 photos remain unchanged.
function photoSource(photo) {
  if (!photo) return "";
  if (photo.startsWith("data:") || /^https?:\/\//i.test(photo)) return photo;
  return new URL(photo.replace(/^\.\//, ""), document.baseURI).href;
}

initializeDays();
loadProfile();
renderAll();
loadSharedData();

document.getElementById("generalForm").addEventListener("submit", saveProfile);
document.getElementById("measurementForm").addEventListener("submit", saveMeasurement);
document.getElementById("photo").addEventListener("change", previewPhoto);
document.getElementById("recordsTable").addEventListener("click", deleteMeasurement);
document.getElementById("closePhotoDialog").addEventListener("click", () => document.getElementById("photoDialog").close());
document.getElementById("photoDialog").addEventListener("click", event => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
document.getElementById("exportData").addEventListener("click", exportData);
document.getElementById("importButton").addEventListener("click", () => document.getElementById("importData").click());
document.getElementById("importData").addEventListener("change", importData);
