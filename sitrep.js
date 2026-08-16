"use strict";

(() => {
  const BMKG_URL = "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json";
  const IMPACT_URL = "data/impact.json";
  const HEALTH_URL = "data/health.json";
  const SECTOR_IMPACT_URL = "data/sector-impact.json";
  const REPORTS_URL = "data/reports.json";
  const REFRESH_MS = 5 * 60 * 1000;

  const AFFECTED_AREA_LOCATIONS = [
    { key: "Sikka Regency", label: "Sikka", representative: "Maumere", lat: -8.6199, lng: 122.2111 },
    { key: "Ende Regency", label: "Ende", representative: "Ende", lat: -8.8432, lng: 121.6623 },
    { key: "East Manggarai Regency", label: "East Manggarai", representative: "Borong", lat: -8.8125, lng: 120.6092 },
    { key: "Nagekeo Regency", label: "Nagekeo", representative: "Mbay", lat: -8.5558, lng: 121.2711 },
    { key: "West Manggarai Regency", label: "West Manggarai", representative: "Labuan Bajo", lat: -8.4964, lng: 119.8877 },
    { key: "Manggarai Regency", label: "Manggarai", representative: "Ruteng", lat: -8.6114, lng: 120.4644 },
    { key: "Ngada Regency", label: "Ngada", representative: "Bajawa", lat: -8.7848, lng: 120.9744 },
    { key: "East Flores Regency", label: "East Flores", representative: "Larantuka", lat: -8.3436, lng: 122.9883 }
  ];

  const byId = (id) => document.getElementById(id);

  const setText = (id, value) => {
    const element = byId(id);
    if (element && value !== undefined && value !== null) {
      element.textContent = value;
    }
  };

  const formatNumber = (value) =>
    Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-US") : "—";

  const fetchJson = async (url) => {
    const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} request failed: ${response.status}`);
    return response.json();
  };

  const isFloresRegion = (quake) => {
    const coordinates = String(quake.Coordinates || "")
      .split(",")
      .map(Number);
    const [latitude, longitude] = coordinates;
    const insideRegionalBounds =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -11.5 &&
      latitude <= -6 &&
      longitude >= 118 &&
      longitude <= 125;

    const place = String(quake.Wilayah || "").toUpperCase();
    const hasRegionalName =
      /NTT|NAGEKEO|MBAY|RUTENG|MANGGARAI|LABUANBAJO|SIKKA|MAUMERE|ENDE|FLORES/.test(
        place
      );

    return insideRegionalBounds || hasRegionalName;
  };

  const formatRefreshTime = () =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date());

  const createRecentQuake = (quake) => {
    const row = document.createElement("div");
    row.className = "live-quake-row";

    const magnitude = document.createElement("strong");
    magnitude.textContent = `M${quake.Magnitude || "—"}`;

    const location = document.createElement("span");
    location.textContent = quake.Wilayah || "Location unavailable";

    const time = document.createElement("time");
    time.dateTime = quake.DateTime || "";
    time.textContent = `${quake.Tanggal || "—"} · ${quake.Jam || "—"}`;

    row.append(magnitude, location, time);
    return row;
  };

  const renderBmkgFeed = (quakes) => {
    const regionalQuakes = quakes.filter(isFloresRegion);
    const latest = regionalQuakes[0];

    if (!latest) {
      throw new Error("No recent Flores/NTT M5+ event found in the current BMKG list.");
    }

    setText("live-magnitude", `M${latest.Magnitude}`);
    setText("live-depth", latest.Kedalaman);
    setText("live-location", latest.Wilayah);
    setText("live-event-time", `${latest.Tanggal} · ${latest.Jam}`);
    setText("live-potential", latest.Potensi);
    setText("live-coordinates", latest.Coordinates);
    setText("feed-last-checked", `Last checked: ${formatRefreshTime()} WIB`);

    const status = byId("feed-status");
    if (status) {
      status.textContent = "BMKG feed connected";
      status.className = "feed-status is-live";
    }

    const recentList = byId("recent-quakes");
    if (recentList) {
      recentList.replaceChildren(
        ...regionalQuakes.slice(0, 5).map(createRecentQuake)
      );
    }
  };

  const loadBmkgFeed = async () => {
    try {
      const payload = await fetchJson(BMKG_URL);
      const quakes = payload?.Infogempa?.gempa;
      if (!Array.isArray(quakes)) throw new Error("Unexpected BMKG data format.");
      renderBmkgFeed(quakes);
    } catch (error) {
      console.error(error);
      const status = byId("feed-status");
      if (status) {
        status.textContent = "Live feed temporarily unavailable — fallback values shown";
        status.className = "feed-status is-warning";
      }
      setText("feed-last-checked", `Last attempt: ${formatRefreshTime()} WIB`);
    }
  };

  const renderList = (id, items) => {
    const list = byId(id);
    if (!list || !Array.isArray(items)) return;
    list.replaceChildren(
      ...items.map((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        return li;
      })
    );
  };

  const loadImpactData = async () => {
    try {
      const data = await fetchJson(IMPACT_URL);
      setText(
        "impact-casualties",
        `${data.casualties?.deaths ?? "—"} | ${data.casualties?.injured ?? "—"}`
      );
      setText("impact-cutoff", `Impact update: ${data.updated_display}`);
      setText("impact-validation-status", data.status_label);
      setText("impact-validation-time", `Cut-off: ${data.updated_display}`);
      const displacement = data.displacement || {};
      setText(
        "impact-displacement",
        displacement.status || formatNumber(displacement.self_evacuated_approx)
      );

      renderList("impact-confirmed-list", data.confirmed);
      renderList("impact-damage-list", data.damage_reports);
      renderList("impact-gaps-list", data.information_gaps);

      const sourceLink = byId("impact-source-link");
      if (sourceLink && data.source?.url) {
        sourceLink.href = data.source.url;
        sourceLink.textContent = data.source.agency || "Official source";
      }

      const seismic = data.seismic_monitoring || {};
      if (seismic.aftershocks_recorded !== undefined) {
        setText("hero-aftershocks", formatNumber(seismic.aftershocks_recorded));
        setText("aftershock-total", formatNumber(seismic.aftershocks_recorded));
      }
      if (seismic.data_cutoff_display) {
        setText("hero-aftershocks-label", `Aftershocks by ${seismic.data_cutoff_display.split("·")[0].trim()}`);
        setText("aftershock-window", `events by ${seismic.data_cutoff_display}`);
      }
      const range = seismic.magnitude_range || {};
      if (range.minimum !== undefined && range.maximum !== undefined) {
        const extra = [];
        if (seismic.aftershocks_above_m5 !== undefined) extra.push(`${seismic.aftershocks_above_m5} above M5`);
        if (seismic.aftershocks_felt_by_residents !== undefined) extra.push(`${seismic.aftershocks_felt_by_residents} felt`);
        const extraText = extra.length ? `; ${extra.join("; ")}` : "";
        setText(
          "aftershock-range",
          `M${range.minimum}\u2013M${range.maximum}${extraText}; ${seismic.trend_note || "sequence ongoing"}`
        );
      }

      const emergencyStatus = data.emergency_status;
      const emergencyList = byId("emergency-status-list");
      if (emergencyStatus && emergencyList) {
        const rows = [];
        if (emergencyStatus.provincial) {
          rows.push([emergencyStatus.provincial.region, `${emergencyStatus.provincial.status}${emergencyStatus.provincial.planned_duration_days ? ` — ${emergencyStatus.provincial.planned_duration_days} days` : ""}`]);
        }
        (emergencyStatus.regency_level || []).forEach((entry) => {
          rows.push([entry.region, `${entry.status} — ${entry.duration || ""}`]);
        });
        emergencyList.replaceChildren(
          ...rows.map(([label, value]) => {
            const row = document.createElement("div");
            row.className = "sector-status-row";
            const span = document.createElement("span");
            span.textContent = label;
            const strong = document.createElement("strong");
            strong.textContent = value;
            row.append(span, strong);
            return row;
          })
        );
      }
      if (emergencyStatus?.provincial?.note) {
        setText("emergency-status-note", emergencyStatus.provincial.note);
      }

      const bpbd = data.bpbd_reports;
      const bpbdList = byId("bpbd-reports-list");
      if (bpbd && bpbdList) {
        const rows = [
          bpbd.bpbd_ntt && ["BPBD NTT", bpbd.bpbd_ntt.spokesperson || "Reported"],
          bpbd.bpbd_ntb && ["BPBD NTB (Bima)", bpbd.bpbd_ntb.spokesperson || "Reported"],
          bpbd.bpbd_kota_bima && ["BPBD Kota Bima", "Field verification ongoing"],
        ].filter(Boolean);
        bpbdList.replaceChildren(
          ...rows.map(([label, value]) => {
            const row = document.createElement("div");
            row.className = "sector-status-row";
            const span = document.createElement("span");
            span.textContent = label;
            const strong = document.createElement("strong");
            strong.textContent = value;
            row.append(span, strong);
            return row;
          })
        );
      }

      const crossProvince = data.cross_province_impact;
      const ntbList = byId("cross-province-ntb-list");
      if (crossProvince?.west_nusa_tenggara?.damage && ntbList) {
        renderList("cross-province-ntb-list", crossProvince.west_nusa_tenggara.damage);
      }
    } catch (error) {
      console.error(error);
      setText("impact-validation-status", "Static fallback data shown");
    }
  };


  const mapValue = (value) =>
    value === undefined || value === null ? "Not reported" : formatNumber(value);

  const createMapPopup = (location, impact, healthDistrict) => {
    const casualty = impact.casualties_by_location?.[location.key] || {};
    const injuryValues = [
      casualty.injured_serious_kemenkes,
      casualty.injured_minor_kemenkes
    ].filter((value) => value !== undefined && value !== null);
    const totalInjured =
      injuryValues.length > 0
        ? injuryValues.reduce((total, value) => total + Number(value || 0), 0)
        : null;

    const popup = document.createElement("div");
    popup.className = "map-popup";

    const title = document.createElement("h3");
    title.textContent = location.label;

    const representative = document.createElement("p");
    representative.textContent = `Representative point: ${location.representative}`;

    const details = document.createElement("dl");
    const rows = [
      ["Population listed as affected", mapValue(healthDistrict?.affected_population)],
      ["Deaths — BNPB", mapValue(casualty.deaths_bnpb)],
      ["Deaths — Kemenkes", mapValue(casualty.deaths_kemenkes)],
      ["Injured — Kemenkes", mapValue(totalInjured)]
    ];
    rows.forEach(([label, value]) => {
      const term = document.createElement("dt");
      term.textContent = label;
      const definition = document.createElement("dd");
      definition.textContent = value;
      details.append(term, definition);
    });

    const source = document.createElement("a");
    source.href = impact.source?.url || "https://www.bnpb.go.id/";
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = "Open primary impact source";

    popup.append(title, representative, details, source);
    return popup;
  };

  const mapMarkerColour = (casualty) => {
    const reported = casualty?.deaths_bnpb ?? casualty?.deaths_kemenkes;
    if (reported === undefined || reported === null) return "#2a9d8f";
    if (Number(reported) >= 10) return "#c83f43";
    if (Number(reported) >= 1) return "#e58b2a";
    return "#2a9d8f";
  };

  const loadAffectedAreaMap = async () => {
    try {
      if (!window.L) throw new Error("Leaflet library is unavailable.");

      const mapElement = byId("disaster-map");
      if (!mapElement) return;

      const [impact, health] = await Promise.all([
        fetchJson(IMPACT_URL),
        fetchJson(HEALTH_URL)
      ]);

      const map = window.L.map(mapElement, {
        scrollWheelZoom: false,
        minZoom: 6
      });

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      }).addTo(map);

      const healthDistricts = new Map(
        (Array.isArray(health.districts) ? health.districts : []).map((district) => [
          district.name,
          district
        ])
      );
      const markerByArea = new Map();
      const markerGroup = window.L.featureGroup();

      AFFECTED_AREA_LOCATIONS.forEach((location) => {
        const casualty = impact.casualties_by_location?.[location.key] || {};
        const reported = casualty.deaths_bnpb ?? casualty.deaths_kemenkes ?? 0;
        const marker = window.L.circleMarker([location.lat, location.lng], {
          radius: Math.max(8, Math.min(18, 8 + Number(reported) * 0.4)),
          color: "#ffffff",
          weight: 2,
          fillColor: mapMarkerColour(casualty),
          fillOpacity: 0.88
        });

        marker.bindTooltip(location.label, {
          direction: "top",
          sticky: true,
          opacity: 0.95
        });
        marker.bindPopup(
          createMapPopup(location, impact, healthDistricts.get(location.key)),
          { maxWidth: 320 }
        );
        marker.addTo(markerGroup);
        markerByArea.set(location.key, marker);
      });

      markerGroup.addTo(map);
      map.fitBounds(markerGroup.getBounds(), { padding: [30, 30], maxZoom: 8 });
      window.L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

      document.querySelectorAll("[data-map-area]").forEach((button) => {
        button.addEventListener("click", () => {
          const marker = markerByArea.get(button.dataset.mapArea);
          if (!marker) return;
          map.flyTo(marker.getLatLng(), 9, { duration: 0.7 });
          marker.openPopup();
        });
      });

      setText("map-status", "OpenStreetMap loaded · 8 affected regencies");
      const status = byId("map-status");
      if (status) status.className = "feed-status is-live";
    } catch (error) {
      console.error(error);
      setText("map-status", "Map temporarily unavailable — affected-area list shown");
      const status = byId("map-status");
      if (status) status.className = "feed-status is-warning";
    }
  };

  const createFacilityItem = (facility) => {
    const article = document.createElement("article");
    article.className = "health-facility-item";

    const heading = document.createElement("div");
    heading.className = "health-facility-head";

    const name = document.createElement("strong");
    name.textContent = facility.name || "Health facility";

    const location = document.createElement("span");
    location.textContent = facility.location || "Location under verification";

    heading.append(name, location);

    const structural = document.createElement("p");
    structural.textContent = `Structural status: ${facility.structural_status || "Not reported"}`;

    const operations = document.createElement("p");
    operations.textContent = `Service status: ${facility.operational_status || "Not reported"}`;

    const confidence = document.createElement("small");
    confidence.textContent = facility.confidence || "Verification ongoing";

    article.append(heading, structural, operations, confidence);
    return article;
  };

  const createDiseaseRow = (condition) => {
    const row = document.createElement("div");
    row.className = "disease-row";

    const name = document.createElement("span");
    name.textContent = condition.name;

    const value = document.createElement("strong");
    value.textContent = condition.cases ?? condition.status ?? "Not reported";

    row.append(name, value);
    return row;
  };

  const loadHealthData = async () => {
    try {
      const data = await fetchJson(HEALTH_URL);
      setText("health-status", data.status_label);
      setText("health-updated", `Cut-off: ${data.updated_display}`);
      setText("health-affected-population", formatNumber(data.headline?.affected_population));
      setText("health-facilities-damaged", data.headline?.health_facilities_damaged ?? "—");
      setText("health-serious-injuries", data.headline?.injured_serious ?? "—");
      setText("health-minor-injuries", data.headline?.injured_minor ?? "—");
      setText("health-surveillance-status", data.disease_surveillance?.status);

      renderList("health-district-list", data.district_impact_summary);

      const facilities = byId("health-facilities-list");
      if (facilities && Array.isArray(data.facilities)) {
        facilities.replaceChildren(...data.facilities.map(createFacilityItem));
      }

      const diseases = byId("health-disease-list");
      if (diseases && Array.isArray(data.disease_surveillance?.conditions)) {
        diseases.replaceChildren(
          ...data.disease_surveillance.conditions.map(createDiseaseRow)
        );
      }

      const workforce = byId("health-workforce-list");
      if (workforce && Array.isArray(data.workforce)) {
        workforce.replaceChildren(...data.workforce.map(createSectorStatusRow));
      }

      renderList("health-response-list", data.emergency_response);
      setText(
        "health-logistics-date",
        `Planned dispatch: ${data.planned_logistics?.dispatch_date || "Not reported"}`
      );
      const logistics = byId("health-logistics-list");
      if (logistics && Array.isArray(data.planned_logistics?.items)) {
        logistics.replaceChildren(
          ...data.planned_logistics.items.map(createSectorStatusRow)
        );
      }

      renderList("health-data-quality-list", data.data_quality_notes);

      renderList("health-monitoring-list", data.monitoring_priorities);
    } catch (error) {
      console.error(error);
      setText("health-status", "Static fallback health data shown");
    }
  };

  const createSectorStatusRow = (item) => {
    const row = document.createElement("div");
    row.className = "sector-status-row";

    const label = document.createElement("span");
    label.textContent = item.label || "Indicator";

    const status = document.createElement("strong");
    status.textContent = item.status ?? "Not reported";

    row.append(label, status);
    return row;
  };

  const createSectorImpactItem = (item) => {
    const article = document.createElement("article");
    article.className = "sector-impact-item";

    const sector = document.createElement("strong");
    sector.textContent = item.sector || "Sector";

    const status = document.createElement("p");
    status.textContent = item.status || "Status under assessment";

    const confidence = document.createElement("small");
    confidence.textContent = item.confidence || "Verification ongoing";

    article.append(sector, status, confidence);
    return article;
  };

  const loadSectorImpactData = async () => {
    try {
      const data = await fetchJson(SECTOR_IMPACT_URL);
      const sar = data.sar || {};
      const forwarded = sar.forwarded_sitrep || {};
      const qrsar = sar.qrsar || {};

      setText("sar-status", sar.status_label);
      setText("sar-forwarded-deaths", forwarded.deaths);
      setText("sar-forwarded-injured", forwarded.injured);
      setText("sar-forwarded-trapped", forwarded.trapped);
      setText(
        "sar-forwarded-cutoff",
        `Field cut-off stated: ${forwarded.field_cutoff_display || "Not reported"}.`
      );
      setText("sar-qrsar-deaths", qrsar.deaths_recorded);
      setText("sar-qrsar-search", qrsar.in_search_recorded);
      const qrsarTime = String(qrsar.source_updated_display || "").match(/·\s*(\d{2}:\d{2})/);
      setText("sar-qrsar-updated", qrsarTime?.[1] || "—");
      renderList("sar-movement-list", forwarded.movements);
      setText("sar-caveat-text", sar.disclaimer);

      const animal = data.animal_health || {};
      setText("animal-health-status", animal.status_label);
      setText(
        "animal-cattle-baseline",
        Number(animal.baseline?.cattle_population_ntt_2026 || 0).toLocaleString("en-US")
      );

      const indicators = Array.isArray(animal.indicators) ? animal.indicators : [];
      const indicatorStatus = (pattern) =>
        indicators.find((item) => pattern.test(String(item.label || "")))?.status || "Not reported";
      setText("animal-deaths", indicatorStatus(/deaths|injuries|missing/i));
      setText("animal-facilities", indicatorStatus(/Puskeswan|veterinary/i));
      setText("animal-disease-events", indicatorStatus(/zoonotic|disease/i));

      const animalList = byId("animal-health-indicators");
      if (animalList) {
        animalList.replaceChildren(...indicators.map(createSectorStatusRow));
      }
      renderList("animal-health-priorities", animal.monitoring_priorities);

      const economic = data.economic_impact || {};
      const economicHeadline = economic.headline || {};
      setText("economic-status", economic.status_label);
      setText(
        "economic-monetary-loss",
        economicHeadline.monetary_damage_and_loss_idr ?? "Not available"
      );
      setText("economic-bts", economicHeadline.telecom_sites_disrupted);
      setText("economic-transport", economicHeadline.affected_transport_facilities_named);
      setText("economic-bulog", economicHeadline.bulog_warehouses_affected);

      const economicList = byId("economic-impact-list");
      if (economicList && Array.isArray(economic.known_impacts)) {
        economicList.replaceChildren(
          ...economic.known_impacts.map(createSectorImpactItem)
        );
      }
      renderList("economic-gaps-list", economic.information_gaps);

      const childProtection = data.child_protection;
      if (childProtection) {
        const sectorList = byId("child-protection-sectors");
        if (sectorList && Array.isArray(childProtection.priority_response_sectors)) {
          sectorList.replaceChildren(
            ...childProtection.priority_response_sectors.map((entry) => {
              const row = document.createElement("div");
              row.className = "sector-status-row";
              const span = document.createElement("span");
              span.textContent = entry.sector;
              const strong = document.createElement("strong");
              strong.textContent = entry.focus;
              row.append(span, strong);
              return row;
            })
          );
        }
        setText(
          "child-protection-hazards",
          [childProtection.compounding_hazards?.note, childProtection.response_status]
            .filter(Boolean)
            .join(" ")
        );
      }
    } catch (error) {
      console.error(error);
      setText("sar-status", "Static SAR snapshot shown");
      setText("animal-health-status", "Static animal-health assessment fields shown");
      setText("economic-status", "Static economic-impact assessment fields shown");
    }
  };

  const createReportCard = (report) => {
    const article = document.createElement("article");
    article.className = "report-card";

    const icon = document.createElement("div");
    icon.className = "report-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = report.format || "PDF";

    const content = document.createElement("div");
    content.className = "report-content";

    const title = document.createElement("h3");
    title.textContent = report.subtitle || report.title;

    const name = document.createElement("p");
    name.className = "report-name";
    name.textContent = report.title;

    const meta = document.createElement("div");
    meta.className = "report-meta";
    meta.textContent = `${report.publisher} · ${report.date} · ${report.pages} pages · ${report.language}`;

    const description = document.createElement("p");
    description.textContent = report.description;

    const download = document.createElement("a");
    download.className = "download-button";
    download.href = report.file;
    download.setAttribute("download", "");
    download.textContent = "Download PDF";

    content.append(title, name, meta, description, download);
    article.append(icon, content);
    return article;
  };

  const loadReportsData = async () => {
    try {
      const data = await fetchJson(REPORTS_URL);
      const reports = byId("reports-list");
      if (reports && Array.isArray(data.reports)) {
        reports.replaceChildren(...data.reports.map(createReportCard));
      }
    } catch (error) {
      console.error(error);
      setText("reports-status", "Static archive listing shown");
    }
  };

  loadImpactData();
  loadAffectedAreaMap();
  loadHealthData();
  loadSectorImpactData();
  loadReportsData();
  loadBmkgFeed();
  window.setInterval(loadBmkgFeed, REFRESH_MS);
})();
