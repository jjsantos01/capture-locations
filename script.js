let coordinates = [];
let categories = [];
let map;
let markers = [];
let heatLayer;
let heatmapVisible = false;
let currentCategory;
let currentPosition;

const downloadBtn = document.getElementById('downloadBtn');
const downloadGeoJSONBtn = document.getElementById('downloadGeoJSONBtn');
const uploadFile = document.getElementById('uploadFile');
const createCategoryBtn = document.getElementById('createCategoryBtn');
const categoryButtons = document.getElementById('categoryButtons');
const categoryButtonsEdit = document.getElementById('categoryButtonsEdit');
const sidepanel = document.getElementById('sidepanel');
const closeSidepanel = document.getElementById('closeSidepanel');
const closeSidepanelEditCategorySpan = document.getElementById('closeSidepanelEditCategory');
const saveDescriptionBtn = document.getElementById('saveDescription');
const cancelDescriptionBtn = document.getElementById('cancelDescription');
const clearLocalStorageBtn = document.getElementById('clearLocalStorageBtn');
const sidepanelEditCategory = document.getElementById('sidepanelEditCategory');

uploadFile.addEventListener('change', (event) => {
  const file = event.target.files[0];
  confirmLoadCSV(file);
}
);
createCategoryBtn.addEventListener('click', createCategory);
closeSidepanel.addEventListener('click', closeSidepanelHandler);
closeSidepanelEditCategorySpan.addEventListener('click', closeSidepanelEditCategory);
saveDescriptionBtn.addEventListener('click', saveDescription);
cancelDescriptionBtn.addEventListener('click', closeSidepanelHandler);
document.addEventListener('DOMContentLoaded', () => {
  loadCoordinatesFromLocalStorage();
});
downloadBtn.addEventListener('click', downloadCSV);
downloadGeoJSONBtn.addEventListener('click', downloadGeoJSON);
clearLocalStorageBtn.addEventListener('click', confirmClearLocalStorage);

// Inicializar el mapa
map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);
map.on('click', handleMapClick);

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
    const inputColor = document.getElementById('categoryColor')
    const color = inputColor.value.trim();
    const name = document.getElementById('categoryName').value.trim();

    if (name) {
        const category = { name, color };
        categories.push(category);
        createCategoryButton(category);
        document.getElementById('categoryName').value = '';
        updateLegend();
        updateCategorySelect();
        inputColor.value = generateRandomColor();
    } else {
        alert("Por favor, introduce un nombre para la categoría.");
    }
}

function generateRandomColor() {
    return '#' + Math.floor(Math.random()*16777215).toString(16);
}

