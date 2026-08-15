"use strict";

(() => {
  const BMKG_URL = "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json";
  const IMPACT_URL = "data/impact.json";
  const HEALTH_URL = "data/health.json";
  const REPORTS_URL = "data/reports.json";
  const REFRESH_MS = 5 * 60 * 1000;

  const byId = (id) => document.getElementById(id);

  const setText = (id, value) => {
    const element = byId(id);
    if (element && value !== undefined && value !== null) {
      element.textContent = value;
    }
  };

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
      setText(
        "impact-displacement",
        Number(data.displacement?.self_evacuated_approx || 0).toLocaleString("en-US")
      );

      renderList("impact-confirmed-list", data.confirmed);
      renderList("impact-damage-list", data.damage_reports);
      renderList("impact-gaps-list", data.information_gaps);

      const sourceLink = byId("impact-source-link");
      if (sourceLink && data.source?.url) {
        sourceLink.href = data.source.url;
        sourceLink.textContent = data.source.agency || "Official source";
      }
    } catch (error) {
      console.error(error);
      setText("impact-validation-status", "Static fallback data shown");
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
      setText("health-facilities-damaged", data.headline?.health_facilities_damaged ?? "—");
      setText("health-serious-injuries", data.headline?.injured_serious ?? "—");
      setText("health-minor-injuries", data.headline?.injured_minor ?? "—");
      setText("health-surveillance-status", data.disease_surveillance?.status);

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

      renderList("health-monitoring-list", data.monitoring_priorities);
    } catch (error) {
      console.error(error);
      setText("health-status", "Static fallback health data shown");
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
  loadHealthData();
  loadReportsData();
  loadBmkgFeed();
  window.setInterval(loadBmkgFeed, REFRESH_MS);
})();
