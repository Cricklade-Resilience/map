////////////////////////////////////////
// 1. Map Initialization
////////////////////////////////////////
const map = L.map('map').setView([51.6409, -1.8577], 14);

const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & CartoDB', subdomains: 'abcd', maxZoom: 19
}).addTo(map);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© OpenStreetMap contributors'
});

const esriAerial = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri'
});

const baseMaps = {
  "Greyscale (Carto)": cartoLight,
  "OpenStreetMap": osm,
  "Aerial (Esri)": esriAerial
};

////////////////////////////////////////
// 2. Icon Definitions (Font Awesome divIcons)
////////////////////////////////////////
const faShopIcon = L.divIcon({ html: '<i class="fa-solid fa-shop" style="color: orange;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const WILD = L.divIcon({ html: '<i class="fa-solid fa-diamond" style="color: blue;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const shelter = L.divIcon({ html: '<i class="fa-solid fa-bed" style="color: green;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const storage = L.divIcon({ html: '<i class="fa-solid fa-boxes-packing" style="color: brown;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const medical = L.divIcon({ html: '<i class="fa-solid fa-house-medical" style="color: red;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const guage = L.divIcon({ html: '<i class="fa-solid fa-gauge" style="color: blue;"></i>', className: 'fa-icon', iconSize: [24, 24] });
const histflood = L.divIcon({ html: '<i class="fa-solid fa-star" style="color: blue;"></i>', className: 'fa-icon', iconSize: [24, 24] });

////////////////////////////////////////
// 3. WMS Layers (Flood Zones)
////////////////////////////////////////
const floodZone3WMS = L.tileLayer.wms("https://environment.data.gov.uk/spatialdata/flood-map-for-planning-rivers-and-sea-flood-zone-3/wms", {
  layers: "Flood_Map_for_Planning_Rivers_and_Sea_Flood_Zone_3",
  format: "image/png", transparent: true, opacity:0.5, attribution: "© Environment Agency"
});

const floodZone2WMS = L.tileLayer.wms("https://environment.data.gov.uk/spatialdata/flood-map-for-planning-rivers-and-sea-flood-zone-2/wms", {
  layers: "Flood_Map_for_Planning_Rivers_and_Sea_Flood_Zone_2",
  format: "image/png", transparent: true, opacity:0.5, attribution: "© Environment Agency"
});

////////////////////////////////////////
// 4. Utility Maps & Buffers
////////////////////////////////////////
const overlayBuffer = new Map();    // Temporary storage for loaded layers
const overlays = {};                // Final overlay layers for control
const loadPromises = [];            // Promises for loading GeoJSON files
const polygonLabels = new Map();    // Store polygon tooltips by layer name

////////////////////////////////////////
// 5. Feature Handler (Popups, Labels, Styles)
////////////////////////////////////////
function createOnEachFeature(name, icon, label) {
  return function(feature, layerInstance) {
    const props = feature.properties || {};
    const geometryType = feature.geometry.type;
    feature.properties.layerName = name;

    // Handle Point Features: popups & labels
    if (geometryType === "Point") {
      const nameProp = props.name || "No Name";
      const desc = props.description || "";
      const imgUrl = props.imageURL || "";
      const siteURL = props.siteURL || "";

      let popupContent = `<strong>${nameProp}</strong><br>${desc}`;
      if (imgUrl) popupContent += `<br><img src="${imgUrl}" class="popup-image">`;
      if (siteURL) popupContent += `<br><a href="${siteURL}" target="_blank">Visit Website</a>`;

      layerInstance.bindPopup(popupContent);

      // Bind label tooltip if requested
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

    // Handle Polygon/MultiPolygon Features: styles & labels
    if ((geometryType === "Polygon" || geometryType === "MultiPolygon") && label) {
      const labelText = (name === "Admin: Warden Zones") ? (props.id || "No ID") : (props.name || "No Name");
      const center = layerInstance.getBounds().getCenter();

      // Create permanent tooltip centered on polygon
      if (name === "Admin: Warden Zones" || name === "Feature: Evacuation Sites") {
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

    // Set polygon styles
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
    }
  };
}

////////////////////////////////////////
// 6. Load GeoJSON Layers
////////////////////////////////////////
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
    }).catch(err => console.error(`Error loading ${file}:`, err));

  loadPromises.push(p);
});

////////////////////////////////////////
// 7. Map Display Logic & Controls
////////////////////////////////////////
Promise.all(loadPromises).then(() => {
  // Add WMS flood zone overlays
  overlays["Flood: EA Flood Zone 3 (WMS)"] = floodZone3WMS;
  overlays["Flood: EA Flood Zone 2 (WMS)"] = floodZone2WMS;

  // Add GeoJSON overlays in preferred order
  const orderedNames = [
    "Feature: Medical", "Feature: Shelter", "Feature: Storage", "Feature: Supplies",
    "Feature: Evacuation Sites", "Flood: Water Guages", "Flood: Areas of Concern",
    "Flood: WILD Watercourse Issues", "Admin: Warden Zones", "Admin: Parish Boundary"
  ];

  orderedNames.forEach(name => {
    if (overlayBuffer.has(name)) overlays[name] = overlayBuffer.get(name);
  });

  // Add default layers (Warden Zones & Parish Boundary) with labels
  if (overlayBuffer.has("Admin: Warden Zones")) {
    const wardenZonesLayer = overlayBuffer.get("Admin: Warden Zones");
    wardenZonesLayer.addTo(map);
    wardenZonesLayer.eachLayer(l => {
      l.setStyle({ color: "#444", weight: 2, fillOpacity: 0.1 });
      const tooltip = l._tooltipRef;
      if (tooltip) map.addLayer(tooltip);
    });
  }

  if (overlayBuffer.has("Admin: Parish Boundary")) {
    const parishLayer = overlayBuffer.get("Admin: Parish Boundary");
    parishLayer.addTo(map);
    parishLayer.eachLayer(l => {
      l.setStyle({ color: "black", weight: 3, fillOpacity: 0 });
    });
  }

  // Tooltip visibility & polygon weight changes based on zoom level
  map.on('zoomend', () => {
    const zoom = map.getZoom();

    // Show polygon labels only if zoomed in enough
    polygonLabels.forEach((tooltips, name) => {
      tooltips.forEach(t => {
        if (zoom > 14) {
          if (!map.hasLayer(t)) map.addLayer(t);
        } else {
          if (map.hasLayer(t)) map.removeLayer(t);
        }
      });
    });

    // Adjust polygon styles by zoom
    if (overlayBuffer.has("Admin: Warden Zones")) {
      overlayBuffer.get("Admin: Warden Zones").eachLayer(l => {
        l.setStyle({ weight: zoom > 14 ? 3 : 1 });
      });
    }
    if (overlayBuffer.has("Admin: Parish Boundary")) {
      overlayBuffer.get("Admin: Parish Boundary").eachLayer(l => {
        l.setStyle({ weight: zoom > 14 ? 4 : 2 });
      });
    }
  });

  // Add overlay controls to map
  L.control.layers(baseMaps, overlays).addTo(map);
});

////////////////////////////////////////
// 8. Overlay Events (Label Toggling)
////////////////////////////////////////
map.on('overlayadd', e => {
  const layerName = e.name || e.layer?.options?.name;
  if (layerName && polygonLabels.has(layerName)) {
    polygonLabels.get(layerName).forEach(t => map.addLayer(t));
  }
});

map.on('overlayremove', e => {
  const layerName = e.name || e.layer?.options?.name;
  if (layerName && polygonLabels.has(layerName)) {
    polygonLabels.get(layerName).forEach(t => map.removeLayer(t));
  }
});

////////////////////////////////////////
// 9. Locate Button Functionality
////////////////////////////////////////
let locationMarker, locationCircle;
function onLocationFound(e) {
  if (locationMarker) {
    locationMarker.setLatLng(e.latlng);
    locationCircle.setLatLng(e.latlng).setRadius(e.accuracy);
  } else {
    locationMarker = L.marker(e.latlng).addTo(map).bindPopup("You are here").openPopup();
    locationCircle = L.circle(e.latlng, e.accuracy).addTo(map);
  }
  map.setView(e.latlng, 15);
}

function onLocationError(e) {
  alert(e.message);
}

const locateControl = L.control({ position: 'topleft' });
locateControl.onAdd = function() {
  const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
  div.innerHTML = '<i class="fa-solid fa-location-crosshairs" title="Locate Me"></i>';
  div.style.cursor = 'pointer';
  div.style.width = '34px';
  div.style.height = '34px';

  div.onclick = () => map.locate({ setView: true, maxZoom: 16 });

  return div;
};
locateControl.addTo(map);

map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);

////////////////////////////////////////
// 10. Info Button Control
////////////////////////////////////////
const infoButton = document.getElementById('infoButton');
const infoBox = document.getElementById('infoBox');

infoButton.addEventListener('click', () => {
  if (infoBox.style.display === 'none' || infoBox.style.display === '') {
    infoBox.style.display = 'block';
  } else {
    infoBox.style.display = 'none';
  }
});

function closeInfoBox() {
  infoBox.style.display = 'none';
}
