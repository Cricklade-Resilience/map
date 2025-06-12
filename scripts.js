// Initialize map centered on Cricklade
const map = L.map('map').setView([51.6409, -1.8577], 14);

// Define base map layers
const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & CartoDB', subdomains: 'abcd', maxZoom: 19
}).addTo(map);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© OpenStreetMap contributors'
});

const esriAerial = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri'
});

// Group base layers for toggle control
const baseMaps = {
  "Greyscale (Carto)": cartoLight,
  "OpenStreetMap": osm,
  "Aerial (Esri)": esriAerial
};

// WMS flood zones from Environment Agency
const floodZone3WMS = L.tileLayer.wms("https://environment.data.gov.uk/spatialdata/flood-map-for-planning-rivers-and-sea-flood-zone-3/wms", {
  layers: "Flood_Map_for_Planning_Rivers_and_Sea_Flood_Zone_3",
  format: "image/png", transparent: true, opacity: 0.5, attribution: "© Environment Agency"
});

const floodZone2WMS = L.tileLayer.wms("https://environment.data.gov.uk/spatialdata/flood-map-for-planning-rivers-and-sea-flood-zone-2/wms", {
  layers: "Flood_Map_for_Planning_Rivers_and_Sea_Flood_Zone_2",
  format: "image/png", transparent: true, opacity: 0.5, attribution: "© Environment Agency"
});

