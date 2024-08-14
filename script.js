let coordinates = [];
let categories = [];
let map;
let markers = [];
let heatLayer;
let heatmapVisible = false;
let currentCategory;
let currentPosition;

const downloadBtn = document.getElementById('downloadBtn');
const uploadFile = document.getElementById('uploadFile');
const createCategoryBtn = document.getElementById('createCategoryBtn');
const categoryButtons = document.getElementById('categoryButtons');
const sidepanel = document.getElementById('sidepanel');
const closeSidepanel = document.getElementById('closeSidepanel');
const saveDescriptionBtn = document.getElementById('saveDescription');
const cancelDescriptionBtn = document.getElementById('cancelDescription');

downloadBtn.addEventListener('click', downloadCSV);
uploadFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    loadCSV(file);
}
);

createCategoryBtn.addEventListener('click', createCategory);
closeSidepanel.addEventListener('click', closeSidepanelHandler);
saveDescriptionBtn.addEventListener('click', saveDescription);
cancelDescriptionBtn.addEventListener('click', closeSidepanelHandler);

// Inicializar el mapa
map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Añadir leyenda
let legend = L.control({position: 'bottomright'});
legend.onAdd = function (map) {
    let div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = '<h4>Leyenda</h4>';
    return div;
};
legend.addTo(map);

// Añadir control de mapa de calor
let heatmapControl = L.control({position: 'topright'});
heatmapControl.onAdd = function (map) {
    let div = L.DomUtil.create('div', 'leaflet-control-heatmap');
    div.innerHTML = '<button onclick="toggleHeatmap()">Mapa de Calor</button>';
    return div;
};
heatmapControl.addTo(map);

function createCategory() {
    const color = document.getElementById('categoryColor').value;
    const name = document.getElementById('categoryName').value.trim();

    if (name) {
        const category = { name, color };
        categories.push(category);
        createCategoryButton(category);
        document.getElementById('categoryName').value = '';
        updateLegend();
        updateCategorySelect();
    } else {
        alert("Por favor, introduce un nombre para la categoría.");
    }
}

function createCategoryButton(category) {
    const button = document.createElement('button');
    button.textContent = category.name;
    button.style.backgroundColor = category.color;
    button.style.color = getContrastColor(category.color);
    button.addEventListener('click', () => startCaptureLocation(category));
    categoryButtons.appendChild(button);
}

function startCaptureLocation(category) {
    currentCategory = category;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentPosition = position;
                openSidepanel();
            },
            (error) => {
                console.error("Error al obtener la ubicación:", error);
                alert("Error al obtener la ubicación. Por favor, intenta de nuevo y asegúrate de dar permiso en el diálogo del navegador.");
            },
            { enableHighAccuracy: true }
        );
    } else {
        alert("Tu navegador no soporta geolocalización.");
    }
}

function openSidepanel() {
  sidepanel.classList.add('open');
  document.querySelector('.main-container').style.marginRight = '300px';

  if (editingIndex === -1) {
      document.querySelector('#sidepanel h2').textContent = 'Añadir registro';
      document.getElementById('sidepanelDescription').value = '';
      updateCategorySelect();
      document.getElementById('categorySelect').value = currentCategory ? currentCategory.name : '';
  }
}

function closeSidepanelHandler() {
  sidepanel.classList.remove('open');
  document.querySelector('.main-container').style.marginRight = '0';
  currentCategory = null;
  currentPosition = null;
  editingIndex = -1;

  document.getElementById('saveDescription').textContent = 'Guardar';
  document.getElementById('cancelDescription').textContent = 'Cancelar';
  document.querySelector('#sidepanel h2').textContent = 'Añadir registro';
}

function saveDescription() {
  const description = document.getElementById('sidepanelDescription').value.trim();
  const categoryName = document.getElementById('categorySelect').value;
  const category = categories.find(cat => cat.name === categoryName);

  if (editingIndex !== -1) {
      // Editando un registro existente
      coordinates[editingIndex].description = description;
      coordinates[editingIndex].category = category.name;
      coordinates[editingIndex].color = category.color;
      coordinates[editingIndex].timestamp = new Date().toISOString();

      updateMarker(editingIndex);
  } else if (currentPosition) {
      // Creando un nuevo registro
      const { latitude, longitude } = currentPosition.coords;
      const timestamp = new Date().toISOString();
      const newCoord = {
          latitude,
          longitude,
          timestamp,
          category: category.name,
          color: category.color,
          tipo: 'registro',
          description: description
      };
      coordinates.push(newCoord);
      addMarkerToMap(newCoord);
  }

  updateCoordsList();
  updateHeatmap();
  closeSidepanelHandler();
}

