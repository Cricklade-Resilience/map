////////////////////////////////////////
// Custom Legend Control
// Drop this file in your project and add
// <script src="legend-control.js"></script>
// AFTER your Leaflet script tags.
//
// Then call addLegend(map) once your map
// and layers are set up (e.g. inside the
// Promise.all().then() block).
////////////////////////////////////////

function addLegend(map) {

  // ── 1. Define your legend entries ──────────────────────────────────────
  // Adjust colours and labels to match your actual layer icons/styles.
  //
  // type: 'dot'    → coloured circle  (point/marker layers)
  // type: 'swatch' → coloured rectangle (polygon/WMS layers)
  //
  // For 'dot' entries, 'color' should match the FA icon color used in your
  // divIcon definitions at the top of index.html.
  //
  // For 'swatch' entries:
  //   color       = fill colour
  //   borderColor = stroke/outline colour (optional, defaults to color)
  //   dashed      = true for dashed border (e.g. parish boundary)

  const sections = [
    {
      title: 'Flood layers',
      items: [
        { type: 'swatch', color: 'rgba(74,158,221,0.45)',  borderColor: 'rgba(74,158,221,0.9)',  label: 'Flood zones (rivers & sea)' },
        { type: 'swatch', color: 'rgba(232,93,38,0.35)',   borderColor: 'rgba(232,93,38,0.8)',   label: 'Surface water risk' },
      ]
    },
    {
      title: 'Admin',
      items: [
        { type: 'swatch', color: 'rgba(26,35,50,0.08)', borderColor: 'rgba(26,35,50,0.55)', dashed: true, label: 'Parish boundary' },
        { type: 'swatch', color: 'rgba(68,68,68,0.08)', borderColor: 'rgba(68,68,68,0.45)', dashed: true, label: 'Volunteer zones' },
      ]
    },
    {
      title: 'Community resources',
      items: [
        { type: 'dot', color: 'orange',  icon: 'fa-shop',                  label: 'Shop / supplies' },
        { type: 'dot', color: 'green',   icon: 'fa-bed',                   label: 'Emergency shelter' },
        { type: 'dot', color: 'brown',   icon: 'fa-boxes-packing',         label: 'Storage' },
        { type: 'dot', color: 'red',     icon: 'fa-house-medical',         label: 'Medical / first aid' },
        { type: 'dot', color: 'red',     icon: 'fa-heart-pulse',           label: 'Defibrillator' },
        { type: 'dot', color: 'grey',    icon: 'fa-flag',                  label: 'Asset' },
        { type: 'dot', color: 'green',   icon: 'fa-magnifying-glass-location', label: 'Inspection feature' },
      ]
    },
    {
      title: 'Monitoring & history',
      items: [
        { type: 'dot', color: 'blue',  icon: 'fa-gauge',          label: 'Water gauge' },
        { type: 'dot', color: 'blue',  icon: 'fa-star',           label: 'Historical flood' },
        { type: 'dot', color: 'blue',  icon: 'fa-diamond',        label: 'WILD network point' },
        { type: 'dot', color: 'black', icon: 'fa-calendar-days',  label: 'Historical event' },
      ]
    },
  ];

  // ── 2. Build the control ───────────────────────────────────────────────

  const LegendControl = L.Control.extend({
    options: { position: 'bottomright' },

    onAdd: function () {
      const container = L.DomUtil.create('div', 'legend-control leaflet-control');

      // Stop map interactions when hovering the panel
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      // Header
      const header = L.DomUtil.create('div', 'legend-control-header', container);
      const headerText = L.DomUtil.create('span', '', header);
      headerText.textContent = 'Legend';
      const chevron = L.DomUtil.create('span', 'legend-control-chevron open', header);
      chevron.textContent = '▲';

      // Body
      const body = L.DomUtil.create('div', 'legend-control-body', container);

      // Render sections
      sections.forEach((section, si) => {
        if (si > 0) {
          L.DomUtil.create('div', 'legend-divider', body);
        }

        const title = L.DomUtil.create('div', 'legend-section-title', body);
        title.textContent = section.title;

        section.items.forEach(item => {
          const row = L.DomUtil.create('div', 'legend-row', body);

          if (item.type === 'dot') {
            // Coloured circle with a tiny FA icon inside
            const dot = L.DomUtil.create('div', 'legend-dot', row);
            dot.style.background = item.color;
            dot.innerHTML = `<i class="fa-solid ${item.icon}" style="font-size:7px;color:white;"></i>`;
          } else {
            // Colour swatch for polygon / WMS layers
            const swatch = L.DomUtil.create('div', 'legend-swatch', row);
            swatch.style.background = item.color;
            const bc = item.borderColor || item.color;
            swatch.style.border = item.dashed
              ? `1.5px dashed ${bc}`
              : `1.5px solid ${bc}`;
          }

          const label = L.DomUtil.create('span', 'legend-row-label', row);
          label.textContent = item.label;
        });
      });

      // Toggle collapse on header click
      let isOpen = true;
      header.addEventListener('click', () => {
        isOpen = !isOpen;
        body.style.display = isOpen ? 'flex' : 'none';
        chevron.textContent = isOpen ? '▲' : '▼';
        chevron.classList.toggle('open', isOpen);
      });

      return container;
    }
  });

  new LegendControl().addTo(map);
}