// Font Awesome icons for different features
const faShopIcon = L.divIcon({ html: '<i class="fa-solid fa-shop" style="color: orange;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const WILD = L.divIcon({ html: '<i class="fa-solid fa-diamond" style="color: blue;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const shelter = L.divIcon({ html: '<i class="fa-solid fa-bed" style="color: green;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const storage = L.divIcon({ html: '<i class="fa-solid fa-boxes-packing" style="color: brown;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const medical = L.divIcon({ html: '<i class="fa-solid fa-house-medical" style="color: red;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const guage = L.divIcon({ html: '<i class="fa-solid fa-gauge" style="color: blue;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const histflood = L.divIcon({ html: '<i class="fa-solid fa-star" style="color: blue;"></i>', className: 'fa-icon', iconSize: [24, 24] });

// Data structures to track loaded layers and tooltips
const overlayBuffer = new Map();
const overlays = {};
const loadPromises = [];
const polygonLabels = new Map();

/**
 * Handler to customize how each feature behaves on the map
 */
function createOnEachFeature(name, icon, label) {
  return function (feature, layerInstance) {
    const props = feature.properties || {};
    const geometryType = feature.geometry.type;
    feature.properties.layerName = name;

    // --- Point Features ---
    if (geometryType === "Point") {
      const nameProp = props.name || "No Name";
      const desc = props.description || "";
      const imgUrl = props.imageURL || "";
      const siteURL = props.siteURL || "";

      let popupContent = `<strong>${nameProp}</strong><br>${desc}`;
      if (imgUrl) popupContent += `<br><img src="${imgUrl}" class="popup-image">`;
      if (siteURL) popupContent += `<br><a href="${siteURL}" target="_blank">Visit Website</a>`;

      layerInstance.bindPopup(popupContent);

      if (label && icon) {
        const labelColor = icon.options.html.match(/color:\s*(\w+)/i)?.[1] || "black";
        layerInstance.bindTooltip(nameProp, {
          permanent: true,
          direction: "top",
          offset: [0, -20],
          className: `point-label-${labelColor}`
        });
        layerInstance._tooltipRef = layerInstance.getTooltip();
      }
    }

    // --- Polygon Features ---
    if (geometryType.includes("Polygon")) {
      let style = { color: "#666", weight: 2, fillOpacity: 0.2 };

      if (name === "Admin: Warden Zones") {
        style = { color: "#444", weight: 2, fillOpacity: 0.1 };
      } else if (name === "Admin: Parish Boundary") {
        style = { color: "black", weight: 3, fillOpacity: 0 };
      } else if (name === "Feature: Evacuation Sites") {
        style = { color: "red", weight: 2, fillOpacity: 0.1 };
      }

      layerInstance.setStyle(style);

      if (label) {
        const labelText = name === "Admin: Warden Zones" ? (props.id || "No ID") : (props.name || "No Name");
        const center = layerInstance.getBounds().getCenter();
        const tooltip = L.tooltip({
          permanent: true,
          direction: 'center',
          className: 'polygon-label',
          offset: [0, 0]
        }).setContent(labelText).setLatLng(center);

        if (!polygonLabels.has(name)) polygonLabels.set(name, []);
        polygonLabels.get(name).push(tooltip);
        layerInstance._tooltipRef = tooltip;
      }
    }
  };
}

// Layers to load dynamically from GeoJSON files
const layersToLoad = [
  { name: "Flood: WILD Watercourse Issues", file: "Data/Flood_WILD_Watercourse_Issues.geojson", icon: WILD, label: false },
  { name: "Feature: Medical", file: "Data/Features_Medical.geojson", icon: medical, label: true },
  { name: "Feature: Shelter", file: "Data/Features_Shelter.geojson", icon: shelter, label: true },
  { name: "Feature: Storage", file: "Data/Features_Storage.geojson", icon: storage, label: true },
  { name: "Feature: Supplies", file: "Data/Features_Supplies.geojson", icon: faShopIcon, label: true },
  { name: "Flood: Water Guages", file: "Data/Water_WaterGuages.geojson", icon: guage, label: true },
  { name: "Flood: Areas of Concern", file: "Data/Flood_HistAreas.geojson", icon: histflood, label: true },
  { name: "Admin: Warden Zones", file: "Data/CrickladeWardenZones.geojson", icon: null, label: true },
  { name: "Feature: Evacuation Sites", file: "Data/Features_EvacSites.geojson", icon: null, label: true },
  { name: "Admin: Parish Boundary", file: "Data/Admin_ParishBoundary.geojson", icon: null, label: false }
];

// Load each layer and store in buffer
layersToLoad.forEach(({ name, file, icon, label }) => {
  const layer = L.geoJSON(null, {
    pointToLayer: (f, latlng) => icon ? L.marker(latlng, { icon }) : L.marker(latlng),
    onEachFeature: createOnEachFeature(name, icon, label)
  });

  const p = fetch(file)
    .then(res => res.json())
    .then(data => {
      data.features.forEach(f => f.properties.layerName = name);
      layer.addData(data);

      if (name === "Admin: Warden Zones" && polygonLabels.has(name)) {
        polygonLabels.get(name).forEach(t => map.addLayer(t));
      }

      overlayBuffer.set(name, layer);
    })
    .catch(err => console.error(`Error loading ${file}:`, err));

  loadPromises.push(p);
});

// Once all layers are loaded
Promise.all(loadPromises).then(() => {
  overlays["Flood: EA Flood Zone 3 (WMS)"] = floodZone3WMS;
  overlays["Flood: EA Flood Zone 2 (WMS)"] = floodZone2WMS;

  const orderedNames = [
    "Feature: Medical", "Feature: Shelter", "Feature: Storage", "Feature: Supplies",
    "Feature: Evacuation Sites", "Flood: Water Guages", "Flood: Areas of Concern",
    "Flood: WILD Watercourse Issues", "Admin: Warden Zones", "Admin: Parish Boundary"
  ];

  orderedNames.forEach(name => {
    if (overlayBuffer.has(name)) overlays[name] = overlayBuffer.get(name);
  });

  // Add key layers by default
  if (overlayBuffer.has("Admin: Warden Zones")) {
    const layer = overlayBuffer.get("Admin: Warden Zones");
    layer.addTo(map);
    layer.eachLayer(l => {
      l.setStyle({ color: "#444", weight: 2, fillOpacity: 0.1 });
      if (l._tooltipRef) map.addLayer(l._tooltipRef);
    });
  }

  if (overlayBuffer.has("Admin: Parish Boundary")) {
    const layer = overlayBuffer.get("Admin: Parish Boundary");
    layer.addTo(map);
    layer.eachLayer(l => l.setStyle({ color: "black", weight: 3, fillOpacity: 0 }));
  }

  const labelVisibilityZoom = 15;

  function updateMapDisplay() {
    const zoom = map.getZoom();

    overlayBuffer.forEach(layer => {
      layer.eachLayer(l => {
        if (l._tooltipRef) {
          zoom >= labelVisibilityZoom ? l.openTooltip() : l.closeTooltip();
        }

        if (l.setStyle && l.feature?.geometry?.type?.includes("Polygon")) {
          const lname = l.feature.properties?.layerName;
          let weight = 2;
          if (lname === "Admin: Parish Boundary") weight = zoom >= 16 ? 5 : 4;
          else if (lname === "Admin: Warden Zones") weight = zoom >= 16 ? 3 : 2;
          l.setStyle({ weight });
        }
      });
    });
  }

  map.on("zoomend", updateMapDisplay);
  updateMapDisplay();

  L.control.layers(baseMaps, overlays, { collapsed: window.innerWidth <= 768 }).addTo(map);
});

// Handle overlay add/remove
map.on('overlayadd', e => {
  const layer = overlayBuffer.get(e.name);
  if (layer) {
    layer.eachLayer(l => {
      if (l._tooltipRef) map.addLayer(l._tooltipRef);
    });
  }
});

map.on('overlayremove', e => {
  const layer = overlayBuffer.get(e.name);
  if (layer) {
    layer.eachLayer(l => {
      if (l._tooltipRef) map.removeLayer(l._tooltipRef);
    });
  }
});

//////////////////////////////////////////////////////
// Geolocation Button – Shows User’s Location
//////////////////////////////////////////////////////
let watchId = null;
let userMarker = null;
let accuracyCircle = null;
let firstUpdate = true;

function locateUser() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    if (userMarker) map.removeLayer(userMarker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);
    userMarker = accuracyCircle = null;
    firstUpdate = true;
    return;
  }

  if (!navigator.geolocation) {
    alert("Geolocation not supported.");
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    pos => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      const heading = pos.coords.heading || 0;
      const accuracy = pos.coords.accuracy;

      const rotatedIcon = L.divIcon({
        html: `<i class="fa-solid fa-location-arrow" style="color: purple; transform: rotate(${heading}deg);"></i>`,
        className: 'fa-icon', iconSize: [24, 24]
      });

      if (!userMarker) {
        userMarker = L.marker(latlng, { icon: rotatedIcon }).addTo(map).bindPopup("You are here");
      } else {
        userMarker.setLatLng(latlng).setIcon(rotatedIcon);
      }

      if (!accuracyCircle) {
        accuracyCircle = L.circle(latlng, {
          radius: accuracy, color: 'blue', fillColor: '#1E90FF',
          fillOpacity: 0.2, weight: 1
        }).addTo(map);
      } else {
        accuracyCircle.setLatLng(latlng).setRadius(accuracy);
      }

      if (firstUpdate) {
        map.setView(latlng, 15);
        firstUpdate = false;
      }
    },
    err => alert("Unable to retrieve your location."),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );
}

//////////////////////////////////////////////////////
// Info Button – Opens Info Box
//////////////////////////////////////////////////////
L.Control.InfoButton = L.Control.extend({
  onAdd: function () {
    const container = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom info-button');
    container.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
    container.title = 'Information';
    L.DomEvent.disableClickPropagation(container);
    container.onclick = () => document.getElementById('infoBox').style.display = 'block';
    return container;
  },
  onRemove: function () {}
});

// Close info box handler
function closeInfoBox() {
  document.getElementById('infoBox').style.display = 'none';
}

// Add info button to map
new L.Control.InfoButton({ position: 'bottomleft' }).addTo(map);