function addMarkerToMap(coord) {
    const marker = L.circleMarker([coord.latitude, coord.longitude], {
        radius: 8,
        fillColor: coord.color,
        color: '#000',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map);

    marker.bindTooltip(`${formatDate(coord.timestamp)}<br>${coord.description}`);
    markers.push(marker);
    map.setView([coord.latitude, coord.longitude], 13);
}

function updateMarker(index) {
  const coord = coordinates[index];
  const marker = markers[index];
  marker.setTooltipContent(`${formatDate(coord.timestamp)}<br>${coord.description}`);
}

function downloadCSV() {
    if (coordinates.length === 0) {
        alert("No hay coordenadas para descargar.");
        return;
    }

    const csv = Papa.unparse(coordinates);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "coordenadas.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function loadCSV(file) {
    Papa.parse(file, {
        header: true,
        complete: (results) => {
            coordinates = results.data;
            coordinates.forEach(coord => {
                coord.latitude = parseFloat(coord.latitude);
                coord.longitude = parseFloat(coord.longitude);
            });
            coordinates.forEach(addMarkerToMap);
            categories = [...new Set(coordinates.map(coord => coord.category))].map(name => {
                return {
                    name,
                    color: '#' + Math.floor(Math.random()*16777215).toString(16)
                };
            }
            );
            updateCategorySelect();
            updateLegend();
            updateCoordsList();
            updateHeatmap();
            categories.forEach(createCategoryButton);
        }
    });
}

function updateCategorySelect() {
  const select = document.getElementById('categorySelect');
  select.innerHTML = '';
  categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.name;
      option.textContent = category.name;
      option.style.color = category.color;
      select.appendChild(option);
  });
}

let editingIndex = -1;

function updateCoordsList() {
    const list = document.getElementById('coordsList');
    list.innerHTML = '<h3>Coordenadas capturadas:</h3>';
    const table = document.createElement('table');
    table.id = 'coordsTable';
    table.innerHTML = `
        <tr>
            <th>Categoría</th>
            <th>Latitud</th>
            <th>Longitud</th>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Descripción</th>
            <th>Acciones</th>
        </tr>
    `;
    coordinates.forEach((coord, index) => {
        const row = table.insertRow();
        row.innerHTML = `
            <td style="color: ${coord.color};">${coord.category}</td>
            <td>${coord.latitude.toFixed(7)}</td>
            <td>${coord.longitude.toFixed(7)}</td>
            <td>${formatDate(coord.timestamp)}</td>
            <td>${coord.tipo}</td>
            <td>${coord.description}</td>
            <td>
                <button class="edit-btn" data-index="${index}">✏️</button>
                <button class="delete-btn" data-index="${index}">×</button>
            </td>
        `;
    });
    list.appendChild(table);

    // Añadir event listeners a los botones de edición y eliminación
    const editButtons = document.querySelectorAll('.edit-btn');
    const deleteButtons = document.querySelectorAll('.delete-btn');
    editButtons.forEach(button => {
        button.addEventListener('click', editCoordinate);
    });
    deleteButtons.forEach(button => {
        button.addEventListener('click', deleteCoordinate);
    });
}

function editCoordinate(event) {
  const index = parseInt(event.target.getAttribute('data-index'));
  editingIndex = index;
  const coord = coordinates[index];

  document.querySelector('#sidepanel h2').textContent = 'Editar registro';

  updateCategorySelect();
  document.getElementById('categorySelect').value = coord.category;
  document.getElementById('sidepanelDescription').value = coord.description;

  document.getElementById('saveDescription').textContent = 'Actualizar';
  document.getElementById('cancelDescription').textContent = 'Cancelar Edición';

  openSidepanel();
}

function deleteCoordinate(event) {
  const index = parseInt(event.target.getAttribute('data-index'));

  // Eliminar el marcador del mapa
  map.removeLayer(markers[index]);
  markers.splice(index, 1);

  // Eliminar la coordenada del array
  coordinates.splice(index, 1);

  // Actualizar la lista de coordenadas y el mapa de calor
  updateCoordsList();
  updateHeatmap();
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function getContrastColor(hexcolor) {
    if (hexcolor.slice(0, 1) === '#') {
        hexcolor = hexcolor.slice(1);
    }
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
}

function updateLegend() {
    let legendContent = '<h4>Leyenda</h4>';
    categories.forEach(category => {
        legendContent += `<i style="background:${category.color}"></i> ${category.name}<br>`;
    });
    document.querySelector('.legend').innerHTML = legendContent;
}

function updateHeatmap() {
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }
    let heatData = coordinates.map(coord => [coord.latitude, coord.longitude, 1]);
    heatLayer = L.heatLayer(heatData, {radius: 25});
    if (heatmapVisible) {
        heatLayer.addTo(map);
    }
}

function toggleHeatmap() {
    heatmapVisible = !heatmapVisible;
    if (heatmapVisible) {
        heatLayer.addTo(map);
        document.querySelector('.leaflet-control-heatmap button').textContent = "Ocultar Mapa de Calor";
    } else {
        map.removeLayer(heatLayer);
        document.querySelector('.leaflet-control-heatmap button').textContent = "Mostrar Mapa de Calor";
    }
}

document.addEventListener('DOMContentLoaded', updateCategorySelect);