function createCategoryButton(category) {
    const button = document.createElement('button');
    button.textContent = category.name;
    button.style.backgroundColor = category.color;
    button.style.color = getContrastColor(category.color);
    button.addEventListener('click', () => startCaptureLocation(category));
    categoryButtons.appendChild(button);

    const editButton = document.createElement('button');
    editButton.textContent = `${category.name}✏️`;
    editButton.style.backgroundColor = category.color;
    editButton.style.color = getContrastColor(category.color);
    editButton.addEventListener('click', () => editCategory(category.name));
    categoryButtonsEdit.appendChild(editButton);


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

function openSidepanelEditCategory() {
  sidepanelEditCategory.classList.add('open');
  document.querySelector('.main-container').style.marginRight = '300px';
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

function closeSidepanelEditCategory() {
  sidepanelEditCategory.classList.remove('open');
  document.querySelector('.main-container').style.marginRight = '0';
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
  saveCoordinatesToLocalStorage();
  updateCoordsList();
  updateHeatmap();
  closeSidepanelHandler();
}

function saveCoordinatesToLocalStorage() {
  localStorage.setItem('coordinates', JSON.stringify(coordinates));
}

function loadCoordinatesFromLocalStorage() {
  const savedCoordinates = localStorage.getItem('coordinates');
  if (savedCoordinates) {
      coordinates = JSON.parse(savedCoordinates);
      updatePageContent()
  }
}

function clearLocalStorage() {
  localStorage.removeItem('coordinates');
  coordinates = [];
  categories = [];
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  updateCoordsList();
  updateHeatmap();
  updateLegend();
  document.getElementById('categoryButtons').innerHTML = '';
  document.getElementById('categoryButtonsEdit').innerHTML = '';
}

function confirmClearLocalStorage() {
  // Verificar si hay datos guardados
  const savedCoordinates = localStorage.getItem('coordinates');

  if (savedCoordinates && JSON.parse(savedCoordinates).length > 0) {
    // Si hay datos, mostrar el mensaje de confirmación
    if (confirm("Borrará todos los datos actuales, ¿está seguro que desea continuar?")) {
      clearLocalStorage();
    }
    // Si el usuario cancela, no hacer nada
  } else {
    // Si no hay datos, simplemente limpiar
    clearLocalStorage();
  }
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

    marker.bindTooltip(`Fecha: ${formatDate(coord.timestamp)}<br><span style="color: ${coord.color}">Categoría: ${coord.category}</span><br>Descripción: ${coord.description}`);
    markers.push(marker);
    map.setView([coord.latitude, coord.longitude], 13);
}

function updateMarker(index) {
  const coord = coordinates[index];
  const marker = markers[index];
  marker.setTooltipContent(`Fecha: ${formatDate(coord.timestamp)}<br><span style="color: ${coord.color}">Categoría: ${coord.category}</span><br>Descripción: ${coord.description}`);
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

function downloadGeoJSON() {
    if (coordinates.length === 0) {
        alert("No hay coordenadas para descargar.");
        return;
    }
    coordinates.forEach((coord, index) => {
        coord.id = index;
    } );
    const geojson = {
        type: 'FeatureCollection',
        features: coordinates.map(coord => {
            return {
                type: 'Feature',
                properties: {
                    category: coord.category,
                    description: coord.description,
                    timestamp: coord.timestamp
                },
                geometry: {
                    type: 'Point',
                    coordinates: [coord.longitude, coord.latitude]
                }
            };
        })
    };
    const blob = new Blob([JSON.stringify(geojson)], { type: 'application/json' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "coordenadas.geojson");
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
            saveCoordinatesToLocalStorage();
            updatePageContent()
        }
    });
}

function confirmLoadCSV(file) {
  const savedCoordinates = localStorage.getItem('coordinates');
  if (savedCoordinates && JSON.parse(savedCoordinates).length > 0) {
    if (confirm("Borrará los datos existente, ¿está seguro que desea continuar?")) {
      clearLocalStorage();
      loadCSV(file);
    }
  } else {
    loadCSV(file);
  }
}

function updatePageContent() {
  markers.forEach(marker => map.removeLayer(marker));
  coordinates.forEach(coord => addMarkerToMap(coord));
  categories = [...new Set(coordinates.map(coord => `${coord.category}+${coord.color}`))].map(category => {
      return {
          name: category.split('+')[0],
          color: category.split('+')[1],
      };
  });
  updateCategorySelect();
  updateLegend();
  updateCoordsList();
  updateHeatmap();
  categoryButtons.innerHTML = ''
  categoryButtonsEdit.innerHTML = ''
  categories.forEach(category => {
    createCategoryButton(category);
  } );
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
                <button class="row-btn edit-btn" data-index="${index}">✏️</button>
                <button class="row-btn delete-btn" data-index="${index}">×</button>
            </td>
        `;
    });
    list.appendChild(table);

    // Añadir event listeners a los botones de edición y eliminación
    const editButtons = document.querySelectorAll('.row-btn.edit-btn');
    const deleteButtons = document.querySelectorAll('.row-btn.delete-btn');
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
  if (confirm("¿Estás seguro que deseas eliminar este registro?")) {
    const index = parseInt(event.target.getAttribute('data-index'));
    map.removeLayer(markers[index]);
    markers.splice(index, 1);
    coordinates.splice(index, 1);
    saveCoordinatesToLocalStorage();
    updatePageContent();
  }
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

function editCategory(categoryName) {
  const category = categories.find(cat => cat.name === categoryName);

  const categoryInput = document.getElementById('editCategoryName');
  categoryInput.value = category.name;

  const colorInput = document.getElementById('editCategoryColor');
  colorInput.value = category.color;

  const saveButton = document.getElementById('saveCategoryEdit');

  saveButton.addEventListener('click', () => {
    const newName = document.getElementById('editCategoryName').value;
    const newColor = document.getElementById('editCategoryColor').value;
    updateCategory(category.name, newName, newColor);
    closeSidepanelEditCategory();
  });

  const cancelButton = document.getElementById('cancelCategoryEdit');
  cancelButton.addEventListener('click', closeSidepanelEditCategory);

  const deleteButton = document.getElementById('deleteCategory');
  deleteButton.addEventListener('click', () => {
    if (confirm(`¿Estás seguro que deseas eliminar la categoría ${category.name}?`)) {
      coordinates = coordinates.filter(coord => coord.category !== category.name);
      saveCoordinatesToLocalStorage();
      updateCategories();
      closeSidepanelEditCategory();
    }
  });

  openSidepanelEditCategory();
}

function updateCategories() {
  categories = coordinates.map(coord => `${coord.category}+${coord.color}`).map(category => {
    return {
      name: category.split('+')[0],
      color: category.split('+')[1],
    };
  }
  )
  updatePageContent();
}

function updateCategory(oldName, newName, newColor) {
  coordinates.forEach(coord => {
    if (coord.category === oldName) {
      coord.category = newName;
      coord.color = newColor;
    }
  });
  saveCoordinatesToLocalStorage();
  updateCategories()
}

function handleMapClick(e) {
  // Capturar las coordenadas del clic
  currentPosition = {
    coords: {
      latitude: e.latlng.lat,
      longitude: e.latlng.lng
    }
  };
  openSidepanel();
}
